from django.contrib import admin
from .models import AttendanceCorrection, AttendanceRecord, WorkSchedule


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("employee", "date", "status", "check_in", "check_out", "work_duration_hours")
    list_filter = ("status", "date", "employee__department")
    search_fields = ("employee__user__first_name", "employee__user__last_name", "employee__employee_id")
    date_hierarchy = "date"


@admin.register(AttendanceCorrection)
class AttendanceCorrectionAdmin(admin.ModelAdmin):
    list_display = ("attendance_record", "corrected_by", "original_status", "new_status", "created_at")
    list_filter = ("original_status", "new_status", "created_at")
    search_fields = ("attendance_record__employee__employee_id", "reason")


@admin.register(WorkSchedule)
class WorkScheduleAdmin(admin.ModelAdmin):
    list_display = ("name", "work_start_time", "work_end_time", "grace_period_minutes", "is_default")
