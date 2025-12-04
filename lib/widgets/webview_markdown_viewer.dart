import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:markdown/markdown.dart' as md;
import 'dart:convert';
import '../main.dart';

class WebViewMarkdownViewer extends StatefulWidget {
  final String markdownContent;
  final List<Annotation> annotations;
  final Function(String text, int startOffset, int endOffset) onAnnotationCreate;

  const WebViewMarkdownViewer({
    super.key,
    required this.markdownContent,
    required this.annotations,
    required this.onAnnotationCreate,
  });

  @override
  State<WebViewMarkdownViewer> createState() => WebViewMarkdownViewerState();
}

class WebViewMarkdownViewerState extends State<WebViewMarkdownViewer> {
  InAppWebViewController? _webViewController;
  bool _isPageLoaded = false;

  @override
  void didUpdateWidget(WebViewMarkdownViewer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.markdownContent != widget.markdownContent) {
      _loadContent();
    } else if (oldWidget.annotations != widget.annotations) {
      _applyAnnotations();
    }
  }

  String _generateHTML() {
    // Convert markdown to HTML
    final htmlContent = md.markdownToHtml(
      widget.markdownContent,
      extensionSet: md.ExtensionSet.gitHubFlavored,
    );

    // GitHub-style CSS with Chinese font support
    const css = '''
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", 
                       "Microsoft YaHei", "微软雅黑", "PingFang SC", 
                       "Hiragino Sans GB", "Source Han Sans CN", 
                       "Noto Sans CJK SC", sans-serif;
          font-size: 16px;
          line-height: 1.6;
          color: #24292e;
          background-color: #ffffff;
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }
        h1, h2, h3, h4, h5, h6 {
          margin-top: 24px;
          margin-bottom: 16px;
          font-weight: 600;
          line-height: 1.25;
        }
        h1 {
          font-size: 2em;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 0.3em;
        }
        h2 {
          font-size: 1.5em;
          border-bottom: 1px solid #eaecef;
          padding-bottom: 0.3em;
        }
        h3 { font-size: 1.25em; }
        h4 { font-size: 1em; }
        h5 { font-size: 0.875em; }
        h6 { font-size: 0.85em; color: #6a737d; }
        p {
          margin-top: 0;
          margin-bottom: 16px;
        }
        code {
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          background-color: rgba(27, 31, 35, 0.05);
          border-radius: 3px;
          font-family: "Consolas", "Monaco", "Courier New", monospace;
        }
        pre {
          padding: 16px;
          overflow: auto;
          font-size: 85%;
          line-height: 1.45;
          background-color: #f6f8fa;
          border-radius: 3px;
          margin-bottom: 16px;
        }
        pre code {
          display: inline;
          padding: 0;
          margin: 0;
          overflow: visible;
          line-height: inherit;
          word-wrap: normal;
          background-color: transparent;
          border: 0;
        }
        blockquote {
          padding: 0 1em;
          color: #6a737d;
          border-left: 0.25em solid #dfe2e5;
          margin-bottom: 16px;
        }
        ul, ol {
          padding-left: 2em;
          margin-bottom: 16px;
        }
        li {
          margin-top: 0.25em;
        }
        table {
          border-spacing: 0;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        table th, table td {
          padding: 6px 13px;
          border: 1px solid #dfe2e5;
        }
        table tr {
          background-color: #fff;
          border-top: 1px solid #c6cbd1;
        }
        table tr:nth-child(2n) {
          background-color: #f6f8fa;
        }
        a {
          color: #0366d6;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        hr {
          height: 0.25em;
          padding: 0;
          margin: 24px 0;
          background-color: #e1e4e8;
          border: 0;
        }
        mark.annotation-highlight {
          background-color: #fff3cd;
          cursor: pointer;
        }
        mark.annotation-highlight:hover {
          background-color: #ffe69c;
        }
      </style>
    ''';

    // JavaScript for selection handling and highlighting
    const javascript = '''
      <script>
        // Store annotations data
        let annotations = [];
        
        // Handle text selection
        document.addEventListener('mouseup', function(e) {
          const selection = window.getSelection();
          if (selection && selection.toString().trim().length > 0) {
            const range = selection.getRangeAt(0);
            const selectedText = selection.toString();
            
            // Calculate approximate offset (this is a simplified approach)
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(document.body);
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            const startOffset = preCaretRange.toString().length;
            const endOffset = startOffset + selectedText.length;
            
            // Send to Flutter
            window.flutter_inappwebview.callHandler('onTextSelected', {
              text: selectedText,
              startOffset: startOffset,
              endOffset: endOffset
            });
          }
        });
        
        // Function to apply highlights
        function applyHighlights(annotationsData) {
          // Clear existing highlights
          const existingHighlights = document.querySelectorAll('mark.annotation-highlight');
          existingHighlights.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
          });
          
          annotations = annotationsData;
          
          // Apply new highlights using text content matching
          annotationsData.forEach((annotation, index) => {
            highlightText(annotation.content, index);
          });
        }
        
        // Function to highlight specific text
        function highlightText(searchText, annotationId) {
          const bodyText = document.body.innerHTML;
          const searchRegex = new RegExp(escapeRegExp(searchText), 'gi');
          
          // Simple text replacement approach
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          const nodesToReplace = [];
          let node;
          while (node = walker.nextNode()) {
            const text = node.textContent;
            const index = text.indexOf(searchText);
            if (index !== -1) {
              nodesToReplace.push({node, index, length: searchText.length});
              break; // Only highlight first occurrence
            }
          }
          
          nodesToReplace.forEach(({node, index, length}) => {
            const before = node.textContent.substring(0, index);
            const match = node.textContent.substring(index, index + length);
            const after = node.textContent.substring(index + length);
            
            const mark = document.createElement('mark');
            mark.className = 'annotation-highlight';
            mark.setAttribute('data-annotation-id', annotationId);
            mark.textContent = match;
            
            const fragment = document.createDocumentFragment();
            if (before) fragment.appendChild(document.createTextNode(before));
            fragment.appendChild(mark);
            if (after) fragment.appendChild(document.createTextNode(after));
            
            node.parentNode.replaceChild(fragment, node);
          });
        }
        
        function escapeRegExp(string) {
          return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        }
        
        // Context menu for annotations
        document.addEventListener('contextmenu', function(e) {
          const selection = window.getSelection();
          if (selection && selection.toString().trim().length > 0) {
            e.preventDefault();
            // Trigger selection handler
            const event = new MouseEvent('mouseup', {bubbles: true});
            document.dispatchEvent(event);
          }
        });
      </script>
    ''';

    return '''
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        $css
      </head>
      <body>
        $htmlContent
        $javascript
      </body>
      </html>
    ''';
  }

  void _loadContent() {
    if (_webViewController != null) {
      final html = _generateHTML();
      _webViewController!.loadData(data: html);
      _isPageLoaded = false;
    }
  }

  Future<void> _applyAnnotations() async {
    if (_webViewController != null && _isPageLoaded) {
      final annotationsJson = jsonEncode(
        widget.annotations.map((a) => {
          'content': a.content,
          'startIndex': a.startIndex,
          'endIndex': a.endIndex,
          'note': a.note,
        }).toList(),
      );
      
      await _webViewController!.evaluateJavascript(
        source: 'applyHighlights($annotationsJson);',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      initialData: InAppWebViewInitialData(
        data: _generateHTML(),
      ),
      initialSettings: InAppWebViewSettings(
        transparentBackground: true,
        disableContextMenu: false,
        supportZoom: false,
        javaScriptEnabled: true,
      ),
      onWebViewCreated: (controller) {
        _webViewController = controller;
        
        // Register handler for text selection
        controller.addJavaScriptHandler(
          handlerName: 'onTextSelected',
          callback: (args) {
            if (args.isNotEmpty) {
              final data = args[0];
              final text = data['text'] as String;
              final startOffset = data['startOffset'] as int;
              final endOffset = data['endOffset'] as int;
              
              widget.onAnnotationCreate(text, startOffset, endOffset);
            }
          },
        );
      },
      onLoadStop: (controller, url) {
        _isPageLoaded = true;
        _applyAnnotations();
      },
    );
  }
}
