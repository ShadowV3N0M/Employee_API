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
..\venv\Scripts\activate              # Windows
..\venv\Scripts\Activate.ps1       # Powershell 
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
| `GET` | `/employees` | ❌ | ✅* | ✅ | ✅ | List employees (*Salary & Address hidden for `user`; supports `all_records=true` or `limit=0` for all N records without pagination caps) |
| `GET` | `/employees/{emp_id}` | ❌ | ✅* | ✅ | ✅ | Get employee details (*Salary & Address hidden for `user`) |
| `POST` | `/employees` | ❌ | ❌ | ✅ | ✅ | Create an employee (with starting salary & auto-email) |
| `PUT` | `/employees/{emp_id}` | ❌ | ❌ | ✅* | ✅ | Full update (*admin can edit all details: Name, Address, Salary, Email, Joining Date, Status; manager restricted to Name/Dept/Address) |
| `PATCH` | `/employees/{emp_id}` | ❌ | ❌ | ✅* | ✅ | Partial update (*admin can edit all details: Name, Address, Salary, Email, Joining Date, Status; manager restricted to Name/Dept/Address) |
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
| `POST` | `/employees/salary/calculate` | ❌ | ✅ | ✅ | ✅ | Calculate gross, take-home pay, EPF, PT, ESI & TDS under New & Old tax regimes |
| `GET` | `/employees/salary/my-profile` | ❌ | ✅ | ✅ | ✅ | Fetch logged-in employee's registered salary for 1-click loading |
| `PUT` | `/auth/change-password` | ❌ | ✅ | ✅ | ✅ | Change own account password (requires old password) |
| `GET` | `/auth/users` | ❌ | ❌ | ❌ | ✅ | List all users with their roles (no password hashes) |
| `POST` | `/auth/users` | ❌ | ❌ | ❌ | ✅ | Create a new user with designated role (`user`, `manager`, `admin`) |
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
2. Open PowerShell in `Your file address `:  <!--D:\Sagar\Python\employee_api -->

