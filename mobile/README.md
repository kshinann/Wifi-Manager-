# Android apps

Two Android apps for the Video Downloader backend, in `webview-app/` and
`native-app/`. Both need the backend (see the repo root `README.md`) running
somewhere reachable from the phone — your computer's LAN IP, or wherever you
deploy it.

Building an `.apk` requires the Android SDK (via Android Studio, or the
command-line tools + `sdkmanager`). Neither app was compiled in this
repository — set up the SDK locally and build from there.

## webview-app

A thin native wrapper (built with [Capacitor](https://capacitorjs.com/)) that
shows a "Server URL" screen once, saves it, then loads the existing web
frontend (`frontend/` at the repo root) in a WebView. Reuses the whole web UI
as-is; no duplicated logic.

```bash
cd mobile/webview-app
npm install
npx cap sync android
```

Then open `mobile/webview-app/android` in Android Studio and hit Run, or
build a release APK from the command line:

```bash
cd mobile/webview-app/android
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

## native-app

A standalone Kotlin app (no web view) that calls the backend's `/api/info`
and `/api/download` endpoints directly: enter the server URL and a video
URL, fetch title/thumbnail/available formats, pick an output format and
resolution, and download — saved straight to the device's Downloads folder
via `MediaStore`.

```bash
cd mobile/native-app
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

Open the same directory in Android Studio if you'd rather build/run from
there.

## Notes

- Both apps default to plain HTTP for the server URL (cleartext traffic is
  allowed) since most people will point them at a backend on their local
  network rather than one behind HTTPS.
- Only download content you have the right to download, and respect the
  terms of service of the site you're downloading from.
