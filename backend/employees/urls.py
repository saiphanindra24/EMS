from django.urls import path
from .views import (
    DepartmentDetailView,
    DepartmentEmployeesView,
    DepartmentListCreateView,
    EmployeeDeactivateView,
    EmployeeDetailView,
    EmployeeListCreateView,
    EmployeeReactivateView,
)

urlpatterns = [
    # Department endpoints
    path("departments/", DepartmentListCreateView.as_view(), name="department-list-create"),
    path("departments/<int:pk>/", DepartmentDetailView.as_view(), name="department-detail"),
    path("departments/<int:pk>/employees/", DepartmentEmployeesView.as_view(), name="department-employees"),

    # Employee endpoints
    path("employees/", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("employees/<int:pk>/", EmployeeDetailView.as_view(), name="employee-detail"),
    path("employees/<int:pk>/deactivate/", EmployeeDeactivateView.as_view(), name="employee-deactivate"),
    path("employees/<int:pk>/reactivate/", EmployeeReactivateView.as_view(), name="employee-reactivate"),
]
