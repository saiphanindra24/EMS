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
