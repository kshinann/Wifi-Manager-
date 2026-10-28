"""Detects running AI desktop apps (ChatGPT, Claude, Cursor, Ollama, ...) by process name."""

import logging
from collections import defaultdict

log = logging.getLogger(__name__)


def scan_ai_processes(matcher) -> dict[str, list]:
    """Return {tool_key: [psutil.Process, ...]} for running processes that match the catalog."""
    import psutil

    found: dict[str, list] = defaultdict(list)
    for proc in psutil.process_iter(["name"]):
        name = proc.info.get("name") or ""
        key = matcher.match_process(name)
        if key:
            found[key].append(proc)
    return found


def process_user(processes) -> str:
    for proc in processes:
        try:
            return proc.username() or ""
        except Exception:  # AccessDenied / NoSuchProcess
            continue
    return ""
