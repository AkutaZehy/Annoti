import 'dart:io';
import 'package:file_selector/file_selector.dart';

/// Service for file I/O operations
class FileService {
  /// Open a markdown or text file using file selector
  Future<FileData?> selectAndOpenFile() async {
    const XTypeGroup typeGroup = XTypeGroup(
      label: 'Documents',
      extensions: <String>['md', 'txt'],
    );
    
    final XFile? file = await openFile(
      acceptedTypeGroups: <XTypeGroup>[typeGroup],
    );

    if (file == null) return null;

    try {
      final content = await file.readAsString();
      return FileData(
        path: file.path,
        name: file.name,
        content: content,
      );
    } catch (e) {
      throw FileReadException('Failed to read file: $e');
    }
  }

  /// Read file content from path
  Future<String> readFile(String path) async {
    try {
      final file = File(path);
      return await file.readAsString();
    } catch (e) {
      throw FileReadException('Failed to read file at $path: $e');
    }
  }

  /// Write content to file
  Future<void> writeFile(String path, String content) async {
    try {
      final file = File(path);
      await file.writeAsString(content);
    } catch (e) {
      throw FileWriteException('Failed to write file at $path: $e');
    }
  }

  /// Create directory if it doesn't exist
  Future<void> ensureDirectoryExists(String path) async {
    try {
      final dir = Directory(path);
      if (!await dir.exists()) {
        await dir.create(recursive: true);
      }
    } catch (e) {
      throw FileSystemException('Failed to create directory at $path: $e');
    }
  }

  /// Check if file exists
  Future<bool> fileExists(String path) async {
    final file = File(path);
    return await file.exists();
  }

  /// Get directory path from file path
  String getDirectoryPath(String filePath) {
    final file = File(filePath);
    return file.parent.path;
  }

  /// Get file name without extension
  String getFileNameWithoutExtension(String filePath) {
    final file = File(filePath);
    final name = file.uri.pathSegments.last;
    final lastDot = name.lastIndexOf('.');
    return lastDot == -1 ? name : name.substring(0, lastDot);
  }

  /// Get file extension
  String getFileExtension(String filePath) {
    final file = File(filePath);
    final name = file.uri.pathSegments.last;
    final lastDot = name.lastIndexOf('.');
    return lastDot == -1 ? '' : name.substring(lastDot + 1);
  }
}

/// Data class for file information
class FileData {
  final String path;
  final String name;
  final String content;

  FileData({
    required this.path,
    required this.name,
    required this.content,
  });
}

/// Exception classes
class FileReadException implements Exception {
  final String message;
  FileReadException(this.message);
  @override
  String toString() => message;
}

class FileWriteException implements Exception {
  final String message;
  FileWriteException(this.message);
  @override
  String toString() => message;
}

class FileSystemException implements Exception {
  final String message;
  FileSystemException(this.message);
  @override
  String toString() => message;
}
