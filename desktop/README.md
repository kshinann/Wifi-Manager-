# Desktop app

A native desktop app (Windows/macOS/Linux) wrapping the backend in an
Electron window, instead of running `uvicorn` and opening a browser tab
yourself. Unlike the Android `webview-app`, this bundles a **real ffmpeg
binary** (via [imageio-ffmpeg](https://pypi.org/project/imageio-ffmpeg/)),
so it has the full format/resolution support of the desktop backend — no
MediaMuxer-style container/codec restrictions.

## How it fits together

- `backend/run_server.py` — entry point that starts the existing FastAPI
  backend (`backend/app/`) on `127.0.0.1`, after putting a bundled ffmpeg
  binary on `PATH` so nothing needs to be installed separately.
- `backend.spec` — a [PyInstaller](https://pyinstaller.org/) spec that
  packages `run_server.py` (plus `frontend/`, yt-dlp's extractors, and the
  bundled ffmpeg binary) into a single standalone executable — no Python
  install needed to run it.
- `main.js` — the Electron main process: spawns that executable as a
  background process, waits for it to respond, then opens it in a native
  window (loading the same `frontend/` UI, unmodified) instead of a browser
  tab. Kills the backend process when the app quits.
- `package.json` — Electron + [electron-builder](https://www.electron.build/)
  config that packages everything into an installer (`.exe` / `.dmg` /
  `.AppImage`) with `main.js`'s spawned executable bundled alongside it via
  `extraResources`.

## Building locally

```bash
cd desktop
pip install -r requirements.txt
pyinstaller backend.spec          # -> desktop/dist/utube-download-backend(.exe)
npm install
npm run dist                       # -> desktop/release/
```

On macOS, convert the iconset to `.icns` first (needs Xcode command line
tools, so this only works on a Mac): `iconutil -c icns build/icon.iconset -o build/icon.icns`.

To just try it without packaging an installer: `npm start` (after the
`pyinstaller` step above) runs the Electron shell directly against the
`dist/` build.

## Untested in this environment

Same caveat as the Android builds: this was written and CI-built without
ever being run — there's no way to launch a Windows/Mac/Linux GUI app from
this dev sandbox to confirm the window actually opens and the backend
responds. The most likely rough edges if something's wrong:

- **yt-dlp's dynamic imports.** It loads most site extractors at runtime
  rather than via static `import` statements, which PyInstaller's analysis
  can miss. The spec uses `collect_all("yt_dlp")` to force everything in,
  but if a NameError/ModuleNotFoundError shows up at runtime for a missing
  extractor, that's the first place to look.
- **electron-builder's icon handling.** `build/icon.ico` and `icon.png` are
  generated directly (see `build/generate_icons.py`); `icon.icns` only
  exists after the macOS-only `iconutil` conversion step above.
- **`extraResources` path.** Assumes electron-builder copies
  `desktop/dist/` to `resources/backend/` inside the packaged app —
  `main.js`'s `backendExecutablePath()` is where to look if the packaged
  app can't find its backend.

## Notes

- Only download content you have the right to download, and respect the
  terms of service of the site you're downloading from.
