# Code Style & Engineering Standards

**Project:** Enterprise Employee & Payroll Management System  
**Version:** 2.6  
**Date:** October 31, 2026  
**Scope:** Python (FastAPI/SQLAlchemy), JavaScript (React 19), Native CSS & Git Workflows  

---

## 1. Guiding Principles

1. **Explicit Over Implicit:** Write self-documenting code with clear variable and function names. Avoid cryptic abbreviations.
2. **Defensive Programming:** Validate all inputs at the boundary using Pydantic models (backend) and validation utilities (frontend). Never trust client payloads.
3. **Layer Separation:** Routers handle HTTP transport; Services handle algorithmic business logic; Models define database schemas; Schemas define validation contracts.
4. **Preserve Documentation Integrity:** Maintain all existing comments, docstrings, and architectural annotations across files.

---

## 2. Python Backend Standards (FastAPI & SQLAlchemy)

### 2.1 Formatting & Style
- Strictly follow **PEP 8** conventions.
- Line length target: **88 to 100 characters**.
- Use 4 spaces for indentation (no tabs).
- Order imports logically:
  1. Standard library imports (`datetime`, `typing`, `io`, `re`)
  2. Third-party dependencies (`fastapi`, `sqlalchemy`, `pydantic`, `jose`)
  3. Local application modules (`app.models`, `app.services`, `app.schemas`)

### 2.2 Type Annotations
All function signatures, route handlers, and service methods must include full type annotations:
```python
# Good:
def shift_employees_upward(db: Session, target_id: int) -> int:
    ...

# Bad:
def shift_employees_upward(db, target_id):
    ...
```

### 2.3 Pydantic v2 Schema Design
- Use Pydantic v2 idioms (`model_dump()`, `ConfigDict`).
- Avoid deprecated Pydantic v1 patterns (e.g. `class Config:`).
- Validate numerical boundaries: salaries must be positive, percentages must be within valid bounds.

### 2.4 Database & SQLAlchemy Guidelines
- **Explicit Parameterization:** Always use parameter binding in raw SQL; never format or concatenate strings into queries:
  ```python
  # Good:
  db.execute(text("DELETE FROM employee WHERE Emp_ID = :del_id"), {"del_id": emp_id})

  # FORBIDDEN (SQL Injection risk):
  db.execute(text(f"DELETE FROM employee WHERE Emp_ID = {emp_id}"))
  ```
- **Session Cleanup:** Routes must use FastAPI's dependency injection (`db: Session = Depends(get_db)`), ensuring sessions are closed and returned to the pool automatically.
- **Identity Map Expiration:** Following bulk raw SQL queries, always invoke `db.flush()` and `db.expire_all()`.

### 2.5 Error Handling & HTTP Status Codes
- Raise standard `HTTPException` with explicit status codes and actionable error details:
  - `400 Bad Request`: Validation failures, business rule violations.
  - `401 Unauthorized`: Missing or invalid JWT credentials.
  - `403 Forbidden`: Insufficient role permissions.
  - `404 Not Found`: Entity does not exist.
  - `409 Conflict`: Unique constraint collisions.
  - `500 Internal Server Error`: Unexpected database or filesystem errors.
- Always perform `db.rollback()` in exception blocks before re-raising.

---

## 3. JavaScript & React 19 Frontend Standards

