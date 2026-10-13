import { useEffect, useState } from "react";
import "./App.css";
import "./components/Auth.css";
import { useAuth } from "./context/AuthContext";
import { API_BASE_URL } from "./services/apiClient";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import EmployeeDirectory from "./components/EmployeeDirectory";
import Attendance from "./components/Attendance";
import Tasks from "./components/Tasks";
import LeaveManagement from "./components/LeaveManagement";
import NotificationMenu from "./components/NotificationMenu";
import Reports from "./components/Reports";
import AdminSettings from "./components/AdminSettings";
import Calendar from "./components/Calendar";
import MeetChat from "./components/MeetChat";
import { ChatWebSocketClient, getUserSlug } from "./services/chatSocket";

// ─── Role-gated navigation ────────────────────────────────────────────────
const ALL_NAV = [
  { name: "Dashboard",   icon: "▦", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Calendar",    icon: "📅", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Meet & Chat", icon: "💬", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Employees",   icon: "♙", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Attendance",  icon: "◷", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Tasks",        icon: "☷", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Leave",        icon: "🏖️", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Reports",     icon: "▤", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"] },
  { name: "Settings",    icon: "⚙", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
];

// ─── Loading splash ───────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-logo-box">
        <img src="/logo.png" alt="SSKATT EWTS Logo" className="loading-logo-img" />
      </div>
      <p>Synchronizing SSKATT EWTS…</p>
    </div>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const labels = {
    SUPER_ADMIN: "Super Admin",
    HR_ADMIN: "HR Admin",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
  };
  return (
    <span className={`role-badge ${role}`}>{labels[role] ?? role}</span>
  );
}

