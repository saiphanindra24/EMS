import { useEffect, useState } from "react";
import "./AdminSettings.css";
import { organizationService } from "../services/organizationService";
import { useAuth } from "../context/AuthContext";

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function AdminSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "HR_ADMIN";

  const [activeTab, setActiveTab] = useState(isAdmin ? "general" : "profile");
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  // ── 1. General Settings State ──
  const [orgSettings, setOrgSettings] = useState({
    name: "",
    timezone: "UTC",
    contact_email: "",
    contact_phone: "",
    address: "",
    website: "",
    logo_url: null,
  });
  const [logoFile, setLogoFile] = useState(null);

  // ── 2. Work Schedule State ──
  const [schedule, setSchedule] = useState({
    work_start_time: "09:00:00",
    work_end_time: "18:00:00",
    grace_period_minutes: 15,
    half_day_minimum_hours: "4.00",
    full_day_minimum_hours: "8.00",
  });

  // ── 3. Holidays State ──
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", description: "" });

  // ── 4. Leave Types State ──
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [newLeaveType, setNewLeaveType] = useState({
    name: "",
    code: "",
    description: "",
    is_paid: true,
    annual_allowance: 12,
  });

  // ── 5. Notification Preferences State ──
  const [notifPrefs, setNotifPrefs] = useState({
    email_notifications_enabled: true,
    task_assignment_alerts: true,
    task_overdue_alerts: true,
    leave_status_alerts: true,
    attendance_reminder_alerts: true,
    daily_digest_enabled: false,
  });

  // ── 6. User Management State ──
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("");

  // ── 7. Audit Trail State ──
  const [auditLogs, setAuditLogs] = useState([]);

  // ── 8. Profile & Password State ──
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: "",
    email: user?.email || "",
    role: user?.role || "",
  });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: "", message: "" }), 5000);
  };

  // Initial Data Fetch
  useEffect(() => {
    if (isAdmin) {
      organizationService.getSettings()
        .then((data) => setOrgSettings(data))
        .catch(() => {});

      organizationService.getSchedule()
        .then((data) => setSchedule(data))
        .catch(() => {});

      organizationService.getHolidays()
        .then((data) => setHolidays(data.results || data || []))
        .catch(() => {});

      organizationService.getLeaveTypes()
        .then((data) => setLeaveTypes(data.results || data || []))
        .catch(() => {});

      organizationService.getNotificationPreferences()
        .then((data) => setNotifPrefs(data))
        .catch(() => {});

      organizationService.getUsers({ page_size: 50 })
        .then((data) => setUsersList(data.results || []))
        .catch(() => {});

      organizationService.getAuditLogs({ page_size: 20 })
        .then((data) => setAuditLogs(data.results || []))
        .catch(() => {});
    }

    organizationService.getProfile()
      .then((data) => setProfileData(data))
      .catch(() => {});
  }, [isAdmin]);

  // ── Handlers: General Settings ──
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", orgSettings.name);
      formData.append("timezone", orgSettings.timezone);
      formData.append("contact_email", orgSettings.contact_email);
      formData.append("contact_phone", orgSettings.contact_phone);
      formData.append("address", orgSettings.address);
      formData.append("website", orgSettings.website);
      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const updated = await organizationService.updateSettings(formData);
      setOrgSettings(updated);
      setLogoFile(null);
      showFeedback("success", "Organization profile settings saved successfully.");
    } catch (err) {
      showFeedback("error", err.detail || err.error || "Failed to update organization profile.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handlers: Work Schedule ──
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = await organizationService.updateSchedule(schedule);
      setSchedule(updated);
      showFeedback("success", "Work schedule & grace period updated.");
    } catch (err) {
      showFeedback("error", err.non_field_errors?.[0] || "Failed to update schedule.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handlers: Holidays ──
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) return;
    setIsLoading(true);
    try {
      const created = await organizationService.createHoliday(newHoliday);
      setHolidays([...holidays, created]);
      setNewHoliday({ name: "", date: "", description: "" });
      showFeedback("success", `Holiday '${created.name}' added to calendar.`);
    } catch (err) {
      showFeedback("error", err.non_field_errors?.[0] || "Failed to add holiday.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHoliday = async (id, name) => {
    if (!window.confirm(`Delete holiday '${name}'?`)) return;
    try {
      await organizationService.deleteHoliday(id);
      setHolidays(holidays.filter((h) => h.id !== id));
      showFeedback("success", "Holiday removed.");
    } catch {
      showFeedback("error", "Failed to delete holiday.");
    }
  };

  // ── Handlers: Leave Types ──
  const handleAddLeaveType = async (e) => {
    e.preventDefault();
    if (!newLeaveType.name || !newLeaveType.code) return;
    setIsLoading(true);
    try {
      const created = await organizationService.createLeaveType(newLeaveType);
      setLeaveTypes([...leaveTypes, created]);
      setNewLeaveType({ name: "", code: "", description: "", is_paid: true, annual_allowance: 12 });
      showFeedback("success", `Leave category '${created.name}' created.`);
    } catch (err) {
      showFeedback("error", err.code?.[0] || err.detail || "Failed to add leave category.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateLeaveType = async (id, name) => {
    if (!window.confirm(`Deactivate leave category '${name}'?`)) return;
    try {
      await organizationService.deactivateLeaveType(id);
      setLeaveTypes(leaveTypes.map((lt) => (lt.id === id ? { ...lt, is_active: false } : lt)));
      showFeedback("success", `Leave category '${name}' deactivated.`);
    } catch {
      showFeedback("error", "Failed to deactivate leave category.");
    }
  };

  // ── Handlers: Notification Preferences ──
  const handleSaveNotifPrefs = async () => {
    setIsLoading(true);
    try {
      const updated = await organizationService.updateNotificationPreferences(notifPrefs);
      setNotifPrefs(updated);
      showFeedback("success", "Notification preferences saved.");
    } catch {
      showFeedback("error", "Failed to update notification preferences.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handlers: User Role Changes ──
  const handleRoleChange = async (userId, newRole) => {
    try {
      const updated = await organizationService.updateUserRole(userId, newRole);
      setUsersList(usersList.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      showFeedback("success", `User role updated to ${updated.role}.`);
    } catch (err) {
      showFeedback("error", err.detail || "Failed to change user role.");
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const updated = await organizationService.toggleUserStatus(userId, !currentStatus);
      setUsersList(usersList.map((u) => (u.id === userId ? { ...u, is_active: updated.is_active } : u)));
      showFeedback("success", `User account ${updated.is_active ? "activated" : "deactivated"}.`);
    } catch (err) {
      showFeedback("error", err.detail || "Failed to toggle user status.");
    }
  };

  // ── Handlers: Profile & Password ──
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = await organizationService.updateProfile({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone,
      });
      setProfileData(updated);
      showFeedback("success", "Profile details updated.");
    } catch {
      showFeedback("error", "Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      showFeedback("error", "New passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await organizationService.changePassword({
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      showFeedback("success", "Password changed successfully.");
    } catch (err) {
      showFeedback("error", Array.isArray(err.detail) ? err.detail.join(" ") : err.detail || "Password change failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered Users
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.full_name.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="settings-container">
      {/* ── Left Settings Sub-Navigation ── */}
      <aside className="settings-nav">
        {isAdmin && (
          <>
            <button
              className={`settings-nav-item ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              <span className="nav-icon">🏢</span> Org Profile &amp; Logo
            </button>
            <button
              className={`settings-nav-item ${activeTab === "schedule" ? "active" : ""}`}
              onClick={() => setActiveTab("schedule")}
            >
              <span className="nav-icon">🕒</span> Schedule &amp; Grace Period
            </button>
            <button
              className={`settings-nav-item ${activeTab === "holidays" ? "active" : ""}`}
              onClick={() => setActiveTab("holidays")}
            >
              <span className="nav-icon">📅</span> Holiday Calendar
            </button>
            <button
              className={`settings-nav-item ${activeTab === "leaves" ? "active" : ""}`}
              onClick={() => setActiveTab("leaves")}
            >
              <span className="nav-icon">🏖️</span> Leave Categories
            </button>
            <button
              className={`settings-nav-item ${activeTab === "notifications" ? "active" : ""}`}
              onClick={() => setActiveTab("notifications")}
            >
              <span className="nav-icon">🔔</span> Notification Preferences
            </button>
            <button
              className={`settings-nav-item ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <span className="nav-icon">🛡️</span> Users &amp; Roles
            </button>
            <button
              className={`settings-nav-item ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              <span className="nav-icon">📜</span> Audit Trail
            </button>
          </>
        )}
        <button
          className={`settings-nav-item ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => setActiveTab("profile")}
        >
          <span className="nav-icon">👤</span> My Profile &amp; Security
        </button>
      </aside>

      {/* ── Right Content Panel ── */}
      <section className="settings-content-card">
        {feedback.message && (
          <div className={`alert-feedback ${feedback.type}`}>
            <span>{feedback.type === "success" ? "✓" : "⚠️"}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* 1. GENERAL ORGANIZATION PROFILE & LOGO */}
        {activeTab === "general" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>Organization Profile &amp; Branding</h2>
              <p>Configure company metadata, brand assets, and default system timezone.</p>
            </div>

            <form onSubmit={handleSaveGeneral} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="logo-upload-box">
                {orgSettings.logo_url ? (
                  <img src={orgSettings.logo_url} alt="Org Logo" className="logo-preview-img" />
                ) : (
                  <div className="logo-fallback-badge">E</div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>Company Logo</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => setLogoFile(e.target.files[0])}
                    style={{ fontSize: "12.5px" }}
                  />
                  <span className="form-hint">Accepted formats: PNG, JPEG, WEBP. Max size: 5MB.</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group-block">
                  <label>Company Legal Name</label>
                  <input
                    type="text"
                    value={orgSettings.name}
                    onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-block">
                  <label>System Timezone</label>
                  <select
                    value={orgSettings.timezone}
                    onChange={(e) => setOrgSettings({ ...orgSettings, timezone: e.target.value })}
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                  <span className="form-hint">Used to evaluate punch timestamps and work boundaries.</span>
                </div>
                <div className="form-group-block">
                  <label>Official Contact Email</label>
                  <input
                    type="email"
                    value={orgSettings.contact_email}
                    onChange={(e) => setOrgSettings({ ...orgSettings, contact_email: e.target.value })}
                  />
                </div>
                <div className="form-group-block">
                  <label>Official Phone Number</label>
                  <input
                    type="text"
                    value={orgSettings.contact_phone}
                    onChange={(e) => setOrgSettings({ ...orgSettings, contact_phone: e.target.value })}
                  />
                </div>
                <div className="form-group-block">
                  <label>Website URL</label>
                  <input
                    type="url"
                    value={orgSettings.website}
                    onChange={(e) => setOrgSettings({ ...orgSettings, website: e.target.value })}
                  />
                </div>
                <div className="form-group-block">
                  <label>Headquarters Address</label>
                  <input
                    type="text"
                    value={orgSettings.address}
                    onChange={(e) => setOrgSettings({ ...orgSettings, address: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn-save" disabled={isLoading}>
                {isLoading ? "Saving…" : "Save Profile Settings"}
              </button>
            </form>
          </>
        )}

        {/* 2. WORK SCHEDULE & GRACE PERIOD */}
        {activeTab === "schedule" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>Work Schedule &amp; Attendance Rules</h2>
              <p>Define operational hours, late arrival grace windows, and session thresholds.</p>
            </div>

            <form onSubmit={handleSaveSchedule} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="form-grid-2">
                <div className="form-group-block">
                  <label>Shift Start Time</label>
                  <input
                    type="time"
                    step="1"
                    value={schedule.work_start_time}
                    onChange={(e) => setSchedule({ ...schedule, work_start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-block">
                  <label>Shift End Time</label>
                  <input
                    type="time"
                    step="1"
                    value={schedule.work_end_time}
                    onChange={(e) => setSchedule({ ...schedule, work_end_time: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-block">
                  <label>Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={schedule.grace_period_minutes}
                    onChange={(e) => setSchedule({ ...schedule, grace_period_minutes: Number(e.target.value) })}
                    required
                  />
                  <span className="form-hint">Arrivals beyond this window are marked as Late.</span>
                </div>
                <div className="form-group-block">
                  <label>Half-Day Minimum Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="12"
                    value={schedule.half_day_minimum_hours}
                    onChange={(e) => setSchedule({ ...schedule, half_day_minimum_hours: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-block">
                  <label>Full-Day Standard Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="4"
                    max="16"
                    value={schedule.full_day_minimum_hours}
                    onChange={(e) => setSchedule({ ...schedule, full_day_minimum_hours: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-save" disabled={isLoading}>
                {isLoading ? "Saving…" : "Save Schedule Rules"}
              </button>
            </form>
          </>
        )}

        {/* 3. HOLIDAY CALENDAR */}
        {activeTab === "holidays" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>Holiday Calendar</h2>
              <p>Manage official company observances and paid non-working holidays.</p>
            </div>

            <form onSubmit={handleAddHoliday} style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
              <div className="form-group-block" style={{ flex: "1 1 200px" }}>
                <label>Holiday Name</label>
                <input
                  type="text"
                  placeholder="e.g. Independence Day"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-block" style={{ flex: "1 1 150px" }}>
                <label>Date</label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-block" style={{ flex: "2 1 250px" }}>
                <label>Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Notes or observance details"
                  value={newHoliday.description}
                  onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-sm-primary" disabled={isLoading}>
                + Add Holiday
              </button>
            </form>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: "center", color: "#64748b" }}>No holidays configured yet.</td></tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id}>
                      <td><strong>{h.name}</strong></td>
                      <td><code>{h.date}</code></td>
                      <td>{h.description || "-"}</td>
                      <td>
                        <button
                          className="btn-danger-outline"
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}

        {/* 4. LEAVE CATEGORIES */}
        {activeTab === "leaves" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>Leave Categories &amp; Policy</h2>
              <p>Configure leave quotas, paid leave designations, and approval requirements.</p>
            </div>

            <form onSubmit={handleAddLeaveType} style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
              <div className="form-group-block" style={{ flex: "1 1 180px" }}>
                <label>Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Parental Leave"
                  value={newLeaveType.name}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-block" style={{ flex: "1 1 100px" }}>
                <label>Code</label>
                <input
                  type="text"
                  placeholder="PAR"
                  value={newLeaveType.code}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, code: e.target.value })}
                  required
                />
              </div>
              <div className="form-group-block" style={{ flex: "1 1 120px" }}>
                <label>Annual Allowance (Days)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newLeaveType.annual_allowance}
                  onChange={(e) => setNewLeaveType({ ...newLeaveType, annual_allowance: Number(e.target.value) })}
                  required
                />
              </div>
              <button type="submit" className="btn-sm-primary" disabled={isLoading}>
                + Add Category
              </button>
            </form>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Annual Allowance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => (
                  <tr key={lt.id}>
                    <td><strong>{lt.name}</strong></td>
                    <td><code>{lt.code}</code></td>
                    <td>{lt.is_paid ? "Paid Leave" : "Unpaid Leave"}</td>
                    <td>{lt.annual_allowance ?? "Unlimited"} days</td>
                    <td>
                      <span className={`status-tag ${lt.is_active ? "active" : "terminated"}`}>
                        {lt.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td>
                      {lt.is_active && (
                        <button
                          className="btn-danger-outline"
                          onClick={() => handleDeactivateLeaveType(lt.id, lt.name)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 5. NOTIFICATION DISPATCH PREFERENCES */}
        {activeTab === "notifications" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>Notification Preferences</h2>
              <p>Configure automated system alerts and notification dispatch channels.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <h4>Email Notifications</h4>
                  <p>Send email copies for important system events</p>
                </div>
                <input
                  type="checkbox"
                  className="switch-checkbox"
                  checked={notifPrefs.email_notifications_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, email_notifications_enabled: e.target.checked })}
                />
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <h4>Task Assignment Alerts</h4>
                  <p>Notify employees when new work is assigned</p>
                </div>
                <input
                  type="checkbox"
                  className="switch-checkbox"
                  checked={notifPrefs.task_assignment_alerts}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, task_assignment_alerts: e.target.checked })}
                />
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <h4>Overdue Task Warnings</h4>
                  <p>Send escalation warnings when deliverables breach deadlines</p>
                </div>
                <input
                  type="checkbox"
                  className="switch-checkbox"
                  checked={notifPrefs.task_overdue_alerts}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, task_overdue_alerts: e.target.checked })}
                />
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <h4>Leave Request Status Updates</h4>
                  <p>Notify employees when leave requests are approved or rejected</p>
                </div>
                <input
                  type="checkbox"
                  className="switch-checkbox"
                  checked={notifPrefs.leave_status_alerts}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, leave_status_alerts: e.target.checked })}
                />
              </div>

              <div className="toggle-setting-row">
                <div className="toggle-info">
                  <h4>Daily Activity Digest</h4>
                  <p>Send automated morning summary of pending items</p>
                </div>
                <input
                  type="checkbox"
                  className="switch-checkbox"
                  checked={notifPrefs.daily_digest_enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, daily_digest_enabled: e.target.checked })}
                />
              </div>
            </div>

            <button className="btn-save" onClick={handleSaveNotifPrefs} disabled={isLoading}>
              {isLoading ? "Saving…" : "Save Notification Preferences"}
            </button>
          </>
        )}

        {/* 6. USERS & ROLE MANAGEMENT */}
        {activeTab === "users" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>User Accounts &amp; Role Management</h2>
              <p>Oversee user accounts, assign authorization tiers, and manage account statuses.</p>
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <input
                type="search"
                placeholder="Search user email or name…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", flex: "1 1 240px" }}
              />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                <option value="">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="HR_ADMIN">HR Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="EMPLOYEE">Employee</option>
              </select>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Assigned Role</th>
                  <th>Account Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{u.email}</div>
                    </td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "12px", border: "1px solid #cbd5e1" }}
                        disabled={user?.role !== "SUPER_ADMIN" && u.role === "SUPER_ADMIN"}
                      >
                        <option value="SUPER_ADMIN">Super Admin</option>
                        <option value="HR_ADMIN">HR Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="EMPLOYEE">Employee</option>
                      </select>
                    </td>
                    <td>
                      <span className={`status-tag ${u.is_active ? "active" : "terminated"}`}>
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td><code>{u.date_joined ? u.date_joined.split("T")[0] : "-"}</code></td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                      >
                        {u.is_active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 7. AUDIT TRAIL */}
        {activeTab === "audit" && isAdmin && (
          <>
            <div className="settings-header-block">
              <h2>Administrative Audit Trail</h2>
              <p>Tamper-evident logs of sensitive role reassignments and configuration changes.</p>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin Actor</th>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: "center", color: "#64748b" }}>No audit events logged yet.</td></tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td><code style={{ fontSize: "11px" }}>{new Date(log.created_at).toLocaleString()}</code></td>
                      <td>
                        <strong>{log.actor_name}</strong>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{log.actor_email}</div>
                      </td>
                      <td><code>{log.action}</code></td>
                      <td><span className="filter-chip">{log.category}</span></td>
                      <td style={{ fontSize: "12.5px" }}>{log.description}</td>
                      <td>
                        <span className="json-preview-badge" title={JSON.stringify(log.changes, null, 2)}>
                          {JSON.stringify(log.changes)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}

        {/* 8. PROFILE & SECURITY (AVAILABLE TO ALL USERS) */}
        {activeTab === "profile" && (
          <>
            <div className="settings-header-block">
              <h2>My Profile &amp; Security Settings</h2>
              <p>Manage your account personal details and update login credentials.</p>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ margin: "0", fontSize: "15px", color: "#1e293b" }}>Personal Details</h3>
              <div className="form-grid-2">
                <div className="form-group-block">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={profileData.first_name || ""}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group-block">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={profileData.last_name || ""}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                  />
                </div>
                <div className="form-group-block">
                  <label>Email Address</label>
                  <input type="email" value={profileData.email || ""} disabled style={{ background: "#f1f5f9" }} />
                </div>
                <div className="form-group-block">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    value={profileData.phone || ""}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-save" disabled={isLoading}>
                {isLoading ? "Saving…" : "Update Profile"}
              </button>
            </form>

            <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "10px 0" }} />

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h3 style={{ margin: "0", fontSize: "15px", color: "#1e293b" }}>Change Account Password</h3>
              <div className="form-grid-2">
                <div className="form-group-block">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={passwords.current_password}
                    onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-block">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwords.new_password}
                    onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group-block">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwords.confirm_password}
                    onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-save" disabled={isLoading}>
                {isLoading ? "Saving…" : "Change Password"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
