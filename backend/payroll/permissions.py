from rest_framework import permissions
from accounts.models import Role


class IsPayrollAdmin(permissions.BasePermission):
    """
    Grants access only to Super Admins and HR Admins who can execute and approve payroll.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(request.user.is_super_admin or request.user.is_hr_admin)


class CanViewPayslipPermission(permissions.BasePermission):
    """
    - Super Admin / HR Admin: All payslips.
    - Manager: Own payslips + direct reports.
    - Employee: Only own payslips.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_super_admin or user.is_hr_admin:
            return True
        if obj.employee.user_id == user.id:
            return True
        if user.role == Role.MANAGER and hasattr(user, "employee_profile"):
            if obj.employee.manager_id == user.employee_profile.id:
                return True
        return False
