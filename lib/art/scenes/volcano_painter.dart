import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// An erupting volcano at night. Lava rivers run further down the slopes as
/// the battery fills; the eruption throws more and higher embers with more
/// charging power.
class VolcanoPainter extends CustomPainter {
  VolcanoPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final ground = h * 0.86;
    final crater = Offset(w * 0.5, h * 0.42);
    final craterW = w * 0.14;
    final lava = Color.lerp(const Color(0xFFFF6A1A), f.accent, 0.2)!;

    paintVertical(canvas, Offset.zero & size, const [
      Color(0xFF07040A),
      Color(0xFF1E0A12),
      Color(0xFF4A1410),
    ]);
    paintStars(canvas, size, f.time, count: 70, maxY: 0.4, alpha: 0.7);
    final pulse = 0.8 + 0.2 * math.sin(f.time * 3);
    paintGlow(canvas, crater, w * 0.9, lava, (0.22 + 0.3 * f.intensity) * pulse);

    // Smoke billowing up and drifting.
    for (var i = 0; i < 14; i++) {
      final p = frac(hash(i, 170) + f.time * 0.03);
      final c = crater.translate(
        math.sin(p * 3 + i) * w * 0.06 + p * w * 0.25,
        -p * h * 0.42,
      );
      final r = w * (0.06 + p * 0.16);
      paintGlow(canvas, c, r, const Color(0xFF3A3236), 0.55 * (1 - p));
    }

    // Embers flung out in ballistic arcs.
    final ember = Paint()..blendMode = BlendMode.plus;
    final count = (14 + f.intensity * 90).round();
    for (var i = 0; i < count; i++) {
      final t = frac(hash(i, 180) + f.phase * (0.18 + hash(i, 181) * 0.12));
      final vx = (hash(i, 182) * 2 - 1) * w * 0.35;
      final vy = -h * (0.25 + hash(i, 183) * 0.35) * (0.6 + f.intensity * 0.6);
      final pos = crater.translate(vx * t, vy * t + h * 0.55 * t * t);
      if (pos.dy > ground) continue;
      ember.color = Color.lerp(const Color(0xFFFFE27A), const Color(0xFFFF3B1A), t)!
          .withValues(alpha: (1 - t) * 0.95);
      canvas.drawCircle(pos, 1.2 + (1 - t) * 2.2, ember);
    }

    // The cone.
    final cone = Path()
      ..moveTo(-w * 0.1, ground)
      ..quadraticBezierTo(w * 0.25, ground - h * 0.08, crater.dx - craterW / 2, crater.dy)
      ..lineTo(crater.dx + craterW / 2, crater.dy)
      ..quadraticBezierTo(w * 0.75, ground - h * 0.08, w * 1.1, ground)
      ..close();
    canvas.drawPath(
      cone,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [darken(lava, 0.55), const Color(0xFF1A0E0C), const Color(0xFF0B0707)],
          stops: const [0, 0.3, 1],
        ).createShader(cone.getBounds()),
    );
    canvas.drawOval(
      Rect.fromCenter(center: crater, width: craterW, height: craterW * 0.3),
      Paint()..color = lighten(lava, 0.4).withValues(alpha: pulse),
    );

    // Lava rivers: each traces a wiggly path down the slope; how far it has
    // flowed is the battery level.
    final river = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 4; i++) {
      final side = i.isEven ? -1 : 1;
      final spread = 0.25 + (i ~/ 2) * 0.2;
      final path = Path()..moveTo(crater.dx + side * craterW * 0.2, crater.dy + 2);
      for (var s = 1; s <= 20; s++) {
        final t = s / 20;
        final x = crater.dx + side * w * spread * t + math.sin(t * 9 + i) * w * 0.02;
        final y = crater.dy + (ground - crater.dy) * t;
        path.lineTo(x, y);
      }
      for (final PathMetric metric in path.computeMetrics()) {
        final flowed = metric.extractPath(0, metric.length * f.level.clamp(0.02, 1.0));
        river
          ..strokeWidth = w * 0.035
          ..color = lava.withValues(alpha: 0.45)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, w * 0.02);
        canvas.drawPath(flowed, river);
        river
          ..strokeWidth = w * 0.012
          ..color = lighten(lava, 0.35)
          ..maskFilter = null;
        canvas.drawPath(flowed, river);
      }
    }

    paintVertical(canvas, Rect.fromLTRB(0, ground, w, h), const [
      Color(0xFF0B0707),
      Color(0xFF040203),
    ]);
  }

  @override
  bool shouldRepaint(VolcanoPainter oldDelegate) => oldDelegate.frame != frame;
}
