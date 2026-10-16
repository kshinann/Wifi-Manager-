import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'art_frame.dart';

/// A sci-fi glass battery cylinder over a scrolling neon floor grid, wrapped
/// in three gyroscope rings whose comets spin faster with charging power.
class BatteryCorePainter extends CustomPainter {
  BatteryCorePainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _rings = [
    (radius: 1.05, tiltX: 1.25, tiltZ: 0.35, speed: 1.0),
    (radius: 1.25, tiltX: 1.1, tiltZ: -0.5, speed: -0.7),
    (radius: 1.45, tiltX: 1.4, tiltZ: 0.05, speed: 0.5),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final c = size.center(Offset.zero);
    final w = math.min(size.width * 0.34, size.height * 0.24);
    final h = w * 1.55;
    final cam = Camera(center: c, unit: 1, distance: w * 6);

    paintBackdrop(canvas, size, f, c);
    _floor(canvas, size, c, w, h, f);
    for (final ring in _rings) {
      _ring(canvas, cam, w, ring, f, front: false);
    }
    _battery(canvas, c, w, h, f);
    for (final ring in _rings) {
      _ring(canvas, cam, w, ring, f, front: true);
    }
  }

  void _floor(Canvas canvas, Size size, Offset c, double w, double h, ArtFrame f) {
    final cam = Camera(center: c, unit: 1, distance: w * 3);
    final y = h / 2 + w * 0.55;
    final step = w * 0.55;
    final paint = Paint()
      ..strokeWidth = 1
      ..blendMode = BlendMode.plus;
    const far = 14.0;
    final scroll = frac(f.phase * 0.35);

    for (var k = 0; k < far; k++) {
      final z = (k - scroll) * step;
      if (z < -w) continue;
      final a = cam.project(Vec3(-w * 8, y, z));
      final b = cam.project(Vec3(w * 8, y, z));
      final fade = (1 - k / far) * (0.15 + 0.35 * f.intensity);
      paint.color = f.accent.withValues(alpha: fade.clamp(0.0, 1.0));
      canvas.drawLine(a.offset, b.offset, paint);
    }
    for (var i = -12; i <= 12; i++) {
      final x = i * step;
      final a = cam.project(Vec3(x, y, -w));
      final b = cam.project(Vec3(x, y, far * step));
      paint.shader = LinearGradient(
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
        colors: [
          f.accent.withValues(alpha: 0.35),
          f.accent.withValues(alpha: 0),
        ],
      ).createShader(Rect.fromPoints(a.offset, b.offset).inflate(1));
      canvas.drawLine(a.offset, b.offset, paint);
      paint.shader = null;
    }

    // Glow pool under the battery.
    final pool = Rect.fromCenter(
      center: cam.project(Vec3(0, y, 0)).offset,
      width: w * 2.4,
      height: w * 0.5,
    );
    canvas.drawOval(
      pool,
      Paint()
        ..shader = RadialGradient(colors: [
          f.accent.withValues(alpha: 0.25 + 0.4 * f.intensity),
          f.accent.withValues(alpha: 0),
        ]).createShader(pool),
    );
  }

