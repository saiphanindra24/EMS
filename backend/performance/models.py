from decimal import Decimal
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class ReviewCycleStatus(models.TextChoices):
    UPCOMING = "UPCOMING", "Upcoming"
    ACTIVE = "ACTIVE", "Active / Self Review"
    EVALUATION = "EVALUATION", "Manager Evaluation"
    COMPLETED = "COMPLETED", "Finalized & Closed"


class ReviewCycleType(models.TextChoices):
    QUARTERLY = "QUARTERLY", "Quarterly Sprint Review"
    ANNUAL = "ANNUAL", "Annual Appraisal"
    MID_YEAR = "MID_YEAR", "Mid-Year Review"
    PROBATION = "PROBATION", "Probation Assessment"


class ReviewCycle(models.Model):
    """
    Appraisal review cycle representing a timeline for self & manager reviews.
    """
    name = models.CharField(max_length=150, unique=True)
    cycle_type = models.CharField(
        max_length=20,
        choices=ReviewCycleType.choices,
        default=ReviewCycleType.QUARTERLY
    )
    start_date = models.DateField()
    end_date = models.DateField()
    self_review_deadline = models.DateField()
    manager_review_deadline = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=ReviewCycleStatus.choices,
        default=ReviewCycleStatus.ACTIVE,
        db_index=True
    )
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class GoalCategory(models.TextChoices):
    TECHNICAL = "TECHNICAL", "Technical Delivery & Architecture"
    OPERATIONAL = "OPERATIONAL", "Operational Quality & SLA"
    LEADERSHIP = "LEADERSHIP", "Team Leadership & Mentorship"
    BUSINESS_GROWTH = "BUSINESS_GROWTH", "Business & Client Impact"
    INNOVATION = "INNOVATION", "Innovation & R&D"


class GoalStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "Not Started"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    ACHIEVED = "ACHIEVED", "Achieved"
    EXCEEDED = "EXCEEDED", "Exceeded"
    DEFERRED = "DEFERRED", "Deferred"


class Goal(models.Model):
    """
    Individual KPI or Performance Goal linked to an employee.
    """
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="performance_goals"
    )
    cycle = models.ForeignKey(
        ReviewCycle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cycle_goals"
    )
    title = models.CharField(max_length=200)
    category = models.CharField(
        max_length=25,
        choices=GoalCategory.choices,
        default=GoalCategory.TECHNICAL
    )
    description = models.TextField(blank=True, default="")
    target_metric = models.CharField(max_length=100, default="100% Completion")
    current_progress = models.IntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    weightage = models.IntegerField(
        default=25,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text="Weight percentage towards overall appraisal score"
    )
    status = models.CharField(
        max_length=20,
        choices=GoalStatus.choices,
        default=GoalStatus.IN_PROGRESS,
        db_index=True
    )
    due_date = models.DateField(null=True, blank=True)
    manager_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.current_progress}%) - {self.employee}"


class ReviewStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SELF_REVIEW = "SELF_REVIEW", "Self Review In Progress"
    MANAGER_REVIEW = "MANAGER_REVIEW", "Manager Review In Progress"
    MEETING_SCHEDULED = "MEETING_SCHEDULED", "1-on-1 Review Scheduled"
    COMPLETED = "COMPLETED", "Finalized & Completed"


class PromotionRecommendation(models.TextChoices):
    NO_CHANGE = "NO_CHANGE", "Maintain Current Band"
    ELIGIBLE_PROMOTION = "ELIGIBLE_PROMOTION", "Recommended for Promotion"
    ROLE_EXPANSION = "ROLE_EXPANSION", "Role Expansion / Senior Band"
    MERIT_INCREASE = "MERIT_INCREASE", "Merit Salary Increment"


class PerformanceReview(models.Model):
    """
    Formal 360 appraisal review record uniting employee self-review,
    manager evaluation, and peer feedback.
    """
    cycle = models.ForeignKey(
        ReviewCycle,
        on_delete=models.CASCADE,
        related_name="reviews"
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="performance_reviews"
    )
    manager = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conducted_reviews"
    )
    status = models.CharField(
        max_length=25,
        choices=ReviewStatus.choices,
        default=ReviewStatus.SELF_REVIEW,
        db_index=True
    )

    # ── Self-Assessment ──
    self_rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("1.0")), MaxValueValidator(Decimal("5.0"))]
    )
    self_achievements = models.TextField(blank=True, default="")
    self_challenges = models.TextField(blank=True, default="")
    self_training_needs = models.TextField(blank=True, default="")
    self_submitted_at = models.DateTimeField(null=True, blank=True)

    # ── Manager Assessment ──
    manager_rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("1.0")), MaxValueValidator(Decimal("5.0"))]
    )
    manager_feedback = models.TextField(blank=True, default="")
    promotion_recommendation = models.CharField(
        max_length=30,
        choices=PromotionRecommendation.choices,
        default=PromotionRecommendation.NO_CHANGE
    )
    pip_required = models.BooleanField(
        default=False,
        help_text="Whether Performance Improvement Plan is mandated"
    )
    final_score = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True
    )
    manager_submitted_at = models.DateTimeField(null=True, blank=True)

    meeting_date = models.DateTimeField(null=True, blank=True)
    hr_notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("cycle", "employee")

    def __str__(self):
        return f"{self.cycle.name} - {self.employee} ({self.get_status_display()})"


class Feedback360Relationship(models.TextChoices):
    PEER = "PEER", "Peer Colleague"
    SUBORDINATE = "SUBORDINATE", "Direct Subordinate"
    CROSS_FUNCTIONAL = "CROSS_FUNCTIONAL", "Cross-Functional Partner"
    MENTOR = "MENTOR", "Technical Mentor"


class Feedback360(models.Model):
    """
    360-degree multi-rater peer feedback attached to a review.
    """
    review = models.ForeignKey(
        PerformanceReview,
        on_delete=models.CASCADE,
        related_name="peer_feedbacks"
    )
    provider = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="given_feedbacks"
    )
    relationship = models.CharField(
        max_length=25,
        choices=Feedback360Relationship.choices,
        default=Feedback360Relationship.PEER
    )
    technical_rating = models.IntegerField(
        default=4,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    collaboration_rating = models.IntegerField(
        default=4,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    leadership_rating = models.IntegerField(
        default=4,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    strengths = models.TextField(blank=True, default="")
    growth_areas = models.TextField(blank=True, default="")
    is_anonymous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"360 Feedback for {self.review.employee} by {self.provider}"
