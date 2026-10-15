from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShiftTemplateViewSet,
    ShiftRosterViewSet,
    ShiftSwapRequestViewSet,
    OvertimeRecordViewSet,
)

router = DefaultRouter()
router.register(r"templates", ShiftTemplateViewSet, basename="shift-template")
router.register(r"roster", ShiftRosterViewSet, basename="shift-roster")
router.register(r"swaps", ShiftSwapRequestViewSet, basename="shift-swap")
router.register(r"overtime", OvertimeRecordViewSet, basename="overtime-record")

urlpatterns = [
    path("", include(router.urls)),
]
