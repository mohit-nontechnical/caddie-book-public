// ── Shot Scope import: shared CSV parsing + round assembly ───
// Used by scripts/import-shotscope.ts (files on disk) and
// app/api/import-shotscope (uploads / pasted text / Google Sheet link).
//
// Accepts any mix of CSV documents and classifies each by header:
//   summary — "Course,Date,Tees,Holes,Score,..." (one row per round, incl. SG)
//   holes   — "Hole,Par,SI,Score,FIR,GIR,Putts"
//   shots   — "Hole,Par,Shot,Club,Lie,Distance,..."
// Red-flag inputs live on the round-summary row; dashboard/dispersion tabs are
// derived views and do not need to be persisted separately.
//
// Holes docs are matched to summary rows — and shots docs to holes docs — by
// total score, which is robust without relying on filenames or tab names.

import type { HoleResult, Round, RoundStats } from "./caddie-store";
import type { Shot } from "./shotscope";

export interface CsvDoc {
  name?: string;
  content: string;
}

export interface ImportWarnings {
  warnings: string[];
}

export interface BuiltRounds extends ImportWarnings {
  rounds: Round[];
}

function parseCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((l) => l.split(",").map((c) => c.trim()));
}

type DocKind = "summary" | "holes" | "shots" | "derived" | "unknown";

function classify(rows: string[][]): DocKind {
  const header = rows[0]?.map((h) => h.toLowerCase()) ?? [];
  if (header[0] === "course" && header[1] === "date") return "summary";
  if (header[0] === "hole" && header[2] === "shot") return "shots";
  if (header[0] === "hole" && header.includes("score") && header.includes("putts")) return "holes";
  if (header[0]?.includes("red flags dashboard") || header[0]?.includes("club dispersion")) return "derived";
  return "unknown";
}

export function parseHoleRows(rows: string[][]): HoleResult[] {
  const holes: HoleResult[] = [];
  for (const r of rows.slice(1)) {
    if (!r[0]?.trim()) continue; // spacer rows
    const holeNum = Number(r[0]);
    if (!Number.isFinite(holeNum) || holeNum < 1) continue; // Out/In/Total/legend
    holes.push({
      hole: holeNum,
      par: Number(r[1]) || 0,
      score: Number(r[3]) || 0,
      fir: r[4] === "o" || r[4] === "✓" ? true : r[4] === "x" ? false : null,
      gir: r[5] === "o" || r[5] === "✓",
      putts: Number(r[6]) || 0,
    });
  }
  return holes;
}

export function parseShotRows(rows: string[][]): Shot[] {
  return rows
    .slice(1)
    .filter((r) => r[0]?.trim() && Number.isFinite(Number(r[0])))
    .map((r) => ({
      hole: Number(r[0]),
      par: Number(r[1]),
      seq: Number(r[2]),
      club: r[3],
      lie: r[4],
      dist: Number(r[5]),
      distUnit: (r[6] || "y") as Shot["distUnit"],
      rem: r[7] === "Holed" || r[7] === "" ? null : Number(r[7]),
      remUnit: r[7] === "Holed" || r[7] === "" ? null : ((r[8] || "y") as Shot["remUnit"]),
      sg: Number(r[9]) || 0,
    }));
}

export function statsFromHoles(holes: HoleResult[]): RoundStats {
  const s: RoundStats = {
    holeCount: holes.length,
    putts: 0,
    gir: 0,
    girHoleCount: 0,
    fairwayHits: 0,
    fairwayHoleCount: 0,
    pars: 0,
    birdies: 0,
    bogeys: 0,
    doubleBogeyOrWorse: 0,
    eagles: 0,
    source: "shotscope",
  };
  for (const h of holes) {
    const diff = h.score - h.par;
    if (diff <= -2) s.eagles!++;
    else if (diff === -1) s.birdies!++;
    else if (diff === 0) s.pars!++;
    else if (diff === 1) s.bogeys!++;
    else s.doubleBogeyOrWorse!++;
    s.putts! += h.putts;
    s.girHoleCount!++;
    if (h.gir) s.gir!++;
    if (h.fir != null) {
      s.fairwayHoleCount!++;
      if (h.fir) s.fairwayHits!++;
    }
  }
  return s;
}

