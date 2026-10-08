from rest_framework import permissions
from accounts.models import Role


class IsAdminUserRole(permissions.BasePermission):
    """
    Grants access exclusively to authenticated Super Admins and HR Admins.
    Employees and Managers receive HTTP 403 Forbidden.
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_super_admin or request.user.is_hr_admin)
        )


class IsSuperAdminOnly(permissions.BasePermission):
    """
    Grants access strictly to Super Admins (for critical security actions,
    e.g. assigning Super Admin / HR Admin roles or destructive configs).
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_super_admin
        )


def can_assign_role(acting_user, target_role, target_user=None):
    """
    Role escalation guard:
    - Super Admin can assign any role.
    - HR Admin can assign MANAGER and EMPLOYEE, but CANNOT assign SUPER_ADMIN or HR_ADMIN.
    - HR Admin CANNOT modify roles of existing Super Admins.
    - Others cannot assign roles.
    """
    if not acting_user or not acting_user.is_authenticated:
        return False

    if acting_user.is_super_admin:
        return True

    if acting_user.is_hr_admin:
        # Check target user is not already super admin
        if target_user and target_user.is_super_admin:
            return False
        # Check new role is not super admin or hr admin
        if target_role in [Role.SUPER_ADMIN, Role.HR_ADMIN]:
            return False
        return True

    return False
