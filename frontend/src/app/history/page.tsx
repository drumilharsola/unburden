"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api, RoomSummary } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";
import { FlowLogo } from "@/components/FlowLogo";

function formatDate(unixStr: string): string {
  if (!unixStr) return "";
  const d = new Date(Number(unixStr) * 1000);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const router = useRouter();
  const { token, username } = useAuthStore();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.push("/verify"); return; }
    if (!username) { router.push("/profile"); return; }
    api.getChatRooms(token)
      .then((res) => setRooms(res.rooms))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, username, router]);

  return (
    <div className="light-canvas grain" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="orb-light-a" />
      <div className="orb-light-b" />

      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 32px",
        background: "rgba(248,247,245,0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <FlowLogo dark />
        <button
          onClick={() => router.push("/lobby")}
          style={{ fontSize: 13, color: "var(--slate)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontWeight: 500 }}
        >
          ← Lobby
        </button>
      </nav>

      <main style={{ flex: 1, maxWidth: 720, width: "100%", margin: "0 auto", padding: "56px 24px 80px", position: "relative", zIndex: 2 }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 className="t-display" style={{ color: "var(--ink)", fontSize: "clamp(36px,6vw,64px)" }}>
            Your <em style={{ color: "var(--accent)" }}>conversations.</em>
          </h1>
          <p style={{ fontSize: 14, color: "var(--slate)", fontFamily: "var(--font-ui)", fontWeight: 300, marginTop: 8 }}>
            Every session, preserved in quiet.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(184,160,232,0.2)", borderTopColor: "var(--accent)", animation: "logo-spin 0.8s linear infinite" }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && rooms.length === 0 && (
          <div style={{
            borderRadius: "var(--r-lg)", padding: "60px 32px", textAlign: "center",
            border: "1.5px dashed rgba(0,0,0,0.1)",
            background: "var(--white)",
          }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--charcoal)", fontSize: 16, fontFamily: "var(--font-ui)" }}>
              No conversations yet.
            </p>
            <p style={{ margin: "8px 0 24px", fontSize: 13, color: "var(--slate)", fontFamily: "var(--font-ui)", fontWeight: 300 }}>
              Your sessions will appear here after you connect with someone.
            </p>
            <button
              onClick={() => router.push("/lobby")}
              className="btn btn-primary btn-md"
            >
              Go to lobby
            </button>
          </div>
        )}

        {/* Conversation list */}
        {!loading && rooms.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rooms.map((room, i) => (
              <button
                key={room.room_id}
                onClick={() => router.push(`/chat?room_id=${encodeURIComponent(room.room_id)}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 20,
                  padding: "22px 0",
                  background: "none", border: "none",
                  borderBottom: i < rooms.length - 1 ? "1px solid rgba(0,0,0,0.07)" : "none",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "opacity 0.15s",
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; }}
                onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                {/* Number */}
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "var(--mist)",
                  fontFamily: "var(--font-ui)", letterSpacing: "0.05em",
                  minWidth: 28, flexShrink: 0,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Avatar */}
                <img
                  src={avatarUrl(room.peer_avatar_id, 72)}
                  alt="avatar"
                  width={44} height={44}
                  style={{ borderRadius: "50%", flexShrink: 0, border: "2px solid rgba(0,0,0,0.06)" }}
                />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontWeight: 600, fontSize: 15,
                    fontFamily: "var(--font-ui)", color: "var(--ink)",
                    fontStyle: "italic",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {room.peer_username || "Anonymous"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--slate)", fontFamily: "var(--font-ui)" }}>
                    {formatDate(room.started_at)}
                  </p>
                </div>

                {/* Status */}
                {room.status === "active" ? (
                  <span className="pill pill-success" style={{ flexShrink: 0, gap: 6 }}>
                    <span className="pill-dot" style={{ background: "var(--success)", animation: "pulse-dot 2s ease-in-out infinite" }} />
                    Live
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--mist)", fontFamily: "var(--font-ui)", flexShrink: 0 }}>
                    Ended
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

