"use client";

import { useState, FormEvent } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = "/";
      } else {
        setError("Incorrect passcode");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0F2016",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#172B1D",
          borderRadius: "12px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "380px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Wordmark */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              color: "#F0C040",
              fontSize: "28px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              lineHeight: 1.1,
            }}
          >
            Caddie Book
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: "13px",
              marginTop: "6px",
            }}
          >
            Enter your passcode to continue
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <input
            type="password"
            placeholder="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "12px 14px",
              backgroundColor: "#0F2016",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <div
              style={{
                color: "#C05C5C",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#F0C040",
              color: "#0F2016",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: 700,
              cursor: loading || !passcode ? "not-allowed" : "pointer",
              opacity: loading || !passcode ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
