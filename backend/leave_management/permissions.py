from rest_framework import permissions
from accounts.models import Role


class CanManageLeaveTypesPermission(permissions.BasePermission):
    """
    Safe methods: Any authenticated user can view active leave types.
    Create/Edit: Only Super Admin and HR Admin can modify leave types.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user.is_super_admin or request.user.is_hr_admin)


class CanViewLeavePermission(permissions.BasePermission):
    """
    Object-level permission for viewing a leave request:
    - Super Admin / HR Admin: All.
    - Manager: Own requests + requests of direct reports.
    - Employee: Own requests.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_super_admin or user.is_hr_admin:
            return True

        # Check if user is the requesting employee
        if obj.employee.user_id == user.id:
            return True

        # Check if user is manager of the requesting employee
        if user.role == Role.MANAGER:
            if hasattr(user, "employee_profile") and obj.employee.manager_id == user.employee_profile.id:
                return True
            if obj.employee.user.manager_id == user.id:
                return True

        return False


class CanApproveLeavePermission(permissions.BasePermission):
    """
    Permission to approve or reject a leave request:
    - Super Admin / HR Admin: Any request.
    - Manager: Only requests of direct reports. Cannot approve own leave!
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return bool(
            user.is_super_admin
            or user.is_hr_admin
            or user.role == Role.MANAGER
        )

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        # No self-approval allowed for managers
        if obj.employee.user_id == user.id:
            return False

        if user.is_super_admin or user.is_hr_admin:
            return True

        if user.role == Role.MANAGER:
            if hasattr(user, "employee_profile") and obj.employee.manager_id == user.employee_profile.id:
                return True
            if obj.employee.user.manager_id == user.id:
                return True

        return False


class CanCancelLeavePermission(permissions.BasePermission):
    """
    Only the requesting employee or an admin can cancel a pending request.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_super_admin or user.is_hr_admin:
            return True
        return obj.employee.user_id == user.id