```powershell
cd  Your filepath address  # D:\Sagar\Python\employee_api

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
        ├── theme.jsx                # Theme context & persistent state
        ├── format.js                # Number & date formatting
        ├── styles.css               # Global responsive CSS with dark/light custom properties
        ├── components/              # Layout, ThemeToggle, Modal, EmployeeDetailModal, EmployeeForm, SalaryModal, HistoryModal
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

### 7. Interactive Role-Based Employee Detail Popup Modal & Single-Profile Endpoint
- **Role-Aware Single Employee Endpoint (`GET /employees/{emp_id}`):**
  - Powers on-demand employee inspection with role filtering handled by `employee_view()`.
  - For `admin` and `manager`, supplies `Emp_ID`, `F_Name`, `L_Name`, `Dept_ID`, `Email`, `Salary`, `Address`, `is_active`, `created_at`, and `updated_at`.
  - For standard `user`, withholds confidential fields (`Salary`, `Address`, timestamps) while returning public directory information (`Emp_ID`, `F_Name`, `L_Name`, `Dept_ID`, `Email`, `is_active`).
- **Frontend Detail Modal Integration (`EmployeeDetailModal.jsx`):**
  - Clicking any table row (or clicking the dedicated **View** button) opens an individual profile modal.
  - Standard users see a clear confidentiality notice: *“Salary compensation, residential address, and salary revision history are confidential and visible to managers and administrators only.”*
  - Admins have access to integrated action controls directly within the popup: `Deactivate/Restore`, `Adjust Salary`, `Edit Profile`, and `Salary History`.
  - Handled `e.stopPropagation()` on row action buttons to prevent unintentional modal popups when clicking inline actions.

### 8. Full Admin User Management CRUD & Permanent Delete Endpoint
- **Direct User Creation (`POST /auth/users`):** Admin-only endpoint allowing instant provisioning of user accounts with designated roles (`user`, `manager`, `admin`), password validation, and optional email.
- **Enhanced Permanent Deletion (`DELETE /auth/users/{username}`):**
  - Supports username or numeric user ID lookup.
  - Self-deletion guard: Admins cannot delete their own account (`400 Bad Request`).
  - Foreign key cascade: Explicitly removes associated password reset tokens prior to account deletion.
- **Full Frontend Admin Control Panel (`Users.jsx`):**
  - Real-time search filter by username, email, or role.
  - `+ Add User` modal dialog.
  - Deactivate/Activate account status toggling.
  - Permanent delete action with confirmation dialog.

### 9. Dark / Light Theme System & Animated Celestial Switch
- **Custom Properties Architecture:** Added full set of CSS variables (`--bg`, `--surface`, `--surface-alt`, `--border`, `--text`, `--muted`, `--primary`, `--danger`, `--ok`, `--input-bg`, `--th-bg`, `--row-hover`, `--shadow`) supporting high-contrast Dark and crisp Light modes.
- **Interactive Celestial Toggle Switch (`ThemeToggle.jsx`):** Custom pill slider switch with spring physics, rotating golden sun with ray bursts in daylight mode, and glowing crescent moon with twinkling sky stars in nighttime mode.
- **Dynamic Page Layout Ripple (View Transitions API):** Seamless hardware-accelerated circular wave transition radiating outwards from the button's exact click coordinates using `document.startViewTransition` and `clip-path: circle()`.
- **Universal Coordinated Fallback:** Progressive enhancement for non-supporting browsers with a 550ms `.theme-transitioning` overlay and synchronized custom property transitions.
- **Dynamic Theme Context:** React `ThemeProvider` with auto system detection (`prefers-color-scheme: dark`), local storage persistence, and immediate HTML attribute synchronization (`data-theme="dark"`).

### 10. 3D Card Flip Transition Animation (`Login.jsx`, `styles.css`)
- **Interactive 3D Flipping:** Implemented a two-sided authentication card with realistic perspective depth (`perspective: 1200px`, `transform-style: preserve-3d`, `rotateY(180deg)`).
- **Fluid Mode Transitions:** Form container dynamically rotates between **Sign In** (Front Face), **Account Registration** (Back Face), and **Password Reset** without jarring reloads.
- **Accessibility Safeguards:** Inputs on the unfocused face are disabled and removed from the keyboard tab sequence (`tabIndex={-1}`) to prevent ghost navigation.
- **Reduced Motion Support:** Gracefully reverts to instant mode switching when `prefers-reduced-motion: reduce` is detected.

### 11. Rooster & Owl Waking-Up Mascot Animations (`ThemeMascot.jsx`, `styles.css`)
- **Rooster Waking Up (Light Mode):** Animated rooster rises at sunrise with morning glow, neck stretching, comb jiggle, wing flutters, floating crowing notes, and *"Rise & Shine! ☀️"* bubble.
- **Owl Waking Up (Dark Mode):** Animated nocturnal owl perched on a tree branch wakes with sleepy blinks, dilating glowing irises, perked ear tufts, inquisitive head-tilt, sparkling stars, and *"Night Owl Mode! 🌙"* badge.
- **Floating Stage:** Positioned in bottom-right corner with `pointer-events: none` and 2.8s auto-dismiss.

### 12. Multi-Field Table Filtration Across All Database Entities (Backend & Frontend)
- **Employee Roster Filtration (`GET /employees` & `GET /employees/export`):**
  - **Full-Text Multi-Field Search:** Searches across First Name, Last Name, Full Name, Email, and exact numeric Employee ID (`search`).
  - **Department Scope Filter:** Filter employees by assigned department ID (`dept_id`).
  - **Account Status Filter:** Filter by `status="active"`, `status="inactive"`, or `status="all"` (with strict RBAC: standard users are prevented from viewing or filtering inactive employees).
  - **Compensation Range Filters:** Filter by `min_salary` and `max_salary` (restricted to `manager` and `admin` roles; standard users receive HTTP 403 Forbidden).
  - **Synchronized CSV Roster Export:** The `GET /employees/export` endpoint accepts the exact same filter criteria, allowing users to export the filtered employee roster directly to CSV.
- **Department Table Filtration (`GET /departments`):**
  - Query filtering by department name or numeric Dept ID (`search`).
  - Budget boundaries filtering with `min_budget` and `max_budget`.
- **User Accounts Filtration (`GET /auth/users`):**
  - Search by username, email, or numeric User ID (`search`).
  - Role dropdown filter (`role="admin"|"manager"|"user"`).
  - Account status filter (`is_active=true|false`).
- **Salary History Audit Filtration (`GET /employees/{emp_id}/salary-history`):**
  - Search revision logs by approving administrator/modifier (`changed_by`).
  - Salary range filtering (`min_salary`, `max_salary`).
- **Unified Frontend Filter Bar Component System:**
  - Modern, responsive filter cards placed directly above all data tables (`Employees.jsx`, `Departments.jsx`, `Users.jsx`, and `HistoryModal.jsx`).
  - 300ms debounced text search, clean dropdown selectors, active filter badge counters, interactive filter chip tags with one-click individual removals, and a master "Reset Filters" action.

### 13. Modern Menu Bar, User Profile Dropdown & Payroll Analytics Dashboard
- **Modern Collapsible Left Sidebar:**
  - Sleek collapsible sidebar menu bar with brand header, navigation icons, and expand/collapse toggle (`◀` / `▶`).
  - Animated width transitions between 250px (expanded) and 72px (collapsed icon-only mode with tooltips).
  - Preference persisted in browser `localStorage` (`sidebar_collapsed`).
  - Active route highlighting and user status footer brief.
- **Responsive Mobile Drawer Navigation:**
  - On screens < 900px, transitions seamlessly to an off-canvas drawer (`transform: translateX(-100%)`).
  - Topbar hamburger button (`☰`) triggers drawer with a dark blur backdrop overlay (`.sidebar-backdrop`).
  - Automatically auto-closes when a route link is selected.
- **User Profile & Account Dropdown Menu:**
  - Modern user menu button in topbar displaying initials avatar, username, role badge, and animated indicator arrow.
  - Dropdown menu panel displaying user avatar, username, email address, role badge, and interactive actions.
  - **"🔑 Change Password" Action Modal (`ChangePasswordModal.jsx`):** Self-service password updates from the topbar with client-side validation and backend integration (`POST /auth/change-password`).
  - **"🚪 Sign Out" Action:** Fast session termination.
  - Click-outside listener and Escape key dismiss.
- **Payroll & Analytics Dashboard (`Analytics.jsx`):**
  - Company-wide compensation metrics (`GET /employees/salary/summary`): Total Payroll Expense, Active Staff Headcount, Average Compensation, and Salary Range.
  - Department budget utilization cards with percentage progress bars (color-coded for safe, warning ≥80%, and over-budget >100%).
  - Detailed department compensation breakdown table with headcount, total payroll, average salary, and budget utilization.
  - Route guarded for `manager` and `admin` roles.

### 14. Admin Department Management: Budget Editing, Revision Audit History & Safe Deletion
- **Admin Department Editing (`PUT /departments/{dept_id}`):**
  - Admins can update department names and modify allocated budgets with instant DB persistence.
  - Validates uniqueness of department name and ensures budget is non-negative.
  - Accepts optional change reason / audit notes (`payload.notes`).
- **Department Revision & Budget History (`DepartmentHistoryDB`, `GET /departments/{dept_id}/history` & `GET /departments/history/all`):**
  - Automatically records historical audit records for department creation (`CREATED`), budget adjustments (`BUDGET_REVISED`), renames (`NAME_CHANGED`), and deletions (`DELETED`).
  - Stores `old_budget`, `new_budget`, `old_name`, `new_name`, `changed_by`, `changed_at`, and `notes`.
  - Accessible only by `admin` role.
- **Safe Department Deletion (`DELETE /departments/{dept_id}`):**
  - Blocks deletion if employees (active or inactive) are currently assigned to the department (`HTTP 400 Bad Request` with employee count).
  - Automatically detaches previous history logs (`Dept_ID=None`) before deleting to preserve audit history without foreign key violations.
  - Logs a permanent deletion entry with the admin's username in `DepartmentHistoryDB`.
- **Frontend Admin Action Panel (`Departments.jsx`, `DepartmentEditModal.jsx`, `DepartmentHistoryModal.jsx`):**
  - Interactive **Edit**, **History**, and **Delete** action buttons on table rows (visible exclusively to `admin`).
  - Global "📜 Audit History" header action for inspecting company-wide department logs.

### 15. Employee Salary & Take-Home Pay Calculator (`POST /employees/salary/calculate`, `GET /employees/salary/my-profile`, `SalaryCalculator.jsx`)
- **Dual Tax Regime Engine (Indian Income Tax):**
  - **New Tax Regime (FY 2024-25 / 2025-26):** Standard deduction ₹75,000, updated slab brackets (0-3L nil, 3-7L 5%, 7-10L 10%, 10-12L 15%, 12-15L 20%, >15L 30%), Section 87A rebate (tax-free up to ₹7,00,000 net taxable income), and 4% Health & Education cess.
  - **Old Tax Regime:** Standard deduction ₹50,000, 80C deduction (up to ₹1,50,000), 80D medical insurance deduction (up to ₹25,000), old tax slabs, and Section 87A rebate up to ₹5,00,000.
  - **Side-by-Side Tax Comparison Banner:** Highlights which tax regime saves more money and exact annual savings.
- **Accurate Indian Statutory Payroll Deductions:**
  - **Employee Provident Fund (EPF):** 12% of Basic pay with toggle for statutory wage ceiling cap (₹1,800/month or ₹21,600/year) vs. uncapped 12%.
  - **Professional Tax (PT):** Standard ₹200/month (₹2,500/year with Feb adjustment).
  - **Employee State Insurance (ESI):** 0.75% of Gross pay for employees with Gross ≤ ₹21,000/month (exempt above ₹21,000).
- **Earnings Breakdown:**
  - Configurable Basic Pay (50% of CTC), House Rent Allowance (HRA 50% for Metro cities, 40% for Non-Metro), Conveyance Allowance (fixed ₹1,600/month), Medical Allowance (fixed ₹1,250/month), and balancing Special Allowance.
- **Admin Full Employee Roster Inspector & Simulation Tools (`SalaryCalculator.jsx`):**
  - **All N Employee Records Access:** Removes arbitrary 200 record caps by leveraging `GET /employees?all_records=true&status=all` (`limit=0`). System administrators and managers can access, search, and calculate salary breakdowns for any number of company employees regardless of organization size.
  - **Employee Selection Directory Modal:** Comprehensive modal with live search by Name, Email, or Emp ID, Department dropdown filtering, Status filtering (Active, Inactive, All), and high-performance client-side pagination (25, 50, 100, 250, All items per page).
  - **Selected Employee Card & Appraisal Raise Simulation:** Pre-fills employee compensation and features 1-click scenario simulation buttons (`+5%`, `+10%`, `+15%`, `+20%`, and `Reset to Base`) with real-time what-if delta calculations.
  - **Official Salary Commitment (`PUT /employees/{emp_id}/salary`):** Admins can commit simulated salary revisions directly back to the database with a 1-click confirmation modal and automated salary history audit logging.
  - **Personalized Payslip Generation:** Generates individualized payslip simulations with the selected employee's actual name, ID, department, and email address.

### 16. Comprehensive Admin Employee Details Editing (`PUT/PATCH /employees/{emp_id}`, `EmployeeForm.jsx`)
- **Full Administrative Edit Authority:**
  - System administrators have unrestricted access to edit **all** attributes of an employee record:
    - **Personal & Contact:** First Name, Last Name, and Residential Address.
    - **Organizational Placement:** Department (`Dept_ID`).
    - **Official Company Email:** Directly editable with syntax validation and database uniqueness checks preventing conflicts with other staff members. Includes convenient "Auto-generate from Name" action.
    - **Joining Date (`joining_date`):** Dedicated HTML5 date picker (`YYYY-MM-DD`). Automatically synchronized with `created_at` timestamp. Includes automatic database schema migration for `employee.joining_date` column with historical backfilling.
    - **Compensation (`Salary`):** Fully editable by admin; automatically appends timestamped change entry to `salary_history` audit table.
    - **Account Status (`is_active`):** Directly toggleable between Active and Inactive / Deactivated from the edit form.
- **Role-Based Privilege Enforcement:**
  - Non-admin managers can only edit First Name, Last Name, Department, and Address. Any attempt by non-admins to alter Salary, Email, Joining Date, or Status is rejected by the backend with `HTTP 403 Forbidden`.
### 17. Universal Sort By & Filter By Engine Across All Pages (`SortByDropdown.jsx`, Backend Endpoints)
- **Backend Query Sorting Enhancements:**
  - `GET /employees`: Supports `sort_by` (`Emp_ID`, `F_Name`, `L_Name`, `Dept_ID`, `Salary`, `Email`, `joining_date`, `is_active`, `created_at`) and `order` (`asc` / `desc`).
  - `GET /departments`: Supports `sort_by` (`Dept_ID`, `Dept_Name`, `Budget`) and `order` (`asc` / `desc`).
  - `GET /auth/users`: Supports `sort_by` (`id`, `username`, `email`, `role`, `is_active`) and `order` (`asc` / `desc`).
- **Frontend Universal Controls (`SortByDropdown.jsx`):**
  - Standardized `⇅ Sort by: [Field] [▲/▼]` popover menu across all pages with active checkmarks and direction toggles (`▲ Asc (A-Z)` / `▼ Desc (Z-A)`).
  - Synchronized with clickable table headers (`.sortable-th`) showing directional arrows.
  - Interactive `⚡ Filter By` toggle button with dynamic active count pills (`⚡ Filter By (2)`), instant filtration, and quick resets across Employees, Departments, Users, Analytics, and Salary Calculator roster.

### 18. Holiday Calendar, Business Days Simulator & Company Announcements (`GET/POST /holidays`, `GET /holidays/business-days`, `GET/POST /announcements`, `Holidays.jsx`)
- **Centralized Holiday Calendar Engine (`app/models/holiday.py`, `app/routers/holidays.py`):**
  - **Database Persistence (`holiday` table):** Stores annual company and public holidays (`id`, `name`, `holiday_date`, `holiday_type`: `National` | `Gazetted` | `Festival` | `Observance`, `description`, `created_at`).
  - **Countdown & Dynamic Metadata:** Every returned holiday includes day of the week and a real-time countdown (`days_remaining`) from today's date.
  - **Upcoming Holidays Spotlight (`GET /holidays/upcoming`):** Returns the next upcoming company holidays for banner spotlights and dashboard widgets.
  - **Seed Default Holidays (`POST /holidays/seed-defaults`):** 1-click admin utility populating 12 Indian national gazetted public holidays for the current year (Republic Day, Holi, Eid, Independence Day, Gandhi Jayanti, Dussehra, Diwali, Guru Nanak Jayanti, Christmas, etc.).
  - **Full Admin CRUD:** Add individual holidays, update date/type/details, or delete holidays with confirmation.
- **Accurate Business Days Calculation Simulator (`GET /holidays/business-days`):**
  - **Leave Integration Engine:** Calculates exact working business days between any two dates.
  - **Automated Deductions:** Iterates through every date in the range, automatically identifying weekend days (Saturdays and Sundays) and deducting gazetted holidays falling on weekdays, preventing double deductions.
  - **Transparent Breakdown:** Returns total calendar days, weekend days, holiday days, net working business days, and the exact list of holidays encountered.
- **Corporate Company Announcements Bulletin Board (`announcement` table):**
  - **Priority System:** Support for four priority levels (`urgent`, `important`, `general`, `event`) with color-coded badges and visual hierarchy.
  - **Pinned Notices:** Critical announcements can be pinned to the top of the feed (`is_pinned=true`).
  - **Department Targeting:** Notices can be broadcast company-wide (`target_dept_id=None`) or targeted to specific organizational departments.
  - **Role-Based Authoring & Moderation:** Managers and Admins can publish, edit, pin, and delete announcements, while all authenticated team members have immediate reading access.
- **Interactive 3-Tab Frontend Hub (`Holidays.jsx`):**
  - **Tab 1: 📅 Holiday Calendar:** Year filter, holiday type dropdown, live text search, table view vs. modern responsive grid card view toggle, upcoming holiday spotlight banner, and Admin action modal.
  - **Tab 2: 📢 Company Announcements:** Priority filter chips, department filter, pinned notice styling with glowing alert cards, author badges, and publish modal.
  - **Tab 3: 🧮 Business Days Calculator:** Date pickers with quick presets (This Month, Next Month, Next 14 Days, Next 30 Days), calculation metrics cards, and breakdown of all holidays in the selected span.

### 19. Real-Time Push Notifications & Announcements via WebSockets (`/ws/notifications`, `GET/PATCH/DELETE /notifications`, `NotificationBell.jsx`, `NotificationContext.jsx`)
- **Full-Duplex WebSocket Engine (`app/services/notification_service.py`, `app/routers/notifications.py`):**
  - **Connection Manager (`ws_manager`):** Thread-safe WebSocket connection manager grouping active client sockets by `user_id`. Supports multi-tab and multi-device sessions per user.
  - **Handshake Authentication:** Seamless token validation via query parameter (`/ws/notifications?token={jwt_token}`) with automatic user account verification.
  - **Live Heartbeat & Keep-Alive:** Periodic 25-second ping/pong frames preventing timeout through reverse proxies and corporate firewalls.
  - **Instant Event Triggers:** Automated real-time push dispatches connected to core business actions:
    - *Announcements:* When managers or admins publish a corporate bulletin board notice.
    - *Employee Management:* When new staff members are onboarded, restored, or permanently deleted.
    - *Salary Revisions:* When compensation adjustments or batch payroll revisions are committed.
    - *Department Operations:* When organizational departments are created or budgets modified.
- **Persistent Notification Inbox & REST APIs (`notification` table):**
  - Stores user alerts with category types (`announcement`, `employee`, `salary`, `department`, `system`, `info`, `warning`, `success`), dynamic relative timestamps (`time_ago`), deep-links, and read statuses.
  - Endpoints:
    - `GET /notifications`: Paginated notification retrieval with `unread_only` filter.
    - `GET /notifications/unread-count`: Lightweight badge count endpoint.
    - `PATCH /notifications/{id}/read`: Mark specific item as read.
    - `PATCH /notifications/mark-all-read`: 1-click batch read update for current user.
    - `DELETE /notifications/{id}` & `DELETE /notifications/clear-all`: Inbox management.
    - `POST /notifications/broadcast`: Restricted admin/manager endpoint to dispatch custom push alerts to everyone or specific roles.
- **Frontend Topbar Notification Bell & Audio Chime (`NotificationBell.jsx`, `NotificationContext.jsx`):**
  - **Animated Bell & Badge:** Topbar notification bell with ringing animation on new incoming alerts, unread count pill badge (`99+`), and green "Live" WebSocket status indicator dot.
  - **Melodic Web Audio Chime:** Gentle synthetic two-tone chime (E5 ➔ A5) generated natively via the HTML5 Web Audio API on new incoming notifications (no external audio assets required).
  - **Interactive Popover Dropdown:** "All" vs "Unread" filter tabs, category icon badges, deep-link navigation on click, individual dismissal, and clear-read action.
  - **Floating Real-Time Toast Banner:** Slide-in alert at the top-right corner with live pill badge and auto-dismiss timer.
  - **Native Desktop Push Notifications:** Integrated browser notifications via `Notification.requestPermission()`.
  - **Manager / Admin Broadcast Modal:** Instant modal allowing team leaders to compose and dispatch custom alerts to all staff or targeted roles.

### 20. Employee Self-Service Profile & Emergency Contacts (`GET/PUT /employees/me/profile`, `GET/POST/PUT/DELETE /employees/me/emergency-contacts`, `GET /employees/{emp_id}/emergency-contacts`, `Profile.jsx`)
- **Identity Link Engine (`UserDB.emp_id` & `resolve_user_employee`):**
  - Seamlessly links user login accounts to employee records via explicit `emp_id` foreign key, with intelligent automatic fallback to official email address or username matching.
  - Dedicated admin utility endpoint `POST /employees/link-user` to explicitly bind user accounts to employee IDs.
- **Extended Personal Profile Attributes (`EmployeeDB` & Database Migrations):**
  - Added personal non-organizational fields: `personal_phone` (mobile), `blood_group` (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`), `dob` (date of birth), and `marital_status` (`Single`, `Married`, `Divorced`, `Widowed`).
  - Automatic database schema migration in `app/database.py` ensuring backwards compatibility.
