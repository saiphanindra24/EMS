from django.contrib import admin
from .models import Feedback360, Goal, PerformanceReview, ReviewCycle


@admin.register(ReviewCycle)
class ReviewCycleAdmin(admin.ModelAdmin):
    list_display = ("name", "cycle_type", "start_date", "end_date", "status")
    list_filter = ("status", "cycle_type")


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("title", "employee", "category", "current_progress", "status", "due_date")
    list_filter = ("status", "category")
    search_fields = ("title", "employee__user__first_name", "employee__user__last_name")


@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    list_display = ("cycle", "employee", "manager", "status", "self_rating", "manager_rating", "final_score")
    list_filter = ("status", "promotion_recommendation", "pip_required")
    search_fields = ("employee__user__first_name", "employee__user__last_name", "cycle__name")


@admin.register(Feedback360)
class Feedback360Admin(admin.ModelAdmin):
    list_display = ("review", "provider", "relationship", "technical_rating", "collaboration_rating")
