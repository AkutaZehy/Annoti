import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_selector/file_selector.dart';
import 'widgets/annotated_markdown_viewer.dart';
import 'dart:convert';
import 'dart:io';

void main() {
  runApp(const MyApp());
}

// 批注数据模型
class Annotation {
  final String content;
  final int startIndex;
  final int endIndex;
  final int lineNumber;
  String note;

  Annotation({
    required this.content,
    required this.startIndex,
    required this.endIndex,
    required this.lineNumber,
    this.note = '',
  });

  Map<String, dynamic> toJson() {
    return {
      'content': content,
      'startIndex': startIndex,
      'endIndex': endIndex,
      'lineNumber': lineNumber,
      'note': note,
    };
  }

  factory Annotation.fromJson(Map<String, dynamic> json) {
    return Annotation(
      content: json['content'],
      startIndex: json['startIndex'],
      endIndex: json['endIndex'],
      lineNumber: json['lineNumber'],
      note: json['note'] ?? '',
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Annotation &&
          runtimeType == other.runtimeType &&
          startIndex == other.startIndex &&
          endIndex == other.endIndex &&
          lineNumber == other.lineNumber;

  @override
  int get hashCode =>
      startIndex.hashCode ^ endIndex.hashCode ^ lineNumber.hashCode;
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Markdown Reader',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
        useMaterial3: true,
        fontFamily: 'OPPOSans', // 在这里指定字体
      ),
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  String? _fileContent;
  String? _filePath;
  String? _fileName;
  final List<Annotation> _annotations = [];
  String _statusMessage = '请打开一个 Markdown 文件。';

  bool _isAnnotationMode = false;
  int? _selectionStartIndex;
  int? _selectionEndIndex;

  bool _isMultiSelectMode = false;
  final Set<Annotation> _selectedAnnotations = {};

  int? _activeLine;
  int? _expandedAnnotationIndex;

  final GlobalKey<AnnotatedMarkdownViewerState> _viewerKey =
      GlobalKey<AnnotatedMarkdownViewerState>();

  Future<void> _openMarkdownFile() async {
    const XTypeGroup typeGroup = XTypeGroup(
      label: 'markdown',
      extensions: <String>['md'],
    );
    final XFile? file = await openFile(
      acceptedTypeGroups: <XTypeGroup>[typeGroup],
    );

    if (file != null) {
      try {
        final String content = await file.readAsString();
        setState(() {
          _fileContent = content;
          _filePath = file.path;
          _fileName = file.name;
          _annotations.clear();
          _isAnnotationMode = false;
          _selectionStartIndex = null;
          _selectionEndIndex = null;
          _activeLine = null;
          _statusMessage = '文件已成功打开。';
        });
        await _loadAnnotations();
      } catch (e) {
        setState(() {
          _fileContent = "文件读取失败: $e";
          _statusMessage = '文件读取失败。';
        });
        print('文件读取失败: $e');
      }
    } else {
      setState(() {
        _statusMessage = '未选择文件。';
      });
    }
  }

  Future<void> _loadAnnotations() async {
    if (_filePath == null) return;

    final jsonFilePath = '$_filePath.json';
    final file = File(jsonFilePath);

    if (await file.exists()) {
      try {
        final jsonString = await file.readAsString();
        final List<dynamic> jsonList = jsonDecode(jsonString);

        setState(() {
          _annotations.clear();
          _annotations.addAll(
            jsonList.map((json) => Annotation.fromJson(json)).toList(),
          );
          _statusMessage = '已检测到批注并加载。';
        });
      } catch (e) {
        setState(() {
          _statusMessage = '检测到批注文件，但加载失败。';
        });
        print('加载批注文件失败: $e');
      }
    } else {
      setState(() {
        _statusMessage = '未检测到批注文件，已初始化。';
      });
    }
  }

  Future<void> _saveAnnotationsToFile() async {
    if (_filePath == null) {
      setState(() {
        _statusMessage = '没有打开的文件，无法保存批注。';
      });
      return;
    }

    final jsonList = _annotations.map((a) => a.toJson()).toList();
    final jsonString = jsonEncode(jsonList);

    final jsonFilePath = '$_filePath.json';
    final file = File(jsonFilePath);

    try {
      await file.writeAsString(jsonString);
      setState(() {
        _statusMessage = '批注已成功写入到 $_fileName.json。';
      });
    } catch (e) {
      setState(() {
        _statusMessage = '保存批注失败: $e';
      });
      print('保存批注失败: $e');
    }
  }

  void _deleteSelectedAnnotations() {
    setState(() {
      _annotations.removeWhere((a) => _selectedAnnotations.contains(a));
      _statusMessage = '已删除选中的 ${_selectedAnnotations.length} 个批注。';
      _selectedAnnotations.clear();
      _isMultiSelectMode = false;
    });
  }

  void _deleteAnnotation(int index) {
    if (index >= 0 && index < _annotations.length) {
      setState(() {
        _annotations.removeAt(index);
        _statusMessage = '已删除一个批注。';
      });
    }
  }

  void _onTextSelectionChanged(TextSelection textSelection) {
    setState(() {
      if (textSelection.baseOffset != textSelection.extentOffset) {
        _selectionStartIndex = textSelection.baseOffset;
        _selectionEndIndex = textSelection.extentOffset;
      } else {
        _selectionStartIndex = null;
        _selectionEndIndex = null;
      }
    });
  }

  void _saveAnnotationFromSelection() {
    if (_selectionStartIndex == null ||
        _selectionEndIndex == null ||
        _fileContent == null) {
      return;
    }
    final int start = _selectionStartIndex! < _selectionEndIndex!
        ? _selectionStartIndex!
        : _selectionEndIndex!;
    final int end = _selectionStartIndex! > _selectionEndIndex!
        ? _selectionStartIndex!
        : _selectionEndIndex!;

    if (start != end) {
      final selectedText = _fileContent!.substring(start, end);
      final lineNumber = _getLineNumber(start);
      _showCreateAnnotationDialog(selectedText, start, end, lineNumber);
    }
  }

  void _showCreateAnnotationDialog(
    String text,
    int start,
    int end,
    int lineNumber,
  ) {
    final noteController = TextEditingController();
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('创建批注'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('被选中的文本:'),
                Text(
                  text.replaceAll('\n', ' ').replaceAll(RegExp(r'\s+'), ' '),
                  maxLines: 5,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 16),
                const Text('添加注解:'),
                TextField(
                  controller: noteController,
                  maxLines: null,
                  decoration: const InputDecoration(
                    hintText: '输入你的注解...',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(
              child: const Text('取消'),
              onPressed: () => Navigator.of(context).pop(),
            ),
            TextButton(
              child: const Text('确认'),
              onPressed: () {
                setState(() {
                  _annotations.add(
                    Annotation(
                      content: text,
                      startIndex: start,
                      endIndex: end,
                      lineNumber: lineNumber,
                      note: noteController.text,
                    ),
                  );
                });
                Navigator.of(context).pop();
                setState(() {
                  _statusMessage = '已成功创建批注。';
                });
              },
            ),
          ],
        );
      },
    );
  }

