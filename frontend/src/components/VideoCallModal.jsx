import { useState, useEffect, useRef } from "react";

export default function VideoCallModal({
  isOpen,
  roomName = "Workplace Conference",
  initialMode = "video", // "video" | "voice" | "screen"
  participants = [],
  currentUser = null,
  onClose,
}) {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(initialMode === "voice");
  const [isScreenSharing, setIsScreenSharing] = useState(initialMode === "screen");
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // In-call messages
  const [inCallMessages, setInCallMessages] = useState([
    { id: 1, sender: "Priya Sharma", text: "Morning everyone! Sharing today's sprint notes.", time: "Just now" },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Call timer
  const [callDuration, setCallDuration] = useState(0);

  // Media stream references
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Simulated peer participants
  const [peers, setPeers] = useState(() => [
    { id: "peer-1", name: "Priya Sharma", role: "HR Admin", initials: "PS", isSpeaking: true, isMuted: false },
    { id: "peer-2", name: "Arjun Mehta", role: "Senior Engineer", initials: "AM", isSpeaking: false, isMuted: true },
  ]);

  // Start call timer
  useEffect(() => {
    if (!isOpen) return;
    setCallDuration(0);
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Format call duration MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Initialize camera and microphone when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initUserMedia() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: initialMode !== "voice",
            audio: true,
          });

          if (!isMounted) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn("Could not access camera/mic (running with simulated workplace media):", err);
      }
    }

    initUserMedia();

    // Auto-launch screen share if opened directly via Share Screen button
    if (initialMode === "screen") {
      startScreenShare();
    }

    return () => {
      isMounted = false;
      stopLocalStream();
      stopScreenShare();
    };
  }, [isOpen, initialMode]);

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
  };

  // Toggle Microphone
  const handleToggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setIsAudioMuted((prev) => !prev);
  };

  // Toggle Camera
  const handleToggleVideo = async () => {
    if (isVideoMuted) {
      // Turn video on
      try {
        if (localStreamRef.current) {
          const videoTracks = localStreamRef.current.getVideoTracks();
          if (videoTracks.length > 0) {
            videoTracks.forEach((t) => (t.enabled = true));
          } else {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newTrack = newStream.getVideoTracks()[0];
            localStreamRef.current.addTrack(newTrack);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          }
        }
      } catch (err) {
        console.warn("Unable to turn on camera:", err);
      }
      setIsVideoMuted(false);
    } else {
      // Turn video off
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach((t) => (t.enabled = false));
      }
      setIsVideoMuted(true);
    }
  };

  // Screen Sharing via browser getDisplayMedia
  const startScreenShare = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }

        // When user clicks the browser native "Stop sharing" bar
        const track = stream.getVideoTracks()[0];
        if (track) {
          track.onended = () => {
            stopScreenShare();
          };
        }
      } else {
        alert("Screen sharing is not supported in this browser environment.");
      }
    } catch (err) {
      console.warn("Screen share canceled or failed:", err);
      setIsScreenSharing(false);
    }
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const handleSendInCallMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg = {
      id: Date.now(),
      sender: currentUser?.first_name || "You",
      text: chatInput,
      time: "Just now",
    };
    setInCallMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  const handleEndCall = () => {
    stopLocalStream();
    stopScreenShare();
    onClose();
  };

  if (!isOpen) return null;

  const currentInitials = currentUser
    ? ((currentUser.first_name?.[0] ?? "") + (currentUser.last_name?.[0] ?? "")).toUpperCase() || "YOU"
    : "YOU";

  return (
    <div className="call-modal-overlay" role="dialog" aria-modal="true">
      <div className="call-modal-container">
        {/* ── Top Bar ── */}
        <header className="call-room-header">
          <div className="call-header-left">
            <span style={{ fontSize: 18 }}>
              {isScreenSharing ? "🖥️" : initialMode === "voice" ? "📞" : "📹"}
            </span>
            <h3 className="call-room-title">{roomName}</h3>
            <span className="call-duration-tag">{formatTimer(callDuration)}</span>
            <span className="call-encrypted-tag">🔒 End-to-End Encrypted</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#cbd5e1", fontSize: 13 }}>
              👥 {peers.length + 1} Participants
            </span>
          </div>
        </header>

        {/* ── Main Stage Area ── */}
        <div className="call-stage-area">
          {/* Active Screen Share Viewport */}
          {isScreenSharing ? (
            <div className="call-screen-share-viewport">
              <div className="call-screen-share-banner">
                <span>🖥️ You are presenting your screen to the meeting</span>
                <button
                  type="button"
                  style={{
                    background: "#ffffff",
                    color: "#0284c7",
                    border: "none",
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                  onClick={stopScreenShare}
                >
                  Stop Presenting
                </button>
              </div>
              <video
                ref={screenVideoRef}
                autoPlay
                playsInline
                className="call-screen-video"
              />
            </div>
          ) : (
            /* Multi-Party Video Gallery Grid */
            <div className="call-video-grid">
              {/* Local Participant Tile */}
              <div
                className={`call-video-tile local ${
                  !isAudioMuted ? "speaking" : ""
                }`}
              >
                {!isVideoMuted ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="call-tile-video-element"
                  />
                ) : (
                  <div className="call-avatar-placeholder">
                    <div
                      className="call-avatar-circle"
                      style={{ background: "#7c3aed" }}
                    >
                      {currentInitials}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Camera Off</span>
                  </div>
                )}

                <div className="call-tile-tag">
                  <span>{currentUser?.full_name || currentUser?.first_name || "You"} (You)</span>
                  <span className="call-tile-status-icon">
                    {isAudioMuted ? "🔇" : "🎙️"}
                  </span>
                  {isHandRaised && <span>✋</span>}
                </div>
              </div>

              {/* Remote Participants Tiles */}
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  className={`call-video-tile ${peer.isSpeaking ? "speaking" : ""}`}
                >
                  <div className="call-avatar-placeholder">
                    <div className="call-avatar-circle">{peer.initials}</div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{peer.name}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{peer.role}</span>
                  </div>

                  <div className="call-tile-tag">
                    <span>{peer.name}</span>
                    <span className="call-tile-status-icon">
                      {peer.isMuted ? "🔇" : "🎙️"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* In-Call Side Chat Drawer */}
          {isChatOpen && (
            <aside className="call-side-chat">
              <div className="call-side-chat-header">
                <span>In-Call Meeting Chat</span>
                <button
                  type="button"
                  className="call-side-chat-close"
                  onClick={() => setIsChatOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="call-side-chat-messages">
                {inCallMessages.map((msg) => (
                  <div key={msg.id} className="call-side-msg-bubble">
                    <div className="call-side-msg-sender">{msg.sender}</div>
                    <div>{msg.text}</div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSendInCallMessage}
                style={{ padding: 10, borderTop: "1px solid #334155", display: "flex", gap: 6 }}
              >
                <input
                  type="text"
                  placeholder="Send a message to meeting..."
                  style={{
                    flex: 1,
                    background: "#1e293b",
                    border: "1px solid #475569",
                    color: "#ffffff",
                    borderRadius: 4,
                    padding: "6px 8px",
                    fontSize: 12,
                    outline: "none",
                  }}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button
                  type="submit"
                  style={{
                    background: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 4,
                    padding: "6px 10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Send
                </button>
              </form>
            </aside>
          )}
        </div>

        {/* ── Bottom Control Floating Dock ── */}
        <div className="call-control-dock">
          {/* Mic */}
          <button
            type="button"
            className={`call-dock-btn ${isAudioMuted ? "muted" : "active"}`}
            onClick={handleToggleAudio}
            aria-label={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isAudioMuted ? "🔇" : "🎙️"}
            <span className="call-dock-tooltip">
              {isAudioMuted ? "Unmute" : "Mute"}
            </span>
          </button>

          {/* Camera */}
          <button
            type="button"
            className={`call-dock-btn ${isVideoMuted ? "muted" : "active"}`}
            onClick={handleToggleVideo}
            aria-label={isVideoMuted ? "Start Camera" : "Stop Camera"}
          >
            {isVideoMuted ? "🚫" : "📹"}
            <span className="call-dock-tooltip">
              {isVideoMuted ? "Start Video" : "Stop Video"}
            </span>
          </button>

          {/* Screen Share */}
          <button
            type="button"
            className={`call-dock-btn ${isScreenSharing ? "screen-active" : ""}`}
            onClick={handleToggleScreenShare}
            aria-label={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
          >
            🖥️
            <span className="call-dock-tooltip">
              {isScreenSharing ? "Stop Share" : "Share Screen"}
            </span>
          </button>

          {/* Hand Raise */}
          <button
            type="button"
            className={`call-dock-btn ${isHandRaised ? "active" : ""}`}
            onClick={() => setIsHandRaised(!isHandRaised)}
            aria-label="Raise Hand"
          >
            ✋
            <span className="call-dock-tooltip">
              {isHandRaised ? "Lower Hand" : "Raise Hand"}
            </span>
          </button>

          {/* In-Call Chat */}
          <button
            type="button"
            className={`call-dock-btn ${isChatOpen ? "active" : ""}`}
            onClick={() => setIsChatOpen(!isChatOpen)}
            aria-label="Toggle In-Call Chat"
          >
            💬
            <span className="call-dock-tooltip">Chat</span>
          </button>

          {/* End Call Button */}
          <button
            type="button"
            className="call-dock-btn end-call"
            onClick={handleEndCall}
            aria-label="Leave Call"
            title="Leave & End Call"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  );
}
