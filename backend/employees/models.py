from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def validate_image_file(image):
    if not image:
        return image
    # Limit max size to 5MB
    max_size = 5 * 1024 * 1024
    if image.size > max_size:
        raise ValidationError("Image file size cannot exceed 5MB.")
    try:
        from PIL import Image as PILImage
        # Open and verify
        image.seek(0)
        img = PILImage.open(image)
        img.verify()
        if img.format.lower() not in ["jpeg", "jpg", "png", "webp", "gif"]:
            raise ValidationError("Unsupported image format. Allowed formats: JPEG, PNG, WEBP, GIF.")
        image.seek(0)
    except ValidationError:
        raise
    except Exception:
        raise ValidationError("Uploaded file is not a valid or readable image.")
    return image


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    head = models.ForeignKey(
        "Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="headed_departments",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "department"
        verbose_name_plural = "departments"

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def employee_count(self):
        return self.employees.filter(is_archived=False).count()


class EmploymentType(models.TextChoices):
    FULL_TIME = "FULL_TIME", "Full-time"
    PART_TIME = "PART_TIME", "Part-time"
    CONTRACT = "CONTRACT", "Contract"
    INTERN = "INTERN", "Intern"


class EmploymentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
    ON_LEAVE = "ON_LEAVE", "On Leave"
    TERMINATED = "TERMINATED", "Terminated"


class Employee(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )
    employee_id = models.CharField(max_length=30, unique=True, db_index=True)
    phone = models.CharField(max_length=25, blank=True, default="")
    profile_photo = models.ImageField(
        upload_to="employee_photos/",
        null=True,
        blank=True,
        validators=[validate_image_file],
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )
    designation = models.CharField(max_length=100, blank=True, default="")
    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subordinates",
    )
    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
        db_index=True,
    )
    work_location = models.CharField(max_length=100, default="On-site")
    date_joined = models.DateField(default=timezone.localdate)
    is_archived = models.BooleanField(default=False, db_index=True)

    # Sensitive personal fields (Restricted to HR Admin, Super Admin, and self)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True, default="")
    emergency_contact_name = models.CharField(max_length=100, blank=True, default="")
    emergency_contact_phone = models.CharField(max_length=25, blank=True, default="")
    address = models.TextField(blank=True, default="")
    national_id = models.CharField(max_length=50, blank=True, default="")
    bank_account_number = models.CharField(max_length=50, blank=True, default="")
    bank_name = models.CharField(max_length=100, blank=True, default="")
    base_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "employee"
        verbose_name_plural = "employees"

    def __str__(self):
        return f"{self.full_name} ({self.employee_id})"

    @property
    def email(self):
        return self.user.email

    @property
    def first_name(self):
        return self.user.first_name

    @property
    def last_name(self):
        return self.user.last_name

    @property
    def full_name(self):
        return self.user.full_name

    @property
    def role(self):
        return self.user.role

    @property
    def is_active(self):
        return self.user.is_active and not self.is_archived and self.status == EmploymentStatus.ACTIVE

    def soft_deactivate(self):
        """Soft deactivate without deleting records."""
        self.status = EmploymentStatus.INACTIVE
        self.is_archived = True
        self.save(update_fields=["status", "is_archived", "updated_at"])
        # Also disable user login
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

    def reactivate(self):
        """Reactivate employee profile and user login."""
        self.status = EmploymentStatus.ACTIVE
        self.is_archived = False
        self.save(update_fields=["status", "is_archived", "updated_at"])
        self.user.is_active = True
        self.user.save(update_fields=["is_active"])
