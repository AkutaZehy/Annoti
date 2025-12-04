import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview_windows/flutter_inappwebview_windows.dart';
import '../models/annotation.dart';

/// Controller for WebView management and JavaScript Bridge
class WebViewController {
  InAppWebViewController? _webViewController;
  final Function(String text, String anchorId, int startOffset, int endOffset)?
      onTextSelected;
  final Function(String annotationId)? onAnnotationClicked;

  WebViewController({
    this.onTextSelected,
    this.onAnnotationClicked,
  });

  /// Initialize WebView controller
  void setWebViewController(InAppWebViewController controller) {
    _webViewController = controller;
  }

  /// Load HTML content into WebView
  Future<void> loadHtmlContent(String htmlContent) async {
    if (_webViewController == null) return;

    await _webViewController!.loadData(
      data: htmlContent,
      mimeType: 'text/html',
      encoding: 'utf-8',
    );
  }

  /// Inject JavaScript to highlight an annotation
  Future<void> highlightAnnotation(Annotation annotation) async {
    if (_webViewController == null) return;

    final script = '''
    (function() {
      try {
        // Create highlight for annotation
        const anchorId = '${annotation.anchorId}';
        const annotationId = '${annotation.id}';
        const text = ${_escapeJsString(annotation.selectedText)};
        
        // Find and highlight text
        highlightTextByAnchor(anchorId, annotationId, text);
      } catch (e) {
        console.error('Error highlighting annotation:', e);
      }
    })();
    
    function highlightTextByAnchor(anchorId, annotationId, text) {
      // Simple implementation: highlight all occurrences of text
      // TODO: Improve to use actual anchor positioning
      const body = document.querySelector('.markdown-body');
      if (!body) return;
      
      const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      
      for (const textNode of textNodes) {
        const content = textNode.textContent;
        const index = content.indexOf(text);
        
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + text.length);
          
          const mark = document.createElement('mark');
          mark.className = 'annotation-highlight';
          mark.setAttribute('data-annotation-id', annotationId);
          
          range.surroundContents(mark);
          break; // Only highlight first occurrence
        }
      }
    }
    ''';

    await _webViewController!.evaluateJavascript(source: script);
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

    await _webViewController!.evaluateJavascript(source: script);
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

    await _webViewController!.evaluateJavascript(source: script);
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

    await _webViewController!.evaluateJavascript(source: script);
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
