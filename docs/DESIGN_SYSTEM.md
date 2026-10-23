# Design System Specification

**Project:** Enterprise Employee & Payroll Management System  
**Version:** 2.5  
**Date:** October 23, 2026  
**Scope:** Design Tokens, Typography, Components, Theme Engine & Accessibility Guidelines  

---

## 1. Design Philosophy

The system's interface follows four foundational design principles:
1. **Zero-Framework Overhead:** Built using native CSS custom properties (design tokens) without heavy runtime UI frameworks (e.g. Tailwind or Bootstrap), maximizing browser rendering speed and Core Web Vitals.
2. **Enterprise Predictability:** Clean tabular data presentation, high data density, clear visual hierarchies, and explicit status signals.
3. **Dual Theme First-Class Support:** Seamless, high-contrast light and dark mode toggling using a centralized `data-theme` attribute on the root element.
4. **Inclusive Accessibility (WCAG 2.1 AA):** High contrast text ratios, standard focus indicators, screen reader attributes (`aria-invalid`, `aria-describedby`), and keyboard-trapped modal dialogs.

---

## 2. Design Tokens & Color Palette

### 2.1 Theme Color Tokens

| Token Name | Light Mode Value | Dark Mode Value | Usage / Semantic Context |
|---|---|---|---|
| `--bg` | `#f4f6fa` | `#0b1120` | Main application viewport canvas |
| `--surface` | `#ffffff` | `#1e293b` | Cards, tables, modals, and panel surfaces |
| `--surface-alt` | `#f8fafc` | `#162032` | Secondary headers, drawer sidebars, table headers |
| `--border` | `#e2e6ee` | `#334155` | Structural borders, card outlines, separators |
| `--text` | `#1c2333` | `#e2e8f0` | Standard body copy and secondary labels |
| `--text-heading` | `#0f172a` | `#f8fafc` | Headings, card titles, modal headers |
| `--muted` | `#6b7489` | `#94a3b8` | Subtitles, disabled states, placeholder copy |
| `--primary` | `#3b5bdb` | `#4c6ef5` | Primary brand actions, links, active tab highlights |
| `--primary-dark` | `#2f49b5` | `#3b5bdb` | Hover state for primary buttons |
| `--primary-light` | `#e7ecff` | `rgba(76, 110, 245, 0.2)` | Primary chip backgrounds, hover row highlights |
| `--danger` | `#d6336c` | `#f783ac` | Destructive buttons, error alerts, deactivation badges |
| `--danger-bg` | `#fff0f3` | `rgba(214, 51, 108, 0.16)` | Error callout boxes, invalid field highlights |
| `--ok` | `#2b8a3e` | `#51cf66` | Success alerts, active badges, status confirmations |
| `--ok-bg` | `#ebfbee` | `rgba(43, 138, 62, 0.18)` | Success banner backgrounds, approved indicators |
| `--focus-ring` | `rgba(59, 91, 219, 0.25)` | `rgba(76, 110, 245, 0.45)` | Accessible focus glow on interactive inputs |

### 2.2 Role & Status Badges

```css
/* Administrator Role Badge */
.badge.role-admin {
  background: var(--badge-role-admin-bg);
  color: var(--badge-role-admin-text);
  border: 1px solid rgba(214, 51, 108, 0.3);
}

/* Department Manager Role Badge */
.badge.role-manager {
  background: var(--badge-role-manager-bg);
  color: var(--badge-role-manager-text);
  border: 1px solid rgba(245, 159, 0, 0.3);
}

/* Standard Employee Role Badge */
.badge.role-user {
  background: var(--badge-role-user-bg);
  color: var(--badge-role-user-text);
  border: 1px solid rgba(59, 91, 219, 0.3);
}
```

---

## 3. Typography Scale

The font stack relies on system native typefaces for instantaneous loading and native operating system fidelity:

```css
--sans: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
--mono: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace;
```

| Scale | Size | Line Height | Weight | Application |
|---|---|---|---|---|
| **Display / H1** | `32px` (`2rem`) | `1.2` | `700` | Page titles, primary dashboard headings |
| **Section / H2** | `24px` (`1.5rem`) | `1.3` | `600` | Modal headers, card section titles |
| **Subheading / H3** | `18px` (`1.125rem`) | `1.4` | `600` | Drawer titles, metric widget labels |
| **Body (Default)** | `15px` (`0.9375rem`) | `1.5` | `400` / `500` | Table data, paragraph text, form labels |
| **Small / Caption** | `13px` (`0.8125rem`) | `1.4` | `400` / `500` | Helper text, timestamps, table column headers |
| **Micro / Badge** | `11px` (`0.6875rem`) | `1.2` | `700` | Pill badges, unread notification counters |

---

## 4. Spacing, Elevation & Geometry

### 4.1 Spatial Rhythm
Spacers adhere to an 8-point geometric scale:
- `4px`: Micro padding (chips, badges, input borders)
- `8px`: Dense item spacing, gap between icon and label
- `12px`: Input internal padding, card item gap
- `16px`: Standard card padding, modal body spacing
- `24px`: Section gap, page container padding
- `32px`: Major layout module separation

### 4.2 Elevation & Shadows
```css
--shadow: 0 1px 3px rgba(20, 30, 60, 0.05);
--modal-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
--overlay-bg: rgba(15, 20, 40, 0.45);
--radius: 10px;
```

### 4.3 Z-Index Hierarchy
- Base Content: `0` – `10`
- Sticky Table Headers & Navbars: `50` – `100`
- Dropdowns & Select Menus: `500`
- Slide-Over Drawers: `800`
- Modal Overlays & Dialogs: `1000`
- Floating Toast Alerts: `2000`

