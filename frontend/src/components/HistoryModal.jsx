import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import { formatDateTime, formatMoney } from "../format";

export default function HistoryModal({ employee, onClose }) {
  const [rows, setRows] = useState(null); // null = still loading
  const [error, setError] = useState("");

  const [changedBy, setChangedBy] = useState("");
  const [debouncedChangedBy, setDebouncedChangedBy] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedChangedBy(changedBy);
    }, 300);
    return () => clearTimeout(timer);
  }, [changedBy]);

  useEffect(() => {
    let cancelled = false;
    const params = {
      changed_by: debouncedChangedBy.trim() || undefined,
      min_salary: minSalary !== "" ? Number(minSalary) : undefined,
      max_salary: maxSalary !== "" ? Number(maxSalary) : undefined,
    };

    api
      .salaryHistory(employee.Emp_ID, params)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [employee.Emp_ID, debouncedChangedBy, minSalary, maxSalary]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (changedBy.trim()) count++;
    if (minSalary !== "") count++;
    if (maxSalary !== "") count++;
    return count;
  }, [changedBy, minSalary, maxSalary]);

  const clearFilters = () => {
    setChangedBy("");
    setDebouncedChangedBy("");
    setMinSalary("");
    setMaxSalary("");
  };

  return (
    <Modal title={`Salary history — ${employee.F_Name} ${employee.L_Name}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}

      {/* Mini filtration bar for salary history */}
      <div style={{ marginBottom: "14px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 120px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Admin / Changer
          </label>
          <input
            type="search"
            className="filter-input"
            style={{ height: "32px", fontSize: "0.82rem" }}
            placeholder="Filter by admin…"
            value={changedBy}
            onChange={(e) => setChangedBy(e.target.value)}
          />
        </div>

        <div style={{ flex: "0 1 90px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Min $
          </label>
          <input
            type="number"
            className="filter-input"
            style={{ height: "32px", fontSize: "0.82rem" }}
            placeholder="Min"
            value={minSalary}
            onChange={(e) => setMinSalary(e.target.value)}
          />
        </div>

        <div style={{ flex: "0 1 90px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
            Max $
          </label>
          <input
            type="number"
            className="filter-input"
            style={{ height: "32px", fontSize: "0.82rem" }}
            placeholder="Max"
            value={maxSalary}
            onChange={(e) => setMaxSalary(e.target.value)}
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className="btn small ghost"
            style={{ height: "32px", padding: "0 10px", alignSelf: "flex-end" }}
            onClick={clearFilters}
          >
            Clear
          </button>
        )}
      </div>

      {!rows && !error && <p className="muted">Loading…</p>}

      {rows && rows.length === 0 && (
        <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>
          {activeFilterCount > 0
            ? "No salary change records match the filter."
            : "No salary changes recorded yet."}
        </p>
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

      <p className="muted small" style={{ marginTop: "12px" }}>
        Only changes are logged; the starting salary isn't an entry.
      </p>
    </Modal>
  );
}
