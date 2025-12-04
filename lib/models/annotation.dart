/// Annotation data model
/// Represents a single annotation with position and content
class Annotation {
  final String id;
  final String selectedText;
  final String note;
  final String anchorId; // DOM anchor for WebView positioning
  final int startOffset;
  final int endOffset;
  final DateTime createdAt;
  DateTime updatedAt;

  Annotation({
    required this.id,
    required this.selectedText,
    required this.note,
    required this.anchorId,
    required this.startOffset,
    required this.endOffset,
    required this.createdAt,
    required this.updatedAt,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'selectedText': selectedText,
      'note': note,
      'anchorId': anchorId,
      'startOffset': startOffset,
      'endOffset': endOffset,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  factory Annotation.fromJson(Map<String, dynamic> json) {
    return Annotation(
      id: json['id'] as String,
      selectedText: json['selectedText'] as String,
      note: json['note'] as String,
      anchorId: json['anchorId'] as String,
      startOffset: json['startOffset'] as int,
      endOffset: json['endOffset'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Annotation copyWith({
    String? id,
    String? selectedText,
    String? note,
    String? anchorId,
    int? startOffset,
    int? endOffset,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Annotation(
      id: id ?? this.id,
      selectedText: selectedText ?? this.selectedText,
      note: note ?? this.note,
      anchorId: anchorId ?? this.anchorId,
      startOffset: startOffset ?? this.startOffset,
      endOffset: endOffset ?? this.endOffset,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Annotation &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}
