// js/ui/cards/pain.js — "What to expect" pain & bleeding card. Owner: Agent C (V3).
// Personal per-cycle-day expectations built from her own history (model.cycleDayProfile).
// Renders ONLY during the menstrual phase, or ≤2 days before the predicted period
// (as a gentle heads-up). Otherwise html() returns '' and the card simply isn't there.
import { cycleDayProfile } from '../../model.js';
import { PAIN_LEVELS } from '../../taxonomy.js';
import { addDays, diffDays } from '../../db.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bandFor(level) {
  return PAIN_LEVELS.find((b) => level >= b.min && level <= b.max) || null;
}

// Severity tint per the frozen class contract (.pain-mild/.pain-moderate/.pain-severe).
function tintClass(level) {
  if (level >= 7) return 'pain-severe';
  if (level >= 4) return 'pain-moderate';
  return 'pain-mild';
}

function flowWord(avgFlow) {
  if (avgFlow == null) return null;
  if (avgFlow < 0.5) return 'little to no bleeding';
  if (avgFlow < 1.5) return 'light spotting';
  if (avgFlow < 2.5) return 'a light flow';
  if (avgFlow < 3.5) return 'a medium flow';
  return 'a heavy flow';
}

// Entry with the largest positive value of `field`, or null.
function argmax(profile, field) {
  let best = null;
  for (const e of profile) {
    const v = e[field];
    if (v != null && v > 0 && (best == null || v > best[field])) best = e;
  }
  return best;
}

function dayName(dateStr, today) {
  if (dateStr === today) return 'today';
  if (dateStr === addDays(today, 1)) return 'tomorrow';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return diffDays(today, dateStr) > 6
    ? date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
    : date.toLocaleDateString(undefined, { weekday: 'long' });
}

function badgeHTML(avgPain) {
  if (avgPain == null) return '';
  const lvl = Math.round(avgPain);
  const band = bandFor(lvl);
  if (!band) return '';
  return `<span class="pain-expect-badge ${tintClass(lvl)}">${band.emoji} ${esc(band.label)} · around ${lvl}/10</span>`;
}

function copperHTML(settings) {
  if (!settings || settings.iudType !== 'copper') return '';
  return `<p class="pain-iud-note">🌙 A copper IUD commonly makes periods heavier and crampier — what you feel is real, and it is not in your head.</p>`;
}

// Comfort suggestions. Deliberately NO drug names — pain-relief guidance is
// "ask your GP or pharmacist", full stop (her other medications matter).
function comfortHTML() {
  return `
      <div class="pain-comfort">
        <div class="pain-comfort-title">Small mercies that help</div>
        <ul>
          <li>🔥 Heat — a hot water bottle low on your belly or back</li>
          <li>🛋️ Rest — doing less today is not falling behind</li>
          <li>🚶‍♀️ Gentle movement — a slow walk or soft stretching, only if it feels kind</li>
          <li>💧 Water within reach, little and often</li>
          <li>🥬 Iron-rich food with a squeeze of vitamin C — a heavy flow takes iron with it</li>
          <li>💬 For pain relief, ask your GP or pharmacist what fits alongside your other medications</li>
        </ul>
      </div>`;
}

function redflagsHTML() {
  return `
      <details class="pain-redflags">
        <summary>When to check in with a GP</summary>
        <p>None of these mean something is wrong — they simply deserve a professional's eyes rather than quiet endurance:</p>
        <ul>
          <li>Soaking through a pad or tampon every hour for 2+ hours</li>
          <li>Clots larger than a 10p coin, regularly</li>
          <li>Pain that stops you doing daily life — work, sleep, walking</li>
          <li>You can't feel your IUD strings, or they feel different</li>
        </ul>
      </details>`;
}

export default {
  id: 'pain',

  html(ctx) {
    const { logs, settings, preds, state, today } = ctx || {};
    const st = state || {};
    const menstrual = st.phase === 'menstrual' || !!st.onPeriod;

    let daysUntil = null;
    if (!menstrual && preds && preds.nextPeriodStart && today) {
      const d = diffDays(today, preds.nextPeriodStart);
      if (d >= 0 && d <= 2) daysUntil = d;
    }
    if (!menstrual && daysUntil == null) return '';

    const profile = cycleDayProfile(logs || []);
    let headline = '';
    let sub = '';
    let badge = '';

    if (menstrual) {
      const day = st.cycleDay;
      const entry = (typeof day === 'number' && day >= 1) ? (profile[day - 1] || null) : null;
      const hasData = !!(entry && entry.n > 0 && (entry.avgPain != null || entry.avgFlow != null));
      if (hasData) {
        const heaviest = argmax(profile, 'avgFlow');
        const w = flowWord(entry.avgFlow);
        const flowBit = (heaviest && heaviest.day === day)
          ? 'usually your heaviest'
          : (w ? `usually ${w}` : '');
        const painBit = entry.avgPain != null ? `pain around ${Math.round(entry.avgPain)}/10 for you` : '';
        const bits = [flowBit, painBit].filter(Boolean).join(', ');
        headline = `Day ${day}${bits ? ` — ${bits}` : ''}`;
        badge = badgeHTML(entry.avgPain);
        sub = ((entry.avgFlow != null && entry.avgFlow >= 3.5) || (entry.avgPain != null && entry.avgPain >= 7))
          ? 'Heavy is your normal, not your fault. Be as gentle with yourself today as you would be with someone you love.'
          : 'Drawn from your own history — the more you log, the truer this gets.';
      } else {
        headline = (typeof day === 'number' && day >= 1) ? `Day ${day} of your period` : 'Your period';
        sub = 'No history for this day yet — log your pain and flow, and this card will learn your rhythm.';
      }
    } else {
      const when = daysUntil === 0 ? 'today' : (daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`);
      headline = `Your period is expected ${when}`;
      const worst = argmax(profile, 'avgFlow') || argmax(profile, 'avgPain');
      if (worst && preds && preds.nextPeriodStart) {
        const worstDate = addDays(preds.nextPeriodStart, worst.day - 1);
        sub = `Day ${worst.day} is usually your hardest — it lands ${dayName(worstDate, today)}. Plan a soft evening: nothing you can't cancel, everything you can make cosy.`;
        badge = badgeHTML(worst.avgPain);
      } else {
        sub = 'When it arrives, log how it feels — next month this card will see it coming.';
      }
    }

    return `<div class="card pain-card">
      <div class="section-title">What to expect</div>
      <div class="pain-headline">${esc(headline)}</div>
      ${badge}
      <p class="pain-sub">${esc(sub)}</p>
      ${copperHTML(settings)}
      ${comfortHTML()}
      ${redflagsHTML()}
    </div>`;
  },
};