interface SummaryRow {
  course: string;
  date: string;
  score: number;
  sgTee?: number;
  sgApproach?: number;
  sgShort?: number;
  sgPutting?: number;
  avgDriveYds?: number;
  teeShotsInTrouble?: number;
  multipleChipsInside50?: number;
  threePutts?: number;
  missedPuttsInside5?: number;
  weakestArea?: string;
  weakestAreaSg?: number;
  weakestHole?: string;
  weakestHoleSg?: number;
}

function parseSummaryRows(rows: string[][]): SummaryRow[] {
  const header = rows[0].map((h) => h.toLowerCase());
  const col = (needle: string) => header.findIndex((h) => h.includes(needle));
  const iScore = col("score");
  const iDrive = col("avg drive");
  const iTee = col("sg tee");
  const iApp = col("sg approach");
  const iShort = col("sg short");
  const iPutt = col("sg putt");
  const iTrouble = col("tee shots in trouble");
  const iMultiChips = col("multiple chips");
  const iThreePutts = col("3-putts");
  const iMissedShort = col("missed putts inside 5ft");
  const iWeakArea = col("weakest area");
  const iWeakAreaSg = header.findIndex((h, i) => i > iWeakArea && h.includes("weakest area sg"));
  const iWeakHole = col("weakest hole");
  const iWeakHoleSg = header.findIndex((h, i) => i > iWeakHole && h.includes("weakest hole sg"));
  const optionalNumber = (r: string[], i: number) => i >= 0 && r[i] !== "" && r[i]?.toLowerCase() !== "n/a" ? Number(r[i]) : undefined;
  return rows
    .slice(1)
    .filter((r) => r[0]?.trim() && r[1]?.trim())
    .map((r) => ({
      course: r[0],
      date: r[1],
      score: Number(r[iScore]) || 0,
      sgTee: iTee >= 0 && r[iTee] !== "" ? Number(r[iTee]) : undefined,
      sgApproach: iApp >= 0 && r[iApp] !== "" ? Number(r[iApp]) : undefined,
      sgShort: iShort >= 0 && r[iShort] !== "" ? Number(r[iShort]) : undefined,
      sgPutting: iPutt >= 0 && r[iPutt] !== "" ? Number(r[iPutt]) : undefined,
      avgDriveYds: iDrive >= 0 && r[iDrive] !== "" ? Number(r[iDrive]) : undefined,
      teeShotsInTrouble: optionalNumber(r, iTrouble),
      multipleChipsInside50: optionalNumber(r, iMultiChips),
      threePutts: optionalNumber(r, iThreePutts),
      missedPuttsInside5: optionalNumber(r, iMissedShort),
      weakestArea: iWeakArea >= 0 ? r[iWeakArea] || undefined : undefined,
      weakestAreaSg: optionalNumber(r, iWeakAreaSg),
      weakestHole: iWeakHole >= 0 ? r[iWeakHole] || undefined : undefined,
      weakestHoleSg: optionalNumber(r, iWeakHoleSg),
    }));
}

export function slugFor(course: string): string {
  if (/harding/i.test(course)) return "harding-fleming";
  if (/presidio/i.test(course)) return "presidio";
  return (
    course
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "course"
  );
}

/**
 * Assemble Round objects from a bag of CSV documents.
 *
 * Matching rules (no filename dependence):
 * - each holes doc's total score is matched against summary rows' Score
 * - each shots doc's row count is matched against holes docs' total score
 * - a holes doc with no summary match still imports if `fallback` provides
 *   course + date (single-round manual import)
 */
