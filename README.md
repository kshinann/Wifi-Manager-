# Video Downloader

A small web app for downloading videos from YouTube and hundreds of other
sites (anything [yt-dlp](https://github.com/yt-dlp/yt-dlp) supports), into a
format and resolution of your choice.

## Features

- Search YouTube right from the app, or paste any video URL directly.
- Play the selected video inline (via YouTube's own embeddable player) before downloading it.
- Fetch a video's title, thumbnail, duration, and available formats.
- Choose an output container (`mp4`, `webm`, `mkv`, `mov`) or extract audio only
  (`mp3`, `m4a`, `wav`, `aac`, `opus`, `flac`).
- Pick a target resolution, or let it grab the best available.
- Single FastAPI backend that also serves the frontend, so it's one process to run.

## Requirements

- Python 3.9+
- [ffmpeg](https://ffmpeg.org/) installed and on your `PATH` (used to remux/convert
  video and to extract audio)

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## Run

```bash
uvicorn backend.app.main:app --reload --port 8000
```

Then open http://localhost:8000 in your browser.

## Run with Docker

```bash
docker build -t video-downloader .
docker run --rm -p 8000:8000 video-downloader
```

Then open http://localhost:8000 in your browser. The image bundles ffmpeg,
so there's nothing else to install.

## Android apps

Two Android app projects live under `mobile/` — a WebView wrapper around
this same frontend, and a standalone native app that calls the API
directly. See `mobile/README.md` for details and build instructions.

## Desktop app

A native Windows/macOS/Linux app lives under `desktop/` — an Electron
window wrapping this same backend and frontend, with a bundled ffmpeg so
nothing needs to be installed separately. See `desktop/README.md` for
build instructions.

## Sites that need a login

Desktop only (the "Sites that need a login" panel on the page): pick a
browser you're already logged in with on the same computer, and its cookies
are reused for `yt-dlp` requests, the same way `yt-dlp --cookies-from-browser
<browser>` works from the command line. This covers private/unlisted videos,
age-gated content, and non-YouTube sites that only serve certain content to
logged-in users. Nothing is uploaded anywhere else — the cookies never leave
this machine. Not available in the standalone mobile app or a headless
server deployment, since there's no browser to borrow cookies from.

## API

- `POST /api/search` — body `{"query": "...", "limit": 12}` — returns lightweight
  results (id, title, uploader, duration, thumbnail, url) for a YouTube search.
- `POST /api/info` — body `{"url": "..."}` — returns title, thumbnail, duration,
  and the list of available formats for a video.
- `POST /api/download` — body `{"url": "...", "format": "mp4", "height": 1080}` —
  downloads and converts the media, streaming the resulting file back.
  `height` and `format_id` are optional; omit `height` for the best available
  resolution, or pass a specific `format_id` from `/api/info` to pick an exact
  source stream.
- `GET /api/settings` / `POST /api/settings` — body `{"cookies_browser": "chrome"}`
  (or `null` to disable) — reads/sets which browser's cookies to reuse for
  sites that need a login. Supported values: `chrome`, `chromium`, `firefox`,
  `edge`, `brave`, `opera`, `vivaldi`, `safari`, `whale`.

## Notes

- Search results come from `yt-dlp`'s search support (no API key needed), and
  playback uses YouTube's own official embeddable player — downloading is a
  separate, explicit action.
- Only download content you have the right to download (your own videos,
  content licensed for download, or sites that explicitly permit it). Respect
  the terms of service of the site you're downloading from.
- Downloaded files are written to a temporary directory and streamed back to
  the browser, then cleaned up automatically after the response is sent.
