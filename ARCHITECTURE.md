# WebView Architecture Documentation

## Overview

This document describes the V1 refactored architecture for the Annoti application, which uses a WebView-based rendering pipeline for Markdown/TXT annotation.

## Architecture Components

### 1. Data Flow Pipeline

```
Source File (.md/.txt) 
  → Dart markdown library parsing 
  → HTML string generation 
  → CSS injection 
  → WebView rendering
```

### 2. Layer Structure

#### Layer 1: View Layer (WebView)
- Uses `flutter_inappwebview` for desktop support (Windows, macOS, Linux)
- Renders HTML content with GitHub-style CSS
- Provides consistent rendering without mode switching

#### Layer 2: Interaction Layer (JavaScript Bridge)
- Handles text selection via JavaScript
- Communicates with Flutter using JS Channel
- Manages annotation highlighting via DOM manipulation

### 3. Data Storage

- **Source files**: Remain untouched (.md/.txt files)
- **Annotations**: Stored in JSON format (same directory as source file, with `.json` extension)

## Key Features

### A. File Loading & Rendering

1. User selects `.md` or `.txt` file
2. Application reads file content
3. Markdown is converted to HTML using the `markdown` package
4. GitHub-style CSS is injected for clean, professional rendering
5. WebView loads the generated HTML

**Key Improvement**: No more separate "preview" and "annotation" modes - everything happens in one unified view.

### B. Annotation Interaction

#### Creating Annotations

1. User selects text in the WebView
2. JavaScript captures the selection event
3. Selection information (text, start offset, end offset) is sent to Flutter via JS Channel
4. Flutter shows a dialog to input notes
5. Annotation object is saved to memory and JSON file
6. JavaScript immediately applies highlighting using `<mark>` tags

#### Loading Annotations

1. When file is opened, JSON annotation file is read
2. After WebView page loads, annotations are applied via JavaScript
3. Highlights are rendered on matching text content

## CSS Styling

The application uses a clean, GitHub-inspired stylesheet with:

- **Font family**: Chinese font support (Microsoft YaHei, PingFang SC, Source Han Sans CN)
- **Font size**: 16px base with 1.6 line-height
- **Color scheme**: Black & white with subtle grays
- **Typography**: Proper heading hierarchy, code blocks, blockquotes, tables
- **Highlighting**: Yellow background (#fff3cd) for annotations with hover effect

## JavaScript Bridge

### Events Handled

- `mouseup`: Captures text selection
- `contextmenu`: Optional context menu support

### Functions Exposed

- `applyHighlights(annotationsData)`: Apply all annotations to the page
- `highlightText(searchText, annotationId)`: Highlight specific text content

### Communication

- Flutter → JS: via `evaluateJavascript()`
- JS → Flutter: via `callHandler()` on registered handlers

## File Structure

```
lib/
├── main.dart                           # Main app entry, file I/O, state management
├── widgets/
    └── webview_markdown_viewer.dart    # WebView-based viewer component
```

## Dependencies

- `flutter_inappwebview: ^6.0.0` - WebView component for desktop
- `markdown: ^7.0.0` - Markdown to HTML conversion
- `file_selector: ^1.0.0` - File picker for desktop
- `collection: ^1.18.0` - Collection utilities

## Acceptance Criteria Met

✅ **Rendering Consistency**: Markdown files render correctly with rich text formatting (headings, bold, lists) without mode switching

✅ **Highlighting Function**: Users can select text and create highlights that stick closely to the text without offset issues

✅ **Persistence**: Annotations are saved and restored when reopening files

✅ **File Separation**: Source `.md` files remain unmodified; all annotations are in separate `.json` files

## Future Improvements

1. Implement more precise text anchoring (using DOM Range/XPath)
2. Add annotation editing directly on highlights
3. Support for more file formats (PDF, EPUB, HTML)
4. Collaborative annotation sharing
5. Search within annotations
6. Export annotations to different formats

## Technical Notes

### Text Selection Offset Calculation

The current implementation uses a simplified offset calculation based on text content. For more robust positioning across different Markdown structures, consider:

- Using DOM Range API with startContainer/endContainer
- Implementing XPath-based positioning
- Using text fingerprinting with surrounding context

### Performance Considerations

- Large files (>100MB) may require pagination or virtual scrolling
- Complex Markdown with many nested elements may slow down highlighting
- Consider implementing lazy loading for annotations

### Browser Compatibility

The WebView uses Chromium engine (via InAppWebView), ensuring consistent behavior across all desktop platforms.
