import { useEffect, useState } from "react";
import { api } from "../api";
import { formatMoney } from "../format";

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

          {/* Department Budget Utilization Cards */}
          <div>
            <h3 style={{ marginBottom: "14px" }}>Department Budget Utilization</h3>
            <div className="dept-utilization-grid">
              {data.departments.map((d) => {
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
          </div>

          {/* Department Breakdown Detailed Table */}
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Department</th>
                  <th className="num">Headcount</th>
                  <th className="num">Total Payroll</th>
                  <th className="num">Average Salary</th>
                  <th className="num">Allocated Budget</th>
                  <th className="num">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((d) => (
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
