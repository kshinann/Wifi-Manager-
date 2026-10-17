import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Looking through a rainy window at blurred city lights. Condensation clears
/// from the bottom up as the battery fills; heavier rain with faster sliding
/// drops means more power.
class RainyWindowPainter extends CustomPainter {
  RainyWindowPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _bokehColors = [
    Color(0xFFFFB347),
    Color(0xFFFF5E5B),
    Color(0xFF4FC3FF),
    Color(0xFFFFE08A),
    Color(0xFFB58CFF),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;

    paintVertical(canvas, Offset.zero & size, const [
      Color(0xFF0A0F1C),
      Color(0xFF151B2E),
      Color(0xFF221A24),
    ]);

    // Out-of-focus city lights.
    for (var i = 0; i < 38; i++) {
      final color = i % 6 == 0 ? f.accent : _bokehColors[i % _bokehColors.length];
      final c = Offset(
        w * hash(i, 140) + math.sin(f.time * 0.1 + i) * 6,
        h * (0.25 + hash(i, 141) * 0.7),
      );
      final r = w * (0.03 + hash(i, 142) * 0.07);
      final pulse = 0.7 + 0.3 * math.sin(f.time * (0.3 + hash(i, 143)) + i);
      paintGlow(canvas, c, r, color, 0.45 * pulse);
    }

    // Condensation fog above the clear line; the clear part grows with charge.
    final clearY = h * (1 - f.level);
    paintVertical(canvas, Rect.fromLTRB(0, 0, w, clearY + 60), [
      const Color(0xFFB8C4D9).withValues(alpha: 0.28),
      const Color(0xFFB8C4D9).withValues(alpha: 0.22),
      const Color(0xFFB8C4D9).withValues(alpha: 0),
    ], [0, clearY / (clearY + 60), 1]);

    // Small static beads, denser in the fog.
    final bead = Paint();
    for (var i = 0; i < 220; i++) {
      final p = Offset(w * hash(i, 150), h * hash(i, 151));
      final inFog = p.dy < clearY;
      final r = (0.8 + hash(i, 152) * 2.2) * (inFog ? 1.2 : 1);
      bead.color = Colors.white.withValues(alpha: inFog ? 0.35 : 0.2);
      canvas.drawCircle(p, r, bead);
      bead.color = Colors.white.withValues(alpha: 0.6);
      canvas.drawCircle(p.translate(-r * 0.3, -r * 0.3), r * 0.3, bead);
    }

    // Sliding drops leave a clear trail behind them.
    final drops = 4 + (f.intensity * 16).round();
    final trail = Paint()..strokeCap = StrokeCap.round;
    for (var i = 0; i < drops; i++) {
      final speed = 0.06 + hash(i, 160) * 0.08;
      final p = frac(hash(i, 161) + f.phase * speed);
      final baseX = w * hash(i, 162);
      final y = -20 + p * (h + 40);
      final x = baseX + math.sin(p * 9 + i) * 6;
      final r = 3.0 + hash(i, 163) * 4;
      final trailLen = h * 0.18 * (0.5 + f.intensity);
      trail
        ..strokeWidth = r * 0.9
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF0A0F1C).withValues(alpha: 0),
            const Color(0xFF0A0F1C).withValues(alpha: 0.35),
          ],
        ).createShader(Rect.fromLTRB(x - r, y - trailLen, x + r, y));
      canvas.drawLine(Offset(baseX + math.sin((p - 0.03) * 9 + i) * 6, y - trailLen), Offset(x, y), trail);

      final drop = Rect.fromCenter(center: Offset(x, y), width: r * 2, height: r * 2.4);
      canvas.drawOval(
        drop,
        Paint()
          ..shader = RadialGradient(
            center: const Alignment(0, 0.4),
            colors: [
              Colors.white.withValues(alpha: 0.15),
              const Color(0xFF9FB4D9).withValues(alpha: 0.45),
            ],
          ).createShader(drop),
      );
      canvas.drawCircle(
        Offset(x - r * 0.35, y - r * 0.5),
        r * 0.3,
        Paint()..color = Colors.white.withValues(alpha: 0.8),
      );
    }

    // Window frame.
    final frameP = Paint()..color = const Color(0xFF0B0D12);
    canvas.drawRect(Rect.fromLTWH(w * 0.5 - 4, 0, 8, h), frameP);
    canvas.drawRect(Rect.fromLTWH(0, h * 0.36 - 4, w, 8), frameP);
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 14
        ..color = const Color(0xFF0B0D12),
    );
  }

  @override
  bool shouldRepaint(RainyWindowPainter oldDelegate) => oldDelegate.frame != frame;
}
