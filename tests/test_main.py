import sys
from pathlib import Path

# Ensure employee_api directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from EMP_main import app, Base, get_db, UserDB, hash_password, limiter



# Rate limits are covered by production config, not these tests
limiter.enabled = False

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={
                       "check_same_thread": False})
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def make_user(username, password, role):
    """Seed a user straight into the DB (registration can only create plain users)."""
    db = TestingSessionLocal()
    try:
        if not db.query(UserDB).filter(UserDB.username == username).first():
            db.add(UserDB(
                username=username,
                hashed_password=hash_password(password),
                role=role
            ))
            db.commit()
    finally:
        db.close()


def token_for(role, password="testpass123"):
    username = f"{role}_tester"
    make_user(username, password, role)

    response = client.post(
        "/auth/login", data={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def headers_for(role):
    return {"Authorization": f"Bearer {token_for(role)}"}


def get_admin_token():
    return token_for("admin")


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_register_and_login():
    response = client.post("/auth/register", json={
        "username": "regular_user",
        "password": "somepassword"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_duplicate_registration_fails():
    client.post("/auth/register", json={
        "username": "dupe_user",
        "password": "pass123"
    })
    response = client.post("/auth/register", json={
        "username": "dupe_user",
        "password": "pass123"
    })
    assert response.status_code == 409


def test_create_employee_requires_admin():
    # No token at all
    response = client.post("/employees", json={
        "Emp_ID": 1, "F_Name": "John", "L_Name": "Doe",
        "Salary": 50000, "Dept_ID": 1, "Address": "123 Street"
    })
    assert response.status_code == 401


def test_full_employee_lifecycle():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept_resp = client.post(
        "/departments",
        json={"Dept_Name": "Engineering", "Budget": 500000},
        headers=headers
    )
    assert dept_resp.status_code == 200
    dept_id = dept_resp.json()["Dept_ID"]

    create_resp = client.post(
        "/employees",
        json={
            "Emp_ID": 101, "F_Name": "Jane", "L_Name": "Smith",
            "Salary": 75000, "Dept_ID": dept_id, "Address": "456 Avenue"
        },
        headers=headers
    )
    assert create_resp.status_code == 200

    get_resp = client.get("/employees/101", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["F_Name"] == "Jane"

    # Give a raise - should log to salary history
    patch_resp = client.patch(
        "/employees/101",
        json={"Salary": 82000},
        headers=headers
    )
    assert patch_resp.status_code == 200

    history_resp = client.get("/employees/101/salary-history", headers=headers)
    assert history_resp.status_code == 200
    assert len(history_resp.json()) == 2
    assert any(float(h["old_salary"]) == 75000 for h in history_resp.json())

    # Soft delete
    delete_resp = client.delete("/employees/101", headers=headers)
    assert delete_resp.status_code == 200

    list_resp = client.get("/employees", headers=headers)
    assert all(e["Emp_ID"] != 101 for e in list_resp.json()["items"])

    list_inactive_resp = client.get(
        "/employees?include_inactive=true", headers=headers)
    assert any(e["Emp_ID"] == 101 for e in list_inactive_resp.json()["items"])


def test_dedicated_salary_endpoints():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept_resp = client.post(
        "/departments",
        json={"Dept_Name": "Marketing", "Budget": 100000},
        headers=headers
    )
    dept_id = dept_resp.json()["Dept_ID"]

    client.post(
        "/employees",
        json={
            "Emp_ID": 202, "F_Name": "Alex", "L_Name": "Rao",
            "Salary": 40000, "Dept_ID": dept_id, "Address": "789 Lane"
        },
        headers=headers
    )

    # Set an exact new salary
    set_resp = client.put(
        "/employees/202/salary",
        json={"new_salary": 45000},
        headers=headers
    )
    assert set_resp.status_code == 200
    assert float(set_resp.json()["employee"]["Salary"]) == 45000

    # Give a raise via increment
    incr_resp = client.post(
        "/employees/202/salary/increment",
        json={"amount": 5000},
        headers=headers
    )
    assert incr_resp.status_code == 200
    assert float(incr_resp.json()["employee"]["Salary"]) == 50000

    # A cut via negative increment
    cut_resp = client.post(
        "/employees/202/salary/increment",
        json={"amount": -2000},
        headers=headers
    )
    assert cut_resp.status_code == 200
    assert float(cut_resp.json()["employee"]["Salary"]) == 48000

    # History should have all 3 changes logged
    history_resp = client.get("/employees/202/salary-history", headers=headers)
    assert history_resp.status_code == 200
    assert len(history_resp.json()) == 4


def test_employee_email_auto_generated():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept_resp = client.post(
        "/departments",
        json={"Dept_Name": "Support", "Budget": 50000},
        headers=headers
    )
    dept_id = dept_resp.json()["Dept_ID"]

    resp1 = client.post(
        "/employees",
        json={
            "Emp_ID": 301, "F_Name": "Sagar", "L_Name": "Pokhariyal",
            "Salary": 40000, "Dept_ID": dept_id, "Address": "1 Road"
        },
        headers=headers
    )
    assert resp1.status_code == 200
    assert resp1.json()["employee"]["Email"] == "sagar.p@laesfera.co"

    # Same first name, same last-initial, DIFFERENT last name
    # -> should extend the last-name prefix instead of a numeric suffix
    resp2 = client.post(
        "/employees",
        json={
            "Emp_ID": 302, "F_Name": "Sagar", "L_Name": "Patil",
            "Salary": 42000, "Dept_ID": dept_id, "Address": "2 Road"
        },
        headers=headers
    )
    assert resp2.status_code == 200
    assert resp2.json()["employee"]["Email"] == "sagar.pa@laesfera.co"


def test_email_collision_extends_lastname_prefix():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept_resp = client.post(
        "/departments",
        json={"Dept_Name": "Ops", "Budget": 30000},
        headers=headers
    )
    dept_id = dept_resp.json()["Dept_ID"]

    def add(emp_id, f_name, l_name):
        resp = client.post(
            "/employees",
            json={
                "Emp_ID": emp_id, "F_Name": f_name, "L_Name": l_name,
                "Salary": 30000, "Dept_ID": dept_id, "Address": "A"
            },
            headers=headers
        )
        assert resp.status_code == 200
        return resp.json()["employee"]["Email"]

    # "p" is free -> takes it
    assert add(401, "Parth", "Patil") == "parth.p@laesfera.co"

    # "p" taken -> a DIFFERENT last name extends to its own next letter, "pa"
    assert add(402, "Parth", "Pandey") == "parth.pa@laesfera.co"

    # Exact same name as 401: "p" and "pa" both taken -> extends to "pat"
    assert add(403, "Parth", "Patil") == "parth.pat@laesfera.co"

    # Exact same name again: "p", "pa", "pat" taken -> extends to "pati"
    assert add(404, "Parth", "Patil") == "parth.pati@laesfera.co"

    # Exact same name again: now the FULL last name "patil" is free -> uses it
    assert add(405, "Parth", "Patil") == "parth.patil@laesfera.co"

    # Exact same name a 5th time: every prefix (p, pa, pat, pati, patil)
    # is now taken -> only now does it fall back to a number
    assert add(406, "Parth", "Patil") == "parth.patil2@laesfera.co"


def test_pagination_params_validated():
    headers = headers_for("admin")

    response = client.get("/employees?page=0", headers=headers)
    assert response.status_code == 400

    response = client.get("/employees?limit=-1", headers=headers)
    assert response.status_code == 400


# =========================================================
# ROLE-BASED ACCESS: user / manager / admin
# =========================================================

def _seed_role_test_data():
    """Department + one employee (Emp_ID 501) created by an admin."""
    admin = headers_for("admin")

    dept = client.post(
        "/departments",
        json={"Dept_Name": "RoleTest", "Budget": 1000},
        headers=admin
    )
    dept_id = dept.json()["Dept_ID"] if dept.status_code == 200 else \
        next(d["Dept_ID"] for d in client.get("/departments", headers=admin).json()
             if d["Dept_Name"] == "RoleTest")

    client.post(
        "/employees",
        json={
            "Emp_ID": 501, "F_Name": "Riya", "L_Name": "Shah",
            "Salary": 60000, "Dept_ID": dept_id, "Address": "Secret Street 5"
        },
        headers=admin
    )
    return dept_id


def test_anonymous_cannot_read_employees():
    assert client.get("/employees").status_code == 401
    assert client.get("/employees/501").status_code == 401
    assert client.get("/departments").status_code == 401


def test_self_registration_cannot_pick_a_role():
    # Try to sneak in as admin - the role field must be ignored
    resp = client.post("/auth/register", json={
        "username": "sneaky", "password": "pass12345", "role": "admin"
    })
    assert resp.status_code == 200

    users = client.get("/auth/users", headers=headers_for("admin")).json()
    sneaky = next(u for u in users if u["username"] == "sneaky")
    assert sneaky["role"] == "user"

    # ...and the resulting token really has no admin powers
    token = resp.json()["access_token"]
    denied = client.post(
        "/departments",
        json={"Dept_Name": "Hacked", "Budget": 1},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert denied.status_code == 403


def test_user_role_is_limited():
    _seed_role_test_data()
    user = headers_for("user")

    # Can read the directory, but without salary / home address
    one = client.get("/employees/501", headers=user)
    assert one.status_code == 200
    assert one.json()["F_Name"] == "Riya"
    assert "Salary" not in one.json()
    assert "Address" not in one.json()

    listing = client.get("/employees", headers=user).json()["items"]
    assert all("Salary" not in e and "Address" not in e for e in listing)

    assert client.get("/departments", headers=user).status_code == 200

    # Cannot write, see salary history, or manage users
    new_emp = {
        "Emp_ID": 599, "F_Name": "No", "L_Name": "Way",
        "Salary": 1, "Dept_ID": 1, "Address": "x"
    }
    assert client.post("/employees", json=new_emp,
                       headers=user).status_code == 403
    assert client.patch(
        "/employees/501", json={"Address": "y"}, headers=user).status_code == 403
    assert client.delete("/employees/501", headers=user).status_code == 403
    assert client.get("/employees/501/salary-history",
                      headers=user).status_code == 403
    assert client.get("/auth/users", headers=user).status_code == 403


def test_manager_role_has_partial_access():
    dept_id = _seed_role_test_data()
    manager = headers_for("manager")

    # Sees the full record, salary included
    one = client.get("/employees/501", headers=manager).json()
    assert float(one["Salary"]) == 60000
    assert one["Address"] == "Secret Street 5"

    # Can hire (create) and edit non-salary details
    created = client.post(
        "/employees",
        json={
            "Emp_ID": 502, "F_Name": "Kabir", "L_Name": "Nair",
            "Salary": 50000, "Dept_ID": dept_id, "Address": "Hire Lane"
        },
        headers=manager
    )
    assert created.status_code == 200

    patched = client.patch(
        "/employees/502", json={"Address": "New Lane"}, headers=manager)
    assert patched.status_code == 200

    # Can view salary history
    assert client.get("/employees/502/salary-history",
                      headers=manager).status_code == 200

    # Cannot change an existing salary - via PATCH, PUT, or the salary endpoints
    assert client.patch(
        "/employees/502", json={"Salary": 99999}, headers=manager).status_code == 403
    assert client.put(
        "/employees/502",
        json={
            "Emp_ID": 502, "F_Name": "Kabir", "L_Name": "Nair",
            "Salary": 99999, "Dept_ID": dept_id, "Address": "New Lane"
        },
        headers=manager
    ).status_code == 403
    assert client.put("/employees/502/salary",
                      json={"new_salary": 99999}, headers=manager).status_code == 403
    assert client.post("/employees/502/salary/increment",
                       json={"amount": 1}, headers=manager).status_code == 403

    # Salary unchanged after all those rejected attempts
    still = client.get("/employees/502", headers=manager).json()
    assert float(still["Salary"]) == 50000

    # Cannot delete/restore, create departments, or manage users
    assert client.delete("/employees/502", headers=manager).status_code == 403
    assert client.post("/employees/502/restore",
                       headers=manager).status_code == 403
    assert client.post(
        "/departments", json={"Dept_Name": "Nope", "Budget": 1}, headers=manager).status_code == 403
    assert client.get("/auth/users", headers=manager).status_code == 403


def test_admin_can_manage_roles():
    admin = headers_for("admin")

    client.post("/auth/register",
                json={"username": "promotee", "password": "pass12345"})

    promote = client.put("/auth/users/promotee/role",
                         json={"role": "manager"}, headers=admin)
    assert promote.status_code == 200

    users = client.get("/auth/users", headers=admin).json()
    assert next(u for u in users if u["username"] == "promotee")[
        "role"] == "manager"
    # hashes never exposed
    assert all("hashed_password" not in u for u in users)

    # Invalid role, unknown user, and self-change are all rejected
    assert client.put("/auth/users/promotee/role",
                      json={"role": "superuser"}, headers=admin).status_code == 400
    assert client.put("/auth/users/ghost/role",
                      json={"role": "user"}, headers=admin).status_code == 404
    assert client.put("/auth/users/admin_tester/role",
                      json={"role": "user"}, headers=admin).status_code == 400


def test_role_change_takes_effect_immediately():
    admin = headers_for("admin")

    resp = client.post(
        "/auth/register", json={"username": "flipper", "password": "pass12345"})
    flipper = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    assert client.get("/employees/501/salary-history",
                      headers=flipper).status_code == 403

    client.put("/auth/users/flipper/role",
               json={"role": "manager"}, headers=admin)

    # Same token as before - role is read from the DB, not baked into the JWT
    assert client.get("/employees/501/salary-history",
                      headers=flipper).status_code == 200


def test_forgot_password_and_reset_flow():
    # 1. Register a user with email
    reg_resp = client.post("/auth/register", json={
        "username": "pwd_reset_user",
        "password": "originalpass123",
        "email": "reset_user@example.com"
    })
    assert reg_resp.status_code == 200

    # 2. Request forgot password using email
    forgot_resp = client.post("/auth/forgot-password", json={
        "identifier": "reset_user@example.com"
    })
    assert forgot_resp.status_code == 200
    assert "password reset link has been sent" in forgot_resp.json()["message"]
    token = forgot_resp.json().get("debug_token")
    assert token is not None

    # 3. Verify reset token endpoint
    verify_resp = client.get(f"/auth/verify-reset-token?token={token}")
    assert verify_resp.status_code == 200
    assert verify_resp.json()["valid"] is True

    # 4. Attempt reset with too short password
    short_resp = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "123"
    })
    assert short_resp.status_code == 400

    # 5. Successfully reset password
    reset_resp = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "brandnewpassword123"
    })
    assert reset_resp.status_code == 200
    assert "successfully" in reset_resp.json()["message"].lower()

    # 6. Old password no longer works
    old_login = client.post("/auth/login", data={
        "username": "pwd_reset_user",
        "password": "originalpass123"
    })
    assert old_login.status_code == 401

    # 7. New password works
    new_login = client.post("/auth/login", data={
        "username": "pwd_reset_user",
        "password": "brandnewpassword123"
    })
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()

    # 8. Token cannot be reused
    reused_resp = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "anotherpassword123"
    })
    assert reused_resp.status_code == 400