- **Self-Service Boundaries & Privacy Protection:**
  - `GET /employees/me/profile`: Authenticated staff view their complete personal profile, official department placement, joining date, private salary/compensation, and registered emergency contacts.
  - `PUT /employees/me/profile`: Allows employees to self-manage their personal contact number, blood group, date of birth, marital status, and residential address while strictly preventing unauthorized alteration of official company fields (Salary, Department, Email, Joining Date).
  - Automatically dispatches real-time audit notifications on profile updates.
- **Emergency Contacts & SOS Directory (`employee_emergency_contact` table):**
  - Relational emergency contact table with cascade deletion: `emp_id`, `contact_name`, `relationship_type` (`Spouse`, `Parent`, `Sibling`, `Child`, `Friend`, `Guardian`, `Other`), `phone_primary`, `phone_secondary`, and `is_primary` priority flag.
  - Automatic single-primary enforcement: Setting a contact as primary resets other contacts for that employee.
  - Full self-service CRUD (`GET/POST/PUT/DELETE /employees/me/emergency-contacts`).
  - **Manager & HR SOS Lookup:** Dedicated endpoint `GET /employees/{emp_id}/emergency-contacts` allowing team leads and HR admins to look up emergency contacts for any staff member in an incident.
- **Frontend Interactive Profile Hub & Detail Modal (`Profile.jsx`, `EmployeeDetailModal.jsx`):**
  - **Hero Header Card:** Employee avatar with initials, role badge, active status pill, department, and annual CTC preview tile.
  - **Tab 1 (Personal Details):** Form to edit personal phone, select blood group with medical badge, set date of birth with live age calculator, marital status, and residential address, alongside read-only organizational credentials.
  - **Tab 2 (Emergency Contacts & SOS):** Primary contact spotlight hero card with click-to-call link (`tel:...`), copy-number action, secondary contacts grid, and modal dialog to add/edit emergency contacts.
  - **Manager Detail Modal Integration:** `EmployeeDetailModal.jsx` displays blood group badges, personal mobile phone, and the full emergency contacts list for rapid medical/incident outreach.
  - **Navigation Integration:** Added `👤 My Profile` in the collapsible sidebar and directly at the top of the topbar user profile dropdown menu.

