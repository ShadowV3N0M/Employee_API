"""Pydantic schemas for Holiday and Announcement modules."""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class HolidayBase(BaseModel):
    name: str = Field(..., max_length=100)
    holiday_date: date
    holiday_type: str = Field(default="National", max_length=50)
    description: Optional[str] = Field(None, max_length=255)


class HolidayCreate(HolidayBase):
    pass


class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    holiday_date: Optional[date] = None
    holiday_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=255)


class HolidayOut(HolidayBase):
    id: int
    created_at: Optional[datetime] = None
    day_of_week: Optional[str] = None
    days_remaining: Optional[int] = None

    class Config:
        from_attributes = True


class BusinessDaysResponse(BaseModel):
    start_date: date
    end_date: date
    total_calendar_days: int
    weekend_days: int
    holiday_days: int
    business_days: int
    holidays: List[HolidayOut] = []


class AnnouncementBase(BaseModel):
    title: str = Field(..., max_length=150)
    content: str
    priority: str = Field(default="general", max_length=20)
    target_dept_id: Optional[int] = None
    is_pinned: bool = False


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=150)
    content: Optional[str] = None
    priority: Optional[str] = Field(None, max_length=20)
    target_dept_id: Optional[int] = None
    is_pinned: Optional[bool] = None


class AnnouncementOut(AnnouncementBase):
    id: int
    published_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    target_dept_name: Optional[str] = None

    class Config:
        from_attributes = True
