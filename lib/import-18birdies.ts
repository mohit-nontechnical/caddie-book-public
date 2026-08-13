// ── 18Birdies account-data importer ──────────────────────────
// Maps an 18Birdies "Download Your Account Data" JSON export into our Round[].
// 18Birdies gives per-hole *scores* plus per-round aggregate stats (GIR, putts,
// fairways) — but not per-hole par/FIR/GIR/putts. We keep per-hole scores and
// store the aggregates in Round.stats (which is what Coach analyzes).

import type { Round, RoundStats } from "./caddie-store";

interface B18Stats {
  putts?: number;
  gir?: number;
  girHoleCount?: number;
  fairwayMiddles?: number;
  fairwayHoleCount?: number;
  pars?: number;
  birdies?: number;
  bogeys?: number;
  doubleBogeyOrWorse?: number;
  eagles?: number;
}

interface B18Round {
  id?: string;
  timestamp?: number;
  clubId?: { id?: string };
  score?: number;
  strokes?: number;
  holeStrokes?: number[];
  stats?: B18Stats;
}

interface B18Archive {
  myData?: {
    activityData?: { rounds?: B18Round[] };
    clubData?: { playedClubs?: { clubId: string; name: string }[] };
  };
  // Also accept already-unwrapped shapes:
  activityData?: { rounds?: B18Round[] };
  clubData?: { playedClubs?: { clubId: string; name: string }[] };
}

export interface ImportResult {
  rounds: Round[];
  total: number;
  skipped: number;
  courses: number;
  courseNames: string[];
}

export function mapArchiveToRounds(archive: B18Archive): ImportResult {
  const activity = archive?.myData?.activityData ?? archive?.activityData;
  const clubs = archive?.myData?.clubData?.playedClubs ?? archive?.clubData?.playedClubs ?? [];
  const rawRounds = activity?.rounds ?? [];

  const clubName = new Map<string, string>();
  for (const c of clubs) if (c?.clubId) clubName.set(c.clubId, c.name);

  const seenCourses = new Set<string>();
  let skipped = 0;
  const rounds: Round[] = [];

  for (const r of rawRounds) {
    const holeStrokes = Array.isArray(r.holeStrokes) ? r.holeStrokes : [];
    if (!r.id || !holeStrokes.length) {
      skipped++;
      continue;
    }
    const course = (r.clubId?.id && clubName.get(r.clubId.id)) || "Unknown course";
    seenCourses.add(course);

    const s = r.stats ?? {};
    const stats: RoundStats = {
      holeCount: holeStrokes.length,
      putts: s.putts,
      gir: s.gir,
      girHoleCount: s.girHoleCount,
      fairwayHits: s.fairwayMiddles,
      fairwayHoleCount: s.fairwayHoleCount,
      pars: s.pars,
      birdies: s.birdies,
      bogeys: s.bogeys,
      doubleBogeyOrWorse: s.doubleBogeyOrWorse,
      eagles: s.eagles,
      source: "18birdies",
    };

    rounds.push({
      id: r.id,
      course,
      date: new Date(r.timestamp ?? Date.now()).toISOString(),
      total: r.strokes ?? holeStrokes.reduce((a, b) => a + (b || 0), 0),
      holes: holeStrokes.map((score, i) => ({
        hole: i + 1,
        par: 0, // not provided by 18Birdies export
        score,
        fir: null,
        gir: false,
        putts: 0,
      })),
      stats,
    });
  }

  return { rounds, total: rounds.length, skipped, courses: seenCourses.size, courseNames: Array.from(seenCourses) };
}
