import { useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import FieldError from "./FieldError";
import { formatMoney } from "../format";
import { validateDeptName, validateBudget } from "../validation";

export default function DepartmentEditModal({ department, onClose, onSaved }) {
  const [name, setName] = useState(department.Dept_Name || "");
  const [budget, setBudget] = useState(
    department.Budget != null ? String(department.Budget) : ""
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const currentBudget = department.Budget != null ? Number(department.Budget) : null;
  const newBudgetNum = budget !== "" ? Number(budget) : null;

  const isNameChanged = name.trim() !== department.Dept_Name;
  const isBudgetChanged = newBudgetNum !== currentBudget;
  const hasChanges = isNameChanged || isBudgetChanged;

  const handleNameChange = (e) => {
    setName(e.target.value);
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: "" }));
    }
    if (error) setError("");
  };

  const handleNameBlur = () => {
    const err = validateDeptName(name);
    setFieldErrors((prev) => ({ ...prev, name: err }));
  };

  const handleBudgetChange = (e) => {
    setBudget(e.target.value);
    if (fieldErrors.budget) {
      setFieldErrors((prev) => ({ ...prev, budget: "" }));
    }
    if (error) setError("");
  };

  const handleBudgetBlur = () => {
    const err = validateBudget(budget, false);
    setFieldErrors((prev) => ({ ...prev, budget: err }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const nameErr = validateDeptName(name);
    const budgetErr = validateBudget(budget, false);

    const activeErrors = {};
    if (nameErr) activeErrors.name = nameErr;
    if (budgetErr) activeErrors.budget = budgetErr;

    if (Object.keys(activeErrors).length > 0) {
      setFieldErrors(activeErrors);
      setError("Please fix the errors before submitting.");
      const firstId = activeErrors.name ? "dept-edit-name" : "dept-edit-budget";
      const el = document.getElementById(firstId);
      if (el) el.focus();
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
      <form onSubmit={handleSubmit} className="stack" noValidate>
        {error && <div className="alert error" role="alert">{error}</div>}

        <div
          style={{
            background: "var(--surface-alt)",
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
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
          <span>Department Name <span className="required-asterisk">*</span></span>
          <input
            id="dept-edit-name"
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            placeholder="e.g. Engineering"
            required
            maxLength={50}
            className={fieldErrors.name ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "dept-edit-name-error" : undefined}
          />
          <FieldError error={fieldErrors.name} id="dept-edit-name-error" />
        </label>

        <label>
          <span>Allocated Budget</span>
          <input
            id="dept-edit-budget"
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={handleBudgetChange}
            onBlur={handleBudgetBlur}
            placeholder="e.g. 750000 (leave empty for unset)"
            className={fieldErrors.budget ? "input-error" : ""}
            aria-invalid={Boolean(fieldErrors.budget)}
            aria-describedby={fieldErrors.budget ? "dept-edit-budget-error" : undefined}
          />
          <FieldError error={fieldErrors.budget} id="dept-edit-budget-error" />
          <span className="small muted">
            {newBudgetNum !== null && Number.isFinite(newBudgetNum) ? (
              <>Preview: <strong>{formatMoney(newBudgetNum)}</strong></>
            ) : (
              "No budget limit allocated"
            )}
          </span>
        </label>

        <label>
          <span>Change Reason / Audit Note (optional)</span>
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