### 23. PDF Export & Official Company Reports Engine
- **ReportLab PDF Rendering Pipelines (`app/services/pdf_service.py`):**
  - **Two-Pass `NumberedCanvas` Engine:** Automatically computes total document pages and renders running top rule on secondary pages along with formal bottom footer (`Confidential • La Esfera Technologies Pvt. Ltd. • Page X of Y`).
  - **Indian Currency & Numbering Notation:** Converts numbers into Indian formatted strings (`Rs. 7,50,000.00`) and Indian currency words in Lakhs/Crores (`Rupees Seven Lakh Fifty Thousand Only`).
  - **Official Payslip Voucher (`GET /reports/payslip/{emp_id}/pdf`, `GET /reports/my-payslip/pdf`):**
    - High-fidelity portrait A4 payslip with corporate branding, CIN, and employee identification grid.
    - Working days and attendance summary banner (Days in month, Days paid, Loss of pay).
    - Side-by-side Earnings table (Basic 50%, HRA 40/50%, Special Allowance, Conveyance, Medical) vs. Statutory Deductions (EPF 12%, Professional Tax, ESI 0.75%, TDS Income Tax).
    - Prominent Net Salary Payable banner with figure and words in Indian numbering.
    - Annual CTC overview and digital verification signature block.
    - Role-aware: Administrators and managers can generate for any employee; employees can self-serve their own payslip voucher.
  - **Employee Directory & Headcount Report (`GET /reports/employees/pdf`):**
    - Executive landscape A4 multi-column layout formatted for HR printing.
    - Top KPI cards (Total Headcount, Active Personnel, Inactive, Total Departments).
    - Department, status (active/inactive/all), and search keyword filtration with filter criterion banner.
    - Privilege masking: Manager/Admin view includes compensation totals and individual CTC; regular users view public directory columns only.
  - **Department Budget Utilization & Expense Statement (`GET /reports/departments/pdf`):**
    - Fiscal statement detailing headcount, annual payroll expenditure, allocated budgets, and budget consumption percentages.
    - Color-coded audit status pills (Normal, Near Cap, Exceeded).
    - Overall company-wide budget consumption index and financial observations summary.
  - **Salary Revision Notice & Increment Audit Letter (`GET /reports/salary-revisions/{emp_id}/pdf`, `GET /reports/my-salary-revision/pdf`):**
    - Formal corporate letterhead with unique reference number, date, and employee address block.
    - Formal notice of compensation amendment with new CTC and net increment percentage.
    - Chronological compensation audit log table detailing every historical change in `salary_history` (Date, Previous Salary, Revised Salary, Increment Amount, Authorized By).
    - Confidentiality clause and executive signature approval block.
