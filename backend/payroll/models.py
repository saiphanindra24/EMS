from decimal import Decimal
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from employees.models import Employee


class PayrollStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PROCESSING = "PROCESSING", "Processing"
    APPROVED = "APPROVED", "Approved"
    PAID = "PAID", "Disbursed / Paid"
    CANCELLED = "CANCELLED", "Cancelled"


class PayslipStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    GENERATED = "GENERATED", "Generated"
    PAID = "PAID", "Paid"
    CANCELLED = "CANCELLED", "Cancelled"


class PaymentMethod(models.TextChoices):
    BANK_TRANSFER = "BANK_TRANSFER", "Bank NEFT / RTGS"
    DIRECT_DEPOSIT = "DIRECT_DEPOSIT", "Direct Deposit"
    UPI = "UPI", "UPI Transfer"
    CHEQUE = "CHEQUE", "Company Cheque"


class SalaryStructure(models.Model):
    """
    Standard Indian Corporate CTC & Salary Components breakdown per employee.
    Annual CTC = (Monthly Basic + Monthly HRA + Monthly Special Allowance + Monthly PF Contribution) * 12
    """
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name="salary_structure"
    )
    annual_ctc = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("600000.00"),
        help_text="Annual Cost to Company in INR (₹)"
    )
    basic_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("25000.00"),
        help_text="Monthly Basic Salary (Typically 40-50% of monthly CTC)"
    )
    hra = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("12500.00"),
        help_text="House Rent Allowance (Typically 40-50% of Basic)"
    )
    special_allowance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("8700.00"),
        help_text="Special / Flexible Monthly Allowance"
    )
    provident_fund = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("1800.00"),
        help_text="Employee EPF monthly deduction (Statutory ₹1,800 or 12% of Basic)"
    )
    professional_tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("200.00"),
        help_text="State Professional Tax (Typically ₹200/month)"
    )
    tds = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Estimated Monthly Tax Deducted at Source"
    )
    currency = models.CharField(max_length=10, default="INR")
    effective_date = models.DateField(default=timezone.localdate)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "salary structure"
        verbose_name_plural = "salary structures"

    def __str__(self):
        return f"Salary Structure - {self.employee.employee_id} ({self.employee.user.get_full_name() or self.employee.user.username})"

    @property
    def monthly_gross(self) -> Decimal:
        return self.basic_salary + self.hra + self.special_allowance

    @property
    def monthly_deductions(self) -> Decimal:
        return self.provident_fund + self.professional_tax + self.tds

    @property
    def monthly_net(self) -> Decimal:
        return self.monthly_gross - self.monthly_deductions


class PayrollRun(models.Model):
    """
    Monthly Corporate Payroll Cycle batch record.
    """
    month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        db_index=True
    )
    year = models.PositiveIntegerField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=PayrollStatus.choices,
        default=PayrollStatus.DRAFT,
        db_index=True
    )
    total_employees = models.PositiveIntegerField(default=0)
    total_gross = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    total_net = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="processed_payrolls"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_payrolls"
    )
    disbursement_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month"]
        unique_together = ("year", "month")
        verbose_name = "payroll run"
        verbose_name_plural = "payroll runs"

    def __str__(self):
        return f"Payroll Run {self.month:02d}/{self.year} [{self.get_status_display()}]"


class Payslip(models.Model):
    """
    Individual Employee Payslip generated for a monthly payroll cycle.
    """
    payslip_number = models.CharField(max_length=50, unique=True, db_index=True)
    payroll_run = models.ForeignKey(
        PayrollRun,
        on_delete=models.CASCADE,
        related_name="payslips"
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payslips"
    )
    month = models.PositiveSmallIntegerField(db_index=True)
    year = models.PositiveIntegerField(db_index=True)

    # Attendance & Leave Reconciliation
    working_days = models.PositiveSmallIntegerField(default=30)
    present_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    paid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    unpaid_leaves = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    loss_of_pay_days = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))

    # Earnings breakdown (INR)
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    hra = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    special_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    overtime_pay = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    gross_earnings = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Deductions breakdown (INR)
    provident_fund = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    professional_tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    tds = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    loss_of_pay_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    other_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    total_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Final Net Pay
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Payment & Banking Details
    bank_name = models.CharField(max_length=100, blank=True, default="")
    bank_account_number = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=PayslipStatus.choices,
        default=PayslipStatus.GENERATED,
        db_index=True
    )
    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK_TRANSFER
    )
    payment_date = models.DateField(null=True, blank=True)
    transaction_reference = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "-month", "employee__employee_id"]
        unique_together = ("employee", "year", "month")
        verbose_name = "payslip"
        verbose_name_plural = "payslips"

    def __str__(self):
        return f"{self.payslip_number} - {self.employee.employee_id} ({self.month:02d}/{self.year})"
