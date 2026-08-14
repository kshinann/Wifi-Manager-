# Wi-Fi Health

A native Android app that checks the health of a Wi-Fi setup — for a home
user or a small/corporate office — and turns raw radio data into plain-language
recommendations for improving it.

## What it does

- **Scan** — lists nearby Wi-Fi access points with signal strength, band,
  channel, security type, and a per-channel congestion view (which channels
  are crowded, so you know which one to move to).
- **Dashboard** — shows the currently connected network's signal, security,
  link speed, and IP configuration (address, gateway, DNS, DHCP lease), plus
  an overall 0–100 health score and a preview of the top issues found.
- **Speed test** — measures latency/jitter/packet loss (to both the internet
  and the local router, so you can tell whether a problem is local Wi-Fi
  interference or an upstream ISP issue) and download/upload throughput.
  Results are kept in a local history.
- **Recommendations** — a full, categorized list of actionable advice (move
  closer to the router, switch to WPA2/WPA3, change the router's channel,
  switch band, etc.), each derived from a specific rule against the data
  above — not generic tips.

## Why native Android (Kotlin), not cross-platform

The brief was explicitly Android-only. Wi-Fi scanning, per-connection signal
strength, and IP/DHCP configuration are all platform APIs
(`android.net.wifi.WifiManager`, `android.net.ConnectivityManager`) with no
first-class equivalent in cross-platform frameworks — using one would mean
writing a native plugin anyway. Going straight to Kotlin + Jetpack Compose
gives full, direct access to those APIs with less indirection.

## Architecture

```
app/src/main/java/com/wifihealth/manager/
├── data/
│   ├── model/            Plain data classes (WifiNetwork, ConnectionSnapshot,
│   │                     SpeedTestResult, Recommendation, HealthScore, ...)
│   ├── wifi/
│   │   ├── WifiScanner.kt        Wraps WifiManager scanning as a Flow
│   │   ├── ConnectionMonitor.kt  Wraps ConnectivityManager as a Flow of the
│   │   │                        active Wi-Fi connection's full state
│   │   └── ChannelAnalyzer.kt    Frequency↔channel math + congestion scoring
│   ├── speedtest/
│   │   ├── SpeedTestEngine.kt        OkHttp download/upload + raw-socket
│   │   │                            latency/jitter measurement
│   │   └── SpeedTestHistoryStore.kt  DataStore-backed local history
│   └── recommendation/
│       └── RecommendationEngine.kt  Pure, stateless rule engine: connection +
│                                    scan + speed test → health score + advice
├── di/AppContainer.kt    Small hand-rolled DI container (no Hilt needed at
│                         this size); shares Wi-Fi state app-wide as hot
│                         StateFlows so screens don't each register their own
│                         BroadcastReceiver/NetworkCallback
├── ui/                   Jetpack Compose screens + ViewModels, one package
│                         per feature (dashboard, scan, speedtest,
│                         recommendations), plus shared theme/components
└── navigation/           Bottom-nav Destinations + NavHost
```

`RecommendationEngine` and `ChannelAnalyzer` have no Android framework
dependency and are pure functions of their inputs, so they're straightforward
to unit test without an emulator.

## Permissions

| Permission | Why |
|---|---|
| `ACCESS_WIFI_STATE` / `CHANGE_WIFI_STATE` | Read Wi-Fi status, trigger scans |
| `ACCESS_NETWORK_STATE` | Observe the active network via `ConnectivityManager` |
| `INTERNET` | Speed test download/upload |
| `ACCESS_FINE_LOCATION` (API < 33) / `NEARBY_WIFI_DEVICES` (API ≥ 33) | Android treats nearby SSIDs/BSSIDs as location-derived data; one of these is required at runtime to read scan results and the connected SSID. The app requests only the one relevant to the device's API level. |

No location is ever read or transmitted — the permission is Android's gate
for reading Wi-Fi metadata, not something this app uses for positioning.

## Speed test endpoints

Throughput is measured against Cloudflare's public speed-test endpoints
(`speed.cloudflare.com/__down` / `__up`), the same infrastructure used by
several open-source speed test clients — no API key required. Latency is
measured as a raw TCP-connect round trip to `1.1.1.1:443` (internet) and to
the DHCP gateway on port 80 (local hop), which lets a recommendation
distinguish "your Wi-Fi is fine, the problem is upstream" from "the problem
is local interference." Both endpoints are simple constructor defaults in
`SpeedTestEngine` and can be pointed at a self-hosted test server instead.

## Building

Requires Android Studio (or the command-line Android SDK) with:
compileSdk/targetSdk 34, JDK 17.

```
./gradlew assembleDebug
```

> **Note:** this repository was authored in a sandboxed environment without
> network access to `dl.google.com` and without the Android SDK installed, so
> the build could not be executed or verified here. The Gradle wrapper,
> `build.gradle.kts` files, manifest, and all Kotlin sources were written and
> manually reviewed for correctness against the declared API/library
> versions, but **a real Android Studio build + device/emulator run is the
> next step to confirm it compiles and behaves as intended.**

## Minimum SDK

`minSdk 26` (Android 8.0), `targetSdk 34`.
