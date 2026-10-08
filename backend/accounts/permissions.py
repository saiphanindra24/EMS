from rest_framework import permissions
from .models import Role


class IsSuperAdmin(permissions.BasePermission):
    """Allows access only to Super Admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_super_admin
        )


class IsHRAdmin(permissions.BasePermission):
    """Allows access to HR Admins and Super Admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_hr_admin
        )


class IsManager(permissions.BasePermission):
    """Allows access to Managers, HR Admins, and Super Admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_manager
        )


class IsOwnerOrManagerOrAdmin(permissions.BasePermission):
    """
    Object-level permission to ensure employees can only access their own records.
    - Super Admin & HR Admin: Full access.
    - Manager: Access own records and direct reports' records.
    - Employee: Access strictly own records.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_super_admin or user.is_hr_admin:
            return True

        # Check if the target object is the user itself
        if hasattr(obj, "email") and hasattr(obj, "role"):
            target_user = obj
        else:
            target_user = getattr(obj, "user", None)

        if not target_user:
            return False

        # Direct ownership
        if target_user.id == user.id:
            return True

        # Manager checking direct reports
        if user.role == Role.MANAGER and target_user.manager_id == user.id:
            return True

        return False
