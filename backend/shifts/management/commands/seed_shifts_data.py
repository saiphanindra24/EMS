from datetime import time, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from employees.models import Employee
from shifts.models import ShiftTemplate, ShiftRoster, ShiftSwapRequest, OvertimeRecord

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds realistic Shift Templates, Rosters, Peer Swap Requests, and Overtime Records for SSKATT EWTS."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Shift Scheduling, Roster & Overtime Data for SSKATT EWTS...")

        today = timezone.localdate()
        admin_user = (
            User.objects.filter(role="SUPER_ADMIN").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )

        emp_records = list(Employee.objects.filter(is_archived=False).select_related("user").order_by("employee_id")[:6])
        users = [e.user for e in emp_records if e.user]
        if not users:
            users = list(User.objects.all()[:4])

        # 1. Standard Shift Templates
        templates_data = [
            {
                "code": "SHIFT_A",
                "name": "Morning Shift (A)",
                "start_time": time(6, 0),
                "end_time": time(14, 30),
                "grace_period_minutes": 15,
                "break_duration_minutes": 45,
                "is_night_shift": False,
                "color_code": "#00ffcc",
                "description": "Early morning industrial & support operations window.",
            },
            {
                "code": "SHIFT_GEN",
                "name": "General Standard (G)",
                "start_time": time(9, 0),
                "end_time": time(18, 0),
                "grace_period_minutes": 15,
                "break_duration_minutes": 60,
                "is_night_shift": False,
                "color_code": "#38bdf8",
                "description": "Corporate headquarters & engineering daylight core hours.",
            },
            {
                "code": "SHIFT_B",
                "name": "Evening Swing (B)",
                "start_time": time(14, 0),
                "end_time": time(22, 30),
                "grace_period_minutes": 15,
                "break_duration_minutes": 45,
                "is_night_shift": False,
                "color_code": "#f59e0b",
                "description": "Mid-day overlap and evening handover operational tier.",
            },
            {
                "code": "SHIFT_C",
                "name": "Night Graveyard (C)",
                "start_time": time(22, 0),
                "end_time": time(6, 30),
                "grace_period_minutes": 15,
                "break_duration_minutes": 45,
                "is_night_shift": True,
                "color_code": "#a855f7",
                "description": "Overnight infrastructure monitoring and continuous integration shifts.",
            },
            {
                "code": "SHIFT_OC",
                "name": "Weekend Standby (OC)",
                "start_time": time(8, 0),
                "end_time": time(20, 0),
                "grace_period_minutes": 30,
                "break_duration_minutes": 60,
                "is_night_shift": False,
                "color_code": "#ec4899",
                "description": "On-call rapid incident escalation and site standby team.",
            },
        ]

        created_templates = {}
        for t_info in templates_data:
            tmpl, _ = ShiftTemplate.objects.update_or_create(
                code=t_info["code"],
                defaults=t_info
            )
            created_templates[tmpl.code] = tmpl

        self.stdout.write(f"[OK] Seeded {len(created_templates)} shift templates.")

        # 2. Roster Assignments for the current 14-day window using fast bulk_create
        roster_cycle = [
            created_templates["SHIFT_GEN"],
            created_templates["SHIFT_A"],
            created_templates["SHIFT_B"],
            created_templates["SHIFT_C"],
            created_templates["SHIFT_GEN"],
        ]

        # Clear existing roster for clean idempotent seed
        ShiftRoster.objects.filter(
            date__range=[today - timedelta(days=3), today + timedelta(days=10)]
        ).delete()

        roster_objects = []
        for day_offset in range(-3, 11):
            curr_date = today + timedelta(days=day_offset)
            if curr_date.weekday() == 6:
                continue

            for idx, user in enumerate(users):
                chosen_shift = roster_cycle[(idx + day_offset) % len(roster_cycle)]
                if curr_date.weekday() == 5 and idx % 2 == 1:
                    chosen_shift = created_templates["SHIFT_OC"]

                roster_objects.append(
                    ShiftRoster(
                        employee=user,
                        shift=chosen_shift,
                        date=curr_date,
                        status=ShiftRoster.Status.COMPLETED if day_offset < 0 else ShiftRoster.Status.SCHEDULED,
                        is_published=True,
                        notes=f"Standard roster cycle rotation for {curr_date.strftime('%A')}",
                        assigned_by=admin_user,
                    )
                )

        created_rosters = ShiftRoster.objects.bulk_create(roster_objects)
        self.stdout.write(f"[OK] Provisioned {len(created_rosters)} shift roster assignments via bulk_create.")

        # 3. Shift Swap Requests
        if len(users) >= 2:
            u1 = users[0]
            u2 = users[1]

            u1_future_roster = ShiftRoster.objects.filter(employee=u1, date__gt=today).first()
            u2_future_roster = ShiftRoster.objects.filter(employee=u2, date__gt=today).first()

            if u1_future_roster and u2_future_roster:
                ShiftSwapRequest.objects.get_or_create(
                    requester=u1,
                    requester_assignment=u1_future_roster,
                    target_employee=u2,
                    target_assignment=u2_future_roster,
                    defaults={
                        "reason": "Doctor appointment during morning hours; requesting evening shift exchange with peer.",
                        "target_status": ShiftSwapRequest.TargetStatus.ACCEPTED,
                        "manager_status": ShiftSwapRequest.ManagerStatus.PENDING,
                        "manager_notes": "",
                    }
                )
                self.stdout.write("[OK] Seeded peer-to-peer shift swap request (Accepted by peer, pending manager).")

            u1_another = ShiftRoster.objects.filter(employee=u1, date__gte=today + timedelta(days=4)).first()
            if u1_another:
                ShiftSwapRequest.objects.get_or_create(
                    requester=u1,
                    requester_assignment=u1_another,
                    target_employee=None,
                    target_assignment=None,
                    defaults={
                        "reason": "Family weekend commitment; open for any peer in engineering to swap with compensatory off.",
                        "target_status": ShiftSwapRequest.TargetStatus.PENDING,
                        "manager_status": ShiftSwapRequest.ManagerStatus.PENDING,
                    }
                )
                self.stdout.write("[OK] Seeded open department pool swap request.")

        # 4. Overtime Records
        if users:
            OvertimeRecord.objects.get_or_create(
                employee=users[0],
                date=today - timedelta(days=2),
                defaults={
                    "start_time": time(18, 0),
                    "end_time": time(20, 30),
                    "hours": Decimal("2.50"),
                    "rate_multiplier": Decimal("1.50"),
                    "project_code": "PRJ-VOLKS-01",
                    "reason": "Critical production release deployment and end-to-end smoke testing.",
                    "status": OvertimeRecord.Status.APPROVED,
                    "approver": admin_user,
                    "approver_notes": "Authorized by Engineering Lead for Sprint 14 release.",
                }
            )

            OvertimeRecord.objects.get_or_create(
                employee=users[0],
                date=today - timedelta(days=1),
                defaults={
                    "start_time": time(18, 0),
                    "end_time": time(21, 0),
                    "hours": Decimal("3.00"),
                    "rate_multiplier": Decimal("1.50"),
                    "project_code": "PRJ-INFRA-09",
                    "reason": "Emergency Kubernetes cluster node patching and security audit.",
                    "status": OvertimeRecord.Status.PENDING,
                }
            )

            if len(users) > 1:
                OvertimeRecord.objects.get_or_create(
                    employee=users[1],
                    date=today - timedelta(days=4),
                    defaults={
                        "start_time": time(10, 0),
                        "end_time": time(14, 0),
                        "hours": Decimal("4.00"),
                        "rate_multiplier": Decimal("2.00"),
                        "project_code": "PRJ-VOLKS-02",
                        "reason": "Weekend data center migration drill and disaster recovery sync.",
                        "status": OvertimeRecord.Status.PAID,
                        "approver": admin_user,
                        "approver_notes": "Approved for 2.0x weekend multiplier pay in Oct payroll.",
                    }
                )

            self.stdout.write("[OK] Seeded realistic overtime records (Approved, Pending, Paid).")

        self.stdout.write(self.style.SUCCESS("[OK] Successfully seeded all Shift & Overtime data for Milestone 6!"))
