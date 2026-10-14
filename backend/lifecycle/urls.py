from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    EmployeeCertificationViewSet,
    ExitRequestViewSet,
    TrainingCourseViewSet,
    TrainingEnrollmentViewSet,
)

router = DefaultRouter()
router.register(r"courses", TrainingCourseViewSet, basename="lifecycle-courses")
router.register(r"enrollments", TrainingEnrollmentViewSet, basename="lifecycle-enrollments")
router.register(r"certifications", EmployeeCertificationViewSet, basename="lifecycle-certifications")
router.register(r"exits", ExitRequestViewSet, basename="lifecycle-exits")

urlpatterns = [
    path("", include(router.urls)),
]
