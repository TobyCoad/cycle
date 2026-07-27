// js/ui/cards/meals.js — "Feed your phase" Today card. Owner: Agent D (V3).
// Card contract: { id, html(ctx) } with ctx = { logs, settings, preds, state, today }.
// Rotates daily, deterministically, from js/content/meals.js. No network,
// no gradients, no external resources.

import { mealsFor } from '../../content/meals.js';
import * as ART from '../../art.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const SLOTS = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '🌿' },
  { key: 'dinner', label: 'Dinner', emoji: '🕯️' },
  { key: 'snack', label: 'Snack', emoji: '🍒' }
];

function bowOrnament() {
  try {
    if (typeof ART.BOW === 'string' && ART.BOW) {
      return `<span class="card-bow" aria-hidden="true" style="display:inline-block;width:26px;vertical-align:middle">${ART.BOW}</span>`;
    }
  } catch (e) { /* art.js may not have BOW yet */ }
  return '';
}

// Fallback rotation seed when there is no cycle data: the day of the month,
// so the card still changes daily instead of freezing on one menu.
function seedFrom(today) {
  const d = parseInt(String(today || '').slice(8, 10), 10);
  return Number.isFinite(d) && d >= 1 ? d : 1;
}

export default {
  id: 'meals',

  html(ctx) {
    const c = ctx || {};
    const state = c.state || null;
    const phase = state && state.phase ? state.phase : null;
    const cycleDay = state && state.cycleDay != null ? Number(state.cycleDay) : seedFrom(c.today);

    let data = null;
    try { data = mealsFor(phase, cycleDay); } catch (e) { data = null; }
    if (!data) return '';

    const meals = data.meals || {};
    const whys = data.mealWhys || {};

    const rows = SLOTS.map((s) => {
      const dish = meals[s.key];
      if (!dish) return '';
      const why = whys[s.key];
      return `
        <div class="meal-slot">
          <div class="meal-slot-head" style="display:flex;align-items:center;gap:6px">
            <span class="meal-emoji" aria-hidden="true">${s.emoji}</span>
            <span class="meal-slot-name" style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">${esc(s.label)}</span>
          </div>
          <div class="meal-dish" style="margin-top:2px;font-weight:700;line-height:1.4">${esc(dish)}</div>
          ${why ? `<p class="meal-why">${esc(why)}</p>` : ''}
        </div>`;
    }).join('');

    const chips = (Array.isArray(data.nutrients) ? data.nutrients : [])
      .map((n) => `<span class="nutrient-chip" title="${esc(n.why)}">${esc(n.name)}</span>`)
      .join('');

    const nutrientWhys = (Array.isArray(data.nutrients) ? data.nutrients : [])
      .map((n) => `<li><strong>${esc(n.name)}</strong> — ${esc(n.why)}</li>`)
      .join('');

    return `
    <div class="card meals-card">
      <div class="section-title">Feed your phase ${bowOrnament()}</div>
      <div class="meal-phase" style="font-family:'Didot','Bodoni 72',Georgia,serif;font-size:19px;font-weight:700">${esc(data.phaseLabel || '')}</div>
      <p class="meal-phase-why" style="margin:6px 0 0;font-size:13.5px;line-height:1.6">${esc(data.why || '')}</p>
      ${chips ? `<div class="nutrient-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">${chips}</div>` : ''}
      ${nutrientWhys ? `<ul class="nutrient-whys" style="margin:0 0 12px;padding-left:18px;font-size:13px;line-height:1.55;color:var(--muted)">${nutrientWhys}</ul>` : ''}
      ${rows}
      ${data.gutNote ? `<p class="meal-gut-note" style="margin:12px 0 0;font-size:13px;line-height:1.6"><strong>Gut note.</strong> ${esc(data.gutNote)}</p>` : ''}
      <p class="meal-disclaimer" style="margin:10px 0 0;font-size:11.5px;color:var(--muted)">Food ideas, not medical nutrition advice.</p>
    </div>`;
  }
};
