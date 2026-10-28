"""The agent: pulls policy, watches for AI usage, enforces policy and uploads events."""

import logging
import os
import platform
import sys
import threading
import time
from datetime import datetime

from . import __version__
from .api import ApiError, ServerClient
from .catalog import ToolMatcher, current_os
from .config import AgentConfig
from .dlp import scan
from .enforcement import HostsBlocker, Notifier, terminate
from .monitors.network import NetworkMonitor, is_extension_browser
from .monitors.process import process_user, scan_ai_processes
from .policy import decide
from .sessions import SessionTracker
from .store import Store

log = logging.getLogger(__name__)

# Used before the first successful policy download: observe only.
FALLBACK_POLICY = {
    "default_action": "allow", "tool_rules": [], "daily_minutes_total": None, "schedule": None,
    "capture_prompts": False, "prompt_retention_days": 30,
    "dlp": {"enabled": False, "detectors": [], "keywords": [], "action": "log"},
    "monitor_processes": True, "monitor_network": True, "enforce_processes": False, "enforce_hosts_file": False,
    "warn_message": "", "block_message": "",
}

ACTION_TO_EVENT = {"allow": ("visit", "allowed"), "warn": ("warned", "warned"), "block": ("blocked", "blocked")}
DLP_ACTION = {"log": "allow", "warn": "warn", "block": "block"}
EXTENSION_ALIVE_SECONDS = 120
NETWORK_DEDUP_SECONDS = 3600


def console_user() -> str:
    try:
        if sys.platform == "darwin":
            import pwd
            return pwd.getpwuid(os.stat("/dev/console").st_uid).pw_name
        import psutil
        users = psutil.users()
        return users[0].name if users else ""
    except Exception:
        return ""


