from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers

from .models import LeaveAuditLog, LeaveBalance, LeaveRequest, LeaveStatus, LeaveType


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = [
            "id",
            "name",
            "code",
            "description",
            "is_paid",
            "requires_approval",
            "annual_allowance",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class LeaveAuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()
    performed_by_email = serializers.SerializerMethodField()

    class Meta:
        model = LeaveAuditLog
        fields = [
            "id",
            "action",
            "performed_by",
            "performed_by_name",
            "performed_by_email",
            "previous_status",
            "new_status",
            "note",
            "timestamp",
        ]
        read_only_fields = fields

    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else "System"

    def get_performed_by_email(self, obj):
        return obj.performed_by.email if obj.performed_by else ""


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    available_days = serializers.DecimalField(
        max_digits=5,
        decimal_places=1,
        read_only=True,
    )

    class Meta:
        model = LeaveBalance
        fields = [
            "id",
            "employee",
            "leave_type",
            "leave_type_name",
            "leave_type_code",
            "year",
            "allocated_days",
            "used_days",
            "pending_days",
            "available_days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "available_days", "created_at", "updated_at"]


class LeaveRequestListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.user.full_name", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    is_paid = serializers.BooleanField(source="leave_type.is_paid", read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "employee_name",
            "employee_code",
            "department_name",
            "leave_type",
            "leave_type_name",
            "leave_type_code",
            "is_paid",
            "start_date",
            "end_date",
            "duration_days",
            "reason",
            "attachment",
            "status",
            "submitted_at",
            "reviewed_by",
            "reviewed_by_name",
            "reviewed_at",
            "rejection_reason",
            "updated_at",
        ]
        read_only_fields = fields

    def get_department_name(self, obj):
        if obj.employee.department:
            return obj.employee.department.name
        return ""

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.full_name if obj.reviewed_by else None


class LeaveRequestDetailSerializer(LeaveRequestListSerializer):
    audit_logs = LeaveAuditLogSerializer(many=True, read_only=True)

    class Meta(LeaveRequestListSerializer.Meta):
        fields = LeaveRequestListSerializer.Meta.fields + ["audit_logs"]


class LeaveRequestCreateSerializer(serializers.ModelSerializer):
    leave_type_id = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.filter(is_active=True),
        source="leave_type",
        write_only=True,
    )
    employee_id = serializers.IntegerField(
        required=False,
        write_only=True,
        help_text="Optional employee PK (for HR/Super Admin submitting on behalf of an employee)",
    )

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee_id",
            "leave_type_id",
            "start_date",
            "end_date",
            "reason",
            "attachment",
            "duration_days",
            "status",
        ]
        read_only_fields = ["id", "duration_days", "status"]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date": "End date cannot be prior to start date."
            })
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user if request else None

        # Resolve employee
        employee_pk = validated_data.pop("employee_id", None)
        if employee_pk and (user.is_super_admin or user.is_hr_admin):
            from employees.models import Employee
            employee = Employee.objects.get(pk=employee_pk)
        elif hasattr(user, "employee_profile"):
            employee = user.employee_profile
        else:
            raise serializers.ValidationError("Authenticated user does not have an active employee profile.")

        start_date = validated_data["start_date"]
        end_date = validated_data["end_date"]
        duration_days = Decimal(str((end_date - start_date).days + 1))

        # Check overlapping requests
        overlapping = LeaveRequest.objects.filter(
            employee=employee,
            status__in=[LeaveStatus.PENDING, LeaveStatus.APPROVED],
            start_date__lte=end_date,
            end_date__gte=start_date,
        )
        if overlapping.exists():
            conflict = overlapping.first()
            raise serializers.ValidationError(
                f"Overlapping leave request already exists ({conflict.leave_type.name}: "
                f"{conflict.start_date} to {conflict.end_date}, status: {conflict.status})."
            )

        # Check policy balance rules ONLY IF configured for this leave type and employee
        leave_type = validated_data["leave_type"]
        current_year = start_date.year
        balance = LeaveBalance.objects.filter(
            employee=employee,
            leave_type=leave_type,
            year=current_year,
        ).first()

        if balance and balance.allocated_days > 0:
            if balance.available_days < duration_days:
                raise serializers.ValidationError(
                    f"Insufficient leave balance for {leave_type.name}. "
                    f"Available: {balance.available_days} days, Requested: {duration_days} days."
                )

        leave_request = LeaveRequest.objects.create(
            employee=employee,
            duration_days=duration_days,
            **validated_data,
        )

        # Update pending balance if tracked
        if balance:
            balance.pending_days += duration_days
            balance.save(update_fields=["pending_days", "updated_at"])

        # Create initial audit log
        LeaveAuditLog.objects.create(
            leave_request=leave_request,
            action="SUBMITTED",
            performed_by=user,
            previous_status="",
            new_status=LeaveStatus.PENDING,
            note=f"Leave request submitted for {duration_days} day(s).",
        )

        return leave_request


class LeaveRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField(
        required=True,
        min_length=3,
        error_messages={"blank": "A rejection reason is required."},
    )
