"""Maps domains and process names to AI tool keys using the catalog from the server."""

import sys


def current_os() -> str:
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "macos"
    return "linux"


class ToolMatcher:
    def __init__(self, tools: list[dict], os_name: str | None = None):
        self.tools = {t["key"]: t for t in tools}
        os_name = os_name or current_os()
        self._domains: list[tuple[str, str]] = []
        self._processes: dict[str, str] = {}
        for tool in tools:
            for domain in tool.get("domains", []):
                self._domains.append((domain.lower().strip("."), tool["key"]))
            for name in (tool.get("processes") or {}).get(os_name, []):
                self._processes[name.lower()] = tool["key"]
        # Longest domain first so "api.openai.com" wins over a broader entry.
        self._domains.sort(key=lambda item: len(item[0]), reverse=True)

    def match_domain(self, host: str) -> str | None:
        host = host.lower().strip(".")
        for domain, key in self._domains:
            if host == domain or host.endswith("." + domain):
                return key
        return None

    def match_process(self, name: str) -> str | None:
        return self._processes.get(name.lower())

    def domains_for(self, tool_key: str) -> list[str]:
        return list(self.tools.get(tool_key, {}).get("domains", []))

    def name(self, tool_key: str) -> str:
        return self.tools.get(tool_key, {}).get("name", tool_key)