- **Frontend Integration (`Reports.jsx`, `api.js`):**
  - **Reports Hub (`/reports`):** Dedicated page with tabbed controls for Payslip Voucher, Employee Directory, Department Budget, and Salary Revision Letter with live preview in a new tab (`previewPdf`) and direct download (`downloadPdf`).
  - **Directory Toolbar Integration (`Employees.jsx`):** One-click `📑 Export PDF` button in the directory toolbar exporting the currently filtered employee roster.
  - **Employee Detail Modal (`EmployeeDetailModal.jsx`):** Quick actions to generate `🧾 Payslip (PDF)` and `📄 Revision Letter (PDF)` directly from an employee's profile popup.
  - **Salary Calculator (`SalaryCalculator.jsx`):** `📑 Download Official PDF` button inside the simulation modal to export the modeled payslip voucher.
  - **Department Management (`Departments.jsx`):** Direct `📑 Budget PDF Report` button for executive leadership.
  - **Self-Service Profile (`Profile.jsx`):** Quick download buttons for `🧾 My Payslip (PDF)` and `📄 Compensation Letter (PDF)`.

## Roadmap & Features Status

- [x] **Alembic migrations** - Baseline and versioned schema migrations in `alembic/versions/`
- [x] **Self-service "forgot password" via emailed reset link** - Secure token generation, SMTP email dispatch, dev fallback, and reset UI
- [x] **Modular architecture refactor** - Clean `app/` structure with models, schemas, auth, services, and routers
- [x] **Bulk operations & Excel/CSV importer** - Batch import, delete, template download, and payroll analytics
- [x] **Joining-date auto email generation** - Collision detection with year suffixes and counter fallbacks
- [x] **Interactive Role-Based Employee Detail Popup Modal** - Row-click modal and role-masked single profile API (`GET /employees/{emp_id}`)
- [x] **Full Admin User CRUD & Account Deletion** - Direct user creation, role assignment, status toggling, and permanent account deletion (`DELETE /auth/users/{username}`)
- [x] **Dark / Light Theme Toggle** - Theme selector using CSS custom properties, persistent state & system media query
- [x] **Rooster & Owl Waking-Up Mascots** - Animated sunrise rooster (light) and twilight owl (dark) with interactive stage choreography
- [x] **3D Card Flip Animation** - Interactive 3D perspective flip transition between Sign In and Registration forms with accessibility controls
- [x] **Multi-Field Table Filtration Across All Database Entities** - Full search, department, role, status, and compensation boundaries across Employee, Department, User, and Salary History tables with synchronized CSV export
- [x] **Modern Collapsible Left Sidebar & Responsive Mobile Drawer** - Collapsible sidebar with localStorage persistence, mobile drawer overlay, and hamburger navigation
- [x] **User Profile & Account Dropdown Menu** - Topbar account menu with avatar, role badge, "Change Password" modal, and sign out
- [x] **Analytics & Payroll Dashboard** - Visual KPI cards, department budget utilization progress bars, and breakdown tables for managers & admins
- [x] **Admin Department Management & Budget Revision History** - Department name & budget allocation editing, automated revision audit trail, and safe deletion with employee assignment protection
- [x] **Interactive Salary & Take-Home Pay Calculator** - Dual tax regime comparison (New vs. Old), statutory deductions (EPF, PT, ESI), "Load My Salary" profile integration, and printable payslip simulation preview
- [x] **Full Admin Access to Edit All Employee Details** - Admin can modify First/Last Name, Department, Residential Address, Salary (with audit history), Official Email (with uniqueness check), Joining Date (with schema migration), and Account Status (active/inactive)
- [x] **Universal Sort By & Filter By Engine Across Every Page & Modal** - Dedicated Sort By dropdown popover with direction toggles, clickable table headers, and Filter By button with active count pills across Employees, Departments, Users, Analytics, and Salary Calculator roster
- [x] **Show / Hide Password Visibility Toggle** - Interactive eye icon toggles password visibility (plain text vs masked) on Login and Registration forms with theme-adaptive styling and accessibility support
- [x] **Admin Permanent Employee Deletion & Auto-Resequencing of Emp_IDs** - Admin can permanently delete an employee directly from the edit form; cascades salary history deletion and automatically decrements all subsequent Emp_IDs by 1 in an atomic transaction so employee IDs remain strictly consecutive without gaps
- [x] **PDF export & official report generator** - Official payslip vouchers, department expense statements, employee directories, and salary revision letters via `reportlab` with running headers, footers, and two-pass page numbering
- [x] **Employee Analytics** - Visual KPI cards, Employee Attendence and other details utilization progress bars and Pie Charts, and breakdown tables for managers, admins & Users
- [ ] **Employee attendance & time-tracking module** - Real-time clock-in/out, punch logs, work hour analytics, and regularization requests
- [ ] **Leave & time-off management system** - Accrual balances, multi-day leave applications, and multi-tier manager approval workflows
- [ ] **Performance appraisal & review management** - Evaluation cycles, metric scorecards, and appraisal-driven salary increment integrations
- [ ] **Multi-factor authentication (MFA/2FA) & session manager** - TOTP authenticator QR setup via `pyotp` and concurrent session tracking
- [x] **Real-time push notifications & announcements (WebSockets)** - Live topbar notification bell, unread badge counter, audio chime, and company announcements
- [ ] **Employee document & KYC storage vault** - Encrypted cloud/local storage for contracts, identity proofs, and tax declaration receipts
- [ ] **Global command palette (`Ctrl+K` / `Cmd+K`)** - Spotlight-style instant navigation, quick employee search, and keyboard shortcut hub
- [ ] **Automated database backup & disaster recovery** - Scheduled SQL snapshot dumps, backup management console, and safe point-in-time restore
- [ ] **Outgoing webhooks & third-party HRIS integrations** - Event-driven webhooks for Slack, Microsoft Teams, and enterprise payroll APIs
- [ ] **Organization chart & reporting hierarchy** - Manager relationships, direct reports, and cycle-detection traversal
- [x] **Employee self-service profile & emergency contacts** - Self-service personal profile editing, primary/secondary emergency contacts, and blood group directory
- [x] **Holiday calendar & company announcements** - Annual company holiday schedule, corporate bulletin board, and business-day calculation engine
- [ ] **Statutory compliance exports** - Indian payroll statutory reporting (PF ECR text file, ESI monthly return, Form 16, and 24Q quarterly returns)
- [ ] **Single Sign-On (SSO)** - Enterprise SSO integration via Google Workspace and Microsoft 365 (OAuth2 / OIDC)
- [ ] **Fine-grained custom permission builder** - Granular role and permission matrix beyond fixed admin/manager/user tiers
- [ ] **Scheduled, emailed recurring reports** - Automated cron delivery of payroll, attendance, and budget reports directly to executive inboxes
- [ ] **Progressive Web App (PWA) & offline support** - Service worker caching, installable mobile app experience, and offline-resilient directory browsing

