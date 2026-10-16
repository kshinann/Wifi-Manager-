enum ChargeStatus { charging, full, discharging, notCharging, unknown }

enum PlugType { ac, usb, wireless, dock, none, unknown }

enum BatterySource { android, ios, demo }

/// One raw sample from the platform (or the demo simulator).
///
/// Fields a platform cannot report are null: iOS, for example, exposes only
/// the level and the charging state.
class BatteryReading {
  const BatteryReading({
    required this.time,
    required this.level,
    required this.status,
    required this.source,
    this.plug = PlugType.unknown,
    this.voltage,
    this.currentRaw,
    this.currentMa,
    this.temperatureC,
    this.chargeCounterMah,
    this.systemTimeToFull,
  });

  final DateTime time;

  /// Battery level, 0–100.
  final double level;
  final ChargeStatus status;
  final BatterySource source;
  final PlugType plug;

  /// Battery voltage in volts.
  final double? voltage;

  /// Battery current exactly as the OS reported it. Android documents this as
  /// microamps, but many devices report milliamps and some flip the sign, so
  /// [ChargeAnalyzer] normalizes it.
  final double? currentRaw;

  /// Current already in milliamps (used by the demo simulator).
  final double? currentMa;

  final double? temperatureC;

  /// Charge currently stored, in mAh, as reported by the fuel gauge.
  final double? chargeCounterMah;

  /// The OS's own time-to-full estimate (Android 9+), when it has one.
  final Duration? systemTimeToFull;

  bool get isCharging => status == ChargeStatus.charging;

  factory BatteryReading.fromPlatform(
    Map<Object?, Object?> map, {
    DateTime? time,
  }) {
    final mv = map['voltageMv'] as num?;
    final counter = map['chargeCounterUah'] as num?;
    final ttf = map['chargeTimeRemainingMs'] as num?;
    final raw = (map['currentNowRaw'] as num?) ?? (map['currentAvgRaw'] as num?);
    return BatteryReading(
      time: time ?? DateTime.now(),
      level: ((map['level'] as num?) ?? 0).toDouble().clamp(0.0, 100.0),
      status: _parseStatus(map['status']),
      source: map['platform'] == 'ios' ? BatterySource.ios : BatterySource.android,
      plug: _parsePlug(map['plugged']),
      voltage: mv == null || mv <= 0 ? null : normalizeVoltage(mv.toDouble()),
      currentRaw: raw?.toDouble(),
      temperatureC: (map['temperatureC'] as num?)?.toDouble(),
      chargeCounterMah:
          counter == null || counter <= 0 ? null : counter.toDouble() / 1000,
      systemTimeToFull: ttf == null || ttf <= 0
          ? null
          : Duration(milliseconds: ttf.toInt()),
    );
  }

  /// Android documents EXTRA_VOLTAGE as millivolts, but some devices report
  /// volts or microvolts.
  static double normalizeVoltage(double v) {
    if (v > 100000) return v / 1000000;
    if (v > 100) return v / 1000;
    return v;
  }

  static ChargeStatus _parseStatus(Object? s) => switch (s) {
        'charging' => ChargeStatus.charging,
        'full' => ChargeStatus.full,
        'discharging' => ChargeStatus.discharging,
        'not_charging' => ChargeStatus.notCharging,
        _ => ChargeStatus.unknown,
      };

  static PlugType _parsePlug(Object? p) => switch (p) {
        'ac' => PlugType.ac,
        'usb' => PlugType.usb,
        'wireless' => PlugType.wireless,
        'dock' => PlugType.dock,
        'none' => PlugType.none,
        _ => PlugType.unknown,
      };
}
