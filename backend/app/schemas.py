from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    is_enterprise: bool
    mfa_enabled: bool


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    is_enterprise: bool = False


class UserRead(UserBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MFASetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class MFAVerifyRequest(BaseModel):
    code: str


class AuthConfigResponse(BaseModel):
    enable_sso: bool
    oidc_provider_name: str


class MessageResponse(BaseModel):
    detail: str
