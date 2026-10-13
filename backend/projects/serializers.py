from rest_framework import serializers
from employees.models import Employee
from projects.models import DailyWorkReport, Milestone, Project, ProjectMember


class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = [
            "id",
            "project",
            "title",
            "description",
            "due_date",
            "is_achieved",
            "achieved_at",
            "order",
            "created_at",
        ]


class ProjectMemberSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id_code = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", default="Engineering", read_only=True)
    employee_email = serializers.CharField(source="employee.user.email", read_only=True)

    class Meta:
        model = ProjectMember
        fields = [
            "id",
            "project",
            "employee",
            "employee_id_code",
            "employee_name",
            "employee_email",
            "department_name",
            "role",
            "allocation_percentage",
            "is_billable",
            "joined_at",
        ]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username


class ProjectSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField()
    lead_id_code = serializers.CharField(source="lead.employee_id", read_only=True)
    department_name = serializers.CharField(source="department.name", default="General", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)
    health_display = serializers.CharField(source="get_health_display", read_only=True)
    memberships = ProjectMemberSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer(many=True, read_only=True)
    tasks_count = serializers.IntegerField(source="tasks.count", read_only=True)
    members_count = serializers.IntegerField(source="memberships.count", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "code",
            "name",
            "client_name",
            "description",
            "status",
            "status_display",
            "priority",
            "priority_display",
            "health",
            "health_display",
            "lead",
            "lead_name",
            "lead_id_code",
            "department",
            "department_name",
            "start_date",
            "target_end_date",
            "actual_end_date",
            "budget",
            "spent_budget",
            "progress_percentage",
            "tasks_count",
            "members_count",
            "memberships",
            "milestones",
            "created_at",
            "updated_at",
        ]

    def get_lead_name(self, obj):
        if obj.lead and obj.lead.user:
            return obj.lead.user.get_full_name() or obj.lead.user.username
        return None


class DailyWorkReportSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id_code = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", default="Engineering", read_only=True)
    project_name = serializers.CharField(source="project.name", default="", read_only=True)
    project_code = serializers.CharField(source="project.code", default="", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyWorkReport
        fields = [
            "id",
            "employee",
            "employee_id_code",
            "employee_name",
            "department_name",
            "project",
            "project_name",
            "project_code",
            "report_date",
            "hours_worked",
            "activities_summary",
            "issues_faced",
            "plan_for_tomorrow",
            "status",
            "status_display",
            "reviewed_by",
            "reviewed_by_name",
            "manager_feedback",
            "reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["employee", "reviewed_by", "reviewed_at", "created_at", "updated_at"]

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None


class DailyWorkReportReviewInputSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REQUEST_REVISION"])
    manager_feedback = serializers.CharField(required=False, allow_blank=True, default="")
