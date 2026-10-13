from datetime import date
from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from employees.models import Employee, EmploymentStatus
from payroll.models import PayrollRun, PayrollStatus, Payslip, PayslipStatus, SalaryStructure
from payroll.permissions import CanViewPayslipPermission, IsPayrollAdmin
from payroll.serializers import (
    DisbursePayrollInputSerializer,
    PayrollRunSerializer,
    PayslipSerializer,
    ProcessPayrollInputSerializer,
    SalaryStructureSerializer,
)
from payroll.services import run_monthly_payroll


class PayrollSummaryView(APIView):
    """
    Overview summary metrics for the Payroll module.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()
        current_year = today.year
        current_month = today.month

        # If user is an employee, return personal summary
        if not (user.is_super_admin or user.is_hr_admin):
            emp = getattr(user, "employee_profile", None)
            if not emp:
                return Response({
                    "is_admin": False,
                    "latest_payslip": None,
                    "total_payslips": 0,
                })

            user_slips = Payslip.objects.filter(employee=emp).order_by("-year", "-month")
            latest_slip = user_slips.first()
            return Response({
                "is_admin": False,
                "latest_payslip": PayslipSerializer(latest_slip).data if latest_slip else None,
                "total_payslips": user_slips.count(),
                "salary_structure": SalaryStructureSerializer(getattr(emp, "salary_structure", None)).data if hasattr(emp, "salary_structure") else None,
            })

        # Admin / HR Summary
        total_active_employees = Employee.objects.filter(
            is_archived=False,
            status=EmploymentStatus.ACTIVE
        ).count()

        latest_run = PayrollRun.objects.first()
        pending_runs_count = PayrollRun.objects.exclude(status=PayrollStatus.PAID).count()

        yearly_disbursed = PayrollRun.objects.filter(
            year=current_year,
            status=PayrollStatus.PAID
        ).aggregate(total=Sum("total_net"))["total"] or Decimal("0.00")

        return Response({
            "is_admin": True,
            "total_active_employees": total_active_employees,
            "current_month": current_month,
            "current_year": current_year,
            "latest_run": PayrollRunSerializer(latest_run).data if latest_run else None,
            "pending_runs_count": pending_runs_count,
            "yearly_disbursed_total": yearly_disbursed,
        })


class PayrollRunViewSet(viewsets.ModelViewSet):
    """
    Manage monthly payroll runs.
    """
    queryset = PayrollRun.objects.all().select_related("processed_by", "approved_by")
    serializer_class = PayrollRunSerializer
    permission_classes = [IsPayrollAdmin]

    @action(detail=False, methods=["post"], url_path="process")
    def process_payroll(self, request):
        serializer = ProcessPayrollInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        run = run_monthly_payroll(
            year=data["year"],
            month=data["month"],
            user=request.user,
            notes=data.get("notes", "")
        )

        return Response(
            {
                "message": f"Successfully processed payroll run for {run.month:02d}/{run.year}",
                "payroll_run": PayrollRunSerializer(run).data,
            },
            status=status.HTTP_201_CREATED if run.status == PayrollStatus.DRAFT else status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"], url_path="disburse")
    def disburse(self, request, pk=None):
        payroll_run = self.get_object()
        serializer = DisbursePayrollInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        disbursement_date = data.get("disbursement_date") or timezone.localdate()
        payment_method = data.get("payment_method", "BANK_TRANSFER")
        tx_ref = data.get("transaction_reference", "") or f"NEFT-{timezone.now().strftime('%Y%m%d%H%M')}"

        # Update run status
        payroll_run.status = PayrollStatus.PAID
        payroll_run.approved_by = request.user
        payroll_run.disbursement_date = disbursement_date
        payroll_run.save(update_fields=["status", "approved_by", "disbursement_date", "updated_at"])

        # Update all child payslips in bulk
        payroll_run.payslips.update(
            status=PayslipStatus.PAID,
            payment_method=payment_method,
            payment_date=disbursement_date,
            transaction_reference=tx_ref,
        )

        return Response({
            "message": f"Payroll for {payroll_run.month:02d}/{payroll_run.year} successfully marked as disbursed.",
            "payroll_run": PayrollRunSerializer(payroll_run).data,
        })


class PayslipViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View payslips with role-based visibility.
    """
    serializer_class = PayslipSerializer
    permission_classes = [CanViewPayslipPermission]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Payslip.objects.none()

        qs = Payslip.objects.all().select_related("employee__user", "employee__department", "payroll_run")

        # RBAC Filtering
        if not (user.is_super_admin or user.is_hr_admin):
            if user.role == Role.MANAGER and hasattr(user, "employee_profile"):
                qs = qs.filter(
                    Q(employee__user=user) | Q(employee__manager=user.employee_profile)
                )
            else:
                qs = qs.filter(employee__user=user)

        # Query parameter filters
        month = self.request.query_params.get("month")
        year = self.request.query_params.get("year")
        department_id = self.request.query_params.get("department")
        search = self.request.query_params.get("search")
        status_filter = self.request.query_params.get("status")

        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        if department_id:
            qs = qs.filter(employee__department_id=department_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(payslip_number__icontains=search)
                | Q(employee__employee_id__icontains=search)
                | Q(employee__user__first_name__icontains=search)
                | Q(employee__user__last_name__icontains=search)
                | Q(employee__user__email__icontains=search)
            )

        return qs


class SalaryStructureViewSet(viewsets.ModelViewSet):
    """
    Manage employee CTC and salary component structures.
    """
    queryset = SalaryStructure.objects.all().select_related("employee__user", "employee__department")
    serializer_class = SalaryStructureSerializer
    permission_classes = [IsPayrollAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        department_id = self.request.query_params.get("department")
        search = self.request.query_params.get("search")

        if department_id:
            qs = qs.filter(employee__department_id=department_id)
        if search:
            qs = qs.filter(
                Q(employee__employee_id__icontains=search)
                | Q(employee__user__first_name__icontains=search)
                | Q(employee__user__last_name__icontains=search)
                | Q(employee__user__email__icontains=search)
            )
        return qs
