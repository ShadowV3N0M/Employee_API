import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatMoney } from "../format";

// Admin-only. Every change made here is recorded in the salary history.
export default function SalaryModal({ employee, onClose, onSaved }) {
  const current = Number(employee.Salary);

  const [mode, setMode] = useState("set"); // "set" | "increment"
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const amount = Number(value);
  const result =
    mode === "set" ? amount : Math.round((current + amount) * 100) / 100;
  const valid = value !== "" && Number.isFinite(amount) && result >= 0 && result !== current;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;

    setBusy(true);
    setError("");
    try {
      if (mode === "set") await api.setSalary(employee.Emp_ID, amount);
      else await api.incrementSalary(employee.Emp_ID, amount);

      onSaved(
        `${employee.F_Name} ${employee.L_Name}: salary ${formatMoney(current)} → ${formatMoney(result)}`
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Change salary — ${employee.F_Name} ${employee.L_Name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="alert error">{error}</div>}

        <p>Current salary: <strong>{formatMoney(current)}</strong></p>

        <div className="segmented">
          <label className={mode === "set" ? "on" : ""}>
            <input type="radio" name="mode" checked={mode === "set"} onChange={() => setMode("set")} />
            Set exact amount
          </label>
          <label className={mode === "increment" ? "on" : ""}>
            <input type="radio" name="mode" checked={mode === "increment"} onChange={() => setMode("increment")} />
            Raise / cut by
          </label>
        </div>

        <label>
          {mode === "set" ? "New salary" : "Amount (use a minus sign for a cut)"}
          <input
            type="number"
            step="0.01"
            min={mode === "set" ? "0" : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            required
          />
        </label>

        {value !== "" && Number.isFinite(amount) && (
          <p className={result < 0 ? "error-text" : "muted"}>
            {result < 0
              ? "That would make the salary negative."
              : <>New salary would be <strong>{formatMoney(result)}</strong></>}
          </p>
        )}

        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid || busy}>
            {busy ? "Saving…" : "Apply change"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
