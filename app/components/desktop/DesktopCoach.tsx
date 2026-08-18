"use client";

// Caddie Book desktop — Coach chat (shared rail + full page variant) and the
// collapsible right rail. Ported from docs/design/caddie-shell.jsx.
//
// The design used window.claude.complete + a canned fallbackCoach(). That is
// replaced here with a real POST to /api/coach-chat, using the EXACT request/
// response contract already proven out by app/components/CoachChat.tsx:
//   POST /api/coach-chat  body: { messages: [{ role: 'user'|'assistant', content: string }] }
//   → { reply: string }  (or { error: string } on failure)
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IconCoach, IconFlag, IconPanel, IconSend } from "./DesktopIcons";
import { CoachStylePicker } from "../CoachStylePicker";
import { useCoachStyle } from "../useCoachStyle";
import { CoachMarkdown } from "../CoachMarkdown";
import type { CoachStyleId } from "@/lib/coach-styles";

interface DisplayMessage {
  role: "user" | "coach";
  text: string;
}

const COACH_CHIPS = [
  "What's costing me the most strokes?",
  "How do I stop doubling up after a blow-up?",
  "Which course should I stop playing?",
  "What should I practice this week?",
];

const SEED_MESSAGE: DisplayMessage = {
  role: "coach",
  text: "Ask me anything about your game — I'll answer from your real scoring data across every round you've logged.",
};

interface CoachChatProps {
  messages: DisplayMessage[];
  busy: boolean;
  onSend: (text: string) => void;
  variant?: "rail" | "page";
  style?: CoachStyleId;
  onStyleChange?: (id: CoachStyleId) => void;
}

export const DesktopCoachChat: React.FC<CoachChatProps> = ({ messages, busy, onSend, variant = "rail", style, onStyleChange }) => {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const full = variant === "page";

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const submit = (text?: string) => {
    const t = (text != null ? text : input).trim();
    if (!t || busy) return;
    setInput("");
    onSend(t);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* full-page header: voice picker (the rail variant gets its own header
          in DesktopCoachRail below, so this only renders for variant="page") */}
      {full && style && onStyleChange && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 4px 10px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
          <CoachStylePicker theme="parchment" value={style} onChange={onStyleChange} />
        </div>
      )}
      {/* messages */}
      <div ref={scrollRef} className="cb-scroll" style={{ flex: 1, overflowY: "auto", padding: full ? "8px 4px 4px" : "4px 16px", minHeight: 0 }}>
        <div style={{ maxWidth: full ? 720 : "none", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => (
            <Bubble key={i} m={m} full={full} />
          ))}
          {busy && <Bubble m={{ role: "coach", text: "" }} full={full} typing />}
        </div>
      </div>

      {/* chips (only if fresh) */}
      {messages.length <= 1 && !busy && (
        <div style={{ padding: full ? "10px 4px" : "8px 12px 4px", display: "flex", flexWrap: "wrap", gap: 7, maxWidth: full ? 720 : "none", margin: full ? "0 auto" : 0 }}>
          {COACH_CHIPS.map((c, i) => (
            <button
              key={i}
              onClick={() => submit(c)}
              className="cb-chip"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                color: "#22321f",
                cursor: "pointer",
                background: "var(--paper)",
                border: "1px solid var(--line-strong)",
                borderRadius: 999,
                padding: "7px 12px",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <div style={{ padding: full ? "10px 4px 4px" : "10px 12px 12px" }}>
        <div
          style={{
            maxWidth: full ? 720 : "none",
            margin: "0 auto",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "var(--paper)",
            border: "1px solid var(--line-strong)",
            borderRadius: 14,
            padding: "6px 6px 6px 14px",
          }}
        >
          <textarea
            value={input}
            rows={1}
            placeholder="Ask your coach…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13.5,
              color: "#22321f",
              padding: "7px 0",
              maxHeight: 90,
              lineHeight: 1.4,
            }}
          />
          <button
            onClick={() => submit()}
            disabled={busy || !input.trim()}
            className="cb-send"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              flexShrink: 0,
              border: "none",
              cursor: busy || !input.trim() ? "default" : "pointer",
              background: busy || !input.trim() ? "rgba(11,61,46,0.18)" : "var(--ink)",
              display: "grid",
              placeItems: "center",
              transition: "background 0.15s",
            }}
          >
            <IconSend size={17} stroke="#F2ECDC" sw={2} />
          </button>
        </div>
        <div style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.1em", color: "rgba(34,49,36,0.4)", marginTop: 8 }}>
          GROUNDED IN YOUR LOGGED ROUNDS
        </div>
      </div>
    </div>
  );
};

