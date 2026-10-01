# Employee Management API

A FastAPI backend for managing employees, departments, salary history, and
authenticated access, backed by MySQL.

## Tech Stack

- **FastAPI** - web framework
- **SQLAlchemy** - ORM
- **MySQL** (via PyMySQL) - database
- **python-jose** - JWT auth tokens
- **passlib + bcrypt** - password hashing
- **slowapi** - rate limiting
- **pytest** - test suite (runs against SQLite, no MySQL needed)
- **React + Vite** - web frontend (in `frontend/`)

## Setup

### 1. Create and activate a virtual environment

```bash
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux
```

Use **Python 3.12** - some dependencies (notably `pandas`, if you use the
analytics variant of this project) don't yet have stable wheels for very
new Python versions like 3.14, and bcrypt/passlib compatibility has been
smoother on 3.12 in testing.

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **Known version pin:** `bcrypt` must stay at `4.0.1` with `passlib==1.7.4`.
> Newer bcrypt releases (4.1+) break passlib's password hashing with a
> `ValueError: password cannot be longer than 72 bytes` error on first use.

### 3. Configure the database

Set the `DATABASE_URL` environment variable, or edit the default in
`main.py`:

```
mysql+pymysql://<user>:<password>@<host>:3306/<database>
```

Also set a real `JWT_SECRET_KEY` environment variable in any non-local
environment - the default in the code is a placeholder and must not be
used in production.

### 4. Run the app

**Backend (Terminal 1):**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- Binding to `0.0.0.0` ensures both IPv4 (`127.0.0.1`) and IPv6 (`::1` localhost) can connect without `ERR_CONNECTION_REFUSED`.
- Opening `http://localhost:8000/` automatically redirects to interactive Swagger docs: `http://localhost:8000/docs`

**Frontend (Terminal 2 or One-Click):**
Run the automated launcher:
```cmd
setup_frontend.bat
```
(Or double-click `setup_frontend.bat` in File Explorer). This installs packages and launches Vite on `http://localhost:5173`.

Tables (`employee`, `department`, `salary_history`, `user`) are created
automatically on startup if they don't already exist. **This does not
migrate existing tables** - if you change a model's columns, you need to
alter the existing MySQL table yourself (see "Database Migrations" below).

Interactive docs: `http://127.0.0.1:8000/docs`

## Authentication & roles

- `POST /auth/register` - create an account (`username`, `password`). Everyone
  who self-registers is a plain **user**; any `role` field sent is ignored.
- `POST /auth/login` - OAuth2 password flow (`username` + `password` as form
  data). Returns a JWT.
- Send the token as `Authorization: Bearer <token>`. In Swagger UI (`/docs`),
  click **Authorize** and log in there.
- Every endpoint except `/health`, `/auth/register` and `/auth/login`
  requires a valid token.

There are three roles. The role is read from the database on every request,
so a promotion or demotion takes effect immediately (no re-login needed).

| Capability | user | manager | admin |
|---|:-:|:-:|:-:|
| View employee directory (name, email, dept) | yes | yes | yes |
| See salary, home address, timestamps | no | yes | yes |
| View departments | yes | yes | yes |
| View salary history | no | yes | yes |
| Create employees (incl. starting salary) | no | yes | yes |
| Edit employee details (PUT/PATCH, non-salary) | no | yes | yes |
| Change an existing salary (PUT/PATCH/salary endpoints) | no | no | yes |
| Delete / restore employees | no | no | yes |
| Create departments | no | no | yes |
| List users, change roles | no | no | yes |

### Creating the first admin

Because self-registration can only create plain users, the first admin must
be set directly in the database (one time):

```sql
UPDATE user SET role = 'admin' WHERE username = 'your_username';
```

After that, admins promote others with
`PUT /auth/users/{username}/role` (body: `{"role": "manager"}`).
An admin cannot change their own role, so the last admin can't be locked out.

**Passwords are never stored in plain text.** They're hashed with bcrypt
before being saved, which is one-way - it cannot be reversed by anyone,
including the developers. A forgotten password must be *reset* to a new
value, not recovered.

## Endpoints & Role-Based Access Control (RBAC)

