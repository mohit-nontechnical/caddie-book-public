import React, { useEffect, useRef, useState } from "react";
import { slots, gradeColor, hexA } from "@/lib/caddie-data";
import { measureSwing, type PoseSummary } from "@/lib/pose";
import { Back } from "./primitives";
import { IconScan, IconSpark, IconTarget } from "./icons";
import { getCoachStyle } from "./useCoachStyle";

interface SwingResult {
  id?: string; // present only when persisted (demo reads aren't saved)
  observation: string;
  drillRecommendation: string;
  bagSlotAffected: string;
  confidence: "low" | "medium" | "high";
  trend?: string | null;
  metrics?: Record<string, number | null>;
}

interface SwingMemory {
  id: string;
  date: string;
  club?: string;
  observation: string;
  drill: string;
  bagSlot: string;
  confidence: string;
  trend?: string;
  metrics?: Record<string, number | null>;
  source: "video" | "photos";
}

type Stage = "idle" | "extracting" | "measuring" | "analyzing" | "done" | "error";

// Display labels for measured metrics, in preferred order.
const METRIC_LABELS: [key: string, label: string, unit: string][] = [
  ["shoulderTurnAtTopDeg", "SHOULDER TURN", "°"],
  ["hipTurnAtTopDeg", "HIP TURN", "°"],
  ["xFactorAtTopDeg", "X-FACTOR", "°"],
  ["maxHeadSwayPct", "HEAD SWAY", "%"],
  ["spineTiltAtAddressDeg", "SPINE @ ADDRESS", "°"],
  ["spineTiltAtTopDeg", "SPINE @ TOP", "°"],
];

function metricChips(metrics: Record<string, number | null> | undefined, max = 4) {
  if (!metrics) return [];
  return METRIC_LABELS.filter(([k]) => typeof metrics[k] === "number")
    .slice(0, max)
    .map(([k, label, unit]) => ({ label, value: `${metrics[k]}${unit}` }));
}

const MAX_FRAMES = 8;
const MAX_DIM = 640;

// ── Client-side video → frames (no upload of the video itself) ──
function seekTo(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Video seek timed out")), 8000);
    const onSeeked = () => {
      clearTimeout(timer);
      v.removeEventListener("seeked", onSeeked);
      resolve();
    };
    v.addEventListener("seeked", onSeeked);
    v.currentTime = t;
  });
}

// Pass 1 — find the swing. Range clips (especially slo-mo) are mostly the
// player standing over the ball; a coarse motion scan at thumbnail res
// locates the high-motion window so every captured frame lands on the swing.
async function findMotionWindow(
  video: HTMLVideoElement,
  duration: number
): Promise<{ start: number; end: number }> {
  const scans = Math.min(32, Math.max(12, Math.ceil(duration * 2)));
  const w = 96;
  const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { start: 0, end: duration };

  const times: number[] = [];
  const motion: number[] = [];
  let prev: Uint8ClampedArray | null = null;
  for (let i = 0; i < scans; i++) {
    const t = Math.min(duration - 0.05, (duration * i) / (scans - 1));
    await seekTo(video, Math.max(0, t));
    ctx.drawImage(video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    if (prev) {
      let sum = 0;
      for (let p = 0; p < data.length; p += 8) {
        sum += Math.abs(data[p] - prev[p]) + Math.abs(data[p + 1] - prev[p + 1]);
      }
      times.push(t);
      motion.push(sum);
    }
    prev = data.slice();
  }

  const peak = Math.max(...motion);
  if (!isFinite(peak) || peak <= 0) return { start: 0, end: duration };
  const thresh = peak * 0.2;
  const step = duration / (scans - 1);
  const first = motion.findIndex((m) => m >= thresh);
  let last = -1;
  for (let i = motion.length - 1; i >= 0; i--) {
    if (motion[i] >= thresh) { last = i; break; }
  }
  if (first < 0 || last < 0) return { start: 0, end: duration };
  const start = Math.max(0, times[first] - step);
  const end = Math.min(duration, times[last] + step);
  if (end - start < 0.5) {
    // Window suspiciously tight — pad around the peak instead.
    const pi = motion.indexOf(peak);
    return { start: Math.max(0, times[pi] - 1), end: Math.min(duration, times[pi] + 1) };
  }
  return { start, end };
}

async function videoToFrames(
  file: File,
  onProgress: (done: number, total: number) => void
): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Couldn't read that video")), 10000);
      video.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error("Couldn't read that video")); };
    });
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) throw new Error("Couldn't read the video length");

    // Pass 1 — locate the swing (progress total 0 → UI shows "finding your swing").
    onProgress(0, 0);
    let win = { start: 0, end: duration };
    if (duration > 3) {
      try {
        win = await findMotionWindow(video, duration);
      } catch {
        /* fall back to the whole clip */
      }
    }
    const span = Math.max(0.3, win.end - win.start);

    // Pass 2 — capture full-res frames evenly across the swing window.
    const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    const n = MAX_FRAMES;
    const frames: string[] = [];
    for (let i = 0; i < n; i++) {
      // Middle of each slice so we hit address → top → impact → finish.
      const t = Math.min(duration - 0.05, win.start + (span * (i + 0.5)) / n);
      await seekTo(video, Math.max(0, t));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.7));
      onProgress(i + 1, n);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imagesToDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(
    files.slice(0, 3).map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(file);
        })
    )
  );
}

