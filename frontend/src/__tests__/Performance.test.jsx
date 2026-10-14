import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Performance from "../components/Performance";

const { mockCycle, mockGoals, mockMyReviews, mockTeamReviews, mockStats } = vi.hoisted(() => {
  const cycle = {
    id: 1,
    name: "Q4 2026 Engineering Appraisal",
    cycle_type: "QUARTERLY",
    start_date: "2026-09-01",
    end_date: "2026-11-30",
    self_review_deadline: "2026-10-20",
    manager_review_deadline: "2026-11-15",
    status: "ACTIVE",
    status_display: "Active / Self Review",
  };

  const goals = [
    {
      id: 1,
      title: "Deliver High-Availability Neon Postgres Pooling",
      category: "TECHNICAL",
      category_display: "Technical & Delivery",
      target_metric: "99.99% Uptime",
      current_progress: 90,
      weightage: 35,
      status: "IN_PROGRESS",
      due_date: "2026-11-15",
      description: "Implement connection pooling and read replicas.",
    },
    {
      id: 2,
      title: "Conduct Weekly Mentorship Clinics",
      category: "LEADERSHIP",
      category_display: "Leadership & Mentorship",
      target_metric: "10 Sessions",
      current_progress: 100,
      weightage: 25,
      status: "ACHIEVED",
      due_date: "2026-10-30",
      description: "Guide junior engineers on clean architecture.",
    },
  ];

  const myReviews = [
    {
      id: 1,
      cycle_name: "Q4 2026 Engineering Appraisal",
      employee_name: "Arjun Mehta",
      employee_id: "EMP-001",
      department_name: "Engineering",
      designation: "Lead Systems Architect",
      status: "COMPLETED",
      status_display: "Finalized & Completed",
      self_rating: 4.8,
      manager_rating: 4.9,
      final_score: 4.9,
      promotion_recommendation: "MERIT_INCREASE",
      self_achievements: "Spearheaded cloud migration.",
      manager_feedback: "Exceptional architecture leadership.",
      peer_feedbacks: [],
    },
  ];

  const teamReviews = [
    {
      id: 1,
      cycle_name: "Q4 2026 Engineering Appraisal",
      employee_name: "Arjun Mehta",
      employee_id: "EMP-001",
      department_name: "Engineering",
      designation: "Lead Systems Architect",
      status: "COMPLETED",
      status_display: "Finalized & Completed",
      self_rating: 4.8,
      manager_rating: 4.9,
      final_score: 4.9,
      promotion_recommendation: "MERIT_INCREASE",
    },
    {
      id: 2,
      cycle_name: "Q4 2026 Engineering Appraisal",
      employee_name: "Ananya Rao",
      employee_id: "EMP-002",
      department_name: "Engineering",
      designation: "Senior Frontend Engineer",
      status: "MANAGER_REVIEW",
      status_display: "Manager Review In Progress",
      self_rating: 4.6,
      manager_rating: null,
      final_score: null,
      promotion_recommendation: "ELIGIBLE_PROMOTION",
    },
  ];

  const stats = {
    total_reviews: 2,
    completed_reviews: 1,
    completion_percentage: 50.0,
    average_org_score: 4.85,
    promotion_nominees: 2,
    pip_count: 0,
    top_performers: [
      { id: 1, name: "Arjun Mehta", designation: "Lead Systems Architect", score: 4.9, promotion: "Merit Salary Increment" },
      { id: 2, name: "Ananya Rao", designation: "Senior Frontend Engineer", score: 4.7, promotion: "Recommended for Promotion" },
    ],
  };

  return { mockCycle: cycle, mockGoals: goals, mockMyReviews: myReviews, mockTeamReviews: teamReviews, mockStats: stats };
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

vi.mock("../services/performanceService", () => ({
  default: {
    getActiveCycle: vi.fn().mockResolvedValue(mockCycle),
    getGoals: vi.fn().mockResolvedValue(mockGoals),
    getMyReviews: vi.fn().mockResolvedValue(mockMyReviews),
    getReviews: vi.fn().mockResolvedValue(mockTeamReviews),
    getStats: vi.fn().mockResolvedValue(mockStats),
    createGoal: vi.fn().mockResolvedValue({ id: 3, title: "New Goal" }),
    updateGoalProgress: vi.fn().mockResolvedValue({ id: 1, current_progress: 100 }),
    submitSelfReview: vi.fn().mockResolvedValue({ id: 1, status: "MANAGER_REVIEW" }),
    submitManagerReview: vi.fn().mockResolvedValue({ id: 2, status: "COMPLETED" }),
    submit360Feedback: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

describe("Performance Management & 360 Appraisals Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Executive KPI cards with average score, active cycle, and promotions", async () => {
    render(<Performance />);

    await waitFor(() => {
      expect(screen.getByTestId("kpi-org-rating")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-active-cycle")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-completion-rate")).toBeInTheDocument();
      expect(screen.getByTestId("kpi-promotions")).toBeInTheDocument();
    });

    expect(screen.getByText("Performance Management & 360° Appraisals")).toBeInTheDocument();
    expect(screen.getByText("4.85 / 5.0")).toBeInTheDocument();
  });

  it("renders Goals checklist with progress bars and quick actions", async () => {
    render(<Performance />);

    await waitFor(() => {
      expect(screen.getByTestId("goal-card-1")).toBeInTheDocument();
      expect(screen.getByTestId("goal-card-2")).toBeInTheDocument();
    });

    expect(screen.getByText("Deliver High-Availability Neon Postgres Pooling")).toBeInTheDocument();
    expect(screen.getByText("Conduct Weekly Mentorship Clinics")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("opens and cancels the Set KPI Goal modal", async () => {
    render(<Performance />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-add-goal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-add-goal"));
    expect(screen.getByTestId("modal-create-goal")).toBeInTheDocument();
    expect(screen.getByTestId("input-goal-title")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("modal-create-goal")).not.toBeInTheDocument();
  });

  it("switches to Team Appraisals tab and renders review table with action buttons", async () => {
    render(<Performance />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-team-reviews")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-team-reviews"));

    await waitFor(() => {
      expect(screen.getByTestId("team-review-row-1")).toBeInTheDocument();
      expect(screen.getByTestId("team-review-row-2")).toBeInTheDocument();
    });

    expect(screen.getByText("Ananya Rao")).toBeInTheDocument();
    expect(screen.getByTestId("btn-eval-2")).toBeInTheDocument();
  });

  it("switches to Leaderboard tab and renders top performers podium", async () => {
    render(<Performance />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-leaderboard")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-leaderboard"));

    await waitFor(() => {
      expect(screen.getByTestId("podium-rank-1")).toBeInTheDocument();
      expect(screen.getByTestId("podium-rank-2")).toBeInTheDocument();
    });

    expect(screen.getByText("🥇 Rank 1")).toBeInTheDocument();
    expect(screen.getByText("🥈 Rank 2")).toBeInTheDocument();
  });

  it("opens Manager Evaluation modal when Evaluate button is clicked", async () => {
    render(<Performance />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-team-reviews")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("tab-team-reviews"));

    await waitFor(() => {
      expect(screen.getByTestId("btn-eval-2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("btn-eval-2"));
    expect(screen.getByTestId("modal-manager-review")).toBeInTheDocument();
    expect(screen.getByTestId("input-mgr-rating")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByTestId("modal-manager-review")).not.toBeInTheDocument();
  });
});
