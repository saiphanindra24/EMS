import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../components/common/StatusBadge";

describe("StatusBadge Component", () => {
  it("renders attendance PRESENT badge with accessible aria-label", () => {
    render(<StatusBadge status="PRESENT" type="attendance" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Present");
    expect(badge).toHaveAttribute("aria-label", "attendance status: Present");
  });

  it("renders task IN_PROGRESS badge correctly", () => {
    render(<StatusBadge status="IN_PROGRESS" type="task" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("In Progress");
  });

  it("renders priority HIGH badge with correct styling and role", () => {
    render(<StatusBadge status="HIGH" type="priority" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("High");
  });

  it("renders leave APPROVED badge", () => {
    render(<StatusBadge status="APPROVED" type="leave" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Approved");
  });

  it("renders role SUPER_ADMIN badge", () => {
    render(<StatusBadge status="SUPER_ADMIN" type="role" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Super Admin");
  });

  it("returns null if status and label are empty", () => {
    const { container } = render(<StatusBadge status="" />);
    expect(container.firstChild).toBeNull();
  });
});
