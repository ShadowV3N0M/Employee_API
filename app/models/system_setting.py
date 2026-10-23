"""System setting and portal configuration model."""
from sqlalchemy import Column, String, DateTime, func
from app.database import Base


class SystemSettingDB(Base):
    __tablename__ = "system_setting"

    key = Column(String(50), primary_key=True, index=True)
    value = Column(String(255), nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

