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

// ─── Role-gated navigation ────────────────────────────────────────────────
const ALL_NAV = [
  { name: "Dashboard",  icon: "▦", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Employees",  icon: "♙", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Attendance", icon: "◷", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Tasks",       icon: "☷", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Leave",       icon: "🏖️", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
  { name: "Reports",    icon: "▤", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"] },
  { name: "Settings",   icon: "⚙", roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"] },
];

// ─── Loading splash ───────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-logo">E</div>
      <p>Checking session…</p>
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

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setBackendConnected(true))
      .catch(() => setBackendConnected(false));
  }, [API_BASE_URL]);

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
          <div className="brand-logo">E</div>
          <div>
            <h2>EMWTS</h2>
            <span>Workplace Suite</span>
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
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.name}</span>
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
            <button className="date-button" type="button">
              ▦ &nbsp; {todayStr} &nbsp;⌄
            </button>
          </section>

          {activePage === "Dashboard" ? (
            <Dashboard onNavigate={setActivePage} />
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


          <footer className="footer">EMWTS © 2026 · Employee Management &amp; Work Tracking System</footer>
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
