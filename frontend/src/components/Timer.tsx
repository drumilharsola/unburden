"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  remainingSeconds: number;
  onEnd?: () => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function Timer({ remainingSeconds, onEnd }: TimerProps) {
  const [secs, setSecs] = useState(remainingSeconds);

  useEffect(() => {
    setSecs(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (secs <= 0) {
      onEnd?.();
      return;
    }
    const id = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secs, onEnd]);

  const mins = Math.floor(secs / 60);
  const sec = secs % 60;
  const urgent = secs <= 120;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        background: urgent ? "rgba(232,128,128,0.12)" : "rgba(184,160,232,0.1)",
        border: `1px solid ${urgent ? "rgba(232,128,128,0.3)" : "rgba(184,160,232,0.2)"}`,
        borderRadius: "var(--r-full)",
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        fontWeight: 600,
        color: urgent ? "var(--danger)" : "var(--accent)",
        letterSpacing: "0.05em",
        transition: "all 0.3s",
      }}
      aria-live="polite"
      aria-label={`${mins} minutes ${sec} seconds remaining`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" strokeLinecap="round" />
      </svg>
      {pad(mins)}:{pad(sec)}
    </div>
  );
}
