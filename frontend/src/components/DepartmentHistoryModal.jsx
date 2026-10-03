import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import Modal from "./Modal";
import SortByDropdown from "./SortByDropdown";
import { formatDateTime, formatMoney } from "../format";

export default function DepartmentHistoryModal({ department, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Sorting & Filtration
  const [sortBy, setSortBy] = useState("changed_at");
  const [order, setOrder] = useState("desc");
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

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

  const sortOptions = useMemo(() => {
    const opts = [
      { value: "changed_at", label: "Timestamp" },
      { value: "change_type", label: "Action Type" },
      { value: "changed_by", label: "Admin / User" },
      { value: "new_budget", label: "Budget" },
    ];
    if (isGlobal) {
      opts.splice(1, 0, { value: "Dept_Name", label: "Department Name" });
    }
    return opts;
  }, [isGlobal]);

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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (typeFilter !== "all") count++;
    return count;
  }, [searchTerm, typeFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
  };

  const processedHistory = useMemo(() => {
    if (!history) return null;
    let list = [...history];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter((h) => {
        const dName = (h.Dept_Name || "").toLowerCase();
        const changer = (h.changed_by || "").toLowerCase();
        const notes = (h.notes || "").toLowerCase();
        return dName.includes(q) || changer.includes(q) || notes.includes(q);
      });
    }

    if (typeFilter !== "all") {
      list = list.filter((h) => h.change_type === typeFilter);
    }

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
  }, [history, searchTerm, typeFilter, sortBy, order]);

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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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

        {/* Filtration bar for department history */}
        {showFilters && (
          <div className="filter-card" style={{ marginBottom: "14px", padding: "10px 12px" }}>
            <div className="filter-bar" style={{ gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="filter-label">Search</span>
                <input
                  type="search"
                  className="filter-input"
                  style={{ height: "30px", fontSize: "0.82rem" }}
                  placeholder="Search admin, department, notes…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ flex: "0 1 160px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="filter-label">Action Type</span>
                <select
                  className="filter-select"
                  style={{ height: "30px", fontSize: "0.82rem" }}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All Actions</option>
                  <option value="BUDGET_REVISED">Budget Revised</option>
                  <option value="NAME_CHANGED">Name Changed</option>
                  <option value="NAME_AND_BUDGET_UPDATED">Name & Budget</option>
                  <option value="CREATED">Created</option>
                  <option value="DELETED">Deleted</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <p className="muted center" style={{ padding: "30px 0" }}>
            Loading department history…
          </p>
        )}

        {!loading && (!processedHistory || processedHistory.length === 0) && (
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
              {activeFilterCount > 0
                ? "No history records match the selected filters."
                : isGlobal
                ? "No department creation, budget changes, or updates have been logged yet."
                : `No previous revisions recorded for "${department.Dept_Name}".`}
            </p>
          </div>
        )}

        {!loading && processedHistory && processedHistory.length > 0 && (
          <div className="card table-wrap" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th className="sortable sortable-th" onClick={() => toggleSort("changed_at")}>
                    <div className="th-content">Timestamp{arrow("changed_at")}</div>
                  </th>
                  {isGlobal && (
                    <th className="sortable sortable-th" onClick={() => toggleSort("Dept_Name")}>
                      <div className="th-content">Dept{arrow("Dept_Name")}</div>
                    </th>
                  )}
                  <th className="sortable sortable-th" onClick={() => toggleSort("changed_by")}>
                    <div className="th-content">Admin{arrow("changed_by")}</div>
                  </th>
                  <th className="sortable sortable-th" onClick={() => toggleSort("change_type")}>
                    <div className="th-content">Action{arrow("change_type")}</div>
                  </th>
                  <th className="sortable sortable-th" onClick={() => toggleSort("new_budget")}>
                    <div className="th-content">Budget Revision{arrow("new_budget")}</div>
                  </th>
                  <th>Name Change</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {processedHistory.map((h) => (
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
