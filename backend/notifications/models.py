from django.conf import settings
from django.db import models
from django.utils import timezone


class NotificationType(models.TextChoices):
    TASK_ASSIGNED = "TASK_ASSIGNED", "Task Assigned"
    TASK_DEADLINE_APPROACHING = "TASK_DEADLINE_APPROACHING", "Task Deadline Approaching"
    TASK_OVERDUE = "TASK_OVERDUE", "Task Overdue"
    LEAVE_SUBMITTED = "LEAVE_SUBMITTED", "Leave Request Submitted"
    LEAVE_APPROVED = "LEAVE_APPROVED", "Leave Request Approved"
    LEAVE_REJECTED = "LEAVE_REJECTED", "Leave Request Rejected"
    ATTENDANCE_REMINDER = "ATTENDANCE_REMINDER", "Attendance Reminder"
    ANNOUNCEMENT = "ANNOUNCEMENT", "Administrative Announcement"


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    notification_type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
        db_index=True,
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # Optional references for client-side navigation
    target_model = models.CharField(max_length=50, blank=True, default="")
    target_id = models.CharField(max_length=50, blank=True, default="")
    target_url = models.CharField(max_length=255, blank=True, default="")

    # Key used to prevent duplicate spam from repeated events/polling
    deduplication_key = models.CharField(max_length=150, blank=True, default="", db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "notification"
        verbose_name_plural = "notifications"

    def __str__(self):
        return f"[{self.notification_type}] for {self.recipient.email}: {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])
