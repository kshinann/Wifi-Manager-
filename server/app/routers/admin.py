"""Tenant administration: tenant settings, users, groups, policies, tools."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..catalog import tools_for_tenant
from ..db import get_db
from ..deps import require_role, tenant_user
from ..models import AITool, Device, Group, Policy, Tenant, User
from ..policy_schema import DLP_DETECTORS, default_rules
from ..schemas import (GroupIn, GroupOut, GroupUpdate, PolicyIn, PolicyOut, PolicyUpdate, TenantOut, TenantUpdate,
                       ToolIn, ToolOut, UserCreate, UserOut, UserUpdate)
from ..security import hash_password
from ..services import set_default_policy

router = APIRouter(prefix="/api", tags=["admin"])


def _get_owned(db: Session, model, obj_id, tenant_id: str):
    obj = db.get(model, obj_id)
    if obj is None or obj.tenant_id != tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")
    return obj


# --- tenant -----------------------------------------------------------------

@router.get("/tenant", response_model=TenantOut)
def get_tenant(user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    return db.get(Tenant, user.tenant_id)


@router.patch("/tenant", response_model=TenantOut)
def update_tenant(body: TenantUpdate, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    tenant = db.get(Tenant, user.tenant_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tenant, field, value)
    db.commit()
    return tenant


# --- users ------------------------------------------------------------------

@router.get("/users", response_model=list[UserOut])
def list_users(user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.tenant_id == user.tenant_id).order_by(User.created_at)).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    if body.role == "owner" and user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only owners can create owners")
    if db.scalar(select(User).where(func.lower(User.email) == body.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    new = User(tenant_id=user.tenant_id, email=body.email.lower(), name=body.name,
               password_hash=hash_password(body.password), role=body.role)
    db.add(new)
    db.commit()
    return new


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserUpdate, user: User = Depends(require_role("admin")),
                db: Session = Depends(get_db)):
    target = _get_owned(db, User, user_id, user.tenant_id)
    changes = body.model_dump(exclude_unset=True)
    touches_owner = target.role == "owner" or changes.get("role") == "owner"
    if touches_owner and user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only owners can change owners")
    demoting_owner = target.role == "owner" and (changes.get("role", "owner") != "owner" or changes.get("is_active") is False)
    if demoting_owner:
        owners = db.scalar(select(func.count()).select_from(User).where(
            User.tenant_id == user.tenant_id, User.role == "owner", User.is_active.is_(True)))
        if owners <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A tenant needs at least one active owner")
    if "password" in changes:
        target.password_hash = hash_password(changes.pop("password"))
    for field, value in changes.items():
        setattr(target, field, value)
    db.commit()
    return target


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, user: User = Depends(require_role("owner")), db: Session = Depends(get_db)):
    target = _get_owned(db, User, user_id, user.tenant_id)
    if target.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete yourself")
    db.delete(target)
    db.commit()
    return Response(status_code=204)


# --- policies ---------------------------------------------------------------

@router.get("/policies/template")
def policy_template(_: User = Depends(tenant_user)):
    return {"rules": default_rules(), "dlp_detectors": DLP_DETECTORS}


@router.get("/policies", response_model=list[PolicyOut])
def list_policies(user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    return db.scalars(select(Policy).where(Policy.tenant_id == user.tenant_id).order_by(Policy.name)).all()


@router.get("/policies/{policy_id}", response_model=PolicyOut)
def get_policy(policy_id: str, user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    return _get_owned(db, Policy, policy_id, user.tenant_id)


@router.post("/policies", response_model=PolicyOut, status_code=201)
def create_policy(body: PolicyIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    policy = Policy(tenant_id=user.tenant_id, name=body.name, description=body.description,
                    is_default=body.is_default, rules=body.rules.model_dump())
    db.add(policy)
    db.flush()
    if policy.is_default:
        set_default_policy(db, user.tenant_id, policy.id)
    db.commit()
    return policy


@router.put("/policies/{policy_id}", response_model=PolicyOut)
def update_policy(policy_id: str, body: PolicyUpdate, user: User = Depends(require_role("admin")),
                  db: Session = Depends(get_db)):
    policy = _get_owned(db, Policy, policy_id, user.tenant_id)
    changes = body.model_dump(exclude_unset=True)
    if body.rules is not None:
        policy.rules = body.rules.model_dump()
        policy.version += 1
    if changes.get("is_default") is False and policy.is_default:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Make another policy the default instead")
    for field in ("name", "description", "is_default"):
        if field in changes:
            setattr(policy, field, changes[field])
    if policy.is_default:
        set_default_policy(db, user.tenant_id, policy.id)
    db.commit()
    return policy


@router.delete("/policies/{policy_id}", status_code=204)
def delete_policy(policy_id: str, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    policy = _get_owned(db, Policy, policy_id, user.tenant_id)
    if policy.is_default:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The default policy cannot be deleted")
    for group in db.scalars(select(Group).where(Group.policy_id == policy.id)):
        group.policy_id = None
    db.delete(policy)
    db.commit()
    return Response(status_code=204)


# --- groups -----------------------------------------------------------------

def _group_out(db: Session, group: Group) -> GroupOut:
    count = db.scalar(select(func.count()).select_from(Device).where(Device.group_id == group.id,
                                                                     Device.status == "active"))
    return GroupOut.model_validate(group).model_copy(update={"device_count": count or 0})


def _check_policy(db: Session, policy_id: str | None, tenant_id: str) -> None:
    if policy_id is not None:
        _get_owned(db, Policy, policy_id, tenant_id)


@router.get("/groups", response_model=list[GroupOut])
def list_groups(user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    groups = db.scalars(select(Group).where(Group.tenant_id == user.tenant_id).order_by(Group.name)).all()
    return [_group_out(db, g) for g in groups]


@router.post("/groups", response_model=GroupOut, status_code=201)
def create_group(body: GroupIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    _check_policy(db, body.policy_id, user.tenant_id)
    if db.scalar(select(Group).where(Group.tenant_id == user.tenant_id, Group.name == body.name)):
        raise HTTPException(status.HTTP_409_CONFLICT, "A group with this name exists")
    group = Group(tenant_id=user.tenant_id, **body.model_dump())
    db.add(group)
    db.commit()
    return _group_out(db, group)


@router.patch("/groups/{group_id}", response_model=GroupOut)
def update_group(group_id: str, body: GroupUpdate, user: User = Depends(require_role("admin")),
                 db: Session = Depends(get_db)):
    group = _get_owned(db, Group, group_id, user.tenant_id)
    changes = body.model_dump(exclude_unset=True)
    if "policy_id" in changes:
        _check_policy(db, changes["policy_id"], user.tenant_id)
    for field, value in changes.items():
        setattr(group, field, value)
    db.commit()
    return _group_out(db, group)


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: str, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    group = _get_owned(db, Group, group_id, user.tenant_id)
    for device in db.scalars(select(Device).where(Device.group_id == group.id)):
        device.group_id = None
    db.delete(group)
    db.commit()
    return Response(status_code=204)


# --- tool catalog -----------------------------------------------------------

def _tool_out(tool: AITool) -> ToolOut:
    return ToolOut.model_validate(tool).model_copy(update={"builtin": tool.tenant_id is None})


@router.get("/tools", response_model=list[ToolOut])
def list_tools(user: User = Depends(tenant_user), db: Session = Depends(get_db)):
    return [_tool_out(t) for t in tools_for_tenant(db, user.tenant_id)]


@router.post("/tools", response_model=ToolOut, status_code=201)
def create_tool(body: ToolIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    if db.scalar(select(AITool).where(AITool.tenant_id == user.tenant_id, AITool.key == body.key)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Tool key already exists")
    tool = AITool(tenant_id=user.tenant_id, **body.model_dump())
    tool.domains = [d.strip().lower() for d in tool.domains if d.strip()]
    db.add(tool)
    db.commit()
    return _tool_out(tool)


@router.put("/tools/{tool_id}", response_model=ToolOut)
def update_tool(tool_id: int, body: ToolIn, user: User = Depends(require_role("admin")),
                db: Session = Depends(get_db)):
    tool = _get_owned(db, AITool, tool_id, user.tenant_id)
    for field, value in body.model_dump().items():
        setattr(tool, field, value)
    tool.domains = [d.strip().lower() for d in tool.domains if d.strip()]
    db.commit()
    return _tool_out(tool)


@router.delete("/tools/{tool_id}", status_code=204)
def delete_tool(tool_id: int, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    db.delete(_get_owned(db, AITool, tool_id, user.tenant_id))
    db.commit()
    return Response(status_code=204)
