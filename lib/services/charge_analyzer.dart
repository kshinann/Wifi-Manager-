import 'dart:math' as math;

import '../models/battery_reading.dart';

enum ChargeClass { notCharging, full, measuring, slow, normal, fast, superFast }

enum EstimateSource { none, system, current, levelRate }

/// Everything the UI and the artwork need, derived from the latest reading.
class ChargeSnapshot {
  const ChargeSnapshot({
    required this.reading,
    required this.chargeClass,
    required this.intensity,
    this.currentMa,
    this.watts,
    this.timeToFull,
    this.timeToFullSource = EstimateSource.none,
    this.percentPerMinute,
  });

  final BatteryReading reading;

  /// Smoothed current in mA; positive flows into the battery.
  final double? currentMa;

  /// Power going into the battery (not the charger's rating).
  final double? watts;
  final Duration? timeToFull;
  final EstimateSource timeToFullSource;
  final double? percentPerMinute;
  final ChargeClass chargeClass;

  /// 0–1, drives animation speed and particle counts.
  final double intensity;

  double get level => reading.level;
  double? get voltage => reading.voltage;
  double? get temperatureC => reading.temperatureC;
}

/// Turns a stream of raw readings into [ChargeSnapshot]s: normalizes current
/// units, smooths noise, estimates time to full and classifies charge speed.
class ChargeAnalyzer {
  ChargeAnalyzer({this.smoothing = 0.3});

  /// EMA factor for current; higher reacts faster.
  final double smoothing;

  static const _rateWindow = Duration(minutes: 10);
  static const _minRateSpan = Duration(seconds: 90);

  final List<BatteryReading> _session = [];
  double? _emaCurrent;
  bool _reportsMicroamps = false;

  void reset() {
    _session.clear();
    _emaCurrent = null;
    _reportsMicroamps = false;
  }

  ChargeSnapshot add(BatteryReading r) {
    _trackSession(r);

    final instant = r.currentMa ?? normalizeCurrent(r);
    if (instant != null) {
      final prev = _emaCurrent;
      // Restart smoothing when the direction flips (plug in / unplug).
      _emaCurrent = prev == null || prev.sign != instant.sign
          ? instant
          : prev + (instant - prev) * smoothing;
    } else {
      _emaCurrent = null;
    }
    final ma = _emaCurrent;

    final v = r.voltage;
    final watts =
        (ma != null && v != null && ma > 0) ? v * ma / 1000 : null;
    final rate = _percentPerMinute();
    final (ttf, source) = _timeToFull(r, ma, rate);
    final cls = classify(r, watts, rate);

    return ChargeSnapshot(
      reading: r,
      currentMa: ma,
      watts: watts,
      timeToFull: ttf,
      timeToFullSource: source,
      percentPerMinute: rate,
      chargeClass: cls,
      intensity: intensityFor(cls, watts),
    );
  }

  /// Converts the raw platform current to mA, positive into the battery.
  ///
  /// Android specifies microamps, but plenty of devices report milliamps.
  /// Any magnitude of 10,000+ can only be microamps (10 A into a phone is not
  /// plausible), and once seen we remember it so trickle-charge values like
  /// 8,000 µA are not misread as 8 A.
  double? normalizeCurrent(BatteryReading r) {
    final raw = r.currentRaw;
    if (raw == null) return null;
    final mag = raw.abs();
    if (mag >= 10000) _reportsMicroamps = true;
    final ma = _reportsMicroamps ? mag / 1000 : mag;
    return switch (r.status) {
      ChargeStatus.charging || ChargeStatus.full => ma,
      ChargeStatus.discharging || ChargeStatus.notCharging => -ma,
      ChargeStatus.unknown => raw.isNegative ? -ma : ma,
    };
  }

  void _trackSession(BatteryReading r) {
    if (!r.isCharging) {
      _session.clear();
      return;
    }
    _session.add(r);
    final cutoff = r.time.subtract(_rateWindow);
    _session.removeWhere((s) => s.time.isBefore(cutoff));
  }

  double? _percentPerMinute() {
    if (_session.length < 2) return null;
    final first = _session.first;
    final last = _session.last;
    final span = last.time.difference(first.time);
    if (span < _minRateSpan) return null;
    final delta = last.level - first.level;
    if (delta <= 0) return null;
    return delta / (span.inMilliseconds / 60000);
  }

  (Duration?, EstimateSource) _timeToFull(
    BatteryReading r,
    double? ma,
    double? rate,
  ) {
    if (r.status == ChargeStatus.full || r.level >= 100) {
      return (Duration.zero, EstimateSource.system);
    }
    if (!r.isCharging) return (null, EstimateSource.none);

    final sys = r.systemTimeToFull;
    if (sys != null) return (sys, EstimateSource.system);

    final counter = r.chargeCounterMah;
    if (ma != null && ma > 30 && counter != null && r.level >= 1) {
      final capacity = counter / (r.level / 100);
      if (capacity > 500 && capacity < 40000) {
        final remaining = capacity - counter;
        var hours = remaining / ma;
        // Phones taper to roughly half current above 80%, so the last 20%
        // takes about twice as long as the current rate suggests.
        if (r.level < 80) hours += capacity * 0.2 / ma;
        return (_capped(hours * 60), EstimateSource.current);
      }
    }

    if (rate != null && rate > 0) {
      return (_capped((100 - r.level) / rate), EstimateSource.levelRate);
    }
    return (null, EstimateSource.none);
  }

  static Duration _capped(double minutes) =>
      Duration(seconds: (math.min(minutes, 48 * 60) * 60).round());

  /// Battery-side watts are lower than the charger's label: an 18 W charger
  /// typically delivers 12–15 W into the cell.
  static ChargeClass classify(BatteryReading r, double? watts, double? rate) {
    if (r.status == ChargeStatus.full) return ChargeClass.full;
    if (!r.isCharging) return ChargeClass.notCharging;
    if (watts != null) {
      if (watts < 5) return ChargeClass.slow;
      if (watts < 10) return ChargeClass.normal;
      if (watts < 20) return ChargeClass.fast;
      return ChargeClass.superFast;
    }
    if (rate == null) return ChargeClass.measuring;
    if (rate < 0.4) return ChargeClass.slow;
    if (rate < 0.9) return ChargeClass.normal;
    if (rate < 1.6) return ChargeClass.fast;
    return ChargeClass.superFast;
  }

  static double intensityFor(ChargeClass cls, double? watts) {
    if (watts != null && cls != ChargeClass.full) {
      return (watts / 30).clamp(0.08, 1.0);
    }
    return switch (cls) {
      ChargeClass.notCharging => 0.0,
      ChargeClass.full => 0.1,
      ChargeClass.measuring => 0.35,
      ChargeClass.slow => 0.2,
      ChargeClass.normal => 0.45,
      ChargeClass.fast => 0.7,
      ChargeClass.superFast => 1.0,
    };
  }
}
