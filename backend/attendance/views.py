from django.db import transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from employees.models import Employee
from .models import AttendanceCorrection, AttendanceRecord, AttendanceStatus, WorkSchedule
from .permissions import CanAccessAttendanceRecord, CanCorrectAttendance
from .serializers import (
    AttendanceCorrectionCreateSerializer,
    AttendanceCorrectionSerializer,
    AttendanceRecordSerializer,
    CheckInSerializer,
    CheckOutSerializer,
    WorkScheduleSerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def get_employee_for_user(user):
    """Retrieves or creates employee profile for the authenticated user."""
    if hasattr(user, "employee_profile"):
        return user.employee_profile
    emp = Employee.objects.filter(user=user).first()
    return emp


class CheckInView(APIView):
    """
    POST /api/v1/attendance/check-in/
    Records check-in with a strictly backend-controlled timezone-aware timestamp.
    Prevents duplicate active check-ins for the same day.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        employee = get_employee_for_user(request.user)
        if not employee:
            return Response(
                {"detail": "No active employee profile linked to your user account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CheckInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notes = serializer.validated_data.get("notes", "")

        now = timezone.now()
        today = timezone.localdate(now)

        # Check existing record for today
        with transaction.atomic():
            record, created = AttendanceRecord.objects.get_or_create(
                employee=employee,
                date=today,
                defaults={"check_in": now, "notes": notes},
            )

            if not created:
                # If already checked in and has not checked out yet
                if record.check_in and not record.check_out:
                    return Response(
                        {
                            "detail": f"You already have an active check-in today at {timezone.localtime(record.check_in).strftime('%I:%M %p')}."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # If already checked in and already completed check-out today
                if record.check_in and record.check_out:
                    return Response(
                        {
                            "detail": "You have already completed your attendance session for today."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # If record existed (e.g. marked absent or leave) and check_in is now recorded
                record.check_in = now
                if notes:
                    record.notes = (record.notes + " | " + notes).strip(" |")

            # Evaluate status (Late vs Present)
            record.evaluate_status()
            record.save()

        return Response(
            {
                "status": "success",
                "message": f"Check-in successful at {timezone.localtime(record.check_in).strftime('%I:%M %p')}.",
                "record": AttendanceRecordSerializer(record, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class CheckOutView(APIView):
    """
    POST /api/v1/attendance/check-out/
    Records check-out with a backend-controlled timestamp and computes duration.
    Prevents invalid check-outs.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        employee = get_employee_for_user(request.user)
        if not employee:
            return Response(
                {"detail": "No active employee profile linked to your user account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CheckOutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        notes = serializer.validated_data.get("notes", "")

        now = timezone.now()
        today = timezone.localdate(now)

        with transaction.atomic():
            try:
                record = AttendanceRecord.objects.select_for_update().get(
                    employee=employee,
                    date=today,
                )
            except AttendanceRecord.DoesNotExist:
                return Response(
                    {"detail": "No check-in record found for today. Please check in first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not record.check_in:
                return Response(
                    {"detail": "You have not checked in today."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if record.check_out:
                return Response(
                    {
                        "detail": f"You already checked out today at {timezone.localtime(record.check_out).strftime('%I:%M %p')}."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            record.check_out = now
            if notes:
                record.notes = (record.notes + " | " + notes).strip(" |")

            # Compute working duration and update status
            record.calculate_duration()
            record.evaluate_status()
            record.save()

        return Response(
            {
                "status": "success",
                "message": f"Check-out successful at {timezone.localtime(record.check_out).strftime('%I:%M %p')}. Total worked: {record.work_duration_hours} hrs.",
                "record": AttendanceRecordSerializer(record, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class TodayAttendanceView(APIView):
    """
    GET /api/v1/attendance/today/
    Returns the authenticated user's attendance status for today.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        employee = get_employee_for_user(request.user)
        if not employee:
            return Response({"record": None, "has_profile": False}, status=status.HTTP_200_OK)

        today = timezone.localdate()
        record = AttendanceRecord.objects.filter(employee=employee, date=today).first()

        data = AttendanceRecordSerializer(record, context={"request": request}).data if record else None
        return Response({
            "has_profile": True,
            "date": str(today),
            "record": data,
        }, status=status.HTTP_200_OK)


class AttendanceRecordListView(generics.ListAPIView):
    """
    GET /api/v1/attendance/
    Lists attendance records with role-based visibility and filters.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AttendanceRecordSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        qs = AttendanceRecord.objects.select_related("employee", "employee__user", "employee__department")

        # Role-based visibility
        if user.is_super_admin or user.is_hr_admin:
            # Full visibility across entire company
            pass
        elif user.role == Role.MANAGER:
            # Manager sees themselves + direct reports
            manager_emp = get_employee_for_user(user)
            if manager_emp:
                qs = qs.filter(
                    Q(employee=manager_emp) | Q(employee__manager=manager_emp) | Q(employee__user__manager=user)
                )
            else:
                qs = qs.filter(employee__user=user)
        else:
            # Regular employee sees strictly their own records
            emp = get_employee_for_user(user)
            if emp:
                qs = qs.filter(employee=emp)
            else:
                return AttendanceRecord.objects.none()

        # Query Filters
        date_param = self.request.query_params.get("date")
        if date_param:
            qs = qs.filter(date=date_param)

        start_date = self.request.query_params.get("start_date")
        if start_date:
            qs = qs.filter(date__gte=start_date)

        end_date = self.request.query_params.get("end_date")
        if end_date:
            qs = qs.filter(date__lte=end_date)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status__iexact=status_param)

        emp_id = self.request.query_params.get("employee")
        if emp_id and (user.is_super_admin or user.is_hr_admin or user.role == Role.MANAGER):
            qs = qs.filter(employee_id=emp_id)

        dept_id = self.request.query_params.get("department")
        if dept_id and (user.is_super_admin or user.is_hr_admin):
            qs = qs.filter(employee__department_id=dept_id)

        return qs.order_by("-date", "-check_in")


class AttendanceRecordDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/attendance/<int:pk>/
    View attendance record details with object-level permission check.
    """
    permission_classes = [permissions.IsAuthenticated, CanAccessAttendanceRecord]
    queryset = AttendanceRecord.objects.select_related("employee", "employee__user", "employee__department")
    serializer_class = AttendanceRecordSerializer


class AttendanceCorrectionView(APIView):
    """
    POST /api/v1/attendance/<int:pk>/correct/
    Allows HR Admin / Super Admin to adjust timestamps or status with an audit trail.
    """
    permission_classes = [CanCorrectAttendance]

    def post(self, request, pk, *args, **kwargs):
        serializer = AttendanceCorrectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            try:
                record = AttendanceRecord.objects.select_for_update().get(pk=pk)
            except AttendanceRecord.DoesNotExist:
                return Response({"detail": "Attendance record not found."}, status=status.HTTP_404_NOT_FOUND)

            # Log audit trail
            correction = AttendanceCorrection.objects.create(

                attendance_record=record,
                corrected_by=request.user,
                original_check_in=record.check_in,
                original_check_out=record.check_out,
                original_status=record.status,
                new_check_in=data.get("check_in", record.check_in),
                new_check_out=data.get("check_out", record.check_out),
                new_status=data.get("status", record.status),
                reason=data["reason"],
            )

            # Apply corrections to record
            if "check_in" in data:
                record.check_in = data["check_in"]
            if "check_out" in data:
                record.check_out = data["check_out"]
            if "status" in data:
                record.status = data["status"]

            record.calculate_duration()
            record.save()

        return Response(
            {
                "status": "success",
                "message": "Attendance record corrected and audit logged successfully.",
                "record": AttendanceRecordSerializer(record, context={"request": request}).data,
                "correction": AttendanceCorrectionSerializer(correction).data,
            },
            status=status.HTTP_200_OK,
        )


class AttendanceCorrectionHistoryView(generics.ListAPIView):
    """
    GET /api/v1/attendance/<int:pk>/corrections/
    View audit history of corrections for a specific record.
    """
    permission_classes = [CanCorrectAttendance]
    serializer_class = AttendanceCorrectionSerializer

    def get_queryset(self):
        return AttendanceCorrection.objects.filter(
            attendance_record_id=self.kwargs["pk"]
        ).select_related("corrected_by")


class AttendanceStatsView(APIView):
    """
    GET /api/v1/attendance/stats/
    Provides organization-wide or manager-team attendance statistics for today.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        today = timezone.localdate()

        qs = AttendanceRecord.objects.filter(date=today)
        emp_qs = Employee.objects.filter(is_archived=False)

        if user.is_super_admin or user.is_hr_admin:
            pass
        elif user.role == Role.MANAGER:
            manager_emp = get_employee_for_user(user)
            if manager_emp:
                qs = qs.filter(Q(employee=manager_emp) | Q(employee__manager=manager_emp))
                emp_qs = emp_qs.filter(Q(id=manager_emp.id) | Q(manager=manager_emp))
            else:
                qs = qs.filter(employee__user=user)
                emp_qs = emp_qs.filter(user=user)
        else:
            emp = get_employee_for_user(user)
            qs = qs.filter(employee=emp) if emp else AttendanceRecord.objects.none()
            emp_qs = emp_qs.filter(id=emp.id) if emp else Employee.objects.none()

        total_employees = emp_qs.count()
        present_count = qs.filter(status=AttendanceStatus.PRESENT).count()
        late_count = qs.filter(status=AttendanceStatus.LATE).count()
        half_day_count = qs.filter(status=AttendanceStatus.HALF_DAY).count()
        on_leave_count = qs.filter(status=AttendanceStatus.ON_LEAVE).count()
        holiday_count = qs.filter(status=AttendanceStatus.HOLIDAY).count()

        total_recorded = qs.count()
        absent_count = max(0, total_employees - total_recorded)

        avg_hours = qs.exclude(work_duration_hours=0).aggregate(Avg("work_duration_hours"))["work_duration_hours__avg"] or 0

        return Response({
            "date": str(today),
            "total_employees": total_employees,
            "present": present_count,
            "late": late_count,
            "half_day": half_day_count,
            "on_leave": on_leave_count,
            "holiday": holiday_count,
            "absent": absent_count,
            "average_work_hours": round(float(avg_hours), 2),
        }, status=status.HTTP_200_OK)


class WorkScheduleView(APIView):
    """
    GET /api/v1/attendance/schedule/
    Retrieves the organization's active work schedule and grace period.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        schedule = WorkSchedule.get_active_schedule()
        if not schedule:
            schedule = WorkSchedule.objects.create(
                name="Standard Corporate Schedule",
                work_start_time="09:00:00",
                work_end_time="18:00:00",
                grace_period_minutes=15,
                is_default=True,
            )
        serializer = WorkScheduleSerializer(schedule)
        return Response(serializer.data, status=status.HTTP_200_OK)
