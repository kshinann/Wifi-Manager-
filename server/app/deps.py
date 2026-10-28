from collections.abc import Callable

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Device, Tenant, User
from .security import decode_access_token, hash_token

ROLE_RANK = {"viewer": 0, "admin": 1, "owner": 2}


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    return authorization[7:].strip()


def current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    user_id = decode_access_token(_bearer(authorization))
    user = db.get(User, user_id) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    if user.tenant is not None and not user.tenant.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tenant is suspended")
    return user


def tenant_user(user: User = Depends(current_user)) -> User:
    """A user acting inside a customer tenant. All tenant data is scoped by user.tenant_id."""
    if user.tenant_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account does not belong to a tenant")
    return user


def require_role(minimum: str) -> Callable[[User], User]:
    def check(user: User = Depends(tenant_user)) -> User:
        if ROLE_RANK.get(user.role, -1) < ROLE_RANK[minimum]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires {minimum} role")
        return user

    return check


def platform_admin(user: User = Depends(current_user)) -> User:
    if not user.is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform admin only")
    return user


def current_device(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Device:
    token = _bearer(authorization)
    device = db.scalar(select(Device).where(Device.token_hash == hash_token(token)))
    if device is None or device.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown or revoked device")
    tenant = db.get(Tenant, device.tenant_id)
    if tenant is None or not tenant.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tenant is suspended")
    return device