  void _battery(Canvas canvas, Offset c, double w, double h, ArtFrame f) {
    final left = c.dx - w / 2;
    final top = c.dy - h / 2;
    final bottom = c.dy + h / 2;
    final eh = w * 0.24;

    Path cylinder(double l, double width, double t, double b) => Path()
      ..moveTo(l, t)
      ..lineTo(l, b)
      ..arcTo(Rect.fromLTWH(l, b - eh / 2, width, eh), math.pi, -math.pi, false)
      ..lineTo(l + width, t)
      ..arcTo(Rect.fromLTWH(l, t - eh / 2, width, eh), 0, math.pi, false)
      ..close();

    // Glass shell.
    final shell = cylinder(left, w, top, bottom);
    final shellRect = Rect.fromLTRB(left, top, left + w, bottom);
    canvas.drawPath(
      shell,
      Paint()
        ..shader = LinearGradient(colors: [
          Colors.white.withValues(alpha: 0.10),
          Colors.white.withValues(alpha: 0.02),
          Colors.white.withValues(alpha: 0.06),
        ]).createShader(shellRect),
    );

    // Energy fill.
    final pad = w * 0.08;
    final fl = left + pad;
    final fw = w - pad * 2;
    final fb = bottom - pad * 0.5;
    final level = f.level.clamp(0.02, 1.0);
    final ft = fb - (fb - top - pad) * level;
    final fill = cylinder(fl, fw, ft, fb);
    final fillRect = Rect.fromLTRB(fl, ft, fl + fw, fb);
    canvas.drawPath(
      fill,
      Paint()
        ..color = f.accent.withValues(alpha: 0.5 + 0.4 * f.intensity)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, w * 0.12),
    );
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(colors: [
          darken(f.accent, 0.6),
          lighten(f.accent, 0.25),
          f.accent,
          darken(f.accent, 0.7),
        ], stops: const [0, 0.35, 0.6, 1]).createShader(fillRect),
    );

    // Rising energy bands inside the fill.
    canvas.save();
    canvas.clipPath(fill);
    final band = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.025
      ..blendMode = BlendMode.plus;
    for (var i = 0; i < 5; i++) {
      final p = frac(i / 5 + f.phase * 0.3);
      final y = fb - p * (fb - ft);
      band.color = Colors.white.withValues(alpha: 0.35 * math.sin(p * math.pi) * (0.3 + f.intensity));
      canvas.drawArc(Rect.fromLTWH(fl, y - eh / 2, fw, eh), 0, math.pi, false, band);
    }
    canvas.restore();

    // Fill surface cap.
    canvas.drawOval(
      Rect.fromLTWH(fl, ft - eh / 2, fw, eh),
      Paint()..color = lighten(f.accent, 0.45).withValues(alpha: 0.9),
    );

    // Glass outline, top cap and terminal nub.
    final edge = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = lighten(f.accent, 0.3).withValues(alpha: 0.5);
    canvas.drawPath(shell, edge);
    canvas.drawOval(Rect.fromLTWH(left, top - eh / 2, w, eh), edge);

    final nw = w * 0.36;
    final nh = w * 0.13;
    final nub = cylinder(c.dx - nw / 2, nw, top - nh, top - eh * 0.1);
    canvas.drawPath(
      nub,
      Paint()
        ..shader = LinearGradient(colors: [
          const Color(0xFF3A4255),
          const Color(0xFFB8C2D8),
          const Color(0xFF2A3040),
        ]).createShader(Rect.fromLTWH(c.dx - nw / 2, top - nh, nw, nh)),
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset(c.dx, top - nh), width: nw, height: eh * 0.36),
      Paint()..color = const Color(0xFFD5DCEB),
    );

    // Vertical specular streak.
    final streak = Rect.fromLTWH(left + w * 0.16, top + eh * 0.2, w * 0.07, h - eh * 0.2);
    canvas.drawRRect(
      RRect.fromRectAndRadius(streak, Radius.circular(w * 0.04)),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: 0.35),
            Colors.white.withValues(alpha: 0.02),
          ],
        ).createShader(streak),
    );
  }

  void _ring(
    Canvas canvas,
    Camera cam,
    double w,
    ({double radius, double tiltX, double tiltZ, double speed}) ring,
    ArtFrame f, {
    required bool front,
  }) {
    const n = 90;
    final head = f.phase * ring.speed * 1.3;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..blendMode = BlendMode.plus;

    Projected at(int i) {
      final a = 2 * math.pi * i / n;
      return cam.project(
        Vec3(math.cos(a) * ring.radius * w, 0, math.sin(a) * ring.radius * w)
            .rotateX(ring.tiltX)
            .rotateZ(ring.tiltZ),
      );
    }

    var prev = at(0);
    for (var i = 1; i <= n; i++) {
      final cur = at(i);
      if (cur.isFront == front) {
        final a = 2 * math.pi * i / n;
        // Comet: brightest at the head, fading along its tail.
        final d = frac((head - a) / (2 * math.pi) * ring.speed.sign);
        final comet = math.pow(1 - d, 6).toDouble();
        final base = front ? 0.18 : 0.07;
        final alpha = (base + comet * (0.3 + 0.7 * f.intensity)).clamp(0.0, 1.0);
        paint
          ..strokeWidth = (1.2 + comet * 3.5) * cur.scale
          ..color = lighten(f.accent, 0.2 + comet * 0.4).withValues(alpha: alpha);
        canvas.drawLine(prev.offset, cur.offset, paint);
      }
      prev = cur;
    }
  }

  @override
  bool shouldRepaint(BatteryCorePainter oldDelegate) => oldDelegate.frame != frame;
}
