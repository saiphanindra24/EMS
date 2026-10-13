from datetime import datetime, time, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Role
from attendance.models import AttendanceRecord, AttendanceStatus, WorkSchedule
from chat.models import Message
from employees.models import Department, Employee
from leave_management.models import LeaveRequest, LeaveStatus, LeaveType
from notifications.models import Notification, NotificationType
from tasks.models import Task, TaskPriority, TaskStatus

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds real, production-like live workplace activity (attendance punches, leaves, notifications, and team messages)."

    def handle(self, *args, **options):
        self.stdout.write("Seeding live workplace attendance, leave requests, notifications, and chats...")

        with transaction.atomic():
            admin_user = User.objects.filter(role=Role.SUPER_ADMIN).first()
            hr_user = User.objects.filter(role=Role.HR_ADMIN).first()
            manager_user = User.objects.filter(role=Role.MANAGER).first()

            all_employees = list(Employee.objects.select_related("user").filter(is_archived=False))
            if not all_employees:
                self.stderr.write("No employees found. Please run seed_employees first.")
                return

            today = timezone.localdate()
            now = timezone.now()

            # Ensure Work Schedule
            WorkSchedule.objects.get_or_create(
                is_default=True,
                defaults={
                    "name": "Standard Corporate Schedule",
                    "work_start_time": time(9, 0),
                    "work_end_time": time(18, 0),
                    "grace_period_minutes": 15,
                    "half_day_minimum_hours": Decimal("4.00"),
                    "full_day_minimum_hours": Decimal("8.00"),
                },
            )

            # Ensure Leave Types
            annual_type = LeaveType.objects.filter(code="ANNUAL").first()
            sick_type = LeaveType.objects.filter(code="SICK").first()
            casual_type = LeaveType.objects.filter(code="CASUAL").first()

            if not annual_type:
                annual_type, _ = LeaveType.objects.get_or_create(
                    code="ANNUAL",
                    defaults={"name": "Annual Leave", "annual_allowance": Decimal("18.0"), "is_paid": True},
                )
            if not sick_type:
                sick_type, _ = LeaveType.objects.get_or_create(
                    code="SICK",
                    defaults={"name": "Sick Leave", "annual_allowance": Decimal("12.0"), "is_paid": True},
                )
            if not casual_type:
                casual_type, _ = LeaveType.objects.get_or_create(
                    code="CASUAL",
                    defaults={"name": "Casual Leave", "annual_allowance": Decimal("6.0"), "is_paid": True},
                )

            # ── 1. Leave Requests ──
            emp_sneha = next((e for e in all_employees if e.employee_id == "EMP-006"), None)
            emp_arjun = next((e for e in all_employees if e.employee_id == "EMP-005"), None)
            emp_vikram = next((e for e in all_employees if e.employee_id == "EMP-007"), None)
            emp_ananya = next((e for e in all_employees if e.employee_id == "EMP-004"), None)

            if emp_sneha and annual_type:
                LeaveRequest.objects.update_or_create(
                    employee=emp_sneha,
                    start_date=today,
                    defaults={
                        "leave_type": annual_type,
                        "end_date": today + timedelta(days=1),
                        "duration_days": Decimal("2.0"),
                        "reason": "Family vacation & personal wellness time off.",
                        "status": LeaveStatus.APPROVED,
                        "reviewed_by": hr_user,
                        "reviewed_at": now - timedelta(days=2),
                    },
                )

            if emp_arjun and sick_type:
                LeaveRequest.objects.update_or_create(
                    employee=emp_arjun,
                    start_date=today - timedelta(days=3),
                    defaults={
                        "leave_type": sick_type,
                        "end_date": today - timedelta(days=3),
                        "duration_days": Decimal("1.0"),
                        "reason": "Doctor appointment and viral recovery.",
                        "status": LeaveStatus.APPROVED,
                        "reviewed_by": manager_user,
                        "reviewed_at": now - timedelta(days=3),
                    },
                )

            if emp_vikram and casual_type:
                LeaveRequest.objects.update_or_create(
                    employee=emp_vikram,
                    start_date=today + timedelta(days=3),
                    defaults={
                        "leave_type": casual_type,
                        "end_date": today + timedelta(days=3),
                        "duration_days": Decimal("1.0"),
                        "reason": "Attending university graduation ceremony.",
                        "status": LeaveStatus.PENDING,
                    },
                )

            # ── 2. Today's Attendance Punches ──
            # Target realistic breakdown:
            # - EMP-001 (Admin): Check-in 08:52 AM (PRESENT)
            # - EMP-002 (Priya): Check-in 09:02 AM (PRESENT)
            # - EMP-003 (Rahul): Check-in 08:48 AM (PRESENT)
            # - EMP-004 (Ananya): Check-in 09:10 AM (PRESENT)
            # - EMP-005 (Arjun): Check-in 09:32 AM (LATE - after 9:15 grace period)
            # - EMP-006 (Sneha): ON_LEAVE
            # - EMP-007 (Vikram): Check-in 09:04 AM (PRESENT)
            tz = timezone.get_current_timezone()

            punches_today = [
                ("EMP-001", time(8, 52), None, AttendanceStatus.PRESENT, "Morning punch from HQ Desk 1"),
                ("EMP-002", time(9, 2), None, AttendanceStatus.PRESENT, "HQ Reception check-in"),
                ("EMP-003", time(8, 48), None, AttendanceStatus.PRESENT, "Engineering wing biometric scanner"),
                ("EMP-004", time(9, 10), None, AttendanceStatus.PRESENT, "Remote VPN check-in"),
                ("EMP-005", time(9, 32), None, AttendanceStatus.LATE, "Subway delay notification recorded"),
                ("EMP-006", None, None, AttendanceStatus.ON_LEAVE, "Approved annual leave"),
                ("EMP-007", time(9, 4), None, AttendanceStatus.PRESENT, "Marketing floor check-in"),
            ]

            for emp_code, in_time, out_time, att_status, note in punches_today:
                emp = next((e for e in all_employees if e.employee_id == emp_code), None)
                if not emp:
                    continue

                check_in_dt = timezone.make_aware(datetime.combine(today, in_time), tz) if in_time else None
                check_out_dt = timezone.make_aware(datetime.combine(today, out_time), tz) if out_time else None

                rec, created = AttendanceRecord.objects.update_or_create(
                    employee=emp,
                    date=today,
                    defaults={
                        "check_in": check_in_dt,
                        "check_out": check_out_dt,
                        "status": att_status,
                        "notes": note,
                        "ip_address": "192.168.1.104",
                    },
                )
                rec.calculate_duration()
                rec.save()

            # ── 3. Past 5 Days Attendance History for Analytics & Trends ──
            for days_ago in range(1, 6):
                hist_date = today - timedelta(days=days_ago)
                if hist_date.weekday() >= 5:  # Skip weekends (Saturday/Sunday)
                    continue

                for emp in all_employees:
                    # Provide 8h to 8.5h full work sessions
                    start_t = time(8, 45 + (emp.id % 10))
                    end_t = time(17, 30 + (emp.id % 20))
                    c_in = timezone.make_aware(datetime.combine(hist_date, start_t), tz)
                    c_out = timezone.make_aware(datetime.combine(hist_date, end_t), tz)

                    rec, _ = AttendanceRecord.objects.update_or_create(
                        employee=emp,
                        date=hist_date,
                        defaults={
                            "check_in": c_in,
                            "check_out": c_out,
                            "status": AttendanceStatus.PRESENT,
                            "notes": "Verified badge punch",
                            "ip_address": "192.168.1.100",
                        },
                    )
                    rec.calculate_duration()
                    rec.save()

            # ── 4. Live Notifications for Admin & Team ──
            if admin_user:
                notifs = [
                    (
                        NotificationType.LEAVE_SUBMITTED,
                        "New Leave Request Awaiting Review",
                        "Vikram Singh requested 1.0 day of Casual Leave starting in 3 days.",
                        "/leaves",
                    ),
                    (
                        NotificationType.TASK_ASSIGNED,
                        "Sprint 42 Deliverable Updated",
                        "Ananya Rao pushed progress (65%) to 'Build Dynamic Kanban & Task Board UI'.",
                        "/tasks",
                    ),
                    (
                        NotificationType.ANNOUNCEMENT,
                        "Quarterly Security Compliance Review",
                        "Multi-factor authentication (MFA/2FA) and audit trails active across workspace.",
                        "/settings",
                    ),
                ]
                for n_type, title, msg, url in notifs:
                    Notification.objects.get_or_create(
                        recipient=admin_user,
                        title=title,
                        defaults={
                            "actor": manager_user or admin_user,
                            "notification_type": n_type,
                            "message": msg,
                            "target_url": url,
                            "is_read": False,
                        },
                    )

            # ── 5. Live Standup Chat Messages in #daily-scrum ──
            chat_seed = [
                (admin_user, "daily-scrum", "Good morning everyone! Reminder: Sprint 42 demo call is scheduled for this Friday."),
                (manager_user, "daily-scrum", "Morning! Backend indexing and database connection pooling deployed to staging. Ready for load test."),
                (getattr(emp_ananya, "user", None), "daily-scrum", "Morning team! Completed the responsive Kanban view and filters. Now polishing the calendar sync."),
                (getattr(emp_arjun, "user", None), "daily-scrum", "Morning! Running through query benchmarks. Avg response time down to 18ms."),
            ]

            for sender, room, text in chat_seed:
                if sender:
                    Message.objects.get_or_create(
                        room=room,
                        sender=sender,
                        content=text,
                        defaults={
                            "sender_name": sender.full_name or sender.email,
                            "sender_initials": f"{sender.first_name[:1]}{sender.last_name[:1]}" if sender.first_name and sender.last_name else "EM",
                        },
                    )

        self.stdout.write(self.style.SUCCESS("Successfully seeded real workplace attendance, leaves, notifications, and team activity."))