The API enforces strict Role-Based Access Control across three user roles: **`user`**, **`manager`**, and **`admin`**, in addition to public endpoints.

---

### Master API Access Matrix

| Method | Endpoint | Public | `user` | `manager` | `admin` | Description & Access Rules |
|---|---|:---:|:---:|:---:|:---:|---|
| `GET` | `/` | ✅ | ✅ | ✅ | ✅ | Root URL (automatically redirects to `/docs`) |
| `GET` | `/health` | ✅ | ✅ | ✅ | ✅ | Public health and database connectivity check |
| `POST` | `/auth/register` | ✅ | ✅ | ✅ | ✅ | Register a new user (always created with role `user`) |
| `POST` | `/auth/login` | ✅ | ✅ | ✅ | ✅ | Log in with username & password; returns JWT token |
| `POST` | `/auth/forgot-password` | ✅ | ✅ | ✅ | ✅ | Request a password reset link (emailed via SMTP) |
| `GET` | `/auth/verify-reset-token` | ✅ | ✅ | ✅ | ✅ | Validate a password reset token |
| `POST` | `/auth/reset-password` | ✅ | ✅ | ✅ | ✅ | Reset password using valid reset token |
| `GET` | `/auth/me` | ❌ | ✅ | ✅ | ✅ | Get profile of currently logged-in user |
| `GET` | `/departments` | ❌ | ✅ | ✅ | ✅ | List all departments |
| `GET` | `/employees` | ❌ | ✅* | ✅ | ✅ | List employees (*Salary & Address hidden for `user`) |
| `GET` | `/employees/{emp_id}` | ❌ | ✅* | ✅ | ✅ | Get employee details (*Salary & Address hidden for `user`) |
| `POST` | `/employees` | ❌ | ❌ | ✅ | ✅ | Create an employee (with starting salary & auto-email) |
| `PUT` | `/employees/{emp_id}` | ❌ | ❌ | ✅* | ✅ | Full update (*changing salary requires `admin`) |
| `PATCH` | `/employees/{emp_id}` | ❌ | ❌ | ✅* | ✅ | Partial update (*changing salary requires `admin`) |
| `GET` | `/employees/{emp_id}/salary-history` | ❌ | ❌ | ✅ | ✅ | View audit log of salary changes for an employee |
| `POST` | `/departments` | ❌ | ❌ | ❌ | ✅ | Create a new department |
| `DELETE` | `/employees/{emp_id}` | ❌ | ❌ | ❌ | ✅ | Deactivate employee (standard REST alias) |
| `DELETE` | `/employees/{emp_id}/deactivate` | ❌ | ❌ | ❌ | ✅ | Soft-delete employee (`is_active = false`) |
| `DELETE` | `/employees/{emp_id}/delete` | ❌ | ❌ | ❌ | ✅ | Hard-delete employee record from database |
| `POST` | `/employees/{emp_id}/restore` | ❌ | ❌ | ❌ | ✅ | Restore deactivated employee (`is_active = true`) |
| `POST` | `/employees/bulk-delete` | ❌ | ❌ | ❌ | ✅ | Bulk delete/deactivate employees by list of Emp_IDs |
| `POST` | `/employees/bulk-deactivate` | ❌ | ❌ | ❌ | ✅ | Bulk soft-deactivate employees by list of Emp_IDs |
| `POST` | `/employees/bulk-restore` | ❌ | ❌ | ❌ | ✅ | Bulk restore/reactivate employees by list of Emp_IDs |
| `POST` | `/employees/bulk-delete-excel` | ❌ | ❌ | ❌ | ✅ | Bulk delete employees via uploaded Excel (.xlsx) or CSV file |
| `GET` | `/employees/export` | ❌ | ✅* | ✅ | ✅ | Export employee directory to CSV (*role-based field masking) |
| `GET` | `/employees/template` | ❌ | ✅ | ✅ | ✅ | Download sample CSV template for employee import |
| `POST` | `/employees/upload-excel` | ❌ | ❌ | ❌ | ✅ | Batch import employees from Excel (.xlsx) or CSV file |
| `GET` | `/departments/{dept_id}` | ❌ | ✅ | ✅ | ✅ | Get department details, headcount & budget utilization |
| `GET` | `/departments/{dept_id}/employees` | ❌ | ✅* | ✅ | ✅ | List all employees in a department (*role-masked) |
| `PUT` | `/departments/{dept_id}` | ❌ | ❌ | ❌ | ✅ | Update department name or budget |
| `DELETE` | `/departments/{dept_id}` | ❌ | ❌ | ❌ | ✅ | Delete department (prevented if employees assigned) |
| `POST` | `/departments/bulk-create` | ❌ | ❌ | ❌ | ✅ | Create multiple departments in a single request |
| `PUT` | `/employees/{emp_id}/salary` | ❌ | ❌ | ❌ | ✅ | Set an exact new salary and log change |
| `POST` | `/employees/{emp_id}/salary/increment` | ❌ | ❌ | ❌ | ✅ | Apply a salary raise or cut and log change |
| `POST` | `/employees/salary/bulk-increment` | ❌ | ❌ | ❌ | ✅ | Bulk salary raise (% or fixed) by department or IDs |
| `GET` | `/employees/salary/summary` | ❌ | ❌ | ✅ | ✅ | View company-wide and department payroll analytics |
| `PUT` | `/auth/change-password` | ❌ | ✅ | ✅ | ✅ | Change own account password (requires old password) |
| `GET` | `/auth/users` | ❌ | ❌ | ❌ | ✅ | List all users with their roles (no password hashes) |
| `PUT` | `/auth/users/{username}/role` | ❌ | ❌ | ❌ | ✅ | Promote or demote user role (`user`, `manager`, `admin`) |
| `PUT` | `/auth/users/{username}/status` | ❌ | ❌ | ❌ | ✅ | Activate or deactivate a user account |
| `DELETE` | `/auth/users/{username}` | ❌ | ❌ | ❌ | ✅ | Delete user account (cannot delete own account) |



