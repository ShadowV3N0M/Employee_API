# AI Agent Instructions & System Invariants

**Project:** Enterprise Employee & Payroll Management System  
**Audience:** Autonomous AI Agents (Antigravity, Cursor, Copilot, Claude Code, Devins)  
**Status:** Mandatory Implementation Standard  
**Last Updated:** October 2026  

---

## 1. Core Operating Context

When acting as an automated coding assistant or autonomous agent on this codebase, you must adhere strictly to the invariants, dependency rules, and directory structures outlined in this document. Deviations from these rules can break system PATH dependencies, cause database primary key collisions, or corrupt password hashing routines.

### 1.1 Workspace Layout
- **Root Parent Directory:** `D:\Sagar\Python`
- **Backend Application:** `D:\Sagar\Python\employee_api` (FastAPI, SQLAlchemy, PyMySQL)
- **Primary Frontend:** `D:\Sagar\Python\employee_frontend` (React 19, Vite, React Router 6)
- **Mirrored Frontend:** `D:\Sagar\Python\employee_api\frontend`
- **Python Virtual Environment:** `D:\Sagar\Python\venv\Scripts\python.exe`

---

## 2. Non-Negotiable System Invariants

### 🔴 Invariant 1: The Global PATH Binary Rule (CRITICAL)
> **WARNING:** The host machine's global environment `PATH` depends directly on `D:\Sagar\Python\employee_api\frontend\` for `node.exe` and `npm.cmd`.  
> **DO NOT** delete, move, or rename `node.exe` or `npm.cmd` from `D:\Sagar\Python\employee_api\frontend\`.  
> Doing so breaks the entire terminal's capability to run `npm`, `npx`, or `node`.

---

### 🔴 Invariant 2: The Frontend Dual-Sync Rule
The repository maintains two copies of the frontend source code:
1. `D:\Sagar\Python\employee_frontend\src\` (Active frontend workspace)
2. `D:\Sagar\Python\employee_api\frontend\src\` (Mirrored backend bundle)

**Rule:** Every time any component, hook, style, utility, or page is edited or created in `employee_frontend/src/`, you **MUST** synchronize the changes to `employee_api/frontend/src/`.  
*Example PowerShell Sync Command:*
```powershell
Copy-Item -Path "employee_frontend/src/components/EmployeeForm.jsx" -Destination "employee_api/frontend/src/components/EmployeeForm.jsx" -Force
```

---

### 🔴 Invariant 3: Database ID Shift Order & Collision Prevention
When updating employee identifiers across the database (`employee`, `salary_history`, `employee_emergency_contact`, and `user`), you **must** strictly enforce the mathematical sort direction to prevent unique primary key collisions:

1. **Upward Shifts (+1 / Increments):**  
   - When shifting records up (e.g. inserting into an occupied slot), you **MUST** process updates in **DESCENDING order** (`ORDER BY Emp_ID DESC` / reverse list).  
   - *Rationale:* If you have IDs 107 and 108, incrementing 107 first attempts to insert 108 while 108 still exists, causing a fatal unique key constraint collision. Incrementing 108 first (to 109) safely clears the slot for 107 (to 108).
2. **Downward Shifts (-1 / Consecutive Resequencing):**  
   - When shifting records down to fill gaps after deletion, you **MUST** process updates in **ASCENDING order** (`ORDER BY Emp_ID ASC`).  
   - *Rationale:* If slot 107 was deleted and records 108 and 109 remain, moving 108 to 107 first is safe because 107 is empty.

---

### 🔴 Invariant 4: SQLAlchemy Identity Map Purging (`db.expire_all()`)
When raw SQL queries (`db.execute(text(...))`) are used to update employee IDs or foreign keys in the database:
- The SQLAlchemy session's in-memory identity map retains the old primary keys in Python memory.
- If you subsequently insert or query objects in the same session without expiring the cache, SQLAlchemy raises `SAWarning: New instance conflicts with persistent instance`.
- **Mandatory Practice:** Always call `db.flush()` followed immediately by `db.expire_all()` in any shift or resequence routine:
  ```python
  db.flush()
  db.expire_all()
  ```

---

### 🔴 Invariant 5: Password Hashing Dependency Pin
- **Strict Pin:** `bcrypt==4.0.1` and `passlib==1.7.4`
- **DO NOT upgrade** `bcrypt` to `4.1+` or remove the pin in `requirements.txt`.
- *Rationale:* Newer releases of `bcrypt` break `passlib`'s internal hashing wrapper, triggering runtime errors (`ValueError: password cannot be longer than 72 bytes`) during user registration and authentication.

---

### 🔴 Invariant 6: Dialect Agnostic Foreign Key Handling
Code executing bulk resequencing or shifting must support both MySQL (production) and SQLite (tests and local dev):
```python
dialect_name = db.bind.dialect.name if db.bind else "sqlite"

if dialect_name == "mysql":
    db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    # ... execute operations ...
    db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
else:
    if dialect_name == "sqlite":
        db.execute(text("PRAGMA foreign_keys = OFF"))
    # ... execute operations ...
    if dialect_name == "sqlite":
        db.execute(text("PRAGMA foreign_keys = ON"))
```

---

## 3. Standard Operating Commands

### 3.1 Python Backend & Test Suite
Always invoke Python through the active virtual environment:

- **Run Backend Server:**
  ```powershell
  & "D:\Sagar\Python\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
- **Execute Full Pytest Suite:**
  ```powershell
  # Must be executed with employee_api as working directory:
  cd D:\Sagar\Python\employee_api
  & "D:\Sagar\Python\venv\Scripts\python.exe" -m pytest
  ```
- **Run Specific Test File:**
  ```powershell
  & "D:\Sagar\Python\venv\Scripts\python.exe" -m pytest tests/test_main.py -v
  ```

### 3.2 Frontend Development & Verification
- **Run Vite Dev Server:**
  ```powershell
  cd D:\Sagar\Python\employee_frontend
  npm run dev
  ```
- **Execute Production Build (Verification Check):**
  ```powershell
  cd D:\Sagar\Python\employee_frontend
  npm run build
  ```

---

## 4. Agent Quality Checklist Before Completing Any Task

Before marking any coding task complete or reporting results back to the user, every AI agent must execute this verification checklist:

1. [ ] **Dual-Sync Verification:** Were modified frontend files in `employee_frontend/src/` copied to `employee_api/frontend/src/`?
2. [ ] **Test Execution:** Did `pytest` run with **100% pass rate** (0 failures, 0 errors)?
3. [ ] **Frontend Build Verification:** Did `npm run build` finish successfully with 0 compilation errors?
4. [ ] **No Regression in Core Invariants:** Did you verify that `node.exe` was untouched in `employee_api/frontend/`?
5. [ ] **Docstring & Comment Integrity:** Were all existing unrelated docstrings, comments, and type hints preserved?

