import {
  RUNGS, KEY_NAMES, fmt, visible, rungFor, typeName, cardHTML, mountTerminal, mountPreview, receiptHTML, updateDock, briefHTML,
  pageFlags, claimsPanel,
} from './shared.js';

// Version 2: the whole window is frosted. A glass lens you drag around shows what is
// underneath wherever it sits, and turning it (scroll, or + and −) looks deeper.
const R = 100;
const LENS_BLUR = { 2: 7, 3: 5, 4: 3, 5: 1.5, 6: 0 };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export function mountLens(root, ctx) {
  const E = ctx.engine;
  const ui = ctx.ui;
  root.innerHTML = `<main class="lens-view">
    <div class="terminal terminal--lens" aria-hidden="true"></div>
    <div class="frost"></div>
    <div class="lens-left">
      <div class="lens-status milk"><span class="now-dot"></span><div class="now"><small>Now</small><b></b></div><span class="clock"></span></div>
      <div class="lens-q"></div>
      <div class="lens-dock">
        <div class="receipt-host"></div>
        <div class="dock milk"></div>
      </div>
    </div>
    <section class="lens-page"><div class="preview-host"></div></section>
    <div class="lens" tabindex="0" role="group" aria-label="Lens. Drag it over the page or the frosted glass to see underneath. Plus and minus change how deep it looks.">
      <div class="lens-sheen"></div>
      <button class="lens-btn minus" data-lens="-1" aria-label="Look shallower">−</button>
      <button class="lens-btn plus" data-lens="1" aria-label="Look deeper">+</button>
      <div class="lens-depth"></div>
    </div>
    <div class="lens-hint milk">Drag the lens over the page or the frosted glass.<br>Scroll on it, or press + and −, to look deeper.</div>
    <div class="callout milk" hidden></div>
    <div class="lens-brief"></div>
  </main>`;

  const $ = s => root.querySelector(s);
  const view = $('.lens-view');
  const lens = $('.lens');
  const callout = $('.callout');
  const term = mountTerminal($('.terminal'), ctx);
  const preview = mountPreview($('.preview-host'), ctx, { flags: () => pageFlags(E) });
  let target = null;
  let lastCallout = '';

  if (!ui.lens) ui.lens = { x: null, y: null, depth: 4, pinned: null, moved: false };
  ctx.layers.apply(ui.lens.depth, `Lens turned to "${RUNGS[ui.lens.depth - 1].name}"`);

  function place(x, y) {
    const w = view.clientWidth;
    const h = view.clientHeight;
    ui.lens.x = Math.max(R * 0.4, Math.min(w - R * 0.4, x));
    ui.lens.y = Math.max(R * 0.4, Math.min(h - R * 0.4, y));
    view.style.setProperty('--lx', ui.lens.x + 'px');
    view.style.setProperty('--ly', ui.lens.y + 'px');
    requestAnimationFrame(probe);
  }

  function depth(d) {
    const n = Math.max(2, Math.min(6, ui.lens.depth + d));
    if (n === ui.lens.depth) return;
    ui.lens.depth = n;
    ctx.layers.apply(n, `Lens turned to "${RUNGS[n - 1].name}"`);
  }

  // Dragging
  let drag = null;
  lens.addEventListener('pointerdown', e => {
    if (e.target.closest('.lens-btn')) return;
    const vr = view.getBoundingClientRect();
    drag = { dx: e.clientX - vr.left - ui.lens.x, dy: e.clientY - vr.top - ui.lens.y };
    lens.setPointerCapture(e.pointerId);
    lens.classList.add('is-drag');
  });
  lens.addEventListener('pointermove', e => {
    if (!drag) return;
    const vr = view.getBoundingClientRect();
    if (!ui.lens.moved) {
      ui.lens.moved = true;
      $('.lens-hint').hidden = true;
    }
    place(e.clientX - vr.left - drag.dx, e.clientY - vr.top - drag.dy);
  });
  const end = () => {
    drag = null;
    lens.classList.remove('is-drag');
  };
  lens.addEventListener('pointerup', end);
  lens.addEventListener('pointercancel', end);

  let wheel = 0;
  lens.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      wheel += e.deltaY;
      if (Math.abs(wheel) > 70) {
        depth(wheel > 0 ? 1 : -1);
        wheel = 0;
      }
    },
    { passive: false },
  );
  lens.addEventListener('click', e => {
    const b = e.target.closest('[data-lens]');
    if (b) depth(+b.dataset.lens);
  });
  lens.addEventListener('keydown', e => {
    const step = e.shiftKey ? 60 : 24;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      place(ui.lens.x + moves[e.key][0], ui.lens.y + moves[e.key][1]);
    } else if (e.key === '+' || e.key === '=') depth(1);
    else if (e.key === '-') depth(-1);
  });
  callout.addEventListener('click', e => {
    if (!e.target.closest('[data-lpin]')) return;
    ui.lens.pinned = ui.lens.pinned ? null : target && { kind: target.kind, key: target.key, id: target.id };
    E.note(ui.lens.pinned ? 'You pinned the lens' : 'You unpinned the lens');
    E.emit();
  });

  // What is under the centre of the lens?
  function probe() {
    const vr = view.getBoundingClientRect();
    const els = document.elementsFromPoint(vr.left + ui.lens.x, vr.top + ui.lens.y);
    let t = null;
    const onPage = els.find(el => el.closest('.lens-page'));
    if (onPage) {
      const keyEl = els.map(el => el.closest('.lens-page [data-key]')).find(Boolean);
      if (keyEl) t = { kind: 'page', key: keyEl.dataset.key, el: keyEl };
    } else if (!els.some(el => el.closest('.lens-left > *, .callout'))) {
      const tb = els.map(el => el.closest('.tb[data-evt]')).find(Boolean);
      if (tb) t = { kind: 'term', id: tb.dataset.evt, el: tb };
    }
    setTarget(t);
  }

  function setTarget(t) {
    view.querySelectorAll('.is-lensed').forEach(x => x.classList.remove('is-lensed'));
    target = t;
    if (t) t.el.classList.add('is-lensed');
    lens.style.setProperty('--lens-blur', (t && t.kind === 'page' ? 0 : LENS_BLUR[ui.lens.depth]) + 'px');
    lens.dataset.over = t ? t.kind : 'none';
    renderCallout();
  }

  function calloutBody(t) {
    const L = ctx.layers.v;
    const pin = `<button class="chip-btn ghost" data-lpin>${ui.lens.pinned ? 'Unpin' : 'Pin'}</button>`;
    if (t.kind === 'page') {
      const evs = E.log.filter(ev => ev.touches?.includes(t.key));
      const shown = evs.filter(ev => visible(ev, L)).reverse();
      const hidden = evs.length - shown.length;
      const dec = evs.find(ev => ev.decision && !ev.decision.chosen);
      const claims = claimsPanel(E, t.key);
      let html = `<header><div><small>Underneath</small><b>${KEY_NAMES[t.key]}</b></div>${pin}</header>`;
      if (dec && !visible(dec, L)) html += '<p class="hint">The agent made a decision here. Turn the lens to Commentary to see it and redirect it.</p>';
      if (claims) html += `<div class="callout-claims">${claims}</div>`;
      html += shown.slice(0, 3).map(ev => cardHTML(ev, ctx)).join('');
      if (shown.length > 3) html += `<p class="hint">and ${shown.length - 3} earlier step${shown.length - 3 === 1 ? '' : 's'} at this depth</p>`;
      if (!shown.length && !claims) {
        html += `<p class="hint">${evs.length ? `${evs.length} step${evs.length === 1 ? '' : 's'} touched this, but none show at this depth. Turn the lens deeper.` : 'Nothing has touched this yet.'}</p>`;
      } else if (hidden > 0) html += `<p class="hint">${hidden} more step${hidden === 1 ? '' : 's'} sit deeper than this.</p>`;
      return html;
    }
    const ev = E.byId.get(t.id);
    if (!ev) return '';
    let html = `<header><div><small>This line, in plain words</small><b>${cap(typeName(ev))}</b></div>${pin}</header>`;
    html += visible(ev, L) ? cardHTML(ev, ctx) : `<p class="hint">This is ${typeName(ev)}. Turn the lens to ${rungFor(ev).name} to read it in plain words.</p>`;
    return html;
  }

  function renderCallout() {
    const pinned = ui.lens.pinned;
    const t = pinned || target;
    const html = t ? calloutBody(t) : '';
    callout.hidden = !html;
    callout.classList.toggle('is-pinned', !!pinned);
    if (html !== lastCallout) {
      lastCallout = html;
      callout.innerHTML = html;
    }
    if (!html || pinned) return;
    const w = view.clientWidth;
    const h = view.clientHeight;
    const cw = callout.offsetWidth;
    const ch = callout.offsetHeight;
    const right = ui.lens.x + R + 22;
    const x = right + cw < w - 12 ? right : ui.lens.x - R - 22 - cw;
    callout.style.left = Math.max(12, x) + 'px';
    callout.style.top = Math.max(12, Math.min(h - ch - 12, ui.lens.y - ch / 2)) + 'px';
  }

  function renderStatus() {
    const s = $('.lens-status');
    let now;
    if (!E.started) now = 'Waiting for the brief';
    else if (E.waiting) now = 'Waiting for your answer';
    else now = E.status || (E.done ? 'Finished' : 'Working');
    s.querySelector('b').textContent = now;
    s.classList.toggle('is-live', E.started && !E.done && E.playing);
    s.classList.toggle('is-waiting', !!E.waiting);
    s.querySelector('.clock').textContent = fmt(E.clock);
  }

  function render() {
    renderStatus();
    term.render();
    preview.update();
    $('.receipt-host').innerHTML = receiptHTML(E);
    updateDock($('.dock'), ctx, { layers: { rungs: RUNGS.slice(1), rungAct: 'lens-depth', intro: 'The lens shows these layers wherever you hold it. The rest of the window stays at Progress.' } });
    $('.lens-q').innerHTML = E.waiting ? cardHTML(E.waiting, ctx) : '';
    $('.lens-brief').innerHTML = E.started ? '' : briefHTML();
    $('.lens-depth').innerHTML = `<small>Depth ${ui.lens.depth - 1} of 5</small>${RUNGS[ui.lens.depth - 1].short}`;
    lens.style.setProperty('--depth', (ui.lens.depth - 2) / 4);
    $('.lens-hint').hidden = ui.lens.moved;
    probe();
  }

  function tick() {
    renderStatus();
    $('.receipt-host').innerHTML = receiptHTML(E);
  }

  // Start the lens in the open frost between the status bar and the dock.
  const vr = view.getBoundingClientRect();
  const top = $('.lens-status').getBoundingClientRect().bottom - vr.top;
  const bottom = $('.lens-dock').getBoundingClientRect().top - vr.top;
  place(ui.lens.x ?? $('.lens-left').offsetWidth / 2 + 18, ui.lens.y ?? (top + bottom) / 2);
  return {
    render,
    tick,
    setDepth(n) {
      depth(n - ui.lens.depth);
    },
    unmount() {},
  };
}
