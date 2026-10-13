from django.urls import include, path
from rest_framework.routers import DefaultRouter

from payroll.views import (
    PayrollRunViewSet,
    PayrollSummaryView,
    PayslipViewSet,
    SalaryStructureViewSet,
)

router = DefaultRouter()
router.register(r"runs", PayrollRunViewSet, basename="payroll-run")
router.register(r"payslips", PayslipViewSet, basename="payslip")
router.register(r"structures", SalaryStructureViewSet, basename="salary-structure")

urlpatterns = [
    path("summary/", PayrollSummaryView.as_view(), name="payroll-summary"),
    path("", include(router.urls)),
]
