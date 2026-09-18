"""Tiny persisted key-value store for desktop-only user preferences.

Currently holds just the browser to pull cookies from for sites that need a
login (see downloader.py). Not used by the mobile app — there's no browser
to borrow cookies from on-device, and no server to persist settings on.
"""

import json
import os

# yt-dlp's supported --cookies-from-browser values.
SUPPORTED_BROWSERS = {
    "brave",
    "chrome",
    "chromium",
    "edge",
    "firefox",
    "opera",
    "safari",
    "vivaldi",
    "whale",
}

_SETTINGS_PATH = os.path.join(os.path.expanduser("~"), ".utube-download", "settings.json")

_DEFAULTS = {"cookies_browser": None}


def get_settings() -> dict:
    try:
        with open(_SETTINGS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return dict(_DEFAULTS)
    return {**_DEFAULTS, **data}


def save_settings(updates: dict) -> dict:
    current = get_settings()
    current.update(updates)
    os.makedirs(os.path.dirname(_SETTINGS_PATH), exist_ok=True)
    with open(_SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f)
    return current