---

### APIs Accessible by Specific Role

#### 1. Public (No Token Required)
Anyone can access without an account or token:
- `GET /health` - Service and database status
- `POST /auth/register` - Create an account (defaults to `user` role, optional `email`)
- `POST /auth/login` - Authenticate with credentials to receive a Bearer JWT
- `POST /auth/forgot-password` - Request a password reset link by username or email
- `GET /auth/verify-reset-token` - Check if a reset token is valid and unexpired
- `POST /auth/reset-password` - Set a new password using a valid reset token

#### 2. Standard User (`role: user`)
Basic employee directory view. Privacy-sensitive data (salary, home address) is stripped by the backend:
- `GET /auth/me` - View own username and assigned role
- `GET /departments` - View all company departments
- `GET /employees` - Browse employee directory (Name, Email, Department only; `Salary` and `Address` are excluded)
- `GET /employees/{emp_id}` - View individual employee profile (directory info only)

> [!NOTE]
> For `user` accounts, all modification routes (`POST`, `PUT`, `PATCH`, `DELETE`) return **HTTP 403 Forbidden**. Sorting by `Salary` or requesting `include_inactive=true` on `/employees` is also rejected with 403 to prevent inferring pay levels.

#### 3. Manager (`role: manager`)
Operational access for department managers to view compensation and manage staff:
- **All `user` APIs above**, PLUS:
- `GET /employees` - Full employee view including **Salary**, **Address**, and timestamps
- `GET /employees/{emp_id}` - Full profile including **Salary** and **Address**
- `POST /employees` - Create new employee records (including starting salary)
- `PUT /employees/{emp_id}` - Update employee personal/department details (cannot change salary)
- `PATCH /employees/{emp_id}` - Partially update employee details (cannot change salary)
- `GET /employees/{emp_id}/salary-history` - View complete salary revision logs

> [!NOTE]
> Managers cannot delete/deactivate staff, cannot change existing salaries, cannot create departments, and cannot manage user roles. Any such attempt returns **HTTP 403 Forbidden**.

