"""Authentication, user, and password reset Pydantic schemas."""
from typing import Optional
from pydantic import BaseModel


class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    identifier: str  # username or email address


class ResetPasswordConfirm(BaseModel):
    token: str
    new_password: str


class RoleUpdate(BaseModel):
    role: str  # "user", "manager", or "admin"


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserStatusUpdate(BaseModel):
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
