import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_windows/webview_windows.dart';
import '../models/annotation.dart';

/// Controller for WebView management and JavaScript Bridge
/// Uses CSS overlay-based highlighting instead of DOM manipulation
class WebViewController {
  WebviewController? _webViewController;
  final Function(String text, String anchorId, int startOffset, int endOffset)?
      onTextSelected;
  final Function(String annotationId)? onAnnotationClicked;
  
  // Highlighting mode: 'text' for text-only or 'box' for box selection
  String _highlightMode = 'box';

  WebViewController({
    this.onTextSelected,
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

  /// Inject JavaScript to highlight an annotation using overlay system
  /// Creates CSS overlays instead of modifying DOM - works with all text types
  Future<void> highlightAnnotation(Annotation annotation) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      try {
        const anchorId = '${annotation.anchorId}';
        const annotationId = '${annotation.id}';
        const text = ${_escapeJsString(annotation.selectedText)};
        const mode = window.annotationHighlightMode || 'box';
        
        // Create overlay highlight using bounding rectangles
        createOverlayHighlight(anchorId, annotationId, text, mode);
      } catch (e) {
        console.error('Error highlighting annotation:', e);
      }
    })();
    
    function createOverlayHighlight(anchorId, annotationId, text, mode) {
      // Find the text in document
      const body = document.querySelector('.markdown-body');
      if (!body) return;
      
      // Try to find text using anchor path first
      let range = findTextByAnchor(anchorId, body);
      
      // Fallback to text search if anchor fails
      if (!range) {
        range = findTextInElement(body, text);
      }
      
      if (!range) {
        console.error('Could not find text to highlight');
        return;
      }
      
      // Get bounding rectangles for the range
      const rects = range.getClientRects();
      if (rects.length === 0) return;
      
      // Create overlay container if it doesn't exist
      let overlayContainer = document.getElementById('annotation-overlay-container');
      if (!overlayContainer) {
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'annotation-overlay-container';
        overlayContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;';
        document.body.appendChild(overlayContainer);
      }
      
      // Remove existing overlays for this annotation
      const existing = overlayContainer.querySelectorAll(`[data-annotation-id="${annotationId}"]`);
      existing.forEach(el => el.remove());
      
      // Create highlights based on mode
      if (mode === 'box') {
        // Box mode: create a single box around the entire selection
        const boundingRect = range.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        const overlay = document.createElement('div');
        overlay.className = 'annotation-overlay annotation-overlay-box';
        overlay.setAttribute('data-annotation-id', annotationId);
        overlay.style.cssText = `
          position: absolute;
          left: ${boundingRect.left + scrollLeft}px;
          top: ${boundingRect.top + scrollTop}px;
          width: ${boundingRect.width}px;
          height: ${boundingRect.height}px;
          background-color: rgba(255, 243, 205, 0.5);
          border: 2px solid #ffc107;
          pointer-events: auto;
          cursor: pointer;
        `;
        
        overlay.addEventListener('click', function() {
          notifyAnnotationClick(annotationId);
        });
        
        overlayContainer.appendChild(overlay);
      } else {
        // Text mode: create overlays for each line
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          if (rect.width === 0 || rect.height === 0) continue;
          
          const overlay = document.createElement('div');
          overlay.className = 'annotation-overlay annotation-overlay-text';
          overlay.setAttribute('data-annotation-id', annotationId);
          overlay.style.cssText = `
            position: absolute;
            left: ${rect.left + scrollLeft}px;
            top: ${rect.top + scrollTop}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            background-color: rgba(255, 243, 205, 0.6);
            border-bottom: 2px solid #ffc107;
            pointer-events: auto;
            cursor: pointer;
          `;
          
          overlay.addEventListener('click', function() {
            notifyAnnotationClick(annotationId);
          });
          
          overlayContainer.appendChild(overlay);
        }
      }
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

  /// Remove highlight for an annotation
  Future<void> removeHighlight(String annotationId) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (overlayContainer) {
        const overlays = overlayContainer.querySelectorAll('[data-annotation-id="${annotationId}"]');
        overlays.forEach(overlay => overlay.remove());
      }
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Clear all highlights
  Future<void> clearAllHighlights() async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (overlayContainer) {
        overlayContainer.remove();
      }
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Scroll to annotation
  Future<void> scrollToAnnotation(String annotationId) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      const overlayContainer = document.getElementById('annotation-overlay-container');
      if (overlayContainer) {
        const overlay = overlayContainer.querySelector('[data-annotation-id="${annotationId}"]');
        if (overlay) {
          const rect = overlay.getBoundingClientRect();
          const absoluteTop = rect.top + window.pageYOffset;
          window.scrollTo({
            top: absoluteTop - window.innerHeight / 2 + rect.height / 2,
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
