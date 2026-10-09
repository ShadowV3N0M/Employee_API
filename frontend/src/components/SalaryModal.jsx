import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import FieldError from "./FieldError";
import { formatMoney } from "../format";

// Admin-only. Every change made here is recorded in the salary history.
export default function SalaryModal({ employee, onClose, onSaved }) {
  const current = Number(employee.Salary);

  const [mode, setMode] = useState("set"); // "set" | "increment"
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);

  const amount = Number(value);
  const result =
    mode === "set" ? amount : Math.round((current + amount) * 100) / 100;

  function validateInput(val) {
    if (val === "" || val === null || val === undefined) {
      return "Please enter an amount.";
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      return "Please enter a valid numeric amount.";
    }
    const computed = mode === "set" ? num : Math.round((current + num) * 100) / 100;
    if (computed < 0) {
      return mode === "set"
        ? "Salary cannot be negative."
        : "That would make the resulting salary negative.";
    }
    if (computed === current) {
      return mode === "set"
        ? "New salary must be different from current salary."
        : "Adjustment must be non-zero.";
    }
    if (computed > 1000000000) {
      return "Salary cannot exceed 1,000,000,000.";
    }
    return "";
  }

  const handleChange = (e) => {
    setValue(e.target.value);
    if (fieldError) setFieldError("");
    if (error) setError("");
  };

  const handleBlur = () => {
    const err = validateInput(value);
    setFieldError(err);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setFieldError("");
    if (error) setError("");
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const err = validateInput(value);
    if (err) {
      setFieldError(err);
      const el = document.getElementById("salary-modal-input");
      if (el) el.focus();
      return;
    }

    setBusy(true);
    try {
      if (mode === "set") await api.setSalary(employee.Emp_ID, amount);
      else await api.incrementSalary(employee.Emp_ID, amount);

      onSaved(
        `${employee.F_Name} ${employee.L_Name}: salary ${formatMoney(current)} → ${formatMoney(result)}`
      );
    } catch (err) {
      setError(err.message || "Failed to update salary.");
      setBusy(false);
    }
  }

  const isFormValid = !validateInput(value);

  return (
    <Modal title={`Change salary — ${employee.F_Name} ${employee.L_Name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack" noValidate>
        {error && <div className="alert error" role="alert">{error}</div>}

        <p>Current salary: <strong>{formatMoney(current)}</strong></p>

        <div className="segmented">
          <label className={mode === "set" ? "on" : ""}>
            <input type="radio" name="mode" checked={mode === "set"} onChange={() => handleModeChange("set")} />
            Set exact amount
          </label>
          <label className={mode === "increment" ? "on" : ""}>
            <input type="radio" name="mode" checked={mode === "increment"} onChange={() => handleModeChange("increment")} />
            Raise / cut by
          </label>
        </div>

        <label>
          <span>
            {mode === "set" ? "New salary" : "Amount (use a minus sign for a cut)"}{" "}
            <span className="required-asterisk">*</span>
          </span>
          <input
            id="salary-modal-input"
            type="number"
            step="0.01"
            min={mode === "set" ? "0" : undefined}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            autoFocus
            required
            className={fieldError ? "input-error" : ""}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? "salary-modal-input-error" : undefined}
          />
          <FieldError error={fieldError} id="salary-modal-input-error" />
        </label>

        {value !== "" && Number.isFinite(amount) && !fieldError && (
          <p className="muted" style={{ margin: "2px 0 0" }}>
            New salary would be <strong>{formatMoney(result)}</strong>
          </p>
        )}

        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" disabled={!isFormValid || busy}>
            {busy ? "Saving…" : "Apply change"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
