from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def validate_attachment_file(attachment):
    if not attachment:
        return attachment
    max_size = 10 * 1024 * 1024  # 10 MB limit
    if attachment.size > max_size:
        raise ValidationError("Attachment size cannot exceed 10MB.")
    
    # Restrict allowed document and image extensions
    import os
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"}
    ext = os.path.splitext(attachment.name)[1].lower()
    if ext not in allowed_extensions:
        raise ValidationError(f"File extension '{ext}' is not permitted. Allowed: PDF, PNG, JPG, JPEG, WEBP, DOC, DOCX.")
    return attachment


class LeaveType(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)
    code = models.CharField(max_length=30, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    is_paid = models.BooleanField(default=True)
    requires_approval = models.BooleanField(default=True)
    annual_allowance = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Optional max annual days allowed if the organization enforces a quota.",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "leave type"
        verbose_name_plural = "leave types"

    def __str__(self):
        return f"{self.name} ({self.code})"


class LeaveStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


class LeaveRequest(models.Model):
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="leave_requests",
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name="leave_requests",
    )
    start_date = models.DateField(db_index=True)
    end_date = models.DateField(db_index=True)
    duration_days = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        default=Decimal("1.0"),
    )
    reason = models.TextField()
    attachment = models.FileField(
        upload_to="leave_attachments/",
        null=True,
        blank=True,
        validators=[validate_attachment_file],
    )
    status = models.CharField(
        max_length=20,
        choices=LeaveStatus.choices,
        default=LeaveStatus.PENDING,
        db_index=True,
    )
    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_leaves",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at"]
        verbose_name = "leave request"
        verbose_name_plural = "leave requests"

    def __str__(self):
        return f"{self.employee.employee_id} - {self.leave_type.name} ({self.start_date} to {self.end_date})"

    def clean(self):
        super().clean()
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValidationError({"end_date": "End date cannot be prior to start date."})

            # Calculate inclusive duration days
            delta_days = (self.end_date - self.start_date).days + 1
            self.duration_days = Decimal(str(delta_days))

            # Detect overlapping requests for the same employee
            # Active requests are PENDING or APPROVED
            overlapping = LeaveRequest.objects.filter(
                employee=self.employee,
                status__in=[LeaveStatus.PENDING, LeaveStatus.APPROVED],
                start_date__lte=self.end_date,
                end_date__gte=self.start_date,
            )
            if self.pk:
                overlapping = overlapping.exclude(pk=self.pk)

            if overlapping.exists():
                conflict = overlapping.first()
                raise ValidationError(
                    f"Overlapping leave request already exists ({conflict.leave_type.name}: "
                    f"{conflict.start_date} to {conflict.end_date}, status: {conflict.status})."
                )

    def save(self, *args, **kwargs):
        if self.start_date and self.end_date:
            delta_days = (self.end_date - self.start_date).days + 1
            self.duration_days = Decimal(str(delta_days))
        super().save(*args, **kwargs)


class LeaveBalance(models.Model):
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="leave_balances",
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="balances",
    )
    year = models.PositiveIntegerField(db_index=True)
    allocated_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0.0"))
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0.0"))
    pending_days = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0.0"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "leave_type__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "leave_type", "year"],
                name="unique_employee_leave_type_year",
            )
        ]

    def __str__(self):
        return f"{self.employee.employee_id} - {self.leave_type.code} ({self.year}): {self.used_days}/{self.allocated_days}"

    @property
    def available_days(self):
        return max(Decimal("0.0"), self.allocated_days - self.used_days)


class LeaveAuditLog(models.Model):
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=50)  # SUBMITTED, APPROVED, REJECTED, CANCELLED
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_audit_actions",
    )
    previous_status = models.CharField(max_length=20, blank=True, default="")
    new_status = models.CharField(max_length=20, blank=True, default="")
    note = models.TextField(blank=True, default="")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"{self.action} on Request #{self.leave_request_id} at {self.timestamp}"
