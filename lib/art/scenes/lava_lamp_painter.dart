import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// A retro lava lamp. The wax pool at the bottom is the battery level; blobs
/// break off and rise faster, and more of them, the more power flows in.
class LavaLampPainter extends CustomPainter {
  LavaLampPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final c = Offset(w / 2, h * 0.5);
    final glassH = math.min(h * 0.58, w * 1.25);
    final topW = glassH * 0.22;
    final bottomW = glassH * 0.42;
    final glassTop = c.dy - glassH / 2;
    final glassBottom = c.dy + glassH / 2;
    final wax = Color.lerp(const Color(0xFFFF4D6D), f.accent, 0.35)!;

    paintVertical(canvas, Offset.zero & size, const [Color(0xFF12061A), Color(0xFF05030A)]);
    paintGlow(canvas, c, w * 0.8, wax, 0.18 + 0.2 * f.intensity);

    // Tapered glass body: narrow at the top, wide at the bottom.
    final glass = Path()
      ..moveTo(c.dx - topW / 2, glassTop)
      ..lineTo(c.dx + topW / 2, glassTop)
      ..quadraticBezierTo(c.dx + bottomW * 0.62, c.dy + glassH * 0.15, c.dx + bottomW / 2, glassBottom)
      ..lineTo(c.dx - bottomW / 2, glassBottom)
      ..quadraticBezierTo(c.dx - bottomW * 0.62, c.dy + glassH * 0.15, c.dx - topW / 2, glassTop)
      ..close();
    final glassRect = Rect.fromLTRB(c.dx - bottomW * 0.6, glassTop, c.dx + bottomW * 0.6, glassBottom);
    canvas.drawPath(
      glass,
      Paint()
        ..shader = LinearGradient(colors: [
          darken(wax, 0.85),
          darken(wax, 0.55),
          darken(wax, 0.85),
        ]).createShader(glassRect),
    );

    canvas.save();
    canvas.clipPath(glass);

    // Pool of wax: its height is the battery level.
    final poolTop = glassBottom - glassH * (0.06 + 0.5 * f.level);
    final poolPath = Path()..moveTo(glassRect.left, glassBottom);
    for (var x = glassRect.left; x <= glassRect.right + 6; x += 6) {
      final bump = math.sin(x * 0.05 + f.phase * 0.8) * 6 + math.sin(x * 0.11 - f.phase) * 3;
      poolPath.lineTo(x, poolTop + bump);
    }
    poolPath
      ..lineTo(glassRect.right, glassBottom)
      ..close();

    // Draw wax with a blur so blobs merge into each other like real wax.
    final waxPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0, 0.4),
        radius: 0.9,
        colors: [lighten(wax, 0.35), wax, darken(wax, 0.35)],
      ).createShader(glassRect)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, glassH * 0.012);
    canvas.drawPath(poolPath, waxPaint);

    final blobs = 3 + (f.intensity * 6).round();
    for (var i = 0; i < blobs; i++) {
      // Each blob rises and sinks on its own slow cycle.
      final p = frac(hash(i, 80) + f.phase * (0.035 + hash(i, 81) * 0.04));
      final rise = 0.5 - 0.5 * math.cos(p * 2 * math.pi);
      final y = poolTop - (poolTop - glassTop - glassH * 0.05) * rise;
      final x = c.dx + (hash(i, 82) * 2 - 1) * bottomW * 0.22 + math.sin(f.time * 0.4 + i) * bottomW * 0.05;
      final r = glassH * (0.035 + hash(i, 83) * 0.045) * (1 - rise * 0.25);
      final stretch = 1 + 0.35 * math.sin(p * 2 * math.pi).abs();
      canvas.drawOval(
        Rect.fromCenter(center: Offset(x, y), width: r * 2 / stretch, height: r * 2 * stretch),
        waxPaint,
      );
    }
    canvas.restore();

    // Glass highlight and outline.
    canvas.drawPath(
      glass,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = Colors.white.withValues(alpha: 0.18),
    );
    canvas.drawRect(
      Rect.fromLTWH(c.dx - topW * 0.3, glassTop + glassH * 0.05, topW * 0.08, glassH * 0.75),
      Paint()..color = Colors.white.withValues(alpha: 0.08),
    );

    // Metal cap and base.
    final metal = LinearGradient(colors: const [
      Color(0xFF6E7380),
      Color(0xFFE2E6EE),
      Color(0xFF8A909C),
      Color(0xFF3A3E47),
    ]);
    final cap = Path()
      ..moveTo(c.dx - topW / 2, glassTop)
      ..lineTo(c.dx - topW * 0.3, glassTop - glassH * 0.12)
      ..lineTo(c.dx + topW * 0.3, glassTop - glassH * 0.12)
      ..lineTo(c.dx + topW / 2, glassTop)
      ..close();
    canvas.drawPath(cap, Paint()..shader = metal.createShader(cap.getBounds()));
    final base = Path()
      ..moveTo(c.dx - bottomW / 2, glassBottom)
      ..lineTo(c.dx - bottomW * 0.36, glassBottom + glassH * 0.1)
      ..lineTo(c.dx - bottomW * 0.6, glassBottom + glassH * 0.22)
      ..lineTo(c.dx + bottomW * 0.6, glassBottom + glassH * 0.22)
      ..lineTo(c.dx + bottomW * 0.36, glassBottom + glassH * 0.1)
      ..lineTo(c.dx + bottomW / 2, glassBottom)
      ..close();
    canvas.drawPath(base, Paint()..shader = metal.createShader(base.getBounds()));
  }

  @override
  bool shouldRepaint(LavaLampPainter oldDelegate) => oldDelegate.frame != frame;
}
