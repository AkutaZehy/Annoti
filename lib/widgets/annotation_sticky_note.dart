import 'package:flutter/material.dart';
import '../models/annotation.dart';
import '../utils/date_formatter.dart';

/// Floating sticky note widget for displaying annotations
/// White background, can overlay content, draggable
class AnnotationStickyNote extends StatefulWidget {
  final Annotation annotation;
  final VoidCallback onClose;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final Offset position;
  final Function(Offset)? onPositionChanged;

  const AnnotationStickyNote({
    super.key,
    required this.annotation,
    required this.onClose,
    required this.onEdit,
    required this.onDelete,
    required this.position,
    this.onPositionChanged,
  });

  @override
  State<AnnotationStickyNote> createState() => _AnnotationStickyNoteState();
}

class _AnnotationStickyNoteState extends State<AnnotationStickyNote> {
  bool _isExpanded = false;
  late Offset _position;

  @override
  void initState() {
    super.initState();
    _position = widget.position;
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: _position.dx,
      top: _position.dy,
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            _position = Offset(
              _position.dx + details.delta.dx,
              _position.dy + details.delta.dy,
            );
          });
          widget.onPositionChanged?.call(_position);
        },
        child: Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: _isExpanded ? 340 : 300,
            constraints: BoxConstraints(
              maxHeight: _isExpanded ? 450 : 140,
              minHeight: _isExpanded ? 140 : 100,
            ),
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
                      _position = Offset(
                        _position.dx + details.delta.dx,
                        _position.dy + details.delta.dy,
                      );
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
                            'Annotation',
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
                          tooltip: _isExpanded ? 'Collapse' : 'Expand',
                          onPressed: () {
                            setState(() {
                              _isExpanded = !_isExpanded;
                            });
                          },
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.close, size: 16),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          tooltip: 'Close',
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
                          label: const Text('Edit', style: TextStyle(fontSize: 12)),
                          onPressed: widget.onEdit,
                        ),
                        const SizedBox(width: 8),
                        TextButton.icon(
                          icon: const Icon(Icons.delete, size: 14),
                          label: const Text('Delete', style: TextStyle(fontSize: 12)),
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
      ),
    );
  }
}
