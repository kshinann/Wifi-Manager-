"""Local SQLite store: event outbox (survives offline periods), daily usage counters and the cached config."""

import json
import sqlite3
import threading
import uuid
from datetime import date, datetime, timezone
from pathlib import Path


class Store:
    def __init__(self, path: Path):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, tool TEXT NOT NULL, seconds REAL NOT NULL,
                                              PRIMARY KEY (day, tool));
            CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            """
        )
        self._db.commit()

    # --- events -------------------------------------------------------------

    def add_event(self, **fields) -> dict:
        event = {"id": uuid.uuid4().hex, "occurred_at": datetime.now(timezone.utc).isoformat(), **fields}
        with self._lock:
            self._db.execute("INSERT INTO outbox (id, payload, created) VALUES (?, ?, ?)",
                             (event["id"], json.dumps(event), datetime.now().timestamp()))
            self._db.commit()
        return event

    def pending_events(self, limit: int = 200) -> list[dict]:
        with self._lock:
            rows = self._db.execute("SELECT payload FROM outbox ORDER BY created LIMIT ?", (limit,)).fetchall()
        return [json.loads(r[0]) for r in rows]

    def ack_events(self, ids: list[str]) -> None:
        with self._lock:
            self._db.executemany("DELETE FROM outbox WHERE id = ?", [(i,) for i in ids])
            self._db.commit()

    def outbox_size(self) -> int:
        with self._lock:
            return self._db.execute("SELECT COUNT(*) FROM outbox").fetchone()[0]

    # --- usage counters (device local day) -----------------------------------

    def add_usage(self, tool: str, seconds: float, day: date | None = None) -> None:
        day_s = (day or date.today()).isoformat()
        with self._lock:
            self._db.execute(
                "INSERT INTO usage (day, tool, seconds) VALUES (?, ?, ?) "
                "ON CONFLICT(day, tool) DO UPDATE SET seconds = seconds + excluded.seconds",
                (day_s, tool, seconds),
            )
            self._db.commit()

    def usage_today(self, day: date | None = None) -> dict[str, float]:
        day_s = (day or date.today()).isoformat()
        with self._lock:
            rows = self._db.execute("SELECT tool, seconds FROM usage WHERE day = ?", (day_s,)).fetchall()
        return {tool: seconds for tool, seconds in rows}

    def prune_usage(self, keep_days: int = 14) -> None:
        cutoff = date.fromordinal(date.today().toordinal() - keep_days).isoformat()
        with self._lock:
            self._db.execute("DELETE FROM usage WHERE day < ?", (cutoff,))
            self._db.commit()

    # --- key/value ----------------------------------------------------------

    def get_json(self, key: str, default=None):
        with self._lock:
            row = self._db.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def set_json(self, key: str, value) -> None:
        with self._lock:
            self._db.execute("INSERT INTO kv (key, value) VALUES (?, ?) "
                             "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (key, json.dumps(value)))
            self._db.commit()
