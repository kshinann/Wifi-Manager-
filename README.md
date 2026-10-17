# ChargeVerse

A Flutter charging companion that shows live 3D artwork reacting to how fast
your phone is charging, alongside the real numbers.

## Features

- **13 switchable themes.** Scroll the theme strip at the top and tap one, or
  swipe sideways across the artwork. Your choice is remembered. In every theme
  the battery level is part of the scene, and charging power sets the pace.

  | Theme | Battery level shows as | Faster charging means |
  |---|---|---|
  | Liquid Orb | liquid filling a glass sphere | bigger waves, more bubbles and energy streams |
  | Battery Core | energy filling a glass battery | faster gyroscope rings, brighter neon grid |
  | Galaxy | ring around the disc | more stars spiralling into the core |
  | Ocean | the tide (horizon) rising | taller, faster waves and more sun glitter |
  | Fish Tank | water level in the tank | more fish, swimming faster, more bubbles |
  | Forest | night turning into sunrise | more fireflies |
  | Aurora | taller northern-light curtains | faster rippling lights |
  | Lava Lamp | the wax pool at the bottom | more blobs rising faster |
  | Snow Globe | snow piling up | a faster, denser blizzard |
  | Planet | day side growing from crescent to full | faster spin and orbiting moons |
  | Neon City | windows lighting up | faster grid road and flying light trails |
  | Rainy Window | condensation clearing from the bottom up | heavier rain, faster drops |
  | Volcano | lava rivers flowing down the slopes | more, higher embers |
- **Real video for the 10 scene themes.** Ocean, Fish Tank, Forest, Aurora, Lava
  Lamp, Snow Globe, Planet, Neon City, Rainy Window and Volcano play real
  footage hosted on this repo's GitHub Releases. The video plays faster with more charging power
  (0.6x to 1.5x), a soft glow rises from the bottom to the battery level, and
  energy motes float up while charging. Liquid Orb, Battery Core and Galaxy
  stay as drawn 3D art. See [Scene videos](#scene-videos).
- **Live stats**
  - Charge type badge: Slow / Charging / Fast / Super-fast, with watts going
    into the battery and its temperature (hot-battery warning at 42 °C)
  - Current (mA) and voltage (V)
  - Time to full, labelled with where the estimate comes from
- **Demo mode** with a charger-wattage slider, for emulators or when unplugged.
- **Open when charging (Android).** When switched on, ChargeVerse opens over the
  lock screen as soon as you plug in and closes again when you unplug. While
  charging the screen stays awake and dims after 1 minute without a touch.
  On first launch a step-by-step setup wizard walks through every permission
  it needs, skipping any that are already allowed. Change it later, or re-run
  the wizard, from the ⚙ button.

## Open when charging: how it works

Since Android 8 apps can't react to the charger from the manifest, and since
Android 10 they can't open themselves from the background. So:

1. A **foreground service** (`ChargeWatcherService`, type `specialUse`) runs
   only after the user turns the feature on. It shows a silent, minimised
   "ChargeVerse is ready" notification and restarts after a reboot or update
   (`BootReceiver`).
2. On plug-in it posts a **full-screen notification**. When the phone is
   locked, Android opens the charging screen immediately. When you're using
   another app, it appears as a heads-up "tap to open" notification instead
   of interrupting you.
3. `MainActivity` shows over the lock screen only when the charger opened it,
   keeps the screen on while charging, dims after 60 s idle, and closes on
   unplug. If you opened the app yourself, it stays open.

The setup wizard (`lib/ui/setup_wizard.dart`) and the settings sheet check
each requirement. Only notifications can be asked for with a system pop-up;
for the rest the app opens the matching settings page and re-checks when the
user returns. The requirements are: notifications (Android 13+), full-screen alerts (Android 14+), battery
optimization, and on OPPO / realme / OnePlus / Xiaomi / Vivo / Huawei phones the
vendor **Auto-launch** setting, without which the system kills the watcher.
The wizard opens the vendor's own auto-launch list directly where it can
(ColorOS, MIUI, Funtouch, EMUI, ...) and falls back to App info. Android can't
read that switch back, so the user confirms it with "I've turned it on".
Battery optimization uses the settings list rather than the one-tap
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` dialog, which Google Play restricts.

### Google Play notes

- Declare the `specialUse` foreground service in Play Console (App content →
  Foreground service permissions) with a short video of the feature. The
  justification text is already in `AndroidManifest.xml`.
- `USE_FULL_SCREEN_INTENT`: on Android 14+ Play only grants it by default to
  calling and alarm apps. Elsewhere the user can allow it from the settings
  sheet. Without it, the app falls back to the "tap to open" notification.
- The feature is off until the user opts in, and the persistent notification
  explains why the app is running.

## Scene videos

Each video theme downloads its clip the first time it's chosen (with a
progress chip), stores it in app storage and plays it offline from then on.
Until the clip is ready, or if it can't download, the drawn version shows.

The clips are files in the GitHub Release `scene-videos-v1` of this repo
(see `lib/video/scene_videos.dart`), so no API key ships in the app:

| Scene | File name |
|---|---|
| Ocean | `ocean.mp4` |
| Fish Tank | `fish_tank.mp4` |
| Forest | `forest.mp4` |
| Aurora | `aurora.mp4` |
| Lava Lamp | `lava_lamp.mp4` |
| Snow Globe | `snow_globe.mp4` |
| Planet | `planet.mp4` |
| Neon City | `neon_city.mp4` |
| Rainy Window | `rainy_window.mp4` |
| Volcano | `volcano.mp4` |

Pick portrait (vertical) clips around 720×1280 or 1080×1920, ideally under
10 MB and 10–30 s long; they loop. Free sources such as pexels.com allow use
inside apps. To swap a clip later, upload it to a new release
(`scene-videos-v2`) and update the tag in `scene_videos.dart`; phones notice
the new URL and download it. A scene can also use `credit:` to show the
videographer's name.

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
files, so `AndroidManifest.xml`, the Kotlin sources and `AppDelegate.swift`
are preserved:

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
  art/                             Liquid Orb, Battery Core, Galaxy + shared 3D math/helpers
  art/scenes/                      drawn versions of the 10 scenes (shown until the video is ready)
  video/                           scene video config, download cache, video player + charging overlay
  ui/                              charging screen, stats panel, setup wizard, settings sheet
android/.../MainActivity.kt        battery telemetry, lock-screen/keep-awake/dim window, settings channel
android/.../ChargeWatcherService.kt  charger watcher + full-screen plug-in notification
android/.../AutoLaunch.kt          on/off flag, permission checks, notification channels
android/.../BootReceiver.kt        restarts the watcher after reboot/update
ios/Runner/AppDelegate.swift       UIDevice battery stream
test/charge_analyzer_test.dart
```
