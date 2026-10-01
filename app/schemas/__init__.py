"""Export all Pydantic schemas."""
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DepartmentBulkCreate,
)
from app.schemas.employee import (
    Employee,
    EmployeeUpdate,
    SalarySet,
    SalaryIncrement,
    BulkEmployeeDelete,
    BulkSalaryIncrement,
)
from app.schemas.auth import (
    UserRegister,
    UserCreateAdmin,
    RoleUpdate,
    ChangePasswordRequest,
    UserStatusUpdate,
    Token,
    ForgotPasswordRequest,
    ResetPasswordConfirm,
)

__all__ = [
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
    "UserCreateAdmin",
    "RoleUpdate",
    "ChangePasswordRequest",
    "UserStatusUpdate",
    "Token",
    "ForgotPasswordRequest",
    "ResetPasswordConfirm",
]
