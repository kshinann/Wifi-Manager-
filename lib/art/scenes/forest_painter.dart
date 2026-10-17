import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Layered pine forest going from night to sunrise as the battery fills.
/// Fireflies multiply and dance faster with charging power, and the layers
/// drift with parallax for depth.
class ForestPainter extends CustomPainter {
  ForestPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final dawn = f.level;

    // Sky blends from night to sunrise.
    final top = Color.lerp(const Color(0xFF050817), const Color(0xFF3E6FB0), dawn)!;
    final mid = Color.lerp(const Color(0xFF14183A), const Color(0xFFF2A65A), dawn)!;
    final low = Color.lerp(const Color(0xFF1E2246), const Color(0xFFFFE0A3), dawn)!;
    paintVertical(canvas, Offset.zero & size, [top, mid, low], const [0, 0.55, 0.8]);
    paintStars(canvas, size, f.time, count: 80, maxY: 0.6, alpha: 1 - dawn);

    // Rising sun / moon.
    final sunY = h * (0.85 - 0.45 * dawn);
    final sun = Offset(w * 0.68, sunY);
    final sunColor = Color.lerp(const Color(0xFFDDE6FF), const Color(0xFFFFD27A), dawn)!;
    paintGlow(canvas, sun, w * 0.5, sunColor, 0.15 + 0.35 * dawn);
    canvas.drawCircle(sun, w * 0.07, Paint()..color = sunColor);

    // God rays once the sun is up.
    if (dawn > 0.3) {
      final ray = Paint()..blendMode = BlendMode.plus;
      for (var i = 0; i < 6; i++) {
        final a = -2.2 + i * 0.25 + math.sin(f.time * 0.2 + i) * 0.03;
        final end = sun + Offset(math.cos(a), -math.sin(a)) * h * -1.2;
        ray
          ..strokeWidth = w * 0.06
          ..shader = LinearGradient(colors: [
            sunColor.withValues(alpha: 0.12 * (dawn - 0.3)),
            sunColor.withValues(alpha: 0),
          ]).createShader(Rect.fromPoints(sun, end));
        canvas.drawLine(sun, end, ray);
      }
    }

    // Four tree layers, far to near: lighter and foggier in the distance.
    final night = Color.lerp(const Color(0xFF0B0F24), const Color(0xFF2B3B5A), dawn)!;
    for (var layer = 0; layer < 4; layer++) {
      final t = layer / 3;
      final baseY = h * (0.62 + t * 0.3);
      final treeH = h * (0.12 + t * 0.22);
      final color = Color.lerp(
        Color.lerp(night, mid, 0.55)!,
        darken(const Color(0xFF0F2A1E), 0.4 * (1 - dawn)),
        t,
      )!;
      final paint = Paint()..color = color;
      canvas.drawRect(Rect.fromLTRB(0, baseY, w, h), paint);
      final count = 7 + layer * 3;
      final spacing = w / count * 1.2;
      final period = w + spacing * 2;
      // Nearer layers drift faster (parallax); wrapping by the same period
      // as the tree positions keeps the motion seamless.
      final drift = (f.phase * w * 0.004 * (1 + layer)) % period;
      for (var i = -1; i <= count + 1; i++) {
        final x = (i * spacing + drift + hash(i, 40 + layer) * spacing * 0.6) % period - spacing;
        final th = treeH * (0.7 + hash(i, 50 + layer) * 0.6);
        _pine(canvas, Offset(x, baseY + 2), th, paint);
      }
      // Fog between layers.
      paintVertical(canvas, Rect.fromLTRB(0, baseY - treeH * 0.3, w, baseY + treeH * 0.2), [
        mid.withValues(alpha: 0),
        mid.withValues(alpha: 0.18 * (1 - t)),
        mid.withValues(alpha: 0),
      ]);
    }

    // Fireflies, tinted by the charge colour.
    final fly = Paint()..blendMode = BlendMode.plus;
    final count = (12 + f.intensity * 60).round();
    final glow = Color.lerp(const Color(0xFFFFF27A), f.accent, 0.35)!;
    for (var i = 0; i < count; i++) {
      final s = 0.3 + hash(i, 60) * 0.6;
      final x = w * hash(i, 61) + math.sin(f.phase * s + i) * w * 0.08;
      final y = h * (0.45 + hash(i, 62) * 0.5) + math.cos(f.phase * s * 1.3 + i * 2) * h * 0.04;
      final blink = math.max(0.0, math.sin(f.time * (1 + hash(i, 63) * 2) + i * 3));
      fly.color = glow.withValues(alpha: 0.9 * blink * (1 - dawn * 0.6));
      canvas.drawCircle(Offset(x, y), 2.2, fly);
      fly.color = glow.withValues(alpha: 0.18 * blink * (1 - dawn * 0.6));
      canvas.drawCircle(Offset(x, y), 9, fly);
    }
  }

  void _pine(Canvas canvas, Offset base, double height, Paint paint) {
    final wTree = height * 0.42;
    final path = Path();
    for (var tier = 0; tier < 3; tier++) {
      final tierTop = base.dy - height * (0.45 + tier * 0.27);
      final tierBottom = base.dy - height * (tier * 0.27);
      final half = wTree * (1 - tier * 0.25) / 2;
      path
        ..moveTo(base.dx, tierTop)
        ..lineTo(base.dx + half, tierBottom)
        ..lineTo(base.dx - half, tierBottom)
        ..close();
    }
    path.addRect(Rect.fromLTWH(base.dx - height * 0.03, base.dy - height * 0.08, height * 0.06, height * 0.1));
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(ForestPainter oldDelegate) => oldDelegate.frame != frame;
}
