from django.urls import path
from .views import (
    AdminAuditLogListView,
    HolidayDetailView,
    HolidayListCreateView,
    LeaveTypeAdminDetailView,
    LeaveTypeAdminListView,
    NotificationPreferencesAdminView,
    OrganizationSettingsView,
    UserAdminDetailView,
    UserAdminListView,
    WorkScheduleAdminView,
)

app_name = "organization"

urlpatterns = [
    path("settings/", OrganizationSettingsView.as_view(), name="settings"),
    path("schedule/", WorkScheduleAdminView.as_view(), name="schedule"),
    path("holidays/", HolidayListCreateView.as_view(), name="holidays"),
    path("holidays/<int:pk>/", HolidayDetailView.as_view(), name="holiday-detail"),
    path("leave-types/", LeaveTypeAdminListView.as_view(), name="leave-types"),
    path("leave-types/<int:pk>/", LeaveTypeAdminDetailView.as_view(), name="leave-type-detail"),
    path("notifications/preferences/", NotificationPreferencesAdminView.as_view(), name="notification-preferences"),
    path("users/", UserAdminListView.as_view(), name="users"),
    path("users/<int:pk>/", UserAdminDetailView.as_view(), name="user-detail"),
    path("audit-logs/", AdminAuditLogListView.as_view(), name="audit-logs"),
]
