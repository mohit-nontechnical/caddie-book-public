// ── Round persistence (libSQL / Turso) ───────────────────────
// Same code runs two ways:
//   • Local dev  → embedded SQLite file (file:caddie.db). Zero setup.
//   • Cloud      → Turso free tier. Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// Swap is purely env-driven; no code change needed to deploy.

import { createClient, type Client, type Row } from "@libsql/client";

export interface HoleResult {
  hole: number;
  par: number;
  score: number;
  fir: boolean | null; // fairway in regulation (null for par 3s)
  gir: boolean;
  putts: number;
}

export interface RoundStats {
  holeCount?: number;
  putts?: number;
  gir?: number;
  girHoleCount?: number;
  fairwayHits?: number;
  fairwayHoleCount?: number;
  pars?: number;
  birdies?: number;
  bogeys?: number;
  doubleBogeyOrWorse?: number;
  eagles?: number;
  source?: string; // e.g. "18birdies", "shotscope"
  // ── Shot Scope (shot-tracking) extras ──
  sgTee?: number;
  sgApproach?: number;
  sgShort?: number;
  sgPutting?: number;
  avgDriveYds?: number;
  shots?: import("./shotscope").Shot[]; // per-shot detail; strip before inlining in LLM prompts
  pins?: Record<number, [number, number]>; // hole → pin [lat, lng] (Shot Scope GPS)
}

export interface Round {
  id: string;
  course: string;
  date: string; // ISO
  total: number;
  slope?: number;
  rating?: number;
  holes: HoleResult[];
  stats?: RoundStats;
}

let _client: Client | null = null;
function db(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL || "file:caddie.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  _client = createClient(authToken ? { url, authToken } : { url });
  return _client;
}

let _init: Promise<void> | null = null;
function init(): Promise<void> {
  if (!_init) {
    _init = (async () => {
      await db().execute(
        `CREATE TABLE IF NOT EXISTS rounds (
          id         TEXT PRIMARY KEY,
          course     TEXT,
          date       TEXT,
          total      INTEGER,
          slope      REAL,
          rating     REAL,
          holes      TEXT,
          stats      TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`
      );
      // Add stats column to pre-existing tables (idempotent — ignore "duplicate column").
      try {
        await db().execute("ALTER TABLE rounds ADD COLUMN stats TEXT");
      } catch {
        /* column already exists */
      }
      // Persisted bag-slot grades (the latest Coach analysis), so the bag
      // reflects them on any device without re-running.
      await db().execute(
        `CREATE TABLE IF NOT EXISTS slot_grades (
          slot_id    TEXT PRIMARY KEY,
          grade      TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        )`
      );
      // User-edited course Rating/Slope/Par overrides (for the handicap index).
      await db().execute(
        `CREATE TABLE IF NOT EXISTS course_ratings (
          course_norm TEXT PRIMARY KEY,
          course_name TEXT,
          rating      REAL,
          slope       REAL,
          par         INTEGER,
          updated_at  TEXT DEFAULT (datetime('now'))
        )`
      );
      // Persistent practice plan focused on dominant leak (blow-up holes / doubles).
      await db().execute(
        `CREATE TABLE IF NOT EXISTS coach_plan (
          id               TEXT PRIMARY KEY,
          focus            TEXT,
          actions          TEXT,
          baseline_avg     REAL,
          baseline_doubles REAL,
          created_at       TEXT DEFAULT (datetime('now'))
        )`
      );
      // Swing video/photo analyses — Coach's long-term swing memory.
      await db().execute(
        `CREATE TABLE IF NOT EXISTS swing_analyses (
          id          TEXT PRIMARY KEY,
          date        TEXT,
          club        TEXT,
          observation TEXT,
          drill       TEXT,
          bag_slot    TEXT,
          confidence  TEXT,
          trend       TEXT,
          frame_count INTEGER,
          source      TEXT,
          metrics     TEXT,
          created_at  TEXT DEFAULT (datetime('now'))
        )`
      );
      // Add metrics column to pre-existing tables (idempotent — ignore "duplicate column").
      try {
        await db().execute("ALTER TABLE swing_analyses ADD COLUMN metrics TEXT");
      } catch {
        /* column already exists */
      }
    })();
  }
  return _init;
}

