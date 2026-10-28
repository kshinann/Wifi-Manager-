"""Platform (SaaS operator) endpoints: manage customer tenants."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import platform_admin
from ..models import Device, Tenant, User
from ..schemas import SignupIn, TenantOut
from .auth import create_tenant

router = APIRouter(prefix="/api/platform", tags=["platform"])


class TenantStatus(BaseModel):
    is_active: bool


@router.get("/tenants")
def list_tenants(_: User = Depends(platform_admin), db: Session = Depends(get_db)):
    device_counts = dict(db.execute(select(Device.tenant_id, func.count()).where(Device.status == "active")
                                    .group_by(Device.tenant_id)).all())
    user_counts = dict(db.execute(select(User.tenant_id, func.count()).group_by(User.tenant_id)).all())
    return [
        {**TenantOut.model_validate(t).model_dump(), "devices": device_counts.get(t.id, 0),
         "users": user_counts.get(t.id, 0)}
        for t in db.scalars(select(Tenant).order_by(Tenant.created_at.desc()))
    ]


@router.post("/tenants", response_model=TenantOut, status_code=201)
def create(body: SignupIn, _: User = Depends(platform_admin), db: Session = Depends(get_db)):
    owner = create_tenant(db, body.company_name, body.name, body.email, body.password)
    return owner.tenant


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
def set_status(tenant_id: str, body: TenantStatus, _: User = Depends(platform_admin), db: Session = Depends(get_db)):
    tenant = db.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tenant not found")
    tenant.is_active = body.is_active
    db.commit()
    return tenant