const Bubble: React.FC<{ m: DisplayMessage; full: boolean; typing?: boolean }> = ({ m, full, typing }) => {
  const coach = m.role === "coach";
  if (coach) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "var(--ink)", display: "grid", placeItems: "center", marginTop: 1 }}>
          <IconFlag size={14} stroke="var(--gold)" />
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--paper)",
            border: "1px solid var(--line)",
            borderRadius: "4px 14px 14px 14px",
            padding: "10px 13px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: full ? 14.5 : 13.5,
            color: "#22321f",
            lineHeight: 1.5,
          }}
        >
          {typing ? <TypingDots /> : <CoachMarkdown text={m.text} />}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          maxWidth: "82%",
          background: "var(--ink)",
          color: "#F2ECDC",
          borderRadius: "14px 4px 14px 14px",
          padding: "10px 13px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: full ? 14.5 : 13.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {m.text}
      </div>
    </div>
  );
};

const TypingDots: React.FC = () => (
  <span style={{ display: "inline-flex", gap: 4, padding: "2px 0" }}>
    {[0, 1, 2].map((i) => (
      <span key={i} style={{ width: 6, height: 6, borderRadius: 6, background: "rgba(34,49,36,0.4)", animation: `cbBlink 1s ${i * 0.15}s infinite` }} />
    ))}
  </span>
);

interface CoachRailProps {
  open: boolean;
  onToggle: () => void;
  chat: React.ReactNode;
  style?: CoachStyleId;
  onStyleChange?: (id: CoachStyleId) => void;
}

export const DesktopCoachRail: React.FC<CoachRailProps> = ({ open, onToggle, chat, style, onStyleChange }) => {
  if (!open) {
    return (
      <button
        onClick={onToggle}
        title="Open coach"
        style={{
          width: 52,
          flexShrink: 0,
          background: "var(--panel)",
          borderLeft: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          paddingTop: 20,
          cursor: "pointer",
          border: "none",
        }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--ink)", display: "grid", placeItems: "center" }}>
          <IconCoach size={18} stroke="var(--gold)" />
        </span>
        <span style={{ writingMode: "vertical-rl", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.24em", color: "rgba(34,49,36,0.5)", marginTop: 6 }}>
          COACH
        </span>
      </button>
    );
  }
  return (
    <aside style={{ width: 360, flexShrink: 0, background: "var(--panel)", borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 16px 14px", borderBottom: "1px solid var(--line)" }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--ink)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <IconFlag size={17} stroke="var(--gold)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "#22321f", lineHeight: 1 }}>Your Coach</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 6, background: "#3E8F63" }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: "0.08em", color: "rgba(34,49,36,0.55)" }}>ONLINE · READING YOUR STATS</span>
          </div>
        </div>
        {style && onStyleChange && <CoachStylePicker theme="parchment" value={style} onChange={onStyleChange} />}
        <button onClick={onToggle} title="Collapse" className="cb-icon-btn" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, borderRadius: 8, flexShrink: 0 }}>
          <IconPanel size={18} stroke="rgba(34,49,36,0.5)" />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{chat}</div>
    </aside>
  );
};

// Hook that owns the coach conversation state + the real /api/coach-chat
// call, so DesktopShell only needs to render <DesktopCoachChat> /
// <DesktopCoachRail> and doesn't have to know about the network contract.
export function useDesktopCoach() {
  const [messages, setMessages] = useState<DisplayMessage[]>([SEED_MESSAGE]);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useCoachStyle();

  const send = useCallback(
    async (text: string) => {
      const next = [...messages, { role: "user" as const, text }];
      setMessages(next);
      setBusy(true);
      try {
        // Same contract as app/components/CoachChat.tsx: role "user"|"assistant".
        const apiMessages = next.map((m) => ({ role: m.role === "coach" ? "assistant" : "user", content: m.text }));
        const res = await fetch("/api/coach-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, style }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Coach couldn't answer");
        setMessages((m) => [...m, { role: "coach", text: (data.reply || "").trim() || "I couldn't find an answer in your rounds for that — try asking about strokes, blow-ups, or a specific course." }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong reaching the coach.";
        setMessages((m) => [...m, { role: "coach", text: msg }]);
      } finally {
        setBusy(false);
      }
    },
    [messages, style]
  );

  return { messages, busy, send, style, setStyle };
}
