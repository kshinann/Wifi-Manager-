"""Aggregates usage ticks into session events so the server gets one row per stretch of use."""

import threading
import time
from dataclasses import dataclass, field


@dataclass
class _Session:
    tool_key: str
    source: str
    started_wall: float
    last_tick: float
    seconds: float = 0.0
    meta: dict = field(default_factory=dict)


class SessionTracker:
    def __init__(self, emit, idle_timeout: float = 120.0, max_chunk: float = 900.0):
        """emit(**event_fields) is called for each finished or chunked session."""
        self._emit = emit
        self.idle_timeout = idle_timeout
        self.max_chunk = max_chunk
        self._sessions: dict[tuple[str, str], _Session] = {}
        self._lock = threading.Lock()

    def tick(self, tool_key: str, source: str, seconds: float, now: float | None = None, **meta) -> None:
        now = now if now is not None else time.monotonic()
        with self._lock:
            key = (tool_key, source)
            session = self._sessions.get(key)
            if session is None:
                session = _Session(tool_key, source, started_wall=time.time(), last_tick=now)
                self._sessions[key] = session
            session.seconds += seconds
            session.last_tick = now
            session.meta.update({k: v for k, v in meta.items() if v})

    def flush(self, now: float | None = None, force: bool = False) -> int:
        """Emit sessions that went idle (or are long enough to chunk). Returns the number emitted."""
        now = now if now is not None else time.monotonic()
        emitted = []
        with self._lock:
            for key, session in list(self._sessions.items()):
                idle = now - session.last_tick >= self.idle_timeout
                if force or idle or session.seconds >= self.max_chunk:
                    emitted.append(session)
                    if idle or force:
                        del self._sessions[key]
                    else:
                        # Keep the session open but start a fresh chunk.
                        self._sessions[key] = _Session(session.tool_key, session.source, started_wall=time.time(),
                                                       last_tick=session.last_tick, meta=dict(session.meta))
        for s in emitted:
            if s.seconds < 1:
                continue
            self._emit(tool_key=s.tool_key, source=s.source, event_type="session", action="allowed",
                       duration_seconds=int(round(s.seconds)), domain=s.meta.get("domain", ""),
                       process_name=s.meta.get("process_name", ""), url=s.meta.get("url", ""))
        return len(emitted)
