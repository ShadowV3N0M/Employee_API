"""Tests for official reports and PDF generation endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.employee import EmployeeDB
from app.models.user import UserDB
from app.auth.security import create_access_token


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(db_session):
    admin_user = db_session.query(UserDB).filter(UserDB.role == "admin").first()
    return create_access_token({"sub": admin_user.username, "role": "admin"})


@pytest.fixture
def regular_user_token(db_session):
    reg_user = db_session.query(UserDB).filter(UserDB.role == "user").first()
    if not reg_user:
        # Fallback if no user role exists
        return None
    return create_access_token({"sub": reg_user.username, "role": "user"})


@pytest.fixture
def sample_emp_id(db_session):
    emp = db_session.query(EmployeeDB).first()
    return emp.Emp_ID if emp else 1


def test_payslip_pdf_as_admin(client, admin_token, sample_emp_id):
    """Admin can generate official payslip PDF for any employee."""
    res = client.get(
        f"/reports/payslip/{sample_emp_id}/pdf?month=October&year=2026",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 1000


def test_employee_directory_pdf_as_admin(client, admin_token):
    """Admin can generate company-wide employee directory PDF."""
    res = client.get(
        "/reports/employees/pdf?status=all",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 1000


def test_department_budget_pdf_as_admin(client, admin_token):
    """Admin can generate executive department budget PDF statement."""
    res = client.get(
        "/reports/departments/pdf",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 1000


def test_salary_revision_letter_pdf_as_admin(client, admin_token, sample_emp_id):
    """Admin can generate formal salary revision notice PDF."""
    res = client.get(
        f"/reports/salary-revisions/{sample_emp_id}/pdf",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert len(res.content) > 1000


def test_unauthenticated_access_blocked(client, sample_emp_id):
    """Unauthenticated requests must be rejected with 401."""
    res = client.get(f"/reports/payslip/{sample_emp_id}/pdf")
    assert res.status_code == 401


def test_department_budget_forbidden_for_regular_user(client, regular_user_token):
    """Regular employees cannot access department budget statements."""
    if not regular_user_token:
        pytest.skip("No regular user account in DB")
    res = client.get(
        "/reports/departments/pdf",
        headers={"Authorization": f"Bearer {regular_user_token}"},
    )
    assert res.status_code == 403
