from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer
from .services import NotificationService


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoints for personal in-app notifications.
    Strictly scoped to the requesting user (request.user).
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Notification.objects.none()

        qs = Notification.objects.filter(recipient=user).select_related("actor")

        unread_only = self.request.query_params.get("unread_only")
        if unread_only and unread_only.lower() in ["true", "1"]:
            qs = qs.filter(is_read=False)

        type_param = self.request.query_params.get("type")
        if type_param:
            qs = qs.filter(notification_type=type_param)

        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        notification = self.get_object()
        notification.mark_as_read()
        return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        now = timezone.now()
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
        ).update(is_read=True, read_at=now)
        return Response({"marked_read": updated_count}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="announcement")
    def create_announcement(self, request):
        """
        Broadcast administrative announcement.
        Requires Super Admin or HR Admin permissions.
        """
        if not (request.user.is_super_admin or request.user.is_hr_admin):
            return Response(
                {"error": "Only administrators can broadcast announcements."},
                status=status.HTTP_403_FORBIDDEN,
            )

        title = request.data.get("title", "").strip()
        message = request.data.get("message", "").strip()
        target_role = request.data.get("target_role")

        if not title or not message:
            return Response(
                {"error": "Both 'title' and 'message' are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_notifications = NotificationService.broadcast_announcement(
            title=title,
            message=message,
            actor=request.user,
            target_role=target_role,
        )

        return Response(
            {
                "success": True,
                "broadcast_count": len(created_notifications),
                "title": title,
            },
            status=status.HTTP_201_CREATED,
        )
