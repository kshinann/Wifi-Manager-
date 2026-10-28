"""Endpoints called by the desktop agent, authenticated with a per-device token."""

from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import tools_for_tenant
from ..db import get_db
from ..deps import current_device
from ..models import Device, EnrollmentToken, Tenant, UsageEvent, utcnow
from ..schemas import AgentEnrollIn, AgentEnrollOut, AgentEventsIn, AgentHeartbeatIn
from ..security import hash_token, new_secret_token
from ..services import effective_policy

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _as_utc(dt):
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


@router.post("/enroll", response_model=AgentEnrollOut, status_code=201)
def enroll(body: AgentEnrollIn, db: Session = Depends(get_db)):
    token = db.scalar(select(EnrollmentToken).where(EnrollmentToken.token_hash == hash_token(body.enrollment_token)))
    invalid = (
        token is None or token.revoked
        or (token.expires_at is not None and _as_utc(token.expires_at) < utcnow())
        or (token.max_uses is not None and token.uses >= token.max_uses)
    )
    if invalid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired enrollment token")
    tenant = db.get(Tenant, token.tenant_id)
    if tenant is None or not tenant.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tenant is suspended")
    raw = new_secret_token("dev")
    device = Device(tenant_id=token.tenant_id, group_id=token.group_id, hostname=body.hostname, os=body.os,
                    os_version=body.os_version, agent_version=body.agent_version, os_user=body.os_user,
                    token_hash=hash_token(raw), last_seen_at=utcnow())
    token.uses += 1
    db.add(device)
    db.commit()
    return AgentEnrollOut(device_id=device.id, device_token=raw, tenant_name=tenant.name)


@router.get("/config")
def config(device: Device = Depends(current_device), db: Session = Depends(get_db)):
    rules, version, _ = effective_policy(db, device)
    device.last_seen_at = utcnow()
    device.policy_version = version
    db.commit()
    tools = [
        {"key": t.key, "name": t.name, "category": t.category, "domains": t.domains, "processes": t.processes}
        for t in tools_for_tenant(db, device.tenant_id)
    ]
    return {"device_id": device.id, "policy_version": version, "policy": rules, "tools": tools,
            "server_time": utcnow().isoformat()}


@router.post("/heartbeat")
def heartbeat(body: AgentHeartbeatIn, device: Device = Depends(current_device), db: Session = Depends(get_db)):
    device.last_seen_at = utcnow()
    for field in ("agent_version", "os_user", "os_version"):
        value = getattr(body, field)
        if value:
            setattr(device, field, value)
    db.commit()
    _, version, _ = effective_policy(db, device)
    return {"policy_version": version}


@router.post("/events")
def ingest_events(body: AgentEventsIn, device: Device = Depends(current_device), db: Session = Depends(get_db)):
    rules, _, _ = effective_policy(db, device)
    capture = bool(rules.get("capture_prompts"))
    retention = timedelta(days=int(rules.get("prompt_retention_days", 30)))

    ids = [e.id for e in body.events]
    seen = set(db.scalars(select(UsageEvent.client_event_id).where(
        UsageEvent.device_id == device.id, UsageEvent.client_event_id.in_(ids))))
    accepted = 0
    for e in body.events:
        if e.id in seen:
            continue
        seen.add(e.id)
        # Server-side guard: never keep prompt text unless the current policy allows it.
        prompt_text = e.prompt_text if capture else None
        db.add(UsageEvent(
            tenant_id=device.tenant_id, device_id=device.id, client_event_id=e.id, tool_key=e.tool_key,
            source=e.source, event_type=e.event_type, action=e.action, reason=e.reason, domain=e.domain,
            url=e.url, process_name=e.process_name, os_user=e.os_user or device.os_user,
            occurred_at=_as_utc(e.occurred_at), duration_seconds=e.duration_seconds, prompt_chars=e.prompt_chars,
            prompt_text=prompt_text, prompt_expires_at=utcnow() + retention if prompt_text else None,
            dlp_hits=e.dlp_hits,
        ))
        accepted += 1
    device.last_seen_at = utcnow()
    db.commit()
    return {"accepted": accepted, "duplicates": len(body.events) - accepted}
