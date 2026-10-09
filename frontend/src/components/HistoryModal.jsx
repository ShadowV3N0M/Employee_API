import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import SortByDropdown from "./SortByDropdown";
import { formatDateTime, formatMoney } from "../format";

export default function HistoryModal({ employee, onClose }) {
  const [rows, setRows] = useState(null); // null = still loading
  const [error, setError] = useState("");

  const [changedBy, setChangedBy] = useState("");
  const [debouncedChangedBy, setDebouncedChangedBy] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");

  // Sorting & filter toggle
  const [sortBy, setSortBy] = useState("changed_at");
  const [order, setOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(true);

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

  const sortOptions = [
    { value: "changed_at", label: "Revision Date" },
    { value: "old_salary", label: "Previous Salary" },
    { value: "new_salary", label: "New Salary" },
    { value: "changed_by", label: "Changed By" },
  ];

  function toggleSort(field) {
    if (sortBy === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setOrder("asc");
    }
  }

  const arrow = (field) =>
    sortBy === field ? (
      <span className="sort-indicator">{order === "asc" ? " ▲" : " ▼"}</span>
    ) : (
      <span className="sort-indicator muted" style={{ opacity: 0.35 }}>
        {" "}
        ⇅
      </span>
    );

  const sortedRows = useMemo(() => {
    if (!rows) return null;
    const list = [...rows];
    list.sort((a, b) => {
      let va = a[sortBy];
      let vb = b[sortBy];
      if (va == null) va = order === "asc" ? Infinity : -Infinity;
      if (vb == null) vb = order === "asc" ? Infinity : -Infinity;

      if (typeof va === "string") {
        const cmp = va.localeCompare(String(vb));
        return order === "asc" ? cmp : -cmp;
      }
      return order === "asc" ? va - vb : vb - va;
    });
    return list;
  }, [rows, sortBy, order]);

  return (
    <Modal title={`Salary history — ${employee.F_Name} ${employee.L_Name}`} onClose={onClose}>
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn ${showFilters ? "primary" : "ghost"} small filter-toggle-btn`}
            onClick={() => setShowFilters((prev) => !prev)}
            title={showFilters ? "Hide filtration bar" : "Show filtration bar"}
          >
            ⚡ Filter By
            {activeFilterCount > 0 && (
              <span className="filter-badge-active">{activeFilterCount}</span>
            )}
            <span style={{ fontSize: "0.7rem", marginLeft: "4px" }}>
              {showFilters ? "▲" : "▼"}
            </span>
          </button>

          <SortByDropdown
            options={sortOptions}
            sortBy={sortBy}
            order={order}
            onChange={(field, newOrder) => {
              setSortBy(field);
              setOrder(newOrder);
            }}
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className="btn small ghost"
            onClick={clearFilters}
            title="Reset filters"
          >
            ✕ Reset
          </button>
        )}
      </div>

      {/* Mini filtration bar for salary history */}
      {showFilters && (
        <div className="filter-card" style={{ marginBottom: "14px", padding: "10px 12px" }}>
          <div className="filter-bar" style={{ gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 120px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="filter-label">Admin / Changer</span>
              <input
                type="search"
                className="filter-input"
                style={{ height: "30px", fontSize: "0.82rem" }}
                placeholder="Filter by admin…"
                value={changedBy}
                onChange={(e) => setChangedBy(e.target.value)}
              />
            </div>

            <div style={{ flex: "0 1 90px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="filter-label">Min $</span>
              <input
                type="number"
                className="filter-input"
                style={{ height: "30px", fontSize: "0.82rem" }}
                placeholder="Min"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
              />
            </div>

            <div style={{ flex: "0 1 90px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="filter-label">Max $</span>
              <input
                type="number"
                className="filter-input"
                style={{ height: "30px", fontSize: "0.82rem" }}
                placeholder="Max"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {!rows && !error && <p className="muted">Loading…</p>}

      {sortedRows && sortedRows.length === 0 && (
        <p className="muted" style={{ padding: "16px 0", textAlign: "center" }}>
          {activeFilterCount > 0
            ? "No salary change records match the filter."
            : "No salary changes recorded yet."}
        </p>
      )}

      {sortedRows && sortedRows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable sortable-th" onClick={() => toggleSort("changed_at")}>
                  <div className="th-content">When{arrow("changed_at")}</div>
                </th>
                <th className="sortable sortable-th num" onClick={() => toggleSort("old_salary")}>
                  <div className="th-content" style={{ justifyContent: "flex-end" }}>From{arrow("old_salary")}</div>
                </th>
                <th className="sortable sortable-th num" onClick={() => toggleSort("new_salary")}>
                  <div className="th-content" style={{ justifyContent: "flex-end" }}>To{arrow("new_salary")}</div>
                </th>
                <th className="sortable sortable-th" onClick={() => toggleSort("changed_by")}>
                  <div className="th-content">Changed by{arrow("changed_by")}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
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
