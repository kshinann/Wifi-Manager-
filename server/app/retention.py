import logging
from datetime import timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from .models import Tenant, UsageEvent, utcnow

log = logging.getLogger(__name__)


def purge(db: Session) -> dict:
    """Drop expired prompt text and delete events past each tenant's retention window."""
    now = utcnow()
    prompts = db.execute(
        update(UsageEvent).where(UsageEvent.prompt_expires_at.is_not(None), UsageEvent.prompt_expires_at < now)
        .values(prompt_text=None, prompt_expires_at=None)
    ).rowcount
    events = 0
    for tenant_id, days in db.execute(select(Tenant.id, Tenant.event_retention_days)).all():
        events += db.execute(
            delete(UsageEvent).where(UsageEvent.tenant_id == tenant_id,
                                     UsageEvent.occurred_at < now - timedelta(days=days))
        ).rowcount
    db.commit()
    if prompts or events:
        log.info("retention: cleared %s prompt texts, deleted %s events", prompts, events)
    return {"prompts_cleared": prompts, "events_deleted": events}
