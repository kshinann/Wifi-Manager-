import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';

import '../models/battery_reading.dart';

/// Live battery readings from the native side (see MainActivity.kt and
/// AppDelegate.swift), pushed about once a second.
class BatteryService {
  static const _channel = EventChannel('chargeverse/battery_stream');

  Stream<BatteryReading> readings() => _channel
      .receiveBroadcastStream()
      .map((e) => BatteryReading.fromPlatform(e as Map<Object?, Object?>));
}

/// Simulated charger for trying the app on an emulator or unplugged device.
/// [watts] is read on every tick so a slider can change it live.
class DemoBattery {
  DemoBattery({required this.watts});

  final double Function() watts;
  static const _capacityMah = 4500.0;
  double _storedMah = 0;
  final _rand = math.Random();

  Stream<BatteryReading> readings({double startLevel = 23}) {
    _storedMah = _capacityMah * startLevel / 100;
    return Stream.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  BatteryReading _tick() {
    final level = _storedMah / _capacityMah * 100;
    final voltage = 3.75 + level / 100 * 0.6 + (_rand.nextDouble() - 0.5) * 0.02;
    // Constant power until 80%, then taper towards a trickle.
    final taper = level < 80 ? 1.0 : math.max(0.08, (100 - level) / 20);
    final ma = watts() / voltage * 1000 * taper * (0.97 + _rand.nextDouble() * 0.06);
    final full = level >= 99.9;

    // Demo runs 20x real time so the level visibly climbs.
    _storedMah = full ? _capacityMah * 0.15 : _storedMah + ma / 3600 * 20;

    return BatteryReading(
      time: DateTime.now(),
      level: level.clamp(0.0, 100.0),
      status: full ? ChargeStatus.full : ChargeStatus.charging,
      source: BatterySource.demo,
      plug: PlugType.ac,
      voltage: voltage,
      currentMa: full ? 0 : ma,
      temperatureC: 29 + watts() / 6 + _rand.nextDouble() * 0.3,
      chargeCounterMah: _storedMah,
      systemTimeToFull: full
          ? null
          : Duration(
              seconds: ((_capacityMah - _storedMah) / ma * 3600 / 20).round(),
            ),
    );
  }
}
