import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;
import '../main.dart';

class AnnotatedMarkdownViewer extends StatefulWidget {
  final String markdownContent;
  final List<Annotation> annotations;
  final bool isAnnotationMode;
  final Function(TextSelection) onSelectionChanged;
  final int? activeLine;

  const AnnotatedMarkdownViewer({
    super.key,
    required this.markdownContent,
    required this.annotations,
    required this.isAnnotationMode,
    required this.onSelectionChanged,
    this.activeLine,
  });

  @override
  State<AnnotatedMarkdownViewer> createState() =>
      AnnotatedMarkdownViewerState();
}

class AnnotatedMarkdownViewerState extends State<AnnotatedMarkdownViewer> {
  late final ScrollController _previewScrollController;
  late final ScrollController _annotationScrollController;
  final Map<int, GlobalKey> _previewLineKeys = {};

  @override
  void initState() {
    super.initState();
    _previewScrollController = ScrollController();
    _annotationScrollController = ScrollController();
    _createPreviewLineKeys();
  }

  @override
  void didUpdateWidget(AnnotatedMarkdownViewer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.markdownContent != widget.markdownContent) {
      _createPreviewLineKeys();
    }
  }

  void _createPreviewLineKeys() {
    _previewLineKeys.clear();
    final lines = widget.markdownContent.split('\n');
    for (int i = 0; i < lines.length; i++) {
      _previewLineKeys[i + 1] = GlobalKey();
    }
  }

  void scrollToLine(int lineNumber) {
    if (widget.isAnnotationMode) {
      final targetAnnotation = widget.annotations.firstWhere(
        (a) => a.lineNumber == lineNumber,
        orElse: () => Annotation(
          content: '',
          startIndex: -1,
          endIndex: -1,
          lineNumber: -1,
        ),
      );

      if (targetAnnotation.startIndex != -1) {
        final textPainter = TextPainter(
          text: TextSpan(
            text: widget.markdownContent.substring(
              0,
              targetAnnotation.startIndex,
            ),
            style: const TextStyle(fontSize: 14.0),
          ),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: MediaQuery.of(context).size.width * 0.5);

        _annotationScrollController.animateTo(
          textPainter.height,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    } else {
      final key = _previewLineKeys[lineNumber];
      if (key != null) {
        final context = key.currentContext;
        if (context != null) {
          Scrollable.ensureVisible(
            context,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            alignment: 0.5,
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final annotationLines = widget.annotations
        .map((a) => a.lineNumber)
        .toSet()
        .toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 40, // 增加宽度以容纳两个标记
          child: widget.isAnnotationMode
              ? const SizedBox.shrink()
              : _MarkerWidget(
                  scrollController: _previewScrollController,
                  activeLine: widget.activeLine,
                  lineKeys: _previewLineKeys,
                  annotatedLines: annotationLines,
                ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: widget.isAnnotationMode
              ? _buildAnnotatedText()
              : _buildMarkdownContent(),
        ),
      ],
    );
  }

  Widget _buildAnnotatedText() {
    final spans = <InlineSpan>[];
    int lastIndex = 0;

    final sortedAnnotations = widget.annotations.toList()
      ..sort((a, b) => a.startIndex.compareTo(b.startIndex));

    for (var annotation in sortedAnnotations) {
      if (annotation.startIndex > lastIndex) {
        spans.add(
          TextSpan(
            text: widget.markdownContent.substring(
              lastIndex,
              annotation.startIndex,
            ),
          ),
        );
      }
      final annotatedText = widget.markdownContent.substring(
        annotation.startIndex,
        annotation.endIndex,
      );
      spans.add(
        TextSpan(
          text: annotatedText,
          style: const TextStyle(backgroundColor: Colors.yellow),
        ),
      );
      lastIndex = annotation.endIndex;
    }

    if (lastIndex < widget.markdownContent.length) {
      spans.add(TextSpan(text: widget.markdownContent.substring(lastIndex)));
    }

    return SingleChildScrollView(
      controller: _annotationScrollController,
      child: SelectableText.rich(
        TextSpan(children: spans),
        onSelectionChanged: (selection, cause) =>
            widget.onSelectionChanged(selection),
      ),
    );
  }

  Widget _buildMarkdownContent() {
    final lines = widget.markdownContent.split('\n');
    return SingleChildScrollView(
      controller: _previewScrollController,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(lines.length, (index) {
          final line = lines[index];
          return Padding(
            key: _previewLineKeys[index + 1],
            padding: const EdgeInsets.symmetric(vertical: 2.0),
            child: MarkdownBody(
              data: line.trim().isNotEmpty ? line : ' ',
              selectable: false,
              styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)),
              onTapLink: (text, href, title) {},
            ),
          );
        }),
      ),
    );
  }
}

