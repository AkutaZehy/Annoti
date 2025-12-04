import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_windows/webview_windows.dart';
import '../models/annotation.dart';

/// Controller for WebView management and JavaScript Bridge
class WebViewController {
  WebviewController? _webViewController;
  final Function(String text, String anchorId, int startOffset, int endOffset)?
      onTextSelected;
  final Function(String annotationId)? onAnnotationClicked;

  WebViewController({
    this.onTextSelected,
    this.onAnnotationClicked,
  });

  /// Initialize WebView controller
  void setWebViewController(WebviewController controller) {
    _webViewController = controller;
  }

  /// Load HTML content into WebView
  Future<void> loadHtmlContent(String htmlContent) async {
    if (_webViewController == null) return;

    await _webViewController!.loadStringContent(htmlContent);
  }

  /// Inject JavaScript to highlight an annotation
  /// Note: Improved implementation to handle formatted text and cross-element highlighting
  Future<void> highlightAnnotation(Annotation annotation) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      try {
        // Create highlight for annotation
        const anchorId = '${annotation.anchorId}';
        const annotationId = '${annotation.id}';
        const text = ${_escapeJsString(annotation.selectedText)};
        
        // Find and highlight text using improved algorithm
        highlightTextByAnchor(anchorId, annotationId, text);
      } catch (e) {
        console.error('Error highlighting annotation:', e);
      }
    })();
    
    function highlightTextByAnchor(anchorId, annotationId, text) {
      const body = document.querySelector('.markdown-body');
      if (!body) return;
      
      // Use a more robust highlighting approach that handles formatted text
      highlightTextInElement(body, text, annotationId);
    }
    
    function highlightTextInElement(element, searchText, annotationId) {
      // Get all text content and find the search text
      const textContent = element.textContent;
      const index = textContent.indexOf(searchText);
      
      if (index === -1) return false;
      
      // Find the text nodes that contain our search text
      let currentPos = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;
      let searchLength = searchText.length;
      
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
        
        // Check if this node contains the start of our search text
        if (startNode === null && index >= currentPos && index < nodeEnd) {
          startNode = node;
          startOffset = index - currentPos;
        }
        
        // Check if this node contains the end of our search text
        if (startNode !== null && (index + searchLength) <= nodeEnd) {
          endNode = node;
          endOffset = (index + searchLength) - currentPos;
          break;
        }
        
        currentPos = nodeEnd;
      }
      
      if (!startNode || !endNode) return false;
      
      try {
        // Create a range spanning from start to end
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        
        // Extract the contents
        const contents = range.extractContents();
        
        // Create mark element
        const mark = document.createElement('mark');
        mark.className = 'annotation-highlight';
        mark.setAttribute('data-annotation-id', annotationId);
        mark.appendChild(contents);
        
        // Insert the mark element
        range.insertNode(mark);
        
        return true;
      } catch (e) {
        console.error('Error creating highlight:', e);
        return false;
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
      const marks = document.querySelectorAll('[data-annotation-id="${annotationId}"]');
      marks.forEach(mark => {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      });
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Clear all highlights
  Future<void> clearAllHighlights() async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      const marks = document.querySelectorAll('.annotation-highlight');
      marks.forEach(mark => {
        const parent = mark.parentNode;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      });
    })();
    ''';

    await _webViewController!.executeScript(script);
  }

  /// Scroll to annotation
  Future<void> scrollToAnnotation(String annotationId) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      const mark = document.querySelector('[data-annotation-id="${annotationId}"]');
      if (mark) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
