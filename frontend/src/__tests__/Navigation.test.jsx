import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../App";
import * as AuthContextModule from "../context/AuthContext";

describe("Role-Aware Navigation & Shell", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], count: 0, total_employees: 0, total_tasks: 0 }),
    });
  });

  it("renders Reports navigation tab for SUPER_ADMIN", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 1,
        email: "admin@emwts.local",
        first_name: "Admin",
        last_name: "User",
        role: "SUPER_ADMIN",
      },
      roles: {
        role: "SUPER_ADMIN",
        is_super_admin: true,
        is_hr_admin: true,
        is_manager: true,
        is_employee: true,
      },
      logout: vi.fn(),
    });

    render(<App />);

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("button", { name: /Reports/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Employees/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Attendance/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Tasks/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Leave/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Settings/i })).toBeInTheDocument();
  });

  it("does not render Reports navigation tab for EMPLOYEE", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 10,
        email: "employee@emwts.local",
        first_name: "Jane",
        last_name: "Doe",
        role: "EMPLOYEE",
      },
      roles: {
        role: "EMPLOYEE",
        is_super_admin: false,
        is_hr_admin: false,
        is_manager: false,
        is_employee: true,
      },
      logout: vi.fn(),
    });

    render(<App />);

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryByRole("button", { name: /Reports/i })).not.toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Dashboard/i })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: /Attendance/i })).toBeInTheDocument();
  });

  it("toggles mobile menu drawer on mobile button click", () => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 1,
        email: "admin@emwts.local",
        first_name: "Admin",
        role: "SUPER_ADMIN",
      },
      roles: { is_super_admin: true },
      logout: vi.fn(),
    });

    render(<App />);

    const toggleBtn = screen.getByRole("button", { name: /Toggle navigation menu/i });
    expect(toggleBtn).toBeInTheDocument();

    const sidebar = screen.getByLabelText("Main Navigation");
    expect(sidebar).not.toHaveClass("open");

    fireEvent.click(toggleBtn);
    expect(sidebar).toHaveClass("open");

    const closeBtn = screen.getByRole("button", { name: /Close menu/i });
    fireEvent.click(closeBtn);
    expect(sidebar).not.toHaveClass("open");
  });
});
