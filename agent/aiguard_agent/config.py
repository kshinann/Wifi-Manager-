import json
import os
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

LOCAL_API_PORT = 47615


def data_dir() -> Path:
    override = os.getenv("AIGUARD_DATA_DIR")
    if override:
        path = Path(override)
    elif sys.platform == "win32":
        path = Path(os.getenv("PROGRAMDATA", r"C:\ProgramData")) / "AIGuard"
    elif sys.platform == "darwin":
        path = Path("/Library/Application Support/AIGuard")
    else:
        path = Path("/var/lib/aiguard")
    path.mkdir(parents=True, exist_ok=True)
    return path


@dataclass
class AgentConfig:
    server_url: str = ""
    device_id: str = ""
    device_token: str = ""
    tenant_name: str = ""
    # Extension IDs allowed to call the local API. Empty allows any browser extension origin.
    allowed_extension_ids: tuple[str, ...] = ()

    @property
    def enrolled(self) -> bool:
        return bool(self.server_url and self.device_token)

    @classmethod
    def load(cls) -> "AgentConfig":
        path = data_dir() / "agent.json"
        if not path.exists():
            return cls()
        raw = json.loads(path.read_text())
        raw["allowed_extension_ids"] = tuple(raw.get("allowed_extension_ids", ()))
        return cls(**{k: v for k, v in raw.items() if k in cls.__dataclass_fields__})

    def save(self) -> None:
        path = data_dir() / "agent.json"
        tmp = path.with_suffix(".tmp")
        data = asdict(self)
        data["allowed_extension_ids"] = list(self.allowed_extension_ids)
        tmp.write_text(json.dumps(data, indent=2))
        if sys.platform != "win32":
            os.chmod(tmp, 0o600)
        os.replace(tmp, path)
