"use client";

import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { Back, SLabel } from "./primitives";
import { RoundsView } from "./RoundsView";
import { CourseStrategyCard } from "./CourseStrategyCard";
import { useCoachStyle } from "./useCoachStyle";
import type { RoundSummary } from "./types";

interface Props {
  course: string;
  onBack: () => void;
  onOpenRound: (r: RoundSummary) => void;
}

export const CourseDetail = ({ course, onBack, onOpenRound }: Props) => {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [style] = useCoachStyle();

  useEffect(() => {
    fetch("/api/rounds")
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) {
          const filtered = (json as RoundSummary[]).filter((r) => r.course === course);
          setRounds(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [course]);

  const rounds18 = rounds.filter((r) => r.holeCount >= 18);
  const totals18 = rounds18.map((r) => r.total);
  const avg18 = totals18.length > 0
    ? (totals18.reduce((a, b) => a + b, 0) / totals18.length).toFixed(1)
    : null;
  const best18 = totals18.length > 0 ? Math.min(...totals18) : null;

  return (
    <div style={{ paddingBottom: 28 }}>
      <Back onBack={onBack} label="Courses" />

      {/* Course header */}
      <div style={{ padding: "0 16px 18px" }}>
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: "18px 18px 16px",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", marginBottom: 6 }}>
            COURSE
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--cream)", lineHeight: 1.1, marginBottom: 14 }}>
            {course}
          </div>

          {/* Quick stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {[
              ["Rounds", loading ? "…" : rounds.length, false],
              ["Avg (18)", loading ? "…" : avg18 ?? "—", false],
              ["Best (18)", loading ? "…" : best18 ?? "—", false],
            ].map(([label, value, _]) => (
              <div key={String(label)} style={{ background: hexA("#FFFFFF", 0.04), borderRadius: 10, padding: "9px 10px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--cream)", fontWeight: 500 }}>
                  {String(value)}
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--cream-3)", marginTop: 3 }}>
                  {String(label)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <CourseStrategyCard theme="dark" course={course} style={style} />
      </div>

      {/* Rounds at this course */}
      <div style={{ padding: "0 16px 8px" }}>
        <SLabel>Rounds here</SLabel>
      </div>
      <RoundsView onOpenRound={onOpenRound} courseFilter={course} />
    </div>
  );
};
