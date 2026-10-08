from django.urls import path
from .views import (
    TaskCommentListCreateView,
    TaskDetailView,
    TaskListCreateView,
    TaskStatsView,
)

urlpatterns = [
    path("", TaskListCreateView.as_view(), name="task-list-create"),
    path("stats/", TaskStatsView.as_view(), name="task-stats"),
    path("<int:pk>/", TaskDetailView.as_view(), name="task-detail"),
    path("<int:pk>/comments/", TaskCommentListCreateView.as_view(), name="task-comments"),
]
