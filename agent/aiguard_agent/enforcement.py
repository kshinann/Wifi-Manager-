"""OS-level enforcement: hosts-file blocking, terminating apps and user notifications."""

import logging
import os
import subprocess
import sys
import time
from pathlib import Path

log = logging.getLogger(__name__)

BEGIN = "# BEGIN AIGUARD (managed by AI Guard agent, do not edit)"
END = "# END AIGUARD"


def hosts_path() -> Path:
    if sys.platform == "win32":
        return Path(os.getenv("SystemRoot", r"C:\Windows")) / "System32" / "drivers" / "etc" / "hosts"
    return Path("/etc/hosts")


def render_hosts(original: str, domains: list[str]) -> str:
    """Return hosts content with the managed block replaced by entries for domains."""
    lines, inside = [], False
    for line in original.splitlines():
        if line.strip() == BEGIN:
            inside = True
            continue
        if line.strip() == END:
            inside = False
            continue
        if not inside:
            lines.append(line)
    while lines and not lines[-1].strip():
        lines.pop()
    if domains:
        lines += ["", BEGIN]
        for domain in sorted(set(domains)):
            lines.append(f"0.0.0.0 {domain}")
            if not domain.startswith("www."):
                lines.append(f"0.0.0.0 www.{domain}")
        lines.append(END)
    return "\n".join(lines) + "\n"


class HostsBlocker:
    def __init__(self, path: Path | None = None):
        self.path = path or hosts_path()
        self._applied: list[str] | None = None

    def apply(self, domains: list[str]) -> None:
        domains = sorted(set(domains))
        if domains == self._applied:
            return
        try:
            original = self.path.read_text(encoding="utf-8", errors="ignore")
            updated = render_hosts(original, domains)
            if updated != original:
                self.path.write_text(updated, encoding="utf-8")
                flush_dns()
            self._applied = domains
            log.info("hosts file now blocks %d domains", len(domains))
        except PermissionError:
            log.warning("cannot write %s; run the agent as Administrator/root to enable network blocking", self.path)
            self._applied = domains  # do not retry every tick


def flush_dns() -> None:
    commands = (
        [["ipconfig", "/flushdns"]] if sys.platform == "win32"
        else [["dscacheutil", "-flushcache"], ["killall", "-HUP", "mDNSResponder"]] if sys.platform == "darwin"
        else []
    )
    for cmd in commands:
        subprocess.run(cmd, capture_output=True, timeout=10, check=False)


def terminate(processes) -> int:
    """Terminate psutil processes, escalating to kill after a grace period."""
    import psutil

    alive = []
    for proc in processes:
        try:
            proc.terminate()
            alive.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    _, still_alive = psutil.wait_procs(alive, timeout=3)
    for proc in still_alive:
        try:
            proc.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return len(alive)


class Notifier:
    """Shows a desktop message to the logged-in user, rate limited per key."""

    def __init__(self, cooldown_seconds: int = 600):
        self.cooldown = cooldown_seconds
        self._last: dict[str, float] = {}

    def notify(self, key: str, title: str, message: str) -> None:
        now = time.monotonic()
        if now - self._last.get(key, -1e9) < self.cooldown:
            return
        self._last[key] = now
        try:
            if sys.platform == "win32":
                # Works from a SYSTEM service on Windows Pro/Enterprise; delivered to every interactive session.
                subprocess.run(["msg", "*", "/TIME:30", f"{title}\n\n{message}"], capture_output=True, timeout=10,
                               check=False)
            elif sys.platform == "darwin":
                script = f'display notification {_osa(message)} with title {_osa(title)}'
                cmd = ["osascript", "-e", script]
                uid = _console_uid()
                if os.geteuid() == 0 and uid:
                    cmd = ["launchctl", "asuser", str(uid)] + cmd
                subprocess.run(cmd, capture_output=True, timeout=10, check=False)
            else:
                subprocess.run(["notify-send", title, message], capture_output=True, timeout=10, check=False)
        except (OSError, subprocess.SubprocessError) as exc:
            log.debug("notification failed: %s", exc)


def _osa(text: str) -> str:
    return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _console_uid() -> int | None:
    try:
        return os.stat("/dev/console").st_uid
    except OSError:
        return None
