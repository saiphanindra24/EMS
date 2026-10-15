from datetime import date, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ShiftTemplate, ShiftRoster, ShiftSwapRequest, OvertimeRecord
from .serializers import (
    ShiftTemplateSerializer,
    ShiftRosterSerializer,
    ShiftSwapRequestSerializer,
    OvertimeRecordSerializer,
)


class ShiftTemplateViewSet(viewsets.ModelViewSet):
    """
    CRUD for standard Shift Templates.
    """
    queryset = ShiftTemplate.objects.all()
    serializer_class = ShiftTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get("active_only")
        if active_only and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        return qs


class ShiftRosterViewSet(viewsets.ModelViewSet):
    """
    Roster assignments calendar and scheduling.
    """
    queryset = ShiftRoster.objects.select_related("employee", "shift", "assigned_by").all()
    serializer_class = ShiftRosterSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")
        employee_id = self.request.query_params.get("employee_id")
        shift_id = self.request.query_params.get("shift_id")

        if start_date:
            qs = qs.filter(date__gte=start_date)
        if end_date:
            qs = qs.filter(date__lte=end_date)
        if shift_id:
            qs = qs.filter(shift_id=shift_id)

        # Privilege checks
        is_management = getattr(user, "role", None) in [
            "SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"
        ] or user.is_staff

        if employee_id:
            if is_management or str(user.id) == str(employee_id):
                qs = qs.filter(employee_id=employee_id)
            else:
                qs = qs.filter(employee=user)
        elif not is_management and not self.request.query_params.get("view_scope") == "team":
            # Default to personal shifts if not requesting team view
            qs = qs.filter(employee=user)

        return qs

    @action(detail=False, methods=["get"])
    def my_roster(self, request):
        user = request.user
        today = date.today()
        start = request.query_params.get("start_date", today - timedelta(days=7))
        end = request.query_params.get("end_date", today + timedelta(days=21))

        rosters = ShiftRoster.objects.filter(
            employee=user,
            date__range=[start, end]
        ).select_related("shift")

        serializer = self.get_serializer(rosters, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def bulk_assign(self, request):
        """
        Assign shift to an employee or multiple employees across a date range.
        Payload: {
            "employee_ids": [1, 2],
            "shift_id": 3,
            "start_date": "2026-10-15",
            "end_date": "2026-10-19",
            "notes": "Project sprint coverage"
        }
        """
        user = request.user
        is_management = getattr(user, "role", None) in [
            "SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"
        ] or user.is_staff
        if not is_management:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        employee_ids = request.data.get("employee_ids", [])
        shift_id = request.data.get("shift_id")
        start_date_str = request.data.get("start_date")
        end_date_str = request.data.get("end_date")
        notes = request.data.get("notes", "")

        if not employee_ids or not shift_id or not start_date_str:
            return Response(
                {"detail": "employee_ids, shift_id, and start_date are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            shift = ShiftTemplate.objects.get(id=shift_id)
        except ShiftTemplate.DoesNotExist:
            return Response({"detail": "ShiftTemplate not found."}, status=status.HTTP_404_NOT_FOUND)

        start_d = date.fromisoformat(start_date_str)
        end_d = date.fromisoformat(end_date_str) if end_date_str else start_d

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            curr = start_d
            while curr <= end_d:
                for emp_id in employee_ids:
                    obj, created = ShiftRoster.objects.update_or_create(
                        employee_id=emp_id,
                        date=curr,
                        defaults={
                            "shift": shift,
                            "notes": notes,
                            "assigned_by": user,
                            "status": ShiftRoster.Status.SCHEDULED,
                            "is_published": True,
                        }
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                curr += timedelta(days=1)

        return Response({
            "detail": f"Successfully rostered {created_count} shifts created, {updated_count} updated.",
            "created": created_count,
            "updated": updated_count,
        }, status=status.HTTP_201_CREATED)


class ShiftSwapRequestViewSet(viewsets.ModelViewSet):
    """
    Peer swap negotiation and manager approval workflow.
    """
    queryset = ShiftSwapRequest.objects.select_related(
        "requester", "target_employee", "requester_assignment__shift", "target_assignment__shift", "reviewed_by"
    ).all()
    serializer_class = ShiftSwapRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_management = getattr(user, "role", None) in [
            "SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"
        ] or user.is_staff

        if is_management:
            return super().get_queryset()

        return super().get_queryset().filter(
            Q(requester=user) | Q(target_employee=user) | Q(target_employee__isnull=True)
        )

    @action(detail=False, methods=["post"])
    def submit_swap(self, request):
        """
        Submit a new shift swap request.
        """
        user = request.user
        requester_assignment_id = request.data.get("requester_assignment_id")
        target_employee_id = request.data.get("target_employee_id")
        target_assignment_id = request.data.get("target_assignment_id")
        reason = request.data.get("reason", "").strip()

        if not requester_assignment_id or not reason:
            return Response(
                {"detail": "requester_assignment_id and reason are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            req_assign = ShiftRoster.objects.get(id=requester_assignment_id, employee=user)
        except ShiftRoster.DoesNotExist:
            return Response(
                {"detail": "Requester roster assignment not found or does not belong to you."},
                status=status.HTTP_404_NOT_FOUND
            )

        target_assign = None
        if target_assignment_id:
            try:
                target_assign = ShiftRoster.objects.get(id=target_assignment_id)
            except ShiftRoster.DoesNotExist:
                return Response({"detail": "Target roster assignment not found."}, status=status.HTTP_404_NOT_FOUND)

        swap = ShiftSwapRequest.objects.create(
            requester=user,
            requester_assignment=req_assign,
            target_employee_id=target_employee_id if target_employee_id else (target_assign.employee_id if target_assign else None),
            target_assignment=target_assign,
            reason=reason,
            target_status=ShiftSwapRequest.TargetStatus.PENDING if (target_employee_id or target_assign) else ShiftSwapRequest.TargetStatus.ACCEPTED,
            manager_status=ShiftSwapRequest.ManagerStatus.PENDING,
        )

        serializer = self.get_serializer(swap)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def peer_respond(self, request, pk=None):
        """
        Target peer responds to swap request.
        Payload: { "decision": "ACCEPTED" | "DECLINED" }
        """
        swap = self.get_object()
        user = request.user

        if swap.target_employee and swap.target_employee != user:
            return Response({"detail": "You are not the designated peer for this swap."}, status=status.HTTP_403_FORBIDDEN)

        decision = request.data.get("decision", "").upper()
        if decision not in ["ACCEPTED", "DECLINED"]:
            return Response({"detail": "decision must be ACCEPTED or DECLINED."}, status=status.HTTP_400_BAD_REQUEST)

        # If it was an open pool swap, claiming peer becomes the target_employee
        if not swap.target_employee:
            swap.target_employee = user
            target_assign_id = request.data.get("target_assignment_id")
            if target_assign_id:
                try:
                    swap.target_assignment = ShiftRoster.objects.get(id=target_assign_id, employee=user)
                except ShiftRoster.DoesNotExist:
                    pass

        swap.target_status = decision
        swap.save()

        serializer = self.get_serializer(swap)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def manager_review(self, request, pk=None):
        """
        Manager reviews and approves or rejects swap.
        Payload: { "decision": "APPROVED" | "REJECTED", "notes": "..." }
        """
        user = request.user
        is_management = getattr(user, "role", None) in [
            "SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"
        ] or user.is_staff
        if not is_management:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        swap = self.get_object()
        decision = request.data.get("decision", "").upper()
        notes = request.data.get("notes", "").strip()

        if decision not in ["APPROVED", "REJECTED"]:
            return Response({"detail": "decision must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            swap.manager_status = decision
            swap.manager_notes = notes
            swap.reviewed_by = user
            swap.save()

            if decision == "APPROVED":
                # Perform atomic shift swap if both roster assignments exist
                req_roster = swap.requester_assignment
                tar_roster = swap.target_assignment

                if req_roster and tar_roster:
                    temp_shift = req_roster.shift
                    req_roster.shift = tar_roster.shift
                    tar_roster.shift = temp_shift

                    req_roster.status = ShiftRoster.Status.SWAPPED
                    tar_roster.status = ShiftRoster.Status.SWAPPED

                    req_roster.save()
                    tar_roster.save()
                elif req_roster and not tar_roster:
                    # Open pool claim or unilateral reassignment
                    req_roster.status = ShiftRoster.Status.SWAPPED
                    req_roster.save()

        serializer = self.get_serializer(swap)
        return Response(serializer.data)


class OvertimeRecordViewSet(viewsets.ModelViewSet):
    """
    Overtime tracking and manager sign-off.
    """
    queryset = OvertimeRecord.objects.select_related("employee", "approver", "roster_assignment__shift").all()
    serializer_class = OvertimeRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_management = getattr(user, "role", None) in [
            "SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"
        ] or user.is_staff

        if is_management:
            return super().get_queryset()
        return super().get_queryset().filter(employee=user)

    @action(detail=False, methods=["post"])
    def submit_overtime(self, request):
        user = request.user
        date_val = request.data.get("date")
        start_time = request.data.get("start_time")
        end_time = request.data.get("end_time")
        hours = request.data.get("hours")
        rate_multiplier = request.data.get("rate_multiplier", 1.50)
        project_code = request.data.get("project_code", "")
        reason = request.data.get("reason", "")
        roster_assignment_id = request.data.get("roster_assignment_id")

        if not date_val or not hours or not reason:
            return Response(
                {"detail": "date, hours, and reason are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ot = OvertimeRecord.objects.create(
            employee=user,
            date=date_val,
            start_time=start_time or "18:00:00",
            end_time=end_time or "20:30:00",
            hours=Decimal(str(hours)),
            rate_multiplier=Decimal(str(rate_multiplier)),
            project_code=project_code,
            reason=reason,
            roster_assignment_id=roster_assignment_id if roster_assignment_id else None,
            status=OvertimeRecord.Status.PENDING,
        )

        serializer = self.get_serializer(ot)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def review_overtime(self, request, pk=None):
        user = request.user
        is_management = getattr(user, "role", None) in [
            "SUPER_ADMIN", "ADMIN", "HR_ADMIN", "DEPARTMENT_HEAD", "MANAGER"
        ] or user.is_staff
        if not is_management:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        ot = self.get_object()
        decision = request.data.get("decision", "").upper()
        notes = request.data.get("notes", "").strip()

        if decision not in ["APPROVED", "REJECTED", "PAID"]:
            return Response({"detail": "decision must be APPROVED, REJECTED, or PAID."}, status=status.HTTP_400_BAD_REQUEST)

        ot.status = decision
        ot.approver = user
        ot.approver_notes = notes
        ot.save()

        serializer = self.get_serializer(ot)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        Aggregated Shift & Overtime KPI Summary.
        """
        today = date.today()
        month_start = today.replace(day=1)

        total_rostered_week = ShiftRoster.objects.filter(
            date__range=[today, today + timedelta(days=6)]
        ).count()

        active_shifts_today = ShiftRoster.objects.filter(
            date=today
        ).count()

        pending_swaps = ShiftSwapRequest.objects.filter(
            manager_status=ShiftSwapRequest.ManagerStatus.PENDING
        ).count()

        approved_ot_hours = OvertimeRecord.objects.filter(
            date__gte=month_start,
            status=OvertimeRecord.Status.APPROVED
        ).aggregate(total=Sum("hours"))["total"] or 0

        pending_ot_claims = OvertimeRecord.objects.filter(
            status=OvertimeRecord.Status.PENDING
        ).count()

        return Response({
            "total_rostered_week": total_rostered_week,
            "active_shifts_today": active_shifts_today,
            "pending_swaps": pending_swaps,
            "approved_ot_hours_month": float(approved_ot_hours),
            "pending_ot_claims": pending_ot_claims,
        })
