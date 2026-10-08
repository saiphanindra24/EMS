from datetime import datetime, timedelta
from decimal import Decimal
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Q, Sum
from django.http import Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role
from attendance.models import AttendanceRecord, AttendanceStatus
from employees.models import Department, Employee, EmploymentStatus
from leave_management.models import LeaveRequest, LeaveStatus
from tasks.models import Task, TaskStatus

from .permissions import (
    CanViewReports,
    can_access_department,
    can_access_employee,
    get_scoped_employee_ids,
    is_authorized_for_sensitive_data,
)
from .services import (
    PRODUCTIVITY_DEFINITIONS,
    generate_csv_response,
    generate_excel_response,
    resolve_date_period,
)


class ReportOverviewView(APIView):
    """
    GET /api/v1/reports/overview/
    Returns high-level statistics and metadata about available reports.
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        scoped_ids = get_scoped_employee_ids(user)

        emp_qs = Employee.objects.filter(is_archived=False)
        if scoped_ids is not None:
            emp_qs = emp_qs.filter(id__in=scoped_ids)

        today = timezone.localdate()
        first_of_month = today.replace(day=1)

        att_qs = AttendanceRecord.objects.filter(date__gte=first_of_month, date__lte=today)
        if scoped_ids is not None:
            att_qs = att_qs.filter(employee_id__in=scoped_ids)

        task_qs = Task.objects.filter(is_archived=False)
        if scoped_ids is not None:
            task_qs = task_qs.filter(assignee_id__in=scoped_ids)

        leave_qs = LeaveRequest.objects.filter(status=LeaveStatus.PENDING)
        if scoped_ids is not None:
            leave_qs = leave_qs.filter(employee_id__in=scoped_ids)

        available_reports = [
            {
                "id": "employees",
                "name": "Employee Roster & Headcount",
                "description": "Comprehensive employee profiles, departmental allocations, and role hierarchy with sensitive data controls.",
                "endpoint": "/api/v1/reports/employees/",
                "supported_formats": ["json", "csv", "xlsx"],
            },
            {
                "id": "attendance",
                "name": "Attendance & Punctuality",
                "description": "Daily attendance logs, time tracked, late occurrences, half-days, and attendance reliability rates.",
                "endpoint": "/api/v1/reports/attendance/",
                "supported_formats": ["json", "csv", "xlsx"],
            },
            {
                "id": "tasks",
                "name": "Task Progress & Delivery",
                "description": "Task delivery metrics, deadlines, completion rates, and estimated vs. actual hour variance.",
                "endpoint": "/api/v1/reports/tasks/",
                "supported_formats": ["json", "csv", "xlsx"],
            },
            {
                "id": "leaves",
                "name": "Leave & Absence Records",
                "description": "Leave requests, approval status, durations, and category distribution.",
                "endpoint": "/api/v1/reports/leaves/",
                "supported_formats": ["json", "csv", "xlsx"],
            },
            {
                "id": "departments",
                "name": "Department Performance",
                "description": "Departmental headcount, aggregate task execution, total logged hours, and average attendance rate.",
                "endpoint": "/api/v1/reports/departments/",
                "supported_formats": ["json", "csv", "xlsx"],
            },
            {
                "id": "productivity",
                "name": "Productivity & Multi-Factor Index",
                "description": "Holistic performance synthesis combining task execution, schedule adherence, attendance reliability, and estimation efficiency.",
                "endpoint": "/api/v1/reports/productivity/",
                "supported_formats": ["json", "csv", "xlsx"],
            },
        ]

        return Response({
            "high_level_stats": {
                "total_employees": emp_qs.count(),
                "attendance_records_this_month": att_qs.count(),
                "active_tasks": task_qs.filter(status__in=[TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW]).count(),
                "pending_leave_requests": leave_qs.count(),
            },
            "definitions": PRODUCTIVITY_DEFINITIONS,
            "available_reports": available_reports,
        })


class EmployeeReportView(APIView):
    """
    GET /api/v1/reports/employees/
    Filters: department, employment_type, status, search, date_joined_start, date_joined_end, export (csv, xlsx)
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        scoped_ids = get_scoped_employee_ids(user)
        can_view_sensitive = is_authorized_for_sensitive_data(user)

        qs = Employee.objects.select_related("user", "department", "manager", "manager__user")
        if scoped_ids is not None:
            qs = qs.filter(id__in=scoped_ids)

        # Filters
        include_archived = request.query_params.get("include_archived", "false").lower() in ["true", "1"]
        if not include_archived:
            qs = qs.filter(is_archived=False)

        dept_param = request.query_params.get("department")
        if dept_param:
            if dept_param.isdigit():
                qs = qs.filter(department_id=dept_param)
            else:
                qs = qs.filter(department__code__iexact=dept_param)

        emp_type = request.query_params.get("employment_type")
        if emp_type:
            qs = qs.filter(employment_type=emp_type.upper())

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(employee_id__icontains=search)
                | Q(designation__icontains=search)
            )

        start_join = request.query_params.get("date_joined_start")
        if start_join:
            try:
                d = datetime.strptime(start_join, "%Y-%m-%d").date()
                qs = qs.filter(date_joined__gte=d)
            except ValueError:
                return Response({"error": "Invalid date_joined_start. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        end_join = request.query_params.get("date_joined_end")
        if end_join:
            try:
                d = datetime.strptime(end_join, "%Y-%m-%d").date()
                qs = qs.filter(date_joined__lte=d)
            except ValueError:
                return Response({"error": "Invalid date_joined_end. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        ordering = request.query_params.get("ordering", "employee_id")
        allowed_ordering = ["employee_id", "-employee_id", "date_joined", "-date_joined", "created_at", "-created_at"]
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("employee_id")

        # Handle exports
        export_format = request.query_params.get("export", "").lower()
        if export_format in ["csv", "xlsx"]:
            headers = [
                "Employee ID", "Full Name", "Email", "Phone", "Department",
                "Designation", "Manager", "Employment Type", "Status",
                "Work Location", "Date Joined"
            ]
            if can_view_sensitive:
                headers.extend([
                    "Date of Birth", "Gender", "Emergency Contact Name",
                    "Emergency Contact Phone", "Address", "National ID",
                    "Bank Name", "Bank Account Number", "Base Salary"
                ])

            rows = []
            for emp in qs:
                row = [
                    emp.employee_id,
                    emp.full_name,
                    emp.email,
                    emp.phone or "-",
                    emp.department.name if emp.department else "-",
                    emp.designation or "-",
                    emp.manager.full_name if emp.manager else "-",
                    emp.get_employment_type_display(),
                    emp.get_status_display(),
                    emp.work_location,
                    emp.date_joined.isoformat() if emp.date_joined else "-",
                ]
                if can_view_sensitive:
                    row.extend([
                        emp.date_of_birth.isoformat() if emp.date_of_birth else "-",
                        emp.gender or "-",
                        emp.emergency_contact_name or "-",
                        emp.emergency_contact_phone or "-",
                        emp.address or "-",
                        emp.national_id or "-",
                        emp.bank_name or "-",
                        emp.bank_account_number or "-",
                        float(emp.base_salary) if emp.base_salary is not None else "-",
                    ])
                rows.append(row)

            metadata = {
                "Report": "Employee Roster & Headcount Report",
                "Generated By": user.email,
                "Generated At": timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "Confidentiality": "Confidential (HR Authorized)" if can_view_sensitive else "Standard Internal",
                "Total Count": len(rows),
            }

            if export_format == "csv":
                return generate_csv_response("emwts_employee_report", headers, rows, metadata)
            return generate_excel_response("emwts_employee_report", "Employees", headers, rows, metadata)

        # JSON response with pagination
        page = request.query_params.get("page", 1)
        page_size = min(int(request.query_params.get("page_size", 15)), 100)
        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except Exception:
            page_obj = paginator.page(1)

        results = []
        for emp in page_obj:
            item = {
                "id": emp.id,
                "employee_id": emp.employee_id,
                "full_name": emp.full_name,
                "email": emp.email,
                "phone": emp.phone,
                "department": {"id": emp.department.id, "name": emp.department.name, "code": emp.department.code} if emp.department else None,
                "designation": emp.designation,
                "manager": {"id": emp.manager.id, "name": emp.manager.full_name} if emp.manager else None,
                "employment_type": emp.employment_type,
                "status": emp.status,
                "work_location": emp.work_location,
                "date_joined": emp.date_joined.isoformat() if emp.date_joined else None,
                "is_archived": emp.is_archived,
            }
            if can_view_sensitive:
                item["sensitive_data"] = {
                    "date_of_birth": emp.date_of_birth.isoformat() if emp.date_of_birth else None,
                    "gender": emp.gender,
                    "emergency_contact_name": emp.emergency_contact_name,
                    "emergency_contact_phone": emp.emergency_contact_phone,
                    "address": emp.address,
                    "national_id": emp.national_id,
                    "bank_name": emp.bank_name,
                    "bank_account_number": emp.bank_account_number,
                    "base_salary": str(emp.base_salary) if emp.base_salary is not None else None,
                }
            results.append(item)

        # Summary aggregates
        dept_counts = dict(
            Employee.objects.filter(is_archived=False)
            .values("department__name")
            .annotate(c=Count("id"))
            .values_list("department__name", "c")
        )

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_obj.number,
            "page_size": page_size,
            "summary": {
                "total_records": paginator.count,
                "active_employees": qs.filter(status=EmploymentStatus.ACTIVE).count(),
                "departments_distribution": dept_counts,
            },
            "results": results,
        })


class AttendanceReportView(APIView):
    """
    GET /api/v1/reports/attendance/
    Filters: start_date, end_date, period, department, employee, status, export (csv, xlsx)
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        scoped_ids = get_scoped_employee_ids(user)

        try:
            start_date, end_date, period_label = resolve_date_period(request.query_params)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        qs = AttendanceRecord.objects.filter(
            date__gte=start_date,
            date__lte=end_date,
        ).select_related("employee", "employee__user", "employee__department")

        if scoped_ids is not None:
            qs = qs.filter(employee_id__in=scoped_ids)

        dept_param = request.query_params.get("department")
        if dept_param:
            if dept_param.isdigit():
                qs = qs.filter(employee__department_id=dept_param)
            else:
                qs = qs.filter(employee__department__code__iexact=dept_param)

        emp_param = request.query_params.get("employee")
        if emp_param:
            if emp_param.isdigit():
                qs = qs.filter(employee_id=emp_param)
            else:
                qs = qs.filter(employee__employee_id__iexact=emp_param)

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())

        ordering = request.query_params.get("ordering", "-date")
        if ordering in ["date", "-date", "created_at", "-created_at"]:
            qs = qs.order_by(ordering, "-check_in")
        else:
            qs = qs.order_by("-date", "-check_in")

        # Handle exports
        export_format = request.query_params.get("export", "").lower()
        if export_format in ["csv", "xlsx"]:
            headers = [
                "Employee ID", "Employee Name", "Department", "Date",
                "Status", "Check In", "Check Out", "Duration (Hours)",
                "Notes", "IP Address"
            ]
            rows = []
            for rec in qs:
                rows.append([
                    rec.employee.employee_id,
                    rec.employee.full_name,
                    rec.employee.department.name if rec.employee.department else "-",
                    rec.date.isoformat(),
                    rec.get_status_display(),
                    timezone.localtime(rec.check_in).strftime("%H:%M:%S") if rec.check_in else "-",
                    timezone.localtime(rec.check_out).strftime("%H:%M:%S") if rec.check_out else "-",
                    float(rec.work_duration_hours),
                    rec.notes or "-",
                    rec.ip_address or "-",
                ])

            metadata = {
                "Report": "Attendance & Punctuality Report",
                "Period": period_label,
                "Generated By": user.email,
                "Generated At": timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "Total Records": len(rows),
            }

            if export_format == "csv":
                return generate_csv_response("emwts_attendance_report", headers, rows, metadata)
            return generate_excel_response("emwts_attendance_report", "Attendance", headers, rows, metadata)

        # JSON response
        page = request.query_params.get("page", 1)
        page_size = min(int(request.query_params.get("page_size", 15)), 100)
        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except Exception:
            page_obj = paginator.page(1)

        results = []
        for rec in page_obj:
            results.append({
                "id": rec.id,
                "employee": {
                    "id": rec.employee.id,
                    "employee_id": rec.employee.employee_id,
                    "full_name": rec.employee.full_name,
                    "department": rec.employee.department.name if rec.employee.department else None,
                },
                "date": rec.date.isoformat(),
                "status": rec.status,
                "check_in": rec.check_in.isoformat() if rec.check_in else None,
                "check_out": rec.check_out.isoformat() if rec.check_out else None,
                "work_duration_hours": str(rec.work_duration_hours),
                "work_duration_minutes": rec.work_duration_minutes,
                "notes": rec.notes,
                "ip_address": rec.ip_address,
            })

        # Summary metrics
        total_recs = qs.count()
        status_breakdown = dict(qs.values("status").annotate(c=Count("id")).values_list("status", "c"))
        total_hours = qs.aggregate(s=Sum("work_duration_hours"))["s"] or Decimal("0.00")
        avg_hours = qs.aggregate(a=Avg("work_duration_hours"))["a"] or Decimal("0.00")

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_obj.number,
            "page_size": page_size,
            "reporting_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "label": period_label,
            },
            "summary": {
                "total_records": total_recs,
                "present_count": status_breakdown.get(AttendanceStatus.PRESENT, 0),
                "late_count": status_breakdown.get(AttendanceStatus.LATE, 0),
                "half_day_count": status_breakdown.get(AttendanceStatus.HALF_DAY, 0),
                "absent_count": status_breakdown.get(AttendanceStatus.ABSENT, 0),
                "on_leave_count": status_breakdown.get(AttendanceStatus.ON_LEAVE, 0),
                "total_hours_worked": round(float(total_hours), 2),
                "average_hours_per_day": round(float(avg_hours), 2),
            },
            "results": results,
        })


class TaskReportView(APIView):
    """
    GET /api/v1/reports/tasks/
    Filters: start_date, end_date, period, department, assignee, status, priority, overdue, export (csv, xlsx)
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        scoped_ids = get_scoped_employee_ids(user)

        try:
            start_date, end_date, period_label = resolve_date_period(request.query_params)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        qs = Task.objects.filter(is_archived=False).select_related(
            "assignee", "assignee__user", "department", "assigning_manager"
        )

        # Scoping
        if scoped_ids is not None:
            qs = qs.filter(
                Q(assignee_id__in=scoped_ids)
                | Q(assigning_manager=user)
            )

        # Date window: created or due within the window
        date_filter_mode = request.query_params.get("date_filter_mode", "due_date")
        if date_filter_mode == "created":
            qs = qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
        else:
            qs = qs.filter(
                Q(due_date__gte=start_date, due_date__lte=end_date)
                | Q(due_date__isnull=True, created_at__date__gte=start_date, created_at__date__lte=end_date)
            )

        dept_param = request.query_params.get("department")
        if dept_param:
            if dept_param.isdigit():
                qs = qs.filter(department_id=dept_param)
            else:
                qs = qs.filter(department__code__iexact=dept_param)

        assignee_param = request.query_params.get("assignee")
        if assignee_param:
            if assignee_param.isdigit():
                qs = qs.filter(assignee_id=assignee_param)
            else:
                qs = qs.filter(assignee__employee_id__iexact=assignee_param)

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())

        priority_param = request.query_params.get("priority")
        if priority_param:
            qs = qs.filter(priority=priority_param.upper())

        overdue_param = request.query_params.get("overdue")
        if overdue_param is not None:
            today = timezone.localdate()
            if overdue_param.lower() in ["true", "1"]:
                qs = qs.filter(due_date__lt=today).exclude(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED])
            elif overdue_param.lower() in ["false", "0"]:
                qs = qs.filter(Q(due_date__gte=today) | Q(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]))

        ordering = request.query_params.get("ordering", "-created_at")
        allowed_ordering = ["created_at", "-created_at", "due_date", "-due_date", "priority", "-priority", "status", "-status"]
        if ordering in allowed_ordering:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-created_at")

        # Export handling
        export_format = request.query_params.get("export", "").lower()
        if export_format in ["csv", "xlsx"]:
            headers = [
                "Task ID", "Title", "Assignee ID", "Assignee Name",
                "Department", "Assigned By", "Priority", "Status",
                "Progress (%)", "Estimated (h)", "Actual (h)", "Variance (h)",
                "Start Date", "Due Date", "Is Overdue", "Created At"
            ]
            rows = []
            today = timezone.localdate()
            for t in qs:
                variance = t.actual_hours - t.estimated_hours
                is_ov = "Yes" if (t.due_date and t.due_date < today and t.status not in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]) else "No"
                rows.append([
                    t.task_id,
                    t.title,
                    t.assignee.employee_id if t.assignee else "-",
                    t.assignee.full_name if t.assignee else "Unassigned",
                    t.department.name if t.department else "-",
                    t.assigning_manager.email if t.assigning_manager else "-",
                    t.get_priority_display(),
                    t.get_status_display(),
                    t.progress,
                    float(t.estimated_hours),
                    float(t.actual_hours),
                    float(variance),
                    t.start_date.isoformat() if t.start_date else "-",
                    t.due_date.isoformat() if t.due_date else "-",
                    is_ov,
                    t.created_at.strftime("%Y-%m-%d"),
                ])

            metadata = {
                "Report": "Task Progress & Delivery Report",
                "Period": period_label,
                "Generated By": user.email,
                "Generated At": timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "Total Tasks": len(rows),
            }

            if export_format == "csv":
                return generate_csv_response("emwts_tasks_report", headers, rows, metadata)
            return generate_excel_response("emwts_tasks_report", "Tasks", headers, rows, metadata)

        # JSON response
        page = request.query_params.get("page", 1)
        page_size = min(int(request.query_params.get("page_size", 15)), 100)
        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except Exception:
            page_obj = paginator.page(1)

        results = []
        for t in page_obj:
            results.append({
                "id": t.id,
                "task_id": t.task_id,
                "title": t.title,
                "assignee": {
                    "id": t.assignee.id,
                    "employee_id": t.assignee.employee_id,
                    "full_name": t.assignee.full_name,
                } if t.assignee else None,
                "department": {"id": t.department.id, "name": t.department.name} if t.department else None,
                "priority": t.priority,
                "status": t.status,
                "progress": t.progress,
                "estimated_hours": str(t.estimated_hours),
                "actual_hours": str(t.actual_hours),
                "start_date": t.start_date.isoformat() if t.start_date else None,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "is_overdue": t.is_overdue,
                "created_at": t.created_at.isoformat(),
            })

        # Aggregations
        total_tasks = qs.count()
        completed_tasks = qs.filter(status=TaskStatus.COMPLETED).count()
        in_progress_tasks = qs.filter(status=TaskStatus.IN_PROGRESS).count()
        overdue_count = qs.filter(due_date__lt=timezone.localdate()).exclude(status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]).count()
        total_est = qs.aggregate(s=Sum("estimated_hours"))["s"] or Decimal("0.00")
        total_act = qs.aggregate(s=Sum("actual_hours"))["s"] or Decimal("0.00")
        completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_obj.number,
            "page_size": page_size,
            "reporting_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "label": period_label,
            },
            "summary": {
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "in_progress_tasks": in_progress_tasks,
                "overdue_tasks": overdue_count,
                "completion_rate": completion_rate,
                "total_estimated_hours": float(total_est),
                "total_actual_hours": float(total_act),
                "hours_variance": float(total_act - total_est),
            },
            "results": results,
        })


