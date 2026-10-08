from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Present"
    ABSENT = "ABSENT", "Absent"
    LATE = "LATE", "Late"
    HALF_DAY = "HALF_DAY", "Half Day"
    HOLIDAY = "HOLIDAY", "Holiday"
    ON_LEAVE = "ON_LEAVE", "On Leave"


class WorkSchedule(models.Model):
    name = models.CharField(max_length=100, default="Standard Corporate Schedule")
    work_start_time = models.TimeField(default="09:00:00")
    work_end_time = models.TimeField(default="18:00:00")
    grace_period_minutes = models.PositiveIntegerField(default=15)
    half_day_minimum_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("4.00"))
    full_day_minimum_hours = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("8.00"))
    is_default = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (Starts {self.work_start_time})"

    @classmethod
    def get_active_schedule(cls):
        return cls.objects.filter(is_default=True).first()


class AttendanceRecord(models.Model):
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    date = models.DateField(db_index=True)
    check_in = models.DateTimeField(null=True, blank=True)
    check_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.PRESENT,
        db_index=True,
    )
    work_duration_minutes = models.PositiveIntegerField(default=0)
    work_duration_hours = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-check_in"]
        verbose_name = "attendance record"
        verbose_name_plural = "attendance records"
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                name="unique_employee_daily_attendance",
            )
        ]

    def __str__(self):
        return f"{self.employee.full_name} - {self.date} ({self.status})"

    @property
    def is_active_session(self):
        return self.check_in is not None and self.check_out is None

    def calculate_duration(self):
        """Calculates working minutes and hours between check_in and check_out."""
        if not self.check_in or not self.check_out:
            self.work_duration_minutes = 0
            self.work_duration_hours = Decimal("0.00")
            return

        if self.check_out < self.check_in:
            raise ValidationError("Check-out timestamp cannot be earlier than check-in timestamp.")

        delta = self.check_out - self.check_in
        total_seconds = int(delta.total_seconds())
        minutes = total_seconds // 60
        hours = round(Decimal(total_seconds) / Decimal(3600), 2)

        self.work_duration_minutes = minutes
        self.work_duration_hours = hours

    def evaluate_status(self, schedule=None):
        """
        Evaluates attendance status based on work schedule and calculated hours.
        """
        if self.status in [AttendanceStatus.HOLIDAY, AttendanceStatus.ON_LEAVE, AttendanceStatus.ABSENT]:
            return

        schedule = schedule or WorkSchedule.get_active_schedule()
        half_day_hrs = Decimal(str(settings.ATTENDANCE_HALF_DAY_MINIMUM_HOURS))
        if schedule:
            half_day_hrs = schedule.half_day_minimum_hours

        # If session completed and worked less than half-day minimum
        if self.check_out and self.work_duration_hours < half_day_hrs:
            self.status = AttendanceStatus.HALF_DAY
            return

        # Check late arrival if check_in exists
        if self.check_in:
            local_in = timezone.localtime(self.check_in)
            sched_start = "09:00:00"
            grace_min = settings.ATTENDANCE_GRACE_PERIOD_MINUTES
            if schedule:
                sched_start = str(schedule.work_start_time)
                grace_min = schedule.grace_period_minutes

            start_hour, start_min = [int(x) for x in sched_start.split(":")[:2]]
            sched_minute_of_day = (start_hour * 60) + start_min + grace_min
            actual_minute_of_day = (local_in.hour * 60) + local_in.minute

            if actual_minute_of_day > sched_minute_of_day:
                self.status = AttendanceStatus.LATE
            else:
                self.status = AttendanceStatus.PRESENT


class AttendanceCorrection(models.Model):
    """
    Audit trail for authorized adjustments made to attendance records.
    """
    attendance_record = models.ForeignKey(
        AttendanceRecord,
        on_delete=models.CASCADE,
        related_name="corrections",
    )
    corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="attendance_corrections",
    )
    original_check_in = models.DateTimeField(null=True, blank=True)
    original_check_out = models.DateTimeField(null=True, blank=True)
    original_status = models.CharField(max_length=20)
    new_check_in = models.DateTimeField(null=True, blank=True)
    new_check_out = models.DateTimeField(null=True, blank=True)
    new_status = models.CharField(max_length=20)
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "attendance correction"
        verbose_name_plural = "attendance corrections"

    def __str__(self):
        by = self.corrected_by.email if self.corrected_by else "System"
        return f"Correction on {self.attendance_record.date} by {by}"