function rowToRound(r: Row): Round {
  let holes: HoleResult[] = [];
  try {
    holes = r.holes ? (JSON.parse(String(r.holes)) as HoleResult[]) : [];
  } catch {
    holes = [];
  }
  let stats: RoundStats | undefined;
  try {
    stats = r.stats ? (JSON.parse(String(r.stats)) as RoundStats) : undefined;
  } catch {
    stats = undefined;
  }
  return {
    id: String(r.id),
    course: r.course == null ? "" : String(r.course),
    date: r.date == null ? "" : String(r.date),
    total: r.total == null ? 0 : Number(r.total),
    slope: r.slope == null ? undefined : Number(r.slope),
    rating: r.rating == null ? undefined : Number(r.rating),
    holes,
    stats,
  };
}

export async function getRounds(limit = 50): Promise<Round[]> {
  try {
    await init();
    const rs = await db().execute({
      sql: "SELECT * FROM rounds ORDER BY date DESC LIMIT ?",
      args: [limit],
    });
    return rs.rows.map(rowToRound);
  } catch {
    return [];
  }
}

function insertArgs(round: Round) {
  return [
    round.id,
    round.course ?? "",
    round.date ?? new Date().toISOString(),
    round.total ?? 0,
    round.slope ?? null,
    round.rating ?? null,
    JSON.stringify(round.holes ?? []),
    round.stats ? JSON.stringify(round.stats) : null,
  ];
}

const INSERT_SQL = `INSERT OR REPLACE INTO rounds (id, course, date, total, slope, rating, holes, stats)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

export async function addRound(round: Round): Promise<Round[]> {
  await init();
  await db().execute({ sql: INSERT_SQL, args: insertArgs(round) });
  return getRounds();
}

/** Bulk upsert (idempotent by id). Returns number of rounds written. */
export async function insertRounds(rounds: Round[]): Promise<number> {
  await init();
  if (!rounds.length) return 0;
  await db().batch(
    rounds.map((r) => ({ sql: INSERT_SQL, args: insertArgs(r) })),
    "write"
  );
  return rounds.length;
}

/**
 * A round is "complete" if it has a full 9 or 18 holes and a plausible total.
 * Filters out abandoned/partial entries (e.g. a 2-hole walk-in recorded as total 8)
 * without deleting them from the record.
 */
export function isCompleteRound(r: Round): boolean {
  const holes = r.stats?.holeCount ?? r.holes.length;
  if (holes < 9) return false;
  if (r.total && r.total < holes * 2) return false; // < 2 strokes/hole is impossible
  return true;
}

// ── Persisted bag-slot grades ────────────────────────────────
export type GradeMap = Record<string, string>;

export async function saveGrades(list: { id: string; grade: string }[]): Promise<void> {
  await init();
  const valid = (list || []).filter((g) => g?.id && /^[ABCDF]$/i.test(String(g.grade)));
  if (!valid.length) return;
  await db().batch(
    valid.map((g) => ({
      sql: "INSERT OR REPLACE INTO slot_grades (slot_id, grade, updated_at) VALUES (?, ?, datetime('now'))",
      args: [g.id, String(g.grade).toUpperCase()],
    })),
    "write"
  );
}

export async function loadGrades(): Promise<GradeMap> {
  try {
    await init();
    const rs = await db().execute("SELECT slot_id, grade FROM slot_grades");
    const m: GradeMap = {};
    for (const r of rs.rows) m[String(r.slot_id)] = String(r.grade);
    return m;
  } catch {
    return {};
  }
}

// ── Course rating overrides (user-edited) ────────────────────
export interface CourseRatingOverride {
  rating: number;
  slope: number;
  par: number;
}

/** Map of normalized-course-name → override. */
export async function getCourseRatingOverrides(): Promise<Record<string, CourseRatingOverride>> {
  try {
    await init();
    const rs = await db().execute("SELECT course_norm, rating, slope, par FROM course_ratings");
    const m: Record<string, CourseRatingOverride> = {};
    for (const r of rs.rows) {
      m[String(r.course_norm)] = {
        rating: Number(r.rating),
        slope: Number(r.slope),
        par: Number(r.par),
      };
    }
    return m;
  } catch {
    return {};
  }
}

export async function setCourseRating(
  courseNorm: string,
  courseName: string,
  o: CourseRatingOverride
): Promise<void> {
  await init();
  await db().execute({
    sql: `INSERT OR REPLACE INTO course_ratings (course_norm, course_name, rating, slope, par, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    args: [courseNorm, courseName, o.rating, o.slope, o.par],
  });
}

