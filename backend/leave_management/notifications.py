import logging
from django.utils import timezone

logger = logging.getLogger("leave_management.notifications")


def notify_leave_submitted(leave_request):
    """
    Hook called when a leave request is submitted.
    Notifies reporting manager and HR admins.
    """
    try:
        from notifications.services import NotificationService
        NotificationService.notify_leave_submitted(leave_request)
    except Exception as e:
        logger.warning(f"Could not dispatch in-app notification: {e}")

    return {
        "event": "LEAVE_SUBMITTED",
        "recipient_type": "MANAGER_AND_HR",
        "leave_request_id": leave_request.id,
        "timestamp": timezone.now().isoformat(),
    }


def notify_leave_decision(leave_request, decision, reviewer, rejection_reason=""):
    """
    Hook called when a leave request is approved or rejected.
    Notifies the requesting employee.
    """
    try:
        from notifications.services import NotificationService
        if decision == "APPROVED":
            NotificationService.notify_leave_approved(leave_request, reviewer=reviewer)
        elif decision == "REJECTED":
            NotificationService.notify_leave_rejected(
                leave_request, reviewer=reviewer, rejection_reason=rejection_reason
            )
    except Exception as e:
        logger.warning(f"Could not dispatch in-app notification: {e}")

    return {
        "event": f"LEAVE_{decision}",
        "recipient_user_id": leave_request.employee.user_id,
        "leave_request_id": leave_request.id,
        "timestamp": timezone.now().isoformat(),
    }


def notify_leave_cancelled(leave_request, cancelled_by):
    """
    Hook called when a leave request is cancelled.
    """
    try:
        from notifications.models import NotificationType
        from notifications.services import NotificationService
        # Notify direct manager if assigned
        manager = leave_request.employee.manager
        if manager and manager.user:
            NotificationService.create_notification(
                recipient=manager.user,
                actor=cancelled_by,
                notification_type=NotificationType.ANNOUNCEMENT,
                title="Leave Request Cancelled",
                message=f"{leave_request.employee.user.full_name} cancelled their leave request #{leave_request.id} ({leave_request.start_date} to {leave_request.end_date}).",
                target_model="leave",
                target_id=leave_request.id,
                target_url="/leave",
            )
    except Exception as e:
        logger.warning(f"Could not dispatch in-app notification: {e}")

    return {
        "event": "LEAVE_CANCELLED",
        "leave_request_id": leave_request.id,
        "timestamp": timezone.now().isoformat(),
    }
