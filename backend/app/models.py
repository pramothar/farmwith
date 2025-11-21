from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, BigInteger
from sqlalchemy.sql import func

from .database import Base

class User(Base):
    __tablename__ = "users"

    # Supabase uses BigInt auto-incrementing ID, not UUID
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    # Supabase uses 'username' instead of 'email' as the main field
    username = Column(String(255), unique=True, index=True, nullable=False)
    
    # Supabase uses 'password_hash' instead of 'hashed_password'
    password_hash = Column(String(255), nullable=True)
    
    # Login tracking
    login_attempts = Column(Integer, default=0)
    last_attempt = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # OIDC fields
    oidc_sub = Column(String(255), nullable=True)
    oidc_issuer = Column(String(255), nullable=True)
    oidc_email = Column(String(255), nullable=True)
    auth_method = Column(String(50), default='local')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def mark_sso(self, provider: str, subject: str) -> None:
        self.auth_provider = provider
        self.oidc_sub = subject
        self.auth_method = 'oidc'

    # Property to maintain compatibility with your existing code
    @property
    def email(self):
        return self.username

    @property
    def hashed_password(self):
        return self.password_hash
