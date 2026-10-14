from django.contrib import admin
from .models import (
    EmployeeCertification,
    ExitClearance,
    ExitRequest,
    TrainingCourse,
    TrainingEnrollment,
)


@admin.register(TrainingCourse)
class TrainingCourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "instructor", "format", "level", "duration_hours", "start_date")
    list_filter = ("format", "level", "is_mandatory")
    search_fields = ("code", "title", "instructor")


@admin.register(TrainingEnrollment)
class TrainingEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("employee", "course", "status", "progress_percent", "feedback_rating", "enrolled_at")
    list_filter = ("status",)


@admin.register(EmployeeCertification)
class EmployeeCertificationAdmin(admin.ModelAdmin):
    list_display = ("name", "employee", "issuing_organization", "issue_date", "is_verified")
    list_filter = ("is_verified",)
    search_fields = ("name", "employee__user__first_name", "employee__user__last_name")


class ExitClearanceInline(admin.TabularInline):
    model = ExitClearance
    extra = 0


@admin.register(ExitRequest)
class ExitRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "resignation_date", "reason_category", "status", "requested_last_working_day", "relieving_letter_issued")
    list_filter = ("status", "reason_category", "relieving_letter_issued")
    inlines = [ExitClearanceInline]
