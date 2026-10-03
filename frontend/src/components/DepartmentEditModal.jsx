import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatMoney } from "../format";

export default function DepartmentEditModal({ department, onClose, onSaved }) {
  const [name, setName] = useState(department.Dept_Name || "");
  const [budget, setBudget] = useState(
    department.Budget != null ? String(department.Budget) : ""
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentBudget = department.Budget != null ? Number(department.Budget) : null;
  const newBudgetNum = budget !== "" ? Number(budget) : null;

  const isNameChanged = name.trim() !== department.Dept_Name;
  const isBudgetChanged = newBudgetNum !== currentBudget;
  const hasChanges = isNameChanged || isBudgetChanged;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Department name is required.");
      return;
    }

    if (newBudgetNum !== null && newBudgetNum < 0) {
      setError("Budget cannot be negative.");
      return;
    }

    if (!hasChanges) {
      onClose();
      return;
    }

    setBusy(true);
    try {
      await api.updateDepartment(department.Dept_ID, {
        Dept_Name: name.trim(),
        Budget: newBudgetNum,
        notes: notes.trim() || undefined,
      });

      let msg = `Department "${name.trim()}" updated successfully.`;
      if (isBudgetChanged) {
        msg += ` Budget revised: ${
          currentBudget != null ? formatMoney(currentBudget) : "Unset"
        } → ${newBudgetNum != null ? formatMoney(newBudgetNum) : "Unset"}.`;
      }
      onSaved(msg);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update department.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Edit Department — ${department.Dept_Name} (ID #${department.Dept_ID})`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="stack">
        {error && <div className="alert error">{error}</div>}

        <div
          style={{
            background: "var(--surface-alt)",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            display: "flex",
            gap: "24px",
            fontSize: "0.88rem",
          }}
        >
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
              Current Name
            </span>
            <strong>{department.Dept_Name}</strong>
          </div>
          <div>
            <span className="muted" style={{ display: "block", fontSize: "0.78rem" }}>
              Current Budget
            </span>
            <strong>
              {department.Budget != null ? formatMoney(department.Budget) : "Unset"}
            </strong>
          </div>
        </div>

        <label>
          Department Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Engineering"
            required
            maxLength={50}
          />
        </label>

        <label>
          Allocated Budget
          <input
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 750000 (leave empty for unset)"
          />
          <span className="small muted">
            {newBudgetNum !== null && Number.isFinite(newBudgetNum) ? (
              <>Preview: <strong>{formatMoney(newBudgetNum)}</strong></>
            ) : (
              "No budget limit allocated"
            )}
          </span>
        </label>

        <label>
          Change Reason / Audit Note (optional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Q4 budget expansion or corporate restructuring"
            maxLength={255}
          />
          <span className="small muted">
            This reason will be logged in the department's revision history.
          </span>
        </label>

        <div className="actions" style={{ marginTop: "12px" }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy || !hasChanges}>
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
