import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Expenses from "../components/Expenses";

const { mockClaims, mockStats, mockProjects } = vi.hoisted(() => {
  const claims = [
    {
      id: 1,
      claim_number: "EXP-2026-001",
      employee_name: "Arjun Mehta",
      employee_id: "EMP-001",
      department_name: "Engineering",
      project_code: "PRJ-101",
      project_name: "SSKATT EWTS Workplace Suite",
      title: "Client Onsite Workshop - Flight & Hotel",
      category: "TRAVEL",
      category_display: "Travel & Accommodation",
      expense_date: "2026-10-10",
      currency: "INR",
      amount: "18500.00",
      tax_amount: "2220.00",
      total_amount: "20720.00",
      is_billable: true,
      receipt_url: "https://example.com/receipt.jpg",
      description: "Roundtrip flights to Bengaluru for client architecture walkthrough.",
      status: "REIMBURSED",
      status_display: "Settled & Reimbursed",
      manager_reviewer_name: "Admin User",
      manager_reviewed_at: "2026-10-11T10:00:00Z",
      manager_notes: "Approved per client budget.",
      finance_reviewer_name: "Admin User",
      finance_reviewed_at: "2026-10-12T10:00:00Z",
      payment_method: "NEFT_UPI",
      payment_method_display: "Corporate NEFT / UPI",
      transaction_reference: "NEFT/ICICI/84920194829",
      reimbursed_at: "2026-10-12T10:00:00Z",
      created_at: "2026-10-10T09:00:00Z",
    },
    {
      id: 2,
      claim_number: "EXP-2026-002",
      employee_name: "Ananya Rao",
      employee_id: "EMP-002",
      department_name: "Engineering",
      project_code: "",
      project_name: "",
      title: "Team Sprint Lunch",
      category: "MEALS",
      category_display: "Food & Meals",
      expense_date: "2026-10-12",
      currency: "INR",
      amount: "2500.00",
      tax_amount: "125.00",
      total_amount: "2625.00",
      is_billable: false,
      receipt_url: "",
      description: "Sprint celebration lunch.",
      status: "SUBMITTED",
      status_display: "Submitted (Pending Mgr)",
      manager_reviewer_name: "",
      finance_reviewer_name: "",
      payment_method: "",
      transaction_reference: "",
      reimbursed_at: null,
      created_at: "2026-10-12T12:00:00Z",
    },
  ];

  const stats = {
    total_claims: 2,
    total_amount: 23345.0,
    pending_manager_approval: 1,
    pending_finance_approval: 0,
    total_reimbursed_amount: 20720.0,
    billable_client_amount: 20720.0,
    category_breakdown: [
      { category: "TRAVEL", label: "Travel & Accommodation", count: 1, total: 20720.0 },
      { category: "MEALS", label: "Food & Meals", count: 1, total: 2625.0 },
    ],
  };

  const projects = [
    { id: 1, code: "PRJ-101", name: "SSKATT EWTS Workplace Suite", client_name: "VolkssKatt Global" },
  ];

  return { mockClaims: claims, mockStats: stats, mockProjects: projects };
});

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

vi.mock("../services/expenseService", () => ({
  default: {
    getExpenseClaims: vi.fn().mockResolvedValue(mockClaims),
    getMyClaims: vi.fn().mockResolvedValue(mockClaims),
    getExpenseStats: vi.fn().mockResolvedValue(mockStats),
    getProjects: vi.fn().mockResolvedValue(mockProjects),
    createClaim: vi.fn().mockResolvedValue({ id: 3, claim_number: "EXP-2026-003" }),
    managerReview: vi.fn().mockResolvedValue({ id: 2, status: "MANAGER_APPROVED" }),
    financeSettlement: vi.fn().mockResolvedValue({ id: 1, status: "REIMBURSED" }),
  },
}));

describe("Expenses & Reimbursements Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Executive KPI cards and category distribution breakdown", async () => {
    render(<Expenses />);

    await waitFor(() => {
      expect(screen.getByTestId("kpi-total-claims")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-pending-mgr")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-reimbursed")).toBeInTheDocument();
    });

    expect(screen.getByText("Expense & Reimbursement Center")).toBeInTheDocument();
    expect(screen.getAllByText("Travel & Accommodation").length).toBeGreaterThan(0);
  });

  it("renders corporate claims table rows with formatted amounts and badges", async () => {
    render(<Expenses />);

    await waitFor(() => {
      expect(screen.getByTestId("claim-row-1")).toBeInTheDocument();
      expect(screen.getByTestId("claim-row-2")).toBeInTheDocument();
    });

    expect(screen.getByText("EXP-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Client Onsite Workshop - Flight & Hotel")).toBeInTheDocument();
    expect(screen.getByText("Arjun Mehta")).toBeInTheDocument();
    expect(screen.getByText("Billable")).toBeInTheDocument();
  });

  it("opens and closes the Submit Expense Claim modal", async () => {
    render(<Expenses />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-new-claim")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-new-claim"));
    expect(screen.getByTestId("modal-create-claim")).toBeInTheDocument();
    expect(screen.getByTestId("input-claim-title")).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByText("✕"));
    expect(screen.queryByTestId("modal-create-claim")).not.toBeInTheDocument();
  });

  it("opens the Claim Detail modal to inspect audit timeline and receipts", async () => {
    render(<Expenses />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-view-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-view-1"));
    expect(screen.getByTestId("modal-detail-claim")).toBeInTheDocument();
    expect(screen.getByText("3. Finance Settlement & Disbursement")).toBeInTheDocument();
    expect(screen.getByText("NEFT/ICICI/84920194829")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close"));
    expect(screen.queryByTestId("modal-detail-claim")).not.toBeInTheDocument();
  });

  it("triggers Manager Review modal for pending claims", async () => {
    render(<Expenses />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-mgr-review-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-mgr-review-2"));
    expect(screen.getByTestId("modal-review-claim")).toBeInTheDocument();
    expect(screen.getByText("✓ Approve & Send to Finance")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("modal-review-claim")).not.toBeInTheDocument();
  });
});
