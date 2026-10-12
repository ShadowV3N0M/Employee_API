# Product Requirements Document (PRD)

**Project:** Enterprise Employee & Payroll Management System  
**Version:** 2.4  
**Status:** Active / Production-Ready  
**Authors:** Engineering & Product Team  
**Last Updated:** October 2026  

---

## 1. Executive Summary & Vision

### 1.1 Purpose & Problem Statement
Modern human resources and enterprise teams require a unified, secure, and resilient platform to manage employee records, department structures, salary revisions, corporate announcements, and compliance reporting. Traditional HR tools often suffer from:
1. **Data Fragility & ID Collisions:** Deleting or inserting records with overlapping employee identifiers frequently overwrites existing staff history or leaves orphaned records.
2. **Coarse Role Permissions:** Leaking sensitive compensation data and personal contact information to unauthorized personnel due to lack of strict data-masking layers.
3. **Disconnected Payroll Breakdown:** Inability to break down gross compensation into Indian statutory tax and allowance components (Basic, HRA, PF, PT, TDS) with formal printable payslips.
4. **Poor Real-Time Connectivity:** Lack of instantaneous organizational announcements and push updates during critical HR events.

### 1.2 Product Vision
The **Enterprise Employee & Payroll Management System** provides a reactive, high-performance web portal and REST API built with **FastAPI** and **React 19**. It features:
- **Zero-Loss Auto-Shift Architecture:** Automatically resequences and increments IDs to guarantee that no employee record is ever overwritten or lost.
- **Three-Tier Dynamic RBAC:** Real-time database-enforced permissions (`user`, `manager`, `admin`) with automated PII masking.
- **Enterprise Reporting & PDF Hub:** Instant generation of professional Indian payslips, headcount summaries, and salary revision letters.
- **Real-Time Push Communication:** WebSockets-powered notifications and company-wide broadcasts with audible chimes.
- **Self-Service Portals:** Employee personal profile management with emergency SOS directory.

---

## 2. Target Audiences & User Personas

| Role | Persona | Key Responsibilities & Capabilities |
|---|---|---|
| **`user`** (Standard Staff) | **Employee Directory User** | • Explores sanitized employee directory (Name, Department, Official Email).<br>• Accesses personal profile to update personal phone, blood group, address, and emergency SOS contacts.<br>• Generates and downloads monthly salary payslips.<br>• Views company holidays, countdown timer, and organizational announcements. |
| **`manager`** (Department Head) | **Team Supervisor & HR Lead** | • Full directory visibility including home addresses, phone numbers, and compensation.<br>• Onboards new hires and edits team member operational details.<br>• Reviews salary progression audit logs.<br>• Accesses department analytics, headcount ratios, and department budget expenditures.<br>• Publishes department-targeted notices. |
| **`admin`** (System Administrator) | **Superuser & Payroll Admin** | • Complete system administration and user role elevation (`user` ➔ `manager` ➔ `admin`).<br>• Executes batch employee creation and mass deletions via Excel/CSV Hub.<br>• Adjusts employee salaries, applies percentage raises/cuts, and triggers compensation revisions.<br>• Performs permanent employee deletions with automatic consecutive resequencing.<br>• Broadcasts company-wide emergency push notifications. |

---

## 3. Functional Requirements

### 3.1 Authentication, Authorization & User Management
- **FR-AUTH-1 (Registration):** Public self-registration (`POST /auth/register`) creating accounts strictly with the `user` role. Any submitted `role` parameter must be sanitized and ignored.
- **FR-AUTH-2 (OAuth2 Authentication):** Secure login endpoint (`POST /auth/login`) accepting form credentials and issuing signed JSON Web Tokens (JWT) with HS256 algorithm and 60-minute expiration.
- **FR-AUTH-3 (Live Role Verification):** User roles must be queried from the database on every protected request. Role elevation or demotion by an admin takes effect immediately without requiring user re-authentication.
- **FR-AUTH-4 (Self-Service Password Reset):** Two-step forgot-password workflow generating cryptographically secure, single-use, time-bound reset tokens (`POST /auth/forgot-password` and `POST /auth/reset-password`).
- **FR-AUTH-5 (Admin User Management):** Superuser portal to view all system accounts, update roles, toggle active status, and link user logins to underlying employee records (`POST /employees/link-user`).

