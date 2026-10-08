import io
from PIL import Image
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role
from employees.models import Department, Employee, EmploymentStatus, EmploymentType

User = get_user_model()


def create_test_image(name="test.jpg", format="JPEG", size=(100, 100)):
    file_obj = io.BytesIO()
    image = Image.new("RGB", size, color="blue")
    image.save(file_obj, format=format)
    file_obj.seek(0)
    return SimpleUploadedFile(name, file_obj.read(), content_type=f"image/{format.lower()}")


class DepartmentAPITests(APITestCase):
    def setUp(self):
        # Admin user
        self.admin = User.objects.create_superuser(
            email="admin@emwts.local",
            password="AdminPass2026!",
            first_name="Admin",
            last_name="User",
        )
        # Regular employee user
        self.regular_user = User.objects.create_user(
            email="emp@emwts.local",
            password="EmpPass2026!",
            first_name="Regular",
            last_name="Employee",
            role=Role.EMPLOYEE,
        )
        self.dept = Department.objects.create(
            name="Engineering",
            code="ENG",
            description="Software Engineering team",
            is_active=True,
        )

    def test_list_departments_authenticated(self):
        self.client.force_authenticate(user=self.regular_user)
        url = reverse("department-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Engineering")

    def test_create_department_by_admin(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("department-list-create")
        data = {
            "name": "Human Resources",
            "code": "HR",
            "description": "HR & People Ops",
            "is_active": True,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Department.objects.filter(code="HR").exists())

    def test_create_department_by_regular_employee_forbidden(self):
        self.client.force_authenticate(user=self.regular_user)
        url = reverse("department-list-create")
        data = {
            "name": "Finance",
            "code": "FIN",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_department_name_or_code(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("department-list-create")
        # Same code
        response = self.client.post(url, {"name": "Other Dept", "code": "ENG"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Same name
        response = self.client.post(url, {"name": "Engineering", "code": "ENG2"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_department_soft_delete(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("department-detail", kwargs={"pk": self.dept.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.dept.refresh_from_db()
        self.assertFalse(self.dept.is_active)  # Soft deactivated, not deleted


class EmployeeAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="admin@emwts.local",
            password="AdminPass2026!",
            first_name="Admin",
            last_name="User",
        )
        self.hr_user = User.objects.create_user(
            email="hr@emwts.local",
            password="HRPass2026!",
            first_name="HR",
            last_name="Manager",
            role=Role.HR_ADMIN,
        )
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Create an employee
        self.emp_user1 = User.objects.create_user(
            email="john@emwts.local",
            password="JohnPass2026!",
            first_name="John",
            last_name="Doe",
            role=Role.EMPLOYEE,
        )
        self.employee1 = Employee.objects.create(
            user=self.emp_user1,
            employee_id="EMP-001",
            phone="+1234567890",
            department=self.dept,
            designation="Software Engineer",
            employment_type=EmploymentType.FULL_TIME,
            status=EmploymentStatus.ACTIVE,
            work_location="Remote",
            base_salary=95000.00,
            bank_account_number="123456789",
            national_id="TAX-998877",
            emergency_contact_name="Jane Doe",
            emergency_contact_phone="+1987654321",
        )

        # Create another employee
        self.emp_user2 = User.objects.create_user(
            email="alice@emwts.local",
            password="AlicePass2026!",
            first_name="Alice",
            last_name="Smith",
            role=Role.EMPLOYEE,
        )
        self.employee2 = Employee.objects.create(
            user=self.emp_user2,
            employee_id="EMP-002",
            phone="+1987654320",
            department=self.dept,
            designation="QA Engineer",
            employment_type=EmploymentType.FULL_TIME,
            status=EmploymentStatus.ACTIVE,
            work_location="On-site",
            base_salary=80000.00,
        )

    def test_list_employees(self):
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("employee-list-create")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get("results", response.data)
        self.assertGreaterEqual(len(results), 2)
        # Sensitive fields must NOT be in the list view
        self.assertNotIn("base_salary", results[0])
        self.assertNotIn("bank_account_number", results[0])

    def test_create_employee_success(self):
        self.client.force_authenticate(user=self.hr_user)
        url = reverse("employee-list-create")
        data = {
            "email": "newbie@emwts.local",
            "first_name": "Bob",
            "last_name": "Ross",
            "role": Role.EMPLOYEE,
            "employee_id": "EMP-003",
            "phone": "+1122334455",
            "department": self.dept.pk,
            "designation": "Junior Developer",
            "employment_type": EmploymentType.FULL_TIME,
            "work_location": "Hybrid",
            "base_salary": 70000.00,
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="newbie@emwts.local").exists())
        self.assertTrue(Employee.objects.filter(employee_id="EMP-003").exists())

    def test_create_employee_duplicate_email_forbidden(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("employee-list-create")
        data = {
            "email": "john@emwts.local",  # Duplicate email
            "first_name": "Another",
            "last_name": "John",
            "employee_id": "EMP-999",
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_employee_duplicate_employee_id_forbidden(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("employee-list-create")
        data = {
            "email": "brandnew@emwts.local",
            "first_name": "New",
            "last_name": "Person",
            "employee_id": "EMP-001",  # Duplicate employee_id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sensitive_field_masking_for_other_employees(self):
        # Alice views John's profile
        self.client.force_authenticate(user=self.emp_user2)
        url = reverse("employee-detail", kwargs={"pk": self.employee1.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Alice should NOT see John's sensitive fields
        self.assertNotIn("base_salary", response.data)
        self.assertNotIn("bank_account_number", response.data)
        self.assertNotIn("national_id", response.data)
        self.assertNotIn("emergency_contact_phone", response.data)

    def test_sensitive_field_visible_to_self(self):
        # John views his own profile
        self.client.force_authenticate(user=self.emp_user1)
        url = reverse("employee-detail", kwargs={"pk": self.employee1.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # John CAN see his own sensitive fields
        self.assertIn("base_salary", response.data)
        self.assertIn("bank_account_number", response.data)
        self.assertEqual(response.data["bank_account_number"], "123456789")

    def test_sensitive_field_visible_to_admin(self):
        # Admin views John's profile
        self.client.force_authenticate(user=self.admin)
        url = reverse("employee-detail", kwargs={"pk": self.employee1.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("base_salary", response.data)
        self.assertIn("bank_account_number", response.data)

    def test_search_and_filter_employees(self):
        self.client.force_authenticate(user=self.admin)
        # Search by name
        url = f"{reverse('employee-list-create')}?search=Alice"
        response = self.client.get(url)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["employee_id"], "EMP-002")

        # Search by employee_id
        url = f"{reverse('employee-list-create')}?search=EMP-001"
        response = self.client.get(url)
        results = response.data.get("results", response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["full_name"], "John Doe")

    def test_soft_deactivation_and_reactivation(self):
        self.client.force_authenticate(user=self.admin)
        # Deactivate
        deact_url = reverse("employee-deactivate", kwargs={"pk": self.employee1.pk})
        response = self.client.post(deact_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.employee1.refresh_from_db()
        self.assertTrue(self.employee1.is_archived)
        self.assertEqual(self.employee1.status, EmploymentStatus.INACTIVE)
        self.assertFalse(self.employee1.user.is_active)

        # Reactivate
        react_url = reverse("employee-reactivate", kwargs={"pk": self.employee1.pk})
        response = self.client.post(react_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.employee1.refresh_from_db()
        self.assertFalse(self.employee1.is_archived)
        self.assertEqual(self.employee1.status, EmploymentStatus.ACTIVE)
        self.assertTrue(self.employee1.user.is_active)

    def test_employee_image_upload_validation(self):
        self.client.force_authenticate(user=self.hr_user)
        image = create_test_image("profile.jpg")
        url = reverse("employee-list-create")
        data = {
            "email": "photoguy@emwts.local",
            "first_name": "Photo",
            "last_name": "Guy",
            "employee_id": "EMP-004",
            "profile_photo": image,
        }
        response = self.client.post(url, data, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Employee.objects.filter(employee_id="EMP-004").exists())
        emp = Employee.objects.get(employee_id="EMP-004")
        self.assertTrue(bool(emp.profile_photo))
