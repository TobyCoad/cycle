// partner.js — builds the standalone "for her person" share page. Owner: Agent E (V3).
//
// buildPartnerHTML(logs, settings, options) returns a COMPLETE single-file
// HTML string. It bakes in ONLY her cycle parameters (last period start,
// avgCycle, avgPeriod, luteal length) — never daily logs, symptoms or notes —
// plus a small inline ES5 engine that recomputes cycle day / phase /
// countdown from the device clock every time the page is opened, so the page
// stays accurate indefinitely and works offline from file://.

import { getPeriods } from './model.js';
import { predictions } from './predict.js';
import { todayStr } from './db.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Tiny heart-with-a-bow favicon, embedded so the page needs nothing external.
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
  "<path d='M32 57 C11 42 5 27 12 18 C18 10.5 28 12.5 32 21 C36 12.5 46 10.5 52 18 C59 27 53 42 32 57 Z' fill='#f472a8'/>" +
  "<path d='M32 13.5 C28.5 8 21 8.8 21 13 C21 17.4 28.5 18.4 32 13.5 C35.5 18.4 43 17.4 43 13 C43 8.8 35.5 8 32 13.5 Z' fill='#8f1d2c'/>" +
  "<circle cx='32' cy='13.5' r='2' fill='#8f1d2c'/>" +
  '</svg>'
);

// Small inline bow ornament for the page header (flat colours only).
const BOW_SVG =
  '<svg class="bow" viewBox="0 0 120 62" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<path d="M60 28 C42 6 14 10 14 29 C14 47 44 49 60 28 Z" fill="#f4a8c4"/>' +
  '<path d="M60 28 C78 6 106 10 106 29 C106 47 76 49 60 28 Z" fill="#f4a8c4"/>' +
  '<path d="M52 34 L42 58 L52 55 Z" fill="#e58bb0"/>' +
  '<path d="M68 34 L78 58 L68 55 Z" fill="#e58bb0"/>' +
  '<circle cx="60" cy="29" r="8.5" fill="#8f1d2c"/>' +
  '</svg>';

