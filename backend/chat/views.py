from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import Message


class MessageHistoryView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, room_name):
        query = Message.objects.filter(room=room_name)
        if not query.exists() and room_name.startswith("dm_"):
            parts = room_name.split("_")[1:]
            legacy_rooms = [f"dm-{p}" for p in parts]
            query = Message.objects.filter(room__in=[room_name] + legacy_rooms)

        messages = query.order_by("created_at")[:100]
        data = [
            {
                "id": m.id,
                "sender": m.sender_name,
                "initials": m.sender_initials or m.sender_name[:2].upper(),
                "text": m.content,
                "isCallInvite": m.is_call_invite,
                "callType": m.call_type,
                "reactions": m.reactions,
                "time": m.created_at.strftime("%I:%M %p"),
            }
            for m in messages
        ]
        return Response({"room": room_name, "results": data})
