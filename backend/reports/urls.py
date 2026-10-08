from django.urls import path
from .views import (
    AttendanceReportView,
    DepartmentReportView,
    EmployeeReportView,
    LeaveReportView,
    ProductivityReportView,
    ReportOverviewView,
    TaskReportView,
)

app_name = "reports"

urlpatterns = [
    path("", ReportOverviewView.as_view(), name="overview"),
    path("overview/", ReportOverviewView.as_view(), name="overview-alias"),
    path("employees/", EmployeeReportView.as_view(), name="employees"),
    path("attendance/", AttendanceReportView.as_view(), name="attendance"),
    path("tasks/", TaskReportView.as_view(), name="tasks"),
    path("leaves/", LeaveReportView.as_view(), name="leaves"),
    path("departments/", DepartmentReportView.as_view(), name="departments"),
    path("productivity/", ProductivityReportView.as_view(), name="productivity"),
]
