import { Engine } from './engine.js';
import { createLayers, fmt, esc } from './shared.js';
import { TASK } from './data.js';
import { mountSheet } from './sheet.js';
import { mountLens } from './lens.js';

const engine = new Engine();
const layers = createLayers(engine);
const ui = { why: new Set(), steer: new Map(), lit: null, viewVersion: null, device: 'desktop', cycle: 'monthly', tab: 'claims', lens: null };
const ctx = { engine, layers, ui };

const stage = document.getElementById('stage');
const bar = document.getElementById('bar');
let view = null;

function route() {
  const name = location.hash === '#lens' ? 'lens' : 'sheet';
  if (view && view.name === name) return;
  if (view) engine.note(`You switched to the ${name === 'lens' ? 'lens' : 'glass sheet'}`);
  // Mounting can set layers, which re-renders; keep the old view out of that render.
  view = null;
  stage.innerHTML = '';
  const next = name === 'lens' ? mountLens(stage, ctx) : mountSheet(stage, ctx);
  next.name = name;
  view = next;
  render();
}

function renderBar() {
  const E = engine;
  const name = view ? view.name : 'sheet';
  let play;
  if (!E.started) play = '<button class="btn-primary sm" data-act="start">Start</button>';
  else if (E.done) play = '<button class="bar-btn" disabled>Finished</button>';
  else if (E.waiting) play = '<button class="bar-btn" disabled>Waiting for you</button>';
  else play = `<button class="bar-btn" data-act="toggle-play">${E.playing ? 'Pause' : 'Resume'}</button>`;
  bar.innerHTML = `
    <div class="brand"><span class="mark" aria-hidden="true"></span>Veil<em>prototype</em></div>
    <nav class="seg" aria-label="Version">
      <a href="#sheet" class="${name === 'sheet' ? 'on' : ''}" aria-current="${name === 'sheet'}">Glass sheet</a>
      <a href="#lens" class="${name === 'lens' ? 'on' : ''}" aria-current="${name === 'lens'}">Lens</a>
    </nav>
    <div class="task" title="${esc(TASK.brief)}"><small>Task</small>${esc(TASK.title)}<span>for ${TASK.app}</span></div>
    <div class="playback">
      ${play}
      <button class="bar-btn" data-act="skip" ${E.done || E.waiting ? 'disabled' : ''}>Skip ahead</button>
      <button class="bar-btn" data-act="restart">Restart</button>
      <div class="seg seg--sm" role="group" aria-label="Speed">${[1, 2, 4]
        .map(s => `<button class="${E.speed === s ? 'on' : ''}" data-act="speed" data-speed="${s}">${s}×</button>`)
        .join('')}</div>
      <span class="bar-clock">${fmt(E.clock)}</span>
    </div>`;
}

function render() {
  renderBar();
  if (view) view.render();
}

engine.on(kind => {
  if (kind === 'tick') {
    // Tools and helpers change look when they finish, so redraw when that set changes.
    const sig = engine.log.filter(ev => engine.isRunning(ev)).map(ev => ev.id + (ev.type === 'subagent' ? Math.ceil(((engine.clock - ev.at) / ev.dur) * ev.steps.length) : '')).join();
    if (sig !== ctx.runningSig) {
      ctx.runningSig = sig;
      return render();
    }
    bar.querySelector('.bar-clock').textContent = fmt(engine.clock);
    view && view.tick();
    return;
  }
  render();
});
layers.on(render);

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const { act, id, choice } = b.dataset;
  switch (act) {
    case 'start':
      engine.start();
      break;
    case 'toggle-play':
      engine.playing ? engine.pause() : engine.play();
      break;
    case 'skip':
      engine.skip();
      break;
    case 'restart':
      engine.reset();
      ui.why.clear();
      ui.steer.clear();
      ui.viewVersion = null;
      ui.cycle = 'monthly';
      if (ui.lens) ui.lens.pinned = null;
      render();
      break;
    case 'speed':
      engine.setSpeed(+b.dataset.speed);
      break;
    case 'why': {
      if (ui.why.has(id)) ui.why.delete(id);
      else {
        ui.why.add(id);
        const ev = engine.byId.get(id);
        engine.note(`You asked why: "${ev.plain || ev.short || ev.text}"`);
      }
      render();
      break;
    }
    case 'steer-open':
      ui.steer.get(id) === b.dataset.card ? ui.steer.delete(id) : ui.steer.set(id, b.dataset.card);
      render();
      break;
    case 'steer':
      ui.steer.delete(id);
      engine.steer(id, choice);
      break;
    case 'answer':
      engine.answer(id, choice);
      break;
    case 'ask-check':
      engine.askCheck(id);
      break;
    case 'rung':
      layers.apply(+b.dataset.n);
      break;
    case 'lens-depth':
      view.setDepth && view.setDepth(+b.dataset.n);
      break;
    case 'layer':
      layers.set(b.dataset.key, +b.dataset.val);
      break;
    case 'version':
      ui.viewVersion = +b.dataset.v || null;
      render();
      break;
    case 'device':
      ui.device = b.dataset.device;
      engine.note(`You previewed the page on ${ui.device === 'mobile' ? 'a phone' : 'desktop'}`);
      render();
      break;
    case 'cycle':
      ui.cycle = b.dataset.cycle || (ui.cycle === 'monthly' ? 'yearly' : 'monthly');
      render();
      break;
    case 'tab':
      ui.tab = b.dataset.tab;
      render();
      break;
    case 'sheet-mode': {
      const mode = b.dataset.mode;
      const cur = ui.sheetMode || 'cover';
      if (mode === cur) break;
      if (mode === 'collapsed') ui.sheetLast = cur;
      ui.sheetMode = mode;
      engine.note({ cover: 'You laid the veil back over the work', pinned: 'You pinned the veil to the left', collapsed: 'You collapsed the veil' }[mode]);
      render();
      break;
    }
  }
});

document.addEventListener('change', e => {
  if (e.target.dataset.change === 'verify') layers.setVerify(e.target.checked);
});

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  engine.tick(Math.min(1.2, (now - last) / 1000));
  last = now;
}, 100);

window.addEventListener('hashchange', route);
route();

// For testing from the console.
window.veil = { engine, layers, ui, render };
