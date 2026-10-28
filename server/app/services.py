import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Device, Group, Policy
from .policy_schema import PolicyRules, default_rules


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()
    return value[:60] or "tenant"


def effective_policy(db: Session, device: Device) -> tuple[dict, str, str | None]:
    """Return (rules, version tag, policy id) for a device.

    Resolution order: the device group's policy, then the tenant default policy,
    then built-in defaults. The version tag changes whenever the chosen policy
    changes so agents can detect updates cheaply.
    """
    policy: Policy | None = None
    if device.group_id:
        group = db.get(Group, device.group_id)
        if group is not None and group.policy_id:
            policy = db.get(Policy, group.policy_id)
    if policy is None:
        policy = db.scalar(select(Policy).where(Policy.tenant_id == device.tenant_id, Policy.is_default.is_(True)))
    if policy is None:
        return default_rules(), "builtin-default", None
    # Re-validate so rules stored by older schema versions get new defaults filled in.
    rules = PolicyRules.model_validate(policy.rules).model_dump()
    return rules, f"{policy.id}:{policy.version}", policy.id


def set_default_policy(db: Session, tenant_id: str, policy_id: str) -> None:
    for other in db.scalars(select(Policy).where(Policy.tenant_id == tenant_id, Policy.is_default.is_(True))):
        if other.id != policy_id:
            other.is_default = False
