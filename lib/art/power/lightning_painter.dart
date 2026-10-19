import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Electric storm around a glowing energy core.
///
/// - Slow: the core hums with a few small sparks crawling over it.
/// - Normal: occasional bolts strike the core from the clouds.
/// - Fast: frequent branching bolts and arcs.
/// - Super-fast: a lightning storm with screen flashes.
/// Plugging in fires a shockwave and a volley of strikes. The core grows with
/// the battery level.
class LightningPainter extends CustomPainter {
  LightningPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _tiers = [
    Color(0xFF6E7BFF), // idle
    Color(0xFF7FA8FF), // slow
    Color(0xFF34E7FF), // normal
    Color(0xFF9D7BFF), // fast
    Color(0xFFE2F4FF), // super: white-hot
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final c = Offset(w / 2, h * 0.47);
    final s = size.shortestSide;
    // The plug-in burst counts as a moment of full power.
    final power = math.max(f.power, f.burst * 4);
    final color = tierColor(power, _tiers);
    final coreR = s * (0.1 + 0.05 * f.level) * (1 + 0.04 * math.sin(f.time * 6));

    // Storm sky.
    paintVertical(canvas, Offset.zero & size, const [
      Color(0xFF05040F),
      Color(0xFF0E0B26),
      Color(0xFF04030A),
    ]);
    for (var i = 0; i < 5; i++) {
      final cloud = Offset(w * (0.1 + 0.2 * i) + math.sin(f.time * 0.1 + i) * 20, h * (0.08 + 0.05 * (i % 2)));
      paintGlow(canvas, cloud, w * 0.45, const Color(0xFF2B2366), 0.35);
    }

    // Bolts from the sky to the core. Each slot strikes on its own rhythm;
    // higher tiers mean more slots, striking more often.
    final slots = power < 1.5 ? 0 : (power * 1.8).round();
    final period = 1.8 - 0.35 * power;
    var flash = 0.0;
    for (var i = 0; i < slots; i++) {
      final cycle = f.time / (period * (0.7 + hash(i, 1) * 0.6)) + hash(i, 2);
      final t = frac(cycle);
      const visible = 0.16;
      if (t > visible) continue;
      final seed = cycle.floor() * 31 + i;
      final alpha = 1 - t / visible;
      final from = Offset(w * hash(seed, 3), -10);
      final dir = (from - c);
      final to = c + dir / dir.distance * coreR * 0.9;
      final pts = jaggedLine(from, to, seed, depth: 6, rough: 0.22);
      paintBolt(canvas, pts, color, 1.6 + power * 0.5, alpha);
      // Branches on fast and super-fast.
      if (power > 2.6) {
        for (var b = 0; b < 2; b++) {
          final start = pts[(pts.length * (0.3 + 0.25 * b)).floor()];
          final end = start + Offset((hash(seed, 10 + b) - 0.5) * w * 0.4, h * 0.12 * (0.5 + hash(seed, 12 + b)));
          paintBolt(canvas, jaggedLine(start, end, seed + 7 + b, depth: 4), color, 1.0, alpha * 0.7);
        }
      }
      flash = math.max(flash, alpha);
    }
    // Sky flashes during the super-fast storm.
    if (power > 3.2 && flash > 0) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()..color = color.withValues(alpha: 0.12 * flash * (power - 3.2) / 0.8),
      );
    }

    // Core.
    paintGlow(canvas, c, coreR * (3 + power * 0.6), color, 0.25 + 0.12 * power);
    final core = Rect.fromCircle(center: c, radius: coreR);
    canvas.drawCircle(
      c,
      coreR,
      Paint()
        ..shader = RadialGradient(
          colors: [Colors.white, lighten(color, 0.4), color, darken(color, 0.5)],
          stops: const [0, 0.35, 0.75, 1],
        ).createShader(core),
    );

    // Sparks crawling over the core: present at every tier while charging.
    if (f.charging || f.burst > 0) {
      final sparks = 2 + (power * 3).round();
      for (var i = 0; i < sparks; i++) {
        final cycle = f.time * (2 + power) + hash(i, 20) * 10;
        final seed = cycle.floor() * 13 + i;
        final a = hash(seed, 21) * 2 * math.pi;
        final span = 0.5 + hash(seed, 22) * 0.9;
        final r = coreR * (1.05 + 0.25 * hash(seed, 23));
        final p = c + Offset(math.cos(a), math.sin(a)) * r;
        final q = c + Offset(math.cos(a + span), math.sin(a + span)) * r;
        paintBolt(canvas, jaggedLine(p, q, seed, depth: 4, rough: 0.4), color, 0.9, 1 - frac(cycle));
      }
    }

    // Plug-in shockwave.
    if (f.burst > 0) {
      final r = coreR + (1 - f.burst) * s * 0.9;
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 6 + 18 * f.burst
          ..color = Colors.white.withValues(alpha: 0.6 * f.burst)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
      );
      canvas.drawRect(Offset.zero & size, Paint()..color = Colors.white.withValues(alpha: 0.25 * f.burst * f.burst));
    }
  }

  @override
  bool shouldRepaint(LightningPainter oldDelegate) => oldDelegate.frame != frame;
}
