from decimal import Decimal
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Feedback360,
    Goal,
    GoalStatus,
    PerformanceReview,
    PromotionRecommendation,
    ReviewCycle,
    ReviewCycleStatus,
    ReviewStatus,
)
from .serializers import (
    Feedback360Serializer,
    GoalSerializer,
    ManagerReviewInputSerializer,
    PerformanceReviewSerializer,
    ReviewCycleSerializer,
    SelfReviewInputSerializer,
)


class ReviewCycleViewSet(viewsets.ModelViewSet):
    queryset = ReviewCycle.objects.all().order_by("-start_date")
    serializer_class = ReviewCycleSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"])
    def active(self, request):
        cycle = ReviewCycle.objects.filter(status=ReviewCycleStatus.ACTIVE).first()
        if not cycle:
            cycle = ReviewCycle.objects.first()
        if not cycle:
            return Response({"detail": "No review cycle found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReviewCycleSerializer(cycle).data)


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", "")
        qs = Goal.objects.select_related("employee", "employee__user", "cycle")

        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            return qs

        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return qs.none()

        if role == "MANAGER":
            return qs.filter(
                Q(employee=employee_profile) | Q(employee__manager=employee_profile)
            ).distinct()

        return qs.filter(employee=employee_profile)

    def perform_create(self, serializer):
        user = self.request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            raise permissions.exceptions.PermissionDenied("No employee profile found.")
        serializer.save(employee=employee_profile)

    @action(detail=True, methods=["patch"])
    def update_progress(self, request, pk=None):
        goal = self.get_object()
        progress = request.data.get("current_progress")
        if progress is not None:
            try:
                progress_val = int(progress)
                if 0 <= progress_val <= 100:
                    goal.current_progress = progress_val
                    if progress_val == 100:
                        goal.status = GoalStatus.ACHIEVED
                    elif progress_val > 0:
                        goal.status = GoalStatus.IN_PROGRESS
                    goal.save()
                    return Response(GoalSerializer(goal).data)
                else:
                    return Response({"error": "Progress must be between 0 and 100."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({"error": "Invalid progress value."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"error": "current_progress required."}, status=status.HTTP_400_BAD_REQUEST)


class PerformanceReviewViewSet(viewsets.ModelViewSet):
    serializer_class = PerformanceReviewSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", "")
        qs = PerformanceReview.objects.select_related(
            "cycle",
            "employee",
            "employee__user",
            "employee__department",
            "manager",
            "manager__user"
        ).prefetch_related("peer_feedbacks", "peer_feedbacks__provider", "peer_feedbacks__provider__user")

        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            return qs

        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return qs.none()

        if role == "MANAGER":
            return qs.filter(
                Q(employee=employee_profile) | Q(employee__manager=employee_profile) | Q(manager=employee_profile)
            ).distinct()

        return qs.filter(employee=employee_profile)

    @action(detail=False, methods=["get"])
    def my_reviews(self, request):
        user = request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return Response([])
        reviews = PerformanceReview.objects.filter(employee=employee_profile).order_by("-cycle__start_date")
        return Response(PerformanceReviewSerializer(reviews, many=True).data)

    @action(detail=True, methods=["post"])
    def self_submit(self, request, pk=None):
        review = self.get_object()
        user = request.user
        employee_profile = getattr(user, "employee_profile", None)

        if not employee_profile or review.employee_id != employee_profile.id:
            return Response(
                {"error": "Only the assigned employee can submit self-assessment."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = SelfReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        review.self_rating = data["self_rating"]
        review.self_achievements = data["self_achievements"]
        review.self_challenges = data.get("self_challenges", "")
        review.self_training_needs = data.get("self_training_needs", "")
        review.self_submitted_at = timezone.now()
        review.status = ReviewStatus.MANAGER_REVIEW
        review.save()

        return Response(PerformanceReviewSerializer(review).data)

    @action(detail=True, methods=["post"])
    def manager_submit(self, request, pk=None):
        review = self.get_object()
        user = request.user
        role = getattr(user, "role", "")
        employee_profile = getattr(user, "employee_profile", None)

        is_authorized = False
        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            is_authorized = True
        elif employee_profile:
            if review.manager_id == employee_profile.id or (review.employee.manager_id == employee_profile.id):
                is_authorized = True

        if not is_authorized:
            return Response(
                {"error": "You do not have manager authorization to evaluate this employee review."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ManagerReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        mgr_rating = data["manager_rating"]
        review.manager_rating = mgr_rating
        review.manager_feedback = data["manager_feedback"]
        review.promotion_recommendation = data.get("promotion_recommendation", PromotionRecommendation.NO_CHANGE)
        review.pip_required = data.get("pip_required", False)

        final_score = data.get("final_score")
        if final_score is not None:
            review.final_score = final_score
        elif review.self_rating:
            # Weighted average: 40% self, 60% manager
            review.final_score = (
                (review.self_rating * Decimal("0.40")) + (mgr_rating * Decimal("0.60"))
            ).quantize(Decimal("0.1"))
        else:
            review.final_score = mgr_rating

        review.manager_submitted_at = timezone.now()
        review.status = ReviewStatus.COMPLETED
        review.save()

        return Response(PerformanceReviewSerializer(review).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = self.get_queryset()
        total_reviews = qs.count()
        completed_reviews = qs.filter(status=ReviewStatus.COMPLETED).count()

        avg_score = qs.filter(final_score__isnull=False).aggregate(a=Avg("final_score"))["a"] or 0.0
        avg_score = round(float(avg_score), 2)

        promo_count = qs.filter(
            promotion_recommendation__in=[
                PromotionRecommendation.ELIGIBLE_PROMOTION,
                PromotionRecommendation.ROLE_EXPANSION,
                PromotionRecommendation.MERIT_INCREASE,
            ]
        ).count()

        pip_count = qs.filter(pip_required=True).count()

        # Top performers
        top_qs = qs.filter(final_score__isnull=False).order_by("-final_score")[:5]
        top_performers = []
        for r in top_qs:
            top_performers.append({
                "id": r.id,
                "employee_id": r.employee.employee_id,
                "name": f"{r.employee.user.first_name} {r.employee.user.last_name}".strip(),
                "designation": r.employee.designation,
                "score": float(r.final_score),
                "promotion": r.get_promotion_recommendation_display(),
            })

        return Response({
            "total_reviews": total_reviews,
            "completed_reviews": completed_reviews,
            "completion_percentage": round((completed_reviews / total_reviews * 100) if total_reviews > 0 else 0, 1),
            "average_org_score": avg_score,
            "promotion_nominees": promo_count,
            "pip_count": pip_count,
            "top_performers": top_performers,
        })


class Feedback360ViewSet(viewsets.ModelViewSet):
    serializer_class = Feedback360Serializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", "")
        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            return Feedback360.objects.all()

        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return Feedback360.objects.none()

        return Feedback360.objects.filter(
            Q(review__employee=employee_profile) | Q(provider=employee_profile)
        )

    def perform_create(self, serializer):
        user = self.request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            raise permissions.exceptions.PermissionDenied("Must have employee profile to submit peer feedback.")
        serializer.save(provider=employee_profile)
