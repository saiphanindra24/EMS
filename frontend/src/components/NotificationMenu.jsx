import { useEffect, useRef, useState } from "react";
import { notificationService } from "../services/notificationService";
import "./NotificationMenu.css";

export default function NotificationMenu({ user, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' or 'unread'
  const [isLoading, setIsLoading] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastData, setBroadcastData] = useState({ title: "", message: "" });
  const [broadcastError, setBroadcastError] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const containerRef = useRef(null);

  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  // Polling unread count
  const fetchUnreadCount = async () => {
    try {
      const data = await notificationService.getUnreadCount();
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Ignore background polling errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000); // 30s polling
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications when opened or filter changed
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params = filter === "unread" ? { unread_only: "true" } : {};
      const data = await notificationService.getNotifications(params);
      setNotifications(data);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, filter]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id, targetUrl) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      if (targetUrl && onNavigate) {
        setIsOpen(false);
        onNavigate(targetUrl);
      }
    } catch (err) {
      console.error("Error marking notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!broadcastData.title.trim() || !broadcastData.message.trim()) {
      setBroadcastError("Please provide both title and announcement message.");
      return;
    }
    setBroadcastError("");
    setIsBroadcasting(true);
    try {
      await notificationService.sendAnnouncement(
        broadcastData.title.trim(),
        broadcastData.message.trim()
      );
      setBroadcastData({ title: "", message: "" });
      setIsBroadcastModalOpen(false);
      fetchNotifications();
      fetchUnreadCount();
      alert("Announcement broadcasted successfully to all active team members.");
    } catch (err) {
      setBroadcastError(err?.error || "Failed to broadcast announcement.");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case "TASK_ASSIGNED":
      case "TASK_DEADLINE_APPROACHING":
      case "TASK_OVERDUE":
        return "📋";
      case "LEAVE_SUBMITTED":
      case "LEAVE_APPROVED":
      case "LEAVE_REJECTED":
        return "🏖️";
      case "ATTENDANCE_REMINDER":
        return "⏰";
      case "ANNOUNCEMENT":
      default:
        return "📢";
    }
  };

  return (
    <div className="notification-container" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        title="Notifications"
      >
        <span>🔔</span>
        {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notif-header">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-tabs">
            <button
              type="button"
              className={`notif-tab-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`notif-tab-btn ${filter === "unread" ? "active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          <div className="notif-list">
            {isLoading ? (
              <div className="notif-empty">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                {filter === "unread"
                  ? "All caught up! No unread notifications."
                  : "No notifications found."}
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`notif-item ${!item.is_read ? "unread" : ""}`}
                  onClick={() => handleMarkAsRead(item.id, item.target_url)}
                >
                  <div className="notif-icon">{getIcon(item.notification_type)}</div>
                  <div className="notif-content">
                    <div className="notif-title-row">
                      <strong>{item.title}</strong>
                      <span className="notif-time">
                        {new Date(item.created_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="notif-desc">{item.message}</p>
                    {item.actor_name && (
                      <span className="notif-actor">From: {item.actor_name}</span>
                    )}
                  </div>
                  {!item.is_read && <span className="unread-dot" />}
                </div>
              ))
            )}
          </div>

          {isAdmin && (
            <div className="notif-footer">
              <span className="text-xs text-gray-500">Admin Controls</span>
              <button
                type="button"
                className="broadcast-btn"
                onClick={() => {
                  setIsOpen(false);
                  setIsBroadcastModalOpen(true);
                }}
              >
                📢 Broadcast Announcement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin Broadcast Announcement Modal */}
      {isBroadcastModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsBroadcastModalOpen(false)}
        >
          <div
            className="modal-card sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>Broadcast Announcement</h3>
                <p>Send an in-app announcement to all team members</p>
              </div>
              <button
                className="close-btn"
                onClick={() => setIsBroadcastModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="modal-body">
              {broadcastError && (
                <div className="form-error-banner">{broadcastError}</div>
              )}

              <div className="form-group">
                <label>Title <span className="req">*</span></label>
                <input
                  type="text"
                  value={broadcastData.title}
                  onChange={(e) =>
                    setBroadcastData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g. Office Town Hall Meeting"
                  disabled={isBroadcasting}
                  required
                />
              </div>

              <div className="form-group">
                <label>Message <span className="req">*</span></label>
                <textarea
                  rows={4}
                  value={broadcastData.message}
                  onChange={(e) =>
                    setBroadcastData((prev) => ({
                      ...prev,
                      message: e.target.value,
                    }))
                  }
                  placeholder="Write the announcement details..."
                  disabled={isBroadcasting}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  disabled={isBroadcasting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={isBroadcasting}
                >
                  {isBroadcasting ? "Broadcasting..." : "Send Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
