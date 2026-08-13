import React, { useEffect, useRef, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { useCoachStyle } from "./useCoachStyle";
import { CoachStylePicker } from "./CoachStylePicker";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What's the #1 thing costing me strokes?",
  "Why do I blow up after a bad hole?",
  "Which course do I struggle on most?",
  "What should I practice to break 85?",
];

// Conversational Coach — full-screen overlay. Asks /api/coach-chat, which
// grounds every answer in the player's real scoring data.
export function CoachChat({ onBack }: { onBack: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useCoachStyle();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setErr("");
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Coach couldn't answer");
      setMsgs((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 16px 14px" }}>
        <button onClick={onBack} className="sc-press" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 999, width: 34, height: 34, cursor: "pointer", color: "var(--cream)", fontSize: 17, display: "grid", placeItems: "center", flexShrink: 0 }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.2em", color: "var(--gold)", textTransform: "uppercase" }}>Ask Coach</div>
          <h1 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Your rounds, answered</h1>
        </div>
        <CoachStylePicker theme="dark" value={style} onChange={setStyle} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="sc-scroll" data-noswipe style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, padding: "0 16px 8px" }}>
        {msgs.length === 0 && (
          <div style={{ paddingTop: 6 }}>
            <p style={{ margin: "0 0 14px", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream-2)", lineHeight: 1.5 }}>
              I&apos;ve read all your rounds. Ask me anything about your game — I&apos;ll answer from your real scoring data.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="sc-tile" style={{ textAlign: "left", cursor: "pointer", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 13, padding: "12px 14px", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream)", lineHeight: 1.35 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: msgs.length ? 4 : 0 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: "11px 14px",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  ...(m.role === "user"
                    ? { background: "var(--gold)", color: "#0F2016", borderBottomRightRadius: 5, fontWeight: 500 }
                    : { background: "var(--panel)", border: "1px solid var(--line)", color: "var(--cream)", borderBottomLeftRadius: 5 }),
                }}
              >
                {m.role === "assistant" ? m.content.replace(/\*\*/g, "").replace(/^#+\s*/gm, "") : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: "flex-start", maxWidth: "86%" }}>
              <div style={{ borderRadius: 16, borderBottomLeftRadius: 5, padding: "11px 14px", background: "var(--panel)", border: "1px solid var(--line)", color: "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 13 }}>
                Coach is reading your rounds…
              </div>
            </div>
          )}
          {err && (
            <div style={{ alignSelf: "flex-start", maxWidth: "86%", borderRadius: 12, padding: "10px 13px", background: hexA("#C05C5C", 0.1), border: "1px solid " + hexA("#C05C5C", 0.4), color: "var(--cream-2)", fontFamily: "var(--font-ui)", fontSize: 12.5 }}>
              {err}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div data-noswipe style={{ flexShrink: 0, padding: "10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px)", borderTop: "1px solid var(--line)", background: "var(--bg)", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about your game…"
          rows={1}
          style={{ flex: 1, resize: "none", maxHeight: 120, borderRadius: 14, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--cream)", fontFamily: "var(--font-ui)", fontSize: 14, padding: "11px 13px", outline: "none", lineHeight: 1.4 }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="sc-press"
          style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 14, border: "none", cursor: loading || !input.trim() ? "default" : "pointer", background: input.trim() ? "var(--gold)" : "var(--panel)", color: input.trim() ? "#0F2016" : "var(--cream-3)", fontSize: 18, fontWeight: 700, display: "grid", placeItems: "center", opacity: loading ? 0.6 : 1 }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