### 3.2 Employee Lifecycle & Data Integrity
- **FR-EMP-1 (Employee Directory & Pagination):** Paginated listing (`GET /employees`) supporting column sorting (`Emp_ID`, `F_Name`, `L_Name`, `Salary`, `Dept_ID`, `joining_date`), keyword search, department filtering, and active/inactive status toggling.
- **FR-EMP-2 (Field-Level PII Masking):** The API must automatically strip `Salary`, `Address`, `created_at`, `updated_at`, `dob`, and `marital_status` for callers with the `user` role.
- **FR-EMP-3 (Auto-Shift Upward on Insert):** When creating an employee at an existing `Emp_ID` (e.g. `#107`), the system must automatically increment ID `107` and all subsequent records ($\ge 107$) by $+1$ in descending order. Existing records, salary history, emergency contacts, and linked users are preserved without overwriting.
- **FR-EMP-4 (Soft Deactivation & Restoration):** Admin capability to soft-delete an employee (`DELETE /employees/{id}/deactivate`), marking `is_active = False` while preserving historic audit trails. Restorable via `POST /employees/{id}/restore`.
- **FR-EMP-5 (Permanent Hard Delete & Resequencing):** Permanent deletion (`DELETE /employees/{id}/delete`) removing the employee and cascading emergency contacts and salary history, while automatically resequencing remaining subsequent IDs consecutively to eliminate sequence gaps.
- **FR-EMP-6 (Official Email Generation):** Automated corporate email generation (e.g. `first.l@laesfera.co`) with collision resolution appending joining year and sequential numeric suffixes.

### 3.3 Excel & CSV Batch Hub
- **FR-XLS-1 (Batch Employee Import):** Uploading `.xlsx`, `.xls`, or `.csv` files (`POST /employees/upload-excel`) supporting flexible column mapping (`Emp_ID`, `F_Name`, `L_Name`, `Salary`, `Dept_ID`/`Dept_Name`, `Address`, `joining_date`).
- **FR-XLS-2 (Pure Python XML Fallback):** Robust parsing using `openpyxl` with an automated pure-Python zip/XML parsing fallback for environments lacking third-party spreadsheet binaries.
- **FR-XLS-3 (Auto-Reactivation on Re-Import):** If an uploaded spreadsheet references an existing inactive employee ID, the system automatically reactivates the employee and updates details.
- **FR-XLS-4 (Batch Identifier Operations):** Spreadsheet-driven bulk activation (`POST /employees/bulk-activate-excel`), bulk deactivation (`POST /employees/bulk-deactivate-excel`), and bulk permanent deletion with consecutive gap-closing (`POST /employees/bulk-delete-excel`).
- **FR-XLS-5 (Template Downloads):** On-demand download of standardized CSV import templates with instructional sample rows.

### 3.4 Compensation & Salary History
- **FR-SAL-1 (Salary Revisions):** Admin endpoint to update individual compensation with mandatory audit logging in `salary_history` (`PUT /employees/{id}/salary`).
- **FR-SAL-2 (Bulk Increment Calculator):** System-wide or department-wide percentage or fixed salary increments (`POST /employees/salary/bulk-increment`).
- **FR-SAL-3 (Indian Statutory Payroll Breakdown):** Comprehensive salary computation model (`POST /employees/salary/calculate`) deriving:
  - **Gross Earnings:** Basic (50%), HRA (25%), Special Allowance (25%).
  - **Statutory Deductions:** Employee Provident Fund (PF: 12% of Basic, capped at ₹1,800), Professional Tax (PT: ₹200), Tax Deducted at Source (TDS: calculated dynamically).
  - **Net Take-Home Pay:** Gross Earnings minus Total Deductions, formatted in Indian Rupee words (Lakhs & Crores).
- **FR-SAL-4 (Salary Audit Trail):** Read-only timeline of all historical salary revisions showing previous salary, revised salary, approving admin, and timestamp (`GET /employees/{id}/salary-history`).

### 3.5 Department Management & Budget Analytics
- **FR-DEPT-1 (Department CRUD):** Creation, renaming, and budget allocation for organizational departments (`GET`, `POST`, `PUT`, `DELETE /departments`).
- **FR-DEPT-2 (Deletion Constraints):** Deleting a department with active assigned employees must be rejected with HTTP 400 Bad Request to prevent orphaned records.
- **FR-DEPT-3 (Department Audit Log):** Automated change tracking in `department_history` logging budget adjustments and renames.
- **FR-DEPT-4 (Analytics & Headcount KPIs):** Analytics endpoints returning total headcount per department, salary expenditure distributions, and budget utilization ratios.

### 3.6 Corporate Holidays, Announcements & Business Days
- **FR-HOL-1 (Holiday Calendar):** Listing official organizational holidays (`GET /holidays`) categorized into National, Festival, and Company holidays, with live countdown timers.
- **FR-HOL-2 (Announcements Bulletin):** Rich bulletin board supporting pinned priority banners, department targeting, and expiration dates (`GET`, `POST /announcements`).
- **FR-HOL-3 (Business Days Simulator):** Working days calculator computing exact business days between two dates, excluding weekends (Saturday/Sunday) and recognized corporate holidays.

