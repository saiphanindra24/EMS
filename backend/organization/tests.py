from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role
from attendance.models import WorkSchedule
from employees.models import Department, Employee
from leave_management.models import LeaveType

from .models import (
    AdminAuditLog,
    Holiday,
    NotificationPreferenceSetting,
    OrganizationSetting,
)

User = get_user_model()


class OrganizationAdminTests(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="Human Resources", code="HRD")

        # Super Admin
        self.super_admin = User.objects.create_superuser(
            email="superadmin@emwts.local",
            password="SuperPassword2026!",
            first_name="Super",
            last_name="Admin",
            role=Role.SUPER_ADMIN,
        )

        # HR Admin
        self.hr_admin = User.objects.create_user(
            email="hradmin@emwts.local",
            password="HrAdminPassword2026!",
            first_name="Helen",
            last_name="Admin",
            role=Role.HR_ADMIN,
        )

        # Manager
        self.manager = User.objects.create_user(
            email="manager@emwts.local",
            password="ManagerPassword2026!",
            first_name="Marcus",
            last_name="Manager",
            role=Role.MANAGER,
        )

        # Standard Employee
        self.employee = User.objects.create_user(
            email="employee@emwts.local",
            password="EmployeePassword2026!",
            first_name="Ethan",
            last_name="Employee",
            role=Role.EMPLOYEE,
        )
        self.employee_profile = Employee.objects.create(
            user=self.employee,
            employee_id="EMP-ETH-001",
            department=self.dept,
            phone="555-0100",
        )

    # --------------------------------------------------------------------------
    # 1. ORGANIZATION SETTINGS & TIMEZONE VALIDATION
    # --------------------------------------------------------------------------
    def test_get_and_patch_organization_settings_as_admin(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse("organization:settings")

        # GET
        res_get = self.client.get(url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["timezone"], "UTC")

        # PATCH valid update
        res_patch = self.client.patch(url, {
            "name": "Global Tech Corp",
            "timezone": "America/New_York",
            "contact_email": "ops@globaltech.local",
        })
        self.assertEqual(res_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(res_patch.data["name"], "Global Tech Corp")
        self.assertEqual(res_patch.data["timezone"], "America/New_York")

        # Verify audit log was created
        log = AdminAuditLog.objects.filter(action="ORGANIZATION_SETTINGS_UPDATED").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.super_admin)

    def test_invalid_timezone_validation(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse("organization:settings")

        res = self.client.patch(url, {"timezone": "Fantasy/Invalid_Timezone"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("timezone", res.data)

    def test_employee_cannot_update_organization_settings(self):
        self.client.force_authenticate(user=self.employee)
        url = reverse("organization:settings")

        # Employee should be forbidden
        res = self.client.patch(url, {"name": "Hacked Name"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # --------------------------------------------------------------------------
    # 2. WORK SCHEDULE & GRACE PERIOD
    # --------------------------------------------------------------------------
    def test_work_schedule_update_and_validation(self):
        self.client.force_authenticate(user=self.hr_admin)
        url = reverse("organization:schedule")

        # Update valid schedule
        res = self.client.patch(url, {
            "work_start_time": "08:30:00",
            "work_end_time": "17:30:00",
            "grace_period_minutes": 20,
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["grace_period_minutes"], 20)

        # Inverted schedule times (start >= end) should fail
        res_invalid = self.client.patch(url, {
            "work_start_time": "18:00:00",
            "work_end_time": "09:00:00",
        })
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 3. HOLIDAY CALENDAR
    # --------------------------------------------------------------------------
    def test_holiday_crud_and_duplicate_prevention(self):
        self.client.force_authenticate(user=self.hr_admin)
        url = reverse("organization:holidays")

        # Create holiday
        h_date = date(2026, 12, 25)
        res_create = self.client.post(url, {
            "name": "Winter Holiday",
            "date": h_date.isoformat(),
            "description": "Company-wide winter recess",
        })
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        h_id = res_create.data["id"]

        # Duplicate should be rejected
        res_dup = self.client.post(url, {
            "name": "Winter Holiday",
            "date": h_date.isoformat(),
        })
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Delete holiday
        del_url = reverse("organization:holiday-detail", kwargs={"pk": h_id})
        res_del = self.client.delete(del_url)
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

    # --------------------------------------------------------------------------
    # 4. LEAVE TYPES MANAGEMENT
    # --------------------------------------------------------------------------
    def test_leave_type_creation_and_deactivation(self):
        self.client.force_authenticate(user=self.hr_admin)
        url = reverse("organization:leave-types")

        res_create = self.client.post(url, {
            "name": "Sabbatical Leave",
            "code": "SAB",
            "description": "Extended personal sabbatical",
            "is_paid": False,
            "annual_allowance": 30.0,
        })
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        lt_id = res_create.data["id"]

        # Soft deactivate
        detail_url = reverse("organization:leave-type-detail", kwargs={"pk": lt_id})
        res_del = self.client.delete(detail_url)
        self.assertEqual(res_del.status_code, status.HTTP_204_NO_CONTENT)

        lt = LeaveType.objects.get(id=lt_id)
        self.assertFalse(lt.is_active)

    # --------------------------------------------------------------------------
    # 5. NOTIFICATION PREFERENCES
    # --------------------------------------------------------------------------
    def test_notification_preferences_update(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse("organization:notification-preferences")

        res = self.client.patch(url, {
            "email_notifications_enabled": True,
            "task_overdue_alerts": True,
            "daily_digest_enabled": True,
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["daily_digest_enabled"])

    # --------------------------------------------------------------------------
    # 6. AUTHORIZED USER & ROLE MANAGEMENT & ESCALATION GUARD
    # --------------------------------------------------------------------------
    def test_super_admin_can_promote_and_audit_role_change(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse("organization:user-detail", kwargs={"pk": self.employee.id})

        # Promote employee to Manager
        res = self.client.patch(url, {"role": Role.MANAGER})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.role, Role.MANAGER)

        # Check audit log
        log = AdminAuditLog.objects.filter(action="USER_ROLE_CHANGED").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.changes["role"]["after"], Role.MANAGER)

    def test_hr_admin_cannot_escalate_to_super_admin(self):
        self.client.force_authenticate(user=self.hr_admin)
        url = reverse("organization:user-detail", kwargs={"pk": self.employee.id})

        # HR Admin attempting to grant SUPER_ADMIN must be rejected
        res = self.client.patch(url, {"role": Role.SUPER_ADMIN})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.employee.refresh_from_db()
        self.assertNotEqual(self.employee.role, Role.SUPER_ADMIN)

    # --------------------------------------------------------------------------
    # 7. USER PROFILE SETTINGS & PASSWORD CHANGE
    # --------------------------------------------------------------------------
    def test_user_profile_update(self):
        self.client.force_authenticate(user=self.employee)
        url = reverse("auth-profile")

        res = self.client.patch(url, {
            "first_name": "Nathan",
            "phone": "555-9999",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["first_name"], "Nathan")
        self.assertEqual(res.data["phone"], "555-9999")

    def test_change_password_workflow(self):
        self.client.force_authenticate(user=self.employee)
        url = reverse("auth-change-password")

        # Wrong current password fails
        res_wrong = self.client.post(url, {
            "current_password": "WrongPassword!",
            "new_password": "NewValidPassword2026!",
        })
        self.assertEqual(res_wrong.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid change succeeds
        res_ok = self.client.post(url, {
            "current_password": "EmployeePassword2026!",
            "new_password": "BrandNewSecret2026!",
        })
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.employee.refresh_from_db()
        self.assertTrue(self.employee.check_password("BrandNewSecret2026!"))

    # --------------------------------------------------------------------------
    # 8. AUDIT LOG RETRIEVAL
    # --------------------------------------------------------------------------
    def test_admin_can_retrieve_audit_logs(self):
        self.client.force_authenticate(user=self.super_admin)
        AdminAuditLog.log_action(
            actor=self.super_admin,
            action="SECURITY_CHECK",
            category="SECURITY",
            description="Automated system check executed",
        )

        url = reverse("organization:audit-logs")
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["count"], 1)
