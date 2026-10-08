from django.urls import path
from .views import (
    AttendanceCorrectionHistoryView,
    AttendanceCorrectionView,
    AttendanceRecordDetailView,
    AttendanceRecordListView,
    AttendanceStatsView,
    CheckInView,
    CheckOutView,
    TodayAttendanceView,
    WorkScheduleView,
)

urlpatterns = [
    path("check-in/", CheckInView.as_view(), name="attendance-check-in"),
    path("check-out/", CheckOutView.as_view(), name="attendance-check-out"),
    path("today/", TodayAttendanceView.as_view(), name="attendance-today"),
    path("history/", AttendanceRecordListView.as_view(), name="attendance-history"),
    path("", AttendanceRecordListView.as_view(), name="attendance-list"),
    path("stats/", AttendanceStatsView.as_view(), name="attendance-stats"),
    path("schedule/", WorkScheduleView.as_view(), name="attendance-schedule"),
    path("<int:pk>/", AttendanceRecordDetailView.as_view(), name="attendance-detail"),
    path("<int:pk>/correct/", AttendanceCorrectionView.as_view(), name="attendance-correct"),
    path("<int:pk>/corrections/", AttendanceCorrectionHistoryView.as_view(), name="attendance-corrections-history"),
]