  void _editAnnotationNote(int index) {
    final annotation = _annotations[index];
    final noteController = TextEditingController(text: annotation.note);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('编辑注解'),
        content: TextField(
          controller: noteController,
          maxLines: null,
          decoration: const InputDecoration(
            hintText: '输入你的注解...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                annotation.note = noteController.text;
                _statusMessage = '已更新批注的注解。';
              });
              Navigator.of(context).pop();
            },
            child: const Text('保存'),
          ),
        ],
      ),
    );
  }

  int _getLineNumber(int textIndex) {
    if (_fileContent == null) return 1;
    final content = _fileContent!;
    int lineNumber = 1;
    for (int i = 0; i < textIndex; i++) {
      if (content[i] == '\n') {
        lineNumber++;
      }
    }
    return lineNumber;
  }

  void _scrollToLine(int lineNumber) {
    _viewerKey.currentState?.scrollToLine(lineNumber);
    setState(() {
      _activeLine = _isAnnotationMode ? null : lineNumber;
      _statusMessage = '正在滚动到行号: $lineNumber。';
    });
  }

  void _handleKeyEvent(RawKeyEvent event) {
    if (event is RawKeyDownEvent) {
      final isCtrlPressed = HardwareKeyboard.instance.isControlPressed;
      final key = event.logicalKey;

      if (isCtrlPressed && key == LogicalKeyboardKey.keyO) {
        _openMarkdownFile();
      } else if (isCtrlPressed && key == LogicalKeyboardKey.keyS) {
        _saveAnnotationsToFile();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RawKeyboardListener(
      focusNode: FocusNode(),
      onKey: _handleKeyEvent,
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: Theme.of(context).colorScheme.inversePrimary,
          title: Text(_fileName ?? 'Markdown Reader'),
        ),
        body: Row(
          children: <Widget>[
            Container(
              color: Colors.grey[200],
              padding: const EdgeInsets.symmetric(
                horizontal: 8.0,
                vertical: 16.0,
              ),
              child: Column(
                children: [
                  Tooltip(
                    message: '打开 Markdown 文件',
                    child: IconButton(
                      icon: const Icon(Icons.folder_open),
                      onPressed: _openMarkdownFile,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Tooltip(
                    message: _isAnnotationMode ? '切换到预览模式' : '切换到批注模式',
                    child: IconButton(
                      icon: const Icon(Icons.swap_horiz),
                      onPressed: () {
                        setState(() {
                          _isAnnotationMode = !_isAnnotationMode;
                          _selectedAnnotations.clear();
                          _isMultiSelectMode = false;
                        });
                      },
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_isAnnotationMode)
                    Tooltip(
                      message: '创建批注',
                      child: IconButton(
                        icon: const Icon(Icons.add_comment),
                        onPressed: _saveAnnotationFromSelection,
                      ),
                    ),
                  const Spacer(),
                  Tooltip(
                    message: '保存批注',
                    child: IconButton(
                      icon: const Icon(Icons.save),
                      onPressed: _saveAnnotationsToFile,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_isAnnotationMode)
                    Tooltip(
                      message: _isMultiSelectMode ? '删除选中的批注' : '选择要删除的批注',
                      child: Stack(
                        alignment: Alignment.topRight,
                        children: [
                          IconButton(
                            icon: Icon(
                              _isMultiSelectMode
                                  ? Icons.delete_forever
                                  : Icons.delete_outline,
                              color: Colors.red,
                            ),
                            onPressed: _isMultiSelectMode
                                ? _deleteSelectedAnnotations
                                : () {
                                    setState(() {
                                      _isMultiSelectMode = true;
                                    });
                                  },
                          ),
                          if (_isMultiSelectMode &&
                              _selectedAnnotations.isNotEmpty)
                            Positioned(
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  color: Colors.red,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                constraints: const BoxConstraints(
                                  minWidth: 16,
                                  minHeight: 16,
                                ),
                                child: Text(
                                  '${_selectedAnnotations.length}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  if (_isMultiSelectMode)
                    Tooltip(
                      message: '取消多选',
                      child: IconButton(
                        icon: const Icon(Icons.cancel),
                        onPressed: () {
                          setState(() {
                            _isMultiSelectMode = false;
                            _selectedAnnotations.clear();
                          });
                        },
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              flex: 3,
              child: Container(
                padding: const EdgeInsets.all(16.0),
                child: _fileContent != null
                    ? AnnotatedMarkdownViewer(
                        key: _viewerKey,
                        markdownContent: _fileContent!,
                        annotations: _annotations,
                        isAnnotationMode: _isAnnotationMode,
                        onSelectionChanged: _onTextSelectionChanged,
                        activeLine: _activeLine,
                      )
                    : const Center(child: Text('请在左侧点击按钮选择一个 .md 文件。')),
              ),
            ),
            Expanded(
              flex: 1,
              child: Container(
                color: Colors.grey[200],
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text(
                      '批注列表',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    if (_annotations.isEmpty)
                      const Text('没有批注', style: TextStyle(color: Colors.grey)),
                    Expanded(
                      child: ListView.builder(
                        itemCount: _annotations.length,
                        itemBuilder: (context, index) {
                          final annotation = _annotations[index];
                          final isSelected = _selectedAnnotations.contains(
                            annotation,
                          );
                          return _AnnotationCard(
                            annotation: annotation,
                            isSelected: isSelected,
                            isMultiSelectMode: _isMultiSelectMode,
                            isExpanded: _expandedAnnotationIndex == index,
                            onTap: () {
                              if (_isMultiSelectMode) {
                                setState(() {
                                  if (isSelected) {
                                    _selectedAnnotations.remove(annotation);
                                  } else {
                                    _selectedAnnotations.add(annotation);
                                  }
                                });
                              } else {
                                setState(() {
                                  if (_expandedAnnotationIndex == index) {
                                    _expandedAnnotationIndex = null;
                                  } else {
                                    _expandedAnnotationIndex = index;
                                  }
                                });
                                _scrollToLine(annotation.lineNumber);
                              }
                            },
                            onEdit: _isMultiSelectMode
                                ? null
                                : () => _editAnnotationNote(index),
                            onDelete: _isMultiSelectMode
                                ? null
                                : () => _deleteAnnotation(index),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: BottomAppBar(
          color: Theme.of(context).colorScheme.inversePrimary.withOpacity(0.5),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 16.0,
              vertical: 8.0,
            ),
            child: Text(
              _statusMessage,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AnnotationCard extends StatelessWidget {
  final Annotation annotation;
  final bool isSelected;
  final bool isMultiSelectMode;
  final bool isExpanded;
  final VoidCallback onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  const _AnnotationCard({
    required this.annotation,
    required this.isSelected,
    required this.isMultiSelectMode,
    required this.isExpanded,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      color: isSelected ? Colors.blue.withOpacity(0.3) : null,
      child: ListTile(
        onTap: onTap,
        leading: AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: isMultiSelectMode ? 1.0 : 0.0,
          child: Checkbox(
            value: isSelected,
            onChanged: (bool? value) => onTap(),
          ),
        ),
        title: Text(
          annotation.content
              .replaceAll('\n', ' ')
              .replaceAll(RegExp(r'\s+'), ' '),
          overflow: TextOverflow.ellipsis,
          maxLines: 1,
        ),
        subtitle: Text(
          annotation.note.isNotEmpty
              ? annotation.note
              : '行号: ${annotation.lineNumber}',
          maxLines: isExpanded ? null : 2,
          overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
        ),
        trailing: isMultiSelectMode
            ? null
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.edit),
                    color: Colors.blue,
                    onPressed: onEdit,
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete),
                    color: Colors.red,
                    onPressed: onDelete,
                  ),
                ],
              ),
      ),
    );
  }
}
