# Security Architecture & Threat Model

**Project:** Enterprise Employee & Payroll Management System  
**Version:** 2.5  
**Date:** October 23, 2026  
**Scope:** Authentication, Authorization, Cryptography, Data Masking & Defense-in-Depth  

---

## 1. Security Overview & Threat Model

The application enforces a **Defense-in-Depth** security architecture designed to prevent unauthorized privilege escalation, sensitive compensation data leaks, SQL injection, credential brute-forcing, and cross-site attacks.

```
[ External Client Request ]
             │
             ▼
[ 1. Transport & Network Layer ] ──► HTTPS / TLS, CORS Whitelist
             │
             ▼
[ 2. Rate Limiting Layer ] ────────► slowapi (10 req/min & 60 req/min)
             │
             ▼
[ 3. Authentication Layer ] ───────► JWT Signature Verification (HS256)
             │
             ▼
[ 4. Authorization & RBAC ] ───────► Live DB Role Lookup (admin, manager, user)
             │
             ▼
[ 5. Input Validation Layer ] ─────► Pydantic v2 Strict Type Contracts
             │
             ▼
[ 6. Data Access & ORM Layer ] ────► SQLAlchemy Parameterized Queries (No SQLi)
             │
             ▼
[ 7. Response Masking Layer ] ─────► employee_view() Role-Tailored Field Stripping
```

---

## 2. Authentication Architecture

### 2.1 OAuth2 Password Flow & JWT Tokens
- **Endpoint:** `POST /auth/login`
- **Protocol:** Standard OAuth2 Password Bearer flow taking `application/x-www-form-urlencoded` credentials (`username`, `password`).
- **Token Format:** Signed JSON Web Token (JWT) utilizing the **HMAC-SHA256 (HS256)** cryptographic signature.
- **Payload Structure:**
  ```json
  {
    "sub": "username_here",
    "role": "admin",
    "exp": 1729000000
  }
  ```
- **Expiration Policy:** Access tokens expire after **60 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES = 60`).
- **Secret Key Management:** The cryptographic secret key is read from the `JWT_SECRET_KEY` environment variable. Production environments must inject a high-entropy 256-bit secret; fallback placeholders in source code are strictly forbidden in production.

### 2.2 Password Hashing & Salt Policy
- **Cryptographic Wrapper:** Implemented using `passlib.context.CryptContext` with the `bcrypt` hashing scheme.
- **Cost Factor:** Work factor 12 rounds (`rounds=12`).
- **Dependency Pinning Invariant:**
  ```
  passlib==1.7.4
  bcrypt==4.0.1
  ```
  *Security Note:* `bcrypt` must remain pinned to version `4.0.1`. Upgrading to version `4.1+` causes fatal string length checks inside `passlib`, breaking password hashing with runtime exceptions.

### 2.3 Self-Service Password Reset Security
- **Token Generation:** Generated using `secrets.token_urlsafe(32)`, providing 256 bits of cryptographic entropy.
- **Token Storage:** Tokens are **never** stored in plaintext. The database (`password_reset_token.token_hash`) records a cryptographic hash of the token.
- **Single-Use Enforcement:** The `used` boolean flag transitions to `True` upon successful password change. Tokens cannot be reused.
- **Expiration:** Tokens are valid for exactly **15 minutes**.
- **User Enumeration Prevention:** Calling `POST /auth/forgot-password` returns a generic success message (`"If this identifier is registered, a password reset link has been sent."`) regardless of whether the identifier exists, preventing account enumeration.

### 2.4 Inactivity Session Timeout & Token Revocation
- **Universal Multi-Device Monitoring:** Inactivity listener monitors user actions (`mousedown`, `mousemove`, `keydown`, `touchstart`, `touchmove`, `touchend`, `scroll`, `wheel`, and `click`) across all authenticated roles (`admin`, `manager`, `user`).
- **Policy Persistence (`system_setting`):** Managed globally in the database under `session_timeout_minutes` and `session_auto_logout_idle`, fetched via `GET /auth/session-config` and updated via `PUT /auth/session-config`.
- **Dynamic Warning Shield:** Displays a security modal before auto-logout occurs. Warning thresholds scale dynamically with session length (15s for 1 min, 30s for 2 min, up to 60s for 5+ min), preventing premature modal popups on short testing sessions.
- **Cross-Tab & State Sync:** Uses `localStorage` timestamp keys (`session_last_active`, `portal_session_timeout`) so actions in any tab keep all tabs alive simultaneously.
- **Mobile Background & Sleep Detection:** Uses `visibilitychange` and `window.focus` handlers to immediately revoke tokens if a phone returns from a sleep/lock screen past the timeout limit.
- **Forced Token Clearance:** On expiration, clears JWT tokens, purges cached user state, and redirects to `/login?reason=timeout&minutes=X` with an explicit alert banner.
- **Session Refresh Ping:** Calling `POST /auth/refresh-session` allows active users to refresh session validity without disrupting existing workflows.

---

## 3. Authorization & Role-Based Access Control (RBAC)

The system enforces three distinct access tiers:

| Security Capability | `user` (Standard) | `manager` (Department Lead) | `admin` (Superuser) |
|---|:---:|:---:|:---:|
| **Directory Viewing (Name, Dept, Email)** | ✅ | ✅ | ✅ |
| **Sensitive PII (Address, DOB, Phone, Marital)** | ❌ (Masked) | ✅ | ✅ |
| **Salary Data (Current & History)** | ❌ (Masked) | ✅ | ✅ |
| **Employee Creation & Operational Edits** | ❌ | ✅ | ✅ |
| **Salary Revisions & Bulk Increments** | ❌ | ❌ | ✅ |
| **Excel Batch Hub (Import / Mass Operations)** | ❌ | ❌ | ✅ |
| **Permanent Deletions & Resequencing** | ❌ | ❌ | ✅ |
| **User Role Management & Status Toggle** | ❌ | ❌ | ✅ |

### 3.1 Live Database Role Verification
Unlike naive JWT architectures where user permissions are baked statically into client tokens:
- **Dependency Injection Guard (`app/auth/dependencies.py`):** Every protected endpoint decodes the username (`sub`) from the token and **immediately queries the live user record from the database**.
- **Zero-Latency Revocation:** If an administrator demotes an account from `admin` to `user` or deactivates an account (`is_active = False`), the change takes effect immediately on the user's next request without waiting for the JWT to expire.

### 3.2 Output Sanitization & Field-Level Data Masking
Data masking is enforced at the serialization boundary using the `employee_view(emp, role)` helper:
```python
def employee_view(emp: EmployeeDB, role: str) -> dict:
    view = {
        "Emp_ID": emp.Emp_ID,
        "F_Name": emp.F_Name,
        "L_Name": emp.L_Name,
        "Dept_ID": emp.Dept_ID,
        "Email": emp.Email,
        "personal_phone": emp.personal_phone,
        "is_active": emp.is_active,
        "joining_date": str(emp.joining_date) if emp.joining_date else None,
    }
    # Sensitive attributes are only included for manager and admin roles:
    if role in ("manager", "admin"):
        view["Salary"] = float(emp.Salary) if emp.Salary is not None else 0.0
        view["Address"] = emp.Address
        view["created_at"] = emp.created_at
        view["updated_at"] = emp.updated_at
        view["blood_group"] = emp.blood_group
        view["dob"] = str(emp.dob) if getattr(emp, "dob", None) else None
        view["marital_status"] = emp.marital_status

    return view
