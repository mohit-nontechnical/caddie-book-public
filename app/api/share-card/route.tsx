export const runtime = "nodejs";

// GET /api/share-card → 1080x1350 PNG "player profile" card, built from live
// round data. Shared via the Profile pages ("share my card") — the image is
// the artifact that leaves the app, so it carries the "Made with Caddie Book"
// footer. Behind the passcode middleware like every other route; sharing
// happens by sending the image file, not the URL.
import { ImageResponse } from "next/og";
import { getRounds, getCourseRatingOverrides, isCompleteRound } from "@/lib/caddie-store";
import { computeHandicap } from "@/lib/handicap";
import { makeResolver, buildRatedRounds } from "@/lib/live-handicap";
import { golfer } from "@/lib/caddie-data";

const W = 1080;
const H = 1350;

// ---- fonts: fetched once per lambda from Google Fonts (no-UA fetch returns
// TTF, which satori accepts). On any failure we render with next/og's
// bundled default instead of erroring the card. ----
const fontCache = new Map<string, ArrayBuffer | null>();

async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  if (fontCache.has(key)) return fontCache.get(key) ?? null;
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) throw new Error("no ttf url");
    const buf = await (await fetch(url)).arrayBuffer();
    fontCache.set(key, buf);
    return buf;
  } catch {
    fontCache.set(key, null);
    return null;
  }
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET() {
  const [rounds, overrides] = await Promise.all([getRounds(300), getCourseRatingOverrides()]);

  // Handicap — same pipeline as /api/handicap so the card always agrees.
  const hcp = computeHandicap(buildRatedRounds(rounds, makeResolver(overrides), true));
  // Trend delta over the last ~5 rounds, same derivation as useLiveGolfer.
  const tr = hcp.trend;
  const trendDelta =
    tr.length >= 2 ? r1(tr[tr.length - 1].index - tr[Math.max(0, tr.length - 6)].index) : null;

  // Season stats over complete 18-hole rounds (same filters as /api/stats).
  const complete18 = rounds.filter(
    (r) => isCompleteRound(r) && (r.stats?.holeCount ?? r.holes.length) >= 18
  );
  const totals = complete18.map((r) => r.total);
  const n = totals.length;
  const avg = n ? r1(totals.reduce((a, b) => a + b, 0) / n) : null;
  const bestRound = n
    ? complete18.reduce((best, r) => (r.total < best.total ? r : best), complete18[0])
    : null;
  const break85 = totals.filter((t) => t < 85).length;

  // Blow-up rate (holes at 7+), the app's signature stat.
  let holes = 0;
  let big = 0;
  for (const r of complete18) {
    for (const h of r.holes) {
      if (typeof h.score === "number" && h.score > 0) {
        holes++;
        if (h.score >= 7) big++;
      }
    }
  }
  const blowUpPct = holes ? r1((big / holes) * 100) : null;

  const lastFive = [...complete18]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((r) => r.total)
    .reverse();

  const [display, sans, mono] = await Promise.all([
    loadFont("Cormorant Garamond", 600),
    loadFont("DM Sans", 500),
    loadFont("DM Mono", 400),
  ]);
  const fonts = [
    display && { name: "display", data: display, weight: 600 as const, style: "normal" as const },
    sans && { name: "sans", data: sans, weight: 500 as const, style: "normal" as const },
    mono && { name: "mono", data: mono, weight: 400 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[];

  const GOLD = "#F0C040";
  const CREAM = "#F2ECDC";
  const CREAM_DIM = "rgba(242,236,220,0.55)";
  const PANEL = "rgba(242,236,220,0.055)";
  const LINE = "rgba(242,236,220,0.14)";
  const displayFont = display ? "display" : "sans-serif";
  const sansFont = sans ? "sans" : "sans-serif";
  const monoFont = mono ? "mono" : "monospace";

  const dateLabel = new Date()
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();

  const stat = (label: string, value: string, sub?: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 22,
        padding: "28px 30px",
      }}
    >
      <div style={{ fontFamily: monoFont, fontSize: 19, letterSpacing: 3, color: CREAM_DIM }}>{label}</div>
      <div style={{ fontFamily: displayFont, fontSize: 74, color: CREAM, marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub ? (
        <div style={{ fontFamily: sansFont, fontSize: 21, color: CREAM_DIM, marginTop: 8 }}>{sub}</div>
      ) : null}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #14291C 0%, #0F2016 55%, #0B1810 100%)",
          padding: 64,
        }}
      >
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: monoFont, fontSize: 22, letterSpacing: 6, color: GOLD }}>CADDIE BOOK</div>
            <div style={{ fontFamily: monoFont, fontSize: 18, letterSpacing: 4, color: CREAM_DIM, marginTop: 8 }}>
              {`PLAYER PROFILE · ${dateLabel}`}
            </div>
          </div>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              background: "linear-gradient(135deg, #1B4D3E, #0F2016)",
              border: `2px solid ${GOLD}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: displayFont,
              fontSize: 40,
              color: GOLD,
            }}
          >
            {golfer.initials}
          </div>
        </div>

        {/* player + index hero */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 56 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: displayFont, fontSize: 96, color: CREAM, lineHeight: 1 }}>{golfer.name}</div>
            <div style={{ fontFamily: sansFont, fontSize: 26, color: CREAM_DIM, marginTop: 14 }}>
              {`Chasing ${golfer.goal.toLowerCase()} · ${n} rounds logged`}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontFamily: monoFont, fontSize: 20, letterSpacing: 4, color: CREAM_DIM }}>HANDICAP INDEX</div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <div style={{ fontFamily: displayFont, fontSize: 150, color: GOLD, lineHeight: 1 }}>
                {hcp.index != null ? hcp.index.toFixed(1) : "—"}
              </div>
              {trendDelta != null && trendDelta !== 0 ? (
                <div
                  style={{
                    fontFamily: sansFont,
                    fontSize: 30,
                    color: trendDelta < 0 ? "#4CAF82" : "#C05C5C",
                    marginLeft: 14,
                    marginBottom: 18,
                  }}
                >
                  {`${trendDelta < 0 ? "−" : "+"}${Math.abs(trendDelta).toFixed(1)}`}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ height: 2, background: LINE, marginTop: 48, marginBottom: 48, display: "flex" }} />

        {/* stat grid */}
        <div style={{ display: "flex", gap: 24 }}>
          {stat("SEASON AVG", avg != null ? String(avg) : "—", "per 18 holes")}
          {stat(
            "BEST ROUND",
            bestRound ? String(bestRound.total) : "—",
            bestRound ? bestRound.course : undefined
          )}
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
          {stat("BROKE 85", `${break85}×`, `of ${n} rounds`)}
          {stat("BLOW-UP HOLES", blowUpPct != null ? `${blowUpPct}%` : "—", "holes at 7 or worse")}
        </div>

        {/* last five strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 22,
            padding: "26px 30px",
            marginTop: 24,
          }}
        >
          <div style={{ fontFamily: monoFont, fontSize: 19, letterSpacing: 3, color: CREAM_DIM }}>LAST 5</div>
          <div style={{ display: "flex", gap: 18 }}>
            {lastFive.map((t, i) => (
              <div
                key={i}
                style={{
                  fontFamily: displayFont,
                  fontSize: 44,
                  color: i === lastFive.length - 1 ? GOLD : CREAM,
                  display: "flex",
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div style={{ flex: 1, display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: sansFont, fontSize: 24, color: CREAM_DIM }}>Made with Caddie Book</div>
          <div style={{ fontFamily: monoFont, fontSize: 20, letterSpacing: 2, color: GOLD }}>
            caddie-book.vercel.app
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.length ? fonts : undefined }
  );
}
