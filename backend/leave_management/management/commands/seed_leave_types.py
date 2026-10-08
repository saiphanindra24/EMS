from decimal import Decimal
from django.core.management.base import BaseCommand
from leave_management.models import LeaveType

DEFAULT_LEAVE_TYPES = [
    {
        "name": "Annual Leave",
        "code": "ANNUAL",
        "description": "Standard paid vacation days for employees.",
        "is_paid": True,
        "requires_approval": True,
        "annual_allowance": Decimal("18.0"),
    },
    {
        "name": "Sick Leave",
        "code": "SICK",
        "description": "Paid leave for personal illness, medical appointments, or recovery.",
        "is_paid": True,
        "requires_approval": True,
        "annual_allowance": Decimal("12.0"),
    },
    {
        "name": "Casual Leave",
        "code": "CASUAL",
        "description": "Short paid leave for unforeseen personal or family matters.",
        "is_paid": True,
        "requires_approval": True,
        "annual_allowance": Decimal("6.0"),
    },
    {
        "name": "Unpaid Leave",
        "code": "UNPAID",
        "description": "Approved absence without pay when paid allowances are exhausted.",
        "is_paid": False,
        "requires_approval": True,
        "annual_allowance": None,
    },
    {
        "name": "Parental Leave",
        "code": "PARENTAL",
        "description": "Maternity and paternity leave for newborn care and family bonding.",
        "is_paid": True,
        "requires_approval": True,
        "annual_allowance": Decimal("90.0"),
    },
    {
        "name": "Bereavement Leave",
        "code": "BEREAVEMENT",
        "description": "Compassionate leave following the loss of an immediate family member.",
        "is_paid": True,
        "requires_approval": True,
        "annual_allowance": Decimal("5.0"),
    },
]


class Command(BaseCommand):
    help = "Seeds standard initial leave types into the database."

    def handle(self, *args, **options):
        created_count = 0
        for item in DEFAULT_LEAVE_TYPES:
            obj, created = LeaveType.objects.get_or_create(
                code=item["code"],
                defaults={
                    "name": item["name"],
                    "description": item["description"],
                    "is_paid": item["is_paid"],
                    "requires_approval": item["requires_approval"],
                    "annual_allowance": item["annual_allowance"],
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created leave type: {obj.name} ({obj.code})"))
            else:
                self.stdout.write(f"Leave type already exists: {obj.name} ({obj.code})")

        self.stdout.write(self.style.SUCCESS(f"Done. {created_count} leave types created."))

        # 2. Seed Leave Balances for all active employees
        from datetime import timedelta
        from django.utils import timezone
        from employees.models import Employee
        from leave_management.models import LeaveBalance, LeaveRequest, LeaveStatus

        current_year = timezone.now().year
        employees = Employee.objects.filter(status="ACTIVE")
        balance_count = 0

        for emp in employees:
            for lt in LeaveType.objects.filter(is_active=True):
                if lt.annual_allowance:
                    _, b_created = LeaveBalance.objects.get_or_create(
                        employee=emp,
                        leave_type=lt,
                        year=current_year,
                        defaults={
                            "allocated_days": lt.annual_allowance,
                            "used_days": Decimal("0.0"),
                            "pending_days": Decimal("0.0"),
                        },
                    )
                    if b_created:
                        balance_count += 1

        if balance_count > 0:
            self.stdout.write(self.style.SUCCESS(f"Initialized {balance_count} leave balance allowances for employees."))

        # 3. Seed realistic sample leave requests if none exist
        if not LeaveRequest.objects.exists():
            today = timezone.localdate()
            annual_lt = LeaveType.objects.filter(code="ANNUAL").first()
            sick_lt = LeaveType.objects.filter(code="SICK").first()
            casual_lt = LeaveType.objects.filter(code="CASUAL").first()

            emp_ananya = Employee.objects.filter(employee_id="EMP-004").first()
            emp_arjun = Employee.objects.filter(employee_id="EMP-005").first()
            emp_sneha = Employee.objects.filter(employee_id="EMP-006").first()

            if emp_ananya and annual_lt:
                start_d = today + timedelta(days=7)
                end_d = today + timedelta(days=9)
                req = LeaveRequest.objects.create(
                    employee=emp_ananya,
                    leave_type=annual_lt,
                    start_date=start_d,
                    end_date=end_d,
                    duration_days=Decimal("3.0"),
                    reason="Family annual vacation trip.",
                    status=LeaveStatus.PENDING,
                )
                # Update pending balance
                bal = LeaveBalance.objects.filter(employee=emp_ananya, leave_type=annual_lt, year=current_year).first()
                if bal:
                    bal.pending_days += Decimal("3.0")
                    bal.save(update_fields=["pending_days"])
                self.stdout.write(f"  Created pending leave request for {emp_ananya.full_name} (#{req.id})")

            if emp_arjun and casual_lt:
                start_d = today + timedelta(days=14)
                end_d = today + timedelta(days=15)
                req = LeaveRequest.objects.create(
                    employee=emp_arjun,
                    leave_type=casual_lt,
                    start_date=start_d,
                    end_date=end_d,
                    duration_days=Decimal("2.0"),
                    reason="Personal family commitment.",
                    status=LeaveStatus.APPROVED,
                    reviewed_at=timezone.now(),
                )
                bal = LeaveBalance.objects.filter(employee=emp_arjun, leave_type=casual_lt, year=current_year).first()
                if bal:
                    bal.used_days += Decimal("2.0")
                    bal.save(update_fields=["used_days"])
                self.stdout.write(f"  Created approved leave request for {emp_arjun.full_name} (#{req.id})")

            if emp_sneha and sick_lt:
                start_d = today - timedelta(days=3)
                end_d = today - timedelta(days=3)
                req = LeaveRequest.objects.create(
                    employee=emp_sneha,
                    leave_type=sick_lt,
                    start_date=start_d,
                    end_date=end_d,
                    duration_days=Decimal("1.0"),
                    reason="Medical checkup and recovery.",
                    status=LeaveStatus.APPROVED,
                    reviewed_at=timezone.now(),
                )
                bal = LeaveBalance.objects.filter(employee=emp_sneha, leave_type=sick_lt, year=current_year).first()
                if bal:
                    bal.used_days += Decimal("1.0")
                    bal.save(update_fields=["used_days"])
                self.stdout.write(f"  Created approved leave request for {emp_sneha.full_name} (#{req.id})")

            self.stdout.write(self.style.SUCCESS("Successfully seeded sample leave requests."))
