// Caddie Book — desktop data model. Plain JS, attaches to window.CB
(function () {
  // ── seeded RNG (deterministic per round) ────────────────
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Golfer ──────────────────────────────────────────────
  const golfer = {
    name: 'Ray Calloway',
    initials: 'RC',
    index: '25.1',
    index9: '24.4',
    scoreAvg18: '100.1',
    scoreAvg9: '49.8',
    best: 80,
    rounds: 81,
    home: 'Shoreline Golf Links',
    breakGoal: { target: 85, done: 2, total: 44 },
    // mental hook
    bounce: { recovered: 46.3, doubleUp: 53.8, trend: 'up' }, // after a blow-up hole
  };

  // ── Grade system (tuned darker for parchment) ───────────
  const gradeColor = (g) => ({
    A: '#3E8F63', B: '#6E9A46', C: '#C0912F', D: '#C0742F', F: '#B0433D',
  }[g] || '#C0912F');

  // ── Courses (31 played, Bay Area) ───────────────────────
  // [name, city, avg, rating, slope, rounds, lat, lng]
  const _courses = [
    ['Shoreline Golf Links', 'Mountain View', 98.4, 71.9, 123, 14, 37.4192, -122.0862],
    ['Baylands Golf Links', 'Palo Alto', 105.5, 72.6, 130, 6, 37.4610, -122.1150],
    ['Sunnyvale Golf Course', 'Sunnyvale', 96.8, 68.9, 114, 8, 37.3552, -122.0233],
    ['Deep Cliff Golf Course', 'Cupertino', 91.2, 63.3, 106, 5, 37.3220, -122.0510],
    ['Los Lagos Golf Course', 'San Jose', 99.1, 70.1, 121, 4, 37.2790, -121.8330],
    ['Santa Teresa Golf Club', 'San Jose', 101.7, 71.4, 124, 3, 37.2210, -121.7810],
    ['Cinnabar Hills', 'San Jose', 104.2, 73.5, 132, 2, 37.1970, -121.7620],
    ['Coyote Creek — Tournament', 'Morgan Hill', 106.8, 74.8, 138, 2, 37.1490, -121.5620],
    ['Spring Valley GC', 'Milpitas', 97.6, 69.5, 118, 4, 37.4550, -121.8720],
    ['Summitpointe GC', 'Milpitas', 100.9, 71.0, 126, 3, 37.4380, -121.8560],
    ['San Jose Muni', 'San Jose', 95.3, 70.3, 119, 5, 37.3860, -121.8360],
    ['Rancho del Pueblo', 'San Jose', 88.4, 59.8, 92, 6, 37.3610, -121.8020],
    ['Pruneridge GC', 'Santa Clara', 89.1, 60.5, 95, 4, 37.3460, -121.9770],
    ['Palo Alto Muni (9)', 'Palo Alto', 97.0, 71.2, 122, 3, 37.4640, -122.1120],
    ['Los Altos G&CC', 'Los Altos', 102.4, 71.8, 129, 2, 37.3690, -122.1150],
    ['Moffett Field GC', 'Mountain View', 98.9, 70.6, 120, 3, 37.4090, -122.0490],
    ['Emerald Hills', 'Redwood City', 92.7, 64.1, 108, 2, 37.4470, -122.2630],
    ['Poplar Creek', 'San Mateo', 96.1, 69.8, 117, 4, 37.5460, -122.2900],
    ['Crystal Springs', 'Burlingame', 103.8, 72.9, 133, 2, 37.5680, -122.3760],
    ['Sharp Park', 'Pacifica', 100.2, 70.9, 125, 3, 37.6320, -122.4930],
    ['Gleneagles', 'San Francisco', 101.1, 68.4, 129, 2, 37.7150, -122.4030],
    ['TPC Harding Park', 'San Francisco', 104.9, 73.8, 136, 1, 37.7230, -122.4930],
    ['Lincoln Park', 'San Francisco', 99.7, 68.0, 118, 2, 37.7830, -122.5010],
    ['Metropolitan GL', 'Oakland', 97.9, 70.1, 121, 3, 37.7300, -122.1560],
    ['Lake Chabot', 'Oakland', 100.6, 70.5, 124, 2, 37.7460, -122.1180],
    ['Monarch Bay', 'San Leandro', 98.2, 70.7, 122, 3, 37.6960, -122.1870],
    ['Skywest GC', 'Hayward', 95.8, 69.9, 116, 5, 37.6560, -122.1180],
    ['Boundary Oak', 'Walnut Creek', 101.4, 71.6, 127, 2, 37.9110, -122.0250],
    ['Callippe Preserve', 'Pleasanton', 99.5, 71.3, 128, 3, 37.6350, -121.8420],
    ['The Course at Wente', 'Livermore', 105.1, 74.2, 139, 1, 37.6410, -121.7460],
    ['Half Moon Bay — Old', 'Half Moon Bay', 106.2, 73.5, 134, 1, 37.4310, -122.4390],
  ];
  const overall = parseFloat(golfer.scoreAvg18);
  const courses = _courses.map((c, i) => {
    const [name, city, avg, rating, slope, rounds, lat, lng] = c;
    return {
      id: 'c' + i, name, city, avg, rating, slope, rounds, lat, lng,
      // + means he plays it worse than his overall average (loses strokes)
      sg: +(overall - avg).toFixed(1),
    };
  });
  const courseByName = (n) => courses.find((c) => c.name === n) || courses[0];

  // ── Rounds (score trend over the season) ────────────────
  // score trend: chronological, most recent last. best round = 80.
  const _rounds = [
    ['2025-09-14', 'Baylands Golf Links', 108],
    ['2025-09-28', 'Shoreline Golf Links', 104],
    ['2025-10-11', 'Sunnyvale Golf Course', 101],
    ['2025-10-19', 'Santa Teresa Golf Club', 106],
    ['2025-11-02', 'Shoreline Golf Links', 99],
    ['2025-11-16', 'San Jose Muni', 97],
    ['2025-11-30', 'Deep Cliff Golf Course', 92],
    ['2025-12-13', 'Baylands Golf Links', 107],
    ['2026-01-04', 'Shoreline Golf Links', 100],
    ['2026-01-18', 'Poplar Creek', 96],
    ['2026-02-01', 'Rancho del Pueblo', 88],
    ['2026-02-15', 'Sunnyvale Golf Course', 95],
    ['2026-03-01', 'Shoreline Golf Links', 98],
    ['2026-03-15', 'Skywest GC', 94],
    ['2026-03-29', 'Deep Cliff Golf Course', 80],
    ['2026-04-12', 'Shoreline Golf Links', 96],
    ['2026-04-26', 'Los Lagos Golf Course', 99],
    ['2026-05-10', 'Sunnyvale Golf Course', 93],
    ['2026-05-24', 'Shoreline Golf Links', 91],
    ['2026-06-07', 'Baylands Golf Links', 103],
    ['2026-06-21', 'Spring Valley GC', 95],
    ['2026-06-28', 'Shoreline Golf Links', 89],
  ];

  // par templates
  const PAR72 = [4,4,3,5,4,4,3,5,4, 4,3,4,5,4,4,3,5,4];
  const PAR70 = [4,3,4,4,4,3,5,4,4, 4,4,3,5,4,3,4,4,4];
  const parsFor = (courseName) => {
    const c = courseByName(courseName);
    return (c.rating < 65) ? PAR70 : PAR72; // executive/short courses par 70
  };

  // deterministic hole-by-hole from a target score
  function buildHoles(pars, target, seed) {
    const rnd = mulberry32(seed);
    const holes = pars.map((p) => p + 1); // start bogey golf
    let sum = holes.reduce((a, b) => a + b, 0);
    let guard = 0;
    // add strokes (blow-ups) if under target
    while (sum < target && guard++ < 400) {
      const i = Math.floor(rnd() * holes.length);
      if (holes[i] - pars[i] < 4) { holes[i]++; sum++; }
    }
    // remove strokes (pars/birdies) if over target
    while (sum > target && guard++ < 400) {
      const i = Math.floor(rnd() * holes.length);
      const min = pars[i] >= 5 ? pars[i] - 1 : pars[i]; // allow a birdie on par 5s
      if (holes[i] > min) { holes[i]--; sum--; }
    }
    return holes;
  }

  const rounds = _rounds.map((r, i) => {
    const [date, courseName, score] = r;
    const pars = parsFor(courseName);
    const holes = buildHoles(pars, score, 1000 + i * 7);
    const vs = holes.map((h, k) => h - pars[k]);
    const blowups = vs.filter((v) => v >= 2).length;
    const par = pars.reduce((a, b) => a + b, 0);
    const c = courseByName(courseName);
    const diff = +(((score - c.rating) * 113) / c.slope).toFixed(1);
    const d = new Date(date + 'T12:00:00');
    return {
      id: 'r' + i, idx: i, date, courseName, course: c,
      dateShort: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateLong: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      score, par, holes, pars, vs, blowups, diff, holesN: 18,
      toPar: score - par,
    };
  });
  const roundsDesc = [...rounds].reverse();
  const latest = rounds[rounds.length - 1];

  // strokes-gained "vs potential" trend series (paired with score trend)
  // potential = if he cleaned up blow-ups. positive = strokes left on the table.
  const sgTrend = rounds.map((r) => +(r.blowups * 1.35 + (r.toPar - 27) * 0.12).toFixed(1));

  // scoring distribution across the season (per-hole outcomes)
  const distribution = (() => {
    let birdie = 0, par = 0, bogey = 0, dbl = 0, blow = 0;
    rounds.forEach((r) => r.vs.forEach((v) => {
      if (v <= -1) birdie++; else if (v === 0) par++; else if (v === 1) bogey++;
      else if (v === 2) dbl++; else blow++;
    }));
    const total = birdie + par + bogey + dbl + blow;
    return { total, bars: [
      { key: 'Birdie+', n: birdie, color: '#3E8F63' },
      { key: 'Par', n: par, color: '#6E9A46' },
      { key: 'Bogey', n: bogey, color: '#C0912F' },
      { key: 'Double', n: dbl, color: '#C0742F' },
      { key: 'Blow-up', n: blow, color: '#B0433D' },
    ] };
  })();

  // ── Bag (14 slots), tuned for a 25 handicap ─────────────
  const slots = [
    { id: 'driver',  section: 'POWER', name: 'Driver',        grade: 'D', trend: 'flat', diag: 'Big miss right — the source of most blow-up holes off the tee.',
      stats: [['Fairways', '38', '%'], ['Avg carry', '221', 'yd'], ['Penalties', '1.4', '/rd']], spark: [48,50,49,47,49], drill: 'tempo' },
    { id: 'woods',   section: 'POWER', name: 'Fairway Woods', grade: 'C', trend: 'up',   diag: 'Improving off the deck, still streaky.',
      stats: [['GIR reach', '31', '%'], ['Avg carry', '198', 'yd'], ['Tops/rd', '1.2', '']], spark: [58,60,63,64,66], drill: 'tempo' },
    { id: 'longiron','section': 'POWER', name: 'Long Irons',  grade: 'F', trend: 'down', diag: 'GIR near zero from 190+. A club you should bag less.',
      stats: [['GIR 190+', '6', '%'], ['Avg prox', '61', 'ft'], ['Lost', '2.9', '/rd']], spark: [40,38,36,35,33], drill: 'window' },
    { id: 'midiron', section: 'POWER', name: 'Mid Irons',     grade: 'C', trend: 'up',   diag: 'Your most trustworthy full swing, 6–8 iron.',
      stats: [['GIR', '29', '%'], ['Avg prox', '44', 'ft'], ['Strikes/rd', '4.4', '']], spark: [60,62,64,66,68], drill: 'ladder' },
    { id: 'shortiron','section': 'POWER', name: 'Short Irons', grade: 'C', trend: 'flat', diag: 'Fine contact, wanders left under 150.',
      stats: [['GIR <150', '41', '%'], ['Avg prox', '34', 'ft'], ['Looks/rd', '1.9', '']], spark: [64,66,65,67,66], drill: 'window' },
    { id: 'wedge',   section: 'SCORING', name: 'Wedge Game',  grade: 'D', trend: 'down', diag: 'Distance control is a coin flip inside 100.',
      stats: [['Prox 50–100', '46', 'ft'], ['Inside 15ft', '19', '%'], ['Chunks/rd', '1.6', '']], spark: [56,54,52,51,49], drill: 'ladder' },
    { id: 'approach','section': 'SCORING', name: 'Approach 100–150', grade: 'F', trend: 'down', diag: 'Your single biggest stroke leak — 17% GIR.', focus: true,
      stats: [['GIR', '17', '%'], ['Avg prox', '52', 'ft'], ['Lost', '3.4', '/rd']], spark: [46,43,41,39,36], drill: 'window' },
    { id: 'chip',    section: 'SCORING', name: 'Chipping',    grade: 'C', trend: 'up',   diag: 'Up-and-down 31% — trending the right way.',
      stats: [['Up & down', '31', '%'], ['Avg prox', '12', 'ft'], ['Skulls/rd', '1.1', '']], spark: [58,60,62,64,66], drill: 'par18' },
    { id: 'bunker',  section: 'SCORING', name: 'Bunker Play', grade: 'F', trend: 'flat', diag: '1-in-11 sand saves. Pure bleeding.',
      stats: [['Sand saves', '9', '%'], ['Avg prox', '31', 'ft'], ['Lost', '2.1', '/rd']], spark: [36,35,34,34,33], drill: 'splash' },
    { id: 'putting', section: 'SCORING', name: 'Putting',     grade: 'B', trend: 'up',   diag: 'Quietly your best asset — 1.9 putts per hole.',
      stats: [['Putts/rd', '34.2', ''], ['3-putts/rd', '2.1', ''], ['Make <6ft', '79', '%']], spark: [72,74,76,78,80], drill: 'gate' },
    { id: 'mgmt',    section: 'MENTAL', name: 'Course Mgmt',  grade: 'D', trend: 'flat', diag: 'Firing at flags you have no business at.',
      stats: [['Smart play', '44', '%'], ['Penalties/rd', '2.3', ''], ['Short-side', '38', '%']], spark: [52,51,53,52,52], drill: 'window' },
    { id: 'zones',   section: 'MENTAL', name: 'Scoring Zones', grade: 'C', trend: 'up',  diag: 'Cards a par when you finally reach range.',
      stats: [['Pars/rd', '4.6', ''], ['Bogey-free', '0.9', ''], ['Doubles/rd', '4.1', '']], spark: [60,62,63,65,66], drill: 'par18' },
    { id: 'pressure','section': 'MENTAL', name: 'Bounce-back', grade: 'C', trend: 'up', diag: 'Recovers after a blow-up 46% of the time — up from 38%.', mental: true,
      stats: [['Recover', '46.3', '%'], ['Double-up', '53.8', '%'], ['Worst run', '3', 'hl']], spark: [58,60,62,64,67], drill: 'gate' },
    { id: 'consist', section: 'MENTAL', name: 'Consistency',  grade: 'D', trend: 'up', diag: 'A blow-up hole every 4.1 holes — but the trend is up.',
      stats: [['Blow-ups/rd', '4.4', ''], ['Worst streak', '3', 'hl'], ['Clean 9s', '0.6', '/rd']], spark: [50,52,53,55,56], drill: 'window' },
  ];
  const bagGpa = (() => {
    const m = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    return (slots.reduce((a, s) => a + m[s.grade], 0) / slots.length).toFixed(2);
  })();

  // ── Drills ──────────────────────────────────────────────
  const drills = {
    window: { id: 'window', name: 'The Window Drill', slot: 'approach', dur: '15 min', diff: 'Core',
      fixes: 'Strike consistency and start line on full-swing approaches.',
      steps: [
        'Pick a target 120 yards out on the range.',
        'Imagine a 6-ft-wide window 10 yards ahead, hip-high.',
        'Hit 15 balls — each must start through the window.',
        'Goal: 11 of 15 start on line.',
      ],
      why: 'You lose 3.4 strokes per round from 100–150. Most are pushes that never started on line — a path fault, not a yardage one.' },
    splash: { id: 'splash', name: 'Splash the Line', slot: 'bunker', dur: '10 min', diff: 'Core',
      fixes: 'Consistent entry point in greenside bunkers.',
      steps: ['Draw a line in the sand perpendicular to target.', 'Set the ball 2 inches ahead of the line.', 'Make 10 swings that splash the LINE — ignore the ball.', 'Add a ball; same swing, same splash point.'],
      why: 'A 9% sand-save rate almost always traces to a wandering entry point. Groove the entry and the ball comes out for free.' },
    gate: { id: 'gate', name: 'Gate Putts', slot: 'putting', dur: '10 min', diff: 'Maintenance',
      fixes: 'Start line on short, must-make putts.',
      steps: ['Two tees a putter-head apart, 18 inches ahead of the ball.', 'Roll 20 putts through the gate without a clip.', 'Step to 6 feet; repeat for 10.'],
      why: 'Putting is already your strength — this protects the short ones that keep blow-ups from becoming disasters.' },
    tempo: { id: 'tempo', name: 'Tempo Count', slot: 'driver', dur: '12 min', diff: 'Core',
      fixes: 'A right miss caused by rushing the transition.',
      steps: ['Count "one-two-three" back, "one" down.', 'Hit 10 drives at 80% with that count.', 'Note the finish — smoother tempo squares the face.'],
      why: 'Your right miss spikes when speed climbs. A 3-to-1 tempo holds the face square and keeps the ball in play.' },
    ladder: { id: 'ladder', name: 'Ladder Wedges', slot: 'wedge', dur: '15 min', diff: 'Core',
      fixes: 'Distance control gaps inside 100 yards.',
      steps: ['Hit 5 balls each to 50, 70, and 90 yards.', 'Chart the front-to-back spread per station.', 'Tighten the worst station before moving on.'],
      why: 'A wandering wedge turns a good drive into a double. Build a reliable clock and the leak closes.' },
    par18: { id: 'par18', name: 'Par-18 Short Game', slot: 'chip', dur: '20 min', diff: 'Game',
      fixes: 'Converting greenside chances into up-and-downs.',
      steps: ['Drop 9 balls around one green at varied lies.', 'Chip and hole out each — par is 2 (18 total).', 'Keep score; beat your number next time.'],
      why: 'Chipping climbs fastest when every rep has a score attached. This is how a double becomes a bogey.' },
  };

  // ── Pre-round mental routine ────────────────────────────
  const routine = [
    { title: 'Play to bogey', body: 'Your target on every hole is bogey, not par. Bogey golf breaks 90. Par is a bonus, never the plan.' },
    { title: 'Take your medicine', body: 'In trouble? Wedge back to the fairway. One bad swing costs one stroke — trying the hero shot costs three.' },
    { title: 'Reset the tilt', body: 'After a blow-up, walk to the next tee and take three slow breaths. The round is 18 holes, not the last one.' },
    { title: 'Coach\u2019s mantra', body: '“Smooth tempo, front of the green, two putts, walk to the next tee.” Say it before every full swing.' },
  ];

  // ── Insights (the mobile cards, laid out desktop) ───────
  const frontBack = { front: 49.8, back: 50.3 }; // avg per nine
  const insights = { frontBack };

  // ── Latest debrief coach note ───────────────────────────
  const debriefNote =
    'Two holes cost you the round: the double-double on 8 and 12 after tee balls right. ' +
    'Take driver out of your hands on those and you shoot 84. Everything else was bogey golf.';

  // ── Coach suggested prompts ─────────────────────────────
  const coachChips = [
    "What's costing me the most strokes?",
    'How do I stop doubling up after a blow-up?',
    'Which course should I stop playing?',
    'What should I practice this week?',
  ];
  // seed conversation (used before the live model answers)
  const coachSeed = [
    { role: 'coach', text: `Morning, Ray. I went through all 81 rounds. Short version: you're a putter and a grinder trapped behind a driver and a 100–150 approach game. Ask me anything — I'll quote your own numbers back.` },
  ];

  // grounding facts for the live model
  const coachFacts = [
    `Golfer: Ray Calloway, handicap index 25.1, 18-hole scoring average 100.1, best round 80, 81 rounds logged, home course Shoreline Golf Links.`,
    `Goal: break 85. He has done it 2 times in 44 attempts.`,
    `Biggest stroke leak: approach shots 100–150 yards, graded F, 17% greens in regulation, losing 3.4 strokes per round.`,
    `Driver graded D: 38% fairways, right miss, 1.4 penalties per round — the source of most blow-up holes.`,
    `Bunker play graded F: 9% sand saves. Long irons graded F from 190+.`,
    `Putting is his strength, graded B, and he leaves too many approach putts long.`,
    `Bounce-back rate after a blow-up hole: 46.3% recovered, 53.8% double-up. Up from 38% last season.`,
    `Hardest course: Baylands Golf Links, 105.5 average. Easiest: Rancho del Pueblo, 88.4. He under-performs most at Coyote Creek and Half Moon Bay.`,
    `He averages 49.8 on the front nine and 50.3 on the back — a slight back-nine fade.`,
    `Assigned focus drill: The Window Drill for approach strike and start line.`,
  ];
  const coachSystem =
    `You are Ray Calloway's golf coach inside the Caddie Book app — an after-round analysis tool. ` +
    `You are warm, direct, and a little clubby, like an old caddie who has seen his whole season. ` +
    `You ALWAYS ground answers in his real numbers and quote specific stats back to him. ` +
    `Keep replies to 2–4 short sentences. No markdown, no bullet lists, no emoji. Speak to him as "you".\n\n` +
    `His data:\n` + coachFacts.map((f) => '- ' + f).join('\n');

  window.CB = {
    golfer, gradeColor, courses, courseByName, rounds, roundsDesc, latest,
    sgTrend, distribution, slots, bagGpa, drills, routine, insights,
    debriefNote, coachChips, coachSeed, coachFacts, coachSystem,
    // helpers
    hexA(hex, a) {
      const h = hex.replace('#', '');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    },
    scoreColor(vsPar) {
      if (vsPar <= -1) return '#3E8F63';
      if (vsPar === 0) return '#6E9A46';
      if (vsPar === 1) return '#8A7A52';
      if (vsPar === 2) return '#C0742F';
      return '#B0433D';
    },
  };
})();
