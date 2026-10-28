"""Loopback HTTP API used by the browser extension (127.0.0.1 only).

Every request must carry the X-AIGuard-Client header. Web pages cannot add it cross-origin without a
CORS preflight, and preflights are only answered for extension origins. Chrome omits Origin on extension
GETs, so a missing Origin is accepted there; POSTs (which record events) must come from an extension
origin, restricted to allowed_extension_ids when configured.
"""

import json
import logging
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .config import LOCAL_API_PORT

log = logging.getLogger(__name__)

EXTENSION_SCHEMES = ("chrome-extension://", "extension://", "moz-extension://")
MAX_BODY = 256 * 1024
CLIENT_HEADER = "X-AIGuard-Client"


def origin_allowed(origin: str | None, allowed_ids: tuple[str, ...]) -> bool:
    if not origin or not origin.startswith(EXTENSION_SCHEMES):
        return False
    if not allowed_ids:
        return True
    ext_id = origin.split("://", 1)[1].strip("/")
    return ext_id in allowed_ids


def make_handler(agent, allowed_ids: tuple[str, ...]):
    class Handler(BaseHTTPRequestHandler):
        server_version = "AIGuardAgent"

        def log_message(self, fmt, *args):  # route to logging instead of stderr
            log.debug("local api: " + fmt, *args)

        def _send(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            origin = self.headers.get("Origin")
            if origin_allowed(origin, allowed_ids):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def _authorized(self, require_origin: bool) -> bool:
            origin = self.headers.get("Origin")
            ok = bool(self.headers.get(CLIENT_HEADER)) and (
                origin_allowed(origin, allowed_ids) if (origin or require_origin) else True)
            if not ok:
                self._send(403, {"error": "forbidden"})
            return ok

        def _body(self) -> dict:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                raise ValueError("body too large")
            return json.loads(self.rfile.read(length) or b"{}")

        def do_OPTIONS(self):
            if not origin_allowed(self.headers.get("Origin"), allowed_ids):
                self._send(403, {"error": "forbidden"})
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", self.headers["Origin"])
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", f"Content-Type, {CLIENT_HEADER}")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()

        def do_GET(self):
            if not self._authorized(require_origin=False):
                return
            if self.path == "/v1/status":
                self._send(200, agent.status())
            elif self.path == "/v1/policy":
                agent.extension_seen_at = time.monotonic()
                decisions = {t["key"]: agent.decide(t["key"]).to_dict() for t in agent.tools}
                self._send(200, {"status": agent.status(), "policy": agent.policy, "tools": agent.tools,
                                 "decisions": decisions, "usage_today": agent.store.usage_today()})
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self):
            if not self._authorized(require_origin=True):
                return
            try:
                body = self._body()
                tool_key = str(body.get("tool_key", ""))
                if not tool_key:
                    raise ValueError("tool_key is required")
                domain, url = str(body.get("domain", ""))[:255], str(body.get("url", ""))[:4000]
                if self.path == "/v1/visit":
                    result = agent.handle_visit(tool_key, domain, url)
                elif self.path == "/v1/activity":
                    result = agent.handle_activity(tool_key, float(body.get("seconds", 0)), domain, url)
                elif self.path == "/v1/prompt":
                    text = body.get("text")
                    chars = body.get("chars")
                    result = agent.handle_prompt(tool_key, domain, url,
                                                 text=str(text)[:100_000] if text is not None else None,
                                                 chars=int(chars) if chars is not None else None)
                else:
                    self._send(404, {"error": "not found"})
                    return
            except (ValueError, TypeError) as exc:
                self._send(400, {"error": str(exc)})
                return
            self._send(200, result)

    return Handler


def serve(agent, allowed_ids: tuple[str, ...] = (), port: int = LOCAL_API_PORT) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(agent, allowed_ids))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, name="local-api", daemon=True).start()
    log.info("local API listening on 127.0.0.1:%d", port)
    return server
