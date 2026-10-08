from datetime import date
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.models import Role
from .models import LeaveAuditLog, LeaveBalance, LeaveRequest, LeaveStatus, LeaveType
from .notifications import (
    notify_leave_cancelled,
    notify_leave_decision,
    notify_leave_submitted,
)
from .permissions import (
    CanApproveLeavePermission,
    CanCancelLeavePermission,
    CanManageLeaveTypesPermission,
    CanViewLeavePermission,
)
from .serializers import (
    LeaveAuditLogSerializer,
    LeaveBalanceSerializer,
    LeaveRejectSerializer,
    LeaveRequestCreateSerializer,
    LeaveRequestDetailSerializer,
    LeaveRequestListSerializer,
    LeaveTypeSerializer,
)


class LeaveTypeViewSet(viewsets.ModelViewSet):
    queryset = LeaveType.objects.all().order_by("name")
    serializer_class = LeaveTypeSerializer
    permission_classes = [CanManageLeaveTypesPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get("active_only")
        if active_only and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        return qs


class LeaveRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, CanViewLeavePermission]

    def get_serializer_class(self):
        if self.action == "create":
            return LeaveRequestCreateSerializer
        if self.action in ["retrieve", "approve", "reject", "cancel"]:
            return LeaveRequestDetailSerializer
        return LeaveRequestListSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return LeaveRequest.objects.none()

        qs = LeaveRequest.objects.select_related(
            "employee",
            "employee__user",
            "employee__department",
            "leave_type",
            "reviewed_by",
        ).prefetch_related("audit_logs", "audit_logs__performed_by")

        scope = self.request.query_params.get("scope")

        if user.is_super_admin or user.is_hr_admin:
            # Full visibility unless explicitly requested for personal leaves
            if scope == "my" and hasattr(user, "employee_profile"):
                qs = qs.filter(employee=user.employee_profile)
        elif user.role == Role.MANAGER:
            manager_profile = getattr(user, "employee_profile", None)
            if scope == "my" and manager_profile:
                qs = qs.filter(employee=manager_profile)
            elif scope == "team" and manager_profile:
                qs = qs.filter(employee__manager=manager_profile)
            else:
                # Own requests + direct reports
                filter_q = Q(employee__user=user)
                if manager_profile:
                    filter_q |= Q(employee__manager=manager_profile)
                qs = qs.filter(filter_q)
        else:
            # Employee only sees own requests
            if hasattr(user, "employee_profile"):
                qs = qs.filter(employee=user.employee_profile)
            else:
                qs = qs.none()

        # Filters
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())

        leave_type_param = self.request.query_params.get("leave_type")
        if leave_type_param:
            qs = qs.filter(leave_type_id=leave_type_param)

        department_param = self.request.query_params.get("department")
        if department_param:
            qs = qs.filter(employee__department_id=department_param)

        employee_param = self.request.query_params.get("employee")
        if employee_param:
            qs = qs.filter(employee_id=employee_param)

        start_after = self.request.query_params.get("start_date")
        if start_after:
            qs = qs.filter(start_date__gte=start_after)

        end_before = self.request.query_params.get("end_date")
        if end_before:
            qs = qs.filter(end_date__lte=end_before)

        return qs.order_by("-submitted_at")

    def perform_create(self, serializer):
        leave_request = serializer.save()
        notify_leave_submitted(leave_request)

    @action(detail=True, methods=["post"], permission_classes=[CanApproveLeavePermission])
    def approve(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status != LeaveStatus.PENDING:
            return Response(
                {"error": f"Cannot approve request with current status '{leave_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            old_status = leave_request.status
            leave_request.status = LeaveStatus.APPROVED
            leave_request.reviewed_by = request.user
            leave_request.reviewed_at = timezone.now()
            leave_request.rejection_reason = ""
            leave_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason", "updated_at"])

            # Deduct from LeaveBalance if tracked
            balance = LeaveBalance.objects.filter(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year,
            ).first()

            if balance:
                if balance.pending_days >= leave_request.duration_days:
                    balance.pending_days -= leave_request.duration_days
                balance.used_days += leave_request.duration_days
                balance.save(update_fields=["pending_days", "used_days", "updated_at"])

            # Record audit log
            LeaveAuditLog.objects.create(
                leave_request=leave_request,
                action="APPROVED",
                performed_by=request.user,
                previous_status=old_status,
                new_status=LeaveStatus.APPROVED,
                note=f"Approved by {request.user.full_name} ({request.user.role}).",
            )

            notify_leave_decision(leave_request, "APPROVED", request.user)

        serializer = LeaveRequestDetailSerializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[CanApproveLeavePermission])
    def reject(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status != LeaveStatus.PENDING:
            return Response(
                {"error": f"Cannot reject request with current status '{leave_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reject_serializer = LeaveRejectSerializer(data=request.data)
        if not reject_serializer.is_valid():
            return Response(reject_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = reject_serializer.validated_data["rejection_reason"]

        with transaction.atomic():
            old_status = leave_request.status
            leave_request.status = LeaveStatus.REJECTED
            leave_request.reviewed_by = request.user
            leave_request.reviewed_at = timezone.now()
            leave_request.rejection_reason = rejection_reason
            leave_request.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason", "updated_at"])

            # Release pending days in LeaveBalance if tracked
            balance = LeaveBalance.objects.filter(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year,
            ).first()

            if balance and balance.pending_days >= leave_request.duration_days:
                balance.pending_days -= leave_request.duration_days
                balance.save(update_fields=["pending_days", "updated_at"])

            # Record audit log
            LeaveAuditLog.objects.create(
                leave_request=leave_request,
                action="REJECTED",
                performed_by=request.user,
                previous_status=old_status,
                new_status=LeaveStatus.REJECTED,
                note=f"Rejected: {rejection_reason}",
            )

            notify_leave_decision(leave_request, "REJECTED", request.user, rejection_reason=rejection_reason)

        serializer = LeaveRequestDetailSerializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[CanCancelLeavePermission])
    def cancel(self, request, pk=None):
        leave_request = self.get_object()

        if leave_request.status != LeaveStatus.PENDING:
            return Response(
                {"error": f"Only pending leave requests can be cancelled (current status: {leave_request.status})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            old_status = leave_request.status
            leave_request.status = LeaveStatus.CANCELLED
            leave_request.save(update_fields=["status", "updated_at"])

            # Release pending days in LeaveBalance if tracked
            balance = LeaveBalance.objects.filter(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year,
            ).first()

            if balance and balance.pending_days >= leave_request.duration_days:
                balance.pending_days -= leave_request.duration_days
                balance.save(update_fields=["pending_days", "updated_at"])

            # Record audit log
            LeaveAuditLog.objects.create(
                leave_request=leave_request,
                action="CANCELLED",
                performed_by=request.user,
                previous_status=old_status,
                new_status=LeaveStatus.CANCELLED,
                note=f"Cancelled by {request.user.full_name}.",
            )

            notify_leave_cancelled(leave_request, request.user)

        serializer = LeaveRequestDetailSerializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        user = request.user
        base_qs = self.get_queryset()

        today = timezone.localdate()
        first_of_month = today.replace(day=1)

        total_pending = base_qs.filter(status=LeaveStatus.PENDING).count()
        approved_this_month = base_qs.filter(
            status=LeaveStatus.APPROVED,
            start_date__gte=first_of_month,
        ).count()
        total_rejected = base_qs.filter(status=LeaveStatus.REJECTED).count()

        # Employees on leave today
        on_leave_today_count = LeaveRequest.objects.filter(
            status=LeaveStatus.APPROVED,
            start_date__lte=today,
            end_date__gte=today,
        ).values("employee_id").distinct().count()

        return Response({
            "total_pending": total_pending,
            "approved_this_month": approved_this_month,
            "total_rejected": total_rejected,
            "on_leave_today": on_leave_today_count,
        })

    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """
        Calendar view of approved leaves within a date range.
        Defaults to current month if no dates provided.
        """
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        today = timezone.localdate()
        if not start_date_str:
            start_date_str = str(today.replace(day=1))
        if not end_date_str:
            # Next month or end of month
            end_date_str = str(today.replace(day=28))

        qs = self.get_queryset().filter(
            status=LeaveStatus.APPROVED,
            start_date__lte=end_date_str,
            end_date__gte=start_date_str,
        ).select_related("employee", "employee__user", "leave_type")

        data = [
            {
                "id": req.id,
                "employee_id": req.employee.employee_id,
                "employee_name": req.employee.user.full_name,
                "leave_type": req.leave_type.name,
                "leave_type_code": req.leave_type.code,
                "start_date": req.start_date,
                "end_date": req.end_date,
                "duration_days": req.duration_days,
                "is_paid": req.leave_type.is_paid,
            }
            for req in qs
        ]

        return Response(data)


class LeaveBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LeaveBalanceSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return LeaveBalance.objects.none()

        qs = LeaveBalance.objects.select_related("employee", "employee__user", "leave_type")

        scope = self.request.query_params.get("scope")
        employee_id = self.request.query_params.get("employee")

        if employee_id:
            if user.is_super_admin or user.is_hr_admin:
                qs = qs.filter(employee_id=employee_id)
            elif user.role == Role.MANAGER:
                manager_profile = getattr(user, "employee_profile", None)
                if manager_profile:
                    qs = qs.filter(
                        Q(employee_id=employee_id, employee__manager=manager_profile)
                        | Q(employee=manager_profile, employee_id=employee_id)
                    )
                else:
                    return LeaveBalance.objects.none()
            else:
                if hasattr(user, "employee_profile") and str(user.employee_profile.id) == str(employee_id):
                    qs = qs.filter(employee=user.employee_profile)
                else:
                    return LeaveBalance.objects.none()
        elif scope == "all" and (user.is_super_admin or user.is_hr_admin):
            # Explicitly requested all company balances
            pass
        else:
            # Default: Personal balances for the logged-in user
            if hasattr(user, "employee_profile"):
                qs = qs.filter(employee=user.employee_profile)
            else:
                qs = qs.none()

        year = self.request.query_params.get("year", timezone.now().year)
        if year:
            qs = qs.filter(year=year)

        return qs.order_by("leave_type__name")
