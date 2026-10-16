import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'art_frame.dart';

/// A glass sphere filling with glowing liquid. The surface ripples and
/// bubbles rise faster as more power flows in; a 3D ring of light orbits it
/// and energy particles stream up from below while charging.
class LiquidOrbPainter extends CustomPainter {
  LiquidOrbPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final c = size.center(Offset.zero);
    final r = size.shortestSide * 0.3;
    final cam = Camera(center: c, unit: r, distance: 5);

    paintBackdrop(canvas, size, f, c);
    _inflow(canvas, size, c, r, f);
    _ring(canvas, cam, r, f, front: false);

    // Outer glow.
    canvas.drawCircle(
      c,
      r * 1.05,
      Paint()
        ..color = f.accent.withValues(alpha: 0.12 + 0.3 * f.intensity)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.18),
    );

    // Glass body.
    final sphere = Rect.fromCircle(center: c, radius: r);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-0.3, -0.4),
          colors: [Color(0xFF1B2436), Color(0xFF060911)],
        ).createShader(sphere),
    );

    canvas.save();
    canvas.clipPath(Path()..addOval(sphere));
    _liquid(canvas, c, r, f);
    canvas.restore();

    // Rim light sweeping around the glass.
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.025
        ..shader = SweepGradient(
          colors: [
            f.accent.withValues(alpha: 0.05),
            lighten(f.accent, 0.5).withValues(alpha: 0.9),
            f.accent.withValues(alpha: 0.05),
            f.accent.withValues(alpha: 0.4),
            f.accent.withValues(alpha: 0.05),
          ],
          transform: GradientRotation(f.phase * 0.8),
        ).createShader(sphere),
    );

    // Specular highlight.
    canvas.save();
    canvas.translate(c.dx - r * 0.38, c.dy - r * 0.5);
    canvas.rotate(-0.55);
    final hl = Rect.fromCenter(center: Offset.zero, width: r * 0.55, height: r * 0.24);
    canvas.drawOval(
      hl,
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.white.withValues(alpha: 0.35),
          Colors.white.withValues(alpha: 0),
        ]).createShader(hl),
    );
    canvas.restore();

    _ring(canvas, cam, r, f, front: true);
  }

  void _liquid(Canvas canvas, Offset c, double r, ArtFrame f) {
    final level = f.level.clamp(0.03, 0.97);
    final surfaceY = c.dy + r - 2 * r * level;
    final dy = surfaceY - c.dy;
    final half = math.sqrt(math.max(0, r * r - dy * dy));
    final eh = half * 0.28;
    final amp = r * 0.018 * (0.6 + f.intensity * 1.8);

    // Point on the wobbling elliptical surface; theta in (0, pi) is the
    // front half facing the viewer.
    Offset surf(double theta) => Offset(
          c.dx + half * math.cos(theta),
          surfaceY +
              eh * math.sin(theta) +
              amp * math.sin(3 * theta + f.phase * 2.2) +
              amp * 0.6 * math.sin(5 * theta - f.phase * 3.3),
        );

    final bottom = c.dy + r;
    final body = Path()..moveTo(c.dx - r, surf(math.pi).dy);
    for (var i = 0; i <= 48; i++) {
      final p = surf(math.pi - math.pi * i / 48);
      body.lineTo(p.dx, p.dy);
    }
    body
      ..lineTo(c.dx + r, surf(0).dy)
      ..lineTo(c.dx + r, bottom)
      ..lineTo(c.dx - r, bottom)
      ..close();

    final liquidRect = Rect.fromLTRB(c.dx - r, surfaceY - eh, c.dx + r, bottom);
    canvas.drawPath(
      body,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            lighten(f.accent, 0.1),
            f.accent,
            darken(f.accent, 0.75),
          ],
          stops: const [0, 0.35, 1],
        ).createShader(liquidRect),
    );

    // Side shading so the liquid reads as a rounded volume.
    canvas.drawPath(
      body,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.2, -0.1),
          radius: 0.9,
          colors: [Colors.transparent, Colors.black.withValues(alpha: 0.45)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Bubbles.
    final bubble = Paint();
    final n = (6 + f.intensity * 30).round();
    final depth = bottom - surfaceY;
    if (depth > r * 0.08) {
      for (var i = 0; i < n; i++) {
        final p = frac(hash(i, 1) + f.phase * (0.12 + hash(i, 2) * 0.2));
        final y = bottom - p * depth;
        final x = c.dx +
            (hash(i, 3) * 2 - 1) * r * 0.7 +
            math.sin(f.time * 2 + i) * r * 0.03;
        bubble.color = Colors.white.withValues(alpha: 0.4 * (1 - p * 0.6));
        canvas.drawCircle(Offset(x, y), r * (0.008 + hash(i, 4) * 0.022), bubble);
      }
    }

    // The liquid's top surface, seen slightly from above.
    final top = Path()..moveTo(surf(0).dx, surf(0).dy);
    for (var i = 1; i <= 96; i++) {
      final p = surf(2 * math.pi * i / 96);
      top.lineTo(p.dx, p.dy);
    }
    top.close();
    final topRect = Rect.fromCenter(
      center: Offset(c.dx, surfaceY),
      width: math.max(1, half * 2),
      height: math.max(1, eh * 2),
    );
    canvas.drawPath(
      top,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(math.sin(f.time * 0.7) * 0.4, -0.2),
          colors: [
            lighten(f.accent, 0.55).withValues(alpha: 0.95),
            lighten(f.accent, 0.15).withValues(alpha: 0.85),
          ],
        ).createShader(topRect),
    );
  }

  /// A tilted ring of light dots orbiting the orb. The back half is drawn
  /// before the sphere and the front half after it, so it wraps in 3D.
  void _ring(Canvas canvas, Camera cam, double r, ArtFrame f, {required bool front}) {
    const n = 72;
    final paint = Paint()..blendMode = BlendMode.plus;
    for (var i = 0; i < n; i++) {
      final a = 2 * math.pi * i / n + f.phase * 0.5;
      final v = Vec3(math.cos(a) * 1.4, 0, math.sin(a) * 1.4)
          .rotateX(1.2)
          .rotateZ(-0.28);
      final p = cam.project(v);
      if (p.isFront != front) continue;
      final pulse = 0.5 + 0.5 * math.sin(a * 3 - f.phase * 4);
      final alpha = (front ? 0.85 : 0.3) * (0.25 + 0.75 * pulse) * (0.3 + 0.7 * f.intensity);
      paint.color = lighten(f.accent, 0.3).withValues(alpha: alpha.clamp(0.0, 1.0));
      canvas.drawCircle(p.offset, r * 0.016 * p.scale * (0.7 + pulse * 0.6), paint);
    }
  }

  /// Energy particles streaming up from the bottom edge into the orb.
  void _inflow(Canvas canvas, Size size, Offset c, double r, ArtFrame f) {
    if (!f.charging) return;
    final n = (8 + f.intensity * 46).round();
    final paint = Paint()..blendMode = BlendMode.plus;
    for (var i = 0; i < n; i++) {
      final p = frac(hash(i, 21) + f.phase * (0.18 + hash(i, 22) * 0.18));
      final eased = 1 - math.pow(1 - p, 2).toDouble();
      final spread = hash(i, 23) * 2 - 1;
      final start = Offset(c.dx + spread * size.width * 0.45, size.height + 10);
      final end = Offset(c.dx + spread * r * 0.25, c.dy + r * 0.9);
      final pos = Offset.lerp(start, end, eased)!;
      final alpha = math.sin(p * math.pi) * (0.4 + 0.6 * f.intensity);
      paint.color = lighten(f.accent, 0.4).withValues(alpha: alpha.clamp(0.0, 1.0));
      final trail = Offset.lerp(start, end, math.max(0, eased - 0.04))!;
      paint.strokeWidth = r * 0.012;
      paint.strokeCap = StrokeCap.round;
      canvas.drawLine(trail, pos, paint);
    }
  }

  @override
  bool shouldRepaint(LiquidOrbPainter oldDelegate) => oldDelegate.frame != frame;
}
