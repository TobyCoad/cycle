// js/art.js — Ghibli-inspired soft painterly art (Agent A, V3 coquette).
// FROZEN contract: named exports BUNNY_MASCOT, BUNNY_MOON, BUNNY_CHEER,
// BUNNY_SLEEPY, FAWN (each `<svg viewBox="0 0 120 120">`),
// BOW (`<svg viewBox="0 0 120 80">`, single dusty-pink ribbon bow) and
// SPARKLES (`<svg viewBox="0 0 200 24">`, lace-and-bow divider).
// Plain strings, no width/height attrs.
// Style: layered translucent blobs fake watercolor shading — warm cream body,
// gentle grey-brown shading, dusty-rose ears/blush, bead eyes with a glint,
// storybook proportions, quiet expressions, small ribbon bows. Original
// creatures, no thick outlines. Sized by .bunny-art / .bunny-art-sm (app.css).

/* ---------- palette (warm, harmonious with the baby-pink theme) ---------- */
const CREAM = '#f5ead9';                       // base fur
const EDGE = 'rgba(163,130,116,0.42)';         // low-contrast soft edge
const SHADE = 'rgba(196,168,143,0.32)';        // grey-brown watercolor shading
const HILITE = 'rgba(255,255,255,0.5)';        // soft highlight blob
const INNER = 'rgba(224,160,170,0.65)';        // dusty-rose inner ear
const BLUSH = 'rgba(228,150,160,0.45)';        // dusty-rose blush
const EYE = '#4a3b32';                          // dark bead eyes
const MOUTH = 'rgba(74,59,50,0.6)';
const MUZZLE = '#c9a08e';                       // small neutral nose
const GRASS = 'rgba(139,168,118,0.55)';
const PETAL = 'rgba(233,160,175,0.7)';
const PETAL_LT = 'rgba(233,160,175,0.45)';
const MOTE = 'rgba(201,184,245,0.5)';           // lavender dust mote
const MOTE_WARM = 'rgba(242,215,149,0.55)';     // warm dust mote
const MOON_FILL = '#f2d795';
const MOON_GLOW = 'rgba(242,215,149,0.35)';
const GROUND = 'rgba(166,127,146,0.16)';        // soft ground shadow
const RIBBON = '#d98aa4';                       // dusty-pink ribbon
const RIBBON_DK = 'rgba(143,29,44,0.45)';       // soft cherry edge
const CHERRY = '#8f1d2c';                       // deep cherry knot
const TAN = '#e3c39a';                          // fawn coat
const TAN_EDGE = 'rgba(160,118,82,0.45)';       // fawn soft edge
const TAN_SHADE = 'rgba(166,120,80,0.30)';      // fawn watercolor shading
const SPOT = 'rgba(255,253,248,0.9)';           // white back spots
const LACE = 'rgba(217,138,164,0.75)';          // lace thread

/* ---------- tiny builders ---------- */

const el = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

const petal = (cx, cy, rot, rx, ry, fill) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" transform="rotate(${rot} ${cx} ${cy})"/>`;

const mote = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

// relaxed droopy ear: cream outer + dusty-rose inner + soft base shading
function ear(cx, cy, tilt) {
  return `<g transform="rotate(${tilt} ${cx} ${cy})">` +
    el(cx, cy, 6.5, 18, CREAM, `stroke="${EDGE}" stroke-width="1.4"`) +
    el(cx, cy + 2, 3, 12, INNER) +
    el(cx, cy + 12, 4.5, 5, SHADE) +
    `</g>`;
}

