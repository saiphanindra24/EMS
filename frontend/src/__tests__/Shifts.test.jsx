import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Shifts from "../components/Shifts";

// Hoisted mocks for Vitest
const { mockStats, mockTemplates, mockRoster, mockSwaps, mockOvertimes } = vi.hoisted(() => ({
  mockStats: {
    total_rostered_week: 12,
    active_shifts_today: 4,
    pending_swaps: 2,
    approved_ot_hours_month: 8.5,
    pending_ot_claims: 1,
  },
  mockTemplates: [
    {
      id: 1,
      code: "SHIFT_A",
      name: "Morning Shift (A)",
      formatted_timing: "06:00 - 14:30",
      grace_period_minutes: 15,
      break_duration_minutes: 45,
      is_night_shift: false,
      color_code: "#00ffcc",
      description: "Early morning industrial shift",
    },
    {
      id: 2,
      code: "SHIFT_C",
      name: "Night Graveyard (C)",
      formatted_timing: "22:00 - 06:30",
      grace_period_minutes: 15,
      break_duration_minutes: 45,
      is_night_shift: true,
      color_code: "#a855f7",
      description: "Overnight infrastructure coverage",
    },
  ],
  mockRoster: [
    {
      id: 101,
      employee: 1,
      employee_name: "Devin Booker",
      employee_role: "EMPLOYEE",
      shift_name: "Morning Shift (A)",
      shift_code: "SHIFT_A",
      shift_start_time: "06:00:00",
      shift_end_time: "14:30:00",
      shift_color: "#00ffcc",
      shift_is_night: false,
      date: "2026-10-15",
      status: "SCHEDULED",
      notes: "Release morning duty",
    },
  ],
  mockSwaps: [
    {
      id: 201,
      requester: 1,
      requester_name: "Devin Booker",
      requester_email: "devin@sskatttest.local",
      requester_shift_name: "Morning Shift (A)",
      requester_assignment_date: "2026-10-18",
      requester_shift_timing: "06:00 - 14:30",
      target_employee: 2,
      target_name: "Elena Rostova",
      target_email: "elena@sskatttest.local",
      target_shift_name: "Evening Swing (B)",
      target_assignment_date: "2026-10-18",
      target_shift_timing: "14:00 - 22:30",
      reason: "Doctor appointment during morning",
      target_status: "ACCEPTED",
      manager_status: "PENDING",
    },
  ],
  mockOvertimes: [
    {
      id: 301,
      employee: 1,
      employee_name: "Devin Booker",
      employee_email: "devin@sskatttest.local",
      date: "2026-10-14",
      start_time: "18:00:00",
      end_time: "20:30:00",
      hours: "2.50",
      rate_multiplier: "1.50",
      project_code: "PRJ-VOLKS-01",
      reason: "Emergency production deploy",
      status: "APPROVED",
      approver_name: "Marcus Vance",
    },
  ],
}));

vi.mock("../services/shiftService", () => ({
  default: {
    getShiftStats: vi.fn(() => Promise.resolve(mockStats)),
    getShiftTemplates: vi.fn(() => Promise.resolve(mockTemplates)),
    getRoster: vi.fn(() => Promise.resolve(mockRoster)),
    getMyRoster: vi.fn(() => Promise.resolve(mockRoster)),
    getSwapRequests: vi.fn(() => Promise.resolve(mockSwaps)),
    getOvertimeRecords: vi.fn(() => Promise.resolve(mockOvertimes)),
    submitSwapRequest: vi.fn(() => Promise.resolve({ success: true })),
    respondPeerSwap: vi.fn(() => Promise.resolve({ success: true })),
    reviewManagerSwap: vi.fn(() => Promise.resolve({ success: true })),
    submitOvertime: vi.fn(() => Promise.resolve({ success: true })),
    reviewOvertime: vi.fn(() => Promise.resolve({ success: true })),
    bulkAssignShifts: vi.fn(() => Promise.resolve({ success: true })),
    createShiftTemplate: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("../services/employeeService", () => ({
  default: {
    getEmployees: vi.fn(() => Promise.resolve([])),
    getAllEmployees: vi.fn(() => Promise.resolve([])),
  },
}));

describe("Shift Scheduling, Roster & Overtime Module", () => {
  const dummyUser = {
    id: 1,
    first_name: "Devin",
    last_name: "Booker",
    email: "devin@sskatttest.local",
    role: "MANAGER",
    is_staff: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Executive KPI summary cards with active shifts, pending swaps, and OT", async () => {
    render(<Shifts user={dummyUser} />);

    expect(await screen.findByText("Active Shifts Today")).toBeInTheDocument();
    expect(screen.getByText("Rostered This Week")).toBeInTheDocument();
    expect(screen.getByText("Pending Swap Trades")).toBeInTheDocument();
    expect(screen.getByText("Approved OT This Month")).toBeInTheDocument();
    expect(screen.getByText("8.5h")).toBeInTheDocument();
  });

  it("renders Roster Schedule cards with employee name and shift badge", async () => {
    render(<Shifts user={dummyUser} />);

    expect(await screen.findByText("Devin Booker")).toBeInTheDocument();
    expect(screen.getAllByText("Morning Shift (A)")[0]).toBeInTheDocument();
    expect(screen.getByText("2026-10-15")).toBeInTheDocument();
    expect(screen.getByText(/Propose Trade/i)).toBeInTheDocument();
  });

  it("switches to Shift Swap Board tab and renders swap requests", async () => {
    render(<Shifts user={dummyUser} />);

    const swapTabBtn = await screen.findByRole("button", { name: /Shift Swap Board/i });
    fireEvent.click(swapTabBtn);

    expect(await screen.findByText("Doctor appointment during morning")).toBeInTheDocument();
    expect(screen.getByText("Elena Rostova")).toBeInTheDocument();
    expect(screen.getByText("Manager Review")).toBeInTheDocument();
  });

  it("switches to Overtime Tracker tab and displays claimed OT hours and multipliers", async () => {
    render(<Shifts user={dummyUser} />);

    const otTabBtn = await screen.findByRole("button", { name: /Overtime Tracker/i });
    fireEvent.click(otTabBtn);

    expect(await screen.findByText("2.50 hrs")).toBeInTheDocument();
    expect(screen.getByText("1.50x")).toBeInTheDocument();
    expect(screen.getByText("Emergency production deploy")).toBeInTheDocument();
  });

  it("switches to Shift Templates tab and displays defined corporate shifts", async () => {
    render(<Shifts user={dummyUser} />);

    const tmplTabBtn = await screen.findByRole("button", { name: /Shift Templates/i });
    fireEvent.click(tmplTabBtn);

    expect(await screen.findByText("Night Graveyard (C)")).toBeInTheDocument();
    expect(screen.getByText("22:00 - 06:30")).toBeInTheDocument();
    expect(screen.getByText("🌙 Night Shift")).toBeInTheDocument();
  });

  it("opens the Claim Overtime modal when clicking the action button", async () => {
    render(<Shifts user={dummyUser} />);

    const claimBtn = await screen.findByRole("button", { name: /Claim Overtime/i });
    fireEvent.click(claimBtn);

    expect(screen.getByText("⏱️ Log Overtime Claim")).toBeInTheDocument();
    expect(screen.getByText("Total Duration (Hours) *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Claim/i })).toBeInTheDocument();
  });
});