export function buildRounds(
  docs: CsvDoc[],
  fallback?: { course?: string; date?: string }
): BuiltRounds {
  const warnings: string[] = [];
  const summaries: SummaryRow[] = [];
  const holesDocs: { name?: string; holes: HoleResult[]; total: number }[] = [];
  const shotsDocs: { name?: string; shots: Shot[] }[] = [];

  for (const doc of docs) {
    const rows = parseCsv(doc.content);
    const kind = classify(rows);
    if (kind === "summary") summaries.push(...parseSummaryRows(rows));
    else if (kind === "holes") {
      const holes = parseHoleRows(rows);
      if (holes.length) holesDocs.push({ name: doc.name, holes, total: holes.reduce((a, h) => a + h.score, 0) });
    } else if (kind === "shots") {
      const shots = parseShotRows(rows);
      if (shots.length) shotsDocs.push({ name: doc.name, shots });
    } else if (kind === "derived") {
      // These presentation tabs are recomputed per round by the app.
    } else if (doc.name) {
      warnings.push(`Skipped "${doc.name}" — not a round summary, holes, or shots table.`);
    }
  }

  const rounds: Round[] = [];
  const usedShots = new Set<number>();

  for (const hd of holesDocs) {
    const matches = summaries.filter((s) => s.score === hd.total);
    let summary: SummaryRow | undefined;
    if (matches.length === 1) summary = matches[0];
    else if (matches.length > 1) {
      summary = matches[0];
      warnings.push(`Multiple summary rows score ${hd.total}; used the first (${summary.course} ${summary.date}).`);
    }

    const course = summary?.course ?? fallback?.course;
    const date = summary?.date ?? fallback?.date;
    if (!course || !date) {
      warnings.push(
        `Holes table${hd.name ? ` "${hd.name}"` : ""} (total ${hd.total}) has no matching summary row — provide course and date to import it.`
      );
      continue;
    }

    const stats = statsFromHoles(hd.holes);
    if (summary) {
      stats.sgTee = summary.sgTee;
      stats.sgApproach = summary.sgApproach;
      stats.sgShort = summary.sgShort;
      stats.sgPutting = summary.sgPutting;
      stats.avgDriveYds = summary.avgDriveYds;
      stats.teeShotsInTrouble = summary.teeShotsInTrouble;
      stats.multipleChipsInside50 = summary.multipleChipsInside50;
      stats.threePutts = summary.threePutts;
      stats.missedPuttsInside5 = summary.missedPuttsInside5;
      stats.weakestArea = summary.weakestArea;
      stats.weakestAreaSg = summary.weakestAreaSg;
      stats.weakestHole = summary.weakestHole;
      stats.weakestHoleSg = summary.weakestHoleSg;
    }

    const shotIdx = shotsDocs.findIndex((sd, i) => !usedShots.has(i) && sd.shots.length === hd.total);
    if (shotIdx >= 0) {
      usedShots.add(shotIdx);
      stats.shots = shotsDocs[shotIdx].shots;
    }

    rounds.push({
      id: `shotscope-${date}-${slugFor(course)}`,
      course,
      date,
      total: hd.total,
      holes: hd.holes,
      stats,
    });
  }

  for (let i = 0; i < shotsDocs.length; i++) {
    if (!usedShots.has(i)) {
      warnings.push(
        `Shots table${shotsDocs[i].name ? ` "${shotsDocs[i].name}"` : ""} (${shotsDocs[i].shots.length} shots) didn't match any holes table's total score — not imported.`
      );
    }
  }

  return { rounds, warnings };
}

// ── GPS merge ────────────────────────────────────────────────
// Attach per-shot coordinates + pin positions from a Shot Scope GPS dump.
// Two accepted shapes:
//   compact — [{ n, pin: [lat,lng], s: [[sLat,sLng,eLat,eLng,lie,club,lost], …] }]
//   raw v2  — { holes: [{ holeNum, pin: {lat,lng}, shots: [{startLat,…}] }] }
// Shots match by hole number + order; a count mismatch skips that hole with a warning.

interface GpsHole {
  hole: number;
  pin: [number, number] | null;
  shots: { sLat: number; sLng: number; eLat: number; eLng: number; lost: boolean }[];
}

