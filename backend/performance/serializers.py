from decimal import Decimal
from rest_framework import serializers
from .models import (
    Feedback360,
    Feedback360Relationship,
    Goal,
    GoalCategory,
    GoalStatus,
    PerformanceReview,
    PromotionRecommendation,
    ReviewCycle,
    ReviewCycleStatus,
    ReviewCycleType,
    ReviewStatus,
)


class ReviewCycleSerializer(serializers.ModelSerializer):
    cycle_type_display = serializers.CharField(source="get_cycle_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    total_reviews = serializers.SerializerMethodField()
    completed_reviews = serializers.SerializerMethodField()

    class Meta:
        model = ReviewCycle
        fields = [
            "id",
            "name",
            "cycle_type",
            "cycle_type_display",
            "start_date",
            "end_date",
            "self_review_deadline",
            "manager_review_deadline",
            "status",
            "status_display",
            "description",
            "total_reviews",
            "completed_reviews",
            "created_at",
            "updated_at",
        ]

    def get_total_reviews(self, obj):
        return obj.reviews.count()

    def get_completed_reviews(self, obj):
        return obj.reviews.filter(status=ReviewStatus.COMPLETED).count()


class GoalSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Goal
        fields = [
            "id",
            "employee",
            "employee_id",
            "employee_name",
            "cycle",
            "title",
            "category",
            "category_display",
            "description",
            "target_metric",
            "current_progress",
            "weightage",
            "status",
            "status_display",
            "due_date",
            "manager_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "employee", "created_at", "updated_at"]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            u = obj.employee.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "Unknown"


class Feedback360Serializer(serializers.ModelSerializer):
    provider_name = serializers.SerializerMethodField()
    relationship_display = serializers.CharField(source="get_relationship_display", read_only=True)

    class Meta:
        model = Feedback360
        fields = [
            "id",
            "review",
            "provider",
            "provider_name",
            "relationship",
            "relationship_display",
            "technical_rating",
            "collaboration_rating",
            "leadership_rating",
            "strengths",
            "growth_areas",
            "is_anonymous",
            "created_at",
        ]
        read_only_fields = ["id", "provider", "created_at"]

    def get_provider_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous Peer"
        if obj.provider and obj.provider.user:
            u = obj.provider.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "Peer Colleague"


class PerformanceReviewSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True, default="")
    designation = serializers.CharField(source="employee.designation", read_only=True, default="")
    manager_name = serializers.SerializerMethodField()
    cycle_name = serializers.CharField(source="cycle.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    promotion_recommendation_display = serializers.CharField(
        source="get_promotion_recommendation_display", read_only=True
    )
    peer_feedbacks = Feedback360Serializer(many=True, read_only=True)
    goals = serializers.SerializerMethodField()

    class Meta:
        model = PerformanceReview
        fields = [
            "id",
            "cycle",
            "cycle_name",
            "employee",
            "employee_id",
            "employee_name",
            "department_name",
            "designation",
            "manager",
            "manager_name",
            "status",
            "status_display",
            "self_rating",
            "self_achievements",
            "self_challenges",
            "self_training_needs",
            "self_submitted_at",
            "manager_rating",
            "manager_feedback",
            "promotion_recommendation",
            "promotion_recommendation_display",
            "pip_required",
            "final_score",
            "manager_submitted_at",
            "meeting_date",
            "hr_notes",
            "peer_feedbacks",
            "goals",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "cycle",
            "employee",
            "manager",
            "status",
            "self_submitted_at",
            "manager_submitted_at",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            u = obj.employee.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "Unknown"

    def get_manager_name(self, obj):
        if obj.manager and obj.manager.user:
            u = obj.manager.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return "None Assigned"

    def get_goals(self, obj):
        # Fetch goals matching this employee and cycle
        goals_qs = Goal.objects.filter(employee=obj.employee, cycle=obj.cycle)
        return GoalSerializer(goals_qs, many=True).data


class SelfReviewInputSerializer(serializers.Serializer):
    self_rating = serializers.DecimalField(
        max_digits=3, decimal_places=1, min_value=Decimal("1.0"), max_value=Decimal("5.0")
    )
    self_achievements = serializers.CharField(required=True)
    self_challenges = serializers.CharField(required=False, allow_blank=True, default="")
    self_training_needs = serializers.CharField(required=False, allow_blank=True, default="")


class ManagerReviewInputSerializer(serializers.Serializer):
    manager_rating = serializers.DecimalField(
        max_digits=3, decimal_places=1, min_value=Decimal("1.0"), max_value=Decimal("5.0")
    )
    manager_feedback = serializers.CharField(required=True)
    promotion_recommendation = serializers.ChoiceField(
        choices=PromotionRecommendation.choices,
        default=PromotionRecommendation.NO_CHANGE
    )
    pip_required = serializers.BooleanField(default=False)
    final_score = serializers.DecimalField(
        max_digits=3, decimal_places=1, required=False, min_value=Decimal("1.0"), max_value=Decimal("5.0")
    )
