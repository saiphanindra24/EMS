from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

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


class Command(BaseCommand):
    help = "Seeds corporate training courses, employee enrollments, verified certifications, and exit clearance workflows."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Training, Certifications, and Exit Clearance Data for SSKATT EWTS...")

        today = timezone.localdate()
        eng_dept = Department.objects.filter(code="ENG").first() or Department.objects.first()

        admin_user = (
            User.objects.filter(role="SUPER_ADMIN").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )

        emp_list = list(Employee.objects.filter(is_archived=False).order_by("employee_id")[:5])
        if not emp_list:
            self.stdout.write(self.style.WARNING("No employees found to seed lifecycle data for."))
            return

        emp_arjun = emp_list[0]
        emp_ananya = emp_list[1] if len(emp_list) > 1 else emp_arjun
        emp_sneha = emp_list[2] if len(emp_list) > 2 else emp_arjun
        emp_vikram = emp_list[3] if len(emp_list) > 3 else emp_arjun

        # ── 1. Training Courses ──
        courses_data = [
            {
                "code": "TRN-2026-ARCH",
                "title": "Fullstack Event-Driven Microservices & Cloud Scaling",
                "instructor": "Arjun Mehta (Lead Systems Architect)",
                "department": eng_dept,
                "format": CourseFormat.VIRTUAL_LIVE,
                "level": CourseLevel.ADVANCED,
                "duration_hours": 24,
                "max_participants": 25,
                "start_date": today - timedelta(days=20),
                "end_date": today + timedelta(days=10),
                "is_mandatory": True,
                "skills_covered": "Django REST, Redis, WebSockets, Neon PostgreSQL, Celery",
                "description": "Comprehensive corporate engineering masterclass on decoupling monolithic architectures into scalable event-driven services.",
            },
            {
                "code": "TRN-2026-CLOUD",
                "title": "Kubernetes & Cloud Infrastructure Reliability at Scale",
                "instructor": "Dr. R. K. Sharma (Principal Infrastructure Fellow)",
                "department": eng_dept,
                "format": CourseFormat.BLENDED,
                "level": CourseLevel.ADVANCED,
                "duration_hours": 32,
                "max_participants": 30,
                "start_date": today - timedelta(days=10),
                "end_date": today + timedelta(days=25),
                "is_mandatory": False,
                "skills_covered": "Docker, Kubernetes, Helm, Terraform, Prometheus, Grafana",
                "description": "Hands-on cloud orchestration boot-camp covering zero-downtime rolling updates, canary rollouts, and autoscaling.",
            },
            {
                "code": "TRN-2026-SEC",
                "title": "Enterprise Application Security & OWASP Top 10 Compliance",
                "instructor": "Ananya Rao (Senior Security Specialist)",
                "department": eng_dept,
                "format": CourseFormat.SELF_PACED,
                "level": CourseLevel.INTERMEDIATE,
                "duration_hours": 12,
                "max_participants": 50,
                "start_date": today - timedelta(days=35),
                "end_date": today + timedelta(days=60),
                "is_mandatory": True,
                "skills_covered": "RBAC, JWT Security, SQL Injection Prevention, XSS, CSRF, TLS",
                "description": "Mandatory security certification required for all product engineers touching customer financial and biometric telemetry.",
            },
            {
                "code": "TRN-2026-AGILE",
                "title": "High-Velocity Sprint Execution & Scrum Leadership",
                "instructor": "Priya Sharma (HR & Agile Practice Director)",
                "department": None,
                "format": CourseFormat.CLASSROOM_ONSITE,
                "level": CourseLevel.BEGINNER,
                "duration_hours": 8,
                "max_participants": 40,
                "start_date": today + timedelta(days=15),
                "end_date": today + timedelta(days=16),
                "is_mandatory": False,
                "skills_covered": "Sprint Planning, Velocity Forecasting, Retrospectives, JIRA",
                "description": "Interactive workshop on team rhythm, milestone delivery, and cross-functional communication.",
            },
        ]

        created_courses = []
        for cdata in courses_data:
            c, _ = TrainingCourse.objects.update_or_create(
                code=cdata["code"],
                defaults=cdata
            )
            created_courses.append(c)

        # ── 2. Training Enrollments ──
        c1, c2, c3, c4 = created_courses

        TrainingEnrollment.objects.update_or_create(
            employee=emp_ananya,
            course=c1,
            defaults={
                "status": EnrollmentStatus.COMPLETED,
                "progress_percent": 100,
                "completion_date": today - timedelta(days=2),
                "feedback_rating": 5,
                "feedback_comments": "Exceptional architecture course with practical real-time coding sessions and deep-dives into connection pooling.",
            }
        )

        TrainingEnrollment.objects.update_or_create(
            employee=emp_sneha,
            course=c2,
            defaults={
                "status": EnrollmentStatus.IN_PROGRESS,
                "progress_percent": 75,
                "completion_date": None,
                "feedback_rating": 5,
                "feedback_comments": "Great hands-on Kubernetes lab exercises.",
            }
        )

        TrainingEnrollment.objects.update_or_create(
            employee=emp_vikram,
            course=c3,
            defaults={
                "status": EnrollmentStatus.COMPLETED,
                "progress_percent": 100,
                "completion_date": today - timedelta(days=5),
                "feedback_rating": 5,
                "feedback_comments": "Essential security training for QA and automated regression pipelines.",
            }
        )

        TrainingEnrollment.objects.update_or_create(
            employee=emp_arjun,
            course=c3,
            defaults={
                "status": EnrollmentStatus.COMPLETED,
                "progress_percent": 100,
                "completion_date": today - timedelta(days=8),
                "feedback_rating": 5,
                "feedback_comments": "Thorough and actionable OWASP compliance guidelines.",
            }
        )

        # ── 3. Employee Professional Certifications ──
        certs_data = [
            {
                "employee": emp_arjun,
                "name": "AWS Certified Solutions Architect - Professional",
                "issuing_organization": "Amazon Web Services (AWS)",
                "issue_date": today - timedelta(days=300),
                "expiry_date": today + timedelta(days=795),
                "credential_id": "AWS-PSA-994821",
                "credential_url": "https://aws.amazon.com/verification",
                "is_verified": True,
            },
            {
                "employee": emp_ananya,
                "name": "Certified Kubernetes Application Developer (CKAD)",
                "issuing_organization": "The Linux Foundation & CNCF",
                "issue_date": today - timedelta(days=120),
                "expiry_date": today + timedelta(days=975),
                "credential_id": "CKAD-CNCF-882103",
                "credential_url": "https://www.cncf.io/certification/ckad/",
                "is_verified": True,
            },
            {
                "employee": emp_sneha,
                "name": "Meta Certified Front-End Developer Professional",
                "issuing_organization": "Meta Staff Engineering Credential",
                "issue_date": today - timedelta(days=60),
                "expiry_date": None,
                "credential_id": "META-FED-441290",
                "credential_url": "https://coursera.org/verify/professional-cert",
                "is_verified": True,
            },
            {
                "employee": emp_vikram,
                "name": "ISTQB Certified Advanced Test Automation Engineer",
                "issuing_organization": "International Software Testing Qualifications Board",
                "issue_date": today - timedelta(days=180),
                "expiry_date": None,
                "credential_id": "ISTQB-CTAL-TAE-194",
                "credential_url": "https://istqb.org/verify",
                "is_verified": True,
            },
        ]

        for cert in certs_data:
            EmployeeCertification.objects.update_or_create(
                employee=cert["employee"],
                name=cert["name"],
                defaults=cert
            )

        # ── 4. Exit Request & Multi-Department Clearance ──
        # Let's seed an exit request for demonstration
        exit_emp = emp_vikram
        exit_req, _ = ExitRequest.objects.update_or_create(
            employee=exit_emp,
            defaults={
                "resignation_date": today - timedelta(days=14),
                "reason_category": ExitReason.HIGHER_EDUCATION,
                "detailed_reason": "Admitted to Master of Science in Distributed Systems at CMU. Requesting handover completion by next month.",
                "notice_period_days": 30,
                "requested_last_working_day": today + timedelta(days=16),
                "agreed_last_working_day": today + timedelta(days=16),
                "status": ExitStatus.CLEARANCE_IN_PROGRESS,
                "manager_reviewed_by": admin_user,
                "manager_comments": "Accepted with warm regards. Vikram has agreed to complete comprehensive test automation handover.",
                "manager_action_date": timezone.now() - timedelta(days=12),
                "exit_interview_completed": True,
                "exit_interview_notes": "Very positive feedback on engineering culture and team camaraderie. Highlighted growth in automated testing.",
                "retention_discussion": "Employee is committed to full-time master's program abroad; welcomed to return post-degree.",
                "would_recommend_company": True,
                "relieving_letter_issued": False,
            }
        )

        # Department Clearances for the exit request
        ExitClearance.objects.update_or_create(
            exit_request=exit_req,
            department=ClearanceDepartment.IT_ASSET_RECOVERY,
            defaults={
                "is_cleared": True,
                "cleared_by": admin_user,
                "cleared_at": timezone.now() - timedelta(days=5),
                "notes": "MacBook Pro M3 Max (Asset #VK-902) and 27-inch 4K monitor returned in pristine condition.",
            }
        )

        ExitClearance.objects.update_or_create(
            exit_request=exit_req,
            department=ClearanceDepartment.REPORTING_MANAGER,
            defaults={
                "is_cleared": True,
                "cleared_by": admin_user,
                "cleared_at": timezone.now() - timedelta(days=3),
                "notes": "Regression test suite documentation and CI/CD pipelines successfully transitioned to Sneha.",
            }
        )

        ExitClearance.objects.update_or_create(
            exit_request=exit_req,
            department=ClearanceDepartment.FINANCE_SETTLEMENT,
            defaults={
                "is_cleared": False,
                "cleared_by": None,
                "cleared_at": None,
                "notes": "Pending final payroll run and 14 days earned leave encashment computation.",
            }
        )

        ExitClearance.objects.update_or_create(
            exit_request=exit_req,
            department=ClearanceDepartment.HR_DOCUMENTATION,
            defaults={
                "is_cleared": False,
                "cleared_by": None,
                "cleared_at": None,
                "notes": "Awaiting final settlement sign-off before releasing relieving letter and experience certificate.",
            }
        )

        self.stdout.write(self.style.SUCCESS("Successfully seeded Training Courses, Enrollments, Certifications, and Exit Clearances!"))
