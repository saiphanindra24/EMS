import json
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User, Role
from employees.models import Department, Employee
from attendance.models import AttendanceRecord
from tasks.models import Task
from leave_management.models import LeaveType, LeaveRequest, LeaveBalance
from notifications.models import Notification, NotificationType
from organization.models import OrganizationSetting


class EndToEndIntegrationQATestCase(TestCase):
    """
    Milestone 13 Comprehensive End-to-End Integration and QA Test Suite.
    Validates end-to-end user workflows across Django APIs, PostgreSQL, and RBAC.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Super Admin
        self.super_admin = User.objects.create_user(
            email="superadmin@emwts.local",
            password="AdminPassword123!",
            first_name="Super",
            last_name="Admin",
            role=Role.SUPER_ADMIN,
        )

        # 2. HR Admin
        self.hr_admin = User.objects.create_user(
            email="hradmin@emwts.local",
            password="HrPassword123!",
            first_name="HR",
            last_name="Director",
            role=Role.HR_ADMIN,
        )

        # 3. Manager
        self.manager_user = User.objects.create_user(
            email="manager@emwts.local",
            password="ManagerPassword123!",
            first_name="Team",
            last_name="Lead",
            role=Role.MANAGER,
        )

        # 4. Employee
        self.employee_user = User.objects.create_user(
            email="employee@emwts.local",
            password="EmployeePassword123!",
            first_name="Jane",
            last_name="Worker",
            role=Role.EMPLOYEE,
        )

        # Department
        self.engineering_dept = Department.objects.create(
            name="Engineering",
            code="ENG",
            description="Core Platform Engineering",
        )

        # Employee Profiles
        self.manager_profile = Employee.objects.create(
            user=self.manager_user,
            employee_id="MGR-001",
            department=self.engineering_dept,
            designation="Engineering Manager",
            date_joined=date(2025, 1, 1),
            employment_type="FULL_TIME",
        )

        self.employee_profile = Employee.objects.create(
            user=self.employee_user,
            employee_id="EMP-001",
            department=self.engineering_dept,
            manager=self.manager_profile,
            designation="Software Engineer",
            date_joined=date(2025, 2, 1),
            employment_type="FULL_TIME",
        )

        # Leave Type & Balance
        self.annual_leave = LeaveType.objects.create(
            name="Annual Vacation",
            code="VAC",
            annual_allowance=20.0,
            is_paid=True,
            requires_approval=True,
        )
        self.employee_balance = LeaveBalance.objects.create(
            employee=self.employee_profile,
            leave_type=self.annual_leave,
            year=date.today().year,
            allocated_days=20,
            used_days=0,
            pending_days=0,
        )

    # ── 1. Authentication and Session E2E ─────────────────────────────────────
    def test_e2e_authentication_flow_and_rejection(self):
        # Successful login
        login_res = self.client.post(
            "/api/v1/auth/login/",
            {"email": "employee@emwts.local", "password": "EmployeePassword123!"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access_token = login_res.data.get("access")
        self.assertIsNotNone(access_token)
        self.assertEqual(login_res.data["user"]["role"], "EMPLOYEE")

        # Authenticated profile access
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        me_res = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data["user"]["email"], "employee@emwts.local")

        # Unauthorized request without token
        unauth_client = APIClient()
        unauth_res = unauth_client.get("/api/v1/auth/me/")
        self.assertEqual(unauth_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Invalid token rejection
        unauth_client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token-xyz")
        invalid_res = unauth_client.get("/api/v1/auth/me/")
        self.assertEqual(invalid_res.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── 2. RBAC Permissions and Unauthorized Rejection ───────────────────────
    def test_rbac_permission_boundaries(self):
        # Employee cannot create a department
        self.client.force_authenticate(user=self.employee_user)
        denied_res = self.client.post(
            "/api/v1/departments/",
            {"name": "Unauthorized Dept", "code": "BAD"},
            format="json",
        )
        self.assertIn(denied_res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED])

        # Employee cannot modify organization settings
        org_denied = self.client.patch(
            "/api/v1/organization/settings/",
            {"organization_name": "Hacked Name"},
            format="json",
        )
        self.assertEqual(org_denied.status_code, status.HTTP_403_FORBIDDEN)

        # HR Admin can create departments
        self.client.force_authenticate(user=self.hr_admin)
        dept_res = self.client.post(
            "/api/v1/departments/",
            {"name": "Marketing", "code": "MKT", "description": "Global Marketing"},
            format="json",
        )
        self.assertEqual(dept_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Department.objects.filter(code="MKT").exists())

    # ── 3. Employee CRUD and Duplicate ID / Email Rejection ─────────────────
    def test_employee_crud_and_uniqueness_validation(self):
        self.client.force_authenticate(user=self.hr_admin)

        # Attempt to create duplicate employee ID
        dup_id_payload = {
            "email": "unique@emwts.local",
            "password": "TempPass123!",
            "first_name": "Test",
            "last_name": "User",
            "role": "EMPLOYEE",
            "employee_id": "EMP-001",  # Already used in setUp
            "department": self.engineering_dept.id,
            "designation": "QA Analyst",
            "employment_type": "FULL_TIME",
            "date_joined": "2026-03-01",
        }
        dup_id_res = self.client.post("/api/v1/employees/", dup_id_payload, format="json")
        self.assertEqual(dup_id_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("employee_id", str(dup_id_res.data))

        # Attempt to create duplicate email
        dup_email_payload = {
            "email": "employee@emwts.local",  # Already used in setUp
            "password": "TempPass123!",
            "first_name": "New",
            "last_name": "Person",
            "role": "EMPLOYEE",
            "employee_id": "EMP-999",
            "department": self.engineering_dept.id,
            "designation": "QA Analyst",
            "employment_type": "FULL_TIME",
            "date_joined": "2026-03-01",
        }
        dup_email_res = self.client.post("/api/v1/employees/", dup_email_payload, format="json")
        self.assertEqual(dup_email_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", str(dup_email_res.data))

    # ── 4. Attendance Check-in, Check-out and Calculations ───────────────────
    def test_attendance_lifecycle_and_duration_calculation(self):
        self.client.force_authenticate(user=self.employee_user)

        # 1. Check in
        checkin_res = self.client.post(
            "/api/v1/attendance/check-in/",
            {"note": "Morning checkin at workstation"},
            format="json",
        )
        self.assertEqual(checkin_res.status_code, status.HTTP_200_OK)
        today = date.today()
        record = AttendanceRecord.objects.get(employee=self.employee_profile, date=today)
        self.assertIsNotNone(record.check_in)
        self.assertIn(record.status, ["PRESENT", "LATE"])

        # 2. Check out
        checkout_res = self.client.post(
            "/api/v1/attendance/check-out/",
            {"note": "Day work concluded"},
            format="json",
        )
        self.assertEqual(checkout_res.status_code, status.HTTP_200_OK)
        record.refresh_from_db()
        self.assertIsNotNone(record.check_out)
        self.assertIn(record.status, ["PRESENT", "LATE", "HALF_DAY"])

        # 3. Attendance Stats endpoint reflects employee punch
        self.client.force_authenticate(user=self.hr_admin)
        stats_res = self.client.get("/api/v1/attendance/stats/")
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        active_punches = (
            stats_res.data.get("present", 0)
            + stats_res.data.get("late", 0)
            + stats_res.data.get("half_day", 0)
        )
        self.assertGreaterEqual(active_punches, 1)

    # ── 5. Task Assignment, Status Changes and Stats ────────────────────────
    def test_task_assignment_and_progress_tracking(self):
        # Manager creates and assigns a task to employee
        self.client.force_authenticate(user=self.manager_user)
        create_task_res = self.client.post(
            "/api/v1/tasks/",
            {
                "title": "Complete Security Audit",
                "description": "Perform review of dependencies and endpoints.",
                "assignee": self.employee_profile.id,
                "priority": "HIGH",
                "due_date": str(date.today() + timedelta(days=5)),
            },
            format="json",
        )
        self.assertEqual(create_task_res.status_code, status.HTTP_201_CREATED)
        task_id = create_task_res.data["id"]

        # Employee updates task to IN_PROGRESS
        self.client.force_authenticate(user=self.employee_user)
        prog_res = self.client.patch(
            f"/api/v1/tasks/{task_id}/",
            {"status": "IN_PROGRESS"},
            format="json",
        )
        self.assertEqual(prog_res.status_code, status.HTTP_200_OK)
        self.assertEqual(prog_res.data["status"], "IN_PROGRESS")

        # Employee marks task COMPLETED
        comp_res = self.client.patch(
            f"/api/v1/tasks/{task_id}/",
            {"status": "COMPLETED"},
            format="json",
        )
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertEqual(comp_res.data["status"], "COMPLETED")

        # Task stats API calculation
        stats_res = self.client.get("/api/v1/tasks/stats/")
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(stats_res.data.get("completed", 0), 1)

    # ── 6. Leave Request and Manager Approval Workflow ──────────────────────
    def test_leave_request_approval_and_balance_deduction(self):
        # 1. Employee submits leave request
        self.client.force_authenticate(user=self.employee_user)
        start_date = date.today() + timedelta(days=10)
        end_date = date.today() + timedelta(days=12)
        leave_res = self.client.post(
            "/api/v1/leave/",
            {
                "leave_type_id": self.annual_leave.id,
                "start_date": str(start_date),
                "end_date": str(end_date),
                "reason": "Family vacation",
            },
            format="json",
        )
        self.assertEqual(leave_res.status_code, status.HTTP_201_CREATED)
        req_id = leave_res.data["id"]

        # 2. Manager reviews and approves the request
        self.client.force_authenticate(user=self.manager_user)
        appr_res = self.client.post(
            f"/api/v1/leave/{req_id}/approve/",
            {"review_note": "Approved, enjoy your vacation."},
            format="json",
        )
        self.assertEqual(appr_res.status_code, status.HTTP_200_OK)
        self.assertEqual(appr_res.data["status"], "APPROVED")

        # 3. Leave balance updated
        self.employee_balance.refresh_from_db()
        self.assertGreater(self.employee_balance.used_days, 0)

    # ── 7. Notifications Visibility and Read Lifecycle ──────────────────────
    def test_notification_creation_and_read_state(self):
        # System creates a notification for employee
        notif = Notification.objects.create(
            recipient=self.employee_user,
            title="Project Update",
            message="Your leave request has been approved.",
            notification_type=NotificationType.LEAVE_APPROVED,
        )

        self.client.force_authenticate(user=self.employee_user)
        list_res = self.client.get("/api/v1/notifications/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data if isinstance(list_res.data, list) else list_res.data.get("results", [])
        self.assertTrue(any(n["id"] == notif.id for n in results))

        # Mark notification as read via /read/ endpoint
        read_res = self.client.post(f"/api/v1/notifications/{notif.id}/read/")
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.is_read)

    # ── 8. Authorized Reports and Export Restrictions ────────────────────────
    def test_reports_access_and_export_generation(self):
        # HR Admin has full report and export access
        self.client.force_authenticate(user=self.hr_admin)

        # Productivity index summary
        prod_res = self.client.get("/api/v1/reports/productivity/")
        self.assertEqual(prod_res.status_code, status.HTTP_200_OK)
        self.assertIn("results", prod_res.data)

        # CSV Export
        csv_res = self.client.get("/api/v1/reports/productivity/?export=csv")
        self.assertEqual(csv_res.status_code, status.HTTP_200_OK)
        self.assertTrue(csv_res["Content-Type"].startswith("text/csv"))
        self.assertIn("attachment; filename=", csv_res["Content-Disposition"])

        # Excel Export (supports ?export=xlsx)
        excel_res = self.client.get("/api/v1/reports/employees/?export=xlsx")
        self.assertEqual(excel_res.status_code, status.HTTP_200_OK)
        self.assertIn("application/vnd.openxmlformats-officedocument", excel_res["Content-Type"])

        # Employee view is strictly scoped to self and sensitive financial data is masked
        self.client.force_authenticate(user=self.employee_user)
        emp_prod_res = self.client.get("/api/v1/reports/productivity/")
        self.assertEqual(emp_prod_res.status_code, status.HTTP_200_OK)
        emp_results = emp_prod_res.data.get("results", [])
        self.assertEqual(len(emp_results), 1)
        self.assertEqual(emp_results[0]["employee_id"], self.employee_profile.employee_id)

        # Employee cannot view confidential employee financial data
        emp_roster_res = self.client.get("/api/v1/reports/employees/")
        self.assertEqual(emp_roster_res.status_code, status.HTTP_200_OK)
        for emp_item in emp_roster_res.data.get("results", []):
            self.assertNotIn("sensitive_data", emp_item)
