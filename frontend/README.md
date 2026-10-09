# Employee Management System - Frontend

A modern React + Vite single-page application for the Employee Management system, providing role-based user interfaces for employees, managers, and system administrators.

---

## Tech Stack

- **React 19** (`react`, `react-dom`)
- **Vite 8** (Ultra-fast build tool & dev server)
- **React Router 6** (`react-router-dom` for declarative routing and auth guards)
- **Native CSS** (Custom responsive design with modern CSS design tokens)

---

## Key Features & UI Capabilities

- **Role-Based Access Control (RBAC):**
  - **`user`:** Directory view (Name, Email, Dept). Salaries and home addresses are automatically withheld by the API and hidden from the UI.
  - **`manager`:** Complete employee cards, address viewing, salary viewing, employee add/edit modal, and salary change history audit log.
  - **`admin`:** Full superuser capabilities — Excel Hub, salary raises/cuts, user account role promotion (`user` ➔ `manager` ➔ `admin`), account status toggling, and deactivation/restoration.
- **Employee Directory:** Pagination (10 per page), column sorting (ID, Name, Dept, Salary), active/inactive filtering toggle, and CSV roster export.
- **Excel & CSV Hub:** Modal for uploading `.xlsx` and `.csv` files for batch employee creation, sample CSV template download, and spreadsheet-driven bulk deletion.
- **Interactive Employee Profile Modal (`EmployeeDetailModal.jsx`):** Clickable table rows and dedicated "View" action button. Displays role-tailored modal views: superuser full access for `admin`, management view for `manager`, and sanitized directory view with confidentiality notice for standard `user`.
- **Salary Management:** Modal for setting exact salaries or applying raises/cuts with real-time validation and change tracking.
- **Salary History Audit Log:** Modal displaying full timestamped salary revision records with previous salary, new salary, and who approved the change.
- **Self-Service Password Reset:** Forgot-password request with token verification, real-time validation, and offline development fallback links.
- **Holiday Calendar, Announcements & Business Days Simulator (`Holidays.jsx`):** 3-tab corporate hub featuring annual holiday schedule with countdown timer and grid/table toggle, priority-tagged announcements bulletin board with department targeting and pinned notices, and working business days calculator deducting weekends and official holidays.
- **Real-Time Push Notifications & Live Bell (`NotificationBell.jsx`, `NotificationContext.jsx`):** Full-duplex WebSocket connection, ringing bell animation, unread badge counter, synthesized HTML5 Web Audio chime, floating real-time toast alerts, notification inbox with category filters, and Manager/Admin instant broadcast modal.
- **Employee Self-Service Profile & Emergency Contacts (`Profile.jsx`, `EmployeeDetailModal.jsx`):** Authenticated personal profile portal allowing staff to manage personal phone, blood group with medical badge, date of birth with live age calculator, marital status, and residential address; interactive Emergency Contacts & SOS directory with primary contact hero spotlight, 1-click click-to-call links, and copy-number shortcuts; integrated SOS view in Employee Detail Modal for managers and HR admins.
- **Official Reports & PDF Generator Hub (`Reports.jsx`, `api.js`):** Comprehensive document generation suite powered by ReportLab. Features dedicated tabbed generators for Monthly Payslip Vouchers (with Indian earnings/deductions breakdown and net pay in Lakhs/Crores words), Employee Directory & Headcount Reports (Landscape A4 with KPI summary), Department Budget & Expense Statements, and Formal Salary Revision Letters with historical progression audit logs. Includes contextual PDF download actions across `Employees.jsx`, `EmployeeDetailModal.jsx`, `SalaryCalculator.jsx`, `Departments.jsx`, and `Profile.jsx`.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Backend URL (Optional)
By default, the client points to `http://127.0.0.1:8000`. You can override it by creating a `.env` file:
```env
VITE_API_URL=http://127.0.0.1:8000
```

### 3. Start Development Server

**Option A (1-Click Launcher):**
Double-click `start.bat` in the project root.