#### 4. Administrator (`role: admin`)
Full administrative and superuser privileges across the system:
- **All `user` and `manager` APIs above**, PLUS:
- `POST /departments` - Create new company departments
- `DELETE /employees/{emp_id}/deactivate` - Soft-delete employee (`is_active = false`)
- `DELETE /employees/{emp_id}/delete` - Hard-delete employee (permanent removal)
- `POST /employees/{emp_id}/restore` - Reactivate an inactive employee (`is_active = true`)
- `PUT /employees/{emp_id}/salary` - Set an exact new salary (automatically logged in audit table)
- `POST /employees/{emp_id}/salary/increment` - Apply salary raise or cut (automatically logged)
- `PUT /employees/{emp_id}` & `PATCH /employees/{emp_id}` - May modify any field, including salary
- `GET /auth/users` - View all user accounts, active status, and current roles
- `PUT /auth/users/{username}/role` - Promote or demote users between `user`, `manager`, and `admin`

## Auto-generated employee emails

On creation, each employee gets an email like `firstname.l@laesfera.co`
(first name + last-initial).

- **Different last names**: Extends the last-name portion letter by letter
  (`p` -> `pa` -> `pat` -> ...) until unique, e.g. **Parth Patil** and
  **Parth Pandey** become `parth.p@laesfera.co` and `parth.pa@laesfera.co`.
- **Identical first & last name (Duplicate names)**: A suffix based on the
  employee's **joining date** (e.g. year `2026`) is automatically appended,
  e.g. `parth.patil2026@laesfera.co`.
- **Multiple duplicates in the same year**: An incremental counter is added,
  e.g. `parth.patil2026.2@laesfera.co`.
- You can pass `joining_date: "YYYY-MM-DD"` when creating an employee via `POST /employees`
  or let it default to the current registration date.

## Database Migrations (Alembic)

Database schema versioning is managed with **Alembic**. Migration scripts are located in `alembic/versions/`:

- `001_baseline`: Baseline schema (tables: `department`, `employee`, `salary_history`, `user`).
- `002_password_reset`: Adds `email` to `user` and creates `password_reset_token` table.

### Running Migrations

Ensure your virtual environment is active, then from the `employee_api` folder:

```powershell
# Apply all pending migrations to the database
alembic upgrade head

# Roll back the most recent migration
alembic downgrade -1

# Create a new migration after updating SQLAlchemy models in EMP_main.py
alembic revision --autogenerate -m "describe_change"

# Check migration history
alembic history --verbose
```

## Password Reset & Email (SMTP) Setup

Self-service password reset is handled via `/auth/forgot-password` and `/auth/reset-password`:

1. User requests a reset link using their **username** or **registered email**.
2. A single-use, cryptographically secure token (SHA-256 hashed in DB) is created with a 15-minute expiry.
3. If SMTP is configured, an HTML + plain text email with the reset button is sent.
4. **Development fallback:** If no SMTP credentials are configured, the system automatically logs the reset link and token directly to your terminal console, allowing instant local testing without needing an email server.

> [!NOTE]
> **No code changes are required** to use your personal email. The application reads configuration directly from environment variables.

### Setting Up Your Personal Email (e.g., Gmail)

Modern email providers block third-party scripts from using your standard login password. You must generate an **App Password** (16 characters):

1. **Enable 2-Step Verification:** Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. **Generate App Password:** Search for `App passwords`, name it (e.g. `EmployeeAPI`), and copy the 16-character token generated (e.g. `abcd efgh ijkl mnop`).
3. **Set Environment Variables in PowerShell:**

```powershell
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "your_email@gmail.com"
$env:SMTP_PASSWORD = "your_16_character_app_password"
$env:SMTP_FROM_EMAIL = "your_email@gmail.com"
$env:SMTP_TLS = "true"
$env:FRONTEND_URL = "http://localhost:5173"

# Start the backend with SMTP active
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### SMTP Environment Variables Reference

| Variable | Description | Gmail | Outlook / Hotmail | Default |
|---|---|---|---|---|
| `SMTP_HOST` | Outgoing SMTP server address | `smtp.gmail.com` | `smtp-mail.outlook.com` | `""` (dev fallback) |
| `SMTP_PORT` | SMTP port (STARTTLS) | `587` | `587` | `587` |
| `SMTP_USER` | Email username / sender address | `your_email@gmail.com` | `your_email@outlook.com` | `""` |
| `SMTP_PASSWORD` | 16-character App Password | *Generated App Password* | *Generated App Password* | `""` |
| `SMTP_FROM_EMAIL` | Displayed sender address | `your_email@gmail.com` | `your_email@outlook.com` | `no-reply@laesfera.co` |
| `SMTP_TLS` | Enable TLS encryption | `true` | `true` | `true` |
| `FRONTEND_URL` | Base URL of frontend for link generation | `http://localhost:5173` | `http://localhost:5173` | `http://localhost:5173` |
| `PASSWORD_RESET_TOKEN_EXPIRE_MINUTES` | Token lifetime | `15` | `15` | `15` |

