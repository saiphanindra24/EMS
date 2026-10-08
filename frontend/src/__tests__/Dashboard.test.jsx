import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Dashboard from "../components/Dashboard";
import * as AuthContextModule from "../context/AuthContext";
import { attendanceService } from "../services/attendanceService";
import { taskService } from "../services/taskService";
import { employeeService } from "../services/employeeService";
import { leaveService } from "../services/leaveService";

describe("Dashboard Component", () => {
  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: {
        id: 1,
        first_name: "Test",
        role: "SUPER_ADMIN",
      },
      roles: { is_super_admin: true, is_manager: true },
    });

    vi.spyOn(attendanceService, "getAttendanceStats").mockResolvedValue({
      date: "2026-10-08",
      total_employees: 10,
      present: 8,
      late: 1,
      absent: 1,
      on_leave: 0,
      average_work_hours: 7.8,
    });

    vi.spyOn(taskService, "getTasks").mockResolvedValue({
      count: 2,
      results: [
        {
          id: 101,
          task_id: "TSK-001",
          title: "Implement OAuth flow",
          assignee: { full_name: "Alice Smith" },
          priority: "HIGH",
          due_date: "2026-10-15",
          is_overdue: false,
          status: "IN_PROGRESS",
        },
      ],
    });

    vi.spyOn(taskService, "getTaskStats").mockResolvedValue({
      total_tasks: 12,
      completed_tasks: 9,
      in_progress_tasks: 2,
      todo_tasks: 1,
      overdue_tasks: 0,
      completion_rate: 75,
    });

    vi.spyOn(employeeService, "getEmployees").mockResolvedValue({
      count: 10,
      results: [],
    });

    vi.spyOn(leaveService, "getLeaves").mockResolvedValue({
      count: 3,
      results: [],
    });
    vi.spyOn(leaveService, "getLeaveRequests").mockResolvedValue({
      count: 3,
      results: [],
    });
  });

  it("renders loading spinner while loading", () => {
    render(<Dashboard onNavigate={vi.fn()} />);
    expect(screen.getByText(/Loading Real-Time Dashboard…/i)).toBeInTheDocument();
  });

  it("renders KPI cards and live metrics once resolved", async () => {
    render(<Dashboard onNavigate={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Total Workforce")).toBeInTheDocument();
    });

    expect(screen.getByText("Present Today")).toBeInTheDocument();
    expect(screen.getByText("Tasks In Progress")).toBeInTheDocument();
    expect(screen.getByText("Pending Leaves")).toBeInTheDocument();
    expect(screen.getByText("Implement OAuth flow")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("navigates to Tasks view on button click", async () => {
    const onNavigate = vi.fn();
    render(<Dashboard onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText("View all tasks →")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View all tasks →"));
    expect(onNavigate).toHaveBeenCalledWith("Tasks");
  });
});
