import 'package:flutter/material.dart';

import 'art_frame.dart';
import 'battery_core_painter.dart';
import 'liquid_orb_painter.dart';
import 'particle_galaxy_painter.dart';

enum ArtStyle {
  liquidOrb('Liquid Orb', Icons.bubble_chart),
  batteryCore('Battery Core', Icons.battery_charging_full),
  particleGalaxy('Galaxy', Icons.blur_on);

  const ArtStyle(this.label, this.icon);

  final String label;
  final IconData icon;

  CustomPainter painter(ValueNotifier<ArtFrame> frame) => switch (this) {
        ArtStyle.liquidOrb => LiquidOrbPainter(frame),
        ArtStyle.batteryCore => BatteryCorePainter(frame),
        ArtStyle.particleGalaxy => ParticleGalaxyPainter(frame),
      };

  ArtStyle get next => ArtStyle.values[(index + 1) % ArtStyle.values.length];

  ArtStyle get previous =>
      ArtStyle.values[(index - 1 + ArtStyle.values.length) % ArtStyle.values.length];

  static ArtStyle fromName(String? name) =>
      ArtStyle.values.firstWhere((s) => s.name == name, orElse: () => ArtStyle.liquidOrb);
}