// The embedded engine. Plain ES5, no modules, no template literals — it runs
// inside the exported page on whatever browser he opens it in. All copy lives
// here so the page keeps giving phase-correct guidance forever.
// NOTE: this string is inside a JS template literal — it must never contain
// a backtick or "${".
const ENGINE = `
(function () {
  var DATA = __BAKED__;

  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmt(d) {
    var W = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return W[d.getDay()] + ' ' + d.getDate() + ' ' + M[d.getMonth()];
  }
  function daysWord(n) { return n === 1 ? '1 day' : n + ' days'; }
  function put(id, text) { var n = document.getElementById(id); if (n) n.textContent = text; }
  function show(id) { var n = document.getElementById(id); if (n) n.className = n.className.replace(/\\bhidden\\b/g, ' '); }
  function fillList(id, items) {
    var n = document.getElementById(id);
    if (!n) return;
    var h = '';
    for (var i = 0; i < items.length; i++) h += '<li>' + items[i] + '</li>';
    n.innerHTML = h;
  }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var start = parse(DATA.lastPeriodStart);
  var daysSince = Math.round((today - start) / 86400000);
  if (daysSince < 0) daysSince = 0; // device clock behind the generation date

  var cyclesElapsed = Math.floor(daysSince / DATA.avgCycle);
  var cycleDay = (daysSince % DATA.avgCycle) + 1;
  var next = new Date(start.getFullYear(), start.getMonth(),
                      start.getDate() + (cyclesElapsed + 1) * DATA.avgCycle);
  var daysToNext = Math.round((next - today) / 86400000);
  var ovDay = DATA.avgCycle - DATA.lutealLength;

  var phase;
  if (cycleDay <= DATA.avgPeriod) phase = 'menstrual';
  else if (Math.abs(cycleDay - ovDay) <= 1) phase = 'ovulation';
  else if (cycleDay > ovDay + 1) phase = 'luteal';
  else phase = 'follicular';

  var pms = phase === 'luteal' && daysToNext <= 5;
  var heavyDays = phase === 'menstrual' && cycleDay <= 2 && DATA.includePain;

  var COPY = {
    menstrual: {
      title: 'Her quiet days',
      poem: 'the body\\u2019s midwinter \\u2014 soft, slow, worth keeping warm',
      weather: 'Both of her key hormones, oestrogen and progesterone, have dropped to their lowest ebb \\u2014 that is what starts a period. Low hormones mean low fuel: energy dips, everything aches a little more, and warmth and rest genuinely help her body do its work.',
      support: [
        'Keep plans gentle and cancellable \\u2014 zero pressure is the kindest gift.',
        'Warm things work wonders: tea made without asking, a blanket that simply appears.',
        'She may want closeness or she may want space \\u2014 ask which, and believe the answer.',
        'Quietly take a chore off her plate. Don\\u2019t announce it; just do it.'
      ],
      gestures: [
        'Have her favourite snacks already in the house before she thinks to want them.',
        'Run her a bath and light the nice candle.',
        'Sort dinner start to finish \\u2014 her only job is to eat it.',
        'A cosy film, her choice, no debate.'
      ]
    },
    follicular: {
      title: 'Springtime',
      poem: 'energy rising like sap \\u2014 say yes to things',
      weather: 'Oestrogen is climbing day by day, and it brings the good stuff with it: energy, optimism, focus, a taste for the new. This is the body\\u2019s springtime \\u2014 she will likely feel more social, more spontaneous and more herself with every passing day.',
      support: [
        'Plan the adventure \\u2014 this is the week to actually book the thing.',
        'Match her energy: walks, projects, spontaneous detours.',
        'Bring her your ideas; she\\u2019ll have ten of her own to trade.',
        'Encourage the new hobby, the bold plan, the yes.'
      ],
      gestures: [
        'A surprise day out, planned end to end so she just gets to enjoy it.',
        'Book that restaurant you two keep talking about.',
        'A morning walk and properly good coffee.',
        'Say an enthusiastic yes to her most spontaneous idea this week.'
      ]
    },
    ovulation: {
      title: 'Golden hour',
      poem: 'the very peak of her cycle \\u2014 she glows',
      weather: 'Oestrogen has just hit its golden hour, and a quick surge of luteinising hormone marks the summit of her cycle. Many women feel their most confident, radiant and magnetic right about now \\u2014 it is real, and it is chemistry.',
      support: [
        'Tell her she looks incredible \\u2014 you will simply be reporting facts.',
        'Make tonight count: this is the night for the proper date.',
        'Let her shine in company; she\\u2019ll likely be at her most social.',
        'Take the photo. She will be glad of it later.'
      ],
      gestures: [
        'Dress up and take her somewhere lovely.',
        'Write down one true thing you love about her and give it to her.',
        'Kitchen dancing to her favourite song.',
        'Plan something only the two of you would find romantic.'
      ]
    },
    luteal: {
      title: 'The slow descent',
      poem: 'autumn light \\u2014 softer plans, softer voice',
      weather: 'Progesterone is running the show now while oestrogen slips away \\u2014 the long, slow descent toward her next period. Energy softens, patience runs a little shorter, and in the final few days this can tip into PMS. If moods turn, that is chemistry moving through her \\u2014 not a verdict on you.',
      support: [
        'Reassurance, offered before she has to ask for it.',
        'Low-key evenings beat big plans \\u2014 protect the quiet.',
        'Don\\u2019t take sharp moments personally; be the calm in the room.',
        'Snacks appearing unprompted are a genuine love language this week.',
        'Shrink her decisions: pick the film, sort the food, book the thing.'
      ],
      gestures: [
        'Her comfort food, sorted without a conversation.',
        'A night in that you organise completely.',
        'Small, unexpected thinking-of-you texts.',
        'Handle the boring life-admin task she has been dreading.'
      ]
    }
  };

  var c = COPY[phase];

  put('phase-name', c.title);
  put('phase-poem', c.poem);
  put('day-line', 'Day ' + cycleDay + ' of a roughly ' + DATA.avgCycle + '-day cycle');

  var weather = c.weather;
  var support = c.support.slice();
  if (heavyDays) {
    weather += ' Days one and two are usually her heaviest and most painful \\u2014 today is one of them, so double everything below.';
    support = [
      'Heat is her best friend \\u2014 have the hot water bottle ready before she asks.',
      'Patience over solutions: cramps this strong are exhausting, and she doesn\\u2019t need fixing, just backing.',
      'Favourite snacks, unprompted, and zero pressure to do anything at all.'
    ].concat(support);
  }
  put('weather', weather);
  fillList('support', support);
  fillList('gestures', c.gestures);

  if (phase === 'menstrual') {
    put('countdown', 'Day ' + cycleDay + ' of her period \\u2014 hers usually last about ' + DATA.avgPeriod + ' days.');
  } else if (daysToNext <= 2) {
    put('countdown', 'Her period is expected any day now \\u2014 around ' + fmt(next) + '. Have the kindness ready.');
  } else {
    put('countdown', 'Her next period is expected in ' + daysWord(daysToNext) + ', around ' + fmt(next) + '.');
  }

  if (pms) show('pms-badge');

  if (DATA.includeLibido && ovDay >= 1 && cycleDay >= ovDay - 4 && cycleDay <= ovDay + 1) {
    show('libido-note');
  }

  if (cyclesElapsed > 3) {
    var made = parse(DATA.generatedOn);
    put('made-on', fmt(made) + ' ' + made.getFullYear());
    show('stale-note');
  }

  var fd = parse(DATA.generatedOn);
  put('footer-date', fmt(fd) + ' ' + fd.getFullYear());
})();
`;