class _MarkerWidget extends StatefulWidget {
  final ScrollController scrollController;
  final int? activeLine;
  final Map<int, GlobalKey> lineKeys;
  final List<int> annotatedLines;

  const _MarkerWidget({
    required this.scrollController,
    required this.activeLine,
    required this.lineKeys,
    required this.annotatedLines,
  });

  @override
  __MarkerWidgetState createState() => __MarkerWidgetState();
}

class __MarkerWidgetState extends State<_MarkerWidget> {
  double _markerPosition = 0.0;
  bool _isMounted = false;

  @override
  void initState() {
    super.initState();
    _isMounted = true;
    widget.scrollController.addListener(_updateMarkerPosition);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _updateMarkerPosition();
    });
  }

  @override
  void didUpdateWidget(_MarkerWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.activeLine != widget.activeLine) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _updateMarkerPosition();
      });
    }
  }

  @override
  void dispose() {
    widget.scrollController.removeListener(_updateMarkerPosition);
    _isMounted = false;
    super.dispose();
  }

  void _updateMarkerPosition() {
    if (widget.activeLine == null || !_isMounted) return;

    final key = widget.lineKeys[widget.activeLine!];
    final context = key?.currentContext;
    if (context == null) return;

    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null) return;

    final scrollBox = context.findAncestorRenderObjectOfType<RenderBox>();
    if (scrollBox == null) return;

    final targetPosition = renderBox
        .localToGlobal(
          Offset(0, renderBox.size.height / 2),
          ancestor: scrollBox,
        )
        .dy;

    if (_isMounted) {
      setState(() {
        _markerPosition = targetPosition;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewportHeight = MediaQuery.of(context).size.height;
    final markers = <Widget>[];

    // 添加二级标记（批注标记）
    for (int lineNumber in widget.annotatedLines) {
      final key = widget.lineKeys[lineNumber];
      if (key == null || key.currentContext == null) continue;

      final renderBox = key.currentContext!.findRenderObject() as RenderBox;
      final scrollBox = key.currentContext!
          .findAncestorRenderObjectOfType<RenderBox>();
      if (scrollBox == null) continue;

      final position = renderBox
          .localToGlobal(
            Offset(0, renderBox.size.height / 2),
            ancestor: scrollBox,
          )
          .dy;

      final displayPosition = position - widget.scrollController.offset;
      if (displayPosition >= 0 && displayPosition <= viewportHeight) {
        markers.add(
          Positioned(
            left: 0,
            top: displayPosition - 8,
            child: const Icon(Icons.circle, size: 16, color: Colors.orange),
          ),
        );
      }
    }

    // 添加主定位标
    if (widget.activeLine != null) {
      final key = widget.lineKeys[widget.activeLine!];
      if (key != null && key.currentContext != null) {
        final renderBox = key.currentContext!.findRenderObject() as RenderBox;
        final scrollBox = key.currentContext!
            .findAncestorRenderObjectOfType<RenderBox>();
        if (scrollBox != null) {
          final targetPosition = renderBox
              .localToGlobal(
                Offset(0, renderBox.size.height / 2),
                ancestor: scrollBox,
              )
              .dy;

          final markerDisplayPosition =
              targetPosition - widget.scrollController.offset;
          final isVisible =
              markerDisplayPosition >= 0 &&
              markerDisplayPosition <= viewportHeight;

          if (isVisible) {
            markers.add(
              Positioned(
                left: 20,
                top: markerDisplayPosition - 8,
                child: const Icon(
                  Icons.play_arrow,
                  size: 16,
                  color: Colors.blue,
                ),
              ),
            );
          } else {
            // 如果主定位标不在可视区域内，显示方向指示
            markers.add(
              Align(
                alignment: markerDisplayPosition < 0
                    ? Alignment.topCenter
                    : Alignment.bottomCenter,
                child: Icon(
                  markerDisplayPosition < 0
                      ? Icons.keyboard_arrow_up
                      : Icons.keyboard_arrow_down,
                  color: Colors.blue,
                ),
              ),
            );
          }
        }
      }
    }

    return Stack(children: markers);
  }
}
