import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// A hero-style power-up aura blazing around the battery percentage.
///
/// - Slow: a soft blue glow.
/// - Normal: a cyan aura flickering upwards.
/// - Fast: a violet aura with rising energy and shockwaves.
/// - Super-fast: an explosive golden aura crackling with lightning.
/// Plugging in triggers a power-up flash and shockwave. A ring around the
/// centre fills with the battery level.
class AuraPainter extends CustomPainter {
  AuraPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _tiers = [
    Color(0xFF3A4A7A), // idle
    Color(0xFF6FB7FF), // slow
    Color(0xFF34E7FF), // normal
    Color(0xFFB45CFF), // fast
    Color(0xFFFFD34D), // super: golden
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final c = Offset(w / 2, h * 0.47);
    final s = size.shortestSide;
    final power = math.max(f.power, f.burst * 4);
    final color = tierColor(power, _tiers);
    final r0 = s * 0.2 * (1 + 0.15 * f.burst);

    paintVertical(canvas, Offset.zero & size, const [Color(0xFF030308), Color(0xFF0A0815)]);
    paintGlow(canvas, c, s * (0.7 + 0.1 * power), color, 0.12 + 0.08 * power);

    // Ground glow beneath, as if the energy lights the floor.
    canvas.drawOval(
      Rect.fromCenter(center: Offset(c.dx, h * 0.86), width: w * 1.1, height: h * 0.12),
      Paint()
        ..color = color.withValues(alpha: 0.12 + 0.06 * power)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30),
    );

    // Energy streaming upwards through the aura.
    final streak = Paint()
      ..strokeCap = StrokeCap.round
      ..blendMode = BlendMode.plus;
    final n = (16 + power * 30).round();
    for (var i = 0; i < n; i++) {
      final p = frac(hash(i, 1) + f.phase * (0.25 + hash(i, 2) * 0.3));
      final x = c.dx + (hash(i, 3) - 0.5) * r0 * 3.2 * (1 - 0.4 * p);
      final y = h * 0.9 - p * h * 0.95;
      final len = 10 + power * 8;
      streak
        ..strokeWidth = 1.5 + hash(i, 4) * 2
        ..color = lighten(color, 0.4).withValues(alpha: math.sin(p * math.pi) * 0.6);
      canvas.drawLine(Offset(x, y), Offset(x, y + len), streak);
    }

    // Aura layers: flame-like outlines that flicker and stretch upwards.
    final aura = Paint()..blendMode = BlendMode.plus;
    for (var layer = 2; layer >= 0; layer--) {
      final base = r0 * (1.15 + layer * 0.22);
      final amp = r0 * (0.06 + 0.1 * power) * (1 + layer * 0.3);
      final path = Path();
      const k = 96;
      for (var j = 0; j <= k; j++) {
        final a = 2 * math.pi * j / k;
        final up = math.max(0.0, -math.sin(a)); // 1 at the top
        final noise = math.sin(a * 3 + f.phase * 2 + layer) * 0.5 +
            math.sin(a * 7 - f.phase * 3.1 + layer * 2) * 0.3 +
            math.sin(a * 13 + f.phase * 5 + layer) * 0.2;
        final r = base + amp * (0.6 + noise) + up * up * amp * (1.5 + power * 0.6);
        final p = c + Offset(math.cos(a), math.sin(a)) * r;
        if (j == 0) {
          path.moveTo(p.dx, p.dy);
        } else {
          path.lineTo(p.dx, p.dy);
        }
      }
      path.close();
      final bounds = Rect.fromCircle(center: c, radius: base + amp * 4);
      aura.shader = RadialGradient(
        colors: [
          color.withValues(alpha: 0),
          color.withValues(alpha: 0.18 + 0.05 * power),
          lighten(color, 0.3).withValues(alpha: 0.32 + 0.08 * power),
          color.withValues(alpha: 0),
        ],
        stops: const [0, 0.55, 0.8, 1],
      ).createShader(bounds);
      canvas.drawPath(path, aura);
    }

    // Shockwaves pulsing out on fast and super-fast.
    if (power > 2.5) {
      final strength = ((power - 2.5) / 1.5).clamp(0.0, 1.0);
      for (var i = 0; i < 2; i++) {
        final t = frac(f.time / (1.6 - 0.5 * strength) + i * 0.5);
        canvas.drawCircle(
          c,
          r0 * 1.2 + t * s * 0.7,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 3 * (1 - t) + 1
            ..color = lighten(color, 0.3).withValues(alpha: 0.5 * (1 - t) * strength),
        );
      }
    }

    // Lightning crackling around the aura on super-fast.
    if (power > 3.3) {
      final crackle = ((power - 3.3) / 0.7).clamp(0.0, 1.0);
      for (var i = 0; i < 4; i++) {
        final cycle = f.time * 5 + hash(i, 20) * 10;
        final seed = cycle.floor() * 7 + i;
        final a = hash(seed, 21) * 2 * math.pi;
        final p = c + Offset(math.cos(a), math.sin(a)) * r0 * 1.3;
        final q = c + Offset(math.cos(a + 0.7), math.sin(a + 0.7)) * r0 * 1.9;
        paintBolt(canvas, jaggedLine(p, q, seed, depth: 4, rough: 0.35), color, 1.1, crackle * (1 - frac(cycle)));
      }
    }

    // Battery ring.
    final ringRect = Rect.fromCircle(center: c, radius: r0 * 0.95);
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(c, r0 * 0.95, ring..strokeWidth = 4..color = Colors.white.withValues(alpha: 0.08));
    canvas.drawArc(
      ringRect,
      -math.pi / 2,
      2 * math.pi * f.level.clamp(0.0, 1.0),
      false,
      ring
        ..strokeWidth = 6
        ..color = lighten(color, 0.35)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
    );

    // Plug-in power-up.
    if (f.burst > 0) {
      canvas.drawCircle(
        c,
        r0 + (1 - f.burst) * s,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 20 * f.burst + 2
          ..color = const Color(0xFFFFF1B8).withValues(alpha: 0.7 * f.burst)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
      );
      canvas.drawRect(Offset.zero & size, Paint()..color = Colors.white.withValues(alpha: 0.3 * f.burst * f.burst));
    }
  }

  @override
  bool shouldRepaint(AuraPainter oldDelegate) => oldDelegate.frame != frame;
}
