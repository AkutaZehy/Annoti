import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_windows/webview_windows.dart';
import '../models/annotation.dart';

/// Controller for WebView management and JavaScript Bridge
/// Uses CSS overlay-based highlighting instead of DOM manipulation
class AnnotiWebViewController {
  WebviewController? _webViewController;
  final Function(String text, String anchorId, int startOffset, int endOffset)?
      onTextSelected;
  final Function(double left, double top, double width, double height, String anchorId)?
      onBoxDrawn;
  final Function(String annotationId)? onAnnotationClicked;
  
  // Highlighting mode: 'text' for text-only or 'box' for box selection
  String _highlightMode = 'box';

  AnnotiWebViewController({
    this.onTextSelected,
    this.onBoxDrawn,
    this.onAnnotationClicked,
  });

  /// Initialize WebView controller
  void setWebViewController(WebviewController controller) {
    _webViewController = controller;
  }
  
  /// Set highlight mode
  Future<void> setHighlightMode(String mode) async {
    _highlightMode = mode;
    if (_webViewController != null) {
      await _webViewController!.executeScript('''
        window.annotationHighlightMode = '$mode';
      ''');
    }
  }

  /// Load HTML content into WebView
  Future<void> loadHtmlContent(String htmlContent) async {
    if (_webViewController == null) return;

    await _webViewController!.loadStringContent(htmlContent);
  }

