"""
Employee Management API - Root entrypoint.
Forwards to the modular `app.main` application.

Usage:
    uvicorn main:app --reload
"""
from app.models import (
    DepartmentDB,
    EmployeeDB,
    PasswordResetTokenDB,
    SalaryHistoryDB,
    UserDB,
)
from app.main import app, create_app
from app.database import Base, SessionLocal, engine, get_db
from app.config import limiter
from app.auth import get_current_user, hash_password
import sys
from pathlib import Path

# Ensure package root is at the top of sys.path BEFORE any application imports
_current_dir = str(Path(__file__).resolve().parent)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)


__all__ = [
    "app",
    "create_app",
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "DepartmentDB",
    "EmployeeDB",
    "SalaryHistoryDB",
    "UserDB",
    "PasswordResetTokenDB",
    "hash_password",
    "get_current_user",
    "limiter",
]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
