// js/moon.js — moon phase + Stardust-style moon-cycle archetypes. Owner: Agent S (V2).
// Pure module: no DB imports, no Date.now(). Dates are 'YYYY-MM-DD' strings,
// parsed as LOCAL NOON so timezone edges can't shift the calendar day.

const SYNODIC = 29.53059; // mean synodic month, days
// Known new moon: 2000-01-06 18:14 UTC.
const ANCHOR_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const MS_PER_DAY = 86400000;

// Parse 'YYYY-MM-DD' as local noon (dodges DST/timezone day-boundary edges).
function localNoonMs(dateStr) {
  const p = String(dateStr || '').split('-').map(Number);
  const y = p[0], m = p[1] || 1, d = p[2] || 1;
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime();
}

// Age of the moon in days at local noon of dateStr, in [0, SYNODIC).
function moonAge(dateStr) {
  const days = (localNoonMs(dateStr) - ANCHOR_MS) / MS_PER_DAY;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}

// 8 phases; windows of width 1/8 centered on the cardinal points
// (New at 0, First Quarter at 0.25, Full at 0.5, Last Quarter at 0.75).
const PHASES = [
  { name: 'New Moon', emoji: '\u{1F311}' },        // 🌑
  { name: 'Waxing Crescent', emoji: '\u{1F312}' }, // 🌒
  { name: 'First Quarter', emoji: '\u{1F313}' },   // 🌓
  { name: 'Waxing Gibbous', emoji: '\u{1F314}' },  // 🌔
  { name: 'Full Moon', emoji: '\u{1F315}' },       // 🌕
  { name: 'Waning Gibbous', emoji: '\u{1F316}' },  // 🌖
  { name: 'Last Quarter', emoji: '\u{1F317}' },    // 🌗
  { name: 'Waning Crescent', emoji: '\u{1F318}' }, // 🌘
];

export function moonPhase(dateStr) {
  const age = moonAge(dateStr);
  const frac = age / SYNODIC; // 0 = new, 0.5 = full, in [0, 1)
  // Phase index: shift by half a window so each phase is centered on its point.
  const idx = Math.floor(((frac + 1 / 16) % 1) * 8);
  const phase = PHASES[Math.min(7, Math.max(0, idx))];
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * frac)) / 2) * 100);
  return { frac, name: phase.name, emoji: phase.emoji, illumination };
}

// 'new' | 'full' | null — true only for the ONE calendar day nearest each exact
// new/full moment (the day whose local noon is within half a day of the instant).
export function moonMarker(dateStr) {
  const age = moonAge(dateStr);
  if (age <= 0.5 || age > SYNODIC - 0.5) return 'new';
  const half = SYNODIC / 2;
  if (age > half - 0.5 && age <= half + 0.5) return 'full';
  return null;
}

/* ---------- moon-cycle archetypes (Stardust-style, just for fun) ---------- */
// Quadrants of the lunation, each SYNODIC/4 ≈ 7.38 days wide, with the white
// and red windows CENTERED on the exact new/full points:
//   white  = frac in [0.875, 1) ∪ [0, 0.125)   (around the new moon)
//   pink   = frac in [0.125, 0.375)            (waxing half)
//   red    = frac in [0.375, 0.625)            (around the full moon)
//   purple = frac in [0.625, 0.875)            (waning half)

const CYCLE_TYPES = {
  white: {
    type: 'white',
    title: 'White Moon cycle',
    blurb: 'White Moon cycle — you bleed with the new moon, when the sky goes dark and quiet. Folklore paints this as the nurturer’s rhythm: energy turned inward, resting and restoring while the moon does the same, then blooming as it waxes. A lovely excuse for cosy nights and gentle self-care — just for fun, not science. \u{1F311}✨',
  },
  pink: {
    type: 'pink',
    title: 'Pink Moon cycle',
    blurb: 'Pink Moon cycle — your period arrives while the moon is waxing, growing brighter night by night. Tradition calls this a season of becoming: stepping into your own light, trying new things, letting confidence build alongside the crescent. Sweet imagery to carry with you — just for fun, not science. \u{1F312}\u{1F380}',
  },
  red: {
    type: 'red',
    title: 'Red Moon cycle',
    blurb: 'Red Moon cycle — you bleed under the full moon, the sky at its boldest and brightest. Old stories link this rhythm to the wise-woman archetype: creative, expressive, outward-facing energy, sharing your magic while the moon shines at full power. Delicious lore to enjoy — just for fun, not science. \u{1F315}✨',
  },
  purple: {
    type: 'purple',
    title: 'Purple Moon cycle',
    blurb: 'Purple Moon cycle — your period begins as the moon wanes, softening from full back toward dark. Folklore reads this as the healer’s season: releasing what’s done, reflecting, and trusting transitions while the moon gently lets go too. A tender little story to hold — just for fun, not science. \u{1F318}\u{1F49C}',
  },
};

export function moonCycleType(periodStartDateStr) {
  const frac = moonAge(periodStartDateStr) / SYNODIC;
  let key;
  if (frac >= 0.875 || frac < 0.125) key = 'white';
  else if (frac < 0.375) key = 'pink';
  else if (frac < 0.625) key = 'red';
  else key = 'purple';
  const t = CYCLE_TYPES[key];
  return { type: t.type, title: t.title, blurb: t.blurb };
}