class LeaveReportView(APIView):
    """
    GET /api/v1/reports/leaves/
    Filters: start_date, end_date, period, department, employee, leave_type, status, export (csv, xlsx)
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        scoped_ids = get_scoped_employee_ids(user)

        try:
            start_date, end_date, period_label = resolve_date_period(request.query_params)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Overlapping date query: request touches the window
        qs = LeaveRequest.objects.filter(
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).select_related("employee", "employee__user", "employee__department", "leave_type", "reviewed_by")

        if scoped_ids is not None:
            qs = qs.filter(employee_id__in=scoped_ids)

        dept_param = request.query_params.get("department")
        if dept_param:
            if dept_param.isdigit():
                qs = qs.filter(employee__department_id=dept_param)
            else:
                qs = qs.filter(employee__department__code__iexact=dept_param)

        emp_param = request.query_params.get("employee")
        if emp_param:
            if emp_param.isdigit():
                qs = qs.filter(employee_id=emp_param)
            else:
                qs = qs.filter(employee__employee_id__iexact=emp_param)

        type_param = request.query_params.get("leave_type")
        if type_param:
            if type_param.isdigit():
                qs = qs.filter(leave_type_id=type_param)
            else:
                qs = qs.filter(leave_type__code__iexact=type_param)

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param.upper())

        qs = qs.order_by("-submitted_at")

        # Export handling
        export_format = request.query_params.get("export", "").lower()
        if export_format in ["csv", "xlsx"]:
            headers = [
                "Request ID", "Employee ID", "Employee Name", "Department",
                "Leave Type", "Paid", "Start Date", "End Date", "Duration (Days)",
                "Status", "Reason", "Reviewed By", "Reviewed At"
            ]
            rows = []
            for req in qs:
                rows.append([
                    req.id,
                    req.employee.employee_id,
                    req.employee.full_name,
                    req.employee.department.name if req.employee.department else "-",
                    req.leave_type.name,
                    "Yes" if req.leave_type.is_paid else "No",
                    req.start_date.isoformat(),
                    req.end_date.isoformat(),
                    float(req.duration_days),
                    req.get_status_display(),
                    req.reason,
                    req.reviewed_by.email if req.reviewed_by else "-",
                    req.reviewed_at.strftime("%Y-%m-%d %H:%M") if req.reviewed_at else "-",
                ])

            metadata = {
                "Report": "Leave & Absence Records Report",
                "Period": period_label,
                "Generated By": user.email,
                "Generated At": timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "Total Requests": len(rows),
            }

            if export_format == "csv":
                return generate_csv_response("emwts_leave_report", headers, rows, metadata)
            return generate_excel_response("emwts_leave_report", "Leaves", headers, rows, metadata)

        # JSON response
        page = request.query_params.get("page", 1)
        page_size = min(int(request.query_params.get("page_size", 15)), 100)
        paginator = Paginator(qs, page_size)
        try:
            page_obj = paginator.page(page)
        except Exception:
            page_obj = paginator.page(1)

        results = []
        for req in page_obj:
            results.append({
                "id": req.id,
                "employee": {
                    "id": req.employee.id,
                    "employee_id": req.employee.employee_id,
                    "full_name": req.employee.full_name,
                    "department": req.employee.department.name if req.employee.department else None,
                },
                "leave_type": {
                    "id": req.leave_type.id,
                    "name": req.leave_type.name,
                    "code": req.leave_type.code,
                    "is_paid": req.leave_type.is_paid,
                },
                "start_date": req.start_date.isoformat(),
                "end_date": req.end_date.isoformat(),
                "duration_days": str(req.duration_days),
                "status": req.status,
                "reason": req.reason,
                "submitted_at": req.submitted_at.isoformat(),
                "reviewed_by": req.reviewed_by.email if req.reviewed_by else None,
                "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
            })

        total_requests = qs.count()
        approved_count = qs.filter(status=LeaveStatus.APPROVED).count()
        pending_count = qs.filter(status=LeaveStatus.PENDING).count()
        rejected_count = qs.filter(status=LeaveStatus.REJECTED).count()
        total_approved_days = qs.filter(status=LeaveStatus.APPROVED).aggregate(s=Sum("duration_days"))["s"] or Decimal("0.0")

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_obj.number,
            "page_size": page_size,
            "reporting_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "label": period_label,
            },
            "summary": {
                "total_requests": total_requests,
                "approved_requests": approved_count,
                "pending_requests": pending_count,
                "rejected_requests": rejected_count,
                "total_approved_days": float(total_approved_days),
            },
            "results": results,
        })


class DepartmentReportView(APIView):
    """
    GET /api/v1/reports/departments/
    Filters: is_active, search, start_date, end_date, period, export (csv, xlsx)
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        emp = getattr(user, "employee_profile", None)

        try:
            start_date, end_date, period_label = resolve_date_period(request.query_params)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        qs = Department.objects.select_related("head", "head__user")

        # Scoping
        if not (user.is_super_admin or user.is_hr_admin):
            if emp and emp.department_id:
                # Can view their own department and departments they head
                dept_ids = [emp.department_id] + list(emp.headed_departments.values_list("id", flat=True))
                qs = qs.filter(id__in=set(dept_ids))
            else:
                qs = qs.none()

        status_param = request.query_params.get("is_active")
        if status_param is not None:
            if status_param.lower() in ["true", "1"]:
                qs = qs.filter(is_active=True)
            elif status_param.lower() in ["false", "0"]:
                qs = qs.filter(is_active=False)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))

        qs = qs.order_by("name")

        # Compute department metrics
        dept_data = []
        for d in qs:
            active_headcount = d.employees.filter(is_archived=False, status=EmploymentStatus.ACTIVE).count()
            dept_tasks = Task.objects.filter(department=d, is_archived=False)
            total_tasks = dept_tasks.count()
            completed_tasks = dept_tasks.filter(status=TaskStatus.COMPLETED).count()
            completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

            # Logged hours
            att_qs = AttendanceRecord.objects.filter(
                employee__department=d,
                date__gte=start_date,
                date__lte=end_date,
            )
            logged_hours = att_qs.aggregate(s=Sum("work_duration_hours"))["s"] or Decimal("0.00")
            present_records = att_qs.filter(status=AttendanceStatus.PRESENT).count()
            total_att_records = att_qs.count()
            attendance_rate = round((present_records / total_att_records * 100), 1) if total_att_records > 0 else 0.0

            dept_data.append({
                "id": d.id,
                "code": d.code,
                "name": d.name,
                "head": d.head.full_name if d.head else "Unassigned",
                "is_active": d.is_active,
                "active_employees": active_headcount,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "task_completion_rate": completion_rate,
                "logged_work_hours": round(float(logged_hours), 2),
                "attendance_rate": attendance_rate,
            })

        # Handle exports
        export_format = request.query_params.get("export", "").lower()
        if export_format in ["csv", "xlsx"]:
            headers = [
                "Department Code", "Department Name", "Department Head",
                "Active Headcount", "Total Tasks", "Completed Tasks",
                "Task Completion Rate (%)", "Logged Work Hours (h)", "Attendance Rate (%)", "Status"
            ]
            rows = []
            for item in dept_data:
                rows.append([
                    item["code"],
                    item["name"],
                    item["head"],
                    item["active_employees"],
                    item["total_tasks"],
                    item["completed_tasks"],
                    item["task_completion_rate"],
                    item["logged_work_hours"],
                    item["attendance_rate"],
                    "Active" if item["is_active"] else "Inactive",
                ])

            metadata = {
                "Report": "Department Performance & Headcount Report",
                "Period": period_label,
                "Generated By": user.email,
                "Generated At": timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "Total Departments": len(rows),
            }

            if export_format == "csv":
                return generate_csv_response("emwts_departments_report", headers, rows, metadata)
            return generate_excel_response("emwts_departments_report", "Departments", headers, rows, metadata)

        # JSON response with pagination
        page = request.query_params.get("page", 1)
        page_size = min(int(request.query_params.get("page_size", 15)), 100)
        paginator = Paginator(dept_data, page_size)
        try:
            page_obj = paginator.page(page)
        except Exception:
            page_obj = paginator.page(1)

        total_headcount = sum(d["active_employees"] for d in dept_data)
        avg_completion = round(sum(d["task_completion_rate"] for d in dept_data) / len(dept_data), 1) if dept_data else 0.0

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_obj.number,
            "page_size": page_size,
            "reporting_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "label": period_label,
            },
            "summary": {
                "total_departments": len(dept_data),
                "total_headcount": total_headcount,
                "average_task_completion_rate": avg_completion,
            },
            "results": list(page_obj.object_list),
        })


