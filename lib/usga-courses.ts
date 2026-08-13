// ── USGA course-rating sheet lookup (libSQL / Turso) ────────────
// Local-first replacement for the (WAF-blocked-in-prod) live NCRDB search.
// Backed by a static USGA export (data/usga-courses.json, 13,706 rows) seeded
// once via scripts/seed-usga-courses.ts into a `usga_courses` table.
//
// IMPORTANT DATA CAVEAT: every row is a CHAMPIONSHIP/TIPS rating (one per
// course, hardest tees) — NOT the White/Blue tees this app's user actually
// plays. Callers must treat {rating, slope, par} from this table as a
// labeled, editable fallback ("tips") only — never silently apply it as if
// it were the played tee. See app/api/course-lookup/route.ts.
//
// Same client-creation pattern as lib/caddie-store.ts (same env vars, same
// local-file-vs-Turso swap), duplicated here rather than imported since that
// file has no shared client/db getter export.

import { createClient, type Client, type Row } from "@libsql/client";

export interface UsgaCourseRow {
  id: number;
  facility: string;
  course: string;
  city: string;
  county: string;
  state: string;
  rating: number;
  slope: number;
  par: number;
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
        `CREATE TABLE IF NOT EXISTS usga_courses (
          id           INTEGER PRIMARY KEY,
          facility     TEXT,
          course       TEXT,
          city         TEXT,
          county       TEXT,
          state        TEXT,
          rating       REAL,
          slope        INTEGER,
          par          INTEGER,
          course_lower TEXT,
          facility_lower TEXT,
          city_lower   TEXT
        )`
      );
      // Helpful (not required — queries also fall back to LOWER()) indexes
      // for the lowercase search columns populated by the seed script.
      await db().execute(
        "CREATE INDEX IF NOT EXISTS idx_usga_courses_course_lower ON usga_courses(course_lower)"
      );
      await db().execute(
        "CREATE INDEX IF NOT EXISTS idx_usga_courses_state ON usga_courses(state)"
      );
    })();
  }
  return _init;
}

function rowToUsgaCourse(r: Row): UsgaCourseRow {
  return {
    id: Number(r.id),
    facility: r.facility == null ? "" : String(r.facility),
    course: r.course == null ? "" : String(r.course),
    city: r.city == null ? "" : String(r.city),
    county: r.county == null ? "" : String(r.county),
    state: r.state == null ? "" : String(r.state),
    rating: r.rating == null ? 0 : Number(r.rating),
    slope: r.slope == null ? 0 : Number(r.slope),
    par: r.par == null ? 0 : Number(r.par),
  };
}

/**
 * Case-insensitive substring search on course OR facility OR city, optionally
 * narrowed to a state. Ranked prefix-match-first (on course, then facility),
 * then alphabetically by course name. Returns [] on any DB error (callers
 * should treat that the same as "table empty/unavailable" and fall back).
 */
export async function searchUsgaCourses(
  q: string,
  state?: string,
  limit = 12
): Promise<UsgaCourseRow[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  try {
    await init();
    const like = `%${needle}%`;
    const prefix = `${needle}%`;
    const args: (string | number)[] = [prefix, prefix, like, like, like];
    let stateClause = "";
    if (state && state.trim()) {
      stateClause = " AND LOWER(state) = LOWER(?)";
      args.push(state.trim());
    }
    args.push(limit);

    const rs = await db().execute({
      sql: `SELECT *,
              CASE
                WHEN course_lower LIKE ? THEN 0
                WHEN facility_lower LIKE ? THEN 1
                ELSE 2
              END AS rank
            FROM usga_courses
            WHERE (course_lower LIKE ? OR facility_lower LIKE ? OR city_lower LIKE ?)${stateClause}
            ORDER BY rank ASC, course ASC
            LIMIT ?`,
      args,
    });
    return rs.rows.map(rowToUsgaCourse);
  } catch {
    return [];
  }
}

export async function usgaCourseById(id: number): Promise<UsgaCourseRow | null> {
  if (!Number.isFinite(id)) return null;
  try {
    await init();
    const rs = await db().execute({
      sql: "SELECT * FROM usga_courses WHERE id = ?",
      args: [id],
    });
    if (!rs.rows.length) return null;
    return rowToUsgaCourse(rs.rows[0]);
  } catch {
    return null;
  }
}

export async function usgaCourseCount(): Promise<number> {
  try {
    await init();
    const rs = await db().execute("SELECT COUNT(*) AS n FROM usga_courses");
    return rs.rows.length ? Number(rs.rows[0].n) : 0;
  } catch {
    return 0;
  }
}

/**
 * Bulk upsert used only by the seed script. Rows are pre-assigned stable
 * integer ids (their 0-based index in data/usga-courses.json) so re-running
 * the seed is idempotent via INSERT OR REPLACE.
 */
export async function upsertUsgaCourses(rows: UsgaCourseRow[]): Promise<void> {
  await init();
  if (!rows.length) return;
  await db().batch(
    rows.map((r) => ({
      sql: `INSERT OR REPLACE INTO usga_courses
            (id, facility, course, city, county, state, rating, slope, par, course_lower, facility_lower, city_lower)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        r.id,
        r.facility,
        r.course,
        r.city,
        r.county,
        r.state,
        r.rating,
        r.slope,
        r.par,
        r.course.toLowerCase(),
        r.facility.toLowerCase(),
        r.city.toLowerCase(),
      ],
    })),
    "write"
  );
}

/** Deletes all rows — used by the seed script for a clean re-seed. */
export async function clearUsgaCourses(): Promise<void> {
  await init();
  await db().execute("DELETE FROM usga_courses");
}
