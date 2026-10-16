import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'ui/charging_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  runApp(const ChargeVerseApp());
}

class ChargeVerseApp extends StatelessWidget {
  const ChargeVerseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ChargeVerse',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF34E7FF),
        useMaterial3: true,
      ),
      home: const ChargingScreen(),
    );
  }
}
