import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formatMoney } from "../format";
import SortByDropdown from "../components/SortByDropdown";

const DEPT_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#e11d48", // Rose
  "#64748b", // Slate
];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("workforce"); // "workforce" | "financial"

  // Filtration & Sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "over" | "warning" | "safe" | "unbudgeted"
  const [sortBy, setSortBy] = useState("dept_id");
  const [order, setOrder] = useState("asc");
  const [showFilters, setShowFilters] = useState(true);
  const [barChartMode, setBarChartMode] = useState("top8"); // "top8" | "all" | "utilization"

  const loadData = () => {
    setLoading(true);
    setError("");
    api
      .getWorkforceAnalytics()
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load workforce analytics"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const isPrivileged = data && !data.is_financial_masked;

  const workforceSortOptions = [
    { value: "dept_id", label: "Department ID" },
    { value: "dept_name", label: "Department Name" },
    { value: "headcount", label: "Headcount" },
    { value: "percentage_of_total", label: "Workforce Share %" },
  ];

  const financialSortOptions = [
    { value: "dept_id", label: "Department ID" },
    { value: "dept_name", label: "Department Name" },
    { value: "headcount", label: "Headcount" },
    { value: "total_payroll", label: "Total Payroll" },
    { value: "average_salary", label: "Average Salary" },
    { value: "budget", label: "Allocated Budget" },
    { value: "budget_utilization_pct", label: "Budget Utilization %" },
  ];

  const currentSortOptions = activeTab === "financial" && isPrivileged
    ? financialSortOptions
    : workforceSortOptions;

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
    if (activeTab === "financial" && statusFilter !== "all") count++;
    return count;
  }, [searchTerm, statusFilter, activeTab]);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
  };

  // Filter and sort department list
  const processedDepartments = useMemo(() => {
    if (!data?.departments) return [];
    let list = [...data.departments];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.dept_name.toLowerCase().includes(q) ||
          String(d.dept_id).includes(q)
      );
    }

    if (activeTab === "financial" && statusFilter !== "all") {
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

      if (va == null && vb == null) return 0;
      if (va == null) return order === "asc" ? 1 : -1;
      if (vb == null) return order === "asc" ? -1 : 1;

      if (typeof va === "string") {
        return order === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return order === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [data?.departments, searchTerm, statusFilter, sortBy, order, activeTab]);

  // Donut chart calculations
  const donutSlices = useMemo(() => {
    if (!data?.departments || !data?.summary?.active_headcount) return [];
    const total = data.summary.active_headcount;
    if (total === 0) return [];

    const radius = 38;
    const circumference = 2 * Math.PI * radius; // ~238.76
    let cumulativePercent = 0;

    return data.departments
      .filter((d) => d.headcount > 0)
      .map((d, index) => {
        const percent = (d.headcount / total) * 100;
        const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -((cumulativePercent / 100) * circumference);
        cumulativePercent += percent;

        return {
          dept_id: d.dept_id,
          dept_name: d.dept_name,
          headcount: d.headcount,
          percent: percent.toFixed(1),
          color: DEPT_COLORS[index % DEPT_COLORS.length],
          strokeDasharray,
          strokeDashoffset,
        };
      });
  }, [data?.departments, data?.summary?.active_headcount]);

  const barChartDepartments = useMemo(() => {
    if (!data?.departments) return [];
    const list = [...data.departments];
    if (barChartMode === "utilization") {
      return list
        .filter((d) => d.budget_utilization_pct != null)
        .sort((a, b) => (b.budget_utilization_pct || 0) - (a.budget_utilization_pct || 0));
    }
    if (barChartMode === "top8") {
      return list
        .sort((a, b) => (b.total_payroll || 0) - (a.total_payroll || 0))
        .slice(0, 8);
    }
    return list.sort((a, b) => (b.total_payroll || 0) - (a.total_payroll || 0));
  }, [data?.departments, barChartMode]);

  const maxFinancialValue = useMemo(() => {
    if (!barChartDepartments.length) return 1;
    return Math.max(
      ...barChartDepartments.map((d) => Math.max(d.total_payroll || 0, d.budget || 0, 1))
    );
  }, [barChartDepartments]);

  function getBudgetStatusColor(status) {
    if (status === "over" || status === "danger") return "#e03131";
    if (status === "warning") return "#f59f00";
    if (status === "safe" || status === "ok") return "#2b8a3e";
    return "#868e96";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <h2>Workforce & Employee Analytics</h2>
            {data && (
              <span
                className={`badge ${isPrivileged ? "primary" : "secondary"}`}
                style={{ fontSize: "11px", fontWeight: "600", padding: "3px 8px" }}
              >
                {data.viewer_role === "admin"
                  ? "👑 Executive View"
                  : data.viewer_role === "manager"
                  ? "🛡️ Leadership View"
                  : "👥 Staff Directory View"}
              </span>
            )}
          </div>
          <p className="muted" style={{ marginTop: "4px" }}>
            {isPrivileged
              ? "Comprehensive workforce demographics, department staffing proportions, tenure milestones, and financial payroll utilization."
              : "Company-wide team headcount distributions, tenure milestones, and workplace emergency readiness."}
          </p>
        </div>

        <div className="toolbar" style={{ marginTop: "4px" }}>
          <button className="btn ghost" onClick={loadData} disabled={loading} title="Reload latest statistics">
            🔄 {loading ? "Refreshing…" : "Refresh Data"}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading && !data && (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          Loading workforce analytics…
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Tab Navigation for Privileged Users */}
          {isPrivileged && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "8px",
              }}
            >
              <button
                type="button"
                className={`btn ${activeTab === "workforce" ? "primary" : "ghost"}`}
                style={{ fontSize: "13px", padding: "7px 16px" }}
                onClick={() => {
                  setActiveTab("workforce");
                  setSortBy("dept_id");
                }}
              >
                👥 Workforce & Team Demographics
              </button>
              <button
                type="button"
                className={`btn ${activeTab === "financial" ? "primary" : "ghost"}`}
                style={{ fontSize: "13px", padding: "7px 16px" }}
                onClick={() => {
                  setActiveTab("financial");
                  setSortBy("dept_id");
                }}
              >
                💼 Payroll & Budget Intelligence
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 1: WORKFORCE & TEAM DEMOGRAPHICS (Visible to ALL roles)              */}
          {/* ========================================================================= */}
          {activeTab === "workforce" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              {/* Row 1: High-Level Workforce KPI Cards */}
              <div className="analytics-kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                    👥
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Active Workforce</span>
                    <span className="kpi-value">{data.summary.active_headcount}</span>
                    <span className="kpi-sub">
                      {data.summary.retention_rate_pct}% Active ({data.summary.inactive_headcount} Inactive)
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                    ⏳
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Average Tenure</span>
                    <span className="kpi-value">{data.summary.avg_tenure_years} Years</span>
                    <span className="kpi-sub">Mean company tenure across active staff</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                    🚀
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">New Hires (90 Days)</span>
                    <span className="kpi-value">+{data.summary.new_hires_last_90_days}</span>
                    <span className="kpi-sub">
                      {data.summary.new_hires_last_30_days} in last 30d • {data.summary.new_hires_last_365_days} this year
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                    🚨
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">SOS Emergency Readiness</span>
                    <span className="kpi-value">{data.summary.emergency_contacts_coverage_pct}%</span>
                    <span className="kpi-sub">Active staff with verified emergency contacts</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Charts Grid (Department Donut + Tenure Histogram) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
                  gap: "20px",
                }}
              >
                {/* Chart A: Department Donut Chart */}
                <div className="card" style={{ padding: "20px" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "var(--text-heading)" }}>
                    🏛️ Department Staffing Distribution
                  </h3>

                  <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap", justifyContent: "center" }}>
                    {/* SVG Donut */}
                    <div style={{ position: "relative", width: "160px", height: "160px", flexShrink: 0 }}>
                      <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                        {/* Background track circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="var(--border)"
                          strokeWidth="14"
                        />
                        {/* Slices */}
                        {donutSlices.map((slice) => (
                          <circle
                            key={slice.dept_id}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="14"
                            strokeDasharray={slice.strokeDasharray}
                            strokeDashoffset={slice.strokeDashoffset}
                            style={{ transition: "stroke-dashoffset 0.5s ease" }}
                          />
                        ))}
                      </svg>
                      {/* Donut Center */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <span style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-heading)", lineHeight: 1 }}>
                          {data.summary.active_headcount}
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", marginTop: "2px" }}>
                          Total Staff
                        </span>
                      </div>
                    </div>

                    {/* Donut Legend */}
                    <div style={{ flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {donutSlices.slice(0, 6).map((slice) => (
                        <div
                          key={slice.dept_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "12px",
                            padding: "2px 0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                            <span
                              style={{
                                width: "10px",
                                height: "10px",
                                borderRadius: "3px",
                                background: slice.color,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                              {slice.dept_name}
                            </span>
                          </div>
                          <span style={{ fontWeight: "600", color: "var(--text-heading)", marginLeft: "8px" }}>
                            {slice.headcount} ({slice.percent}%)
                          </span>
                        </div>
                      ))}
                      {donutSlices.length > 6 && (
                        <span style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                          +{donutSlices.length - 6} other departments in table below
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chart B: Tenure Distribution Histogram */}
                <div className="card" style={{ padding: "20px" }}>
                  <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "var(--text-heading)" }}>
                    📈 Workforce Experience & Tenure Bands
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { label: "< 1 Year (New Joiners)", count: data.tenure_brackets.under_1_year, color: "#3b82f6" },
                      { label: "1 – 3 Years (Developing)", count: data.tenure_brackets["1_to_3_years"], color: "#10b981" },
                      { label: "3 – 5 Years (Core Experienced)", count: data.tenure_brackets["3_to_5_years"], color: "#f59e0b" },
                      { label: "5+ Years (Company Veterans)", count: data.tenure_brackets.over_5_years, color: "#8b5cf6" },
                    ].map((band, idx) => {
                      const total = data.summary.active_headcount || 1;
                      const pct = Math.round((band.count / total) * 100);

                      return (
                        <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                            <span style={{ fontWeight: "500", color: "var(--text)" }}>{band.label}</span>
                            <span style={{ fontWeight: "600", color: "var(--text-heading)" }}>
                              {band.count} ({pct}%)
                            </span>
                          </div>
                          <div className="progress-bar-track" style={{ height: "8px" }}>
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${pct}%`, background: band.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Row 3: Health Readiness (Blood Group Directory Distribution) */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-heading)" }}>
                      🩸 Emergency Blood Group Directory Readiness
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>
                      Workforce distribution for rapid emergency blood response and safety preparedness.
                    </p>
                  </div>
                  <span className="badge info" style={{ fontSize: "11px" }}>
                    Occupational Health
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(90px, 100%), 1fr))",
                    gap: "10px",
                    marginTop: "8px",
                  }}
                >
                  {Object.entries(data.blood_group_distribution).map(([bg, count]) => {
                    const total = data.summary.active_headcount || 1;
                    const pct = Math.round((count / total) * 100);

                    return (
                      <div
                        key={bg}
                        style={{
                          background: "var(--surface-alt)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          padding: "10px 8px",
                          textAlign: "center",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: "700",
                            color: bg === "Not Specified" ? "var(--muted)" : "var(--danger)",
                          }}
                        >
                          {bg}
                        </span>
                        <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-heading)" }}>
                          {count}
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--muted)" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Generational / Age Demographics (Privileged only) */}
              {isPrivileged && data.age_demographics && (
                <div className="card" style={{ padding: "20px" }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "var(--text-heading)" }}>
                    🎂 Age & Generational Workforce Demographics (From Date of Birth)
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))",
                      gap: "12px",
                    }}
                  >
                    {[
                      { label: "Under 25", count: data.age_demographics.under_25, color: "#3b82f6" },
                      { label: "25 – 34", count: data.age_demographics["25_to_34"], color: "#10b981" },
                      { label: "35 – 49", count: data.age_demographics["35_to_49"], color: "#f59e0b" },
                      { label: "50+ Years", count: data.age_demographics["50_plus"], color: "#8b5cf6" },
                      { label: "Unspecified DOB", count: data.age_demographics.unspecified, color: "var(--muted)" },
                    ].map((bracket, idx) => {
                      const total = data.summary.active_headcount || 1;
                      const pct = Math.round((bracket.count / total) * 100);

                      return (
                        <div
                          key={idx}
                          style={{
                            background: "var(--surface-alt)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                        >
                          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>
                            {bracket.label}
                          </span>
                          <div style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-heading)", margin: "4px 0" }}>
                            {bracket.count}
                          </div>
                          <div className="progress-bar-track" style={{ height: "4px" }}>
                            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: bracket.color }} />
                          </div>
                          <span style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px", display: "block" }}>
                            {pct}% of workforce
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Row 5: Department Staffing Breakdown Table */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Filtration Toolbar */}
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

                    <SortByDropdown
                      options={currentSortOptions}
                      sortBy={sortBy}
                      order={order}
                      onChange={(field, newOrder) => {
                        setSortBy(field);
                        setOrder(newOrder);
                      }}
                    />

                    {activeFilterCount > 0 && (
                      <div className="filter-actions">
                        <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th onClick={() => toggleSort("dept_id")} style={{ cursor: "pointer", width: "90px" }}>
                          Dept ID {arrow("dept_id")}
                        </th>
                        <th onClick={() => toggleSort("dept_name")} style={{ cursor: "pointer" }}>
                          Department Name {arrow("dept_name")}
                        </th>
                        <th onClick={() => toggleSort("headcount")} style={{ cursor: "pointer", textAlign: "right" }}>
                          Staff Headcount {arrow("headcount")}
                        </th>
                        <th onClick={() => toggleSort("percentage_of_total")} style={{ cursor: "pointer", width: "240px" }}>
                          Workforce Proportion {arrow("percentage_of_total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedDepartments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="empty-state">
                            No departments match your filter.
                          </td>
                        </tr>
                      ) : (
                        processedDepartments.map((dept, idx) => (
                          <tr key={dept.dept_id}>
                            <td className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                              #{dept.dept_id}
                            </td>
                            <td>
                              <strong style={{ color: "var(--text-heading)" }}>{dept.dept_name}</strong>
                            </td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: "600" }}>
                              {dept.headcount}
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div className="progress-bar-track" style={{ flex: 1, height: "8px" }}>
                                  <div
                                    className="progress-bar-fill"
                                    style={{
                                      width: `${dept.percentage_of_total}%`,
                                      background: DEPT_COLORS[idx % DEPT_COLORS.length],
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: "12px", minWidth: "40px", fontVariantNumeric: "tabular-nums" }}>
                                  {dept.percentage_of_total}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: PAYROLL & BUDGET INTELLIGENCE (Admin / Manager Only)              */}
          {/* ========================================================================= */}
          {activeTab === "financial" && isPrivileged && data.financials && (
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              {/* Financial KPI Summary Cards */}
              <div className="analytics-kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(59, 91, 219, 0.15)", color: "var(--primary)" }}>
                    💼
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Total Payroll Expense</span>
                    <span className="kpi-value">{formatMoney(data.financials.total_payroll)}</span>
                    <span className="kpi-sub">Across all {data.financials.active_payroll_count} active employees</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(43, 138, 62, 0.15)", color: "var(--ok)" }}>
                    📈
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Average Compensation</span>
                    <span className="kpi-value">{formatMoney(data.financials.average_salary)}</span>
                    <span className="kpi-sub">Per active employee</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(214, 51, 108, 0.15)", color: "var(--danger)" }}>
                    ⚖️
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Compensation Range</span>
                    <span className="kpi-value" style={{ fontSize: "1.15rem" }}>
                      {formatMoney(data.financials.min_salary)} – {formatMoney(data.financials.max_salary)}
                    </span>
                    <span className="kpi-sub">Min to max compensation</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon" style={{ background: "rgba(107, 70, 193, 0.15)", color: "#805ad5" }}>
                    🏛️
                  </div>
                  <div className="kpi-content">
                    <span className="kpi-label">Tracked Departments</span>
                    <span className="kpi-value">{data.summary.departments_count}</span>
                    <span className="kpi-sub">Operational business units</span>
                  </div>
                </div>
              </div>

              {/* Department Budget vs. Payroll Expense Bar Graph */}
              <div className="card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-heading)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>📊</span> Department Budget vs. Payroll Expense Bar Graph
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                      Side-by-side comparative bar chart analyzing allocated operating budgets against active payroll expense.
                    </p>
                  </div>

                  {/* Controls & Legend */}
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                    {/* Legend */}
                    <div style={{ display: "flex", gap: "12px", fontSize: "12px", alignItems: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "10px", height: "10px", background: "#3b82f6", borderRadius: "2px" }} />
                        <span>Payroll</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "10px", height: "10px", background: "#10b981", borderRadius: "2px" }} />
                        <span>Budget (Healthy)</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "10px", height: "10px", background: "#ef4444", borderRadius: "2px" }} />
                        <span>Budget (Over)</span>
                      </span>
                    </div>

                    {/* Mode Buttons */}
                    <div style={{ display: "inline-flex", background: "var(--surface-alt)", padding: "2px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                      <button
                        type="button"
                        className="btn small"
                        style={{
                          background: barChartMode === "top8" ? "var(--primary)" : "transparent",
                          color: barChartMode === "top8" ? "#fff" : "var(--text)",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          margin: 0,
                        }}
                        onClick={() => setBarChartMode("top8")}
                      >
                        Top 8 by Payroll
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        style={{
                          background: barChartMode === "all" ? "var(--primary)" : "transparent",
                          color: barChartMode === "all" ? "#fff" : "var(--text)",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          margin: 0,
                        }}
                        onClick={() => setBarChartMode("all")}
                      >
                        All ({data.departments.length})
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        style={{
                          background: barChartMode === "utilization" ? "var(--primary)" : "transparent",
                          color: barChartMode === "utilization" ? "#fff" : "var(--text)",
                          border: "none",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          margin: 0,
                        }}
                        onClick={() => setBarChartMode("utilization")}
                      >
                        Utilization %
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visual Bars Container */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    maxHeight: barChartMode === "all" ? "600px" : "none",
                    overflowY: barChartMode === "all" ? "auto" : "visible",
                    paddingRight: barChartMode === "all" ? "8px" : 0,
                  }}
                >
                  {barChartDepartments.map((dept) => {
                    const payrollPct = maxFinancialValue > 0 ? ((dept.total_payroll || 0) / maxFinancialValue) * 100 : 0;
                    const budgetPct = maxFinancialValue > 0 && dept.budget ? ((dept.budget || 0) / maxFinancialValue) * 100 : 0;
                    const isOver = dept.budget_status === "over";
                    const statusColor = getBudgetStatusColor(dept.budget_status);

                    if (barChartMode === "utilization") {
                      return (
                        <div key={dept.dept_id} style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", flexWrap: "wrap", gap: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <strong style={{ color: "var(--text-heading)" }}>{dept.dept_name}</strong>
                              <span className="muted" style={{ fontSize: "11px" }}>({dept.headcount} staff)</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span className="muted" style={{ fontSize: "11px" }}>
                                Payroll: {formatMoney(dept.total_payroll)} / Budget: {dept.budget != null ? formatMoney(dept.budget) : "—"}
                              </span>
                              <span className={`badge ${dept.budget_status === "over" ? "danger" : dept.budget_status === "warning" ? "warning" : "ok"}`} style={{ fontSize: "11px" }}>
                                {dept.budget_utilization_pct}% {dept.budget_status === "over" ? "Over" : dept.budget_status === "warning" ? "Caution" : "Healthy"}
                              </span>
                            </div>
                          </div>
                          <div style={{ width: "100%", height: "10px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "999px", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(dept.budget_utilization_pct || 0, 100)}%`,
                                height: "100%",
                                background: statusColor,
                                borderRadius: "999px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={dept.dept_id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          background: "rgba(255, 255, 255, 0.02)",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", flexWrap: "wrap", gap: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ color: "var(--text-heading)" }}>{dept.dept_name}</strong>
                            <span className="muted" style={{ fontSize: "11px" }}>#{dept.dept_id} · {dept.headcount} staff</span>
                          </div>
                          {dept.budget != null && (
                            <span className={`badge ${isOver ? "danger" : dept.budget_status === "warning" ? "warning" : "ok"}`} style={{ fontSize: "11px" }}>
                              {dept.budget_utilization_pct}% {isOver ? "Over Budget" : dept.budget_status === "warning" ? "Near Budget" : "Healthy Budget"}
                            </span>
                          )}
                        </div>

                        {/* Bar 1: Payroll Expense */}
                        <div className="analytics-bar-row">
                          <span className="analytics-bar-label" style={{ color: "#60a5fa" }}>
                            Payroll
                          </span>
                          <div className="analytics-bar-track">
                            <div
                              style={{
                                width: `${Math.max(payrollPct, 2)}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
                                borderRadius: "4px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <strong className="analytics-bar-value" style={{ color: "var(--text-heading)" }}>
                            {formatMoney(dept.total_payroll)}
                          </strong>
                        </div>

                        {/* Bar 2: Budget Allocation */}
                        <div className="analytics-bar-row">
                          <span className="analytics-bar-label" style={{ color: isOver ? "#f87171" : "#34d399" }}>
                            Budget
                          </span>
                          <div className="analytics-bar-track">
                            {dept.budget != null ? (
                              <div
                                style={{
                                  width: `${Math.max(budgetPct, 2)}%`,
                                  height: "100%",
                                  background: isOver
                                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                                    : "linear-gradient(90deg, #10b981, #34d399)",
                                  borderRadius: "4px",
                                  transition: "width 0.4s ease",
                                }}
                              />
                            ) : (
                              <div style={{ height: "100%", display: "flex", alignItems: "center", paddingLeft: "6px", color: "var(--muted)", fontSize: "10px" }}>
                                Unbudgeted unit
                              </div>
                            )}
                          </div>
                          <strong className="analytics-bar-value" style={{ color: dept.budget != null ? "var(--text-heading)" : "var(--muted)" }}>
                            {dept.budget != null ? formatMoney(dept.budget) : "—"}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Department Budget Utilization Cards Grid */}
              <div>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "var(--text-heading)" }}>
                  📊 Department Budget Utilization & Status
                </h3>
                <div className="dept-utilization-grid">
                  {processedDepartments.map((dept) => {
                    const pct = dept.budget_utilization_pct;
                    const statusClass =
                      dept.budget_status === "over"
                        ? "danger"
                        : dept.budget_status === "warning"
                        ? "warning"
                        : dept.budget_status === "safe"
                        ? "ok"
                        : "muted";

                    return (
                      <div key={dept.dept_id} className="card dept-utilization-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <div>
                            <strong style={{ fontSize: "1rem", color: "var(--text-heading)", display: "block" }}>
                              {dept.dept_name}
                            </strong>
                            <span className="muted" style={{ fontSize: "0.78rem" }}>
                              {dept.headcount} {dept.headcount === 1 ? "Employee" : "Employees"}
                            </span>
                          </div>
                          {dept.budget != null ? (
                            <span className={`badge ${statusClass}`} style={{ fontSize: "0.72rem" }}>
                              {pct}% {dept.budget_status === "over" ? "Over" : dept.budget_status === "warning" ? "Caution" : "Healthy"}
                            </span>
                          ) : (
                            <span className="badge muted" style={{ fontSize: "0.72rem" }}>
                              Unbudgeted
                            </span>
                          )}
                        </div>

                        {dept.budget != null && (
                          <div style={{ margin: "12px 0 10px 0" }}>
                            <div
                              className="progress-bar-track"
                              style={{
                                height: "8px",
                                background: "rgba(255, 255, 255, 0.08)",
                                borderRadius: "999px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                className={`progress-bar-fill progress-bar-${statusClass}`}
                                style={{
                                  width: `${Math.min(pct || 0, 100)}%`,
                                  background: getBudgetStatusColor(dept.budget_status || statusClass),
                                  height: "100%",
                                  borderRadius: "999px",
                                  transition: "width 0.4s ease",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginTop: "8px" }}>
                          <div>
                            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Payroll</span>
                            <strong>{formatMoney(dept.total_payroll)}</strong>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span className="muted" style={{ display: "block", fontSize: "0.72rem" }}>Budget</span>
                            <strong>{dept.budget != null ? formatMoney(dept.budget) : "—"}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Department Financial Breakdown Table */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
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

                    <SortByDropdown
                      options={currentSortOptions}
                      sortBy={sortBy}
                      order={order}
                      onChange={(field, newOrder) => {
                        setSortBy(field);
                        setOrder(newOrder);
                      }}
                    />

                    {activeFilterCount > 0 && (
                      <div className="filter-actions">
                        <button type="button" className="filter-clear-btn" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th onClick={() => toggleSort("dept_id")} style={{ cursor: "pointer", width: "90px" }}>
                          Dept ID {arrow("dept_id")}
                        </th>
                        <th onClick={() => toggleSort("dept_name")} style={{ cursor: "pointer" }}>
                          Department {arrow("dept_name")}
                        </th>
                        <th onClick={() => toggleSort("headcount")} style={{ cursor: "pointer", textAlign: "right" }}>
                          Staff {arrow("headcount")}
                        </th>
                        <th onClick={() => toggleSort("total_payroll")} style={{ cursor: "pointer", textAlign: "right" }}>
                          Total Payroll {arrow("total_payroll")}
                        </th>
                        <th onClick={() => toggleSort("average_salary")} style={{ cursor: "pointer", textAlign: "right" }}>
                          Avg Salary {arrow("average_salary")}
                        </th>
                        <th onClick={() => toggleSort("budget")} style={{ cursor: "pointer", textAlign: "right" }}>
                          Allocated Budget {arrow("budget")}
                        </th>
                        <th onClick={() => toggleSort("budget_utilization_pct")} style={{ cursor: "pointer", width: "180px" }}>
                          Utilization {arrow("budget_utilization_pct")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedDepartments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            No departments matched the selected filters.
                          </td>
                        </tr>
                      ) : (
                        processedDepartments.map((dept) => {
                          const pct = dept.budget_utilization_pct;
                          const statusClass =
                            dept.budget_status === "over"
                              ? "danger"
                              : dept.budget_status === "warning"
                              ? "warning"
                              : dept.budget_status === "safe"
                              ? "ok"
                              : "muted";

                          return (
                            <tr key={dept.dept_id}>
                              <td className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                                #{dept.dept_id}
                              </td>
                              <td>
                                <strong>{dept.dept_name}</strong>
                              </td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {dept.headcount}
                              </td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: "600" }}>
                                {formatMoney(dept.total_payroll)}
                              </td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {formatMoney(dept.average_salary)}
                              </td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {dept.budget != null ? formatMoney(dept.budget) : <span className="muted">—</span>}
                              </td>
                              <td>
                                {pct != null ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <div
                                      className="progress-bar-track"
                                      style={{
                                        flex: 1,
                                        height: "6px",
                                        background: "rgba(255, 255, 255, 0.08)",
                                        borderRadius: "999px",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <div
                                        className={`progress-bar-fill progress-bar-${statusClass}`}
                                        style={{
                                          width: `${Math.min(pct, 100)}%`,
                                          background: getBudgetStatusColor(dept.budget_status || statusClass),
                                          height: "100%",
                                          borderRadius: "999px",
                                        }}
                                      />
                                    </div>
                                    <span style={{ fontSize: "11px", fontWeight: "600", minWidth: "35px" }}>
                                      {pct}%
                                    </span>
                                  </div>
                                ) : (
                                  <span className="muted" style={{ fontSize: "12px" }}>Unbudgeted</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