## Frontend (React + Vite)

A small React app in `frontend/` that talks to this API. It has a login /
register page, an employee table (pagination, sorting, add/edit, salary
changes, salary history, deactivate/restore), a departments page, and an
admin-only users page. What each person sees depends on their role - a plain
user never even receives the salary or address (the API withholds them), and
buttons a role can't use are hidden.

### 1. Install Node.js (one time)

Node.js runs the build tools and dev server. Python is not involved.

**Windows - option A (installer):**
1. Go to <https://nodejs.org> and download the **LTS** Windows installer (`.msi`).
2. Run it and accept the defaults (leave "Add to PATH" ticked).
3. **Close and reopen** PowerShell / your editor's terminal so it sees the new install.

**Windows - option B (one command):**
```powershell
winget install OpenJS.NodeJS.LTS
```
Then close and reopen the terminal.

**Check it worked** (Node 18 or newer is required; LTS is fine):
```powershell
node -v
npm -v
```

Common problems:
- **`npm : File ...npm.ps1 cannot be loaded because running scripts is disabled`** -
  PowerShell blocks script files by default. Run this once (no admin needed),
  then retry:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```
  (Or just type `npm.cmd` instead of `npm`.)
- **`node` / `npm` is not recognized** - you didn't reopen the terminal after
  installing, or the installer's "Add to PATH" box was unticked.
- **`An Application Control policy has blocked this file`** - a machine-wide
  Windows security policy is stopping a native helper (Vite's `esbuild`) from
  running, the same kind of block that can affect `pandas`. It is not a bug in
  this project. Try a personal machine, or ask whoever manages the policy to
  allow the project folder.

### 2. Start the backend

In one terminal, with your Python venv active, from the folder containing
`main.py` (`D:\Sagar\Python\employee_api`):

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- Bound to `0.0.0.0:8000` so both `127.0.0.1` and `localhost` connect seamlessly.
- Interactive Swagger docs: <http://localhost:8000/docs>
- Make sure you have at least one admin (see "Creating the first admin" above).

### 3. Start the frontend

You can run the frontend from the separate `employee_frontend/` folder:

**Option A (One-Click Launcher):**
Double-click `start.bat` inside `D:\Sagar\Python\employee_frontend\`.

**Option B (Terminal):**
Open a **second** terminal:
```powershell
cd D:\Sagar\Python\employee_frontend
npm install        # first time only - downloads dependencies into node_modules/
npm run dev
```

Open <http://localhost:5173> and sign in.

### Configuration

| Setting | Where | Default |
|---|---|---|
| API address the frontend calls | `frontend/.env` -> `VITE_API_URL` (copy `frontend/.env.example`) | `http://127.0.0.1:8000` |
| Frontend addresses the API allows (CORS) | backend env var `CORS_ORIGINS`, comma-separated | `http://localhost:5173,http://127.0.0.1:5173` |

If the browser console shows a **CORS error**, the address in your browser's
URL bar isn't in `CORS_ORIGINS`. If the page says **"Cannot reach the server"**,
the backend isn't running or `VITE_API_URL` points at the wrong place.
Restart `npm run dev` after editing `.env`.

### Production build

```powershell
npm run build      # outputs static files to frontend/dist/
```

### Trying the roles

1. Sign in as your admin, open **Users**, and promote a test account to `manager`.
2. Register another account (it starts as `user`).
3. Log in as each in turn and compare what the Employees page shows.

Note: the token is kept in the browser's `localStorage` so a refresh keeps you
signed in. That is fine for a portfolio project; a production app handling
sensitive data would typically use short-lived tokens with httpOnly cookies.

## Testing

```bash
pytest -v
```

Tests run against a local SQLite file (`test.db`), so they don't touch
your real MySQL database or require it to be running.

## Docker

