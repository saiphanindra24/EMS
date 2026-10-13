import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Payroll from "../components/Payroll";

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

vi.mock("../services/payrollService", () => ({
  default: {
    getSummary: vi.fn().mockResolvedValue({
      is_admin: true,
      total_active_employees: 7,
      latest_run: {
        id: 1,
        month: 10,
        year: 2026,
        total_gross: "670000.00",
        total_deductions: "22500.00",
        total_net: "647500.00",
        status: "APPROVED",
        status_display: "Approved",
      },
    }),
    getPayslips: vi.fn().mockResolvedValue([
      {
        id: 1,
        payslip_number: "PAY-202610-EMP004",
        employee_name: "Ananya Rao",
        employee_id_code: "EMP-004",
        department_name: "Engineering",
        designation: "Frontend Engineer",
        month: 10,
        year: 2026,
        working_days: 31,
        present_days: "31.00",
        basic_salary: "55000.00",
        hra: "22000.00",
        special_allowance: "33000.00",
        gross_earnings: "110000.00",
        provident_fund: "1800.00",
        professional_tax: "200.00",
        tds: "1500.00",
        total_deductions: "3500.00",
        net_salary: "106500.00",
        status: "GENERATED",
        status_display: "Generated",
      },
    ]),
    getRuns: vi.fn().mockResolvedValue([
      {
        id: 1,
        month: 10,
        year: 2026,
        status: "APPROVED",
        status_display: "Approved",
        total_employees: 7,
        total_gross: "670000.00",
        total_deductions: "22500.00",
        total_net: "647500.00",
        processed_by_name: "Admin User",
      },
    ]),
    getSalaryStructures: vi.fn().mockResolvedValue([
      {
        id: 1,
        employee_name: "Ananya Rao",
        employee_id_code: "EMP-004",
        designation: "Frontend Engineer",
        annual_ctc: "1320000.00",
        basic_salary: "55000.00",
        hra: "22000.00",
        special_allowance: "33000.00",
        monthly_gross: "110000.00",
        monthly_deductions: "3500.00",
        monthly_net: "106500.00",
      },
    ]),
    processPayroll: vi.fn().mockResolvedValue({ message: "Processed" }),
    disbursePayroll: vi.fn().mockResolvedValue({ message: "Disbursed" }),
  },
}));

describe("SSKATT EWTS — Payroll Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders payroll executive header and KPI cards", async () => {
    render(<Payroll />);

    expect(screen.getByText(/SSKATT Payroll Management/i)).toBeInTheDocument();
    expect(screen.getByText(/VolkssKatt Enterprise Compensation/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Monthly Gross Payroll/i)).toBeInTheDocument();
      expect(screen.getByText(/Net Disbursable/i)).toBeInTheDocument();
      expect(screen.getByText(/7 Employees/i)).toBeInTheDocument();
    });
  });

  it("renders payslips table with employee record and action button", async () => {
    render(<Payroll />);

    await waitFor(() => {
      expect(screen.getByText("Ananya Rao")).toBeInTheDocument();
      expect(screen.getByText("PAY-202610-EMP004")).toBeInTheDocument();
      expect(screen.getByText("Engineering")).toBeInTheDocument();
    });

    const viewButton = screen.getByRole("button", { name: /View \/ Print/i });
    expect(viewButton).toBeInTheDocument();
  });

  it("opens the formal printable payslip modal when View/Print is clicked", async () => {
    render(<Payroll />);

    await waitFor(() => {
      expect(screen.getByText("Ananya Rao")).toBeInTheDocument();
    });

    const viewButton = screen.getByRole("button", { name: /View \/ Print/i });
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /VolkssKatt Infotech Private Limited/i })).toBeInTheDocument();
      expect(screen.getByText(/Earnings \(INR\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Deductions \(INR\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Print \/ Save as PDF/i)).toBeInTheDocument();
    });
  });

  it("switches to Payroll Cycle Runs and CTC Structures tabs", async () => {
    render(<Payroll />);

    await waitFor(() => {
      expect(screen.getByText(/Payroll Cycle Runs/i)).toBeInTheDocument();
    });

    // Switch to Runs tab
    const runsTabBtn = screen.getByRole("button", { name: /Payroll Cycle Runs/i });
    fireEvent.click(runsTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Disburse NEFT →/i)).toBeInTheDocument();
    });

    // Switch to Structures tab
    const structsTabBtn = screen.getByRole("button", { name: /CTC & Salary Structures/i });
    fireEvent.click(structsTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/Annual CTC/i)).toBeInTheDocument();
    });
  });

  it("opens Process Payroll Batch modal when button is clicked", async () => {
    render(<Payroll />);

    const processBtn = screen.getByRole("button", { name: /Process Payroll Batch/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText(/Process Monthly Payroll Batch/i)).toBeInTheDocument();
      expect(screen.getByText(/Execute Payroll Run/i)).toBeInTheDocument();
    });
  });
});
