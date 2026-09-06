"""Stdlib-only HTTP server exposing the video-downloader API on 127.0.0.1.

Deliberately avoids FastAPI/uvicorn/pydantic here: those pull in compiled
extensions (pydantic-core in particular) that may not have prebuilt Android
wheels, whereas everything below is Python standard library plus yt-dlp
(pure Python), which Chaquopy can install for Android without issue.
"""

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import downloader

HOST = "127.0.0.1"

_server = None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        return json.loads(raw or b"{}")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:
        try:
            if self.path == "/api/search":
                payload = self._read_json()
                results = downloader.search_videos(payload.get("query", ""), payload.get("limit", 12))
                self._send_json(200, {"results": results})
            elif self.path == "/api/info":
                payload = self._read_json()
                self._send_json(200, downloader.fetch_info(payload["url"]))
            elif self.path == "/api/download":
                self._handle_download(self._read_json())
            else:
                self._send_json(404, {"detail": "Not found"})
        except Exception as exc:
            self._send_json(400, {"detail": str(exc)})

    def _handle_download(self, payload: dict) -> None:
        file_path = downloader.download_media(
            payload["url"],
            payload["format"],
            payload.get("height"),
            payload.get("format_id"),
        )
        try:
            mime_type = downloader.mime_type_for(payload["format"])
            saved_as = downloader.save_to_downloads(file_path, mime_type)
            self._send_json(200, {"saved_as": saved_as})
        finally:
            downloader.cleanup_job(file_path)

    def log_message(self, format, *args):  # noqa: A002 - matches base class signature
        pass


def start(port: int = 8765) -> None:
    global _server
    if _server is not None:
        return
    _server = ThreadingHTTPServer((HOST, port), Handler)
    thread = threading.Thread(target=_server.serve_forever, daemon=True)
    thread.start()
