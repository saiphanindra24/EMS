from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role, User


class AccountsModelTests(TestCase):
    def test_create_user(self):
        user = User.objects.create_user(
            email="emp@emwts.com",
            password="securePassword123!",
            first_name="Jane",
            last_name="Doe",
        )
        self.assertEqual(user.email, "emp@emwts.com")
        self.assertEqual(user.role, Role.EMPLOYEE)
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("securePassword123!"))

    def test_create_superuser(self):
        admin = User.objects.create_superuser(
            email="super@emwts.com",
            password="adminPassword123!",
            first_name="Super",
            last_name="Admin",
        )
        self.assertEqual(admin.role, Role.SUPER_ADMIN)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_super_admin)


class AuthenticationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = "ValidPassword123!"
        self.user = User.objects.create_user(
            email="testuser@emwts.com",
            password=self.password,
            first_name="Test",
            last_name="User",
            role=Role.EMPLOYEE,
        )
        self.login_url = reverse("auth-login")
        self.refresh_url = reverse("auth-token-refresh")
        self.logout_url = reverse("auth-logout")
        self.me_url = reverse("auth-me")

    def test_successful_login(self):
        response = self.client.post(self.login_url, {
            "email": "testuser@emwts.com",
            "password": self.password,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "testuser@emwts.com")
        self.assertEqual(response.data["user"]["role"], Role.EMPLOYEE)
        # Check cookies
        self.assertIn("access_token", response.cookies)
        self.assertTrue(response.cookies["access_token"]["httponly"])

    def test_login_invalid_credentials(self):
        response = self.client.post(self.login_url, {
            "email": "testuser@emwts.com",
            "password": "WrongPassword!",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(self.login_url, {
            "email": "testuser@emwts.com",
            "password": self.password,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_refresh(self):
        refresh = str(RefreshToken.for_user(self.user))
        response = self.client.post(self.refresh_url, {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_logout(self):
        refresh = str(RefreshToken.for_user(self.user))
        response = self.client.post(self.logout_url, {"refresh": refresh})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Verify access cookie is cleared
        self.assertEqual(response.cookies["access_token"].value, "")

    def test_current_user_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["email"], self.user.email)
        self.assertEqual(response.data["roles"]["role"], Role.EMPLOYEE)

    def test_current_user_me_unauthenticated(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class RolePermissionBoundaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.super_admin = User.objects.create_superuser(
            email="superadmin@emwts.com",
            password="pass",
            role=Role.SUPER_ADMIN,
        )
        self.hr_admin = User.objects.create_user(
            email="hradmin@emwts.com",
            password="pass",
            role=Role.HR_ADMIN,
            is_staff=True,
        )
        self.manager = User.objects.create_user(
            email="manager@emwts.com",
            password="pass",
            role=Role.MANAGER,
        )
        self.report_employee = User.objects.create_user(
            email="report@emwts.com",
            password="pass",
            role=Role.EMPLOYEE,
            manager=self.manager,
        )
        self.other_employee = User.objects.create_user(
            email="other@emwts.com",
            password="pass",
            role=Role.EMPLOYEE,
        )

    def test_employee_cannot_access_other_employee_record(self):
        """Rule 6: Employees cannot access other employees' records merely by changing an ID."""
        self.client.force_authenticate(user=self.other_employee)
        url = reverse("auth-user-detail", kwargs={"pk": self.report_employee.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_employee_can_access_own_record(self):
        self.client.force_authenticate(user=self.other_employee)
        url = reverse("auth-user-detail", kwargs={"pk": self.other_employee.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.other_employee.email)

    def test_manager_can_access_direct_report_record(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse("auth-user-detail", kwargs={"pk": self.report_employee.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.report_employee.email)

    def test_manager_cannot_access_unrelated_employee_record(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse("auth-user-detail", kwargs={"pk": self.other_employee.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hr_admin_can_access_any_record(self):
        self.client.force_authenticate(user=self.hr_admin)
        url = reverse("auth-user-detail", kwargs={"pk": self.other_employee.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_super_admin_can_access_any_record(self):
        self.client.force_authenticate(user=self.super_admin)
        url = reverse("auth-user-detail", kwargs={"pk": self.other_employee.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
