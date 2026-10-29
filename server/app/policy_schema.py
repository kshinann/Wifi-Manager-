"""Policy rule document stored in Policy.rules and sent to agents.

The agent evaluates these rules locally (see agent/aiguard_agent/policy.py), so
any change here must be mirrored there and bump SCHEMA_VERSION.
"""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

SCHEMA_VERSION = 1

Action = Literal["allow", "warn", "block"]

DLP_DETECTORS = ["credentials", "email", "credit_card", "phone", "api_key", "my_nric", "ip_address", "iban"]

_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class ToolRule(BaseModel):
    tool: str = Field(min_length=1, max_length=80)
    action: Action = "allow"
    # Per-tool daily limit in minutes, counted on the device's local day.
    daily_minutes: int | None = Field(default=None, ge=0, le=1440)


class Schedule(BaseModel):
    # 0 = Monday ... 6 = Sunday
    days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    start: str = "08:00"
    end: str = "18:00"
    outside_action: Literal["warn", "block"] = "block"

    @field_validator("start", "end")
    @classmethod
    def _check_time(cls, value: str) -> str:
        if not _HHMM.match(value):
            raise ValueError("must be HH:MM (24h)")
        return value

    @field_validator("days")
    @classmethod
    def _check_days(cls, value: list[int]) -> list[int]:
        if any(d < 0 or d > 6 for d in value):
            raise ValueError("days must be between 0 (Mon) and 6 (Sun)")
        return sorted(set(value))


class DLPSettings(BaseModel):
    enabled: bool = False
    detectors: list[str] = Field(default_factory=lambda: ["credentials", "credit_card", "api_key", "my_nric"])
    # Case-insensitive words or phrases, e.g. project code names.
    keywords: list[str] = Field(default_factory=list)
    action: Literal["log", "warn", "block"] = "warn"

    @field_validator("detectors")
    @classmethod
    def _check_detectors(cls, value: list[str]) -> list[str]:
        unknown = set(value) - set(DLP_DETECTORS)
        if unknown:
            raise ValueError(f"unknown detectors: {sorted(unknown)}")
        return value


class PolicyRules(BaseModel):
    schema_version: int = SCHEMA_VERSION
    # Applies to catalog tools that have no explicit rule.
    default_action: Action = "allow"
    tool_rules: list[ToolRule] = Field(default_factory=list)
    # Limit across all AI tools combined, in minutes per local day.
    daily_minutes_total: int | None = Field(default=None, ge=0, le=1440)
    schedule: Schedule | None = None
    capture_prompts: bool = False
    prompt_retention_days: int = Field(default=30, ge=1, le=3650)
    dlp: DLPSettings = Field(default_factory=DLPSettings)
    monitor_processes: bool = True
    monitor_network: bool = True
    # Kill blocked desktop apps and add blocked domains to the hosts file.
    enforce_processes: bool = True
    enforce_hosts_file: bool = True
    warn_message: str = "This AI tool is monitored by your organization. Do not share confidential data."
    block_message: str = "This AI tool is blocked by your organization's AI usage policy."

    @field_validator("tool_rules")
    @classmethod
    def _unique_tools(cls, value: list[ToolRule]) -> list[ToolRule]:
        keys = [r.tool for r in value]
        if len(keys) != len(set(keys)):
            raise ValueError("each tool may only have one rule")
        return value


def default_rules() -> dict:
    return PolicyRules().model_dump()
