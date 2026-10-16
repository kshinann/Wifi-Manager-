import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private let battery = BatteryStreamHandler()

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "ChargeVerseBattery") {
      FlutterEventChannel(
        name: "chargeverse/battery_stream",
        binaryMessenger: registrar.messenger()
      ).setStreamHandler(battery)
    }
  }
}

/// iOS exposes only the battery level and charging state to apps. Current,
/// voltage and temperature are not available, so Dart estimates charge speed
/// from how fast the level rises.
final class BatteryStreamHandler: NSObject, FlutterStreamHandler {
  private var sink: FlutterEventSink?
  private var timer: Timer?

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    sink = events
    UIDevice.current.isBatteryMonitoringEnabled = true
    emit()
    timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
      self?.emit()
    }
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    timer?.invalidate()
    timer = nil
    sink = nil
    return nil
  }

  private func emit() {
    guard let sink = sink else { return }
    let device = UIDevice.current
    var data: [String: Any] = ["platform": "ios"]
    if device.batteryLevel >= 0 {
      data["level"] = Double(device.batteryLevel) * 100
    }
    switch device.batteryState {
    case .charging:
      data["status"] = "charging"
    case .full:
      data["status"] = "full"
    case .unplugged:
      data["status"] = "discharging"
      data["plugged"] = "none"
    default:
      data["status"] = "unknown"
    }
    sink(data)
  }
}
