from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role
from employees.models import Department, Employee
from .models import LeaveAuditLog, LeaveBalance, LeaveRequest, LeaveStatus, LeaveType

User = get_user_model()


class LeaveManagementTests(APITestCase):
    def setUp(self):
        # Create department
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Create Super Admin
        self.super_admin_user = User.objects.create_user(
            email="superadmin@example.com",
            password="Password123!",
            first_name="Super",
            last_name="Admin",
            role=Role.SUPER_ADMIN,
        )

        # Create HR Admin
        self.hr_user = User.objects.create_user(
            email="hr@example.com",
            password="Password123!",
            first_name="HR",
            last_name="Manager",
            role=Role.HR_ADMIN,
        )

        # Create Manager
        self.manager_user = User.objects.create_user(
            email="manager@example.com",
            password="Password123!",
            first_name="Jane",
            last_name="Manager",
            role=Role.MANAGER,
        )
        self.manager_emp = Employee.objects.create(
            user=self.manager_user,
            employee_id="EMP-MGR-001",
            department=self.dept,
            designation="Engineering Lead",
        )

        # Create Employee 1 (reports to manager)
        self.emp1_user = User.objects.create_user(
            email="emp1@example.com",
            password="Password123!",
            first_name="Alice",
            last_name="Smith",
            role=Role.EMPLOYEE,
        )
        self.emp1 = Employee.objects.create(
            user=self.emp1_user,
            employee_id="EMP-001",
            department=self.dept,
            designation="Software Engineer",
            manager=self.manager_emp,
        )

        # Create Employee 2 (different department / independent)
        self.emp2_user = User.objects.create_user(
            email="emp2@example.com",
            password="Password123!",
            first_name="Bob",
            last_name="Jones",
            role=Role.EMPLOYEE,
        )
        self.emp2 = Employee.objects.create(
            user=self.emp2_user,
            employee_id="EMP-002",
            department=self.dept,
            designation="QA Engineer",
        )

        # Create Leave Types
        self.annual_leave = LeaveType.objects.create(
            name="Annual Leave",
            code="ANNUAL",
            annual_allowance=Decimal("20.0"),
            is_paid=True,
        )
        self.sick_leave = LeaveType.objects.create(
            name="Sick Leave",
            code="SICK",
            annual_allowance=Decimal("10.0"),
            is_paid=True,
        )

        self.list_url = reverse("leave-request-list")

    # ─────────────────────────────────────────────────────────────
    # 1. Submission Tests
    # ─────────────────────────────────────────────────────────────
    def test_employee_can_submit_valid_leave_request(self):
        self.client.force_authenticate(user=self.emp1_user)
        payload = {
            "leave_type_id": self.annual_leave.id,
            "start_date": "2026-11-10",
            "end_date": "2026-11-12",
            "reason": "Family vacation",
        }
        res = self.client.post(self.list_url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["duration_days"], "3.0")
        self.assertEqual(res.data["status"], LeaveStatus.PENDING)

        # Check audit log created
        req_id = res.data["id"]
        audit_log = LeaveAuditLog.objects.filter(leave_request_id=req_id).first()
        self.assertIsNotNone(audit_log)
        self.assertEqual(audit_log.action, "SUBMITTED")
        self.assertEqual(audit_log.performed_by, self.emp1_user)

    def test_invalid_date_range_rejected(self):
        self.client.force_authenticate(user=self.emp1_user)
        payload = {
            "leave_type_id": self.annual_leave.id,
            "start_date": "2026-11-15",
            "end_date": "2026-11-10",  # Prior to start
            "reason": "Invalid dates",
        }
        res = self.client.post(self.list_url, payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("end_date", res.data)

    # ─────────────────────────────────────────────────────────────
    # 2. Conflict & Overlap Detection Tests
    # ─────────────────────────────────────────────────────────────
    def test_overlapping_leave_request_rejected(self):
        self.client.force_authenticate(user=self.emp1_user)
        # Create first request: Nov 10 to Nov 15
        payload1 = {
            "leave_type_id": self.annual_leave.id,
            "start_date": "2026-11-10",
            "end_date": "2026-11-15",
            "reason": "First request",
        }
        res1 = self.client.post(self.list_url, payload1)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Overlapping request: Nov 12 to Nov 18
        payload2 = {
            "leave_type_id": self.sick_leave.id,
            "start_date": "2026-11-12",
            "end_date": "2026-11-18",
            "reason": "Overlapping request",
        }
        res2 = self.client.post(self.list_url, payload2)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Overlapping", str(res2.data))

    def test_different_employee_can_take_same_dates(self):
        # Alice requests Nov 10 to Nov 15
        LeaveRequest.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            start_date=date(2026, 11, 10),
            end_date=date(2026, 11, 15),
            duration_days=Decimal("6.0"),
            reason="Alice vacation",
            status=LeaveStatus.PENDING,
        )

        # Bob requests same dates
        self.client.force_authenticate(user=self.emp2_user)
        payload = {
            "leave_type_id": self.annual_leave.id,
            "start_date": "2026-11-10",
            "end_date": "2026-11-15",
            "reason": "Bob vacation",
        }
        res = self.client.post(self.list_url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    # ─────────────────────────────────────────────────────────────
    # 3. Approval Workflow & Role Permissions
    # ─────────────────────────────────────────────────────────────
    def test_manager_can_approve_subordinate_leave(self):
        req = LeaveRequest.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            start_date=date(2026, 11, 20),
            end_date=date(2026, 11, 22),
            duration_days=Decimal("3.0"),
            reason="Subordinate leave",
            status=LeaveStatus.PENDING,
        )
        approve_url = reverse("leave-request-approve", args=[req.id])

        self.client.force_authenticate(user=self.manager_user)
        res = self.client.post(approve_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, LeaveStatus.APPROVED)
        self.assertEqual(req.reviewed_by, self.manager_user)
        self.assertIsNotNone(req.reviewed_at)

        # Check audit log
        log = LeaveAuditLog.objects.filter(leave_request=req, action="APPROVED").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.performed_by, self.manager_user)

    def test_manager_cannot_approve_own_leave(self):
        req = LeaveRequest.objects.create(
            employee=self.manager_emp,
            leave_type=self.annual_leave,
            start_date=date(2026, 11, 25),
            end_date=date(2026, 11, 26),
            duration_days=Decimal("2.0"),
            reason="Manager personal leave",
            status=LeaveStatus.PENDING,
        )
        approve_url = reverse("leave-request-approve", args=[req.id])

        self.client.force_authenticate(user=self.manager_user)
        res = self.client.post(approve_url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        req.refresh_from_db()
        self.assertEqual(req.status, LeaveStatus.PENDING)

    def test_manager_cannot_approve_non_subordinate_leave(self):
        req = LeaveRequest.objects.create(
            employee=self.emp2,  # Not managed by Jane
            leave_type=self.annual_leave,
            start_date=date(2026, 11, 28),
            end_date=date(2026, 11, 29),
            duration_days=Decimal("2.0"),
            reason="Bob leave",
            status=LeaveStatus.PENDING,
        )
        approve_url = reverse("leave-request-approve", args=[req.id])

        self.client.force_authenticate(user=self.manager_user)
        res = self.client.post(approve_url)
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_hr_admin_can_approve_any_leave(self):
        req = LeaveRequest.objects.create(
            employee=self.emp2,
            leave_type=self.annual_leave,
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 2),
            duration_days=Decimal("2.0"),
            reason="Bob leave",
            status=LeaveStatus.PENDING,
        )
        approve_url = reverse("leave-request-approve", args=[req.id])

        self.client.force_authenticate(user=self.hr_user)
        res = self.client.post(approve_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, LeaveStatus.APPROVED)
        self.assertEqual(req.reviewed_by, self.hr_user)

    # ─────────────────────────────────────────────────────────────
    # 4. Rejection Workflow Tests
    # ─────────────────────────────────────────────────────────────
    def test_rejection_requires_reason(self):
        req = LeaveRequest.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            start_date=date(2026, 12, 5),
            end_date=date(2026, 12, 6),
            duration_days=Decimal("2.0"),
            reason="Vacation",
            status=LeaveStatus.PENDING,
        )
        reject_url = reverse("leave-request-reject", args=[req.id])

        self.client.force_authenticate(user=self.manager_user)
        # Empty payload
        res = self.client.post(reject_url, {})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("rejection_reason", res.data)

        # Valid reason
        res = self.client.post(reject_url, {"rejection_reason": "High project workload this week."})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, LeaveStatus.REJECTED)
        self.assertEqual(req.rejection_reason, "High project workload this week.")

        # Check audit log
        log = LeaveAuditLog.objects.filter(leave_request=req, action="REJECTED").first()
        self.assertIsNotNone(log)
        self.assertIn("High project workload", log.note)

    # ─────────────────────────────────────────────────────────────
    # 5. Cancellation Tests
    # ─────────────────────────────────────────────────────────────
    def test_employee_can_cancel_pending_leave(self):
        req = LeaveRequest.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            start_date=date(2026, 12, 10),
            end_date=date(2026, 12, 12),
            duration_days=Decimal("3.0"),
            reason="Trip plans",
            status=LeaveStatus.PENDING,
        )
        cancel_url = reverse("leave-request-cancel", args=[req.id])

        self.client.force_authenticate(user=self.emp1_user)
        res = self.client.post(cancel_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, LeaveStatus.CANCELLED)

    def test_cannot_cancel_already_approved_leave(self):
        req = LeaveRequest.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            start_date=date(2026, 12, 15),
            end_date=date(2026, 12, 16),
            duration_days=Decimal("2.0"),
            reason="Approved trip",
            status=LeaveStatus.APPROVED,
        )
        cancel_url = reverse("leave-request-cancel", args=[req.id])

        self.client.force_authenticate(user=self.emp1_user)
        res = self.client.post(cancel_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # ─────────────────────────────────────────────────────────────
    # 6. Access Control & Scoped Visibility Tests
    # ─────────────────────────────────────────────────────────────
    def test_regular_employee_only_sees_own_leaves(self):
        LeaveRequest.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            start_date=date(2026, 12, 20),
            end_date=date(2026, 12, 21),
            duration_days=Decimal("2.0"),
            reason="Alice",
            status=LeaveStatus.PENDING,
        )
        LeaveRequest.objects.create(
            employee=self.emp2,
            leave_type=self.annual_leave,
            start_date=date(2026, 12, 22),
            end_date=date(2026, 12, 23),
            duration_days=Decimal("2.0"),
            reason="Bob",
            status=LeaveStatus.PENDING,
        )

        self.client.force_authenticate(user=self.emp1_user)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Should only see Alice's request
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["employee_code"], "EMP-001")

    # ─────────────────────────────────────────────────────────────
    # 7. Configurable Leave Balance Rules Test
    # ─────────────────────────────────────────────────────────────
    def test_balance_quota_enforced_only_when_configured(self):
        # Configure a balance record with 2 allocated days
        LeaveBalance.objects.create(
            employee=self.emp1,
            leave_type=self.annual_leave,
            year=2026,
            allocated_days=Decimal("2.0"),
            used_days=Decimal("0.0"),
        )

        self.client.force_authenticate(user=self.emp1_user)
        # Attempt requesting 4 days (exceeds balance of 2.0)
        payload = {
            "leave_type_id": self.annual_leave.id,
            "start_date": "2026-10-20",
            "end_date": "2026-10-23",  # 4 days
            "reason": "Exceeds balance",
        }
        res = self.client.post(self.list_url, payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient leave balance", str(res.data))
