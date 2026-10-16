import 'dart:math' as math;
import 'dart:ui';

/// The per-frame state every artwork painter draws from.
class ArtFrame {
  const ArtFrame({
    required this.time,
    required this.phase,
    required this.level,
    required this.intensity,
    required this.charging,
    required this.accent,
  });

  /// Wall-clock seconds since the screen opened.
  final double time;

  /// Accumulated animation phase; advances faster the more power flows in,
  /// so speed changes never make the animation jump.
  final double phase;

  /// Battery level, 0–1.
  final double level;

  /// Charge intensity, 0–1.
  final double intensity;
  final bool charging;
  final Color accent;

  static const initial = ArtFrame(
    time: 0,
    phase: 0,
    level: 0,
    intensity: 0,
    charging: false,
    accent: Color(0xFF34E7FF),
  );
}

class Vec3 {
  const Vec3(this.x, this.y, this.z);

  final double x, y, z;

  Vec3 rotateX(double a) {
    final c = math.cos(a), s = math.sin(a);
    return Vec3(x, y * c - z * s, y * s + z * c);
  }

  Vec3 rotateY(double a) {
    final c = math.cos(a), s = math.sin(a);
    return Vec3(x * c + z * s, y, -x * s + z * c);
  }

  Vec3 rotateZ(double a) {
    final c = math.cos(a), s = math.sin(a);
    return Vec3(x * c - y * s, x * s + y * c, z);
  }
}

class Projected {
  const Projected(this.offset, this.scale, this.depth);

  final Offset offset;
  final double scale;

  /// Positive is further from the viewer.
  final double depth;

  bool get isFront => depth < 0;
}

/// Simple perspective camera looking down +z at [center].
class Camera {
  const Camera({required this.center, required this.unit, this.distance = 4});

  final Offset center;

  /// Pixels per world unit.
  final double unit;
  final double distance;

  Projected project(Vec3 v) {
    final s = distance / math.max(0.05, distance + v.z);
    return Projected(
      Offset(center.dx + v.x * s * unit, center.dy + v.y * s * unit),
      s,
      v.z,
    );
  }
}

/// Deterministic 0–1 noise so particles keep their identity between frames.
double hash(int i, [int salt = 0]) {
  final v = math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - v.floorToDouble();
}

double frac(double v) => v - v.floorToDouble();

Color darken(Color c, double t) => Color.lerp(c, const Color(0xFF000000), t)!;

Color lighten(Color c, double t) => Color.lerp(c, const Color(0xFFFFFFFF), t)!;

/// Dark space backdrop with a soft accent glow that brightens with power.
void paintBackdrop(Canvas canvas, Size size, ArtFrame f, Offset glowCenter) {
  final rect = Offset.zero & size;
  canvas.drawRect(
    rect,
    Paint()
      ..shader = Gradient.linear(
        rect.topCenter,
        rect.bottomCenter,
        const [Color(0xFF070A14), Color(0xFF020307)],
      ),
  );
  final glowR = size.shortestSide * (0.6 + 0.2 * f.intensity);
  canvas.drawCircle(
    glowCenter,
    glowR,
    Paint()
      ..shader = Gradient.radial(glowCenter, glowR, [
        f.accent.withValues(alpha: 0.10 + 0.14 * f.intensity),
        f.accent.withValues(alpha: 0),
      ]),
  );
  // Faint twinkling stars.
  final star = Paint();
  for (var i = 0; i < 70; i++) {
    final p = Offset(hash(i, 11) * size.width, hash(i, 12) * size.height);
    final tw = 0.5 + 0.5 * math.sin(f.time * (0.6 + hash(i, 13) * 1.5) + i);
    star.color = const Color(0xFFFFFFFF).withValues(alpha: 0.05 + 0.25 * tw * hash(i, 14));
    canvas.drawCircle(p, 0.6 + hash(i, 15) * 0.9, star);
  }
}
