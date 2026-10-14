from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
# PART A: Training & Development, Courses, Certifications
# ─────────────────────────────────────────────────────────────────────────────

class CourseFormat(models.TextChoices):
    VIRTUAL_LIVE = "VIRTUAL_LIVE", "Live Virtual Session"
    SELF_PACED = "SELF_PACED", "Self-Paced e-Learning"
    CLASSROOM_ONSITE = "CLASSROOM_ONSITE", "Onsite Workshop"
    BLENDED = "BLENDED", "Blended Learning"


class CourseLevel(models.TextChoices):
    BEGINNER = "BEGINNER", "Beginner / Foundation"
    INTERMEDIATE = "INTERMEDIATE", "Intermediate Practitioner"
    ADVANCED = "ADVANCED", "Advanced Specialist"
    EXECUTIVE = "EXECUTIVE", "Executive Leadership"


class TrainingCourse(models.Model):
    """
    Corporate learning course or technical boot-camp.
    """
    code = models.CharField(max_length=30, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    instructor = models.CharField(max_length=150, blank=True, default="VolkssKatt Academy Lead")
    department = models.ForeignKey(
        "employees.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="training_courses"
    )
    format = models.CharField(
        max_length=25,
        choices=CourseFormat.choices,
        default=CourseFormat.VIRTUAL_LIVE
    )
    level = models.CharField(
        max_length=20,
        choices=CourseLevel.choices,
        default=CourseLevel.INTERMEDIATE
    )
    duration_hours = models.IntegerField(default=16, validators=[MinValueValidator(1)])
    max_participants = models.IntegerField(default=30)
    start_date = models.DateField()
    end_date = models.DateField()
    is_mandatory = models.BooleanField(default=False)
    skills_covered = models.CharField(max_length=300, blank=True, default="")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"[{self.code}] {self.title} ({self.get_format_display()})"


class EnrollmentStatus(models.TextChoices):
    ENROLLED = "ENROLLED", "Enrolled"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"
    DROPPED = "DROPPED", "Dropped"


class TrainingEnrollment(models.Model):
    """
    Employee enrollment, progress tracking, and course feedback.
    """
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="training_enrollments"
    )
    course = models.ForeignKey(
        TrainingCourse,
        on_delete=models.CASCADE,
        related_name="enrollments"
    )
    status = models.CharField(
        max_length=20,
        choices=EnrollmentStatus.choices,
        default=EnrollmentStatus.ENROLLED,
        db_index=True
    )
    progress_percent = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    completion_date = models.DateField(null=True, blank=True)
    feedback_rating = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    feedback_comments = models.TextField(blank=True, default="")
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-enrolled_at"]
        unique_together = ("employee", "course")

    def __str__(self):
        return f"{self.employee} in {self.course.code} ({self.progress_percent}%)"


class EmployeeCertification(models.Model):
    """
    External verified industry certificate held by an employee.
    """
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="certifications"
    )
    name = models.CharField(max_length=200)
    issuing_organization = models.CharField(max_length=150)
    issue_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    credential_id = models.CharField(max_length=100, blank=True, default="")
    credential_url = models.CharField(max_length=500, blank=True, default="")
    is_verified = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issue_date"]

    def __str__(self):
        return f"{self.name} - {self.employee} ({self.issuing_organization})"


# ─────────────────────────────────────────────────────────────────────────────
# PART B: Exit Management, Separation & Clearance Workflow
# ─────────────────────────────────────────────────────────────────────────────

class ExitReason(models.TextChoices):
    BETTER_OPPORTUNITY = "BETTER_OPPORTUNITY", "Better Career Opportunity"
    HIGHER_EDUCATION = "HIGHER_EDUCATION", "Higher Education / Research"
    CAREER_CHANGE = "CAREER_CHANGE", "Industry / Career Transition"
    RELOCATION = "RELOCATION", "Geographic Relocation"
    PERSONAL_HEALTH = "PERSONAL_HEALTH", "Personal / Health Circumstances"
    RETIREMENT = "RETIREMENT", "Retirement"
    OTHER = "OTHER", "Other Reason"


class ExitStatus(models.TextChoices):
    SUBMITTED = "SUBMITTED", "Resignation Submitted"
    MANAGER_APPROVED = "MANAGER_APPROVED", "Manager Endorsed"
    CLEARANCE_IN_PROGRESS = "CLEARANCE_IN_PROGRESS", "Clearance In Progress"
    FINAL_SETTLEMENT = "FINAL_SETTLEMENT", "Final Accounts Settlement"
    COMPLETED = "COMPLETED", "Separation Complete"
    WITHDRAWN = "WITHDRAWN", "Resignation Withdrawn"


class ClearanceDepartment(models.TextChoices):
    IT_ASSET_RECOVERY = "IT_ASSET_RECOVERY", "IT & Hardware Asset Recovery"
    FINANCE_SETTLEMENT = "FINANCE_SETTLEMENT", "Finance, Tax & Gratuity Settlement"
    HR_DOCUMENTATION = "HR_DOCUMENTATION", "HR Exit Interview & Relieving Letter"
    REPORTING_MANAGER = "REPORTING_MANAGER", "Project Handover & Knowledge Transfer"


class ExitRequest(models.Model):
    """
    Formal resignation and separation record with multi-department clearance checklist.
    """
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="exit_requests"
    )
    resignation_date = models.DateField(default=timezone.localdate)
    reason_category = models.CharField(
        max_length=30,
        choices=ExitReason.choices,
        default=ExitReason.BETTER_OPPORTUNITY
    )
    detailed_reason = models.TextField(blank=True, default="")
    notice_period_days = models.IntegerField(default=30)
    requested_last_working_day = models.DateField()
    agreed_last_working_day = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=30,
        choices=ExitStatus.choices,
        default=ExitStatus.SUBMITTED,
        db_index=True
    )

    # Manager endorsement
    manager_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_exits"
    )
    manager_comments = models.TextField(blank=True, default="")
    manager_action_date = models.DateTimeField(null=True, blank=True)

    # Exit interview & documentation
    exit_interview_completed = models.BooleanField(default=False)
    exit_interview_notes = models.TextField(blank=True, default="")
    retention_discussion = models.TextField(blank=True, default="")
    would_recommend_company = models.BooleanField(default=True)
    relieving_letter_issued = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Exit: {self.employee} ({self.get_status_display()})"


class ExitClearance(models.Model):
    """
    Checklist item for departmental sign-off during employee off-boarding.
    """
    exit_request = models.ForeignKey(
        ExitRequest,
        on_delete=models.CASCADE,
        related_name="clearance_items"
    )
    department = models.CharField(
        max_length=30,
        choices=ClearanceDepartment.choices,
        db_index=True
    )
    is_cleared = models.BooleanField(default=False)
    cleared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="signed_clearances"
    )
    cleared_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        unique_together = ("exit_request", "department")
        ordering = ["department"]

    def __str__(self):
        status_text = "CLEARED" if self.is_cleared else "PENDING"
        return f"{self.get_department_display()} for {self.exit_request.employee}: {status_text}"