---

## Future Updates & Next-Gen Roadmap

The following modules represent the next-generation architectural enhancements planned for future release cycles of the Employee Management & HRMS Platform:

### 1. PDF Export & Official Company Reports Engine
- **Backend Architecture:**
  - Integrated `reportlab` and `weasyprint` rendering pipelines.
  - Endpoints:
    - `GET /reports/payslip/{emp_id}/pdf`: Generates formal, printable monthly salary slip vouchers containing gross earnings, statutory deductions (EPF, PT, ESI, TDS), net pay, and organization seal watermark.
    - `GET /reports/employees/pdf`: Filtered directory report formatted for HR printing.
    - `GET /reports/departments/pdf`: Department-level budget utilization and head-count cost breakdown report for executive leadership.
    - `GET /reports/salary-revisions/{emp_id}/pdf`: Formal salary increment/revision letter with compensation history audit log.
- **Frontend Integration:**
  - Dedicated "Export PDF" buttons embedded in `SalaryCalculator.jsx` (payslip voucher preview and instant PDF download), `Employees.jsx`, `Analytics.jsx`, and `HistoryModal.jsx`.

### 2. Employee Attendance & Time-Tracking Module
- **Backend Architecture:**
  - New database table `attendance` (`id`, `emp_id`, `date`, `clock_in`, `clock_out`, `total_hours`, `status`: `present` | `late` | `half_day` | `absent`, `work_mode`: `office` | `remote` | `hybrid`).
  - Endpoints:
    - `POST /attendance/clock-in`: Captures timestamp and IP/work mode.
    - `POST /attendance/clock-out`: Calculates shift duration and overtime.
    - `GET /attendance`: Paginated attendance history with date-range filters.
    - `POST /attendance/regularize`: Allows employees to request correction for missed punches with manager approval flow.
