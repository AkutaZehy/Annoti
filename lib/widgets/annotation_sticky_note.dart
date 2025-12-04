import 'package:flutter/material.dart';
import '../models/annotation.dart';
import '../utils/date_formatter.dart';

/// Floating sticky note widget for displaying annotations
/// White background, can overlay content, draggable and resizable
class AnnotationStickyNote extends StatefulWidget {
  final Annotation annotation;
  final VoidCallback onClose;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final Offset position;
  final Function(Offset)? onPositionChanged;
  final VoidCallback? onReset; // For resetting position and size

  const AnnotationStickyNote({
    super.key,
    required this.annotation,
    required this.onClose,
    required this.onEdit,
    required this.onDelete,
    required this.position,
    this.onPositionChanged,
    this.onReset,
  });

  @override
  State<AnnotationStickyNote> createState() => _AnnotationStickyNoteState();
}

class _AnnotationStickyNoteState extends State<AnnotationStickyNote> {
  bool _isExpanded = false;
  late Offset _position;
  double _width = 300;
  double _height = 100;
  
  // Minimum and maximum sizes
  static const double _minWidth = 250;
  static const double _minHeight = 100;
  static const double _sidebarWidth = 60; // Left sidebar
  static const double _annotationListWidth = 250; // Right annotation list
  static const double _margin = 20;
  
  // Max size constrained by screen and sidebar areas
  double get _maxWidth {
    final screenWidth = MediaQuery.of(context).size.width;
    return screenWidth - _annotationListWidth - (_margin * 2);
  }
  
  double get _maxHeight {
    final screenHeight = MediaQuery.of(context).size.height;
    return screenHeight - (_margin * 2);
  }

  @override
  void initState() {
    super.initState();
    _position = widget.position;
  }
  
  @override
  void didUpdateWidget(AnnotationStickyNote oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Reset position and size when annotation changes
    if (oldWidget.annotation.id != widget.annotation.id) {
      _resetPositionAndSize();
    }
  }
  
  // Reset position and size to defaults
  void _resetPositionAndSize() {
    setState(() {
      _position = widget.position;
      _width = 300;
      _height = 100;
      _isExpanded = false;
    });
  }
  
  // Constrain position to stay within screen bounds (excluding sidebars)
  Offset _constrainPosition(Offset newPosition, Size noteSize) {
    final screenSize = MediaQuery.of(context).size;
    // Left bound: start from 0 (left sidebar is separate)
    final minX = 0.0;
    // Right bound: before annotation list, accounting for note width
    final maxX = screenSize.width - _annotationListWidth - noteSize.width;
    // Top bound
    final minY = 0.0;
    // Bottom bound
    final maxY = screenSize.height - noteSize.height;
    
    return Offset(
      newPosition.dx.clamp(minX, maxX > minX ? maxX : minX),
      newPosition.dy.clamp(minY, maxY > minY ? maxY : minY),
    );
  }
  
