"""On-device port of backend/app/downloader.py, adapted to run inside the
Android app process via Chaquopy instead of as a separate server.

Differences from the desktop version:
- `configure()` must be called once (from Kotlin) before anything else, to
  provide a writable download directory, an optional ffmpeg command, and the
  Android Context needed to save finished files into the Downloads folder.
- Finished downloads are saved directly to MediaStore Downloads via the
  Android Context (see `save_to_downloads`) rather than streamed back over
  HTTP for the browser to save, since saving a blob: download from inside an
  Android WebView isn't reliable.
"""

import os
import shutil
import uuid
from typing import Optional

import yt_dlp

AUDIO_ONLY_FORMATS = {"mp3", "m4a", "wav", "aac", "opus", "flac"}
VIDEO_CONTAINERS = {"mp4", "mkv", "webm", "mov"}

DOWNLOAD_ROOT: Optional[str] = None
FFMPEG_LOCATION: Optional[str] = None
ANDROID_CONTEXT = None


def configure(download_root: str, ffmpeg_location: Optional[str], android_context) -> None:
    global DOWNLOAD_ROOT, FFMPEG_LOCATION, ANDROID_CONTEXT
    DOWNLOAD_ROOT = download_root
    os.makedirs(DOWNLOAD_ROOT, exist_ok=True)
    FFMPEG_LOCATION = ffmpeg_location
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
    }


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
    outtmpl = os.path.join(job_dir, "%(title).200B.%(ext)s")

    is_audio_only = output_format in AUDIO_ONLY_FORMATS
    has_ffmpeg = bool(FFMPEG_LOCATION)

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": outtmpl,
        "postprocessors": [],
    }
    if FFMPEG_LOCATION:
        ydl_opts["ffmpeg_location"] = FFMPEG_LOCATION

    if format_id:
        ydl_opts["format"] = format_id
    elif is_audio_only:
        ydl_opts["format"] = "bestaudio/best"
    elif not has_ffmpeg:
        # No ffmpeg on this device: pick a single stream that already has
        # both video and audio, since merging separate streams needs ffmpeg.
        cap = f"[height<={height}]" if height else ""
        ydl_opts["format"] = f"best{cap}[vcodec!=none][acodec!=none]/best{cap}"
    elif height:
        ydl_opts["format"] = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]"
    else:
        ydl_opts["format"] = "bestvideo+bestaudio/best"

    if has_ffmpeg:
        if is_audio_only:
            ydl_opts["postprocessors"].append(
                {"key": "FFmpegExtractAudio", "preferredcodec": output_format}
            )
        else:
            ydl_opts["merge_output_format"] = output_format
            ydl_opts["postprocessors"].append(
                {"key": "FFmpegVideoConvertor", "preferedformat": output_format}
            )

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise

    files = [f for f in os.listdir(job_dir) if not f.endswith((".part", ".ytdl"))]
    if not files:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise RuntimeError("Download failed: no output file produced")

    matching = [f for f in files if f.lower().endswith(f".{output_format}")]
    chosen = matching[0] if matching else files[0]
    return os.path.join(job_dir, chosen)


def cleanup_job(file_path: str) -> None:
    job_dir = os.path.dirname(file_path)
    if DOWNLOAD_ROOT and os.path.commonpath([job_dir, DOWNLOAD_ROOT]) == DOWNLOAD_ROOT:
        shutil.rmtree(job_dir, ignore_errors=True)


_MIME_TYPES = {
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mkv": "video/x-matroska",
    "mov": "video/quicktime",
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "wav": "audio/wav",
    "aac": "audio/aac",
    "opus": "audio/opus",
    "flac": "audio/flac",
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
