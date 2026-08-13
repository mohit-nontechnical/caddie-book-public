// ── Caddie Book domain data ──────────────────────────────────
// Ported from the HTML prototype's window.CB. This is seed/demo data;
// the API routes (parse-round, coach) can mutate rounds over time.

export type Trend = "up" | "down" | "flat";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type Section = "POWER" | "SCORING" | "MENTAL";

export interface Slot {
  id: string;
  section: Section;
  name: string;
  grade: Grade;
  trend: Trend;
  diag: string;
  focus?: boolean;
  stats: [string, string, string][];
  spark: number[];
  drill: string;
  club?: string;
}

export interface Drill {
  id: string;
  name: string;
  slot: string;
  dur: string;
  diff: string;
  fixes: string;
  steps: string[];
  why: string;
}

export interface Pattern {
  id: string;
  date: string;
  tag: string;
  slot: string;
  text: string;
}

export interface Course {
  name: string;
  city: string;
  par: number;
  slope: number;
  rating: number;
  rounds: number;
  avg: number;
  best: number;
  lat: number;
  lng: number;
}

export const golfer = {
  name: "Mo",
  initials: "MO",
  index: "14.2",
  trend: "-0.8",
  home: "Sharp Park GC",
  rounds: 18,
  lastFive: [92, 89, 94, 88, 91],
  goal: "Break 85",
};

export const GRADE_VALUE: Record<Grade, number> = { A: 92, B: 80, C: 66, D: 52, F: 36 };

export const gradeColor = (g: string): string =>
  (({ A: "#4CAF82", B: "#7DBE63", C: "#E8C44C", D: "#D2814A", F: "#C05C5C" } as Record<string, string>)[g] ||
    "#F0C040");

