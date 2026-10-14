from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from employees.models import Employee
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


class Command(BaseCommand):
    help = "Seeds standard corporate appraisal review cycles, KPI goals, 360 reviews, and peer feedback."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Performance Management & 360 Appraisal Data for SSKATT EWTS...")

        today = timezone.localdate()

        # 1. Review Cycles
        cycle_q4, _ = ReviewCycle.objects.update_or_create(
            name="Q4 2026 Engineering & Product Sprint Appraisal",
            defaults={
                "cycle_type": ReviewCycleType.QUARTERLY,
                "start_date": today - timedelta(days=45),
                "end_date": today + timedelta(days=45),
                "self_review_deadline": today - timedelta(days=5),
                "manager_review_deadline": today + timedelta(days=15),
                "status": ReviewCycleStatus.ACTIVE,
                "description": "Quarterly performance evaluation covering technical throughput, quality milestones, and leadership competencies.",
            }
        )

        ReviewCycle.objects.update_or_create(
            name="Annual 2026 Global Performance & Compensation Review",
            defaults={
                "cycle_type": ReviewCycleType.ANNUAL,
                "start_date": today + timedelta(days=60),
                "end_date": today + timedelta(days=120),
                "self_review_deadline": today + timedelta(days=80),
                "manager_review_deadline": today + timedelta(days=100),
                "status": ReviewCycleStatus.UPCOMING,
                "description": "Annual 360 review cycle determining band promotions and merit increments.",
            }
        )

        emp_list = list(Employee.objects.filter(is_archived=False).order_by("employee_id")[:5])
        if not emp_list:
            self.stdout.write(self.style.WARNING("No employees found to seed performance data for."))
            return

        emp_arjun = emp_list[0]
        emp_ananya = emp_list[1] if len(emp_list) > 1 else emp_arjun
        emp_sneha = emp_list[2] if len(emp_list) > 2 else emp_arjun
        emp_vikram = emp_list[3] if len(emp_list) > 3 else emp_arjun

        # 2. KPI Goals
        goals_data = [
            {
                "employee": emp_arjun,
                "cycle": cycle_q4,
                "title": "Architect Zero-Downtime Microservices & Neon High-Availability",
                "category": GoalCategory.TECHNICAL,
                "description": "Ensure 99.99% database uptime and sub-100ms API response latency across the platform.",
                "target_metric": "99.99% Uptime",
                "current_progress": 90,
                "weightage": 35,
                "status": GoalStatus.IN_PROGRESS,
                "due_date": today + timedelta(days=20),
                "manager_notes": "Outstanding progress on Postgres connection pooling.",
            },
            {
                "employee": emp_arjun,
                "cycle": cycle_q4,
                "title": "Mentor Senior & Junior Engineers in Fullstack Best Practices",
                "category": GoalCategory.LEADERSHIP,
                "description": "Conduct weekly architecture clinics and code review walkthroughs for the engineering team.",
                "target_metric": "10 Mentorship Sessions",
                "current_progress": 100,
                "weightage": 25,
                "status": GoalStatus.ACHIEVED,
                "due_date": today - timedelta(days=5),
                "manager_notes": "Completed 12 workshops with glowing feedback.",
            },
            {
                "employee": emp_ananya,
                "cycle": cycle_q4,
                "title": "Deliver VolkssKatt EWTS Modern Design System & Accessible Components",
                "category": GoalCategory.TECHNICAL,
                "description": "Implement high-contrast WCAG 2.1 AA responsive CSS design tokens and reusable component suite.",
                "target_metric": "100% Component Library",
                "current_progress": 95,
                "weightage": 40,
                "status": GoalStatus.IN_PROGRESS,
                "due_date": today + timedelta(days=15),
                "manager_notes": "Exemplary UI styling that has elevated our enterprise client demonstrations.",
            },
            {
                "employee": emp_sneha,
                "cycle": cycle_q4,
                "title": "Expand Automated Test Coverage Across Payroll & Daily Work Reports",
                "category": GoalCategory.OPERATIONAL,
                "description": "Build comprehensive Vitest and Django unit test suites with zero regressions.",
                "target_metric": "50+ Passing Tests",
                "current_progress": 100,
                "weightage": 30,
                "status": GoalStatus.ACHIEVED,
                "due_date": today - timedelta(days=2),
                "manager_notes": "Achieved 100% test pass rate across 11 test suites.",
            },
            {
                "employee": emp_vikram,
                "cycle": cycle_q4,
                "title": "End-to-End Stress Testing & Webhook Reliability Audit",
                "category": GoalCategory.INNOVATION,
                "description": "Simulate 5,000 concurrent employee clock-in requests during peak morning shifts.",
                "target_metric": "5,000 Virtual Users",
                "current_progress": 70,
                "weightage": 35,
                "status": GoalStatus.IN_PROGRESS,
                "due_date": today + timedelta(days=25),
                "manager_notes": "Initial benchmark runs complete; optimizing cache hit ratios.",
            },
        ]

        for gd in goals_data:
            Goal.objects.update_or_create(
                employee=gd["employee"],
                title=gd["title"],
                defaults=gd
            )

        # 3. Performance Reviews
        # Review 1: Arjun Mehta (Completed Top Performer)
        r1, _ = PerformanceReview.objects.update_or_create(
            cycle=cycle_q4,
            employee=emp_arjun,
            defaults={
                "manager": emp_arjun,  # Self or executive
                "status": ReviewStatus.COMPLETED,
                "self_rating": Decimal("4.8"),
                "self_achievements": "Successfully spearheaded SSKATT EWTS modernization, cloud database migration, and mentoring junior engineers.",
                "self_challenges": "Balancing urgent client project delivery with core architectural refactoring.",
                "self_training_needs": "Advanced Distributed Systems & Event Sourcing.",
                "self_submitted_at": timezone.now() - timedelta(days=15),
                "manager_rating": Decimal("4.9"),
                "manager_feedback": "Exceptional technical leadership. Arjun consistently delivers production-grade architecture ahead of schedule.",
                "promotion_recommendation": PromotionRecommendation.MERIT_INCREASE,
                "pip_required": False,
                "final_score": Decimal("4.9"),
                "manager_submitted_at": timezone.now() - timedelta(days=10),
                "hr_notes": "Approved for annual 18% merit bonus in upcoming payroll cycle.",
            }
        )

        # Review 2: Ananya Rao (Completed Top Performer - Promotion Nominee)
        r2, _ = PerformanceReview.objects.update_or_create(
            cycle=cycle_q4,
            employee=emp_ananya,
            defaults={
                "manager": emp_arjun,
                "status": ReviewStatus.COMPLETED,
                "self_rating": Decimal("4.6"),
                "self_achievements": "Delivered entire front-end design overhaul, dark mode tokens, and streamlined Daily Work Reports workflows.",
                "self_challenges": "Handling multiple rapid changes across different module screens.",
                "self_training_needs": "Fullstack Django REST Framework integration & WebSockets.",
                "self_submitted_at": timezone.now() - timedelta(days=12),
                "manager_rating": Decimal("4.8"),
                "manager_feedback": "Ananya is a rockstar frontend engineer with meticulous eye for aesthetic polish and user delight.",
                "promotion_recommendation": PromotionRecommendation.ELIGIBLE_PROMOTION,
                "pip_required": False,
                "final_score": Decimal("4.7"),
                "manager_submitted_at": timezone.now() - timedelta(days=8),
                "hr_notes": "Nominated for Lead Frontend Engineer band advancement.",
            }
        )

        # Review 3: Sneha Patel (Completed)
        r3, _ = PerformanceReview.objects.update_or_create(
            cycle=cycle_q4,
            employee=emp_sneha,
            defaults={
                "manager": emp_arjun,
                "status": ReviewStatus.COMPLETED,
                "self_rating": Decimal("4.3"),
                "self_achievements": "Engineered automated test suites for project tracking, payroll, and expenses.",
                "self_challenges": "Learning the subtle differences between SQLite in-memory test mocks and Neon Postgres.",
                "self_training_needs": "CI/CD Pipeline Automation & Docker Containers.",
                "self_submitted_at": timezone.now() - timedelta(days=10),
                "manager_rating": Decimal("4.4"),
                "manager_feedback": "Great attention to detail and rigorous test writing. Elevated our team's code quality substantially.",
                "promotion_recommendation": PromotionRecommendation.ROLE_EXPANSION,
                "pip_required": False,
                "final_score": Decimal("4.4"),
                "manager_submitted_at": timezone.now() - timedelta(days=6),
            }
        )

        # Review 4: Vikram Singh (In Manager Review stage)
        r4, _ = PerformanceReview.objects.update_or_create(
            cycle=cycle_q4,
            employee=emp_vikram,
            defaults={
                "manager": emp_arjun,
                "status": ReviewStatus.MANAGER_REVIEW,
                "self_rating": Decimal("4.1"),
                "self_achievements": "Configured comprehensive stress test suites and verified zero regression on high-volume check-ins.",
                "self_challenges": "Setting up realistic test harnesses for WebSocket chat and video calls.",
                "self_training_needs": "Kubernetes Cluster Performance Tuning.",
                "self_submitted_at": timezone.now() - timedelta(days=3),
                "manager_rating": None,
                "manager_feedback": "",
                "promotion_recommendation": PromotionRecommendation.NO_CHANGE,
                "pip_required": False,
                "final_score": None,
                "manager_submitted_at": None,
            }
        )

        # 4. 360 Peer Feedback
        Feedback360.objects.update_or_create(
            review=r2,
            provider=emp_arjun,
            defaults={
                "relationship": Feedback360Relationship.MENTOR,
                "technical_rating": 5,
                "collaboration_rating": 5,
                "leadership_rating": 4,
                "strengths": "World-class UI craft, rapid velocity, and extreme ownership of user experience.",
                "growth_areas": "Continue taking ownership of end-to-end fullstack data architecture.",
                "is_anonymous": False,
            }
        )

        Feedback360.objects.update_or_create(
            review=r3,
            provider=emp_ananya,
            defaults={
                "relationship": Feedback360Relationship.PEER,
                "technical_rating": 4,
                "collaboration_rating": 5,
                "leadership_rating": 4,
                "strengths": "Always available to help teammates debug subtle edge cases. Reliable partner on every sprint.",
                "growth_areas": "Presenting more frequently in cross-department sprint reviews.",
                "is_anonymous": False,
            }
        )

        self.stdout.write(self.style.SUCCESS("Successfully seeded Performance Cycles, Goals, Reviews, and 360 Feedback!"))
