// Shared response-shape interfaces for the desktop dashboard's API calls.
// Kept loose/optional where the real API may omit fields, so the UI can
// always render sensible zeros instead of throwing.

export interface HandicapCourseRow {
  name: string;
  norm: string;
  rounds18: number;
  rating: number;
  slope: number;
  par: number;
  estimated: boolean;
}

export interface HandicapResponse {
  index: number | null;
  roundsUsed?: number;
  rounds18?: number;
  rounds9?: number;
  recent20?: unknown[];
  trend?: "up" | "down" | "flat" | null;
  estimatedCourses?: string[];
  courses?: HandicapCourseRow[];
  error?: string;
}

export interface StatsBreak85 {
  count: number;
  total: number;
  pct: number;
}

export interface StatsMonthlyAvg {
  month: string;
  avg: number;
}

export interface StatsCourseRow {
  name: string;
  norm: string;
  rounds: number;
  rounds18: number;
  rounds9: number;
  avg18: number | null;
  best18: number | null;
  par: number;
  lastPlayed: string;
  scores18: number[];
}

export interface StatsResponse {
  overall: {
    totalRounds: number;
    rounds18: number;
    rounds9: number;
    scoringAvg18: number | null;
    best18: number | null;
    worst18: number | null;
    break85: StatsBreak85;
    monthlyAvg: StatsMonthlyAvg[];
  };
  courses: StatsCourseRow[];
  error?: string;
}

export interface RoundListItem {
  id: string;
  date: string;
  course: string;
  total: number;
  holeCount: number;
  front9: number;
  back9: number;
  holes: number[];
  complete: boolean;
  shotScope?: {
    shots: number;
    putts?: number;
    sgTee?: number;
    sgApproach?: number;
    sgShort?: number;
    sgPutting?: number;
  };
}

export interface StrokesGainedTrendPoint {
  date: string;
  sg: number;
}

export interface StrokesGainedByCourse {
  course: string;
  rounds: number;
  avgSG: number;
  avgDiff: number;
}

export interface StrokesGainedResponse {
  rounds: number;
  index: number | null;
  avgSG: number | null;
  potentialGap: number | null;
  gainerPct: number;
  best?: { date: string; course: string; total: number; differential: number; sg: number } | null;
  worst?: { date: string; course: string; total: number; differential: number; sg: number } | null;
  trend: StrokesGainedTrendPoint[];
  byCourse: StrokesGainedByCourse[];
  recent?: unknown[];
  excludedExecutive?: number;
  excludedCourses?: string[];
  error?: string;
}

export interface DebriefBlowUp {
  hole: number;
  score: number;
}

export interface DebriefBounceback {
  chances: number;
  recovered: number;
  recoveredPct: number;
  avgNextHole: number;
  tilt: boolean;
}

export interface DebriefResponse {
  round?: {
    id: string;
    course: string;
    date: string;
    total: number;
    holeCount: number;
    front9: number;
    back9: number;
  };
  personalAvg?: number | null;
  best?: number | null;
  vsAvg?: number | null;
  scoring?: {
    pars: number;
    birdiesPlus: number;
    bogeys: number;
    doublesPlus: number;
  };
  blowUps?: DebriefBlowUp[];
  blowUpCount?: number;
  blowUpStrokesOverBogey?: number;
  cleanScore?: number;
  bounceback?: DebriefBounceback | null;
  headline?: string;
  coachNote?: string;
  error?: string;
}

export interface InsightsMental {
  blowUpHoles: number;
  recovered: number;
  recoveredPct: number;
  doubledUpPct: number;
  avgNextHole: number;
  tilt: boolean;
  trend: { early: number | null; recent: number | null };
}

export interface InsightsResponse {
  rounds18: number;
  avg: number | null;
  best: number | null;
  worst: number | null;
  scoring: { pars: number; birdies: number; bogeys: number; doublesPlus: number };
  holeDist: { score: string; count: number; pct: number }[];
  bigHolePct: number;
  gapToGoal: {
    goal: number;
    current: number | null;
    gap: number | null;
    doublesPerRound: number;
    strokesIfHalved: number;
  };
  frontBack: { front: number; back: number; diff: number; backWorsePct: number } | null;
  trend: { date: string; score: number }[];
  consistency: { stdev: number; spread: number };
  mental: InsightsMental | null;
  error?: string;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}
