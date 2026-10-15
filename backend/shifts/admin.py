from django.contrib import admin
from .models import ShiftTemplate, ShiftRoster, ShiftSwapRequest, OvertimeRecord


@admin.register(ShiftTemplate)
class ShiftTemplateAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "start_time", "end_time", "is_night_shift", "is_active"]
    list_filter = ["is_night_shift", "is_active"]
    search_fields = ["name", "code"]


@admin.register(ShiftRoster)
class ShiftRosterAdmin(admin.ModelAdmin):
    list_display = ["employee", "shift", "date", "status", "is_published"]
    list_filter = ["status", "is_published", "shift", "date"]
    search_fields = ["employee__first_name", "employee__last_name", "employee__email"]


@admin.register(ShiftSwapRequest)
class ShiftSwapRequestAdmin(admin.ModelAdmin):
    list_display = ["requester", "target_employee", "target_status", "manager_status", "created_at"]
    list_filter = ["target_status", "manager_status"]
    search_fields = ["requester__first_name", "requester__last_name", "reason"]


@admin.register(OvertimeRecord)
class OvertimeRecordAdmin(admin.ModelAdmin):
    list_display = ["employee", "date", "hours", "rate_multiplier", "project_code", "status"]
    list_filter = ["status", "rate_multiplier", "date"]
    search_fields = ["employee__first_name", "employee__last_name", "project_code", "reason"]