class Agent:
    def __init__(self, config: AgentConfig, store: Store, notifier: Notifier | None = None,
                 hosts: HostsBlocker | None = None, client: ServerClient | None = None):
        self.config = config
        self.store = store
        self.client = client or ServerClient(config.server_url, config.device_token)
        self.notifier = notifier or Notifier()
        self.hosts = hosts or HostsBlocker()
        self.network = NetworkMonitor()
        self.sessions = SessionTracker(self.record)
        self.stop_event = threading.Event()
        self._lock = threading.RLock()
        self.extension_seen_at = 0.0
        self._network_seen: dict[tuple[str, str], float] = {}
        self._browser_tools_seen: dict[str, float] = {}
        self._warned_processes: set[str] = set()
        self.last_sync_error = ""
        self._apply_config(store.get_json("config") or {})

    # --- configuration ------------------------------------------------------

    def _apply_config(self, cfg: dict) -> None:
        with self._lock:
            self.policy = cfg.get("policy") or FALLBACK_POLICY
            self.policy_version = cfg.get("policy_version", "")
            self.tools = cfg.get("tools") or []
            self.matcher = ToolMatcher(self.tools)

    def refresh_config(self) -> None:
        try:
            cfg = self.client.config()
        except (ApiError, OSError) as exc:
            self.last_sync_error = str(exc)
            log.warning("policy refresh failed, keeping cached policy: %s", exc)
            return
        if cfg.get("policy_version") != self.policy_version:
            log.info("policy updated to %s", cfg.get("policy_version"))
        self.store.set_json("config", cfg)
        self._apply_config(cfg)

    # --- helpers ------------------------------------------------------------

    def record(self, **fields) -> dict:
        fields.setdefault("os_user", console_user())
        return self.store.add_event(**fields)

    def decide(self, tool_key: str):
        return decide(self.policy, tool_key, datetime.now(), self.store.usage_today())

    def status(self) -> dict:
        dlp = self.policy.get("dlp") or {}
        return {
            "enrolled": self.config.enrolled, "tenant": self.config.tenant_name, "device_id": self.config.device_id,
            "agent_version": __version__, "policy_version": self.policy_version,
            "capture_prompts": bool(self.policy.get("capture_prompts")), "dlp_enabled": bool(dlp.get("enabled")),
            "outbox": self.store.outbox_size(), "last_sync_error": self.last_sync_error,
        }

    # --- browser extension handlers -------------------------------------------

    def handle_visit(self, tool_key: str, domain: str = "", url: str = "") -> dict:
        self.extension_seen_at = time.monotonic()
        self._browser_tools_seen[tool_key] = time.monotonic()
        d = self.decide(tool_key)
        event_type, action = ACTION_TO_EVENT[d.action]
        self.record(tool_key=tool_key, source="browser", event_type=event_type, action=action, reason=d.reason,
                    domain=domain, url=url)
        return {**d.to_dict(), "tool_name": self.matcher.name(tool_key)}

    def handle_activity(self, tool_key: str, seconds: float, domain: str = "", url: str = "") -> dict:
        """Called while an AI tab is focused. Returns the decision so the tab can be blocked mid-session."""
        self.extension_seen_at = time.monotonic()
        self._browser_tools_seen[tool_key] = time.monotonic()
        seconds = max(0.0, min(float(seconds), 60.0))
        before = self.decide(tool_key)
        if before.action != "block":
            self.store.add_usage(tool_key, seconds)
            self.sessions.tick(tool_key, "browser", seconds, domain=domain)
        after = self.decide(tool_key)
        if after.action == "block" and before.action != "block":
            self.record(tool_key=tool_key, source="browser", event_type="blocked", action="blocked",
                        reason=after.reason, domain=domain, url=url)
        return {**after.to_dict(), "tool_name": self.matcher.name(tool_key)}

    def handle_prompt(self, tool_key: str, domain: str = "", url: str = "", text: str | None = None,
                      chars: int | None = None) -> dict:
        self.extension_seen_at = time.monotonic()
        dlp = self.policy.get("dlp") or {}
        hits = scan(text, dlp.get("detectors", []), dlp.get("keywords", [])) if text and dlp.get("enabled") else []
        action = DLP_ACTION[dlp.get("action", "log")] if hits else "allow"
        # A prompt on a tool that is blocked or over quota is blocked too.
        tool_decision = self.decide(tool_key)
        if tool_decision.action == "block":
            action = "block"
        capture = bool(self.policy.get("capture_prompts"))
        self.record(
            tool_key=tool_key, source="browser", event_type="dlp" if hits else "prompt",
            action=ACTION_TO_EVENT[action][1], reason=("sensitive data: " + ", ".join(hits)) if hits else "",
            domain=domain, url=url, prompt_chars=len(text) if text is not None else chars,
            prompt_text=text if capture else None, dlp_hits=hits,
        )
        message = ""
        if hits and action != "allow":
            message = f"Your prompt appears to contain sensitive data ({', '.join(hits)})."
        elif action == "block":
            message = tool_decision.message
        return {"action": action, "hits": hits, "message": message}

    # --- monitors -------------------------------------------------------------

    def process_tick(self, interval: float) -> None:
        if not self.policy.get("monitor_processes", True):
            return
        found = scan_ai_processes(self.matcher)
        for tool_key in list(self._warned_processes):
            if tool_key not in found:
                self._warned_processes.discard(tool_key)
        for tool_key, procs in found.items():
            name = _first_name(procs)
            d = self.decide(tool_key)
            if d.action == "block" and self.policy.get("enforce_processes", True):
                user = process_user(procs)
                killed = terminate(procs)
                if killed:
                    self.record(tool_key=tool_key, source="process", event_type="blocked", action="blocked",
                                reason=d.reason, process_name=name, os_user=user or console_user())
                    self.notifier.notify(f"block:{tool_key}", f"{self.matcher.name(tool_key)} was closed",
                                         d.message or d.reason)
                continue
            if d.action == "warn" and tool_key not in self._warned_processes:
                self._warned_processes.add(tool_key)
                self.record(tool_key=tool_key, source="process", event_type="warned", action="warned",
                            reason=d.reason, process_name=name)
                self.notifier.notify(f"warn:{tool_key}", self.matcher.name(tool_key), d.message or d.reason)
            self.store.add_usage(tool_key, interval)
            self.sessions.tick(tool_key, "process", interval, process_name=name)

    def network_tick(self) -> None:
        if not self.policy.get("monitor_network", True):
            return
        domains = sorted({d for t in self.tools for d in t.get("domains", [])})
        observed = list(self.network.connections(domains))
        observed += [(name, "") for name in self.network.dns_cache_names() if self.matcher.match_domain(name)]
        now = time.monotonic()
        extension_alive = now - self.extension_seen_at < EXTENSION_ALIVE_SECONDS
        for domain, proc_name in observed:
            tool_key = self.matcher.match_domain(domain)
            if not tool_key:
                continue
            if extension_alive and (is_extension_browser(proc_name) or
                                    (not proc_name and now - self._browser_tools_seen.get(tool_key, -1e9) < 3600)):
                continue  # already reported by the browser extension
            key = (tool_key, proc_name)
            if now - self._network_seen.get(key, -1e9) < NETWORK_DEDUP_SECONDS:
                continue
            self._network_seen[key] = now
            d = self.decide(tool_key)
            event_type, action = ACTION_TO_EVENT[d.action]
            if event_type == "warned":
                event_type = "visit"  # network traffic cannot show a warning; record it as observed use
            self.record(tool_key=tool_key, source="network", event_type=event_type, action=action,
                        reason=d.reason, domain=domain, process_name=proc_name)

    def hosts_tick(self) -> None:
        domains: list[str] = []
        if self.policy.get("enforce_hosts_file", True):
            for tool in self.tools:
                if self.decide(tool["key"]).action == "block":
                    domains += tool.get("domains", [])
        self.hosts.apply(domains)

    # --- server sync ----------------------------------------------------------

    def sync_tick(self) -> None:
        while True:
            batch = self.store.pending_events(200)
            if not batch:
                return
            try:
                self.client.send_events(batch)
            except (ApiError, OSError) as exc:
                self.last_sync_error = str(exc)
                log.warning("event upload failed (%d queued): %s", self.store.outbox_size(), exc)
                return
            self.store.ack_events([e["id"] for e in batch])
            self.last_sync_error = ""

    def heartbeat(self) -> None:
        try:
            self.client.heartbeat(agent_version=__version__, os_user=console_user(),
                                  os_version=f"{platform.system()} {platform.release()}")
        except (ApiError, OSError) as exc:
            log.debug("heartbeat failed: %s", exc)

    # --- main loop ------------------------------------------------------------

    def _every(self, jobs: list[tuple[float, callable]]) -> None:
        next_run = [0.0] * len(jobs)
        while not self.stop_event.is_set():
            now = time.monotonic()
            for i, (interval, job) in enumerate(jobs):
                if now >= next_run[i]:
                    next_run[i] = now + interval
                    try:
                        job()
                    except Exception:
                        log.exception("job %s failed", getattr(job, "__name__", job))
            self.stop_event.wait(1.0)

    def run(self) -> None:
        from .local_api import serve

        log.info("AI Guard agent %s starting on %s (tenant: %s)", __version__, current_os(),
                 self.config.tenant_name or "not enrolled")
        server = serve(self, self.config.allowed_extension_ids)
        monitor_jobs = [
            (5, lambda: self.process_tick(5)),
            (30, self.network_tick),
            (15, self.hosts_tick),
            (30, self.sessions.flush),
            (86400, self.store.prune_usage),
        ]
        sync_jobs = [(60, self.refresh_config), (30, self.sync_tick), (300, self.heartbeat)]
        sync_thread = threading.Thread(target=self._every, args=(sync_jobs,), name="sync", daemon=True)
        sync_thread.start()
        try:
            self._every(monitor_jobs)
        finally:
            server.shutdown()
            server.server_close()
            self.sessions.flush(force=True)
            self.sync_tick()

    def stop(self) -> None:
        self.stop_event.set()


def _first_name(procs) -> str:
    for proc in procs:
        try:
            return proc.name()
        except Exception:
            continue
    return ""
