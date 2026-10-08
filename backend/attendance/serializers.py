from rest_framework import serializers
from .models import AttendanceCorrection, AttendanceRecord, AttendanceStatus, WorkSchedule


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    employee_id_code = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    is_active_session = serializers.BooleanField(read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_id_code",
            "department_name",
            "date",
            "check_in",
            "check_out",
            "status",
            "work_duration_minutes",
            "work_duration_hours",
            "notes",
            "is_active_session",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "employee",
            "date",
            "check_in",
            "check_out",
            "work_duration_minutes",
            "work_duration_hours",
            "created_at",
            "updated_at",
        ]


class CheckInSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CheckOutSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AttendanceCorrectionSerializer(serializers.ModelSerializer):
    corrected_by_name = serializers.CharField(source="corrected_by.full_name", read_only=True)

    class Meta:
        model = AttendanceCorrection
        fields = [
            "id",
            "attendance_record",
            "corrected_by",
            "corrected_by_name",
            "original_check_in",
            "original_check_out",
            "original_status",
            "new_check_in",
            "new_check_out",
            "new_status",
            "reason",
            "created_at",
        ]
        read_only_fields = ["id", "corrected_by", "created_at"]


class AttendanceCorrectionCreateSerializer(serializers.Serializer):
    check_in = serializers.DateTimeField(required=False, allow_null=True)
    check_out = serializers.DateTimeField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=AttendanceStatus.choices, required=False)
    reason = serializers.CharField(required=True, min_length=5)

    def validate(self, attrs):
        check_in = attrs.get("check_in")
        check_out = attrs.get("check_out")
        if check_in and check_out and check_out < check_in:
            raise serializers.ValidationError("Check-out timestamp cannot be earlier than check-in.")
        return attrs


class WorkScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkSchedule
        fields = [
            "id",
            "name",
            "work_start_time",
            "work_end_time",
            "grace_period_minutes",
            "half_day_minimum_hours",
            "full_day_minimum_hours",
            "is_default",
            "created_at",
            "updated_at",
        ]