### 3.1 Component Architecture
- Use functional components with standard React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`).
- Keep components focused. Decompose complex forms into modals and reusable input blocks (e.g. `PhoneInput.jsx`, `FieldError.jsx`).
- Export components as `default export` for pages and modals, and named exports for utilities.

### 3.2 Form Validation Event Timing Matrix
Forms must strictly follow the three-tier validation timing pattern:
1. **On Change (`onChange`):** Clear the active error for that field immediately as the user types.
2. **On Blur (`onBlur`):** Validate the individual field and display inline errors if invalid.
3. **On Submit (`onSubmit`):** Validate all form fields simultaneously. If errors exist, abort submission and scroll smoothly to the first invalid input:
   ```javascript
   const firstInvalidEl = document.querySelector(".input-error");
   if (firstInvalidEl) {
     firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
     firstInvalidEl.focus();
   }
   ```

### 3.3 Accessibility (a11y) Rules
- Inputs must have associated `<label>` tags with descriptive text.
- Invalid inputs must specify `aria-invalid="true"` and `aria-describedby="error-<field_name>"`.
- Error messages must render with `role="alert"` or be paired with `<FieldError />`.
- All modals must trap keyboard focus and handle `Escape` key dismissals.

### 3.4 Asynchronous State & Cleanup
- Always handle unmounted component cleanup in `useEffect` to prevent memory leaks and race conditions:
  ```javascript
  useEffect(() => {
    let active = true;
    api.getEmployee(id)
      .then(data => { if (active) setEmployee(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [id]);
  ```

### 3.5 High-Frequency Event Throttling & Resilient Imports
- **Passive Activity Listeners:** High-frequency event listeners (`mousemove`, `touchmove`, `scroll`, `wheel`) must always register with `{ passive: true }` to maintain smooth 60fps scrolling and eliminate UI jank.
- **Storage Write Throttling:** Write operations to `localStorage` triggered by user activity must be throttled to at most once every $2\text{ seconds}$ to avoid excessive disk I/O.
- **Resilient Dynamic Imports:** When lazy-loading third-party compliance or privacy modules that could be blocked by browser privacy shields (e.g. Brave Shields), wrap imports with a `.catch()` fallback returning a dummy component (`{ default: () => null }`) to ensure core application routes render safely without throwing unhandled promise rejections.

---

## 4. CSS & Styling Conventions

### 4.1 Design Tokens Over Hardcoded Hex
Always reference CSS custom properties rather than hardcoding hex colors or raw pixel fonts:
```css
/* Good: */
background: var(--surface);
color: var(--text);
border: 1px solid var(--border);
border-radius: var(--radius);

/* Bad: */
background: #ffffff;
color: #1c2333;
border: 1px solid #e2e6ee;
border-radius: 10px;
```

### 4.2 Class Naming Conventions
- Use descriptive kebab-case class names: `.btn-primary`, `.table-container`, `.modal-backdrop`.
- Use modifier classes for state: `.input-error`, `.is-active`, `.is-loading`.
- Scope role badges cleanly: `.badge.role-admin`, `.badge.role-manager`, `.badge.role-user`.

### 4.3 Mobile Viewport & Dynamic Theming Standards
- **Safe Area Insets:** For mobile web views, respect notch cutouts with `env(safe-area-inset-top)` / `bottom` / `left` / `right`.
- **Dynamic Viewports:** Use `min-height: 100dvh` in addition to `100vh` to handle mobile browser navigation bars smoothly without jumpy repaints.
- **Theme Scoping Over Hardcoded Overrides:** Never use `!important` hex color rules (`#ffffff !important`, `#0f172a !important`) on thematic components. Define CSS variables at the container root (`--auth-wrapper-bg`, `--auth-card-bg`) and override them cleanly under `[data-theme="dark"]`.

---

## 5. Git & Version Control Conventions

### 5.1 Conventional Commits
Commit messages should follow the Conventional Commits specification:
- `feat: <description>` (New feature or capability)
- `fix: <description>` (Bug fix or patch)
- `docs: <description>` (Documentation updates)
- `refactor: <description>` (Code restructuring without changing external behavior)
- `test: <description>` (Adding or updating tests)
- `style: <description>` (Formatting, whitespace, design token adjustments)

*Examples:*
```
feat: add upward auto-shift on duplicate employee ID insertion
fix: resolve identity map conflict warning during bulk resequencing
docs: create enterprise design system and architecture specifications
```

### 5.2 Pre-Commit Verification Checklist
Before committing any changes:
1. Run backend tests: `& "..\venv\Scripts\python.exe" -m pytest` (100% pass required).
2. Build frontend: `npm run build` (0 errors required).
3. Synchronize `employee_frontend/src/` changes to `employee_api/frontend/src/`.

