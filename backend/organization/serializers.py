from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.models import Role
from attendance.models import WorkSchedule
from leave_management.models import LeaveType

from .models import (
    AdminAuditLog,
    Holiday,
    NotificationPreferenceSetting,
    OrganizationSetting,
    validate_timezone_name,
)

User = get_user_model()


class OrganizationSettingSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationSetting
        fields = [
            "id",
            "name",
            "logo",
            "logo_url",
            "timezone",
            "contact_email",
            "contact_phone",
            "address",
            "website",
            "fiscal_year_start_month",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None

    def validate_timezone(self, value):
        validate_timezone_name(value)
        return value


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = [
            "id",
            "name",
            "date",
            "description",
            "is_optional",
            "is_recurring_annually",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        name = attrs.get("name", getattr(self.instance, "name", "")).strip()
        h_date = attrs.get("date", getattr(self.instance, "date", None))
        
        # Check duplicate date + name
        qs = Holiday.objects.filter(date=h_date, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Holiday '{name}' already exists on {h_date}.")
        return attrs


class NotificationPreferenceSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreferenceSetting
        fields = [
            "email_notifications_enabled",
            "task_assignment_alerts",
            "task_overdue_alerts",
            "leave_status_alerts",
            "attendance_reminder_alerts",
            "daily_digest_enabled",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class WorkScheduleAdminSerializer(serializers.ModelSerializer):
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
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("work_start_time", getattr(self.instance, "work_start_time", None))
        end = attrs.get("work_end_time", getattr(self.instance, "work_end_time", None))
        grace = attrs.get("grace_period_minutes", getattr(self.instance, "grace_period_minutes", 15))
        half_day = attrs.get("half_day_minimum_hours", getattr(self.instance, "half_day_minimum_hours", Decimal("4.0")))
        full_day = attrs.get("full_day_minimum_hours", getattr(self.instance, "full_day_minimum_hours", Decimal("8.0")))

        if start and end and start >= end:
            raise serializers.ValidationError("Work start time must be earlier than work end time.")
        if grace < 0 or grace > 120:
            raise serializers.ValidationError("Grace period must be between 0 and 120 minutes.")
        if half_day <= Decimal("0.0"):
            raise serializers.ValidationError("Half-day minimum hours must be greater than zero.")
        if full_day <= half_day:
            raise serializers.ValidationError("Full-day minimum hours must exceed half-day minimum hours.")
        return attrs


class LeaveTypeAdminSerializer(serializers.ModelSerializer):
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
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def validate_code(self, value):
        val = value.strip().upper()
        qs = LeaveType.objects.filter(code__iexact=val)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Leave type code '{val}' is already in use.")
        return val

    def validate_annual_allowance(self, value):
        if value is not None and value < Decimal("0.0"):
            raise serializers.ValidationError("Annual allowance cannot be negative.")
        return value


class UserAdminSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    employee_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "department",
            "is_active",
            "is_staff",
            "date_joined",
            "employee_id",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_employee_id(self, obj):
        emp = getattr(obj, "employee_profile", None)
        return emp.employee_id if emp else None


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.SerializerMethodField()
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AdminAuditLog
        fields = [
            "id",
            "actor",
            "actor_email",
            "actor_name",
            "action",
            "category",
            "description",
            "changes",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else "System"

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor else "System Automation"
