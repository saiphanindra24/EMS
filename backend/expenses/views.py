from decimal import Decimal
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ExpenseCategory, ExpenseClaim, ExpenseStatus, PaymentMethod
from .serializers import (
    ExpenseClaimSerializer,
    ExpenseFinanceSettlementInputSerializer,
    ExpenseManagerReviewInputSerializer,
)


class ExpenseClaimViewSet(viewsets.ModelViewSet):
    """
    CRUD and multi-tier approval workflow for Employee Expense Claims.
    """
    serializer_class = ExpenseClaimSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ExpenseClaim.objects.select_related(
            "employee",
            "employee__user",
            "employee__department",
            "project",
            "manager_reviewed_by",
            "finance_reviewed_by"
        )

        role = getattr(user, "role", "")
        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            return qs

        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return qs.none()

        if role == "MANAGER":
            return qs.filter(
                Q(employee=employee_profile) |
                Q(employee__manager=employee_profile) |
                Q(project__lead=employee_profile)
            ).distinct()

        # Regular employee
        return qs.filter(employee=employee_profile)

    def perform_create(self, serializer):
        user = self.request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            raise permissions.exceptions.PermissionDenied("You do not have an active employee profile to submit expense claims.")
        serializer.save(
            employee=employee_profile,
            status=ExpenseStatus.SUBMITTED
        )

    @action(detail=False, methods=["get"])
    def my_claims(self, request):
        user = request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return Response([])
        claims = ExpenseClaim.objects.filter(employee=employee_profile).order_by("-created_at")
        serializer = self.get_serializer(claims, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = self.get_queryset()
        total_claims_count = qs.count()
        total_amount_sum = qs.aggregate(s=Sum("total_amount"))["s"] or Decimal("0.00")

        pending_manager_count = qs.filter(status=ExpenseStatus.SUBMITTED).count()
        pending_finance_count = qs.filter(status=ExpenseStatus.MANAGER_APPROVED).count()
        reimbursed_amount = (
            qs.filter(status=ExpenseStatus.REIMBURSED).aggregate(s=Sum("total_amount"))["s"]
            or Decimal("0.00")
        )
        billable_amount = (
            qs.filter(is_billable=True).aggregate(s=Sum("total_amount"))["s"]
            or Decimal("0.00")
        )

        # Category breakdown
        category_breakdown = []
        for cat_choice in ExpenseCategory.choices:
            cat_key, cat_label = cat_choice
            cat_qs = qs.filter(category=cat_key)
            cat_sum = cat_qs.aggregate(s=Sum("total_amount"))["s"] or Decimal("0.00")
            cat_count = cat_qs.count()
            if cat_count > 0:
                category_breakdown.append({
                    "category": cat_key,
                    "label": cat_label,
                    "count": cat_count,
                    "total": float(cat_sum),
                })

        return Response({
            "total_claims": total_claims_count,
            "total_amount": float(total_amount_sum),
            "pending_manager_approval": pending_manager_count,
            "pending_finance_approval": pending_finance_count,
            "total_reimbursed_amount": float(reimbursed_amount),
            "billable_client_amount": float(billable_amount),
            "category_breakdown": category_breakdown,
        })

    @action(detail=True, methods=["post"])
    def manager_review(self, request, pk=None):
        claim = self.get_object()
        user = request.user
        role = getattr(user, "role", "")

        # Verify permissions: Super Admin, HR Admin, direct manager, or project lead
        is_manager = False
        emp_prof = getattr(user, "employee_profile", None)
        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            is_manager = True
        elif emp_prof:
            if claim.employee.manager_id == emp_prof.id:
                is_manager = True
            elif claim.project and claim.project.lead_id == emp_prof.id:
                is_manager = True

        if not is_manager:
            return Response(
                {"error": "You do not have manager authorization to review this expense claim."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ExpenseManagerReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_choice = serializer.validated_data["action"]
        notes = serializer.validated_data.get("notes", "")

        claim.manager_reviewed_by = user
        claim.manager_reviewed_at = timezone.now()
        claim.manager_notes = notes

        if action_choice == "APPROVE":
            claim.status = ExpenseStatus.MANAGER_APPROVED
        else:
            claim.status = ExpenseStatus.REJECTED

        claim.save()
        return Response(ExpenseClaimSerializer(claim).data)

    @action(detail=True, methods=["post"])
    def finance_settlement(self, request, pk=None):
        claim = self.get_object()
        user = request.user
        role = getattr(user, "role", "")

        if role not in ["SUPER_ADMIN", "HR_ADMIN"]:
            return Response(
                {"error": "Only Finance & HR Administrators can settle or authorize expense disbursements."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ExpenseFinanceSettlementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action_choice = serializer.validated_data["action"]
        notes = serializer.validated_data.get("notes", "")
        payment_method = serializer.validated_data.get("payment_method", PaymentMethod.DIRECT_DEPOSIT)
        transaction_reference = serializer.validated_data.get("transaction_reference", "")

        claim.finance_reviewed_by = user
        claim.finance_reviewed_at = timezone.now()
        claim.finance_notes = notes

        if action_choice == "APPROVE":
            claim.status = ExpenseStatus.FINANCE_APPROVED
        elif action_choice == "REIMBURSE":
            claim.status = ExpenseStatus.REIMBURSED
            claim.reimbursed_at = timezone.now()
            claim.payment_method = payment_method
            claim.transaction_reference = transaction_reference
        else:
            claim.status = ExpenseStatus.REJECTED

        claim.save()
        return Response(ExpenseClaimSerializer(claim).data)
