from rest_framework import permissions
from accounts.models import Role


class IsHRAdminOrSuperAdmin(permissions.BasePermission):
    """Allows write operations only to Super Admins and HR Admins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_super_admin or request.user.is_hr_admin)
        )


class CanManageDepartmentsPermission(permissions.BasePermission):
    """
    Read: All authenticated users.
    Write: Super Admin and HR Admin.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user.is_super_admin or request.user.is_hr_admin)


class CanManageEmployeesPermission(permissions.BasePermission):
    """
    Read: All authenticated users can view directory.
    Create/Deactivate/Reactivate: Super Admin and HR Admin only.
    Update: Super Admin, HR Admin, or employee editing their own profile (limited fields).
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == "POST":
            # Creation is strictly Super Admin or HR Admin
            return bool(request.user.is_super_admin or request.user.is_hr_admin)
        # For PUT/PATCH/DELETE, check has_object_permission
        return True

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        if user.is_super_admin or user.is_hr_admin:
            return True

        # Employee editing their own contact info
        if request.method in ["PUT", "PATCH"]:
            return obj.user_id == user.id

        return False
