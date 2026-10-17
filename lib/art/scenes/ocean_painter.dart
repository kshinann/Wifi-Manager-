import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Open sea at sunset seen in perspective. The tide (horizon) rises with the
/// battery level; waves grow and roll faster with charging power, and the sun
/// throws a glittering path across the water.
class OceanPainter extends CustomPainter {
  OceanPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final horizon = h * (0.78 - 0.38 * f.level);

    paintVertical(canvas, Rect.fromLTWH(0, 0, w, horizon + 1), const [
      Color(0xFF0B1033),
      Color(0xFF3B2B6B),
      Color(0xFFE0716A),
      Color(0xFFFFC37A),
    ], const [0, 0.45, 0.85, 1]);
    paintStars(canvas, Size(w, horizon), f.time, count: 50, maxY: 0.5, alpha: 0.6);

    // Sun sitting on the horizon.
    final sun = Offset(w * 0.5, horizon - w * 0.05);
    paintGlow(canvas, sun, w * 0.55, lighten(f.accent, 0.4), 0.25 + 0.25 * f.intensity);
    canvas.drawCircle(sun, w * 0.09, Paint()..color = const Color(0xFFFFE3A3));

    // Wave rows from the horizon to the viewer, drawn far to near so nearer
    // rows cover farther ones.
    const rows = 26;
    final amp = 0.4 + f.intensity * 1.4;
    const deep = Color(0xFF0A2A4A);
    const near = Color(0xFF1C6E8C);
    final crest = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    for (var i = 0; i <= rows; i++) {
      final t = i / rows;
      final y = horizon + (h - horizon) * t * t;
      final a = (1.5 + 22 * t * t) * amp;
      final k = 2 * math.pi / (w * (0.25 + t * 0.6));
      final path = Path()..moveTo(0, h);
      for (var x = 0.0; x <= w + 8; x += 8) {
        final yy = y +
            a * math.sin(x * k + f.phase * 1.6 + i * 1.7) +
            a * 0.4 * math.sin(x * k * 2.3 - f.phase * 2.1 + i);
        path.lineTo(x, yy);
      }
      path
        ..lineTo(w, h)
        ..close();
      canvas.drawPath(path, Paint()..color = Color.lerp(deep, near, t)!);
      crest.color = Colors.white.withValues(alpha: 0.05 + 0.18 * t);
      canvas.drawPath(path, crest);
    }

    // Sun glitter: short bright dashes that shimmer in a column below the sun.
    final glint = Paint()
      ..strokeCap = StrokeCap.round
      ..blendMode = BlendMode.plus;
    final count = (30 + f.intensity * 60).round();
    for (var i = 0; i < count; i++) {
      final t = hash(i, 1);
      final y = horizon + (h - horizon) * t * t;
      final spread = w * (0.05 + 0.35 * t);
      final x = sun.dx + (hash(i, 2) * 2 - 1) * spread;
      final flicker = 0.5 + 0.5 * math.sin(f.time * (3 + hash(i, 3) * 4) + i);
      glint
        ..strokeWidth = 1 + t * 2.5
        ..color = const Color(0xFFFFE3A3).withValues(alpha: 0.55 * flicker * (1 - t * 0.5));
      final len = 3 + t * 16;
      canvas.drawLine(Offset(x - len, y), Offset(x + len, y), glint);
    }
  }

  @override
  bool shouldRepaint(OceanPainter oldDelegate) => oldDelegate.frame != frame;
}
