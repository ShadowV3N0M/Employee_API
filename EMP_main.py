"""
Backward-compatibility facade for the modular Employee Management API.

The monolithic EMP_main.py has been refactored into the modular `app/` package.
This module re-exports all app objects, models, schemas, services, and auth utilities
so that existing test suites, migration scripts, and seeders continue working without modification.

Recommended modern entrypoint:
    uvicorn app.main:app --reload
"""
from app.schemas import (
    BulkEmployeeDelete,
    BulkSalaryIncrement,
    ChangePasswordRequest,
    DepartmentBulkCreate,
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    Employee,
    EmployeeUpdate,
    ForgotPasswordRequest,
    ResetPasswordConfirm,
    RoleUpdate,
    SalaryIncrement,
    SalarySet,
    Token,
    UserCreateAdmin,
    UserRegister,
    UserStatusUpdate,
)
from app.models import (
    DepartmentDB,
    EmployeeDB,
    PasswordResetTokenDB,
    SalaryHistoryDB,
    UserDB,
)
from app.main import app, create_app
from app.database import (
    Base,
    SessionLocal,
    auto_migrate_schema,
    engine,
    get_db,
)
from app.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    CORS_ORIGINS,
    DATABASE_URL,
    EMAIL_DOMAIN,
    FRONTEND_URL,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TLS,
    SMTP_USER,
    limiter,
)
from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    oauth2_scheme,
    pwd_context,
    require_admin,
    require_manager_or_admin,
    require_roles,
    verify_password,
)
import os
import sys
from pathlib import Path

# Ensure package root is at the top of sys.path BEFORE any application imports
_current_dir = str(Path(__file__).resolve().parent)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

# Configuration & Rate Limiting

# Database & Engine

# Main Application & Lifecycles

# SQLAlchemy Database Models

# Ensure package root is at the top of sys.path BEFORE any application imports
_current_dir = str(Path(__file__).resolve().parent)
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

# Configuration & Rate Limiting

# Database & Engine

# Main Application & Lifecycles

# SQLAlchemy Database Models

# Pydantic Schemas

# Authentication & Security

# Aliases for exact backwards compatibility
req_admin = require_admin
req_manager_or_admin = require_manager_or_admin

# Business Logic Services

__all__ = [
    "app",
    "create_app",
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "auto_migrate_schema",
    "SECRET_KEY",
    "ALGORITHM",
    "ACCESS_TOKEN_EXPIRE_MINUTES",
    "DATABASE_URL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
    "SMTP_TLS",
    "FRONTEND_URL",
    "PASSWORD_RESET_TOKEN_EXPIRE_MINUTES",
    "EMAIL_DOMAIN",
    "CORS_ORIGINS",
    "limiter",
    "DepartmentDB",
    "EmployeeDB",
    "SalaryHistoryDB",
    "UserDB",
    "PasswordResetTokenDB",
    "DepartmentCreate",
    "DepartmentResponse",
    "DepartmentUpdate",
    "DepartmentBulkCreate",
    "Employee",
    "EmployeeUpdate",
    "SalarySet",
    "SalaryIncrement",
    "BulkEmployeeDelete",
    "BulkSalaryIncrement",
    "UserRegister",
    "RoleUpdate",
    "ChangePasswordRequest",
    "UserStatusUpdate",
    "Token",
    "ForgotPasswordRequest",
    "ResetPasswordConfirm",
    "pwd_context",
    "oauth2_scheme",
    "hash_password",
    "verify_password",
    "create_access_token",
    "get_current_user",
    "require_roles",
    "require_admin",
    "require_manager_or_admin",
    "req_admin",
    "req_manager_or_admin",
    "VALID_ROLES",
    "generate_employee_email",
    "send_password_reset_email",
    "employee_view",
    "SORTABLE_FIELDS",
    "parse_spreadsheet_data",
    "import_employees_from_records",
    "generate_sample_csv_template",
    "parse_ids_or_emails_for_deletion",
    "export_employees_to_csv",
]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
