from django.contrib import admin
from .models import LeaveAuditLog, LeaveBalance, LeaveRequest, LeaveType


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_paid", "requires_approval", "annual_allowance", "is_active")
    list_filter = ("is_active", "is_paid", "requires_approval")
    search_fields = ("name", "code")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employee",
        "leave_type",
        "start_date",
        "end_date",
        "duration_days",
        "status",
        "submitted_at",
        "reviewed_by",
    )
    list_filter = ("status", "leave_type", "start_date")
    search_fields = ("employee__employee_id", "employee__user__email", "employee__user__first_name", "reason")
    readonly_fields = ("submitted_at", "updated_at", "duration_days")


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "year", "allocated_days", "used_days", "pending_days")
    list_filter = ("year", "leave_type")
    search_fields = ("employee__employee_id", "employee__user__first_name")


@admin.register(LeaveAuditLog)
class LeaveAuditLogAdmin(admin.ModelAdmin):
    list_display = ("leave_request", "action", "performed_by", "previous_status", "new_status", "timestamp")
    list_filter = ("action", "timestamp")
    readonly_fields = ("leave_request", "action", "performed_by", "previous_status", "new_status", "note", "timestamp")
