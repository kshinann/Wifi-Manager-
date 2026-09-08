"""On-device port of backend/app/downloader.py, adapted to run inside the
Android app process via Chaquopy instead of as a separate server.

Differences from the desktop version:
- `configure()` must be called once (from Kotlin) before anything else, to
  provide a writable download directory and the Android Context needed to
  save finished files into the Downloads folder.
- No ffmpeg on-device. yt-dlp downloads video and audio as separate raw
  files, and MediaMerger.kt (Media3 Transformer, via Chaquopy's Java
  interop) muxes/transcodes them into the final file instead.
- Because of that, the supported output formats are narrower than the
  desktop backend's: Android's MediaMuxer only writes MP4/WEBM containers,
  and AAC is the only audio encoder guaranteed present on every device.
- Finished downloads are saved directly to MediaStore Downloads via the
  Android Context (see `save_to_downloads`) rather than streamed back over
  HTTP for the browser to save, since saving a blob: download from inside an
  Android WebView isn't reliable.
"""

import os
import re
import shutil
import uuid
from typing import Optional

import yt_dlp

# Narrower than the desktop backend's — see module docstring.
AUDIO_ONLY_FORMATS = {"m4a"}
VIDEO_CONTAINERS = {"mp4", "webm"}

DOWNLOAD_ROOT: Optional[str] = None
ANDROID_CONTEXT = None


def configure(download_root: str, android_context) -> None:
    global DOWNLOAD_ROOT, ANDROID_CONTEXT
    DOWNLOAD_ROOT = download_root
    os.makedirs(DOWNLOAD_ROOT, exist_ok=True)
    ANDROID_CONTEXT = android_context


def search_videos(query: str, limit: int = 12) -> list:
    limit = max(1, min(limit, 25))
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "default_search": "ytsearch",
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)

    results = []
    for e in info.get("entries") or []:
        if not e:
            continue
        video_id = e.get("id")
        results.append(
            {
                "id": video_id,
                "title": e.get("title"),
                "uploader": e.get("uploader") or e.get("channel"),
                "duration": e.get("duration"),
                "thumbnail": e.get("thumbnail")
                or (f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else None),
                "url": e.get("url")
                or e.get("webpage_url")
                or (f"https://www.youtube.com/watch?v={video_id}" if video_id else None),
            }
        )
    return results


def fetch_info(url: str) -> dict:
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if "entries" in info:
        info = next((e for e in info["entries"] if e), info)

    formats = []
    for f in info.get("formats", []):
        has_video = f.get("vcodec") not in (None, "none")
        has_audio = f.get("acodec") not in (None, "none")
        if not has_video and not has_audio:
            continue
        formats.append(
            {
                "format_id": f.get("format_id"),
                "ext": f.get("ext"),
                "resolution": f.get("resolution")
                or (f"{f.get('height')}p" if f.get("height") else "audio only"),
                "height": f.get("height"),
                "fps": f.get("fps"),
                "vcodec": f.get("vcodec"),
                "acodec": f.get("acodec"),
                "filesize": f.get("filesize") or f.get("filesize_approx"),
                "has_video": has_video,
                "has_audio": has_audio,
                "note": f.get("format_note"),
            }
        )

    return {
        "id": info.get("id"),
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "uploader": info.get("uploader"),
        "webpage_url": info.get("webpage_url"),
        "extractor": info.get("extractor"),
        "formats": formats,
        # Media3 Transformer can always merge separate video+audio streams
        # on-device, so every resolution is fair game (unlike the old
        # no-ffmpeg fallback, which could only offer pre-merged streams).
        "can_merge": True,
    }


def _download_raw(url: str, format_selector: str, job_dir: str, basename: str) -> str:
    """Downloads a single yt-dlp format (no merging/postprocessing) to
    job_dir/basename.<ext>, and returns the resulting path."""
    outtmpl = os.path.join(job_dir, f"{basename}.%(ext)s")
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": outtmpl,
        "format": format_selector,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    matches = [
        f
        for f in os.listdir(job_dir)
        if f.startswith(f"{basename}.") and not f.endswith((".part", ".ytdl"))
    ]
    if not matches:
        raise RuntimeError(f"Download failed for format '{format_selector}'")
    return os.path.join(job_dir, matches[0])