- **Frontend Integration:**
  - Topbar Quick-Action Clock-In / Clock-Out widget with live stopwatch timer.
  - Dedicated `/attendance` dashboard with monthly calendar heatmap, punch history table, and manager approval queue.

### 3. Leave & Time-Off Management System
- **Backend Architecture:**
  - Tables: `leave_balances` (`emp_id`, `casual_leave`, `sick_leave`, `earned_leave`) and `leave_requests` (`id`, `emp_id`, `leave_type`, `start_date`, `end_date`, `reason`, `status`: `pending` | `approved` | `rejected`, `reviewed_by`, `reviewer_comments`).
  - Automated accrual engine: Monthly cron task crediting leave quotas based on company tenure.
  - Endpoints:
    - `POST /leaves/apply`: Submits request with automatic business-day calculation (excluding weekends and public holidays).
    - `GET /leaves/my-requests`: Employee request tracking.
    - `PATCH /leaves/{request_id}/status`: Manager approval/rejection endpoint with automated notification.
- **Frontend Integration:**
  - Dedicated `/leaves` view with leave balance overview cards, calendar selector, and interactive approval hub for managers.

### 4. Performance Appraisal & Review Management
- **Backend Architecture:**
  - Table: `appraisals` (`id`, `emp_id`, `cycle_id`, `rating`, `self_assessment`, `manager_feedback`, `promotion_recommended`, `recommended_increment_pct`, `status`).
  - Endpoints:
    - `POST /appraisals/submit`: Employee self-evaluation submission.
    - `PUT /appraisals/{id}/review`: Manager rating and feedback submission.
    - `POST /appraisals/{id}/apply-increment`: Admin action to directly promote recommended increment into employee salary and generate revision history.
- **Frontend Integration:**
  - Seamless integration with the existing `SalaryCalculator.jsx`, allowing managers to test appraisal percentages (`+5%`, `+10%`, `+15%`) and commit them with a single click.

### 5. Multi-Factor Authentication (MFA / 2FA) & Session Security
- **Backend Architecture:**
  - Time-based One-Time Password (TOTP) standard implementation using `pyotp` and QR code generator (`qrcode[pil]`).
  - Endpoints:
    - `POST /auth/2fa/setup`: Generates base32 secret and QR code URI.
    - `POST /auth/2fa/verify`: Validates 6-digit TOTP token to activate 2FA and generates one-time backup recovery codes.
    - `POST /auth/2fa/disable`: Requires current password and token verification.
  - Active session registry tracking client IP, user agent, login timestamp, and token revocation for single-device or global sign-out.
- **Frontend Integration:**
  - "Security & 2FA" tab in User Profile modal (`ChangePasswordModal.jsx` / User Menu).
  - Setup wizard with QR code scanner view, token verification input, and active session manager with "Revoke All Other Sessions".

### 6. Real-Time Push Notifications & Announcements (WebSockets / SSE)
- **Backend Architecture:**
  - WebSocket hub or Server-Sent Events (SSE) router (`/ws/notifications/{user_id}`).
  - Event dispatch triggers for:
    - Salary revisions and appraisal approvals.
    - Leave request status updates.
    - Role modifications and security alerts.
    - System-wide corporate broadcast announcements.
- **Frontend Integration:**
  - Interactive topbar Notification Bell icon with real-time unread badge counter, sliding notification drawer, audio notification toggle, and instant notification toast popups.

### 7. Employee Document & KYC Storage Vault
- **Backend Architecture:**
  - Table: `employee_documents` (`id`, `emp_id`, `category`: `id_proof` | `contract` | `tax_form` | `certificate`, `filename`, `file_path`, `file_size`, `mime_type`, `uploaded_at`).
  - Secure local or S3-compatible cloud storage with cryptographic checksums, virus scanning validation, and role-restricted signed download URLs (`GET /employees/{emp_id}/documents/{doc_id}/download`).
- **Frontend Integration:**
  - "Documents & KYC" tab inside `EmployeeDetailModal.jsx` with drag-and-drop file upload, document previewer (PDF & image modal), and document verification status pills (`Verified` / `Pending Verification`).

### 8. Global Command Palette & Keyboard Shortcuts (`Ctrl+K` / `Cmd+K`)
- **Backend Architecture:**
  - High-speed unified search endpoint `GET /search/global?q=...` querying across employees, departments, users, and audit logs with relevance ranking.
- **Frontend Integration:**
  - Spotlight-style Command Palette modal accessible via `Ctrl+K` / `Cmd+K` keyboard shortcut or topbar quick search.
  - Keyboard navigation (`↑`, `↓`, `Enter`, `Esc`) to jump to any page, open specific employee details, toggle theme, or trigger bulk operations.
  - Keyboard shortcuts cheat-sheet modal (`?` key).

### 9. Automated Database Backups & Disaster Recovery
- **Backend Architecture:**
  - Scheduled automated database dumps (`pg_dump` / `sqlite3`) compressed to `.sql.gz` with configurable retention policies (daily, weekly, monthly).
  - Endpoints (restricted to Super-Admin role):
    - `GET /admin/backups`: Lists existing snapshots with file size and timestamp.
    - `POST /admin/backups/create`: Triggers immediate snapshot creation.
    - `POST /admin/backups/restore/{backup_id}`: Safe database restoration workflow with pre-restore state locking.
- **Frontend Integration:**
  - Admin-only "System & Maintenance" panel showing backup status, disk usage, 1-click snapshot creation, and snapshot download links.

### 10. Outgoing Webhooks & Third-Party HRIS Integration
- **Backend Architecture:**
  - Event-driven webhook dispatcher engine supporting HMAC SHA-256 signatures for payload integrity.
  - Configurable event subscriptions: `employee.created`, `employee.updated`, `salary.revised`, `leave.approved`.
  - Native incoming webhook connectors for Slack and Microsoft Teams for HR announcements.
- **Frontend Integration:**
  - Webhooks management dashboard in Admin view: configure target URLs, secret signing keys, event filters, and review delivery logs with HTTP response status codes.

