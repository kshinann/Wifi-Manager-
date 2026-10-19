import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../art_frame.dart';

/// Flames rising from the bottom of the screen.
///
/// - Slow: a low flame with a few drifting embers.
/// - Normal: a steady campfire.
/// - Fast: a roaring blaze with showers of sparks.
/// - Super-fast: a blue-white inferno.
/// Plugging in throws a ring of fire outwards. An ember glow behind the
/// flames rises to the battery level.
class FirePainter extends CustomPainter {
  FirePainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  static const _hot = Color(0xFFFFF4C2);
  static const _blue = Color(0xFFBFE4FF);
  static const _ramp = [
    Color(0xFFFFE07A), // yellow
    Color(0xFFFF8A1F), // orange
    Color(0xFFE5321B), // red
    Color(0xFF5A0E08), // smoky red
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;
    final power = math.max(f.power, f.burst * 4);
    final blueHeat = ((power - 3.3) / 0.7).clamp(0.0, 1.0);

    paintVertical(canvas, Offset.zero & size, const [
      Color(0xFF050203),
      Color(0xFF140504),
      Color(0xFF2A0A05),
    ]);

    // Ember glow up to the battery level.
    final levelY = h * (1 - f.level.clamp(0.0, 1.0));
    paintVertical(canvas, Rect.fromLTRB(0, levelY, w, h), [
      const Color(0xFF8A1E0A).withValues(alpha: 0),
      const Color(0xFF8A1E0A).withValues(alpha: 0.35),
    ]);

    final flameH = h * (0.12 + 0.13 * power);
    paintGlow(canvas, Offset(w / 2, h), w * (0.55 + 0.12 * power), const Color(0xFFFF6A1A), 0.25 + 0.1 * power);
    if (!f.charging && f.burst == 0 && power < 0.3) {
      _embers(canvas, size, 6, 0.4, f);
      return;
    }

    // Flame particles: born along the bottom, rising and cooling from
    // white-yellow to red smoke. Additive blending makes overlaps glow.
    final n = (70 + power * 45).round();
    final paint = Paint()..blendMode = BlendMode.plus;
    for (var i = 0; i < n; i++) {
      final speed = 0.35 + hash(i, 1) * 0.35;
      final p = frac(hash(i, 2) + f.phase * speed);
      // Flames gather into tongues around a few base columns.
      final column = (i % 5 + 0.5) / 5;
      final x0 = w * (column + (hash(i, 3) - 0.5) * 0.22);
      final x = x0 + math.sin(p * 7 + i + f.time * 2) * w * 0.025 * (1 + 2 * p) + (w / 2 - x0) * p * 0.35;
      final y = h + 10 - p * flameH * (0.6 + 0.7 * hash(i, 4));
      final r = w * (0.05 + 0.05 * hash(i, 5)) * math.pow(1 - p, 0.6).toDouble() * (0.7 + 0.12 * power);
      var color = _rampAt(p);
      if (p < 0.35) color = Color.lerp(color, Color.lerp(_hot, _blue, blueHeat)!, (0.35 - p) / 0.35)!;
      paint.color = color.withValues(alpha: (1 - p) * 0.33);
      canvas.drawCircle(Offset(x, y), r, paint);
    }

    _embers(canvas, size, (12 + power * 28).round(), 0.5 + 0.3 * power, f);

    // Plug-in ring of fire.
    if (f.burst > 0) {
      final c = Offset(w / 2, h * 0.75);
      final r = (1 - f.burst) * w * 0.9;
      for (var i = 0; i < 48; i++) {
        final a = 2 * math.pi * i / 48;
        final pos = c + Offset(math.cos(a), math.sin(a) * 0.5) * r;
        paint.color = _rampAt(1 - f.burst).withValues(alpha: 0.7 * f.burst);
        canvas.drawCircle(pos, w * 0.04 * (0.5 + f.burst), paint);
      }
      canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFFFF8A1F).withValues(alpha: 0.2 * f.burst * f.burst));
    }
  }

  void _embers(Canvas canvas, Size size, int n, double speed, ArtFrame f) {
    final w = size.width, h = size.height;
    final spark = Paint()
      ..blendMode = BlendMode.plus
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2;
    for (var i = 0; i < n; i++) {
      final p = frac(hash(i, 40) + f.phase * speed * (0.2 + hash(i, 41) * 0.3));
      final x = w * hash(i, 42) + math.sin(p * 9 + i) * w * 0.05;
      final y = h - p * h * (0.5 + 0.45 * hash(i, 43));
      final alpha = math.sin(p * math.pi) * (0.6 + 0.4 * hash(i, 44));
      spark.color = Color.lerp(const Color(0xFFFFE07A), const Color(0xFFFF4A1A), p)!.withValues(alpha: alpha);
      canvas.drawLine(Offset(x, y), Offset(x - math.cos(p * 9 + i) * 3, y + 7), spark);
    }
  }

  static Color _rampAt(double p) {
    final t = p.clamp(0.0, 0.999) * (_ramp.length - 1);
    final i = t.floor();
    return Color.lerp(_ramp[i], _ramp[i + 1], t - i)!;
  }

  @override
  bool shouldRepaint(FirePainter oldDelegate) => oldDelegate.frame != frame;
}
