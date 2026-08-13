"use client";

// ── Shot Scope import screen ─────────────────────────────────
// Three input routes, one pipeline: uploaded CSV files, a published
// Google Sheet link, or pasted CSV text → POST /api/import-shotscope
// (preview) → confirm → POST (commit).

import React, { useRef, useState } from "react";
import { hexA } from "@/lib/caddie-data";

interface RoundPreview {
  id: string;
  course: string;
  date: string;
  total: number;
  holeCount: number;
  shotCount: number;
  putts?: number;
  sgTee?: number;
  sgApproach?: number;
  sgShort?: number;
  sgPutting?: number;
}

interface PreviewResponse {
  rounds?: RoundPreview[];
  warnings?: string[];
  written?: number;
  error?: string;
}

type Stage = "idle" | "previewing" | "preview" | "committing" | "done";

const label: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.14em",
  color: "var(--cream-3)",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: hexA("#FFFFFF", 0.05),
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "11px 12px",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--cream)",
  outline: "none",
};

function fmtSg(v: number | undefined): string {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
}

export const ShotScopeImport = ({ onImported }: { onImported?: () => void }) => {
  const [sheetUrl, setSheetUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [course, setCourse] = useState("");
  const [date, setDate] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<RoundPreview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [written, setWritten] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const hasInput = !!sheetUrl.trim() || !!pasted.trim() || files.length > 0;
  const needsFallback = warnings.some((w) => w.includes("provide course and date"));

  async function pickFiles(list: FileList | null) {
    if (!list) return;
    const next: { name: string; content: string }[] = [];
    for (const f of Array.from(list).slice(0, 10)) {
      next.push({ name: f.name, content: await f.text() });
    }
    setFiles((prev) => [...prev.filter((p) => !next.some((n) => n.name === p.name)), ...next]);
    setStage("idle");
  }

  function buildBody(mode: "preview" | "commit") {
    const docs = [...files];
    if (pasted.trim()) docs.push({ name: "pasted", content: pasted });
    return {
      mode,
      docs,
      sheetUrl: sheetUrl.trim() || undefined,
      course: course.trim() || undefined,
      date: date.trim() || undefined,
    };
  }

  async function run(mode: "preview" | "commit") {
    setError("");
    setStage(mode === "preview" ? "previewing" : "committing");
    try {
      const res = await fetch("/api/import-shotscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(mode)),
      });
      const json: PreviewResponse = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `Import failed (${res.status})`);
      setPreview(json.rounds ?? []);
      setWarnings(json.warnings ?? []);
      if (mode === "commit") {
        setWritten(json.written ?? 0);
        setStage("done");
        onImported?.();
      } else {
        setStage("preview");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setStage(mode === "preview" ? "idle" : "preview");
    }
  }

  function reset() {
    setSheetUrl("");
    setPasted("");
    setFiles([]);
    setCourse("");
    setDate("");
    setPreview([]);
    setWarnings([]);
    setWritten(0);
    setError("");
    setStage("idle");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {stage !== "done" && (
        <>
          {/* Files */}
          <div>
            <div style={label}>CSV FILES · EXPORTED OR HAND-BUILT</div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              style={{ display: "none" }}
              onChange={(e) => void pickFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%",
                cursor: "pointer",
                background: hexA("#F0C040", 0.06),
                border: "1px dashed " + hexA("#F0C040", 0.35),
                borderRadius: 14,
                padding: "16px 12px",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: "var(--cream-2)",
              }}
            >
              {files.length
                ? files.map((f) => f.name).join(" · ")
                : "Choose CSV files — holes, shots, round summary"}
            </button>
          </div>

          {/* Sheet link */}
          <div>
            <div style={label}>OR A PUBLISHED GOOGLE SHEET LINK</div>
            <input
              value={sheetUrl}
              onChange={(e) => { setSheetUrl(e.target.value); setStage("idle"); }}
              placeholder="https://docs.google.com/spreadsheets/…/pubhtml"
              style={inputStyle}
            />
          </div>

          {/* Paste */}
          <div>
            <div style={label}>OR PASTE CSV ROWS</div>
            <textarea
              value={pasted}
              onChange={(e) => { setPasted(e.target.value); setStage("idle"); }}
              placeholder={"Hole,Par,SI,Score,FIR,GIR,Putts\n1,4,-,6,o,x,2\n…"}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 11.5 }}
            />
          </div>

          {/* Fallback course/date — surfaced when the parser asks for it */}
          {(needsFallback || course || date) && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1.6 }}>
                <div style={label}>COURSE</div>
                <input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course name" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={label}>DATE</div>
                <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" style={inputStyle} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Errors */}
      {error && (
        <div style={{ background: hexA("#C05C5C", 0.1), border: "1px solid " + hexA("#C05C5C", 0.3), borderRadius: 12, padding: "10px 12px", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--cream-2)" }}>
          {error}
        </div>
      )}

      {/* Preview / result list */}
      {(stage === "preview" || stage === "committing" || stage === "done") && (
        <div>
          <div style={label}>
            {stage === "done" ? `IMPORTED ${written} ROUND${written === 1 ? "" : "S"}` : `FOUND ${preview.length} ROUND${preview.length === 1 ? "" : "S"}`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {preview.map((r) => (
              <div key={r.id} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, color: "var(--cream)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.course}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 600, color: "var(--cream)" }}>{r.total}</div>
                </div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--cream-3)", marginTop: 3 }}>
                  {r.date} · {r.holeCount} holes
                  {r.shotCount ? ` · ${r.shotCount} shots tracked` : " · no shot detail"}
                  {typeof r.putts === "number" ? ` · ${r.putts} putts` : ""}
                </div>
                {(r.sgTee != null || r.sgPutting != null) && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--cream-2)", marginTop: 6, letterSpacing: "0.02em" }}>
                    SG · tee {fmtSg(r.sgTee)} · app {fmtSg(r.sgApproach)} · short {fmtSg(r.sgShort)} · putt {fmtSg(r.sgPutting)}
                  </div>
                )}
              </div>
            ))}
          </div>
          {warnings.length > 0 && stage !== "done" && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {warnings.map((w, i) => (
                <div key={i} style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "#D9A441", lineHeight: 1.45 }}>
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {stage === "done" ? (
        <button
          onClick={reset}
          style={{ cursor: "pointer", background: hexA("#FFFFFF", 0.06), border: "1px solid var(--line)", borderRadius: 12, padding: "12px", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--cream)" }}
        >
          Import more
        </button>
      ) : stage === "preview" || stage === "committing" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setStage("idle")}
            disabled={stage === "committing"}
            style={{ flex: 1, cursor: "pointer", background: "transparent", border: "1px solid var(--line)", borderRadius: 12, padding: "12px", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--cream-2)" }}
          >
            Edit
          </button>
          <button
            onClick={() => void run("commit")}
            disabled={stage === "committing" || preview.length === 0}
            style={{ flex: 2, cursor: "pointer", background: hexA("#F0C040", 0.9), border: "none", borderRadius: 12, padding: "12px", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 700, color: "#1B1B14", opacity: stage === "committing" ? 0.7 : 1 }}
          >
            {stage === "committing" ? "Importing…" : `Import ${preview.length} round${preview.length === 1 ? "" : "s"}`}
          </button>
        </div>
      ) : (
        <button
          onClick={() => void run("preview")}
          disabled={!hasInput || stage === "previewing"}
          style={{
            cursor: hasInput ? "pointer" : "default",
            background: hasInput ? hexA("#F0C040", 0.9) : hexA("#FFFFFF", 0.05),
            border: "none",
            borderRadius: 12,
            padding: "12px",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 700,
            color: hasInput ? "#1B1B14" : "var(--cream-3)",
            opacity: stage === "previewing" ? 0.7 : 1,
          }}
        >
          {stage === "previewing" ? "Reading…" : "Preview import"}
        </button>
      )}
    </div>
  );
};
