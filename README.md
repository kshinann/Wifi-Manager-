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
  Results are kept in a local history, with a download/upload trend chart
  once there are at least two runs to compare.
- **Recommendations** — a full, categorized list of actionable advice (move
  closer to the router, switch to WPA2/WPA3, change the router's channel,
  switch band, etc.), each derived from a specific rule against the data
  above — not generic tips.
- **Devices** — a best-effort scan of who else is on your local network, so
  you can spot an unrecognized device. See "Devices / intruder detection"
  below for exactly what this can and can't actually see.

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
│   ├── lan/
│   │   ├── SubnetPlanner.kt      Pure IPv4 subnet math (which addresses to
│   │   │                        probe), no Android dependency
│   │   ├── LanDeviceScanner.kt   Bounded-concurrency TCP probe across the
│   │   │                        subnet -- see "Devices" below for what this
│   │   │                        can/can't detect
│   │   └── KnownDeviceStore.kt   DataStore-backed "these are mine" allow-list
│   └── recommendation/
│       └── RecommendationEngine.kt  Pure, stateless rule engine: connection +
│                                    scan + speed test → health score + advice
├── di/AppContainer.kt    Small hand-rolled DI container (no Hilt needed at
│                         this size); shares Wi-Fi state app-wide as hot
│                         StateFlows so screens don't each register their own
│                         BroadcastReceiver/NetworkCallback
├── ui/                   Jetpack Compose screens + ViewModels, one package
│                         per feature (dashboard, scan, devices, speedtest,
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
| `POST_NOTIFICATIONS` (API ≥ 33) | Only requested if you turn on "Unrecognized-device alerts" in the Devices tab; never requested otherwise. |

No location is ever read or transmitted — the permission is Android's gate
for reading Wi-Fi metadata, not something this app uses for positioning.

## Speed test endpoints

Throughput is measured against Cloudflare's public speed-test endpoints
(`speed.cloudflare.com/__down` / `__up`), the same infrastructure used by
several open-source speed test clients — no API key required. Both endpoints
are simple constructor defaults in `SpeedTestEngine` and can be pointed at a
self-hosted test server instead.

Download/upload each open **4 parallel connections** (`SpeedTestEngine.PARALLEL_STREAMS`)
and sum their throughput, the same approach Ookla/speedtest.net uses. A
single TCP stream is a poor proxy for link capacity — TCP slow-start and a
single connection's window ceiling mean one stream alone typically reads
well below what the link can actually do, especially on faster connections.

Latency is measured as a raw TCP-connect round trip to `1.1.1.1:443`
(internet) and to the DHCP gateway on port 80 (local hop), which lets a
recommendation distinguish "your Wi-Fi is fine, the problem is upstream"
from "the problem is local interference." Note the local-hop number can
legitimately be *higher* than the internet one on some routers — a cheap
router's embedded CPU answering a TCP handshake is often slower than a
CDN's hardware-accelerated edge, so a high "local latency" isn't necessarily
a bug in the measurement.

## Devices / intruder detection

The Devices tab sweeps the current subnet and probes a handful of common TCP
ports per address (`LanDeviceScanner`), so you can spot something on your
network you don't recognize. It's worth being precise about what this is
and isn't, since "check for intruders" invites assuming more than an app
without root or router access can actually deliver:

- **No MAC address or manufacturer info.** Android has blocked apps from
  reading other devices' MAC addresses via ARP since Android 10, specifically
  to prevent cross-app/cross-device tracking. That means no "vendor: Apple"
  or "vendor: Samsung" hints — just an IP address and, occasionally, a
  hostname if the router happens to do reverse DNS for its clients (most
  consumer routers don't).
- **Can miss real devices.** A host is flagged "alive" if a TCP connection
  either succeeds or is refused fast (a fast refusal still proves something
  answered). Routers, computers, printers and IoT gear usually have at least
  one open port and get caught reliably. Phones and tablets that run no
  listening service and silently drop unsolicited traffic can be missed
  entirely — this is a heuristic sweep, not a guaranteed inventory.
- **"Unrecognized" can be a false alarm.** Devices are tracked by IP address
  (the only identifier available without root), and a router reassigning
  DHCP leases -- e.g. after a reboot -- can make a device you already
  approved reappear as "new." That's a limitation of the technique, not
  necessarily a sign of an intruder.
- **The actually-authoritative list lives on the router itself** (its DHCP
  client table), which isn't something a LAN peer app can query without
  router-specific admin credentials and a per-brand integration -- out of
  scope for this app. If you get an unrecognized-device hit you're unsure
  about, cross-check it against your router's own admin page.

In short: treat a flagged device as a prompt to go look, not a verdict.

**Alerts are opt-in.** The Devices tab has an "Unrecognized-device alerts"
toggle (off by default) that posts a local notification whenever a scan
finds a device outside the known-devices list. It's off unless you turn it
on, and on Android 13+ turning it on also prompts for the POST_NOTIFICATIONS
runtime permission -- nothing is ever pushed without both. This only fires
when you tap "Scan network" yourself; there's no background/periodic scan.

## Building

Requires Android Studio (or the command-line Android SDK) with:
compileSdk/targetSdk 34, JDK 17.

```
./gradlew assembleDebug
```

Every push also builds automatically via GitHub Actions
(`.github/workflows/android-build.yml`), which uploads the debug APK as a
workflow artifact — see the repo's Actions tab for the latest build and a
downloadable APK without needing a local Android SDK at all.

## Minimum SDK

`minSdk 26` (Android 8.0), `targetSdk 34`.

## Ads (AdMob)

The app ships a single persistent banner ad (`ui/components/BannerAdView.kt`)
docked above the bottom navigation bar, using Google Mobile Ads
(`com.google.android.gms:play-services-ads`).

**Out of the box it's wired to Google's published TEST IDs** (both the
`APPLICATION_ID` meta-data in `AndroidManifest.xml` and
`BannerAdView`'s default `adUnitId`) — these only ever serve clearly-labeled
test creatives and are safe to ship in debug builds, but **earn nothing** and
must be replaced before a real release:

1. Create an account at [apps.admob.com](https://apps.admob.com) (needs a
   Google account; a Play Console account isn't required to start, but
   AdMob and Play Console link together once the app is published).
2. Add an app in AdMob (Android platform), which gives you a real
   **App ID** — put it in the `com.google.android.gms.ads.APPLICATION_ID`
   meta-data tag in `AndroidManifest.xml`.
3. Create a **Banner** ad unit under that app, which gives you an
   **ad unit ID** — pass it to `BannerAdView(adUnitId = "ca-app-pub-...")`
   at its call site in `navigation/AppNavHost.kt`.
4. If you have EU/UK/California users, integrate Google's User Messaging
   Platform (UMP) SDK for consent — required by Google's ad policies and by
   GDPR; not included here since it needs your AdMob account's configured
   consent message to test against.
5. Using ads means your Play Console **Data safety** section and store
   listing's **Privacy Policy** must disclose what the ads SDK collects
   (advertising ID, device/app data) — see the publishing checklist below.

Wanting a different ad format (interstitial after a completed speed test,
for example) or removing ads for a paid tier are both reasonable follow-ups
this scaffold doesn't include yet.

## Publishing to Google Play

This is mostly manual work in the Play Console rather than code, but here's
the concrete path from this repo to a published listing:

1. **Signed release build.** Play requires a signed App Bundle, not a debug
   APK.
   - Generate an upload keystore once (keep it and its passwords **safely
     backed up** — losing it can permanently block updates to the app):
     ```
     keytool -genkey -v -keystore release-upload-key.jks -keyalg RSA \
       -keysize 2048 -validity 10000 -alias upload
     ```
   - Copy `keystore.properties.example` to `keystore.properties` (already
     gitignored) and fill in the real path/passwords/alias.
   - Build the bundle: `./gradlew bundleRelease` → output at
     `app/build/outputs/bundle/release/app-release.aab`.
   - (The CI workflow only builds the unsigned debug APK on purpose, to
     avoid needing signing secrets in GitHub Actions. Release bundles are
     meant to be built locally, or via a separate workflow you wire up with
     `KEYSTORE_*` repo secrets — `app/build.gradle.kts`'s signing config
     already reads those env vars as a fallback to `keystore.properties`.)
2. **Play Console account.** One-time $25 fee, identity verification
   (can take a few days for new accounts).
3. **Create the app listing**: title, short/full description, icon,
   feature graphic, phone screenshots (take these from an actual run —
   Dashboard, Scan, Speed test, Tips are good choices), content rating
   questionnaire, and target audience.
4. **Privacy Policy URL** — mandatory once ads are enabled. Can be a single
   static page (GitHub Pages works fine) stating what data the app and its
   ads SDK collect (advertising ID via AdMob; the app itself collects no
   personal data or location — it only *uses* the location-gated Wi-Fi scan
   API, never reads or stores actual location).
5. **Data safety form** — declare what AdMob collects (device/advertising
   identifiers, app interactions, for advertising purposes) and confirm the
   app itself doesn't collect additional personal data.
6. **Permissions declaration** — `ACCESS_FINE_LOCATION` is a sensitive
   permission Play will ask you to justify; the accurate answer is "used
   solely to satisfy Android's Wi-Fi scan API requirement, never to
   determine or store the user's location."
7. **New personal developer accounts**: Google currently requires a closed
   test with **at least 12 opted-in testers for 14 continuous days** before
   allowing a first production release — plan for this lead time.
8. **Upload the AAB** to a testing track first (internal → closed → open),
   then promote to production once testing requirements are satisfied.
9. **Target API level**: Play enforces targeting a recent Android version
   for new releases (the requirement moves forward roughly yearly). This
   project currently targets API 34 (Android 14) — check the current
   requirement in Play Console when you get to this step, since it may need
   bumping to 35 by the time you publish.
