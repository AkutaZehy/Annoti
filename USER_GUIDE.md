# Annoti V1 - User Guide

## Overview

Annoti is a Flutter desktop application for reading and annotating Markdown and TXT files. This guide covers the V1 WebView-based architecture.

## Getting Started

### Installation

1. Ensure Flutter is installed and configured for desktop development
2. Clone the repository
3. Run `flutter pub get` to install dependencies
4. Run `flutter run -d windows` (or `-d macos`, `-d linux`) to start the application

### Opening Files

1. Click the **folder icon** in the left sidebar or press `Ctrl+O`
2. Select a `.md` or `.txt` file
3. The file will be rendered with GitHub-style formatting

## Creating Annotations

### Method 1: Text Selection (Recommended)

1. Select any text in the document by clicking and dragging
2. A dialog will appear automatically
3. Enter your note in the text field
4. Click **确认** (Confirm) to save the annotation
5. The selected text will be highlighted in yellow

### Method 2: Context Menu

1. Right-click on selected text
2. The annotation dialog will appear
3. Follow the same steps as Method 1

## Managing Annotations

### Viewing Annotations

All annotations appear in the right sidebar panel under **批注列表** (Annotation List):

- **Content Preview**: Shows the first line of annotated text
- **Note**: Your annotation note (if provided)
- **Line Number**: Location in the document

### Editing Annotations

1. Click the **edit icon** (✏️) next to an annotation
2. Modify the note text
3. Click **保存** (Save) to update

### Deleting Annotations

#### Single Deletion
1. Click the **delete icon** (🗑️) next to an annotation

#### Multiple Deletion
1. Click the **delete outline icon** in the left sidebar to enter multi-select mode
2. Select annotations by clicking their checkboxes
3. Click the **delete forever icon** to delete all selected annotations
4. Click **cancel icon** to exit multi-select mode

### Expanding/Collapsing Notes

- Click on an annotation card to expand and see the full note
- Click again to collapse

## Saving Annotations

### Automatic vs Manual Save

- Annotations are stored in memory as you create them
- To persist annotations to disk, click the **save icon** (💾) or press `Ctrl+S`

### File Location

Annotations are saved as a JSON file in the same directory as your source file:

```
your-document.md
your-document.md.json  ← Annotation file
```

The original `.md` or `.txt` file is **never modified**.

## Keyboard Shortcuts

- `Ctrl+O` - Open file
- `Ctrl+S` - Save annotations

## Features

### Rendering

- **Headings**: H1-H6 with proper hierarchy
- **Text Formatting**: Bold, italic, strikethrough
- **Code Blocks**: Syntax highlighting with monospace font
- **Blockquotes**: Styled with left border
- **Lists**: Ordered and unordered lists
- **Tables**: Full table support with alternating row colors
- **Links**: Clickable hyperlinks
- **Images**: Inline image rendering

### Highlighting

- **Color**: Yellow background (#fff3cd)
- **Hover Effect**: Darker yellow on hover (#ffe69c)
- **Positioning**: Accurate text-based positioning
- **Multiple Highlights**: Support for overlapping annotations

### Chinese Font Support

The application uses Chinese-friendly fonts:
- Microsoft YaHei (微软雅黑)
- PingFang SC
- Source Han Sans CN
- Noto Sans CJK SC

## Troubleshooting

### Annotations Not Appearing

1. Ensure you've saved the annotations (`Ctrl+S`)
2. Check that the JSON file exists in the same directory
3. Try closing and reopening the file

### Highlights in Wrong Position

This can happen if:
- The document structure changed after annotation creation
- Complex nested HTML elements are present

**Solution**: Delete and recreate the annotation

### File Not Loading

Ensure the file is:
- A valid `.md` or `.txt` file
- Not corrupted or locked by another application
- Using UTF-8 encoding

### WebView Not Displaying

If the WebView appears blank:
1. Check that JavaScript is enabled (it should be by default)
2. Try reopening the file
3. Check the console for error messages

## File Format Support

### Supported Formats
- `.md` - Markdown files (GitHub Flavored Markdown)
- `.txt` - Plain text files

### Markdown Features Supported
- GitHub Flavored Markdown (GFM)
- Tables
- Task lists
- Strikethrough
- Autolinks

### Not Yet Supported
- PDF files
- EPUB files
- HTML files (coming in future versions)

## Tips & Best Practices

### For Better Performance
- Keep individual files under 10MB for optimal performance
- Large documents may take a few seconds to render

### For Better Annotations
- Keep annotation text concise and specific
- Use annotations for important insights, not general highlights
- Review and clean up annotations periodically

### Collaboration
- Share both the source file and the `.json` file with collaborators
- Keep files together in the same directory
- Use version control (Git) to track annotation changes

## Known Limitations

1. **Text Selection**: Complex nested structures may require multiple selection attempts
2. **Large Files**: Files >100MB may experience slower rendering
3. **Platform**: Desktop only (Windows, macOS, Linux)

## Advanced Usage

### Custom Styling

To modify the GitHub-style CSS, edit:
```
lib/widgets/webview_markdown_viewer.dart
```

Look for the `css` constant string in the `_generateHTML()` method.

### Annotation Data Format

Annotations are stored in JSON format:

```json
[
  {
    "content": "Selected text",
    "startIndex": 100,
    "endIndex": 115,
    "lineNumber": 5,
    "note": "Your annotation note"
  }
]
```

### Backup Annotations

To backup your annotations:
1. Copy all `.json` files from your document directories
2. Store them in a safe location
3. To restore, copy them back to the original locations

## Support

For issues, bug reports, or feature requests:
- Check the `ARCHITECTURE.md` for technical details
- Review the `CHANGELOG.md` for recent changes
- Open an issue on the GitHub repository
