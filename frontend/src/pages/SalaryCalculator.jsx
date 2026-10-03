import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatMoney } from "../format";
import Modal from "../components/Modal";

// Pre-defined quick presets (in Lakhs per Annum)
const SALARY_PRESETS = [
  { label: "₹3.6 LPA", value: 360000 },
  { label: "₹6.0 LPA", value: 600000 },
  { label: "₹9.0 LPA", value: 900000 },
  { label: "₹12.0 LPA", value: 1200000 },
  { label: "₹18.0 LPA", value: 1800000 },
  { label: "₹25.0 LPA", value: 2500000 },
  { label: "₹35.0 LPA", value: 3500000 },
];

export default function SalaryCalculator() {
  const { user } = useAuth();

  // Input states
  const [basis, setBasis] = useState("annual"); // "annual" | "monthly"
  const [amountInput, setAmountInput] = useState("600000");
  const [regime, setRegime] = useState("new"); // "new" | "old"
  const [isMetro, setIsMetro] = useState(true);
  const [pfCapped, setPfCapped] = useState(true);
  const [deductions80c, setDeductions80c] = useState("150000");
  const [deductions80d, setDeductions80d] = useState("25000");

  // View mode for tables
  const [breakdownView, setBreakdownView] = useState("monthly"); // "monthly" | "annual"

  // User profile salary state
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [profileMsg, setProfileMsg] = useState("");

  // Payslip simulation modal
  const [showPayslip, setShowPayslip] = useState(false);

  // Check if current user has an employee salary on file
  useEffect(() => {
    api
      .getMySalaryProfile()
      .then((data) => {
        if (data.matched) {
          setMyProfile(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleLoadMySalary = () => {
    if (myProfile && myProfile.salary) {
      setBasis("annual");
      setAmountInput(String(myProfile.salary));
      setProfileMsg(
        `Loaded your registered annual compensation: ${formatMoney(myProfile.salary)}`
      );
      setTimeout(() => setProfileMsg(""), 5000);
    } else {
      setLoadingProfile(true);
      api
        .getMySalaryProfile()
        .then((data) => {
          if (data.matched && data.salary) {
            setMyProfile(data);
            setBasis("annual");
            setAmountInput(String(data.salary));
            setProfileMsg(
              `Loaded your registered annual compensation: ${formatMoney(data.salary)}`
            );
          } else {
            setProfileMsg(
              "No registered employee salary was found matching your login. You can enter any custom salary below!"
            );
          }
        })
        .catch(() => {
          setProfileMsg("Could not fetch salary profile. You can enter any custom amount.");
        })
        .finally(() => {
          setLoadingProfile(false);
          setTimeout(() => setProfileMsg(""), 5000);
        });
    }
  };

  // Compute values client-side in real time
  const calculation = useMemo(() => {
    const rawVal = parseFloat(amountInput) || 0;
    const annualCTC = basis === "annual" ? rawVal : rawVal * 12;

    const monthlyGross = Math.max(0, Math.round((annualCTC / 12) * 100) / 100);
    const annualGross = Math.max(0, Math.round(annualCTC * 100) / 100);

    // Earnings breakdown
    const basicMonthly = Math.round(monthlyGross * 0.5 * 100) / 100;
    const hraRate = isMetro ? 0.5 : 0.4;
    let hraMonthly = Math.round(basicMonthly * hraRate * 100) / 100;
    const conveyanceMonthly = monthlyGross >= 25000 ? 1600 : 0;
    const medicalMonthly = monthlyGross >= 25000 ? 1250 : 0;

    const fixed = basicMonthly + hraMonthly + conveyanceMonthly + medicalMonthly;
    let specialAllowanceMonthly = 0;
    if (fixed > monthlyGross) {
      specialAllowanceMonthly = 0;
      hraMonthly = Math.max(0, monthlyGross - basicMonthly);
    } else {
      specialAllowanceMonthly = Math.round((monthlyGross - fixed) * 100) / 100;
    }

    // Deductions: EPF
    const pfWage = pfCapped ? Math.min(basicMonthly, 15000) : basicMonthly;
    const epfEmployeeMonthly = Math.round(pfWage * 0.12 * 100) / 100;

    // Deductions: Professional Tax
    const ptMonthly = monthlyGross >= 15000 ? 200 : 0;

    // Deductions: ESI (0.75% if monthly gross <= 21000)
    const esiMonthly =
      monthlyGross > 0 && monthlyGross <= 21000
        ? Math.round(monthlyGross * 0.0075 * 100) / 100
        : 0;

    const annualEPF = epfEmployeeMonthly * 12;
    const annualPT = ptMonthly * 12;

    // --- Income Tax Calculations ---
    // 1. New Tax Regime (FY 2024-25 / 2025-26)
    const newStdDeduction = 75000;
    const newTaxable = Math.max(0, annualGross - newStdDeduction);
    let newTax = 0;
    if (newTaxable <= 700000) {
      newTax = 0; // 87A rebate
    } else {
      let rem = newTaxable;
      if (rem > 1500000) {
        newTax += (rem - 1500000) * 0.3;
        rem = 1500000;
      }
      if (rem > 1200000) {
        newTax += (rem - 1200000) * 0.2;
        rem = 1200000;
      }
      if (rem > 1000000) {
        newTax += (rem - 1000000) * 0.15;
        rem = 1000000;
      }
      if (rem > 700000) {
        newTax += (rem - 700000) * 0.1;
        rem = 700000;
      }
      if (rem > 300000) {
        newTax += (rem - 300000) * 0.05;
      }
      // 4% Health & Education Cess
      newTax += newTax * 0.04;
    }
    newTax = Math.round(newTax);

    // 2. Old Tax Regime
    const oldStdDeduction = 50000;
    const d80c = Math.min(150000, Math.max(annualEPF, parseFloat(deductions80c) || 0));
    const d80d = Math.min(50000, Math.max(0, parseFloat(deductions80d) || 0));
    const oldExemptions = oldStdDeduction + d80c + d80d + annualPT;
    const oldTaxable = Math.max(0, annualGross - oldExemptions);

    let oldTax = 0;
    if (oldTaxable <= 500000) {
      oldTax = 0; // 87A rebate
    } else {
      let rem = oldTaxable;
      if (rem > 1000000) {
        oldTax += (rem - 1000000) * 0.3;
        rem = 1000000;
      }
      if (rem > 500000) {
        oldTax += (rem - 500000) * 0.2;
        rem = 500000;
      }
      if (rem > 250000) {
        oldTax += (rem - 250000) * 0.05;
      }
      oldTax += oldTax * 0.04;
    }
    oldTax = Math.round(oldTax);

    // Selected tax
    const activeAnnualTax = regime === "new" ? newTax : oldTax;
    const activeMonthlyTax = Math.round(activeAnnualTax / 12);

    const totalMonthlyDeductions = Math.round(
      (epfEmployeeMonthly + ptMonthly + esiMonthly + activeMonthlyTax) * 100
    ) / 100;
    const netTakeHomeMonthly = Math.max(
      0,
      Math.round((monthlyGross - totalMonthlyDeductions) * 100) / 100
    );
    const netTakeHomeAnnual = Math.round(netTakeHomeMonthly * 12 * 100) / 100;

    return {
      annualCTC,
      monthlyGross,
      annualGross,
      earnings: {
        basic: basicMonthly,
        hra: hraMonthly,
        special: specialAllowanceMonthly,
        conveyance: conveyanceMonthly,
        medical: medicalMonthly,
        total: monthlyGross,
      },
      deductions: {
        epf: epfEmployeeMonthly,
        pt: ptMonthly,
        esi: esiMonthly,
        tax: activeMonthlyTax,
        total: totalMonthlyDeductions,
      },
      net: {
        monthly: netTakeHomeMonthly,
        annual: netTakeHomeAnnual,
      },
      tax: {
        activeAnnual: activeAnnualTax,
        activeMonthly: activeMonthlyTax,
        newTax,
        oldTax,
        savings: Math.abs(oldTax - newTax),
        recommended: newTax < oldTax ? "new" : oldTax < newTax ? "old" : "same",
      },
    };
  }, [amountInput, basis, regime, isMetro, pfCapped, deductions80c, deductions80d]);

  const mult = breakdownView === "annual" ? 12 : 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Salary & In-Hand Pay Calculator</h2>
          <p className="muted">
            Interactive payroll calculator for employees to estimate take-home pay, earnings
            components, statutory deductions, and tax under New vs. Old Tax Regimes.
          </p>
        </div>

        <div className="toolbar">
          <button
            type="button"
            className="btn secondary"
            onClick={handleLoadMySalary}
            disabled={loadingProfile}
            title="Load your registered compensation on file"
          >
            👤 {loadingProfile ? "Loading…" : "Load My Salary"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowPayslip(true)}
            title="Preview estimated monthly payslip"
          >
            📄 View Payslip Voucher
          </button>
        </div>
      </div>

      {profileMsg && <div className="alert info">{profileMsg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Input & Parameters Card */}
        <div className="card" style={{ padding: "22px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Calculation Basis:</span>
              <div className="segmented" style={{ margin: 0 }}>
                <label className={basis === "annual" ? "on" : ""}>
                  <input
                    type="radio"
                    name="basis"
                    checked={basis === "annual"}
                    onChange={() => {
                      if (basis !== "annual") {
                        setBasis("annual");
                        const val = parseFloat(amountInput) || 0;
                        setAmountInput(String(Math.round(val * 12)));
                      }
                    }}
                  />
                  Annual CTC
                </label>
                <label className={basis === "monthly" ? "on" : ""}>
                  <input
                    type="radio"
                    name="basis"
                    checked={basis === "monthly"}
                    onChange={() => {
                      if (basis !== "monthly") {
                        setBasis("monthly");
                        const val = parseFloat(amountInput) || 0;
                        setAmountInput(String(Math.round(val / 12)));
                      }
                    }}
                  />
                  Monthly Gross
                </label>
              </div>
            </div>

            {/* Quick LPA Presets */}
            {basis === "annual" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {SALARY_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`btn small ${
                      Number(amountInput) === p.value ? "primary" : "secondary"
                    }`}
                    onClick={() => setAmountInput(String(p.value))}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount Input & Slider */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
                marginBottom: "10px",
              }}
            >
              <div style={{ flex: "1 1 260px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "4px" }}>
                  {basis === "annual" ? "Annual CTC Amount (₹)" : "Monthly Gross Salary (₹)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--primary)",
                    padding: "10px 14px",
                    width: "100%",
                  }}
                />
              </div>
              <div style={{ alignSelf: "flex-end", paddingBottom: "6px" }}>
                <span className="muted" style={{ fontSize: "1rem" }}>
                  = <strong>{formatMoney(calculation.monthlyGross)}</strong> / month (
                  <strong>{formatMoney(calculation.annualGross)}</strong> / year)
                </span>
              </div>
            </div>

            {basis === "annual" && (
              <input
                type="range"
                min="100000"
                max="5000000"
                step="25000"
                value={Number(amountInput) || 100000}
                onChange={(e) => setAmountInput(e.target.value)}
                style={{ width: "100%", cursor: "pointer" }}
              />
            )}
          </div>

          {/* Options Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              paddingTop: "14px",
              borderTop: "1px dashed var(--border)",
            }}
          >
            <div>
              <span className="small muted" style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                Income Tax Regime
              </span>
              <div className="segmented">
                <label className={regime === "new" ? "on" : ""}>
                  <input
                    type="radio"
                    name="regime"
                    checked={regime === "new"}
                    onChange={() => setRegime("new")}
                  />
                  New Regime (FY 24-25)
                </label>
                <label className={regime === "old" ? "on" : ""}>
                  <input
                    type="radio"
                    name="regime"
                    checked={regime === "old"}
                    onChange={() => setRegime("old")}
                  />
                  Old Regime
                </label>
              </div>
            </div>

            <div>
              <span className="small muted" style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                City Type (HRA Rate)
              </span>
              <div className="segmented">
                <label className={isMetro ? "on" : ""}>
                  <input
                    type="radio"
                    name="city"
                    checked={isMetro}
                    onChange={() => setIsMetro(true)}
                  />
                  Metro (50% HRA)
                </label>
                <label className={!isMetro ? "on" : ""}>
                  <input
                    type="radio"
                    name="city"
                    checked={!isMetro}
                    onChange={() => setIsMetro(false)}
                  />
                  Non-Metro (40%)
                </label>
              </div>
            </div>

            <div>
              <span className="small muted" style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
                EPF Contribution Limit
              </span>
              <div className="segmented">
                <label className={pfCapped ? "on" : ""}>
                  <input
                    type="radio"
                    name="pf"
                    checked={pfCapped}
                    onChange={() => setPfCapped(true)}
                  />
                  Capped (₹1,800/mo)
                </label>
                <label className={!pfCapped ? "on" : ""}>
                  <input
                    type="radio"
                    name="pf"
                    checked={!pfCapped}
                    onChange={() => setPfCapped(false)}
                  />
                  Full (12% of Basic)
                </label>
              </div>
            </div>
          </div>

          {/* Old Regime Extra Deductions Inputs */}
          {regime === "old" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                marginTop: "16px",
                paddingTop: "14px",
                borderTop: "1px dashed var(--border)",
                background: "var(--surface-alt)",
                padding: "14px",
                borderRadius: "8px",
              }}
            >
              <label>
                Section 80C Deductions (Max ₹1.5L)
                <input
                  type="number"
                  min="0"
                  max="150000"
                  step="5000"
                  value={deductions80c}
                  onChange={(e) => setDeductions80c(e.target.value)}
                  placeholder="PPF, EPF, ELSS, Insurance"
                />
              </label>

              <label>
                Section 80D Health Insurance (Max ₹50k)
                <input
                  type="number"
                  min="0"
                  max="50000"
                  step="2500"
                  value={deductions80d}
                  onChange={(e) => setDeductions80d(e.target.value)}
                  placeholder="Self & Parents Health Insurance"
                />
              </label>
            </div>
          )}
        </div>

        {/* KPI Hero Result Cards */}
        <div className="analytics-kpi-grid">
          <div className="kpi-card" style={{ borderLeft: "4px solid var(--ok)" }}>
            <div className="kpi-icon" style={{ background: "rgba(43, 138, 62, 0.15)", color: "var(--ok)" }}>
              💵
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Estimated Monthly In-Hand</span>
              <span className="kpi-value" style={{ color: "var(--ok)", fontSize: "1.6rem" }}>
                {formatMoney(calculation.net.monthly)}
              </span>
              <span className="kpi-sub">Net take-home cash per month</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "rgba(59, 91, 219, 0.15)", color: "var(--primary)" }}>
              💼
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Gross Monthly Pay</span>
              <span className="kpi-value">{formatMoney(calculation.monthlyGross)}</span>
              <span className="kpi-sub">Total earnings before deductions</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "rgba(214, 51, 108, 0.15)", color: "var(--danger)" }}>
              📉
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Total Monthly Deductions</span>
              <span className="kpi-value" style={{ color: "var(--danger)" }}>
                {formatMoney(calculation.deductions.total)}
              </span>
              <span className="kpi-sub">EPF + PT + ESI + Estimated TDS</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: "rgba(245, 159, 0, 0.15)", color: "#f59f00" }}>
              🏦
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Annual In-Hand Pay</span>
              <span className="kpi-value">{formatMoney(calculation.net.annual)}</span>
              <span className="kpi-sub">Net take-home across 12 months</span>
            </div>
          </div>
        </div>

        {/* Tax Regime Comparison Card */}
        <div
          className="card"
          style={{
            padding: "18px 22px",
            background:
              calculation.tax.recommended === "new"
                ? "rgba(59, 91, 219, 0.05)"
                : "rgba(43, 138, 62, 0.05)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: "1rem" }}>⚖️ Tax Regime Analysis</h4>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Comparison of tax liabilities under New Regime (FY 2024-25) vs. Old Regime:
              </p>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div>
                <span className="small muted">New Regime Tax:</span>{" "}
                <strong>{formatMoney(calculation.tax.newTax)}</strong>/yr
              </div>
              <div style={{ borderLeft: "1px solid var(--border)", height: "24px" }} />
              <div>
                <span className="small muted">Old Regime Tax:</span>{" "}
                <strong>{formatMoney(calculation.tax.oldTax)}</strong>/yr
              </div>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            {calculation.tax.recommended === "new" && (
              <span className="badge role-user" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                ✨ New Tax Regime saves you <strong>{formatMoney(calculation.tax.savings)}</strong>{" "}
                more per year!
              </span>
            )}
            {calculation.tax.recommended === "old" && (
              <span className="badge ok" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                ✨ Old Tax Regime saves you <strong>{formatMoney(calculation.tax.savings)}</strong>{" "}
                more with your 80C/80D investments!
              </span>
            )}
            {calculation.tax.recommended === "same" && (
              <span className="badge" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                Tax liability is identical in both regimes (₹0 tax payable).
              </span>
            )}
          </div>
        </div>

        {/* Detailed Dual-Column Breakdown */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <h3 style={{ margin: 0 }}>Detailed Salary Breakdown</h3>
            <div className="segmented">
              <label className={breakdownView === "monthly" ? "on" : ""}>
                <input
                  type="radio"
                  name="view"
                  checked={breakdownView === "monthly"}
                  onChange={() => setBreakdownView("monthly")}
                />
                Monthly View
              </label>
              <label className={breakdownView === "annual" ? "on" : ""}>
                <input
                  type="radio"
                  name="view"
                  checked={breakdownView === "annual"}
                  onChange={() => setBreakdownView("annual")}
                />
                Annual View
              </label>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {/* Earnings Column */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "var(--surface-alt)",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  fontWeight: 700,
                  color: "var(--text-heading)",
                }}
              >
                Earnings (A)
              </div>
              <table style={{ margin: 0 }}>
                <tbody>
                  <tr>
                    <td>Basic Pay (50%)</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.earnings.basic * mult)}
                    </td>
                  </tr>
                  <tr>
                    <td>House Rent Allowance (HRA)</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.earnings.hra * mult)}
                    </td>
                  </tr>
                  <tr>
                    <td>Special Allowance</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.earnings.special * mult)}
                    </td>
                  </tr>
                  <tr>
                    <td>Conveyance Allowance</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.earnings.conveyance * mult)}
                    </td>
                  </tr>
                  <tr>
                    <td>Medical Allowance</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.earnings.medical * mult)}
                    </td>
                  </tr>
                  <tr style={{ background: "var(--surface-alt)", fontWeight: 700 }}>
                    <td>Total Gross Earnings</td>
                    <td className="num" style={{ color: "var(--primary)" }}>
                      {formatMoney(calculation.earnings.total * mult)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions Column */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "var(--surface-alt)",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border)",
                  fontWeight: 700,
                  color: "var(--danger)",
                }}
              >
                Deductions (B)
              </div>
              <table style={{ margin: 0 }}>
                <tbody>
                  <tr>
                    <td>Employee Provident Fund (EPF 12%)</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.deductions.epf * mult)}
                    </td>
                  </tr>
                  <tr>
                    <td>Professional Tax (PT)</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.deductions.pt * mult)}
                    </td>
                  </tr>
                  <tr>
                    <td>Employee State Insurance (ESI 0.75%)</td>
                    <td className="num font-mono">
                      {calculation.deductions.esi > 0
                        ? formatMoney(calculation.deductions.esi * mult)
                        : "Exempt (Gross > ₹21k)"}
                    </td>
                  </tr>
                  <tr>
                    <td>Estimated Income Tax (TDS)</td>
                    <td className="num font-mono">
                      {formatMoney(calculation.deductions.tax * mult)}
                    </td>
                  </tr>
                  <tr style={{ background: "var(--surface-alt)", fontWeight: 700 }}>
                    <td>Total Deductions</td>
                    <td className="num" style={{ color: "var(--danger)" }}>
                      {formatMoney(calculation.deductions.total * mult)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Take-Home Summary Row */}
          <div
            style={{
              marginTop: "20px",
              padding: "16px 20px",
              borderRadius: "8px",
              background: "var(--ok-bg)",
              border: "1px solid var(--ok-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <strong style={{ fontSize: "1.1rem", color: "var(--ok-text)" }}>
                Net Take-Home Pay (A − B):
              </strong>
              <div className="small muted">
                In-hand cash credited to employee's bank account
              </div>
            </div>
            <div style={{ fontSize: "1.45rem", fontWeight: 700, color: "var(--ok-text)" }}>
              {formatMoney(
                breakdownView === "monthly"
                  ? calculation.net.monthly
                  : calculation.net.annual
              )}{" "}
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                / {breakdownView === "monthly" ? "month" : "year"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Payslip Voucher Modal */}
      {showPayslip && (
        <Modal title="Estimated Monthly Payslip Simulation" onClose={() => setShowPayslip(false)}>
          <div
            id="payslip-voucher"
            style={{
              padding: "16px",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: "0.9rem",
            }}
          >
            <div
              style={{
                borderBottom: "2px solid var(--border)",
                paddingBottom: "14px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "var(--primary)" }}>StaffPortal Corp.</h3>
                <div className="small muted">Company Payroll Department</div>
                <div className="small muted">Employee Compensation Slip</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="badge role-user">Simulation</span>
                <div className="small muted" style={{ marginTop: "4px" }}>
                  Pay Period: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "16px",
                fontSize: "0.85rem",
              }}
            >
              <div>
                <span className="muted">Employee Name:</span>{" "}
                <strong>{myProfile?.name || user.username}</strong>
              </div>
              <div>
                <span className="muted">Role / Position:</span> <strong>{user.role}</strong>
              </div>
              <div>
                <span className="muted">Selected Tax Regime:</span>{" "}
                <strong>{regime === "new" ? "New Tax Regime" : "Old Tax Regime"}</strong>
              </div>
              <div>
                <span className="muted">PF Limit:</span>{" "}
                <strong>{pfCapped ? "Capped (₹1,800)" : "Uncapped (12%)"}</strong>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                borderTop: "1px solid var(--border)",
                paddingTop: "12px",
              }}
            >
              <div>
                <strong style={{ color: "var(--text-heading)", display: "block", marginBottom: "8px" }}>
                  Earnings
                </strong>
                <table style={{ width: "100%", fontSize: "0.85rem" }}>
                  <tbody>
                    <tr>
                      <td>Basic Pay</td>
                      <td className="num">{formatMoney(calculation.earnings.basic)}</td>
                    </tr>
                    <tr>
                      <td>HRA</td>
                      <td className="num">{formatMoney(calculation.earnings.hra)}</td>
                    </tr>
                    <tr>
                      <td>Special Allowance</td>
                      <td className="num">{formatMoney(calculation.earnings.special)}</td>
                    </tr>
                    <tr>
                      <td>Conveyance</td>
                      <td className="num">{formatMoney(calculation.earnings.conveyance)}</td>
                    </tr>
                    <tr>
                      <td>Medical Allowance</td>
                      <td className="num">{formatMoney(calculation.earnings.medical)}</td>
                    </tr>
                    <tr style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>
                      <td>Gross Earnings</td>
                      <td className="num">{formatMoney(calculation.earnings.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <strong style={{ color: "var(--danger)", display: "block", marginBottom: "8px" }}>
                  Deductions
                </strong>
                <table style={{ width: "100%", fontSize: "0.85rem" }}>
                  <tbody>
                    <tr>
                      <td>EPF (12%)</td>
                      <td className="num">{formatMoney(calculation.deductions.epf)}</td>
                    </tr>
                    <tr>
                      <td>Professional Tax</td>
                      <td className="num">{formatMoney(calculation.deductions.pt)}</td>
                    </tr>
                    <tr>
                      <td>ESI</td>
                      <td className="num">
                        {calculation.deductions.esi > 0
                          ? formatMoney(calculation.deductions.esi)
                          : "₹0.00"}
                      </td>
                    </tr>
                    <tr>
                      <td>TDS (Income Tax)</td>
                      <td className="num">{formatMoney(calculation.deductions.tax)}</td>
                    </tr>
                    <tr style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>
                      <td>Total Deductions</td>
                      <td className="num">{formatMoney(calculation.deductions.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                background: "var(--surface-alt)",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong style={{ fontSize: "1rem" }}>Net Amount Credited:</strong>
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ok)" }}>
                {formatMoney(calculation.net.monthly)}
              </div>
            </div>

            <p className="small muted" style={{ marginTop: "14px", textAlign: "center" }}>
              * This is a computerized simulation for estimation purposes based on the latest Indian
              tax & payroll guidelines.
            </p>

            <div className="actions" style={{ marginTop: "14px" }}>
              <button type="button" className="btn ghost" onClick={() => window.print()}>
                🖨️ Print Payslip
              </button>
              <button type="button" className="btn primary" onClick={() => setShowPayslip(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
