import 'dart:io';
import 'package:markdown/markdown.dart' as md;
import 'package:path/path.dart' as path;

/// Service for HTML generation and management
/// Converts Markdown to HTML with GitHub-style CSS
class HtmlService {
  /// Convert Markdown content to HTML with CSS styling
  String convertMarkdownToHtml(String markdownContent) {
    final htmlBody = md.markdownToHtml(
      markdownContent,
      extensionSet: md.ExtensionSet.gitHubWeb,
    );

    return _wrapWithHtmlTemplate(htmlBody);
  }

  /// Get HTML file path for a source file
  /// Saves HTML in same-name directory with .html suffix
  /// Example: document.md -> document/document.html
  String getHtmlFilePath(String sourceFilePath) {
    final file = File(sourceFilePath);
    final dir = file.parent.path;
    final nameWithoutExt = path.basenameWithoutExtension(sourceFilePath);
    final htmlDir = path.join(dir, nameWithoutExt);
    return path.join(htmlDir, '$nameWithoutExt.html');
  }

  /// Get HTML directory path for a source file
  String getHtmlDirectoryPath(String sourceFilePath) {
    final file = File(sourceFilePath);
    final dir = file.parent.path;
    final nameWithoutExt = path.basenameWithoutExtension(sourceFilePath);
    return path.join(dir, nameWithoutExt);
  }

  /// Save HTML content to file
  Future<void> saveHtml(String sourceFilePath, String htmlContent) async {
    final htmlPath = getHtmlFilePath(sourceFilePath);
    final htmlDir = getHtmlDirectoryPath(sourceFilePath);

    // Create directory if it doesn't exist
    final dir = Directory(htmlDir);
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }

