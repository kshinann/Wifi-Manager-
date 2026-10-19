import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// A whirlpool seen from above at an angle.
///
/// - Slow: calm water with gentle ripples spreading outwards.
/// - Normal: the water begins to turn.
/// - Fast: a spinning whirlpool with foam spiral arms.
/// - Super-fast: a raging vortex throwing spray up from its eye.
/// Plugging in sends a splash of droplets out from the centre. A foam ring
/// around the rim fills with the battery level.
class WaterVortexPainter extends CustomPainter {
  WaterVortexPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _squash = 0.58; // vertical squash: viewing the water at an angle

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final c = Offset(w / 2, h * 0.5);
    final maxR = w * 0.62;
    final power = math.max(f.power, f.burst * 4);
    final spin = ((power - 1) / 2).clamp(0.0, 1.0); // 0 calm → 1 whirlpool
    final spray = ((power - 3) / 1).clamp(0.0, 1.0);

    // Deep water, darker towards the eye.
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(0, 0),
          radius: 0.9,
          colors: [
            const Color(0xFF01060F),
            Color.lerp(const Color(0xFF06314A), f.accent, 0.15)!,
            const Color(0xFF0A5170),
          ],
          stops: const [0, 0.45, 1],
        ).createShader(rect),
    );
    // Drifting caustic light.
    for (var i = 0; i < 6; i++) {
      final p = Offset(
        w * (0.5 + 0.45 * math.sin(f.time * 0.15 + i * 1.7)),
        h * (0.5 + 0.4 * math.cos(f.time * 0.12 + i * 2.3)),
      );
      paintGlow(canvas, p, w * 0.35, const Color(0xFF3FD0E8), 0.08);
    }

    // Ripples spreading from the centre: always present, calmer when slow.
    final ripple = Paint()..style = PaintingStyle.stroke;
    for (var i = 0; i < 6; i++) {
      final t = frac(f.time * (0.08 + 0.05 * power) + i / 6);
      final r = maxR * 1.1 * t;
      ripple
        ..strokeWidth = 1.5 + 2 * (1 - t)
        ..color = Colors.white.withValues(alpha: 0.22 * (1 - t) * (1 - spin * 0.6));
      canvas.drawOval(Rect.fromCenter(center: c, width: r * 2, height: r * 2 * _squash), ripple);
    }

    // Foam streaks orbiting the eye: inner water turns faster.
    if (spin > 0) {
      final streak = Paint()
        ..strokeCap = StrokeCap.round
        ..blendMode = BlendMode.plus;
      final n = (90 + power * 70).round();
      for (var i = 0; i < n; i++) {
        final u = 0.08 + 0.92 * hash(i, 1);
        final r = maxR * u;
        // Spiral: angle also depends on radius, so streaks form arms.
        final a = hash(i % 3, 2) * 2 * math.pi + math.log(u) * 2.2 + hash(i, 3) * 0.9 + f.phase * (0.6 + power * 0.5) / (0.25 + u);
        final len = 0.12 + 0.25 * spin;
        final p0 = c + Offset(math.cos(a - len), math.sin(a - len) * _squash) * r;
        final p1 = c + Offset(math.cos(a), math.sin(a) * _squash) * r;
        streak
          ..strokeWidth = 1 + 2.5 * (1 - u)
          ..color = Colors.white.withValues(alpha: spin * (0.15 + 0.45 * (1 - u)) * (0.4 + 0.6 * hash(i, 4)));
        canvas.drawLine(p0, p1, streak);
      }
    }

    // The eye.
    final eyeR = maxR * (0.06 + 0.1 * spin);
    final eye = Rect.fromCenter(center: c, width: eyeR * 2, height: eyeR * 2 * _squash);
    canvas.drawOval(
      eye.inflate(eyeR * 0.6),
      Paint()
        ..shader = RadialGradient(colors: [
          Colors.black.withValues(alpha: 0.9),
          Colors.black.withValues(alpha: 0),
        ]).createShader(eye.inflate(eyeR * 0.6)),
    );

    // Spray thrown up from the eye on super-fast charging.
    if (spray > 0) {
      final drop = Paint()..blendMode = BlendMode.plus;
      final n = (60 * spray).round();
      for (var i = 0; i < n; i++) {
        final p = frac(hash(i, 10) + f.phase * (0.3 + hash(i, 11) * 0.3));
        final vx = (hash(i, 12) - 0.5) * w * 0.7;
        final vy = h * (0.45 + 0.35 * hash(i, 13));
        final pos = c + Offset(vx * p, -vy * p + h * 0.55 * p * p);
        drop.color = const Color(0xFFCFF6FF).withValues(alpha: (1 - p) * 0.8 * spray);
        canvas.drawCircle(pos, 1.5 + 2.5 * (1 - p), drop);
      }
    }

    // Foam ring on the rim showing the battery level.
    final ringRect = Rect.fromCenter(center: c, width: maxR * 2.02, height: maxR * 2.02 * _squash);
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawOval(ringRect, ring..strokeWidth = 3..color = Colors.white.withValues(alpha: 0.1));
    canvas.drawArc(
      ringRect,
      math.pi / 2,
      2 * math.pi * f.level.clamp(0.0, 1.0),
      false,
      ring
        ..strokeWidth = 5
        ..color = lighten(f.accent, 0.5).withValues(alpha: 0.9)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
    );

    // Plug-in splash.
    if (f.burst > 0) {
      final drop = Paint()..color = Colors.white.withValues(alpha: 0.8 * f.burst);
      final r = (1 - f.burst) * maxR * 1.3;
      for (var i = 0; i < 40; i++) {
        final a = 2 * math.pi * i / 40 + hash(i, 30) * 0.2;
        final lift = math.sin((1 - f.burst) * math.pi) * h * 0.08 * hash(i, 31);
        canvas.drawCircle(c + Offset(math.cos(a), math.sin(a) * _squash) * r - Offset(0, lift), 2 + 3 * f.burst, drop);
      }
      canvas.drawOval(
        Rect.fromCenter(center: c, width: r * 2, height: r * 2 * _squash),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4 * f.burst + 1
          ..color = Colors.white.withValues(alpha: 0.6 * f.burst),
      );
    }
  }

  @override
  bool shouldRepaint(WaterVortexPainter oldDelegate) => oldDelegate.frame != frame;
}
