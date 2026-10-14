from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    Feedback360ViewSet,
    GoalViewSet,
    PerformanceReviewViewSet,
    ReviewCycleViewSet,
)

router = DefaultRouter()
router.register(r"cycles", ReviewCycleViewSet, basename="performance-cycles")
router.register(r"goals", GoalViewSet, basename="performance-goals")
router.register(r"reviews", PerformanceReviewViewSet, basename="performance-reviews")
router.register(r"feedback360", Feedback360ViewSet, basename="performance-feedback360")

urlpatterns = [
    path("", include(router.urls)),
]
