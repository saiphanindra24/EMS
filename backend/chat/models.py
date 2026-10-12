from django.conf import settings
from django.db import models


class Message(models.Model):
    room = models.CharField(max_length=100, db_index=True)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
    )
    sender_name = models.CharField(max_length=150)
    sender_initials = models.CharField(max_length=10, blank=True, default="")
    content = models.TextField()
    is_call_invite = models.BooleanField(default=False)
    call_type = models.CharField(max_length=50, blank=True, default="")
    reactions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.room}] {self.sender_name}: {self.content[:30]}"