// soft paw (small rounded limb)
const paw = (cx, cy, rot = 0) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="5" ry="8.5" fill="${CREAM}" stroke="${EDGE}" stroke-width="1.3"` +
  (rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : '') + `/>`;

const grassBlade = (x, lean) =>
  `<path d="M${x} 112 Q${x + lean} 101 ${x + lean * 2} 95" fill="none" stroke="${GRASS}" stroke-width="2" stroke-linecap="round"/>`;

// small ribbon bow (two loops, cherry knot, trailing tails) — worn at the neck
const neckBow = (cx, cy, s = 1) =>
  `<g transform="translate(${cx} ${cy}) scale(${s})">` +
  `<path d="M-0.5 0 C-3.5 -4.5 -9.5 -3.5 -9.5 0.5 C-9.5 4 -3.5 4.5 -0.5 0 Z" fill="${RIBBON}" stroke="${RIBBON_DK}" stroke-width="0.7"/>` +
  `<path d="M0.5 0 C3.5 -4.5 9.5 -3.5 9.5 0.5 C9.5 4 3.5 4.5 0.5 0 Z" fill="${RIBBON}" stroke="${RIBBON_DK}" stroke-width="0.7"/>` +
  `<path d="M-1.2 1.2 L-3.2 6 M1.2 1.2 L3.2 6" stroke="${RIBBON}" stroke-width="1.6" stroke-linecap="round"/>` +
  `<circle cx="0" cy="0" r="1.9" fill="${CHERRY}"/>` +
  `</g>`;

// plump storybook body + watercolor shading layers, sitting on a soft shadow
const BODY_SOFT =
  el(60, 110, 29, 5, GROUND) +
  el(60, 86, 27, 23, CREAM, `stroke="${EDGE}" stroke-width="1.5"`) +
  el(69, 93, 14, 10, SHADE) +
  el(50, 78, 12, 9, HILITE);

const FRONT_PAWS =
  el(50, 101, 6, 4.5, CREAM, `stroke="${EDGE}" stroke-width="1.2"`) +
  el(70, 101, 6, 4.5, CREAM, `stroke="${EDGE}" stroke-width="1.2"`);

// round gentle head + shading + highlight
const HEAD_SOFT =
  `<circle cx="60" cy="52" r="21" fill="${CREAM}" stroke="${EDGE}" stroke-width="1.5"/>` +
  el(68, 59, 10, 8, SHADE) +
  el(52, 44, 9, 7, HILITE);

const BLUSH_CHEEKS = el(46, 57, 4.5, 2.8, BLUSH) + el(74, 57, 4.5, 2.8, BLUSH);

// tiny dark bead eyes with a white glint
const EYES_OPEN =
  `<circle cx="52" cy="50" r="2.2" fill="${EYE}"/><circle cx="52.8" cy="49.2" r="0.7" fill="#fff"/>` +
  `<circle cx="68" cy="50" r="2.2" fill="${EYE}"/><circle cx="68.8" cy="49.2" r="0.7" fill="#fff"/>`;
const EYES_HAPPY =
  `<path d="M49.5 50.5 Q52 48 54.5 50.5" fill="none" stroke="${EYE}" stroke-width="1.8" stroke-linecap="round"/>` +
  `<path d="M65.5 50.5 Q68 48 70.5 50.5" fill="none" stroke="${EYE}" stroke-width="1.8" stroke-linecap="round"/>`;
const EYES_CLOSED =
  `<path d="M49.5 50 Q52 52.5 54.5 50" fill="none" stroke="${EYE}" stroke-width="1.8" stroke-linecap="round"/>` +
  `<path d="M65.5 50 Q68 52.5 70.5 50" fill="none" stroke="${EYE}" stroke-width="1.8" stroke-linecap="round"/>`;

const MUZZLE_SOFT =
  el(60, 55, 1.8, 1.4, MUZZLE) +
  `<path d="M57.5 58.5 Q60 60.5 62.5 58.5" fill="none" stroke="${MOUTH}" stroke-width="1.3" stroke-linecap="round"/>`;
const MOUTH_TINY =
  el(60, 55, 1.8, 1.4, MUZZLE) +
  `<path d="M58.5 58 Q60 59.3 61.5 58" fill="none" stroke="${MOUTH}" stroke-width="1.3" stroke-linecap="round"/>`;

const svgOpen = (label) =>
  `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">`;

/* ---------- the bunnies ---------- */

// Gentle bunny raising one paw in a quiet hello, grass at its feet, a petal drifting by.
export const BUNNY_MASCOT =
  svgOpen('Gentle bunny waving hello') +
  ear(50, 24, -24) + ear(70, 24, 24) +
  BODY_SOFT + el(50, 101, 6, 4.5, CREAM, `stroke="${EDGE}" stroke-width="1.2"`) +
  paw(84, 60, 35) +
  HEAD_SOFT +
  EYES_OPEN + BLUSH_CHEEKS + MUZZLE_SOFT +
  neckBow(60, 73, 0.9) +
  grassBlade(14, 3) + grassBlade(21, -2) + grassBlade(102, 2) +
  petal(27, 28, -30, 3.5, 2, PETAL) + mote(96, 20, 1.5, MOTE) + mote(20, 44, 1.1, MOTE_WARM) +
  `</svg>`;

