"""Local policy evaluation. Mirrors server/app/policy_schema.py."""

from dataclasses import dataclass, field
from datetime import datetime

SEVERITY = {"allow": 0, "warn": 1, "block": 2}


@dataclass
class Decision:
    action: str = "allow"  # allow | warn | block
    reasons: list[str] = field(default_factory=list)
    message: str = ""

    def escalate(self, action: str, reason: str) -> None:
        if SEVERITY[action] > SEVERITY[self.action]:
            self.action = action
        if action != "allow":
            self.reasons.append(reason)

    @property
    def reason(self) -> str:
        return "; ".join(self.reasons)

    def to_dict(self) -> dict:
        return {"action": self.action, "reason": self.reason, "message": self.message}


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def within_schedule(schedule: dict, now: datetime) -> bool:
    if now.weekday() not in schedule.get("days", []):
        return False
    start, end = _minutes(schedule["start"]), _minutes(schedule["end"])
    current = now.hour * 60 + now.minute
    if start <= end:
        return start <= current < end
    # Overnight window such as 22:00-06:00.
    return current >= start or current < end


def tool_rule(policy: dict, tool_key: str) -> dict | None:
    for rule in policy.get("tool_rules", []):
        if rule.get("tool") == tool_key:
            return rule
    return None


def decide(policy: dict, tool_key: str, now: datetime, usage_seconds: dict[str, float]) -> Decision:
    """Decide whether a tool may be used right now.

    usage_seconds holds today's accumulated usage per tool key on this device.
    """
    decision = Decision()
    rule = tool_rule(policy, tool_key)
    base_action = rule["action"] if rule else policy.get("default_action", "allow")
    if base_action == "block":
        decision.escalate("block", "tool not approved")
    elif base_action == "warn":
        decision.escalate("warn", "tool requires caution")

    schedule = policy.get("schedule")
    if schedule and not within_schedule(schedule, now):
        decision.escalate(schedule.get("outside_action", "block"), "outside allowed hours")

    limit = rule.get("daily_minutes") if rule else None
    if limit is not None and usage_seconds.get(tool_key, 0) >= limit * 60:
        decision.escalate("block", f"daily limit of {limit} min reached")

    total_limit = policy.get("daily_minutes_total")
    if total_limit is not None and sum(usage_seconds.values()) >= total_limit * 60:
        decision.escalate("block", f"daily AI limit of {total_limit} min reached")

    if decision.action == "block":
        decision.message = policy.get("block_message", "")
    elif decision.action == "warn":
        decision.message = policy.get("warn_message", "")
    return decision
