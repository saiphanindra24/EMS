from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import Role
from employees.models import Department, Employee
from lifecycle.models import (
    ClearanceDepartment,
    CourseFormat,
    CourseLevel,
    EmployeeCertification,
    EnrollmentStatus,
    ExitClearance,
    ExitReason,
    ExitRequest,
    ExitStatus,
    TrainingCourse,
    TrainingEnrollment,
)

User = get_user_model()


class LifecycleManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Admin user
        self.admin_user = User.objects.create_user(
            email="admin.life@sskatttest.local",
            password="AdminPassword123!",
            role=Role.SUPER_ADMIN,
            first_name="Admin",
            last_name="System",
            is_staff=True
        )

        # Manager user & profile
        self.manager_user = User.objects.create_user(
            email="manager.life@sskatttest.local",
            password="ManagerPassword123!",
            role=Role.MANAGER,
            first_name="Rajesh",
            last_name="Kumar"
        )
        self.manager_emp = Employee.objects.create(
            user=self.manager_user,
            employee_id="EMP-MGR-LIFE",
            department=self.dept,
            designation="Engineering Director"
        )

        # Employee user & profile
        self.emp_user = User.objects.create_user(
            email="ananya.life@sskatttest.local",
            password="EmpPassword123!",
            role=Role.EMPLOYEE,
            first_name="Ananya",
            last_name="Rao"
        )
        self.emp_profile = Employee.objects.create(
            user=self.emp_user,
            employee_id="EMP-DEV-LIFE",
            department=self.dept,
            designation="Senior Frontend Engineer",
            manager=self.manager_emp
        )

        # Sample Course
        today = timezone.localdate()
        self.course = TrainingCourse.objects.create(
            code="TRN-TEST-101",
            title="Advanced Cloud Architectures",
            instructor="Lead Architect",
            format=CourseFormat.VIRTUAL_LIVE,
            level=CourseLevel.ADVANCED,
            duration_hours=20,
            start_date=today,
            end_date=today + timedelta(days=10)
        )

    def test_course_listing_and_enrollment(self):
        self.client.force_authenticate(user=self.emp_user)
        res = self.client.post(f"/api/v1/lifecycle/courses/{self.course.id}/enroll/")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["course_code"], "TRN-TEST-101")
        self.assertEqual(res.data["status"], EnrollmentStatus.ENROLLED)

        # Second call returns existing enrollment (200 OK)
        res2 = self.client.post(f"/api/v1/lifecycle/courses/{self.course.id}/enroll/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

    def test_update_enrollment_progress_and_feedback(self):
        enrollment = TrainingEnrollment.objects.create(
            employee=self.emp_profile,
            course=self.course,
            status=EnrollmentStatus.ENROLLED,
            progress_percent=20
        )

        self.client.force_authenticate(user=self.emp_user)
        patch_url = f"/api/v1/lifecycle/enrollments/{enrollment.id}/update_progress/"
        payload = {
            "progress_percent": 100,
            "feedback_rating": 5,
            "feedback_comments": "Practical masterclass with clear architecture takeaways."
        }
        res = self.client.patch(patch_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        enrollment.refresh_from_db()
        self.assertEqual(enrollment.status, EnrollmentStatus.COMPLETED)
        self.assertEqual(enrollment.progress_percent, 100)
        self.assertEqual(enrollment.feedback_rating, 5)
        self.assertIsNotNone(enrollment.completion_date)

    def test_employee_certification_logging(self):
        self.client.force_authenticate(user=self.emp_user)
        payload = {
            "name": "AWS Certified Developer",
            "issuing_organization": "Amazon Web Services",
            "issue_date": "2026-05-10",
            "credential_id": "AWS-DEV-12345",
            "credential_url": "https://aws.amazon.com/verify/12345"
        }
        res = self.client.post("/api/v1/lifecycle/certifications/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "AWS Certified Developer")
        self.assertTrue(res.data["is_verified"])

    def test_resignation_submission_and_clearance_generation(self):
        self.client.force_authenticate(user=self.emp_user)
        today = timezone.localdate()
        payload = {
            "reason_category": "HIGHER_EDUCATION",
            "detailed_reason": "Admitted to graduate university studies.",
            "notice_period_days": 30,
            "requested_last_working_day": str(today + timedelta(days=30))
        }
        res = self.client.post("/api/v1/lifecycle/exits/submit_resignation/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data
        self.assertEqual(data["status"], ExitStatus.SUBMITTED)
        # Verify 4 clearance items generated
        self.assertEqual(len(data["clearance_items"]), 4)

    def test_manager_approval_and_clearance_signoff(self):
        today = timezone.localdate()
        exit_req = ExitRequest.objects.create(
            employee=self.emp_profile,
            reason_category=ExitReason.CAREER_CHANGE,
            notice_period_days=30,
            requested_last_working_day=today + timedelta(days=30),
            status=ExitStatus.SUBMITTED
        )
        for dept_code in ClearanceDepartment.values:
            ExitClearance.objects.create(exit_request=exit_req, department=dept_code)

        # Manager approves
        self.client.force_authenticate(user=self.manager_user)
        rev_url = f"/api/v1/lifecycle/exits/{exit_req.id}/manager_review/"
        res = self.client.post(
            rev_url,
            {"action": "APPROVE", "agreed_last_working_day": str(today + timedelta(days=30)), "manager_comments": "Approved"},
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        exit_req.refresh_from_db()
        self.assertEqual(exit_req.status, ExitStatus.CLEARANCE_IN_PROGRESS)

        # Admin signs IT clearance
        self.client.force_authenticate(user=self.admin_user)
        clear_url = f"/api/v1/lifecycle/exits/{exit_req.id}/sign_clearance/"
        c_res = self.client.post(
            clear_url,
            {"department": ClearanceDepartment.IT_ASSET_RECOVERY, "is_cleared": True, "notes": "Laptop returned"},
            format="json"
        )
        self.assertEqual(c_res.status_code, status.HTTP_200_OK)
        it_clearance = ExitClearance.objects.get(exit_request=exit_req, department=ClearanceDepartment.IT_ASSET_RECOVERY)
        self.assertTrue(it_clearance.is_cleared)

    def test_lifecycle_stats(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get("/api/v1/lifecycle/exits/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_courses", res.data)
        self.assertIn("total_enrollments", res.data)
        self.assertIn("active_certifications", res.data)
        self.assertIn("ongoing_exits", res.data)
