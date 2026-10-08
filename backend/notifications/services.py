import logging
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Notification, NotificationType

logger = logging.getLogger("notifications.services")
User = get_user_model()


class NotificationService:
    @staticmethod
    def create_notification(
        recipient,
        notification_type,
        title,
        message,
        actor=None,
        target_model="",
        target_id="",
        target_url="",
        deduplication_key="",
    ):
        """
        Creates an in-app notification with optional deduplication.
        If deduplication_key already exists for this recipient, returns the existing record.
        """
        if not recipient:
            return None

        # Do not notify oneself for their own direct actions (e.g. self-assigned task)
        if actor and recipient.id == actor.id and notification_type != NotificationType.ATTENDANCE_REMINDER:
            return None

        if deduplication_key:
            existing = Notification.objects.filter(
                recipient=recipient,
                deduplication_key=deduplication_key,
            ).first()
            if existing:
                return existing

        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            title=title,
            message=message,
            target_model=target_model,
            target_id=str(target_id),
            target_url=target_url,
            deduplication_key=deduplication_key,
        )
        logger.info(f"Notification #{notification.id} created for {recipient.email}: {title}")
        return notification

    @staticmethod
    def notify_task_assigned(task, actor=None):
        if not task.assignee or not task.assignee.user:
            return None

        recipient = task.assignee.user
        actor_name = actor.full_name if actor else "Manager"
        return NotificationService.create_notification(
            recipient=recipient,
            actor=actor,
            notification_type=NotificationType.TASK_ASSIGNED,
            title=f"New Task Assigned: {task.title}",
            message=f"{actor_name} assigned you the task '{task.title}' (Due: {task.due_date}). Priority: {task.priority}.",
            target_model="task",
            target_id=task.id,
            target_url="/tasks",
            deduplication_key=f"TASK_ASSIGNED:{task.id}:{recipient.id}",
        )

    @staticmethod
    def notify_task_deadline_approaching(task):
        if not task.assignee or not task.assignee.user:
            return None

        recipient = task.assignee.user
        today = timezone.localdate().isoformat()
        return NotificationService.create_notification(
            recipient=recipient,
            notification_type=NotificationType.TASK_DEADLINE_APPROACHING,
            title=f"Task Deadline Approaching: {task.title}",
            message=f"Task '{task.title}' is due soon on {task.due_date}. Current status: {task.status}.",
            target_model="task",
            target_id=task.id,
            target_url="/tasks",
            deduplication_key=f"TASK_DEADLINE:{task.id}:{today}",
        )

    @staticmethod
    def notify_task_overdue(task):
        if not task.assignee or not task.assignee.user:
            return None

        recipient = task.assignee.user
        today = timezone.localdate().isoformat()
        return NotificationService.create_notification(
            recipient=recipient,
            notification_type=NotificationType.TASK_OVERDUE,
            title=f"Task Overdue: {task.title}",
            message=f"Task '{task.title}' was due on {task.due_date} and is currently overdue. Please update your progress.",
            target_model="task",
            target_id=task.id,
            target_url="/tasks",
            deduplication_key=f"TASK_OVERDUE:{task.id}:{today}",
        )

    @staticmethod
    def notify_leave_submitted(leave_request):
        employee = leave_request.employee
        actor = employee.user
        notified_users = set()

        # 1. Notify direct manager if assigned
        if employee.manager and employee.manager.user:
            notified_users.add(employee.manager.user)

        # 2. Notify HR Admins
        hr_admins = User.objects.filter(role__in=["SUPER_ADMIN", "HR_ADMIN"], is_active=True)
        for hr in hr_admins:
            notified_users.add(hr)

        results = []
        for recipient in notified_users:
            n = NotificationService.create_notification(
                recipient=recipient,
                actor=actor,
                notification_type=NotificationType.LEAVE_SUBMITTED,
                title=f"New Leave Request from {actor.full_name}",
                message=f"{actor.full_name} submitted a request for {leave_request.leave_type.name} ({leave_request.start_date} to {leave_request.end_date}, {leave_request.duration_days} days).",
                target_model="leave",
                target_id=leave_request.id,
                target_url="/leave",
                deduplication_key=f"LEAVE_SUBMITTED:{leave_request.id}:{recipient.id}",
            )
            results.append(n)
        return results

    @staticmethod
    def notify_leave_approved(leave_request, reviewer=None):
        recipient = leave_request.employee.user
        reviewer_name = reviewer.full_name if reviewer else "Management"
        return NotificationService.create_notification(
            recipient=recipient,
            actor=reviewer,
            notification_type=NotificationType.LEAVE_APPROVED,
            title="Leave Request Approved",
            message=f"Your request for {leave_request.leave_type.name} ({leave_request.start_date} to {leave_request.end_date}) has been approved by {reviewer_name}.",
            target_model="leave",
            target_id=leave_request.id,
            target_url="/leave",
            deduplication_key=f"LEAVE_APPROVED:{leave_request.id}",
        )

    @staticmethod
    def notify_leave_rejected(leave_request, reviewer=None, rejection_reason=""):
        recipient = leave_request.employee.user
        reviewer_name = reviewer.full_name if reviewer else "Management"
        reason_msg = f" Reason: '{rejection_reason}'" if rejection_reason else ""
        return NotificationService.create_notification(
            recipient=recipient,
            actor=reviewer,
            notification_type=NotificationType.LEAVE_REJECTED,
            title="Leave Request Rejected",
            message=f"Your request for {leave_request.leave_type.name} ({leave_request.start_date} to {leave_request.end_date}) was rejected by {reviewer_name}.{reason_msg}",
            target_model="leave",
            target_id=leave_request.id,
            target_url="/leave",
            deduplication_key=f"LEAVE_REJECTED:{leave_request.id}",
        )

    @staticmethod
    def broadcast_announcement(title, message, actor=None, target_role=None):
        qs = User.objects.filter(is_active=True)
        if target_role:
            qs = qs.filter(role=target_role)

        results = []
        for user in qs:
            n = NotificationService.create_notification(
                recipient=user,
                actor=actor,
                notification_type=NotificationType.ANNOUNCEMENT,
                title=title,
                message=message,
                target_model="announcement",
                target_url="/",
            )
            results.append(n)
        return results
