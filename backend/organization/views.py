from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from attendance.models import WorkSchedule
from leave_management.models import LeaveType

from .models import (
    AdminAuditLog,
    Holiday,
    NotificationPreferenceSetting,
    OrganizationSetting,
)
from .permissions import IsAdminUserRole, IsSuperAdminOnly, can_assign_role
from .serializers import (
    AdminAuditLogSerializer,
    HolidaySerializer,
    LeaveTypeAdminSerializer,
    NotificationPreferenceSettingSerializer,
    OrganizationSettingSerializer,
    UserAdminSerializer,
    WorkScheduleAdminSerializer,
)

User = get_user_model()


class StandardPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 100


def get_client_ip(request):
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class OrganizationSettingsView(APIView):
    """
    GET /api/v1/organization/settings/
    Retrieves the organization core settings.

    PATCH /api/v1/organization/settings/
    Updates organization profile, timezone, contact info, and logo.
    """
    permission_classes = [IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        settings_obj = OrganizationSetting.get_settings()
        serializer = OrganizationSettingSerializer(settings_obj, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        settings_obj = OrganizationSetting.get_settings()
        old_data = {
            "name": settings_obj.name,
            "timezone": settings_obj.timezone,
            "contact_email": settings_obj.contact_email,
        }

        serializer = OrganizationSettingSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        updated_obj = serializer.save()

        # Audit logging
        changes = {}
        for k in ["name", "timezone", "contact_email", "contact_phone", "address", "website"]:
            new_val = getattr(updated_obj, k, None)
            old_val = old_data.get(k)
            if old_val != new_val:
                changes[k] = {"before": str(old_val), "after": str(new_val)}

        if "logo" in request.FILES:
            changes["logo"] = "Logo image updated"

        AdminAuditLog.log_action(
            actor=request.user,
            action="ORGANIZATION_SETTINGS_UPDATED",
            category="SETTINGS",
            description=f"Organization settings modified by {request.user.email}",
            changes=changes,
            ip_address=get_client_ip(request),
        )

        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkScheduleAdminView(APIView):
    """
    GET /api/v1/organization/schedule/
    Retrieves the active work schedule & grace period settings.

    PATCH /api/v1/organization/schedule/
    Updates working hours, grace period, and minimum hour thresholds.
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        schedule = WorkSchedule.get_active_schedule()
        if not schedule:
            schedule = WorkSchedule.objects.create(
                name="Standard Corporate Schedule",
                work_start_time="09:00:00",
                work_end_time="18:00:00",
                grace_period_minutes=15,
                is_default=True,
            )
        serializer = WorkScheduleAdminSerializer(schedule)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        schedule = WorkSchedule.get_active_schedule()
        if not schedule:
            schedule = WorkSchedule.objects.create(
                name="Standard Corporate Schedule",
                work_start_time="09:00:00",
                work_end_time="18:00:00",
                grace_period_minutes=15,
                is_default=True,
            )

        old_grace = schedule.grace_period_minutes
        old_start = str(schedule.work_start_time)
        old_end = str(schedule.work_end_time)

        serializer = WorkScheduleAdminSerializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_schedule = serializer.save()

        AdminAuditLog.log_action(
            actor=request.user,
            action="WORK_SCHEDULE_UPDATED",
            category="SCHEDULE",
            description=f"Work schedule updated: {updated_schedule.work_start_time} - {updated_schedule.work_end_time}, {updated_schedule.grace_period_minutes}m grace",
            changes={
                "work_start_time": {"before": old_start, "after": str(updated_schedule.work_start_time)},
                "work_end_time": {"before": old_end, "after": str(updated_schedule.work_end_time)},
                "grace_period_minutes": {"before": old_grace, "after": updated_schedule.grace_period_minutes},
            },
            ip_address=get_client_ip(request),
        )

        return Response(serializer.data, status=status.HTTP_200_OK)


class HolidayListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/organization/holidays/
    Lists holidays with optional year/month filter.

    POST /api/v1/organization/holidays/
    Adds a new company holiday.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = HolidaySerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Holiday.objects.all()
        year = self.request.query_params.get("year")
        if year and year.isdigit():
            qs = qs.filter(date__year=int(year))
        return qs.order_by("date")

    def perform_create(self, serializer):
        holiday = serializer.save()
        AdminAuditLog.log_action(
            actor=self.request.user,
            action="HOLIDAY_CREATED",
            category="HOLIDAYS",
            description=f"Created holiday '{holiday.name}' on {holiday.date}",
            changes={"name": holiday.name, "date": str(holiday.date)},
            ip_address=get_client_ip(self.request),
        )


class HolidayDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/organization/holidays/<int:pk>/
    PATCH /api/v1/organization/holidays/<int:pk>/
    DELETE /api/v1/organization/holidays/<int:pk>/
    """
    permission_classes = [IsAdminUserRole]
    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    def perform_update(self, serializer):
        holiday = serializer.save()
        AdminAuditLog.log_action(
            actor=self.request.user,
            action="HOLIDAY_UPDATED",
            category="HOLIDAYS",
            description=f"Updated holiday '{holiday.name}' ({holiday.date})",
            ip_address=get_client_ip(self.request),
        )

    def perform_destroy(self, instance):
        name = instance.name
        h_date = str(instance.date)
        instance.delete()
        AdminAuditLog.log_action(
            actor=self.request.user,
            action="HOLIDAY_DELETED",
            category="HOLIDAYS",
            description=f"Deleted holiday '{name}' ({h_date})",
            ip_address=get_client_ip(self.request),
        )


class LeaveTypeAdminListView(generics.ListCreateAPIView):
    """
    GET /api/v1/organization/leave-types/
    POST /api/v1/organization/leave-types/
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = LeaveTypeAdminSerializer
    pagination_class = StandardPagination
    queryset = LeaveType.objects.all().order_by("name")

    def perform_create(self, serializer):
        leave_type = serializer.save()
        AdminAuditLog.log_action(
            actor=self.request.user,
            action="LEAVE_TYPE_CREATED",
            category="LEAVES",
            description=f"Created leave category '{leave_type.name}' ({leave_type.code})",
            changes={"name": leave_type.name, "code": leave_type.code, "is_paid": leave_type.is_paid},
            ip_address=get_client_ip(self.request),
        )


class LeaveTypeAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/organization/leave-types/<int:pk>/
    PATCH /api/v1/organization/leave-types/<int:pk>/
    DELETE /api/v1/organization/leave-types/<int:pk>/
    """
    permission_classes = [IsAdminUserRole]
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeAdminSerializer

    def perform_update(self, serializer):
        lt = serializer.save()
        AdminAuditLog.log_action(
            actor=self.request.user,
            action="LEAVE_TYPE_UPDATED",
            category="LEAVES",
            description=f"Updated leave category '{lt.name}' ({lt.code})",
            ip_address=get_client_ip(self.request),
        )

    def perform_destroy(self, instance):
        # Soft deactivate rather than hard cascade delete
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        AdminAuditLog.log_action(
            actor=self.request.user,
            action="LEAVE_TYPE_DEACTIVATED",
            category="LEAVES",
            description=f"Deactivated leave category '{instance.name}' ({instance.code})",
            ip_address=get_client_ip(self.request),
        )


class NotificationPreferencesAdminView(APIView):
    """
    GET /api/v1/organization/notifications/preferences/
    PATCH /api/v1/organization/notifications/preferences/
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        prefs = NotificationPreferenceSetting.get_preferences()
        serializer = NotificationPreferenceSettingSerializer(prefs)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        prefs = NotificationPreferenceSetting.get_preferences()
        serializer = NotificationPreferenceSettingSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        AdminAuditLog.log_action(
            actor=request.user,
            action="NOTIFICATION_SETTINGS_UPDATED",
            category="NOTIFICATIONS",
            description=f"Notification dispatch preferences modified by {request.user.email}",
            changes=serializer.validated_data,
            ip_address=get_client_ip(request),
        )

        return Response(serializer.data, status=status.HTTP_200_OK)


class UserAdminListView(generics.ListCreateAPIView):
    """
    GET /api/v1/organization/users/
    Lists all users with search, role, and active status filters.

    POST /api/v1/organization/users/
    Registers a new user with assigned role and temporary password.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = UserAdminSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = User.objects.all().select_related("employee_profile")
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role.upper())

        active_param = self.request.query_params.get("is_active")
        if active_param is not None:
            if active_param.lower() in ["true", "1"]:
                qs = qs.filter(is_active=True)
            elif active_param.lower() in ["false", "0"]:
                qs = qs.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(employee_profile__employee_id__icontains=search)
            )

        return qs.order_by("-date_joined")

    def perform_create(self, serializer):
        acting_user = self.request.user
        target_role = serializer.validated_data.get("role", Role.EMPLOYEE)

        if not can_assign_role(acting_user, target_role):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(f"You do not possess authority to create accounts with role '{target_role}'.")

        raw_password = self.request.data.get("password") or "ChangeMe2026!"
        user = serializer.save()
        user.set_password(raw_password)
        if target_role == Role.SUPER_ADMIN:
            user.is_superuser = True
            user.is_staff = True
        user.save()

        AdminAuditLog.log_action(
            actor=acting_user,
            action="USER_CREATED",
            category="USERS",
            description=f"Created user account {user.email} with role {user.role}",
            changes={"email": user.email, "role": user.role},
            ip_address=get_client_ip(self.request),
        )


