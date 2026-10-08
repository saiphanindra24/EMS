from django.db.models import Count, Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from organization.models import AdminAuditLog
from .models import Department, Employee, EmploymentStatus
from .permissions import (
    CanManageDepartmentsPermission,
    CanManageEmployeesPermission,
    IsHRAdminOrSuperAdmin,
)
from .serializers import (
    DepartmentDetailSerializer,
    DepartmentSerializer,
    EmployeeCreateSerializer,
    EmployeeDetailSerializer,
    EmployeeListSerializer,
    EmployeeUpdateSerializer,
    SimpleEmployeeSerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class DepartmentListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/departments/
    List departments with search, active status filter, and employee counts.

    POST /api/v1/departments/
    Create a new department (Super Admin or HR Admin only).
    """
    permission_classes = [CanManageDepartmentsPermission]
    serializer_class = DepartmentSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = Department.objects.annotate(
            annotated_employee_count=Count("employees", filter=Q(employees__is_archived=False))
        ).select_related("head", "head__user")

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(description__icontains=search)
            )

        status_param = self.request.query_params.get("is_active")
        if status_param is not None:
            if status_param.lower() in ["true", "1"]:
                qs = qs.filter(is_active=True)
            elif status_param.lower() in ["false", "0"]:
                qs = qs.filter(is_active=False)

        ordering = self.request.query_params.get("ordering", "name")
        allowed_ordering = ["name", "-name", "code", "-code", "created_at", "-created_at"]
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("name")

        return qs

    def perform_create(self, serializer):
        serializer.save()


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/departments/<int:pk>/
    View department details including employee roster.

    PUT/PATCH /api/v1/departments/<int:pk>/
    Update department details.

    DELETE /api/v1/departments/<int:pk>/
    Soft-deactivate department (sets is_active=False).
    """
    permission_classes = [CanManageDepartmentsPermission]
    queryset = Department.objects.annotate(
        annotated_employee_count=Count("employees", filter=Q(employees__is_archived=False))
    ).select_related("head", "head__user")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return DepartmentDetailSerializer
        return DepartmentSerializer

    def perform_destroy(self, instance):
        # Soft deactivate instead of permanently destroying
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class DepartmentEmployeesView(generics.ListAPIView):
    """
    GET /api/v1/departments/<int:pk>/employees/
    List active employees belonging to a specific department.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SimpleEmployeeSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        dept_id = self.kwargs["pk"]
        return Employee.objects.filter(
            department_id=dept_id,
            is_archived=False,
        ).select_related("user")


class EmployeeListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/employees/
    Search, filter, sort, and paginate employee records.

    POST /api/v1/employees/
    Create a new employee and auth user (Super Admin / HR Admin only).
    Supports multipart/form-data for profile photos.
    """
    permission_classes = [CanManageEmployeesPermission]
    pagination_class = StandardResultsSetPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EmployeeCreateSerializer
        return EmployeeListSerializer

    def perform_create(self, serializer):
        employee = serializer.save()
        AdminAuditLog.log_action(
            actor=self.request.user if (self.request and self.request.user and self.request.user.is_authenticated) else None,
            action="CREATE_EMPLOYEE",
            category="EMPLOYEE_MANAGEMENT",
            description=f"Created employee profile for {employee.full_name} ({employee.employee_id})",
            changes={"employee_id": employee.employee_id, "email": employee.email},
            ip_address=self.request.META.get("REMOTE_ADDR") if self.request else None,
        )

    def get_queryset(self):
        qs = Employee.objects.select_related("user", "department", "manager", "manager__user")
        user = self.request.user

        # Access restriction for regular employees:
        # Super Admins and HR Admins can view all, including archived if requested.
        is_admin = user.is_authenticated and (user.is_super_admin or user.is_hr_admin)
        include_archived = self.request.query_params.get("include_archived", "false").lower() in ["true", "1"]

        if not (is_admin and include_archived):
            qs = qs.filter(is_archived=False)

        # Search across full_name, email, employee_id, designation
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(employee_id__icontains=search)
                | Q(designation__icontains=search)
            )

        # Department filter (by ID or code)
        department = self.request.query_params.get("department")
        if department:
            if department.isdigit():
                qs = qs.filter(department_id=department)
            else:
                qs = qs.filter(department__code__iexact=department)

        # Status filter
        emp_status = self.request.query_params.get("status")
        if emp_status:
            qs = qs.filter(status__iexact=emp_status)

        # Employment type filter
        emp_type = self.request.query_params.get("employment_type")
        if emp_type:
            qs = qs.filter(employment_type__iexact=emp_type)

        # Work location filter
        work_location = self.request.query_params.get("work_location")
        if work_location:
            qs = qs.filter(work_location__icontains=work_location)

        # Manager filter (?manager=me or ?manager=<id>)
        manager_param = self.request.query_params.get("manager")
        if manager_param:
            if manager_param == "me" and hasattr(user, "employee_profile"):
                qs = qs.filter(manager=user.employee_profile)
            elif manager_param.isdigit():
                qs = qs.filter(manager_id=manager_param)

        # Sorting
        ordering = self.request.query_params.get("ordering", "-created_at")
        allowed_ordering = [
            "employee_id",
            "-employee_id",
            "user__first_name",
            "-user__first_name",
            "date_joined",
            "-date_joined",
            "created_at",
            "-created_at",
            "department__name",
            "-department__name",
        ]
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-created_at")

        return qs