def test_forgot_password_unknown_identifier_does_not_leak():
    resp = client.post("/auth/forgot-password", json={
        "identifier": "completely_unknown_user_99999"
    })
    assert resp.status_code == 200
    assert "password reset link has been sent" in resp.json()["message"]
    assert "debug_token" not in resp.json()


def test_email_generation_with_duplicate_name_and_joining_date_suffix():
    admin = headers_for("admin")

    # Ensure test department exists
    dept_resp = client.post(
        "/departments",
        json={"Dept_Name": "SuffixTestDept", "Budget": 100000},
        headers=admin
    )
    dept_id = dept_resp.json(
    )["Dept_ID"] if dept_resp.status_code == 200 else 1

    # Employee 1: Johnathan Doe -> gets johnathan.d@laesfera.co
    emp1 = client.post("/employees", json={
        "Emp_ID": 701, "F_Name": "Johnathan", "L_Name": "Doe",
        "Salary": 60000, "Dept_ID": dept_id, "Address": "Lane 1"
    }, headers=admin)
    assert emp1.status_code == 200
    assert emp1.json()["employee"]["Email"] == "johnathan.d@laesfera.co"

    # Employee 2: Same name (Johnathan Doe) joining in 2026 -> gets johnathan.doe2026@laesfera.co
    emp2 = client.post("/employees", json={
        "Emp_ID": 702, "F_Name": "Johnathan", "L_Name": "Doe",
        "Salary": 65000, "Dept_ID": dept_id, "Address": "Lane 2",
        "joining_date": "2026-04-15"
    }, headers=admin)
    assert emp2.status_code == 200
    assert emp2.json()["employee"]["Email"] == "johnathan.doe2026@laesfera.co"

    # Employee 3: Third Johnathan Doe joining in the same year 2026 -> gets johnathan.doe2026.2@laesfera.co
    emp3 = client.post("/employees", json={
        "Emp_ID": 703, "F_Name": "Johnathan", "L_Name": "Doe",
        "Salary": 70000, "Dept_ID": dept_id, "Address": "Lane 3",
        "joining_date": "2026-08-20"
    }, headers=admin)
    assert emp3.status_code == 200
    assert emp3.json()[
        "employee"]["Email"] == "johnathan.doe2026.2@laesfera.co"

    # Employee 4: Fourth Johnathan Doe joining in 2027 -> gets johnathan.doe2027@laesfera.co
    emp4 = client.post("/employees", json={
        "Emp_ID": 704, "F_Name": "Johnathan", "L_Name": "Doe",
        "Salary": 75000, "Dept_ID": dept_id, "Address": "Lane 4",
        "joining_date": "2027-01-10"
    }, headers=admin)
    assert emp4.status_code == 200
    assert emp4.json()["employee"]["Email"] == "johnathan.doe2027@laesfera.co"


