import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../auth";

const TYPE_ICONS = {
  announcement: "📢",
  employee: "👥",
  salary: "💰",
  department: "🏛️",
  system: "⚙️",
  warning: "⚠️",
  success: "✅",
  info: "🔔",
};

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    isConnected,
    latestToast,
    dismissToast,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    broadcastAlert,
    requestDesktopPermission,
  } = useNotifications();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" | "unread"
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);

  // Broadcast modal state
  const [bcTitle, setBcTitle] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcType, setBcType] = useState("announcement");
  const [bcAudience, setBcAudience] = useState("all");
  const [bcLink, setBcLink] = useState("");
  const [bcSubmitting, setBcSubmitting] = useState(false);
  const [bcError, setBcError] = useState("");
  const [bcSuccess, setBcSuccess] = useState("");

  const dropdownRef = useRef(null);
  const prevUnreadRef = useRef(unreadCount);

  // Ring the bell when unread count increments
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellRinging(true);
      const timer = setTimeout(() => setBellRinging(false), 1200);
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Click outside and escape key handling
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowBroadcastModal(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const displayedNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    return true;
  });

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    if (notif.link) {
      setOpen(false);
      navigate(notif.link);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcMessage.trim()) {
      setBcError("Title and message are required.");
      return;
    }
    setBcSubmitting(true);
    setBcError("");
    setBcSuccess("");

    try {
      const payload = {
        title: bcTitle.trim(),
        message: bcMessage.trim(),
        type: bcType,
        link: bcLink.trim() || null,
        broadcast: bcAudience === "all",
        role: bcAudience !== "all" ? bcAudience : null,
      };
      await broadcastAlert(payload);
      setBcSuccess("Alert broadcasted in real time to all recipients!");
      setTimeout(() => {
        setShowBroadcastModal(false);
        setBcTitle("");
        setBcMessage("");
        setBcLink("");
        setBcSuccess("");
      }, 1500);
    } catch (err) {
      setBcError(err.message || "Failed to broadcast notification.");
    } finally {
      setBcSubmitting(false);
    }
  };

  const canBroadcast = user?.role === "admin" || user?.role === "manager";

  return (
    <>
      <div className="notif-bell-container" ref={dropdownRef}>
        <button
          type="button"
          className={`notif-bell-btn ${open ? "active" : ""} ${
            bellRinging ? "ring-animation" : ""
          }`}
          onClick={() => {
            setOpen((prev) => !prev);
            requestDesktopPermission();
          }}
          title={
            isConnected
              ? `Notifications (${unreadCount} unread) - Real-time Connected`
              : "Notifications - Connecting..."
          }
          aria-label="Open notifications menu"
          aria-expanded={open}
        >
          <span className="notif-bell-icon">🔔</span>

          {unreadCount > 0 && (
            <span className="notif-badge">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}

          {/* Real-time status indicator dot */}
          <span
            className={`notif-status-dot ${isConnected ? "online" : "offline"}`}
            title={isConnected ? "WebSocket Live" : "Reconnecting..."}
          />
        </button>

        {open && (
          <div className="notif-dropdown-panel" role="menu">
            {/* Dropdown Header */}
            <div className="notif-dropdown-header">
              <div className="notif-header-title-row">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 className="notif-header-title">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="notif-unread-count-pill">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    className={`notif-ws-indicator ${isConnected ? "live" : "sync"}`}
                    title={isConnected ? "WebSocket connected" : "Connecting..."}
                  >
                    {isConnected ? "● Live" : "○ Syncing"}
                  </span>
                </div>
              </div>

              {/* Filter Tabs and Mark All Read Action */}
              <div className="notif-header-actions-row">
                <div className="notif-filter-tabs">
                  <button
                    type="button"
                    className={`notif-tab ${filter === "all" ? "active" : ""}`}
                    onClick={() => setFilter("all")}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    type="button"
                    className={`notif-tab ${filter === "unread" ? "active" : ""}`}
                    onClick={() => setFilter("unread")}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="notif-mark-all-btn"
                    onClick={markAllAsRead}
                    title="Mark all as read"
                  >
                    ✓ Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Notification List Body */}
            <div className="notif-dropdown-body">
              {displayedNotifications.length === 0 ? (
                <div className="notif-empty-state">
                  <span className="notif-empty-icon">
                    {filter === "unread" ? "🎉" : "📭"}
                  </span>
                  <p className="notif-empty-title">
                    {filter === "unread"
                      ? "You're all caught up!"
                      : "No notifications yet"}
                  </p>
                  <p className="notif-empty-subtitle">
                    {filter === "unread"
                      ? "There are no unread notifications right now."
                      : "Important announcements and updates will appear here in real time."}
                  </p>
                </div>
              ) : (
                <div className="notif-list">
                  {displayedNotifications.map((notif) => {
                    const icon = TYPE_ICONS[notif.type] || "🔔";
                    return (
                      <div
                        key={notif.id}
                        className={`notif-item ${!notif.is_read ? "unread" : "read"} ${
                          notif.link ? "clickable" : ""
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="notif-item-icon-box" title={notif.type}>
                          <span className="notif-item-icon">{icon}</span>
                        </div>

                        <div className="notif-item-content">
                          <div className="notif-item-title-row">
                            <span className="notif-item-title">{notif.title}</span>
                            {!notif.is_read && (
                              <span
                                className="notif-unread-dot"
                                title="Unread notification"
                              />
                            )}
                          </div>
                          <p className="notif-item-msg">{notif.message}</p>
                          <div className="notif-item-meta">
                            <span className="notif-item-time">
                              {notif.time_ago || "Recently"}
                            </span>
                            {notif.link && (
                              <span className="notif-item-link-badge">
                                View details ↗
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="notif-item-dismiss-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notif.id);
                          }}
                          title="Dismiss notification"
                          aria-label="Dismiss"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="notif-dropdown-footer">
              {notifications.some((n) => n.is_read) && (
                <button
                  type="button"
                  className="notif-clear-read-btn"
                  onClick={clearAllRead}
                  title="Clear already-read items"
                >
                  Clear read
                </button>
              )}

              {canBroadcast && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary notif-broadcast-trigger-btn"
                  onClick={() => {
                    setOpen(false);
                    setShowBroadcastModal(true);
                  }}
                >
                  📢 Broadcast Alert
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Real-time Toast Alert (Slide-in on new notification) */}
      {latestToast && (
        <div
          className="notif-toast-banner"
          onClick={() => {
            if (latestToast.link) {
              navigate(latestToast.link);
            }
            markAsRead(latestToast.id);
            dismissToast();
          }}
          role="alert"
        >
          <div className="notif-toast-icon">
            {TYPE_ICONS[latestToast.type] || "🔔"}
          </div>
          <div className="notif-toast-content">
            <div className="notif-toast-header">
              <strong className="notif-toast-title">{latestToast.title}</strong>
              <span className="notif-toast-pill">LIVE</span>
            </div>
            <p className="notif-toast-msg">{latestToast.message}</p>
          </div>
          <button
            type="button"
            className="notif-toast-close"
            onClick={(e) => {
              e.stopPropagation();
              dismissToast();
            }}
            aria-label="Close notification preview"
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin / Manager Broadcast Notification Modal */}
      {showBroadcastModal && (
        <div className="modal-backdrop" onClick={() => setShowBroadcastModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📢 Broadcast Push Notification</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowBroadcastModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="modal-subtitle">
              Dispatch an instant real-time notification with audio chime to all connected users or specific roles.
            </p>

            {bcError && <div className="alert danger">{bcError}</div>}
            {bcSuccess && <div className="alert success">{bcSuccess}</div>}

            <form onSubmit={handleSendBroadcast} className="form-grid">
              <div className="form-group full">
                <label>Notification Title *</label>
                <input
                  type="text"
                  placeholder="e.g. System Maintenance Notice or Town Hall Meeting"
                  value={bcTitle}
                  onChange={(e) => setBcTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full">
                <label>Message Content *</label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed message text..."
                  value={bcMessage}
                  onChange={(e) => setBcMessage(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Notification Category</label>
                <select
                  value={bcType}
                  onChange={(e) => setBcType(e.target.value)}
                >
                  <option value="announcement">📢 Announcement</option>
                  <option value="employee">👥 Employee Notice</option>
                  <option value="salary">💰 Compensation Update</option>
                  <option value="department">🏛️ Department News</option>
                  <option value="system">⚙️ System Alert</option>
                  <option value="warning">⚠️ Urgent Warning</option>
                  <option value="info">🔔 General Info</option>
                </select>
              </div>

              <div className="form-group">
                <label>Target Audience</label>
                <select
                  value={bcAudience}
                  onChange={(e) => setBcAudience(e.target.value)}
                >
                  <option value="all">Everyone (All Company Users)</option>
                  <option value="admin">Administrators Only</option>
                  <option value="manager">Managers Only</option>
                  <option value="user">Standard Users Only</option>
                </select>
              </div>

              <div className="form-group full">
                <label>Target Page Link (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. /holidays or /departments or /salary-calculator"
                  value={bcLink}
                  onChange={(e) => setBcLink(e.target.value)}
                />
              </div>

              <div className="modal-actions full" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBroadcastModal(false)}
                  disabled={bcSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bcSubmitting}
                >
                  {bcSubmitting ? "Dispatching Push..." : "🚀 Push Notification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
