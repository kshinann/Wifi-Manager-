import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import Text, func, select, type_coerce, update

from . import retention
from .catalog import seed_builtin_tools
from .config import settings
from .crypto import PREFIX
from .db import Base, SessionLocal, engine
from .models import UsageEvent, User
from .routers import admin, agent, auth, devices, platform, usage
from .security import hash_password

log = logging.getLogger("aiguard")


def init_db() -> None:
    # MVP: create tables directly. Switch to Alembic migrations before the first schema change in production.
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_builtin_tools(db)
        email, password = settings.platform_admin_email, settings.platform_admin_password
        if email and password and not db.scalar(select(User).where(func.lower(User.email) == email.lower())):
            db.add(User(email=email.lower(), name="Platform admin", password_hash=hash_password(password),
                        role="owner", is_platform_admin=True))
            db.commit()
            log.info("created platform admin %s", email)
        encrypt_legacy_prompts(db)


def encrypt_legacy_prompts(db) -> None:
    """Encrypt prompt text stored before encryption at rest was added."""
    raw = type_coerce(UsageEvent.prompt_text, Text)  # read the stored value without decrypting
    rows = db.execute(select(UsageEvent.id, raw).where(raw.is_not(None), ~raw.startswith(PREFIX))).all()
    for event_id, text in rows:
        db.execute(update(UsageEvent).where(UsageEvent.id == event_id).values(prompt_text=text))
    db.commit()
    if rows:
        log.info("encrypted %d previously stored prompts", len(rows))


def _run_retention() -> None:
    with SessionLocal() as db:
        retention.purge(db)


async def _retention_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_run_retention)
        except Exception:  # keep the loop alive; the next run retries
            log.exception("retention job failed")
        await asyncio.sleep(settings.retention_interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.secret_key == "change-me-in-production":
        log.warning("SECRET_KEY is not set; using an insecure default")
    init_db()
    task = asyncio.create_task(_retention_loop())
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(title="AI Guard", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

for module in (auth, admin, devices, usage, agent, platform):
    app.include_router(module.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
