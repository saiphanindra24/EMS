from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from employees.models import Employee, EmploymentStatus
from .models import (
    ClearanceDepartment,
    EmployeeCertification,
    EnrollmentStatus,
    ExitClearance,
    ExitRequest,
    ExitStatus,
    TrainingCourse,
    TrainingEnrollment,
)
from .serializers import (
    ClearanceSignoffInputSerializer,
    EmployeeCertificationSerializer,
    ExitInterviewInputSerializer,
    ExitRequestSerializer,
    ManagerExitReviewInputSerializer,
    ResignationInputSerializer,
    TrainingCourseSerializer,
    TrainingEnrollmentSerializer,
)


class TrainingCourseViewSet(viewsets.ModelViewSet):
    queryset = TrainingCourse.objects.all().order_by("-start_date")
    serializer_class = TrainingCourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["post"])
    def enroll(self, request, pk=None):
        course = self.get_object()
        user = request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return Response(
                {"error": "Only authenticated employees can enroll in courses."},
                status=status.HTTP_400_BAD_REQUEST
            )

        enrollment, created = TrainingEnrollment.objects.get_or_create(
            employee=employee_profile,
            course=course,
            defaults={"status": EnrollmentStatus.ENROLLED, "progress_percent": 0}
        )

        return Response(
            TrainingEnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class TrainingEnrollmentViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingEnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", "")
        qs = TrainingEnrollment.objects.select_related("employee", "employee__user", "course")

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

    @action(detail=True, methods=["patch"])
    def update_progress(self, request, pk=None):
        enrollment = self.get_object()
        progress = request.data.get("progress_percent")
        feedback_rating = request.data.get("feedback_rating")
        feedback_comments = request.data.get("feedback_comments")

        if progress is not None:
            try:
                pval = int(progress)
                if 0 <= pval <= 100:
                    enrollment.progress_percent = pval
                    if pval == 100:
                        enrollment.status = EnrollmentStatus.COMPLETED
                        enrollment.completion_date = timezone.localdate()
                    elif pval > 0:
                        enrollment.status = EnrollmentStatus.IN_PROGRESS
            except ValueError:
                pass

        if feedback_rating is not None:
            try:
                rval = int(feedback_rating)
                if 1 <= rval <= 5:
                    enrollment.feedback_rating = rval
            except ValueError:
                pass

        if feedback_comments is not None:
            enrollment.feedback_comments = str(feedback_comments)

        enrollment.save()
        return Response(TrainingEnrollmentSerializer(enrollment).data)


class EmployeeCertificationViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeCertificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", "")
        qs = EmployeeCertification.objects.select_related("employee", "employee__user")

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
            raise permissions.exceptions.PermissionDenied("Must have employee profile to log certificates.")
        serializer.save(employee=employee_profile, is_verified=True)


class ExitRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ExitRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", "")
        qs = ExitRequest.objects.select_related(
            "employee",
            "employee__user",
            "employee__department",
            "manager_reviewed_by"
        ).prefetch_related("clearance_items", "clearance_items__cleared_by")

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

    @action(detail=False, methods=["post"])
    def submit_resignation(self, request):
        user = request.user
        employee_profile = getattr(user, "employee_profile", None)
        if not employee_profile:
            return Response(
                {"error": "Only active employees can submit resignation."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ResignationInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exit_req = ExitRequest.objects.create(
            employee=employee_profile,
            reason_category=data["reason_category"],
            detailed_reason=data.get("detailed_reason", ""),
            notice_period_days=data.get("notice_period_days", 30),
            requested_last_working_day=data["requested_last_working_day"],
            status=ExitStatus.SUBMITTED
        )

        # Auto-create the 4 standard departmental clearance items
        for dept_code in ClearanceDepartment.values:
            ExitClearance.objects.create(
                exit_request=exit_req,
                department=dept_code,
                is_cleared=False
            )

        return Response(ExitRequestSerializer(exit_req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def manager_review(self, request, pk=None):
        exit_req = self.get_object()
        user = request.user
        role = getattr(user, "role", "")
        emp_prof = getattr(user, "employee_profile", None)

        is_manager = False
        if role in ["SUPER_ADMIN", "HR_ADMIN"]:
            is_manager = True
        elif emp_prof and exit_req.employee.manager_id == emp_prof.id:
            is_manager = True

        if not is_manager:
            return Response(
                {"error": "You do not have manager authorization to review this exit request."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ManagerExitReviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        action_choice = data["action"]
        exit_req.manager_reviewed_by = user
        exit_req.manager_comments = data.get("manager_comments", "")
        exit_req.manager_action_date = timezone.now()

        if action_choice == "APPROVE":
            exit_req.status = ExitStatus.CLEARANCE_IN_PROGRESS
            exit_req.agreed_last_working_day = data.get(
                "agreed_last_working_day", exit_req.requested_last_working_day
            )
        else:
            exit_req.status = ExitStatus.WITHDRAWN

        exit_req.save()
        return Response(ExitRequestSerializer(exit_req).data)

    @action(detail=True, methods=["post"])
    def sign_clearance(self, request, pk=None):
        exit_req = self.get_object()
        user = request.user
        role = getattr(user, "role", "")

        serializer = ClearanceSignoffInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        dept = data["department"]
        is_cleared = data["is_cleared"]
        notes = data.get("notes", "")

        clearance, _ = ExitClearance.objects.get_or_create(
            exit_request=exit_req,
            department=dept
        )
        clearance.is_cleared = is_cleared
        clearance.cleared_by = user
        clearance.cleared_at = timezone.now()
        clearance.notes = notes
        clearance.save()

        # Check if all 4 clearances are signed
        all_cleared = all(c.is_cleared for c in exit_req.clearance_items.all())
        if all_cleared and exit_req.status == ExitStatus.CLEARANCE_IN_PROGRESS:
            exit_req.status = ExitStatus.FINAL_SETTLEMENT
            exit_req.save()

        return Response(ExitRequestSerializer(exit_req).data)

    @action(detail=True, methods=["post"])
    def complete_separation(self, request, pk=None):
        exit_req = self.get_object()
        user = request.user
        role = getattr(user, "role", "")

        if role not in ["SUPER_ADMIN", "HR_ADMIN"]:
            return Response(
                {"error": "Only HR Administrators can finalize employee exit and issue relieving letters."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ExitInterviewInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exit_req.exit_interview_completed = True
        exit_req.exit_interview_notes = data["exit_interview_notes"]
        exit_req.retention_discussion = data.get("retention_discussion", "")
        exit_req.would_recommend_company = data.get("would_recommend_company", True)
        exit_req.relieving_letter_issued = data.get("relieving_letter_issued", True)
        exit_req.status = ExitStatus.COMPLETED
        exit_req.save()

        # Update employee status to inactive/terminated
        emp = exit_req.employee
        emp.status = EmploymentStatus.INACTIVE
        emp.save()

        return Response(ExitRequestSerializer(exit_req).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        courses_count = TrainingCourse.objects.count()
        enrollments_count = TrainingEnrollment.objects.count()
        completed_enrollments = TrainingEnrollment.objects.filter(status=EnrollmentStatus.COMPLETED).count()
        certifications_count = EmployeeCertification.objects.count()

        avg_rating = TrainingEnrollment.objects.filter(feedback_rating__isnull=False).aggregate(
            a=Avg("feedback_rating")
        )["a"] or 4.8
        avg_rating = round(float(avg_rating), 1)

        ongoing_exits = ExitRequest.objects.exclude(
            status__in=[ExitStatus.COMPLETED, ExitStatus.WITHDRAWN]
        ).count()
        completed_exits = ExitRequest.objects.filter(status=ExitStatus.COMPLETED).count()

        return Response({
            "total_courses": courses_count,
            "total_enrollments": enrollments_count,
            "completed_enrollments": completed_enrollments,
            "active_certifications": certifications_count,
            "average_course_rating": avg_rating,
            "ongoing_exits": ongoing_exits,
            "completed_exits": completed_exits,
        })
