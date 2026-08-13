import React, { useCallback, useEffect, useRef, useState } from "react";
import { hexA } from "@/lib/caddie-data";
import { IconUpload, IconScan, IconBag, IconFlag } from "./icons";
import { SwingAnalyzer } from "./SwingAnalyzer";
import { RoundDebrief } from "./RoundDebrief";
import { CourseVerifyCard } from "./CourseVerifyCard";
import { ShotScopeImport } from "./ShotScopeImport";
import { useCourseVerify } from "./useCourseVerify";
import { TrendAlertsList } from "./TrendAlerts";
import type { TrendAlert } from "@/lib/trends";

const ScorecardSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 22, borderRadius: 5, background: hexA("#F0C040", 0.06 + (i % 3) * 0.05), animation: "scShimmer 1.4s ease-in-out infinite", animationDelay: i * 0.08 + "s" }} />
      ))}
    </div>
    <div style={{ display: "flex", gap: 5 }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 34, borderRadius: 5, background: "rgba(255,255,255,0.05)", animation: "scShimmer 1.4s ease-in-out infinite", animationDelay: 0.4 + i * 0.08 + "s" }} />
      ))}
    </div>
  </div>
);

type Stage = "idle" | "parsing" | "done" | "error";
interface ParsedRound {
  course?: string | null;
  total?: number;
  holes?: unknown[];
}
interface RecentRound {
  id: string;
  date: string;
  course: string;
  total: number;
  holeCount: number;
}

function relDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export const UploadView = ({ onParsed, onOpenInsights }: { onParsed: () => void; onOpenInsights?: () => void }) => {
  const [mode, setMode] = useState<"scorecard" | "swing" | "shotscope">("scorecard");
  const [stage, setStage] = useState<Stage>("idle");
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<ParsedRound | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");
  const [recent, setRecent] = useState<RecentRound[] | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefKey, setDebriefKey] = useState(0);
  const [trendAlerts, setTrendAlerts] = useState<TrendAlert[]>([]);
  const courseVerify = useCourseVerify();

  const steps = ["Reading scorecard…", "Parsing 18 holes…", "Matching fairways & GIR…", "Updating bag grades…"];
  const stepIdx = Math.min(steps.length - 1, Math.floor(pct / 26));

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/rounds");
      if (!res.ok) return;
      const data: RecentRound[] = await res.json();
      setRecent(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {
      /* leave as-is */
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Animated progress while parsing (caps at 92% until the request resolves).
  useEffect(() => {
    if (stage !== "parsing") return;
    setPct(0);
    const iv = setInterval(() => setPct((p) => (p >= 92 ? 92 : p + 3)), 55);
    return () => clearInterval(iv);
  }, [stage]);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function handleFile(file: File) {
    setStage("parsing");
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/parse-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Parse failed");
      setResult(data);
      setPct(100);
      setTimeout(() => setStage("done"), 350);
      loadRecent();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Something went wrong");
      setStage("error");
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportMsg("");
    setImportErr("");
    try {
      const text = await file.text();
      const archive = JSON.parse(text);
      const res = await fetch("/api/import-18birdies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(archive),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Import failed");
      const { added, updated, courses, courseNames } = data as {
        added: number;
        updated: number;
        courses: number;
        courseNames?: string[];
      };
      setImportMsg(
        added > 0
          ? `${added} new round${added === 1 ? "" : "s"} added · ${updated} already up to date · ${courses} courses.`
          : "You're all caught up — no new rounds since your last export."
      );
      if (added > 0) {
        setDebriefKey((k) => k + 1);
        setShowDebrief(true);
        // Non-blocking: kick off USGA verification for any estimated-rating
        // courses this import touched. A USGA outage here never affects the
        // import result already shown above.
        courseVerify.start(courseNames ?? []);
        // Non-blocking, zero-AI-cost: surface any deterministic trend shifts
        // now that fresh rounds are in. Never blocks the import result.
        fetch("/api/trends")
          .then((r) => r.json())
          .then((j) => {
            if (Array.isArray(j?.alerts)) setTrendAlerts(j.alerts);
          })
          .catch(() => {});
      } else {
        setTrendAlerts([]);
      }
      loadRecent();
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "Could not read that file");
    } finally {
      setImporting(false);
    }
  }

  // Demo path: simulate a parse without hitting the API (no key needed).
  function runDemo() {
    setStage("parsing");
    setResult({ course: "Sharp Park GC", total: 91, holes: Array.from({ length: 18 }) });
    setTimeout(() => {
      setPct(100);
      setTimeout(() => setStage("done"), 350);
    }, 1900);
  }

  const total = result?.total ?? 91;

  if (mode === "swing") return <SwingAnalyzer onBack={() => setMode("scorecard")} />;

  if (mode === "shotscope") {
    return (
      <div style={{ padding: "0 16px 28px" }}>
        <div style={{ padding: "6px 0 18px" }}>
          <button onClick={() => setMode("scorecard")} style={{ cursor: "pointer", background: "none", border: "none", padding: 0, fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)" }}>
            ‹ Upload
          </button>
          <h1 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Shot Scope import</h1>
          <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>
            Bring in shot-tracked rounds from your Connex tags — every club, lie, and strokes-gained number.
          </p>
        </div>
        <ShotScopeImport onImported={loadRecent} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 28px" }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <input ref={jsonRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />

      <div style={{ padding: "6px 0 18px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>SYNC YOUR ROUNDS</div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Bring in 18Birdies</h1>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>Keep scoring in 18Birdies. Drop your export here and the Caddie Book figures out what&apos;s costing you strokes.</p>
      </div>

      {stage === "idle" && (
        <>
          {/* Primary path: 18Birdies import */}
          <button onClick={() => jsonRef.current?.click()} disabled={importing} className="sc-press" style={{ width: "100%", cursor: importing ? "default" : "pointer", borderRadius: 20, padding: "30px 20px", marginBottom: 12, border: "1.5px dashed " + hexA("#F0C040", 0.5), background: "linear-gradient(160deg, " + hexA("#F0C040", 0.08) + ", transparent), var(--panel)", display: "flex", flexDirection: "column", alignItems: "center", gap: 13, opacity: importing ? 0.6 : 1 }}>
            <span style={{ width: 56, height: 56, borderRadius: 18, background: hexA("#F0C040", 0.14), display: "grid", placeItems: "center" }}>
              <IconBag size={26} stroke="var(--gold)" />
            </span>
            <span style={{ textAlign: "center" }}>
              <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--cream)" }}>Import 18Birdies export</span>
              <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", marginTop: 4 }}>Account → Download Your Data → drop the JSON</span>
            </span>
          </button>

          {/* Shot Scope shot-tracked rounds */}
          <button onClick={() => setMode("shotscope")} className="sc-tile" style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "var(--panel)", border: "1px solid " + hexA("#F0C040", 0.35), borderRadius: 16, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: hexA("#F0C040", 0.12), display: "grid", placeItems: "center", flexShrink: 0 }}>
              <IconFlag size={20} stroke="var(--gold)" />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>Shot Scope tags</span>
              <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", marginTop: 2 }}>Shot-by-shot rounds — CSV, sheet link, or paste</span>
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--gold)", background: hexA("#F0C040", 0.12), padding: "3px 8px", borderRadius: 6 }}>SG</span>
          </button>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", listStyle: "none", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--cream-3)", padding: "2px 2px 8px" }}>How do I get my 18Birdies export? ›</summary>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.55, padding: "2px 4px 4px" }}>
              In the 18Birdies app: <b>Profile → Settings → Account → Download Your Account Data</b>. They email you a JSON file with every round. Drop that file above — re-importing later only adds new rounds, nothing is duplicated.
            </div>
          </details>

          {/* Secondary fallbacks */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Scorecard photo", "No 18Birdies? Snap it", <IconUpload key="u" size={20} stroke="var(--cream)" />, () => fileRef.current?.click()], ["Swing video", "Range or course clip", <IconScan key="s" size={20} stroke="var(--cream)" />, () => setMode("swing")]].map(([title, sub, icon, onClick], i) => (
              <button key={i} onClick={onClick as () => void} className="sc-tile" style={{ textAlign: "left", cursor: "pointer", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px", display: "flex", flexDirection: "column", gap: 11 }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "grid", placeItems: "center" }}>{icon as React.ReactNode}</span>
                <span>
                  <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)" }}>{title as string}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 2 }}>{sub as string}</span>
                </span>
              </button>
            ))}
          </div>

          {importing && (
            <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid var(--line)", background: "var(--panel)", padding: "12px 14px", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)" }}>Importing your 18Birdies history…</div>
          )}
          {importMsg && (
            <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid " + hexA("#4CAF82", 0.4), background: hexA("#4CAF82", 0.1), padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--good)", fontSize: 15 }}>✓</span>
              <span style={{ flex: 1, fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>{importMsg}</span>
            </div>
          )}
          {importErr && (
            <div style={{ marginTop: 12, borderRadius: 12, border: "1px solid " + hexA("#C05C5C", 0.4), background: hexA("#C05C5C", 0.08), padding: "12px 14px", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>{importErr}</div>
          )}

          {trendAlerts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", margin: "0 2px 9px", textTransform: "uppercase" }}>Trends</div>
              <TrendAlertsList alerts={trendAlerts} />
            </div>
          )}

          {showDebrief && (
            <div style={{ marginTop: 14 }}>
              <RoundDebrief key={debriefKey} onOpenCoach={onOpenInsights} />
            </div>
          )}

          {courseVerify.hasWork && (
            <CourseVerifyCard
              theme="dark"
              items={courseVerify.items}
              onPickCandidate={courseVerify.pickCandidate}
              onPickTee={(courseName, tee) => courseVerify.apply(courseName, tee)}
              onApplyTips={(courseName, edited) => courseVerify.applyTips(courseName, edited)}
              onSkip={courseVerify.skip}
              onSkipAll={courseVerify.skipAll}
              onRetry={courseVerify.retry}
            />
          )}

          <button onClick={runDemo} className="sc-press" style={{ marginTop: 12, width: "100%", borderRadius: 12, padding: "11px", cursor: "pointer", border: "1px solid var(--line)", background: "transparent", color: "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500 }}>Try a demo parse (no upload)</button>

          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--cream-3)", margin: "22px 2px 11px", textTransform: "uppercase" }}>Recent rounds {recent ? `· ${recent.length}` : ""}</div>
          {recent === null && (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", padding: "4px 2px" }}>Loading your rounds…</div>
          )}
          {recent !== null && recent.length === 0 && (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", padding: "10px 14px", border: "1px dashed var(--line)", borderRadius: 14, lineHeight: 1.5 }}>No rounds yet. Import your 18Birdies export above to get started.</div>
          )}
          {(recent ?? []).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, marginBottom: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: hexA("#4CAF82", 0.13), display: "grid", placeItems: "center" }}>
                <IconFlag size={17} stroke="var(--good)" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.course}</span>
                <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", marginTop: 1 }}>{r.total} · {r.holeCount < 18 ? `${r.holeCount}h · ` : ""}{relDate(r.date)}</span>
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--good)" }}>Logged</span>
            </div>
          ))}
        </>
      )}

      {stage === "parsing" && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", border: "1px solid var(--line)", background: "var(--panel)", padding: "26px 22px" }}>
            <ScorecardSkeleton />
            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)" }}>{steps[stepIdx]}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--gold)" }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: pct + "%", background: "var(--gold)", borderRadius: 6, transition: "width 0.1s linear" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ borderRadius: 20, border: "1px solid " + hexA("#4CAF82", 0.45), background: "linear-gradient(160deg, " + hexA("#4CAF82", 0.12) + ", transparent), var(--panel)", padding: "24px 20px", textAlign: "center" }}>
            <span style={{ width: 56, height: 56, borderRadius: 999, background: hexA("#4CAF82", 0.18), display: "grid", placeItems: "center", margin: "0 auto", color: "var(--good)", fontSize: 26 }}>✓</span>
            <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 600, color: "var(--cream)" }}>Round logged — {total}</h2>
            <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)", lineHeight: 1.4 }}>{result?.holes?.length ?? 18} holes parsed. Open Insights to see what it changed.</p>
          </div>
          <button onClick={onParsed} className="sc-press" style={{ marginTop: 14, width: "100%", borderRadius: 14, padding: "15px", cursor: "pointer", border: "none", background: "var(--gold)", color: "#0F2016", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700 }}>See what Coach found</button>
          <button onClick={() => { setStage("idle"); setResult(null); }} className="sc-press" style={{ marginTop: 9, width: "100%", borderRadius: 14, padding: "13px", cursor: "pointer", border: "1px solid var(--line)", background: "transparent", color: "var(--cream-2)", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500 }}>Upload another</button>
        </div>
      )}

      {stage === "error" && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ borderRadius: 20, border: "1px solid " + hexA("#C05C5C", 0.45), background: "linear-gradient(160deg, " + hexA("#C05C5C", 0.12) + ", transparent), var(--panel)", padding: "24px 20px", textAlign: "center" }}>
            <span style={{ width: 56, height: 56, borderRadius: 999, background: hexA("#C05C5C", 0.18), display: "grid", placeItems: "center", margin: "0 auto", color: "var(--bad)", fontSize: 26 }}>!</span>
            <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--cream)" }}>Couldn&apos;t parse that</h2>
            <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.45 }}>{errMsg}</p>
          </div>
          <button onClick={() => setStage("idle")} className="sc-press" style={{ marginTop: 14, width: "100%", borderRadius: 14, padding: "15px", cursor: "pointer", border: "none", background: "var(--gold)", color: "#0F2016", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700 }}>Try again</button>
        </div>
      )}
    </div>
  );
};
