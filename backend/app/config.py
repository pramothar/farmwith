from functools import lru_cache
from typing import Optional

from pydantic import AnyHttpUrl, BaseSettings, Field, validator


class Settings(BaseSettings):
    app_name: str = "FarmWith Auth API"
    database_url: str = Field(..., env="DATABASE_URL")
    jwt_secret_key: str = Field(..., env="JWT_SECRET_KEY")
    session_secret_key: str = Field(..., env="SESSION_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)

    enable_sso: bool = Field(default=False, env="ENABLE_SSO")
    oidc_provider_name: str = Field(default="Authentik", env="OIDC_PROVIDER_NAME")
    oidc_client_id: Optional[str] = Field(default=None, env="OIDC_CLIENT_ID")
    oidc_client_secret: Optional[str] = Field(default=None, env="OIDC_CLIENT_SECRET")
    oidc_configuration_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_CONFIGURATION_URL")
    oidc_authorize_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_AUTHORIZE_URL")
    oidc_token_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_TOKEN_URL")
    oidc_userinfo_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_USERINFO_URL")
    oidc_logout_url: Optional[AnyHttpUrl] = Field(default=None, env="OIDC_LOGOUT_URL")

    frontend_url: AnyHttpUrl = Field(default="http://15.207.115.64:5173", env="FRONTEND_URL")
    backend_url: AnyHttpUrl = Field(default="http://15.207.115.64:8001", env="BACKEND_URL")

    class Config:
        env_file = ".env"
        case_sensitive = False

    @validator("oidc_client_id", "oidc_client_secret", pre=True)
    def empty_str_to_none(cls, v):  # type: ignore[override]
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @validator(
        "oidc_configuration_url",
        "oidc_authorize_url",
        "oidc_token_url",
        "oidc_userinfo_url",
        "oidc_logout_url",
        pre=True,
    )
    def allow_empty_urls(cls, v):  # type: ignore[override]
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @property
    def sso_enabled(self) -> bool:
        if not self.enable_sso:
            return False
        return bool(
            self.oidc_client_id
            and self.oidc_client_secret
            and (
                self.oidc_configuration_url
                or (
                    self.oidc_authorize_url
                    and self.oidc_token_url
                    and self.oidc_userinfo_url
                )
            )
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