```bash
docker-compose up --build
```

Spins up MySQL and the API together. The API waits for MySQL's health
check to pass before starting.

## CI

`.github/workflows/ci.yml` runs the test suite and a Docker build on every
push/PR to `main`.

## GitHub Upload Guide

Follow these steps to publish your project to GitHub. You can maintain the backend and frontend in separate repositories:

### 1. Push the Backend (`employee_api`) to GitHub

1. Create a new repository on **[GitHub](https://github.com/new)** named `employee-api` (leave "Initialize with README" **unchecked**).
2. Open PowerShell in `D:\Sagar\Python\employee_api`:

```powershell
cd D:\Sagar\Python\employee_api

# 1. Initialize Git repository
git init

# 2. Check status (ensure .gitignore excludes venv/, node_modules/, test.db)
git status

# 3. Stage all project files
git add .

# 4. Commit files
git commit -m "feat: initial commit for modular FastAPI backend"

# 5. Rename branch to main
git branch -M main

# 6. Add your GitHub remote repository (replace with your GitHub username)
git remote add origin https://github.com/<your-username>/employee-api.git

# 7. Push to GitHub
git push -u origin main
```

### 2. Push the Frontend (`employee_frontend`) to GitHub

1. Create a second repository on **[GitHub](https://github.com/new)** named `employee-frontend` (leave "Initialize with README" **unchecked**).
2. Open PowerShell in `D:\Sagar\Python\employee_frontend`:

```powershell
cd D:\Sagar\Python\employee_frontend

# 1. Initialize Git repository
git init

# 2. Stage all files (node_modules is excluded by .gitignore)
git add .

# 3. Commit files
git commit -m "feat: initial commit for React Vite frontend"

# 4. Rename branch to main
git branch -M main

# 5. Add your GitHub remote
git remote add origin https://github.com/<your-username>/employee-frontend.git

# 6. Push to GitHub
git push -u origin main
```

---

## Git Version Control Guide & Cheatsheet

Here are the essential daily Git commands for version controlling your project:

### 1. Everyday Development Workflow

| Action | Command | Purpose |
|---|---|---|
| **Check Changes** | `git status` | View modified, deleted, and untracked files |
| **Inspect Differences** | `git diff` | Show exact line-by-line code changes before staging |
| **Stage Files** | `git add <file>` or `git add .` | Stage modified files for the next commit |
| **Commit Changes** | `git commit -m "feat: description"` | Save staged changes with a clear message |
| **Push Updates** | `git push` | Upload committed changes to GitHub |
| **Pull Updates** | `git pull` | Download latest changes from GitHub |

### 2. Branching & Safe Feature Development

Always create a separate branch when developing new features or refactoring code:

```powershell
# Create and switch to a new feature branch
git checkout -b feature/payroll-export

# Make changes to your code, then stage and commit:
git add .
git commit -m "feat: add PDF payroll export service"

# Push the feature branch to GitHub
git push -u origin feature/payroll-export

# Switch back to the main branch
git checkout main

# Merge your tested feature branch into main
git merge feature/payroll-export

# Push updated main to GitHub
git push origin main
```

### 3. Reviewing History & Undoing Mistakes

```powershell
# View concise commit history
git log --oneline -n 10

# Discard uncommitted changes in a specific file
git restore path/to/file.py

# Unstage a file without losing your edits
git restore --staged path/to/file.py

# Undo the last commit while keeping your edits in the working directory
git reset --soft HEAD~1
```

> [!WARNING]
> **Never commit secrets or sensitive credentials!**
> Always verify that files containing passwords or API tokens (`.env`, `venv/`, `node_modules/`, database files `*.db`) are listed in `.gitignore` before running `git add .`.

## Project structure

```
.
├── app/                             # Core modular application package
│   ├── __init__.py
│   ├── main.py                      # FastAPI app factory, CORS, routes & lifecycles
│   ├── config.py                    # Environment, JWT, DB URL, SMTP, rate limiter
│   ├── database.py                  # SQLAlchemy engine, SessionLocal, Base, get_db
│   ├── models/                      # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── department.py            # DepartmentDB
│   │   ├── employee.py              # EmployeeDB, SalaryHistoryDB
│   │   └── user.py                  # UserDB, PasswordResetTokenDB
│   ├── schemas/                     # Pydantic schemas (request/response)
│   │   ├── __init__.py
│   │   ├── auth.py                  # UserRegister, RoleUpdate, Token, PasswordReset
│   │   ├── department.py            # DepartmentCreate, DepartmentResponse
│   │   └── employee.py              # Employee, EmployeeUpdate, SalarySet/Increment
│   ├── auth/                        # Security & authorization
│   │   ├── __init__.py
│   │   ├── security.py              # Password hashing & JWT token issuance
│   │   └── dependencies.py          # get_current_user, role-based guard dependencies
│   ├── services/                    # Business logic services
│   │   ├── __init__.py
│   │   ├── email_service.py         # Joining-date email generation & SMTP reset emails
│   │   ├── employee_service.py      # Field masking views & sorting helpers
│   │   └── excel_service.py         # Excel (.xlsx) & CSV parser and batch importer
│   └── routers/                     # Endpoint controllers
│       ├── __init__.py
│       ├── health.py                # GET /health
│       ├── auth.py                  # /auth/* (login, register, reset, user management)
│       ├── departments.py           # /departments/*
│       ├── employees.py             # /employees/* (CRUD, activate, restore, excel upload)
│       └── salaries.py              # /employees/{id}/salary* & salary-history
├── main.py                          # Root ASGI entrypoint (uvicorn main:app)
├── EMP_main.py                      # Backward-compatible facade (re-exports app.*)
├── setup_frontend.bat               # Automated frontend setup, cleanup & launcher
├── import_excel.py                  # CLI batch employee spreadsheet importer
├── seed_data.py                     # Safe database seeder & reset script

├── backfill_emails.py               # One-time script to fill in Email for old rows
├── test_hashing.py                  # Standalone bcrypt sanity check (no DB)
├── alembic/                         # Database migration configuration & versions
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── tests/
│   └── test_main.py                 # Backend test suite (pytest against SQLite)
└── frontend/                        # React + Vite client
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx                 # Entry point
        ├── App.jsx                  # Routes + role-based route guard
        ├── api.js                   # Every backend call + error handling
        ├── auth.jsx                 # Login session / current user
        ├── format.js                # Number & date formatting
        ├── styles.css
        ├── components/              # Layout, Modal, EmployeeForm, SalaryModal, HistoryModal
        └── pages/                   # Login, ResetPassword, Employees, Departments, Users
```

## Recent Project Updates & Changelog

### 1. Modular Architecture Refactoring (`app/` Package)
- Transitioned the entire backend codebase from a monolithic `EMP_main.py` into a production-ready clean modular architecture:
  - **`app/main.py`**: Application factory with async lifespan, CORS middleware, global exception handlers, and auto-mounted routers.
  - **`app/config.py`**: Centralized configuration management for DB URL, JWT secrets, SMTP credentials, and SlowAPI rate limiter.
  - **`app/database.py`**: SQLAlchemy engine initialization, `SessionLocal`, base declarative models, and `get_db` dependency.
  - **`app/models/`**: Separate SQLAlchemy ORM definitions (`user.py`, `employee.py`, `department.py`).
  - **`app/schemas/`**: Validated Pydantic request/response schemas (`auth.py`, `employee.py`, `department.py`).
  - **`app/auth/`**: Security helper functions (`security.py`) and role-based access control guard dependencies (`dependencies.py`).
  - **`app/services/`**: Reusable business logic layers for joining-date email generation (`email_service.py`), field masking (`employee_service.py`), and Excel/CSV handling (`excel_service.py`).
  - **`app/routers/`**: Clean controller separation by domain (`health.py`, `auth.py`, `departments.py`, `employees.py`, `salaries.py`).
- **Backward Compatibility Preserved:** Root `main.py` acts as ASGI entrypoint, and `EMP_main.py` remains as a compatibility facade re-exporting symbols from `app.*` so existing scripts continue working seamlessly.

### 2. Joining-Date-Based Unique Email Generation
- Upgraded `generate_employee_email` in `app/services/email_service.py`:
  - **Single & Different Names:** Expands last name letters progressively (`first.l`, `first.la`, `first.las`...) to resolve collisions naturally.
  - **Identical Names (Duplicate First + Last Name):** Automatically appends the employee's joining year as a suffix (e.g. `parth.patil2026@laesfera.co`).
  - **Same-Year Collision:** Appends an incremental number (e.g. `parth.patil2026.2@laesfera.co`).
  - Accepts an optional `joining_date: "YYYY-MM-DD"` on employee creation or defaults to the current registration date.

### 3. Bulk Operations & Excel / CSV Integration
- **Excel Batch Import (`POST /employees/upload-excel`):** Admins can upload `.xlsx` or `.csv` files to create multiple employees simultaneously. Automatically provisions missing departments, calculates unique emails, and reports row-by-row validation feedback.
- **Bulk Delete Spreadsheet (`POST /employees/bulk-delete-excel`):** Batch deactivates or permanently removes employees listed in an uploaded spreadsheet.
- **Roster Export (`GET /employees/export`):** Exports the full directory to CSV with role-based field masking (salaries and addresses omitted for standard `user` accounts).
- **CSV Template Download (`GET /employees/template`):** Provides a pre-filled sample spreadsheet with instructions.
- **CLI Import Tool (`import_excel.py`):** Standalone script to import spreadsheets directly into MySQL from the terminal.
- **Bulk CRUD APIs:**
  - `POST /employees/bulk-delete`: Hard-delete multiple employee records by IDs.
  - `POST /employees/bulk-deactivate`: Soft-delete/deactivate multiple employees in a single request.
  - `POST /employees/bulk-restore`: Bulk reactivate previously inactive employees.
  - `POST /departments/bulk-create`: Batch create multiple departments.
  - `POST /employees/salary/bulk-increment`: Apply company-wide or department-specific salary adjustments (percentage or flat amount).
  - `GET /employees/salary/summary`: Aggregate analytics on company payroll (total cost, average, min, max) and department breakdowns.

### 4. Password Security & Dev Console Fallback
- Added self-service reset endpoints (`/auth/forgot-password`, `/auth/reset-password`) with SHA-256 hashed single-use tokens expiring in 15 minutes.
- **Offline / Dev Fallback:** If SMTP credentials are not configured, password reset tokens and links print directly to the server terminal/log for immediate local testing without an email server.
- Clarified documentation: bcrypt passwords are mathematically one-way and cannot be decrypted from hashes; forgotten credentials must be reset.

### 5. Automated Frontend Launcher (`setup_frontend.bat`)
- Created `setup_frontend.bat` to eliminate setup hurdles:
  - Resolves Windows NTFS `EPERM` / `Access is denied` errors caused by accidentally copied Node.js files.
  - Automatically clears stray Node binaries (`node.exe`, `npm.cmd`, `npm.ps1`, `install_tools.bat`).
  - Installs npm packages cleanly and launches Vite dev server on `http://localhost:5173`.

### 6. Test Suite & Reliability Fixes
- Added `httpx==0.28.1` to `requirements.txt`.
- Fixed `sys.path` ordering across entrypoints and `alembic/env.py`.
- Updated test authentication headers (`headers_for()`), achieving **100% pass rate (25/25 tests passing)** in `pytest`.
- Added root URL redirect (`GET /` -> `/docs`) for immediate interactive Swagger documentation.
- Configured default server host binding to `0.0.0.0:8000` to resolve `ERR_CONNECTION_REFUSED` across IPv4 and IPv6 `localhost`.

## Roadmap & Features Status

- [x] **Alembic migrations** - Baseline and versioned schema migrations in `alembic/versions/`
- [x] **Self-service "forgot password" via emailed reset link** - Secure token generation, SMTP email dispatch, dev fallback, and reset UI
- [x] **Modular architecture refactor** - Clean `app/` structure with models, schemas, auth, services, and routers
- [x] **Bulk operations & Excel/CSV importer** - Batch import, delete, template download, and payroll analytics
- [x] **Joining-date auto email generation** - Collision detection with year suffixes and counter fallbacks
- [ ] **PDF export of reports** - Export employee rosters, department expense breakdowns, and salary history to PDF
- [ ] **Attendance / leave tracking module** - Check-in/check-out logs, time-off requests, and manager approval workflows

---
*Last updated: 2026-10-01*