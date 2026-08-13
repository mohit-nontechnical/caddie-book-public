// ── Fetch new Shot Scope rounds from dashboard.shotscope.com ─────
//
// Usage:  npx tsx scripts/fetch-shotscope.mts [--all] [--no-import] [--headless]
//   or double-click "Fetch Shot Scope.command" in the repo root.
//
// What it does:
//   1. Opens dashboard.shotscope.com in its own Chrome profile
//      (.shotscope-profile/ — log in ONCE on first run; session persists).
//   2. Lists rounds via /api/rounds/slim, finds ones not yet in data/shotscope/.
//   3. For each new round:
//      - pulls per-hole structure from /api/v2/rounds/{id}  → <date>-<slug>-holes.csv
//      - drives the UI (Overview + Hole By Hole) to scrape per-shot SG,
//        official category SG, and misc stats           → <date>-<slug>-shots.csv
//                                                       → row in round-summary.csv
//      - screenshots Overview + every hole              → data/shotscope/screenshots/<date>-<slug>/
//   4. Runs scripts/import-shotscope.ts (unless --no-import) to upsert into Turso.
//
// Notes / gotchas (verified against the live dashboard 2026-08-13):
//   - /api/v2/rounds/{id} returns distances in METERS; the UI (and our CSVs) use yards.
//     We take distances from the rendered UI, so no conversion happens here.
//   - Per-shot SG is NOT in any API response — it's computed client-side by the
//     dashboard bundle. That's why the Hole By Hole DOM is scraped, not the API.
//   - CSV fields must never contain commas (lib/shotscope-import.ts splits naively).
//   - Idempotent: a round is skipped when <date>-<slug>-shots.csv already exists,
//     and round-summary.csv rows are keyed on Course+Date.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium, type Page } from "playwright-core";
import { slugFor } from "../lib/shotscope-import";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data", "shotscope");
const SHOTS_DIR = join(DATA_DIR, "screenshots");
const PROFILE_DIR = join(ROOT, ".shotscope-profile");
const BASE = "https://dashboard.shotscope.com";

const argv = process.argv.slice(2);
const FLAG_ALL = argv.includes("--all"); // re-fetch even if CSVs exist (screenshots refresh)
const FLAG_NO_IMPORT = argv.includes("--no-import");
const FLAG_HEADLESS = argv.includes("--headless"); // only safe once logged in

// ── helpers ──────────────────────────────────────────────────────

const csvSafe = (s: string) => s.replace(/,/g, ";").trim();

/** An ISO timestamp becomes its YYYY-MM-DD date (offset already local). */
const dateOf = (startedDate: string) => startedDate.slice(0, 10);

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function log(msg: string) {
  console.log(`[shotscope] ${msg}`);
}

// ── round list (API) ─────────────────────────────────────────────

interface SlimRound {
  roundID: number;
  courseName: string;
  startedDate: string;
  tees: string;
  totalShots: number;
  totalPar: number;
  avgScoreVsPar: number;
  fairwaysInRegulation: number;
  greensInRegulation: number;
  putts: number;
  playedHoles: number;
  state: string;
}

interface V2Hole {
  holeNum: number;
  par: number;
  score: number;
  fairwayInRegulation: boolean;
  greenInRegulation: boolean;
  shots: { lie: string }[];
}

async function apiJson<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`${BASE}${path}`);
  if (!res.ok()) throw new Error(`GET ${path} → ${res.status()}`);
  return (await res.json()) as T;
}

// ── UI driving ───────────────────────────────────────────────────

