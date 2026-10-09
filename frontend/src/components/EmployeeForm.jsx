import { useState, useEffect } from "react";
import { api } from "../api";
import Modal from "./Modal";
import PhoneInput from "./PhoneInput";
import FieldError from "./FieldError";
import { formatMoney } from "../format";
import { formatFullPhone, parsePhoneNumber } from "../phoneUtils";
import {
  validateName,
  validateEmpId,
  validateEmail,
  validateSalary,
  validateAddress,
  validatePhone,
  validateDob,
  validateJoiningDate,
} from "../validation";

// Used for both "Add employee" (employee = null) and "Edit employee".
export default function EmployeeForm({ employee, departments, role, onClose, onSaved }) {
  const editing = Boolean(employee);
  const isAdmin = role === "admin";
  const canEditSalary = !editing || isAdmin;

  const initialJoiningDate = () => {
    if (employee?.joining_date) {
      return String(employee.joining_date).slice(0, 10);
    }
    if (employee?.created_at) {
      return String(employee.created_at).slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  };

  const initialPhone = parsePhoneNumber(employee?.personal_phone);
  const [phoneCountryCode, setPhoneCountryCode] = useState(initialPhone.code);
  const [customCountryCode, setCustomCountryCode] = useState(initialPhone.customCode);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone.digits);

  const [form, setForm] = useState({
    Emp_ID: employee?.Emp_ID ?? "",
    F_Name: employee?.F_Name ?? "",
    L_Name: employee?.L_Name ?? "",
    Email: employee?.Email ?? "",
    Salary: employee?.Salary ?? "",
    Dept_ID: employee?.Dept_ID ?? departments[0]?.Dept_ID ?? "",
    Address: employee?.Address ?? "",
    joining_date: initialJoiningDate(),
    is_active: employee?.is_active ?? true,
    blood_group: employee?.blood_group ?? "",
    dob: employee?.dob ? String(employee.dob).slice(0, 10) : "",
    marital_status: employee?.marital_status ?? "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [occupiedEmployee, setOccupiedEmployee] = useState(null);

  // Check if entered Emp_ID is currently occupied by an existing employee
  useEffect(() => {
    if (editing || !form.Emp_ID) {
      setOccupiedEmployee(null);
      return;
    }
    const num = Number(form.Emp_ID);
    if (!Number.isInteger(num) || num <= 0) {
      setOccupiedEmployee(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const emp = await api.getEmployee(num);
        if (active && emp && emp.Emp_ID === num) {
          setOccupiedEmployee(emp);
        } else if (active) {
          setOccupiedEmployee(null);
        }
      } catch {
        if (active) {
          setOccupiedEmployee(null);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.Emp_ID, editing]);

  // Field validator matching modern validation timing rules
  function validateField(fieldName, val = form[fieldName]) {
    switch (fieldName) {
      case "Emp_ID":
        return !editing ? validateEmpId(val) : "";
      case "F_Name":
        return validateName(val, "First name");
      case "L_Name":
        return validateName(val, "Last name");
      case "Dept_ID":
        return !Number(val) ? "Please select a department." : "";
      case "Salary":
        return canEditSalary ? validateSalary(val, true) : "";
      case "Address":
        return validateAddress(val);
      case "joining_date":
        return isAdmin || !editing ? validateJoiningDate(val, true) : "";
      case "Email":
        if (isAdmin && editing) {
          return validateEmail(val, true);
        }
        if (isAdmin && !editing && (val || "").trim()) {
          return validateEmail(val, false);
        }
        return "";
      case "phone":
        return validatePhone(phoneDigits, phoneCountryCode, customCountryCode, false);
      case "dob":
        return validateDob(val, false);
      default:
        return "";
    }
  }

  // Clear errors immediately on typing (Validation Event Timing Matrix rule 1)
  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (error) setError("");
  };

  // Validate on blur (Validation Event Timing Matrix rule 2)
  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field);
    setFieldErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handlePhoneDigitsChange = (newDigits) => {
    setPhoneDigits(newDigits);
    if (fieldErrors.phone) {
      setFieldErrors((prev) => ({ ...prev, phone: "" }));
    }
    if (error) setError("");
  };

  const handlePhoneBlur = () => {
    setTouched((prev) => ({ ...prev, phone: true }));
    const err = validatePhone(phoneDigits, phoneCountryCode, customCountryCode, false);
    setFieldErrors((prev) => ({ ...prev, phone: err }));
  };

  async function handleDelete() {
    if (!isAdmin || !editing) return;
    setError("");
    setBusy(true);
    try {
      const res = await api.deleteEmployee(employee.Emp_ID);
      onSaved(
        res.message ||
          `Employee #${employee.Emp_ID} deleted and subsequent IDs updated successfully.`
      );
    } catch (err) {
      setError(err.message || "Failed to delete employee.");
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  }

  const handleAutoGenerateEmail = () => {
    const f = form.F_Name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const l = form.L_Name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!f || !l) {
      setError("Please provide first and last name before generating email.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      Email: `${f}.${l[0]}@laesfera.co`,
    }));
    if (fieldErrors.Email) {
      setFieldErrors((prev) => ({ ...prev, Email: "" }));
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validate all fields (Validation Event Timing Matrix rule 3: Gatekeeper on submit)
    const errors = {
      F_Name: validateField("F_Name", form.F_Name),
      L_Name: validateField("L_Name", form.L_Name),
      Dept_ID: validateField("Dept_ID", form.Dept_ID),
      Address: validateField("Address", form.Address),
      joining_date: validateField("joining_date", form.joining_date),
      phone: validatePhone(phoneDigits, phoneCountryCode, customCountryCode, false),
      dob: validateField("dob", form.dob),
    };

    if (!editing) {
      errors.Emp_ID = validateField("Emp_ID", form.Emp_ID);
    }

    if (canEditSalary) {
      errors.Salary = validateField("Salary", form.Salary);
    }

    if (isAdmin && (editing || form.Email.trim())) {
      errors.Email = validateField("Email", form.Email);
    }

    // Filter active errors
    const activeErrors = {};
    for (const [k, v] of Object.entries(errors)) {
      if (v) activeErrors[k] = v;
    }

    if (Object.keys(activeErrors).length > 0) {
      setFieldErrors(activeErrors);
      setError("Please correct the highlighted errors before submitting.");

      // Focus first invalid element for accessibility
      const firstErrorKey = Object.keys(activeErrors)[0];
      const targetId = firstErrorKey === "phone" ? "field-phone" : `field-${firstErrorKey}`;
      const firstInvalidEl = document.getElementById(targetId);
      if (firstInvalidEl) {
        firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalidEl.focus();
      }
      return;
    }

    const deptId = Number(form.Dept_ID);
    const formattedPhone = formatFullPhone(phoneCountryCode, customCountryCode, phoneDigits);

    setBusy(true);
    try {
      if (!editing) {
        const payload = {
          Emp_ID: Number(form.Emp_ID),
          F_Name: form.F_Name.trim(),
          L_Name: form.L_Name.trim(),
          Salary: Number(form.Salary),
          Dept_ID: deptId,
          Address: form.Address.trim(),
          joining_date: form.joining_date || undefined,
        };
        if (form.Email.trim()) {
          payload.Email = form.Email.trim().toLowerCase();
        }
        if (formattedPhone) payload.personal_phone = formattedPhone;
        if (form.blood_group.trim()) payload.blood_group = form.blood_group.trim().toUpperCase();
        if (form.dob) payload.dob = form.dob;
        if (form.marital_status.trim()) payload.marital_status = form.marital_status.trim();

        const res = await api.createEmployee(payload);
        const shiftNote = res.shifted_count
          ? ` (${res.shifted_count} existing record(s) auto-shifted up)`
          : "";
        onSaved(`Created ${res.employee.F_Name} ${res.employee.L_Name} — email ${res.employee.Email}${shiftNote}`);
      } else {
        // Send only what actually changed
        const changes = {};
        if (form.F_Name.trim() !== (employee.F_Name || "")) {
          changes.F_Name = form.F_Name.trim();
        }
        if (form.L_Name.trim() !== (employee.L_Name || "")) {
          changes.L_Name = form.L_Name.trim();
        }
        if (deptId !== employee.Dept_ID) {
          changes.Dept_ID = deptId;
        }
        if (form.Address.trim() !== (employee.Address || "")) {
          changes.Address = form.Address.trim();
        }

        // Personal details updates
        const origPhone = employee?.personal_phone ? employee.personal_phone.trim() : "";
        if ((formattedPhone || "") !== origPhone) {
          changes.personal_phone = formattedPhone;
        }
        if (form.blood_group.trim() !== (employee.blood_group || "")) {
          changes.blood_group = form.blood_group.trim().toUpperCase() || null;
        }
        const origDob = employee.dob ? String(employee.dob).slice(0, 10) : "";
        if (form.dob !== origDob) {
          changes.dob = form.dob || null;
        }
        if (form.marital_status !== (employee.marital_status || "")) {
          changes.marital_status = form.marital_status || null;
        }

        // Admin-only updates
        if (isAdmin) {
          if (canEditSalary && Number(form.Salary) !== Number(employee.Salary)) {
            changes.Salary = Number(form.Salary);
          }
          if (form.Email.trim().toLowerCase() !== (employee.Email || "").toLowerCase()) {
            changes.Email = form.Email.trim().toLowerCase();
          }
          const origDate = employee.joining_date
            ? String(employee.joining_date).slice(0, 10)
            : (employee.created_at ? String(employee.created_at).slice(0, 10) : "");
          if (form.joining_date && form.joining_date !== origDate) {
            changes.joining_date = form.joining_date;
          }
          if (Boolean(form.is_active) !== Boolean(employee.is_active)) {
            changes.is_active = Boolean(form.is_active);
          }
        }

        if (Object.keys(changes).length === 0) {
          return onClose();
        }

        await api.updateEmployee(employee.Emp_ID, changes);
        onSaved(`Updated #${employee.Emp_ID} ${form.F_Name.trim()} ${form.L_Name.trim()}`);
      }
    } catch (err) {
      setError(err.message || "Failed to save employee.");
      setBusy(false);
    }
  }

  const modalTitle = editing
    ? (isAdmin
        ? `Edit Employee #${employee.Emp_ID} (Admin Full Access)`
        : `Edit Employee #${employee.Emp_ID}`)
    : "Add Employee";

  return (
    <Modal title={modalTitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form-grid" noValidate>
        {error && <div className="alert error span-2" role="alert">{error}</div>}

        {isAdmin && editing && (
          <div
            className="span-2"
            style={{
              padding: "8px 12px",
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="badge role-admin">Admin</span>
            <span>You have full administrative privileges to edit all details: Name, Address, Salary, Email, Joining Date, and Status.</span>
          </div>
        )}

        {!editing && (
          <label>
            <span>Employee ID <span className="required-asterisk">*</span></span>
            <input
              id="field-Emp_ID"
              type="number"
              min="1"
              value={form.Emp_ID}
              onChange={set("Emp_ID")}
              onBlur={handleBlur("Emp_ID")}
              className={fieldErrors.Emp_ID ? "input-error" : ""}
              aria-invalid={Boolean(fieldErrors.Emp_ID)}
              aria-describedby={fieldErrors.Emp_ID ? "error-Emp_ID" : undefined}
              required
            />
            <FieldError error={fieldErrors.Emp_ID} id="error-Emp_ID" />
            {occupiedEmployee && (
              <div
                style={{
                  marginTop: "6px",
                  padding: "8px 12px",
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  borderRadius: "6px",
                  fontSize: "0.83rem",
                  color: "var(--color-primary, #2563eb)",
                  lineHeight: "1.4",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>⚡</span>
                <span>
                  <strong>Auto-Shift Notice:</strong> ID #{occupiedEmployee.Emp_ID} is currently held by{" "}
                  <strong>{occupiedEmployee.F_Name} {occupiedEmployee.L_Name}</strong>. Creating this employee will
                  auto-shift ID #{occupiedEmployee.Emp_ID} and higher records upward (+1) so no data is replaced or lost.
                </span>
              </div>
            )}
          </label>
        )}

        <label>
          <span>First name <span className="required-asterisk">*</span></span>
          <input
            id="field-F_Name"
            value={form.F_Name}
            onChange={set("F_Name")}
            onBlur={handleBlur("F_Name")}
            className={fieldErrors.F_Name ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.F_Name)}
            aria-describedby={fieldErrors.F_Name ? "error-F_Name" : undefined}
            required
            maxLength={50}
          />
          <FieldError error={fieldErrors.F_Name} id="error-F_Name" />
        </label>

        <label>
          <span>Last name <span className="required-asterisk">*</span></span>
          <input
            id="field-L_Name"
            value={form.L_Name}
            onChange={set("L_Name")}
            onBlur={handleBlur("L_Name")}
            className={fieldErrors.L_Name ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.L_Name)}
            aria-describedby={fieldErrors.L_Name ? "error-L_Name" : undefined}
            required
            maxLength={50}
          />
          <FieldError error={fieldErrors.L_Name} id="error-L_Name" />
        </label>

        <label>
          <span>Department <span className="required-asterisk">*</span></span>
          <select
            id="field-Dept_ID"
            value={form.Dept_ID}
            onChange={set("Dept_ID")}
            onBlur={handleBlur("Dept_ID")}
            className={fieldErrors.Dept_ID ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.Dept_ID)}
            aria-describedby={fieldErrors.Dept_ID ? "error-Dept_ID" : undefined}
            required
          >
            {departments.length === 0 && <option value="">No departments yet</option>}
            {departments.map((d) => (
              <option key={d.Dept_ID} value={d.Dept_ID}>
                {d.Dept_Name}
              </option>
            ))}
          </select>
          <FieldError error={fieldErrors.Dept_ID} id="error-Dept_ID" />
        </label>

        {canEditSalary ? (
          <label>
            <span>{editing ? "Salary" : "Starting salary"} <span className="required-asterisk">*</span></span>
            <input
              id="field-Salary"
              type="number"
              min="0"
              step="0.01"
              value={form.Salary}
              onChange={set("Salary")}
              onBlur={handleBlur("Salary")}
              className={fieldErrors.Salary ? "input-error" : ""}
              aria-invalid={Boolean(fieldErrors.Salary)}
              aria-describedby={fieldErrors.Salary ? "error-Salary" : undefined}
              required
            />
            <FieldError error={fieldErrors.Salary} id="error-Salary" />
          </label>
        ) : (
          <div className="readonly-field">
            <span>Salary</span>
            <strong>{formatMoney(employee.Salary)}</strong>
            <small className="muted">Only an admin can change an existing salary.</small>
          </div>
        )}

        <label className="span-2">
          <span>Address <span className="required-asterisk">*</span></span>
          <input
            id="field-Address"
            value={form.Address}
            onChange={set("Address")}
            onBlur={handleBlur("Address")}
            className={fieldErrors.Address ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.Address)}
            aria-describedby={fieldErrors.Address ? "error-Address" : undefined}
            required
            maxLength={500}
          />
          <FieldError error={fieldErrors.Address} id="error-Address" />
        </label>

        {/* Joining Date Field */}
        {isAdmin || !editing ? (
          <label>
            <span>Joining Date <span className="required-asterisk">*</span></span>
            <input
              id="field-joining_date"
              type="date"
              value={form.joining_date}
              onChange={set("joining_date")}
              onBlur={handleBlur("joining_date")}
              className={fieldErrors.joining_date ? "input-error" : ""}
              aria-invalid={Boolean(fieldErrors.joining_date)}
              aria-describedby={fieldErrors.joining_date ? "error-joining_date" : undefined}
              required
            />
            <FieldError error={fieldErrors.joining_date} id="error-joining_date" />
          </label>
        ) : (
          <div className="readonly-field">
            <span>Joining Date</span>
            <strong>{form.joining_date || "—"}</strong>
            <small className="muted">Only an admin can edit joining date.</small>
          </div>
        )}

        {/* Status Field */}
        {editing ? (
          isAdmin ? (
            <label>
              <span>Account Status</span>
              <select
                id="field-is_active"
                value={form.is_active ? "active" : "inactive"}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive / Deactivated</option>
              </select>
            </label>
          ) : (
            <div className="readonly-field">
              <span>Status</span>
              <strong>{form.is_active ? "Active" : "Inactive"}</strong>
              <small className="muted">Only an admin can toggle account status.</small>
            </div>
          )
        ) : (
          <div className="readonly-field">
            <span>Initial Status</span>
            <strong>Active</strong>
            <small className="muted">New employee will be created active.</small>
          </div>
        )}

        {/* Email Field */}
        {editing ? (
          isAdmin ? (
            <div className="span-2">
              <label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Official Email <span className="required-asterisk">*</span></span>
                  <button
                    type="button"
                    className="link small"
                    onClick={handleAutoGenerateEmail}
                    style={{ fontSize: "0.8rem", textDecoration: "underline", cursor: "pointer" }}
                  >
                    Auto-generate from Name
                  </button>
                </div>
                <input
                  id="field-Email"
                  type="email"
                  value={form.Email}
                  onChange={set("Email")}
                  onBlur={handleBlur("Email")}
                  placeholder="employee@company.com"
                  className={fieldErrors.Email ? "input-error" : ""}
                  aria-invalid={Boolean(fieldErrors.Email)}
                  aria-describedby={fieldErrors.Email ? "error-Email" : undefined}
                  required
                />
                <FieldError error={fieldErrors.Email} id="error-Email" />
              </label>
            </div>
          ) : (
            <div className="readonly-field span-2">
              <span>Official Email</span>
              <strong>{employee.Email || "—"}</strong>
              <small className="muted">Only an admin can edit official company email.</small>
            </div>
          )
        ) : (
          <div className="span-2">
            {isAdmin ? (
              <label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Official Email (Optional)</span>
                  <button
                    type="button"
                    className="link small"
                    onClick={handleAutoGenerateEmail}
                    style={{ fontSize: "0.8rem", textDecoration: "underline", cursor: "pointer" }}
                  >
                    Auto-generate from Name
                  </button>
                </div>
                <input
                  id="field-Email"
                  type="email"
                  value={form.Email}
                  onChange={set("Email")}
                  onBlur={handleBlur("Email")}
                  placeholder="Leave empty to auto-generate (e.g. john.d@laesfera.co)"
                  className={fieldErrors.Email ? "input-error" : ""}
                  aria-invalid={Boolean(fieldErrors.Email)}
                  aria-describedby={fieldErrors.Email ? "error-Email" : undefined}
                />
                <FieldError error={fieldErrors.Email} id="error-Email" />
              </label>
            ) : (
              <p className="muted small">
                The email (like <code>firstname.l@laesfera.co</code>) is generated automatically.
              </p>
            )}
          </div>
        )}

        {/* Personal Details Section */}
        <div className="span-2" style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginTop: "4px" }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "0.82rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>
            Personal Information (Self-Service Profile)
          </h4>
        </div>

        <PhoneInput
          id="field-phone"
          countryCode={phoneCountryCode}
          setCountryCode={setPhoneCountryCode}
          customCode={customCountryCode}
          setCustomCode={setCustomCountryCode}
          digits={phoneDigits}
          setDigits={handlePhoneDigitsChange}
          onBlur={handlePhoneBlur}
          error={fieldErrors.phone}
          label="Personal Mobile Phone"
        />

        <label>
          <span>Blood Group</span>
          <select id="field-blood_group" value={form.blood_group} onChange={set("blood_group")}>
            <option value="">Select blood group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </label>

        <label>
          <span>Date of Birth</span>
          <input
            id="field-dob"
            type="date"
            value={form.dob}
            onChange={set("dob")}
            onBlur={handleBlur("dob")}
            className={fieldErrors.dob ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.dob)}
            aria-describedby={fieldErrors.dob ? "error-dob" : undefined}
          />
          <FieldError error={fieldErrors.dob} id="error-dob" />
        </label>

        <label>
          <span>Marital Status</span>
          <select id="field-marital_status" value={form.marital_status} onChange={set("marital_status")}>
            <option value="">Select marital status</option>
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Divorced">Divorced</option>
            <option value="Widowed">Widowed</option>
          </select>
        </label>

        {showDeleteConfirm && (
          <div
            className="alert error span-2"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              border: "1px solid var(--danger-border)",
              marginTop: "8px",
            }}
          >
            <div>
              <strong style={{ fontSize: "0.95rem" }}>
                Permanently Delete Employee #{employee.Emp_ID}?
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong>{employee.F_Name} {employee.L_Name}</strong> and their salary history records?
                <br />
                <span style={{ color: "var(--text-heading)", fontWeight: 600 }}>
                  ⚡ Auto-Resequencing: All subsequent employee IDs (&gt; #{employee.Emp_ID}) will automatically decrement by 1 so IDs remain consecutive without gaps.
                </span>
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger small"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? "Deleting & Resequencing…" : "Confirm Permanent Delete"}
              </button>
            </div>
          </div>
        )}

        <div
          className="span-2"
          style={{
            display: "flex",
            justifyContent: isAdmin && editing ? "space-between" : "flex-end",
            alignItems: "center",
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {isAdmin && editing ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={busy || showDeleteConfirm}
              style={{ fontSize: "0.85rem", padding: "8px 14px" }}
              title="Permanently remove this employee and auto-update all subsequent IDs"
            >
              🗑️ Delete Employee
            </button>
          ) : <span />}

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy || showDeleteConfirm}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create employee"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
