import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Synthwave skyline at dusk. More windows light up as the battery fills; the
/// neon grid road scrolls and the flying lights zip past faster with charging
/// power.
class NeonCityPainter extends CustomPainter {
  NeonCityPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final horizon = h * 0.62;
    const pink = Color(0xFFFF3EA5);
    final neon = Color.lerp(const Color(0xFF34E7FF), f.accent, 0.4)!;

    paintVertical(canvas, Rect.fromLTWH(0, 0, w, horizon), const [
      Color(0xFF0A0322),
      Color(0xFF3A0B5C),
      Color(0xFFB0247A),
      Color(0xFFFF7A59),
    ], const [0, 0.45, 0.8, 1]);
    paintStars(canvas, Size(w, horizon), f.time, count: 60, maxY: 0.5, alpha: 0.7);

    // Striped retro sun.
    final sunC = Offset(w / 2, horizon - w * 0.12);
    final sunR = w * 0.26;
    final sunRect = Rect.fromCircle(center: sunC, radius: sunR);
    canvas.save();
    canvas.clipPath(Path()..addOval(sunRect));
    canvas.drawRect(
      sunRect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFE66D), Color(0xFFFF3E8A)],
        ).createShader(sunRect),
    );
    final gap = Paint()..color = const Color(0xFF7A1660);
    for (var i = 0; i < 7; i++) {
      final y = sunC.dy + sunR * (0.1 + i * 0.14) + frac(f.phase * 0.05) * sunR * 0.14;
      canvas.drawRect(Rect.fromLTWH(sunRect.left, y, sunR * 2, 2.0 + i * 1.3), gap);
    }
    canvas.restore();

    // Skyline: three depths of buildings with lit windows.
    final rand = math.Random(7);
    for (var layer = 0; layer < 3; layer++) {
      final shade = Color.lerp(const Color(0xFF2A0F45), const Color(0xFF07030F), layer / 2)!;
      var x = -10.0 + layer * 13;
      while (x < w) {
        final bw = w * (0.06 + rand.nextDouble() * 0.08);
        final bh = h * (0.12 + rand.nextDouble() * 0.22) * (1 - layer * 0.18);
        final rect = Rect.fromLTWH(x, horizon - bh, bw, bh);
        canvas.drawRect(rect, Paint()..color = shade);
        if (layer == 2) {
          canvas.drawLine(
            rect.topLeft,
            rect.topRight,
            Paint()
              ..color = neon.withValues(alpha: 0.7)
              ..strokeWidth = 1.5,
          );
        }
        // Windows switch on as the battery fills. The farthest layer is too
        // small to show them, which also keeps the frame cheap.
        final win = Paint();
        final cols = layer == 0 ? 0 : (bw / 8).floor();
        final rows = (bh / 11).floor();
        for (var cx = 0; cx < cols; cx++) {
          for (var ry = 1; ry < rows; ry++) {
            final id = (x * 13 + cx * 8 + ry * 31 + layer * 101).round();
            if (hash(id, 120) > f.level) continue;
            final flicker = hash(id, 121) > 0.97 ? 0.5 + 0.5 * math.sin(f.time * 9 + id) : 1.0;
            win.color = (hash(id, 122) > 0.5 ? const Color(0xFFFFD27A) : neon)
                .withValues(alpha: (0.35 + 0.4 * (1 - layer / 2)) * flicker);
            canvas.drawRect(Rect.fromLTWH(x + 3 + cx * 8, horizon - bh + ry * 11, 3, 5), win);
          }
        }
        x += bw + 2 + rand.nextDouble() * 6;
      }
    }

    // Perspective grid road.
    paintVertical(canvas, Rect.fromLTRB(0, horizon, w, h), const [
      Color(0xFF14031F),
      Color(0xFF05010A),
    ]);
    final cam = Camera(center: Offset(w / 2, horizon), unit: 1, distance: w * 0.5);
    final floor = h - horizon;
    final grid = Paint()
      ..strokeWidth = 1.2
      ..blendMode = BlendMode.plus;
    const far = 16;
    final scroll = frac(f.phase * 0.5);
    for (var k = 0; k < far; k++) {
      final z = (k + 1 - scroll) * w * 0.12;
      final a = cam.project(Vec3(-w * 3, floor * 0.9, z));
      final b = cam.project(Vec3(w * 3, floor * 0.9, z));
      grid.color = pink.withValues(alpha: 0.7 * (1 - k / far));
      canvas.drawLine(a.offset, b.offset, grid);
    }
    for (var i = -12; i <= 12; i++) {
      final a = cam.project(Vec3(i * w * 0.12, floor * 0.9, 0.0));
      final b = cam.project(Vec3(i * w * 0.12, floor * 0.9, far * w * 0.12));
      grid.color = pink.withValues(alpha: 0.5);
      canvas.drawLine(a.offset, b.offset, grid);
    }
    paintGlow(canvas, Offset(w / 2, horizon), w * 0.7, pink, 0.25);

    // Flying light trails across the sky.
    final trail = Paint()
      ..strokeCap = StrokeCap.round
      ..blendMode = BlendMode.plus;
    final cars = 2 + (f.intensity * 8).round();
    for (var i = 0; i < cars; i++) {
      final p = frac(hash(i, 130) + f.phase * (0.08 + hash(i, 131) * 0.08));
      final y = horizon * (0.35 + hash(i, 132) * 0.45);
      final dir = hash(i, 133) > 0.5 ? 1 : -1;
      final x = dir > 0 ? -w * 0.2 + p * w * 1.4 : w * 1.2 - p * w * 1.4;
      final len = w * 0.08 * (0.5 + f.intensity);
      trail
        ..strokeWidth = 2
        ..shader = LinearGradient(colors: [
          (i.isEven ? neon : pink).withValues(alpha: 0),
          (i.isEven ? neon : pink).withValues(alpha: 0.9),
        ]).createShader(Rect.fromLTRB(x - len * dir, y - 1, x, y + 1));
      canvas.drawLine(Offset(x - len * dir, y), Offset(x, y), trail);
    }
  }

  @override
  bool shouldRepaint(NeonCityPainter oldDelegate) => oldDelegate.frame != frame;
}
