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
    this.power = 0,
    this.burst = 0,
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

  /// Charging tier eased smoothly between whole steps: 0 not charging,
  /// 1 slow, 2 normal, 3 fast, 4 super-fast. Power scenes switch their look
  /// at each step and blend in between.
  final double power;

  /// 1 the moment the charger is plugged in, fading to 0 over ~2 s. Power
  /// scenes play their "ignite" effect while it is above 0.
  final double burst;

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

/// Fills [rect] with a top-to-bottom gradient.
void paintVertical(Canvas canvas, Rect rect, List<Color> colors, [List<double>? stops]) {
  canvas.drawRect(
    rect,
    Paint()
      ..shader = Gradient.linear(
        rect.topCenter,
        rect.bottomCenter,
        colors,
        // dart:ui requires explicit stops for more than two colours.
        stops ??
            (colors.length == 2
                ? null
                : [for (var i = 0; i < colors.length; i++) i / (colors.length - 1)]),
      ),
  );
}

/// Twinkling stars in the top [maxY] fraction of the screen.
void paintStars(
  Canvas canvas,
  Size size,
  double time, {
  int count = 90,
  double maxY = 1,
  double alpha = 1,
  int salt = 0,
}) {
  final star = Paint();
  for (var i = 0; i < count; i++) {
    final p = Offset(hash(i, 31 + salt) * size.width, hash(i, 32 + salt) * size.height * maxY);
    final tw = 0.5 + 0.5 * math.sin(time * (0.5 + hash(i, 33) * 2) + i);
    star.color = const Color(0xFFFFFFFF)
        .withValues(alpha: (alpha * (0.15 + 0.7 * tw * hash(i, 34))).clamp(0.0, 1.0));
    canvas.drawCircle(p, 0.5 + hash(i, 35) * 1.2, star);
  }
}

/// Soft radial glow.
void paintGlow(Canvas canvas, Offset c, double radius, Color color, double alpha) {
  canvas.drawCircle(
    c,
    radius,
    Paint()
      ..shader = Gradient.radial(c, radius, [
        color.withValues(alpha: alpha.clamp(0.0, 1.0)),
        color.withValues(alpha: 0),
      ]),
  );
}

/// A jagged lightning-style polyline from [a] to [b] by midpoint
/// displacement. The same [seed] always gives the same shape, so a bolt keeps
/// its shape for as long as it is visible.
List<Offset> jaggedLine(Offset a, Offset b, int seed, {int depth = 5, double rough = 0.28}) {
  var pts = [a, b];
  var r = rough;
  for (var d = 0; d < depth; d++) {
    final next = <Offset>[pts.first];
    for (var i = 0; i < pts.length - 1; i++) {
      final p = pts[i], q = pts[i + 1];
      final seg = q - p;
      final normal = Offset(-seg.dy, seg.dx);
      final shift = (hash(seed * 131 + d * 17 + i, 77) * 2 - 1) * r;
      next
        ..add(Offset.lerp(p, q, 0.5)! + normal * shift)
        ..add(q);
    }
    pts = next;
    r *= 0.55;
  }
  return pts;
}

/// Draws [points] as a glowing electric stroke: a wide blurred halo, a
/// coloured body and a thin white-hot core.
void paintBolt(Canvas canvas, List<Offset> points, Color color, double width, double alpha) {
  if (points.length < 2 || alpha <= 0) return;
  final path = Path()..moveTo(points.first.dx, points.first.dy);
  for (final p in points.skip(1)) {
    path.lineTo(p.dx, p.dy);
  }
  final paint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round
    ..blendMode = BlendMode.plus;
  final a = alpha.clamp(0.0, 1.0);
  canvas.drawPath(
    path,
    paint
      ..strokeWidth = width * 4
      ..color = color.withValues(alpha: 0.35 * a)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, width * 2.5),
  );
  canvas.drawPath(
    path,
    paint
      ..strokeWidth = width * 1.6
      ..color = color.withValues(alpha: 0.9 * a)
      ..maskFilter = null,
  );
  canvas.drawPath(
    path,
    paint
      ..strokeWidth = width * 0.6
      ..color = const Color(0xFFFFFFFF).withValues(alpha: a),
  );
}

/// Picks a colour along [stops] for a continuous [power] value 0–4.
Color tierColor(double power, List<Color> stops) {
  final t = power.clamp(0.0, stops.length - 1.0);
  final i = t.floor().clamp(0, stops.length - 2);
  return Color.lerp(stops[i], stops[i + 1], t - i)!;
}
