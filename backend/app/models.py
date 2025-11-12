import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(512), nullable=True)
    is_enterprise = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(64), nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    auth_provider = Column(String(128), nullable=True)
    auth_provider_subject = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def mark_sso(self, provider: str, subject: str) -> None:
        self.auth_provider = provider
        self.auth_provider_subject = subject
        self.is_enterprise = True
