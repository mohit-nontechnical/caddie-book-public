import React from "react";
import { hexA } from "@/lib/caddie-data";
import type { TrendAlert } from "@/lib/trends";

// Shared renderer for deterministic trend alerts (lib/trends.ts) — used by
// UploadView.tsx (post-import result area) and FeedView.tsx (top-of-feed
// card). Dark-theme only: both call sites live in the mobile Augusta shell.
export function TrendAlertsList({ alerts }: { alerts: TrendAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a) => {
        const c = a.good ? "#4CAF82" : "#C05C5C";
        return (
          <div
            key={a.metric}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "11px 13px",
              borderRadius: 12,
              background: hexA(c, 0.1),
              border: "1px solid " + hexA(c, 0.35),
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1.5, flexShrink: 0, color: c }}>{a.direction === "up" ? "▲" : "▼"}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>
                {a.headline}
              </span>
              <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 2, lineHeight: 1.4 }}>
                {a.detail}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
