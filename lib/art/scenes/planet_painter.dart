import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// A ringed gas giant turning in space with orbiting moons. Its day side
/// grows from a thin crescent to fully lit as the battery fills; it spins and
/// the moons orbit faster with charging power.
class PlanetPainter extends CustomPainter {
  PlanetPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _bands = [
    Color(0xFFE8C99A),
    Color(0xFFC98E5A),
    Color(0xFFF2DDB8),
    Color(0xFFA8683E),
    Color(0xFFE0B282),
    Color(0xFFB97B4B),
    Color(0xFFF5E4C8),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final c = Offset(w / 2, h * 0.47);
    final r = math.min(w, h) * 0.24;
    final cam = Camera(center: c, unit: r, distance: 6);

    paintVertical(canvas, Offset.zero & size, const [Color(0xFF02030A), Color(0xFF070B1C)]);
    paintStars(canvas, size, f.time, count: 160);
    paintGlow(canvas, c.translate(-w * 0.3, -h * 0.25), w * 0.6, const Color(0xFF5B3DB8), 0.18);

    _moons(canvas, cam, r, f, front: false);
    _rings(canvas, cam, f, front: false);

    // Planet body: latitude bands that wobble and drift as it turns.
    final body = Rect.fromCircle(center: c, radius: r);
    canvas.save();
    canvas.clipPath(Path()..addOval(body));
    const bandCount = 14;
    for (var i = 0; i < bandCount; i++) {
      final y0 = c.dy - r + 2 * r * i / bandCount;
      final y1 = y0 + 2 * r / bandCount + 1;
      final path = Path()..moveTo(c.dx - r, y0);
      for (var x = -r; x <= r + 4; x += 4) {
        path.lineTo(c.dx + x, y0 + math.sin(x / r * 4 + f.phase * 0.6 + i) * r * 0.025);
      }
      path
        ..lineTo(c.dx + r, y1)
        ..lineTo(c.dx - r, y1)
        ..close();
      canvas.drawPath(path, Paint()..color = _bands[i % _bands.length]);
    }
    // Storm spots sweep across as the planet rotates.
    for (var i = 0; i < 3; i++) {
      final lon = frac(hash(i, 100) + f.phase * 0.03) * 2 * math.pi;
      final x = math.sin(lon);
      if (math.cos(lon) < 0) continue; // on the far side
      final lat = (hash(i, 101) - 0.5) * 1.2;
      final spot = Offset(c.dx + x * r * math.cos(lat), c.dy + math.sin(lat) * r);
      final sw = r * 0.22 * math.cos(lon).abs();
      canvas.drawOval(
        Rect.fromCenter(center: spot, width: sw, height: r * 0.12),
        Paint()..color = const Color(0xFF9A4A2A).withValues(alpha: 0.85),
      );
    }
    // Day/night terminator: lit fraction is the battery level.
    final lit = f.level.clamp(0.04, 1.0);
    canvas.drawRect(
      body,
      Paint()
        ..shader = LinearGradient(
          colors: [
            Colors.black.withValues(alpha: 0),
            Colors.black.withValues(alpha: 0),
            Colors.black.withValues(alpha: 0.9),
          ],
          stops: [0, lit * 0.9, math.min(1.0, lit * 0.9 + 0.18)],
        ).createShader(body),
    );
    // Spherical shading and atmosphere.
    canvas.drawRect(
      body,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(-0.35, -0.35),
          colors: [Colors.white.withValues(alpha: 0.18), Colors.black.withValues(alpha: 0.45)],
        ).createShader(body),
    );
    canvas.restore();
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.05
        ..color = lighten(f.accent, 0.3).withValues(alpha: 0.25)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.04),
    );

    _rings(canvas, cam, f, front: true);
    _moons(canvas, cam, r, f, front: true);
  }

  void _rings(Canvas canvas, Camera cam, ArtFrame f, {required bool front}) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const n = 120;
    for (var ring = 0; ring < 5; ring++) {
      final radius = 1.35 + ring * 0.12;
      final color = Color.lerp(const Color(0xFFE7D2B0), const Color(0xFF9C8466), ring / 4)!;
      Projected at(int i) {
        final a = 2 * math.pi * i / n;
        return cam.project(
          Vec3(math.cos(a) * radius, 0, math.sin(a) * radius).rotateX(1.25).rotateZ(-0.35),
        );
      }

      var prev = at(0);
      for (var i = 1; i <= n; i++) {
        final cur = at(i);
        if (cur.isFront == front) {
          final sparkle = 0.6 + 0.4 * math.sin(i * 0.7 + f.phase * 2 + ring);
          paint
            ..strokeWidth = (3.2 - ring * 0.35) * cur.scale
            ..color = color.withValues(alpha: (front ? 0.85 : 0.55) * sparkle);
          canvas.drawLine(prev.offset, cur.offset, paint);
        }
        prev = cur;
      }
    }
  }

  void _moons(Canvas canvas, Camera cam, double r, ArtFrame f, {required bool front}) {
    const moons = [
      (dist: 2.3, size: 0.12, speed: 0.25, tilt: 1.1, color: Color(0xFFCFD6E6)),
      (dist: 2.9, size: 0.08, speed: -0.16, tilt: 1.35, color: Color(0xFFE6B98C)),
      (dist: 1.9, size: 0.06, speed: 0.4, tilt: 0.95, color: Color(0xFF9FB4D9)),
    ];
    for (final m in moons) {
      final a = f.phase * m.speed;
      final p = cam.project(
        Vec3(math.cos(a) * m.dist, 0, math.sin(a) * m.dist).rotateX(m.tilt).rotateZ(-0.35),
      );
      if (p.isFront != front) continue;
      final mr = r * m.size * p.scale;
      final rect = Rect.fromCircle(center: p.offset, radius: mr);
      canvas.drawCircle(
        p.offset,
        mr,
        Paint()
          ..shader = RadialGradient(
            center: const Alignment(-0.4, -0.4),
            colors: [lighten(m.color, 0.3), darken(m.color, 0.6)],
          ).createShader(rect),
      );
    }
  }

  @override
  bool shouldRepaint(PlanetPainter oldDelegate) => oldDelegate.frame != frame;
}
