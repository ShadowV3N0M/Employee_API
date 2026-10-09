import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isPrivileged = isAdmin || isManager;

  // Active Report Tab: "payslip" | "directory" | "budget" | "revision"
  const [activeTab, setActiveTab] = useState("payslip");

  // Shared Data
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Current Month/Year Defaults
  const monthsList = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const now = new Date();
  const currentMonthName = monthsList[now.getMonth()];
  const currentYearNum = now.getFullYear();

  // Tab 1: Payslip State
  const [payslipEmpId, setPayslipEmpId] = useState("");
  const [payslipMonth, setPayslipMonth] = useState(currentMonthName);
  const [payslipYear, setPayslipYear] = useState(currentYearNum);
  const [payslipRegime, setPayslipRegime] = useState("new");
  const [payslipMetro, setPayslipMetro] = useState(false);

  // Tab 2: Directory Report State
  const [dirDeptId, setDirDeptId] = useState("");
  const [dirStatus, setDirStatus] = useState("active");
  const [dirSearch, setDirSearch] = useState("");

  // Tab 4: Salary Revision Letter State
  const [revisionEmpId, setRevisionEmpId] = useState("");

  // Load employees & departments list for selection
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    setError("");

    const loadAll = async () => {
      try {
        const [deptRes, empRes] = await Promise.all([
          api.listDepartments(),
          isPrivileged
            ? api.listEmployees({ all_records: true, all: true, limit: 0, status: "all" })
            : api.getMyProfile().catch(() => null),
        ]);

        if (cancelled) return;

        if (Array.isArray(deptRes)) {
          setDepartments(deptRes);
        }

        if (isPrivileged) {
          const list = Array.isArray(empRes) ? empRes : (empRes?.items || []);
          setEmployees(list);
          if (list.length > 0) {
            setPayslipEmpId((prev) => prev || String(list[0].Emp_ID));
            setRevisionEmpId((prev) => prev || String(list[0].Emp_ID));
          }
        } else {
          // Regular user viewing their own record
          let prof = empRes;
          if (!prof) {
            prof = await api.getMySalaryProfile().catch(() => null);
          }
          if (prof && (prof.Emp_ID || prof.emp_id)) {
            const empIdStr = String(prof.Emp_ID || prof.emp_id);
            setPayslipEmpId(empIdStr);
            setRevisionEmpId(empIdStr);
            setEmployees([
              {
                Emp_ID: prof.Emp_ID || prof.emp_id,
                F_Name: prof.F_Name || prof.name?.split(" ")[0] || "",
                L_Name: prof.L_Name || prof.name?.split(" ").slice(1).join(" ") || "",
                Email: prof.Email || prof.email || "",
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to load reports organizational directories:", err);
        if (!cancelled) setError("Failed to load organizational directories.");
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [isPrivileged]);

  // Ensure revisionEmpId and payslipEmpId default to first employee when list loads
  useEffect(() => {
    if (employees.length > 0) {
      if (!revisionEmpId || !employees.some((e) => String(e.Emp_ID) === String(revisionEmpId))) {
        setRevisionEmpId(String(employees[0].Emp_ID));
      }
      if (!payslipEmpId || !employees.some((e) => String(e.Emp_ID) === String(payslipEmpId))) {
        setPayslipEmpId(String(employees[0].Emp_ID));
      }
    }
  }, [employees, revisionEmpId, payslipEmpId]);

  const notify = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4500);
  };

  // 1. Payslip Handlers
  const handlePreviewPayslip = async () => {
    setError("");
    setBusy(true);
    try {
      const url = isPrivileged
        ? api.getPayslipPdfUrl(payslipEmpId, {
            month: payslipMonth,
            year: payslipYear,
            regime: payslipRegime,
            isMetro: payslipMetro,
            inline: true,
          })
        : api.getMyPayslipPdfUrl({
            month: payslipMonth,
            year: payslipYear,
            regime: payslipRegime,
            isMetro: payslipMetro,
            inline: true,
          });

      await api.previewPdf(url);
      notify("Payslip PDF preview opened in a new tab.");
    } catch (err) {
      setError(err.message || "Failed to generate payslip PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPayslip = async () => {
    setError("");
    setBusy(true);
    try {
      const filename = `Payslip_${payslipEmpId || "Self"}_${payslipMonth}_${payslipYear}.pdf`;
      const url = isPrivileged
        ? api.getPayslipPdfUrl(payslipEmpId, {
            month: payslipMonth,
            year: payslipYear,
            regime: payslipRegime,
            isMetro: payslipMetro,
            inline: false,
          })
        : api.getMyPayslipPdfUrl({
            month: payslipMonth,
            year: payslipYear,
            regime: payslipRegime,
            isMetro: payslipMetro,
            inline: false,
          });

      await api.downloadPdf(url, filename);
      notify(`Downloaded ${filename} successfully!`);
    } catch (err) {
      setError(err.message || "Failed to download payslip PDF.");
    } finally {
      setBusy(false);
    }
  };

  // 2. Directory Handlers
  const handlePreviewDirectory = async () => {
    setError("");
    setBusy(true);
    try {
      const url = api.getEmployeesPdfUrl({
        deptId: dirDeptId ? Number(dirDeptId) : undefined,
        status: dirStatus,
        search: dirSearch.trim() || undefined,
        inline: true,
      });
      await api.previewPdf(url);
      notify("Employee directory report preview opened.");
    } catch (err) {
      setError(err.message || "Failed to generate directory PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadDirectory = async () => {
    setError("");
    setBusy(true);
    try {
      const filename = `Employee_Directory_${dirStatus}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = api.getEmployeesPdfUrl({
        deptId: dirDeptId ? Number(dirDeptId) : undefined,
        status: dirStatus,
        search: dirSearch.trim() || undefined,
        inline: false,
      });
      await api.downloadPdf(url, filename);
      notify(`Downloaded ${filename} successfully!`);
    } catch (err) {
      setError(err.message || "Failed to download directory PDF.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Department Budget Handlers
  const handlePreviewBudget = async () => {
    setError("");
    setBusy(true);
    try {
      const url = api.getDepartmentsPdfUrl({ inline: true });
      await api.previewPdf(url);
      notify("Department budget statement opened.");
    } catch (err) {
      setError(err.message || "Failed to generate budget statement PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBudget = async () => {
    setError("");
    setBusy(true);
    try {
      const filename = `Department_Budget_Statement_${new Date().toISOString().slice(0, 10)}.pdf`;
      const url = api.getDepartmentsPdfUrl({ inline: false });
      await api.downloadPdf(url, filename);
      notify(`Downloaded ${filename} successfully!`);
    } catch (err) {
      setError(err.message || "Failed to download budget statement PDF.");
    } finally {
      setBusy(false);
    }
  };

  // 4. Salary Revision Letter Handlers
  const handlePreviewRevision = async () => {
    setError("");
    setBusy(true);
    try {
      const url = isPrivileged
        ? api.getSalaryRevisionPdfUrl(revisionEmpId, { inline: true })
        : api.getMySalaryRevisionPdfUrl({ inline: true });
      await api.previewPdf(url);
      notify("Salary revision letter preview opened.");
    } catch (err) {
      setError(err.message || "Failed to generate salary revision letter PDF.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadRevision = async () => {
    setError("");
    setBusy(true);
    try {
      const filename = `Salary_Revision_Letter_${revisionEmpId || "Self"}.pdf`;
      const url = isPrivileged
        ? api.getSalaryRevisionPdfUrl(revisionEmpId, { inline: false })
        : api.getMySalaryRevisionPdfUrl({ inline: false });
      await api.downloadPdf(url, filename);
      notify(`Downloaded ${filename} successfully!`);
    } catch (err) {
      setError(err.message || "Failed to download salary revision letter PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reports-page" style={{ maxWidth: "1080px", margin: "0 auto", padding: "16px 20px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: "1.75rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>📑</span> Official Reports &amp; PDF Generator
          </h1>
          <span className="badge role-admin" style={{ fontSize: "0.8rem", padding: "3px 8px" }}>
            ReportLab Engine
          </span>
        </div>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.92rem", lineHeight: 1.5 }}>
          Generate, preview, and download formal company PDF records: Monthly salary slip vouchers,
          HR directory statements, executive department budget utilization reports, and official salary revision letters.
        </p>
      </div>

      {/* Notifications */}
      {error && <div className="alert error" style={{ marginBottom: "16px" }}>{error}</div>}
      {successMsg && <div className="alert ok" style={{ marginBottom: "16px" }}>{successMsg}</div>}

      {/* Reports Navigation Tabs */}
      <div
        className="tabs-header"
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "2px solid var(--border)",
          marginBottom: "24px",
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          className={`btn ${activeTab === "payslip" ? "primary" : "ghost"}`}
          onClick={() => setActiveTab("payslip")}
          style={{ borderRadius: "8px 8px 0 0", fontWeight: 600 }}
        >
          🧾 Monthly Payslip Voucher
        </button>

        <button
          type="button"
          className={`btn ${activeTab === "directory" ? "primary" : "ghost"}`}
          onClick={() => setActiveTab("directory")}
          style={{ borderRadius: "8px 8px 0 0", fontWeight: 600 }}
        >
          👥 Employee Directory Report
        </button>

        {isPrivileged && (
          <button
            type="button"
            className={`btn ${activeTab === "budget" ? "primary" : "ghost"}`}
            onClick={() => setActiveTab("budget")}
            style={{ borderRadius: "8px 8px 0 0", fontWeight: 600 }}
          >
            🏛️ Department Budget Statement
          </button>
        )}

        <button
          type="button"
          className={`btn ${activeTab === "revision" ? "primary" : "ghost"}`}
          onClick={() => setActiveTab("revision")}
          style={{ borderRadius: "8px 8px 0 0", fontWeight: 600 }}
        >
          📜 Salary Revision Letter
        </button>
      </div>

      {/* TAB 1: PAYSLIP VOUCHER */}
      {activeTab === "payslip" && (
        <div className="card" style={{ padding: "24px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem" }}>
                🧾 Monthly Employee Payslip Voucher
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                Formal Indian payroll voucher detailing Gross Earnings, Statutory Deductions (EPF, PT, ESI, TDS),
                Net Take-Home Pay, and official organization authorization seal.
              </p>
            </div>
            <span className="badge" style={{ background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 }}>
              Portrait A4 • System Certified
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "16px", marginTop: "16px" }}>
            {/* Employee Selector */}
            {isPrivileged ? (
              <label>
                <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>
                  Select Employee {loadingData && "(Loading…)"}
                </span>
                <select
                  value={payslipEmpId}
                  onChange={(e) => setPayslipEmpId(e.target.value)}
                  disabled={busy || loadingData || employees.length === 0}
                >
                  {employees.length === 0 ? (
                    <option value="">{loadingData ? "Loading employee roster…" : "No employees available"}</option>
                  ) : (
                    employees.map((emp) => (
                      <option key={emp.Emp_ID} value={emp.Emp_ID}>
                        #{emp.Emp_ID} — {emp.F_Name} {emp.L_Name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : (
              <div>
                <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Employee Account</span>
                <div style={{ padding: "8px 12px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)", fontWeight: 600 }}>
                  👤 {user?.username} (Self-Service)
                </div>
              </div>
            )}

            {/* Month Selector */}
            <label>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Payroll Month</span>
              <select
                value={payslipMonth}
                onChange={(e) => setPayslipMonth(e.target.value)}
                disabled={busy}
              >
                {monthsList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>

            {/* Year Selector */}
            <label>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Calendar Year</span>
              <input
                type="number"
                min="2020"
                max="2035"
                value={payslipYear}
                onChange={(e) => setPayslipYear(Number(e.target.value))}
                disabled={busy}
              />
            </label>

            {/* Tax Regime */}
            <label>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Income Tax Regime</span>
              <select
                value={payslipRegime}
                onChange={(e) => setPayslipRegime(e.target.value)}
                disabled={busy}
              >
                <option value="new">New Regime (Default / FY 25-26)</option>
                <option value="old">Old Regime (80C / 80D Deductions)</option>
              </select>
            </label>
          </div>

          <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={payslipMetro}
                onChange={(e) => setPayslipMetro(e.target.checked)}
                disabled={busy}
              />
              <span>Metro city location (50% HRA allocation instead of 40%)</span>
            </label>
          </div>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={handlePreviewPayslip}
              disabled={busy || (isPrivileged ? !payslipEmpId : false)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>👁️</span> {busy ? "Rendering..." : "Preview Payslip (PDF)"}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleDownloadPayslip}
              disabled={busy || (isPrivileged ? !payslipEmpId : false)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>⬇️</span> {busy ? "Downloading..." : "Download Official PDF Payslip"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEE DIRECTORY REPORT */}
      {activeTab === "directory" && (
        <div className="card" style={{ padding: "24px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem" }}>
                👥 Employee Directory &amp; Headcount Report
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                Comprehensive organizational roster formatted for executive review and HR printing.
                Includes headcount metrics, active/inactive distribution, and compensation totals.
              </p>
            </div>
            <span className="badge" style={{ background: "#f0fdf4", color: "#16a34a", fontWeight: 600 }}>
              Landscape A4 • Multi-Column HR Layout
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "16px", marginTop: "16px" }}>
            {/* Department Filter */}
            <label>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Filter by Department</span>
              <select
                value={dirDeptId}
                onChange={(e) => setDirDeptId(e.target.value)}
                disabled={busy}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.Dept_ID} value={d.Dept_ID}>
                    {d.Dept_Name}
                  </option>
                ))}
              </select>
            </label>

            {/* Status Filter */}
            <label>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Employment Status</span>
              <select
                value={dirStatus}
                onChange={(e) => setDirStatus(e.target.value)}
                disabled={busy}
              >
                <option value="active">Active Employees Only</option>
                {isPrivileged && <option value="inactive">Inactive / Deactivated Only</option>}
                <option value="all">All Records (Active + Inactive)</option>
              </select>
            </label>

            {/* Keyword Search */}
            <label>
              <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Search Keyword (Optional)</span>
              <input
                type="text"
                placeholder="Name, email, or Emp ID..."
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={handlePreviewDirectory}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>👁️</span> {busy ? "Rendering..." : "Preview Directory (PDF)"}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleDownloadDirectory}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>⬇️</span> {busy ? "Downloading..." : "Download Directory PDF"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: DEPARTMENT BUDGET STATEMENT */}
      {activeTab === "budget" && isPrivileged && (
        <div className="card" style={{ padding: "24px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem" }}>
                🏛️ Department Budget Utilization &amp; Expense Statement
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                Fiscal management statement breaking down department headcount, annual payroll expenditure,
                allocated budget limits, and budget consumption percentages.
              </p>
            </div>
            <span className="badge" style={{ background: "#fef3c7", color: "#b45309", fontWeight: 600 }}>
              Portrait A4 • Leadership Statement
            </span>
          </div>

          <div style={{
            marginTop: "16px",
            padding: "16px",
            background: "var(--bg)",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
            gap: "14px",
          }}>
            <div>
              <span className="small muted" style={{ display: "block" }}>Active Departments</span>
              <strong style={{ fontSize: "1.2rem", color: "var(--text)" }}>{departments.length}</strong>
            </div>
            <div>
              <span className="small muted" style={{ display: "block" }}>Active Staff Tracked</span>
              <strong style={{ fontSize: "1.2rem", color: "var(--primary)" }}>{employees.filter(e => e.is_active).length}</strong>
            </div>
            <div>
              <span className="small muted" style={{ display: "block" }}>Fiscal Year Cycle</span>
              <strong style={{ fontSize: "1.2rem", color: "var(--text)" }}>FY 2025–26</strong>
            </div>
            <div>
              <span className="small muted" style={{ display: "block" }}>Compliance Status</span>
              <span className="badge ok" style={{ fontSize: "0.85rem", marginTop: "2px" }}>Normal Audit</span>
            </div>
          </div>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={handlePreviewBudget}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>👁️</span> {busy ? "Rendering..." : "Preview Statement (PDF)"}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleDownloadBudget}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>⬇️</span> {busy ? "Downloading..." : "Download Budget Statement (PDF)"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: SALARY REVISION LETTER */}
      {activeTab === "revision" && (
        <div className="card" style={{ padding: "24px", background: "var(--surface)", borderRadius: "10px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px 0", fontSize: "1.25rem" }}>
                📜 Formal Salary Revision &amp; Compensation Audit Letter
              </h2>
              <p className="muted small" style={{ margin: 0 }}>
                Official corporate increment letter with letterhead, revised compensation breakdown,
                and complete chronological audit log of all historical salary changes.
              </p>
            </div>
            <span className="badge" style={{ background: "#fdf4ff", color: "#a21caf", fontWeight: 600 }}>
              Official Letterhead • Audit Trail
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "16px", marginTop: "16px" }}>
            {isPrivileged ? (
              <label>
                <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>
                  Select Employee {loadingData && "(Loading…)"}
                </span>
                <select
                  value={revisionEmpId}
                  onChange={(e) => setRevisionEmpId(e.target.value)}
                  disabled={busy || loadingData || employees.length === 0}
                >
                  {employees.length === 0 ? (
                    <option value="">{loadingData ? "Loading employee roster…" : "No employees available"}</option>
                  ) : (
                    employees.map((emp) => (
                      <option key={emp.Emp_ID} value={emp.Emp_ID}>
                        #{emp.Emp_ID} — {emp.F_Name} {emp.L_Name}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : (
              <div>
                <span className="small muted" style={{ display: "block", marginBottom: "4px" }}>Employee Account</span>
                <div style={{ padding: "8px 12px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)", fontWeight: 600 }}>
                  👤 {user?.username} (Self-Service)
                </div>
              </div>
            )}
          </div>

          <p className="muted small" style={{ marginTop: "14px" }}>
            💡 <em>Includes formal corporate salutation, reference code, new compensation structure,
            and an authentic chronological progression log from the salary history table.</em>
          </p>

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={handlePreviewRevision}
              disabled={busy || (isPrivileged ? !revisionEmpId : false)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>👁️</span> {busy ? "Rendering..." : "Preview Letter (PDF)"}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleDownloadRevision}
              disabled={busy || (isPrivileged ? !revisionEmpId : false)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>⬇️</span> {busy ? "Downloading..." : "Download Revision Letter (PDF)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
