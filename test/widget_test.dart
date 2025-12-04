// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:annoti/main.dart';

void main() {
  testWidgets('App should show file selection prompt', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp());

    // Verify that the file selection prompt is shown
    expect(find.text('请在左侧点击按钮选择一个 .md 或 .txt 文件。'), findsOneWidget);
    
    // Verify that the app title is shown
    expect(find.text('Markdown Reader'), findsOneWidget);
  });

  test('Annotation model serialization test', () {
    final annotation = Annotation(
      content: 'Test content',
      startIndex: 0,
      endIndex: 12,
      lineNumber: 1,
      note: 'Test note',
    );

    // Test toJson
    final json = annotation.toJson();
    expect(json['content'], 'Test content');
    expect(json['startIndex'], 0);
    expect(json['endIndex'], 12);
    expect(json['lineNumber'], 1);
    expect(json['note'], 'Test note');

    // Test fromJson
    final restored = Annotation.fromJson(json);
    expect(restored.content, annotation.content);
    expect(restored.startIndex, annotation.startIndex);
    expect(restored.endIndex, annotation.endIndex);
    expect(restored.lineNumber, annotation.lineNumber);
    expect(restored.note, annotation.note);
  });
}
