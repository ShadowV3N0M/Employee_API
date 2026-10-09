import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import ThemeToggle from "../components/ThemeToggle";

// Popular portal routes with keywords for smart matching
const PORTAL_PAGES = [
  {
    path: "/",
    title: "Employees Directory",
    icon: "👥",
    desc: "Directory of all active and inactive employees, records, and contact details.",
    keywords: ["emp", "employee", "employees", "staff", "people", "worker", "directory", "roster", "team"],
  },
  {
    path: "/departments",
    title: "Departments & Budgets",
    icon: "🏢",
    desc: "Department structure, budget allocations, leadership, and headcount distribution.",
    keywords: ["dept", "department", "departments", "budget", "unit", "division"],
  },
  {
    path: "/salary-calculator",
    title: "Salary Calculator",
    icon: "🧮",
    desc: "Estimate net take-home salary, FY 24-25 tax regimes, PF limits, and pay slabs.",
    keywords: ["salary", "salaries", "calculator", "calc", "pay", "tax", "wage", "ctc", "takehome", "payslip"],
  },
  {
    path: "/holidays",
    title: "Company Holidays & News",
    icon: "📅",
    desc: "Official corporate holiday calendar, business days counter, and announcements.",
    keywords: ["holiday", "holidays", "leave", "calendar", "event", "news", "announcement", "off"],
  },
  {
    path: "/profile",
    title: "My Self-Service Profile",
    icon: "👤",
    desc: "Personal profile, residential address, emergency SOS contacts, and salary slip.",
    keywords: ["profile", "me", "self", "account", "personal", "emergency", "contact"],
  },
  {
    path: "/reports",
    title: "Official Reports & PDF Center",
    icon: "📑",
    desc: "Generate and download official PDF payslips, staff directories, and budget summaries.",
    keywords: ["report", "reports", "pdf", "voucher", "export", "download", "summary"],
  },
  {
    path: "/analytics",
    title: "Workforce Analytics",
    icon: "📈",
    desc: "Executive analytics, salary distributions, department budgets, and tenure charts.",
    keywords: ["analytics", "analytic", "chart", "charts", "metrics", "graph", "stats", "insights"],
  },
  {
    path: "/users",
    title: "User Account Management",
    icon: "🛡️",
    desc: "Administrative portal to manage user credentials, roles, and account statuses.",
    adminOnly: true,
    keywords: ["user", "users", "account", "accounts", "admin", "role", "roles", "permission"],
  },
];