```

---

## 4. Network & API Protection

### 4.1 Rate Limiting (`slowapi`)
The API uses `slowapi` with in-memory IP bucket limiters to mitigate brute-force and denial-of-service attacks:
- **Sensitive Operations (`10 requests / minute`):**
  - `/auth/login` (Brute-force protection)
  - `/employees/{id}/delete` (Destructive action prevention)
  - `/employees/{id}/restore`
  - `/employees/{id}/salary` (Compensation revision throttling)
  - `/employees/bulk-delete`
- **Standard Operations (`60 requests / minute`):** General read queries and public endpoints.

### 4.2 Cross-Origin Resource Sharing (CORS)
- Middleware: `CORSMiddleware`
- Origins: Explicitly configured to trusted frontend domains (`http://localhost:5173`, `http://127.0.0.1:5173`).
- Wildcards (`*`) with credentials (`allow_credentials=True`) are strictly prohibited.

### 4.3 SQL Injection Prevention
- All database queries use **SQLAlchemy ORM** or parameterized raw SQL (`text("... :param")` with explicit dictionary arguments).
- No user-supplied parameters are ever concatenated directly into SQL query strings.

### 4.4 File Upload Safety (Spreadsheet Parsing)
- Allowed file extensions: `.xlsx`, `.xls`, `.csv`.
- In-memory stream processing (`io.BytesIO`) prevents malicious files from writing to server disk.
- Safe XML parsing: Pure Python XML fallback utilizes Python's built-in `xml.etree.ElementTree` configured to prevent XML External Entity (XXE) attacks.

### 4.5 HTTPS Redirection & HSTS Enforcements
- **Automated Transport Encryption:** When `ENFORCE_HTTPS=True` (or behind an SSL termination reverse proxy), all insecure HTTP requests are permanently redirected to HTTPS with HTTP 301.
- **HTTP Strict Transport Security (HSTS):** Automatically appends the `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header to all HTTPS responses, instructing browsers to strictly refuse insecure plaintext connections for 1 year.
- **Security Headers Injected:**
  - `X-Content-Type-Options: nosniff` (MIME-sniffing prevention)
  - `X-Frame-Options: SAMEORIGIN` (Clickjacking defense)
  - `Referrer-Policy: strict-origin-when-cross-origin` (Information leakage prevention)
  - `Secure` flag enforced on all Set-Cookie headers in HTTPS contexts.
- **Client-Side Redirection:** The frontend `<head>` includes automatic HTTPS redirection for all non-local hostnames.

### 4.6 Cookie Consent & Privacy Compliance
- **GDPR / ePrivacy Compliance:** Interactive `<PrivacyNotice />` banner rendered across all pages.
- **Categorized Storage:**
  - *Strictly Necessary:* JWT authentication token (`emp_token`) and HTTPS routing tokens (always enabled).
  - *Preferences & Functionality:* Theme mode choice (`emp_theme`) and layout states (toggleable).
  - *Performance & Analytics:* Response latency and telemetry (toggleable).
- **Persistent Preferences:** Preferences are stored in `localStorage` (`cookie_consent_preferences`) and can be re-opened and modified at any time via the floating 🍪 button (docked cleanly in the bottom-left without occluding navigation) or the user profile dropdown.

### 4.7 Browser Privacy Shield & Adblocker Defense
- **Brave Shield / Adblocker Resilience:** Aggressive browser shields (such as Brave Shields or uBlock Origin) often intercept compliance scripts or external telemetry.
- **Resilient Lazy Load Guard:** In `App.jsx`, compliance components are dynamically imported inside a `.catch()` fallback handler. If an adblocker blocks compliance scripts from loading, the exception is caught safely, allowing core authentication and application routes to render without blank screen errors.

