from decimal import Decimal
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class ProjectStatus(models.TextChoices):
    PLANNING = "PLANNING", "Planning"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    ON_HOLD = "ON_HOLD", "On Hold"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ProjectPriority(models.TextChoices):
    LOW = "LOW", "Low"
    MEDIUM = "MEDIUM", "Medium"
    HIGH = "HIGH", "High"
    CRITICAL = "CRITICAL", "Critical"


class ProjectHealth(models.TextChoices):
    ON_TRACK = "ON_TRACK", "On Track"
    AT_RISK = "AT_RISK", "At Risk"
    DELAYED = "DELAYED", "Delayed"


class Project(models.Model):
    """
    Client or internal workplace project.
    """
    code = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    client_name = models.CharField(max_length=150, blank=True, default="Internal VolkssKatt")
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.IN_PROGRESS,
        db_index=True
    )
    priority = models.CharField(
        max_length=20,
        choices=ProjectPriority.choices,
        default=ProjectPriority.MEDIUM
    )
    health = models.CharField(
        max_length=20,
        choices=ProjectHealth.choices,
        default=ProjectHealth.ON_TRACK
    )
    lead = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_projects"
    )
    department = models.ForeignKey(
        "employees.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects"
    )
    start_date = models.DateField(default=timezone.localdate)
    target_end_date = models.DateField(null=True, blank=True)
    actual_end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    spent_budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    progress_percentage = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "project"
        verbose_name_plural = "projects"

    def __str__(self):
        return f"[{self.code}] {self.name} ({self.get_status_display()})"


class Milestone(models.Model):
    """
    Project phase or key milestone.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="milestones"
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField()
    is_achieved = models.BooleanField(default=False)
    achieved_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "due_date"]
        verbose_name = "milestone"
        verbose_name_plural = "milestones"

    def __str__(self):
        return f"{self.project.code} - {self.title}"


class ProjectMember(models.Model):
    """
    Resource allocation: maps an employee to a project with role & capacity.
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships"
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="project_memberships"
    )
    role = models.CharField(max_length=100, default="Contributor")
    allocation_percentage = models.PositiveIntegerField(
        default=100,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    is_billable = models.BooleanField(default=True)
    joined_at = models.DateField(default=timezone.localdate)

    class Meta:
        unique_together = ("project", "employee")
        verbose_name = "project member"
        verbose_name_plural = "project members"

    def __str__(self):
        return f"{self.employee.employee_id} on {self.project.code} ({self.role})"


class DailyWorkReportStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Submitted"
    APPROVED = "APPROVED", "Approved"
    REVISION_REQUESTED = "REVISION_REQUESTED", "Revision Requested"


class DailyWorkReport(models.Model):
    """
    Daily Work Report (DWR) submitted by an employee for manager accountability.
    """
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="daily_work_reports"
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="daily_reports"
    )
    report_date = models.DateField(default=timezone.localdate, db_index=True)
    hours_worked = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("8.00"),
        validators=[MinValueValidator(Decimal("0.50")), MaxValueValidator(Decimal("24.00"))]
    )
    activities_summary = models.TextField(help_text="Key activities and work completed today")
    issues_faced = models.TextField(blank=True, default="", help_text="Blockers or impediments")
    plan_for_tomorrow = models.TextField(blank=True, default="", help_text="Planned deliverables for tomorrow")
    status = models.CharField(
        max_length=25,
        choices=DailyWorkReportStatus.choices,
        default=DailyWorkReportStatus.SUBMITTED,
        db_index=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_work_reports"
    )
    manager_feedback = models.TextField(blank=True, default="")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-report_date", "-created_at"]
        unique_together = ("employee", "report_date")
        verbose_name = "daily work report"
        verbose_name_plural = "daily work reports"

    def __str__(self):
        return f"DWR - {self.employee.employee_id} ({self.report_date}) [{self.get_status_display()}]"
