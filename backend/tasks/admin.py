from django.contrib import admin
from .models import Task, TaskComment, TaskHistory


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("task_id", "title", "assignee", "department", "priority", "status", "progress", "due_date")
    list_filter = ("status", "priority", "department", "is_archived")
    search_fields = ("task_id", "title", "description", "assignee__user__first_name", "assignee__user__last_name")


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "created_at")
    search_fields = ("task__task_id", "author__email", "content")


@admin.register(TaskHistory)
class TaskHistoryAdmin(admin.ModelAdmin):
    list_display = ("task", "changed_by", "field_name", "old_value", "new_value", "created_at")
    list_filter = ("field_name", "created_at")
    search_fields = ("task__task_id", "field_name")
