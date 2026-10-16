import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'art_frame.dart';

/// A tilted 3D spiral galaxy whose stars spiral inward into a glowing core.
/// More power means more stars and a faster inflow; a ring around the disc
/// traces the battery level.
class ParticleGalaxyPainter extends CustomPainter {
  ParticleGalaxyPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _maxStars = 900;
  static const _arms = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final c = size.center(Offset.zero);
    final unit = size.shortestSide * 0.26;
    final cam = Camera(center: c, unit: unit, distance: 4);
    final tilt = 1.08 + 0.08 * math.sin(f.time * 0.25);
    const roll = 0.32;

    paintBackdrop(canvas, size, f, c);
    _levelRing(canvas, cam, f, tilt, roll, front: false);

    final count = (260 + f.intensity * (_maxStars - 260)).round();
    final inflow = f.charging ? 0.05 + 0.03 * f.intensity : 0.012;
    final paint = Paint()..blendMode = BlendMode.plus;
    final hot = lighten(f.accent, 0.75);

    for (var i = 0; i < count; i++) {
      final speed = 0.6 + hash(i, 1) * 0.8;
      // Distance from the core shrinks over time, then the star respawns at
      // the rim, so the whole disc continuously drains into the core.
      final life = frac(hash(i, 2) + f.phase * inflow * speed);
      final radius = 0.12 + (1 - life) * 1.65;
      final arm = (i % _arms) * 2 * math.pi / _arms;
      final scatter = (hash(i, 3) * 2 - 1) * (0.25 + radius * 0.25);
      final theta = arm + radius * 2.3 + scatter + f.phase * 0.35 / (0.35 + radius);
      final height = (hash(i, 4) * 2 - 1) * 0.06 * (1.8 - radius);

      final p = cam.project(
        Vec3(math.cos(theta) * radius, height, math.sin(theta) * radius)
            .rotateX(tilt)
            .rotateZ(roll),
      );

      final edgeFade = math.min(1.0, life * 6);
      final coreFade = math.min(1.0, (radius - 0.12) * 5);
      final alpha = edgeFade * coreFade * (0.35 + 0.55 * hash(i, 5));
      paint.color = Color.lerp(hot, f.accent, (radius / 1.2).clamp(0.0, 1.0))!
          .withValues(alpha: alpha.clamp(0.0, 1.0));
      canvas.drawCircle(p.offset, (0.6 + hash(i, 6) * 1.6) * p.scale, paint);
    }

    _core(canvas, c, unit, f);
    _levelRing(canvas, cam, f, tilt, roll, front: true);
  }

  void _core(Canvas canvas, Offset c, double unit, ArtFrame f) {
    final pulse = 0.5 + 0.5 * math.sin(f.time * (2 + f.intensity * 4));
    final r = unit * (0.2 + 0.08 * f.intensity + 0.02 * pulse);
    canvas.drawCircle(
      c,
      r * 2.4,
      Paint()
        ..shader = RadialGradient(colors: [
          f.accent.withValues(alpha: 0.35 + 0.3 * f.intensity),
          f.accent.withValues(alpha: 0),
        ]).createShader(Rect.fromCircle(center: c, radius: r * 2.4)),
    );
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.25, -0.3),
          colors: [Colors.white, lighten(f.accent, 0.4), darken(f.accent, 0.3)],
          stops: const [0, 0.45, 1],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  /// A ring around the disc; the bright arc shows the battery level.
  void _levelRing(
    Canvas canvas,
    Camera cam,
    ArtFrame f,
    double tilt,
    double roll, {
    required bool front,
  }) {
    const n = 160;
    const radius = 1.95;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    Projected at(int i) {
      // Start at the point nearest the viewer and run clockwise.
      final a = -math.pi / 2 + 2 * math.pi * i / n;
      return cam.project(
        Vec3(math.cos(a) * radius, 0, math.sin(a) * radius).rotateX(tilt).rotateZ(roll),
      );
    }

    var prev = at(0);
    for (var i = 1; i <= n; i++) {
      final cur = at(i);
      if (cur.isFront == front) {
        final filled = i / n <= f.level;
        final shimmer = 0.5 + 0.5 * math.sin(i * 0.3 - f.phase * 3);
        paint
          ..strokeWidth = (filled ? 3.2 : 1.4) * cur.scale
          ..color = filled
              ? lighten(f.accent, 0.2 + 0.3 * shimmer)
                  .withValues(alpha: front ? 0.95 : 0.45)
              : Colors.white.withValues(alpha: front ? 0.12 : 0.05);
        canvas.drawLine(prev.offset, cur.offset, paint);
      }
      prev = cur;
    }
  }

  @override
  bool shouldRepaint(ParticleGalaxyPainter oldDelegate) => oldDelegate.frame != frame;
}
