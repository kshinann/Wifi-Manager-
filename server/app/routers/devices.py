from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_role, tenant_user
from ..models import Device, EnrollmentToken, Group, User, utcnow
from ..schemas import DeviceOut, DeviceUpdate, EnrollmentTokenCreated, EnrollmentTokenIn, EnrollmentTokenOut
from ..security import hash_token, new_secret_token
from ..services import effective_policy

router = APIRouter(prefix="/api", tags=["devices"])


def _device(db: Session, device_id: str, tenant_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None or device.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    return device


@router.get("/devices", response_model=list[DeviceOut])
def list_devices(include_revoked: bool = False, user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    query = select(Device).where(Device.tenant_id == user.tenant_id)
    if not include_revoked:
        query = query.where(Device.status == "active")
    return db.scalars(query.order_by(Device.hostname)).all()


@router.get("/devices/{device_id}")
def get_device(device_id: str, user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    device = _device(db, device_id, user.tenant_id)
    rules, version, policy_id = effective_policy(db, device)
    return {
        "device": DeviceOut.model_validate(device),
        "effective_policy": {"id": policy_id, "version": version, "rules": rules},
        "policy_in_sync": device.policy_version == version,
    }


@router.patch("/devices/{device_id}", response_model=DeviceOut)
def update_device(device_id: str, body: DeviceUpdate, user: User = Depends(require_role("admin")),
                  db: Session = Depends(get_db)):
    device = _device(db, device_id, user.tenant_id)
    if body.group_id is not None:
        group = db.get(Group, body.group_id)
        if group is None or group.tenant_id != user.tenant_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    device.group_id = body.group_id
    db.commit()
    return device


@router.delete("/devices/{device_id}", status_code=204)
def revoke_device(device_id: str, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Revoke the device token. Its usage history is kept."""
    device = _device(db, device_id, user.tenant_id)
    device.status = "revoked"
    db.commit()
    return Response(status_code=204)


@router.get("/enrollment-tokens", response_model=list[EnrollmentTokenOut])
def list_tokens(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return db.scalars(select(EnrollmentToken).where(EnrollmentToken.tenant_id == user.tenant_id)
                      .order_by(EnrollmentToken.created_at.desc())).all()


@router.post("/enrollment-tokens", response_model=EnrollmentTokenCreated, status_code=201)
def create_token(body: EnrollmentTokenIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    if body.group_id is not None:
        group = db.get(Group, body.group_id)
        if group is None or group.tenant_id != user.tenant_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")
    raw = new_secret_token("enr")
    token = EnrollmentToken(
        tenant_id=user.tenant_id, group_id=body.group_id, label=body.label, token_hash=hash_token(raw),
        token_prefix=raw[:10], max_uses=body.max_uses,
        expires_at=utcnow() + timedelta(days=body.expires_in_days) if body.expires_in_days else None,
    )
    db.add(token)
    db.commit()
    return EnrollmentTokenCreated.model_validate(token).model_copy(update={"token": raw})


@router.delete("/enrollment-tokens/{token_id}", status_code=204)
def revoke_token(token_id: str, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    token = db.get(EnrollmentToken, token_id)
    if token is None or token.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    token.revoked = True
    db.commit()
    return Response(status_code=204)
