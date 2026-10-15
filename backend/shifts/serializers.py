from rest_framework import serializers
from .models import ShiftTemplate, ShiftRoster, ShiftSwapRequest, OvertimeRecord


class ShiftTemplateSerializer(serializers.ModelSerializer):
    formatted_timing = serializers.SerializerMethodField()

    class Meta:
        model = ShiftTemplate
        fields = [
            "id",
            "name",
            "code",
            "start_time",
            "end_time",
            "grace_period_minutes",
            "break_duration_minutes",
            "is_night_shift",
            "color_code",
            "is_active",
            "description",
            "formatted_timing",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_formatted_timing(self, obj):
        st = obj.start_time.strftime("%H:%M") if obj.start_time else ""
        et = obj.end_time.strftime("%H:%M") if obj.end_time else ""
        return f"{st} - {et}"


class ShiftRosterSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.get_full_name", read_only=True)
    employee_email = serializers.CharField(source="employee.email", read_only=True)
    employee_role = serializers.CharField(source="employee.role", read_only=True)
    shift_name = serializers.CharField(source="shift.name", read_only=True)
    shift_code = serializers.CharField(source="shift.code", read_only=True)
    shift_start_time = serializers.TimeField(source="shift.start_time", read_only=True)
    shift_end_time = serializers.TimeField(source="shift.end_time", read_only=True)
    shift_color = serializers.CharField(source="shift.color_code", read_only=True)
    shift_is_night = serializers.BooleanField(source="shift.is_night_shift", read_only=True)
    shift_details = ShiftTemplateSerializer(source="shift", read_only=True)

    class Meta:
        model = ShiftRoster
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_email",
            "employee_role",
            "shift",
            "shift_name",
            "shift_code",
            "shift_start_time",
            "shift_end_time",
            "shift_color",
            "shift_is_night",
            "shift_details",
            "date",
            "status",
            "is_published",
            "notes",
            "assigned_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ShiftSwapRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.get_full_name", read_only=True)
    requester_email = serializers.CharField(source="requester.email", read_only=True)
    target_name = serializers.SerializerMethodField()
    target_email = serializers.SerializerMethodField()
    requester_assignment_date = serializers.DateField(source="requester_assignment.date", read_only=True)
    requester_shift_name = serializers.CharField(source="requester_assignment.shift.name", read_only=True)
    requester_shift_timing = serializers.SerializerMethodField()
    target_assignment_date = serializers.DateField(source="target_assignment.date", read_only=True, default=None)
    target_shift_name = serializers.CharField(source="target_assignment.shift.name", read_only=True, default=None)
    target_shift_timing = serializers.SerializerMethodField()
    reviewed_by_name = serializers.CharField(source="reviewed_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = ShiftSwapRequest
        fields = [
            "id",
            "requester",
            "requester_name",
            "requester_email",
            "requester_assignment",
            "requester_assignment_date",
            "requester_shift_name",
            "requester_shift_timing",
            "target_employee",
            "target_name",
            "target_email",
            "target_assignment",
            "target_assignment_date",
            "target_shift_name",
            "target_shift_timing",
            "reason",
            "target_status",
            "manager_status",
            "manager_notes",
            "reviewed_by",
            "reviewed_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_target_name(self, obj):
        return obj.target_employee.get_full_name() if obj.target_employee else "Open Pool"

    def get_target_email(self, obj):
        return obj.target_employee.email if obj.target_employee else None

    def get_requester_shift_timing(self, obj):
        if obj.requester_assignment and obj.requester_assignment.shift:
            s = obj.requester_assignment.shift
            return f"{s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')}"
        return ""

    def get_target_shift_timing(self, obj):
        if obj.target_assignment and obj.target_assignment.shift:
            s = obj.target_assignment.shift
            return f"{s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')}"
        return ""


class OvertimeRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.get_full_name", read_only=True)
    employee_email = serializers.CharField(source="employee.email", read_only=True)
    approver_name = serializers.CharField(source="approver.get_full_name", read_only=True, default=None)
    calculated_amount = serializers.SerializerMethodField()

    class Meta:
        model = OvertimeRecord
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_email",
            "date",
            "roster_assignment",
            "start_time",
            "end_time",
            "hours",
            "rate_multiplier",
            "project_code",
            "reason",
            "status",
            "approver",
            "approver_name",
            "approver_notes",
            "calculated_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_calculated_amount(self, obj):
        # Estimated pay factor display: hours * rate_multiplier
        return round(float(obj.hours) * float(obj.rate_multiplier), 2)
