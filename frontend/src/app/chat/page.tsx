"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api, wsUrl } from "@/lib/api";
import { Timer } from "@/components/Timer";
import { TypingIndicator } from "@/components/TypingIndicator";
import { SessionEndModal } from "@/components/SessionEndModal";
import { ReportModal } from "@/components/ReportModal";
import { UserProfileModal } from "@/components/UserProfileModal";
import { avatarUrl } from "@/lib/avatars";
import { FlowLogo } from "@/components/FlowLogo";

interface ChatMessage {
  type: "message";
  from: string;
  text: string;
  ts: number;
}

type WsEvent =
  | ChatMessage
  | { type: "history"; messages: ChatMessage[] }
  | { type: "typing_start"; from: string }
  | { type: "typing_stop"; from: string }
  | { type: "tick"; remaining: number }
  | { type: "session_end" }
  | { type: "peer_left" }
  | { type: "extended"; remaining: number }
  | { type: "error"; detail: string };

function ChatContent() {
  const router = useRouter();
  const params = useSearchParams();
  const roomId = params.get("room_id") ?? "";

  const { token, username } = useAuthStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [remaining, setRemaining] = useState(15 * 60);
  const [peerUsername, setPeerUsername] = useState<string | null>(null);
  const [peerAvatarId, setPeerAvatarId] = useState<number>(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [peerLeft, setPeerLeft] = useState(false);
  const [canExtend, setCanExtend] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [mode, setMode] = useState<"checking" | "live" | "readonly" | "expired">("checking");
  const [showPeerProfile, setShowPeerProfile] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Redirect guards
  useEffect(() => {
    if (!token) { router.push("/verify"); return; }
    if (!username) { router.push("/profile"); return; }
    if (!roomId) { router.push("/lobby"); return; }
  }, [token, username, roomId, router]);

  // Pre-check room status before opening WebSocket
  useEffect(() => {
    if (!token || !roomId) return;
    api.getRoomMessages(token, roomId)
      .then((data) => {
        if (data.status === "ended") {
          setMessages(data.messages);
          if (data.peer_username) setPeerUsername(data.peer_username);
          if (data.peer_avatar_id != null) setPeerAvatarId(data.peer_avatar_id);
          setMode("readonly");
        } else {
          setMode("live");
        }
      })
      .catch(() => setMode("expired"));
  }, [token, roomId]);

  // Connect WebSocket (live mode only)
  useEffect(() => {
    if (!token || !roomId || mode !== "live") return;

    const ws = new WebSocket(wsUrl.chat(token, roomId));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const data: WsEvent = JSON.parse(event.data);

      switch (data.type) {
        case "history":
          setMessages(data.messages);
          if (data.messages.length > 0 && username) {
            const peer = data.messages.find((m) => m.from !== username);
            if (peer) setPeerUsername(peer.from);
          }
          break;

        case "message":
          setMessages((prev) => [...prev, data as ChatMessage]);
          if (data.from !== username) {
            setPeerUsername(data.from);
            setPeerTyping(false);
          }
          break;

        case "typing_start":
          if (data.from !== username) { setPeerUsername(data.from); setPeerTyping(true); }
          break;

        case "typing_stop":
          if (data.from !== username) setPeerTyping(false);
          break;

        case "tick":
          setRemaining(data.remaining);
          break;

        case "session_end":
          setSessionEnded(true);
          break;

        case "peer_left":
          setPeerLeft(true);
          break;

        case "extended":
          setRemaining(data.remaining);
          setCanExtend(false);
          setSessionEnded(false);
          break;

        case "error":
          setConnectionError(data.detail);
          break;
      }
    };

    ws.onerror = () => {};
    ws.onclose = (ev) => {
      setConnected(false);
      if (ev.code === 4010) {
        api.getRoomMessages(token!, roomId).then((data) => {
          setMessages(data.messages);
          if (data.peer_username) setPeerUsername(data.peer_username);
          setMode("readonly");
        }).catch(() => setMode("expired"));
      }
    };

    return () => { ws.close(); };
  }, [token, roomId, username, mode]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
    setInput("");
    if (isTypingRef.current) {
      isTypingRef.current = false;
      wsRef.current.send(JSON.stringify({ type: "typing_stop" }));
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ws = wsRef.current;
    if (!ws) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      ws.send(JSON.stringify({ type: "typing_start" }));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      ws.send(JSON.stringify({ type: "typing_stop" }));
    }, 1500);
  };

  const handleExtend = () => {
    wsRef.current?.send(JSON.stringify({ type: "extend" }));
    setSessionEnded(false);
  };

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: "var(--ink)", color: "var(--white)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Ambient orbs */}
      <div className="orb orb-c" style={{ position: "fixed", opacity: 0.3 }} />

      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px",
        background: "rgba(13,13,15,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0, position: "relative", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => router.push("/lobby")}
            style={{ background: "none", border: "none", color: "var(--slate)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "4px 8px" }}
            aria-label="Back to board"
          >
            ←
          </button>
          <FlowLogo />
          {peerUsername && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
              <button
                onClick={() => peerUsername && setShowPeerProfile(true)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <img
                  src={avatarUrl(peerAvatarId, 72)}
                  alt="peer avatar"
                  width={36} height={36}
                  style={{ borderRadius: "50%", border: "2px solid rgba(184,160,232,0.3)" }}
                />
              </button>
              <div>
                <button
                  onClick={() => peerUsername && setShowPeerProfile(true)}
                  style={{
                    background: "none", border: "none", cursor: peerUsername ? "pointer" : "default",
                    fontWeight: 600, fontSize: 14, color: "var(--white)",
                    fontFamily: "var(--font-ui)", padding: 0, display: "block",
                  }}
                >
                  {peerUsername}
                </button>
                <p style={{ margin: 0, fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-ui)" }}>
                  {mode === "readonly" ? "Session ended · read-only" : connected ? "Live · anonymous" : "Connecting…"}
                </p>
              </div>
              {peerLeft && (
                <span style={{ fontSize: 11, color: "var(--danger)", fontFamily: "var(--font-ui)" }}>disconnected</span>
              )}
            </div>
          )}
          {!peerUsername && (
            <span style={{ fontSize: 13, color: "var(--slate)", fontFamily: "var(--font-ui)", marginLeft: 8 }}>
              {mode === "checking" ? "Loading…" : "Waiting for peer…"}
            </span>
          )}
        </div>

        {mode === "live" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Timer remainingSeconds={remaining} onEnd={() => setSessionEnded(true)} />
            <button
              onClick={() => setShowReport(true)}
              style={{ background: "none", border: "none", color: "var(--slate)", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}
              title="Report"
            >
              ⚑
            </button>
            <button
              onClick={() => { wsRef.current?.send(JSON.stringify({ type: "leave" })); router.push("/lobby"); }}
              style={{
                padding: "7px 14px", borderRadius: "var(--r-full)",
                background: "none", border: "1px solid rgba(232,128,128,0.3)",
                color: "var(--danger)", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "var(--font-ui)",
              }}
            >
              Leave
            </button>
          </div>
        )}
      </header>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px", display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 2 }}>
        {mode === "readonly" && (
          <div style={{ textAlign: "center", paddingBottom: 8 }}>
            <span className="pill" style={{ fontSize: 11 }}>Session ended · read-only</span>
          </div>
        )}

        {connectionError && mode === "live" && (
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--danger)", background: "rgba(232,128,128,0.08)", border: "1px solid rgba(232,128,128,0.2)", borderRadius: "var(--r-md)", padding: "12px 16px", fontFamily: "var(--font-ui)" }}>
            {connectionError}
          </div>
        )}

        {peerLeft && (
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--slate)", background: "rgba(255,255,255,0.04)", borderRadius: "var(--r-md)", padding: "12px 16px", fontFamily: "var(--font-ui)" }}>
            Your guide stepped away quietly.
          </div>
        )}

        {mode === "checking" && messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(184,160,232,0.3)", borderTopColor: "var(--accent)", animation: "logo-spin 0.8s linear infinite" }} />
          </div>
        )}

        {mode === "expired" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 48, color: "rgba(255,255,255,0.1)", fontWeight: 900, letterSpacing: "-0.04em" }}>404</p>
            <p style={{ fontWeight: 600, color: "var(--fog)", fontFamily: "var(--font-ui)" }}>Conversation no longer available.</p>
            <p style={{ fontSize: 13, color: "var(--slate)", fontFamily: "var(--font-ui)" }}>This chat has expired.</p>
          </div>
        )}

        {messages.length === 0 && mode === "live" && !peerLeft && connected && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--slate)", fontSize: 14, fontFamily: "var(--font-ui)", fontWeight: 300 }}>
            This is your space. Take your time.
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.from === username;
          return (
            <div key={i} className="msg-enter" style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {!isMe && (
                <span style={{ fontSize: 11, color: "var(--slate)", marginBottom: 4, paddingLeft: 4, fontFamily: "var(--font-ui)" }}>{msg.from}</span>
              )}
              <div style={{
                maxWidth: "72%",
                padding: "10px 16px",
                borderRadius: isMe ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                fontSize: 14, lineHeight: 1.55,
                fontFamily: "var(--font-ui)", fontWeight: 300,
                ...(isMe
                  ? { background: "var(--charcoal)", color: "var(--white)", border: "1px solid rgba(255,255,255,0.08)" }
                  : { background: "rgba(255,255,255,0.08)", color: "var(--fog)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }
                ),
              }}>
                {msg.text}
              </div>
              <span style={{ fontSize: 10, color: "var(--graphite)", padding: "3px 4px", fontFamily: "var(--font-ui)" }}>
                {formatTime(msg.ts)}
              </span>
            </div>
          );
        })}

        {peerTyping && peerUsername && <TypingIndicator username={peerUsername} />}

        <div ref={bottomRef} />
      </div>

      {/* Input bar (live only) */}
      {mode === "live" && (
        <div style={{
          flexShrink: 0, padding: "12px 20px 16px",
          background: "rgba(13,13,15,0.9)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          position: "relative", zIndex: 10,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: 760, margin: "0 auto" }}>
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!connected || peerLeft || sessionEnded}
              placeholder={peerLeft ? "Chat ended" : !connected ? "Connecting…" : "Say something…"}
              rows={1}
              className="flow-input"
              style={{
                flex: 1, resize: "none", maxHeight: 128, overflowY: "auto",
                lineHeight: 1.5, opacity: (!connected || peerLeft || sessionEnded) ? 0.5 : 1,
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || !connected || peerLeft}
              style={{
                padding: "13px 18px", borderRadius: "var(--r-md)",
                background: "var(--accent)",
                border: "none", color: "var(--ink)",
                fontSize: 16, cursor: "pointer",
                transition: "opacity 0.15s",
                opacity: (!input.trim() || !connected || peerLeft) ? 0.35 : 1,
                flexShrink: 0,
              }}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: 10, color: "var(--graphite)", marginTop: 6, fontFamily: "var(--font-ui)" }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      )}

      {/* Readonly/expired footer */}
      {(mode === "readonly" || mode === "expired") && (
        <div style={{
          flexShrink: 0, padding: "14px 20px",
          background: "rgba(13,13,15,0.9)", backdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          position: "relative", zIndex: 10,
        }}>
          <button
            onClick={() => router.push("/lobby")}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            ← Back to lobby
          </button>
          <button
            onClick={() => router.push("/history")}
            className="btn btn-sm"
            style={{ fontSize: 13, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--fog)" }}
          >
            View history
          </button>
        </div>
      )}

      {/* Modals */}
      {sessionEnded && (
        <SessionEndModal canExtend={canExtend} onExtend={handleExtend} onClose={() => setSessionEnded(false)} />
      )}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
      {showPeerProfile && peerUsername && token && (
        <UserProfileModal username={peerUsername} token={token} onClose={() => setShowPeerProfile(false)} />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ink)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid rgba(184,160,232,0.2)", borderTopColor: "var(--accent)", animation: "logo-spin 0.8s linear infinite" }} />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}

