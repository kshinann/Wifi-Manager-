import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../models/battery_reading.dart';
import '../services/charge_analyzer.dart';
import 'formatting.dart';

/// Frosted panel with the charge-type badge and the live numbers.
class StatsPanel extends StatelessWidget {
  const StatsPanel({super.key, required this.snapshot});

  final ChargeSnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final s = snapshot;
    final ios = s?.reading.source == BatterySource.ios;
    const unavailable = 'Not reported by iOS';

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _ChargeTypeBadge(snapshot: s),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _StatTile(
                      icon: Icons.electric_meter_rounded,
                      label: 'Current',
                      value: _current(s),
                      detail: ios
                          ? unavailable
                          : (s?.currentMa ?? 0) >= 0
                              ? 'into battery'
                              : 'drawn from battery',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _StatTile(
                      icon: Icons.speed_rounded,
                      label: 'Voltage',
                      value: s?.voltage == null ? '—' : '${s!.voltage!.toStringAsFixed(2)} V',
                      detail: ios ? unavailable : 'battery terminal',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _StatTile(
                icon: Icons.timer_outlined,
                label: 'Time to full',
                value: s?.timeToFull == null ? '—' : formatDuration(s!.timeToFull!),
                detail: _ttfDetail(s),
                wide: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _current(ChargeSnapshot? s) {
    final ma = s?.currentMa;
    if (ma == null) return '—';
    return '${formatThousands(ma.abs().round())} mA';
  }

  static String _ttfDetail(ChargeSnapshot? s) {
    if (s == null) return 'waiting for battery data';
    if (s.reading.status == ChargeStatus.full) return 'battery is full';
    if (!s.reading.isCharging) return 'plug in to charge';
    return switch (s.timeToFullSource) {
      EstimateSource.system => 'system estimate',
      EstimateSource.current => 'estimated from current',
      EstimateSource.levelRate => 'estimated from charge rate',
      EstimateSource.none => 'measuring — needs about 2 min',
    };
  }
}

class _ChargeTypeBadge extends StatelessWidget {
  const _ChargeTypeBadge({required this.snapshot});

  final ChargeSnapshot? snapshot;

  @override
  Widget build(BuildContext context) {
    final s = snapshot;
    final cls = s?.chargeClass ?? ChargeClass.measuring;
    final details = <String>[
      if (s?.watts != null) '${s!.watts!.toStringAsFixed(1)} W',
      if (s?.watts == null && s?.percentPerMinute != null)
        '${s!.percentPerMinute!.toStringAsFixed(2)} %/min',
      if (s?.temperatureC != null) '${s!.temperatureC!.toStringAsFixed(1)} °C',
    ];

    return AnimatedContainer(
      duration: const Duration(milliseconds: 500),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(colors: [
          cls.color.withValues(alpha: 0.28),
          cls.color.withValues(alpha: 0.08),
        ]),
        border: Border.all(color: cls.color.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Icon(cls.icon, color: cls.color, size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cls.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (details.isNotEmpty)
                  Text(
                    details.join('  ·  '),
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
                  ),
              ],
            ),
          ),
          if (s?.temperatureC != null && s!.temperatureC! >= 42)
            const Tooltip(
              message: 'Battery is hot',
              child: Icon(Icons.local_fire_department_rounded, color: Color(0xFFFF6B4A)),
            ),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.detail,
    this.wide = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final String detail;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final valueText = Text(
      value,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 22,
        fontWeight: FontWeight.w600,
        fontFeatures: [FontFeature.tabularFigures()],
      ),
    );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: Colors.white54),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          if (wide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                valueText,
                const SizedBox(width: 10),
                Flexible(child: _detail()),
              ],
            )
          else ...[
            valueText,
            _detail(),
          ],
        ],
      ),
    );
  }

  Widget _detail() => Text(
        detail,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: Colors.white38, fontSize: 11),
      );
}
