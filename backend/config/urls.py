from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from api.views import api_root, health_check

urlpatterns = [
    path("", api_root, name="api-root"),
    path("healthz/", health_check, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/attendance/", include("attendance.urls")),
    path("api/v1/tasks/", include("tasks.urls")),
    path("api/v1/leave/", include("leave_management.urls")),
    path("api/v1/notifications/", include("notifications.urls")),
    path("api/v1/reports/", include("reports.urls")),
    path("api/v1/organization/", include("organization.urls")),
    path("api/v1/", include("employees.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
