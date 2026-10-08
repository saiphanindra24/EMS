from rest_framework import permissions
from accounts.models import Role
from employees.models import Employee


def is_authorized_for_sensitive_data(user):
    """
    Checks if user is authorized to view confidential personal/financial data
    (such as base salary, national ID, bank details, home address, date of birth).
    Strictly limited to Super Admin and HR Admin.
    """
    if not user or not user.is_authenticated:
        return False
    return bool(user.is_super_admin or user.is_hr_admin)


def get_scoped_employee_ids(user):
    """
    Returns a queryset/set of employee IDs that the user is authorized to inspect.
    - Super Admin / HR Admin: returns None (indicating unrestricted organization-wide access)
    - Manager: direct reports, managed department members, and themselves
    - Employee: strictly their own employee profile
    """
    if not user or not user.is_authenticated:
        return []

    if user.is_super_admin or user.is_hr_admin:
        return None  # Unrestricted

    # Get employee profile for the current user
    emp = getattr(user, "employee_profile", None)
    if not emp:
        return []

    if user.role == Role.MANAGER or user.is_manager:
        # Include self, direct reports, and employees in any department the manager heads or belongs to
        managed_reports = Employee.objects.filter(manager=emp).values_list("id", flat=True)
        dept_ids = []
        if emp.department_id:
            dept_ids.append(emp.department_id)
        # Any departments where this employee is designated head
        headed_dept_ids = list(emp.headed_departments.values_list("id", flat=True))
        all_dept_ids = set(dept_ids + headed_dept_ids)

        dept_emp_ids = Employee.objects.filter(department_id__in=all_dept_ids).values_list("id", flat=True)

        authorized_ids = set(managed_reports).union(set(dept_emp_ids))
        authorized_ids.add(emp.id)
        return list(authorized_ids)

    # Standard Employee: strictly self
    return [emp.id]


def can_access_employee(user, employee):
    """
    Returns True if user has permission to see records for the specified employee.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_super_admin or user.is_hr_admin:
        return True

    allowed_ids = get_scoped_employee_ids(user)
    if allowed_ids is None:
        return True
    return employee.id in allowed_ids


def can_access_department(user, department_id):
    """
    Returns True if user has permission to see department-level records.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_super_admin or user.is_hr_admin:
        return True

    emp = getattr(user, "employee_profile", None)
    if not emp or not emp.department_id:
        return False

    if str(emp.department_id) == str(department_id):
        return True

    if emp.headed_departments.filter(id=department_id).exists():
        return True

    return False


class CanViewReports(permissions.BasePermission):
    """
    Permission check to ensure user is authenticated and authorized to access reporting.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