// ── Hex alpha helper ─────────────────────────────────────────
export function hexA(hex: string, a: number): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export const slots: Slot[] = [
  // POWER
  { id: "driver", section: "POWER", name: "Driver", grade: "D", trend: "down", diag: "Push-slice right — open face at impact. 44% fairways.", stats: [["Fairways", "44", "%"], ["Avg carry", "241", "yd"], ["Miss bias", "R→", ""]], spark: [55, 52, 50, 49, 47], drill: "tempo", club: "TaylorMade Qi10 LS" },
  { id: "woods", section: "POWER", name: "3-Wood", grade: "C", trend: "flat", diag: "Solid off the tee. Off-deck use still developing.", stats: [["GIR reach", "42", "%"], ["Avg carry", "218", "yd"], ["Off deck", "Dev", ""]], spark: [62, 63, 62, 65, 64], drill: "tempo", club: "Titleist TSR" },
  { id: "hybrid", section: "POWER", name: "4-Hybrid", grade: "B", trend: "up", diag: "Old faithful. Most reliable long club in the bag.", stats: [["GIR reach", "51", "%"], ["Avg carry", "198", "yd"], ["Conf.", "4.2", "/5"]], spark: [74, 76, 77, 79, 81], drill: "ladder", club: "Old Faithful" },
  { id: "midiron", section: "POWER", name: "Mid Irons", grade: "C", trend: "flat", diag: "6-8 iron. Adequate — not yet a scoring weapon.", stats: [["GIR", "34", "%"], ["Avg prox", "38", "ft"], ["Conf.", "3.1", "/5"]], spark: [62, 63, 64, 63, 65], drill: "window", club: "Mizuno 6–8i" },
  { id: "shortiron", section: "POWER", name: "Short Irons", grade: "C", trend: "up", diag: "9-PW. GIR improving but still trailing off inside 150.", stats: [["GIR <150", "38", "%"], ["Avg prox", "29", "ft"], ["Conf.", "3.4", "/5"]], spark: [60, 62, 63, 65, 67], drill: "window", club: "Mizuno 9–PW" },

  // SCORING
  { id: "wedge", section: "SCORING", name: "Wedge Game", grade: "C", trend: "flat", diag: "Distance control wanders ±14 yds inside 100.", stats: [["Prox 50–100", "32", "ft"], ["Inside 15ft", "28", "%"], ["Spin var", "Hi", ""]], spark: [62, 63, 62, 64, 63], drill: "ladder", club: "Cleveland + gap" },
  { id: "approach", section: "SCORING", name: "Approach 100–150", grade: "D", trend: "down", diag: "22% GIR — biggest stroke leak per round.", focus: true, stats: [["GIR", "22", "%"], ["Avg prox", "41", "ft"], ["Lost/rd", "3.4", ""]], spark: [58, 55, 53, 51, 48], drill: "window" },
  { id: "chip", section: "SCORING", name: "Chipping", grade: "C", trend: "up", diag: "Up-and-down 34%. Anti-flip technique improving.", stats: [["Up & down", "34", "%"], ["Avg prox", "11", "ft"], ["Skulls/rd", "1.1", ""]], spark: [58, 60, 62, 64, 66], drill: "par18" },
  { id: "bunker", section: "SCORING", name: "Bunker Play", grade: "F", trend: "down", diag: "1-in-12 sand saves. Bleeding here every round.", stats: [["Sand saves", "8", "%"], ["Avg prox", "29", "ft"], ["Lost/rd", "2.1", ""]], spark: [40, 38, 36, 35, 32], drill: "splash" },
  { id: "putting", section: "SCORING", name: "Putting", grade: "B", trend: "up", diag: "1.84 putts/GIR. Odyssey White Hot doing work.", stats: [["Putts/GIR", "1.84", ""], ["3-putts/rd", "0.7", ""], ["Make <6ft", "81", "%"]], spark: [74, 76, 78, 79, 81], drill: "gate", club: "Odyssey White Hot OG" },

  // MENTAL
  { id: "mgmt", section: "MENTAL", name: "Course Mgmt", grade: "C", trend: "flat", diag: "Ego shots with driver when fairway wood is the call.", stats: [["Smart play", "54", "%"], ["Penalties/rd", "1.6", ""], ["Par 3 GIR", "21", "%"]], spark: [62, 61, 63, 62, 63], drill: "window" },
  { id: "zones", section: "MENTAL", name: "Scoring Zones", grade: "C", trend: "up", diag: "Getting better at converting when inside 100.", stats: [["Conv. rate", "14", "%"], ["Pars+/rd", "7.8", ""], ["Bogey-free", "1.4", ""]], spark: [60, 62, 63, 65, 66], drill: "par18" },
  { id: "pressure", section: "MENTAL", name: "Pressure Putts", grade: "C", trend: "down", diag: "Back-9 short putts slipping. Tilt pattern from chess.", stats: [["Make 4–6ft", "61", "%"], ["Back-9 drop", "2.8", ""], ["Lip-outs/rd", "1.3", ""]], spark: [66, 64, 63, 62, 60], drill: "gate" },
  { id: "consist", section: "MENTAL", name: "Consistency", grade: "D", trend: "down", diag: "Blow-up hole every 1.1 rounds. Recovery rate low.", stats: [["Doubles/rd", "1.7", ""], ["Worst str.", "4", "hl"], ["Recover", "24", "%"]], spark: [55, 53, 51, 50, 48], drill: "window" },
];

export const drills: Record<string, Drill> = {
  window: { id: "window", name: "The Window Drill", slot: "approach", dur: "15 min", diff: "Core", fixes: "Strike consistency and trajectory control on full-swing approaches.", steps: ["Pick a target 120 yards out on the range.", "Imagine a 6-ft-wide window 10 yards in front of you, hip-high.", "Hit 15 balls — each must start through the window.", "Track how many start on line. Goal: 11 of 15."], why: "You're losing 3.4 strokes per round from 100–150. Most misses are pushes — a strike-path fault, not a yardage one. Fix the start line first." },
  splash: { id: "splash", name: "Splash the Line", slot: "bunker", dur: "10 min", diff: "Core", fixes: "Entry point and consistent sand contact in greenside bunkers.", steps: ["Draw a line in the sand perpendicular to your target.", "Set the ball 2 inches ahead of the line.", "Make 10 swings that splash the LINE — ignore the ball.", "Then add a ball. Same swing, same splash point."], why: "An 8% sand-save rate almost always traces to a wandering entry point. Groove the entry, the ball comes out for free." },
  gate: { id: "gate", name: "Gate Putts", slot: "putting", dur: "10 min", diff: "Maintenance", fixes: "Start line on short, must-make putts — especially back nine.", steps: ["Place two tees a putter-head apart, 18 inches in front of the ball.", "Roll 20 putts through the gate without clipping a tee.", "Step back to 6 feet and repeat for 10 putts."], why: "Your back-9 drop suggests pressure, not stroke mechanics. The Odyssey White Hot is working — keep the start line honest under fatigue." },
  tempo: { id: "tempo", name: "Tempo Count", slot: "driver", dur: "12 min", diff: "Core", fixes: "Push-slice caused by rushing the transition and opening the face.", steps: ['Count "one-two-three" on the backswing, "one" on the way down.', "Hit 10 drives at 80% effort with that exact count.", "Lead wrist flat at the top — check in a mirror or phone camera.", "Note where the ball finishes — smoother tempo squares the face."], why: "Your right miss spikes when you rush. A 3-to-1 tempo keeps the lead wrist from cupping and the face from opening at impact." },
  ladder: { id: "ladder", name: "Ladder Wedges", slot: "wedge", dur: "15 min", diff: "Core", fixes: "Distance control gaps inside 100 yards.", steps: ["Hit 5 balls each to 60, 75, and 90 yards.", "Chart the front-to-back spread at every station.", "Tighten the worst station before moving on."], why: "A ±14-yard spread turns makeable wedges into scrambles. Build a reliable clock system and the approach stats follow." },
  par18: { id: "par18", name: "Par-18 Short Game", slot: "chip", dur: "20 min", diff: "Game", fixes: "Converting greenside chances into up-and-downs.", steps: ["Drop 9 balls around one green at varied lies.", "Chip and hole out each — par is 2 per ball (18 total).", "Keep score. Beat your number next session."], why: "Your up-and-down rate climbs fastest when every rep has a score attached. Same logic as chess puzzles — pressure creates pattern memory." },
};

