from rest_framework import serializers
from .models import (
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


class TrainingCourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True, default="All Departments")
    format_display = serializers.CharField(source="get_format_display", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)
    enrollment_count = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()

    class Meta:
        model = TrainingCourse
        fields = [
            "id",
            "code",
            "title",
            "instructor",
            "department",
            "department_name",
            "format",
            "format_display",
            "level",
            "level_display",
            "duration_hours",
            "max_participants",
            "start_date",
            "end_date",
            "is_mandatory",
            "skills_covered",
            "description",
            "enrollment_count",
            "is_enrolled",
            "created_at",
            "updated_at",
        ]

    def get_enrollment_count(self, obj):
        return obj.enrollments.count()

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if request and hasattr(request.user, "employee_profile"):
            return obj.enrollments.filter(employee=request.user.employee_profile).exists()
        return False


class TrainingEnrollmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    course_instructor = serializers.CharField(source="course.instructor", read_only=True)
    duration_hours = serializers.IntegerField(source="course.duration_hours", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = TrainingEnrollment
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "department_name",
            "course",
            "course_code",
            "course_title",
            "course_instructor",
            "duration_hours",
            "status",
            "status_display",
            "progress_percent",
            "completion_date",
            "feedback_rating",
            "feedback_comments",
            "enrolled_at",
        ]
        read_only_fields = ["id", "employee", "enrolled_at"]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            u = obj.employee.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "Unknown"


class EmployeeCertificationSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)

    class Meta:
        model = EmployeeCertification
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "name",
            "issuing_organization",
            "issue_date",
            "expiry_date",
            "credential_id",
            "credential_url",
            "is_verified",
            "created_at",
        ]
        read_only_fields = ["id", "employee", "created_at"]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            u = obj.employee.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "Unknown"


class ExitClearanceSerializer(serializers.ModelSerializer):
    department_display = serializers.CharField(source="get_department_display", read_only=True)
    cleared_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ExitClearance
        fields = [
            "id",
            "department",
            "department_display",
            "is_cleared",
            "cleared_by",
            "cleared_by_name",
            "cleared_at",
            "notes",
        ]

    def get_cleared_by_name(self, obj):
        if obj.cleared_by:
            full = f"{obj.cleared_by.first_name} {obj.cleared_by.last_name}".strip()
            return full or obj.cleared_by.username
        return ""


class ExitRequestSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    designation = serializers.CharField(source="employee.designation", read_only=True, default="")
    reason_display = serializers.CharField(source="get_reason_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    manager_name = serializers.SerializerMethodField()
    clearance_items = ExitClearanceSerializer(many=True, read_only=True)
    all_clearances_complete = serializers.SerializerMethodField()

    class Meta:
        model = ExitRequest
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "department_name",
            "designation",
            "resignation_date",
            "reason_category",
            "reason_display",
            "detailed_reason",
            "notice_period_days",
            "requested_last_working_day",
            "agreed_last_working_day",
            "status",
            "status_display",
            "manager_reviewed_by",
            "manager_name",
            "manager_comments",
            "manager_action_date",
            "exit_interview_completed",
            "exit_interview_notes",
            "retention_discussion",
            "would_recommend_company",
            "relieving_letter_issued",
            "clearance_items",
            "all_clearances_complete",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "employee",
            "status",
            "manager_reviewed_by",
            "manager_action_date",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            u = obj.employee.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "Unknown"

    def get_manager_name(self, obj):
        if obj.manager_reviewed_by:
            full = f"{obj.manager_reviewed_by.first_name} {obj.manager_reviewed_by.last_name}".strip()
            return full or obj.manager_reviewed_by.username
        return ""

    def get_all_clearances_complete(self, obj):
        items = obj.clearance_items.all()
        if not items.exists():
            return False
        return all(c.is_cleared for c in items)


class ResignationInputSerializer(serializers.Serializer):
    reason_category = serializers.ChoiceField(choices=ExitReason.choices)
    detailed_reason = serializers.CharField(required=False, allow_blank=True, default="")
    notice_period_days = serializers.IntegerField(default=30)
    requested_last_working_day = serializers.DateField()


class ManagerExitReviewInputSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    agreed_last_working_day = serializers.DateField(required=False)
    manager_comments = serializers.CharField(required=False, allow_blank=True, default="")


class ClearanceSignoffInputSerializer(serializers.Serializer):
    department = serializers.ChoiceField(choices=ClearanceDepartment.choices)
    is_cleared = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ExitInterviewInputSerializer(serializers.Serializer):
    exit_interview_notes = serializers.CharField(required=True)
    retention_discussion = serializers.CharField(required=False, allow_blank=True, default="")
    would_recommend_company = serializers.BooleanField(default=True)
    relieving_letter_issued = serializers.BooleanField(default=True)
