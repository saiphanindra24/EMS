from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "is_read",
            "read_at",
            "actor",
            "actor_name",
            "actor_email",
            "target_model",
            "target_id",
            "target_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor else "System"

    def get_actor_email(self, obj):
        return obj.actor.email if obj.actor else ""