export const patterns: Pattern[] = [
  { id: "p1", date: "After Sharp Park · 91", tag: "Driver leak", slot: "driver", text: "You're hitting 44% of fairways with your Qi10 LS, but your miss is always right. The push-slice is an open face at impact — rushing the transition and cupping the lead wrist. Fix this first and 3 other slots improve automatically." },
  { id: "p2", date: "After Sharp Park · 91", tag: "Strength confirmed", slot: "putting", text: "Putting is a genuine strength: 1.84 putts/GIR and the Odyssey White Hot is clearly dialed in. The strokes are leaking before the green — you're leaving approaches 40+ feet out. Fix the approach, not the putter." },
  { id: "p3", date: "After Baylands · 88", tag: "Same fault twice", slot: "approach", text: "Your driver misses right AND your 100–150 GIR is 22%. These are likely the same path fault expressing itself at two distances. Get the mid-iron path sorted and the driver numbers will move too." },
  { id: "p4", date: "After Indian Valley · 94", tag: "Tilt pattern", slot: "pressure", text: "Your back nine averages 3.1 strokes worse than your front. The pattern looks like tilt — similar to your chess blitz sessions. One bad hole cascades. The fix is pre-shot routine, not mechanics." },
  { id: "p5", date: "After Baylands · 88", tag: "Old faithful working", slot: "hybrid", text: "The 4-hybrid is your most reliable scoring club. When in doubt off the tee on tight holes, it's the play. Course management note: you're using it 40% less than your stats suggest you should." },
];

export const courses: Course[] = [
  { name: "Sharp Park GC", city: "Pacifica, CA", par: 72, slope: 121, rating: 70.1, rounds: 8, avg: 91.2, best: 87, lat: 37.603, lng: -122.495 },
  { name: "Baylands GC", city: "Palo Alto, CA", par: 72, slope: 113, rating: 68.4, rounds: 6, avg: 89.8, best: 88, lat: 37.465, lng: -122.085 },
  { name: "Indian Valley GC", city: "Novato, CA", par: 72, slope: 118, rating: 69.8, rounds: 4, avg: 93.5, best: 90, lat: 38.090, lng: -122.575 },
];

// ── Augusta color themes ─────────────────────────────────────
export const THEMES: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    "--bg": "#0F2016",
    "--panel": "#172B1D",
    "--line": "rgba(255,255,255,0.08)",
    "--cream": "#FFFFFF",
    "--cream-2": "rgba(255,255,255,0.75)",
    "--cream-3": "rgba(255,255,255,0.40)",
    "--tabbar": "rgba(12,26,18,0.88)",
    "--surface": "#1B4D3E",
  },
  light: {
    "--bg": "#E9E4D6",
    "--panel": "#F5F1E8",
    "--line": "rgba(27,77,62,0.12)",
    "--cream": "#0F2016",
    "--cream-2": "rgba(15,32,22,0.72)",
    "--cream-3": "rgba(15,32,22,0.44)",
    "--tabbar": "rgba(240,236,228,0.90)",
    "--surface": "#D6E8DF",
  },
};
