"""Export all SQLAlchemy models."""
from app.database import Base
from app.models.department import DepartmentDB, DepartmentHistoryDB
from app.models.employee import EmployeeDB, SalaryHistoryDB, EmergencyContactDB
from app.models.user import UserDB, PasswordResetTokenDB
from app.models.holiday import HolidayDB, AnnouncementDB
from app.models.notification import NotificationDB

__all__ = [
    "Base",
    "DepartmentDB",
    "DepartmentHistoryDB",
    "EmployeeDB",
    "SalaryHistoryDB",
    "EmergencyContactDB",
    "UserDB",
    "PasswordResetTokenDB",
    "HolidayDB",
    "AnnouncementDB",
    "NotificationDB",
]