const PAGE_CSS = `
  :root {
    --pink: #f472a8; --pink-soft: #ffd6e8; --cream: #fdf6ec; --card: #fffdf8;
    --text: #5c3a4d; --muted: #a67f92; --cherry: #8f1d2c; --border: #f3d9e6;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: var(--text);
    font: 16px/1.55 ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, sans-serif;
    background-color: var(--cream);
    /* subtle gingham — hard colour stops only, never a fade */
    background-image:
      repeating-linear-gradient(0deg,  rgba(244,114,168,.045) 0 12px, rgba(244,114,168,0) 12px 24px),
      repeating-linear-gradient(90deg, rgba(244,114,168,.045) 0 12px, rgba(244,114,168,0) 12px 24px);
  }
  main {
    max-width: 480px; margin: 0 auto;
    padding: 24px 16px 44px;
    padding-top: calc(24px + env(safe-area-inset-top, 0px));
  }
  .bow { display: block; width: 58px; height: auto; margin: 0 auto 4px; }
  h1 {
    font-family: "Didot", "Bodoni 72", Georgia, serif;
    font-weight: 600; font-size: 34px; color: var(--cherry);
    text-align: center; margin: 4px 0 2px; letter-spacing: .3px;
  }
  .sub {
    text-align: center; font-family: Georgia, serif; font-style: italic;
    color: var(--muted); margin: 0 0 22px;
  }
  .card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 20px; box-shadow: 0 6px 22px rgba(244,114,168,.14);
    padding: 18px 16px 16px; margin: 0 0 16px;
  }
  /* scalloped lace top edge — radial hard stops, flat colours */
  .card::before {
    content: ''; display: block; height: 10px; margin: -18px -16px 12px;
    border-radius: 18px 18px 0 0;
    background:
      radial-gradient(circle at 8px 11px, var(--card) 5.2px, rgba(0,0,0,0) 5.9px) 0 0 / 16px 10px repeat-x,
      var(--pink-soft);
  }
  h2 {
    font-family: "Didot", "Bodoni 72", Georgia, serif;
    font-weight: 600; font-size: 19px; color: var(--cherry); margin: 0 0 8px;
  }
  .phase-name {
    font-family: "Didot", "Bodoni 72", Georgia, serif;
    font-size: 26px; font-weight: 600; color: var(--cherry); margin: 2px 0 0;
  }
  .card p { margin: 8px 0 0; }
  .note { font-family: Georgia, serif; font-style: italic; color: var(--muted); }
  .center { text-align: center; margin: 18px 8px; }
  .badge {
    display: inline-block; margin-top: 10px; padding: 5px 14px;
    background: var(--cherry); color: #fff6f2; border-radius: 999px; font-size: 13px;
  }
  ul { margin: 8px 0 0; padding: 0; list-style: none; }
  li { position: relative; padding: 6px 0 6px 24px; }
  li::before { content: '\\2661'; position: absolute; left: 2px; color: var(--pink); }
  .libido { background: var(--pink-soft); border-color: #f4b9d4; }
  .libido::before { background:
      radial-gradient(circle at 8px 11px, var(--pink-soft) 5.2px, rgba(0,0,0,0) 5.9px) 0 0 / 16px 10px repeat-x,
      var(--pink); }
  .libido p { font-family: Georgia, serif; font-style: italic; color: var(--cherry); margin: 0; }
  .stale {
    border: 1px solid var(--border); border-radius: 14px;
    background: var(--card); padding: 12px 14px; margin: 0 0 16px;
  }
  .trust {
    text-align: center; font-family: Georgia, serif; font-style: italic;
    color: var(--cherry); margin: 26px 6px 8px;
  }
  footer { text-align: center; color: var(--muted); font-size: 12.5px; margin-top: 14px; }
  .hidden { display: none; }
`;

