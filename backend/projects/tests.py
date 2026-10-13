from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Role
from employees.models import Department, Employee, EmploymentStatus
from projects.models import (
    DailyWorkReport,
    DailyWorkReportStatus,
    Milestone,
    Project,
    ProjectMember,
    ProjectStatus,
)

User = get_user_model()


class ProjectsAndDWRTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin User
        self.admin = User.objects.create_user(
            email="admin@sskatt.local",
            password="AdminPassword123!",
            role=Role.SUPER_ADMIN,
            first_name="Admin",
            last_name="User"
        )

        # Employee User
        self.emp_user = User.objects.create_user(
            email="ananya.rao@sskatt.local",
            password="EmpPassword123!",
            role=Role.EMPLOYEE,
            first_name="Ananya",
            last_name="Rao"
        )

        self.dept = Department.objects.create(name="Engineering", code="ENG")
        self.employee = Employee.objects.create(
            user=self.emp_user,
            employee_id="EMP-101",
            department=self.dept,
            designation="Software Engineer",
            status=EmploymentStatus.ACTIVE
        )

        # Create Project
        self.project = Project.objects.create(
            code="PRJ-999",
            name="Cloud Modernization",
            client_name="Test Client",
            status=ProjectStatus.IN_PROGRESS,
            budget=Decimal("500000.00"),
            lead=self.employee,
            department=self.dept,
        )

    def test_project_stats_and_list(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(reverse("project-stats"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_projects"], 1)
        self.assertEqual(res.data["active_projects"], 1)
        self.assertEqual(Decimal(str(res.data["total_budget"])), Decimal("500000.00"))

    def test_milestone_and_member_allocation(self):
        self.client.force_authenticate(user=self.admin)

        # Add Member
        member_url = reverse("project-add-member", kwargs={"pk": self.project.id})
        m_res = self.client.post(member_url, {
            "employee_id": self.employee.id,
            "role": "Frontend Lead",
            "allocation_percentage": 100,
        })
        self.assertEqual(m_res.status_code, status.HTTP_200_OK)
        self.assertEqual(ProjectMember.objects.count(), 1)

        # Milestone
        ms = Milestone.objects.create(
            project=self.project,
            title="UI Wireframes",
            due_date="2026-10-30",
        )
        toggle_url = reverse("milestone-toggle-achieved", kwargs={"pk": ms.id})
        t_res = self.client.post(toggle_url)
        self.assertEqual(t_res.status_code, status.HTTP_200_OK)
        ms.refresh_from_db()
        self.assertTrue(ms.is_achieved)

    def test_daily_work_report_submission_and_review(self):
        self.client.force_authenticate(user=self.emp_user)

        # Submit DWR
        dwr_url = reverse("daily-work-report-list")
        payload = {
            "project": self.project.id,
            "hours_worked": "8.00",
            "activities_summary": "Finished project dashboard layout and unit tests.",
            "issues_faced": "None",
            "plan_for_tomorrow": "Integrate milestones API",
        }
        res = self.client.post(dwr_url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        dwr_id = res.data["id"]

        # Today status
        status_url = reverse("daily-work-report-today-status")
        s_res = self.client.get(status_url)
        self.assertEqual(s_res.status_code, status.HTTP_200_OK)
        self.assertTrue(s_res.data["has_submitted"])

        # Admin reviews DWR
        self.client.force_authenticate(user=self.admin)
        review_url = reverse("daily-work-report-review", kwargs={"pk": dwr_id})
        r_res = self.client.post(review_url, {
            "action": "APPROVE",
            "manager_feedback": "Great work on the UI."
        })
        self.assertEqual(r_res.status_code, status.HTTP_200_OK)
        report = DailyWorkReport.objects.get(id=dwr_id)
        self.assertEqual(report.status, DailyWorkReportStatus.APPROVED)
        self.assertEqual(report.reviewed_by, self.admin)
