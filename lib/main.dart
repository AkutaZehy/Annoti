import 'package:flutter/material.dart';
import 'package:flutter_inappwebview_windows/flutter_inappwebview_windows.dart';
import 'pages/editor_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize WebView for Windows
  if (InAppWebViewPlatform.instance is WindowsInAppWebViewPlatform) {
    await WindowsInAppWebViewPlatform.instance!.init();
  }
  
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