function normalizeGps(data: unknown): GpsHole[] {
  const raw = data as { holes?: unknown } | unknown[];
  const holesArr: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { holes?: unknown[] })?.holes) ? (raw as { holes: unknown[] }).holes : [];
  const out: GpsHole[] = [];
  for (const h of holesArr) {
    const hh = h as Record<string, unknown>;
    if (Array.isArray(hh.s)) {
      // compact
      out.push({
        hole: Number(hh.n),
        pin: Array.isArray(hh.pin) ? [Number(hh.pin[0]), Number(hh.pin[1])] : null,
        shots: (hh.s as unknown[][]).map((s) => ({
          sLat: Number(s[0]),
          sLng: Number(s[1]),
          eLat: Number(s[2]),
          eLng: Number(s[3]),
          lost: !!s[6],
        })),
      });
    } else if (Array.isArray(hh.shots)) {
      // raw v2
      const pin = hh.pin as Record<string, unknown> | undefined;
      out.push({
        hole: Number(hh.holeNum),
        pin: pin && (pin.lat ?? pin.latitude) != null ? [Number(pin.lat ?? pin.latitude), Number(pin.lng ?? pin.longitude)] : null,
        shots: (hh.shots as Record<string, unknown>[]).map((s) => ({
          sLat: Number(s.startLat),
          sLng: Number(s.startLng),
          eLat: Number(s.endLat),
          eLng: Number(s.endLng),
          lost: !!s.lostBall,
        })),
      });
    }
  }
  return out.filter((h) => Number.isFinite(h.hole) && h.shots.length);
}

/** Merge GPS coordinates into a round's stats.shots in place. Returns warnings. */
export function applyGps(round: Round, gpsData: unknown): string[] {
  const warnings: string[] = [];
  const shots = round.stats?.shots;
  if (!shots?.length) return [`${round.id}: no shot-level data to attach GPS to.`];

  const gps = normalizeGps(gpsData);
  const pins: Record<number, [number, number]> = {};

  for (const gh of gps) {
    const holeShots = shots.filter((s) => s.hole === gh.hole);
    if (!holeShots.length) continue;
    if (holeShots.length !== gh.shots.length) {
      warnings.push(`${round.id} hole ${gh.hole}: ${holeShots.length} shots in CSV vs ${gh.shots.length} in GPS — coordinates skipped for this hole.`);
      continue;
    }
    holeShots.forEach((s, i) => {
      const g = gh.shots[i];
      if (Number.isFinite(g.sLat)) {
        s.sLat = g.sLat;
        s.sLng = g.sLng;
        s.eLat = g.eLat;
        s.eLng = g.eLng;
        if (g.lost) s.lost = true;
      }
    });
    if (gh.pin) pins[gh.hole] = gh.pin;
  }

  if (Object.keys(pins).length && round.stats) round.stats.pins = pins;
  return warnings;
}

/**
 * Fetch every tab of a published Google Sheet as CSV docs.
 * Accepts .../pubhtml or .../pub links from "File → Share → Publish to web".
 */
export async function fetchSheetDocs(url: string): Promise<CsvDoc[]> {
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/(e\/[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)/);
  if (!m) throw new Error("That doesn't look like a Google Sheets link.");
  const base = `https://docs.google.com/spreadsheets/d/${m[1]}`;

  const htmlRes = await fetch(`${base}/pubhtml`, { redirect: "follow" });
  if (!htmlRes.ok) {
    throw new Error(
      "Couldn't read the sheet. Make sure it's published to the web (File → Share → Publish to web)."
    );
  }
  const html = await htmlRes.text();
  const gids = [...new Set([...html.matchAll(/gid=(\d+)/g)].map((g) => g[1]))];
  if (!gids.length) gids.push("0");

  const docs: CsvDoc[] = [];
  for (const gid of gids.slice(0, 12)) {
    const res = await fetch(`${base}/pub?output=csv&gid=${gid}`, { redirect: "follow" });
    if (res.ok) docs.push({ name: `tab-${gid}`, content: await res.text() });
  }
  if (!docs.length) throw new Error("No readable tabs found in that sheet.");
  return docs;
}
