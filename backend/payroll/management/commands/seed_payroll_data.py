from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from employees.models import Employee, EmploymentStatus
from payroll.models import PayrollRun, PayrollStatus, SalaryStructure
from payroll.services import run_monthly_payroll


class Command(BaseCommand):
    help = "Seeds standard Indian CTC salary structures and executes an initial monthly payroll run for SSKATT EWTS."

    def handle(self, *args, **options):
        self.stdout.write("Configuring Indian Corporate Salary Structures for SSKATT EWTS workforce...")

        employees = Employee.objects.filter(is_archived=False, status=EmploymentStatus.ACTIVE)
        if not employees.exists():
            self.stdout.write(self.style.WARNING("No active employees found to seed payroll structures for."))
            return

        # Salary profiles based on seniority/role
        ctc_tiers = {
            "Lead": Decimal("1800000.00"),       # ₹18 LPA
            "Senior": Decimal("1320000.00"),     # ₹13.2 LPA
            "Engineer": Decimal("960000.00"),    # ₹9.6 LPA
            "Developer": Decimal("840000.00"),   # ₹8.4 LPA
            "Specialist": Decimal("720000.00"),  # ₹7.2 LPA
            "Default": Decimal("600000.00"),     # ₹6.0 LPA
        }

        seeded_count = 0
        for emp in employees:
            desig = emp.designation or ""
            matched_ctc = ctc_tiers["Default"]
            for key, ctc in ctc_tiers.items():
                if key.lower() in desig.lower():
                    matched_ctc = ctc
                    break

            monthly_ctc = (matched_ctc / Decimal("12")).quantize(Decimal("0.01"))
            basic = (monthly_ctc * Decimal("0.50")).quantize(Decimal("0.01"))
            hra = (basic * Decimal("0.40")).quantize(Decimal("0.01"))
            pf = Decimal("1800.00")
            pt = Decimal("200.00")
            special = monthly_ctc - (basic + hra)
            tds = Decimal("1500.00") if monthly_ctc > Decimal("70000.00") else Decimal("500.00")

            struct, created = SalaryStructure.objects.update_or_create(
                employee=emp,
                defaults={
                    "annual_ctc": matched_ctc,
                    "basic_salary": basic,
                    "hra": hra,
                    "special_allowance": max(Decimal("0.00"), special),
                    "provident_fund": pf,
                    "professional_tax": pt,
                    "tds": tds,
                    "is_active": True,
                }
            )
            # Sync employee base_salary on employee profile
            emp.base_salary = basic
            emp.save(update_fields=["base_salary"])
            seeded_count += 1
            self.stdout.write(f"  * {emp.employee_id} ({emp.user.get_full_name()}): INR {matched_ctc:,.2f} CTC / Basic INR {basic:,.2f}")

        self.stdout.write(self.style.SUCCESS(f"Configured {seeded_count} employee salary structures."))

        # Process October 2026 Payroll Run
        self.stdout.write("Executing initial October 2026 payroll run...")
        today = timezone.localdate()
        run = run_monthly_payroll(year=today.year, month=today.month, notes="Initial standard corporate run for SSKATT EWTS")
        self.stdout.write(self.style.SUCCESS(
            f"Successfully created Payroll Run for {run.month:02d}/{run.year}: "
            f"{run.total_employees} payslips generated | Total Gross: INR {run.total_gross:,.2f} | Net: INR {run.total_net:,.2f}"
        ))
