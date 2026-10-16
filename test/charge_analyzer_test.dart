import 'package:charge_verse/models/battery_reading.dart';
import 'package:charge_verse/services/charge_analyzer.dart';
import 'package:flutter_test/flutter_test.dart';

BatteryReading reading({
  DateTime? time,
  double level = 50,
  ChargeStatus status = ChargeStatus.charging,
  double? voltage = 4.0,
  double? currentRaw,
  double? currentMa,
  double? counter,
  Duration? systemTtf,
  BatterySource source = BatterySource.android,
}) =>
    BatteryReading(
      time: time ?? DateTime(2026),
      level: level,
      status: status,
      source: source,
      voltage: voltage,
      currentRaw: currentRaw,
      currentMa: currentMa,
      chargeCounterMah: counter,
      systemTimeToFull: systemTtf,
    );

void main() {
  group('normalizeCurrent', () {
    test('microamps are converted to mA', () {
      final a = ChargeAnalyzer();
      expect(a.normalizeCurrent(reading(currentRaw: 2500000)), 2500);
    });

    test('milliamp devices pass through', () {
      final a = ChargeAnalyzer();
      expect(a.normalizeCurrent(reading(currentRaw: 2500)), 2500);
    });

    test('sign follows charging status, not the device convention', () {
      final a = ChargeAnalyzer();
      expect(a.normalizeCurrent(reading(currentRaw: -1800000)), 1800);
      expect(
        a.normalizeCurrent(reading(currentRaw: 400000, status: ChargeStatus.discharging)),
        -400,
      );
    });

    test('remembers microamps so trickle current is not misread as amps', () {
      final a = ChargeAnalyzer();
      a.normalizeCurrent(reading(currentRaw: 1500000));
      expect(a.normalizeCurrent(reading(currentRaw: 8000)), 8);
    });
  });

  group('classify', () {
    test('uses battery-side watts when available', () {
      final r = reading();
      expect(ChargeAnalyzer.classify(r, 3, null), ChargeClass.slow);
      expect(ChargeAnalyzer.classify(r, 7, null), ChargeClass.normal);
      expect(ChargeAnalyzer.classify(r, 15, null), ChargeClass.fast);
      expect(ChargeAnalyzer.classify(r, 25, null), ChargeClass.superFast);
    });

    test('falls back to level rate, then to measuring', () {
      final r = reading(voltage: null);
      expect(ChargeAnalyzer.classify(r, null, null), ChargeClass.measuring);
      expect(ChargeAnalyzer.classify(r, null, 0.2), ChargeClass.slow);
      expect(ChargeAnalyzer.classify(r, null, 2.0), ChargeClass.superFast);
    });

    test('not charging and full win over speed', () {
      expect(
        ChargeAnalyzer.classify(reading(status: ChargeStatus.discharging), 20, null),
        ChargeClass.notCharging,
      );
      expect(
        ChargeAnalyzer.classify(reading(status: ChargeStatus.full), 20, null),
        ChargeClass.full,
      );
    });
  });

  group('add', () {
    test('computes watts from voltage and current', () {
      final s = ChargeAnalyzer().add(reading(voltage: 4.0, currentRaw: 3000000));
      expect(s.currentMa, 3000);
      expect(s.watts, closeTo(12, 1e-9));
      expect(s.chargeClass, ChargeClass.fast);
    });

    test('prefers the system time-to-full estimate', () {
      final s = ChargeAnalyzer().add(
        reading(currentRaw: 2000000, counter: 2000, systemTtf: const Duration(minutes: 42)),
      );
      expect(s.timeToFull, const Duration(minutes: 42));
      expect(s.timeToFullSource, EstimateSource.system);
    });

    test('estimates time to full from current and charge counter', () {
      // 4000 mAh battery at 90% holds 3600 mAh; 400 mAh left at 2000 mA = 12 min.
      final s = ChargeAnalyzer().add(reading(level: 90, currentRaw: 2000000, counter: 3600));
      expect(s.timeToFullSource, EstimateSource.current);
      expect(s.timeToFull, const Duration(minutes: 12));
    });

    test('estimates time to full from level rate when current is unknown (iOS)', () {
      final a = ChargeAnalyzer();
      final t0 = DateTime(2026, 1, 1, 12);
      a.add(reading(time: t0, level: 50, voltage: null, source: BatterySource.ios));
      final s = a.add(reading(
        time: t0.add(const Duration(minutes: 5)),
        level: 55,
        voltage: null,
        source: BatterySource.ios,
      ));
      expect(s.percentPerMinute, closeTo(1.0, 1e-9));
      expect(s.timeToFullSource, EstimateSource.levelRate);
      expect(s.timeToFull, const Duration(minutes: 45));
      expect(s.chargeClass, ChargeClass.fast);
    });

    test('unplugging resets the rate history', () {
      final a = ChargeAnalyzer();
      final t0 = DateTime(2026, 1, 1, 12);
      a.add(reading(time: t0, level: 50, voltage: null));
      a.add(reading(time: t0.add(const Duration(minutes: 1)), status: ChargeStatus.discharging));
      final s = a.add(reading(time: t0.add(const Duration(minutes: 5)), level: 55, voltage: null));
      expect(s.percentPerMinute, isNull);
      expect(s.chargeClass, ChargeClass.measuring);
    });
  });

  test('platform map parsing handles missing fields', () {
    final r = BatteryReading.fromPlatform({
      'platform': 'ios',
      'level': 73.0,
      'status': 'charging',
    });
    expect(r.source, BatterySource.ios);
    expect(r.level, 73);
    expect(r.isCharging, isTrue);
    expect(r.voltage, isNull);
    expect(r.currentRaw, isNull);
  });

  test('voltage is normalized from mV', () {
    final r = BatteryReading.fromPlatform({'voltageMv': 4321, 'level': 10});
    expect(r.voltage, closeTo(4.321, 1e-9));
  });
}
