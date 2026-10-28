"""Automated tests for Employee Attendance & Time-Tracking module."""
from datetime import date, datetime, timedelta
from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure employee_api directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, get_db
from app.main import app
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB
from app.models.user import UserDB
from app.auth.security import hash_password
from app.config import limiter

# Disable rate limiting in tests
limiter.enabled = False

TEST_DATABASE_URL = "sqlite:///./test_attendance.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed departments
        d1 = DepartmentDB(Dept_ID=1, Dept_Name="Engineering", Budget=500000)
        d2 = DepartmentDB(Dept_ID=2, Dept_Name="Human Resources", Budget=200000)
        db.add_all([d1, d2])

        # Seed employees
        emp1 = EmployeeDB(
            Emp_ID=101,
            F_Name="Aarav",
            L_Name="Sharma",
            Email="aarav.sharma@example.com",
            Salary=850000,
            Dept_ID=1,
            Address="123 Tech Park, Bangalore",
            is_active=True,
        )
        emp2 = EmployeeDB(
            Emp_ID=102,
            F_Name="Meera",
            L_Name="Patel",
            Email="meera.patel@example.com",
            Salary=750000,
            Dept_ID=2,
            Address="456 Corporate Hub, Mumbai",
            is_active=True,
        )
        db.add_all([emp1, emp2])

        # Seed users: admin, manager, user (linked to emp1), unlinked_user
        u_admin = UserDB(
            username="admin_user",
            email="admin@example.com",
            hashed_password=hash_password("adminpass123"),
            role="admin",
            is_active=True,
        )
        u_manager = UserDB(
            username="manager_user",
            email="manager@example.com",
            hashed_password=hash_password("managerpass123"),
            role="manager",
            is_active=True,
        )
        u_employee = UserDB(
            username="aarav",
            email="aarav.sharma@example.com",
            emp_id=101,
            hashed_password=hash_password("userpass123"),
            role="user",
            is_active=True,
        )
        u_unlinked = UserDB(
            username="unlinked",
            email="unlinked@example.com",
            hashed_password=hash_password("unlinkedpass123"),
            role="user",
            is_active=True,
        )
        db.add_all([u_admin, u_manager, u_employee, u_unlinked])
        db.commit()
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=engine)
    if old_override:
        app.dependency_overrides[get_db] = old_override
    else:
        app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def get_token(username, password):
    resp = client.post("/auth/login", data={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]


def test_clock_in_unlinked_user_fails():
    token = get_token("unlinked", "unlinkedpass123")
    resp = client.post(
        "/attendance/clock-in",
        headers={"Authorization": f"Bearer {token}"},
        json={"work_mode": "office"},
    )
    assert resp.status_code == 400
    assert "not linked to an official employee profile" in resp.json()["detail"]


def test_clock_in_success():
    token = get_token("aarav", "userpass123")
    resp = client.post(
        "/attendance/clock-in",
        headers={"Authorization": f"Bearer {token}"},
        json={"work_mode": "office", "notes": "On-time arrival at head office"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["emp_id"] == 101
    assert data["clock_in"] is not None
    assert data["clock_out"] is None
    assert data["work_mode"] == "office"
    assert data["status"] in ("present", "late", "wfh")


def test_clock_in_duplicate_fails():
    token = get_token("aarav", "userpass123")
    resp = client.post(
        "/attendance/clock-in",
        headers={"Authorization": f"Bearer {token}"},
        json={"work_mode": "office"},
    )
    assert resp.status_code == 400
    assert "already clocked in" in resp.json()["detail"].lower()


def test_break_start_and_end():
    token = get_token("aarav", "userpass123")

    # 1. Start break
    resp = client.post(
        "/attendance/break/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"break_type": "lunch", "notes": "Cafeteria lunch"},
    )
    assert resp.status_code == 200
    break_data = resp.json()
    assert break_data["break_type"] == "lunch"
    assert break_data["start_time"] is not None
    assert break_data["end_time"] is None

    # Check live status reflects break
    today_resp = client.get("/attendance/today", headers={"Authorization": f"Bearer {token}"})
    assert today_resp.status_code == 200
    today_data = today_resp.json()
    assert today_data["is_clocked_in"] is True
    assert today_data["is_on_break"] is True
    assert today_data["current_break_type"] == "lunch"

    # Duplicate break start should fail
    dup_resp = client.post(
        "/attendance/break/start",
        headers={"Authorization": f"Bearer {token}"},
        json={"break_type": "tea"},
    )
    assert dup_resp.status_code == 400

    # 2. End break
    end_resp = client.post(
        "/attendance/break/end",
        headers={"Authorization": f"Bearer {token}"},
        json={"notes": "Returned from lunch"},
    )
    assert end_resp.status_code == 200
    ended_data = end_resp.json()
    assert ended_data["end_time"] is not None


def test_clock_out_success():
    token = get_token("aarav", "userpass123")
    resp = client.post(
        "/attendance/clock-out",
        headers={"Authorization": f"Bearer {token}"},
        json={"notes": "Shift ended for the day"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["clock_out"] is not None
    assert "total_hours" in data
    assert "regular_hours" in data
    assert "overtime_hours" in data

    # Verify status in /attendance/today
    today_resp = client.get("/attendance/today", headers={"Authorization": f"Bearer {token}"})
    assert today_resp.status_code == 200
    assert today_resp.json()["is_clocked_out"] is True


def test_my_history_and_summary():
    token = get_token("aarav", "userpass123")

    history_resp = client.get("/attendance/my-history", headers={"Authorization": f"Bearer {token}"})
    assert history_resp.status_code == 200
    history_items = history_resp.json()
    assert len(history_items) >= 1
    assert history_items[0]["emp_id"] == 101

    summary_resp = client.get("/attendance/my-summary", headers={"Authorization": f"Bearer {token}"})
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert "present_days" in summary
    assert "on_time_rate_pct" in summary
    assert "total_work_hours" in summary
    assert summary["present_days"] >= 1


def test_regularization_workflow():
    token_emp = get_token("aarav", "userpass123")
    token_mgr = get_token("manager_user", "managerpass123")

    yesterday = date.today() - timedelta(days=1)
    req_in = datetime.combine(yesterday, datetime.strptime("09:15:00", "%H:%M:%S").time())
    req_out = datetime.combine(yesterday, datetime.strptime("18:15:00", "%H:%M:%S").time())

    # 1. Employee submits regularization request
    submit_resp = client.post(
        "/attendance/regularize",
        headers={"Authorization": f"Bearer {token_emp}"},
        json={
            "attendance_date": yesterday.isoformat(),
            "requested_clock_in": req_in.isoformat(),
            "requested_clock_out": req_out.isoformat(),
            "reason": "VPN connection glitch during morning punch",
        },
    )
    assert submit_resp.status_code == 200
    req_data = submit_resp.json()
    req_id = req_data["id"]
    assert req_data["status"] == "pending"

    # 2. Employee checks their requests
    my_reqs = client.get(
        "/attendance/regularize/my-requests",
        headers={"Authorization": f"Bearer {token_emp}"},
    )
    assert my_reqs.status_code == 200
    assert any(r["id"] == req_id for r in my_reqs.json())

    # 3. Manager lists pending requests
    pending_resp = client.get(
        "/attendance/regularize/pending",
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert pending_resp.status_code == 200
    assert any(r["id"] == req_id for r in pending_resp.json())

    # 4. Manager reviews and approves request
    review_resp = client.post(
        f"/attendance/regularize/{req_id}/review",
        headers={"Authorization": f"Bearer {token_mgr}"},
        json={"status": "approved", "review_notes": "Verified with team lead, approved."},
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "approved"
    assert review_resp.json()["reviewed_by"] == "manager_user"


def test_team_live_roster_and_authorization():
    token_user = get_token("aarav", "userpass123")
    token_mgr = get_token("manager_user", "managerpass123")
    token_admin = get_token("admin_user", "adminpass123")

    # Regular user is forbidden
    resp_user = client.get("/attendance/team-live", headers={"Authorization": f"Bearer {token_user}"})
    assert resp_user.status_code == 403

    # Manager is allowed
    resp_mgr = client.get("/attendance/team-live", headers={"Authorization": f"Bearer {token_mgr}"})
    assert resp_mgr.status_code == 200
    data_mgr = resp_mgr.json()
    assert "total_employees" in data_mgr
    assert "members" in data_mgr
    assert data_mgr["total_employees"] >= 2

    # Admin is allowed
    resp_roster = client.get("/attendance/roster", headers={"Authorization": f"Bearer {token_admin}"})
    assert resp_roster.status_code == 200
    roster_data = resp_roster.json()
    assert "items" in roster_data
    assert "total" in roster_data


def test_admin_manual_attendance_and_delete():
    token_admin = get_token("admin_user", "adminpass123")
    token_user = get_token("aarav", "userpass123")

    target_date = date.today() - timedelta(days=2)
    in_time = datetime.combine(target_date, datetime.strptime("09:00:00", "%H:%M:%S").time())
    out_time = datetime.combine(target_date, datetime.strptime("17:30:00", "%H:%M:%S").time())

    # Regular user forbidden
    forbid_resp = client.post(
        "/attendance/manual",
        headers={"Authorization": f"Bearer {token_user}"},
        json={
            "emp_id": 102,
            "attendance_date": target_date.isoformat(),
            "clock_in": in_time.isoformat(),
            "clock_out": out_time.isoformat(),
            "status": "present",
            "work_mode": "office",
        },
    )
    assert forbid_resp.status_code == 403

    # Admin manual insert
    admin_resp = client.post(
        "/attendance/manual",
        headers={"Authorization": f"Bearer {token_admin}"},
        json={
            "emp_id": 102,
            "attendance_date": target_date.isoformat(),
            "clock_in": in_time.isoformat(),
            "clock_out": out_time.isoformat(),
            "status": "present",
            "work_mode": "office",
            "notes": "Admin verified punch adjustment",
        },
    )
    assert admin_resp.status_code == 200
    rec_id = admin_resp.json()["id"]
    assert admin_resp.json()["emp_id"] == 102

    # Admin delete record
    del_resp = client.delete(
        f"/attendance/{rec_id}",
        headers={"Authorization": f"Bearer {token_admin}"},
    )
    assert del_resp.status_code == 200


def test_csv_and_pdf_exports():
    token = get_token("aarav", "userpass123")

    # CSV Export
    csv_resp = client.get("/attendance/export/csv", headers={"Authorization": f"Bearer {token}"})
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Record ID,Employee ID,Employee Name" in csv_resp.text

    # PDF Export
    pdf_resp = client.get("/attendance/export/pdf", headers={"Authorization": f"Bearer {token}"})
    assert pdf_resp.status_code == 200
    assert "application/pdf" in pdf_resp.headers["content-type"]
    assert pdf_resp.content.startswith(b"%PDF")
