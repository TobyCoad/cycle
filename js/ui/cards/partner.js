// js/ui/cards/partner.js — "For your love" Today card. Owner: Agent E (V3).
// Card contract: default export { id, html(ctx), wire(el, ctx) },
// ctx = { logs, settings, preds, state, today }. Null-safe when preds is null.

import { saveSettings } from '../../db.js';
import { buildPartnerHTML } from '../../partner.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function partnerSettings(ctx) {
  const stored = (ctx && ctx.settings && ctx.settings.partner) || {};
  return Object.assign({ name: '', includeLibido: false, includePain: true }, stored);
}

function switchHtml(on, label, pkey) {
  return `<button type="button" class="switch${on ? ' on' : ''}" role="switch" ` +
         `aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label)}" data-pkey="${pkey}"></button>`;
}

function slug(name) {
  return String(name || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

// Scoped styles for this card only (Agent A owns the CSS files; the shared
// .card / .switch / .btn classes come from app.css, the rest lives here).
const CARD_CSS = `
  .partner-card .partner-explainer { margin: 2px 0 10px; color: var(--muted); }
  .partner-card .partner-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; min-height: 44px;
  }
  .partner-card .partner-row > span { flex: 1; }
  .partner-card .partner-name-input {
    flex: 1; min-width: 0; min-height: 44px; padding: 8px 12px;
    border: 1px solid var(--border); border-radius: 12px;
    background: #fff; color: var(--text); font: inherit;
  }
  .partner-card .partner-name-input:focus { outline: 2px solid var(--accent-soft); }
  .partner-card .partner-share { width: 100%; margin-top: 10px; min-height: 44px; }
  .partner-card .partner-share[disabled] { opacity: .55; }
  .partner-card .partner-hint { margin: 8px 0 0; color: var(--cherry); font-size: 14px; }
  .partner-card .partner-small { margin: 8px 0 0; color: var(--muted); font-size: 13px; font-style: italic; }
  .partner-card .partner-status { margin: 8px 0 0; color: var(--cherry); font-size: 14px; }
`;

export default {
  id: 'partner',

  html(ctx) {
    const p = partnerSettings(ctx);
    const ready = !!(ctx && ctx.preds);
    return `<div class="card partner-card">
      <style>${CARD_CSS}</style>
      <h2 class="section-title">For your love \u{1F48C}</h2>
      <p class="partner-explainer">A private page for him that keeps itself up to date &mdash; share it once.</p>
      <label class="partner-row">
        <span>His name</span>
        <input type="text" class="partner-name-input" maxlength="40" autocomplete="off"
               placeholder="his name" value="${esc(p.name)}">
      </label>
      <div class="partner-row">
        <span>Include her high-libido window</span>
        ${switchHtml(!!p.includeLibido, 'Include her high-libido window', 'includeLibido')}
      </div>
      <div class="partner-row">
        <span>Include pain &amp; heavy-day expectations</span>
        ${switchHtml(p.includePain !== false, 'Include pain and heavy-day expectations', 'includePain')}
      </div>
      <button type="button" class="btn btn-primary partner-share"${ready ? '' : ' disabled'}>Share his page</button>
      ${ready ? '' : '<p class="partner-hint">Log a period first so the maths is real.</p>'}
      <p class="partner-small">Built fresh each time you share &mdash; only cycle averages, never your daily logs. She shares, on her terms.</p>
      <p class="partner-status" role="status" aria-live="polite"></p>
    </div>`;
  },

  wire(el, ctx) {
    const card = el && el.classList && el.classList.contains('partner-card')
      ? el
      : (el ? el.querySelector('.partner-card') : null);
    if (!card) return;

    const base = partnerSettings(ctx);
    const nameInput = card.querySelector('.partner-name-input');
    const shareBtn = card.querySelector('.partner-share');
    const statusEl = card.querySelector('.partner-status');

    const status = (msg) => { if (statusEl && statusEl.isConnected) statusEl.textContent = msg; };
    const nameNow = () => (nameInput ? nameInput.value.trim().slice(0, 40) : base.name);

    // Current toggle state read from the live DOM (base as fallback).
    const liveState = () => {
      const out = Object.assign({}, base, { name: nameNow() });
      card.querySelectorAll('.switch[data-pkey]').forEach((sw) => {
        out[sw.dataset.pkey] = sw.classList.contains('on');
      });
      return out;
    };

    // Persist helper — always includes the currently-typed name so a toggle
    // tap never wipes an un-blurred name (saveSettings re-renders the screen).
    const persist = (patch) =>
      saveSettings({ partner: Object.assign(liveState(), patch || {}) })
        .catch(() => status('Couldn’t save just now — try again.'));

    // Name: save on change only (change fires on blur; a 'data-changed'
    // re-render mid-typing would eat the input state otherwise).
    if (nameInput) {
      nameInput.addEventListener('change', () => {
        if (nameNow() !== base.name) persist();
      });
    }

    // Toggles: flip optimistically, then persist (re-render confirms).
    card.querySelectorAll('.switch[data-pkey]').forEach((sw) => {
      sw.addEventListener('click', () => {
        const on = !sw.classList.contains('on');
        sw.classList.toggle('on', on);
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        persist();
      });
    });

    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        if (!ctx || !ctx.preds) return; // button is disabled anyway
        status('');

        const p = liveState();
        let html;
        try {
          html = buildPartnerHTML(ctx.logs, ctx.settings, {
            partnerName: p.name,
            includeLibido: !!p.includeLibido,
            includePain: p.includePain !== false
          });
        } catch (e) {
          status('Log a period first so the maths is real.');
          return;
        }

        const fname = 'for-' + (slug(p.name) || 'him') + '.html';

        // Prefer the native share sheet with a real file; fall back to a
        // plain download. Every failure path lands somewhere graceful.
        try {
          if (typeof File === 'function' && navigator.canShare && navigator.share) {
            const file = new File([html], fname, { type: 'text/html' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: 'For ' + (p.name || 'him') });
              status('On its way \u{1F48C}');
              return;
            }
          }
        } catch (e) {
          if (e && e.name === 'AbortError') return; // she changed her mind — fine
          // otherwise fall through to download
        }

        try {
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
          status('Saved as ' + fname + ' — send it to him however you like.');
        } catch (e) {
          status('Sharing didn’t work — try again in a moment.');
        }
      });
    }
  }
};
