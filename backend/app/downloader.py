"""Video/audio fetching and downloading helpers built on top of yt-dlp."""

import os
import shutil
import tempfile
import uuid
from typing import Optional

import yt_dlp

DOWNLOAD_ROOT = os.path.join(tempfile.gettempdir(), "video_downloader_jobs")
os.makedirs(DOWNLOAD_ROOT, exist_ok=True)

AUDIO_ONLY_FORMATS = {"mp3", "m4a", "wav", "aac", "opus", "flac"}
VIDEO_CONTAINERS = {"mp4", "mkv", "webm", "mov"}


def fetch_info(url: str) -> dict:
    """Return metadata and available formats for a video URL, without downloading it."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if "entries" in info:
        # Playlist / channel URL: only support single videos, use the first entry.
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
    """Download the media at `url`, converting it to `output_format`. Returns the local file path."""
    output_format = output_format.lower()
    if output_format not in AUDIO_ONLY_FORMATS and output_format not in VIDEO_CONTAINERS:
        raise ValueError(f"Unsupported output format: {output_format}")

    job_dir = os.path.join(DOWNLOAD_ROOT, uuid.uuid4().hex)
    os.makedirs(job_dir, exist_ok=True)
    outtmpl = os.path.join(job_dir, "%(title).200B.%(ext)s")

    is_audio_only = output_format in AUDIO_ONLY_FORMATS

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "outtmpl": outtmpl,
        "postprocessors": [],
    }

    if format_id:
        ydl_opts["format"] = format_id
    elif is_audio_only:
        ydl_opts["format"] = "bestaudio/best"
    elif height:
        ydl_opts["format"] = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]"
    else:
        ydl_opts["format"] = "bestvideo+bestaudio/best"

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
    """Remove the temporary job directory for a completed/failed download."""
    job_dir = os.path.dirname(file_path)
    if os.path.commonpath([job_dir, DOWNLOAD_ROOT]) == DOWNLOAD_ROOT:
        shutil.rmtree(job_dir, ignore_errors=True)
