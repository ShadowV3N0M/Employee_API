"""Department SQLAlchemy model."""
from sqlalchemy import Column, Integer, String, Numeric
from sqlalchemy.orm import relationship
from app.database import Base


class DepartmentDB(Base):
    __tablename__ = "department"

    Dept_ID = Column(Integer, primary_key=True, autoincrement=True)
    Dept_Name = Column(String(50), unique=True, nullable=False)
    Budget = Column(Numeric(18, 2), nullable=True)

    employees = relationship("EmployeeDB", back_populates="department")
