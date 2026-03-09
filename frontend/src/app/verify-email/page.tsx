"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Stage = "loading" | "success" | "error";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { setAuth, setEmailVerified, setProfile } = useAuthStore();

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setErrorMsg("No verification token found in the link.");
      setStage("error");
      return;
    }

    api
      .verifyEmail(token)
      .then(async (res) => {
        setAuth(res.token, res.session_id);
        setEmailVerified(true);
        if (res.has_profile) {
          try {
            const me = await api.getMe(res.token);
            setProfile(me.username, Number(me.avatar_id ?? 0));
          } catch { /* continue anyway */ }
          router.push("/lobby");
        } else {
          router.push("/profile");
        }
        setStage("success");
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "Verification failed");
        setStage("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="grain"
      style={{
        minHeight: "100vh",
        background: "var(--ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 20,
        padding: "40px 24px",
        position: "relative",
      }}
    >
      <div className="orb orb-a" style={{ position: "fixed" }} />
      <div className="orb orb-b" style={{ position: "fixed" }} />

      <div
        style={{
          position: "relative",
          zIndex: 5,
          textAlign: "center",
          maxWidth: 420,
        }}
      >
        {stage === "loading" && (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "2px solid rgba(184,164,244,0.2)",
                borderTop: "2px solid var(--accent)",
                margin: "0 auto 24px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 15,
                color: "var(--slate)",
                margin: 0,
              }}
            >
              Verifying your email…
            </p>
          </>
        )}

        {stage === "success" && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-glow)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                margin: "0 auto 24px",
              }}
            >
              ✓
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--white)",
                letterSpacing: "-0.02em",
                marginBottom: 10,
              }}
            >
              Email verified.
            </h1>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--slate)",
                margin: 0,
              }}
            >
              Redirecting you now…
            </p>
          </>
        )}

        {stage === "error" && (
          <>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(232,128,128,0.1)",
                border: "1px solid rgba(232,128,128,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                margin: "0 auto 24px",
              }}
            >
              ✕
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 700,
                color: "var(--white)",
                letterSpacing: "-0.02em",
                marginBottom: 10,
              }}
            >
              Link expired.
            </h1>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--slate)",
                marginBottom: 28,
              }}
            >
              {errorMsg || "This verification link is invalid or has expired."}
            </p>
            <button
              onClick={() => router.push("/verify")}
              className="btn btn-accent btn-md"
              style={{ borderRadius: "var(--r-md)" }}
            >
              Back to sign in →
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