class ProductivityReportView(APIView):
    """
    GET /api/v1/reports/productivity/
    Calculates a holistic multi-factor performance index for employees:
    - Task Completion Rate (40%)
    - On-Time Delivery Rate (25%)
    - Attendance Reliability Rate (25%)
    - Estimation Efficiency (10%)
    Does not rely on naive task counts.
    Filters: start_date, end_date, period, department, employee, export (csv, xlsx)
    """
    permission_classes = [CanViewReports]

    def get(self, request):
        user = request.user
        scoped_ids = get_scoped_employee_ids(user)

        try:
            start_date, end_date, period_label = resolve_date_period(request.query_params)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        emp_qs = Employee.objects.filter(is_archived=False).select_related("user", "department")

        if scoped_ids is not None:
            emp_qs = emp_qs.filter(id__in=scoped_ids)

        dept_param = request.query_params.get("department")
        if dept_param:
            if dept_param.isdigit():
                emp_qs = emp_qs.filter(department_id=dept_param)
            else:
                emp_qs = emp_qs.filter(department__code__iexact=dept_param)

        emp_param = request.query_params.get("employee")
        if emp_param:
            if emp_param.isdigit():
                emp_qs = emp_qs.filter(id=emp_param)
            else:
                emp_qs = emp_qs.filter(employee_id__iexact=emp_param)

        emp_qs = emp_qs.order_by("employee_id")

        # Total calendar days in reporting window
        total_days_in_period = max((end_date - start_date).days + 1, 1)
        # Approximate weekdays (Monday to Friday)
        cur = start_date
        weekdays_count = 0
        while cur <= end_date:
            if cur.weekday() < 5:
                weekdays_count += 1
            cur += timedelta(days=1)
        expected_working_days = max(weekdays_count, 1)

        productivity_records = []
        for emp in emp_qs:
            # 1. Task metrics
            tasks = Task.objects.filter(
                assignee=emp,
                is_archived=False,
                created_at__date__lte=end_date,
            )
            total_tasks = tasks.count()
            completed_tasks = tasks.filter(status=TaskStatus.COMPLETED).count()
            task_completion_rate = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0

            # On-time delivery rate
            # Completed tasks that were finished on or before due date (or had no due date)
            completed_with_due = tasks.filter(status=TaskStatus.COMPLETED, due_date__isnull=False)
            on_time_count = 0
            for t in completed_with_due:
                if t.due_date and t.updated_at.date() <= t.due_date:
                    on_time_count += 1
            # If no tasks had due dates, default to 100% on time if completed, or 0%
            if completed_with_due.count() > 0:
                on_time_rate = round((on_time_count / completed_with_due.count() * 100), 1)
            else:
                on_time_rate = 100.0 if completed_tasks > 0 else 0.0

            overdue_count = tasks.filter(due_date__lt=timezone.localdate()).exclude(
                status__in=[TaskStatus.COMPLETED, TaskStatus.CANCELLED]
            ).count()

            # Hours variance & efficiency
            total_est_hours = tasks.aggregate(s=Sum("estimated_hours"))["s"] or Decimal("0.00")
            total_act_hours = tasks.aggregate(s=Sum("actual_hours"))["s"] or Decimal("0.00")
            if total_act_hours > Decimal("0.00") and total_est_hours > Decimal("0.00"):
                # If actual <= estimated, efficiency is 100%. If actual > estimated, efficiency decreases
                ratio = float(total_est_hours / total_act_hours) * 100
                estimation_efficiency = round(min(ratio, 100.0), 1)
            elif total_tasks == 0:
                estimation_efficiency = 0.0
            else:
                estimation_efficiency = 100.0

            # 2. Attendance & work hours
            attendance_records = AttendanceRecord.objects.filter(
                employee=emp,
                date__gte=start_date,
                date__lte=end_date,
            )
            present_days = attendance_records.filter(status=AttendanceStatus.PRESENT).count()
            late_days = attendance_records.filter(status=AttendanceStatus.LATE).count()
            half_days = attendance_records.filter(status=AttendanceStatus.HALF_DAY).count()
            total_logged_hours = attendance_records.aggregate(s=Sum("work_duration_hours"))["s"] or Decimal("0.00")
            avg_daily_hours = round(float(total_logged_hours) / max(attendance_records.count(), 1), 2)

            # Approved leave days
            approved_leaves = LeaveRequest.objects.filter(
                employee=emp,
                status=LeaveStatus.APPROVED,
                start_date__lte=end_date,
                end_date__gte=start_date,
            )
            leave_days_taken = sum(float(l.duration_days) for l in approved_leaves)

            # Attendance reliability rate:
            # (present + 0.9 * late + 0.5 * half_day + approved_leaves) / expected_working_days
            effective_attended = (
                present_days
                + (0.9 * late_days)
                + (0.5 * half_days)
                + leave_days_taken
            )
            attendance_reliability = round(min((effective_attended / expected_working_days * 100), 100.0), 1)

            # 3. Balanced Composite Productivity Score:
            # Formula weights:
            # - Task Completion Rate: 40%
            # - On-Time Delivery Rate: 25%
            # - Attendance Reliability: 25%
            # - Estimation Efficiency: 10%
            composite_score = round(
                (task_completion_rate * 0.40)
                + (on_time_rate * 0.25)
                + (attendance_reliability * 0.25)
                + (estimation_efficiency * 0.10),
                1,
            )

            # Performance tier badge
            if composite_score >= 85:
                tier = "Exceptional"
            elif composite_score >= 70:
                tier = "High Performing"
            elif composite_score >= 50:
                tier = "Satisfactory"
            elif total_tasks == 0 and attendance_reliability >= 70:
                tier = "Active (No Tasks)"
            else:
                tier = "Needs Attention"

            productivity_records.append({
                "employee_id": emp.employee_id,
                "full_name": emp.full_name,
                "email": emp.email,
                "department": emp.department.name if emp.department else "Unassigned",
                "designation": emp.designation or "-",
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "task_completion_rate": task_completion_rate,
                "on_time_delivery_rate": on_time_rate,
                "overdue_tasks": overdue_count,
                "estimated_hours": float(total_est_hours),
                "actual_hours": float(total_act_hours),
                "hours_variance": round(float(total_act_hours - total_est_hours), 2),
                "estimation_efficiency": estimation_efficiency,
                "present_days": present_days,
                "late_days": late_days,
                "half_days": half_days,
                "total_logged_hours": round(float(total_logged_hours), 2),
                "avg_daily_hours": avg_daily_hours,
                "leave_days_taken": leave_days_taken,
                "attendance_reliability": attendance_reliability,
                "composite_productivity_score": composite_score,
                "performance_tier": tier,
            })

        # Sorting: default by composite_productivity_score descending
        ordering = request.query_params.get("ordering", "-composite_score")
        if ordering == "composite_score":
            productivity_records.sort(key=lambda x: x["composite_productivity_score"])
        elif ordering == "-composite_score":
            productivity_records.sort(key=lambda x: x["composite_productivity_score"], reverse=True)
        elif ordering == "employee_id":
            productivity_records.sort(key=lambda x: x["employee_id"])

        # Handle exports
        export_format = request.query_params.get("export", "").lower()
        if export_format in ["csv", "xlsx"]:
            headers = [
                "Employee ID", "Employee Name", "Department", "Designation",
                "Total Tasks", "Completed Tasks", "Task Completion Rate (%)",
                "On-Time Rate (%)", "Overdue Tasks", "Est. Hours", "Act. Hours",
                "Variance (h)", "Efficiency (%)", "Present Days", "Late Days",
                "Logged Hours (h)", "Avg Daily (h)", "Leaves (Days)",
                "Attendance Reliability (%)", "Composite Score", "Performance Tier"
            ]
            rows = []
            for item in productivity_records:
                rows.append([
                    item["employee_id"],
                    item["full_name"],
                    item["department"],
                    item["designation"],
                    item["total_tasks"],
                    item["completed_tasks"],
                    item["task_completion_rate"],
                    item["on_time_delivery_rate"],
                    item["overdue_tasks"],
                    item["estimated_hours"],
                    item["actual_hours"],
                    item["hours_variance"],
                    item["estimation_efficiency"],
                    item["present_days"],
                    item["late_days"],
                    item["total_logged_hours"],
                    item["avg_daily_hours"],
                    item["leave_days_taken"],
                    item["attendance_reliability"],
                    item["composite_productivity_score"],
                    item["performance_tier"],
                ])

            metadata = {
                "Report": "Productivity & Multi-Factor Performance Summary",
                "Period": period_label,
                "Generated By": user.email,
                "Generated At": timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
                "Calculation Note": "Balanced index: 40% Task Completion + 25% On-Time Delivery + 25% Attendance Reliability + 10% Estimation Efficiency. Simple task counts are explicitly avoided.",
                "Total Employees Evaluated": len(rows),
            }

            if export_format == "csv":
                return generate_csv_response("emwts_productivity_report", headers, rows, metadata)
            return generate_excel_response("emwts_productivity_report", "Productivity", headers, rows, metadata)

        # JSON response with pagination
        page = request.query_params.get("page", 1)
        page_size = min(int(request.query_params.get("page_size", 15)), 100)
        paginator = Paginator(productivity_records, page_size)
        try:
            page_obj = paginator.page(page)
        except Exception:
            page_obj = paginator.page(1)

        # Averages for summary header
        total_eval = len(productivity_records)
        avg_score = round(sum(p["composite_productivity_score"] for p in productivity_records) / total_eval, 1) if total_eval > 0 else 0.0
        avg_completion = round(sum(p["task_completion_rate"] for p in productivity_records) / total_eval, 1) if total_eval > 0 else 0.0
        avg_on_time = round(sum(p["on_time_delivery_rate"] for p in productivity_records) / total_eval, 1) if total_eval > 0 else 0.0
        avg_att = round(sum(p["attendance_reliability"] for p in productivity_records) / total_eval, 1) if total_eval > 0 else 0.0

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_obj.number,
            "page_size": page_size,
            "reporting_period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "label": period_label,
            },
            "definitions": PRODUCTIVITY_DEFINITIONS,
            "summary": {
                "total_employees_evaluated": total_eval,
                "average_composite_score": avg_score,
                "average_task_completion_rate": avg_completion,
                "average_on_time_delivery_rate": avg_on_time,
                "average_attendance_reliability": avg_att,
            },
            "results": list(page_obj.object_list),
        })
