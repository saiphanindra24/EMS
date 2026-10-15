from django.db import models
from django.conf import settings


class ShiftTemplate(models.Model):
    """
    Standard Shift definitions across the enterprise.
    Supports Morning, Standard Day, Swing / Evening, Night / Graveyard, and Weekend Standby.
    """
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    grace_period_minutes = models.PositiveIntegerField(default=15, help_text="Permissible late arrival window in minutes")
    break_duration_minutes = models.PositiveIntegerField(default=45, help_text="Unpaid or scheduled break duration in minutes")
    is_night_shift = models.BooleanField(default=False, help_text="Indicates whether shift spans past midnight")
    color_code = models.CharField(max_length=20, default="#00ffcc", help_text="Hex or CSS color for calendar visualization")
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["start_time", "name"]
        verbose_name = "Shift Template"
        verbose_name_plural = "Shift Templates"

    def __str__(self):
        return f"{self.name} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')})"


class ShiftRoster(models.Model):
    """
    Assigned roster shift for an employee on a given working calendar date.
    """
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        CONFIRMED = "CONFIRMED", "Confirmed"
        COMPLETED = "COMPLETED", "Completed"
        ABSENT = "ABSENT", "Absent / No Show"
        SWAPPED = "SWAPPED", "Swapped"
        CANCELLED = "CANCELLED", "Cancelled"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shift_rosters"
    )
    shift = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.CASCADE,
        related_name="roster_assignments"
    )
    date = models.DateField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    is_published = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_rosters"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "employee"]
        verbose_name = "Shift Roster Assignment"
        verbose_name_plural = "Shift Roster Assignments"
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                name="unique_employee_date_shift_roster"
            )
        ]

    def __str__(self):
        return f"{self.employee.get_full_name()} - {self.shift.name} ({self.date})"


class ShiftSwapRequest(models.Model):
    """
    Peer-to-peer or open pool shift exchange with target approval and supervisor sign-off.
    """
    class TargetStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Peer Approval"
        ACCEPTED = "ACCEPTED", "Accepted by Peer"
        DECLINED = "DECLINED", "Declined by Peer"

    class ManagerStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Manager Approval"
        APPROVED = "APPROVED", "Approved by Manager"
        REJECTED = "REJECTED", "Rejected by Manager"

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_shift_swaps"
    )
    requester_assignment = models.ForeignKey(
        ShiftRoster,
        on_delete=models.CASCADE,
        related_name="outgoing_swap_requests"
    )
    target_employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="received_shift_swaps",
        help_text="Designated peer colleague or null for open department swap board"
    )
    target_assignment = models.ForeignKey(
        ShiftRoster,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="incoming_swap_requests"
    )
    reason = models.TextField()
    target_status = models.CharField(
        max_length=20,
        choices=TargetStatus.choices,
        default=TargetStatus.PENDING
    )
    manager_status = models.CharField(
        max_length=20,
        choices=ManagerStatus.choices,
        default=ManagerStatus.PENDING
    )
    manager_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_shift_swaps"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Shift Swap Request"
        verbose_name_plural = "Shift Swap Requests"

    def __str__(self):
        target_name = self.target_employee.get_full_name() if self.target_employee else "Open Pool"
        return f"Swap: {self.requester.get_full_name()} -> {target_name} ({self.requester_assignment.date})"


class OvertimeRecord(models.Model):
    """
    Overtime hours claimed by employees or logged automatically beyond regular rostered shift thresholds.
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Approval"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        PAID = "PAID", "Disbursed / Paid in Payroll"

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="overtime_records"
    )
    date = models.DateField()
    roster_assignment = models.ForeignKey(
        ShiftRoster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="overtime_records"
    )
    start_time = models.TimeField()
    end_time = models.TimeField()
    hours = models.DecimalField(max_digits=5, decimal_places=2, help_text="Total overtime duration in hours")
    rate_multiplier = models.DecimalField(max_digits=3, decimal_places=2, default=1.50, help_text="OT pay factor e.g. 1.5x regular, 2.0x weekend")
    project_code = models.CharField(max_length=50, blank=True, help_text="Associated project charge code")
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_overtimes"
    )
    approver_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "Overtime Record"
        verbose_name_plural = "Overtime Records"

    def __str__(self):
        return f"OT: {self.employee.get_full_name()} ({self.date}: {self.hours} hrs @ {self.rate_multiplier}x)"
