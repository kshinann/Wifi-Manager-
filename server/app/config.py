import os
from dataclasses import dataclass, field


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./aiguard.db"))
    secret_key: str = field(default_factory=lambda: os.getenv("SECRET_KEY", "change-me-in-production"))
    access_token_minutes: int = field(default_factory=lambda: int(os.getenv("ACCESS_TOKEN_MINUTES", "720")))
    # When false, new tenants can only be created by a platform admin.
    allow_signup: bool = field(default_factory=lambda: _bool("ALLOW_SIGNUP", True))
    # Bootstrapped on startup if both are set and the user does not exist yet.
    platform_admin_email: str | None = field(default_factory=lambda: os.getenv("PLATFORM_ADMIN_EMAIL"))
    platform_admin_password: str | None = field(default_factory=lambda: os.getenv("PLATFORM_ADMIN_PASSWORD"))
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    )
    retention_interval_seconds: int = field(default_factory=lambda: int(os.getenv("RETENTION_INTERVAL_SECONDS", "3600")))


settings = Settings()
