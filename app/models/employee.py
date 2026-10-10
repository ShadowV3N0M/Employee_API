"""Employee and Salary History SQLAlchemy models."""
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean,
    DateTime, Date, ForeignKey, func
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
    joining_date = Column(Date, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    # Extended Self-Service Personal Attributes
    personal_phone = Column(String(20), nullable=True)
    # A+, A-, B+, B-, AB+, AB-, O+, O-
    blood_group = Column(String(10), nullable=True)
    dob = Column(Date, nullable=True)  # Date of birth
    # Single, Married, Divorced, Widowed
    marital_status = Column(String(20), nullable=True)

    department = relationship("DepartmentDB", back_populates="employees")
    salary_history = relationship("SalaryHistoryDB", back_populates="employee")
    emergency_contacts = relationship(
        "EmergencyContactDB",
        back_populates="employee",
        cascade="all, delete-orphan",
        order_by="desc(EmergencyContactDB.is_primary), EmergencyContactDB.id.asc()",
    )


class SalaryHistoryDB(Base):
    __tablename__ = "salary_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    Emp_ID = Column(Integer, ForeignKey("employee.Emp_ID"), nullable=False)
    old_salary = Column(Numeric(20, 2), nullable=False)
    new_salary = Column(Numeric(20, 2), nullable=False)
    changed_by = Column(String(50), nullable=True)
    changed_at = Column(DateTime, server_default=func.now())

    employee = relationship("EmployeeDB", back_populates="salary_history")


class EmergencyContactDB(Base):
    """Emergency contacts directory for employees (SOS contact cards)."""
    __tablename__ = "employee_emergency_contact"

    id = Column(Integer, primary_key=True, autoincrement=True)
    emp_id = Column(
        Integer,
        ForeignKey("employee.Emp_ID", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_name = Column(String(100), nullable=False)
    # "Spouse", "Parent", "Sibling", "Child", "Friend", "Guardian", "Other"
    relationship_type = Column(String(50), nullable=False)
    phone_primary = Column(String(20), nullable=False)
    phone_secondary = Column(String(20), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(),
                        onupdate=func.now())

    employee = relationship("EmployeeDB", back_populates="emergency_contacts")
