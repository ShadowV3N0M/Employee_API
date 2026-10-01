"""Department Pydantic schemas."""
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


class DepartmentBulkCreate(BaseModel):
    departments: list[DepartmentCreate]
