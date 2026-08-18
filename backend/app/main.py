"""FastAPI app exposing video info lookup and download endpoints, plus the static frontend."""

import os
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import downloader

app = FastAPI(title="Video Downloader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class InfoRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    format: str = Field(..., description="Desired output format/container, e.g. mp4, webm, mp3")
    height: Optional[int] = Field(None, description="Max vertical resolution, e.g. 1080")
    format_id: Optional[str] = Field(None, description="Specific yt-dlp format id to use")


@app.post("/api/info")
def get_info(payload: InfoRequest):
    try:
        return downloader.fetch_info(payload.url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/download")
def download(payload: DownloadRequest, background_tasks: BackgroundTasks):
    try:
        file_path = downloader.download_media(
            payload.url, payload.format, payload.height, payload.format_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    background_tasks.add_task(downloader.cleanup_job, file_path)
    return FileResponse(
        file_path,
        filename=os.path.basename(file_path),
        media_type="application/octet-stream",
    )


_FRONTEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
)
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
