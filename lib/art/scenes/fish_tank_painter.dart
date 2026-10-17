import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// A glass aquarium in 3D. The water level is the battery level; fish swim
/// faster, and more of them come out, the more power flows in.
class FishTankPainter extends CustomPainter {
  FishTankPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _fishColors = [
    Color(0xFFFF8A3D),
    Color(0xFF4FC3FF),
    Color(0xFFFFD84D),
    Color(0xFFFF5C8A),
    Color(0xFF7CFFB2),
    Color(0xFFB58CFF),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    paintVertical(canvas, Offset.zero & size, const [Color(0xFF0B0E16), Color(0xFF1A1410)]);

    // Tank front face plus a receding top face for depth.
    final tw = math.min(w * 0.86, h * 0.62);
    final th = tw * 0.78;
    final front = Rect.fromCenter(center: Offset(w / 2, h * 0.5), width: tw, height: th);
    final depth = Offset(tw * 0.08, -tw * 0.08);

    // Back wall and table.
    canvas.drawRect(
      front.shift(depth),
      Paint()..color = const Color(0xFF0E2233),
    );
    paintVertical(canvas, Rect.fromLTRB(0, front.bottom, w, h), const [
      Color(0xFF3A2A1E),
      Color(0xFF16100B),
    ]);

    canvas.save();
    canvas.clipRect(front);

    // Water up to the battery level.
    final level = f.level.clamp(0.04, 0.96);
    final surface = front.bottom - th * level;
    final water = Path()..moveTo(front.left, front.bottom);
    for (var x = front.left; x <= front.right + 6; x += 6) {
      water.lineTo(x, surface + math.sin(x * 0.04 + f.phase * 2) * (2 + 3 * f.intensity));
    }
    water
      ..lineTo(front.right, front.bottom)
      ..close();
    canvas.drawPath(
      water,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color.lerp(const Color(0xFF2EC4D6), f.accent, 0.25)!.withValues(alpha: 0.85),
            const Color(0xFF0B3B5A).withValues(alpha: 0.95),
          ],
        ).createShader(Rect.fromLTRB(front.left, surface, front.right, front.bottom)),
    );

    // Light rays from the surface.
    final ray = Paint()..blendMode = BlendMode.plus;
    for (var i = 0; i < 5; i++) {
      final x = front.left + tw * (0.15 + i * 0.18) + math.sin(f.time * 0.4 + i) * tw * 0.04;
      ray.shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.white.withValues(alpha: 0.12), Colors.white.withValues(alpha: 0)],
      ).createShader(Rect.fromLTRB(x, surface, x + tw * 0.1, front.bottom));
      canvas.drawPath(
        Path()
          ..moveTo(x, surface)
          ..lineTo(x + tw * 0.05, surface)
          ..lineTo(x + tw * 0.12, front.bottom)
          ..lineTo(x + tw * 0.02, front.bottom)
          ..close(),
        ray,
      );
    }

    // Gravel.
    final gravel = Paint();
    for (var i = 0; i < 140; i++) {
      gravel.color = Color.lerp(const Color(0xFF8A7458), const Color(0xFF3F3428), hash(i, 5))!;
      canvas.drawCircle(
        Offset(front.left + hash(i, 6) * tw, front.bottom - hash(i, 7) * th * 0.07),
        2 + hash(i, 8) * 3,
        gravel,
      );
    }

    // Swaying plants.
    final plant = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 9; i++) {
      final x = front.left + tw * (0.05 + hash(i, 9) * 0.9);
      final tall = th * (0.25 + hash(i, 10) * 0.4);
      final sway = math.sin(f.time * 1.2 + i) * tall * 0.12;
      plant
        ..strokeWidth = 3 + hash(i, 11) * 4
        ..color = Color.lerp(const Color(0xFF1F8F4E), const Color(0xFF5BD17A), hash(i, 12))!;
      canvas.drawPath(
        Path()
          ..moveTo(x, front.bottom)
          ..quadraticBezierTo(x - sway, front.bottom - tall * 0.5, x + sway, front.bottom - tall),
        plant,
      );
    }

    // Fish: each swims across at its own depth, flipping at the walls.
    final fishCount = 3 + (f.intensity * 7).round();
    for (var i = 0; i < fishCount; i++) {
      final z = hash(i, 13); // 0 = back, 1 = front
      final scale = 0.55 + z * 0.6;
      final speed = 0.05 + hash(i, 14) * 0.06;
      final p = frac(hash(i, 15) + f.phase * speed);
      final goingRight = p < 0.5;
      final u = goingRight ? p * 2 : 2 - p * 2;
      final x = front.left + tw * (0.1 + 0.8 * u);
      final minY = surface + th * 0.06;
      final maxY = front.bottom - th * 0.14;
      if (maxY <= minY) continue;
      final y = minY + (maxY - minY) * hash(i, 16) + math.sin(f.time * 1.5 + i) * th * 0.02;
      _fish(
        canvas,
        Offset(x, y),
        tw * 0.06 * scale,
        _fishColors[i % _fishColors.length],
        goingRight,
        f.time * (6 + f.intensity * 10) + i,
        0.55 + 0.45 * z,
      );
    }

    // Bubbles from the air stone.
    final bubble = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final bubbles = (6 + f.intensity * 24).round();
    for (var i = 0; i < bubbles; i++) {
      final p = frac(hash(i, 17) + f.phase * (0.2 + hash(i, 18) * 0.2));
      final y = front.bottom - (front.bottom - surface) * p;
      final x = front.left + tw * 0.82 + math.sin(p * 12 + i) * 6;
      bubble.color = Colors.white.withValues(alpha: 0.55 * (1 - p * 0.5));
      canvas.drawCircle(Offset(x, y), 1.5 + hash(i, 19) * 3.5, bubble);
    }
    canvas.restore();

    // Glass edges and reflections.
    final edge = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = Colors.white.withValues(alpha: 0.35);
    canvas.drawRect(front, edge);
    final top = Path()
      ..moveTo(front.left, front.top)
      ..lineTo(front.left + depth.dx, front.top + depth.dy)
      ..lineTo(front.right + depth.dx, front.top + depth.dy)
      ..lineTo(front.right, front.top);
    canvas.drawPath(top, edge..color = Colors.white.withValues(alpha: 0.2));
    canvas.drawLine(
      front.topRight,
      Offset(front.right + depth.dx, front.top + depth.dy),
      edge,
    );
    canvas.drawLine(
      front.bottomRight,
      Offset(front.right + depth.dx, front.bottom + depth.dy),
      edge,
    );
    canvas.drawRect(
      Rect.fromLTWH(front.left + tw * 0.05, front.top + th * 0.05, tw * 0.04, th * 0.9),
      Paint()..color = Colors.white.withValues(alpha: 0.06),
    );
    // Lid light.
    canvas.drawRect(
      Rect.fromLTWH(front.left - 4, front.top - 10, tw + 8, 10),
      Paint()..color = const Color(0xFF262A33),
    );
  }

  void _fish(
    Canvas canvas,
    Offset c,
    double len,
    Color color,
    bool right,
    double wag,
    double alpha,
  ) {
    canvas.save();
    canvas.translate(c.dx, c.dy);
    if (!right) canvas.scale(-1, 1);
    final body = Rect.fromCenter(center: Offset.zero, width: len * 2, height: len * 1.1);
    final tailSwing = math.sin(wag) * len * 0.25;
    final tail = Path()
      ..moveTo(-len * 0.85, 0)
      ..lineTo(-len * 1.5, -len * 0.5 + tailSwing)
      ..lineTo(-len * 1.5, len * 0.5 + tailSwing)
      ..close();
    final paint = Paint()..color = color.withValues(alpha: alpha);
    canvas.drawPath(tail, paint);
    canvas.drawOval(
      body,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [lighten(color, 0.35), color, darken(color, 0.4)],
        ).createShader(body)
        ..color = Colors.white.withValues(alpha: alpha),
    );
    canvas.drawCircle(Offset(len * 0.55, -len * 0.12), len * 0.12, Paint()..color = Colors.white);
    canvas.drawCircle(Offset(len * 0.6, -len * 0.12), len * 0.06, Paint()..color = Colors.black);
    canvas.restore();
  }

  @override
  bool shouldRepaint(FishTankPainter oldDelegate) => oldDelegate.frame != frame;
}
