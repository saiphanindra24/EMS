from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Role
from employees.models import Department, Employee
from performance.models import (
    Feedback360,
    Feedback360Relationship,
    Goal,
    GoalCategory,
    GoalStatus,
    PerformanceReview,
    PromotionRecommendation,
    ReviewCycle,
    ReviewCycleStatus,
    ReviewCycleType,
    ReviewStatus,
)

User = get_user_model()


class PerformanceManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Admin user
        self.admin_user = User.objects.create_user(
            email="admin.perf@sskatttest.local",
            password="AdminPassword123!",
            role=Role.SUPER_ADMIN,
            first_name="Admin",
            last_name="System",
            is_staff=True
        )

        # Manager user & profile
        self.manager_user = User.objects.create_user(
            email="manager.perf@sskatttest.local",
            password="ManagerPassword123!",
            role=Role.MANAGER,
            first_name="Rajesh",
            last_name="Kumar"
        )
        self.manager_emp = Employee.objects.create(
            user=self.manager_user,
            employee_id="EMP-MGR-PERF",
            department=self.dept,
            designation="Engineering Director"
        )

        # Employee user & profile
        self.emp_user = User.objects.create_user(
            email="ananya.perf@sskatttest.local",
            password="EmpPassword123!",
            role=Role.EMPLOYEE,
            first_name="Ananya",
            last_name="Rao"
        )
        self.emp_profile = Employee.objects.create(
            user=self.emp_user,
            employee_id="EMP-DEV-PERF",
            department=self.dept,
            designation="Senior Frontend Engineer",
            manager=self.manager_emp
        )

        # Review cycle
        today = timezone.localdate()
        self.cycle = ReviewCycle.objects.create(
            name="Q4 2026 Test Appraisal",
            cycle_type=ReviewCycleType.QUARTERLY,
            start_date=today - timedelta(days=30),
            end_date=today + timedelta(days=30),
            self_review_deadline=today - timedelta(days=5),
            manager_review_deadline=today + timedelta(days=10),
            status=ReviewCycleStatus.ACTIVE
        )

    def test_review_cycle_active_endpoint(self):
        self.client.force_authenticate(user=self.emp_user)
        res = self.client.get("/api/v1/performance/cycles/active/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Q4 2026 Test Appraisal")
        self.assertEqual(res.data["status"], ReviewCycleStatus.ACTIVE)

    def test_goal_creation_and_progress_update(self):
        self.client.force_authenticate(user=self.emp_user)
        payload = {
            "title": "Optimize Webpack & Vite Bundle Size",
            "category": "TECHNICAL",
            "target_metric": "Sub 200KB initial chunk",
            "weightage": 30,
            "description": "Tree-shake icons and dynamic import routes"
        }
        res = self.client.post("/api/v1/performance/goals/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        goal_id = res.data["id"]

        # Update progress to 100%
        patch_res = self.client.patch(
            f"/api/v1/performance/goals/{goal_id}/update_progress/",
            {"current_progress": 100},
            format="json"
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["current_progress"], 100)
        self.assertEqual(patch_res.data["status"], GoalStatus.ACHIEVED)

    def test_self_review_submission(self):
        review = PerformanceReview.objects.create(
            cycle=self.cycle,
            employee=self.emp_profile,
            manager=self.manager_emp,
            status=ReviewStatus.SELF_REVIEW
        )

        self.client.force_authenticate(user=self.emp_user)
        url = f"/api/v1/performance/reviews/{review.id}/self_submit/"
        payload = {
            "self_rating": "4.5",
            "self_achievements": "Built complete responsive UI design system with 100% test coverage.",
            "self_challenges": "Balancing urgent hotfixes with long-term architecture.",
            "self_training_needs": "Micro-frontends and state machines."
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, ReviewStatus.MANAGER_REVIEW)
        self.assertEqual(Decimal(str(review.self_rating)), Decimal("4.5"))
        self.assertIsNotNone(review.self_submitted_at)

    def test_manager_evaluation_and_scoring(self):
        review = PerformanceReview.objects.create(
            cycle=self.cycle,
            employee=self.emp_profile,
            manager=self.manager_emp,
            status=ReviewStatus.MANAGER_REVIEW,
            self_rating=Decimal("4.5"),
            self_achievements="Great achievements"
        )

        self.client.force_authenticate(user=self.manager_user)
        url = f"/api/v1/performance/reviews/{review.id}/manager_submit/"
        payload = {
            "manager_rating": "4.8",
            "manager_feedback": "Exceptional velocity, high autonomy, and inspiring design craft.",
            "promotion_recommendation": "ELIGIBLE_PROMOTION",
            "pip_required": False
        }
        res = self.client.post(url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, ReviewStatus.COMPLETED)
        self.assertEqual(Decimal(str(review.manager_rating)), Decimal("4.8"))
        self.assertEqual(review.promotion_recommendation, PromotionRecommendation.ELIGIBLE_PROMOTION)
        # Check computed weighted final score: (4.5*0.4) + (4.8*0.6) = 1.8 + 2.88 = 4.68 -> 4.7
        self.assertIsNotNone(review.final_score)
        self.assertEqual(Decimal(str(review.final_score)), Decimal("4.7"))

    def test_feedback360_creation(self):
        review = PerformanceReview.objects.create(
            cycle=self.cycle,
            employee=self.emp_profile,
            manager=self.manager_emp,
            status=ReviewStatus.COMPLETED
        )

        self.client.force_authenticate(user=self.manager_user)
        payload = {
            "review": review.id,
            "relationship": Feedback360Relationship.MENTOR,
            "technical_rating": 5,
            "collaboration_rating": 5,
            "leadership_rating": 4,
            "strengths": "Peerless work ethic and creativity.",
            "growth_areas": "Lead architecture sessions."
        }
        res = self.client.post("/api/v1/performance/feedback360/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["technical_rating"], 5)

    def test_performance_stats(self):
        PerformanceReview.objects.create(
            cycle=self.cycle,
            employee=self.emp_profile,
            manager=self.manager_emp,
            status=ReviewStatus.COMPLETED,
            self_rating=Decimal("4.5"),
            manager_rating=Decimal("4.8"),
            final_score=Decimal("4.7"),
            promotion_recommendation=PromotionRecommendation.ELIGIBLE_PROMOTION
        )

        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/api/v1/performance/reviews/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["total_reviews"], 1)
        self.assertEqual(data["completed_reviews"], 1)
        self.assertEqual(data["completion_percentage"], 100.0)
        self.assertEqual(data["promotion_nominees"], 1)
        self.assertEqual(len(data["top_performers"]), 1)
        self.assertEqual(data["top_performers"][0]["score"], 4.7)
