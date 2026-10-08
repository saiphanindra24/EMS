from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from employees.models import Employee
from .models import Task, TaskComment, TaskHistory, TaskPriority, TaskStatus
from .permissions import CanCreateTasksPermission, CanModifyTaskPermission
from .serializers import (
    TaskCommentSerializer,
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskUpdateSerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class TaskListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/tasks/
    List tasks with search, filtering, and role-based visibility.

    POST /api/v1/tasks/
    Create task (Super Admin, HR Admin, or Manager only).
    """
    permission_classes = [CanCreateTasksPermission]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TaskCreateSerializer
        return TaskListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Task.objects.select_related(
            "assignee", "assignee__user", "assignee__department", "department", "assigning_manager"
        )

        # Archive filter: exclude archived unless explicitly requested
        include_archived = self.request.query_params.get("include_archived", "false").lower() in ["true", "1"]
        if not include_archived:
            qs = qs.filter(is_archived=False)

        # Role-based visibility
        if user.is_super_admin or user.is_hr_admin:
            pass  # Full visibility
        elif user.role == Role.MANAGER:
            # Manager sees tasks they assigned, tasks assigned to their reports, or tasks in their department
            manager_emp = getattr(user, "employee_profile", None)
            mgr_filter = Q(assigning_manager=user)
            if manager_emp:
                mgr_filter |= Q(assignee=manager_emp) | Q(assignee__manager=manager_emp)
                if manager_emp.department_id:
                    mgr_filter |= Q(department_id=manager_emp.department_id)
            qs = qs.filter(mgr_filter)
        else:
            # Regular employee sees tasks assigned to them, or open tasks in their department
            emp = getattr(user, "employee_profile", None)
            if emp:
                emp_filter = Q(assignee=emp)
                if emp.department_id:
                    emp_filter |= Q(department_id=emp.department_id)
                qs = qs.filter(emp_filter)
            else:
                return Task.objects.none()

        # Query Filters
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(task_id__icontains=search)
                | Q(description__icontains=search)
                | Q(assignee__user__first_name__icontains=search)
                | Q(assignee__user__last_name__icontains=search)
            )

        assignee_param = self.request.query_params.get("assignee")
        if assignee_param:
            if assignee_param == "me" and hasattr(user, "employee_profile"):
                qs = qs.filter(assignee=user.employee_profile)
            elif assignee_param.isdigit():
                qs = qs.filter(assignee_id=assignee_param)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        priority_param = self.request.query_params.get("priority")
        if priority_param:
            qs = qs.filter(priority__iexact=priority_param)

        department_param = self.request.query_params.get("department")
        if department_param:
            if department_param.isdigit():
                qs = qs.filter(department_id=department_param)
            else:
                qs = qs.filter(department__code__iexact=department_param)

        due_date_param = self.request.query_params.get("due_date")
        if due_date_param:
            qs = qs.filter(due_date=due_date_param)

        overdue_param = self.request.query_params.get("overdue")
        if overdue_param and overdue_param.lower() in ["true", "1"]:
            today = timezone.localdate()
            qs = qs.filter(due_date__lt=today).exclude(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED])

        ordering = self.request.query_params.get("ordering", "-created_at")
        allowed_orderings = [
            "created_at", "-created_at",
            "due_date", "-due_date",
            "priority", "-priority",
            "status", "-status",
            "progress", "-progress",
        ]
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-created_at")

        return qs

    def perform_create(self, serializer):
        task = serializer.save()
        try:
            from notifications.services import NotificationService
            NotificationService.notify_task_assigned(task, actor=self.request.user)
        except Exception:
            pass


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/tasks/<int:pk>/
    View task details with comments and history.

    PUT/PATCH /api/v1/tasks/<int:pk>/
    Update task. Field permissions enforced by TaskUpdateSerializer.

    DELETE /api/v1/tasks/<int:pk>/
    Soft archive task (sets is_archived=True).
    """
    permission_classes = [permissions.IsAuthenticated, CanModifyTaskPermission]
    queryset = Task.objects.select_related(
        "assignee", "assignee__user", "assignee__department", "department", "assigning_manager"
    ).prefetch_related("comments__author", "history__changed_by")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TaskUpdateSerializer
        return TaskDetailSerializer

    def perform_update(self, serializer):
        old_assignee = serializer.instance.assignee
        task = serializer.save()
        if task.assignee and task.assignee != old_assignee:
            try:
                from notifications.services import NotificationService
                NotificationService.notify_task_assigned(task, actor=self.request.user)
            except Exception:
                pass

    def perform_destroy(self, instance):
        instance.is_archived = True
        instance.save(update_fields=["is_archived", "updated_at"])
        TaskHistory.objects.create(
            task=instance,
            changed_by=self.request.user,
            field_name="archived",
            old_value="False",
            new_value="True",
        )


class TaskCommentListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/tasks/<int:pk>/comments/
    List comments on a task.

    POST /api/v1/tasks/<int:pk>/comments/
    Add a comment to a task.
    """
    permission_classes = [permissions.IsAuthenticated, CanModifyTaskPermission]
    serializer_class = TaskCommentSerializer

    def get_queryset(self):
        return TaskComment.objects.filter(task_id=self.kwargs["pk"]).select_related("author")

    def perform_create(self, serializer):
        task = Task.objects.get(pk=self.kwargs["pk"])
        serializer.save(task=task, author=self.request.user)


class TaskStatsView(APIView):
    """
    GET /api/v1/tasks/stats/
    Provides task metrics for dashboard widgets and team tracking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        qs = Task.objects.filter(is_archived=False)

        if not (user.is_super_admin or user.is_hr_admin):
            if user.role == Role.MANAGER:
                manager_emp = getattr(user, "employee_profile", None)
                mgr_filter = Q(assigning_manager=user)
                if manager_emp:
                    mgr_filter |= Q(assignee=manager_emp) | Q(assignee__manager=manager_emp)
                    if manager_emp.department_id:
                        mgr_filter |= Q(department_id=manager_emp.department_id)
                qs = qs.filter(mgr_filter)
            else:
                emp = getattr(user, "employee_profile", None)
                if emp:
                    emp_filter = Q(assignee=emp)
                    if emp.department_id:
                        emp_filter |= Q(department_id=emp.department_id)
                    qs = qs.filter(emp_filter)
                else:
                    qs = Task.objects.none()

        today = timezone.localdate()
        total = qs.count()
        todo = qs.filter(status=TaskStatus.TODO).count()
        in_progress = qs.filter(status=TaskStatus.IN_PROGRESS).count()
        in_review = qs.filter(status=TaskStatus.IN_REVIEW).count()
        completed = qs.filter(status=TaskStatus.COMPLETED).count()
        blocked = qs.filter(status=TaskStatus.BLOCKED).count()
        overdue = qs.filter(due_date__lt=today).exclude(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]).count()

        return Response({
            "total": total,
            "todo": todo,
            "in_progress": in_progress,
            "in_review": in_review,
            "completed": completed,
            "blocked": blocked,
            "overdue": overdue,
        }, status=status.HTTP_200_OK)