### 11. Organization Chart & Reporting Hierarchy
- **Backend Architecture:**
  - Database schema extension: `manager_id = Column(Integer, ForeignKey("employee.Emp_ID"), nullable=True)` on `EmployeeDB`.
  - Recursive tree traversal engine with cycle-detection graph verification (preventing circular reporting loops `A -> B -> A`).
  - Endpoints:
    - `GET /employees/org-chart`: Returns full nested organization tree with direct report headcounts and department branches.
    - `PATCH /employees/{emp_id}/manager`: Reassigns reporting manager with validation and cycle prevention.
    - `GET /employees/{emp_id}/team`: Returns direct and indirect subordinates for any manager or team lead.
- **Frontend Integration:**
  - Dedicated `/org-chart` page with interactive zoomable and pannable hierarchy chart, collapsible department nodes, manager quick-reassignment, and employee profile preview cards.

### 12. Employee Self-Service Profile & Emergency Contacts
- **Backend Architecture:**
  - Tables: `employee_emergency_contacts` (`id`, `emp_id`, `contact_name`, `relationship`, `phone_primary`, `phone_secondary`, `is_primary`) and extended personal attributes (`blood_group`, `personal_phone`, `dob`, `marital_status`).
  - Endpoints:
    - `GET /employees/me/profile`: Authenticated user views their linked employee profile.
    - `PUT /employees/me/profile`: Allows employees to self-manage personal details, residential address, and emergency contacts without exposing privileged salary or department fields.
- **Frontend Integration:**
  - "My Profile & Emergency Contacts" tab inside the topbar User Profile dropdown; instant SOS/emergency contact lookup cards for managers and HR administrators.

### 13. Holiday Calendar & Company Announcements
- **Backend Architecture:**
  - Tables: `holidays` (`id`, `name`, `date`, `is_optional`, `applicable_regions`) and `announcements` (`id`, `title`, `body`, `priority`: `urgent` | `standard` | `low`, `published_at`, `expires_at`, `created_by`).
  - Business logic integration: Leave engine queries `holidays` and weekends to automatically compute deductible business days during leave applications.
  - Endpoints:
    - `GET /holidays`: List annual corporate paid holidays.
    - `POST /holidays`: Admin endpoint to manage company holidays.
    - `GET /announcements`: Corporate announcement feed with priority ordering.
- **Frontend Integration:**
  - Interactive Holiday Calendar view showing upcoming paid days off; corporate bulletin board banner widget on the dashboard for urgent company-wide notices.

### 14. Statutory Compliance Exports (Indian Payroll & Tax Filings)
- **Backend Architecture:**
  - Automated compliance calculator tied to Salary Calculator logic (EPF 12% capped at ₹1,800/actuals, ESI 0.75%/3.25%, Professional Tax state slabs, TDS projections under New & Old tax regimes).
  - Endpoints:
    - `GET /compliance/pf-ecr`: Generates official EPFO Electronic Challan Return (ECR) text file formatted for direct upload to the EPFO unified portal.
    - `GET /compliance/esi-return`: Generates monthly ESIC contribution return spreadsheet.
    - `GET /compliance/form-16/{emp_id}`: Generates Part A and Part B PDF certificate for annual income tax return filing.
    - `GET /compliance/tds-24q`: Generates quarterly 24Q e-TDS filing format.
- **Frontend Integration:**
  - Dedicated "Statutory Compliance Hub" in Analytics page: 1-click downloads for ECR text files, ESIC spreadsheets, state PT reports, and batch Form 16 PDF exports.

### 15. Single Sign-On (SSO via Google Workspace & Microsoft 365)
- **Backend Architecture:**
  - OAuth2 / OpenID Connect (OIDC) pipeline supporting Google Identity and Microsoft Azure AD / Entra ID.
  - Endpoints:
    - `GET /auth/sso/google/login` & `GET /auth/sso/google/callback`
    - `GET /auth/sso/microsoft/login` & `GET /auth/sso/microsoft/callback`
  - JIT (Just-In-Time) user provisioning mapping corporate emails (`@laesfera.co`) directly to active database employees.
  - Strict domain restriction enforcement for enterprise security.
- **Frontend Integration:**
  - Sleek "Sign in with Google" and "Sign in with Microsoft" action buttons on the 3D flip card login page (`Login.jsx`), styled to respect active light and dark themes.

### 16. Fine-Grained Custom Permission Builder
- **Backend Architecture:**
  - Tables: `permissions` (`id`, `code`: `employees.view_salary`, `employees.edit_basic`, `departments.manage_budget`, `attendance.approve`, etc.) and `role_permissions` join table.
  - Dynamic permission dependency injection middleware evaluating user permissions per request rather than static role enums.
  - Endpoints:
    - `GET /auth/permissions`: Complete permission catalog.
    - `POST /auth/roles/custom`: Create custom enterprise roles (e.g. "HR Payroll Specialist", "Department Lead", "Auditor").
    - `PUT /auth/roles/{role_id}/permissions`: Updates granular permission matrix.
- **Frontend Integration:**
  - Interactive Role & Permission Matrix view in Users management (`Users.jsx`) with checkbox grid for granular privilege assignments.

### 17. Scheduled, Emailed Recurring Reports
- **Backend Architecture:**
  - Asynchronous background task scheduler (Celery / APScheduler) running periodic report generations.
  - Table: `scheduled_reports` (`id`, `report_type`: `payroll_summary` | `department_budget` | `attendance_headcount`, `frequency`: `daily` | `weekly` | `monthly`, `recipient_emails`, `cron_expression`, `is_active`).
  - Automated HTML email dispatch with attached PDF/Excel reports using configured SMTP gateway.
- **Frontend Integration:**
  - "Scheduled Reports" modal in Analytics page: configure report type, recipients, frequency, and test immediate dispatch with preview.

### 18. Progressive Web App (PWA) & Offline Support
- **Backend Architecture:**
  - Enhanced cache headers and ETag validation for static and semi-static API responses (`/departments`, `/employees/summary`).
  - Delta synchronization endpoint `GET /sync/delta?since=...` returning only records modified since the client's last sync timestamp.
- **Frontend Integration:**
  - Web App Manifest (`manifest.json`) and service worker with Workbox caching strategies (stale-while-revalidate for rosters, cache-first for assets).
  - Install App banner prompt for mobile and desktop; offline indicator with cached directory browsing and queued background actions.

---
*Last updated: 2026-10-05*