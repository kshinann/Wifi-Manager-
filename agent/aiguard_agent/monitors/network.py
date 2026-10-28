"""Detects traffic to AI services from any process (scripts, IDE plugins, browsers without the extension).

Two signals are combined:
* live TCP connections whose remote IP belongs to a catalog domain (resolved periodically), which also tells us
  the owning process;
* on Windows, the OS DNS client cache, which catches short-lived API calls between scans.
"""

import logging
import socket
import subprocess
import sys
import time

log = logging.getLogger(__name__)

# Browsers covered by the AI Guard extension; their traffic is reported by the extension instead.
EXTENSION_BROWSERS = ("chrome", "msedge", "microsoft edge", "google chrome")


class NetworkMonitor:
    def __init__(self, resolve_interval: float = 600.0):
        self.resolve_interval = resolve_interval
        self._ip_to_domain: dict[str, str] = {}
        self._resolved_at = 0.0
        self._resolved_for: tuple[str, ...] = ()

    def _refresh_ips(self, domains: list[str]) -> None:
        key = tuple(sorted(domains))
        if key == self._resolved_for and time.monotonic() - self._resolved_at < self.resolve_interval:
            return
        mapping: dict[str, str] = {}
        for domain in domains:
            try:
                for info in socket.getaddrinfo(domain, 443, proto=socket.IPPROTO_TCP):
                    mapping[info[4][0]] = domain
            except OSError:
                continue
        self._ip_to_domain = mapping
        self._resolved_at = time.monotonic()
        self._resolved_for = key

    def connections(self, domains: list[str]) -> list[tuple[str, str]]:
        """Return [(domain, process_name)] for established connections to AI domains."""
        import psutil

        self._refresh_ips(domains)
        if not self._ip_to_domain:
            return []
        hits: set[tuple[str, str]] = set()
        try:
            conns = psutil.net_connections(kind="tcp")
        except (psutil.AccessDenied, OSError):
            log.debug("net_connections needs admin/root")
            return []
        for conn in conns:
            if conn.status != psutil.CONN_ESTABLISHED or not conn.raddr:
                continue
            domain = self._ip_to_domain.get(conn.raddr.ip)
            if not domain:
                continue
            name = ""
            if conn.pid:
                try:
                    name = psutil.Process(conn.pid).name()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            hits.add((domain, name))
        return sorted(hits)

    @staticmethod
    def dns_cache_names() -> set[str]:
        """Hostnames in the Windows DNS client cache. Empty on other platforms."""
        if sys.platform != "win32":
            return set()
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command",
                 "Get-DnsClientCache | Select-Object -ExpandProperty Entry"],
                capture_output=True, text=True, timeout=20, check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            ).stdout
        except (OSError, subprocess.SubprocessError):
            return set()
        return {line.strip().lower() for line in out.splitlines() if line.strip()}


def is_extension_browser(process_name: str) -> bool:
    lowered = process_name.lower()
    return any(b in lowered for b in EXTENSION_BROWSERS)
