import 'package:flutter/material.dart';

import '../services/charge_analyzer.dart';

extension ChargeClassStyle on ChargeClass {
  String get label => switch (this) {
        ChargeClass.notCharging => 'Not charging',
        ChargeClass.full => 'Fully charged',
        ChargeClass.measuring => 'Measuring speed…',
        ChargeClass.slow => 'Slow charging',
        ChargeClass.normal => 'Charging',
        ChargeClass.fast => 'Fast charging',
        ChargeClass.superFast => 'Super-fast charging',
      };

  Color get color => switch (this) {
        ChargeClass.notCharging => const Color(0xFF7D8BA6),
        ChargeClass.full => const Color(0xFF4CFFB0),
        ChargeClass.measuring => const Color(0xFF34E7FF),
        ChargeClass.slow => const Color(0xFFFFB547),
        ChargeClass.normal => const Color(0xFF34E7FF),
        ChargeClass.fast => const Color(0xFF3DFF8A),
        ChargeClass.superFast => const Color(0xFFD45CFF),
      };

  IconData get icon => switch (this) {
        ChargeClass.notCharging => Icons.power_off_rounded,
        ChargeClass.full => Icons.battery_full_rounded,
        ChargeClass.measuring => Icons.hourglass_top_rounded,
        ChargeClass.slow => Icons.bolt_outlined,
        ChargeClass.normal => Icons.bolt_rounded,
        ChargeClass.fast => Icons.flash_on_rounded,
        ChargeClass.superFast => Icons.electric_bolt_rounded,
      };
}

String formatDuration(Duration d) {
  if (d == Duration.zero) return 'Full';
  final h = d.inHours;
  final m = d.inMinutes.remainder(60);
  if (h == 0) return '${d.inMinutes < 1 ? '<1' : m} min';
  return '${h}h ${m.toString().padLeft(2, '0')}m';
}

String formatThousands(int v) {
  final s = v.abs().toString();
  final out = StringBuffer(v < 0 ? '-' : '');
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) out.write(',');
    out.write(s[i]);
  }
  return out.toString();
}