  /// Inject JavaScript to highlight an annotation
  /// Each annotation has its own highlightType ('text' or 'box')
  Future<void> highlightAnnotation(Annotation annotation) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      try {
        const anchorId = '${annotation.anchorId}';
        const annotationId = '${annotation.id}';
        const text = ${_escapeJsString(annotation.selectedText)};
        const highlightType = '${annotation.highlightType}';
        
        if (highlightType === 'text') {
          // Text mode: traverse DOM and wrap text nodes with <mark> tags
          highlightTextInDOM(anchorId, annotationId, text);
        } else {
          // Box mode: create CSS overlay
          highlightWithOverlay(anchorId, annotationId, text);
        }
      } catch (e) {
        console.error('Error highlighting annotation:', e);
      }
    })();
    
    // Text mode: Traverse DOM and wrap text nodes
    function highlightTextInDOM(anchorId, annotationId, text) {
      const body = document.querySelector('.markdown-body');
      if (!body) return;
      
      // Find the range
      let range = findTextByAnchor(anchorId, body);
      if (!range) {
        range = findTextInElement(body, text);
      }
      if (!range) {
        console.error('Could not find text to highlight');
        return;
      }
      
      // Remove existing highlights for this annotation
      const existing = body.querySelectorAll('mark[data-annotation-id="' + annotationId + '"]');
      existing.forEach(mark => {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize(); // Merge adjacent text nodes
      });
      
      // Extract contents and wrap each text node
      try {
        // Get all text nodes within the range using proper DOM traversal
        function getTextNodesInRange(range) {
          const textNodes = [];
          const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            // Check if this text node is within the range
            const nodeRange = document.createRange();
            nodeRange.selectNodeContents(node);
            
            // Check if ranges intersect
            if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0 &&
                range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0) {
              textNodes.push(node);
            }
          }
          
          return textNodes;
        }
        
        // Find all text nodes within the selection range
        const textNodes = getTextNodesInRange(range);
        
        // Process each text node
        for (let i = 0; i < textNodes.length; i++) {
          const textNode = textNodes[i];
          const nodeRange = document.createRange();
          
          // Determine start and end offsets for this node
          let startOffset = 0;
          let endOffset = textNode.length;
          
          // For the first text node, check if it's the range's start container
          if (textNode === range.startContainer) {
            startOffset = range.startOffset;
          } else {
            // Check if this node comes after range start
            const tempRange = document.createRange();
            tempRange.selectNodeContents(textNode);
            if (range.compareBoundaryPoints(Range.START_TO_START, tempRange) < 0) {
              // Range starts before this node, include from beginning
              startOffset = 0;
            }
          }
          
          // For the last text node, check if it's the range's end container
          if (textNode === range.endContainer) {
            endOffset = range.endOffset;
          } else {
            // Check if this node comes before range end
            const tempRange = document.createRange();
            tempRange.selectNodeContents(textNode);
            if (range.compareBoundaryPoints(Range.END_TO_END, tempRange) > 0) {
              // Range ends after this node, include to end
              endOffset = textNode.length;
            }
          }
          
          // Skip if no content to wrap
          if (startOffset >= endOffset || startOffset >= textNode.length) continue;
          
          // Create range for this portion
          nodeRange.setStart(textNode, startOffset);
          nodeRange.setEnd(textNode, Math.min(endOffset, textNode.length));
          
          // Create mark element
          const mark = document.createElement('mark');
          mark.setAttribute('data-annotation-id', annotationId);
          mark.style.cssText = 'background-color: #fff3cd; border-bottom: 2px solid #ffc107; cursor: pointer;';
          mark.addEventListener('click', function() {
            notifyAnnotationClick(annotationId);
          });
          
          // Wrap the content
          try {
            nodeRange.surroundContents(mark);
          } catch (e) {
            // If surroundContents fails (e.g., range crosses element boundaries),
            // use extractContents + appendChild approach
            const fragment = nodeRange.extractContents();
            mark.appendChild(fragment);
            nodeRange.insertNode(mark);
          }
        }
      } catch (e) {
        console.error('Error wrapping text nodes:', e);
      }
    }
    
    // Box mode: Create CSS overlay (position-based)
    function highlightWithOverlay(anchorId, annotationId, text) {
      const body = document.querySelector('.markdown-body');
      if (!body) return;
      
      // Create overlay container if needed
      let overlayContainer = document.getElementById('annotation-overlay-container');
      if (!overlayContainer) {
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'annotation-overlay-container';
        overlayContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 100;';
        document.body.appendChild(overlayContainer);
        
        // Add window resize listener to recalculate positions
        if (!window.annotationResizeListener) {
          window.annotationResizeListener = function() {
            recalculateAllOverlays();
          };
          window.addEventListener('resize', window.annotationResizeListener);
        }
      }
      
      // Remove existing overlays
      const existing = overlayContainer.querySelectorAll('[data-annotation-id="' + annotationId + '"]');
      existing.forEach(el => el.remove());
      
      // Check if this is a box annotation (anchorId starts with 'box:')
      let boundingRect;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      const bodyRect = body.getBoundingClientRect();
      
      if (anchorId.startsWith('box:')) {
        // Box annotation - extract coordinates from anchorId
        try {
          const boxDataStr = anchorId.substring(4); // Remove 'box:' prefix
          const boxData = JSON.parse(boxDataStr);
          boundingRect = {
            left: boxData.left + bodyRect.left,
            top: boxData.top + bodyRect.top,
            width: boxData.width,
            height: boxData.height
          };
        } catch (e) {
          console.error('Error parsing box data:', e);
          return;
        }
      } else {
        // Text-based box annotation - find the range
        let range = findTextByAnchor(anchorId, body);
        if (!range) {
          range = findTextInElement(body, text);
        }
        if (!range) {
          console.error('Could not find text to highlight');
          return;
        }
        boundingRect = range.getBoundingClientRect();
      }
      
      // Create box overlay
      const overlay = document.createElement('div');
      overlay.className = 'annotation-overlay annotation-overlay-box';
      overlay.setAttribute('data-annotation-id', annotationId);
      overlay.setAttribute('data-anchor-id', anchorId);
      overlay.style.cssText = 
        'position: absolute;' +
        'left: ' + (boundingRect.left + scrollLeft) + 'px;' +
        'top: ' + (boundingRect.top + scrollTop) + 'px;' +
        'width: ' + boundingRect.width + 'px;' +
        'height: ' + boundingRect.height + 'px;' +
        'background-color: rgba(255, 243, 205, 1);' +
        'border: 2px solid #ffc107;' +
        'pointer-events: auto;' +
        'cursor: pointer;';
      
      overlay.addEventListener('click', function() {
        notifyAnnotationClick(annotationId);
      });
      
      overlayContainer.appendChild(overlay);
    }
    
    // Recalculate all overlay positions on window resize
    function recalculateAllOverlays() {
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (!overlayContainer) return;
      
      const body = document.querySelector('.markdown-body');
      if (!body) return;
      
      const overlays = overlayContainer.querySelectorAll('.annotation-overlay-box');
      overlays.forEach(overlay => {
        const annotationId = overlay.getAttribute('data-annotation-id');
        const anchorId = overlay.getAttribute('data-anchor-id');
        const text = overlay.getAttribute('data-range-text');
        
        if (!anchorId || !text) return;
        
        // Find the range again
        let range = findTextByAnchor(anchorId, body);
        if (!range) {
          range = findTextInElement(body, text);
        }
        if (!range) return;
        
        // Recalculate position
        const boundingRect = range.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        overlay.style.left = (boundingRect.left + scrollLeft) + 'px';
        overlay.style.top = (boundingRect.top + scrollTop) + 'px';
        overlay.style.width = boundingRect.width + 'px';
        overlay.style.height = boundingRect.height + 'px';
      });
    }
    
    function findTextByAnchor(anchorId, body) {
      try {
        const parts = anchorId.split('_').filter(p => p !== 'anchor' && p !== '');
        if (parts.length === 0) return null;
        
        const nodePath = parts.slice(0, -1).map(p => parseInt(p));
        const anchorOffset = parseInt(parts[parts.length - 1]);
        
        let currentNode = body;
        for (const index of nodePath) {
          if (currentNode.childNodes && currentNode.childNodes[index]) {
            currentNode = currentNode.childNodes[index];
          } else {
            return null;
          }
        }
        
        if (currentNode.nodeType === Node.TEXT_NODE) {
          const range = document.createRange();
          range.setStart(currentNode, anchorOffset);
          return range;
        }
      } catch (e) {
        console.error('Error finding text by anchor:', e);
      }
      return null;
    }
    
    function findTextInElement(element, searchText) {
      const textContent = element.textContent;
      const index = textContent.indexOf(searchText);
      
      if (index === -1) return null;
      
      let currentPos = 0;
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const nodeLength = node.textContent.length;
        const nodeEnd = currentPos + nodeLength;
        
        if (index >= currentPos && index < nodeEnd) {
          const range = document.createRange();
          const startOffset = index - currentPos;
          range.setStart(node, startOffset);
          
          // Find end position
          let remaining = searchText.length - (nodeLength - startOffset);
          if (remaining <= 0) {
            range.setEnd(node, startOffset + searchText.length);
          } else {
            range.setEnd(node, nodeLength);
            let endNode = node;
            while (remaining > 0 && (endNode = walker.nextNode())) {
              if (remaining <= endNode.textContent.length) {
                range.setEnd(endNode, remaining);
                break;
              }
              remaining -= endNode.textContent.length;
            }
          }
          
          return range;
        }
        
        currentPos = nodeEnd;
      }
      
      return null;
    }
    
    function notifyAnnotationClick(annotationId) {
      if (window.chrome && window.chrome.webview) {
        const data = {
          handler: 'onAnnotationClicked',
          annotationId: annotationId
        };
        window.chrome.webview.postMessage(JSON.stringify(data));
      }
    }
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Highlight multiple annotations
  Future<void> highlightAnnotations(List<Annotation> annotations) async {
    for (final annotation in annotations) {
      await highlightAnnotation(annotation);
    }
  }

  /// Remove highlight for an annotation - handles both text and box modes
  Future<void> removeHighlight(String annotationId) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      // Remove text mode highlights (mark tags)
      const body = document.querySelector('.markdown-body');
      if (body) {
        const marks = body.querySelectorAll('mark[data-annotation-id="' + annotationId + '"]');
        marks.forEach(mark => {
          const parent = mark.parentNode;
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
          parent.normalize();
        });
      }
      
      // Remove box mode highlights (overlays)
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (overlayContainer) {
        const overlays = overlayContainer.querySelectorAll('[data-annotation-id="' + annotationId + '"]');
        overlays.forEach(overlay => overlay.remove());
      }
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Clear all highlights - both text and box modes
  Future<void> clearAllHighlights() async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      // Clear text mode highlights (mark tags)
      const body = document.querySelector('.markdown-body');
      if (body) {
        const marks = body.querySelectorAll('mark[data-annotation-id]');
        marks.forEach(mark => {
          const parent = mark.parentNode;
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
          parent.normalize();
        });
      }
      
      // Clear box mode highlights (overlays)
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (overlayContainer) {
        overlayContainer.remove();
      }
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Scroll to annotation - handles both text mode (mark tags) and box mode (overlays)
  Future<void> scrollToAnnotation(String annotationId) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      // Try text mode first (mark tags)
      const body = document.querySelector('.markdown-body');
      if (body) {
        const marks = body.querySelectorAll('mark[data-annotation-id="' + annotationId + '"]');
        if (marks.length > 0) {
          // Calculate center of all marks
          let minTop = Infinity;
          let maxBottom = -Infinity;
          
          marks.forEach(mark => {
            const rect = mark.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const absoluteTop = rect.top + scrollTop;
            const absoluteBottom = rect.bottom + scrollTop;
            minTop = Math.min(minTop, absoluteTop);
            maxBottom = Math.max(maxBottom, absoluteBottom);
          });
          
          const centerY = (minTop + maxBottom) / 2;
          window.scrollTo({
            top: centerY - window.innerHeight / 2,
            behavior: 'smooth'
          });
          return;
        }
      }
      
      // Fallback to box mode (overlays)
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (overlayContainer) {
        const overlays = overlayContainer.querySelectorAll('[data-annotation-id="' + annotationId + '"]');
        if (overlays.length > 0) {
          const overlay = overlays[0];
          const rect = overlay.getBoundingClientRect();
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const centerY = rect.top + scrollTop + rect.height / 2;
          
          window.scrollTo({
            top: centerY - window.innerHeight / 2,
            behavior: 'smooth'
          });
        }
      }
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Escape string for JavaScript
  String _escapeJsString(String str) {
    return jsonEncode(str);
  }

  /// Dispose controller
  void dispose() {
    _webViewController = null;
  }
}
