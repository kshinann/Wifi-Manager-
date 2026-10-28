from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..models import Policy, Tenant, User, utcnow
from ..policy_schema import default_rules
from ..schemas import LoginIn, SignupIn, TenantOut, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password
from ..services import slugify

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token_response(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut.model_validate(user),
        tenant=TenantOut.model_validate(user.tenant) if user.tenant else None,
    )


def create_tenant(db: Session, company_name: str, owner_name: str, email: str, password: str) -> User:
    if db.scalar(select(User).where(func.lower(User.email) == email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    base = slugify(company_name)
    slug, n = base, 1
    while db.scalar(select(Tenant).where(Tenant.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    tenant = Tenant(name=company_name, slug=slug)
    db.add(tenant)
    db.flush()
    db.add(Policy(tenant_id=tenant.id, name="Default policy", description="Applies to devices without a group policy.",
                  is_default=True, rules=default_rules()))
    owner = User(tenant_id=tenant.id, email=email.lower(), name=owner_name,
                 password_hash=hash_password(password), role="owner")
    db.add(owner)
    db.commit()
    db.refresh(owner)
    return owner


@router.post("/signup", response_model=TokenOut, status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    if not settings.allow_signup:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Self-service signup is disabled")
    owner = create_tenant(db, body.company_name, body.name, body.email, body.password)
    return _token_response(owner)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if user.tenant is not None and not user.tenant.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tenant is suspended")
    user.last_login_at = utcnow()
    db.commit()
    return _token_response(user)


@router.get("/me", response_model=TokenOut)
def me(user: User = Depends(current_user)):
    return _token_response(user)
