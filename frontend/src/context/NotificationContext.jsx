import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api, BASE_URL, getToken } from "../api";
import { useAuth } from "../auth";

const NotificationContext = createContext(null);

// Synthesized modern two-tone audio chime using HTML5 Web Audio API
function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1: Gentle E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Tone 2: Melodic A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);
  } catch {
    // Suppressed if browser requires user gesture
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [latestToast, setLatestToast] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Fetch initial notifications and unread count
  const refreshNotifications = useCallback(async (unreadOnly = false) => {
    if (!user) return;
    try {
      const data = await api.listNotifications(unreadOnly, 50);
      setNotifications(data);
    } catch {
      // Ignore background refresh errors
    }
  }, [user]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getUnreadNotificationCount();
      setUnreadCount(res.unread_count);
    } catch {
      // Ignore background errors
    }
  }, [user]);

  // Request browser desktop notification permissions if user wants
  const requestDesktopPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignored
      }
    }
  }, []);

  // Show desktop notification if permitted
  const showDesktopNotification = useCallback((notif) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(notif.title || "StaffPortal Notification", {
          body: notif.message,
          icon: "/favicon.ico",
        });
      } catch {
        // Ignored
      }
    }
  }, []);

  // Establish and manage real-time WebSocket connection
  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    refreshNotifications();
    refreshUnreadCount();

    function connectWs() {
      const token = getToken();
      if (!token) return;

      const wsProtocol = BASE_URL.startsWith("https") ? "wss:" : "ws:";
      const host = BASE_URL.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}//${host}/ws/notifications?token=${encodeURIComponent(token)}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          // Heartbeat ping every 25s to keep proxy connections alive
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "init") {
              setUnreadCount(data.unread_count ?? 0);
            } else if (data.type === "new_notification" && data.notification) {
              const newNotif = data.notification;
              setNotifications((prev) => [newNotif, ...prev]);
              setUnreadCount((prev) => prev + 1);

              // Play gentle chime
              playChime();

              // Trigger real-time floating toast banner
              setLatestToast(newNotif);
              if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
              toastTimeoutRef.current = setTimeout(() => {
                setLatestToast(null);
              }, 6000);

              // Trigger desktop push notification
              showDesktopNotification(newNotif);
            }
          } catch {
            // Invalid JSON ignored
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          // Auto-reconnect with backoff
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (getToken()) connectWs();
          }, 3500);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // Reconnect on next interval
      }
    }

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [user, refreshNotifications, refreshUnreadCount, showDesktopNotification]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignored
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignored
    }
  };

  // Delete notification
  const deleteNotification = async (id) => {
    try {
      const target = notifications.find((n) => n.id === id);
      await api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Ignored
    }
  };

  // Clear all read notifications
  const clearAllRead = async () => {
    try {
      await api.clearAllReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch {
      // Ignored
    }
  };

  // Broadcast custom alert (Admin / Manager)
  const broadcastAlert = async (payload) => {
    const res = await api.broadcastNotification(payload);
    refreshNotifications();
    return res;
  };

  const dismissToast = () => {
    setLatestToast(null);
  };

  return (
    <NotificationContext.Provider
      value={{
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
        refreshNotifications,
        requestDesktopPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
