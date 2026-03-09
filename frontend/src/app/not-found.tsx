"use client";

import { useRouter } from "next/navigation";
import { FlowLogo } from "@/components/FlowLogo";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="dark-canvas grain" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div className="orb orb-a" />
      <div className="orb orb-b" />

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "24px 32px", zIndex: 10 }}>
        <FlowLogo />
      </div>

      <div style={{ textAlign: "center", position: "relative", zIndex: 5 }}>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(120px, 20vw, 220px)",
          fontWeight: 900,
          color: "rgba(255,255,255,0.04)",
          letterSpacing: "-0.05em",
          lineHeight: 1,
          margin: 0,
          userSelect: "none",
        }}>404</p>
        <div style={{ marginTop: -24 }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px,5vw,48px)",
            fontWeight: 700,
            color: "var(--fog)",
            letterSpacing: "-0.03em",
            fontStyle: "italic",
            marginBottom: 12,
          }}>
            This page dissolved.
          </h1>
          <p style={{ fontSize: 14, color: "var(--slate)", fontFamily: "var(--font-ui)", fontWeight: 300, marginBottom: 32 }}>
            It was here once, but it chose to vanish.
          </p>
          <button
            onClick={() => router.push("/")}
            className="btn btn-accent btn-md"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
