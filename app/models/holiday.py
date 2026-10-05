"""Holiday and Announcement SQLAlchemy models."""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean,
    DateTime, Date, ForeignKey, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class HolidayDB(Base):
    __tablename__ = "holiday"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    holiday_date = Column(Date, nullable=False, index=True)
    holiday_type = Column(String(50), default="National", nullable=False)  # "National", "Festival", "Company", "Optional"
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class AnnouncementDB(Base):
    __tablename__ = "announcement"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(150), nullable=False)
    content = Column(Text, nullable=False)
    priority = Column(String(20), default="general", nullable=False)  # "urgent", "important", "general", "event"
    target_dept_id = Column(Integer, ForeignKey("department.Dept_ID"), nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    published_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    department = relationship("DepartmentDB")
