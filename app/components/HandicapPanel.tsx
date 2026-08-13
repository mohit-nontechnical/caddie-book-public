import React, { useEffect, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { Sparkline, SLabel } from "./primitives";
import { IconChevron } from "./icons";
import { useHandicap, CourseRow } from "./useHandicap";

const INCLUDE9_KEY = "caddie:include9";

// ── USGA auto-fill types (mirrors app/api/course-lookup response shapes) ──
interface UsgaCandidate {
  /** Local sheet row id — present when candidates came from the local USGA sheet (source: "sheet"). */
  id?: number;
  /** Legacy live-NCRDB id — present only when the local sheet was empty/unavailable. */
  courseID?: number;
  name: string;
  facility?: string;
  city: string;
  state: string;
}

interface UsgaTee {
  tee: string;
  gender: "M" | "F";
  par: number;
  rating: number;
  slope: number;
  yards?: number;
}

interface UsgaTips {
  rating: number;
  slope: number;
  par: number;
}

type UsgaStep = "idle" | "loading-candidates" | "candidates" | "loading-tees" | "tees" | "tips" | "error";

// Build a reasonable-but-simple search query from a stored course name:
// strip parenthetical suffixes like "(9)" and keep the first few significant words.
function cleanCourseQuery(name: string): string {
  const noParens = name.replace(/\([^)]*\)/g, " ").trim();
  const words = noParens.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.max(3, Math.min(words.length, 4))).join(" ");
}

const USGA_9HOLE_PAR_THRESHOLD = 40;