class UserAdminDetailView(generics.RetrieveUpdateAPIView):
    """
    GET /api/v1/organization/users/<int:pk>/
    PATCH /api/v1/organization/users/<int:pk>/
    Updates user role, active status, and departmental assignment.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = UserAdminSerializer
    queryset = User.objects.all()

    def patch(self, request, *args, **kwargs):
        target_user = self.get_object()
        acting_user = request.user
        new_role = request.data.get("role")

        if new_role and new_role != target_user.role:
            if not can_assign_role(acting_user, new_role, target_user):
                return Response(
                    {"detail": f"You do not have authorization to reassign this user to '{new_role}'."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        old_role = target_user.role
        old_status = target_user.is_active

        response = super().patch(request, *args, **kwargs)

        target_user.refresh_from_db()

        changes = {}
        if old_role != target_user.role:
            changes["role"] = {"before": old_role, "after": target_user.role}
            # Sync staff / superuser flags
            if target_user.role == Role.SUPER_ADMIN:
                target_user.is_superuser = True
                target_user.is_staff = True
                target_user.save(update_fields=["is_superuser", "is_staff"])
            elif old_role == Role.SUPER_ADMIN:
                target_user.is_superuser = False
                target_user.is_staff = False
                target_user.save(update_fields=["is_superuser", "is_staff"])

        if old_status != target_user.is_active:
            changes["is_active"] = {"before": old_status, "after": target_user.is_active}

        if changes:
            AdminAuditLog.log_action(
                actor=acting_user,
                action="USER_ROLE_CHANGED" if "role" in changes else "USER_STATUS_CHANGED",
                category="ROLES" if "role" in changes else "USERS",
                description=f"Admin {acting_user.email} modified account {target_user.email}",
                changes=changes,
                ip_address=get_client_ip(request),
            )

        return response


class AdminAuditLogListView(generics.ListAPIView):
    """
    GET /api/v1/organization/audit-logs/
    Retrieves audit logs of configuration and role modifications.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = AdminAuditLogSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = AdminAuditLog.objects.all().select_related("actor")
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(description__icontains=search)
                | Q(action__icontains=search)
                | Q(actor__email__icontains=search)
            )

        return qs.order_by("-created_at")
