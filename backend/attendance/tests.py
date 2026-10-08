from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role
from attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceStatus, WorkSchedule
from employees.models import Department, Employee, EmploymentStatus, EmploymentType

User = get_user_model()


class AttendanceAPITests(APITestCase):
    def setUp(self):
        # Work Schedule
        self.schedule = WorkSchedule.objects.create(
            name="Standard 9-6",
            work_start_time="09:00:00",
            work_end_time="18:00:00",
            grace_period_minutes=15,
            half_day_minimum_hours=Decimal("4.00"),
            full_day_minimum_hours=Decimal("8.00"),
            is_default=True,
        )

        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Admin user
        self.admin = User.objects.create_superuser(
            email="admin@emwts.local",
            password="AdminPass2026!",
            first_name="Admin",
            last_name="User",
        )
        self.admin_emp = Employee.objects.create(
            user=self.admin,
            employee_id="EMP-ADM",
            department=self.dept,
        )

        # Manager user
        self.manager_user = User.objects.create_user(
            email="manager@emwts.local",
            password="ManagerPass2026!",
            first_name="Manager",
            last_name="One",
            role=Role.MANAGER,
        )
        self.manager_emp = Employee.objects.create(
            user=self.manager_user,
            employee_id="EMP-MGR",
            department=self.dept,
        )

        # Employee 1 (reports to manager)
        self.emp_user1 = User.objects.create_user(
            email="emp1@emwts.local",
            password="EmpPass2026!",
            first_name="Employee",
            last_name="One",
            role=Role.EMPLOYEE,
        )
        self.employee1 = Employee.objects.create(
            user=self.emp_user1,
            employee_id="EMP-001",
            department=self.dept,
            manager=self.manager_emp,
        )

        # Employee 2 (unrelated)
        self.emp_user2 = User.objects.create_user(
            email="emp2@emwts.local",
            password="EmpPass2026!",
            first_name="Employee",
            last_name="Two",
            role=Role.EMPLOYEE,
        )
        self.employee2 = Employee.objects.create(
            user=self.emp_user2,
            employee_id="EMP-002",
            department=self.dept,
        )

    def test_check_in_success(self):
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("attendance-check-in")
        response = self.client.post(url, {"notes": "On-time arrival"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")

        today = timezone.localdate()
        record = AttendanceRecord.objects.get(employee=self.employee1, date=today)
        self.assertIsNotNone(record.check_in)
        self.assertIsNone(record.check_out)
        self.assertTrue(record.is_active_session)

    def test_duplicate_check_in_prevented(self):
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("attendance-check-in")
        # First check-in
        res1 = self.client.post(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        # Duplicate check-in on the same day while active
        res2 = self.client.post(url)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already have an active check-in", res2.data["detail"])

    def test_check_out_without_check_in_rejected(self):
        self.client.force_authenticate(user=self.emp_user2)
        url = reverse("attendance-check-out")
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No check-in record found", response.data["detail"])

    def test_normal_check_in_and_check_out_sequence(self):
        self.client.force_authenticate(user=self.emp_user1)
        # Check in
        self.client.post(reverse("attendance-check-in"))

        # Advance check_in backward in time to simulate 8.5 hours worked
        today = timezone.localdate()
        record = AttendanceRecord.objects.get(employee=self.employee1, date=today)
        record.check_in = timezone.now() - timedelta(hours=8, minutes=30)
        record.save()

        # Check out
        checkout_res = self.client.post(reverse("attendance-check-out"), {"notes": "End of day"})
        self.assertEqual(checkout_res.status_code, status.HTTP_200_OK)

        record.refresh_from_db()
        self.assertIsNotNone(record.check_out)
        self.assertFalse(record.is_active_session)
        self.assertGreaterEqual(record.work_duration_minutes, 500)
        self.assertGreaterEqual(record.work_duration_hours, Decimal("8.00"))

    def test_second_check_out_prevented(self):
        self.client.force_authenticate(user=self.emp_user1)
        self.client.post(reverse("attendance-check-in"))
        self.client.post(reverse("attendance-check-out"))

        # Second check out
        second_out = self.client.post(reverse("attendance-check-out"))
        self.assertEqual(second_out.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already checked out today", second_out.data["detail"])

    def test_today_attendance_endpoint(self):
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("attendance-today")
        res_before = self.client.get(url)
        self.assertEqual(res_before.status_code, status.HTTP_200_OK)
        self.assertIsNone(res_before.data["record"])

        self.client.post(reverse("attendance-check-in"))
        res_after = self.client.get(url)
        self.assertEqual(res_after.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(res_after.data["record"])
        self.assertTrue(res_after.data["record"]["is_active_session"])

    def test_employee_cannot_see_peer_attendance(self):
        # Create an attendance record for Employee 2
        today = timezone.localdate()
        rec2 = AttendanceRecord.objects.create(
            employee=self.employee2,
            date=today,
            check_in=timezone.now(),
            status=AttendanceStatus.PRESENT,
        )

        # Employee 1 logs in and requests attendance list
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("attendance-list")
        res = self.client.get(url)
        results = res.data.get("results", res.data)
        # Should NOT contain rec2
        rec_ids = [r["id"] for r in results]
        self.assertNotIn(rec2.id, rec_ids)

        # Attempt to access rec2 directly -> 404/403 forbidden
        detail_url = reverse("attendance-detail", kwargs={"pk": rec2.pk})
        detail_res = self.client.get(detail_url)
        self.assertEqual(detail_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_see_direct_report_attendance(self):
        today = timezone.localdate()
        rec1 = AttendanceRecord.objects.create(
            employee=self.employee1,
            date=today,
            check_in=timezone.now(),
            status=AttendanceStatus.PRESENT,
        )
        self.client.force_authenticate(user=self.manager_user)
        url = reverse("attendance-list")
        res = self.client.get(url)
        results = res.data.get("results", res.data)
        rec_ids = [r["id"] for r in results]
        self.assertIn(rec1.id, rec_ids)

    def test_attendance_correction_with_audit_trail(self):
        today = timezone.localdate()
        record = AttendanceRecord.objects.create(
            employee=self.employee1,
            date=today,
            check_in=timezone.now() - timedelta(hours=6),
            status=AttendanceStatus.HALF_DAY,
        )

        # Admin performs correction
        self.client.force_authenticate(user=self.admin)
        url = reverse("attendance-correct", kwargs={"pk": record.pk})
        new_in = timezone.now() - timedelta(hours=8)
        new_out = timezone.now()
        data = {
            "check_in": new_in.isoformat(),
            "check_out": new_out.isoformat(),
            "status": AttendanceStatus.PRESENT,
            "reason": "Employee forgot to punch in badge in morning.",
        }
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        record.refresh_from_db()
        self.assertEqual(record.status, AttendanceStatus.PRESENT)
        self.assertGreaterEqual(record.work_duration_hours, Decimal("7.9"))

        # Verify audit trail
        corrections = AttendanceCorrection.objects.filter(attendance_record=record)
        self.assertEqual(corrections.count(), 1)
        audit = corrections.first()
        self.assertEqual(audit.corrected_by, self.admin)
        self.assertEqual(audit.original_status, AttendanceStatus.HALF_DAY)
        self.assertEqual(audit.new_status, AttendanceStatus.PRESENT)
        self.assertIn("forgot to punch", audit.reason)

    def test_regular_employee_cannot_correct_attendance(self):
        today = timezone.localdate()
        record = AttendanceRecord.objects.create(
            employee=self.employee1,
            date=today,
            check_in=timezone.now(),
        )
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("attendance-correct", kwargs={"pk": record.pk})
        res = self.client.post(url, {"status": AttendanceStatus.PRESENT, "reason": "Self adjustment"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
