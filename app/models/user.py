"""User and Password Reset Token SQLAlchemy models."""
from sqlalchemy import (
    Column, Integer, String, Boolean,
    DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class UserDB(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    # "admin", "manager", "user"
    role = Column(String(20), default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    reset_tokens = relationship(
        "PasswordResetTokenDB",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class PasswordResetTokenDB(Base):
    __tablename__ = "password_reset_token"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey(
        "user.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("UserDB", back_populates="reset_tokens")
