# Android apps

Two Android apps for the Video Downloader, in `webview-app/` and
`native-app/`.

Building an `.apk` requires the Android SDK (via Android Studio, or the
command-line tools + `sdkmanager`). Neither app was compiled in this
repository — set up the SDK locally and build from there, or use the
`.github/workflows/build-apk.yml` CI workflow, which does have the SDK.

## webview-app — fully standalone, no server needed

Runs the whole backend **inside the app** via
[Chaquopy](https://chaquo.com/chaquopy/) (embeds a Python interpreter in the
Android process), so there's nothing to deploy separately:

- `android/app/src/main/python/downloader.py` — an on-device port of
  `backend/app/downloader.py` (same yt-dlp logic).
- `android/app/src/main/python/local_server.py` — a stdlib-only HTTP server
  (deliberately not FastAPI/uvicorn/pydantic, which pull in compiled
  extensions Chaquopy may not have Android wheels for) exposing the same
  `/api/search`, `/api/info`, `/api/download` routes on `127.0.0.1:8765`.
- `MainActivity.kt` starts Python and the local server as soon as the app
  launches.
- `www/` is the *same* `frontend/index.html` + `app.js` + `style.css` from
  the repo root, copied in as-is. `app.js` detects it's running inside the
  app (via `window.Capacitor`) and points its API calls at
  `http://127.0.0.1:8765` instead of relative paths — otherwise it's
  identical code to the desktop frontend.
- Finished downloads are saved straight into the device's Downloads folder
  via `MediaStore` (see `downloader.save_to_downloads`), rather than
  streamed back for the WebView to save as a blob — that isn't reliable
  inside an Android WebView.

```bash
cd mobile/webview-app
npm install
npx cap sync android
cd android
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

**Known limitation: no bundled ffmpeg yet.** yt-dlp needs ffmpeg to merge
separate video+audio streams and to convert/extract formats. Sourcing a
legitimate prebuilt ffmpeg binary for Android (or wiring up something like
ffmpeg-kit) wasn't done here — `downloader.py` detects ffmpeg is absent and
falls back to picking an already-merged stream instead of merging/
converting, so downloads still work, just capped to whatever
pre-merged/progressive streams the site offers (typically up to 720p on
YouTube) with no format conversion. If you want full parity with the
desktop backend (any format, any resolution), bundling ffmpeg for Android
is the next piece to add.

## native-app — needs a separate backend server

A standalone Kotlin app (no web view) that calls a **separately-running**
backend's `/api/info` and `/api/download` endpoints over HTTP: enter the
server URL and a video URL, fetch title/thumbnail/available formats, pick
an output format and resolution, and download — saved straight to the
device's Downloads folder via `MediaStore`. Doesn't (yet) embed Python the
way `webview-app` does, so you still need `backend/` running somewhere
reachable from the phone (your computer's LAN IP, or wherever you deploy
it).

```bash
cd mobile/native-app
./gradlew assembleDebug
# APK at app/build/outputs/apk/debug/app-debug.apk
```

Open either project's directory in Android Studio if you'd rather build/run
from there.

## Notes

- `native-app` defaults to plain HTTP for the server URL (cleartext traffic
  is allowed) since most people will point it at a backend on their local
  network rather than one behind HTTPS. `webview-app` allows cleartext (and
  mixed content) too, since its own embedded API is plain HTTP on
  `127.0.0.1`.
- Only download content you have the right to download, and respect the
  terms of service of the site you're downloading from.
