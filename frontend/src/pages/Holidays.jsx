import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";

const HOLIDAY_TYPES = ["National", "Festival", "Company", "Optional"];
const PRIORITY_TYPES = [
  { value: "urgent", label: "🚨 Urgent", color: "var(--danger)" },
  { value: "important", label: "⭐ Important", color: "var(--badge-role-manager-text)" },
  { value: "general", label: "📢 General", color: "var(--primary)" },
  { value: "event", label: "🎉 Event / Celebration", color: "var(--ok)" },
];

export default function Holidays() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isManagerOrAdmin = user?.role === "manager" || user?.role === "admin";

  const [activeTab, setActiveTab] = useState("holidays"); // "holidays" | "announcements" | "calculator"

  // Holidays state
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [yearFilter, setYearFilter] = useState("2026");
  const [typeFilter, setTypeFilter] = useState("all");
  const [holidaySearch, setHolidaySearch] = useState("");
  const [holidayView, setHolidayView] = useState("grid"); // "grid" | "table"

  // Announcements state
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [announcementSearch, setAnnouncementSearch] = useState("");

  // Departments for targeting
  const [departments, setDepartments] = useState([]);

  // Modals state
  const [modal, setModal] = useState(null); // { type: "holiday"|"announcement", item: null|obj }
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: "holiday"|"announcement", item: obj }

  // Notifications
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Business Days Calculator state
  const [calcStart, setCalcStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [calcEnd, setCalcEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Load holidays
  const loadHolidays = async () => {
    setLoadingHolidays(true);
    try {
      const params = {};
      if (yearFilter && yearFilter !== "all") params.year = yearFilter;
      if (typeFilter && typeFilter !== "all") params.type = typeFilter;
      if (holidaySearch.trim()) params.search = holidaySearch.trim();

      const data = await api.listHolidays(params);
      setHolidays(data);
    } catch (err) {
      setError(err.message || "Failed to load holidays");
    } finally {
      setLoadingHolidays(false);
    }
  };

  // Load announcements
  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const params = {};
      if (priorityFilter && priorityFilter !== "all") params.priority = priorityFilter;
      if (announcementSearch.trim()) params.search = announcementSearch.trim();

      const data = await api.listAnnouncements(params);
      setAnnouncements(data);
    } catch (err) {
      setError(err.message || "Failed to load announcements");
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  // Load departments
  useEffect(() => {
    api
      .listDepartments()
      .then((res) => setDepartments(res.departments || []))
      .catch(() => {});
  }, []);

  // Trigger loads on filter change
  useEffect(() => {
    loadHolidays();
  }, [yearFilter, typeFilter, holidaySearch]);

  useEffect(() => {
    loadAnnouncements();
  }, [priorityFilter, announcementSearch]);

  // Compute next upcoming holiday
  const upcomingHoliday = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const future = holidays
      .filter((h) => h.holiday_date >= todayStr)
      .sort((a, b) => (a.holiday_date > b.holiday_date ? 1 : -1));
    return future[0] || null;
  }, [holidays]);

  // Handle calculator run
  const runCalculator = async () => {
    if (!calcStart || !calcEnd) return;
    if (calcEnd < calcStart) {
      setError("End date must be on or after start date");
      return;
    }
    setCalcLoading(true);
    setError("");
    try {
      const res = await api.calculateBusinessDays(calcStart, calcEnd);
      setCalcResult(res);
    } catch (err) {
      setError(err.message || "Calculation failed");
    } finally {
      setCalcLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "calculator") {
      runCalculator();
    }
  }, [activeTab]);

  // Auto-dismiss notice
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);

  // Seed default holidays
  const handleSeedDefaults = async () => {
    setError("");
    try {
      const res = await api.seedDefaultHolidays(Number(yearFilter) || 2026);
      setNotice(res.message);
      loadHolidays();
    } catch (err) {
      setError(err.message || "Failed to seed default holidays");
    }
  };

  // Delete handlers
  const executeDelete = async () => {
    if (!deleteConfirm) return;
    setError("");
    try {
      if (deleteConfirm.type === "holiday") {
        const res = await api.deleteHoliday(deleteConfirm.item.id);
        setNotice(res.message);
        loadHolidays();
      } else {
        const res = await api.deleteAnnouncement(deleteConfirm.item.id);
        setNotice(res.message);
        loadAnnouncements();
      }
      setDeleteConfirm(null);
    } catch (err) {
      setError(err.message || "Failed to delete");
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "1.6rem" }}>
            <span>📅</span>
            <span>Holidays & Announcements</span>
          </h1>
          <p className="muted" style={{ margin: "2px 0 0" }}>
            Corporate holiday schedules, company broadcasts, and working business days calculator.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {isAdmin && activeTab === "holidays" && (
            <>
              <button
                type="button"
                className="btn ghost small"
                onClick={handleSeedDefaults}
                title="Populate standard gazetted & corporate holidays for selected year"
              >
                🌱 Seed Default Holidays
              </button>
              <button
                type="button"
                className="btn primary small"
                onClick={() => setModal({ type: "holiday", item: null })}
              >
                ➕ Add Holiday
              </button>
            </>
          )}

          {isManagerOrAdmin && activeTab === "announcements" && (
            <button
              type="button"
              className="btn primary small"
              onClick={() => setModal({ type: "announcement", item: null })}
            >
              📢 New Announcement
            </button>
          )}
        </div>
      </div>

      {notice && <div className="alert success" onClick={() => setNotice("")}>{notice}</div>}
      {error && <div className="alert error" onClick={() => setError("")}>{error}</div>}

      {/* Featured Upcoming Holiday Spotlight Banner */}
      {upcomingHoliday && activeTab !== "calculator" && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(59, 91, 219, 0.12) 0%, rgba(76, 110, 245, 0.05) 100%)",
            border: "1px solid rgba(59, 91, 219, 0.25)",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "var(--primary)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "14px",
                lineHeight: 1.1,
                boxShadow: "0 2px 8px rgba(59, 91, 219, 0.35)",
              }}
            >
              <span>{new Date(upcomingHoliday.holiday_date).toLocaleString("default", { month: "short" }).toUpperCase()}</span>
              <span style={{ fontSize: "16px" }}>{new Date(upcomingHoliday.holiday_date).getDate()}</span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--primary)", fontWeight: 700 }}>
                  Upcoming Holiday
                </span>
                <span className="badge" style={{ fontSize: "0.75rem" }}>{upcomingHoliday.holiday_type}</span>
              </div>
              <strong style={{ fontSize: "1.15rem", color: "var(--text-heading)", display: "block" }}>
                {upcomingHoliday.name}
              </strong>
              <span className="small muted">
                {upcomingHoliday.day_of_week} ({upcomingHoliday.holiday_date}) {upcomingHoliday.description ? `— ${upcomingHoliday.description}` : ""}
              </span>
            </div>
          </div>

          <div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "var(--primary-light)",
                color: "var(--primary)",
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              ⏳ {upcomingHoliday.days_remaining === 0 ? "Today!" : upcomingHoliday.days_remaining === 1 ? "Tomorrow!" : `In ${upcomingHoliday.days_remaining} days`}
            </span>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border)",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("holidays")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeTab === "holidays" ? "var(--primary)" : "var(--muted)",
            borderBottom: activeTab === "holidays" ? "3px solid var(--primary)" : "3px solid transparent",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📅</span>
          <span>Holiday Calendar</span>
          <span className="badge" style={{ fontSize: "0.75rem" }}>{holidays.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeTab === "announcements" ? "var(--primary)" : "var(--muted)",
            borderBottom: activeTab === "announcements" ? "3px solid var(--primary)" : "3px solid transparent",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>📢</span>
          <span>Company Announcements</span>
          <span className="badge" style={{ fontSize: "0.75rem" }}>{announcements.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calculator")}
          style={{
            background: "none",
            border: "none",
            padding: "10px 18px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            color: activeTab === "calculator" ? "var(--primary)" : "var(--muted)",
            borderBottom: activeTab === "calculator" ? "3px solid var(--primary)" : "3px solid transparent",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>🧮</span>
          <span>Business Days Calculator</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: HOLIDAY CALENDAR
      ========================================================================= */}
      {activeTab === "holidays" && (
        <div>
          {/* Filters Bar */}
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Year Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="small muted" style={{ fontWeight: 600 }}>Year:</span>
                {["2025", "2026", "2027", "all"].map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`btn small ${yearFilter === y ? "primary" : "ghost"}`}
                    onClick={() => setYearFilter(y)}
                  >
                    {y === "all" ? "All Years" : y}
                  </button>
                ))}
              </div>

              {/* Type Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="small muted" style={{ fontWeight: 600 }}>Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ padding: "4px 8px", fontSize: "0.85rem" }}
                >
                  <option value="all">All Types</option>
                  {HOLIDAY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Search holidays…"
                value={holidaySearch}
                onChange={(e) => setHolidaySearch(e.target.value)}
                style={{ padding: "6px 12px", fontSize: "0.85rem", width: "190px" }}
              />

              {/* View Toggle */}
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setHolidayView("grid")}
                  style={{
                    padding: "6px 10px",
                    background: holidayView === "grid" ? "var(--primary-light)" : "var(--surface)",
                    color: holidayView === "grid" ? "var(--primary)" : "var(--muted)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                  title="Card Grid View"
                >
                  ▦ Grid
                </button>
                <button
                  type="button"
                  onClick={() => setHolidayView("table")}
                  style={{
                    padding: "6px 10px",
                    background: holidayView === "table" ? "var(--primary-light)" : "var(--surface)",
                    color: holidayView === "table" ? "var(--primary)" : "var(--muted)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                  title="Table View"
                >
                  ☰ Table
                </button>
              </div>
            </div>
          </div>

          {loadingHolidays ? (
            <div className="card center-note" style={{ padding: "40px" }}>Loading holidays…</div>
          ) : holidays.length === 0 ? (
            <div className="card" style={{ padding: "40px", textAlign: "center" }}>
              <p className="muted">No holidays found matching your filters.</p>
              {isAdmin && (
                <button type="button" className="btn primary small" onClick={handleSeedDefaults}>
                  Seed 2026 Default Holidays
                </button>
              )}
            </div>
          ) : holidayView === "grid" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(270px, 100%), 1fr))",
                gap: "16px",
              }}
            >
              {holidays.map((h) => {
                const isPast = h.days_remaining < 0;
                const isToday = h.days_remaining === 0;

                return (
                  <div
                    key={h.id}
                    className="card"
                    style={{
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "12px",
                      opacity: isPast ? 0.7 : 1,
                      border: isToday ? "2px solid var(--primary)" : "1px solid var(--border)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: "0.75rem",
                            background:
                              h.holiday_type === "National"
                                ? "var(--badge-role-admin-bg)"
                                : h.holiday_type === "Festival"
                                ? "var(--badge-role-manager-bg)"
                                : "var(--badge-bg)",
                            color:
                              h.holiday_type === "National"
                                ? "var(--badge-role-admin-text)"
                                : h.holiday_type === "Festival"
                                ? "var(--badge-role-manager-text)"
                                : "var(--muted)",
                          }}
                        >
                          {h.holiday_type}
                        </span>

                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: isToday ? "var(--primary)" : isPast ? "var(--muted)" : "var(--ok)",
                          }}
                        >
                          {isToday
                            ? "🎉 Today"
                            : isPast
                            ? `${Math.abs(h.days_remaining)}d ago`
                            : `in ${h.days_remaining}d`}
                        </span>
                      </div>

                      <strong style={{ fontSize: "1.05rem", color: "var(--text-heading)", display: "block", marginBottom: "4px" }}>
                        {h.name}
                      </strong>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "var(--muted)" }}>
                        <span>📅 {h.holiday_date}</span>
                        <span>•</span>
                        <span>{h.day_of_week}</span>
                      </div>

                      {h.description && (
                        <p className="small muted" style={{ margin: "8px 0 0", lineHeight: 1.4 }}>
                          {h.description}
                        </p>
                      )}
                    </div>

                    {isAdmin && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "8px",
                          borderTop: "1px solid var(--border)",
                          paddingTop: "10px",
                          marginTop: "6px",
                        }}
                      >
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => setModal({ type: "holiday", item: h })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn danger small"
                          onClick={() => setDeleteConfirm({ type: "holiday", item: h })}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Holiday Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Status</th>
                    {isAdmin && <th className="right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => {
                    const isPast = h.days_remaining < 0;
                    const isToday = h.days_remaining === 0;

                    return (
                      <tr key={h.id} style={{ opacity: isPast ? 0.75 : 1 }}>
                        <td className="nowrap"><strong>{h.holiday_date}</strong></td>
                        <td className="nowrap muted">{h.day_of_week}</td>
                        <td><strong>{h.name}</strong></td>
                        <td>
                          <span className="badge">{h.holiday_type}</span>
                        </td>
                        <td className="small muted">{h.description || "—"}</td>
                        <td className="nowrap">
                          <span
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: isToday ? "var(--primary)" : isPast ? "var(--muted)" : "var(--ok)",
                            }}
                          >
                            {isToday ? "Today" : isPast ? `${Math.abs(h.days_remaining)} days ago` : `In ${h.days_remaining} days`}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="right nowrap">
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => setModal({ type: "holiday", item: h })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn danger small"
                              onClick={() => setDeleteConfirm({ type: "holiday", item: h })}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: COMPANY ANNOUNCEMENTS
      ========================================================================= */}
      {activeTab === "announcements" && (
        <div>
          {/* Controls Bar */}
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="small muted" style={{ fontWeight: 600 }}>Priority:</span>
              <button
                type="button"
                className={`btn small ${priorityFilter === "all" ? "primary" : "ghost"}`}
                onClick={() => setPriorityFilter("all")}
              >
                All
              </button>
              {PRIORITY_TYPES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`btn small ${priorityFilter === p.value ? "primary" : "ghost"}`}
                  onClick={() => setPriorityFilter(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div>
              <input
                type="text"
                placeholder="Search announcements…"
                value={announcementSearch}
                onChange={(e) => setAnnouncementSearch(e.target.value)}
                style={{ padding: "6px 12px", fontSize: "0.85rem", width: "220px" }}
              />
            </div>
          </div>

          {loadingAnnouncements ? (
            <div className="card center-note" style={{ padding: "40px" }}>Loading announcements…</div>
          ) : announcements.length === 0 ? (
            <div className="card" style={{ padding: "40px", textAlign: "center" }}>
              <p className="muted">No company announcements found.</p>
              {isManagerOrAdmin && (
                <button
                  type="button"
                  className="btn primary small"
                  onClick={() => setModal({ type: "announcement", item: null })}
                >
                  Create First Announcement
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {announcements.map((a) => {
                const priorityMeta = PRIORITY_TYPES.find((p) => p.value === a.priority) || PRIORITY_TYPES[2];
                const canManage = isAdmin || (user?.role === "manager" && a.published_by === user?.username);

                return (
                  <div
                    key={a.id}
                    className="card"
                    style={{
                      padding: "20px 24px",
                      borderLeft: a.is_pinned ? "4px solid var(--primary)" : `4px solid ${priorityMeta.color}`,
                      background: a.is_pinned ? "var(--surface-alt)" : "var(--surface)",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {a.is_pinned && (
                          <span
                            style={{
                              background: "var(--primary-light)",
                              color: "var(--primary)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            📌 PINNED
                          </span>
                        )}

                        <span
                          className="badge"
                          style={{
                            fontSize: "0.75rem",
                            background:
                              a.priority === "urgent"
                                ? "var(--danger-bg)"
                                : a.priority === "important"
                                ? "var(--badge-role-manager-bg)"
                                : "var(--primary-light)",
                            color: priorityMeta.color,
                            fontWeight: 700,
                          }}
                        >
                          {priorityMeta.label}
                        </span>

                        {a.target_dept_name ? (
                          <span className="badge" style={{ fontSize: "0.75rem" }}>
                            🏛️ Dept: {a.target_dept_name}
                          </span>
                        ) : (
                          <span className="badge" style={{ fontSize: "0.75rem" }}>
                            🌐 Company-Wide
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.8rem", color: "var(--muted)" }}>
                        <span>Published by <strong>{a.published_by}</strong></span>
                        <span>•</span>
                        <span>{new Date(a.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</span>
                      </div>
                    </div>

                    <h3 style={{ fontSize: "1.2rem", margin: "6px 0 10px", color: "var(--text-heading)" }}>
                      {a.title}
                    </h3>

                    <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                      {a.content}
                    </p>

                    {canManage && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "8px",
                          marginTop: "14px",
                          paddingTop: "10px",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => setModal({ type: "announcement", item: a })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn danger small"
                          onClick={() => setDeleteConfirm({ type: "announcement", item: a })}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: WORKING BUSINESS DAYS CALCULATOR
      ========================================================================= */}
      {activeTab === "calculator" && (
        <div>
          <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "1.15rem" }}>
              Leave & Work Schedule Business Days Simulator
            </h3>
            <p className="muted small" style={{ margin: "0 0 18px", lineHeight: 1.5 }}>
              Automatically calculates actual working days between any two dates by excluding weekends (Saturdays & Sundays) and official gazetted company holidays.
            </p>

            <div style={{ display: "flex", gap: "14px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <label style={{ margin: 0 }}>
                Start Date
                <input
                  type="date"
                  value={calcStart}
                  onChange={(e) => setCalcStart(e.target.value)}
                  style={{ padding: "8px 12px" }}
                />
              </label>

              <label style={{ margin: 0 }}>
                End Date
                <input
                  type="date"
                  value={calcEnd}
                  onChange={(e) => setCalcEnd(e.target.value)}
                  style={{ padding: "8px 12px" }}
                />
              </label>

              <button
                type="button"
                className="btn primary"
                onClick={runCalculator}
                disabled={calcLoading}
                style={{ padding: "9px 20px" }}
              >
                {calcLoading ? "Calculating…" : "⚡ Compute Business Days"}
              </button>
            </div>
          </div>

          {calcResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Metric Breakdown Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
                  gap: "16px",
                }}
              >
                <div className="card" style={{ padding: "18px", textAlign: "center" }}>
                  <span className="muted small" style={{ fontWeight: 600, display: "block" }}>Total Calendar Span</span>
                  <strong style={{ fontSize: "1.8rem", color: "var(--text-heading)", display: "block", marginTop: "4px" }}>
                    {calcResult.total_calendar_days}
                  </strong>
                  <span className="small muted">consecutive days</span>
                </div>

                <div className="card" style={{ padding: "18px", textAlign: "center" }}>
                  <span className="muted small" style={{ fontWeight: 600, display: "block" }}>Weekend Days</span>
                  <strong style={{ fontSize: "1.8rem", color: "var(--muted)", display: "block", marginTop: "4px" }}>
                    -{calcResult.weekend_days}
                  </strong>
                  <span className="small muted">Sat & Sun</span>
                </div>

                <div className="card" style={{ padding: "18px", textAlign: "center" }}>
                  <span className="muted small" style={{ fontWeight: 600, display: "block" }}>Gazetted Holidays</span>
                  <strong style={{ fontSize: "1.8rem", color: "var(--danger)", display: "block", marginTop: "4px" }}>
                    -{calcResult.holiday_days}
                  </strong>
                  <span className="small muted">paid off-days</span>
                </div>

                <div
                  className="card"
                  style={{
                    padding: "18px",
                    textAlign: "center",
                    background: "var(--primary-light)",
                    borderColor: "var(--primary)",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: "0.85rem", display: "block" }}>
                    NET BUSINESS DAYS
                  </span>
                  <strong style={{ fontSize: "2.2rem", color: "var(--primary)", display: "block", marginTop: "2px" }}>
                    {calcResult.business_days}
                  </strong>
                  <span className="small" style={{ color: "var(--primary)", fontWeight: 600 }}>
                    working days to deduct
                  </span>
                </div>
              </div>

              {/* Holidays in range breakdown */}
              {calcResult.holidays && calcResult.holidays.length > 0 ? (
                <div className="card" style={{ padding: "18px 22px" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>
                    Holidays Falling Within Selected Date Span ({calcResult.holidays.length})
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.8 }}>
                    {calcResult.holidays.map((h) => (
                      <li key={h.id}>
                        <strong>{h.name}</strong> — {h.holiday_date} ({h.day_of_week})
                        <span className="badge" style={{ marginLeft: "8px", fontSize: "0.75rem" }}>
                          {h.holiday_type}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="card" style={{ padding: "16px 20px" }}>
                  <p className="muted small" style={{ margin: 0 }}>
                    ℹ️ Zero gazetted holidays fall within this date span.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODALS: HOLIDAY / ANNOUNCEMENT / DELETE CONFIRMATION
      ========================================================================= */}
      {modal?.type === "holiday" && (
        <HolidayModal
          holiday={modal.item}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            setNotice(msg);
            loadHolidays();
          }}
        />
      )}

      {modal?.type === "announcement" && (
        <AnnouncementModal
          announcement={modal.item}
          departments={departments}
          onClose={() => setModal(null)}
          onSaved={(msg) => {
            setModal(null);
            setNotice(msg);
            loadAnnouncements();
          }}
        />
      )}

      {deleteConfirm && (
        <Modal
          title={`Confirm Deletion`}
          onClose={() => setDeleteConfirm(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "8px 0" }}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to delete{" "}
              <strong>
                {deleteConfirm.type === "holiday"
                  ? `holiday "${deleteConfirm.item.name}"`
                  : `announcement "${deleteConfirm.item.title}"`}
              </strong>
              ? This action cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={executeDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// SUB-MODALS: HOLIDAY & ANNOUNCEMENT FORM
// =========================================================================

function HolidayModal({ holiday, onClose, onSaved }) {
  const isEditing = Boolean(holiday);
  const [name, setName] = useState(holiday?.name || "");
  const [holidayDate, setHolidayDate] = useState(
    holiday?.holiday_date || new Date().toISOString().slice(0, 10)
  );
  const [holidayType, setHolidayType] = useState(holiday?.holiday_type || "National");
  const [description, setDescription] = useState(holiday?.description || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Holiday name is required");
    if (!holidayDate) return setError("Holiday date is required");

    setBusy(true);
    setError("");
    try {
      if (isEditing) {
        await api.updateHoliday(holiday.id, {
          name: name.trim(),
          holiday_date: holidayDate,
          holiday_type: holidayType,
          description: description.trim() || undefined,
        });
        onSaved(`Updated holiday "${name.trim()}"`);
      } else {
        await api.createHoliday({
          name: name.trim(),
          holiday_date: holidayDate,
          holiday_type: holidayType,
          description: description.trim() || undefined,
        });
        onSaved(`Created holiday "${name.trim()}"`);
      }
    } catch (err) {
      setError(err.message || "Failed to save holiday");
      setBusy(false);
    }
  };

  return (
    <Modal title={isEditing ? `Edit Holiday` : `Create Holiday`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div className="alert error">{error}</div>}

        <label>
          Holiday Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Diwali, Independence Day"
            required
            autoFocus
          />
        </label>

        <div className="responsive-grid-2">
          <label>
            Date
            <input
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              required
            />
          </label>

          <label>
            Holiday Type
            <select value={holidayType} onChange={(e) => setHolidayType(e.target.value)}>
              {HOLIDAY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Description (Optional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Festival of Lights celebration"
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : isEditing ? "Save Changes" : "Create Holiday"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AnnouncementModal({ announcement, departments, onClose, onSaved }) {
  const isEditing = Boolean(announcement);
  const [title, setTitle] = useState(announcement?.title || "");
  const [content, setContent] = useState(announcement?.content || "");
  const [priority, setPriority] = useState(announcement?.priority || "general");
  const [targetDeptId, setTargetDeptId] = useState(
    announcement?.target_dept_id ? String(announcement.target_dept_id) : ""
  );
  const [isPinned, setIsPinned] = useState(announcement?.is_pinned || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError("Announcement title is required");
    if (!content.trim()) return setError("Announcement content is required");

    setBusy(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        priority,
        target_dept_id: targetDeptId ? Number(targetDeptId) : null,
        is_pinned: isPinned,
      };

      if (isEditing) {
        await api.updateAnnouncement(announcement.id, payload);
        onSaved(`Updated announcement "${title.trim()}"`);
      } else {
        await api.createAnnouncement(payload);
        onSaved(`Broadcasted announcement "${title.trim()}"`);
      }
    } catch (err) {
      setError(err.message || "Failed to save announcement");
      setBusy(false);
    }
  };

  return (
    <Modal title={isEditing ? `Edit Announcement` : `Broadcast Announcement`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && <div className="alert error">{error}</div>}

        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual Company Offsite 2026 Announcement"
            required
            autoFocus
          />
        </label>

        <div className="responsive-grid-2">
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {PRIORITY_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>

          <label>
            Target Audience
            <select value={targetDeptId} onChange={(e) => setTargetDeptId(e.target.value)}>
              <option value="">🌐 Entire Company (All Staff)</option>
              {departments.map((d) => (
                <option key={d.Dept_ID} value={d.Dept_ID}>
                  🏛️ {d.Dept_Name} Only
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Announcement Body
          <textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the full announcement message here…"
            required
            style={{
              padding: "10px 12px",
              fontFamily: "inherit",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text)",
            }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
          />
          <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>
            📌 Pin to top of announcements bulletin
          </span>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Broadcasting…" : isEditing ? "Save Changes" : "Broadcast Announcement"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
