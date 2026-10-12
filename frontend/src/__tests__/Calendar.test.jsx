import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Calendar from "../components/Calendar";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      first_name: "Ananya",
      last_name: "Rao",
      email: "ananya.rao@emwts.local",
      role: "EMPLOYEE",
    },
  }),
}));

// Mock taskService and leaveService
vi.mock("../services/taskService", () => ({
  taskService: {
    getTasks: vi.fn().mockResolvedValue({
      results: [
        {
          id: 101,
          task_id: "TSK-101",
          title: "Build Responsive Navbar Component",
          due_date: "2026-10-12",
          status: "IN_PROGRESS",
          priority: "HIGH",
        },
      ],
    }),
  },
}));

vi.mock("../services/leaveService", () => ({
  leaveService: {
    getLeaves: vi.fn().mockResolvedValue({
      results: [],
    }),
  },
}));

describe("Calendar Component with Workplace Data & Navigation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders toolbar controls: Today, arrows, view switchers, and add button", () => {
    render(<Calendar onNavigate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add event" })).toBeInTheDocument();
  });

  it("renders recurring workplace calls: Morning Scrum Call and Evening Work Update Call", () => {
    render(<Calendar onNavigate={vi.fn()} />);

    const scrumCalls = screen.getAllByText("Morning Scrum Call");
    expect(scrumCalls.length).toBeGreaterThan(0);

    const updateCalls = screen.getAllByText("Evening Work Update Call");
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it("navigates to related page when clicking detail modal navigation button", async () => {
    const handleNavigate = vi.fn();
    render(<Calendar onNavigate={handleNavigate} />);

    // Click on Morning Scrum Call
    const firstScrumCall = screen.getAllByText("Morning Scrum Call")[0];
    fireEvent.click(firstScrumCall);

    // Detail modal should open
    const openModuleBtn = screen.getByRole("button", { name: /Open Tasks Page/i });
    expect(openModuleBtn).toBeInTheDocument();

    fireEvent.click(openModuleBtn);
    expect(handleNavigate).toHaveBeenCalledWith("Tasks");
  });

  it("switches to Week view and Agenda view", () => {
    render(<Calendar onNavigate={vi.fn()} />);

    const weekBtn = screen.getByRole("button", { name: "Week" });
    fireEvent.click(weekBtn);
    expect(weekBtn).toHaveClass("active");

    const agendaBtn = screen.getByRole("button", { name: "Agenda" });
    fireEvent.click(agendaBtn);
    expect(agendaBtn).toHaveClass("active");
  });

  it("opens Add Event modal when + button is clicked", () => {
    render(<Calendar onNavigate={vi.fn()} />);

    const addBtn = screen.getByRole("button", { name: "Add event" });
    fireEvent.click(addBtn);

    expect(screen.getByText("Add Workplace Event / Task")).toBeInTheDocument();
    expect(screen.getByLabelText("Title / Agenda *")).toBeInTheDocument();
  });
});
