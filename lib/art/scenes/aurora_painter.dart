import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Northern lights over snowy mountains and a mirror lake. The curtains grow
/// taller as the battery fills and ripple faster with charging power.
class AuroraPainter extends CustomPainter {
  AuroraPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final lakeY = h * 0.72;

    paintVertical(canvas, Rect.fromLTWH(0, 0, w, lakeY), const [
      Color(0xFF02040C),
      Color(0xFF071530),
      Color(0xFF0E2840),
    ]);
    paintStars(canvas, Size(w, lakeY), f.time, count: 120);

    _aurora(canvas, size, f, lakeY);
    _mountains(canvas, w, lakeY);

    // Lake: mirrored sky, darker and rippled.
    canvas.save();
    canvas.clipRect(Rect.fromLTRB(0, lakeY, w, h));
    paintVertical(canvas, Rect.fromLTRB(0, lakeY, w, h), const [
      Color(0xFF071226),
      Color(0xFF02040A),
    ]);
    canvas.save();
    canvas.translate(0, lakeY * 2);
    canvas.scale(1, -1);
    canvas.saveLayer(Offset.zero & size, Paint()..color = Colors.white.withValues(alpha: 0.4));
    _aurora(canvas, size, f, lakeY);
    _mountains(canvas, w, lakeY);
    canvas.restore();
    canvas.restore();
    final ripple = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..strokeWidth = 1;
    for (var i = 0; i < 18; i++) {
      final y = lakeY + (h - lakeY) * (i / 18) + math.sin(f.time + i) * 2;
      final x = w * hash(i, 70);
      canvas.drawLine(Offset(x - w * 0.15, y), Offset(x + w * 0.15, y), ripple);
    }
    canvas.restore();
  }

  void _aurora(Canvas canvas, Size size, ArtFrame f, double floor) {
    final w = size.width;
    final reach = floor * (0.25 + 0.55 * f.level);
    final paint = Paint()..blendMode = BlendMode.plus;
    final bands = [
      (base: floor * 0.42, color: const Color(0xFF3DFFA0), speed: 0.6, salt: 0.0),
      (base: floor * 0.32, color: const Color(0xFF34E7FF), speed: -0.4, salt: 2.0),
      (base: floor * 0.5, color: Color.lerp(const Color(0xFFB45CFF), f.accent, 0.4)!, speed: 0.3, salt: 4.0),
    ];
    const step = 5.0;
    for (final b in bands) {
      for (var x = 0.0; x < w; x += step) {
        final u = x / w;
        final wave = math.sin(u * 6 + f.phase * b.speed + b.salt) * 0.5 +
            math.sin(u * 13 - f.phase * b.speed * 1.7 + b.salt) * 0.25;
        final bottom = b.base + wave * floor * 0.08;
        final height = reach * (0.5 + 0.5 * math.sin(u * 9 + f.phase * 0.5 + b.salt).abs());
        final shimmer = 0.6 + 0.4 * math.sin(u * 40 + f.time * 2 + b.salt);
        paint.shader = LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            b.color.withValues(alpha: 0.35 * shimmer * (0.5 + 0.5 * f.intensity + 0.3)),
            b.color.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromLTRB(x, bottom - height, x + step, bottom));
        canvas.drawRect(Rect.fromLTRB(x, bottom - height, x + step + 0.5, bottom), paint);
      }
    }
  }

  void _mountains(Canvas canvas, double w, double floor) {
    final peaks = [0.0, 0.18, 0.32, 0.5, 0.63, 0.8, 1.0];
    final heights = [0.18, 0.34, 0.22, 0.4, 0.26, 0.31, 0.15];
    final path = Path()..moveTo(0, floor);
    final snow = Path();
    for (var i = 0; i < peaks.length; i++) {
      final x = peaks[i] * w;
      final y = floor - heights[i] * floor * 0.55;
      path.lineTo(x, y);
      if (i > 0 && i < peaks.length - 1) {
        final cap = heights[i] * floor * 0.08;
        snow
          ..moveTo(x, y)
          ..lineTo(x + cap * 0.9, y + cap)
          ..lineTo(x + cap * 0.3, y + cap * 0.8)
          ..lineTo(x - cap * 0.2, y + cap * 1.1)
          ..lineTo(x - cap * 0.9, y + cap)
          ..close();
      }
    }
    path
      ..lineTo(w, floor)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFF0A1322));
    canvas.drawPath(snow, Paint()..color = const Color(0xFFBFD3E6).withValues(alpha: 0.7));
  }

  @override
  bool shouldRepaint(AuroraPainter oldDelegate) => oldDelegate.frame != frame;
}
