"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

interface SessionEndModalProps {
  canExtend: boolean;
  onExtend: () => void;
  onClose: () => void;
}

export function SessionEndModal({ canExtend, onExtend, onClose }: SessionEndModalProps) {
  const router = useRouter();
  const { clear } = useAuthStore();

  const handleRematch = () => { onClose(); router.push("/lobby"); };
  const handleLeave = () => { clear(); router.push("/"); };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(13,13,15,0.75)",
      backdropFilter: "blur(12px)",
      padding: "1rem",
    }}>
      <div className="glass-card" style={{ maxWidth: 360, width: "100%", padding: "44px 36px", textAlign: "center" }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: 28, fontWeight: 700, fontStyle: "italic",
          color: "var(--white)", marginBottom: 8,
          letterSpacing: "-0.02em",
        }}>
          Time&apos;s up.
        </h2>
        <p style={{ fontSize: 14, color: "var(--slate)", fontWeight: 300, marginBottom: 32, lineHeight: 1.6, fontFamily: "var(--font-ui)" }}>
          That conversation has dissolved. How are you feeling?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {canExtend && (
            <button onClick={onExtend} className="btn btn-accent btn-md" style={{ width: "100%" }}>
              Extend 15 minutes
            </button>
          )}
          <button onClick={handleRematch} className="btn btn-ghost btn-md" style={{ width: "100%" }}>
            Talk to someone new
          </button>
          <button onClick={handleLeave} style={{
            padding: 13, background: "transparent", color: "var(--danger)",
            border: "none", fontFamily: "var(--font-ui)",
            fontSize: 13, fontWeight: 300, cursor: "pointer",
            textDecoration: "underline", textDecorationColor: "rgba(232,128,128,0.3)",
            textUnderlineOffset: "3px",
          }}>
            Leave quietly
          </button>
        </div>
      </div>
    </div>
  );
}

interface SessionEndModalProps {
  canExtend: boolean;
  onExtend: () => void;
  onClose: () => void;
}

