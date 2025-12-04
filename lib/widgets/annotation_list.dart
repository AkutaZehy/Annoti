import 'package:flutter/material.dart';
import '../models/annotation.dart';
import '../utils/date_formatter.dart';

/// Sidebar widget displaying list of annotations
class AnnotationList extends StatelessWidget {
  final List<Annotation> annotations;
  final Function(Annotation) onAnnotationTap;
  final Function(Annotation) onAnnotationEdit;
  final Function(Annotation) onAnnotationDelete;
  final bool isMultiSelectMode;
  final Set<String> selectedAnnotationIds;
  final Function(String) onAnnotationToggleSelect;

  const AnnotationList({
    super.key,
    required this.annotations,
    required this.onAnnotationTap,
    required this.onAnnotationEdit,
    required this.onAnnotationDelete,
    this.isMultiSelectMode = false,
    this.selectedAnnotationIds = const {},
    required this.onAnnotationToggleSelect,
  });

  @override
  Widget build(BuildContext context) {
    if (annotations.isEmpty) {
      return const Center(
        child: Text(
          'No annotations yet',
          style: TextStyle(
            color: Colors.grey,
            fontSize: 14,
          ),
        ),
      );
    }

    return ListView.builder(
      itemCount: annotations.length,
      padding: const EdgeInsets.all(8),
      itemBuilder: (context, index) {
        final annotation = annotations[index];
        final isSelected = selectedAnnotationIds.contains(annotation.id);

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          color: isSelected ? Colors.blue.shade50 : null,
          elevation: isSelected ? 4 : 1,
          child: ListTile(
            dense: true,
            leading: isMultiSelectMode
                ? Checkbox(
                    value: isSelected,
                    onChanged: (_) => onAnnotationToggleSelect(annotation.id),
                  )
                : const Icon(Icons.note, size: 20, color: Colors.orange),
            title: Text(
              annotation.selectedText,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13),
            ),
            subtitle: Text(
              annotation.note.isEmpty 
                  ? DateFormatter.formatShortDateTime(annotation.createdAt)
                  : annotation.note,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade600,
              ),
            ),
            trailing: isMultiSelectMode
                ? null
                : PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert, size: 16),
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'edit',
                        child: Row(
                          children: [
                            Icon(Icons.edit, size: 16),
                            SizedBox(width: 8),
                            Text('Edit', style: TextStyle(fontSize: 12)),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'delete',
                        child: Row(
                          children: [
                            Icon(Icons.delete, size: 16, color: Colors.red),
                            SizedBox(width: 8),
                            Text(
                              'Delete',
                              style: TextStyle(fontSize: 12, color: Colors.red),
                            ),
                          ],
                        ),
                      ),
                    ],
                    onSelected: (value) {
                      if (value == 'edit') {
                        onAnnotationEdit(annotation);
                      } else if (value == 'delete') {
                        onAnnotationDelete(annotation);
                      }
                    },
                  ),
            onTap: () {
              if (isMultiSelectMode) {
                onAnnotationToggleSelect(annotation.id);
              } else {
                onAnnotationTap(annotation);
              }
            },
          ),
        );
      },
    );
  }
}
