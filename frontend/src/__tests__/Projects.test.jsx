import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Projects from "../components/Projects";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      first_name: "Admin",
      last_name: "User",
      email: "admin@sskatt.local",
      role: "SUPER_ADMIN",
    },
  }),
}));

vi.mock("../services/projectService", () => ({
  default: {
    getProjects: vi.fn().mockResolvedValue([
      {
        id: 1,
        code: "PRJ-101",
        name: "SSKATT EWTS Workplace Suite",
        client_name: "VolkssKatt Global",
        description: "Enterprise work tracking modernization with attendance and sprint sync.",
        status: "IN_PROGRESS",
        status_display: "In Progress",
        health: "ON_TRACK",
        health_display: "On Track",
        budget: "2500000.00",
        spent_budget: "1150000.00",
        progress_percentage: 75,
        lead_name: "Arjun Mehta",
        memberships: [
          { employee_name: "Arjun Mehta", employee_id_code: "EMP-005", role: "Lead" },
          { employee_name: "Ananya Rao", employee_id_code: "EMP-004", role: "Frontend Dev" },
        ],
        milestones: [
          { id: 10, title: "Core RBAC & Attendance Sync", is_achieved: true, due_date: "2026-09-30" },
          { id: 11, title: "Project Management & DWR Module", is_achieved: false, due_date: "2026-10-25" },
        ],
      },
    ]),
    getProjectStats: vi.fn().mockResolvedValue({
      total_projects: 2,
      active_projects: 2,
      completed_projects: 0,
      total_budget: "7000000.00",
      total_spent: "2800000.00",
    }),
    getDailyWorkReports: vi.fn().mockResolvedValue([
      {
        id: 1,
        employee_name: "Ananya Rao",
        employee_id_code: "EMP-004",
        department_name: "Engineering",
        project_name: "SSKATT EWTS Workplace Suite",
        report_date: "2026-10-13",
        hours_worked: "8.00",
        activities_summary: "Built Projects & DWR UI tabs, verified live tests.",
        issues_faced: "None",
        plan_for_tomorrow: "Milestone completion checklist",
        status: "APPROVED",
        status_display: "Approved",
      },
    ]),
    getTodayReportStatus: vi.fn().mockResolvedValue({
      has_submitted: true,
      report: {
        hours_worked: "8.00",
        status_display: "Approved",
      },
    }),
    toggleMilestone: vi.fn().mockResolvedValue({ is_achieved: true }),
    submitDailyWorkReport: vi.fn().mockResolvedValue({ message: "Submitted" }),
    createProject: vi.fn().mockResolvedValue({ message: "Created" }),
    reviewDailyWorkReport: vi.fn().mockResolvedValue({ message: "Reviewed" }),
  },
}));

describe("SSKATT EWTS — Projects & Daily Work Reports Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders projects executive header, action buttons, and KPI cards", async () => {
    render(<Projects />);

    expect(screen.getByText(/Projects & Daily Work Tracking/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ New Project/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Daily Report/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Active Projects/i)).toBeInTheDocument();
      expect(screen.getByText(/Committed Client Budget/i)).toBeInTheDocument();
      expect(screen.getByText(/Daily Reports Today/i)).toBeInTheDocument();
    });
  });

  it("renders project card with code, title, and milestone progress", async () => {
    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText("PRJ-101")).toBeInTheDocument();
      expect(screen.getByText("SSKATT EWTS Workplace Suite")).toBeInTheDocument();
      expect(screen.getByText(/Client: VolkssKatt Global/i)).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });
  });

  it("switches to Daily Work Reports tab and renders submitted reports", async () => {
    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText(/Daily Work Reports Feed/i)).toBeInTheDocument();
    });

    const dwrTabBtn = screen.getByRole("button", { name: /Daily Work Reports Feed/i });
    fireEvent.click(dwrTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Today's Work Report is Logged/i)).toBeInTheDocument();
      expect(screen.getByText("Ananya Rao")).toBeInTheDocument();
      expect(screen.getByText(/Built Projects & DWR UI tabs/i)).toBeInTheDocument();
    });
  });

  it("opens project inspection modal with milestones checklist", async () => {
    render(<Projects />);

    await waitFor(() => {
      expect(screen.getByText("PRJ-101")).toBeInTheDocument();
    });

    const inspectBtn = screen.getByRole("button", { name: /Milestones & Team →/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByText(/Core RBAC & Attendance Sync/i)).toBeInTheDocument();
      expect(screen.getByText(/Project Management & DWR Module/i)).toBeInTheDocument();
      expect(screen.getByText(/Allocated Resource Team/i)).toBeInTheDocument();
    });
  });

  it("opens Submit DWR modal when action button is clicked", async () => {
    render(<Projects />);

    const submitBtn = screen.getByRole("button", { name: /Submit Daily Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Submit Daily Work Report \(DWR\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Hours Worked Today:/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Submit Daily Log/i })).toBeInTheDocument();
    });
  });
});
