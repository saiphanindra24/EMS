import uuid
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class ExpenseCategory(models.TextChoices):
    TRAVEL = "TRAVEL", "Travel & Accommodation"
    MEALS = "MEALS", "Food & Meals"
    SUPPLIES = "SUPPLIES", "Office & Equipment Supplies"
    SOFTWARE = "SOFTWARE", "Software & Cloud Services"
    TRAINING = "TRAINING", "Training & Certifications"
    CLIENT_ENTERTAINMENT = "CLIENT_ENTERTAINMENT", "Client Entertainment"
    COMMUTE = "COMMUTE", "Local Commute & Fuel"
    OTHER = "OTHER", "Other General Expense"


class ExpenseStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted (Pending Manager)"
    MANAGER_APPROVED = "MANAGER_APPROVED", "Manager Approved (Pending Finance)"
    FINANCE_APPROVED = "FINANCE_APPROVED", "Finance Approved"
    REJECTED = "REJECTED", "Revision / Rejected"
    REIMBURSED = "REIMBURSED", "Settled & Reimbursed"


class PaymentMethod(models.TextChoices):
    DIRECT_DEPOSIT = "DIRECT_DEPOSIT", "Direct Bank Deposit"
    NEFT_UPI = "NEFT_UPI", "Corporate NEFT / UPI"
    PAYROLL_ADDON = "PAYROLL_ADDON", "Payroll Cycle Add-on"
    COMPANY_CARD = "COMPANY_CARD", "Corporate Credit Card"
    CASH = "CASH", "Petty Cash Reimbursement"


class ExpenseClaim(models.Model):
    """
    Employee Expense & Reimbursement claim model with dual-tier approval
    (Manager -> Finance) and optional client project linkage.
    """
    claim_number = models.CharField(max_length=32, unique=True, db_index=True)
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="expense_claims"
    )
    title = models.CharField(max_length=200)
    category = models.CharField(
        max_length=30,
        choices=ExpenseCategory.choices,
        default=ExpenseCategory.OTHER,
        db_index=True
    )
    expense_date = models.DateField(default=timezone.localdate)
    currency = models.CharField(max_length=10, default="INR")
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))]
    )
    tax_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))]
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00")
    )
    is_billable = models.BooleanField(
        default=False,
        help_text="Whether this expense can be invoiced to a client project"
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses"
    )
    receipt = models.FileField(
        upload_to="expense_receipts/",
        null=True,
        blank=True
    )
    receipt_url = models.CharField(max_length=500, blank=True, default="")
    description = models.TextField(
        blank=True,
        default="",
        help_text="Detailed business justification and itemized notes"
    )
    status = models.CharField(
        max_length=30,
        choices=ExpenseStatus.choices,
        default=ExpenseStatus.SUBMITTED,
        db_index=True
    )

    # Manager review tier
    manager_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="manager_reviewed_expenses"
    )
    manager_reviewed_at = models.DateTimeField(null=True, blank=True)
    manager_notes = models.TextField(blank=True, default="")

    # Finance approval & payout tier
    finance_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="finance_reviewed_expenses"
    )
    finance_reviewed_at = models.DateTimeField(null=True, blank=True)
    finance_notes = models.TextField(blank=True, default="")
    payment_method = models.CharField(
        max_length=40,
        choices=PaymentMethod.choices,
        blank=True,
        default=""
    )
    transaction_reference = models.CharField(max_length=100, blank=True, default="")
    reimbursed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Expense Claim"
        verbose_name_plural = "Expense Claims"

    def save(self, *args, **kwargs):
        # Auto-compute total_amount
        amt = self.amount or Decimal("0.00")
        tax = self.tax_amount or Decimal("0.00")
        self.total_amount = amt + tax

        # Auto-generate claim_number if empty
        if not self.claim_number:
            year = timezone.now().year
            rand_suffix = uuid.uuid4().hex[:6].upper()
            self.claim_number = f"EXP-{year}-{rand_suffix}"

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.claim_number} - {self.title} ({self.currency} {self.total_amount})"
