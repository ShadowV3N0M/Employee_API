"""Employee and Salary History SQLAlchemy models."""
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class EmployeeDB(Base):
    __tablename__ = "employee"

    Emp_ID = Column(Integer, primary_key=True, nullable=False)
    F_Name = Column(String(50), nullable=False)
    L_Name = Column(String(50), nullable=False)
    Salary = Column(Numeric(20, 2), nullable=False)
    Dept_ID = Column(Integer, ForeignKey("department.Dept_ID"), nullable=False)
    Address = Column(String(500), nullable=False)
    Email = Column(String(100), unique=True, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    department = relationship("DepartmentDB", back_populates="employees")
    salary_history = relationship("SalaryHistoryDB", back_populates="employee")


class SalaryHistoryDB(Base):
    __tablename__ = "salary_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    Emp_ID = Column(Integer, ForeignKey("employee.Emp_ID"), nullable=False)
    old_salary = Column(Numeric(20, 2), nullable=False)
    new_salary = Column(Numeric(20, 2), nullable=False)
    changed_by = Column(String(50), nullable=True)
    changed_at = Column(DateTime, server_default=func.now())

    employee = relationship("EmployeeDB", back_populates="salary_history")
