import { useEffect, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatDateTime, formatMoney } from "../format";

export default function HistoryModal({ employee, onClose }) {
  const [rows, setRows] = useState(null); // null = still loading
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .salaryHistory(employee.Emp_ID)
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [employee.Emp_ID]);

  return (
    <Modal title={`Salary history — ${employee.F_Name} ${employee.L_Name}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}
      {!rows && !error && <p className="muted">Loading…</p>}

      {rows && rows.length === 0 && (
        <p className="muted">No salary changes recorded yet.</p>
      )}

      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th className="num">From</th><th className="num">To</th><th>Changed by</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.changed_at)}</td>
                  <td className="num">{formatMoney(r.old_salary)}</td>
                  <td className="num">{formatMoney(r.new_salary)}</td>
                  <td>{r.changed_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small">Only changes are logged; the starting salary isn't an entry.</p>
    </Modal>
  );
}