// Bunny reaching toward a hand-painted storybook crescent with a soft glow, motes drifting.
export const BUNNY_MOON =
  svgOpen('Bunny reaching for a storybook crescent moon') +
  `<circle cx="94" cy="26" r="17" fill="${MOON_GLOW}"/>` +
  `<path d="M96 12 a14 14 0 1 0 0 28 a18 18 0 0 1 0 -28 z" fill="${MOON_FILL}"/>` +
  el(87, 20, 2.5, 4, 'rgba(255,255,255,0.4)') +
  mote(20, 18, 1.5, MOTE_WARM) + mote(30, 40, 1.1, MOTE) + mote(106, 52, 1.3, MOTE) +
  ear(50, 26, -26) + ear(70, 24, 16) +
  BODY_SOFT + el(50, 101, 6, 4.5, CREAM, `stroke="${EDGE}" stroke-width="1.2"`) +
  HEAD_SOFT +
  paw(82, 44, 48) +
  EYES_OPEN + BLUSH_CHEEKS + MUZZLE_SOFT +
  neckBow(60, 73, 0.9) +
  grassBlade(16, 2) +
  `</svg>`;

// Calmly joyful bunny, both paws lifted, petals drifting down around it, a little flower nearby.
export const BUNNY_CHEER =
  svgOpen('Happy bunny among drifting petals') +
  ear(50, 23, -20) + ear(70, 23, 20) +
  BODY_SOFT +
  paw(38, 62, -35) + paw(82, 62, 35) +
  HEAD_SOFT +
  EYES_HAPPY + BLUSH_CHEEKS + MUZZLE_SOFT +
  neckBow(60, 73, 0.9) +
  petal(24, 22, -25, 3.5, 2, PETAL) + petal(92, 15, 20, 3, 1.8, PETAL_LT) + petal(102, 44, -40, 3.2, 1.9, PETAL) +
  mote(34, 10, 1.2, MOTE) + mote(104, 28, 1.3, MOTE_WARM) +
  `<circle cx="22" cy="105" r="2.6" fill="${PETAL}"/><circle cx="22" cy="105" r="1.1" fill="${MOON_FILL}"/>` +
  grassBlade(28, 2) +
  `</svg>`;

