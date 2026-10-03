import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formatMoney } from "../format";
import SortByDropdown from "../components/SortByDropdown";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtration & Sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "over" | "warning" | "safe" | "unbudgeted"
  const [sortBy, setSortBy] = useState("Dept_ID");
  const [order, setOrder] = useState("asc");
  const [showFilters, setShowFilters] = useState(true);

  const loadData = () => {
    setLoading(true);
    setError("");
    api
      .getPayrollSummary()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load payroll analytics"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortOptions = [
    { value: "Dept_ID", label: "Department ID" },
    { value: "Dept_Name", label: "Department Name" },
    { value: "headcount", label: "Headcount" },
    { value: "total_payroll", label: "Total Payroll" },
    { value: "average_salary", label: "Average Salary" },
    { value: "budget", label: "Allocated Budget" },
    { value: "budget_utilization_pct", label: "Budget Utilization %" },
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [searchTerm, statusFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  const processedDepartments = useMemo(() => {
    if (!data?.departments) return [];
    let list = [...data.departments];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.Dept_Name.toLowerCase().includes(q) ||
          String(d.Dept_ID).includes(q)
      );
    }

    if (statusFilter !== "all") {
      list = list.filter((d) => {
        const pct = d.budget_utilization_pct;
        if (statusFilter === "over") return pct != null && pct > 100;
        if (statusFilter === "warning") return pct != null && pct >= 80 && pct <= 100;
        if (statusFilter === "safe") return pct != null && pct < 80;
        if (statusFilter === "unbudgeted") return pct == null;
        return true;
      });
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
  }, [data?.departments, searchTerm, statusFilter, sortBy, order]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Payroll & Company Analytics</h2>
          <p className="muted">
            Company-wide compensation breakdown, active headcount, and department budget utilization.
          </p>
        </div>

        <div className="toolbar">
          <button
            type="button"
            className={`btn ${showFilters ? "primary" : "ghost"} filter-toggle-btn`}
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

          <button className="btn ghost" onClick={loadData} disabled={loading} title="Reload latest statistics">
            🔄 {loading ? "Refreshing…" : "Refresh Data"}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading && !data && (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          Loading analytics…
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* KPI Summary Cards */}
          <div className="analytics-kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(59, 91, 219, 0.15)", color: "var(--primary)" }}>
                💼
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Total Payroll Expense</span>
                <span className="kpi-value">{formatMoney(data.total_payroll)}</span>
                <span className="kpi-sub">Across all active staff</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(43, 138, 62, 0.15)", color: "var(--ok)" }}>
                👥
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Active Headcount</span>
                <span className="kpi-value">{data.total_headcount}</span>
                <span className="kpi-sub">{data.total_headcount === 1 ? "Employee" : "Employees"} active</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(245, 159, 0, 0.15)", color: "#f59f00" }}>
                📈
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Average Compensation</span>
                <span className="kpi-value">{formatMoney(data.average_salary)}</span>
                <span className="kpi-sub">Per active employee</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: "rgba(214, 51, 108, 0.15)", color: "var(--danger)" }}>
                ⚖️
              </div>
              <div className="kpi-content">
                <span className="kpi-label">Compensation Range</span>
                <span className="kpi-value" style={{ fontSize: "1.1rem" }}>
                  {formatMoney(data.min_salary)} – {formatMoney(data.max_salary)}
                </span>
                <span className="kpi-sub">Min to max compensation</span>
              </div>
            </div>
          </div>

          {/* Department Breakdown Filtering Bar */}
          {showFilters && (
            <div className="filter-card">
              <div className="filter-bar">
                <div className="filter-group lg">
                  <span className="filter-label">🔍 Search Department</span>
                  <input
                    type="search"
                    className="filter-input"
                    placeholder="Search by name or Dept ID…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <span className="filter-label">📊 Budget Status</span>
                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Budget Statuses</option>
                    <option value="over">🚨 Over Budget (&gt;100%)</option>
                    <option value="warning">⚠️ Budget Warning (80-100%)</option>
                    <option value="safe">✅ Healthy (&lt;80%)</option>
                    <option value="unbudgeted">⚪ Unbudgeted</option>
                  </select>
                </div>

                <div className="filter-actions">
                  <button
                    type="button"
                    className="filter-clear-btn"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                    title="Reset all filters"
                  >
                    ✕ Reset Filters
                    {activeFilterCount > 0 && (
                      <span className="filter-badge-active">{activeFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <div className="filter-summary">
                  <div className="filter-chips">
                    <span className="small muted">Active filters:</span>
                    {searchTerm.trim() && (
                      <span className="filter-chip">
                        Search: "{searchTerm.trim()}"
                        <button
                          className="filter-chip-remove"
                          title="Remove search filter"
                          onClick={() => setSearchTerm("")}
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {statusFilter !== "all" && (
                      <span className="filter-chip">
                        Status:{" "}
                        {statusFilter === "over"
                          ? "Over Budget"
                          : statusFilter === "warning"
                          ? "Warning (80-100%)"
                          : statusFilter === "safe"
                          ? "Healthy"
                          : "Unbudgeted"}
                        <button
                          className="filter-chip-remove"
                          title="Remove status filter"
                          onClick={() => setStatusFilter("all")}
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                  <span className="small muted">
                    Showing {processedDepartments.length} of {data.departments.length} departments
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Department Budget Utilization Cards */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0 }}>Department Budget Utilization</h3>
              <span className="muted small">
                {processedDepartments.length} matching {processedDepartments.length === 1 ? "department" : "departments"}
              </span>
            </div>

            {processedDepartments.length === 0 ? (
              <div className="card" style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>
                No departments match the current filter criteria.
                {activeFilterCount > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <button className="link" onClick={clearFilters}>
                      Clear filters to view all departments
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="dept-utilization-grid">
                {processedDepartments.map((d) => {
                  const pct = d.budget_utilization_pct != null ? d.budget_utilization_pct : null;
                  const isOverBudget = pct != null && pct > 100;
                  const isWarning = pct != null && pct >= 80 && pct <= 100;

                  return (
                    <div key={d.Dept_ID} className="card dept-utilization-card">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <strong style={{ fontSize: "1rem", color: "var(--text-heading)" }}>{d.Dept_Name}</strong>
                          <div className="small muted">Dept #{d.Dept_ID} · {d.headcount} {d.headcount === 1 ? "employee" : "employees"}</div>
                        </div>
                        {pct != null ? (
                          <span
                            className={`badge ${isOverBudget ? "role-admin" : isWarning ? "role-manager" : "ok"}`}
                            style={{ fontWeight: "700" }}
                          >
                            {pct}% used
                          </span>
                        ) : (
                          <span className="badge off">No budget</span>
                        )}
                      </div>

                      <div style={{ margin: "10px 0" }}>
                        <div className="progress-bar-track">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${Math.min(100, pct || 0)}%`,
                              backgroundColor: isOverBudget
                                ? "var(--danger)"
                                : isWarning
                                ? "#f59f00"
                                : "var(--ok)",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--muted)" }}>
                        <span>Spent: <strong>{formatMoney(d.total_payroll)}</strong></span>
                        <span>Budget: <strong>{d.budget != null ? formatMoney(d.budget) : "Unset"}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Department Breakdown Detailed Table */}
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="sortable sortable-th" onClick={() => toggleSort("Dept_ID")}>
                    <div className="th-content">ID{arrow("Dept_ID")}</div>
                  </th>
                  <th className="sortable sortable-th" onClick={() => toggleSort("Dept_Name")}>
                    <div className="th-content">Department{arrow("Dept_Name")}</div>
                  </th>
                  <th className="sortable sortable-th num" onClick={() => toggleSort("headcount")}>
                    <div className="th-content" style={{ justifyContent: "flex-end" }}>Headcount{arrow("headcount")}</div>
                  </th>
                  <th className="sortable sortable-th num" onClick={() => toggleSort("total_payroll")}>
                    <div className="th-content" style={{ justifyContent: "flex-end" }}>Total Payroll{arrow("total_payroll")}</div>
                  </th>
                  <th className="sortable sortable-th num" onClick={() => toggleSort("average_salary")}>
                    <div className="th-content" style={{ justifyContent: "flex-end" }}>Average Salary{arrow("average_salary")}</div>
                  </th>
                  <th className="sortable sortable-th num" onClick={() => toggleSort("budget")}>
                    <div className="th-content" style={{ justifyContent: "flex-end" }}>Allocated Budget{arrow("budget")}</div>
                  </th>
                  <th className="sortable sortable-th num" onClick={() => toggleSort("budget_utilization_pct")}>
                    <div className="th-content" style={{ justifyContent: "flex-end" }}>Utilization{arrow("budget_utilization_pct")}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {processedDepartments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted center" style={{ padding: "30px 10px" }}>
                      No departments match the current filter criteria.
                    </td>
                  </tr>
                )}
                {processedDepartments.map((d) => (
                  <tr key={d.Dept_ID}>
                    <td>{d.Dept_ID}</td>
                    <td><strong>{d.Dept_Name}</strong></td>
                    <td className="num">{d.headcount}</td>
                    <td className="num">{formatMoney(d.total_payroll)}</td>
                    <td className="num">{formatMoney(d.average_salary)}</td>
                    <td className="num">{d.budget != null ? formatMoney(d.budget) : "—"}</td>
                    <td className="num">
                      {d.budget_utilization_pct != null ? (
                        <span
                          className={`badge ${
                            d.budget_utilization_pct > 100
                              ? "role-admin"
                              : d.budget_utilization_pct >= 80
                              ? "role-manager"
                              : "ok"
                          }`}
                        >
                          {d.budget_utilization_pct}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
