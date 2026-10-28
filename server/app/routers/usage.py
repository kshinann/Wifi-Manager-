import csv
import io
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import ROLE_RANK, tenant_user
from ..models import Device, UsageEvent, User, utcnow
from ..schemas import UsageEventOut, UsageEventPage

router = APIRouter(prefix="/api/usage", tags=["usage"])


def _filtered(user: User, device_id, tool_key, action, event_type, source, since, until, q):
    query = select(UsageEvent).where(UsageEvent.tenant_id == user.tenant_id)
    if device_id:
        query = query.where(UsageEvent.device_id == device_id)
    if tool_key:
        query = query.where(UsageEvent.tool_key == tool_key)
    if action:
        query = query.where(UsageEvent.action == action)
    if event_type:
        query = query.where(UsageEvent.event_type == event_type)
    if source:
        query = query.where(UsageEvent.source == source)
    if since:
        query = query.where(UsageEvent.occurred_at >= since)
    if until:
        query = query.where(UsageEvent.occurred_at < until)
    if q:
        like = f"%{q}%"
        query = query.where(UsageEvent.domain.ilike(like) | UsageEvent.process_name.ilike(like)
                            | UsageEvent.os_user.ilike(like) | UsageEvent.reason.ilike(like))
    return query


def _visible(user: User, event: UsageEvent) -> UsageEventOut:
    out = UsageEventOut.model_validate(event)
    # Captured prompts are sensitive; only admins and owners may read them.
    if ROLE_RANK.get(user.role, 0) < ROLE_RANK["admin"]:
        out = out.model_copy(update={"prompt_text": None})
    return out


@router.get("/events", response_model=UsageEventPage)
def list_events(
    device_id: str | None = None, tool_key: str | None = None, action: str | None = None,
    event_type: str | None = None, source: str | None = None, since: datetime | None = None,
    until: datetime | None = None, q: str | None = None,
    limit: int = Query(default=50, ge=1, le=500), offset: int = Query(default=0, ge=0),
    user: User = Depends(tenant_user), db: Session = Depends(get_db),
):
    query = _filtered(user, device_id, tool_key, action, event_type, source, since, until, q)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(UsageEvent.occurred_at.desc(), UsageEvent.id.desc()).limit(limit).offset(offset))
    return UsageEventPage(total=total or 0, items=[_visible(user, r) for r in rows])


@router.get("/events.csv")
def export_events(
    device_id: str | None = None, tool_key: str | None = None, action: str | None = None,
    event_type: str | None = None, source: str | None = None, since: datetime | None = None,
    until: datetime | None = None, q: str | None = None,
    user: User = Depends(tenant_user), db: Session = Depends(get_db),
):
    query = _filtered(user, device_id, tool_key, action, event_type, source, since, until, q)
    hostnames = dict(db.execute(select(Device.id, Device.hostname).where(Device.tenant_id == user.tenant_id)).all())
    columns = ["occurred_at", "hostname", "os_user", "tool_key", "source", "event_type", "action", "reason",
               "domain", "process_name", "duration_seconds", "prompt_chars", "dlp_hits", "prompt_text"]

    def rows():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(columns)
        for event in db.scalars(query.order_by(UsageEvent.occurred_at.desc()).limit(100_000)):
            e = _visible(user, event)
            writer.writerow([e.occurred_at.isoformat(), hostnames.get(e.device_id, ""), e.os_user, e.tool_key,
                             e.source, e.event_type, e.action, e.reason, e.domain, e.process_name,
                             e.duration_seconds, e.prompt_chars or "", ";".join(e.dlp_hits), e.prompt_text or ""])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate()

    return StreamingResponse(rows(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=ai-usage.csv"})


@router.get("/summary")
def summary(days: int = Query(default=7, ge=1, le=365), device_id: str | None = None,
            user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    since = utcnow() - timedelta(days=days)
    base = [UsageEvent.tenant_id == user.tenant_id, UsageEvent.occurred_at >= since]
    if device_id:
        base.append(UsageEvent.device_id == device_id)

    minutes = func.coalesce(func.sum(UsageEvent.duration_seconds), 0) / 60.0
    blocked = func.sum(case((UsageEvent.action == "blocked", 1), else_=0))
    warned = func.sum(case((UsageEvent.action == "warned", 1), else_=0))
    prompts = func.sum(case((UsageEvent.event_type.in_(["prompt", "dlp"]), 1), else_=0))
    dlp = func.sum(case((UsageEvent.event_type == "dlp", 1), else_=0))

    totals = db.execute(select(func.count(), minutes, blocked, warned, prompts, dlp,
                               func.count(func.distinct(UsageEvent.device_id))).where(*base)).one()

    by_tool = db.execute(
        select(UsageEvent.tool_key, func.count(), minutes, blocked, func.count(func.distinct(UsageEvent.device_id)))
        .where(*base).group_by(UsageEvent.tool_key).order_by(minutes.desc())
    ).all()
    day = func.date(UsageEvent.occurred_at)
    by_day = db.execute(select(day, func.count(), minutes, blocked).where(*base).group_by(day).order_by(day)).all()
    by_source = db.execute(select(UsageEvent.source, func.count(), minutes).where(*base)
                           .group_by(UsageEvent.source)).all()
    top_devices = db.execute(
        select(UsageEvent.device_id, Device.hostname, func.count(), minutes, blocked)
        .join(Device, Device.id == UsageEvent.device_id).where(*base)
        .group_by(UsageEvent.device_id, Device.hostname).order_by(minutes.desc()).limit(10)
    ).all()
    top_users = db.execute(
        select(UsageEvent.os_user, func.count(), minutes).where(*base, UsageEvent.os_user != "")
        .group_by(UsageEvent.os_user).order_by(minutes.desc()).limit(10)
    ).all()

    return {
        "days": days,
        "totals": {
            "events": totals[0], "minutes": round(float(totals[1] or 0), 1), "blocked": int(totals[2] or 0),
            "warned": int(totals[3] or 0), "prompts": int(totals[4] or 0), "dlp_hits": int(totals[5] or 0),
            "active_devices": totals[6],
        },
        "by_tool": [{"tool_key": t, "events": c, "minutes": round(float(m or 0), 1), "blocked": int(b or 0),
                     "devices": d} for t, c, m, b, d in by_tool],
        "by_day": [{"date": str(d), "events": c, "minutes": round(float(m or 0), 1), "blocked": int(b or 0)}
                   for d, c, m, b in by_day],
        "by_source": [{"source": s, "events": c, "minutes": round(float(m or 0), 1)} for s, c, m in by_source],
        "top_devices": [{"device_id": i, "hostname": h, "events": c, "minutes": round(float(m or 0), 1),
                         "blocked": int(b or 0)} for i, h, c, m, b in top_devices],
        "top_users": [{"os_user": u, "events": c, "minutes": round(float(m or 0), 1)} for u, c, m in top_users],
    }
