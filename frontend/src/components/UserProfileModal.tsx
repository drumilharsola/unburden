"use client";

import { useEffect, useState } from "react";
import { api, AuthError } from "@/lib/api";
import { avatarUrl } from "@/lib/avatars";

interface Props {
  username: string;
  token: string;
  peerSessionId?: string;
  roomId?: string;
  onClose: () => void;
  onBlocked?: () => void;
}

function fmtDate(ts: string): string {
  if (!ts) return "";
  return new Date(Number(ts) * 1000).toLocaleDateString([], { year: "numeric", month: "long" });
}

export function UserProfileModal({ username, token, peerSessionId, roomId, onClose, onBlocked }: Props) {
  const [profile, setProfile] = useState<{
    username: string;
    avatar_id: number;
    speak_count: number;
    listen_count: number;
    member_since: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);
  const [blockDone, setBlockDone] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  useEffect(() => {
    api.getUserProfile(token, username)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username, token]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBlock = async () => {
    if (!peerSessionId || blocking) return;
    setBlocking(true);
    try {
      await api.blockUser(token, peerSessionId, username, profile?.avatar_id ?? 0);
      setBlockDone(true);
      onBlocked?.();
    } catch (e) {
      if (e instanceof AuthError) {
        setBlockError("Your session has expired. Please refresh the page to log back in.");
        return;
      }
    } finally {
      setBlocking(false);
    }
  };

  return (
    <>
      <style>{`@keyframes vpm-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(46,36,32,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          padding: "1rem",
        }}
      >
        {/* Glass card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: "340px",
            borderRadius: "36px",
            padding: "36px 28px 28px",
            background: "rgba(255,253,250,0.07)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(255,253,250,0.12)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,253,250,0.08)",
            color: "rgba(244,241,238,0.9)",
            position: "relative",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", top: "16px", right: "16px",
              width: "32px", height: "32px", borderRadius: "50%",
              background: "rgba(255,253,250,0.1)",
              border: "1px solid rgba(255,253,250,0.15)",
              color: "rgba(244,241,238,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: "18px", lineHeight: 1,
              transition: "background 0.2s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,253,250,0.18)"; }}
            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,253,250,0.1)"; }}
          >
            ×
          </button>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                border: "2.5px solid rgba(255,253,250,0.12)",
                borderTopColor: "#dbbfb0",
                animation: "vpm-spin 0.8s linear infinite",
              }} />
            </div>
          ) : profile ? (
            <>
              {/* Avatar + name */}
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <img
                  src={avatarUrl(profile.avatar_id, 160)}
                  alt={profile.username}
                  width={80}
                  height={80}
                  style={{
                    borderRadius: "50%",
                    margin: "0 auto 14px",
                    display: "block",
                    boxShadow: "0 0 32px rgba(219,191,176,0.35)",
                    border: "3px solid rgba(219,191,176,0.5)",
                  }}
                />
                <h2 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
                  {profile.username}
                </h2>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                {[
                  { label: "Vent", value: profile.speak_count, icon: "🎤" },
                  { label: "Listen", value: profile.listen_count, icon: "👂" },
                ].map((stat) => (
                  <div key={stat.label} style={{
                    background: "rgba(255,253,250,0.06)",
                    border: "1px solid rgba(255,253,250,0.1)",
                    borderRadius: "18px", padding: "16px 12px",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "22px", marginBottom: "6px" }}>{stat.icon}</div>
                    <div style={{ fontSize: "26px", fontWeight: "800", lineHeight: 1 }}>{stat.value}</div>
                    <div style={{ fontSize: "11px", color: "rgba(244,241,238,0.38)", marginTop: "5px" }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {profile.member_since && (
                <p style={{
                  textAlign: "center", fontSize: "12px",
                  color: "rgba(244,241,238,0.28)", margin: "0 0 20px",
                }}>
                  ✶ Member since {fmtDate(profile.member_since)}
                </p>
              )}

              {peerSessionId && (
                <>
                  {blockError && (
                    <p style={{ fontSize: 12, color: "rgba(232,128,128,0.85)", marginBottom: 10, textAlign: "center", fontFamily: "var(--font-ui)" }}>
                      {blockError}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    {confirmingBlock ? (
                      <>
                        <button
                          onClick={() => { setConfirmingBlock(false); void handleBlock(); }}
                          disabled={blocking}
                          style={{
                            flex: 1, padding: "10px 14px", borderRadius: "14px",
                            border: "1px solid rgba(232,128,128,0.5)",
                            background: "rgba(232,128,128,0.15)",
                            color: "rgba(232,128,128,0.9)", fontSize: "13px", fontWeight: 700,
                            cursor: "pointer", fontFamily: "var(--font-ui)", opacity: blocking ? 0.6 : 1,
                          }}
                        >
                          Yes, block
                        </button>
                        <button
                          onClick={() => setConfirmingBlock(false)}
                          style={{
                            flex: 1, padding: "10px 14px", borderRadius: "14px",
                            border: "1px solid rgba(255,253,250,0.15)",
                            background: "transparent",
                            color: "rgba(244,241,238,0.5)", fontSize: "13px", fontWeight: 600,
                            cursor: "pointer", fontFamily: "var(--font-ui)",
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmingBlock(true)}
                          disabled={blocking || blockDone}
                          style={{
                            flex: 1,
                            padding: "10px 14px",
                            borderRadius: "14px",
                            border: "1px solid rgba(232,128,128,0.3)",
                            background: blockDone ? "rgba(232,128,128,0.08)" : "transparent",
                            color: blockDone ? "rgba(232,128,128,0.6)" : "rgba(232,128,128,0.85)",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: blocking || blockDone ? "default" : "pointer",
                            fontFamily: "var(--font-ui)",
                            transition: "all 0.2s",
                            opacity: blocking ? 0.6 : 1,
                          }}
                        >
                          {blockDone ? "Blocked" : blocking ? "Blocking…" : "Block"}
                        </button>

                      </>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p style={{ textAlign: "center", color: "rgba(244,241,238,0.38)", padding: "16px 0" }}>
              Profile not available
            </p>
          )}
        </div>
      </div>

    </>
  );
}
