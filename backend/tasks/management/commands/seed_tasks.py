from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from employees.models import Department, Employee
from tasks.models import Task, TaskComment, TaskHistory, TaskPriority, TaskStatus

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds initial database-driven tasks, comments, and history into EMWTS."

    def handle(self, *args, **options):
        self.stdout.write("Seeding tasks and work tracking records...")

        with transaction.atomic():
            admin_user = User.objects.filter(role="SUPER_ADMIN").first()
            manager_user = User.objects.filter(role="MANAGER").first() or admin_user

            eng_dept = Department.objects.filter(code="ENG").first()
            prod_dept = Department.objects.filter(code="PROD").first()
            mkt_dept = Department.objects.filter(code="MKT").first()

            emp_ananya = Employee.objects.filter(employee_id="EMP-004").first()
            emp_arjun = Employee.objects.filter(employee_id="EMP-005").first()
            emp_sneha = Employee.objects.filter(employee_id="EMP-006").first()
            emp_vikram = Employee.objects.filter(employee_id="EMP-007").first()

            today = timezone.localdate()

            tasks_specs = [
                {
                    "task_id": "TSK-101",
                    "title": "Build Dynamic Kanban & Task Board UI",
                    "description": "Develop full interactive task cards with progress sliders, status dropdowns, priority tags, and responsive modal viewers.",
                    "assignee": emp_ananya,
                    "assigning_manager": manager_user,
                    "department": eng_dept,
                    "priority": TaskPriority.HIGH,
                    "start_date": today - timedelta(days=2),
                    "due_date": today + timedelta(days=3),
                    "status": TaskStatus.IN_PROGRESS,
                    "progress": 65,
                    "estimated_hours": Decimal("24.00"),
                    "actual_hours": Decimal("15.50"),
                    "comments": [
                        (manager_user, "Great progress on the filters. Make sure overdue dates turn distinctively red/urgent."),
                        (getattr(emp_ananya, "user", admin_user), "Added overdue badges and duration badges! Working on comments feed now."),
                    ],
                },
                {
                    "task_id": "TSK-102",
                    "title": "Optimize PostgreSQL Connection Pooling & Indexing",
                    "description": "Audit slow query logs, review execution plans for attendance date range queries, and verify connection pooling.",
                    "assignee": emp_arjun,
                    "assigning_manager": manager_user,
                    "department": eng_dept,
                    "priority": TaskPriority.URGENT,
                    "start_date": today - timedelta(days=5),
                    "due_date": today - timedelta(days=1),  # Intentionally overdue
                    "status": TaskStatus.IN_PROGRESS,
                    "progress": 80,
                    "estimated_hours": Decimal("18.00"),
                    "actual_hours": Decimal("16.00"),
                    "comments": [
                        (manager_user, "Due date has passed. Need this wrapped up for the release."),
                        (getattr(emp_arjun, "user", admin_user), "Running final benchmark benchmarks on attendance indices now."),
                    ],
                },
                {
                    "task_id": "TSK-103",
                    "title": "Design Corporate Design Tokens & Glassmorphism Theme",
                    "description": "Establish cohesive color schemes, card elevation shadows, badges, and dark glassmorphic styling tokens across web app.",
                    "assignee": emp_sneha,
                    "assigning_manager": manager_user,
                    "department": prod_dept,
                    "priority": TaskPriority.MEDIUM,
                    "start_date": today - timedelta(days=7),
                    "due_date": today - timedelta(days=2),
                    "status": TaskStatus.COMPLETED,
                    "progress": 100,
                    "estimated_hours": Decimal("12.00"),
                    "actual_hours": Decimal("11.50"),
                    "comments": [
                        (getattr(emp_sneha, "user", admin_user), "Design tokens finalized and approved by leadership."),
                    ],
                },
                {
                    "task_id": "TSK-104",
                    "title": "Launch Q4 Employer Branding & Talent Campaign",
                    "description": "Draft social announcements, developer spotlight articles, and coordinate with engineering leads for quotes.",
                    "assignee": emp_vikram,
                    "assigning_manager": admin_user,
                    "department": mkt_dept,
                    "priority": TaskPriority.MEDIUM,
                    "start_date": today,
                    "due_date": today + timedelta(days=10),
                    "status": TaskStatus.TODO,
                    "progress": 0,
                    "estimated_hours": Decimal("20.00"),
                    "actual_hours": Decimal("0.00"),
                    "comments": [],
                },
                {
                    "task_id": "TSK-105",
                    "title": "Conduct Security & RBAC Access Boundary Review",
                    "description": "Verify object ownership tests, prevent IDOR vulnerabilities, and ensure salary and private employee fields remain masked.",
                    "assignee": emp_arjun,
                    "assigning_manager": admin_user,
                    "department": eng_dept,
                    "priority": TaskPriority.URGENT,
                    "start_date": today - timedelta(days=1),
                    "due_date": today + timedelta(days=2),
                    "status": TaskStatus.IN_REVIEW,
                    "progress": 90,
                    "estimated_hours": Decimal("14.00"),
                    "actual_hours": Decimal("12.00"),
                    "comments": [
                        (admin_user, "All 40 backend security tests are green. Ready for final staging review."),
                    ],
                },
                {
                    "task_id": "TSK-106",
                    "title": "Update Employee Onboarding Handbooks",
                    "description": "Revise benefits summary, attendance policy grace periods, and reporting hierarchy documentation.",
                    "assignee": None,
                    "assigning_manager": admin_user,
                    "department": eng_dept,
                    "priority": TaskPriority.LOW,
                    "start_date": today,
                    "due_date": today + timedelta(days=14),
                    "status": TaskStatus.TODO,
                    "progress": 0,
                    "estimated_hours": Decimal("8.00"),
                    "actual_hours": Decimal("0.00"),
                    "comments": [],
                },
            ]

            for spec in tasks_specs:
                comments = spec.pop("comments")
                task, created = Task.objects.get_or_create(
                    task_id=spec["task_id"],
                    defaults=spec,
                )
                if not created:
                    for k, v in spec.items():
                        setattr(task, k, v)
                    task.save()

                # Add comments
                for author, text in comments:
                    if author and not TaskComment.objects.filter(task=task, content=text).exists():
                        TaskComment.objects.create(task=task, author=author, content=text)

                self.stdout.write(f"  Task: [{task.task_id}] {task.title} ({task.status}) - Assignee: {task.assignee}")

        self.stdout.write(self.style.SUCCESS("Successfully seeded real database tasks, comments, and history."))
