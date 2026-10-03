"""Department Pydantic schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DepartmentCreate(BaseModel):
    Dept_Name: str
    Budget: Optional[float] = None


class DepartmentResponse(BaseModel):
    Dept_ID: int
    Dept_Name: str
    Budget: Optional[float] = None

    class Config:
        from_attributes = True


class DepartmentUpdate(BaseModel):
    Dept_Name: Optional[str] = None
    Budget: Optional[float] = None
    notes: Optional[str] = None


class DepartmentBulkCreate(BaseModel):
    departments: list[DepartmentCreate]


class DepartmentHistoryResponse(BaseModel):
    id: int
    Dept_ID: Optional[int] = None
    Dept_Name: str
    old_budget: Optional[float] = None
    new_budget: Optional[float] = None
    old_name: Optional[str] = None
    new_name: Optional[str] = None
    change_type: str
    notes: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime

    class Config:
        from_attributes = True