// ─── Main authenticated shell ─────────────────────────────────────────────
function AppShell() {
  const { user, logout } = useAuth();

  const [activePage, setActivePage] = useState("Dashboard");
  const [backendConnected, setBackendConnected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Global Call & Notification State across entire application
  const [globalIncomingCall, setGlobalIncomingCall] = useState(null);
  const [globalToast, setGlobalToast] = useState(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [targetChatRoom, setTargetChatRoom] = useState(null);
  const [autoOpenCall, setAutoOpenCall] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  }, [API_BASE_URL]);

  // Connect user personal WebSocket channel for workspace-wide calls and messages
  useEffect(() => {
    if (!user) return;
    const mySlug = getUserSlug(user);
    const myName = user?.full_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email;

    const handleGlobalSignal = (signalData) => {
      if (signalData.type === "user_notification") {
        const notifType = signalData.notification_type;
        const sender = signalData.sender_name || "Coworker";
        const room = signalData.room_name || "c-scrum";

        // Ignore if initiated by ourselves
        if (sender === myName || sender === user?.first_name) return;

        if (notifType === "call_user") {
          setGlobalIncomingCall({
            caller: sender,
            room: room,
            callType: signalData.call_type || "video",
          });
        } else if (notifType === "call_ended") {
          setGlobalIncomingCall(null);
        } else if (notifType === "chat_message") {
          setChatUnreadCount((prev) => prev + 1);
          setGlobalToast({
            id: Date.now(),
            sender: sender,
            content: signalData.content,
            room: room,
          });
        }
      }
    };

    const client = new ChatWebSocketClient(
      `user_${mySlug}`,
      null,
      handleGlobalSignal
    );

    return () => {
      client.disconnect();
    };
  }, [user]);

  // Auto-dismiss message toast after 7s
  useEffect(() => {
    if (globalToast) {
      const timer = setTimeout(() => setGlobalToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [globalToast]);

  const userRole = user?.role ?? "EMPLOYEE";
  const navigation = ALL_NAV.filter((n) => n.roles.includes(userRole));

  const avatarInitials = user
    ? ((user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "")).toUpperCase() || user.email[0].toUpperCase()
    : "?";

  const todayStr = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="layout">
      {/* ── Global Real-Time Call Alert (Visible anywhere on Dashboard or Workspace) ── */}
      {globalIncomingCall && (
        <div className="global-call-banner" role="alert">
          <span style={{ fontSize: 26, animation: "bounce 1s infinite" }}>
            {globalIncomingCall.callType === "voice" ? "📞" : "📹"}
          </span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: 0.5 }}>
              INCOMING {globalIncomingCall.callType.toUpperCase()} CALL
            </div>
            <strong style={{ fontSize: 15, display: "block", marginTop: 2 }}>
              {globalIncomingCall.caller}
            </strong>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              Calling you in {globalIncomingCall.room.startsWith("c-") ? `#${globalIncomingCall.room.replace("c-", "")}` : "Direct Meeting"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button
              type="button"
              style={{
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "8px 16px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => {
                setTargetChatRoom(globalIncomingCall.room);
                setAutoOpenCall(true);
                setActivePage("Meet & Chat");
                setGlobalIncomingCall(null);
              }}
            >
              Accept
            </button>
            <button
              type="button"
              style={{
                background: "#ef4444",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => setGlobalIncomingCall(null)}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ── Global Toast for Real-Time Chat Message ── */}
      {globalToast && (
        <div
          className="global-toast-alert"
          role="status"
          onClick={() => {
            setTargetChatRoom(globalToast.room);
            setAutoOpenCall(false);
            setActivePage("Meet & Chat");
            setGlobalToast(null);
            setChatUnreadCount(0);
          }}
        >
          <span style={{ fontSize: 22 }}>💬</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>
              {globalToast.sender}
            </div>
            <div style={{ fontSize: 12, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {globalToast.content}
            </div>
          </div>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 16,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setGlobalToast(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Mobile Sidebar Backdrop ── */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Main Navigation">
        <div className="brand">
          <div className="brand-logo-container">
            <img src="/logo.png" alt="SSKATT EWTS Logo" className="brand-logo-img" />
          </div>
          <div className="brand-titles">
            <h2>SSKATT EWTS</h2>
            <span>VolkssKatt Suite</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="nav-label">MAIN MENU</div>
        <nav className="navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? "active" : ""}`}
              onClick={() => {
                setActivePage(item.name);
                if (item.name === "Meet & Chat") {
                  setChatUnreadCount(0);
                }
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.name}</span>
              {item.name === "Meet & Chat" && chatUnreadCount > 0 && (
                <span className="nav-unread-badge">{chatUnreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection">
            <span className={`connection-dot ${backendConnected ? "online" : ""}`} />
            <span>
              {backendConnected === null
                ? "Checking…"
                : backendConnected
                ? "Backend connected"
                : "Backend offline"}
            </span>
          </div>

          <div className="sidebar-user">
            <div className="avatar">{avatarInitials}</div>
            <div className="user-info">
              <strong>{user?.full_name ?? user?.email ?? "User"}</strong>
              <span>
                {user?.role && <RoleBadge role={user.role} />}
              </span>
            </div>
          </div>

          <button
            className="logout-btn"
            onClick={logout}
            id="logout-btn"
          >
            ⎋ Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
            >
              ☰
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <span>⌕</span>
              <input type="search" placeholder="Search…" aria-label="Search across workspace" />
              <kbd>⌘ K</kbd>
            </label>
            <NotificationMenu user={user} onNavigate={setActivePage} />
            <div className="top-avatar" title={user?.email}>{avatarInitials}</div>
          </div>
        </header>

        <div className="content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>
                {activePage === "Dashboard"
                  ? `Welcome, ${user?.first_name || user?.email?.split("@")[0] || "there"} 👋`
                  : activePage}
              </h1>
              <p className="subtitle">
                {activePage === "Dashboard"
                  ? "Here's what's happening with your team today."
                  : `Manage and review your ${activePage.toLowerCase()} information.`}
              </p>
            </div>
            <button
              className="date-button"
              type="button"
              onClick={() => setActivePage("Calendar")}
              title="Open Calendar"
            >
              ▦ &nbsp; {todayStr} &nbsp;⌄
            </button>
          </section>

          {activePage === "Dashboard" ? (
            <Dashboard onNavigate={setActivePage} />
          ) : activePage === "Calendar" ? (
            <Calendar onNavigate={setActivePage} />
          ) : activePage === "Meet & Chat" ? (
            <MeetChat
              targetChatRoom={targetChatRoom}
              autoOpenCall={autoOpenCall}
            />
          ) : activePage === "Employees" ? (
            <EmployeeDirectory />
          ) : activePage === "Attendance" ? (
            <Attendance />
          ) : activePage === "Tasks" ? (
            <Tasks />
          ) : activePage === "Leave" ? (
            <LeaveManagement />
          ) : activePage === "Reports" ? (
            <Reports />
          ) : activePage === "Settings" ? (
            <AdminSettings />
          ) : (

            <section className="panel placeholder-panel">
              <div className="placeholder-icon">▦</div>
              <h3>{activePage} module</h3>
              <p>
                This section is ready for development. Its forms,
                data tables, and API integration are planned for an upcoming milestone.
              </p>
              <button className="primary-button" onClick={() => setActivePage("Dashboard")}>
                Back to dashboard
              </button>
            </section>
          )}


          <footer className="footer">SSKATT EWTS © 2026 · VolkssKatt Infotech Private Limited</footer>
        </div>
      </main>
    </div>
  );
}

// ─── Root component: gate behind auth ────────────────────────────────────
function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginPage />;
  return <AppShell />;
}

export default App;
