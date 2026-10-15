from datetime import date, time, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Role
from employees.models import Department, Employee
from shifts.models import ShiftTemplate, ShiftRoster, ShiftSwapRequest, OvertimeRecord

User = get_user_model()


class ShiftManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(name="Operations", code="OPS")

        # Admin User
        self.admin_user = User.objects.create_user(
            email="admin.shifts@sskatttest.local",
            password="AdminPassword123!",
            role=Role.SUPER_ADMIN,
            first_name="Admin",
            last_name="Commander",
            is_staff=True,
        )

        # Manager User
        self.manager_user = User.objects.create_user(
            email="manager.shifts@sskatttest.local",
            password="ManagerPassword123!",
            role=Role.MANAGER,
            first_name="Marcus",
            last_name="Vance",
        )

        # Employee 1
        self.emp1_user = User.objects.create_user(
            email="emp1.shifts@sskatttest.local",
            password="EmployeePassword123!",
            role=Role.EMPLOYEE,
            first_name="Devin",
            last_name="Booker",
        )
        self.emp1_profile = Employee.objects.create(
            user=self.emp1_user,
            employee_id="EMP-SH-01",
            department=self.dept,
            designation="Site Reliability Engineer",
            date_joined=timezone.localdate() - timedelta(days=200),
        )

        # Employee 2
        self.emp2_user = User.objects.create_user(
            email="emp2.shifts@sskatttest.local",
            password="EmployeePassword123!",
            role=Role.EMPLOYEE,
            first_name="Elena",
            last_name="Rostova",
        )
        self.emp2_profile = Employee.objects.create(
            user=self.emp2_user,
            employee_id="EMP-SH-02",
            department=self.dept,
            designation="Cloud Infrastructure Specialist",
            date_joined=timezone.localdate() - timedelta(days=150),
        )

        # Shift Templates
        self.shift_morning = ShiftTemplate.objects.create(
            code="SHIFT_A",
            name="Morning Shift (A)",
            start_time=time(6, 0),
            end_time=time(14, 30),
            grace_period_minutes=15,
            break_duration_minutes=45,
            is_night_shift=False,
            color_code="#00ffcc",
        )
        self.shift_evening = ShiftTemplate.objects.create(
            code="SHIFT_B",
            name="Evening Swing (B)",
            start_time=time(14, 0),
            end_time=time(22, 30),
            grace_period_minutes=15,
            break_duration_minutes=45,
            is_night_shift=False,
            color_code="#f59e0b",
        )

    def test_shift_templates_listing(self):
        self.client.force_authenticate(user=self.emp1_user)
        response = self.client.get("/api/v1/shifts/templates/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        self.assertGreaterEqual(len(results), 2)
        codes = [item["code"] for item in results]
        self.assertIn("SHIFT_A", codes)
        self.assertIn("SHIFT_B", codes)

    def test_roster_assignment_and_my_roster(self):
        today = date.today()
        # Assign morning shift to emp1 today
        ShiftRoster.objects.create(
            employee=self.emp1_user,
            shift=self.shift_morning,
            date=today,
            status=ShiftRoster.Status.SCHEDULED,
            assigned_by=self.manager_user,
        )

        # Emp1 queries my_roster
        self.client.force_authenticate(user=self.emp1_user)
        response = self.client.get("/api/v1/shifts/roster/my_roster/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["shift_code"], "SHIFT_A")
        self.assertEqual(response.data[0]["shift_name"], "Morning Shift (A)")

    def test_bulk_assign_shifts_by_manager(self):
        today = date.today()
        target_dates = today + timedelta(days=3)
        self.client.force_authenticate(user=self.manager_user)

        payload = {
            "employee_ids": [self.emp1_user.id, self.emp2_user.id],
            "shift_id": self.shift_evening.id,
            "start_date": str(today + timedelta(days=2)),
            "end_date": str(target_dates),
            "notes": "Sprint handover support",
        }
        response = self.client.post("/api/v1/shifts/roster/bulk_assign/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("Successfully rostered", response.data["detail"])

        # Check DB
        rosters = ShiftRoster.objects.filter(shift=self.shift_evening)
        self.assertEqual(rosters.count(), 4)  # 2 days * 2 employees = 4

    def test_shift_swap_request_peer_acceptance_and_atomic_swap(self):
        swap_date = date.today() + timedelta(days=5)

        # Emp1 has morning shift, Emp2 has evening shift on swap_date
        r1 = ShiftRoster.objects.create(
            employee=self.emp1_user,
            shift=self.shift_morning,
            date=swap_date,
            status=ShiftRoster.Status.SCHEDULED,
        )
        r2 = ShiftRoster.objects.create(
            employee=self.emp2_user,
            shift=self.shift_evening,
            date=swap_date,
            status=ShiftRoster.Status.SCHEDULED,
        )

        # Emp1 submits swap request
        self.client.force_authenticate(user=self.emp1_user)
        swap_payload = {
            "requester_assignment_id": r1.id,
            "target_employee_id": self.emp2_user.id,
            "target_assignment_id": r2.id,
            "reason": "Family dinner in evening; request trade for morning shift.",
        }
        res_create = self.client.post("/api/v1/shifts/swaps/submit_swap/", swap_payload, format="json")
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        swap_id = res_create.data["id"]

        # Emp2 accepts swap proposal
        self.client.force_authenticate(user=self.emp2_user)
        res_peer = self.client.post(f"/api/v1/shifts/swaps/{swap_id}/peer_respond/", {"decision": "ACCEPTED"}, format="json")
        self.assertEqual(res_peer.status_code, status.HTTP_200_OK)
        self.assertEqual(res_peer.data["target_status"], "ACCEPTED")

        # Manager reviews and approves
        self.client.force_authenticate(user=self.manager_user)
        res_mgr = self.client.post(
            f"/api/v1/shifts/swaps/{swap_id}/manager_review/",
            {"decision": "APPROVED", "notes": "Approved; operational coverage verified."},
            format="json"
        )
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_mgr.data["manager_status"], "APPROVED")

        # Refresh rosters from DB: shifts must have swapped!
        r1.refresh_from_db()
        r2.refresh_from_db()
        self.assertEqual(r1.shift, self.shift_evening)
        self.assertEqual(r2.shift, self.shift_morning)
        self.assertEqual(r1.status, ShiftRoster.Status.SWAPPED)
        self.assertEqual(r2.status, ShiftRoster.Status.SWAPPED)

    def test_overtime_submission_and_manager_review(self):
        self.client.force_authenticate(user=self.emp1_user)
        ot_payload = {
            "date": str(date.today()),
            "start_time": "18:00:00",
            "end_time": "20:30:00",
            "hours": "2.50",
            "rate_multiplier": "1.50",
            "project_code": "PRJ-VOLKS-01",
            "reason": "Emergency DB failover drill",
        }
        res_submit = self.client.post("/api/v1/shifts/overtime/submit_overtime/", ot_payload, format="json")
        self.assertEqual(res_submit.status_code, status.HTTP_201_CREATED)
        ot_id = res_submit.data["id"]
        self.assertEqual(res_submit.data["status"], "PENDING")

        # Manager approves
        self.client.force_authenticate(user=self.manager_user)
        res_approve = self.client.post(
            f"/api/v1/shifts/overtime/{ot_id}/review_overtime/",
            {"decision": "APPROVED", "notes": "Authorized for weekend run."},
            format="json"
        )
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_approve.data["status"], "APPROVED")

    def test_shift_stats_endpoint(self):
        # Create an overtime and roster
        ShiftRoster.objects.create(
            employee=self.emp1_user,
            shift=self.shift_morning,
            date=date.today(),
            status=ShiftRoster.Status.SCHEDULED,
        )
        OvertimeRecord.objects.create(
            employee=self.emp1_user,
            date=date.today(),
            start_time=time(18, 0),
            end_time=time(20, 0),
            hours=Decimal("2.00"),
            rate_multiplier=Decimal("1.50"),
            reason="Release deployment",
            status=OvertimeRecord.Status.APPROVED,
        )

        self.client.force_authenticate(user=self.emp1_user)
        response = self.client.get("/api/v1/shifts/overtime/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_rostered_week", response.data)
        self.assertIn("active_shifts_today", response.data)
        self.assertIn("approved_ot_hours_month", response.data)
        self.assertEqual(response.data["active_shifts_today"], 1)
        self.assertEqual(response.data["approved_ot_hours_month"], 2.0)