  Size get _currentSize {
    return Size(
      _isExpanded ? _width : 300,
      _isExpanded ? _height : 140,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Ensure position is within bounds on each build
    final constrainedPosition = _constrainPosition(_position, _currentSize);
    if (constrainedPosition != _position) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        setState(() {
          _position = constrainedPosition;
        });
      });
    }
    
    return Positioned(
      left: _position.dx,
      top: _position.dy,
      child: Container(
        width: _isExpanded ? _width : 300,
        height: _isExpanded ? _height : null,
        constraints: BoxConstraints(
          maxHeight: _isExpanded ? _height : 140,
          minHeight: _isExpanded ? _minHeight : 100,
        ),
        child: Stack(
          children: [
            // Main sticky note content
            Material(
              elevation: 8,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade300, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header - draggable handle
                    GestureDetector(
                      onPanUpdate: (details) {
                        setState(() {
                          final newPosition = Offset(
                            _position.dx + details.delta.dx,
                            _position.dy + details.delta.dy,
                          );
                          _position = _constrainPosition(newPosition, _currentSize);
                        });
                        widget.onPositionChanged?.call(_position);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(6),
                            topRight: Radius.circular(6),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.drag_indicator,
                              size: 16,
                              color: Colors.orange,
                            ),
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.note,
                              size: 16,
                              color: Colors.orange,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '批注',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey.shade700,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: Icon(
                                _isExpanded ? Icons.unfold_less : Icons.unfold_more,
                                size: 16,
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              tooltip: _isExpanded ? '折叠' : '展开',
                              onPressed: () {
                                setState(() {
                                  _isExpanded = !_isExpanded;
                                  if (_isExpanded) {
                                    // Set initial expanded size
                                    _width = 340;
                                    _height = 300;
                                  }
                                });
                              },
                            ),
                            const SizedBox(width: 4),
                            IconButton(
                              icon: const Icon(Icons.close, size: 16),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              tooltip: '关闭',
                              onPressed: widget.onClose,
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Content
                    Flexible(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Selected text - always show 1 line when collapsed
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.yellow.shade50,
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: Colors.yellow.shade200),
                              ),
                              child: Text(
                                widget.annotation.selectedText,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade800,
                                  fontStyle: FontStyle.italic,
                                ),
                                maxLines: _isExpanded ? null : 1,
                                overflow: _isExpanded
                                    ? TextOverflow.visible
                                    : TextOverflow.ellipsis,
                              ),
                            ),
                            if (widget.annotation.note.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              // Note content - show 1 line when collapsed
                              Text(
                                widget.annotation.note,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade900,
                                ),
                                maxLines: _isExpanded ? null : 1,
                                overflow: _isExpanded
                                    ? TextOverflow.visible
                                    : TextOverflow.ellipsis,
                              ),
                            ],
                            if (_isExpanded) ...[
                              const SizedBox(height: 8),
                              // Timestamp - only show when expanded
                              Text(
                                'Created: ${DateFormatter.formatDateTime(widget.annotation.createdAt)}',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                              if (widget.annotation.updatedAt != widget.annotation.createdAt)
                                Text(
                                  'Updated: ${DateFormatter.formatDateTime(widget.annotation.updatedAt)}',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    // Actions - only show when expanded
                    if (_isExpanded)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: const BorderRadius.only(
                            bottomLeft: Radius.circular(6),
                            bottomRight: Radius.circular(6),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton.icon(
                              icon: const Icon(Icons.edit, size: 14),
                              label: const Text('编辑', style: TextStyle(fontSize: 12)),
                              onPressed: widget.onEdit,
                            ),
                            const SizedBox(width: 8),
                            TextButton.icon(
                              icon: const Icon(Icons.delete, size: 14),
                              label: const Text('删除', style: TextStyle(fontSize: 12)),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.red,
                              ),
                              onPressed: widget.onDelete,
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            
            // Resize handles - only show when expanded
            if (_isExpanded) ...[
              // Right edge resize handle
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                child: GestureDetector(
                  onPanUpdate: (details) {
                    setState(() {
                      final newWidth = (_width + details.delta.dx).clamp(_minWidth, _maxWidth);
                      _width = newWidth;
                      // Ensure position stays within bounds after resize
                      _position = _constrainPosition(_position, _currentSize);
                    });
                  },
                  child: MouseRegion(
                    cursor: SystemMouseCursors.resizeColumn,
                    child: Container(
                      width: 8,
                      color: Colors.transparent,
                    ),
                  ),
                ),
              ),
              
              // Bottom edge resize handle
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: GestureDetector(
                  onPanUpdate: (details) {
                    setState(() {
                      final newHeight = (_height + details.delta.dy).clamp(_minHeight, _maxHeight);
                      _height = newHeight;
                      // Ensure position stays within bounds after resize
                      _position = _constrainPosition(_position, _currentSize);
                    });
                  },
                  child: MouseRegion(
                    cursor: SystemMouseCursors.resizeRow,
                    child: Container(
                      height: 8,
                      color: Colors.transparent,
                    ),
                  ),
                ),
              ),
              
              // Bottom-right corner resize handle
              Positioned(
                right: 0,
                bottom: 0,
                child: GestureDetector(
                  onPanUpdate: (details) {
                    setState(() {
                      final newWidth = (_width + details.delta.dx).clamp(_minWidth, _maxWidth);
                      final newHeight = (_height + details.delta.dy).clamp(_minHeight, _maxHeight);
                      _width = newWidth;
                      _height = newHeight;
                      // Ensure position stays within bounds after resize
                      _position = _constrainPosition(_position, _currentSize);
                    });
                  },
                  child: MouseRegion(
                    cursor: SystemMouseCursors.resizeUpLeftDownRight,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        color: Colors.orange.shade100,
                        borderRadius: const BorderRadius.only(
                          bottomRight: Radius.circular(6),
                        ),
                      ),
                      child: Icon(
                        Icons.zoom_out_map,
                        size: 12,
                        color: Colors.orange.shade700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
