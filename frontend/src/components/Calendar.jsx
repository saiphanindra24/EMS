import { useState, useEffect, useRef } from "react";
import "./Calendar.css";
import { EventModal, EventDetailModal, CalendarFeedModal } from "./CalendarModals";
import { useAuth } from "../context/AuthContext";
import { taskService } from "../services/taskService";
import { leaveService } from "../services/leaveService";

export default function Calendar({ onNavigate }) {
  const { user } = useAuth();

  // Active user presentation name
  const employeeName =
    user?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "Employee";

  // Base calendar date: defaults to October 12, 2026
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 9, 12));
  const [viewMode, setViewMode] = useState("month"); // "month" | "week" | "agenda"

  // Calendars category definition based on employee workplace roles & schedules
  const [calendars, setCalendars] = useState(() => [
    {
      id: "my-tasks",
      name: `${employeeName}'s Assigned Tasks`,
      color: "#2563EB",
      colorClass: "event-color-blue",
      visible: true,
      targetPage: "Tasks",
    },
    {
      id: "morning-scrum",
      name: "Morning Scrum Call (Daily Standup)",
      color: "#DC2626",
      colorClass: "event-color-red",
      visible: true,
      targetPage: "Tasks",
    },
    {
      id: "evening-update",
      name: "Evening Work Update Call (Wrap-up)",
      color: "#334E68",
      colorClass: "event-color-slate",
      visible: true,
      targetPage: "Attendance",
    },
    {
      id: "sprints",
      name: "Sprint Milestones & Demos",
      color: "#8B5CF6",
      colorClass: "event-color-purple",
      visible: true,
      targetPage: "Tasks",
    },
    {
      id: "leaves",
      name: "Leave & Holiday Schedules",
      color: "#B45309",
      colorClass: "event-color-brown",
      visible: true,
      targetPage: "Leave",
    },
    {
      id: "one-on-one",
      name: "1:1 Reviews & Team Check-ins",
      color: "#059669",
      colorClass: "event-color-green",
      visible: true,
      targetPage: "Employees",
    },
  ]);

  // Keep employee name updated if user loads later
  useEffect(() => {
    if (employeeName) {
      setCalendars((prev) =>
        prev.map((c) =>
          c.id === "my-tasks"
            ? { ...c, name: `${employeeName}'s Assigned Tasks` }
            : c
        )
      );
    }
  }, [employeeName]);

  // Generate weekday recurring workplace calls for month (Morning Scrum & Evening Work Update)
  const generateRecurringCalls = (targetYear = 2026, targetMonth = 9) => {
    const recurringEvents = [];
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInTargetMonth; day++) {
      const d = new Date(targetYear, targetMonth, day);
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat

      // Weekdays only (Monday to Friday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const mm = String(targetMonth + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        const dateStr = `${targetYear}-${mm}-${dd}`;

        // 1. Morning Scrum Call (09:30 AM)
        recurringEvents.push({
          id: `scrum-${dateStr}`,
          title: "Morning Scrum Call",
          calendarId: "morning-scrum",
          type: "meeting",
          date: dateStr,
          startTime: "09:30",
          endTime: "10:00",
          isAllDay: false,
          description: `Daily standup for ${employeeName} and team: 1) Yesterday's progress, 2) Today's deliverables, 3) Blockers and technical sync.`,
          targetPage: "Tasks",
        });

        // 2. Evening Work Update Call (05:00 PM)
        recurringEvents.push({
          id: `update-${dateStr}`,
          title: "Evening Work Update Call",
          calendarId: "evening-update",
          type: "meeting",
          date: dateStr,
          startTime: "17:00",
          endTime: "17:30",
          isAllDay: false,
          description: `Daily evening wrap-up call: review merged PRs, summarize completed hours, and confirm attendance punch-out.`,
          targetPage: "Attendance",
        });
      }
    }

    // Add Key Sprints and Team Milestones in October 2026
    recurringEvents.push(
      {
        id: "sprint-plan-1",
        title: "Sprint 42 Planning & Backlog Grooming",
        calendarId: "sprints",
        type: "milestone",
        date: "2026-10-05",
        startTime: "11:00",
        endTime: "12:30",
        isAllDay: false,
        description: "Sprint commitment & Jira task point estimation for Q4 roadmap.",
        targetPage: "Tasks",
      },
      {
        id: "sprint-mid-check",
        title: "Sprint Mid-Cycle Review & QA Sync",
        calendarId: "sprints",
        type: "milestone",
        date: "2026-10-12",
        startTime: "14:00",
        endTime: "15:00",
        isAllDay: false,
        description: "Mid-sprint velocity tracking and staging deployment verification.",
        targetPage: "Tasks",
      },
      {
        id: "one-on-one-1",
        title: "1:1 Sync with Manager",
        calendarId: "one-on-one",
        type: "meeting",
        date: "2026-10-16",
        startTime: "15:30",
        endTime: "16:00",
        isAllDay: false,
        description: "Bi-weekly 1-on-1 career growth and bandwidth sync.",
        targetPage: "Employees",
      },
      {
        id: "sprint-demo-1",
        title: "Sprint 42 Demo & Retrospective",
        calendarId: "sprints",
        type: "milestone",
        date: "2026-10-19",
        startTime: "16:00",
        endTime: "17:00",
        isAllDay: false,
        description: "Sprint deliverables demo for stakeholders and retro discussion.",
        targetPage: "Reports",
      },
      {
        id: "sprint-plan-2",
        title: "Sprint 43 Kickoff & Architecture Review",
        calendarId: "sprints",
        type: "milestone",
        date: "2026-10-26",
        startTime: "11:00",
        endTime: "12:30",
        isAllDay: false,
        description: "Next sprint kickoff and backend schema design walkthrough.",
        targetPage: "Tasks",
      }
    );

    return recurringEvents;
  };

  // Events list state
  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem("emwts_events_v2");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return generateRecurringCalls(2026, 9);
  });

  // Undated backlog items
  const [undatedItems, setUndatedItems] = useState([
    { id: "undated-1", title: "Complete Q4 Workplace OKR Form", calendarId: "my-tasks", targetPage: "Employees" },
    { id: "undated-2", title: "Update Emergency Contact Info", calendarId: "my-tasks", targetPage: "Settings" },
    { id: "undated-3", title: "Security Awareness Refresher Module", calendarId: "my-tasks", targetPage: "Tasks" },
  ]);

  // Load real employee Tasks and Leave requests from backend API
  useEffect(() => {
    let isMounted = true;

    async function loadEmployeeData() {
      try {
        const [tasksRes, leavesRes] = await Promise.allSettled([
          taskService.getTasks({ page_size: 100 }),
          leaveService.getLeaves({ page_size: 50 }),
        ]);

        const fetchedEvents = [];
        const fetchedUndated = [];

        // 1. Process Tasks
        if (tasksRes.status === "fulfilled" && tasksRes.value?.results) {
          tasksRes.value.results.forEach((task) => {
            if (task.due_date) {
              fetchedEvents.push({
                id: `api-task-${task.id}`,
                title: task.title,
                calendarId: "my-tasks",
                type: "task",
                date: task.due_date,
                startTime: "17:00",
                endTime: "18:00",
                isAllDay: true,
                description: task.description || `Task #${task.task_id} (${task.priority} Priority, Status: ${task.status})`,
                targetPage: "Tasks",
                status: task.status,
                priority: task.priority,
              });
            } else {
              fetchedUndated.push({
                id: `api-task-undated-${task.id}`,
                title: task.title,
                calendarId: "my-tasks",
                targetPage: "Tasks",
              });
            }
          });
        }

        // 2. Process Leaves
        if (leavesRes.status === "fulfilled" && leavesRes.value?.results) {
          leavesRes.value.results.forEach((leave) => {
            if (leave.start_date) {
              fetchedEvents.push({
                id: `api-leave-${leave.id}`,
                title: `${leave.leave_type_name || "Leave"}: ${leave.employee_name || employeeName}`,
                calendarId: "leaves",
                type: "milestone",
                date: leave.start_date,
                startTime: "09:00",
                endTime: "18:00",
                isAllDay: true,
                description: `Reason: ${leave.reason || "Scheduled Time Off"} (Status: ${leave.status})`,
                targetPage: "Leave",
              });
            }
          });
        }

        if (isMounted && (fetchedEvents.length > 0 || fetchedUndated.length > 0)) {
          setEvents((prev) => {
            // Keep unique items
            const existingIds = new Set(prev.map((e) => e.id));
            const newItems = fetchedEvents.filter((e) => !existingIds.has(e.id));
            return [...prev, ...newItems];
          });

          if (fetchedUndated.length > 0) {
            setUndatedItems((prev) => {
              const existingIds = new Set(prev.map((u) => u.id));
              const newItems = fetchedUndated.filter((u) => !existingIds.has(u.id));
              return [...prev, ...newItems];
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch employee tasks/leaves for calendar", err);
      }
    }

    loadEmployeeData();

    return () => {
      isMounted = false;
    };
  }, [employeeName]);

  // Persist events to localStorage
  useEffect(() => {
    localStorage.setItem("emwts_events_v2", JSON.stringify(events));
  }, [events]);

  // Collapsible sections
  const [calendarsExpanded, setCalendarsExpanded] = useState(true);
  const [undatedExpanded, setUndatedExpanded] = useState(false);

  // Popover datepicker
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const popoverRef = useRef(null);

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalMode, setEventModalMode] = useState("create");
  const [selectedEventData, setSelectedEventData] = useState(null);

  const [selectedDetailEvent, setSelectedDetailEvent] = useState(null);
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
    }
    if (isDatePickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDatePickerOpen]);

  // Navigation handlers
  const handleToday = () => {
    setCurrentDate(new Date(2026, 9, 12));
  };

  const handlePrev = () => {
    if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
    }
  };

  // Toggle calendar filter visibility
  const toggleCalendarVisibility = (id) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  // Create / Edit Event
  const handleOpenAddEvent = (presetDate = null) => {
    setEventModalMode("create");
    setSelectedEventData(presetDate ? { date: presetDate } : null);
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (savedEvent) => {
    if (eventModalMode === "create") {
      setEvents((prev) => [...prev, savedEvent]);
    } else {
      setEvents((prev) =>
        prev.map((evt) => (evt.id === savedEvent.id ? savedEvent : evt))
      );
    }
  };

  const handleDeleteEvent = (id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // Quick navigation to related page
  const handleDirectNavigate = (targetPage) => {
    if (onNavigate && targetPage) {
      onNavigate(targetPage);
    }
  };

  // Active visible calendar map
  const activeCalendarMap = new Map();
  calendars.forEach((c) => {
    if (c.visible) activeCalendarMap.set(c.id, c);
  });

  const visibleEvents = events.filter((e) => activeCalendarMap.has(e.calendarId));

  // Calendar dates generation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthTitle = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Days in month calculation for Month View (Sunday first)
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  const monthGridDays = [];

  // Trailing previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = prevMonthLastDate - i;
    const prevDate = new Date(year, month - 1, d);
    const dateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    monthGridDays.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: false,
      dateObj: prevDate,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(year, month, d);
    monthGridDays.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: true,
      dateObj,
    });
  }

  // Leading next month days
  const totalCells = Math.ceil(monthGridDays.length / 7) * 7;
  const remaining = totalCells - monthGridDays.length;
  for (let d = 1; d <= remaining; d++) {
    const nextDate = new Date(year, month + 1, d);
    const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    monthGridDays.push({
      dayNumber: d,
      dateStr,
      isCurrentMonth: false,
      dateObj: nextDate,
    });
  }

  // Split into 7-day rows
  const weeks = [];
  for (let i = 0; i < monthGridDays.length; i += 7) {
    weeks.push(monthGridDays.slice(i, i + 7));
  }

  // Group events by date
  const eventsByDate = {};
  visibleEvents.forEach((evt) => {
    if (!eventsByDate[evt.date]) eventsByDate[evt.date] = [];
    eventsByDate[evt.date].push(evt);
  });

  // Week View calculation
  const currentDayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDayOfWeek);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    weekDays.push({
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: d.getDate(),
      dateStr,
      dateObj: d,
    });
  }

  // Agenda View items
  const sortedAgendaEvents = [...visibleEvents].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const agendaGrouped = {};
  sortedAgendaEvents.forEach((e) => {
    if (!agendaGrouped[e.date]) agendaGrouped[e.date] = [];
    agendaGrouped[e.date].push(e);
  });

  // Is today helper (Oct 12, 2026)
  const isDateToday = (dateStr) => dateStr === "2026-10-12";

  return (
    <div className="calendar-page-container">
      <div className="calendar-layout-wrapper">
        {/* ─── Left / Center: Main Calendar ──────────────────────────────── */}
        <section className="calendar-main-pane">
          {/* ── Top Bar ── */}
          <div className="calendar-toolbar">
            <div className="calendar-nav-controls">
              <button
                type="button"
                className="cal-btn"
                onClick={handleToday}
                id="cal-today-btn"
              >
                Today
              </button>

              <div className="cal-nav-arrows">
                <button
                  type="button"
                  className="cal-nav-arrow-btn"
                  onClick={handlePrev}
                  aria-label="Previous"
                  id="cal-prev-btn"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="cal-nav-arrow-btn"
                  onClick={handleNext}
                  aria-label="Next"
                  id="cal-next-btn"
                >
                  →
                </button>
              </div>

              {/* Jump to Date Input with Popover */}
              <div className="cal-jump-input-wrapper" ref={popoverRef}>
                <input
                  type="text"
                  readOnly
                  className="cal-jump-input"
                  value={monthTitle}
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  aria-label="Jump to month or date"
                />
                <button
                  type="button"
                  className="cal-jump-icon-btn"
                  onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  aria-label="Open date picker popover"
                >
                  📅
                </button>

                {isDatePickerOpen && (
                  <div className="cal-date-picker-popover">
                    <div className="popover-header">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(currentDate);
                          d.setMonth(d.getMonth() - 1);
                          setCurrentDate(d);
                        }}
                      >
                        ◀
                      </button>
                      <span>{monthTitle}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(currentDate);
                          d.setMonth(d.getMonth() + 1);
                          setCurrentDate(d);
                        }}
                      >
                        ▶
                      </button>
                    </div>

                    <div className="popover-days-grid">
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((wd) => (
                        <span key={wd} className="popover-day-name">
                          {wd}
                        </span>
                      ))}

                      {monthGridDays.slice(0, 35).map((cell, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`popover-day-btn ${
                            !cell.isCurrentMonth ? "other-month" : ""
                          } ${
                            isDateToday(cell.dateStr) ? "today" : ""
                          } ${
                            cell.dateStr ===
                            `${currentDate.getFullYear()}-${String(
                              currentDate.getMonth() + 1
                            ).padStart(2, "0")}-${String(
                              currentDate.getDate()
                            ).padStart(2, "0")}`
                              ? "selected"
                              : ""
                          }`}
                          onClick={() => {
                            setCurrentDate(cell.dateObj);
                            setIsDatePickerOpen(false);
                          }}
                        >
                          {cell.dayNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Controls: View Switcher & Add Button */}
            <div className="calendar-view-controls">
              <div className="cal-view-group">
                <button
                  type="button"
                  className={`cal-view-btn ${viewMode === "week" ? "active" : ""}`}
                  onClick={() => setViewMode("week")}
                >
                  Week
                </button>
                <button
                  type="button"
                  className={`cal-view-btn ${viewMode === "month" ? "active" : ""}`}
                  onClick={() => setViewMode("month")}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`cal-view-btn ${viewMode === "agenda" ? "active" : ""}`}
                  onClick={() => setViewMode("agenda")}
                >
                  Agenda
                </button>
              </div>

              <button
                type="button"
                className="cal-add-btn"
                onClick={() => handleOpenAddEvent()}
                aria-label="Add event"
                id="cal-add-event-btn"
                title="Add workplace event, scrum call, or task"
              >
                +
              </button>
            </div>
          </div>

          {/* ── Main View Bodies ── */}
          {viewMode === "month" && (
            <div className="calendar-month-grid">
              {/* Weekdays Row */}
              <div className="cal-weekdays-header">
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                  <div key={day} className="cal-weekday-col">
                    {day}
                  </div>
                ))}
              </div>

              {/* Month Weeks Container */}
              <div className="cal-month-days-container">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="cal-month-week-row">
                    {week.map((cell, cIdx) => {
                      const dayEvents = eventsByDate[cell.dateStr] || [];
                      const isToday = isDateToday(cell.dateStr);

                      return (
                        <div
                          key={cIdx}
                          className={`cal-day-cell ${
                            !cell.isCurrentMonth ? "other-month" : ""
                          } ${isToday ? "today" : ""}`}
                          onClick={(e) => {
                            if (e.target.closest(".cal-event-pill")) return;
                            handleOpenAddEvent(cell.dateStr);
                          }}
                        >
                          <div className="cal-day-cell-header">
                            <span className="cal-day-number">{cell.dayNumber}</span>
                          </div>

                          <div className="cal-cell-events-list">
                            {dayEvents.map((evt) => {
                              const cal = activeCalendarMap.get(evt.calendarId);
                              const colorClass = cal?.colorClass || "event-color-slate";
                              const icon =
                                evt.type === "meeting"
                                  ? "👥"
                                  : evt.type === "milestone"
                                  ? "🚩"
                                  : "📋";

                              return (
                                <div
                                  key={evt.id}
                                  className={`cal-event-pill ${colorClass}`}
                                  title={`${evt.title} (${cal?.name || ""}) — Click to view details or navigate to ${evt.targetPage || "module"}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailEvent(evt);
                                  }}
                                >
                                  <span className="cal-event-icon">{icon}</span>
                                  <span className="cal-event-title">{evt.title}</span>
                                  {evt.targetPage && (
                                    <span
                                      className="cal-event-nav-arrow"
                                      title={`Jump to ${evt.targetPage}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDirectNavigate(evt.targetPage);
                                      }}
                                    >
                                      ↗
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "week" && (
            <div className="cal-week-view">
              <div className="cal-week-header">
                {weekDays.map((wd) => (
                  <div
                    key={wd.dateStr}
                    className={`cal-week-header-day ${
                      isDateToday(wd.dateStr) ? "today" : ""
                    }`}
                  >
                    <div className="cal-week-day-title">{wd.name}</div>
                    <div className="cal-week-day-num">{wd.dayNumber}</div>
                  </div>
                ))}
              </div>

              <div className="cal-week-grid">
                {weekDays.map((wd) => {
                  const dayEvents = eventsByDate[wd.dateStr] || [];
                  const isToday = isDateToday(wd.dateStr);

                  return (
                    <div
                      key={wd.dateStr}
                      className={`cal-week-col ${isToday ? "today" : ""}`}
                      onClick={() => handleOpenAddEvent(wd.dateStr)}
                    >
                      {dayEvents.map((evt) => {
                        const cal = activeCalendarMap.get(evt.calendarId);
                        const colorClass = cal?.colorClass || "event-color-slate";
                        const icon = evt.type === "meeting" ? "👥" : "📋";

                        return (
                          <div
                            key={evt.id}
                            className={`cal-event-pill ${colorClass}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDetailEvent(evt);
                            }}
                          >
                            <span className="cal-event-icon">{icon}</span>
                            <span className="cal-event-title">{evt.title}</span>
                            {evt.targetPage && (
                              <span
                                className="cal-event-nav-arrow"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDirectNavigate(evt.targetPage);
                                }}
                              >
                                ↗
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "agenda" && (
            <div className="cal-agenda-view">
              {Object.keys(agendaGrouped).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  No scheduled workplace events in the selected calendars.
                </div>
              ) : (
                Object.entries(agendaGrouped).map(([dateStr, items]) => {
                  const dateObj = new Date(dateStr + "T00:00:00");
                  const formatted = dateObj.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                  const isToday = isDateToday(dateStr);

                  return (
                    <div key={dateStr} className="cal-agenda-date-group">
                      <div className="cal-agenda-date-header">
                        <span>{formatted}</span>
                        {isToday && <span className="cal-agenda-today-tag">TODAY</span>}
                      </div>

                      <div className="cal-agenda-items">
                        {items.map((item) => {
                          const cal = activeCalendarMap.get(item.calendarId);
                          const icon = item.type === "meeting" ? "👥" : "📋";

                          return (
                            <div
                              key={item.id}
                              className="cal-agenda-item-card"
                              style={{ borderLeftColor: cal?.color || "#6b7280" }}
                              onClick={() => setSelectedDetailEvent(item)}
                            >
                              <div className="cal-agenda-card-left">
                                <span className="cal-agenda-time">
                                  {item.isAllDay ? "All Day" : item.startTime}
                                </span>
                                <span style={{ fontSize: 16 }}>{icon}</span>
                                <div>
                                  <div className="cal-agenda-title">{item.title}</div>
                                  <div className="cal-agenda-category">
                                    {cal?.name || "General"}
                                    {item.targetPage && ` · Linked to ${item.targetPage}`}
                                  </div>
                                </div>
                              </div>
                              <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 600 }}>
                                Open ›
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* ─── Right Sidebar ─────────────────────────────────────────────── */}
        <aside className="calendar-sidebar" aria-label="Calendar Sidebar">
          {/* Mini Calendar Widget */}
          <div className="mini-calendar-widget">
            <div className="mini-cal-header">
              <button
                type="button"
                className="mini-cal-nav-btn"
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setMonth(d.getMonth() - 1);
                  setCurrentDate(d);
                }}
                aria-label="Previous Month"
              >
                ◀
              </button>
              <div className="mini-cal-title">{monthTitle}</div>
              <button
                type="button"
                className="mini-cal-nav-btn"
                onClick={() => {
                  const d = new Date(currentDate);
                  d.setMonth(d.getMonth() + 1);
                  setCurrentDate(d);
                }}
                aria-label="Next Month"
              >
                ▶
              </button>
            </div>

            <div className="mini-cal-grid">
              {monthGridDays.slice(0, 35).map((cell, idx) => {
                const hasEvents = (eventsByDate[cell.dateStr] || []).length > 0;
                const isToday = isDateToday(cell.dateStr);

                return (
                  <div
                    key={idx}
                    className={`mini-cal-day-cell ${
                      !cell.isCurrentMonth ? "other-month" : ""
                    } ${isToday ? "today" : ""} ${hasEvents ? "has-events" : ""}`}
                    onClick={() => setCurrentDate(cell.dateObj)}
                  >
                    {cell.dayNumber}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendars Filter List */}
          <div>
            <div
              className="sidebar-section-header"
              onClick={() => setCalendarsExpanded(!calendarsExpanded)}
            >
              <span className="sidebar-section-toggle-icon">
                {calendarsExpanded ? "▼" : "▶"}
              </span>
              <span>CALENDARS</span>
            </div>

            {calendarsExpanded && (
              <div className="calendars-filter-list">
                {calendars.map((cal) => (
                  <div key={cal.id} className="cal-filter-item">
                    <div
                      className={`cal-filter-left ${!cal.visible ? "inactive" : ""}`}
                      onClick={() => toggleCalendarVisibility(cal.id)}
                    >
                      <span
                        className="cal-swatch-box"
                        style={{ backgroundColor: cal.color }}
                      />
                      <span className="cal-filter-label" title={cal.name}>
                        {cal.name}
                      </span>
                    </div>
                    {cal.targetPage && (
                      <button
                        type="button"
                        className="cal-item-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDirectNavigate(cal.targetPage);
                        }}
                        title={`Go to ${cal.targetPage} Page`}
                        style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}
                      >
                        ↗
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Undated Items Collapsible */}
          <div>
            <div
              className="sidebar-section-header"
              onClick={() => setUndatedExpanded(!undatedExpanded)}
            >
              <span className="sidebar-section-toggle-icon">
                {undatedExpanded ? "▼" : "▶"}
              </span>
              <span>UNDATED BACKLOG</span>
            </div>

            {undatedExpanded && (
              <div className="undated-items-list">
                {undatedItems.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#9ca3af", padding: "4px 0" }}>
                    No undated assignments
                  </div>
                ) : (
                  undatedItems.map((item) => (
                    <div key={item.id} className="undated-item-card">
                      <span
                        className="undated-item-title"
                        title={item.title}
                        style={{ cursor: item.targetPage ? "pointer" : "default" }}
                        onClick={() => {
                          if (item.targetPage) handleDirectNavigate(item.targetPage);
                        }}
                      >
                        {item.title}
                      </span>
                      <button
                        type="button"
                        className="undated-schedule-btn"
                        onClick={() => {
                          const yyyy = currentDate.getFullYear();
                          const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
                          const dd = String(currentDate.getDate()).padStart(2, "0");
                          handleOpenAddEvent(`${yyyy}-${mm}-${dd}`);
                          setSelectedEventData({
                            title: item.title,
                            calendarId: item.calendarId,
                            targetPage: item.targetPage,
                            date: `${yyyy}-${mm}-${dd}`,
                          });
                          setUndatedItems((prev) => prev.filter((u) => u.id !== item.id));
                        }}
                      >
                        + Schedule
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Calendar Feed Link */}
          <div className="calendar-feed-section">
            <button
              type="button"
              className="calendar-feed-link"
              onClick={() => setIsFeedModalOpen(true)}
            >
              <span className="calendar-feed-icon">📅</span>
              <span>Calendar Feed</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      <EventModal
        isOpen={isEventModalOpen}
        mode={eventModalMode}
        initialData={selectedEventData}
        calendars={calendars}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
      />

      <EventDetailModal
        event={selectedDetailEvent}
        calendar={
          selectedDetailEvent
            ? calendars.find((c) => c.id === selectedDetailEvent.calendarId)
            : null
        }
        onClose={() => setSelectedDetailEvent(null)}
        onEdit={(evt) => {
          setEventModalMode("edit");
          setSelectedEventData(evt);
          setIsEventModalOpen(true);
        }}
        onDelete={handleDeleteEvent}
        onNavigate={handleDirectNavigate}
      />

      <CalendarFeedModal
        isOpen={isFeedModalOpen}
        onClose={() => setIsFeedModalOpen(false)}
      />
    </div>
  );
}
