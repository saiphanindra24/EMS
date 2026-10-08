import zoneinfo
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def validate_org_logo(image):
    if not image:
        return image
    max_size = 5 * 1024 * 1024  # 5MB max
    if image.size > max_size:
        raise ValidationError("Logo image cannot exceed 5MB.")
    try:
        from PIL import Image as PILImage
        image.seek(0)
        img = PILImage.open(image)
        img.verify()
        if img.format.lower() not in ["jpeg", "jpg", "png", "webp", "gif"]:
            raise ValidationError("Unsupported logo format. Allowed: JPEG, PNG, WEBP, GIF.")
        image.seek(0)
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("Uploaded file is not a valid or readable image.")
    return image


def validate_timezone_name(value):
    if not value:
        raise ValidationError("Timezone cannot be blank.")
    available = zoneinfo.available_timezones()
    if value not in available:
        raise ValidationError(f"'{value}' is not a valid IANA timezone (e.g. 'UTC', 'America/New_York', 'Asia/Kolkata').")


class OrganizationSetting(models.Model):
    name = models.CharField(max_length=150, default="EMWTS Workplace Solutions")
    logo = models.ImageField(
        upload_to="organization_assets/",
        null=True,
        blank=True,
        validators=[validate_org_logo],
    )
    timezone = models.CharField(
        max_length=100,
        default="UTC",
        validators=[validate_timezone_name],
    )
    contact_email = models.EmailField(blank=True, default="admin@emwts.local")
    contact_phone = models.CharField(max_length=35, blank=True, default="")
    address = models.TextField(blank=True, default="")
    website = models.URLField(blank=True, default="https://emwts.local")
    fiscal_year_start_month = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "organization setting"
        verbose_name_plural = "organization settings"

    def __str__(self):
        return f"{self.name} Settings"

    @classmethod
    def get_settings(cls):
        setting, _ = cls.objects.get_or_create(
            id=1,
            defaults={
                "name": "EMWTS Workplace Solutions",
                "timezone": "UTC",
                "contact_email": "admin@emwts.local",
            },
        )
        return setting


class Holiday(models.Model):
    name = models.CharField(max_length=150)
    date = models.DateField(db_index=True)
    description = models.TextField(blank=True, default="")
    is_optional = models.BooleanField(default=False)
    is_recurring_annually = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]
        verbose_name = "holiday"
        verbose_name_plural = "holidays"
        constraints = [
            models.UniqueConstraint(fields=["date", "name"], name="unique_holiday_date_name")
        ]

    def __str__(self):
        return f"{self.name} ({self.date})"


class NotificationPreferenceSetting(models.Model):
    email_notifications_enabled = models.BooleanField(default=True)
    task_assignment_alerts = models.BooleanField(default=True)
    task_overdue_alerts = models.BooleanField(default=True)
    leave_status_alerts = models.BooleanField(default=True)
    attendance_reminder_alerts = models.BooleanField(default=True)
    daily_digest_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "notification preference setting"
        verbose_name_plural = "notification preference settings"

    @classmethod
    def get_preferences(cls):
        prefs, _ = cls.objects.get_or_create(id=1)
        return prefs


class AdminAuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_audit_logs",
    )
    action = models.CharField(max_length=80, db_index=True)
    category = models.CharField(max_length=40, db_index=True)
    description = models.TextField()
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "administration audit log"
        verbose_name_plural = "administration audit logs"

    def __str__(self):
        actor_email = self.actor.email if self.actor else "System"
        return f"[{self.category}] {self.action} by {actor_email} at {self.created_at}"

    @classmethod
    def log_action(cls, actor, action, category, description, changes=None, ip_address=None):
        return cls.objects.create(
            actor=actor,
            action=action,
            category=category,
            description=description,
            changes=changes or {},
            ip_address=ip_address,
        )
