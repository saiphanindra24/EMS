from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from employees.models import Employee
from expenses.models import (
    ExpenseCategory,
    ExpenseClaim,
    ExpenseStatus,
    PaymentMethod,
)
from projects.models import Project

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds standard corporate expense claims, multi-tier approvals, and reimbursements."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Expense Claims & Reimbursements for SSKATT EWTS...")

        admin_user = (
            User.objects.filter(role="SUPER_ADMIN").first()
            or User.objects.filter(is_superuser=True).first()
            or User.objects.first()
        )
        hr_user = (
            User.objects.filter(role="HR_ADMIN").first()
            or admin_user
        )

        emp_list = list(Employee.objects.filter(is_archived=False).order_by("employee_id")[:5])
        if not emp_list:
            self.stdout.write(self.style.WARNING("No employees found to seed expense claims for."))
            return

        emp_arjun = emp_list[0]
        emp_second = emp_list[1] if len(emp_list) > 1 else emp_arjun
        emp_third = emp_list[2] if len(emp_list) > 2 else emp_arjun

        prj_101 = Project.objects.filter(code="PRJ-101").first()
        prj_102 = Project.objects.filter(code="PRJ-102").first()

        today = timezone.localdate()

        seed_claims = [
            {
                "claim_number": "EXP-2026-001",
                "employee": emp_arjun,
                "title": "Client Onsite Workshop - Flight & Hotel Accommodations",
                "category": ExpenseCategory.TRAVEL,
                "expense_date": today - timedelta(days=12),
                "currency": "INR",
                "amount": Decimal("18500.00"),
                "tax_amount": Decimal("2220.00"),
                "is_billable": True,
                "project": prj_101,
                "receipt_url": "https://images.unsplash.com/photo-1554415707-9e4426dca254?w=600&auto=format&fit=crop&q=80",
                "description": "Roundtrip flights to Bengaluru and hotel stay for client architecture walkthrough.",
                "status": ExpenseStatus.REIMBURSED,
                "manager_reviewed_by": admin_user,
                "manager_reviewed_at": timezone.now() - timedelta(days=10),
                "manager_notes": "Approved. Directly chargeable to VolkssKatt Global client project.",
                "finance_reviewed_by": hr_user,
                "finance_reviewed_at": timezone.now() - timedelta(days=9),
                "finance_notes": "Verified against airline invoice. Processed via direct NEFT transfer.",
                "payment_method": PaymentMethod.NEFT_UPI,
                "transaction_reference": "NEFT/ICICI/84920194829",
                "reimbursed_at": timezone.now() - timedelta(days=9),
            },
            {
                "claim_number": "EXP-2026-002",
                "employee": emp_second,
                "title": "AWS High-Performance Load Testing Infrastructure",
                "category": ExpenseCategory.SOFTWARE,
                "expense_date": today - timedelta(days=6),
                "currency": "INR",
                "amount": Decimal("4800.00"),
                "tax_amount": Decimal("864.00"),
                "is_billable": True,
                "project": prj_102,
                "receipt_url": "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80",
                "description": "On-demand EC2 GPU instances for stress testing payment gateway throughput.",
                "status": ExpenseStatus.FINANCE_APPROVED,
                "manager_reviewed_by": admin_user,
                "manager_reviewed_at": timezone.now() - timedelta(days=4),
                "manager_notes": "Validated. Load testing was necessary for Phase 2 readiness.",
                "finance_reviewed_by": hr_user,
                "finance_reviewed_at": timezone.now() - timedelta(days=2),
                "finance_notes": "Authorized for payout in this Friday's settlement cycle.",
                "payment_method": PaymentMethod.DIRECT_DEPOSIT,
                "transaction_reference": "",
                "reimbursed_at": None,
            },
            {
                "claim_number": "EXP-2026-003",
                "employee": emp_third,
                "title": "Sprint 14 Team Working Dinner & Pizza",
                "category": ExpenseCategory.MEALS,
                "expense_date": today - timedelta(days=3),
                "currency": "INR",
                "amount": Decimal("2450.00"),
                "tax_amount": Decimal("122.50"),
                "is_billable": False,
                "project": None,
                "receipt_url": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
                "description": "Dinner for 5 engineers during scheduled release deployment window.",
                "status": ExpenseStatus.MANAGER_APPROVED,
                "manager_reviewed_by": admin_user,
                "manager_reviewed_at": timezone.now() - timedelta(days=1),
                "manager_notes": "Approved under Engineering Overtime Meal policy.",
                "finance_reviewed_by": None,
                "finance_reviewed_at": None,
                "finance_notes": "",
                "payment_method": "",
                "transaction_reference": "",
                "reimbursed_at": None,
            },
            {
                "claim_number": "EXP-2026-004",
                "employee": emp_arjun,
                "title": "Certified Kubernetes Application Developer (CKAD) Exam Voucher",
                "category": ExpenseCategory.TRAINING,
                "expense_date": today - timedelta(days=2),
                "currency": "INR",
                "amount": Decimal("14500.00"),
                "tax_amount": Decimal("2610.00"),
                "is_billable": False,
                "project": None,
                "receipt_url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=80",
                "description": "Official Linux Foundation CKAD certification voucher under annual learning allowance.",
                "status": ExpenseStatus.SUBMITTED,
                "manager_reviewed_by": None,
                "manager_reviewed_at": None,
                "manager_notes": "",
                "finance_reviewed_by": None,
                "finance_reviewed_at": None,
                "finance_notes": "",
                "payment_method": "",
                "transaction_reference": "",
                "reimbursed_at": None,
            },
            {
                "claim_number": "EXP-2026-005",
                "employee": emp_second,
                "title": "Ergonomic Mechanical Keyboard & Wrist Rest",
                "category": ExpenseCategory.SUPPLIES,
                "expense_date": today - timedelta(days=1),
                "currency": "INR",
                "amount": Decimal("3800.00"),
                "tax_amount": Decimal("684.00"),
                "is_billable": False,
                "project": None,
                "receipt_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80",
                "description": "Home office ergonomic accessories under hardware reimbursement stipend.",
                "status": ExpenseStatus.SUBMITTED,
                "manager_reviewed_by": None,
                "manager_reviewed_at": None,
                "manager_notes": "",
                "finance_reviewed_by": None,
                "finance_reviewed_at": None,
                "finance_notes": "",
                "payment_method": "",
                "transaction_reference": "",
                "reimbursed_at": None,
            },
            {
                "claim_number": "EXP-2026-006",
                "employee": emp_third,
                "title": "Airport Taxi Cab & Highway Tolls",
                "category": ExpenseCategory.COMMUTE,
                "expense_date": today - timedelta(days=8),
                "currency": "INR",
                "amount": Decimal("1250.00"),
                "tax_amount": Decimal("0.00"),
                "is_billable": True,
                "project": prj_101,
                "receipt_url": "",
                "description": "Ola Corporate cab receipt to Kempegowda International Airport.",
                "status": ExpenseStatus.REJECTED,
                "manager_reviewed_by": admin_user,
                "manager_reviewed_at": timezone.now() - timedelta(days=7),
                "manager_notes": "Please re-upload a clear PDF invoice showing GST registration number instead of SMS screenshot.",
                "finance_reviewed_by": None,
                "finance_reviewed_at": None,
                "finance_notes": "",
                "payment_method": "",
                "transaction_reference": "",
                "reimbursed_at": None,
            },
        ]

        count = 0
        for item in seed_claims:
            c_num = item.pop("claim_number")
            emp = item.pop("employee")
            ExpenseClaim.objects.update_or_create(
                claim_number=c_num,
                defaults={"employee": emp, **item}
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {count} expense claims across multiple approval stages."))
