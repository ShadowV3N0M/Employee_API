"""Department and Department History SQLAlchemy models."""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class DepartmentDB(Base):
    __tablename__ = "department"

    Dept_ID = Column(Integer, primary_key=True, autoincrement=True)
    Dept_Name = Column(String(50), unique=True, nullable=False)
    Budget = Column(Numeric(20, 2), nullable=True)

    employees = relationship("EmployeeDB", back_populates="department")


class DepartmentHistoryDB(Base):
    __tablename__ = "department_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    Dept_ID = Column(Integer, ForeignKey("department.Dept_ID"), nullable=True)
    Dept_Name = Column(String(50), nullable=False)
    old_budget = Column(Numeric(18, 2), nullable=True)
    new_budget = Column(Numeric(18, 2), nullable=True)
    old_name = Column(String(50), nullable=True)
    new_name = Column(String(50), nullable=True)
    # "CREATED", "BUDGET_REVISED", "NAME_CHANGED", "NAME_AND_BUDGET_UPDATED", "DELETED"
    change_type = Column(String(30), nullable=False)
    notes = Column(String(255), nullable=True)
    changed_by = Column(String(50), nullable=True)
    changed_at = Column(DateTime, server_default=func.now())
