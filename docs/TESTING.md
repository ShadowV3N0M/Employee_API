# Testing Strategy & Quality Assurance Guide

**Project:** Enterprise Employee & Payroll Management System  
**Version:** 2.5  
**Date:** October 23, 2026  
**Test Frameworks:** `pytest` (Backend) | Vite Build & Oxlint (Frontend)  

---

## 1. Testing Philosophy & Architecture

The testing strategy follows a **Zero-Mock Database** approach for integration and API testing:
- **Real Database Semantics:** Rather than mocking database sessions, the test suite executes directly against an isolated **SQLite** engine. This ensures that real foreign keys, constraints, triggers, transaction rollbacks, and identity map behavior are rigorously exercised.
- **Fast Feedback Loop:** The entire test suite of 46 comprehensive tests executes in under **35 seconds** locally.
- **Role Matrix Verification:** Every endpoint is tested across all three authorization contexts (`anonymous`, `user`, `manager`, `admin`) to guarantee zero authorization bypasses.

---

## 2. Test Suite Organization

```
employee_api/tests/
├── test_main.py       # Core integration suite (39 tests: Auth, RBAC, CRUD, Auto-Shift, Resequencing, Session Config)
├── test_reports.py    # ReportLab document engine (7 tests: Payslips, Revision Letters, Roster PDFs, Access Control)
└── test_hashing.py    # Password hashing, salt validation, and bcrypt 4.0.1 compatibility
```

### 2.1 `tests/test_main.py` Coverage Breakdown
- **Authentication & Security:**
  - `test_anonymous_cannot_read_employees`: 401 Unauthorized for unauthenticated calls.
  - `test_self_registration_cannot_pick_a_role`: Verifies public registrations default to `user`.
  - `test_admin_can_manage_roles`: Role elevation (`user` ➔ `manager` ➔ `admin`) and self-demotion prevention.
  - `test_role_change_takes_effect_immediately`: Live DB verification taking effect without re-login.
  - `test_password_reset_flow_with_token`: Full lifecycle: forgot-password, token hashing, password change, single-use invalidation.
  - `test_forgot_password_unknown_identifier_does_not_leak`: Zero-knowledge response against user enumeration.
  - `test_get_session_config_public`: Checks retrieval of portal session timeout and inactivity auto-logout policy.
  - `test_update_session_config_admin_only`: Admin can update global timeout and auto-logout; regular users rejected with 403.
  - `test_session_refresh_endpoint`: Verifies token renewal and timestamp ping via `POST /auth/refresh-session`.
- **Employee Lifecycle, Auto-Shift & Resequencing:**
  - `test_auto_shift_upward_on_insert_preserves_existing_data`: Inserting at an occupied ID auto-increments records ($\ge \text{Emp\_ID}$) by $+1$ in descending order, preserving all existing records and compensation history.
  - `test_delete_resequences_and_reinsert_shifts_upward`: Tests complete deletion lifecycle: ID 107 deleted ➔ ID 108 shifts to 107 ➔ new ID 107 inserted ➔ existing ID 107 auto-shifts to 108 without replacement.
  - `test_bulk_delete_and_restore_employees`: Soft deactivation and mass restoration.
  - `test_bulk_delete_via_excel`: Spreadsheet-driven deletion with consecutive gap-closing.
- **Spreadsheet & Excel Batch Hub:**
  - `test_upload_employees_csv_admin_only`: 403 Forbidden for regular users; 200 OK for admin.
  - `test_reimport_excel_reactivates_inactive_employees`: Auto-restoration of inactive employees upon sheet re-import.
  - `test_download_employee_template`: CSV template generation with valid headers.
  - `test_export_employees_csv`: CSV export with automatic salary masking for non-admin callers.
- **Department & Budget Management:**
  - `test_department_bulk_create_and_detail`: Multi-department creation and analytics headcount inspection.
  - Department deletion constraints: Verifies 400 Bad Request if employees remain assigned.
- **Self-Service Personal Profile & SOS Contacts:**
  - Emergency contact CRUD, primary contact exclusivity, 1-click SOS lookup.

### 2.2 `tests/test_reports.py` Coverage Breakdown
- **Payslip PDF Generation:** Tests `GET /reports/payslip/{emp_id}/pdf`, verifying `%PDF-` binary magic bytes, earnings/deductions table layout, and Indian Rupee word generation.
- **Employee Directory Roster:** Tests `GET /reports/employees/pdf?status=all` as Admin, verifying landscape layout and headcount summary blocks.
- **Department Budget Statement:** Tests `GET /reports/departments/pdf`, ensuring budget comparisons render correctly for Admin.
- **Salary Revision Letter:** Tests `GET /reports/salary-revisions/{emp_id}/pdf`, ensuring previous salary, increment percentage, and new salary match audit history.
- **Authentication Guard:** Tests unauthenticated access returns 401.
- **Role-Based Access Control:**
  - `test_department_budget_forbidden_for_regular_user`: Verifies 403 Forbidden for non-manager/non-admin roles.
  - `test_employee_directory_forbidden_for_regular_user`: Verifies regular employees cannot view full directory or inactive records (`status=all`).

---

## 3. Test Execution Commands

### 3.1 Backend Pytest Execution
Always run `pytest` from the `employee_api` directory using the active virtual environment:

```powershell
# Navigate to backend directory
cd D:\Sagar\Python\employee_api

# Run entire test suite
& "D:\Sagar\Python\venv\Scripts\python.exe" -m pytest

# Run with verbose output and short tracebacks
& "D:\Sagar\Python\venv\Scripts\python.exe" -m pytest -v --tb=short

# Run only auto-shift and resequencing tests
& "D:\Sagar\Python\venv\Scripts\python.exe" -m pytest -k "shift or resequence" -v

# Run only PDF reports tests
& "D:\Sagar\Python\venv\Scripts\python.exe" -m pytest tests/test_reports.py -v
```

### 3.2 Frontend Verification & Linting
Run from the `employee_frontend` directory:

```powershell
cd D:\Sagar\Python\employee_frontend

# Verify production build compilation
npm run build

# Run Oxlint static analysis
npx oxlint
```

---

## 4. Test Fixtures & Utilities

The test suite uses helper functions defined in `tests/test_main.py`:
- `headers_for(role: str) -> dict`: Authenticates or creates a user with the requested role (`user`, `manager`, `admin`) and returns the ready-to-use HTTP header: `{"Authorization": "Bearer <token>"}`.
- `client: TestClient`: Pre-configured FastAPI `TestClient` managing cookies and headers.
- Isolated Database Engine: Automatically creates tables on test runner startup.

### 4.1 Test Database Isolation Invariant
- `test_main.py` binds to `test.db` and drops tables on module teardown.
- `test_reports.py` binds to its own dedicated `test_reports.db` to prevent inter-module race conditions and schema teardown collisions when running the full test suite (`pytest tests`).

---

## 5. Adding New Test Cases: Standards & Checklist

When contributing new features, follow these testing standards:
1. **Always test the Authorization Matrix:** Add tests verifying that `user` is denied (403), `manager` has appropriate partial access, and `admin` succeeds (200).
2. **Test Boundary Conditions:** For numerical IDs or dates, test non-existent IDs (404), negative salaries (400), and invalid date formats (400).
3. **Verify Data Preservation:** When testing update or shift logic, query related tables (`salary_history`, `employee_emergency_contact`, `user`) to verify that foreign key references remained intact.

