from rest_framework import permissions
from accounts.models import Role


class CanAccessAttendanceRecord(permissions.BasePermission):
    """
    Object-level permission:
    - Super Admin and HR Admin: full access.
    - Manager: access own records and direct reports' records.
    - Employee: access only own records.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_super_admin or user.is_hr_admin:
            return True

        record_employee = getattr(obj, "employee", None)
        if not record_employee:
            return False

        # Direct ownership
        if record_employee.user_id == user.id:
            return True

        # Manager checking direct reports
        if user.role == Role.MANAGER and record_employee.manager_id:
            # Check if record_employee.manager is this user's employee profile
            if hasattr(user, "employee_profile") and record_employee.manager_id == user.employee_profile.id:
                return True
            # Or fallback by user manager relationship
            if record_employee.user.manager_id == user.id:
                return True

        return False


class CanCorrectAttendance(permissions.BasePermission):
    """Only Super Admin and HR Admin can perform audit-logged corrections."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_super_admin or request.user.is_hr_admin)
        )
