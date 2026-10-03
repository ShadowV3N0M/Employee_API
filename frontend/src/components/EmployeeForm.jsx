import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatMoney } from "../format";

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
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

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
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const deptId = Number(form.Dept_ID);
    if (!deptId) return setError("Please choose a department.");

    if (!form.F_Name.trim()) return setError("First name is required.");
    if (!form.L_Name.trim()) return setError("Last name is required.");
    if (!form.Address.trim()) return setError("Address is required.");

    if (!editing) {
      const id = Number(form.Emp_ID);
      if (!Number.isInteger(id) || id <= 0) {
        return setError("Employee ID must be a positive whole number.");
      }
    }

    if (canEditSalary) {
      const salary = Number(form.Salary);
      if (form.Salary === "" || !Number.isFinite(salary) || salary < 0) {
        return setError("Salary must be a number that is 0 or more.");
      }
    }

    if (isAdmin && editing && form.Email.trim()) {
      if (!form.Email.includes("@") || form.Email.trim().length < 5) {
        return setError("Please enter a valid email address.");
      }
    }

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

        const res = await api.createEmployee(payload);
        onSaved(`Created ${res.employee.F_Name} ${res.employee.L_Name} — email ${res.employee.Email}`);
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
      setError(err.message);
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
      <form onSubmit={handleSubmit} className="form-grid">
        {error && <div className="alert error span-2">{error}</div>}

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
            Employee ID
            <input type="number" min="1" value={form.Emp_ID} onChange={set("Emp_ID")} required />
          </label>
        )}

        <label>
          First name
          <input value={form.F_Name} onChange={set("F_Name")} required maxLength={50} />
        </label>

        <label>
          Last name
          <input value={form.L_Name} onChange={set("L_Name")} required maxLength={50} />
        </label>

        <label>
          Department
          <select value={form.Dept_ID} onChange={set("Dept_ID")} required>
            {departments.length === 0 && <option value="">No departments yet</option>}
            {departments.map((d) => (
              <option key={d.Dept_ID} value={d.Dept_ID}>
                {d.Dept_Name}
              </option>
            ))}
          </select>
        </label>

        {canEditSalary ? (
          <label>
            {editing ? "Salary" : "Starting salary"}
            <input type="number" min="0" step="0.01" value={form.Salary} onChange={set("Salary")} required />
          </label>
        ) : (
          <div className="readonly-field">
            <span>Salary</span>
            <strong>{formatMoney(employee.Salary)}</strong>
            <small className="muted">Only an admin can change an existing salary.</small>
          </div>
        )}

        <label className="span-2">
          Address
          <input value={form.Address} onChange={set("Address")} required maxLength={500} />
        </label>

        {/* Joining Date Field */}
        {isAdmin || !editing ? (
          <label>
            Joining Date
            <input
              type="date"
              value={form.joining_date}
              onChange={set("joining_date")}
              required
            />
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
              Account Status
              <select
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
                  <span>Official Email</span>
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
                  type="email"
                  value={form.Email}
                  onChange={set("Email")}
                  placeholder="employee@company.com"
                  required
                />
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
                  type="email"
                  value={form.Email}
                  onChange={set("Email")}
                  placeholder="Leave empty to auto-generate (e.g. john.d@laesfera.co)"
                />
              </label>
            ) : (
              <p className="muted small">
                The email (like <code>firstname.l@laesfera.co</code>) is generated automatically.
              </p>
            )}
          </div>
        )}

        <div className="actions span-2">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create employee"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
