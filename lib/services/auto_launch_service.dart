import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// State of "open automatically when charging" (Android only; iOS doesn't
/// allow apps to launch themselves).
class AutoLaunchStatus {
  const AutoLaunchStatus({
    required this.supported,
    this.enabled = false,
    this.notificationsAllowed = false,
    this.fullScreenAllowed = false,
    this.batteryUnrestricted = false,
    this.manufacturer = '',
  });

  factory AutoLaunchStatus.fromMap(Map<Object?, Object?> m) => AutoLaunchStatus(
        supported: m['supported'] == true,
        enabled: m['enabled'] == true,
        notificationsAllowed: m['notificationsAllowed'] == true,
        fullScreenAllowed: m['fullScreenAllowed'] == true,
        batteryUnrestricted: m['batteryUnrestricted'] == true,
        manufacturer: (m['manufacturer'] as String?) ?? '',
      );

  static const unsupported = AutoLaunchStatus(supported: false);

  final bool supported;
  final bool enabled;
  final bool notificationsAllowed;

  /// Without this (Android 14+), plugging in shows a "tap to open"
  /// notification instead of opening the app.
  final bool fullScreenAllowed;

  /// Battery optimization can stop the watcher on some phones.
  final bool batteryUnrestricted;
  final String manufacturer;

  /// OPPO, Xiaomi, Vivo, Huawei and friends kill background services unless
  /// the user allows "auto-launch" in a vendor-specific settings page.
  bool get hasAggressiveBatteryManager => const {
        'oppo',
        'realme',
        'oneplus',
        'xiaomi',
        'redmi',
        'poco',
        'vivo',
        'iqoo',
        'huawei',
        'honor',
        'meizu',
        'asus',
      }.contains(manufacturer);

  bool get fullyWorking => enabled && notificationsAllowed && fullScreenAllowed;
}

class AutoLaunchService {
  static const _channel = MethodChannel('chargeverse/auto_launch');

  static bool get isAvailable =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<AutoLaunchStatus> status() => _call('getStatus');

  /// Turning on asks for the notification permission on Android 13+; if the
  /// user declines, the returned status stays disabled.
  Future<AutoLaunchStatus> setEnabled(bool enabled) => _call('setEnabled', enabled);

  Future<void> openNotificationSettings() => _open('openNotificationSettings');
  Future<void> openFullScreenSettings() => _open('openFullScreenSettings');
  Future<void> openBatterySettings() => _open('openBatterySettings');
  Future<void> openAppSettings() => _open('openAppSettings');

  Future<AutoLaunchStatus> _call(String method, [Object? args]) async {
    if (!isAvailable) return AutoLaunchStatus.unsupported;
    try {
      final m = await _channel.invokeMethod<Map<Object?, Object?>>(method, args);
      return m == null ? AutoLaunchStatus.unsupported : AutoLaunchStatus.fromMap(m);
    } on MissingPluginException {
      return AutoLaunchStatus.unsupported;
    }
  }

  Future<void> _open(String method) async {
    if (!isAvailable) return;
    try {
      await _channel.invokeMethod<void>(method);
    } on MissingPluginException {
      // Nothing to open on this platform.
    }
  }
}