// ── Coach practice plan (persistent, tracks dominant leak) ───
export interface CoachPlan {
  focus: string;
  actions: string[];
  baselineAvg: number;
  baselineDoubles: number;
  createdAt: string;
}

export async function savePlan(p: CoachPlan): Promise<void> {
  await init();
  await db().execute({
    sql: `INSERT OR REPLACE INTO coach_plan (id, focus, actions, baseline_avg, baseline_doubles, created_at)
          VALUES ('current', ?, ?, ?, ?, datetime('now'))`,
    args: [p.focus, JSON.stringify(p.actions), p.baselineAvg, p.baselineDoubles],
  });
}

export async function loadPlan(): Promise<CoachPlan | null> {
  try {
    await init();
    const rs = await db().execute(
      "SELECT focus, actions, baseline_avg, baseline_doubles, created_at FROM coach_plan WHERE id='current'"
    );
    if (!rs.rows.length) return null;
    const r = rs.rows[0];
    return {
      focus: String(r.focus ?? ""),
      actions: JSON.parse(String(r.actions ?? "[]")) as string[],
      baselineAvg: Number(r.baseline_avg),
      baselineDoubles: Number(r.baseline_doubles),
      createdAt: String(r.created_at ?? ""),
    };
  } catch {
    return null;
  }
}

export async function clearPlan(): Promise<void> {
  await init();
  await db().execute("DELETE FROM coach_plan WHERE id='current'");
}

// ── Swing analyses (Coach's long-term swing memory) ──────────
export interface SwingAnalysis {
  id: string;
  date: string; // ISO
  club?: string;
  observation: string;
  drill: string;
  bagSlot: string;
  confidence: string;
  /** Model's read on progression vs prior analyses (null on first read). */
  trend?: string;
  /** Measured pose metrics (MediaPipe, client-side): shoulder/hip turn, x-factor, spine tilt, head sway. */
  metrics?: Record<string, number | null>;
  frameCount: number;
  source: "video" | "photos";
}

export async function saveSwingAnalysis(a: SwingAnalysis): Promise<void> {
  await init();
  await db().execute({
    sql: `INSERT OR REPLACE INTO swing_analyses
          (id, date, club, observation, drill, bag_slot, confidence, trend, frame_count, source, metrics)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      a.id,
      a.date,
      a.club ?? null,
      a.observation,
      a.drill,
      a.bagSlot,
      a.confidence,
      a.trend ?? null,
      a.frameCount,
      a.source,
      a.metrics ? JSON.stringify(a.metrics) : null,
    ],
  });
}

export async function getSwingAnalyses(limit = 20): Promise<SwingAnalysis[]> {
  try {
    await init();
    const rs = await db().execute({
      sql: "SELECT * FROM swing_analyses ORDER BY date DESC LIMIT ?",
      args: [limit],
    });
    return rs.rows.map((r) => {
      let metrics: Record<string, number | null> | undefined;
      try {
        metrics = r.metrics ? (JSON.parse(String(r.metrics)) as Record<string, number | null>) : undefined;
      } catch {
        metrics = undefined;
      }
      return {
        id: String(r.id),
        date: r.date == null ? "" : String(r.date),
        club: r.club == null ? undefined : String(r.club),
        observation: String(r.observation ?? ""),
        drill: String(r.drill ?? ""),
        bagSlot: String(r.bag_slot ?? ""),
        confidence: String(r.confidence ?? "medium"),
        trend: r.trend == null ? undefined : String(r.trend),
        metrics,
        frameCount: r.frame_count == null ? 0 : Number(r.frame_count),
        source: (String(r.source ?? "photos") === "video" ? "video" : "photos") as "video" | "photos",
      };
    });
  } catch {
    return [];
  }
}

export async function deleteSwingAnalysis(id: string): Promise<void> {
  await init();
  await db().execute({ sql: "DELETE FROM swing_analyses WHERE id = ?", args: [id] });
}
