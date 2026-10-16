# ChargeVerse

A Flutter charging companion that shows live 3D artwork reacting to how fast
your phone is charging, alongside the real numbers.

## Features

- **Three switchable 3D themes.** Tap the selector at the top or swipe sideways
  across the artwork. Your choice is remembered.
  - **Liquid Orb**: a glass sphere filling with glowing liquid. Waves, bubbles
    and an orbiting light ring speed up with charging power, and energy streams
    up into the orb while plugged in.
  - **Battery Core**: a sci-fi glass battery over a scrolling neon grid, wrapped
    in three gyroscope rings with comet trails.
  - **Galaxy**: a tilted 3D spiral galaxy draining into a pulsing core. More
    power means more stars and faster inflow. The outer ring shows the battery
    level.
- **Live stats**
  - Charge type badge: Slow / Charging / Fast / Super-fast, with watts going
    into the battery and its temperature (hot-battery warning at 42 °C)
  - Current (mA) and voltage (V)
  - Time to full, labelled with where the estimate comes from
- **Demo mode** with a charger-wattage slider, for emulators or when unplugged.

## Platform support

| | Android | iOS |
|---|---|---|
| Level & charging state | ✅ | ✅ |
| Current, voltage, temperature, watts | ✅ | ❌ not exposed by iOS |
| Time to full | System estimate (Android 9+), else from current | Estimated from how fast % rises (needs about 2 min) |
| Charge type | From battery-side watts | From % per minute |

Watts are measured at the battery, so they read lower than the charger's
label. An 18 W charger usually puts about 12–15 W into the cell.

Android devices disagree on current units (µA vs mA) and sign. The app
normalizes both; see `ChargeAnalyzer.normalizeCurrent`.

## Getting started

Only the app source and the custom native files are committed. Generate the
remaining platform boilerplate once with `flutter create`. It keeps existing
files, so `MainActivity.kt` and `AppDelegate.swift` are preserved:

```bash
flutter create --org com.chargeverse --project-name charge_verse --platforms=android,ios .
flutter pub get
flutter test
flutter run
```

Requires Flutter 3.27 or newer (developed against the 3.47 templates).

## Project layout

```
lib/
  main.dart
  models/battery_reading.dart      raw sample + platform map parsing
  services/battery_service.dart    native EventChannel + demo simulator
  services/charge_analyzer.dart    unit normalization, smoothing, time to full, classification
  art/                             the three CustomPainter 3D themes + tiny 3D math
  ui/                              charging screen, stats panel, formatting
android/.../MainActivity.kt        BatteryManager telemetry stream
ios/Runner/AppDelegate.swift       UIDevice battery stream
test/charge_analyzer_test.dart
```
