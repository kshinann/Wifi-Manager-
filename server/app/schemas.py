from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .policy_schema import PolicyRules

Role = Literal["owner", "admin", "viewer"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- auth / tenants -------------------------------------------------------

class SignupIn(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TenantOut(ORM):
    id: str
    name: str
    slug: str
    is_active: bool
    event_retention_days: int
    created_at: datetime


class TenantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    event_retention_days: int | None = Field(default=None, ge=7, le=3650)


class UserOut(ORM):
    id: str
    tenant_id: str | None
    email: str
    name: str
    role: str
    is_platform_admin: bool
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    tenant: TenantOut | None


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=10, max_length=200)
    role: Role = "viewer"


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=10, max_length=200)


# --- policies / groups -----------------------------------------------------

class PolicyIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    is_default: bool = False
    rules: PolicyRules = Field(default_factory=PolicyRules)


class PolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_default: bool | None = None
    rules: PolicyRules | None = None


class PolicyOut(ORM):
    id: str
    name: str
    description: str
    is_default: bool
    rules: dict
    version: int
    created_at: datetime
    updated_at: datetime


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    policy_id: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    policy_id: str | None = None


class GroupOut(ORM):
    id: str
    name: str
    description: str
    policy_id: str | None
    created_at: datetime
    device_count: int = 0


# --- tools ----------------------------------------------------------------

class ToolIn(BaseModel):
    key: str = Field(pattern=r"^[a-z0-9_]{2,80}$")
    name: str = Field(min_length=1, max_length=200)
    vendor: str = ""
    category: str = "chat"
    domains: list[str] = Field(default_factory=list)
    processes: dict[str, list[str]] = Field(default_factory=dict)


class ToolOut(ORM):
    id: int
    key: str
    name: str
    vendor: str
    category: str
    domains: list[str]
    processes: dict
    builtin: bool = False


# --- devices / enrollment ----------------------------------------------------

class EnrollmentTokenIn(BaseModel):
    label: str = ""
    group_id: str | None = None
    max_uses: int | None = Field(default=None, ge=1)
    expires_in_days: int | None = Field(default=30, ge=1, le=3650)


class EnrollmentTokenOut(ORM):
    id: str
    label: str
    group_id: str | None
    token_prefix: str
    max_uses: int | None
    uses: int
    expires_at: datetime | None
    revoked: bool
    created_at: datetime


class EnrollmentTokenCreated(EnrollmentTokenOut):
    # Shown once; only the hash is stored.
    token: str = ""


class DeviceOut(ORM):
    id: str
    hostname: str
    os: str
    os_version: str
    agent_version: str
    os_user: str
    group_id: str | None
    status: str
    enrolled_at: datetime
    last_seen_at: datetime | None
    policy_version: str


class DeviceUpdate(BaseModel):
    group_id: str | None = None


# --- agent ----------------------------------------------------------------

class AgentEnrollIn(BaseModel):
    enrollment_token: str
    hostname: str = Field(max_length=255)
    os: Literal["windows", "macos", "linux"]
    os_version: str = ""
    agent_version: str = ""
    os_user: str = ""


class AgentEnrollOut(BaseModel):
    device_id: str
    device_token: str
    tenant_name: str


class AgentEventIn(BaseModel):
    id: str = Field(min_length=8, max_length=64)
    tool_key: str = Field(max_length=80)
    source: Literal["browser", "process", "network"]
    event_type: Literal["visit", "session", "prompt", "blocked", "warned", "dlp"]
    action: Literal["allowed", "warned", "blocked"] = "allowed"
    reason: str = Field(default="", max_length=200)
    domain: str = Field(default="", max_length=255)
    url: str = Field(default="", max_length=4000)
    process_name: str = Field(default="", max_length=255)
    os_user: str = Field(default="", max_length=200)
    occurred_at: datetime
    duration_seconds: int = Field(default=0, ge=0, le=86400)
    prompt_chars: int | None = Field(default=None, ge=0)
    prompt_text: str | None = Field(default=None, max_length=100_000)
    dlp_hits: list[str] = Field(default_factory=list)


class AgentEventsIn(BaseModel):
    events: list[AgentEventIn] = Field(max_length=500)


class AgentHeartbeatIn(BaseModel):
    agent_version: str = ""
    os_user: str = ""
    os_version: str = ""


class UsageEventOut(ORM):
    id: int
    device_id: str
    tool_key: str
    source: str
    event_type: str
    action: str
    reason: str
    domain: str
    url: str
    process_name: str
    os_user: str
    occurred_at: datetime
    duration_seconds: int
    prompt_chars: int | None
    prompt_text: str | None
    dlp_hits: list


class UsageEventPage(BaseModel):
    total: int
    items: list[UsageEventOut]