---

## 5. Component Library Specifications

### 5.1 Buttons
Buttons are available in four functional variants:
- **Primary (`.btn-primary`):** Solid `--primary` fill with white text. Used for main action per view (Save, Create, Export).
- **Secondary (`.btn-secondary`):** Translucent background with `--border` outline and `--text` color. Used for Cancel, Back, Filter.
- **Danger (`.btn-danger`):** Soft or solid red fill (`--danger`). Used for Deactivate, Delete, Terminate.
- **Ghost / Icon (`.btn-ghost`):** Borderless with subtle hover highlight. Used for close buttons, header icons, pagination arrows.

### 5.2 Form Inputs & Real-Time Validation
- Standard inputs specify `height: 40px`, `border: 1px solid var(--border)`, and `border-radius: var(--radius)`.
- When an error is present:
  - Input receives `.input-error` class (`border-color: var(--danger)`).
  - Renders `<FieldError error={fieldErrors[fieldName]} id={"error-" + fieldName} />` immediately below.
  - Input sets `aria-invalid="true"` and `aria-describedby={"error-" + fieldName}`.
- **Validation Event Timing:**
  - Typing (`onChange`): Immediately clears previous error messages.
  - Blurring (`onBlur`): Validates single field and displays inline feedback.
  - Submission (`onSubmit`): Validates entire form and scrolls smoothly to first invalid field.

### 5.3 Modal Architecture (`Modal.jsx`)
- Full viewport background backdrop with `backdrop-filter: blur(4px)`.
- Keyboard trap: pressing `Escape` dismisses the modal gracefully.
- Clicking backdrop outside dialog triggers dismissal, unless locked for pending operations (`busy=true`).
- Smooth entrance animation: scale from `0.97` to `1.0` with opacity fade over `180ms`.

### 5.4 Data Tables & Pagination
- Alternating row styling with subtle hover effect (`--row-hover`).
- Interactive column headers with visual sort indicators (`▲`, `▼`).
- Sticky table header (`position: sticky; top: 0; background: var(--th-bg)`).
- Mobile responsive container with horizontal scroll handling (`overflow-x: auto`).

### 5.5 Real-Time Notification Bell & Toasts
- Ringing bell with CSS keyframe animation (`@keyframes bell-shake`).
- Red badge counter highlighting unread notifications.
- Floating toast alert positioning in the bottom-right viewport with progress bar auto-dismissal (4000ms).

### 5.6 Inactivity Idle Badge & Security Timeout Dialog
- **Topbar Inactivity Badge (`.session-idle-pill`):**
  - Pill button container with monospace tabular numbers for stable countdown display.
  - Hover elevation with brand outline and 1-click quick-extend action.
  - Urgent State (`.session-idle-pill.urgent` when $\le 60\text{s}$): soft red background, red border, and pulsing box-shadow animation (`@keyframes sessionIdlePulse`).
- **Security Timeout Dialog (`.session-timeout-card`):**
  - High z-index fixed backdrop (`z-index: 99999`) with strong blur (`backdrop-filter: blur(8px)`).
  - Centered elevated card featuring an animated sand timer icon pulse (`.session-timeout-icon-pulse`).
  - Prominent countdown numeric readout and animated progress bar (`.session-progress-bar-fill`).
  - Accessible action buttons (`Stay Signed In` as auto-focused primary, `Sign Out Now` as secondary).

### 5.7 Modern Split-Screen Hero Authentication & 3D Card Flip
- **Showcase Stage (`.auth-hero-showcase`):**
  - Left column featuring cybernetic ambient glow orbs, subtle grid mesh, dynamic live clock with millisecond precision, current system date, and contextual greeting (`GOOD MORNING/AFTERNOON/EVENING`).
  - Digital network sphere with orbital rings, core glow, and attendance verification status banners (strictly without corporate logos or photography).
  - 4-column feature strip detailing platform pillars (`Secure attendance`, `Real-time tracking`, `Insightful reports`, `Team connected`).
- **3D Card Flip Auth Stage (`.auth-card-stage`, `.auth-flip-card`):**
  - Right column with 3D perspective (`perspective: 1200px`) and smooth flip transition (`transform: rotateY(180deg)`).
  - Front face: Sign In form with email/ID input, password visibility reveal, "Remember me" persistence, primary submit button, and Microsoft SSO placeholder.
  - Back face: Self-Service Registration and Account Recovery (Forgot Password) forms.
  - Security indicator footer with green status pulse dot (`System secure • Secure access • Friday, Oct 23, 2026`).

### 5.8 Cookie Compliance & Floating Controls
- **Floating Settings Trigger (`.privacy-notice-pill`):**
  - Positioned fixed in bottom-left viewport (`bottom: 20px; left: 20px; z-index: 900`).
  - Compact glassmorphism pill (`Cookie Settings 🍪`) positioned cleanly without hovering over or occluding user avatars, navigation links, or action buttons.
- **Granular Settings Modal:**
  - Categorized consent switches for Strictly Necessary (locked), Functional Preferences, and Analytics with one-click Save & Accept.

---

## 6. Responsive Breakpoints

```css
/* Mobile Phones */
@media (max-width: 639px) {
  .app-container { padding: 12px; }
  .table-responsive { display: block; overflow-x: auto; }
  .modal-card { width: 95vw; margin: 10px; }
}

/* Tablets & Small Laptops */
@media (min-width: 640px) and (max-width: 1023px) {
  .app-container { padding: 18px; }
}

/* Desktops & Large Displays */
@media (min-width: 1024px) {
  .app-container { max-width: 1280px; margin: 0 auto; }
}
```

