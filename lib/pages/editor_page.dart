import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';
import '../models/annotation.dart';
import '../services/file_service.dart';
import '../services/html_service.dart';
import '../services/annotation_service.dart';
import '../controllers/webview_controller.dart' as app_controller;
import '../widgets/annotation_list.dart';
import '../widgets/annotation_sticky_note.dart';

/// Main editor page with WebView and annotation functionality
class EditorPage extends StatefulWidget {
  const EditorPage({super.key});

  @override
  State<EditorPage> createState() => _EditorPageState();
}

class _EditorPageState extends State<EditorPage> {
  final FileService _fileService = FileService();
  final HtmlService _htmlService = HtmlService();
  final AnnotationService _annotationService = AnnotationService();
  late app_controller.WebViewController _webViewController;
  final _webviewController = WebviewController();

  String? _currentFilePath;
  String? _currentFileName;
  List<Annotation> _annotations = [];
  String _statusMessage = 'Please open a Markdown or Text file.';
  bool _isEditMode = false; // false = read mode, true = edit mode
  bool _isMultiSelectMode = false;
  final Set<String> _selectedAnnotationIds = {};
  Annotation? _activeAnnotation;
  Offset _stickyNotePosition = const Offset(100, 100);
  bool _isWebViewReady = false;

  @override
  void initState() {
    super.initState();
    _webViewController = app_controller.WebViewController(
      onTextSelected: _handleTextSelected,
      onAnnotationClicked: _handleAnnotationClicked,
    );
    _initWebView();
  }

  Future<void> _initWebView() async {
    await _webviewController.initialize();
    _webViewController.setWebViewController(_webviewController);
    
    // Set up message handler for JavaScript communication
    _webviewController.webMessage.listen((message) {
      try {
        final jsonData = jsonDecode(message) as Map<String, dynamic>;
        final handler = jsonData['handler'] as String?;
        
        if (handler == 'onTextSelected') {
          _handleTextSelected(
            jsonData['text'] as String,
            jsonData['anchorId'] as String,
            jsonData['startOffset'] as int,
            jsonData['endOffset'] as int,
          );
        } else if (handler == 'onAnnotationClicked') {
          _handleAnnotationClicked(jsonData['annotationId'] as String);
        }
      } catch (e) {
        debugPrint('Error processing web message: $e');
      }
    });
    
    setState(() {
      _isWebViewReady = true;
    });
  }

  @override
  void dispose() {
    _webviewController.dispose();
    super.dispose();
  }

  Future<void> _openFile() async {
    try {
      final fileData = await _fileService.selectAndOpenFile();
      if (fileData == null) {
        setState(() => _statusMessage = 'No file selected.');
        return;
      }

      // Convert markdown to HTML
      final htmlContent = _htmlService.convertMarkdownToHtml(fileData.content);
      
      // Save HTML to same-name directory
      await _htmlService.saveHtml(fileData.path, htmlContent);

      // Load annotations
      final annotations = await _annotationService.loadAnnotations(fileData.path);

      setState(() {
        _currentFilePath = fileData.path;
        _currentFileName = fileData.name;
        _annotations = annotations;
        _statusMessage = 'File loaded successfully.';
        _activeAnnotation = null;
      });

      // Load HTML into WebView
      await _webViewController.loadHtmlContent(htmlContent);

      // Highlight existing annotations
      await _webViewController.highlightAnnotations(_annotations);
      
      setState(() => _statusMessage = 'File loaded with ${_annotations.length} annotations.');
    } catch (e) {
      setState(() => _statusMessage = 'Error opening file: $e');
    }
  }

  void _handleTextSelected(String text, String anchorId, int startOffset, int endOffset) {
    if (!_isEditMode) return; // Only allow selection in edit mode

    _showCreateAnnotationDialog(text, anchorId, startOffset, endOffset);
  }

