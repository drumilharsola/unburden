"use client";

export function TypingIndicator({ username }: { username: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }} className="msg-enter">
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px 20px 20px 4px",
        padding: "12px 18px",
      }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--slate)",
              display: "inline-block",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "var(--slate)", marginBottom: 4, fontFamily: "var(--font-ui)" }}>{username}</span>
    </div>
  );
}
