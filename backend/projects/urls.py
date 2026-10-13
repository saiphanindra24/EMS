from django.urls import include, path
from rest_framework.routers import DefaultRouter

from projects.views import (
    DailyWorkReportViewSet,
    MilestoneViewSet,
    ProjectViewSet,
)

router = DefaultRouter()
router.register(r"items", ProjectViewSet, basename="project")
router.register(r"milestones", MilestoneViewSet, basename="milestone")
router.register(r"dwr", DailyWorkReportViewSet, basename="daily-work-report")

urlpatterns = [
    path("", include(router.urls)),
]
