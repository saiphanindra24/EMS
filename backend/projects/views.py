from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import Role
from employees.models import Employee
from projects.models import (
    DailyWorkReport,
    DailyWorkReportStatus,
    Milestone,
    Project,
    ProjectMember,
    ProjectStatus,
)
from projects.serializers import (
    DailyWorkReportReviewInputSerializer,
    DailyWorkReportSerializer,
    MilestoneSerializer,
    ProjectMemberSerializer,
    ProjectSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    Manage Projects with milestones and resource memberships.
    """
    queryset = Project.objects.all().select_related("lead__user", "department").prefetch_related("memberships__employee__user", "milestones")
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        health_param = self.request.query_params.get("health")
        search = self.request.query_params.get("search")

        if status_param:
            qs = qs.filter(status=status_param)
        if health_param:
            qs = qs.filter(health=health_param)
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(client_name__icontains=search)
            )
        return qs

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        total_projects = Project.objects.count()
        active_projects = Project.objects.filter(status=ProjectStatus.IN_PROGRESS).count()
        completed_projects = Project.objects.filter(status=ProjectStatus.COMPLETED).count()
        totals = Project.objects.aggregate(
            total_budget=Sum("budget"),
            total_spent=Sum("spent_budget")
        )

        return Response({
            "total_projects": total_projects,
            "active_projects": active_projects,
            "completed_projects": completed_projects,
            "total_budget": totals["total_budget"] or Decimal("0.00"),
            "total_spent": totals["total_spent"] or Decimal("0.00"),
        })

    @action(detail=True, methods=["post"], url_path="add-member")
    def add_member(self, request, pk=None):
        project = self.get_object()
        employee_id = request.data.get("employee_id")
        role = request.data.get("role", "Contributor")
        allocation = int(request.data.get("allocation_percentage", 100))
        is_billable = bool(request.data.get("is_billable", True))

        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        membership, _ = ProjectMember.objects.update_or_create(
            project=project,
            employee=employee,
            defaults={
                "role": role,
                "allocation_percentage": allocation,
                "is_billable": is_billable,
            }
        )

        return Response(ProjectMemberSerializer(membership).data, status=status.HTTP_200_OK)


class MilestoneViewSet(viewsets.ModelViewSet):
    """
    Project milestones management.
    """
    queryset = Milestone.objects.all().select_related("project")
    serializer_class = MilestoneSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @action(detail=True, methods=["post"], url_path="toggle-achieved")
    def toggle_achieved(self, request, pk=None):
        milestone = self.get_object()
        milestone.is_achieved = not milestone.is_achieved
        milestone.achieved_at = timezone.now() if milestone.is_achieved else None
        milestone.save(update_fields=["is_achieved", "achieved_at"])
        return Response(MilestoneSerializer(milestone).data)


class DailyWorkReportViewSet(viewsets.ModelViewSet):
    """
    Daily Work Reports (DWR) submitted by employees and reviewed by leads/managers.
    """
    queryset = DailyWorkReport.objects.all().select_related("employee__user", "employee__department", "project", "reviewed_by")
    serializer_class = DailyWorkReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        # If regular employee, default to own DWRs unless explicitly querying team
        if not (user.is_super_admin or user.is_hr_admin):
            if user.role == Role.MANAGER and hasattr(user, "employee_profile"):
                # Manager sees own and their direct reports' reports
                qs = qs.filter(
                    Q(employee__user=user) | Q(employee__manager=user.employee_profile)
                )
            else:
                qs = qs.filter(employee__user=user)

        # Filters
        report_date = self.request.query_params.get("date")
        project_id = self.request.query_params.get("project")
        status_param = self.request.query_params.get("status")

        if report_date:
            qs = qs.filter(report_date=report_date)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if status_param:
            qs = qs.filter(status=status_param)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        emp = getattr(user, "employee_profile", None)
        if not emp:
            # If admin testing without employee profile, take first active employee
            emp = Employee.objects.filter(is_archived=False).first()
        serializer.save(employee=emp)

    @action(detail=False, methods=["get"], url_path="today-status")
    def today_status(self, request):
        user = request.user
        today = timezone.localdate()
        emp = getattr(user, "employee_profile", None)
        if not emp:
            return Response({"has_submitted": False, "report": None})

        report = DailyWorkReport.objects.filter(employee=emp, report_date=today).first()
        return Response({
            "has_submitted": report is not None,
            "report": DailyWorkReportSerializer(report).data if report else None,
        })

    @action(detail=True, methods=["post"], url_path="review")
    def review(self, request, pk=None):
        report = self.get_object()
        serializer = DailyWorkReportReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data["action"] == "APPROVE":
            report.status = DailyWorkReportStatus.APPROVED
        else:
            report.status = DailyWorkReportStatus.REVISION_REQUESTED

        report.reviewed_by = request.user
        report.manager_feedback = data.get("manager_feedback", "")
        report.reviewed_at = timezone.now()
        report.save(update_fields=["status", "reviewed_by", "manager_feedback", "reviewed_at", "updated_at"])

        return Response({
            "message": f"Daily work report successfully {report.get_status_display().lower()}.",
            "report": DailyWorkReportSerializer(report).data,
        })