def _safe_filename(title: Optional[str], ext: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]+', "_", (title or "download")).strip()
    return f"{(name[:150] or 'download')}.{ext}"


def download_media(
    url: str,
    output_format: str,
    height: Optional[int] = None,
    format_id: Optional[str] = None,
) -> str:
    output_format = output_format.lower()
    if output_format not in AUDIO_ONLY_FORMATS and output_format not in VIDEO_CONTAINERS:
        raise ValueError(f"Unsupported output format: {output_format}")
    if DOWNLOAD_ROOT is None:
        raise RuntimeError("downloader.configure() was not called")

    job_dir = os.path.join(DOWNLOAD_ROOT, uuid.uuid4().hex)
    os.makedirs(job_dir, exist_ok=True)

    is_audio_only = output_format in AUDIO_ONLY_FORMATS

    try:
        with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True}) as ydl:
            title = ydl.extract_info(url, download=False, process=False).get("title")

        video_raw: Optional[str] = None
        audio_raw: Optional[str] = None

        if format_id:
            # An exact source format was requested — download it as-is and
            # let MediaMerger remux/transcode whatever tracks it contains
            # (video+audio, video-only, or audio-only).
            raw = _download_raw(url, format_id, job_dir, "raw_source")
            if is_audio_only:
                audio_raw = raw
            else:
                video_raw = raw
        elif is_audio_only:
            audio_raw = _download_raw(url, "bestaudio/best", job_dir, "raw_audio")
        else:
            cap = f"[height<={height}]" if height else ""
            video_raw = _download_raw(url, f"bestvideo{cap}/best{cap}", job_dir, "raw_video")
            audio_raw = _download_raw(url, "bestaudio/best", job_dir, "raw_audio")

        output_path = os.path.join(job_dir, _safe_filename(title, output_format))

        from java import jclass

        jclass("com.videodownloader.app.MediaMerger").merge(
            ANDROID_CONTEXT, video_raw, audio_raw, output_path
        )

        if not os.path.exists(output_path):
            raise RuntimeError("Merge failed: no output file produced")
        return output_path
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise


def cleanup_job(file_path: str) -> None:
    job_dir = os.path.dirname(file_path)
    if DOWNLOAD_ROOT and os.path.commonpath([job_dir, DOWNLOAD_ROOT]) == DOWNLOAD_ROOT:
        shutil.rmtree(job_dir, ignore_errors=True)


_MIME_TYPES = {
    "mp4": "video/mp4",
    "webm": "video/webm",
    "m4a": "audio/mp4",
}


def mime_type_for(output_format: str) -> str:
    return _MIME_TYPES.get(output_format.lower(), "application/octet-stream")


def save_to_downloads(file_path: str, mime_type: str) -> str:
    """Save a finished download into the device's public Downloads folder
    via MediaStore, using the Context passed to `configure()`."""
    if ANDROID_CONTEXT is None:
        raise RuntimeError("downloader.configure() was not called with an Android context")

    from java import jclass

    content_values_cls = jclass("android.content.ContentValues")
    media_store_downloads = jclass("android.provider.MediaStore$Downloads")

    filename = os.path.basename(file_path)

    values = content_values_cls()
    values.put("_display_name", filename)
    values.put("mime_type", mime_type)
    values.put("is_pending", 1)

    resolver = ANDROID_CONTEXT.getContentResolver()
    uri = resolver.insert(media_store_downloads.EXTERNAL_CONTENT_URI, values)
    if uri is None:
        raise RuntimeError("Could not create file in Downloads")

    out_stream = resolver.openOutputStream(uri)
    try:
        with open(file_path, "rb") as src:
            while True:
                chunk = src.read(64 * 1024)
                if not chunk:
                    break
                out_stream.write(chunk)
    finally:
        out_stream.close()

    done_values = content_values_cls()
    done_values.put("is_pending", 0)
    resolver.update(uri, done_values, None, None)

    return filename
