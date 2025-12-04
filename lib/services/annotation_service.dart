import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as path;
import '../models/annotation.dart';

/// Service for annotation persistence
/// Saves annotations as JSON files alongside source documents
class AnnotationService {
  /// Get annotation file path for a source file
  /// Example: document.md -> document.md.annotations.json
  String getAnnotationFilePath(String sourceFilePath) {
    return '$sourceFilePath.annotations.json';
  }

  /// Load annotations from JSON file
  Future<List<Annotation>> loadAnnotations(String sourceFilePath) async {
    final annotationPath = getAnnotationFilePath(sourceFilePath);
    final file = File(annotationPath);

    if (!await file.exists()) {
      return [];
    }

    try {
      final jsonString = await file.readAsString();
      final List<dynamic> jsonList = jsonDecode(jsonString);
      return jsonList
          .map((json) => Annotation.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      throw AnnotationLoadException(
        'Failed to load annotations from $annotationPath: $e',
      );
    }
  }

  /// Save annotations to JSON file
  Future<void> saveAnnotations(
    String sourceFilePath,
    List<Annotation> annotations,
  ) async {
    final annotationPath = getAnnotationFilePath(sourceFilePath);
    final file = File(annotationPath);

    try {
      final jsonList = annotations.map((a) => a.toJson()).toList();
      final jsonString = const JsonEncoder.withIndent('  ').convert(jsonList);
      await file.writeAsString(jsonString);
    } catch (e) {
      throw AnnotationSaveException(
        'Failed to save annotations to $annotationPath: $e',
      );
    }
  }

  /// Add a new annotation
  Future<void> addAnnotation(
    String sourceFilePath,
    Annotation annotation,
  ) async {
    final annotations = await loadAnnotations(sourceFilePath);
    annotations.add(annotation);
    await saveAnnotations(sourceFilePath, annotations);
  }

  /// Update an existing annotation
  Future<void> updateAnnotation(
    String sourceFilePath,
    Annotation annotation,
  ) async {
    final annotations = await loadAnnotations(sourceFilePath);
    final index = annotations.indexWhere((a) => a.id == annotation.id);
    
    if (index != -1) {
      annotations[index] = annotation;
      await saveAnnotations(sourceFilePath, annotations);
    } else {
      throw AnnotationNotFoundException(
        'Annotation with id ${annotation.id} not found',
      );
    }
  }

  /// Delete an annotation
  Future<void> deleteAnnotation(
    String sourceFilePath,
    String annotationId,
  ) async {
    final annotations = await loadAnnotations(sourceFilePath);
    annotations.removeWhere((a) => a.id == annotationId);
    await saveAnnotations(sourceFilePath, annotations);
  }

  /// Delete multiple annotations
  Future<void> deleteAnnotations(
    String sourceFilePath,
    List<String> annotationIds,
  ) async {
    final annotations = await loadAnnotations(sourceFilePath);
    annotations.removeWhere((a) => annotationIds.contains(a.id));
    await saveAnnotations(sourceFilePath, annotations);
  }

  /// Check if annotations exist for a source file
  Future<bool> annotationsExist(String sourceFilePath) async {
    final annotationPath = getAnnotationFilePath(sourceFilePath);
    final file = File(annotationPath);
    return await file.exists();
  }

  /// Get annotation by ID
  Future<Annotation?> getAnnotationById(
    String sourceFilePath,
    String annotationId,
  ) async {
    final annotations = await loadAnnotations(sourceFilePath);
    try {
      return annotations.firstWhere((a) => a.id == annotationId);
    } catch (e) {
      return null;
    }
  }
}

/// Exception classes
class AnnotationLoadException implements Exception {
  final String message;
  AnnotationLoadException(this.message);
  @override
  String toString() => message;
}

class AnnotationSaveException implements Exception {
  final String message;
  AnnotationSaveException(this.message);
  @override
  String toString() => message;
}

class AnnotationNotFoundException implements Exception {
  final String message;
  AnnotationNotFoundException(this.message);
  @override
  String toString() => message;
}
