import {
  RUNGS, esc, fmt, clarity, visible, syncList, cardHTML, cardSig, mountTerminal, mountPreview, receiptHTML, updateDock, briefHTML,
} from './shared.js';

// Where the sheet sits: over the raw work, docked as a column on the left, or folded to a strip.
const MODES = [
  {
    id: 'cover', label: 'Cover', title: 'Lay the veil over the work',
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><rect x="3.5" y="4.5" width="9" height="7" rx="1" class="fillish"/></svg>',
  },
  {
    id: 'pinned', label: 'Pin left', title: 'Pin the veil to the left so the raw work shows beside it',
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><rect x="2.5" y="3.5" width="5" height="9" rx="1" class="fillish"/></svg>',
  },
  {
    id: 'collapsed', label: 'Collapse', title: 'Fold the veil into a strip on the left',
    icon: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.5 4 4.5 8l4 4M12.5 4l-4 4 4 4"/></svg>',
  },
];
const EXPAND_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.5 4l4 4-4 4M3.5 4l4 4-4 4"/></svg>';

// Version 1: a frosted sheet lies over the agent's raw terminal. The dial decides how
// much the sheet explains, and the more it explains, the clearer the glass gets.
export function mountSheet(root, ctx) {
  const E = ctx.engine;
  root.innerHTML = `<main class="sheet-view">
    <section class="agent-pane" aria-label="The agent's work">
      <div class="terminal" aria-hidden="true"></div>
      <div class="glass-sheet">
        <div class="sheet-head milk">
          <span class="now-dot"></span>
          <div class="now"><small>Now</small><b></b></div>
          <span class="clock"></span>
          <div class="seg seg--sm sheet-modes" role="group" aria-label="Where the veil sits"></div>
        </div>
        <div class="feed" aria-live="polite"></div>
        <div class="dial milk"></div>
        <div class="sheet-rail">
          <button class="rail-btn" data-act="sheet-mode" aria-label="Open the veil" title="Open the veil">${EXPAND_ICON}</button>
          <div class="rail-pill milk"><span class="now-dot"></span><span class="rail-label"></span><span class="rail-clock"></span></div>
          <button class="rail-btn rail-q" data-act="sheet-mode" aria-label="The agent is asking you something. Open the veil." title="The agent is asking you something" hidden>?</button>
        </div>
      </div>
      <div class="sheet-float"></div>
    </section>
    <aside class="side">
      <div class="preview-host"></div>
      <div class="receipt-host"></div>
      <div class="dock milk"></div>
    </aside>
  </main>`;

  const $ = s => root.querySelector(s);
  const view = $('.sheet-view');
  const sheet = $('.glass-sheet');
  const feed = $('.feed');
  const term = mountTerminal($('.terminal'), ctx);
  const preview = mountPreview($('.preview-host'), ctx);
  let lastAsked = null;
  let lastMode = null;

  // Hovering a card lights its raw lines under the glass.
  feed.addEventListener('mouseover', e => {
    const card = e.target.closest('[data-evt]');
    const id = card ? card.dataset.evt : null;
    if (id !== ctx.ui.lit) {
      ctx.ui.lit = id;
      term.light(id);
    }
  });
  feed.addEventListener('mouseleave', () => {
    ctx.ui.lit = null;
    term.light(null);
  });

  function nowText() {
    const L = ctx.layers.v;
    if (!E.started) return 'Waiting for the brief';
    if (E.waiting) return 'Waiting for your answer';
    if (L.verbosity >= 1 && E.status) return E.status;
    return E.done ? 'Finished' : 'Working behind the veil';
  }

  function renderHead() {
    const live = E.started && !E.done && E.playing;
    for (const el of [$('.sheet-head'), $('.rail-pill')]) {
      el.classList.toggle('is-live', live);
      el.classList.toggle('is-waiting', !!E.waiting);
    }
    $('.sheet-head b').textContent = nowText();
    $('.sheet-head .clock').textContent = fmt(E.clock);
    $('.rail-clock').textContent = fmt(E.clock);
  }

  function renderMode() {
    const mode = ctx.ui.sheetMode || 'cover';
    view.dataset.mode = mode;
    const r = RUNGS.find(x => x.n === ctx.layers.rung());
    $('.rail-label').textContent = `Veil · ${r ? r.short : 'Custom'}`;
    $('.rail-q').hidden = !E.waiting;
    $('.sheet-float').innerHTML = mode === 'collapsed' && E.waiting ? cardHTML(E.waiting, ctx) : '';
    if (mode === lastMode) return;
    lastMode = mode;
    $('.sheet-modes').innerHTML = MODES.map(
      m => `<button class="${m.id === mode ? 'on' : ''}" data-act="sheet-mode" data-mode="${m.id}" aria-pressed="${m.id === mode}" title="${m.title}">${m.icon}<span>${m.label}</span></button>`,
    ).join('');
    root.querySelectorAll('.rail-btn').forEach(b => (b.dataset.mode = ctx.ui.sheetLast || 'cover'));
  }

  function renderDial() {
    const cur = ctx.layers.rung();
    const r = RUNGS.find(x => x.n === cur);
    $('.dial').innerHTML = `<div class="dial-top">
        <span class="lbl">Veil</span>
        <b>${r ? esc(r.name) : 'Custom mix'}</b>
        <span class="dial-hint">${r ? esc(r.hint) : 'Set layer by layer'}</span>
        <button class="chip-btn ghost" data-act="tab" data-tab="layers">Fine-tune layers</button>
      </div>
      <div class="dial-track" role="radiogroup" aria-label="How much the veil shows">
        <span class="end">Frosted</span>
        <div class="stops" style="--pos:${cur ? (cur - 1) / 5 : -1}">
          <div class="rail"><div class="fill"></div></div>
          ${RUNGS.map(x => `<button role="radio" aria-checked="${x.n === cur}" class="stop${x.n === cur ? ' on' : ''}${cur && x.n < cur ? ' past' : ''}" data-act="rung" data-n="${x.n}" title="${esc(x.hint)}"><i></i><span>${esc(x.short)}</span></button>`).join('')}
        </div>
        <span class="end">Clear</span>
      </div>`;
  }

  function renderFeed() {
    const L = ctx.layers.v;
    if (!E.started) {
      syncList(feed, [{ key: 'brief', sig: 'b', html: briefHTML() }]);
      return;
    }
    const near = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
    const items = E.log
      .filter(ev => visible(ev, L))
      .map(ev => ({ key: ev.id, sig: cardSig(ev, ctx), html: cardHTML(ev, ctx) }));
    if (!items.length) {
      items.push({
        key: 'drawn',
        sig: String(E.done),
        html: `<div class="veil-note milk"><b>The veil is fully drawn.</b><span>${E.done ? 'The agent has finished. The page is on the right.' : 'The agent is working underneath. Turn the dial to see how.'}</span></div>`,
      });
    }
    syncList(feed, items);
    const asking = E.waiting && E.waiting.id;
    if (near || (asking && asking !== lastAsked)) feed.scrollTop = feed.scrollHeight;
    lastAsked = asking;
  }

  function renderFrost() {
    const c = clarity(ctx.layers.v);
    sheet.style.setProperty('--frost', `${(28 - 26 * c).toFixed(1)}px`);
    sheet.style.setProperty('--tint', (0.5 - 0.42 * c).toFixed(3));
    sheet.dataset.clear = c > 0.7 ? 'yes' : 'no';
  }

  function render() {
    renderMode();
    renderHead();
    renderDial();
    renderFeed();
    renderFrost();
    term.render();
    preview.update();
    $('.receipt-host').innerHTML = receiptHTML(E);
    updateDock($('.dock'), ctx);
  }

  function tick() {
    renderHead();
    $('.receipt-host').innerHTML = receiptHTML(E);
  }

  return { render, tick, unmount() {} };
}