    // Write HTML file
    final file = File(htmlPath);
    await file.writeAsString(htmlContent);
  }

  /// Check if HTML file exists for source file
  Future<bool> htmlExists(String sourceFilePath) async {
    final htmlPath = getHtmlFilePath(sourceFilePath);
    final file = File(htmlPath);
    return await file.exists();
  }

  /// Read existing HTML file
  Future<String?> readHtml(String sourceFilePath) async {
    if (!await htmlExists(sourceFilePath)) return null;
    
    final htmlPath = getHtmlFilePath(sourceFilePath);
    final file = File(htmlPath);
    return await file.readAsString();
  }

  /// Wrap HTML content with template including GitHub-style CSS
  String _wrapWithHtmlTemplate(String bodyContent) {
    return '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${_getGithubCss()}
  </style>
</head>
<body>
  <div class="markdown-body">
    $bodyContent
  </div>
  <script>
    ${_getSelectionScript()}
  </script>
</body>
</html>
''';
  }

  /// GitHub-style CSS for Markdown rendering
  String _getGithubCss() {
    return '''
body {
  margin: 0;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #24292e;
  background-color: #ffffff;
}

.markdown-body {
  max-width: 980px;
  margin: 0 auto;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body h1 {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: 0.875em; }
.markdown-body h6 { font-size: 0.85em; color: #6a737d; }

.markdown-body p {
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body code {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

.markdown-body pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #f6f8fa;
  border-radius: 3px;
}

.markdown-body pre code {
  display: inline;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  background-color: transparent;
  border: 0;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body li {
  margin-top: 0.25em;
}

.markdown-body blockquote {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0 0 16px 0;
}

.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-top: 0;
  margin-bottom: 16px;
}

.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.markdown-body table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.markdown-body table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

.markdown-body img {
  max-width: 100%;
  box-sizing: content-box;
}

.markdown-body a {
  color: #0366d6;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

/* Overlay-based highlights (no DOM modification) */
.annotation-overlay {
  transition: opacity 0.2s;
}

.annotation-overlay:hover {
  opacity: 0.8;
}

.annotation-overlay-box {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.annotation-overlay-text {
  /* Precise text highlighting */
}
''';
  }

  /// JavaScript for text selection and annotation interaction
  String _getSelectionScript() {
    return '''
// Current highlight mode: 'text' or 'box'
window.annotationHighlightMode = 'text';

// Box drawing mode variables
let isDrawing = false;
let startX, startY;
let drawingBox = null;

// Send selection to Flutter (text mode)
function sendSelection() {
  try {
    // Only for text mode
    if (window.annotationHighlightMode !== 'text') return;
    
    const selection = window.getSelection();
    if (selection.toString().length > 0) {
      const range = selection.getRangeAt(0);
      const data = {
        handler: 'onTextSelected',
        text: selection.toString(),
        anchorId: generateAnchorId(range),
        startOffset: range.startOffset,
        endOffset: range.endOffset
      };
      
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage(JSON.stringify(data));
      }
    }
  } catch (error) {
    console.error('Error sending selection:', error);
  }
}

// Box drawing functions
function startBoxDrawing(e) {
  if (window.annotationHighlightMode !== 'box') return;
  
  isDrawing = true;
  const rect = document.querySelector('.markdown-body').getBoundingClientRect();
  startX = e.clientX - rect.left + window.scrollX;
  startY = e.clientY - rect.top + window.scrollY;
  
  // Create visual drawing box
  drawingBox = document.createElement('div');
  drawingBox.style.cssText = 
    'position: absolute;' +
    'border: 2px dashed #ffc107;' +
    'background-color: rgba(255, 243, 205, 0.3);' +
    'pointer-events: none;' +
    'z-index: 9999;';
  document.body.appendChild(drawingBox);
  
  e.preventDefault();
}

function updateBoxDrawing(e) {
  if (!isDrawing || !drawingBox) return;
  
  const rect = document.querySelector('.markdown-body').getBoundingClientRect();
  const currentX = e.clientX - rect.left + window.scrollX;
  const currentY = e.clientY - rect.top + window.scrollY;
  
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  drawingBox.style.left = (rect.left + left) + 'px';
  drawingBox.style.top = (rect.top + top) + 'px';
  drawingBox.style.width = width + 'px';
  drawingBox.style.height = height + 'px';
}

function endBoxDrawing(e) {
  if (!isDrawing || !drawingBox) return;
  
  isDrawing = false;
  
  const rect = document.querySelector('.markdown-body').getBoundingClientRect();
  const currentX = e.clientX - rect.left + window.scrollX;
  const currentY = e.clientY - rect.top + window.scrollY;
  
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  
  // Remove visual box
  drawingBox.remove();
  drawingBox = null;
  
  // Only send if box has meaningful size
  if (width > 10 && height > 10) {
    const boxData = {
      left: left,
      top: top,
      width: width,
      height: height
    };
    
    const data = {
      handler: 'onBoxDrawn',
      left: left,
      top: top,
      width: width,
      height: height,
      anchorId: 'box:' + JSON.stringify(boxData),
      text: '' // No text for box annotations
    };
    
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(JSON.stringify(data));
    }
  }
}

// Generate unique anchor ID for range
function generateAnchorId(range) {
  const startNode = range.startContainer;
  const path = getNodePath(startNode);
  return 'anchor_' + path.join('_') + '_' + range.startOffset;
}

// Get path to node from document root
function getNodePath(node) {
  const path = [];
  while (node && (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE)) {
    if (node.parentNode) {
      const siblings = Array.from(node.parentNode.childNodes);
      const index = siblings.indexOf(node);
      path.unshift(index);
      node = node.parentNode;
    } else {
      break;
    }
  }
  return path;
}

// Highlight annotation in document
function highlightAnnotation(anchorId, annotationId) {
  // Implementation for highlighting will be added when annotations are created
  console.log('Highlighting annotation:', anchorId, annotationId);
}

// Event listeners - conditionally added based on mode
let textModeListenersActive = false;
let boxModeListenersActive = false;

function enableTextModeListeners() {
  if (!textModeListenersActive) {
    document.addEventListener('mouseup', sendSelection);
    document.addEventListener('touchend', sendSelection);
    textModeListenersActive = true;
  }
}

function disableTextModeListeners() {
  if (textModeListenersActive) {
    document.removeEventListener('mouseup', sendSelection);
    document.removeEventListener('touchend', sendSelection);
    textModeListenersActive = false;
  }
}

function enableBoxModeListeners() {
  if (!boxModeListenersActive) {
    const markdownBody = document.querySelector('.markdown-body');
    if (markdownBody) {
      markdownBody.addEventListener('mousedown', startBoxDrawing);
      document.addEventListener('mousemove', updateBoxDrawing);
      document.addEventListener('mouseup', endBoxDrawing);
      boxModeListenersActive = true;
    }
  }
}

function disableBoxModeListeners() {
  if (boxModeListenersActive) {
    const markdownBody = document.querySelector('.markdown-body');
    if (markdownBody) {
      markdownBody.removeEventListener('mousedown', startBoxDrawing);
    }
    document.removeEventListener('mousemove', updateBoxDrawing);
    document.removeEventListener('mouseup', endBoxDrawing);
    boxModeListenersActive = false;
  }
}

// Initialize with text mode
enableTextModeListeners();

// Mode switching function (called from Flutter)
window.setAnnotationMode = function(mode) {
  window.annotationHighlightMode = mode;
  if (mode === 'text') {
    disableBoxModeListeners();
    enableTextModeListeners();
  } else if (mode === 'box') {
    disableTextModeListeners();
    enableBoxModeListeners();
  }
};

// Handle annotation clicks
document.addEventListener('click', function(e) {
  try {
    if (e.target.classList.contains('annotation-highlight')) {
      const annotationId = e.target.getAttribute('data-annotation-id');
      if (window.chrome && window.chrome.webview && annotationId) {
        const data = {
          handler: 'onAnnotationClicked',
          annotationId: annotationId
        };
        window.chrome.webview.postMessage(JSON.stringify(data));
      }
    }
  } catch (error) {
    console.error('Error handling annotation click:', error);
  }
});
''';
  }
}
