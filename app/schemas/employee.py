"""Employee and Salary Pydantic schemas."""
from datetime import date
from typing import Optional, Union
from pydantic import BaseModel


class Employee(BaseModel):
    Emp_ID: int
    F_Name: str
    L_Name: str
    Salary: float
    Dept_ID: int
    Address: str
    joining_date: Optional[Union[str, date]] = None


class EmployeeUpdate(BaseModel):
    F_Name: Optional[str] = None
    L_Name: Optional[str] = None
    Salary: Optional[float] = None
    Dept_ID: Optional[int] = None
    Address: Optional[str] = None


class SalarySet(BaseModel):
    new_salary: float


class SalaryIncrement(BaseModel):
    amount: float  # positive for raise, negative for cut


class BulkEmployeeDelete(BaseModel):
    emp_ids: list[int]
    # False = soft delete (deactivate), True = hard delete from DB
    hard_delete: bool = False


class BulkSalaryIncrement(BaseModel):
    # Fixed dollar/INR increase, e.g. 5000.00
    amount: Optional[float] = None
    # Percentage raise, e.g. 10.0 for +10%
    percentage: Optional[float] = None
    dept_id: Optional[int] = None           # Optional filter by department ID
    # Optional filter by specific employee IDs
    emp_ids: Optional[list[int]] = None


class SalaryCalculateRequest(BaseModel):
    annual_ctc: float
    is_metro: bool = False
    pf_capped: bool = True
    regime: str = "new"  # "new" or "old"
    deductions_80c: float = 150000.0
    deductions_80d: float = 25000.0
