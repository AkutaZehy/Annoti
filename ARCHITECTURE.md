# Annoti V1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.dart (31 lines)                     │
│                 AnnotiApp - Flutter MaterialApp                  │
│              Initialize WebView for Windows Platform             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  pages/editor_page.dart (518 lines)              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ State Management                                         │   │
│  │  • Current file path & content                           │   │
│  │  • Annotations list                                      │   │
│  │  • Edit/Read mode toggle                                 │   │
│  │  • Active annotation for sticky note                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐     │
│  │  Left Sidebar│  │ Center: Stack │  │ Right Sidebar    │     │
│  │              │  │               │  │                  │     │
│  │ • Open File  │  │ • WebView     │  │ • Annotation     │     │
│  │ • Mode Toggle│  │ • Sticky Note │  │   List Widget    │     │
│  │ • Multi-Del  │  │   (overlay)   │  │                  │     │
│  └──────────────┘  └───────────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ FileService    │  │ WebViewController │  │ AnnotationList   │
│ (125 lines)    │  │ (169 lines)      │  │ Widget           │
│                │  │                  │  │ (119 lines)      │
│ • Open file    │  │ • Load HTML      │  │                  │
│ • Read/Write   │  │ • Highlight      │  │ • Display list   │
│ • Path utils   │  │ • JS injection   │  │ • Edit/Delete    │
└────────────────┘  │ • Scroll to      │  │ • Multi-select   │
         │          └──────────────────┘  └──────────────────┘
         │                    │
         ▼                    │            ┌──────────────────┐
┌────────────────┐            │            │ StickyNote Widget│
│ HtmlService    │            │            │ (213 lines)      │
│ (311 lines)    │            │            │                  │
│                │            │            │ • Floating UI    │
│ • MD → HTML    │◄───────────┘            │ • White bg       │
│ • GitHub CSS   │                         │ • Expand/Collapse│
│ • JS Bridge    │                         │ • Edit/Delete    │
│ • Save to dir  │                         └──────────────────┘
└────────────────┘
         │
         ▼
┌────────────────┐
│AnnotationSvc   │
│ (145 lines)    │
│                │
│ • Load JSON    │
│ • Save JSON    │
│ • CRUD ops     │
└────────────────┘
         │
         ▼
┌────────────────┐
│ Annotation     │
│ Model          │
│ (81 lines)     │
│                │
│ • id           │
│ • selectedText │
│ • note         │
│ • anchorId     │
│ • timestamps   │
│ • JSON ser/des │
└────────────────┘

┌────────────────┐
│ DateFormatter  │
│ Utility        │
│ (29 lines)     │
│                │
│ • format       │
│ • parse        │
└────────────────┘
```

## Data Flow

### File Opening Flow
```
User Action → FileService.selectAndOpenFile()
    ↓
Read file content
    ↓
HtmlService.convertMarkdownToHtml()
    ↓
HtmlService.saveHtml() → Save to same-name directory
    ↓
WebViewController.loadHtmlContent()
    ↓
AnnotationService.loadAnnotations()
    ↓
WebViewController.highlightAnnotations()
```

### Annotation Creation Flow (Edit Mode)
```
User selects text in WebView
    ↓
JavaScript: sendSelection()
    ↓
JS Bridge → Flutter
    ↓
EditorPage._handleTextSelected()
    ↓
Show dialog for note input
    ↓
Create Annotation object
    ↓
AnnotationService.addAnnotation() → Save to JSON
    ↓
WebViewController.highlightAnnotation() → Inject JS
    ↓
Update annotations list
```

### Annotation Display Flow
```
Click annotation in list
    ↓
WebViewController.scrollToAnnotation()
    ↓
Set _activeAnnotation
    ↓
StickyNote widget appears (overlay)
    │
    ├─ Edit → Update dialog → AnnotationService.updateAnnotation()
    │
    └─ Delete → Confirm dialog → AnnotationService.deleteAnnotation()
                ↓
           WebViewController.removeHighlight()
```

## Component Responsibilities

### Models Layer
- **annotation.dart**: Pure data structure with serialization

### Services Layer
- **file_service.dart**: File system operations (read/write/path utils)
- **html_service.dart**: Business logic for HTML generation & storage
- **annotation_service.dart**: Business logic for annotation persistence

### Controllers Layer
- **webview_controller.dart**: Bridge between Flutter & WebView JavaScript

### UI Layer
- **editor_page.dart**: Orchestrates all components, manages state
- **annotation_sticky_note.dart**: Reusable sticky note component
- **annotation_list.dart**: Reusable list component

### Utils Layer
- **date_formatter.dart**: Shared formatting utilities

## Technology Stack

```
┌─────────────────────────────────────────────┐
│           Flutter Desktop (Windows)          │
├─────────────────────────────────────────────┤
│  UI Framework: Flutter Material Design 3    │
├─────────────────────────────────────────────┤
│  WebView: flutter_inappwebview_windows      │
├─────────────────────────────────────────────┤
│  Markdown: markdown (Dart package)          │
├─────────────────────────────────────────────┤
│  File I/O: file_selector + dart:io          │
├─────────────────────────────────────────────┤
│  Persistence: JSON (dart:convert)           │
├─────────────────────────────────────────────┤
│  Communication: JavaScript Bridge           │
└─────────────────────────────────────────────┘
```

## File Storage Structure

```
project_directory/
├── document.md                      (source file)
├── document.md.annotations.json     (annotations data)
└── document/                        (HTML directory)
    └── document.html                (rendered HTML with CSS & JS)
```
