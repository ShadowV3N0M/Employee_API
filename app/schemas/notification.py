"""Pydantic schemas for real-time notifications."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    """Schema returned to client for a notification."""
    id: int
    user_id: int
    title: str
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime
    time_ago: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    """Schema for broadcasting a manual or custom notification (Managers/Admins)."""
    title: str = Field(..., min_length=2, max_length=200)
    message: str = Field(..., min_length=2)
    type: str = Field("info", description="announcement, employee, salary, department, system, info, warning, success")
    link: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = Field(None, description="Optional target role: 'admin', 'manager', 'user'")
    user_id: Optional[int] = Field(None, description="Optional target user ID")
    broadcast: bool = Field(False, description="Send to all active users if true")


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkAllReadResponse(BaseModel):
    marked_count: int
