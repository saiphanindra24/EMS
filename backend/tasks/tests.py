from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role
from employees.models import Department, Employee
from tasks.models import Task, TaskComment, TaskHistory, TaskPriority, TaskStatus

User = get_user_model()


class TaskAPITests(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(name="Engineering", code="ENG")

        # Admin
        self.admin = User.objects.create_superuser(
            email="admin@emwts.local",
            password="AdminPass2026!",
            first_name="Admin",
            last_name="User",
        )
        self.admin_emp = Employee.objects.create(user=self.admin, employee_id="EMP-ADM", department=self.dept)

        # Manager
        self.manager = User.objects.create_user(
            email="manager@emwts.local",
            password="ManagerPass2026!",
            first_name="Manager",
            last_name="Verma",
            role=Role.MANAGER,
        )
        self.manager_emp = Employee.objects.create(user=self.manager, employee_id="EMP-MGR", department=self.dept)

        # Employee 1
        self.emp1 = User.objects.create_user(
            email="emp1@emwts.local",
            password="EmpPass2026!",
            first_name="Ananya",
            last_name="Rao",
            role=Role.EMPLOYEE,
        )
        self.emp1_profile = Employee.objects.create(
            user=self.emp1,
            employee_id="EMP-001",
            department=self.dept,
            manager=self.manager_emp,
        )

        # Employee 2
        self.emp2 = User.objects.create_user(
            email="emp2@emwts.local",
            password="EmpPass2026!",
            first_name="Arjun",
            last_name="Mehta",
            role=Role.EMPLOYEE,
        )
        self.emp2_profile = Employee.objects.create(
            user=self.emp2,
            employee_id="EMP-002",
            department=self.dept,
        )

    def test_manager_create_task_success(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse("task-list-create")
        data = {
            "title": "Design REST API Architecture",
            "description": "Establish schemas and contracts for endpoints.",
            "assignee": self.emp1_profile.pk,
            "department": self.dept.pk,
            "priority": TaskPriority.HIGH,
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() + timedelta(days=5)),
            "estimated_hours": "16.00",
        }
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Task.objects.filter(title="Design REST API Architecture").exists())
        task = Task.objects.get(title="Design REST API Architecture")
        self.assertEqual(task.assignee, self.emp1_profile)
        self.assertEqual(task.priority, TaskPriority.HIGH)

    def test_employee_cannot_create_task(self):
        self.client.force_authenticate(user=self.emp1)
        url = reverse("task-list-create")
        data = {
            "title": "Unauthorized Task Creation",
            "priority": TaskPriority.LOW,
        }
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_due_date_before_start_date_validation_error(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse("task-list-create")
        data = {
            "title": "Invalid Dates Task",
            "start_date": str(timezone.localdate()),
            "due_date": str(timezone.localdate() - timedelta(days=2)),
        }
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("due_date", res.data)

    def test_assignee_can_update_status_and_progress(self):
        task = Task.objects.create(
            task_id="TSK-001",
            title="Implement User Flow",
            assignee=self.emp1_profile,
            assigning_manager=self.manager,
            department=self.dept,
            status=TaskStatus.TODO,
            progress=0,
        )

        self.client.force_authenticate(user=self.emp1)
        url = reverse("task-detail", kwargs={"pk": task.pk})
        data = {
            "status": TaskStatus.IN_PROGRESS,
            "progress": 50,
            "actual_hours": "4.50",
        }
        res = self.client.patch(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        self.assertEqual(task.status, TaskStatus.IN_PROGRESS)
        self.assertEqual(task.progress, 50)
        self.assertEqual(task.actual_hours, Decimal("4.50"))

        # Verify task history logged the changes
        history = TaskHistory.objects.filter(task=task)
        self.assertGreaterEqual(history.count(), 1)

    def test_assignee_cannot_modify_administrative_properties(self):
        task = Task.objects.create(
            task_id="TSK-002",
            title="Original Title",
            assignee=self.emp1_profile,
            assigning_manager=self.manager,
            priority=TaskPriority.LOW,
        )

        self.client.force_authenticate(user=self.emp1)
        url = reverse("task-detail", kwargs={"pk": task.pk})
        # Attempt to change title, priority, or assignee
        data = {
            "title": "Hacked Title",
            "priority": TaskPriority.URGENT,
        }
        res = self.client.patch(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Employees are not authorized", str(res.data))

    def test_task_commenting(self):
        task = Task.objects.create(
            task_id="TSK-003",
            title="Review Pull Request",
            assignee=self.emp1_profile,
            assigning_manager=self.manager,
        )

        # Employee leaves a comment
        self.client.force_authenticate(user=self.emp1)
        url = reverse("task-comments", kwargs={"pk": task.pk})
        res = self.client.post(url, {"content": "PR is ready for review at #42."}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.assertEqual(TaskComment.objects.filter(task=task).count(), 1)
        comment = TaskComment.objects.get(task=task)
        self.assertEqual(comment.author, self.emp1)
        self.assertIn("PR is ready", comment.content)

    def test_task_soft_archival(self):
        task = Task.objects.create(
            task_id="TSK-004",
            title="Old Deprecated Feature",
            assignee=self.emp1_profile,
            assigning_manager=self.manager,
        )

        self.client.force_authenticate(user=self.manager)
        url = reverse("task-detail", kwargs={"pk": task.pk})
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        task.refresh_from_db()
        self.assertTrue(task.is_archived)

    def test_overdue_and_filter_tasks(self):
        today = timezone.localdate()
        # Overdue task
        Task.objects.create(
            task_id="TSK-OD",
            title="Overdue Audit",
            assignee=self.emp1_profile,
            due_date=today - timedelta(days=3),
            status=TaskStatus.IN_PROGRESS,
        )
        # Completed task past due (should NOT be considered overdue)
        Task.objects.create(
            task_id="TSK-DONE",
            title="Completed Audit",
            assignee=self.emp1_profile,
            due_date=today - timedelta(days=3),
            status=TaskStatus.COMPLETED,
        )

        self.client.force_authenticate(user=self.manager)
        url = f"{reverse('task-list-create')}?overdue=true"
        res = self.client.get(url)
        results = res.data.get("results", res.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["task_id"], "TSK-OD")
        self.assertTrue(results[0]["is_overdue"])
