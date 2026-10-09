import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import ThemeToggle from "./ThemeToggle";
import ChangePasswordModal from "./ChangePasswordModal";
import NotificationBell from "./NotificationBell";

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(/[\s_.-]+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Collapsible sidebar state (persisted across sessions)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // User profile dropdown menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordNotification, setPasswordNotification] = useState("");

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Click outside and escape key handling for user dropdown and drawer
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handlePasswordSuccess = (msg) => {
    setPasswordNotification(msg || "Password changed successfully!");
    setTimeout(() => {
      setPasswordNotification("");
    }, 4000);
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Collapsible Left Sidebar */}
      <aside className={`app-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="sidebar-brand-icon" title="Employee Portal">🏢</span>
            {!sidebarCollapsed && <span className="sidebar-brand-text">StaffPortal</span>}
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
          <button
            type="button"
            className="sidebar-close-mobile-btn"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="Employees"
          >
            <span className="sidebar-link-icon">👥</span>
            <span className="sidebar-link-label">Employees</span>
          </NavLink>

          <NavLink
            to="/departments"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="Departments"
          >
            <span className="sidebar-link-icon">🏛️</span>
            <span className="sidebar-link-label">Departments</span>
          </NavLink>

          <NavLink
            to="/salary-calculator"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="Salary & In-Hand Pay Calculator"
          >
            <span className="sidebar-link-icon">🧮</span>
            <span className="sidebar-link-label">Salary Calculator</span>
          </NavLink>

          <NavLink
            to="/holidays"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="Holiday Calendar & Company Announcements"
          >
            <span className="sidebar-link-icon">📅</span>
            <span className="sidebar-link-label">Holidays & News</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="My Profile & Emergency Contacts"
          >
            <span className="sidebar-link-icon">👤</span>
            <span className="sidebar-link-label">My Profile</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="Official Reports & PDF Generator"
          >
            <span className="sidebar-link-icon">📑</span>
            <span className="sidebar-link-label">Official Reports</span>
          </NavLink>

          <NavLink
            to="/analytics"
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            title="Workforce & Organizational Analytics"
          >
            <span className="sidebar-link-icon">📊</span>
            <span className="sidebar-link-label">Analytics</span>
          </NavLink>

          {user?.role === "admin" && (
            <NavLink
              to="/users"
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              title="User Management"
            >
              <span className="sidebar-link-icon">🛡️</span>
              <span className="sidebar-link-label">Users</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-brief" title={`${user?.username} (${user?.role})`}>
            <span className="sidebar-user-avatar">{getInitials(user?.username)}</span>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.username}</span>
                <span className={`badge role-${user?.role} sidebar-badge`}>{user?.role}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-left">
              <button
                type="button"
                className="topbar-hamburger"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle navigation drawer"
              >
                ☰
              </button>
              <span className="topbar-brand-title">Employee Management</span>
            </div>

            <div className="topbar-right">
              <ThemeToggle />
              <NotificationBell />

              {/* User Profile Dropdown Menu */}
              <div className="user-menu-container" ref={userMenuRef}>
                <button
                  type="button"
                  className={`user-menu-btn ${userMenuOpen ? "active" : ""}`}
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  title="Account menu"
                >
                  <span className="user-menu-avatar">{getInitials(user?.username)}</span>
                  <span className="user-menu-name">{user?.username}</span>
                  <span className={`badge role-${user?.role} user-menu-badge`}>{user?.role}</span>
                  <span className={`user-menu-chevron ${userMenuOpen ? "open" : ""}`}>▾</span>
                </button>

                {userMenuOpen && (
                  <div className="user-dropdown-panel" role="menu">
                    <div className="user-dropdown-header">
                      <div className="user-dropdown-header-avatar">{getInitials(user?.username)}</div>
                      <div className="user-dropdown-header-info">
                        <strong className="user-dropdown-name">{user?.username}</strong>
                        <span className="user-dropdown-email">
                          {user?.email || `${user?.username}@company.internal`}
                        </span>
                        <div style={{ marginTop: "4px" }}>
                          <span className={`badge role-${user?.role}`}>{user?.role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="user-dropdown-body">
                      <NavLink
                        to="/profile"
                        className="user-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span className="user-dropdown-item-icon">👤</span>
                        <span>My Profile & SOS</span>
                      </NavLink>

                      <NavLink
                        to="/salary-calculator"
                        className="user-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span className="user-dropdown-item-icon">🧮</span>
                        <span>Salary Calculator</span>
                      </NavLink>

                      <NavLink
                        to="/holidays"
                        className="user-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span className="user-dropdown-item-icon">📅</span>
                        <span>Holidays & News</span>
                      </NavLink>

                      <NavLink
                        to="/reports"
                        className="user-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <span className="user-dropdown-item-icon">📑</span>
                        <span>Official Reports</span>
                      </NavLink>

                      <button
                        type="button"
                        className="user-dropdown-item"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setShowChangePassword(true);
                        }}
                      >
                        <span className="user-dropdown-item-icon">🔑</span>
                        <span>Change Password</span>
                      </button>

                      <div className="user-dropdown-divider" />

                      <button
                        type="button"
                        className="user-dropdown-item danger"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                      >
                        <span className="user-dropdown-item-icon">🚪</span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {passwordNotification && (
          <div style={{ maxWidth: "1200px", margin: "14px auto 0", padding: "0 20px" }}>
            <div className="alert success" onClick={() => setPasswordNotification("")}>
              {passwordNotification}
              <span className="dismiss">✕</span>
            </div>
          </div>
        )}

        <main className="container">
          <Outlet />
        </main>
      </div>

      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={handlePasswordSuccess}
        />
      )}
    </div>
  );
}
