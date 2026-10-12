import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .models import Message


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except Exception:
            return

        msg_type = data.get("type", "chat_message")
        sender_name = data.get("sender_name") or data.get("caller_name") or "Anonymous"
        sender_initials = data.get("sender_initials", "A")

        # ── 1. Text Chat Message ──
        if msg_type == "chat_message":
            content = data.get("content", "").strip()
            is_call_invite = data.get("is_call_invite", False)
            call_type = data.get("call_type", "")
            reactions = data.get("reactions", [])
            target_user = data.get("target_user", "")

            if not content and not is_call_invite:
                return

            saved_msg = await self.save_message(
                room=self.room_name,
                sender_name=sender_name,
                sender_initials=sender_initials,
                content=content,
                is_call_invite=is_call_invite,
                call_type=call_type,
                reactions=reactions,
            )

            created_time_str = saved_msg.created_at.strftime("%I:%M %p")

            # Broadcast to the room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_chat_message",
                    "id": saved_msg.id,
                    "sender_name": sender_name,
                    "sender_initials": sender_initials,
                    "content": content,
                    "is_call_invite": is_call_invite,
                    "call_type": call_type,
                    "reactions": reactions,
                    "created_at": created_time_str,
                }
            )

            # Also notify target user personal channels if this is a DM or has a target
            target_slugs = []
            if self.room_name.startswith("dm_"):
                parts = self.room_name.split("_")[1:]
                target_slugs.extend(parts)
            if target_user:
                target_slugs.append(target_user.lower())

            for slug in set(target_slugs):
                await self.channel_layer.group_send(
                    f"chat_user_{slug}",
                    {
                        "type": "broadcast_user_notification",
                        "notification_type": "chat_message",
                        "sender_name": sender_name,
                        "sender_initials": sender_initials,
                        "room_name": self.room_name,
                        "content": content,
                        "is_call_invite": is_call_invite,
                        "call_type": call_type,
                        "created_at": created_time_str,
                    }
                )

        # ── 2. WebRTC Call Signaling (Offers, Answers, ICE, Screen Share) ──
        elif msg_type in [
            "call_user",
            "call_accepted",
            "call_declined",
            "call_ended",
            "webrtc_offer",
            "webrtc_answer",
            "ice_candidate",
            "screen_share_started",
            "screen_share_stopped",
            "hand_raise",
        ]:
            # Forward signal to everyone in the room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "broadcast_signal",
                    "sender_channel_name": self.channel_name,
                    "signal_type": msg_type,
                    "payload": data,
                }
            )

            # If initiating or ending a call, also broadcast to user personal channels
            if msg_type in ["call_user", "call_ended"]:
                target_user = data.get("target_user", "")
                target_slugs = []
                if self.room_name.startswith("dm_"):
                    parts = self.room_name.split("_")[1:]
                    target_slugs.extend(parts)
                elif self.room_name.startswith("c-") or self.room_name in ["scrum", "general"]:
                    target_slugs.extend(["admin", "ananya", "arjun", "priya"])

                if target_user:
                    target_slugs.append(target_user.lower())

                for slug in set(target_slugs):
                    await self.channel_layer.group_send(
                        f"chat_user_{slug}",
                        {
                            "type": "broadcast_user_notification",
                            "notification_type": msg_type,
                            "sender_name": sender_name,
                            "sender_initials": sender_initials,
                            "room_name": self.room_name,
                            "call_type": data.get("call_type", "video"),
                            "payload": data,
                        }
                    )

    # ── Handlers for group_send ──
    async def broadcast_chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "id": event["id"],
            "sender_name": event["sender_name"],
            "sender_initials": event["sender_initials"],
            "content": event["content"],
            "is_call_invite": event["is_call_invite"],
            "call_type": event["call_type"],
            "reactions": event["reactions"],
            "created_at": event["created_at"],
        }))

    async def broadcast_signal(self, event):
        # Do not send back to the initiator
        if self.channel_name != event.get("sender_channel_name"):
            await self.send(text_data=json.dumps({
                "type": event["signal_type"],
                **event["payload"]
            }))

    async def broadcast_user_notification(self, event):
        # Notify the user on their personal channel
        await self.send(text_data=json.dumps({
            "type": "user_notification",
            "notification_type": event.get("notification_type"),
            "sender_name": event.get("sender_name"),
            "sender_initials": event.get("sender_initials", "U"),
            "room_name": event.get("room_name"),
            "content": event.get("content", ""),
            "call_type": event.get("call_type", ""),
            "created_at": event.get("created_at", "Just now"),
            "payload": event.get("payload", {}),
        }))

    @database_sync_to_async
    def save_message(self, room, sender_name, sender_initials, content, is_call_invite, call_type, reactions):
        user = self.scope.get("user")
        user_inst = user if user and user.is_authenticated else None
        return Message.objects.create(
            room=room,
            sender=user_inst,
            sender_name=sender_name,
            sender_initials=sender_initials,
            content=content,
            is_call_invite=is_call_invite,
            call_type=call_type,
            reactions=reactions,
        )
