import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatDateTime, formatMoney } from "../format";

export default function DepartmentHistoryModal({ department, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const isGlobal = !department;

  useEffect(() => {
    setLoading(true);
    setError("");

    const fetcher = isGlobal
      ? api.allDepartmentsHistory()
      : api.departmentHistory(department.Dept_ID);

    fetcher
      .then((data) => setHistory(data))
      .catch((err) => setError(err.message || "Failed to load department history."))
      .finally(() => setLoading(false));
  }, [department, isGlobal]);

  const renderBadge = (type) => {
    switch (type) {
      case "BUDGET_REVISED":
        return <span className="badge role-user">Budget Revised</span>;
      case "NAME_CHANGED":
        return <span className="badge role-manager">Name Changed</span>;
      case "NAME_AND_BUDGET_UPDATED":
        return <span className="badge role-admin">Name & Budget</span>;
      case "CREATED":
        return <span className="badge ok">Created</span>;
      case "DELETED":
        return <span className="badge role-admin">Deleted</span>;
      default:
        return <span className="badge">{type}</span>;
    }
  };

  const renderBudgetChange = (h) => {
    if (h.old_budget == null && h.new_budget == null) return "—";

    const oldVal = h.old_budget != null ? Number(h.old_budget) : null;
    const newVal = h.new_budget != null ? Number(h.new_budget) : null;

    let diffEl = null;
    if (oldVal != null && newVal != null) {
      const diff = newVal - oldVal;
      if (diff > 0) {
        diffEl = (
          <span style={{ color: "var(--ok)", fontSize: "0.78rem", marginLeft: "4px" }}>
            (+{formatMoney(diff)})
          </span>
        );
      } else if (diff < 0) {
        diffEl = (
          <span style={{ color: "var(--danger)", fontSize: "0.78rem", marginLeft: "4px" }}>
            ({formatMoney(diff)})
          </span>
        );
      }
    }

    return (
      <div style={{ whiteSpace: "nowrap" }}>
        <span>{oldVal != null ? formatMoney(oldVal) : "Unset"}</span>
        {" → "}
        <strong>{newVal != null ? formatMoney(newVal) : "Unset"}</strong>
        {diffEl}
      </div>
    );
  };

  return (
    <Modal
      title={
        isGlobal
          ? "Company Department Audit & Budget History"
          : `Revision & Budget History — ${department.Dept_Name} (Dept #${department.Dept_ID})`
      }
      onClose={onClose}
    >
      <div style={{ width: "100%", maxWidth: "820px" }}>
        {error && <div className="alert error">{error}</div>}

        {loading && (
          <p className="muted center" style={{ padding: "30px 0" }}>
            Loading department history…
          </p>
        )}

        {!loading && (!history || history.length === 0) && (
          <div
            style={{
              padding: "36px 12px",
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <p style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "4px" }}>
              No history records found
            </p>
            <p className="small">
              {isGlobal
                ? "No department creation, budget changes, or updates have been logged yet."
                : `No previous revisions recorded for "${department.Dept_Name}".`}
            </p>
          </div>
        )}

        {!loading && history && history.length > 0 && (
          <div className="card table-wrap" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  {isGlobal && <th>Dept</th>}
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Budget Revision</th>
                  <th>Name Change</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="nowrap small muted">{formatDateTime(h.changed_at)}</td>
                    {isGlobal && (
                      <td>
                        <strong>{h.Dept_Name}</strong>
                        {h.Dept_ID && <span className="small muted"> (#{h.Dept_ID})</span>}
                      </td>
                    )}
                    <td>
                      <code>{h.changed_by || "System"}</code>
                    </td>
                    <td>{renderBadge(h.change_type)}</td>
                    <td>{renderBudgetChange(h)}</td>
                    <td className="small">
                      {h.old_name && h.new_name && h.old_name !== h.new_name ? (
                        <>
                          <span className="muted">{h.old_name}</span> → <strong>{h.new_name}</strong>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="small muted">{h.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="actions" style={{ marginTop: "16px" }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
