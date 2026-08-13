// ── Import Shot Scope Connex rounds from data/shotscope/ ─────
// Usage:  set -a && source .env.local && set +a && npx -y tsx scripts/import-shotscope.ts
// Idempotent: rounds upsert by id (shotscope-<date>-<slug>).
//
// Reads every *.csv in data/shotscope/ and assembles rounds via the same
// parser the in-app import screen uses (lib/shotscope-import.ts). Docs are
// classified by header and matched by total score — filenames don't matter.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { insertRounds } from "../lib/caddie-store";
import { applyGps, buildRounds, slugFor, type CsvDoc } from "../lib/shotscope-import";

const DIR = join(__dirname, "..", "data", "shotscope");

async function main() {
  const docs: CsvDoc[] = readdirSync(DIR)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => ({ name: f, content: readFileSync(join(DIR, f), "utf8") }));

  const { rounds, warnings } = buildRounds(docs);

  // Attach GPS coordinates when a <date>-<slug>-gps.json capture exists.
  for (const r of rounds) {
    const gpsPath = join(DIR, `${r.date}-${slugFor(r.course)}-gps.json`);
    if (existsSync(gpsPath)) {
      warnings.push(...applyGps(r, JSON.parse(readFileSync(gpsPath, "utf8"))));
    }
  }

  for (const w of warnings) console.warn("warn:", w);

  const n = await insertRounds(rounds);
  console.log(`Imported ${n} Shot Scope round(s):`);
  for (const r of rounds) {
    console.log(
      `  ${r.id} — ${r.course} ${r.date}: ${r.total} (${r.holes.length} holes` +
        `${r.stats?.shots ? `, ${r.stats.shots.length} shots` : ""})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