**Option B (Terminal):**
```bash
npm run dev
```
The application will be accessible at: **[http://localhost:5173](http://localhost:5173)**

### 4. Build for Production
```bash
npm run build
```
Static production files will be output to `dist/`.

---

## Connected Backend

This frontend connects to the FastAPI backend located in `employee_api/`.
Ensure the backend is running on port 8000:
```bash
cd ../employee_api
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

## Project Structure

```
employee_frontend/
├── package.json               # React 19, Vite 8, React Router dependencies
├── vite.config.js             # Vite config (port 5173, host 0.0.0.0)
├── index.html                 # Single page application entry HTML
├── .env.example               # Backend API URL environment template
├── .gitignore                 # Excludes node_modules/, dist/, and .env
├── start.bat                  # 1-click Windows installer and dev launcher
├── README.md                  # This documentation
└── src/
    ├── main.jsx               # Entry point with BrowserRouter and AuthProvider
    ├── App.jsx                # Route definitions & RequireAuth route guards
    ├── auth.jsx               # Authentication context, session, and role helpers
    ├── theme.jsx              # Theme context, state persistence & media listener
    ├── api.js                 # Centralized API service for all FastAPI endpoints
    ├── format.js              # Currency (INR) and date formatting utilities
    ├── styles.css             # Global responsive styling and CSS custom properties (Light/Dark)
    ├── components/
    │   ├── Layout.jsx         # Responsive top navigation bar with user profile & theme toggle
    │   ├── ThemeToggle.jsx    # Sleek Light / Dark mode toggle button
    │   ├── Modal.jsx          # Reusable accessible modal dialog
    │   ├── EmployeeDetailModal.jsx # Role-based employee profile popup (admin/manager/user)
    │   ├── EmployeeForm.jsx   # Add/Edit employee modal with auto-email preview
    │   ├── SalaryModal.jsx    # Admin salary revision modal (set / increment)
    │   ├── HistoryModal.jsx   # Audit history table for salary adjustments
    │   ├── ExcelImportModal.jsx # Excel/CSV batch import & bulk delete hub
    │   ├── ChangePasswordModal.jsx # Modal to change account password from profile menu
    │   ├── DepartmentEditModal.jsx # Admin department name & budget allocation editor
    │   ├── DepartmentHistoryModal.jsx # Department revision & budget change history table
    │   └── SortByDropdown.jsx # Universal popover dropdown for field selection and direction toggle
    └── pages/
        ├── Login.jsx          # Login, Registration, and Forgot-Password request
        ├── ResetPassword.jsx  # Token verification and password reset screen
        ├── Employees.jsx      # Paginated directory table, filters, and actions
        ├── Departments.jsx    # Department listing, budget, and department creation
        ├── Analytics.jsx      # Company-wide payroll KPIs, headcount, and budget utilization
        ├── Users.jsx          # Admin user management and role promotion
        └── SalaryCalculator.jsx # Employee salary & in-hand take-home pay calculator with payslip preview
```

---

## Recent Project Updates & Frontend Changelog

*(In sync with `employee_api` Backend Updates)*

### 1. Standalone Project Migration
- Extracted the frontend into the standalone `employee_frontend/` workspace to permanently eliminate Windows file-locking issues (`EPERM` / `Access is denied`) caused by accidental local Node distribution copies.
- Upgraded to **React 19** and **Vite 8** with **React Router 6**.

### 2. Excel Hub Integration (`ExcelImportModal.jsx`)
- Built an interactive batch processing modal supporting both `.xlsx` and `.csv` files.
- Added direct download link for the pre-formatted `employee_template.csv` sample file.
- Added spreadsheet-driven bulk deletion with option for soft deactivation or permanent removal.

### 3. Password Reset Workflow (`ResetPassword.jsx`)
- Built full reset token verification UI parsing URL parameters (`?token=...`).
- Integrated development console fallback: when SMTP is not configured, local reset links can be clicked directly to test password changes offline.

### 4. Role-Based Dynamic UI & Privacy Masking
- Strict client-side route guarding matching the backend RBAC matrix:
  - Unauthorized users are automatically redirected to `/login`.
  - Plain `user` accounts cannot view compensation, home addresses, or administrative buttons.
  - Managers can view full details, add employees, and inspect salary revision history.
  - Admins have full access to salary revision, Excel Hub, user role promotion, and deactivation/restoration.

### 5. Automated Windows Launcher (`start.bat`)
- Created a 1-click batch launcher that automatically checks dependencies, runs `npm install`, and starts the development server on `0.0.0.0:5173`.

### 6. Interactive Role-Based Employee Detail Popup (`EmployeeDetailModal.jsx`)
- **Interactive Row Click & Hover State:** All table rows now have pointer cursors and subtle `#f0f4ff` hover states. Clicking any employee row triggers an individual profile modal.
- **Dedicated "View" Button:** Added a `View` action button in the table actions column for all users (including standard `user` accounts).
- **Role-Based Data Separation:**
  - **`admin`:** Comprehensive view containing profile header, initials avatar, department, status, formatted salary, home address, created/updated timestamps, and full action controls (`Deactivate/Restore`, `Salary Revision`, `Edit Profile`, `Salary History`).
  - **`manager`:** Complete view with compensation, address, timestamps, plus `Edit Profile` and `Salary History` actions.
  - **`user`:** Sanitized directory view (Name, Email, Department, Status) with an informative confidentiality notice informing that compensation and residential address are restricted to managers and administrators.
- **Event Isolation:** Handled `e.stopPropagation()` on row action buttons to allow direct triggering of Edit/History/Salary modals without opening the detail modal.

### 7. Full Admin User Management CRUD (`Users.jsx`)
- **Direct User Creation (`+ Add User` Modal):** Admins can provision new users directly with initial role assignment (`user`, `manager`, `admin`), password, and optional email address.
- **Permanent User Deletion (`DELETE /auth/users/{username}`):** Added a dedicated **Delete** button with a confirmation safety guard (`window.confirm`). Permanently deletes the user account while preventing self-deletion.
- **Account Status Toggling:** Admins can quickly activate or deactivate accounts with immediate server synchronization.
- **Real-Time Search & Filtering:** Instant filter bar to search users by username, email, or assigned role.

### 8. Dark / Light Theme System & Animated Celestial Switch (`theme.jsx`, `ThemeToggle.jsx`, `styles.css`)
- **Interactive Celestial Toggle Switch:** Custom-designed pill track with animated sliding thumb, elastic bouncy spring physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`), spinning golden sun with ray burst animation in light mode, and glowing crescent moon with twinkling sky stars in dark mode.
- **Dynamic Text Slide Transition:** The "Light" / "Dark" label text glides smoothly with a micro-entrance animation upon theme change.
- **Hardware-Accelerated Page Layout Transitions (View Transitions API):**
  - Uses native `document.startViewTransition` with a dynamic circular clip-path expansion (`circle(0px) ➔ circle(endRadius)`) originating precisely from the button's click coordinates `(clientX, clientY)`.
  - The new theme radiates smoothly across the entire page layout like an expanding ripple of light/darkness.
- **Coordinated Universal Fallback:**
  - For browsers without View Transitions, adds a `.theme-transitioning` class for 550ms that coordinates all CSS custom properties simultaneously and casts an ambient radial light sweep (`::after`) across the viewport.
- **Accessibility & System Preferences:** Full support for OS-level `prefers-color-scheme: dark` and immediate fallback disabling for `prefers-reduced-motion: reduce`. User choices are saved in `localStorage`.

### 9. 3D Card Flip Transition Animation (`Login.jsx`, `styles.css`)
- **Perspective 3D Architecture:** Built a dynamic two-sided card wrapper (`.auth-flip-container` and `.auth-flip-card`) utilizing CSS 3D transforms (`perspective: 1200px`, `transform-style: preserve-3d`, `rotateY(180deg)`).
- **Seamless Mode Switching:** Smooth 0.65s cubic-bezier flip animation when transitioning between **Sign In** (Front Face), **Account Registration** (Back Face), and **Password Reset** modes without abrupt page reloads or layout jumps.
- **Accessibility & Focus Guarding:** Form inputs on the unfocused side are automatically disabled and removed from the keyboard tab sequence (`tabIndex={-1}`) to prevent accidental input while the card is rotated.
- **Reduced Motion Fallback:** Respects user accessibility preferences via `@media (prefers-reduced-motion: reduce)`, smoothly disabling 3D rotation and providing instant display switching.

### 10. Rooster & Owl Waking-Up Mascot Animations (`ThemeMascot.jsx`, `styles.css`)
- **Rooster Waking Up (Light Mode):** When switching to light theme, an animated rooster rises up with a sunrise glow, stretches its neck, fluffs wings, jiggles its comb, opens its beak to crow with floating musical notes (`♪`, `♫`, `☼`), and displays a *"Rise & Shine! ☀️"* speech bubble.
- **Owl Waking Up (Dark Mode):** When switching to dark theme, a nocturnal owl perched on a moonlit branch slides up from sleep, blinks open glowing amber irises with dilating pupils, perks up its feathery ear tufts, gives an inquisitive head-tilt under twinkling stars (`★`, `✦`), and displays a *"Night Owl Mode! 🌙"* badge.
### 11. Multi-Field Table Filtration Across All Database Entities (`styles.css`, All Pages)
- **Employee Table Filtration (`Employees.jsx`):**
  - **Live Multi-Field Search:** 300ms debounced search matching employee name, email, or numeric ID.
  - **Department Dropdown:** Instant filtering by company department.
  - **Status Selector:** Toggle between Active Only, Inactive Only, or All records (restricted to `manager` and `admin` per RBAC).
  - **Compensation Range:** Minimum and maximum salary inputs (privileged roles only).
  - **Synchronized CSV Export:** The "Export CSV" button automatically applies active filter queries to download filtered results.
- **Department Table Filtration (`Departments.jsx`):**
  - Search by department name or numeric Dept ID.
  - Filter by minimum and maximum department budget.
- **User Account Filtration (`Users.jsx`):**
  - Full-text search by username, email, or ID.
  - Filter by assigned role (`user`, `manager`, `admin`).
  - Filter by account status (`active`, `inactive`).
- **Salary History Audit Filtration (`HistoryModal.jsx`):**
  - Filter change logs by authorizing administrator username (`changed_by`).
  - Filter by salary compensation range.
- **Unified UI Filter Bar Component System:**
  - Modern, responsive filter cards styled for Light and Dark themes.
  - Active filter counters (`filter-badge-active`), filter chip tags with single-click removal (`filter-chip-remove`), and a master "Reset Filters" action.

### 12. Modern Menu Bar & Navigation System (`Layout.jsx`, `Analytics.jsx`, `ChangePasswordModal.jsx`)
- **Modern Collapsible Left Sidebar:**
  - Brand header with portal icon and collapse/expand toggle (`◀` / `▶`).
  - Smooth animated width transition (250px expanded ➔ 72px collapsed).
  - Collapsed state remembers user preference across refreshes via `localStorage` (`sidebar_collapsed`).
  - Active route indicators with brand background pill highlighting.
  - Icon-only mode with tooltips when collapsed.
  - User footer brief with initials avatar and role badge.
- **Responsive Mobile Drawer & Backdrop:**
  - On screens < 900px, sidebar shifts to an off-canvas drawer (`transform: translateX(-100%)`).
  - Topbar hamburger button (`☰`) toggles the drawer open with a dark blur backdrop overlay (`.sidebar-backdrop`).
  - Automatically auto-closes the drawer when navigating to any route.
- **User Profile & Account Dropdown Menu:**
  - Clickable user menu trigger in topbar with gradient initials avatar, username, role pill, and animated arrow chevron.
  - Dropdown card with user avatar, username, email address, role badge, and actions.
  - **"🔑 Change Password" Action Modal (`ChangePasswordModal.jsx`):** Allows users to change their own password directly from the topbar with old password validation and password match checks.
  - **"🚪 Sign Out" Action:** One-click session termination.
  - Accessible click-outside listener and Escape key dismiss.
- **Payroll & Analytics Dashboard (`Analytics.jsx`):**
  - KPI metric cards: Total Payroll Expense, Active Staff Headcount, Average Compensation, and Minimum/Maximum Salary Range.
  - Visual department budget utilization cards with percentage progress bars (color-coded for safe, warning ≥80%, and over-budget >100%).
  - Detailed department compensation table with headcount, total payroll, average salary, and budget utilization.
  - Route guarded with `<RequireAuth roles={["manager", "admin"]}>`.

### 13. Admin Department Management: Budget Editing, Audit History & Safe Deletion (`Departments.jsx`, `DepartmentEditModal.jsx`, `DepartmentHistoryModal.jsx`)
- **Admin Department Editing (`DepartmentEditModal.jsx`):**
  - Admins can edit department names and modify allocated budgets directly from the UI.
  - Real-time preview of formatted currency as numbers are typed.
  - Optional change reason / audit note logged to the department revision history.
  - Strict input validation: non-empty name, non-negative budget.
- **Department Revision & Budget History (`DepartmentHistoryModal.jsx`):**
  - **Per-Department History:** Dedicated "History" button on each department row displaying timestamp, admin user, action badge (`Created`, `Budget Revised`, `Name Changed`, `Name & Budget`, `Deleted`), previous budget ➔ new budget with net difference `(+/-)`, and notes.
  - **Global Company Audit Log:** Topbar "📜 Audit History" button provides an aggregated log of all department creations, name updates, budget revisions, and deletions across the organization.
- **Safe Department Deletion:**
  - Confirmation safety modal preventing accidental clicks.
  - Foreign key integrity check: if any employees (active or inactive) are assigned to the department, deletion is blocked with a clear user notice: *"Cannot delete department 'X': Y employee(s) are assigned to it. Reassign or delete them first."*
  - When empty, safely detaches historical records to preserve the audit trail and removes the department.
- **RBAC Visibility:** Action buttons (`Edit`, `History`, `Delete`) and audit tools are restricted to `admin` role; standard users view directory tables only.

### 14. Interactive Employee Salary & Take-Home Pay Calculator (`SalaryCalculator.jsx`)
- **Self-Service Employee Access:** Open to all registered employee accounts (`user`, `manager`, `admin`). Prominently placed in the modern collapsible sidebar navigation and topbar user profile dropdown.
- **"Load My Salary" Profile Sync:** One-click button querying `GET /employees/salary/my-profile` to automatically prefill the calculator with the authenticated employee's registered annual CTC from their employee record.
- **Dual Tax Regime Engine (Indian Income Tax):**
  - **New Tax Regime (FY 2024-25 / 2025-26):** ₹75,000 standard deduction, latest 6-tier slab brackets, Section 87A rebate for income up to ₹7,00,000, and 4% Health & Education cess.
  - **Old Tax Regime:** ₹50,000 standard deduction, Section 80C deductions (up to ₹1.5L), Section 80D medical health deductions (up to ₹25k), and Section 87A rebate up to ₹5,00,000.
  - **Side-by-Side Tax Comparison Banner:** Highlights which regime yields greater net in-hand earnings and displays the exact annual savings amount.
- **Accurate Indian Statutory Deductions:**
  - **EPF (12%):** With switchable statutory wage ceiling cap (₹1,800/month or ₹21,600/year) vs. uncapped 12% of basic pay.
  - **Professional Tax (PT):** Standard ₹200/month (₹2,500/year with Feb adjustment).
  - **Employee State Insurance (ESI):** 0.75% for Gross monthly pay ≤ ₹21,000 (auto-exempt above threshold).
- **KPI Summary Cards & Dual Views:**
  - Monthly Take-Home Pay, Annual Take-Home Pay, Gross Compensation, and Total Deductions cards.
  - Toggle between Monthly and Annual breakdown tables.
  - Quick presets: ₹3.6 LPA, ₹6.0 LPA, ₹9.0 LPA, ₹12.0 LPA, ₹18.0 LPA, ₹25.0 LPA, ₹35.0 LPA plus interactive continuous slider.
- **Admin Full Employee Roster Inspector & Simulation Tools:**
  - **All N Employee Records Access:** Removes arbitrary 200 record caps by leveraging `GET /employees?all_records=true&status=all` (`limit=0`). System administrators and managers can access, search, and calculate salary breakdowns for any number of company employees regardless of organization size.
  - **Employee Selection Directory Modal:** Comprehensive modal with live search by Name, Email, or Emp ID, Department dropdown filtering, Status filtering (Active, Inactive, All), and high-performance client-side pagination (25, 50, 100, 250, All items per page).
  - **Selected Employee Card & Appraisal Raise Simulation:** Pre-fills employee compensation and features 1-click scenario simulation buttons (`+5%`, `+10%`, `+15%`, `+20%`, and `Reset to Base`) with real-time what-if delta calculations.
  - **Official Salary Commitment (`PUT /employees/{emp_id}/salary`):** Admins can commit simulated salary revisions directly back to the database with a 1-click confirmation modal and automated salary history audit logging.
  - **Personalized Payslip Generation:** Generates individualized payslip simulations with the selected employee's actual name, ID, department, and email address.
- **Simulated Payslip Voucher Modal:**
  - Interactive voucher popup showing company header ("StaffPortal Corp."), employee name, designation, pay period, itemized earnings and deductions, and net amount credited.
  - Dedicated "🖨️ Print Payslip" action triggering clean native browser print styling.

### 15. Comprehensive Admin Employee Details Editing (`EmployeeForm.jsx`, `EmployeeDetailModal.jsx`)
- **Full Administrative Edit Authority for Admins:**
  - Administrators have full editing privileges across all employee attributes:
    - **Name & Address:** First Name, Last Name, and Residential Address with validation.
    - **Department:** Dropdown department reassignment.
    - **Salary:** Real-time editing with automated `salary_history` revision logging.
    - **Official Email:** Directly editable with conflict prevention against existing records, plus one-click "Auto-generate from Name" utility.
    - **Joining Date:** HTML5 date picker (`input[type="date"]`) allowing admins to set or update hire dates.
    - **Account Status:** Fast Active vs. Inactive status toggle.
  - Informative Admin Privilege badge (`Admin Full Access`) displayed in the modal header and banner.
- **Manager Read-Only Safeguards:**
  - Non-admin managers can safely update First Name, Last Name, Department, and Address, while protected attributes (Salary, Official Email, Joining Date, Account Status) are rendered as clean read-only informational cards.
- **Enhanced Profile Inspection (`EmployeeDetailModal.jsx`):**
  - Displays Joining Date alongside Department, Status, and Email in the General Information section visible to directory users.

### 16. Universal Sort By & Filter By Engine (`SortByDropdown.jsx`)
- **Dedicated `Sort by` Popover Dropdown:**
  - Standardized `⇅ Sort by: [Field] [▲/▼]` button on all pages with accessible popover dropdown, outside-click and Escape dismissal.
  - Active checkmark indicators and quick Ascending (`▲ Asc (A-Z)`) / Descending (`▼ Desc (Z-A)`) direction toggles.
  - Clickable table column headers (`<th>`) stay synchronized with directional indicators (`▲` / `▼`).
- **Interactive `⚡ Filter By` Toggle Button:**
  - Displays dynamic active filter badge counter pill (e.g. `⚡ Filter By (2)`).
  - Toggles the multi-field filter card open/closed cleanly, persisting all active filter criteria.
  - Reset filter action with active filter chips and matching record count indicators.
- **Implemented Uniformly Across All Pages & Modals:**
  - **Employees (`Employees.jsx`):** Sort by ID, First Name, Last Name, Department, Email, Joining Date, Account Status, and Salary (privileged). Filter by search, department, status, and salary bounds.
  - **Departments (`Departments.jsx`):** Backend-synchronized sorting by Department ID, Name, and Budget. Filter by search query, min budget, max budget.
  - **Users (`Users.jsx`):** Backend-synchronized sorting by User ID, Username, Email, Role, and Status. Filter by query, role, and active status.
  - **Analytics (`Analytics.jsx`):** Real-time sorting on department breakdown table by Name, Headcount, Total Payroll, Average Compensation, Budget, and Utilization %. Filter by department search and budget health status.
  - **Salary Calculator Roster (`SalaryCalculator.jsx`):** Full N-employee directory modal features dedicated Sort By dropdown, Filter By toggle, and clickable table headers for all company staff.
  - **Audit History Modals (`HistoryModal.jsx` & `DepartmentHistoryModal.jsx`):** Multi-column sorting and filtering on salary revisions and department budget changes.

---

## Roadmap & Features Status

*(Fully synchronized with backend roadmap)*

- [x] **Role-Based UI & Access Guarding** - Strict view controls across `user`, `manager`, and `admin`
- [x] **Dark / Light Theme Toggle** - Theme selector using CSS custom properties, persistent state & system media query
- [x] **Rooster & Owl Waking-Up Mascots** - Animated sunrise rooster (light) and twilight owl (dark) with interactive stage choreography
- [x] **3D Card Flip Transition Animation** - Smooth 3D card flip between Login, Register, and Forgot Password with accessibility safeguards
- [x] **Full Admin User CRUD** - Create user modal, role promotion, status toggling, and permanent deletion with self-delete protection
- [x] **Interactive Role-Based Employee Profile Popup** - Row-click modal with role-based field masking and dynamic action controls
- [x] **Excel & CSV Hub** - Drag-and-drop batch importing and spreadsheet bulk creation/deletion of records
- [x] **Self-Service Password Reset UI** - Token verification and reset password flow
- [x] **Salary Management & Audit Log Modal** - Live salary revisions with change history
- [x] **CSV Directory Export** - Dynamic export with role-based privacy masking and synchronized filter parameters
- [x] **Multi-Field Table Filtration Across All Database Entities** - Full search, department, role, status, and compensation boundaries across Employee, Department, User, and Salary History tables with synchronized CSV export
- [x] **Modern Collapsible Left Sidebar & Responsive Mobile Drawer** - Collapsible sidebar with localStorage persistence, mobile drawer overlay, and hamburger navigation
- [x] **User Profile & Account Dropdown Menu** - Topbar account menu with avatar, role badge, "Change Password" modal, and sign out
- [x] **Analytics & Payroll Dashboard** - Visual KPI cards, department budget utilization progress bars, and breakdown tables for managers & admins
- [x] **Admin Department Management & Budget Revision History** - Modal for editing department name and budget, audit history table, and safe deletion with employee assignment protection
- [x] **Interactive Salary & Take-Home Pay Calculator** - Dual tax regime comparison (New vs. Old), statutory deductions (EPF, PT, ESI), "Load My Salary" profile integration, and printable payslip simulation preview
- [x] **Full Admin Access to Edit All Employee Details** - Admin can modify First/Last Name, Department, Residential Address, Salary (with audit history), Official Email (with uniqueness check), Joining Date (with schema migration), and Account Status (active/inactive)
- [x] **Universal Sort By & Filter By Engine Across Every Page & Modal** - Dedicated Sort By dropdown popover with direction toggles, clickable table headers, and Filter By button with active count pills across Employees, Departments, Users, Analytics, and Salary Calculator roster
- [x] **Show / Hide Password Visibility Toggle** - Interactive eye icon toggles password visibility (plain text vs masked) on Login and Registration forms with theme-adaptive styling and accessibility support
- [x] **Admin Permanent Employee Deletion & Auto-Resequencing of Emp_IDs** - Admin can permanently delete an employee directly from the edit form; cascades salary history deletion and automatically decrements all subsequent Emp_IDs by 1 in an atomic transaction so employee IDs remain strictly consecutive without gaps
- [ ] **PDF export & official report generator** - UI buttons to export formatted employee rosters, department expense breakdowns, and payslip vouchers to PDF *(Backend PDF module in progress)*
- [ ] **Employee attendance & time-tracking module** - Real-time clock-in/out widget, stopwatch timer, monthly calendar heatmap, and manager punch approval table
- [ ] **Leave & time-off management system** - Leave balance cards, multi-day application modal, holiday exclusion, and manager review hub
- [ ] **Performance appraisal & review management** - Evaluation cycles, metric scorecards, and appraisal-driven salary increment integrations
- [ ] **Multi-factor authentication (MFA/2FA) & session manager** - TOTP authenticator QR setup wizard, 6-digit confirmation, and active session manager
- [x] **Real-time push notifications & announcements (WebSockets)** - Live topbar notification bell, unread badge counter, audio chime, and corporate bulletin board
- [ ] **Employee document & KYC storage vault** - Tabbed document uploader in EmployeeDetailModal, drag-and-drop file upload, and PDF/image previewer
- [ ] **Global command palette (`Ctrl+K` / `Cmd+K`)** - Spotlight-style instant navigation, quick employee search, and keyboard shortcut hub
- [ ] **Automated database backup & disaster recovery** - Admin-only snapshot management console, manual dump trigger, and safe restore interface
- [ ] **Outgoing webhooks & third-party HRIS integrations** - Admin console to configure webhook endpoints, inspect event logs, and integrate with Slack/Teams
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

## Git Version Control & GitHub

Push this frontend repository to GitHub with:

```powershell
cd  \ Your Program path 
git init
git add .
git commit -m "feat: initial commit for React 19 + Vite frontend"
git branch -M main
git remote add origin https://github.com/<your_Username>/Employee_Frontend.git ##ShadowV3N0M
git push -u origin main
```

Daily update cycle:
```powershell
git status                    # Check changed files
git add .                     # Stage changes
git commit -m "Your message"  # Commit milestone
git push                      # Push to GitHub
```

---
*Last updated: 2026-10-05 (In sync with backend v2.0)*
