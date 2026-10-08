from django.contrib import admin
from .models import Department, Employee


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "head", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "description")


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "employee_id",
        "full_name",
        "email",
        "department",
        "designation",
        "status",
        "employment_type",
        "is_archived",
    )
    list_filter = ("status", "employment_type", "department", "is_archived")
    search_fields = (
        "employee_id",
        "user__first_name",
        "user__last_name",
        "user__email",
        "designation",
    )
