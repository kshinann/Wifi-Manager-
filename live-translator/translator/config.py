"""Settings: engines, API keys, routes (input -> language channels -> outputs).

Saved as JSON in data/config.json (git-ignored, because it holds API keys).
"""
import copy
import json
import os
import threading
from pathlib import Path

DATA_DIR = Path(os.environ.get("LT_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))

DEFAULTS = {
    "engines": {
        # asr: local | openai      translate: local | openai | claude      tts: edge | local | openai
        "asr": "local",
        "translate": "local",
        "tts": "edge",
    },
    "local": {
        "device": "auto",            # auto | cuda | cpu
        "whisper_model": "auto",     # auto | tiny | base | small | medium | large-v3 | large-v3-turbo
        "nllb_model": "facebook/nllb-200-distilled-600M",
    },
    "cloud": {
        "openai_asr_model": "whisper-1",
        "openai_translate_model": "gpt-4o-mini",
        "openai_tts_model": "tts-1",
        "openai_tts_voice": "alloy",
        "claude_model": "claude-opus-5-5",
        "claude_effort": "low",      # low keeps translation latency down
    },
    "api_keys": {"openai": "", "anthropic": ""},
    "vad": {"silence_ms": 700, "max_segment_s": 12, "min_rms": 0.008},
    "admin_token": "",
    "allowed_languages": [],  # e.g. ["en", "zh"] to show only these in the panel (empty = all)
    "glossary": "",  # optional "term = 翻译" lines passed to AI translators
    "routes": [
        {
            "id": "main",
            "name": "Main hall (English speaker)",
            "enabled": True,
            "input": {"type": "device", "device": None},   # None = system default input
            "source_lang": "en",                           # or "auto"
            "channels": [
                {"id": "main-zh", "target_lang": "zh", "voice": "", "speak": True,
                 "web": True, "outputs": []},
            ],
        }
    ],
}

SECRET_PLACEHOLDER = "********"


def _merge(base, override):
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


class ConfigStore:
    def __init__(self, path=None, preset=None):
        """`preset`: JSON file used as the starting settings the first time (no config yet)."""
        self.path = Path(path) if path else DATA_DIR / "config.json"
        self._lock = threading.Lock()
        self._data = self._load()
        if preset and not self.path.exists():
            data = json.loads(Path(preset).read_text(encoding="utf-8"))
            self.update(data)

    def _load(self):
        data = DEFAULTS
        if self.path.exists():
            try:
                data = _merge(DEFAULTS, json.loads(self.path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass
        data = copy.deepcopy(data)
        # environment variables fill in keys that were not typed into the UI
        for name, env in (("openai", "OPENAI_API_KEY"), ("anthropic", "ANTHROPIC_API_KEY")):
            if not data["api_keys"].get(name) and os.environ.get(env):
                data["api_keys"][name] = os.environ[env]
        return data

    def get(self):
        with self._lock:
            return copy.deepcopy(self._data)

    def public(self):
        """Config safe to send to the browser: secrets replaced by a placeholder."""
        d = self.get()
        d["api_keys"] = {k: (SECRET_PLACEHOLDER if v else "") for k, v in d["api_keys"].items()}
        d["admin_token"] = SECRET_PLACEHOLDER if d.get("admin_token") else ""
        return d

    def update(self, incoming):
        incoming = copy.deepcopy(incoming or {})
        with self._lock:
            current = self._data
            keys = incoming.pop("api_keys", None) or {}
            token = incoming.pop("admin_token", None)
            routes = incoming.pop("routes", None)
            new = _merge(current, incoming)
            for name, value in keys.items():
                if value == SECRET_PLACEHOLDER:
                    continue  # unchanged
                new["api_keys"][name] = (value or "").strip()
            if token is not None and token != SECRET_PLACEHOLDER:
                new["admin_token"] = token.strip()
            if routes is not None:
                new["routes"] = validate_routes(routes)
            self._data = new
            self._save()
            return copy.deepcopy(new)

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)


def validate_routes(routes):
    from .languages import LANGUAGES

    if not isinstance(routes, list):
        raise ValueError("routes must be a list")
    seen_routes, seen_channels, clean = set(), set(), []
    for r in routes:
        rid = str(r.get("id") or "").strip()
        if not rid or rid in seen_routes:
            raise ValueError(f"route id missing or duplicated: {rid!r}")
        seen_routes.add(rid)
        src = r.get("source_lang", "auto")
        if src != "auto" and src not in LANGUAGES:
            raise ValueError(f"unknown source language {src!r}")
        inp = r.get("input") or {}
        itype = inp.get("type", "device")
        if itype not in ("device", "browser"):
            raise ValueError(f"unknown input type {itype!r}")
        channels = []
        for c in r.get("channels") or []:
            cid = str(c.get("id") or "").strip()
            if not cid or cid in seen_channels:
                raise ValueError(f"channel id missing or duplicated: {cid!r}")
            seen_channels.add(cid)
            if c.get("target_lang") not in LANGUAGES:
                raise ValueError(f"unknown target language {c.get('target_lang')!r}")
            channels.append({
                "id": cid,
                "target_lang": c["target_lang"],
                "voice": str(c.get("voice") or ""),
                "speak": bool(c.get("speak", True)),
                "web": bool(c.get("web", True)),
                "outputs": [int(o) for o in (c.get("outputs") or [])],
                # matched by name at start, so presets work on any PC (e.g. "CABLE Input")
                "output_names": [str(n).strip() for n in (c.get("output_names") or []) if str(n).strip()],
            })
        clean.append({
            "id": rid,
            "name": str(r.get("name") or rid),
            "enabled": bool(r.get("enabled", True)),
            "input": {"type": itype,
                      "device": None if inp.get("device") in (None, "") else int(inp["device"])},
            "source_lang": src,
            "channels": channels,
        })
    return clean
