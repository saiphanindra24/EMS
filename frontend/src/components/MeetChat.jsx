import { useState, useEffect, useRef } from "react";
import "./MeetChat.css";
import { useAuth } from "../context/AuthContext";
import VideoCallModal from "./VideoCallModal";
import { ChatWebSocketClient, getUserSlug, getCanonicalRoomId } from "../services/chatSocket";
import { API_BASE_URL } from "../services/apiClient";

// ─── Preset Workplace Channels ───────────────────────────────────────────────
export const INITIAL_CHANNELS = [
  {
    id: "c-scrum",
    name: "daily-scrum",
    description: "Daily Morning Scrum (09:30 AM) & Evening Work Updates",
    unread: 0,
  },
  {
    id: "c-general",
    name: "general",
    description: "Company-wide updates, events, and workplace discussions",
    unread: 0,
  },
  {
    id: "c-engineering",
    name: "engineering",
    description: "Technical architecture, sprint tasks, and GitHub PR reviews",
    unread: 0,
  },
  {
    id: "c-product",
    name: "product-design",
    description: "Product roadmap, feature specs, and Figma reviews",
    unread: 0,
  },
];

// ─── Preset Workplace Direct Message Contacts ────────────────────────────────
export const INITIAL_CONTACTS = [
  {
    id: "dm-priya",
    slug: "priya",
    name: "Priya Sharma",
    role: "HR Admin",
    status: "online",
    avatarColor: "#059669",
    unread: 0,
  },
  {
    id: "dm-arjun",
    slug: "arjun",
    name: "Arjun Mehta",
    role: "Backend Engineer",
    status: "online",
    avatarColor: "#2563eb",
    unread: 0,
  },
  {
    id: "dm-ananya",
    slug: "ananya",
    name: "Ananya Rao",
    role: "Frontend Engineer",
    status: "online",
    avatarColor: "#7c3aed",
    unread: 0,
  },
  {
    id: "dm-admin",
    slug: "admin",
    name: "System Admin",
    role: "Chief Technology Officer",
    status: "online",
    avatarColor: "#dc2626",
    unread: 0,
  },
];

// ─── Initial Message Threads ─────────────────────────────────────────────────
const INITIAL_MESSAGES = {
  "c-scrum": [
    {
      id: "seed-1",
      sender: "Priya Sharma",
      initials: "PS",
      text: "Good morning team! Morning Scrum call is starting at 09:30 AM. Please prepare your updates on active sprint tasks.",
      time: "09:25 AM",
      reactions: ["👍 3", "🚀 2"],
    },
    {
      id: "seed-2",
      sender: "Arjun Mehta",
      initials: "AM",
      text: "Working on PostgreSQL indexing and connection pooling optimizations today. No blockers.",
      time: "09:28 AM",
      reactions: ["💪 1"],
    },
    {
      id: "seed-3",
      sender: "System",
      initials: "EM",
      isCallInvite: true,
      text: "Daily Morning Scrum Call room is now live.",
      time: "09:30 AM",
    },
  ],
  "c-general": [
    {
      id: "seed-10",
      sender: "Priya Sharma",
      initials: "PS",
      text: "Welcome to the SSKATT EWTS Workplace Suite! New calendar features and video calling are now active.",
      time: "Yesterday",
      reactions: ["🎉 5"],
    },
  ],
  "c-engineering": [
    {
      id: "seed-20",
      sender: "Arjun Mehta",
      initials: "AM",
      text: "Code review requested for task #TSK-101 (Calendar Workplace Integration). All unit tests passing.",
      time: "Yesterday",
      reactions: ["👀 2"],
    },
  ],
  "c-product": [
    {
      id: "seed-30",
      sender: "Ananya Rao",
      initials: "AR",
      text: "Uploaded revised UX prototypes for interactive video rooms and screen share controls.",
      time: "2 days ago",
    },
  ],
  "dm-priya": [
    {
      id: "seed-40",
      sender: "Priya Sharma",
      initials: "PS",
      text: "Hi! Quick reminder to verify your attendance check-in for today's morning shift.",
      time: "09:15 AM",
    },
  ],
  "dm-arjun": [
    {
      id: "seed-50",
      sender: "Arjun Mehta",
      initials: "AM",
      text: "Let's jump on a quick screen share call to verify the WebRTC video audio pipeline when you're free.",
      time: "09:20 AM",
    },
  ],
};

