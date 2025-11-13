import secrets
from typing import Optional
from datetime import datetime
import pyotp
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas
from .config import settings
from .database import get_db
from .dependencies import get_current_user
from .security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

oauth = OAuth()
if settings.sso_enabled:
    register_kwargs = {
        "name": "authentik",
        "client_id": settings.oidc_client_id,
        "client_secret": settings.oidc_client_secret,
        "client_kwargs": {"scope": "openid email profile"},
    }
    if settings.oidc_configuration_url:
        register_kwargs["server_metadata_url"] = str(settings.oidc_configuration_url)
    else:
        register_kwargs.update(
            {
                "api_base_url": str(settings.oidc_userinfo_url).rsplit("/", 1)[0]
                if settings.oidc_userinfo_url
                else None,
                "access_token_url": str(settings.oidc_token_url) if settings.oidc_token_url else None,
                "authorize_url": str(settings.oidc_authorize_url) if settings.oidc_authorize_url else None,
                "userinfo_endpoint": str(settings.oidc_userinfo_url) if settings.oidc_userinfo_url else None,
            }
        )
    oauth.register(**{k: v for k, v in register_kwargs.items() if v is not None})


def _get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.username == email).first()

@router.post("/register", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    # Use email as username since Supabase schema uses username field
    user = models.User(
        username=payload.email,  # Store email in username field
        password_hash=get_password_hash(payload.password),
        # Remove is_enterprise if not in database
        # is_enterprise=payload.is_enterprise,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    if user is None or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        # Update login attempts
        user.login_attempts += 1
        user.last_attempt = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Reset login attempts on successful login
    user.login_attempts = 0
    user.last_login = datetime.utcnow()
    db.commit()

    if user.mfa_enabled:
        if not user.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MFA secret missing",
            )
        if not payload.totp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA code required",
            )
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(payload.totp_code, valid_window=1):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    token = create_access_token(str(user.id))
    return schemas.TokenResponse(access_token=token)

@router.get("/config", response_model=schemas.AuthConfigResponse)
def auth_config():
    return schemas.AuthConfigResponse(
        enable_sso=settings.sso_enabled,
        oidc_provider_name=settings.oidc_provider_name,
    )


@router.post("/mfa/setup", response_model=schemas.MFASetupResponse)
def mfa_setup(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.mfa_secret is None:
        current_user.mfa_secret = pyotp.random_base32(length=32)
        db.add(current_user)
        db.commit()
        db.refresh(current_user)

    totp = pyotp.TOTP(current_user.mfa_secret)
    otpauth_url = totp.provisioning_uri(name=current_user.email, issuer_name=settings.app_name)
    return schemas.MFASetupResponse(secret=current_user.mfa_secret, otpauth_url=otpauth_url)


@router.post("/mfa/verify", response_model=schemas.MessageResponse)
def mfa_verify(
    payload: schemas.MFAVerifyRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.mfa_secret is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA is not initialized")

    totp = pyotp.TOTP(current_user.mfa_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA code")

    current_user.mfa_enabled = True
    db.add(current_user)
    db.commit()
    return schemas.MessageResponse(detail="MFA enabled")


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/sso/login")
async def sso_login(request: Request):
    if not settings.sso_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO disabled")

    redirect_uri = f"{settings.backend_url}/auth/sso/callback"
    return await oauth.authentik.authorize_redirect(request, redirect_uri)


@router.get("/sso/callback")
async def sso_callback(request: Request, db: Session = Depends(get_db)):
    if not settings.sso_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO disabled")

    token = await oauth.authentik.authorize_access_token(request)
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO authorization failed")

    userinfo = token.get("userinfo")
    if userinfo is None:
        userinfo = await oauth.authentik.parse_id_token(request, token)

    email = userinfo.get("email")
    subject = userinfo.get("sub") or secrets.token_hex(16)

    if email is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email not provided by identity provider")

    user = _get_user_by_email(db, email)
    if user is None:
        user = models.User(email=email, hashed_password=None, is_enterprise=True)
        db.add(user)
        db.commit()
        db.refresh(user)

    user.mark_sso(settings.oidc_provider_name, subject)
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(str(user.id))
    redirect_url = f"{settings.frontend_url}/sso/callback?token={access_token}"
    return RedirectResponse(url=redirect_url)
