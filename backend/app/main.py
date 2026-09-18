"""FastAPI app exposing video info lookup and download endpoints, plus the static frontend."""

import os
import sys
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import downloader, settings_store

app = FastAPI(title="Video Downloader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class InfoRequest(BaseModel):
    url: str


class SearchRequest(BaseModel):
    query: str
    limit: int = Field(12, ge=1, le=25)


class DownloadRequest(BaseModel):
    url: str
    format: str = Field(..., description="Desired output format/container, e.g. mp4, webm, mp3")
    height: Optional[int] = Field(None, description="Max vertical resolution, e.g. 1080")
    format_id: Optional[str] = Field(None, description="Specific yt-dlp format id to use")


class SettingsRequest(BaseModel):
    cookies_browser: Optional[str] = Field(
        None, description="Browser to pull login cookies from, or null to disable"
    )


@app.get("/api/settings")
def get_settings():
    return settings_store.get_settings()


@app.post("/api/settings")
def update_settings(payload: SettingsRequest):
    if payload.cookies_browser and payload.cookies_browser not in settings_store.SUPPORTED_BROWSERS:
        raise HTTPException(status_code=422, detail=f"Unsupported browser: {payload.cookies_browser}")
    return settings_store.save_settings({"cookies_browser": payload.cookies_browser})


@app.post("/api/info")
def get_info(payload: InfoRequest):
    cookies_browser = settings_store.get_settings().get("cookies_browser")
    try:
        return downloader.fetch_info(payload.url, cookies_browser)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_friendly_error(exc, cookies_browser))


@app.post("/api/search")
def search(payload: SearchRequest):
    try:
        return {"results": downloader.search_videos(payload.query, payload.limit)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _friendly_error(exc: Exception, cookies_browser: Optional[str]) -> str:
    message = str(exc)
    if cookies_browser and ("cookie" in message.lower() or "could not find" in message.lower()):
        return (
            f"{message}\n\nCouldn't read cookies from {cookies_browser}. Make sure it's installed "
            "on this computer and you're logged in to the site there (fully quit the browser first "
            "on some OSes, since it may lock its cookie database while running)."
        )
    return message


@app.post("/api/download")
def download(payload: DownloadRequest, background_tasks: BackgroundTasks):
    cookies_browser = settings_store.get_settings().get("cookies_browser")
    try:
        file_path = downloader.download_media(
            payload.url, payload.format, payload.height, payload.format_id, cookies_browser
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_friendly_error(exc, cookies_browser))

    background_tasks.add_task(downloader.cleanup_job, file_path)
    return FileResponse(
        file_path,
        filename=os.path.basename(file_path),
        media_type="application/octet-stream",
    )


if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    # Running as a PyInstaller-bundled executable (see desktop/) — resources
    # are unpacked under sys._MEIPASS instead of living next to this file.
    _FRONTEND_DIR = os.path.join(sys._MEIPASS, "frontend")
else:
    _FRONTEND_DIR = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
    )
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