const CourseEditRow = ({ c, onSaved }: { c: CourseRow; onSaved: () => void }) => {
  const [rating, setRating] = useState(String(c.rating));
  const [slope, setSlope] = useState(String(c.slope));
  const [par, setPar] = useState(String(c.par));
  const [saving, setSaving] = useState(false);
  const dirty = rating !== String(c.rating) || slope !== String(c.slope) || par !== String(c.par);

  const [usgaOpen, setUsgaOpen] = useState(false);
  const [usgaStep, setUsgaStep] = useState<UsgaStep>("idle");
  const [usgaError, setUsgaError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<UsgaCandidate[]>([]);
  const [tees, setTees] = useState<UsgaTee[]>([]);
  const [tips, setTips] = useState<UsgaTips | null>(null);
  const [tipsRating, setTipsRating] = useState("");
  const [tipsSlope, setTipsSlope] = useState("");
  const [tipsPar, setTipsPar] = useState("");
  const [nineHoleNote, setNineHoleNote] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/courses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: c.name, rating: Number(rating), slope: Number(slope), par: Number(par) }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function startUsgaLookup() {
    setUsgaOpen(true);
    setUsgaStep("loading-candidates");
    setUsgaError(null);
    setCandidates([]);
    setTees([]);
    setTips(null);
    setNineHoleNote(false);
    try {
      const q = cleanCourseQuery(c.name);
      const res = await fetch(`/api/course-lookup?name=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Lookup failed");
      setCandidates(data.candidates ?? []);
      setUsgaStep("candidates");
    } catch (err) {
      setUsgaError(err instanceof Error ? err.message : "Lookup failed");
      setUsgaStep("error");
    }
  }

  // Local-sheet candidates (have `id`) go through ?candidateId=, which
  // attempts a live NCRDB per-tee match and falls back to the sheet's
  // labeled tips rating on ANY NCRDB failure. Legacy live-NCRDB candidates
  // (only reached if the local sheet was empty/unavailable) use ?courseId=.
  async function pickCandidate(cand: UsgaCandidate) {
    setUsgaStep("loading-tees");
    setUsgaError(null);
    try {
      const url = cand.id !== undefined ? `/api/course-lookup?candidateId=${cand.id}` : `/api/course-lookup?courseId=${cand.courseID}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Tee lookup failed");
      if (data.source === "tips" && data.tips) {
        setTips(data.tips);
        setTipsRating(String(data.tips.rating));
        setTipsSlope(String(data.tips.slope));
        setTipsPar(String(data.tips.par));
        setUsgaStep("tips");
        return;
      }
      setTees(data.tees ?? []);
      setUsgaStep("tees");
    } catch (err) {
      setUsgaError(err instanceof Error ? err.message : "Tee lookup failed");
      setUsgaStep("error");
    }
  }

  function pickTee(t: UsgaTee) {
    // This app stores 9-hole courses on an 18-hole basis (rating & par
    // doubled, slope kept as-is). A par this low means the NCRDB tee is a
    // 9-hole rating, so double par + rating before filling.
    const is9 = t.par <= USGA_9HOLE_PAR_THRESHOLD;
    setPar(String(is9 ? t.par * 2 : t.par));
    setRating(String(is9 ? Math.round(t.rating * 2 * 10) / 10 : t.rating));
    setSlope(String(t.slope));
    setNineHoleNote(is9);
    setUsgaOpen(false);
    setUsgaStep("idle");
  }

  // Applies the user-EDITED tips values (never the raw tips numbers
  // silently) — same 9-hole doubling rule as pickTee.
  function applyTips() {
    const r = Number(tipsRating), s = Number(tipsSlope), p = Number(tipsPar);
    if (!(r > 0) || !(s > 0) || !(p > 0)) return;
    const is9 = p <= USGA_9HOLE_PAR_THRESHOLD;
    setPar(String(is9 ? p * 2 : p));
    setRating(String(is9 ? Math.round(r * 2 * 10) / 10 : r));
    setSlope(String(s));
    setNineHoleNote(is9);
    setUsgaOpen(false);
    setUsgaStep("idle");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid var(--line)", borderRadius: 8,
    padding: "7px 8px", color: "var(--cream)", fontFamily: "var(--font-mono)", fontSize: 13, textAlign: "center",
  };

  return (
    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cream-3)" }}>{c.rounds18} rnd</span>
        {c.estimated && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", background: hexA("#F0C040", 0.14), padding: "2px 6px", borderRadius: 5 }}>EST</span>}
        <button
          onClick={startUsgaLookup}
          className="sc-press"
          style={{ flexShrink: 0, borderRadius: 6, padding: "3px 7px", cursor: "pointer", border: "1px solid " + hexA("#F0C040", 0.35), background: hexA("#F0C040", 0.1), color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em" }}
        >
          USGA
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 7, alignItems: "end" }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginBottom: 3 }}>RATING</span>
          <input style={inputStyle} value={rating} inputMode="decimal" onChange={(e) => setRating(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginBottom: 3 }}>SLOPE</span>
          <input style={inputStyle} value={slope} inputMode="numeric" onChange={(e) => setSlope(e.target.value)} />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginBottom: 3 }}>PAR</span>
          <input style={inputStyle} value={par} inputMode="numeric" onChange={(e) => setPar(e.target.value)} />
        </label>
        <button onClick={save} disabled={!dirty || saving} className="sc-press" style={{ borderRadius: 8, padding: "8px 12px", cursor: dirty && !saving ? "pointer" : "default", border: "none", background: dirty ? "var(--gold)" : "rgba(255,255,255,0.07)", color: dirty ? "#0F2016" : "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700 }}>
          {saving ? "…" : "Save"}
        </button>
      </div>

      {nineHoleNote && (
        <div style={{ marginTop: 7, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--gold)" }}>
          (9-hole ×2) — rating &amp; par doubled, slope kept as-is
        </div>
      )}

      {usgaOpen && (
        <div style={{ marginTop: 10, padding: "10px 11px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)" }}>
          {usgaStep === "loading-candidates" && (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>Searching USGA…</div>
          )}
          {usgaStep === "loading-tees" && (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>Loading tees…</div>
          )}
          {usgaStep === "error" && (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--bad)" }}>{usgaError || "Something went wrong."}</div>
          )}
          {usgaStep === "candidates" && (
            candidates.length === 0 ? (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>Not in USGA DB.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {candidates.map((cand) => (
                  <button
                    key={cand.id ?? cand.courseID}
                    onClick={() => pickCandidate(cand)}
                    className="sc-press"
                    style={{ textAlign: "left", background: "rgba(255,255,255,0.05)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                  >
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--cream)" }}>{cand.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cream-3)" }}>{[cand.city, cand.state].filter(Boolean).join(", ")}</div>
                  </button>
                ))}
              </div>
            )
          )}
          {usgaStep === "tips" && tips && (
            <div>
              <div
                style={{
                  display: "inline-block",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--gold)",
                  background: hexA("#F0C040", 0.14),
                  padding: "3px 7px",
                  borderRadius: 5,
                  marginBottom: 7,
                }}
              >
                TIPS RATING — adjust if you played forward
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 7, alignItems: "end" }}>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginBottom: 3 }}>RATING</span>
                  <input style={inputStyle} value={tipsRating} inputMode="decimal" onChange={(e) => setTipsRating(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginBottom: 3 }}>SLOPE</span>
                  <input style={inputStyle} value={tipsSlope} inputMode="numeric" onChange={(e) => setTipsSlope(e.target.value)} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginBottom: 3 }}>PAR</span>
                  <input style={inputStyle} value={tipsPar} inputMode="numeric" onChange={(e) => setTipsPar(e.target.value)} />
                </label>
                <button
                  onClick={applyTips}
                  className="sc-press"
                  style={{ borderRadius: 8, padding: "8px 12px", cursor: "pointer", border: "none", background: "var(--gold)", color: "#0F2016", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700 }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
          {usgaStep === "tees" && (
            tees.length === 0 ? (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)" }}>No tees found for this course.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {tees.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => pickTee(t)}
                    className="sc-press"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left", background: "rgba(255,255,255,0.05)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
                  >
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--cream)" }}>{t.tee}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)" }}>Par {t.par} · {t.rating.toFixed(1)}/{t.slope}</span>
                  </button>
                ))}
              </div>
            )
          )}
          <button
            onClick={() => { setUsgaOpen(false); setUsgaStep("idle"); }}
            className="sc-press"
            style={{ marginTop: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--cream-3)", padding: 0 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export const HandicapPanel = () => {
  const [include9, setInclude9] = useState(true);

  // Hydrate from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INCLUDE9_KEY);
      if (stored !== null) setInclude9(stored !== "0");
    } catch { /* ignore */ }
  }, []);

  function toggleInclude9() {
    setInclude9((v) => {
      const next = !v;
      try { localStorage.setItem(INCLUDE9_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  const { data, loading, reload } = useHandicap(include9);
  const [showEditor, setShowEditor] = useState(false);

  const index = data?.index;
  const trendData = (data?.trend ?? []).map((t) => 60 - t.index); // invert: lower index = higher line
  const estCount = data?.estimatedCourses?.length ?? 0;

  return (
    <>
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px", marginBottom: 11 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "var(--cream-3)" }}>HANDICAP INDEX (WHS)</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 46, lineHeight: 1, fontWeight: 600, color: "var(--cream)", marginTop: 6 }}>
              {loading ? "…" : index != null ? index.toFixed(1) : "—"}
            </div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 5 }}>
              {loading
                ? "Calculating…"
                : index != null
                  ? `Best ${Math.min(8, (data?.roundsUsed ?? 0) >= 20 ? 8 : (data?.roundsUsed ?? 0))} of last ${Math.min(20, data?.roundsUsed ?? 0)} · ${data?.roundsUsed ?? 0} eligible rounds (${data?.rounds18 ?? 0} × 18-hole${(data?.rounds9 ?? 0) > 0 ? `, ${data?.rounds9} × 9-hole` : ""})`
                  : "Need at least 3 rounds"}
            </div>
          </div>
          {trendData.length > 1 && (
            <div style={{ width: 110, paddingTop: 8 }}>
              <Sparkline data={trendData} color="var(--good)" w={110} h={42} sw={2.2} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cream-3)", textAlign: "right", marginTop: 4 }}>TREND</div>
            </div>
          )}
        </div>

        {estCount > 0 && (
          <div style={{ marginTop: 13, padding: "10px 12px", borderRadius: 11, background: hexA("#F0C040", 0.1), border: "1px solid " + hexA("#F0C040", 0.3), fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-2)", lineHeight: 1.4 }}>
            {estCount} course{estCount === 1 ? "" : "s"} use estimated ratings. Refine them for an accurate index.
          </div>
        )}

        <button onClick={toggleInclude9} className="sc-press" style={{ marginTop: 13, width: "100%", display: "flex", alignItems: "center", gap: 11, background: "transparent", border: "1px solid var(--line)", borderRadius: 11, padding: "11px 13px", cursor: "pointer", textAlign: "left" }}>
          <span style={{ width: 38, height: 22, borderRadius: 999, background: include9 ? "var(--gold)" : "rgba(255,255,255,0.12)", position: "relative", flexShrink: 0, transition: "background 0.15s ease" }}>
            <span style={{ position: "absolute", top: 2, left: include9 ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left 0.15s ease" }} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>Include 9-hole rounds</span>
            <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 1 }}>Uses the WHS doubling approximation for 9-hole differentials</span>
          </span>
        </button>

        <button onClick={() => setShowEditor((v) => !v)} className="sc-press" style={{ marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "1px solid var(--line)", borderRadius: 11, padding: "11px 13px", cursor: "pointer" }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--cream)" }}>Manage course ratings</span>
          <span style={{ transform: showEditor ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}><IconChevron size={16} stroke="var(--cream-3)" /></span>
        </button>
      </div>

      {showEditor && data && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", marginBottom: 11 }}>
          <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--line)" }}>
            <SLabel>Course ratings · {data.courses?.length ?? 0}</SLabel>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", lineHeight: 1.4 }}>Enter the Rating / Slope / Par from the tees you play. Saved values stop being &quot;estimated&quot;.</div>
          </div>
          {(data.courses ?? []).map((c) => (
            <CourseEditRow key={c.norm} c={c} onSaved={reload} />
          ))}
        </div>
      )}
    </>
  );
};