def test_download_employee_template():
    """Verify authenticated user can download the employee CSV template."""
    user_headers = headers_for("user")
    res = client.get("/employees/template", headers=user_headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "F_Name,L_Name,Salary,Department" in res.text


def test_upload_employees_csv_admin_only():
    """Verify only admin can upload employees sheet and user gets 403."""
    user_headers = headers_for("user")
    csv_content = b"Emp_ID,F_Name,L_Name,Salary,Department,Address\n801,Test,User,50000,Engineering,Test Address\n"

    # User role should be forbidden
    res = client.post(
        "/employees/upload-excel",
        files={"file": ("test_emp.csv", csv_content, "text/csv")},
        headers=user_headers,
    )
    assert res.status_code == 403

    # Admin role should succeed
    admin_headers = headers_for("admin")
    res_admin = client.post(
        "/employees/upload-excel",
        files={"file": ("test_emp.csv", csv_content, "text/csv")},
        headers=admin_headers,
    )
    assert res_admin.status_code == 200
    body = res_admin.json()
    assert body["inserted"] == 1
    assert body["total_rows"] == 1
    assert body["employees"][0]["Emp_ID"] == 801
    assert body["employees"][0]["Email"] == "test.u@laesfera.co"


def test_bulk_delete_and_restore_employees():
    """Verify bulk deactivation, restoration, and permanent deletion."""
    admin = headers_for("admin")
    dept_res = client.post("/departments", json={"Dept_Name": "BulkDept", "Budget": 100000}, headers=admin)
    dept_id = dept_res.json()["Dept_ID"] if dept_res.status_code == 200 else client.get("/departments", headers=admin).json()[0]["Dept_ID"]
    client.post("/employees", json={
        "Emp_ID": 801, "F_Name": "BulkTest", "L_Name": "User",
        "Salary": 50000, "Dept_ID": dept_id, "Address": "Bulk Test Address"
    }, headers=admin)

    # Deactivate 801
    res_deact = client.post("/employees/bulk-deactivate",
                            json=[801], headers=admin)
    assert res_deact.status_code == 200
    assert 801 in res_deact.json()["deactivated_ids"]

    # Restore 801
    res_rest = client.post("/employees/bulk-restore",
                           json=[801], headers=admin)
    assert res_rest.status_code == 200
    assert 801 in res_rest.json()["restored_ids"]

    # Bulk delete via JSON payload
    res_del = client.post("/employees/bulk-delete",
                          json={"emp_ids": [801], "hard_delete": True}, headers=admin)
    assert res_del.status_code == 200
    assert res_del.json()["affected_count"] == 1


def test_reimport_excel_reactivates_inactive_employees():
    """Verify that importing an employee sheet reactivates previously soft-deleted/inactive employees."""
    admin = headers_for("admin")
    dept_res = client.post("/departments", json={"Dept_Name": "ReimportDept", "Budget": 100000}, headers=admin)
    dept_id = dept_res.json()["Dept_ID"] if dept_res.status_code == 200 else client.get("/departments", headers=admin).json()[0]["Dept_ID"]

    # 1. Create employee 805
    client.post("/employees", json={
        "Emp_ID": 805, "F_Name": "RestoreMe", "L_Name": "Tester",
        "Salary": 55000, "Dept_ID": dept_id, "Address": "Street 805"
    }, headers=admin)

    # 2. Soft-deactivate employee 805
    res_deact = client.post("/employees/bulk-deactivate", json=[805], headers=admin)
    assert res_deact.status_code == 200
    emp_before = client.get("/employees/805", headers=admin).json()
    assert emp_before["is_active"] is False

    # 3. Re-import CSV with employee 805
    csv_data = b"Emp_ID,F_Name,L_Name,Salary,Dept_ID,Address\n805,RestoreMe,Tester,58000," + str(dept_id).encode() + b",Street 805\n"
    res_import = client.post(
        "/employees/upload-excel",
        files={"file": ("restore.csv", csv_data, "text/csv")},
        headers=admin,
    )
    assert res_import.status_code == 200
    assert res_import.json()["inserted"] == 1
    assert res_import.json()["skipped"] == 0

    # 4. Verify employee 805 is now active again and details updated
    emp_after = client.get("/employees/805", headers=admin).json()
    assert emp_after["is_active"] is True
    assert float(emp_after["Salary"]) == 58000


def test_bulk_delete_via_excel():
    """Verify admin can bulk delete employees by uploading an Excel/CSV file."""
    admin = headers_for("admin")
    dept_id = client.get("/departments", headers=admin).json()[0]["Dept_ID"]
    client.post("/employees", json={
        "Emp_ID": 802, "F_Name": "ExcelDel", "L_Name": "Test",
        "Salary": 50000, "Dept_ID": dept_id, "Address": "Street 1"
    }, headers=admin)

    # Upload CSV with Emp_ID 802 to delete
    csv_data = b"Emp_ID\n802\n"
    res = client.post(
        "/employees/bulk-delete-excel?hard_delete=true",
        files={"file": ("del.csv", csv_data, "text/csv")},
        headers=admin
    )
    assert res.status_code == 200
    assert res.json()["affected_count"] == 1

    # Verify 802 is deleted
    get_res = client.get("/employees/802", headers=admin)
    assert get_res.status_code == 404


def test_bulk_activate_and_deactivate_via_excel():
    """Verify admin can bulk activate and deactivate employees and users via spreadsheet."""
    admin = headers_for("admin")
    dept_id = client.get("/departments", headers=admin).json()[0]["Dept_ID"]

    # Create employee 810
    client.post("/employees", json={
        "Emp_ID": 810, "F_Name": "ActDeact", "L_Name": "Test",
        "Salary": 60000, "Dept_ID": dept_id, "Address": "Street 810"
    }, headers=admin)

    # 1. Bulk deactivate via CSV
    deact_csv = b"Emp_ID\n810\n"
    res_deact = client.post(
        "/employees/bulk-deactivate-excel",
        files={"file": ("deact.csv", deact_csv, "text/csv")},
        headers=admin,
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["affected_count"] == 1
    assert 810 in res_deact.json()["affected_ids"]

    emp_deact = client.get("/employees/810", headers=admin).json()
    assert emp_deact["is_active"] is False

    # 2. Bulk activate via CSV
    act_csv = b"Emp_ID\n810\n"
    res_act = client.post(
        "/employees/bulk-activate-excel",
        files={"file": ("act.csv", act_csv, "text/csv")},
        headers=admin,
    )
    assert res_act.status_code == 200
    assert res_act.json()["affected_count"] == 1
    assert 810 in res_act.json()["affected_ids"]

    emp_act = client.get("/employees/810", headers=admin).json()
    assert emp_act["is_active"] is True


def test_excel_templates_download():
    """Verify download of full add template and identifier management template."""
    # 1. Full add template
    res_full = client.get("/employees/template?template_type=full")
    assert res_full.status_code == 200
    assert "F_Name,L_Name,Salary,Department" in res_full.text

    # 2. Identifier template
    res_id = client.get("/employees/template?template_type=identifiers")
    assert res_id.status_code == 200
    assert "Emp_ID,Email,Username" in res_id.text


def test_xlsx_support():
    """Verify that .xlsx files are handled properly in bulk upload."""
    import openpyxl
    from io import BytesIO

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Emp_ID", "F_Name", "L_Name", "Salary", "Department", "Address"])
    ws.append([815, "SheetUser", "Tester", 72000, "Engineering", "Suite 815"])
    bio = BytesIO()
    wb.save(bio)
    xlsx_bytes = bio.getvalue()

    admin = headers_for("admin")
    res = client.post(
        "/employees/upload-excel",
        files={"file": ("batch.xlsx", xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        headers=admin,
    )
    assert res.status_code == 200
    assert res.json()["inserted"] == 1
    assert res.json()["employees"][0]["Emp_ID"] == 815


def test_export_employees_csv():
    """Verify 3-tier CSV export boundaries: full for admin, limited for manager, minimum for user."""
    # 1. User export: 6 basic contact fields (Emp_ID, F_Name, L_Name, Email, Department, Personal_Phone)
    user = headers_for("user")
    res_user = client.get("/employees/export", headers=user)
    assert res_user.status_code == 200
    user_header_line = res_user.text.splitlines()[0]
    assert user_header_line == "Emp_ID,F_Name,L_Name,Email,Department,Personal_Phone"
    assert "Salary" not in res_user.text
    assert "Address" not in res_user.text
    assert "Emergency_Contact" not in res_user.text
    assert "Personal_Phone" in res_user.text

    # User cannot filter by salary
    assert client.get("/employees/export?min_salary=50000", headers=user).status_code == 403

    # 2. Manager export: limited 13 operational fields (includes contacts, excludes salary & audit timestamps)
    manager = headers_for("manager")
    res_manager = client.get("/employees/export", headers=manager)
    assert res_manager.status_code == 200
    manager_header_line = res_manager.text.splitlines()[0]
    assert manager_header_line == "Emp_ID,F_Name,L_Name,Email,Dept_ID,Department,Address,Joining_Date,Status,Personal_Phone,Blood_Group,Emergency_Contact_Name,Emergency_Contact_Phone"
    assert "Personal_Phone" in res_manager.text
    assert "Emergency_Contact_Name" in res_manager.text
    assert "Salary" not in res_manager.text
    assert "Date_Of_Birth" not in res_manager.text
    assert "Created_At" not in res_manager.text

    # Manager cannot filter by salary
    assert client.get("/employees/export?min_salary=50000", headers=manager).status_code == 403

    # 3. Admin export: full 19 fields (includes salary, private demographics, emergency contacts, timestamps)
    admin = headers_for("admin")
    res_admin = client.get("/employees/export", headers=admin)
    assert res_admin.status_code == 200
    admin_header_line = res_admin.text.splitlines()[0]
    assert admin_header_line == "Emp_ID,F_Name,L_Name,Email,Dept_ID,Department,Salary,Address,Joining_Date,Status,Personal_Phone,Blood_Group,Date_Of_Birth,Marital_Status,Emergency_Contact_Name,Emergency_Contact_Phone,Emergency_Contact_Relation,Created_At,Updated_At"
    assert "Salary" in res_admin.text
    assert "Emergency_Contact_Relation" in res_admin.text
    assert "Created_At" in res_admin.text

    # Admin CAN filter by salary
    res_admin_salary = client.get("/employees/export?min_salary=50000", headers=admin)
    assert res_admin_salary.status_code == 200


def test_department_bulk_create_and_detail():
    """Verify bulk department creation and detail analytics."""
    admin = headers_for("admin")
    bulk_res = client.post("/departments/bulk-create", json={
        "departments": [
            {"Dept_Name": "BulkDeptA", "Budget": 100000},
            {"Dept_Name": "BulkDeptB", "Budget": 200000}
        ]
    }, headers=admin)
    assert bulk_res.status_code == 200
    assert len(bulk_res.json()["created"]) >= 1

    dept_id = bulk_res.json()["created"][0]["Dept_ID"]
    detail_res = client.get(f"/departments/{dept_id}", headers=admin)
    assert detail_res.status_code == 200
    assert "headcount" in detail_res.json()


def test_bulk_salary_increment_and_summary():
    """Verify bulk salary raises and payroll summary analytics."""
    admin = headers_for("admin")
    res_summary = client.get("/employees/salary/summary", headers=admin)
    assert res_summary.status_code == 200
    assert "total_payroll" in res_summary.json()

    res_inc = client.post("/employees/salary/bulk-increment", json={
        "percentage": 5.0
    }, headers=admin)
    assert res_inc.status_code == 200


def test_admin_delete_user_and_crud():
    """Verify admin can delete users and perform user CRUD, with self-delete protection."""
    admin = headers_for("admin")
    user_headers = headers_for("user")

    # 1. Register a user to be deleted
    reg_res = client.post("/auth/register", json={
        "username": "user_to_delete",
        "password": "password123"
    })
    assert reg_res.status_code == 200

    # 2. Non-admin cannot delete user
    res_forbidden = client.delete("/auth/users/user_to_delete", headers=user_headers)
    assert res_forbidden.status_code == 403

    # 3. Admin cannot delete their own account
    res_self = client.delete("/auth/users/admin_tester", headers=admin)
    assert res_self.status_code == 400
    assert "cannot delete your own account" in res_self.json()["detail"].lower()

    # 4. Admin can delete user
    res_del = client.delete("/auth/users/user_to_delete", headers=admin)
    assert res_del.status_code == 200
    assert "permanently deleted" in res_del.json()["message"].lower()

    # 5. User is gone from user list
    users = client.get("/auth/users", headers=admin).json()
    assert not any(u["username"] == "user_to_delete" for u in users)

    # 6. Deleting non-existent user returns 404
    res_404 = client.delete("/auth/users/user_to_delete", headers=admin)
    assert res_404.status_code == 404


def test_admin_create_user_with_role():
    """Verify admin can directly provision a new user with a specified role."""
    admin = headers_for("admin")
    user_headers = headers_for("user")

    # Non-admin cannot create users via /auth/users
    res_forbidden = client.post("/auth/users", json={
        "username": "direct_mgr",
        "password": "password123",
        "role": "manager"
    }, headers=user_headers)
    assert res_forbidden.status_code == 403

    # Admin can create user with role 'manager'
    res_create = client.post("/auth/users", json={
        "username": "direct_mgr",
        "password": "password123",
        "email": "direct_mgr@laesfera.co",
        "role": "manager"
    }, headers=admin)
    assert res_create.status_code == 200
    body = res_create.json()
    assert body["user"]["username"] == "direct_mgr"
    assert body["user"]["role"] == "manager"

    # Clean up created test user
    client.delete("/auth/users/direct_mgr", headers=admin)


def test_department_edit_history_and_delete():
    """Verify admin-only department editing, budget revision history, and safe deletion."""
    admin = headers_for("admin")
    user = headers_for("user")

    # 1. Create a test department
    create_resp = client.post(
        "/departments",
        json={"Dept_Name": "Robotics Lab", "Budget": 300000},
        headers=admin
    )
    assert create_resp.status_code == 200
    dept_id = create_resp.json()["Dept_ID"]

    # 2. Non-admin cannot edit department
    forbidden_edit = client.put(
        f"/departments/{dept_id}",
        json={"Dept_Name": "Robotics AI", "Budget": 450000},
        headers=user
    )
    assert forbidden_edit.status_code == 403

    # 3. Admin edits department budget and name
    edit_resp = client.put(
        f"/departments/{dept_id}",
        json={
            "Dept_Name": "Robotics & AI",
            "Budget": 550000,
            "notes": "Q4 AI expansion budget"
        },
        headers=admin
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["Dept_Name"] == "Robotics & AI"
    assert float(edit_resp.json()["Budget"]) == 550000

    # 4. Check department history
    hist_resp = client.get(f"/departments/{dept_id}/history", headers=admin)
    assert hist_resp.status_code == 200
    history_items = hist_resp.json()
    assert len(history_items) >= 2  # CREATED + NAME_AND_BUDGET_UPDATED
    latest = history_items[0]
    assert latest["change_type"] == "NAME_AND_BUDGET_UPDATED"
    assert float(latest["old_budget"]) == 300000
    assert float(latest["new_budget"]) == 550000
    assert latest["notes"] == "Q4 AI expansion budget"
    assert latest["changed_by"] in ("admin", "admin_tester")

    # 5. Non-admin cannot view department history
    hist_forbidden = client.get(f"/departments/{dept_id}/history", headers=user)
    assert hist_forbidden.status_code == 403

    # 6. Global department history
    global_hist = client.get("/departments/history/all", headers=admin)
    assert global_hist.status_code == 200
    assert any(h["Dept_Name"] == "Robotics & AI" for h in global_hist.json())

    # 7. Add an employee to department and verify deletion is blocked
    emp_resp = client.post(
        "/employees",
        json={
            "Emp_ID": 991,
            "F_Name": "Nikola",
            "L_Name": "Tesla",
            "Salary": 120000,
            "Dept_ID": dept_id,
            "Address": "Wardenclyffe",
        },
        headers=admin
    )
    assert emp_resp.status_code == 200

    del_blocked = client.delete(f"/departments/{dept_id}", headers=admin)
    assert del_blocked.status_code == 400
    assert "employee(s) are assigned to it" in del_blocked.json()["detail"]

    # 8. Remove employee and verify successful deletion
    client.delete("/employees/991/delete", headers=admin)

    # 9. Non-admin cannot delete department
    del_forbidden = client.delete(f"/departments/{dept_id}", headers=user)
    assert del_forbidden.status_code == 403

    # 10. Admin deletes empty department
    del_success = client.delete(f"/departments/{dept_id}", headers=admin)
    assert del_success.status_code == 200
    assert "deleted successfully" in del_success.json()["message"]

    # 11. Department no longer exists
    get_404 = client.get(f"/departments/{dept_id}", headers=admin)
    assert get_404.status_code == 404


def test_get_employees_all_records_and_custom_limits():
    """Verify all_records=true and limit=0 return all records without pagination caps."""
    admin = headers_for("admin")
    
    # 1. Fetch with all_records=true
    res_all = client.get("/employees?all_records=true&status=all", headers=admin)
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert "total" in data_all
    assert len(data_all["items"]) == data_all["total"]
    
    # 2. Fetch with limit=0
    res_zero = client.get("/employees?limit=0&status=all", headers=admin)
    assert res_zero.status_code == 200
    data_zero = res_zero.json()
    assert len(data_zero["items"]) == data_zero["total"]

    # 3. Fetch with custom limit > 200
    res_custom = client.get("/employees?limit=500", headers=admin)
    assert res_custom.status_code == 200


def test_workforce_analytics_role_boundaries():
    """Verify GET /analytics/workforce returns full metrics for admin/manager and redacts financials for regular users."""
    admin = headers_for("admin")
    manager = headers_for("manager")
    user = headers_for("user")

    # Seed department & employee
    dept_res = client.post("/departments", json={"Dept_Name": "AnalyticsDept", "Budget": 150000}, headers=admin)
    dept_id = dept_res.json()["Dept_ID"] if dept_res.status_code == 200 else client.get("/departments", headers=admin).json()[0]["Dept_ID"]
    client.post("/employees", json={
        "Emp_ID": 890, "F_Name": "Analytic", "L_Name": "Tester",
        "Salary": 75000, "Dept_ID": dept_id, "Address": "Suite 890",
        "blood_group": "O+", "personal_phone": "9876543210"
    }, headers=admin)

    # 1. Admin view: full financials + departments + summary
    res_admin = client.get("/analytics/workforce", headers=admin)
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["viewer_role"] == "admin"
    assert data_admin["is_financial_masked"] is False
    assert data_admin["financials"] is not None
    assert "total_payroll" in data_admin["financials"]
    assert "total_headcount" in data_admin["summary"]
    assert "tenure_brackets" in data_admin
    assert "blood_group_distribution" in data_admin
    assert data_admin["age_demographics"] is not None

    # 2. Manager view: full financials + departments + summary
    res_manager = client.get("/analytics/workforce", headers=manager)
    assert res_manager.status_code == 200
    data_manager = res_manager.json()
    assert data_manager["viewer_role"] == "manager"
    assert data_manager["is_financial_masked"] is False
    assert data_manager["financials"] is not None

    # 3. Regular user view: workforce demographics present, financials and budgets strictly masked
    res_user = client.get("/analytics/workforce", headers=user)
    assert res_user.status_code == 200
    data_user = res_user.json()
    assert data_user["viewer_role"] == "user"
    assert data_user["is_financial_masked"] is True
    assert data_user["financials"] is None
    assert data_user["age_demographics"] is None
    assert "total_headcount" in data_user["summary"]
    assert "tenure_brackets" in data_user
    assert "blood_group_distribution" in data_user

    # Verify department budget/salaries are None for regular user
    if data_user["departments"]:
        first_dept = data_user["departments"][0]
        assert first_dept["total_payroll"] is None
        assert first_dept["budget"] is None
        assert first_dept["budget_utilization_pct"] is None
        assert first_dept["headcount"] >= 0


def test_user_role_can_view_employee_phone():
    """Verify regular user can view employee phone number when clicking/fetching employee profile, but salary remains hidden."""
    admin = headers_for("admin")
    user = headers_for("user")

    dept_res = client.post("/departments", json={"Dept_Name": "PhoneTestDept", "Budget": 75000}, headers=admin)
    dept_id = dept_res.json()["Dept_ID"] if dept_res.status_code == 200 else 1

    emp_payload = {
        "Emp_ID": 997,
        "F_Name": "Pooja",
        "L_Name": "Sharma",
        "Salary": 55000,
        "Dept_ID": dept_id,
        "Address": "Secret Tower 7",
        "personal_phone": "9876543210",
    }
    create_res = client.post("/employees", json=emp_payload, headers=admin)
    assert create_res.status_code in (200, 409)

    # 1. Fetch single employee detail as regular user
    get_res = client.get("/employees/997", headers=user)
    assert get_res.status_code == 200
    emp_data = get_res.json()
    assert emp_data["Emp_ID"] == 997
    assert emp_data["F_Name"] == "Pooja"
    assert emp_data["personal_phone"] == "9876543210"
    assert "Salary" not in emp_data
    assert "Address" not in emp_data

    # 2. Fetch employee listing as regular user
    list_res = client.get("/employees?search=Pooja", headers=user)
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    target = next((item for item in items if item["Emp_ID"] == 997), None)
    assert target is not None
    assert target["personal_phone"] == "9876543210"
    assert "Salary" not in target
    assert "Address" not in target




