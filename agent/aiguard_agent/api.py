"""Minimal HTTPS client for the AI Guard server (stdlib only)."""

import json
import ssl
import urllib.error
import urllib.request


class ApiError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(f"{status}: {detail}")
        self.status = status


class ServerClient:
    def __init__(self, server_url: str, device_token: str = "", timeout: float = 15.0):
        self.base = server_url.rstrip("/")
        self.token = device_token
        self.timeout = timeout
        self._ssl = ssl.create_default_context()

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.token:
            req.add_header("Authorization", f"Bearer {self.token}")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self._ssl) as resp:
                return json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read()).get("detail", exc.reason)
            except ValueError:
                detail = exc.reason
            raise ApiError(exc.code, str(detail)) from exc

    def enroll(self, enrollment_token: str, **device) -> dict:
        return self._request("POST", "/api/agent/enroll", {"enrollment_token": enrollment_token, **device})

    def config(self) -> dict:
        return self._request("GET", "/api/agent/config")

    def heartbeat(self, **info) -> dict:
        return self._request("POST", "/api/agent/heartbeat", info)

    def send_events(self, events: list[dict]) -> dict:
        return self._request("POST", "/api/agent/events", {"events": events})