// buildPartnerHTML(logs, settings, options)
// options = { partnerName: string, includeLibido: bool, includePain: bool }
export function buildPartnerHTML(logs, settings, options) {
  settings = settings || {};
  options = options || {};

  const periods = getPeriods(logs || []);
  if (periods.length === 0) {
    throw new Error('At least one logged period is needed to build a partner page.');
  }
  const preds = predictions(logs, settings);

  const baked = {
    lastPeriodStart: periods[periods.length - 1].start,
    avgCycle: preds.avgCycle,
    avgPeriod: preds.avgPeriod,
    lutealLength: settings.lutealLength != null ? settings.lutealLength : 14,
    generatedOn: todayStr(),
    includeLibido: !!options.includeLibido,
    includePain: options.includePain !== false
  };

  const her = String(settings.name || '').trim();
  const partner = String(options.partnerName || '').trim();
  const herEsc = her ? esc(her) : '';
  const partnerEsc = partner ? esc(partner) : '';

  const title = 'For ' + (partnerEsc || 'you') + ' \u{1F48C}';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="For ${partnerEsc || 'you'}">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#fdf6ec">
<link rel="icon" href="${FAVICON}">
<title>${title}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
  ${BOW_SVG}
  <h1>For ${partnerEsc || 'you'}</h1>
  <p class="sub">a little field guide to ${herEsc || 'her'}, with love</p>

  <section class="card">
    <h2>Where she is now</h2>
    <p class="phase-name" id="phase-name">&hellip;</p>
    <p class="note" id="phase-poem"></p>
    <p id="day-line">Her cycle runs about ${baked.avgCycle} days, with a period of around ${baked.avgPeriod}.</p>
    <p id="countdown"></p>
    <span class="badge hidden" id="pms-badge">PMS window &mdash; extra tenderness, please</span>
  </section>

  <section class="card">
    <h2>Hormone weather</h2>
    <p id="weather">Open this page with JavaScript on and it will tell you, freshly, every day.</p>
  </section>

  <section class="card">
    <h2>How to support her today</h2>
    <ul id="support"></ul>
  </section>

  <section class="card">
    <h2>Thoughtful gestures</h2>
    <ul id="gestures"></ul>
  </section>

  <section class="card libido hidden" id="libido-note">
    <p>Between the two of you: these few days are when her desire often runs warmest &mdash; if she seems flirtier than usual, it&rsquo;s real. Follow her lead, make her feel adored, and let anything more be entirely her idea.</p>
  </section>

  <div class="stale hidden" id="stale-note">
    <p class="note" style="margin:0">This page was made on <span id="made-on"></span>, and a few cycles have drifted by since. Rhythms wander &mdash; ask her for a fresh page so the maths stays true.</p>
  </div>

  <p class="note center">Cycles are weather, not clockwork &mdash; every date here is a gentle estimate, never an appointment.</p>

  <p class="trust">This page exists because ${herEsc || 'she'} chose to share her rhythm with you. It is a gift of her trust &mdash; keep it private, keep it kind, and never make her regret it.</p>

  <footer>Made with love on <span id="footer-date"></span>, entirely on her device &mdash; nothing here ever touched the internet.</footer>
</main>
<noscript><p style="text-align:center;color:#a67f92">This page needs JavaScript turned on to know where she is today.</p></noscript>
<script>${ENGINE.replace('__BAKED__', () => JSON.stringify(baked))}</script>
</body>
</html>
`;
}
