import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Lifecycle from "../components/Lifecycle";

const { mockCourses, mockEnrollments, mockCertifications, mockExits, mockStats } = vi.hoisted(() => {
  const courses = [
    {
      id: 1,
      code: "TRN-2026-ARCH",
      title: "Fullstack Microservices & Cloud Scaling",
      instructor: "Arjun Mehta",
      format: "VIRTUAL_LIVE",
      format_display: "Live Virtual Session",
      level: "ADVANCED",
      level_display: "Specialist",
      duration_hours: 24,
      skills_covered: "Django, Redis, WebSockets, Postgres",
      description: "Enterprise engineering masterclass on scalable event-driven services.",
      enrollment_count: 2,
    },
    {
      id: 2,
      code: "TRN-2026-CLOUD",
      title: "Kubernetes & Infrastructure Reliability",
      instructor: "Dr. R. K. Sharma",
      format: "BLENDED",
      format_display: "Blended Learning",
      level: "ADVANCED",
      level_display: "Specialist",
      duration_hours: 32,
      skills_covered: "Docker, Kubernetes, Helm",
      description: "Cloud orchestration boot-camp covering rolling updates.",
      enrollment_count: 1,
    },
  ];

  const enrollments = [
    {
      id: 1,
      course: 1,
      course_code: "TRN-2026-ARCH",
      course_title: "Fullstack Microservices & Cloud Scaling",
      course_instructor: "Arjun Mehta",
      duration_hours: 24,
      status: "COMPLETED",
      status_display: "Completed",
      progress_percent: 100,
      feedback_rating: 5,
      feedback_comments: "Exceptional architecture course with practical real-time coding.",
      enrolled_at: "2026-09-15T10:00:00Z",
    },
  ];

  const certifications = [
    {
      id: 1,
      name: "AWS Certified Solutions Architect",
      issuing_organization: "Amazon Web Services",
      issue_date: "2026-01-15",
      expiry_date: "2029-01-15",
      credential_id: "AWS-PSA-994821",
      credential_url: "https://aws.amazon.com/verification",
      is_verified: true,
    },
  ];

  const exits = [
    {
      id: 1,
      employee_name: "Vikram Singh",
      employee_id: "EMP-004",
      designation: "QA Lead",
      department_name: "Engineering",
      resignation_date: "2026-10-01",
      reason_category: "HIGHER_EDUCATION",
      reason_display: "Higher Education / Research",
      detailed_reason: "Admitted to Master's program.",
      notice_period_days: 30,
      requested_last_working_day: "2026-10-31",
      agreed_last_working_day: "2026-10-31",
      status: "CLEARANCE_IN_PROGRESS",
      status_display: "Clearance In Progress",
      relieving_letter_issued: false,
      clearance_items: [
        { id: 10, department: "IT_ASSET_RECOVERY", department_display: "IT Recovery", is_cleared: true },
        { id: 11, department: "REPORTING_MANAGER", department_display: "Manager Handover", is_cleared: true },
        { id: 12, department: "FINANCE_SETTLEMENT", department_display: "Finance", is_cleared: false },
        { id: 13, department: "HR_DOCUMENTATION", department_display: "HR", is_cleared: false },
      ],
    },
  ];

  const stats = {
    total_courses: 2,
    total_enrollments: 1,
    completed_enrollments: 1,
    active_certifications: 1,
    average_course_rating: 4.8,
    ongoing_exits: 1,
    completed_exits: 0,
  };

  return { mockCourses: courses, mockEnrollments: enrollments, mockCertifications: certifications, mockExits: exits, mockStats: stats };
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

vi.mock("../services/lifecycleService", () => ({
  default: {
    getCourses: vi.fn().mockResolvedValue(mockCourses),
    getEnrollments: vi.fn().mockResolvedValue(mockEnrollments),
    getCertifications: vi.fn().mockResolvedValue(mockCertifications),
    getExits: vi.fn().mockResolvedValue(mockExits),
    getStats: vi.fn().mockResolvedValue(mockStats),
    createCourse: vi.fn().mockResolvedValue({ id: 3, code: "TRN-NEW" }),
    enrollCourse: vi.fn().mockResolvedValue({ id: 2, status: "ENROLLED" }),
    updateEnrollment: vi.fn().mockResolvedValue({ id: 1, progress_percent: 100 }),
    createCertification: vi.fn().mockResolvedValue({ id: 2, name: "New Cert" }),
    submitResignation: vi.fn().mockResolvedValue({ id: 2, status: "SUBMITTED" }),
    signClearance: vi.fn().mockResolvedValue({ id: 1 }),
    completeSeparation: vi.fn().mockResolvedValue({ id: 1, status: "COMPLETED" }),
  },
}));

describe("Career Lifecycle, Training & Exit Hub Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Executive KPI cards for courses, enrollments, certs, and separations", async () => {
    render(<Lifecycle />);

    await waitFor(() => {
      expect(screen.getByTestId("kpi-active-courses")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-enrollments")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-certifications")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-exits")).toBeInTheDocument();
    });

    expect(screen.getByText("Career Lifecycle, Training & Exit Hub")).toBeInTheDocument();
  });

  it("renders course catalog cards with duration, instructor, and skills", async () => {
    render(<Lifecycle />);

    await waitFor(() => {
      expect(screen.getByTestId("course-card-1")).toBeInTheDocument();
      expect(screen.getByTestId("course-card-2")).toBeInTheDocument();
    });

    expect(screen.getByText("Fullstack Microservices & Cloud Scaling")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes & Infrastructure Reliability")).toBeInTheDocument();
  });

  it("switches to My Learning & Enrollments tab and renders progress", async () => {
    render(<Lifecycle />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-enrollments")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-enrollments"));

    await waitFor(() => {
      expect(screen.getByTestId("enroll-card-1")).toBeInTheDocument();
    });

    expect(screen.getByText("Course Completion")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("switches to Certifications tab and renders verified credentials", async () => {
    render(<Lifecycle />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-certifications")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-certifications"));

    await waitFor(() => {
      expect(screen.getByTestId("cert-card-1")).toBeInTheDocument();
    });

    expect(screen.getByText("AWS Certified Solutions Architect")).toBeInTheDocument();
    expect(screen.getByText("Amazon Web Services")).toBeInTheDocument();
  });

  it("switches to Exit & Clearance Hub tab and renders multi-department checklist", async () => {
    render(<Lifecycle />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-exit")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-exit"));

    await waitFor(() => {
      expect(screen.getByTestId("exit-card-1")).toBeInTheDocument();
    });

    expect(screen.getByText("Vikram Singh (EMP-004)")).toBeInTheDocument();
    expect(screen.getByText("Department Sign-Off Clearance Checklist:")).toBeInTheDocument();
  });

  it("opens and cancels the Add Course modal", async () => {
    render(<Lifecycle />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-add-course")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-add-course"));
    expect(screen.getByTestId("modal-create-course")).toBeInTheDocument();
    expect(screen.getByTestId("input-course-code")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("modal-create-course")).not.toBeInTheDocument();
  });
});
