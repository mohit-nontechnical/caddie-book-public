"use client";

import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import type { RoundSummary } from "./types";

function fmtDate(iso: string): string {
  // Bare dates (YYYY-MM-DD) parse as UTC midnight and can render a day early
  // locally — anchor them to noon, same as the desktop shell.
  const d = new Date(iso + (iso.length <= 10 ? "T12:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  onOpenRound: (r: RoundSummary) => void;
  courseFilter?: string;
}

export const RoundsView = ({ onOpenRound, courseFilter }: Props) => {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/rounds")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setRounds(json as RoundSummary[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load rounds"))
      .finally(() => setLoading(false));
  }, []);

  const displayed = courseFilter
    ? rounds.filter((r) => r.course === courseFilter)
    : rounds;

  return (
    <div style={{ padding: "0 16px 28px" }}>
      {/* Header — only when not filtering by course */}
      {!courseFilter && (
        <div style={{ padding: "6px 0 18px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>
            ROUNDS
          </div>
          <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>
            Every round
          </h1>
          <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>
            {loading
              ? "Loading rounds…"
              : error
              ? "Rounds unavailable."
              : `${rounds.length} round${rounds.length !== 1 ? "s" : ""} logged`}
          </p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 18, padding: "22px 18px", marginBottom: 12, opacity: 0.6 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", letterSpacing: "0.12em" }}>LOADING…</div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ background: hexA("#C05C5C", 0.1), border: "1px solid " + hexA("#C05C5C", 0.3), borderRadius: 14, padding: "14px 16px", marginBottom: 14, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>
          {error}
        </div>
      )}

      {/* Round cards */}
      {!loading && !error && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {displayed.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpenRound(r)}
              className="sc-tile"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "left",
                cursor: "pointer",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 16,
                padding: "14px 16px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.course || "Unknown Course"}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 3 }}>
                  {fmtDate(r.date)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                {r.shotScope && (
                  <span
                    title={`${r.shotScope.shots} shots tracked`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      color: "var(--gold)",
                      background: hexA("#F0C040", 0.12),
                      border: "1px solid " + hexA("#F0C040", 0.3),
                      padding: "3px 7px",
                      borderRadius: 6,
                    }}
                  >
                    SG
                  </span>
                )}
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  color: "var(--cream-3)",
                  background: hexA("#FFFFFF", 0.06),
                  padding: "3px 7px",
                  borderRadius: 6,
                }}>
                  {r.holeCount >= 18 ? "18" : r.holeCount >= 9 ? "9" : r.holeCount + "H"}
                </span>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: "var(--cream)", lineHeight: 1, minWidth: 36, textAlign: "right" }}>
                  {r.total}
                </div>
              </div>
            </button>
          ))}

          {displayed.length === 0 && (
            <div style={{ padding: "28px 0", textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--cream-3)" }}>
              {courseFilter ? "No rounds at this course yet." : "No rounds recorded yet."}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
