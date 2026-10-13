from datetime import timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone

from employees.models import Department, Employee
from projects.models import (
    DailyWorkReport,
    DailyWorkReportStatus,
    Milestone,
    Project,
    ProjectHealth,
    ProjectMember,
    ProjectPriority,
    ProjectStatus,
)


class Command(BaseCommand):
    help = "Seeds standard corporate projects, milestones, resource memberships, and Daily Work Reports (DWR)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Projects, Resource Allocations, and Daily Work Reports...")

        today = timezone.localdate()
        eng_dept = Department.objects.filter(code="ENG").first() or Department.objects.first()

        lead_emp = Employee.objects.filter(employee_id="EMP-005").first() or Employee.objects.first()
        fe_emp = Employee.objects.filter(employee_id="EMP-004").first()
        be_emp = Employee.objects.filter(employee_id="EMP-003").first()
        design_emp = Employee.objects.filter(employee_id="EMP-006").first()
        pm_emp = Employee.objects.filter(employee_id="EMP-007").first()

        # Project 1: SSKATT EWTS Enterprise Workplace Suite
        p1, _ = Project.objects.update_or_create(
            code="PRJ-101",
            defaults={
                "name": "SSKATT EWTS Enterprise Workplace Suite",
                "client_name": "VolkssKatt Global Infotech",
                "description": "Integrated corporate suite combining Employee Tracking System (ETS) and Work Tracking System (WTS) with real-time biometric and sprint analytics.",
                "status": ProjectStatus.IN_PROGRESS,
                "priority": ProjectPriority.CRITICAL,
                "health": ProjectHealth.ON_TRACK,
                "lead": lead_emp,
                "department": eng_dept,
                "start_date": today - timedelta(days=45),
                "target_end_date": today + timedelta(days=75),
                "budget": Decimal("2500000.00"),
                "spent_budget": Decimal("1150000.00"),
                "progress_percentage": 75,
            }
        )

        # Milestones for PRJ-101
        Milestone.objects.update_or_create(
            project=p1,
            title="Core RBAC & Live Attendance Tracking Engine",
            defaults={
                "due_date": today - timedelta(days=20),
                "is_achieved": True,
                "achieved_at": timezone.now() - timedelta(days=20),
                "order": 1,
            }
        )
        Milestone.objects.update_or_create(
            project=p1,
            title="Statutory Payroll & Formal Payslip Generation",
            defaults={
                "due_date": today - timedelta(days=2),
                "is_achieved": True,
                "achieved_at": timezone.now() - timedelta(days=2),
                "order": 2,
            }
        )
        Milestone.objects.update_or_create(
            project=p1,
            title="Project Management & Daily Work Reports (DWR)",
            defaults={
                "due_date": today + timedelta(days=14),
                "is_achieved": False,
                "order": 3,
            }
        )

        # Memberships for PRJ-101
        if lead_emp:
            ProjectMember.objects.update_or_create(
                project=p1, employee=lead_emp,
                defaults={"role": "Lead Architect", "allocation_percentage": 100, "is_billable": True}
            )
        if fe_emp:
            ProjectMember.objects.update_or_create(
                project=p1, employee=fe_emp,
                defaults={"role": "Frontend Specialist", "allocation_percentage": 100, "is_billable": True}
            )
        if design_emp:
            ProjectMember.objects.update_or_create(
                project=p1, employee=design_emp,
                defaults={"role": "Product & UX Lead", "allocation_percentage": 50, "is_billable": True}
            )

        # Project 2: Fintech Payment Gateway 2.0
        p2, _ = Project.objects.update_or_create(
            code="PRJ-102",
            defaults={
                "name": "Fintech Payment Gateway 2.0",
                "client_name": "Apex Capital & Merchant Bank",
                "description": "High-throughput real-time payment reconciliation engine with ISO20022 compliance and fraud detection.",
                "status": ProjectStatus.IN_PROGRESS,
                "priority": ProjectPriority.HIGH,
                "health": ProjectHealth.ON_TRACK,
                "lead": pm_emp or lead_emp,
                "department": eng_dept,
                "start_date": today - timedelta(days=30),
                "target_end_date": today + timedelta(days=90),
                "budget": Decimal("4500000.00"),
                "spent_budget": Decimal("1650000.00"),
                "progress_percentage": 40,
            }
        )

        if be_emp:
            ProjectMember.objects.update_or_create(
                project=p2, employee=be_emp,
                defaults={"role": "Backend Engineer", "allocation_percentage": 100, "is_billable": True}
            )

        # Seed Daily Work Reports (DWR)
        if fe_emp:
            DailyWorkReport.objects.update_or_create(
                employee=fe_emp,
                report_date=today,
                defaults={
                    "project": p1,
                    "hours_worked": Decimal("8.00"),
                    "activities_summary": "Implemented Project Management & Daily Work Reports frontend components. Added high-contrast theme styling and unified tabs.",
                    "issues_faced": "None. Vitest and Vite production builds passing cleanly.",
                    "plan_for_tomorrow": "Integrate Project milestone progress bars and review feedback drawer.",
                    "status": DailyWorkReportStatus.APPROVED,
                    "manager_feedback": "Excellent progress on the unified WTS UI components.",
                    "reviewed_at": timezone.now(),
                }
            )

        if be_emp:
            DailyWorkReport.objects.update_or_create(
                employee=be_emp,
                report_date=today,
                defaults={
                    "project": p2,
                    "hours_worked": Decimal("7.50"),
                    "activities_summary": "Benchmarked PostgreSQL transaction pooling and drafted multi-bank webhook callbacks for payment settlement.",
                    "issues_faced": "Waiting on NPCI sandbox credential authorization.",
                    "plan_for_tomorrow": "Implement idempotent webhook signature verification.",
                    "status": DailyWorkReportStatus.SUBMITTED,
                }
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded corporate projects, milestones, resource members, and DWR records."))