// Dozing bunny — heavy droopy ears, eyes closed, a small mushroom keeping watch.
export const BUNNY_SLEEPY =
  svgOpen('Sleepy bunny resting in the grass') +
  ear(48, 27, -34) + ear(72, 27, 34) +
  BODY_SOFT + FRONT_PAWS +
  HEAD_SOFT +
  EYES_CLOSED + BLUSH_CHEEKS + MOUTH_TINY +
  neckBow(60, 73, 0.85) +
  `<path d="M84 30 h5 l-5 5 h5" fill="none" stroke="rgba(170,150,190,0.6)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
  mote(95, 18, 1.2, MOTE) +
  `<path d="M89 104 Q95 95.5 101 104 Z" fill="rgba(200,120,110,0.78)"/>` +
  el(95, 107, 2.5, 4, '#ecd9c8') +
  grassBlade(14, 3) + grassBlade(106, -2) +
  `</svg>`;

/* ---------- FAWN — serene painterly spotted fawn, resting in the grass ---------- */

export const FAWN =
  svgOpen('Serene spotted fawn resting in the grass') +
  // ground shadow
  el(62, 106, 34, 5, GROUND) +
  // folded hind legs / haunch under the body
  el(74, 100, 19, 7, TAN, `stroke="${TAN_EDGE}" stroke-width="1.4"`) +
  // body — plump storybook oval, watercolor layers
  el(64, 87, 31, 19, TAN, `stroke="${TAN_EDGE}" stroke-width="1.5"`) +
  el(76, 94, 15, 10, TAN_SHADE) +
  el(52, 80, 13, 9, HILITE) +
  // cream chest / belly
  el(44, 92, 10, 9, CREAM) +
  // folded front legs tucked in front
  el(46, 102, 13, 5, CREAM, `stroke="${TAN_EDGE}" stroke-width="1.2"`) +
  // white back spots — hard little flecks, no fades
  mote(60, 76, 2, SPOT) + mote(69, 74, 1.7, SPOT) + mote(78, 78, 2.1, SPOT) +
  mote(64, 84, 1.5, SPOT) + mote(73, 87, 1.9, SPOT) + mote(83, 87, 1.5, SPOT) +
  mote(87, 80, 1.4, SPOT) +
  // tail tuft
  el(93, 82, 3.5, 2.5, CREAM, `stroke="${TAN_EDGE}" stroke-width="1"`) +
  // neck rising to the head
  `<g transform="rotate(-16 42 70)">` + el(42, 70, 8.5, 15, TAN, `stroke="${TAN_EDGE}" stroke-width="1.4"`) + `</g>` +
  el(40, 74, 4.5, 8, HILITE) +
  // big soft leaf ears with dusty-rose inner
  `<g transform="rotate(-38 26 43)">` +
  el(26, 43, 4.8, 9.5, TAN, `stroke="${TAN_EDGE}" stroke-width="1.3"`) + el(26, 44, 2.2, 6, INNER) + `</g>` +
  `<g transform="rotate(34 49 41)">` +
  el(49, 41, 4.8, 9.5, TAN, `stroke="${TAN_EDGE}" stroke-width="1.3"`) + el(49, 42, 2.2, 6, INNER) + `</g>` +
  // head
  `<circle cx="38" cy="52" r="13" fill="${TAN}" stroke="${TAN_EDGE}" stroke-width="1.4"/>` +
  el(34, 47, 5.5, 4.5, HILITE) +
  // cream muzzle + small dark nose
  el(32.5, 58, 6, 4.8, CREAM) +
  el(29.5, 56.5, 1.9, 1.5, EYE) +
  // serene closed eyes (long gentle lashes)
  `<path d="M32.5 51 Q35 53.6 37.5 51" fill="none" stroke="${EYE}" stroke-width="1.7" stroke-linecap="round"/>` +
  `<path d="M41.5 51 Q44 53.6 46.5 51" fill="none" stroke="${EYE}" stroke-width="1.7" stroke-linecap="round"/>` +
  // blush
  el(34, 56.5, 3.6, 2.3, BLUSH) + el(45, 55.5, 3.4, 2.2, BLUSH) +
  // tiny mouth
  `<path d="M31.5 61 Q33 62.2 34.5 61" fill="none" stroke="${MOUTH}" stroke-width="1.2" stroke-linecap="round"/>` +
  // tiny dusty-pink neck bow
  neckBow(45, 64, 0.75) +
  // quiet meadow details
  grassBlade(12, 3) + grassBlade(103, -2) + grassBlade(109, 2) +
  petal(100, 30, -25, 3.2, 1.9, PETAL_LT) + mote(20, 30, 1.2, MOTE) + mote(96, 18, 1.3, MOTE_WARM) +
  `</svg>`;

/* ---------- BOW — single dusty-pink / cherry ribbon bow ---------- */

export const BOW =
  `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
  // left loop + inner shade
  `<path d="M57 34 C40 12 12 17 13 35 C14 53 42 56 57 36 Z" fill="${RIBBON}" stroke="${RIBBON_DK}" stroke-width="1.4"/>` +
  `<path d="M52 33 C41 21 24 23 23 34 C23 44 40 48 52 36 Z" fill="rgba(255,255,255,0.28)"/>` +
  // right loop + inner shade
  `<path d="M63 34 C80 12 108 17 107 35 C106 53 78 56 63 36 Z" fill="${RIBBON}" stroke="${RIBBON_DK}" stroke-width="1.4"/>` +
  `<path d="M68 33 C79 21 96 23 97 34 C97 44 80 48 68 36 Z" fill="rgba(255,255,255,0.28)"/>` +
  // trailing tails with notched ends
  `<path d="M56 40 C50 52 46 62 38 71 L48 74 C54 63 58 52 60 43 Z" fill="${RIBBON}" stroke="${RIBBON_DK}" stroke-width="1.2"/>` +
  `<path d="M64 40 C70 52 74 62 82 71 L72 74 C66 63 62 52 60 43 Z" fill="${RIBBON}" stroke="${RIBBON_DK}" stroke-width="1.2"/>` +
  // cherry knot with a soft highlight
  `<ellipse cx="60" cy="35.5" rx="7" ry="6" fill="${CHERRY}"/>` +
  `<ellipse cx="57.5" cy="33" rx="2.4" ry="1.7" fill="rgba(255,255,255,0.3)"/>` +
  `</svg>`;

/* ---------- lace-and-bow divider (keeps the SPARKLES export name) ---------- */

// scalloped lace thread with picot dots, meeting at a tiny centre bow
const laceRun = (x0) => {
  let d = `M${x0} 11`;
  for (let i = 0; i < 6; i++) d += ` Q${x0 + i * 12 + 6} 19 ${x0 + (i + 1) * 12} 11`;
  let picots = '';
  for (let i = 0; i < 6; i++) picots += mote(x0 + i * 12 + 6, 21.5, 0.9, LACE);
  return `<path d="${d}" fill="none" stroke="${LACE}" stroke-width="1.4" stroke-linecap="round"/>` + picots;
};

export const SPARKLES =
  `<svg viewBox="0 0 200 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
  laceRun(10) +
  laceRun(118) +
  neckBow(100, 11, 1.05) +
  `</svg>`;