async function ensureLoggedIn(page: Page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  // Logged-in home renders the Rounds nav; login page doesn't.
  const loggedIn = await page
    .waitForSelector(".commonFilterBarButton, .roundWidgetContainer", { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (loggedIn) return;

  if (FLAG_HEADLESS) {
    throw new Error(
      "Not logged in, and --headless can't show you the login page. Re-run without --headless once."
    );
  }
  log("Not logged in — please sign in to Shot Scope in the browser window.");
  log("(You only have to do this once; the session is saved in .shotscope-profile/)");
  await page.waitForSelector(".commonFilterBarButton, .roundWidgetContainer", {
    timeout: 5 * 60 * 1000,
  });
  log("Logged in. Session saved.");
}

/** Open the rounds picker and select the round card matching course + date. */
async function selectRound(page: Page, r: SlimRound) {
  await page.click("button.commonFilterBarButton"); // top-left "Rounds ∨"
  await page.waitForSelector(".roundSelectorRounds .roundWidgetContainer", { timeout: 15000 });
  const day = new Date(r.startedDate).getDate();
  const cards = page.locator(".roundSelectorRounds .roundWidgetContainer");
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const txt = (await cards.nth(i).innerText()).replace(/\s+/g, " ");
    // Card includes the course, tee, date, time, and total score.
    if (
      txt.includes(r.courseName.split(" ")[0]) &&
      new RegExp(`\\b${day} `).test(txt) &&
      txt.includes(`${r.totalShots}`)
    ) {
      await cards.nth(i).click();
      await page.waitForTimeout(1500);
      return;
    }
  }
  throw new Error(`Round card not found for ${r.courseName} ${dateOf(r.startedDate)}`);
}

async function clickTab(page: Page, name: "Overview" | "Hole By Hole") {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(1200);
}

// ── scraping ─────────────────────────────────────────────────────

interface ShotRow {
  seq: number;
  club: string;
  lie: string;
  dist: string;
  distUnit: string;
  rem: string;
  remUnit: string;
  sg: string;
}

function parseShotRowText(t: string): ShotRow | null {
  // "Shot1ClubDLieTeeDistance215 ydsRemaining163 ydsSG0.09"  /  "...RemainingHoledSG0.28"
  const m = t
    .replace(/\s+/g, " ")
    .match(/Shot\s*(\d+)\s*Club\s*(.*?)\s*Lie\s*(.*?)\s*Distance\s*(.*?)\s*Remaining\s*(.*?)\s*SG\s*(-?[\d.]+)/);
  if (!m) return null;
  const dist = (v: string): [string, string] => {
    if (/^<\s*1\s*ft/i.test(v)) return ["0.5", "ft"]; // "< 1 ft" quirk
    const d = v.match(/([\d.]+)\s*(yds|ft|m)/);
    return d ? [d[1], d[2] === "yds" ? "y" : d[2]] : [v, ""];
  };
  const [dv, du] = dist(m[4]);
  const [rv, ru] = /holed/i.test(m[5]) ? ["Holed", ""] : dist(m[5]);
  return { seq: Number(m[1]), club: m[2], lie: m[3], dist: dv, distUnit: du, rem: rv, remUnit: ru, sg: m[6] };
}

/** Scrape all shot rows for the currently-displayed hole. */
async function scrapeHoleShots(page: Page): Promise<ShotRow[]> {
  const texts = await page.$$eval(".shotSelectorRowContainer", (els) =>
    els.map((e) => (e as HTMLElement).innerText)
  );
  return texts.map(parseShotRowText).filter((x): x is ShotRow => x !== null);
}

interface OverviewStats {
  sgTee?: string;
  sgApproach?: string;
  sgShort?: string;
  sgPutting?: string;
  avgDrive?: string;
  teeTrouble?: string;
  multiChips?: string;
  threePutts?: string;
  missedInside5?: string;
  weakArea?: string;
  weakAreaSG?: string;
  weakHole?: string;
  weakHoleSG?: string;
}

async function scrapeOverview(page: Page): Promise<OverviewStats> {
  const text = await page.evaluate(() => document.body.innerText);
  const flat = text.replace(/\s+/g, " ");
  const out: OverviewStats = {};

  // "Strokes Gained Breakdown Tee Shots You gained: 1.12 Approaches You gained: 1.20 ..."
  const cat = (label: string) => {
    const m = flat.match(new RegExp(`${label}\\s+You (gained|lost):\\s*([\\d.]+)`));
    return m ? (m[1] === "lost" ? `-${m[2]}` : m[2]) : undefined;
  };
  out.sgTee = cat("Tee Shots");
  out.sgApproach = cat("Approaches");
  out.sgShort = cat("Short Game");
  out.sgPutting = cat("Putting");

  const grab = (re: RegExp) => flat.match(re)?.[1];
  out.avgDrive = grab(/Average Driving Distance Round (\d+) yds/);
  out.teeTrouble = grab(/([\d.]+) Tee Shots in Trouble/);
  out.multiChips = grab(/([\d.]+) Multiple Chips Inside 50 ?yds/);
  out.threePutts = grab(/([\d.]+) Average 3 Putts Per Round/);
  out.missedInside5 = grab(/([\d.]+) Missed Putts Inside 5 ?ft/);

  const wa = flat.match(/Weakest Area\s+(.*?)\s+Strokes Gained:\s*(-?[\d.]+)/);
  if (wa) {
    out.weakArea = wa[1];
    out.weakAreaSG = wa[2];
  }
  const wh = flat.match(/Weakest Hole\s+Hole:\s*(\d+)\s+Strokes Gained:\s*(-?[\d.]+)/);
  if (wh) {
    out.weakHole = `Hole ${wh[1]}`;
    out.weakHoleSG = wh[2];
  }
  return out;
}

// ── CSV writers ──────────────────────────────────────────────────

function writeHolesCsv(file: string, holes: V2Hole[]) {
  const lines = ["Hole,Par,SI,Score,FIR,GIR,Putts"];
  for (const h of holes) {
    const putts = h.shots.filter((s) => s.lie === "green").length;
    const fir = h.par === 3 ? "-" : h.fairwayInRegulation ? "o" : "x";
    const gir = h.greenInRegulation ? "o" : "x";
    lines.push(`${h.holeNum},${h.par},-,${h.score},${fir},${gir},${putts}`);
  }
  writeFileSync(file, lines.join("\n") + "\n");
}

function writeShotsCsv(file: string, holes: V2Hole[], shotsByHole: Map<number, ShotRow[]>) {
  const lines = ["Hole,Par,Shot,Club,Lie,Distance,DistUnit,Remaining,RemUnit,SG"];
  for (const h of holes) {
    for (const s of shotsByHole.get(h.holeNum) ?? []) {
      lines.push(
        [h.holeNum, h.par, s.seq, csvSafe(s.club), csvSafe(s.lie), s.dist, s.distUnit, s.rem, s.remUnit, s.sg].join(",")
      );
    }
  }
  writeFileSync(file, lines.join("\n") + "\n");
}

const SUMMARY_HEADER =
  "Course,Date,Tees,Holes,Score,To Par,FIR%,GIR%,Putts,Avg Drive (yds),SG Tee Shots,SG Approaches,SG Short Game,SG Putting,Tee Shots in Trouble,Multiple Chips Inside 50yds,3-Putts (or worse),Missed Putts Inside 5ft,Weakest Area,Weakest Area SG,Weakest Hole,Weakest Hole SG";

function appendSummaryRow(r: SlimRound, o: OverviewStats) {
  const file = join(DATA_DIR, "round-summary.csv");
  const date = dateOf(r.startedDate);
  const course = csvSafe(r.courseName);
  if (!existsSync(file)) writeFileSync(file, SUMMARY_HEADER + "\n");
  const existing = readFileSync(file, "utf8");
  if (existing.split(/\r?\n/).some((l) => l.startsWith(`${course},${date},`))) {
    log(`round-summary.csv already has ${course} ${date} — leaving it as-is`);
    return;
  }
  const na = (v?: string) => v ?? "n/a";
  const row = [
    course,
    date,
    csvSafe(r.tees || ""),
    r.playedHoles,
    r.totalShots,
    sign(r.avgScoreVsPar),
    `${Math.round(r.fairwaysInRegulation)}%`,
    `${Math.round(r.greensInRegulation)}%`,
    r.putts,
    na(o.avgDrive),
    na(o.sgTee),
    na(o.sgApproach),
    na(o.sgShort),
    na(o.sgPutting),
    na(o.teeTrouble),
    na(o.multiChips),
    na(o.threePutts),
    na(o.missedInside5),
    csvSafe(o.weakArea ?? "n/a"),
    na(o.weakAreaSG),
    csvSafe(o.weakHole ?? "n/a"),
    na(o.weakHoleSG),
  ].join(",");
  appendFileSync(file, (existing.endsWith("\n") || existing === "" ? "" : "\n") + row + "\n");
}

// ── main ─────────────────────────────────────────────────────────

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(SHOTS_DIR, { recursive: true });

  log("Opening Shot Scope dashboard (dedicated Chrome profile)…");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome", // use installed Google Chrome — no browser download
    headless: FLAG_HEADLESS,
    viewport: { width: 1512, height: 900 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  try {
    await ensureLoggedIn(page);

    const slim = await apiJson<{ rounds: SlimRound[]; usingYards: boolean }>(page, "/api/rounds/slim");
    const rounds = (slim.rounds ?? []).filter((r) => r.state === "Active");
    log(`Dashboard has ${rounds.length} round(s).`);

    const targets = rounds.filter((r) => {
      const key = `${dateOf(r.startedDate)}-${slugFor(r.courseName)}`;
      const done = existsSync(join(DATA_DIR, `${key}-shots.csv`));
      if (done && !FLAG_ALL) log(`  ${key}: already fetched — skipping (use --all to refetch)`);
      return FLAG_ALL || !done;
    });

    if (!targets.length) {
      log("No new rounds. Done.");
      return;
    }

    for (const r of targets) {
      const key = `${dateOf(r.startedDate)}-${slugFor(r.courseName)}`;
      log(`Fetching ${r.courseName} ${dateOf(r.startedDate)} (round ${r.roundID}, ${r.totalShots} shots)…`);
      const shotDir = join(SHOTS_DIR, key);
      mkdirSync(shotDir, { recursive: true });

      // API: per-hole structure
      const detail = await apiJson<{ holes: V2Hole[] }>(page, `/api/v2/rounds/${r.roundID}`);
      const holes = (detail.holes ?? []).filter((h) => h.score > 0 || h.shots?.length);

      // Raw API dump — carries per-shot GPS (startLat/Lng, endLat/Lng), pin
      // positions, club names, and lost-ball flags. The GPS merge step in
      // scripts/import-shotscope.ts reads this to put shots on the map.
      writeFileSync(join(DATA_DIR, `${key}-gps.json`), JSON.stringify(detail, null, 1));

      // UI: select round, scrape Overview
      await selectRound(page, r);
      await clickTab(page, "Overview");
      const overview = await scrapeOverview(page);
      await page.screenshot({ path: join(shotDir, "overview.png"), fullPage: true });

      // UI: Hole By Hole — walk every hole, scrape + screenshot
      await clickTab(page, "Hole By Hole");
      await page.waitForSelector(".shotSelectorRowContainer", { timeout: 15000 });
      const shotsByHole = new Map<number, ShotRow[]>();
      for (let i = 0; i < holes.length; i++) {
        const holeNum = holes[i].holeNum;
        await page.waitForTimeout(600); // let map + rows settle
        shotsByHole.set(holeNum, await scrapeHoleShots(page));
        await page.screenshot({
          path: join(shotDir, `hole-${String(holeNum).padStart(2, "0")}.png`),
        });
        if (i < holes.length - 1) {
          await page.locator(".holeSelectorContainer svg.arrows").last().click(); // next-hole →
          await page.waitForTimeout(800);
        }
      }

      // Sanity: scraped shot count should equal the round's total
      const scraped = [...shotsByHole.values()].reduce((a, v) => a + v.length, 0);
      if (scraped !== r.totalShots) {
        log(`  WARNING: scraped ${scraped} shots but round total is ${r.totalShots}.`);
        log(`  Check screenshots in ${shotDir} — the shots CSV may be incomplete.`);
      }

      writeHolesCsv(join(DATA_DIR, `${key}-holes.csv`), holes);
      writeShotsCsv(join(DATA_DIR, `${key}-shots.csv`), holes, shotsByHole);
      appendSummaryRow(r, overview);
      log(`  wrote ${key}-holes.csv, ${key}-shots.csv, summary row, ${holes.length + 1} screenshots`);
    }
  } finally {
    await ctx.close();
  }

  if (FLAG_NO_IMPORT) {
    log("Skipping import (--no-import). Run: npx tsx scripts/import-shotscope.ts");
    return;
  }
  log("Importing into Caddie Book…");
  const res = spawnSync("npx", ["-y", "tsx", "scripts/import-shotscope.ts"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) throw new Error("import-shotscope.ts failed — see output above");
  log("Done. New rounds are in Caddie Book.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