class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET /api/v1/employees/<int:pk>/
    View full employee details. Sensitive fields are dynamically masked
    unless the caller is Super Admin, HR Admin, or the employee themselves.

    PUT/PATCH /api/v1/employees/<int:pk>/
    Update employee record. Supports multipart for photo updates.

    DELETE /api/v1/employees/<int:pk>/
    Soft deactivation (archival).
    """
    permission_classes = [CanManageEmployeesPermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = Employee.objects.select_related("user", "department", "manager", "manager__user")

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return EmployeeUpdateSerializer
        return EmployeeDetailSerializer

    def perform_destroy(self, instance):
        # Soft deactivation rather than permanent deletion
        instance.soft_deactivate()
        AdminAuditLog.log_action(
            actor=self.request.user if (self.request and self.request.user and self.request.user.is_authenticated) else None,
            action="DELETE_EMPLOYEE",
            category="EMPLOYEE_MANAGEMENT",
            description=f"Archived employee record for {instance.full_name} ({instance.employee_id})",
            changes={"employee_id": instance.employee_id, "is_archived": True},
            ip_address=self.request.META.get("REMOTE_ADDR") if self.request else None,
        )


class EmployeeDeactivateView(APIView):
    """
    POST /api/v1/employees/<int:pk>/deactivate/
    Soft deactivates an employee (sets is_archived=True, status=INACTIVE, and user.is_active=False).
    Requires Super Admin or HR Admin.
    """
    permission_classes = [IsHRAdminOrSuperAdmin]

    def post(self, request, pk, *args, **kwargs):
        try:
            employee = Employee.objects.select_related("user").get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        employee.soft_deactivate()
        AdminAuditLog.log_action(
            actor=request.user,
            action="DEACTIVATE_EMPLOYEE",
            category="EMPLOYEE_MANAGEMENT",
            description=f"Deactivated employee profile for {employee.full_name} ({employee.employee_id})",
            changes={"employee_id": employee.employee_id, "status": "INACTIVE", "is_archived": True},
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        return Response({
            "status": "success",
            "message": f"Employee {employee.full_name} ({employee.employee_id}) has been deactivated.",
        }, status=status.HTTP_200_OK)


class EmployeeReactivateView(APIView):
    """
    POST /api/v1/employees/<int:pk>/reactivate/
    Reactivates an employee profile and user login.
    Requires Super Admin or HR Admin.
    """
    permission_classes = [IsHRAdminOrSuperAdmin]

    def post(self, request, pk, *args, **kwargs):
        try:
            employee = Employee.objects.select_related("user").get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        employee.reactivate()
        AdminAuditLog.log_action(
            actor=request.user,
            action="REACTIVATE_EMPLOYEE",
            category="EMPLOYEE_MANAGEMENT",
            description=f"Reactivated employee profile for {employee.full_name} ({employee.employee_id})",
            changes={"employee_id": employee.employee_id, "status": "ACTIVE", "is_archived": False},
            ip_address=request.META.get("REMOTE_ADDR"),
        )
        return Response({
            "status": "success",
            "message": f"Employee {employee.full_name} ({employee.employee_id}) has been reactivated.",
        }, status=status.HTTP_200_OK)
