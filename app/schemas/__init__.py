"""Export all Pydantic schemas."""
from app.schemas.department import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DepartmentBulkCreate,
    DepartmentHistoryResponse,
)
from app.schemas.employee import (
    Employee,
    EmployeeUpdate,
    SalarySet,
    SalaryIncrement,
    BulkEmployeeDelete,
    BulkSalaryIncrement,
    SalaryCalculateRequest,
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
    "DepartmentHistoryResponse",
    "Employee",
    "EmployeeUpdate",
    "SalarySet",
    "SalaryIncrement",
    "BulkEmployeeDelete",
    "BulkSalaryIncrement",
    "SalaryCalculateRequest",
    "UserRegister",
    "UserCreateAdmin",
    "RoleUpdate",
    "ChangePasswordRequest",
    "UserStatusUpdate",
    "Token",
    "ForgotPasswordRequest",
    "ResetPasswordConfirm",
]
