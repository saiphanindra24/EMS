// ─── Real-Time WebSocket Client for Chat & WebRTC Signaling ─────────────────
import { API_BASE_URL } from "./apiClient";

export const getUserSlug = (user) => {
  if (!user) return "guest";
  if (user.email) {
    const local = user.email.split("@")[0].toLowerCase();
    return local.split(".")[0];
  }
  return (user.first_name || "user").toLowerCase();
};

export const getCanonicalRoomId = (itemId, user) => {
  if (!itemId) return "c-scrum";
  if (itemId.startsWith("c-")) return itemId;
  if (itemId.startsWith("dm_")) return itemId;

  let contactSlug = itemId.replace(/^dm-/, "");
  const mySlug = getUserSlug(user);
  const sorted = [mySlug, contactSlug].sort();
  return `dm_${sorted[0]}_${sorted[1]}`;
};

export class ChatWebSocketClient {
  constructor(roomName, onMessageReceived, onSignalReceived) {
    this.roomName = roomName;
    this.onMessageReceived = onMessageReceived;
    this.onSignalReceived = onSignalReceived;
    this.ws = null;
    this.reconnectTimer = null;
    this.isClosedExplicitly = false;
    this.connect();
  }

  connect() {
    this.isClosedExplicitly = false;
    let wsUrl;
    if (import.meta.env.VITE_WS_URL) {
      const baseWs = import.meta.env.VITE_WS_URL.replace(/\/+$/, "");
      wsUrl = `${baseWs}/ws/chat/${this.roomName}/`;
    } else if (API_BASE_URL) {
      const wsProto = API_BASE_URL.startsWith("https:") ? "wss:" : "ws:";
      const hostPart = API_BASE_URL.replace(/^https?:\/\//, "");
      wsUrl = `${wsProto}//${hostPart}/ws/chat/${this.roomName}/`;
    } else {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname || "127.0.0.1";
      const port = 8000;
      wsUrl = `${protocol}//${host}:${port}/ws/chat/${this.roomName}/`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Connected to Django Channels
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat_message") {
            if (this.onMessageReceived) {
              this.onMessageReceived(data);
            }
          } else {
            // WebRTC signals (webrtc_offer, webrtc_answer, ice_candidate, call_user, screen_share, etc.)
            if (this.onSignalReceived) {
              this.onSignalReceived(data);
            }
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message", err);
        }
      };

      this.ws.onclose = () => {
        if (!this.isClosedExplicitly) {
          // Attempt reconnect after 3 seconds
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("Chat WebSocket error", err);
      };
    } catch (e) {
      console.warn("Unable to establish WebSocket connection", e);
    }
  }

  sendMessage(messagePayload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "chat_message",
          ...messagePayload,
        })
      );
      return true;
    }
    return false;
  }

  sendSignal(signalType, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: signalType,
          ...payload,
        })
      );
      return true;
    }
    return false;
  }

  disconnect() {
    this.isClosedExplicitly = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
