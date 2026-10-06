"""Pydantic schemas for Employee Self-Service Profile and Emergency Contacts."""
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class EmergencyContactCreate(BaseModel):
    contact_name: str = Field(..., min_length=2, max_length=100, description="Full name of emergency contact")
    relationship_type: str = Field(..., min_length=2, max_length=50, description="e.g. Spouse, Parent, Sibling, Child, Friend, Guardian, Other")
    phone_primary: str = Field(..., min_length=7, max_length=20, description="Primary telephone or mobile number")
    phone_secondary: Optional[str] = Field(None, max_length=20, description="Secondary or alternate telephone number")
    is_primary: bool = Field(False, description="Set as the default primary SOS contact")


class EmergencyContactUpdate(BaseModel):
    contact_name: Optional[str] = Field(None, min_length=2, max_length=100)
    relationship_type: Optional[str] = Field(None, min_length=2, max_length=50)
    phone_primary: Optional[str] = Field(None, min_length=7, max_length=20)
    phone_secondary: Optional[str] = None
    is_primary: Optional[bool] = None


class EmergencyContactOut(BaseModel):
    id: int
    emp_id: int
    contact_name: str
    relationship_type: str
    phone_primary: str
    phone_secondary: Optional[str] = None
    is_primary: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileSelfUpdate(BaseModel):
    """Fields that an employee is authorized to self-manage."""
    personal_phone: Optional[str] = Field(None, max_length=20, description="Personal mobile number")
    blood_group: Optional[str] = Field(None, max_length=10, description="A+, A-, B+, B-, AB+, AB-, O+, O-")
    dob: Optional[date] = Field(None, description="Date of birth (YYYY-MM-DD)")
    marital_status: Optional[str] = Field(None, max_length=20, description="Single, Married, Divorced, Widowed")
    Address: Optional[str] = Field(None, min_length=5, max_length=500, description="Current residential address")


class ProfileOut(BaseModel):
    """Complete self-service profile representation for the authenticated employee."""
    Emp_ID: int
    F_Name: str
    L_Name: str
    Email: Optional[str] = None
    Dept_ID: int
    department_name: Optional[str] = None
    Address: str
    joining_date: Optional[date] = None
    Salary: Optional[float] = None
    is_active: bool
    created_at: Optional[datetime] = None
    
    # Extended personal fields
    personal_phone: Optional[str] = None
    blood_group: Optional[str] = None
    dob: Optional[date] = None
    marital_status: Optional[str] = None
    
    # Linked account metadata
    username: Optional[str] = None
    role: Optional[str] = None
    
    # Emergency Contacts
    emergency_contacts: List[EmergencyContactOut] = []

    class Config:
        from_attributes = True


class LinkUserEmployee(BaseModel):
    user_id: int
    emp_id: int