  void _handleAnnotationClicked(String annotationId) {
    final annotation = _annotations.firstWhere(
      (a) => a.id == annotationId,
      orElse: () => Annotation(
        id: '',
        selectedText: '',
        note: '',
        anchorId: '',
        startOffset: 0,
        endOffset: 0,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    );
    
    // Only show if valid annotation found
    if (annotation.id.isNotEmpty) {
      setState(() {
        _activeAnnotation = annotation;
        _stickyNotePosition = const Offset(100, 100);
      });
    }
  }

  void _showCreateAnnotationDialog(String text, String anchorId, int startOffset, int endOffset) {
    final noteController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create Annotation'),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Selected text:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  text,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(height: 16),
              const Text('Note:', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: noteController,
                maxLines: 5,
                decoration: const InputDecoration(
                  hintText: 'Enter your note here...',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final annotation = Annotation(
                id: DateTime.now().millisecondsSinceEpoch.toString(),
                selectedText: text,
                note: noteController.text,
                anchorId: anchorId,
                startOffset: startOffset,
                endOffset: endOffset,
                createdAt: DateTime.now(),
                updatedAt: DateTime.now(),
              );

              await _addAnnotation(annotation);
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _addAnnotation(Annotation annotation) async {
    if (_currentFilePath == null) return;

    try {
      await _annotationService.addAnnotation(_currentFilePath!, annotation);
      await _webViewController.highlightAnnotation(annotation);
      
      setState(() {
        _annotations.add(annotation);
        _statusMessage = 'Annotation created successfully.';
      });
    } catch (e) {
      setState(() => _statusMessage = 'Error creating annotation: $e');
    }
  }

  void _editAnnotation(Annotation annotation) {
    final noteController = TextEditingController(text: annotation.note);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Annotation'),
        content: TextField(
          controller: noteController,
          maxLines: 5,
          decoration: const InputDecoration(
            hintText: 'Enter your note here...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final updated = annotation.copyWith(
                note: noteController.text,
                updatedAt: DateTime.now(),
              );
              
              await _updateAnnotation(updated);
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _updateAnnotation(Annotation annotation) async {
    if (_currentFilePath == null) return;

    try {
      await _annotationService.updateAnnotation(_currentFilePath!, annotation);
      
      setState(() {
        final index = _annotations.indexWhere((a) => a.id == annotation.id);
        if (index != -1) {
          _annotations[index] = annotation;
        }
        if (_activeAnnotation?.id == annotation.id) {
          _activeAnnotation = annotation;
        }
        _statusMessage = 'Annotation updated successfully.';
      });
    } catch (e) {
      setState(() => _statusMessage = 'Error updating annotation: $e');
    }
  }

  Future<void> _deleteAnnotation(Annotation annotation) async {
    if (_currentFilePath == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Annotation'),
        content: const Text('Are you sure you want to delete this annotation?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _annotationService.deleteAnnotation(_currentFilePath!, annotation.id);
      await _webViewController.removeHighlight(annotation.id);
      
      setState(() {
        _annotations.removeWhere((a) => a.id == annotation.id);
        if (_activeAnnotation?.id == annotation.id) {
          _activeAnnotation = null;
        }
        _statusMessage = 'Annotation deleted successfully.';
      });
    } catch (e) {
      setState(() => _statusMessage = 'Error deleting annotation: $e');
    }
  }

  Future<void> _deleteSelectedAnnotations() async {
    if (_selectedAnnotationIds.isEmpty || _currentFilePath == null) return;

    try {
      await _annotationService.deleteAnnotations(
        _currentFilePath!,
        _selectedAnnotationIds.toList(),
      );

      for (final id in _selectedAnnotationIds) {
        await _webViewController.removeHighlight(id);
      }

      setState(() {
        _annotations.removeWhere((a) => _selectedAnnotationIds.contains(a.id));
        _selectedAnnotationIds.clear();
        _isMultiSelectMode = false;
        _statusMessage = 'Selected annotations deleted.';
      });
    } catch (e) {
      setState(() => _statusMessage = 'Error deleting annotations: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_currentFileName ?? 'Annoti'),
        actions: [
          IconButton(
            icon: Icon(_isEditMode ? Icons.visibility : Icons.edit),
            tooltip: _isEditMode ? 'Switch to Read Mode' : 'Switch to Edit Mode',
            onPressed: () {
              setState(() {
                _isEditMode = !_isEditMode;
                _statusMessage = _isEditMode 
                    ? 'Edit mode: Select text to annotate'
                    : 'Read mode: View only';
              });
            },
          ),
        ],
      ),
      body: Row(
        children: [
          _buildSidebar(),
          Expanded(
            flex: 3,
            child: Stack(
              children: [
                _buildWebView(),
                if (_activeAnnotation != null)
                  AnnotationStickyNote(
                    annotation: _activeAnnotation!,
                    position: _stickyNotePosition,
                    onClose: () => setState(() => _activeAnnotation = null),
                    onEdit: () => _editAnnotation(_activeAnnotation!),
                    onDelete: () => _deleteAnnotation(_activeAnnotation!),
                  ),
              ],
            ),
          ),
          _buildAnnotationListSidebar(),
        ],
      ),
      bottomNavigationBar: _buildStatusBar(),
    );
  }

  Widget _buildSidebar() {
    return Container(
      width: 60,
      color: Colors.grey.shade200,
      child: Column(
        children: [
          const SizedBox(height: 16),
          IconButton(
            icon: const Icon(Icons.folder_open),
            tooltip: 'Open File',
            onPressed: _openFile,
          ),
          if (_isEditMode && _isMultiSelectMode) ...[
            const SizedBox(height: 16),
            IconButton(
              icon: const Icon(Icons.delete_forever, color: Colors.red),
              tooltip: 'Delete Selected',
              onPressed: _selectedAnnotationIds.isEmpty 
                  ? null 
                  : _deleteSelectedAnnotations,
            ),
            IconButton(
              icon: const Icon(Icons.cancel),
              tooltip: 'Cancel',
              onPressed: () {
                setState(() {
                  _isMultiSelectMode = false;
                  _selectedAnnotationIds.clear();
                });
              },
            ),
          ] else if (_isEditMode) ...[
            const SizedBox(height: 16),
            IconButton(
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Multi-select',
              onPressed: () {
                setState(() => _isMultiSelectMode = true);
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildWebView() {
    if (!_isWebViewReady) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    return Webview(
      _webviewController,
    );
  }

  Widget _buildAnnotationListSidebar() {
    return Container(
      width: 280,
      color: Colors.grey.shade100,
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.all(8),
            child: Text(
              'Annotations',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          Expanded(
            child: AnnotationList(
              annotations: _annotations,
              isMultiSelectMode: _isMultiSelectMode,
              selectedAnnotationIds: _selectedAnnotationIds,
              onAnnotationTap: (annotation) async {
                setState(() => _activeAnnotation = annotation);
                await _webViewController.scrollToAnnotation(annotation.id);
              },
              onAnnotationEdit: _editAnnotation,
              onAnnotationDelete: _deleteAnnotation,
              onAnnotationToggleSelect: (id) {
                setState(() {
                  if (_selectedAnnotationIds.contains(id)) {
                    _selectedAnnotationIds.remove(id);
                  } else {
                    _selectedAnnotationIds.add(id);
                  }
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: Theme.of(context).colorScheme.inversePrimary.withOpacity(0.3),
      child: Row(
        children: [
          Icon(
            _isEditMode ? Icons.edit : Icons.visibility,
            size: 16,
            color: _isEditMode ? Colors.orange : Colors.blue,
          ),
          const SizedBox(width: 8),
          Text(
            _isEditMode ? 'Edit Mode' : 'Read Mode',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(width: 16),
          Expanded(child: Text(_statusMessage)),
        ],
      ),
    );
  }
}