export const SwingAnalyzer = ({ onBack }: { onBack: () => void }) => {
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<SwingResult | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [count, setCount] = useState(0);
  const [extractDone, setExtractDone] = useState(0);
  const [extractTotal, setExtractTotal] = useState(0);
  const [club, setClub] = useState("");
  const [history, setHistory] = useState<SwingMemory[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadHistory() {
    try {
      const res = await fetch("/api/analyze-swing");
      const data = await res.json();
      if (Array.isArray(data?.analyses)) setHistory(data.analyses);
    } catch {
      /* history is best-effort */
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleFiles(fileList: FileList) {
    const files = Array.from(fileList);
    const video = files.find((f) => f.type.startsWith("video/"));
    try {
      let frames: string[];
      let source: "video" | "photos";
      if (video) {
        source = "video";
        setExtractDone(0);
        setExtractTotal(0); // 0 = motion-scan phase; capture pass sets the real total
        setStage("extracting");
        frames = await videoToFrames(video, (done, total) => {
          setExtractDone(done);
          setExtractTotal(total);
        });
      } else {
        source = "photos";
        frames = await imagesToDataUrls(files.filter((f) => f.type.startsWith("image/")));
        if (!frames.length) throw new Error("Pick a video or 2–3 swing photos");
      }
      setCount(frames.length);

      // Measure body positions locally (MediaPipe) — best-effort, never blocks the read.
      setStage("measuring");
      let pose: PoseSummary | null = null;
      try {
        pose = await Promise.race([
          measureSwing(frames),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 25000)),
        ]);
      } catch {
        pose = null;
      }

      setStage("analyzing");
      const res = await fetch("/api/analyze-swing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, source, club: club.trim() || undefined, pose: pose ?? undefined, style: getCoachStyle() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Analysis failed");
      setResult(data);
      setStage("done");
      loadHistory();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Something went wrong");
      setStage("error");
    }
  }

  function runDemo() {
    setStage("analyzing");
    setCount(3);
    setTimeout(() => {
      setResult({
        observation:
          "Lead wrist cups at the top and the clubface opens through impact — that's the source of the push-slice with the driver.",
        drillRecommendation: "Tempo Count — 3-to-1 backswing-to-downswing count at 80% effort.",
        bagSlotAffected: "driver",
        confidence: "high",
      });
      setStage("done");
    }, 1700);
  }

  async function forget(id: string) {
    setHistory((h) => h.filter((x) => x.id !== id));
    try {
      await fetch("/api/analyze-swing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      loadHistory();
    }
  }

  const slot = result ? slots.find((s) => s.id === result.bagSlotAffected) : undefined;
  const c = slot ? gradeColor(slot.grade) : "var(--gold)";
  const confColor = result?.confidence === "high" ? "var(--good)" : result?.confidence === "low" ? "var(--bad)" : "var(--gold)";

  return (
    <div style={{ paddingBottom: 28 }}>
      <Back onBack={onBack} label="Upload" />
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />

      <div style={{ padding: "0 16px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", color: "var(--cream-3)" }}>SWING ANALYSIS</div>
        <h1 style={{ margin: "3px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 600, color: "var(--cream)", letterSpacing: "-0.015em" }}>Read my swing</h1>
        <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-3)", lineHeight: 1.4 }}>Drop a swing video (or 2–3 frames). Coach reads it, spots the fault, assigns a drill — and remembers it.</p>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {stage === "idle" && (
          <>
            <button onClick={() => fileRef.current?.click()} className="sc-press" style={{ width: "100%", cursor: "pointer", borderRadius: 20, padding: "34px 20px", border: "1.5px dashed " + hexA("#F0C040", 0.5), background: "linear-gradient(160deg, " + hexA("#F0C040", 0.07) + ", transparent), var(--panel)", display: "flex", flexDirection: "column", alignItems: "center", gap: 13 }}>
              <span style={{ width: 56, height: 56, borderRadius: 18, background: hexA("#F0C040", 0.14), display: "grid", placeItems: "center" }}>
                <IconScan size={26} stroke="var(--gold)" />
              </span>
              <span style={{ textAlign: "center" }}>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--cream)" }}>Upload a swing video</span>
                <span style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-3)", marginTop: 4 }}>MP4 / MOV · or 2–3 JPG frames · one swing</span>
              </span>
            </button>

            <input
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Which club? (optional — helps Coach's memory)"
              style={{ marginTop: 12, width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--cream)", fontFamily: "var(--font-ui)", fontSize: 13, outline: "none" }}
            />

            <button onClick={runDemo} className="sc-press" style={{ marginTop: 12, width: "100%", borderRadius: 12, padding: "11px", cursor: "pointer", border: "1px solid var(--line)", background: "transparent", color: "var(--cream-3)", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 500 }}>Try a demo analysis (no upload)</button>

            {history.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--cream-3)", marginBottom: 10 }}>COACH&apos;S MEMORY · {history.length} READ{history.length === 1 ? "" : "S"}</div>
                {history.map((h) => {
                  const hs = slots.find((s) => s.id === h.bagSlot);
                  const hc = hs ? gradeColor(hs.grade) : "var(--gold)";
                  return (
                    <div key={h.id} style={{ borderRadius: 14, border: "1px solid var(--line)", background: "var(--panel)", padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: "var(--cream-3)" }}>
                          {h.date.slice(0, 10)}{h.club ? ` · ${h.club.toUpperCase()}` : ""}{h.source === "video" ? " · VIDEO" : ""}
                        </span>
                        <button onClick={() => forget(h.id)} title="Forget this read" style={{ border: "none", background: "transparent", color: "var(--cream-3)", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 4 }}>×</button>
                      </div>
                      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream)", lineHeight: 1.45 }}>{h.observation}</p>
                      {metricChips(h.metrics, 4).length > 0 && (
                        <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.05em", color: "var(--cream-3)" }}>
                          {metricChips(h.metrics, 4).map((m) => `${m.label} ${m.value}`).join(" · ")}
                        </div>
                      )}
                      {h.trend && (
                        <p style={{ margin: "5px 0 0", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--gold)", lineHeight: 1.4 }}>↗ {h.trend}</p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
                        {hs && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.06em", color: String(hc), background: hexA(String(hc), 0.14), padding: "2px 8px", borderRadius: 999 }}>{hs.name.toUpperCase()}</span>
                        )}
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)" }}>{h.drill}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {stage === "extracting" && (
          <div style={{ borderRadius: 18, border: "1px solid var(--line)", background: "var(--panel)", padding: "30px 22px", textAlign: "center" }}>
            <span style={{ width: 50, height: 50, borderRadius: 999, background: hexA("#F0C040", 0.14), display: "grid", placeItems: "center", margin: "0 auto" }}>
              <IconScan size={24} stroke="var(--gold)" />
            </span>
            <div style={{ marginTop: 14, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>
              {extractTotal === 0 ? "Finding your swing in the video…" : `Pulling frames from your swing… ${extractDone}/${extractTotal}`}
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", letterSpacing: "0.1em" }}>
              {extractTotal === 0 ? "SCANNING FOR MOTION" : "ADDRESS → TOP → IMPACT → FINISH"}
            </div>
          </div>
        )}

        {stage === "measuring" && (
          <div style={{ borderRadius: 18, border: "1px solid var(--line)", background: "var(--panel)", padding: "30px 22px", textAlign: "center" }}>
            <span style={{ width: 50, height: 50, borderRadius: 999, background: hexA("#F0C040", 0.14), display: "grid", placeItems: "center", margin: "0 auto" }}>
              <IconScan size={24} stroke="var(--gold)" />
            </span>
            <div style={{ marginTop: 14, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>Measuring body positions…</div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", letterSpacing: "0.1em" }}>SHOULDER TURN · HIP TURN · SPINE TILT · HEAD SWAY</div>
          </div>
        )}

        {stage === "analyzing" && (
          <div style={{ borderRadius: 18, border: "1px solid var(--line)", background: "var(--panel)", padding: "30px 22px", textAlign: "center" }}>
            <span style={{ width: 50, height: 50, borderRadius: 999, background: hexA("#F0C040", 0.14), display: "grid", placeItems: "center", margin: "0 auto" }}>
              <IconScan size={24} stroke="var(--gold)" />
            </span>
            <div style={{ marginTop: 14, fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--cream)" }}>Analyzing {count} frame{count === 1 ? "" : "s"}…</div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--cream-3)", letterSpacing: "0.1em" }}>READING SWING PATH</div>
          </div>
        )}

        {stage === "done" && result && (
          <div>
            <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", border: "1px solid " + hexA(String(c), 0.4), background: "linear-gradient(160deg, " + hexA(String(c), 0.14) + ", transparent 65%), var(--panel)", padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <IconSpark size={15} stroke="var(--gold)" />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", color: "var(--gold)" }}>COACH READ</span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", color: confColor, background: hexA(confColor === "var(--good)" ? "#4CAF82" : confColor === "var(--bad)" ? "#C05C5C" : "#F0C040", 0.14), padding: "3px 9px", borderRadius: 999 }}>{result.confidence.toUpperCase()} CONFIDENCE</span>
              </div>
              <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--cream)", lineHeight: 1.5 }}>{result.observation}</p>
              {metricChips(result.metrics).length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginTop: 14 }}>
                  {metricChips(result.metrics).map((m) => (
                    <div key={m.label} style={{ borderRadius: 12, border: "1px solid var(--line)", background: hexA("#F0C040", 0.05), padding: "9px 10px", textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--cream)" }}>{m.value}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", color: "var(--cream-3)", marginTop: 2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {result.trend && (
                <p style={{ margin: "10px 0 0", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--gold)", lineHeight: 1.45 }}>↗ {result.trend}</p>
              )}
              {slot && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", background: hexA(String(c), 0.18), fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: String(c) }}>{slot.grade}</span>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>Affects {slot.name}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, borderRadius: 16, border: "1px solid var(--line)", background: "var(--panel)", padding: "15px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: hexA("#F0C040", 0.14) }}>
                <IconTarget size={20} stroke="var(--gold)" />
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: "var(--cream-3)" }}>RECOMMENDED DRILL</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--cream)", marginTop: 3, lineHeight: 1.4 }}>{result.drillRecommendation}</div>
              </div>
            </div>

            {result.id && (
              <div style={{ marginTop: 10, fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", textAlign: "center" }}>Saved to Coach&apos;s memory — ask about it anytime in Coach chat.</div>
            )}

            <button onClick={() => { setStage("idle"); setResult(null); }} className="sc-press" style={{ marginTop: 12, width: "100%", borderRadius: 14, padding: "14px", cursor: "pointer", border: "none", background: "var(--gold)", color: "#0F2016", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700 }}>Analyze another swing</button>
          </div>
        )}

        {stage === "error" && (
          <div>
            <div style={{ borderRadius: 18, border: "1px solid " + hexA("#C05C5C", 0.45), background: "linear-gradient(160deg, " + hexA("#C05C5C", 0.12) + ", transparent), var(--panel)", padding: "22px 20px", textAlign: "center" }}>
              <span style={{ width: 50, height: 50, borderRadius: 999, background: hexA("#C05C5C", 0.18), display: "grid", placeItems: "center", margin: "0 auto", color: "var(--bad)", fontSize: 24 }}>!</span>
              <h2 style={{ margin: "12px 0 0", fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: "var(--cream)" }}>Couldn&apos;t analyze that</h2>
              <p style={{ margin: "7px 0 0", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)", lineHeight: 1.45 }}>{errMsg}</p>
            </div>
            <button onClick={() => setStage("idle")} className="sc-press" style={{ marginTop: 14, width: "100%", borderRadius: 14, padding: "14px", cursor: "pointer", border: "none", background: "var(--gold)", color: "#0F2016", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700 }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
};
