import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// A glass snow globe with a tiny winter village. Snow piles higher as the
/// battery fills; charging power stirs up a faster, denser blizzard.
class SnowGlobePainter extends CustomPainter {
  SnowGlobePainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final r = math.min(w * 0.38, h * 0.26);
    final c = Offset(w / 2, h * 0.47);
    final sphere = Rect.fromCircle(center: c, radius: r);

    paintVertical(canvas, Offset.zero & size, const [Color(0xFF0B1426), Color(0xFF04070F)]);
    paintGlow(canvas, c, r * 2.2, lighten(f.accent, 0.3), 0.12 + 0.15 * f.intensity);

    // Wooden base.
    final baseTop = c.dy + r * 0.78;
    final base = Path()
      ..moveTo(c.dx - r * 0.8, baseTop)
      ..lineTo(c.dx + r * 0.8, baseTop)
      ..lineTo(c.dx + r * 0.95, baseTop + r * 0.42)
      ..lineTo(c.dx - r * 0.95, baseTop + r * 0.42)
      ..close();
    canvas.drawPath(
      base,
      Paint()
        ..shader = const LinearGradient(colors: [
          Color(0xFF3B2414),
          Color(0xFF8A5A33),
          Color(0xFF3B2414),
        ]).createShader(base.getBounds()),
    );

    // Inside the globe.
    canvas.save();
    canvas.clipPath(Path()..addOval(sphere));
    paintVertical(canvas, sphere, const [Color(0xFF1B3A66), Color(0xFF6E9CC9)]);

    // Snow ground: mound height is the battery level.
    final groundY = c.dy + r * (0.75 - 0.55 * f.level);
    final ground = Path()..moveTo(c.dx - r, c.dy + r);
    for (var x = c.dx - r; x <= c.dx + r + 4; x += 4) {
      final u = (x - c.dx) / r;
      ground.lineTo(x, groundY + u * u * r * 0.2 + math.sin(u * 7) * r * 0.015);
    }
    ground
      ..lineTo(c.dx + r, c.dy + r)
      ..close();

    // Village sits on the snow and rises with it.
    _house(canvas, Offset(c.dx - r * 0.12, groundY + r * 0.02), r * 0.32, f.time);
    for (final (dx, s) in [(-0.55, 0.38), (0.38, 0.5), (0.62, 0.32)]) {
      _tree(canvas, Offset(c.dx + r * dx, groundY + r * 0.06 + dx * dx * r * 0.2), r * s);
    }
    canvas.drawPath(ground, Paint()..color = const Color(0xFFF1F6FF));

    // Swirling snow.
    final flake = Paint()..color = Colors.white;
    final count = (60 + f.intensity * 180).round();
    for (var i = 0; i < count; i++) {
      final orbit = r * (0.15 + hash(i, 90) * 0.8);
      final a = hash(i, 91) * 2 * math.pi + f.phase * (0.3 + hash(i, 92) * 0.5);
      final fall = frac(hash(i, 93) + f.time * 0.03);
      final p = Offset(
        c.dx + math.cos(a) * orbit,
        c.dy + math.sin(a) * orbit * 0.6 + (fall - 0.5) * r * 0.4,
      );
      if (p.dy > groundY + 2) continue;
      flake.color = Colors.white.withValues(alpha: 0.5 + 0.5 * hash(i, 94));
      canvas.drawCircle(p, 0.8 + hash(i, 95) * 1.8, flake);
    }
    canvas.restore();

    // Glass: rim light and highlights.
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = Colors.white.withValues(alpha: 0.35),
    );
    canvas.save();
    canvas.translate(c.dx - r * 0.42, c.dy - r * 0.48);
    canvas.rotate(-0.7);
    final hl = Rect.fromCenter(center: Offset.zero, width: r * 0.55, height: r * 0.2);
    canvas.drawOval(
      hl,
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.white.withValues(alpha: 0.5),
          Colors.white.withValues(alpha: 0),
        ]).createShader(hl),
    );
    canvas.restore();
  }

  void _house(Canvas canvas, Offset base, double s, double time) {
    final body = Rect.fromLTWH(base.dx - s * 0.45, base.dy - s * 0.55, s * 0.9, s * 0.55);
    canvas.drawRect(body, Paint()..color = const Color(0xFF8C3B2E));
    canvas.drawPath(
      Path()
        ..moveTo(body.left - s * 0.1, body.top)
        ..lineTo(body.center.dx, body.top - s * 0.4)
        ..lineTo(body.right + s * 0.1, body.top)
        ..close(),
      Paint()..color = const Color(0xFFE8F0FF),
    );
    // Warm flickering window.
    final flicker = 0.85 + 0.15 * math.sin(time * 7);
    final window = Rect.fromLTWH(body.left + s * 0.12, body.top + s * 0.14, s * 0.2, s * 0.18);
    paintGlow(canvas, window.center, s * 0.5, const Color(0xFFFFC46B), 0.4 * flicker);
    canvas.drawRect(window, Paint()..color = const Color(0xFFFFD27A).withValues(alpha: flicker));
    canvas.drawRect(
      Rect.fromLTWH(body.right - s * 0.32, body.bottom - s * 0.32, s * 0.18, s * 0.32),
      Paint()..color = const Color(0xFF4A2318),
    );
  }

  void _tree(Canvas canvas, Offset base, double s) {
    final path = Path();
    for (var tier = 0; tier < 3; tier++) {
      final top = base.dy - s * (0.5 + tier * 0.25);
      final bottom = base.dy - s * tier * 0.25;
      final half = s * 0.22 * (1 - tier * 0.25);
      path
        ..moveTo(base.dx, top)
        ..lineTo(base.dx + half, bottom)
        ..lineTo(base.dx - half, bottom)
        ..close();
    }
    canvas.drawPath(path, Paint()..color = const Color(0xFF1E5A3C));
  }

  @override
  bool shouldRepaint(SnowGlobePainter oldDelegate) => oldDelegate.frame != frame;
}
