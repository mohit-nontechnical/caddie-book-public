// ── Seed usga_courses from data/usga-courses.json ───────────────
// One-time (re-runnable) loader for the USGA course-rating sheet the user
// supplied. Reads the 13,706-row extract and batch-upserts it into the
// `usga_courses` table (see lib/usga-courses.ts).
//
// Idempotent via a clean-slate reseed: DELETE all rows, then INSERT OR
// REPLACE keyed on a stable id = the row's 0-based index in the source JSON
// array. That index is stable across runs as long as data/usga-courses.json
// itself isn't reordered/regenerated — documented here since it's the "your
// call" design decision from the task brief. (Chosen over hashing
// facility+course+city because a few rows in the sheet are exact duplicates
// of that tuple; index-as-id guarantees uniqueness with zero collision risk.)
//
// Loads TURSO_DATABASE_URL / TURSO_AUTH_TOKEN from .env.local with a minimal
// manual parser (no dotenv dependency — none is installed and none is added).
//
// Run: npx tsx scripts/seed-usga-courses.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes, if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();

// Imported after env is loaded so lib/usga-courses.ts's lazy db() getter
// picks up TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
import { clearUsgaCourses, upsertUsgaCourses, usgaCourseCount, type UsgaCourseRow } from "../lib/usga-courses";

interface SheetRow {
  facility: string;
  course: string;
  city: string;
  county: string;
  state: string;
  rating: number;
  slope: number;
  par: number;
}

const BATCH_SIZE = 500;

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.error(
      "TURSO_DATABASE_URL not set (checked process.env and .env.local) — refusing to seed against the default local file DB silently. Set it in .env.local to target the cloud DB."
    );
    process.exit(1);
  }

  const dataPath = resolve(process.cwd(), "data/usga-courses.json");
  const raw = readFileSync(dataPath, "utf8");
  const sheet: SheetRow[] = JSON.parse(raw);
  console.log(`Loaded ${sheet.length} rows from data/usga-courses.json`);

  const rows: UsgaCourseRow[] = sheet.map((r, i) => ({
    id: i,
    facility: r.facility ?? "",
    course: r.course ?? "",
    city: r.city ?? "",
    county: r.county ?? "",
    state: r.state ?? "",
    rating: Number(r.rating) || 0,
    slope: Number(r.slope) || 0,
    par: Number(r.par) || 0,
  }));

  console.log("Clearing existing usga_courses rows (idempotent reseed)…");
  await clearUsgaCourses();

  console.log(`Upserting ${rows.length} rows in batches of ${BATCH_SIZE}…`);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await upsertUsgaCourses(batch);
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }
  console.log("");

  const count = await usgaCourseCount();
  console.log(`Done. usga_courses now has ${count} rows.`);
  if (count !== rows.length) {
    console.warn(
      `WARNING: expected ${rows.length} rows but table reports ${count}. Check for insert errors above.`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