### 3.7 Real-Time Push Notifications & Live Bell
- **FR-NOTIF-1 (WebSocket Pipeline):** Full-duplex WebSocket connection (`/notifications/ws/{user_id}`) delivering instant alerts to active client sessions.
- **FR-NOTIF-2 (Live Bell & Sound Synthesis):** UI header bell indicator with unread count badge, animated wiggle on new alerts, and synthesized Web Audio chime (no external audio assets required).
- **FR-NOTIF-3 (Notification Inbox):** Persistent notification drawer categorized by alert type (`announcement`, `employee`, `salary`, `system`) with 1-click "Mark All as Read".
- **FR-NOTIF-4 (Broadcast Modal):** Manager/Admin modal to dispatch instant organization-wide or role-targeted broadcast alerts.

### 3.8 Self-Service Personal Profile & Emergency Contacts
- **FR-PROF-1 (Personal Attributes):** Authenticated profile portal (`/employees/me/profile`) allowing employees to edit personal phone, blood group (medical badges A+, B+, AB+, O+), date of birth with real-time age calculation, and marital status.
- **FR-PROF-2 (Emergency SOS Directory):** Management of emergency contacts (`GET`, `POST`, `PUT`, `DELETE /employees/me/emergency-contacts`) supporting relationship tags (`Spouse`, `Parent`, `Sibling`, etc.), primary contact spotlight, 1-click click-to-call, and copy shortcuts.
- **FR-PROF-3 (Admin SOS Access):** Instant emergency contact card inspection within the employee detail modal for HR emergency response.

### 3.9 Official Enterprise PDF Generator Hub
- **FR-PDF-1 (Monthly Payslip Voucher):** Formal printable A4 PDF featuring company header, employee details, two-column earnings/deductions breakdown, net pay in figures and words, and authorization stamp.
- **FR-PDF-2 (Employee Directory & Headcount Report):** Landscape A4 tabular roster grouped by department with KPI summary boxes and active status indicators.
- **FR-PDF-3 (Department Budget & Expense Statement):** Financial breakdown comparing department budgets against total monthly salary liabilities.
- **FR-PDF-4 (Salary Revision Letter):** Official formal revision letter detailing previous salary, increment percentage, revised compensation, effective date, and HR sign-off.

---

## 4. Non-Functional Requirements

### 4.1 Performance & Latency
- **API Response Time:** P95 response time for paginated directory queries must remain $< 100\text{ ms}$ under standard loads.
- **Frontend Bundle Size:** Production Vite bundle must not exceed $600\text{ KB}$ minified ($< 160\text{ KB}$ gzip compressed).
- **Time to First Byte (TTFB):** Backend TTFB must be $< 40\text{ ms}$ for local requests and $< 150\text{ ms}$ over WAN.

### 4.2 Security & Data Protection
- **Password Storage:** Salted and hashed using `passlib` with `bcrypt` (work factor 12).
- **Rate Limiting:** Guarded by `slowapi` with strict thresholds:
  - Sensitive endpoints (login, deletion, salary revision): 10 requests / minute.
  - Standard endpoints: 60 requests / minute.
- **CORS Protection:** Whitelisted client origins with strict header and credentials validation.
- **Injection Prevention:** 100% parameterized queries via SQLAlchemy ORM; zero raw string concatenation.

### 4.3 Usability & Accessibility (a11y)
- **WCAG 2.1 AA Compliance:** Minimum contrast ratio of 4.5:1 across light and dark themes.
- **Keyboard Navigation:** Full focus trap within modals, accessible `Esc` dismissals, and visible focus rings (`:focus-visible`).
- **Screen Reader Support:** Form inputs paired with `<FieldError />`, `aria-invalid`, and `aria-describedby` attributes.

### 4.4 Portability & Environments
- **Multi-Database Support:** Transparent execution on **MySQL** for production and **SQLite** for testing and offline local development without code modification.
- **Operating System Compatibility:** Fully verified on Windows (PowerShell/CMD), Linux, and macOS.

---

## 5. Success Metrics & Verification Criteria

1. **Zero Overwrite Rate:** $100\%$ success in preserving existing employee records during duplicate ID additions via the auto-shift mechanism.
2. **Consecutive ID Integrity:** $0$ gaps in employee ID sequences following permanent hard deletions.
3. **Test Suite Health:** $100\%$ pass rate across the automated `pytest` test suite ($43+$ integration tests).
4. **Build Reliability:** Zero errors or untyped warnings during `npm run build`.

