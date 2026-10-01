"""Export all SQLAlchemy models."""
from app.database import Base
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB, SalaryHistoryDB
from app.models.user import UserDB, PasswordResetTokenDB

__all__ = [
    "Base",
    "DepartmentDB",
    "EmployeeDB",
    "SalaryHistoryDB",
    "UserDB",
    "PasswordResetTokenDB",
]
