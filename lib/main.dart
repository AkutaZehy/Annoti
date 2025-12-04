import 'package:flutter/material.dart';
import 'pages/editor_page.dart';

void main() {
  runApp(const AnnotiApp());
}

class AnnotiApp extends StatelessWidget {
  const AnnotiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Annoti',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.green),
        useMaterial3: true,
        fontFamily: 'OPPOSans',
      ),
      home: const EditorPage(),
    );
  }
}
