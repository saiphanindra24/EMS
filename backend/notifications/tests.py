from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role
from .models import Notification, NotificationType
from .services import NotificationService

User = get_user_model()


class NotificationTests(APITestCase):
    def setUp(self):
        # Create users
        self.super_admin = User.objects.create_user(
            email="admin@example.com",
            password="Password123!",
            first_name="Admin",
            last_name="Super",
            role=Role.SUPER_ADMIN,
        )

        self.user_alice = User.objects.create_user(
            email="alice@example.com",
            password="Password123!",
            first_name="Alice",
            last_name="Smith",
            role=Role.EMPLOYEE,
        )

        self.user_bob = User.objects.create_user(
            email="bob@example.com",
            password="Password123!",
            first_name="Bob",
            last_name="Jones",
            role=Role.EMPLOYEE,
        )

        self.list_url = reverse("notification-list")
        self.unread_count_url = reverse("notification-unread-count")
        self.mark_all_read_url = reverse("notification-mark-all-read")
        self.announcement_url = reverse("notification-create-announcement")

    def test_notification_creation_and_visibility(self):
        # Create notification for Alice
        n1 = NotificationService.create_notification(
            recipient=self.user_alice,
            actor=self.super_admin,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="Task 1 Assigned",
            message="You were assigned Task 1",
            target_model="task",
            target_id="101",
            target_url="/tasks",
        )
        # Create notification for Bob
        NotificationService.create_notification(
            recipient=self.user_bob,
            actor=self.super_admin,
            notification_type=NotificationType.TASK_ASSIGNED,
            title="Task 2 Assigned",
            message="You were assigned Task 2",
        )

        # Alice requests her notifications
        self.client.force_authenticate(user=self.user_alice)
        res = self.client.get(self.list_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Alice should only see her 1 notification, never Bob's!
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], n1.id)
        self.assertEqual(res.data[0]["title"], "Task 1 Assigned")
        self.assertEqual(res.data[0]["actor_name"], "Admin Super")

    def test_unread_count_and_mark_as_read(self):
        n1 = NotificationService.create_notification(
            recipient=self.user_alice,
            notification_type=NotificationType.ATTENDANCE_REMINDER,
            title="Check In Reminder",
            message="Don't forget to check in today.",
        )
        n2 = NotificationService.create_notification(
            recipient=self.user_alice,
            notification_type=NotificationType.LEAVE_APPROVED,
            title="Leave Approved",
            message="Your annual leave was approved.",
        )

        self.client.force_authenticate(user=self.user_alice)
        # Initial unread count should be 2
        res = self.client.get(self.unread_count_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["unread_count"], 2)

        # Mark single notification as read
        read_url = reverse("notification-read", args=[n1.id])
        res_read = self.client.post(read_url)
        self.assertEqual(res_read.status_code, status.HTTP_200_OK)
        self.assertTrue(res_read.data["is_read"])

        # Unread count should now be 1
        res_after = self.client.get(self.unread_count_url)
        self.assertEqual(res_after.data["unread_count"], 1)

    def test_mark_all_read(self):
        NotificationService.create_notification(
            recipient=self.user_alice,
            notification_type=NotificationType.TASK_OVERDUE,
            title="Task Overdue",
            message="Your task is overdue",
        )
        NotificationService.create_notification(
            recipient=self.user_alice,
            notification_type=NotificationType.LEAVE_SUBMITTED,
            title="Leave Request Submitted",
            message="Leave request received",
        )

        self.client.force_authenticate(user=self.user_alice)
        res = self.client.post(self.mark_all_read_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["marked_read"], 2)

        # Check unread count is 0
        res_count = self.client.get(self.unread_count_url)
        self.assertEqual(res_count.data["unread_count"], 0)

    def test_deduplication_prevents_duplicate_spam(self):
        dedup_key = "TASK_OVERDUE:55:2026-10-08"
        n1 = NotificationService.create_notification(
            recipient=self.user_alice,
            notification_type=NotificationType.TASK_OVERDUE,
            title="Task #55 is overdue",
            message="Warning 1",
            deduplication_key=dedup_key,
        )
        # Second call with identical deduplication key
        n2 = NotificationService.create_notification(
            recipient=self.user_alice,
            notification_type=NotificationType.TASK_OVERDUE,
            title="Task #55 is overdue",
            message="Warning 2",
            deduplication_key=dedup_key,
        )
        self.assertEqual(n1.id, n2.id)
        self.assertEqual(Notification.objects.filter(recipient=self.user_alice).count(), 1)

    def test_admin_announcement_broadcast(self):
        # Admin broadcasts announcement
        self.client.force_authenticate(user=self.super_admin)
        payload = {
            "title": "Office Town Hall Meeting",
            "message": "All hands meeting tomorrow at 10:00 AM.",
        }
        res = self.client.post(self.announcement_url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data["success"])

        # Check that Alice received the announcement
        self.client.force_authenticate(user=self.user_alice)
        res_alice = self.client.get(self.list_url)
        self.assertTrue(any(item["title"] == "Office Town Hall Meeting" for item in res_alice.data))

    def test_regular_employee_cannot_broadcast_announcements(self):
        self.client.force_authenticate(user=self.user_alice)
        payload = {
            "title": "Unauthorized Announcement",
            "message": "Should be blocked.",
        }
        res = self.client.post(self.announcement_url, payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