export default function MeetChat({
  initialChannel = "c-scrum",
  targetChatRoom = null,
  autoOpenCall = false,
}) {
  const { user } = useAuth();
  const mySlug = getUserSlug(user);

  const resolveInitialItem = () => {
    if (targetChatRoom) {
      if (targetChatRoom.startsWith("dm_")) {
        const parts = targetChatRoom.split("_").slice(1);
        const otherSlug = parts.find((p) => p !== mySlug) || parts[0];
        const contact = INITIAL_CONTACTS.find((c) => c.slug === otherSlug);
        if (contact) return contact.id;
      }
      return targetChatRoom;
    }
    return initialChannel;
  };

  const [activeItem, setActiveItem] = useState(resolveInitialItem);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("emwts_chat_threads_v2");
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });

  const [inputText, setInputText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Video / Audio / Screen Share Call Modal state
  const [isCallOpen, setIsCallOpen] = useState(autoOpenCall);
  const [callMode, setCallMode] = useState("video"); // "video" | "voice" | "screen"
  const [callRoomTitle, setCallRoomTitle] = useState("Workplace Conference");

  // Incoming call notification state
  const [incomingCall, setIncomingCall] = useState(null);

  // WebSocket reference
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Sync targetChatRoom prop changes
  useEffect(() => {
    if (targetChatRoom) {
      if (targetChatRoom.startsWith("dm_")) {
        const parts = targetChatRoom.split("_").slice(1);
        const otherSlug = parts.find((p) => p !== mySlug) || parts[0];
        const contact = INITIAL_CONTACTS.find((c) => c.slug === otherSlug);
        if (contact) setActiveItem(contact.id);
      } else {
        setActiveItem(targetChatRoom);
      }
      if (autoOpenCall) {
        setIsCallOpen(true);
      }
    }
  }, [targetChatRoom, mySlug, autoOpenCall]);

  // Derive canonical room name for WebSocket and backend storage
  const wsRoomName = getCanonicalRoomId(activeItem, user);

  // Active channel/contact metadata
  const currentChannel = INITIAL_CHANNELS.find((c) => c.id === activeItem);
  const currentContact = INITIAL_CONTACTS.find((c) => c.id === activeItem);

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeItem, wsRoomName]);

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem("emwts_chat_threads_v2", JSON.stringify(messages));
  }, [messages]);

  // Load message history from backend REST API
  useEffect(() => {
    let isMounted = true;
    fetch(`${API_BASE_URL}/api/v1/chat/history/${wsRoomName}/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!isMounted || !data?.results?.length) return;
        setMessages((prev) => {
          const currentList = prev[wsRoomName] || prev[activeItem] || [];
          const existingIds = new Set(currentList.map((m) => String(m.id)));
          const newItems = data.results.filter((m) => !existingIds.has(String(m.id)));
          if (!newItems.length) return prev;
          return {
            ...prev,
            [wsRoomName]: [...currentList, ...newItems],
          };
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [wsRoomName, activeItem]);

  // Setup WebSocket connection to Django Channels
  useEffect(() => {
    const handleWsMessage = (msgData) => {
      const newMsg = {
        id: msgData.id || `ws-${Date.now()}`,
        sender: msgData.sender_name,
        initials: msgData.sender_initials,
        text: msgData.content,
        isCallInvite: msgData.is_call_invite,
        callType: msgData.call_type,
        reactions: msgData.reactions || [],
        time: msgData.created_at || "Just now",
        isSelf: msgData.sender_name === (user?.full_name || user?.first_name),
      };

      setMessages((prev) => {
        const thread = prev[wsRoomName] || prev[activeItem] || [];
        if (thread.some((m) => String(m.id) === String(newMsg.id))) {
          return prev;
        }
        return {
          ...prev,
          [wsRoomName]: [...thread, newMsg],
        };
      });
    };

    const handleWsSignal = (signalData) => {
      if (signalData.type === "call_user") {
        setIncomingCall({
          caller: signalData.caller_name || "Coworker",
          room: signalData.room_name || wsRoomName,
          callType: signalData.call_type || "video",
        });
      } else if (signalData.type === "call_ended") {
        setIncomingCall(null);
      }
    };

    const client = new ChatWebSocketClient(
      wsRoomName,
      handleWsMessage,
      handleWsSignal
    );
    socketRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [wsRoomName, activeItem, user]);

  const activeTitle = currentChannel
    ? `#${currentChannel.name}`
    : currentContact?.name || "Conversation";

  const activeSubtitle = currentChannel
    ? currentChannel.description
    : `${currentContact?.role || "Colleague"} · ${currentContact?.status === "online" ? "🟢 Online" : "🟡 Away"}`;

  // Start Call Handler (broadcasts signaling to peers via WebSocket)
  const handleStartCall = (mode = "video") => {
    setCallMode(mode);
    const roomTitle = currentChannel
      ? `${currentChannel.name.toUpperCase()} Room`
      : `Call with ${currentContact?.name || "Colleague"}`;
    setCallRoomTitle(roomTitle);
    setIsCallOpen(true);

    // Notify peers in this channel over WebSocket
    const myName = user?.full_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "You";
    socketRef.current?.sendSignal("call_user", {
      caller_name: myName,
      room_name: wsRoomName,
      target_user: currentContact?.slug || "",
      call_type: mode,
    });
  };

  // Send Message Handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const myName = user?.full_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "You";
    const myInitials = user
      ? ((user.first_name?.[0] ?? "") + (user.last_name?.[0] ?? "")).toUpperCase() || "ME"
      : "ME";

    const sentOverWs = socketRef.current?.sendMessage({
      sender_name: myName,
      sender_initials: myInitials,
      content: inputText,
      is_call_invite: false,
      call_type: "",
      reactions: [],
      target_user: currentContact?.slug || "",
    });

    if (!sentOverWs) {
      // Optimistic local fallback
      const newMsg = {
        id: `local-${Date.now()}`,
        sender: myName,
        initials: myInitials,
        text: inputText,
        time: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "numeric", hour12: true }).format(new Date()),
        isSelf: true,
      };

      setMessages((prev) => ({
        ...prev,
        [wsRoomName]: [...(prev[wsRoomName] || prev[activeItem] || []), newMsg],
      }));
    }

    setInputText("");
  };

  const currentThread = messages[wsRoomName] || messages[activeItem] || [];

  return (
    <div className="meet-chat-container">
      {/* ─── Incoming Call Toast Banner ──────────────────────────────────────── */}
      {incomingCall && !isCallOpen && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 3000,
            background: "#0f172a",
            color: "#ffffff",
            padding: "16px 20px",
            borderRadius: 10,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
            border: "1px solid #7c3aed",
            display: "flex",
            alignItems: "center",
            gap: 16,
            animation: "modalPop 0.2s ease-out",
          }}
        >
          <span style={{ fontSize: 24 }}>📞</span>
          <div>
            <strong style={{ fontSize: 14 }}>Incoming {incomingCall.callType.toUpperCase()} Call</strong>
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              {incomingCall.caller} is calling in #{incomingCall.room}
            </div>
          </div>
          <button
            type="button"
            style={{
              background: "#10b981",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={() => {
              handleStartCall(incomingCall.callType);
              setIncomingCall(null);
            }}
          >
            Accept
          </button>
          <button
            type="button"
            style={{
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={() => setIncomingCall(null)}
          >
            Decline
          </button>
        </div>
      )}

      {/* ─── Left Sidebar: Channels & Direct Messages ────────────────────────── */}
      <aside className="mc-sidebar">
        <div className="mc-sidebar-header">
          <h2>
            <span>💬</span> Meet &amp; Chat
          </h2>
          <button
            type="button"
            className="mc-instant-call-btn"
            onClick={() => handleStartCall("video")}
            title="Start Instant Video Meeting"
          >
            <span>📹</span> Meet Now
          </button>
        </div>

        <div className="mc-search-box">
          <input
            type="search"
            className="mc-search-input"
            placeholder="Search channels or teammates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="mc-sidebar-scroll">
          {/* Channels Section */}
          <div>
            <div className="mc-section-title">
              <span>CHANNELS</span>
              <span style={{ fontSize: 13, cursor: "pointer" }} title="Create Channel">+</span>
            </div>
            <div className="mc-list">
              {INITIAL_CHANNELS.filter((c) =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((chan) => (
                <button
                  key={chan.id}
                  type="button"
                  className={`mc-item-btn ${activeItem === chan.id ? "active" : ""}`}
                  onClick={() => setActiveItem(chan.id)}
                >
                  <div className="mc-item-left">
                    <span className="mc-channel-icon">#</span>
                    <span className="mc-item-name">{chan.name}</span>
                  </div>
                  {chan.unread > 0 && activeItem !== chan.id && (
                    <span className="mc-unread-badge">{chan.unread}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Direct Messages Section */}
          <div>
            <div className="mc-section-title">
              <span>DIRECT MESSAGES</span>
              <span style={{ fontSize: 13, cursor: "pointer" }} title="Start direct chat">+</span>
            </div>
            <div className="mc-list">
              {INITIAL_CONTACTS.filter((c) =>
                c.slug !== mySlug &&
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((contact) => {
                const initials = contact.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("");
                return (
                  <button
                    key={contact.id}
                    type="button"
                    className={`mc-item-btn ${activeItem === contact.id ? "active" : ""}`}
                    onClick={() => setActiveItem(contact.id)}
                  >
                    <div className="mc-item-left">
                      <div
                        className="mc-avatar-badge"
                        style={{ backgroundColor: contact.avatarColor }}
                      >
                        {initials}
                        <span className={`mc-status-dot ${contact.status}`} />
                      </div>
                      <span className="mc-item-name">{contact.name}</span>
                    </div>
                    {contact.unread > 0 && activeItem !== contact.id && (
                      <span className="mc-unread-badge">{contact.unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Chat & Communication Window ───────────────────────────────── */}
      <section className="mc-main">
        {/* Header with Call & Screen Share Buttons */}
        <header className="mc-header">
          <div className="mc-header-info">
            <div>
              <h3 className="mc-header-title">{activeTitle}</h3>
              <div className="mc-header-subtitle">{activeSubtitle}</div>
            </div>
          </div>

          {/* Quick Call Action Bar */}
          <div className="mc-header-actions">
            <button
              type="button"
              className="mc-call-btn"
              onClick={() => handleStartCall("voice")}
              title="Start Voice Call"
            >
              <span>📞</span> Voice Call
            </button>
            <button
              type="button"
              className="mc-call-btn primary"
              onClick={() => handleStartCall("video")}
              title="Start Video Meeting"
            >
              <span>📹</span> Video Call
            </button>
            <button
              type="button"
              className="mc-call-btn screen"
              onClick={() => handleStartCall("screen")}
              title="Start Live Screen Share"
            >
              <span>🖥️</span> Share Screen
            </button>
          </div>
        </header>

        {/* Message Feed */}
        <div className="mc-messages-feed">
          {currentThread.map((msg) => (
            <div
              key={msg.id}
              className={`mc-message-card ${msg.isSelf ? "self" : ""}`}
            >
              <div className="mc-msg-avatar">{msg.initials || "👤"}</div>
              <div className="mc-msg-content">
                <div className="mc-msg-meta">
                  <span className="mc-msg-sender">{msg.sender}</span>
                  <span>{msg.time}</span>
                </div>

                {msg.isCallInvite ? (
                  <div className="mc-call-invite-card">
                    <div>
                      <strong style={{ fontSize: 13, color: "#0f172a" }}>
                        📹 Live Meeting Active
                      </strong>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{msg.text}</div>
                    </div>
                    <button
                      type="button"
                      className="mc-call-invite-btn"
                      onClick={() => handleStartCall("video")}
                    >
                      Join Meeting
                    </button>
                  </div>
                ) : (
                  <div className="mc-msg-bubble">{msg.text}</div>
                )}

                {msg.reactions && msg.reactions.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                    {msg.reactions.map((r, rIdx) => (
                      <span
                        key={rIdx}
                        style={{
                          fontSize: 11,
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 999,
                          padding: "1px 6px",
                          color: "#475569",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="mc-input-container">
          <form className="mc-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="mc-text-input"
              placeholder={`Message ${activeTitle}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <div className="mc-input-actions">
              <button
                type="button"
                className="mc-tool-btn"
                title="Voice note or call"
                onClick={() => handleStartCall("voice")}
              >
                🎙️
              </button>
              <button
                type="button"
                className="mc-tool-btn"
                title="Share Screen"
                onClick={() => handleStartCall("screen")}
              >
                🖥️
              </button>
              <button type="submit" className="mc-send-btn">
                Send
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ─── Video / Voice / Screen Share Modal ─────────────────────────────── */}
      <VideoCallModal
        isOpen={isCallOpen}
        roomName={callRoomTitle}
        initialMode={callMode}
        currentUser={user}
        onClose={() => {
          setIsCallOpen(false);
          socketRef.current?.sendSignal("call_ended", { room_name: activeItem });
        }}
      />
    </div>
  );
}
