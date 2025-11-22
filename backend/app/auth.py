import secrets
from datetime import datetime, timedelta
import smtplib
from email.message import EmailMessage
from authlib.integrations.starlette_client import OAuth
from httpx import HTTPError
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
SSO_CLIENT_NAME = "authentik"
_sso_client_registered = False
if settings.sso_enabled:
    register_kwargs = {
        "name": SSO_CLIENT_NAME,
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
    _sso_client_registered = True


def _is_sso_available() -> bool:
    return settings.sso_enabled and _sso_client_registered


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

    expires_delta = None
    if payload.remember:
        expires_delta = timedelta(days=settings.remember_me_expire_days)

    token = create_access_token(str(user.id), expires_delta=expires_delta)
    return schemas.TokenResponse(access_token=token)

@router.get("/config", response_model=schemas.AuthConfigResponse)
def auth_config():
    return schemas.AuthConfigResponse(
        enable_sso=_is_sso_available(),
        oidc_provider_name=settings.oidc_provider_name,
    )



@router.post("/forgot", response_model=schemas.MessageResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_password = secrets.token_urlsafe(8)
    user.password_hash = get_password_hash(new_password)
    db.add(user)
    db.commit()

    try:
        _send_email(
            to_address=payload.email,
            subject="Your FarmWith password has been reset",
            body=(
                "Hello,\n\n"
                "Your password has been reset by an administrator.\n"
                f"New password: {new_password}\n\n"
                "Please sign in and update your password if needed."
            ),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # pragma: no cover - network errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to send reset email",
        ) from exc

    return schemas.MessageResponse(detail="Password reset email sent")


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/sso/login")
async def sso_login(request: Request):
    if not _is_sso_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SSO is disabled or misconfigured"
        )

    redirect_uri = f"{settings.backend_url}/auth/sso/callback"
    try:
        return await oauth.create_client(SSO_CLIENT_NAME).authorize_redirect(request, redirect_uri)
    except HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO provider is unavailable",
        ) from exc


@router.get("/sso/callback")
async def sso_callback(request: Request, db: Session = Depends(get_db)):
    if not _is_sso_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SSO is disabled or misconfigured"
        )

    client = oauth.create_client(SSO_CLIENT_NAME)
    try:
        token = await client.authorize_access_token(request)
    except HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO provider is unavailable",
        ) from exc
    if token is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SSO authorization failed")

    userinfo = token.get("userinfo")
    if userinfo is None:
        try:
            userinfo = await client.parse_id_token(request, token)
        except HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SSO provider is unavailable",
            ) from exc

    email = userinfo.get("email")
    subject = userinfo.get("sub") or secrets.token_hex(16)

    if email is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email not provided by identity provider")

    user = _get_user_by_email(db, email)
    if user is None:
        # Some databases enforce a NOT NULL constraint on password_hash; use a
        # placeholder so SSO-only accounts can be created without local
        # credentials.
        user = models.User(
            username=email,
            password_hash="sso-placeholder",
            auth_method="oidc",
        )
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


def _send_email(*, to_address: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP settings are not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