export default function NotFound({ type = "404", standalone = false }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const isForbidden = type === "403";
  const requestedPath = location.pathname || "/";
  const isStandaloneMode = standalone || !user;

  // Smart Suggestion: Try to find which page the user might have intended
  const suggestedPage = useMemo(() => {
    if (isForbidden) return null;
    const cleanPath = requestedPath.toLowerCase().replace(/[^a-z0-9]/g, " ");
    const segments = cleanPath.split(/\s+/).filter(Boolean);

    for (const page of PORTAL_PAGES) {
      if (page.adminOnly && user?.role !== "admin") continue;

      // Exact substring match in path
      const pageSlug = page.path.replace("/", "");
      if (pageSlug && cleanPath.includes(pageSlug)) {
        return page;
      }

      // Keyword match
      for (const seg of segments) {
        if (seg.length >= 3 && page.keywords.some((k) => k.includes(seg) || seg.includes(k))) {
          return page;
        }
      }
    }
    return null;
  }, [requestedPath, isForbidden, user]);

  // Filter available pages by search query
  const filteredPages = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    const available = PORTAL_PAGES.filter((p) => !p.adminOnly || user?.role === "admin");
    if (!q) return available;
    return available.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.keywords.some((k) => k.includes(q))
    );
  }, [filterQuery, user]);

  const handleCopyPath = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const content = (
    <div className={`not-found-card card ${isStandaloneMode ? "not-found-standalone-card" : ""}`}>
      {/* Visual Header / Graphic */}
      <div className="not-found-graphic">
        <div className="not-found-badge-wrap">
          <span className={`not-found-status-badge ${isForbidden ? "forbidden" : ""}`}>
            {isForbidden ? "403 · Access Denied" : "404 · Route Not Found"}
          </span>
        </div>

        <div className="not-found-illustration" aria-hidden="true">
          {isForbidden ? (
            <svg
              className="not-found-svg"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" opacity="0.15" />
              <rect x="30" y="44" width="40" height="32" rx="6" fill="currentColor" opacity="0.9" />
              <path
                d="M38 44V34a12 12 0 0 1 24 0v10"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="50" cy="58" r="4" fill="var(--surface)" />
              <path d="M50 62v6" stroke="var(--surface)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              className="not-found-svg"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="6" opacity="0.15" />
              <path
                d="M32 68 L68 32"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                opacity="0.3"
              />
              <circle cx="50" cy="50" r="22" stroke="currentColor" strokeWidth="5" opacity="0.4" />
              <polygon
                points="50,22 56,44 78,50 56,56 50,78 44,56 22,50 44,44"
                fill="currentColor"
                className="not-found-compass-needle"
              />
              <circle cx="50" cy="50" r="4" fill="var(--surface)" />
            </svg>
          )}
        </div>

        <h1 className="not-found-title">
          {isForbidden ? "Restricted Access Area" : "We Can't Find That Page"}
        </h1>

        <p className="not-found-desc">
          {isForbidden ? (
            <>
              You do not have administrative clearance to access{" "}
              <code className="not-found-code">{requestedPath}</code>. Please contact your system
              administrator if you believe this is an error.
            </>
          ) : (
            <>
              The link you followed may be broken, or the page at{" "}
              <code className="not-found-code">{requestedPath}</code> may have been relocated or removed.
            </>
          )}
        </p>

        {/* Path Diagnostic Pill */}
        <div className="not-found-meta-bar">
          <span className="not-found-path-pill" title="Attempted URL path">
            <span className="not-found-path-icon">🔗</span>
            <span className="not-found-path-text">{requestedPath}</span>
          </span>
          <button
            type="button"
            className="not-found-copy-btn"
            onClick={handleCopyPath}
            title="Copy full link"
          >
            {copied ? "✓ Copied" : "📋 Copy Link"}
          </button>
        </div>
      </div>

      {/* Smart Suggested Page Callout */}
      {suggestedPage && (
        <div className="not-found-suggestion-card">
          <div className="not-found-suggestion-left">
            <span className="not-found-suggestion-icon">{suggestedPage.icon}</span>
            <div>
              <div className="not-found-suggestion-label">Did you mean to visit?</div>
              <strong className="not-found-suggestion-title">{suggestedPage.title}</strong>
              <div className="not-found-suggestion-desc small muted">{suggestedPage.desc}</div>
            </div>
          </div>
          <Link to={suggestedPage.path} className="btn primary small nowrap">
            Go to Page →
          </Link>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="not-found-actions">
        <button
          type="button"
          className="btn secondary"
          onClick={() => navigate(-1)}
          title="Return to the previous screen"
        >
          ← Go Back
        </button>

        {user ? (
          <Link to="/" className="btn primary" title="Return to Employees Dashboard">
            🏠 Back to Dashboard
          </Link>
        ) : (
          <Link to="/login" className="btn primary" title="Sign In to StaffPortal">
            🔐 Sign In to Portal
          </Link>
        )}
      </div>

      {/* Quick Search & Portal Directory */}
      <div className="not-found-directory">
        <div className="not-found-directory-header">
          <h2 className="not-found-directory-title">Or navigate to a popular portal section:</h2>
          <div className="not-found-search-wrap">
            <span className="not-found-search-icon">🔍</span>
            <input
              type="search"
              className="not-found-search-input"
              placeholder="Filter portal destinations…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              aria-label="Filter portal sections"
            />
          </div>
        </div>

        <div className="not-found-grid">
          {filteredPages.map((page) => (
            <Link key={page.path} to={page.path} className="not-found-grid-item">
              <span className="not-found-grid-icon">{page.icon}</span>
              <div className="not-found-grid-info">
                <span className="not-found-grid-title">{page.title}</span>
                <span className="not-found-grid-desc">{page.desc}</span>
              </div>
            </Link>
          ))}
          {filteredPages.length === 0 && (
            <div className="not-found-empty muted center" style={{ gridColumn: "1 / -1", padding: "16px" }}>
              No destinations match "{filterQuery}". Try navigating back to the dashboard.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Standalone Full-screen View (for unauthenticated users or direct view)
  if (isStandaloneMode) {
    return (
      <div className="not-found-standalone-wrap">
        <header className="not-found-standalone-header">
          <Link to="/" className="not-found-standalone-brand" title="StaffPortal Home">
            <span className="sidebar-brand-icon">🏢</span>
            <span className="sidebar-brand-text">StaffPortal</span>
          </Link>
          <ThemeToggle />
        </header>

        <main className="not-found-standalone-body">{content}</main>

        <footer className="not-found-standalone-footer small muted">
          &copy; {new Date().getFullYear()} StaffPortal HRMS · Employee Management System
        </footer>
      </div>
    );
  }

  // Inside App Layout View (for authenticated users)
  return <div className="not-found-in-app">{content}</div>;
}

