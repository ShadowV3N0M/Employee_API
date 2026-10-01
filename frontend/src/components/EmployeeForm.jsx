import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatMoney } from "../format";

// Used for both "Add employee" (employee = null) and "Edit employee".
export default function EmployeeForm({ employee, departments, role, onClose, onSaved }) {
  const editing = Boolean(employee);

  // Only admins may change an existing salary (the server enforces this too).
  // Anyone allowed to create an employee may set the starting salary.
  const canEditSalary = !editing || role === "admin";

  const [form, setForm] = useState({
    Emp_ID: employee?.Emp_ID ?? "",
    F_Name: employee?.F_Name ?? "",
    L_Name: employee?.L_Name ?? "",
    Salary: employee?.Salary ?? "",
    Dept_ID: employee?.Dept_ID ?? departments[0]?.Dept_ID ?? "",
    Address: employee?.Address ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const deptId = Number(form.Dept_ID);
    if (!deptId) return setError("Please choose a department.");

    if (!editing) {
      const id = Number(form.Emp_ID);
      if (!Number.isInteger(id) || id <= 0) return setError("Employee ID must be a positive whole number.");
    }
    if (canEditSalary) {
      const salary = Number(form.Salary);
      if (form.Salary === "" || !Number.isFinite(salary) || salary < 0) {
        return setError("Salary must be a number that is 0 or more.");
      }
    }

    setBusy(true);
    try {
      if (!editing) {
        const res = await api.createEmployee({
          Emp_ID: Number(form.Emp_ID),
          F_Name: form.F_Name.trim(),
          L_Name: form.L_Name.trim(),
          Salary: Number(form.Salary),
          Dept_ID: deptId,
          Address: form.Address.trim(),
        });
        onSaved(`Created ${res.employee.F_Name} ${res.employee.L_Name} — email ${res.employee.Email}`);
      } else {
        // Send only what actually changed
        const changes = {};
        if (form.F_Name.trim() !== employee.F_Name) changes.F_Name = form.F_Name.trim();
        if (form.L_Name.trim() !== employee.L_Name) changes.L_Name = form.L_Name.trim();
        if (deptId !== employee.Dept_ID) changes.Dept_ID = deptId;
        if (form.Address.trim() !== employee.Address) changes.Address = form.Address.trim();
        if (canEditSalary && Number(form.Salary) !== Number(employee.Salary)) {
          changes.Salary = Number(form.Salary);
        }

        if (Object.keys(changes).length === 0) return onClose();

        await api.updateEmployee(employee.Emp_ID, changes);
        onSaved(`Updated ${form.F_Name.trim()} ${form.L_Name.trim()}`);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Edit employee #${employee.Emp_ID}` : "Add employee"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form-grid">
        {error && <div className="alert error span-2">{error}</div>}

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
              <option key={d.Dept_ID} value={d.Dept_ID}>{d.Dept_Name}</option>
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

        {editing ? (
          <div className="readonly-field span-2">
            <span>Email</span>
            <strong>{employee.Email || "—"}</strong>
          </div>
        ) : (
          <p className="muted small span-2">
            The email (like <code>firstname.l@laesfera.co</code>) is generated automatically.
          </p>
        )}

        <div className="actions span-2">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create employee"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
