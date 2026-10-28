import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { isPrivileged, useAuth } from "../auth";
import Modal from "../components/Modal";

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "00h 00m 00s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatTimeString(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const privileged = isPrivileged(user?.role); // manager or admin

  // Active Top Navigation Tab
  const [activeTab, setActiveTab] = useState("punch"); // "punch" | "team_live" | "roster" | "approvals"

  // Live Clock & Time State
  const [nowTime, setNowTime] = useState(new Date());

  // Today's Status State
  const [todayStatus, setTodayStatus] = useState(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [workMode, setWorkMode] = useState("office");
  const [punchNote, setPunchNote] = useState("");
  const [breakType, setBreakType] = useState("lunch");
  const [showBreakOptions, setShowBreakOptions] = useState(false);

  // Month & Year Filter for Timesheet
  const [filterMonth, setFilterMonth] = useState(() => new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear());
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Manager/Admin Live Presence & Roster State
  const [liveRoster, setLiveRoster] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [rosterDeptFilter, setRosterDeptFilter] = useState("");
  const [rosterStatusFilter, setRosterStatusFilter] = useState("all");
  const [departments, setDepartments] = useState([]);

  // Regularization Requests
  const [myRequests, setMyRequests] = useState([]);
  const [pendingReqs, setPendingReqs] = useState([]);
  const [reqModal, setReqModal] = useState(null); // null or { date, clock_in, clock_out }
  const [reqDate, setReqDate] = useState("");
  const [reqInTime, setReqInTime] = useState("09:30");
  const [reqOutTime, setReqOutTime] = useState("18:00");
  const [reqReason, setReqReason] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);

  // Admin Manual Adjustment Modal
  const [manualModal, setManualModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualIn, setManualIn] = useState("09:30");
  const [manualOut, setManualOut] = useState("18:00");
  const [manualStatus, setManualStatus] = useState("present");
  const [manualMode, setManualMode] = useState("office");
  const [manualNotes, setManualNotes] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Feedback notifications
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // 1. Ticking live second clock
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Load company departments for filters
  useEffect(() => {
    api
      .listDepartments()
      .then((data) => setDepartments(data.departments || []))
      .catch(() => {});
  }, []);

  // 3. Load today's live status
  const loadTodayStatus = async () => {
    try {
      const res = await api.getAttendanceToday();
      setTodayStatus(res);
      if (res?.work_mode) setWorkMode(res.work_mode);
    } catch (err) {
      // Unlinked account or network error
    }
  };

  useEffect(() => {
    loadTodayStatus();
  }, []);

  // 4. Load Monthly History & Summary
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const firstDay = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
      const lastDayDate = new Date(filterYear, filterMonth, 0);
      const lastDay = `${filterYear}-${String(filterMonth).padStart(2, "0")}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

      const [histData, sumData] = await Promise.all([
        api.getMyAttendanceHistory({ fromDate: firstDay, toDate: lastDay }),
        api.getMyAttendanceSummary({ month: filterMonth, year: filterYear }),
      ]);
      setHistory(histData || []);
      setSummary(sumData || null);
    } catch (err) {
      setError(err.message || "Failed to load timesheet history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [filterMonth, filterYear]);

  // 5. Load Regularization Requests
  const loadRequests = async () => {
    try {
      const res = await api.getMyRegularizationRequests();
      setMyRequests(res || []);
      if (privileged) {
        const pending = await api.getPendingRegularizations();
        setPendingReqs(pending || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadRequests();
  }, [privileged]);

  // 6. Load Live Team Roster (Managers & Admins)
  const loadLiveTeam = async () => {
    if (!privileged) return;
    setLiveLoading(true);
    try {
      const data = await api.getTeamLiveAttendance({
        deptId: rosterDeptFilter ? Number(rosterDeptFilter) : undefined,
        status: rosterStatusFilter !== "all" ? rosterStatusFilter : undefined,
      });
      setLiveRoster(data);
    } catch (err) {
      setError(err.message || "Failed to load team live attendance.");
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "team_live" || activeTab === "roster") {
      loadLiveTeam();
    }
  }, [activeTab, rosterDeptFilter, rosterStatusFilter]);

  // =========================================================================
  // Punch Actions Handlers
  // =========================================================================

  const handleClockIn = async () => {
    setPunchLoading(true);
    setError("");
    setNotice("");
    try {
      await api.clockIn(workMode, punchNote.trim() || undefined);
      setNotice("Clocked in successfully. Have a productive shift!");
      setPunchNote("");
      await loadTodayStatus();
      await loadHistory();
    } catch (err) {
      setError(err.message || "Failed to clock in.");
    } finally {
      setPunchLoading(false);
    }
  };

  const handleClockOut = async () => {
    const confirmOut = window.confirm("Are you sure you want to clock out and end your shift for today?");
    if (!confirmOut) return;

    setPunchLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await api.clockOut(punchNote.trim() || undefined);
      setNotice(`Clocked out successfully. Total shift duration: ${res.total_hours} hrs.`);
      setPunchNote("");
      await loadTodayStatus();
      await loadHistory();
    } catch (err) {
      setError(err.message || "Failed to clock out.");
    } finally {
      setPunchLoading(false);
    }
  };

  const handleStartBreak = async (type = "lunch") => {
    setPunchLoading(true);
    setError("");
    setNotice("");
    try {
      await api.startBreak(type);
      setShowBreakOptions(false);
      setNotice(`Started ${type} break. Relax and recharge!`);
      await loadTodayStatus();
    } catch (err) {
      setError(err.message || "Failed to start break.");
    } finally {
      setPunchLoading(false);
    }
  };

  const handleEndBreak = async () => {
    setPunchLoading(true);
    setError("");
    setNotice("");
    try {
      await api.endBreak();
      setNotice("Break ended. Welcome back to work!");
      await loadTodayStatus();
    } catch (err) {
      setError(err.message || "Failed to end break.");
    } finally {
      setPunchLoading(false);
    }
  };

  // =========================================================================
  // Regularization Actions
  // =========================================================================

  const handleOpenRegularize = (item = null) => {
    if (item) {
      setReqDate(item.attendance_date);
      setReqInTime(item.clock_in ? item.clock_in.slice(11, 16) : "09:30");
      setReqOutTime(item.clock_out ? item.clock_out.slice(11, 16) : "18:00");
    } else {
      setReqDate(new Date().toISOString().slice(0, 10));
      setReqInTime("09:30");
      setReqOutTime("18:00");
    }
    setReqReason("");
    setReqModal(true);
  };

  const handleSubmitRegularization = async (e) => {
    e.preventDefault();
    if (!reqDate || !reqInTime || !reqReason.trim()) {
      setError("Please fill in the date, clock-in time, and explanation.");
      return;
    }

    setReqSubmitting(true);
    setError("");
    try {
      const requestedIn = `${reqDate}T${reqInTime}:00`;
      const requestedOut = reqOutTime ? `${reqDate}T${reqOutTime}:00` : null;

      await api.submitAttendanceRegularization({
        attendance_date: reqDate,
        requested_clock_in: requestedIn,
        requested_clock_out: requestedOut,
        reason: reqReason.trim(),
      });
      setNotice("Regularization request submitted for manager review.");
      setReqModal(false);
      await loadRequests();
    } catch (err) {
      setError(err.message || "Failed to submit regularization request.");
    } finally {
      setReqSubmitting(false);
    }
  };

  const handleReviewRegularization = async (reqId, statusDecision) => {
    const promptMsg = statusDecision === "rejected" ? "Optional review note / reason for rejection:" : "Approval note (optional):";
    const note = window.prompt(promptMsg, "");
    if (note === null) return; // User cancelled prompt

    try {
      await api.reviewRegularization(reqId, statusDecision, note.trim() || undefined);
      setNotice(`Request #${reqId} ${statusDecision} successfully.`);
      await loadRequests();
      await loadTodayStatus();
      if (activeTab === "team_live" || activeTab === "roster") loadLiveTeam();
    } catch (err) {
      setError(err.message || "Failed to review regularization request.");
    }
  };

  // =========================================================================
  // Admin Manual Adjustment
  // =========================================================================

  const handleSaveManualAttendance = async (e) => {
    e.preventDefault();
    if (!manualEmpId || !manualDate) {
      setError("Please specify employee ID and date.");
      return;
    }

    setManualSubmitting(true);
    setError("");
    try {
      const inTime = manualIn ? `${manualDate}T${manualIn}:00` : null;
      const outTime = manualOut ? `${manualDate}T${manualOut}:00` : null;

      await api.createManualAttendance({
        emp_id: Number(manualEmpId),
        attendance_date: manualDate,
        clock_in: inTime,
        clock_out: outTime,
        status: manualStatus,
        work_mode: manualMode,
        notes: manualNotes.trim() || undefined,
      });

      setNotice("Manual attendance entry applied successfully.");
      setManualModal(false);
      if (activeTab === "team_live" || activeTab === "roster") loadLiveTeam();
    } catch (err) {
      setError(err.message || "Failed to save manual attendance entry.");
    } finally {
      setManualSubmitting(false);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear((y) => y - 1);
    } else {
      setFilterMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (filterMonth === 12) {
      setFilterMonth(1);
      setFilterYear((y) => y + 1);
    } else {
      setFilterMonth((m) => m + 1);
    }
  };

  const monthName = new Date(filterYear, filterMonth - 1, 1).toLocaleString("en-US", { month: "long" });

  return (
    <div className="attendance-page-container">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>⏱️</span> Attendance & Time Tracking
          </h2>
          <p className="muted">
            Live workday punch terminal, punctuality logs, and monthly timesheet statements.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="toolbar">
          <button
            type="button"
            className="btn ghost"
            onClick={() => handleOpenRegularize()}
            title="Request attendance regularization for missed or disputed punches"
          >
            ✍️ Request Regularization
          </button>

          {isAdmin && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setManualDate(new Date().toISOString().slice(0, 10));
                setManualModal(true);
              }}
              title="Admin direct manual punch adjustment"
            >
              🛠️ Manual Adjustment
            </button>
          )}

          <a
            href={api.getAttendanceCsvUrl({ month: filterMonth, year: filterYear })}
            download={`attendance_${filterYear}_${filterMonth}.csv`}
            className="btn ghost"
            title="Export attendance records to CSV spreadsheet"
          >
            📤 Export CSV
          </a>

          <a
            href={api.getAttendancePdfUrl({ month: filterMonth, year: filterYear, inline: true })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn primary"
            title="Download formal corporate PDF timesheet report"
          >
            📑 Export PDF
          </a>
        </div>
      </div>

      {/* Global Alerts */}
      {notice && (
        <div className="alert success" onClick={() => setNotice("")} style={{ cursor: "pointer" }}>
          {notice} <span className="dismiss">✕</span>
        </div>
      )}
      {error && (
        <div className="alert error" onClick={() => setError("")} style={{ cursor: "pointer" }}>
          {error} <span className="dismiss">✕</span>
        </div>
      )}

      {/* Top Segmented Tab Navigation Bar */}
      <div className="attendance-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "punch"}
          className={`attendance-tab-btn ${activeTab === "punch" ? "active" : ""}`}
          onClick={() => setActiveTab("punch")}
        >
          <span>🕒</span> My Punch & Timesheet
        </button>

        {privileged && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "team_live"}
            className={`attendance-tab-btn ${activeTab === "team_live" ? "active" : ""}`}
            onClick={() => setActiveTab("team_live")}
          >
            <span>🟢</span> Team Live Ticker
          </button>
        )}

        {privileged && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "roster"}
            className={`attendance-tab-btn ${activeTab === "roster" ? "active" : ""}`}
            onClick={() => setActiveTab("roster")}
          >
            <span>📋</span> Company Roster
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "approvals"}
          className={`attendance-tab-btn ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => setActiveTab("approvals")}
        >
          <span>✍️</span> Regularizations
          {pendingReqs.length > 0 && privileged && (
            <span className="badge role-admin" style={{ marginLeft: "6px", fontSize: "0.72rem" }}>
              {pendingReqs.length}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE PUNCH TERMINAL & PERSONAL TIMESHEET
         ========================================================================= */}
      {activeTab === "punch" && (
        <div className="attendance-dashboard-layout">
          {/* Hero Live Punch Terminal Card */}
          <div className="card attendance-hero-punch-card">
            <div className="punch-card-header">
              <div className="punch-clock-display">
                <span className="punch-clock-time">
                  {nowTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="punch-clock-date">
                  {nowTime.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>

              {/* Status Badge */}
              <div className="punch-status-badge-wrap">
                {todayStatus?.is_on_break ? (
                  <span className="badge warning punch-pulse-badge">
                    <span className="pulse-dot amber" /> On {todayStatus.current_break_type?.toUpperCase() || "BREAK"}
                  </span>
                ) : todayStatus?.is_clocked_in ? (
                  <span className="badge ok punch-pulse-badge">
                    <span className="pulse-dot green" /> SHIFT ACTIVE · WORKING
                  </span>
                ) : todayStatus?.is_clocked_out ? (
                  <span className="badge" style={{ background: "var(--code-bg)" }}>
                    🏁 SHIFT COMPLETED
                  </span>
                ) : (
                  <span className="badge" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                    ⚪ NOT CLOCKED IN
                  </span>
                )}
              </div>
            </div>

            {/* Active Working Timer / Stats Strip */}
            <div className="punch-timer-strip">
              <div className="punch-timer-stat">
                <span className="timer-stat-label">Clock-In Time</span>
                <strong className="timer-stat-value">{formatTimeString(todayStatus?.clock_in_time)}</strong>
              </div>

              <div className="punch-timer-stat">
                <span className="timer-stat-label">Active Working Time</span>
                <strong className="timer-stat-value primary-color">
                  {formatDuration(todayStatus?.active_duration_seconds)}
                </strong>
              </div>

              <div className="punch-timer-stat">
                <span className="timer-stat-label">Break Time Logged</span>
                <strong className="timer-stat-value">
                  {todayStatus?.total_break_minutes || 0} min
                </strong>
              </div>

              <div className="punch-timer-stat">
                <span className="timer-stat-label">Clock-Out Time</span>
                <strong className="timer-stat-value">{formatTimeString(todayStatus?.clock_out_time)}</strong>
              </div>
            </div>

            {/* Interactive Punch Action Controls */}
            <div className="punch-actions-row">
              {!todayStatus?.is_clocked_in && !todayStatus?.is_clocked_out ? (
                <div className="punch-action-block">
                  <div className="punch-options-bar">
                    <span className="small muted">Work Location:</span>
                    <label className="punch-mode-radio">
                      <input
                        type="radio"
                        name="workMode"
                        value="office"
                        checked={workMode === "office"}
                        onChange={() => setWorkMode("office")}
                      />
                      🏢 Office
                    </label>
                    <label className="punch-mode-radio">
                      <input
                        type="radio"
                        name="workMode"
                        value="remote"
                        checked={workMode === "remote"}
                        onChange={() => setWorkMode("remote")}
                      />
                      🏠 Remote / WFH
                    </label>
                  </div>

                  <button
                    type="button"
                    className="btn primary punch-main-btn"
                    onClick={handleClockIn}
                    disabled={punchLoading}
                  >
                    <span>🕒</span> Clock In Now
                  </button>
                </div>
              ) : todayStatus?.is_clocked_in ? (
                <div className="punch-action-block in-progress">
                  {todayStatus?.is_on_break ? (
                    <button
                      type="button"
                      className="btn primary punch-main-btn resume-btn"
                      onClick={handleEndBreak}
                      disabled={punchLoading}
                    >
                      <span>▶️</span> End Break & Resume Work
                    </button>
                  ) : (
                    <div className="punch-split-btns">
                      <div className="break-dropdown-container">
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => setShowBreakOptions((prev) => !prev)}
                          disabled={punchLoading}
                        >
                          <span>☕</span> Take a Break ▾
                        </button>
                        {showBreakOptions && (
                          <div className="break-popover-menu">
                            <button type="button" onClick={() => handleStartBreak("lunch")}>
                              🍱 Lunch Break
                            </button>
                            <button type="button" onClick={() => handleStartBreak("tea")}>
                              ☕ Tea / Coffee Break
                            </button>
                            <button type="button" onClick={() => handleStartBreak("personal")}>
                              🚶 Personal Errand
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn danger punch-out-btn"
                        onClick={handleClockOut}
                        disabled={punchLoading}
                      >
                        <span>🚪</span> Clock Out & Finish Shift
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="punch-action-block completed">
                  <span className="punch-completed-note">
                    ✨ You have completed your shift today ({todayStatus?.today_record?.total_hours || 0} hrs logged).
                  </span>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={handleClockIn}
                    disabled={punchLoading}
                    title="Need to resume or re-enter your shift?"
                  >
                    🔄 Re-Punch / Resume
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Attendance Summary Metrics */}
          {summary && (
            <div className="analytics-kpi-grid">
              <div className="kpi-card" style={{ borderLeft: "4px solid var(--ok)" }}>
                <div className="kpi-icon" style={{ background: "rgba(43, 138, 62, 0.15)", color: "var(--ok)" }}>
                  📅
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Present Days ({monthName})</span>
                  <span className="kpi-value" style={{ color: "var(--ok)" }}>
                    {summary.present_days} <span style={{ fontSize: "1rem", color: "var(--muted)" }}>/ {summary.working_days_so_far}</span>
                  </span>
                  <span className="kpi-sub">{summary.total_calendar_days} calendar days in month</span>
                </div>
              </div>

              <div className="kpi-card" style={{ borderLeft: "4px solid var(--primary)" }}>
                <div className="kpi-icon" style={{ background: "rgba(59, 91, 219, 0.15)", color: "var(--primary)" }}>
                  🎯
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">On-Time Arrival Rate</span>
                  <span className="kpi-value primary-color">{summary.on_time_rate_pct}%</span>
                  <span className="kpi-sub">{summary.late_days} late arrivals this month</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon" style={{ background: "rgba(124, 58, 237, 0.15)", color: "#7c3aed" }}>
                  ⏳
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Total Productive Hours</span>
                  <span className="kpi-value">{summary.total_work_hours} hrs</span>
                  <span className="kpi-sub">Avg {summary.avg_daily_hours} hrs / day</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon" style={{ background: "rgba(245, 159, 0, 0.15)", color: "#d97706" }}>
                  ⚡
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Overtime Hours</span>
                  <span className="kpi-value" style={{ color: "#d97706" }}>{summary.total_overtime_hours} hrs</span>
                  <span className="kpi-sub">{summary.half_days} half-day flags</span>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Timesheet Table */}
          <div className="card" style={{ padding: "20px" }}>
            <div className="timesheet-header-row">
              <div className="timesheet-title-block">
                <h3 style={{ margin: 0 }}>Timesheet Statement</h3>
                <span className="muted small">Daily check-in, check-out, and break duration breakdown</span>
              </div>

              {/* Month & Year Navigator */}
              <div className="month-navigator">
                <button type="button" className="btn small ghost" onClick={handlePrevMonth} title="Previous month">
                  ‹
                </button>
                <strong style={{ minWidth: "130px", textAlign: "center" }}>
                  {monthName} {filterYear}
                </strong>
                <button type="button" className="btn small ghost" onClick={handleNextMonth} title="Next month">
                  ›
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="table-wrap" style={{ marginTop: "14px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date & Day</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Breaks</th>
                    <th className="num">Net Hours</th>
                    <th className="num">Overtime</th>
                    <th>Punctuality</th>
                    <th className="right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan="10" className="center muted" style={{ padding: "30px" }}>
                        Loading timesheet records...
                      </td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="center muted" style={{ padding: "30px" }}>
                        No attendance records logged for {monthName} {filterYear}.
                      </td>
                    </tr>
                  ) : (
                    history.map((rec) => {
                      const isLate = rec.is_late;
                      return (
                        <tr key={rec.id}>
                          <td>
                            <strong>{formatDateDisplay(rec.attendance_date)}</strong>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                rec.status === "present" || rec.status === "wfh"
                                  ? "ok"
                                  : rec.status === "late"
                                  ? "role-manager"
                                  : rec.status === "half_day"
                                  ? "warning"
                                  : "off"
                              }`}
                            >
                              {rec.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textTransform: "capitalize" }}>{rec.work_mode}</td>
                          <td>{formatTimeString(rec.clock_in)}</td>
                          <td>{formatTimeString(rec.clock_out)}</td>
                          <td>
                            {rec.breaks?.length > 0 ? (
                              <span title={`${rec.breaks.length} breaks taken`}>
                                {rec.breaks.reduce((acc, b) => acc + (b.duration_minutes || 0), 0)} min ({rec.breaks.length})
                              </span>
                            ) : (
                              <span className="muted">0 min</span>
                            )}
                          </td>
                          <td className="num font-mono">
                            <strong>{rec.total_hours.toFixed(2)}h</strong>
                          </td>
                          <td className="num font-mono">
                            {rec.overtime_hours > 0 ? (
                              <span style={{ color: "var(--ok)", fontWeight: 600 }}>+{rec.overtime_hours.toFixed(2)}h</span>
                            ) : (
                              <span className="muted">0h</span>
                            )}
                          </td>
                          <td>
                            {isLate ? (
                              <span style={{ color: "var(--danger)", fontSize: "0.82rem", fontWeight: 600 }}>
                                ⚠️ Late ({rec.late_minutes}m)
                              </span>
                            ) : (
                              <span style={{ color: "var(--ok)", fontSize: "0.82rem" }}>✓ On Time</span>
                            )}
                          </td>
                          <td className="right">
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => handleOpenRegularize(rec)}
                              title="Request correction for this date"
                            >
                              Adjust
                            </button>
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

      {/* =========================================================================
          TAB 2: TEAM LIVE ATTENDANCE TICKER (MANAGERS & ADMINS)
         ========================================================================= */}
      {activeTab === "team_live" && privileged && (
        <div className="team-live-container">
          {/* Ticker Cards */}
          {liveRoster && (
            <div className="analytics-kpi-grid">
              <div className="kpi-card" style={{ borderLeft: "4px solid var(--primary)" }}>
                <div className="kpi-icon" style={{ background: "rgba(59, 91, 219, 0.15)", color: "var(--primary)" }}>
                  👥
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Active Team Roster</span>
                  <span className="kpi-value">{liveRoster.total_employees}</span>
                  <span className="kpi-sub">Registered employees</span>
                </div>
              </div>

              <div className="kpi-card" style={{ borderLeft: "4px solid var(--ok)" }}>
                <div className="kpi-icon" style={{ background: "rgba(43, 138, 62, 0.15)", color: "var(--ok)" }}>
                  🟢
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Currently Working</span>
                  <span className="kpi-value" style={{ color: "var(--ok)" }}>{liveRoster.currently_working}</span>
                  <span className="kpi-sub">Actively clocked in right now</span>
                </div>
              </div>

              <div className="kpi-card" style={{ borderLeft: "4px solid #f59f00" }}>
                <div className="kpi-icon" style={{ background: "rgba(245, 159, 0, 0.15)", color: "#d97706" }}>
                  ☕
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Currently On Break</span>
                  <span className="kpi-value" style={{ color: "#d97706" }}>{liveRoster.currently_on_break}</span>
                  <span className="kpi-sub">Lunch / Personal break</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon" style={{ background: "rgba(100, 116, 139, 0.15)", color: "var(--muted)" }}>
                  ⚪
                </div>
                <div className="kpi-content">
                  <span className="kpi-label">Not In Yet</span>
                  <span className="kpi-value">{liveRoster.not_in_yet}</span>
                  <span className="kpi-sub">No punch logged today</span>
                </div>
              </div>
            </div>
          )}

          {/* Live Roster Filter Bar */}
          <div className="card filter-card" style={{ marginTop: "16px" }}>
            <div className="filter-bar">
              <div className="filter-group">
                <span className="filter-label">🏛️ Department</span>
                <select
                  className="filter-select"
                  value={rosterDeptFilter}
                  onChange={(e) => setRosterDeptFilter(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.Dept_ID} value={d.Dept_ID}>
                      {d.Dept_Name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">⚡ Live Status</span>
                <select
                  className="filter-select"
                  value={rosterStatusFilter}
                  onChange={(e) => setRosterStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="working">Currently Working</option>
                  <option value="on_break">On Break</option>
                  <option value="clocked_out">Clocked Out</option>
                  <option value="not_in_yet">Not In Yet</option>
                </select>
              </div>

              <div className="filter-actions">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={loadLiveTeam}
                  disabled={liveLoading}
                >
                  🔄 Refresh Live Ticker
                </button>
              </div>
            </div>
          </div>

          {/* Members Live Presence Grid */}
          <div className="team-live-grid" style={{ marginTop: "16px" }}>
            {liveLoading ? (
              <p className="center-note">Updating live team roster...</p>
            ) : liveRoster?.members?.length === 0 ? (
              <p className="center-note">No employees match the selected criteria.</p>
            ) : (
              liveRoster?.members?.map((m) => {
                const isWorking = m.status === "working";
                const isOnBreak = m.status === "on_break";
                const isOut = m.status === "clocked_out";

                return (
                  <div key={m.emp_id} className={`team-live-card ${m.status}`}>
                    <div className="team-card-top">
                      <div className="team-card-avatar">
                        {m.employee_name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className="team-card-info">
                        <strong>{m.employee_name}</strong>
                        <span className="small muted">
                          #{m.emp_id} · {m.department_name}
                        </span>
                      </div>
                      <span
                        className={`badge ${
                          isWorking ? "ok" : isOnBreak ? "warning" : isOut ? "" : "off"
                        }`}
                      >
                        {isWorking ? "🟢 Working" : isOnBreak ? "☕ On Break" : isOut ? "🏁 Finished" : "⚪ Absent"}
                      </span>
                    </div>

                    <div className="team-card-stats">
                      <div className="small">
                        <span className="muted">Punch In: </span>
                        <strong>{formatTimeString(m.clock_in)}</strong>
                        {m.is_late && (
                          <span style={{ color: "var(--danger)", marginLeft: "4px" }} title={`${m.late_minutes}m late`}>
                            ⚠️
                          </span>
                        )}
                      </div>
                      {isWorking && (
                        <div className="small">
                          <span className="muted">Active: </span>
                          <strong className="primary-color">{formatDuration(m.active_duration_seconds)}</strong>
                        </div>
                      )}
                      {m.work_mode && (
                        <div className="small muted">
                          Mode: <span style={{ textTransform: "capitalize" }}>{m.work_mode}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: COMPANY-WIDE ATTENDANCE ROSTER (ADMIN & MANAGER)
         ========================================================================= */}
      {activeTab === "roster" && privileged && (
        <div className="company-roster-view">
          <div className="card table-wrap" style={{ padding: "20px" }}>
            <h3>Company Attendance Records</h3>
            <p className="muted small">Filterable historical workforce records</p>
            {/* Table can be queried with pagination, or quick export */}
            <div style={{ marginTop: "12px" }}>
              <p className="small muted">
                Use the toolbar buttons above to download formal CSV and corporate PDF reports for any period.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ATTENDANCE REGULARIZATIONS & APPROVALS
         ========================================================================= */}
      {activeTab === "approvals" && (
        <div className="regularizations-view">
          {privileged && pendingReqs.length > 0 && (
            <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚡</span> Pending Review Requests ({pendingReqs.length})
              </h3>
              <p className="muted small">Staff attendance adjustments requiring your verification</p>

              <div className="table-wrap" style={{ marginTop: "14px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Attendance Date</th>
                      <th>Requested Punch In</th>
                      <th>Requested Punch Out</th>
                      <th>Reason / Explanation</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReqs.map((req) => (
                      <tr key={req.id}>
                        <td>
                          <strong>{req.employee_name}</strong> (#{req.emp_id})
                        </td>
                        <td>{formatDateDisplay(req.attendance_date)}</td>
                        <td>{formatTimeString(req.requested_clock_in)}</td>
                        <td>{formatTimeString(req.requested_clock_out)}</td>
                        <td>{req.reason}</td>
                        <td className="right nowrap">
                          <button
                            type="button"
                            className="btn small primary"
                            style={{ marginRight: "6px" }}
                            onClick={() => handleReviewRegularization(req.id, "approved")}
                          >
                            ✓ Approve
                          </button>
                          <button
                            type="button"
                            className="btn small danger"
                            onClick={() => handleReviewRegularization(req.id, "rejected")}
                          >
                            ✕ Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* My Submitted Requests */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h3 style={{ margin: 0 }}>My Regularization Requests</h3>
                <span className="muted small">History of your missed punch adjustments</span>
              </div>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => handleOpenRegularize()}
              >
                + Submit New Request
              </button>
            </div>

            <div className="table-wrap" style={{ marginTop: "14px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Requested In</th>
                    <th>Requested Out</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Reviewed By</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="center muted" style={{ padding: "24px" }}>
                        No regularization requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    myRequests.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{formatDateDisplay(r.attendance_date)}</strong></td>
                        <td>{formatTimeString(r.requested_clock_in)}</td>
                        <td>{formatTimeString(r.requested_clock_out)}</td>
                        <td>{r.reason}</td>
                        <td>
                          <span className={`badge ${r.status === "approved" ? "ok" : r.status === "rejected" ? "off" : "warning"}`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td>{r.reviewed_by || "—"}</td>
                        <td>{r.review_notes || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SUBMIT REGULARIZATION REQUEST
         ========================================================================= */}
      {reqModal && (
        <Modal title="Attendance Regularization Request" onClose={() => setReqModal(false)}>
          <form onSubmit={handleSubmitRegularization} className="form-grid">
            <label className="span-2">
              Attendance Date *
              <input
                type="date"
                required
                value={reqDate}
                onChange={(e) => setReqDate(e.target.value)}
              />
            </label>

            <label>
              Requested Clock-In Time *
              <input
                type="time"
                required
                value={reqInTime}
                onChange={(e) => setReqInTime(e.target.value)}
              />
            </label>

            <label>
              Requested Clock-Out Time
              <input
                type="time"
                value={reqOutTime}
                onChange={(e) => setReqOutTime(e.target.value)}
              />
            </label>

            <label className="span-2">
              Reason / Explanation *
              <textarea
                required
                rows={3}
                placeholder="Explain the reason for punch correction (e.g., Client meeting offsite, badge scanner failure, VPN issue)..."
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text)",
                }}
              />
            </label>

            <div className="modal-actions span-2">
              <button type="button" className="btn ghost" onClick={() => setReqModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={reqSubmitting}>
                {reqSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =========================================================================
          MODAL: ADMIN MANUAL ADJUSTMENT
         ========================================================================= */}
      {manualModal && (
        <Modal title="Admin Manual Attendance Adjustment" onClose={() => setManualModal(false)}>
          <form onSubmit={handleSaveManualAttendance} className="form-grid">
            <label>
              Employee ID *
              <input
                type="number"
                required
                placeholder="e.g. 101"
                value={manualEmpId}
                onChange={(e) => setManualEmpId(e.target.value)}
              />
            </label>

            <label>
              Attendance Date *
              <input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </label>

            <label>
              Clock In Time
              <input
                type="time"
                value={manualIn}
                onChange={(e) => setManualIn(e.target.value)}
              />
            </label>

            <label>
              Clock Out Time
              <input
                type="time"
                value={manualOut}
                onChange={(e) => setManualOut(e.target.value)}
              />
            </label>

            <label>
              Attendance Status
              <select value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}>
                <option value="present">Present (Full Day)</option>
                <option value="late">Late Arrival</option>
                <option value="half_day">Half Day</option>
                <option value="wfh">Remote / WFH</option>
                <option value="on_leave">On Leave</option>
                <option value="holiday">Holiday</option>
                <option value="absent">Absent</option>
              </select>
            </label>

            <label>
              Work Mode
              <select value={manualMode} onChange={(e) => setManualMode(e.target.value)}>
                <option value="office">Office</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>

            <label className="span-2">
              Admin Adjustment Notes
              <input
                type="text"
                placeholder="Reason for manual adjustment..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
              />
            </label>

            <div className="modal-actions span-2">
              <button type="button" className="btn ghost" onClick={() => setManualModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={manualSubmitting}>
                {manualSubmitting ? "Saving..." : "Save Record"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

