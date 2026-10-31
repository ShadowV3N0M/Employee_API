"""Automated tests for PWA Synchronization & Delta Replication."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, get_db
from app.main import app
from app.models.department import DepartmentDB
from app.models.employee import EmployeeDB
from app.models.user import UserDB
from app.auth.security import hash_password
from app.config import limiter

limiter.enabled = False

TEST_SYNC_DB_URL = "sqlite:///./test_sync.db"
engine = create_engine(TEST_SYNC_DB_URL, connect_args={"check_same_thread": False})
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
        # Seed department
        d1 = DepartmentDB(Dept_ID=10, Dept_Name="Sync Engineering", Budget=300000)
        db.add(d1)

        # Seed employee
        emp1 = EmployeeDB(
            Emp_ID=1001,
            F_Name="Sync",
            L_Name="Tester",
            Salary=75000.0,
            Dept_ID=10,
            Address="123 Offline Blvd",
            Email="sync.tester@company.internal",
            is_active=True,
        )
        db.add(emp1)

        # Seed user
        user1 = UserDB(
            username="syncuser",
            hashed_password=hash_password("SyncPass123!"),
            role="user",
            is_active=True,
            emp_id=1001,
        )
        db.add(user1)
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


@pytest.fixture(scope="module")
def auth_headers():
    res = client.post(
        "/auth/login",
        data={"username": "syncuser", "password": "SyncPass123!"},
    )
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_sync_status_unauthenticated():
    """Sync status probe should be publicly reachable for offline connectivity checks."""
    res = client.get("/sync/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["pwa_ready"] is True
    assert "server_time" in data
    assert data["api_version"] == "2.6"


def test_sync_delta_requires_authentication():
    """Delta synchronization requires valid JWT token."""
    res = client.get("/sync/delta")
    assert res.status_code == 401


def test_sync_delta_success(auth_headers):
    """Delta synchronization returns full payload with ETag header."""
    res = client.get("/sync/delta", headers=auth_headers)
    assert res.status_code == 200
    assert "ETag" in res.headers
    etag = res.headers["ETag"]
    assert etag.startswith('"') and etag.endswith('"')

    data = res.json()
    assert "server_time" in data
    assert "etag" in data
    assert "counts" in data
    assert data["counts"]["total_employees"] >= 1
    assert "delta" in data
    assert len(data["delta"]["employees"]) >= 1
    assert len(data["delta"]["departments"]) >= 1


def test_sync_delta_etag_304(auth_headers):
    """Sending matching If-None-Match should return 304 Not Modified."""
    first_res = client.get("/sync/delta", headers=auth_headers)
    assert first_res.status_code == 200
    etag = first_res.headers["ETag"]

    # Request with matching If-None-Match
    cached_res = client.get(
        "/sync/delta",
        headers={**auth_headers, "If-None-Match": etag},
    )
    assert cached_res.status_code == 304
    assert cached_res.text == ""


def test_sync_delta_since_filter(auth_headers):
    """Passing a future 'since' timestamp should return an empty employees delta."""
    future_time = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    res = client.get(f"/sync/delta?since={future_time}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["delta"]["employees"]) == 0
