import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'pages/editor_page.dart' show EditorPage;

void main() {
  // Check if running on supported platform
  if (kIsWeb) {
    runApp(const UnsupportedPlatformApp(
      message: 'Web platform is not supported. Please run on Windows desktop.',
    ));
    return;
  }
  
  if (!Platform.isWindows) {
    runApp(const UnsupportedPlatformApp(
      message: 'Only Windows desktop is currently supported.',
    ));
    return;
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

class UnsupportedPlatformApp extends StatelessWidget {
  final String message;
  
  const UnsupportedPlatformApp({
    super.key,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Annoti',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.red),
        useMaterial3: true,
      ),
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Platform Not Supported'),
          backgroundColor: Colors.red.shade300,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.red.shade700,
                ),
                const SizedBox(height: 24),
                Text(
                  'Platform Not Supported',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Colors.red.shade700,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 24),
                const Text(
                  'Annoti is a Windows desktop application that requires:\n'
                  '• Windows operating system\n'
                  '• Desktop environment (not web browser)',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
