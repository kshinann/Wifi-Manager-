import 'package:flutter/material.dart';

import 'art_frame.dart';
import 'battery_core_painter.dart';
import 'liquid_orb_painter.dart';
import 'particle_galaxy_painter.dart';
import 'power/aura_painter.dart';
import 'power/fire_painter.dart';
import 'power/lightning_painter.dart';
import 'power/water_vortex_painter.dart';
import 'scenes/aurora_painter.dart';
import 'scenes/fish_tank_painter.dart';
import 'scenes/forest_painter.dart';
import 'scenes/lava_lamp_painter.dart';
import 'scenes/neon_city_painter.dart';
import 'scenes/ocean_painter.dart';
import 'scenes/planet_painter.dart';
import 'scenes/rainy_window_painter.dart';
import 'scenes/snow_globe_painter.dart';
import 'scenes/volcano_painter.dart';

enum ArtStyle {
  lightning('Lightning', Icons.flash_on, Color(0xFF7FA8FF)),
  inferno('Inferno', Icons.local_fire_department, Color(0xFFFF6A1A)),
  vortex('Vortex', Icons.cyclone, Color(0xFF3FD0E8)),
  aura('Power Aura', Icons.flare, Color(0xFFFFD34D)),
  liquidOrb('Liquid Orb', Icons.bubble_chart, Color(0xFF34E7FF)),
  batteryCore('Battery Core', Icons.battery_charging_full, Color(0xFF3DFF8A)),
  particleGalaxy('Galaxy', Icons.blur_on, Color(0xFFD45CFF)),
  ocean('Ocean', Icons.waves, Color(0xFF1C9CD8)),
  fishTank('Fish Tank', Icons.set_meal, Color(0xFFFF8A3D)),
  forest('Forest', Icons.forest, Color(0xFF5BD17A)),
  aurora('Aurora', Icons.auto_awesome, Color(0xFF3DFFA0)),
  lavaLamp('Lava Lamp', Icons.lightbulb, Color(0xFFFF4D6D)),
  snowGlobe('Snow Globe', Icons.ac_unit, Color(0xFFBFD3E6)),
  planet('Planet', Icons.public, Color(0xFFE0B282)),
  neonCity('Neon City', Icons.location_city, Color(0xFFFF3EA5)),
  rainyWindow('Rainy Window', Icons.water_drop, Color(0xFF9FB4D9)),
  volcano('Volcano', Icons.volcano, Color(0xFFFF6A1A));

  const ArtStyle(this.label, this.icon, this.tint);

  final String label;
  final IconData icon;

  /// Colour for this theme's button in the picker.
  final Color tint;

  /// Power scenes: bold effects with a different look per charging speed,
  /// a plug-in burst and minimal on-screen info (tap for full stats).
  bool get isPower => index <= ArtStyle.aura.index;

  CustomPainter painter(ValueNotifier<ArtFrame> frame) => switch (this) {
        ArtStyle.lightning => LightningPainter(frame),
        ArtStyle.inferno => FirePainter(frame),
        ArtStyle.vortex => WaterVortexPainter(frame),
        ArtStyle.aura => AuraPainter(frame),
        ArtStyle.liquidOrb => LiquidOrbPainter(frame),
        ArtStyle.batteryCore => BatteryCorePainter(frame),
        ArtStyle.particleGalaxy => ParticleGalaxyPainter(frame),
        ArtStyle.ocean => OceanPainter(frame),
        ArtStyle.fishTank => FishTankPainter(frame),
        ArtStyle.forest => ForestPainter(frame),
        ArtStyle.aurora => AuroraPainter(frame),
        ArtStyle.lavaLamp => LavaLampPainter(frame),
        ArtStyle.snowGlobe => SnowGlobePainter(frame),
        ArtStyle.planet => PlanetPainter(frame),
        ArtStyle.neonCity => NeonCityPainter(frame),
        ArtStyle.rainyWindow => RainyWindowPainter(frame),
        ArtStyle.volcano => VolcanoPainter(frame),
      };

  ArtStyle get next => ArtStyle.values[(index + 1) % ArtStyle.values.length];

  ArtStyle get previous =>
      ArtStyle.values[(index - 1 + ArtStyle.values.length) % ArtStyle.values.length];

  static ArtStyle fromName(String? name) =>
      ArtStyle.values.firstWhere((s) => s.name == name, orElse: () => ArtStyle.lightning);
}
