from rest_framework import permissions
from accounts.models import Role


class CanCreateTasksPermission(permissions.BasePermission):
    """
    Read: Any authenticated user.
    Create: Super Admin, HR Admin, or Manager.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.method == "POST":
            return bool(
                request.user.is_super_admin
                or request.user.is_hr_admin
                or request.user.role == Role.MANAGER
            )
        return True


class CanModifyTaskPermission(permissions.BasePermission):
    """
    Object-level permissions:
    - Super Admin & HR Admin: Full access.
    - Assigning Manager / Manager of assignee: Full access.
    - Assignee: Can view and update (serializer prevents modifying admin fields).
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_super_admin or user.is_hr_admin:
            return True

        # Check if user is the assigned employee
        is_assignee = obj.assignee and obj.assignee.user_id == user.id

        # Check if user is the assigning manager
        is_assigning_mgr = obj.assigning_manager_id == user.id

        # Check if user is manager of the assignee
        is_team_mgr = False
        if user.role == Role.MANAGER and obj.assignee:
            if hasattr(user, "employee_profile") and obj.assignee.manager_id == user.employee_profile.id:
                is_team_mgr = True
            elif obj.assignee.user.manager_id == user.id:
                is_team_mgr = True

        if request.method in permissions.SAFE_METHODS:
            return True

        if request.method in ["PUT", "PATCH"]:
            return is_assignee or is_assigning_mgr or is_team_mgr

        if request.method == "DELETE":
            # Deletion/archival restricted to managers/admins
            return is_assigning_mgr or is_team_mgr

        return False
