import { fmt } from './engine.js';
import { TASK, RECEIPT, SAVINGS } from './data.js';

export { fmt };

export const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The six rungs and six layers come from the Agent Veil playground, renamed for designers.
export const RUNGS = [
  { n: 1, name: 'Just the result', short: 'Result', hint: 'Only the finished page', set: { verbosity: 0, thinking: 0, summary: 0, full: 0, subagents: 0, versions: 0 } },
  { n: 2, name: 'Progress', short: 'Progress', hint: 'One-line status updates', set: { verbosity: 1, thinking: 0, summary: 0, full: 0, subagents: 0, versions: 1 } },
  { n: 3, name: 'Commentary', short: 'Commentary', hint: "The agent's running commentary", set: { verbosity: 3, thinking: 0, summary: 0, full: 0, subagents: 1, versions: 1 } },
  { n: 4, name: 'Commentary and actions', short: 'Actions', hint: 'Plus every action and how it went', set: { verbosity: 3, thinking: 0, summary: 1, full: 0, subagents: 1, versions: 1 } },
  { n: 5, name: 'Commentary and thinking', short: 'Thinking', hint: 'Plus its reasoning, without the actions', set: { verbosity: 3, thinking: 1, summary: 0, full: 0, subagents: 1, versions: 1 } },
  { n: 6, name: 'Everything', short: 'Everything', hint: 'Thinking, actions and the raw output', set: { verbosity: 3, thinking: 1, summary: 1, full: 1, subagents: 2, versions: 2 } },
];

export const LAYERS = [
  { key: 'verbosity', name: "What it's saying", was: 'Verbosity', stops: ['Off', 'Quiet', 'Terse', 'Standard', 'Verbose'], desc: 'Quiet shows status lines only. Terse shortens the commentary.' },
  { key: 'thinking', name: "What it's thinking", was: 'Thinking', stops: ['Off', 'On'], desc: 'Its reasoning, sorted into plan, observation, self-correction and decision.' },
  { key: 'summary', name: "What it's doing", was: 'Summarized tool calls', stops: ['Off', 'On'], desc: 'Each action in plain words, and whether it worked.' },
  { key: 'full', name: 'The raw work', was: 'Full tool output', stops: ['Off', 'On'], desc: 'The exact command and everything it returned.' },
  { key: 'subagents', name: 'Who it asked for help', was: 'Subagents', stops: ['Off', 'Summary', 'Full'], desc: 'Work handed to helper agents.' },
  { key: 'versions', name: 'How the page changed', was: 'Artifact versions', stops: ['Off', 'Latest', 'All'], desc: 'Off keeps the page hidden until the agent finishes.' },
];

export const KEY_NAMES = {
  toggle: 'The billing switch',
  badge: 'The savings badge',
  price: 'The prices',
  cards: 'The plan cards',
  copy: 'The plan descriptions',
};

const KIND_NAMES = { plan: 'Plan', observation: 'Observation', 'self-correction': 'Self-correction', decision: 'Decision' };

export function createLayers(engine) {
  const v = { ...RUNGS[2].set, verify: false };
  const listeners = new Set();
  const layers = {
    v,
    on: fn => listeners.add(fn),
    rung() {
      const r = RUNGS.find(r => Object.entries(r.set).every(([k, val]) => v[k] === val));
      return r ? r.n : 0;
    },
    apply(n, why) {
      const before = layers.rung();
      Object.assign(v, RUNGS[n - 1].set);
      if (before !== n) engine.note(why || `Veil set to "${RUNGS[n - 1].name}"`);
      listeners.forEach(fn => fn());
    },
    set(key, val) {
      const def = LAYERS.find(l => l.key === key);
      if (v[key] === val) return;
      engine.note(`${def.name}: ${def.stops[v[key]]} → ${def.stops[val]}`);
      v[key] = val;
      listeners.forEach(fn => fn());
    },
    setVerify(on) {
      v.verify = on;
      engine.note(`Claim marks on the cards: ${on ? 'on' : 'off'}`);
      listeners.forEach(fn => fn());
    },
    sig: () => JSON.stringify(v),
  };
  return layers;
}

// How clear the glass is, 0 (frosted) to 1 (clear), from what the layers reveal.
export function clarity(L) {
  return Math.min(1, (L.verbosity / 4) * 0.15 + L.thinking * 0.2 + L.summary * 0.2 + L.full * 0.3 + (L.subagents / 2) * 0.075 + (L.versions / 2) * 0.075);
}

export function visible(ev, L) {
  switch (ev.type) {
    case 'status': return L.verbosity >= 1;
    case 'say': return L.verbosity >= 2;
    case 'think': return L.thinking >= 1;
    case 'tool': return L.summary >= 1 || L.full >= 1;
    case 'subagent': return L.subagents >= 1;
    case 'artifact': return L.versions >= 2;
    case 'question': return true;
    default: return false;
  }
}

// The shallowest rung that shows this kind of event, for "turn deeper" hints.
export function rungFor(ev) {
  const n = { status: 2, say: 3, subagent: 3, tool: 4, think: 5, artifact: 6, question: 1 }[ev.type] || 6;
  return RUNGS[n - 1];
}

export function typeName(ev) {
  return {
    status: 'a status update',
    say: "the agent's commentary",
    think: "the agent's thinking",
    tool: 'an action',
    subagent: "a helper's work",
    artifact: 'a new version of the page',
    question: 'a question for you',
  }[ev.type];
}

// Keyed list update: rebuilds only the items whose signature changed.
export function syncList(container, items) {
  const existing = new Map([...container.children].map(el => [el.dataset.k, el]));
  const keep = new Set();
  let prev = null;
  for (const it of items) {
    let el = existing.get(it.key);
    if (!el || el.dataset.sig !== it.sig) {
      const t = document.createElement('template');
      t.innerHTML = it.html.trim();
      const fresh = t.content.firstElementChild;
      fresh.dataset.k = it.key;
      fresh.dataset.sig = it.sig;
      if (!el) fresh.classList.add('is-new');
      if (el) el.replaceWith(fresh);
      el = fresh;
    }
    keep.add(it.key);
    const want = prev ? prev.nextElementSibling : container.firstElementChild;
    if (el !== want) container.insertBefore(el, want);
    prev = el;
  }
  for (const [k, el] of existing) if (!keep.has(k)) el.remove();
}

/* ---------- cards: what the veil says, in plain words ---------- */

const CRACK = `<svg class="crack" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
  <g class="crack-dark"><path d="M318 0 L306 26 L326 44 L300 70 L314 96 L292 140"/><path d="M306 26 L270 34 L238 20 L214 28"/><path d="M326 44 L366 58 L400 50"/><path d="M300 70 L258 82 L222 74 L190 90"/><path d="M314 96 L352 112 L378 140"/></g>
  <g class="crack-light"><path d="M319 1 L307 27 L327 45 L301 71 L315 97 L293 140"/><path d="M307 27 L271 35 L239 21"/><path d="M301 71 L259 83 L223 75"/></g>
</svg>`;

export function whyHTML(ev, E) {
  const src = E.byId.get(ev.from);
  if (!src) return '';
  if (src.type === 'question') {
    const opt = src.options.find(o => o.id === src.answer);
    return `<div class="why"><span class="lbl">Why</span><p>Because you answered “${esc(opt?.label)}” to “${esc(src.text)}”</p></div>`;
  }
  return `<div class="why"><span class="lbl">Why · its thinking, step ${src.step} · ${KIND_NAMES[src.kind]}</span><p>${esc(src.text)}</p></div>`;
}

// ui.steer maps a decision to the card its options were opened on, so they open in one place.
function decisionHTML(ev, ui, cardId) {
  const d = ev.decision;
  if (d.chosen) {
    const o = d.options.find(x => x.id === d.chosen);
    return `<div class="decision is-chosen"><span class="lbl">You redirected this</span><p><s>${esc(d.made)}</s> → <b>${esc(o.label)}</b></p></div>`;
  }
  if (ui.steer.get(ev.id) === cardId) {
    return `<div class="decision is-open"><span class="lbl">What should it do instead?</span>
      ${d.options.map(o => `<button class="opt" data-act="steer" data-id="${ev.id}" data-choice="${o.id}"><b>${esc(o.label)}</b><span>${esc(o.detail)}</span></button>`).join('')}
      <button class="chip-btn ghost" data-act="steer-open" data-id="${ev.id}" data-card="${cardId}">Keep it as is</button></div>`;
  }
  return cardId === ev.id ? `<div class="decision"><span class="lbl">Decision</span><p>${esc(d.made)}</p></div>` : '';
}

function steerButton(ev, ui, cardId) {
  const d = ev.decision;
  if (!d || d.chosen || ui.steer.get(ev.id) === cardId) return '';
  return `<button class="chip-btn steer" data-act="steer-open" data-id="${ev.id}" data-card="${cardId}">Not that</button>`;
}

const STATUS_LABEL = {
  checked: ['ok', '✓ Checked'],
  fixed: ['ok', '↻ Fixed after a failed check'],
  failed: ['bad', '✕ Check failed'],
  unchecked: ['warn', '⚠ Not checked'],
  checking: ['warn', '… Checking now'],
};

function claimChips(ev, E) {
  return `<div class="claim-chips">${ev.claims
    .map(t => {
      const c = E.claims.get(t.id);
      if (!c) return '';
      const [tone, label] = STATUS_LABEL[E.claimStatus(c).state];
      return `<span class="claim-chip ${tone}" title="${esc(c.text)}">${label}</span>`;
    })
    .join('')}</div>`;
}

export function cardHTML(ev, ctx) {
  const { engine: E, ui } = ctx;
  const L = ctx.layers.v;
  const time = `<time>${fmt(ev.at)}</time>`;
  const running = E.isRunning(ev);
  const whyOpen = ui.why.has(ev.id);
  const whyBtn = ev.from ? `<button class="chip-btn" data-act="why" data-id="${ev.id}" aria-expanded="${whyOpen}">${whyOpen ? 'Hide why' : 'Why?'}</button>` : '';
  const why = whyOpen ? whyHTML(ev, E) : '';
  const gone = ev.superseded ? ' is-superseded' : '';
  const goneNote = ev.superseded ? '<p class="gone-note">Undone after you redirected it</p>' : '';

  switch (ev.type) {
    case 'status':
      return `<div class="statusline" data-evt="${ev.id}"><i></i><span>${esc(ev.text)}</span>${time}</div>`;

    case 'say': {
      const text = L.verbosity === 2 ? ev.short || ev.text : ev.text;
      const more = L.verbosity >= 4 && ev.more ? `<p class="more">${esc(ev.more)}</p>` : '';
      const claims = L.verify && ev.claims ? claimChips(ev, E) : '';
      const unchecked = ev.claims?.some(t => E.claims.get(t.id) && E.claimStatus(E.claims.get(t.id)).state === 'unchecked');
      const foot = whyBtn + steerButton(ev, ui, ev.id);
      return `<article class="card card--say${L.verify && unchecked ? ' is-unchecked' : ''}" data-evt="${ev.id}">
        <header><span class="tag">Said</span>${time}</header>
        <p class="said">${esc(text)}</p>${more}${claims}
        ${ev.decision ? decisionHTML(ev, ui, ev.id) : ''}${why}
        ${foot ? `<footer>${foot}</footer>` : ''}
      </article>`;
    }

    case 'think': {
      const dEv = ev.decisionOf && E.byId.get(ev.decisionOf);
      const steer = dEv ? steerButton(dEv, ui, ev.id) : '';
      const dState = dEv ? decisionHTML(dEv, ui, ev.id) : '';
      return `<article class="card card--think kind-${ev.kind}" data-evt="${ev.id}">
        <header><span class="tag">Thinking · step ${ev.step} · ${KIND_NAMES[ev.kind]}</span>${time}</header>
        <p class="thought">${esc(ev.text)}</p>${dState}
        ${steer ? `<footer>${steer}</footer>` : ''}
      </article>`;
    }

    case 'tool': {
      const fail = !running && ev.ok === false;
      const tag = ev.check ? `Check · ${ev.tool}` : `Did · ${ev.tool}`;
      const result = running
        ? '<p class="result running">Working…</p>'
        : `<p class="result ${fail ? 'bad' : ev.check ? 'ok' : ''}">${fail ? '✕' : ev.check ? '✓' : '→'} ${esc(ev.result)}</p>`;
      const summary = L.summary ? `<p class="plain">${esc(ev.plain)}</p>${result}` : '';
      const raw = L.full ? `<pre class="raw"><b>$ ${esc(ev.cmd)}</b>${running ? '\n…' : ev.out ? '\n' + esc(ev.out) : ''}</pre>` : '';
      return `<article class="card card--tool${fail ? ' is-fail' : ''}${running ? ' is-running' : ''}${gone}" data-evt="${ev.id}">
        ${fail ? CRACK : ''}
        <header><span class="tag">${fail ? 'Check failed · ' + esc(ev.tool) : tag}</span>${time}</header>
        ${summary}${raw}${goneNote}${why}
        ${whyBtn ? `<footer>${whyBtn}</footer>` : ''}
      </article>`;
    }

    case 'subagent': {
      const shown = running ? Math.max(1, Math.ceil(((E.clock - ev.at) / ev.dur) * ev.steps.length)) : ev.steps.length;
      const steps =
        L.subagents >= 2
          ? `<ol class="substeps">${ev.steps
              .slice(0, shown)
              .map(s =>
                s.type === 'think'
                  ? `<li class="sub-think"><span>Thinking</span>${esc(s.text)}</li>`
                  : `<li><span>${esc(s.tool)}</span>${esc(s.plain)} <em>→ ${esc(s.result)}</em>${L.full ? `<pre class="raw"><b>$ ${esc(s.cmd)}</b>\n${esc(s.out)}</pre>` : ''}</li>`,
              )
              .join('')}</ol>`
          : '';
      return `<article class="card card--sub${running ? ' is-running' : ''}" data-evt="${ev.id}">
        <header><span class="tag">Helper · ${esc(ev.name)}</span>${time}</header>
        <p class="plain">Asked to: ${esc(ev.task)}</p>
        <p class="result ${running ? 'running' : ''}">${running ? 'Working…' : '→ ' + esc(ev.summary)}</p>${steps}
      </article>`;
    }

    case 'artifact':
      return `<article class="card card--art${gone}" data-evt="${ev.id}">
        <header><span class="tag">Page · version ${ev.v}</span>${time}</header>
        <p class="plain">${esc(ev.label)}</p>${goneNote}
        <footer><button class="chip-btn" data-act="version" data-v="${ev.v}">View this version</button></footer>
      </article>`;

    case 'question': {
      const opt = ev.answer && ev.options.find(o => o.id === ev.answer);
      return `<article class="card card--q${opt ? '' : ' is-waiting'}" data-evt="${ev.id}">
        <header><span class="tag">The agent is asking you</span>${time}</header>
        <p class="q">${esc(ev.text)}</p>
        <p class="qwhy">${esc(ev.why)}</p>
        ${
          opt
            ? `<p class="answered">You chose <b>${esc(opt.label)}</b></p>`
            : `<div class="q-opts">${ev.options.map(o => `<button class="opt" data-act="answer" data-id="${ev.id}" data-choice="${o.id}"><b>${esc(o.label)}</b></button>`).join('')}</div>`
        }
      </article>`;
    }
  }
  return '';
}

export function cardSig(ev, ctx) {
  const { engine: E, ui } = ctx;
  const parts = [ev.rev, E.isRunning(ev) ? 'r' : '', ctx.layers.sig(), ui.why.has(ev.id) ? 'w' : '', ui.steer.get(ev.id) || ''];
  if (ev.decisionOf) {
    const d = E.byId.get(ev.decisionOf);
    parts.push(d ? `${d.rev}${ui.steer.get(d.id) || ''}` : '-');
  }
  if (ev.type === 'subagent' && E.isRunning(ev)) parts.push(Math.ceil(((E.clock - ev.at) / ev.dur) * ev.steps.length));
  if (ev.claims) parts.push(ev.claims.map(t => { const c = E.claims.get(t.id); return c ? E.claimStatus(c).state : ''; }).join());
  return parts.join('|');
}

/* ---------- the raw terminal under the glass ---------- */

function termBlock(ev, E) {
  const running = E.isRunning(ev);
  const out = (text, cls = '') =>
    String(text)
      .split('\n')
      .map((line, i) => `<div class="tl tl-out ${cls} ${line.startsWith('✕') ? 'is-bad' : line.startsWith('✓') ? 'is-good' : ''}">${i ? '   ' : '  ⎿ '}${esc(line)}</div>`)
      .join('');
  let html = '';
  switch (ev.type) {
    case 'status':
      html = `<div class="tl tl-status">· ${esc(ev.text)}</div>`;
      break;
    case 'say':
      html = `<div class="tl tl-say">⏺ ${esc(ev.text)}</div>`;
      break;
    case 'think':
      html = `<div class="tl tl-think">✻ ${esc(ev.text)}</div>`;
      break;
    case 'tool':
      html = `<div class="tl tl-tool">⏺ <b>${esc(ev.tool)}</b>(${esc(ev.cmd)})</div>${running ? out('running…', 'is-dim') : ev.out ? out(ev.out) : out('(no output)', 'is-dim')}`;
      break;
    case 'subagent': {
      html = `<div class="tl tl-tool">⏺ <b>Task</b>(${esc(ev.name)}: ${esc(ev.task)})</div>`;
      const shown = running ? Math.max(1, Math.ceil(((E.clock - ev.at) / ev.dur) * ev.steps.length)) : ev.steps.length;
      for (const s of ev.steps.slice(0, shown)) {
        html += s.type === 'think' ? `<div class="tl tl-think tl-sub">  ✻ ${esc(s.text)}</div>` : `<div class="tl tl-tool tl-sub">  ⏺ <b>${esc(s.tool)}</b>(${esc(s.cmd)})</div>`;
      }
      if (!running) html += out(ev.summary);
      break;
    }
    case 'artifact':
      html = `<div class="tl tl-art">◆ preview → v${ev.v}: ${esc(ev.label)}</div>`;
      break;
    case 'question':
      html = `<div class="tl tl-q">? ${esc(ev.text)}</div>${ev.options.map((o, i) => `<div class="tl tl-out is-dim">   ${i + 1}. ${esc(o.label)}</div>`).join('')}${
        ev.answer ? `<div class="tl tl-out is-good">  ⎿ user chose: ${esc(ev.options.find(o => o.id === ev.answer).label)}</div>` : '<div class="tl tl-out is-dim">  ⎿ waiting for the user…</div>'
      }`;
      break;
  }
  return `<div class="tb${ev.superseded ? ' is-superseded' : ''}" data-evt="${ev.id}">${html}</div>`;
}

export function mountTerminal(el, ctx) {
  const E = ctx.engine;
  el.innerHTML = `<div class="term-inner"><div class="tl tl-prompt"><b>lumen</b> % agent "${esc(TASK.brief)}"</div><div class="term-lines"></div><div class="tl tl-cursor">▍</div></div>`;
  const inner = el.querySelector('.term-inner');
  const lines = el.querySelector('.term-lines');
  let lit = null;
  function render() {
    syncList(
      lines,
      E.log.map(ev => ({
        key: ev.id,
        sig: [ev.rev, E.isRunning(ev) ? 'r' : '', ev.superseded ? 'x' : '', ev.type === 'subagent' && E.isRunning(ev) ? Math.ceil(((E.clock - ev.at) / ev.dur) * ev.steps.length) : ''].join('|'),
        html: termBlock(ev, E),
      })),
    );
    if (lit) light(lit, false);
    else inner.scrollTop = inner.scrollHeight;
  }
  function light(id, scroll = true) {
    lit = id;
    lines.querySelectorAll('.is-lit').forEach(x => x.classList.remove('is-lit'));
    if (!id) {
      inner.scrollTo({ top: inner.scrollHeight, behavior: 'smooth' });
      return;
    }
    const b = lines.querySelector(`[data-k="${CSS.escape(id)}"]`);
    if (!b) return;
    b.classList.add('is-lit');
    if (scroll) inner.scrollTo({ top: b.offsetTop - inner.clientHeight / 2 + b.offsetHeight / 2, behavior: 'smooth' });
  }
  return { render, light };
}

/* ---------- the page the agent is building ---------- */

const PLANS = [
  { id: 'free', name: 'Free', monthly: 0, copy: 'For trying Lumen on your own.', cta: 'Start free', feats: ['1 project', 'Community help'] },
  { id: 'pro', name: 'Pro', monthly: 15, copy: 'For people who ship every week.', cta: 'Start with Pro', feats: ['Unlimited projects', 'Version history', 'Priority help'], pop: true },
  { id: 'team', name: 'Team', monthly: 29, copy: 'For teams who review together.', cta: 'Start with Team', feats: ['Everything in Pro', 'Shared reviews', 'Roles and SSO'] },
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function priceText(plan, P, cycle) {
  const v = P.yearly && cycle === 'yearly' ? (plan.monthly * 10) / 12 : plan.monthly;
  if (P.format === 'fixed') return v === 0 ? '$0' : money.format(v);
  return '$' + v;
}

function switchHTML(P, cycle) {
  const y = cycle === 'yearly';
  switch (P.toggle) {
    case 'new':
      return `<button class="pp-billing${y ? ' is-y' : ''}" data-act="cycle" aria-pressed="${y}"><span>Monthly</span><i><b></b></i><span>Yearly</span></button>`;
    case 'segmented':
      return `<div class="pp-seg" role="group" aria-label="Billing"><button class="${y ? '' : 'on'}" data-act="cycle" data-cycle="monthly">Monthly</button><button class="${y ? 'on' : ''}" data-act="cycle" data-cycle="yearly">Yearly</button></div>`;
    case 'switch':
      return `<label class="pp-toggle"><button class="pp-sw${y ? ' on' : ''}" role="switch" aria-checked="${y}" data-act="cycle"><i></i></button>Bill yearly</label>`;
    default:
      return '';
  }
}

export function pageHTML(P, ui, flags = new Set()) {
  const cycle = ui.cycle;
  const flag = k => (flags.has(k) ? ' has-flag' : '');
  const badge = P.badge && SAVINGS[P.badge] ? `<span class="pp-badge${flag('badge')}" data-key="badge">${SAVINGS[P.badge]}</span>` : '';
  const plans = PLANS.map(
    p => `<div class="pp-plan${p.pop ? ' is-pop' : ''}">
      ${p.pop ? '<span class="pp-pop">Most popular</span>' : ''}
      <h3>${p.name}</h3>
      <p class="pp-desc${flag('copy')}" data-key="copy">${P.copy ? p.copy : 'Lorem ipsum dolor sit amet.'}</p>
      <div class="pp-price${flag('price')}" data-key="price"><b>${priceText(p, P, cycle)}</b><span>/ month</span></div>
      <p class="pp-note">${p.monthly === 0 ? 'Free forever' : P.yearly && cycle === 'yearly' ? `Billed $${p.monthly * 10} yearly` : 'Billed monthly'}</p>
      <button class="pp-cta">${p.cta}</button>
      <ul>${p.feats.map(f => `<li>${f}</li>`).join('')}</ul>
    </div>`,
  ).join('');
  return `<div class="pp${P.mobileFix ? ' fix' : ''}">
    <nav class="pp-nav"><span class="pp-logo"><i></i>Lumen</span><span class="pp-links"><a>Product</a><a>Docs</a><a class="on">Pricing</a></span><span class="pp-sign">Sign in</span></nav>
    <header class="pp-hero"><h1>Simple pricing</h1><p>Start free. Upgrade when your team does.</p></header>
    ${
      P.cards
        ? `${P.toggle !== 'none' ? `<div class="pp-switchrow${flag('toggle')}" data-key="toggle">${switchHTML(P, cycle)}${badge}</div>` : ''}
           <div class="pp-plans${flag('cards')}" data-key="cards">${plans}</div>`
        : '<div class="pp-empty">Nothing built yet</div>'
    }
  </div>`;
}

export function pageFlags(E) {
  const f = new Set();
  const dec = E.log.find(ev => ev.decision && !ev.decision.chosen);
  if (dec) dec.touches.forEach(k => f.add(k));
  for (const c of E.claims.values()) {
    if (E.claimStatus(c).state === 'unchecked') E.byId.get(c.by)?.touches?.forEach(k => f.add(k));
  }
  for (const { f: failed, passedBy } of E.failedChecks()) if (!passedBy) failed.touches?.forEach(k => f.add(k));
  return f;
}

export function mountPreview(host, ctx, opts = {}) {
  const E = ctx.engine;
  host.innerHTML = `<div class="browser">
    <div class="browser-bar">
      <span class="dots"><i></i><i></i><i></i></span>
      <span class="url">lumen.app/pricing</span>
      <div class="seg seg--sm device" role="group" aria-label="Screen size">
        <button data-act="device" data-device="desktop">Desktop</button><button data-act="device" data-device="mobile">Phone</button>
      </div>
    </div>
    <div class="vbanner" hidden></div>
    <div class="viewport"><div class="pp-sizer"><div class="pp-frame"></div></div></div>
    <div class="versions" hidden></div>
    <div class="page-veil" hidden><div><b>The page is behind the veil</b><span>It appears when the agent finishes.</span></div></div>
  </div>`;
  const viewport = host.querySelector('.viewport');
  const frame = host.querySelector('.pp-frame');
  const versions = host.querySelector('.versions');
  const banner = host.querySelector('.vbanner');
  const pageVeil = host.querySelector('.page-veil');
  let lastSig = '';

  function scale() {
    const mobile = ctx.ui.device === 'mobile';
    const w = mobile ? 390 : 1200;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    // A phone stays readable in a short frame: it scrolls rather than shrinking past 0.55.
    const s = mobile ? Math.min(1, (vw - 40) / w, Math.max(0.55, (vh - 24) / 760)) : vw / w;
    frame.style.width = w + 'px';
    frame.style.transform = `scale(${s})`;
    frame.style.left = mobile ? `${(vw - w * s) / 2}px` : '0px';
    frame.style.top = mobile ? '12px' : '0px';
    frame.parentElement.style.height = frame.offsetHeight * s + (mobile ? 24 : 0) + 'px';
  }
  new ResizeObserver(scale).observe(viewport);

  function update() {
    const L = ctx.layers.v;
    const v = ctx.ui.viewVersion && E.versions[ctx.ui.viewVersion - 1] ? ctx.ui.viewVersion : null;
    const P = v ? E.versions[v - 1].snapshot : E.state.page;
    const flags = opts.flags ? opts.flags() : new Set();
    const sig = JSON.stringify([P, ctx.ui.cycle, ctx.ui.device, [...flags]]);
    host.querySelector('.browser').dataset.device = ctx.ui.device;
    host.querySelectorAll('.device button').forEach(b => b.classList.toggle('on', b.dataset.device === ctx.ui.device));
    if (sig !== lastSig) {
      lastSig = sig;
      frame.innerHTML = pageHTML(P, ctx.ui, flags);
      frame.classList.toggle('is-mobile', ctx.ui.device === 'mobile');
      scale();
    }
    banner.hidden = !v;
    if (v) banner.innerHTML = `Viewing version ${v} of ${E.versions.length}: ${esc(E.versions[v - 1].label)} <button data-act="version" data-v="0">Back to latest</button>`;
    const showVersions = L.versions >= 2 && E.versions.length > 0;
    versions.hidden = !showVersions;
    if (showVersions) {
      const cur = v || E.versions.length;
      versions.innerHTML = `<span class="lbl">Versions</span>${E.versions
        .map(x => `<button class="vdot${x.v === cur ? ' on' : ''}${x.superseded ? ' gone' : ''}" data-act="version" data-v="${x.v === E.versions.length ? 0 : x.v}" title="v${x.v}: ${esc(x.label)}">${x.v}</button>`)
        .join('')}`;
    }
    pageVeil.hidden = !(L.versions === 0 && !E.done);
  }
  return { update, el: host };
}

/* ---------- receipt, claims, change log, layers ---------- */

export function receiptHTML(E) {
  return `<div class="receipt" aria-label="Receipt">
    <span><small>Model</small>${RECEIPT.model}</span>
    <span><small>Effort</small>${RECEIPT.effort}</span>
    <span><small>Tokens</small>${E.tokens.toLocaleString()}</span>
    <span><small>Cost so far</small>$${((E.tokens / 1000) * RECEIPT.pricePerK).toFixed(2)}</span>
    <span><small>Time</small>${fmt(E.clock)}</span>
  </div>`;
}

function claimRow(c, E) {
  const st = E.claimStatus(c);
  const [tone, label] = STATUS_LABEL[st.state];
  let body = '';
  if (st.checks.length) {
    body = st.checks
      .map(x => `<li class="${x.ok ? 'ok' : 'bad'}"><span>${x.ok ? '✓' : '✕'} ${esc(x.plain)}</span><time>${fmt(x.at)}</time><em>${esc(x.result)}</em></li>`)
      .join('');
    body = `<ul class="checks">${body}</ul>`;
  } else {
    const near = c.nearMiss && E.byId.get(c.nearMiss);
    body = `<p class="nocheck">Nothing checked this.${near ? ` The only check nearby: “${esc(near.plain)}”.` : ''}</p>`;
    if (c.fix && !c.asked) body += `<button class="chip-btn steer" data-act="ask-check" data-id="${c.id}">Ask it to check</button>`;
  }
  return `<div class="claim ${tone}"><div class="claim-top"><q>${esc(c.text)}</q><time>${fmt(c.at)}</time></div><span class="claim-chip ${tone}">${label}</span>${body}</div>`;
}

export function claimsPanel(E, onlyKey) {
  let claims = [...E.claims.values()];
  if (onlyKey) claims = claims.filter(c => E.byId.get(c.by)?.touches?.includes(onlyKey));
  const failed = onlyKey ? [] : E.failedChecks();
  if (!claims.length && !failed.length) {
    return onlyKey ? '' : '<p class="empty">No claims yet. When the agent says something is done or works, it appears here next to the check behind it, and how that check went.</p>';
  }
  const states = claims.map(c => E.claimStatus(c).state);
  const ok = states.filter(s => s === 'checked' || s === 'fixed').length;
  const sum = onlyKey ? '' : `<p class="sum">${claims.length} claim${claims.length === 1 ? '' : 's'} · ${ok} checked · ${claims.length - ok} not checked</p>`;
  const fails = failed.length
    ? `<h4>Checks that failed</h4>${failed
        .map(
          ({ f, passedBy }) =>
            `<div class="claim bad"><div class="claim-top"><q>${esc(f.result)}</q><time>${fmt(f.at)}</time></div><p class="nocheck">${
              passedBy ? `Fixed, then passed: “${esc(passedBy.plain)}” at ${fmt(passedBy.at)}.` : 'Not passed yet.'
            }</p></div>`,
        )
        .join('')}`
    : '';
  return sum + claims.map(c => claimRow(c, E)).join('') + fails;
}

export function changesPanel(E) {
  if (!E.changes.length) return '<p class="empty">Everything you reveal, ask or redirect is logged here with the run time.</p>';
  return `<ol class="changes">${E.changes
    .slice()
    .reverse()
    .map(c => `<li><time>${fmt(c.at)}</time><span>${esc(c.text)}</span></li>`)
    .join('')}</ol>`;
}

export function layersPanel(layers, opts = {}) {
  const L = layers.v;
  const cur = layers.rung();
  const rungs = (opts.rungs || RUNGS)
    .map(r => `<button class="rung${r.n === cur ? ' on' : ''}" data-act="${opts.rungAct || 'rung'}" data-n="${r.n}" title="${esc(r.hint)}"><b>${r.n}</b>${esc(r.name)}</button>`)
    .join('');
  const rows = LAYERS.map(
    l => `<div class="layer">
      <div class="lname">${l.name}<small>${l.was}</small></div>
      <div class="seg seg--sm" role="group" aria-label="${esc(l.name)}">${l.stops
        .map((s, i) => `<button class="${L[l.key] === i ? 'on' : ''}" data-act="layer" data-key="${l.key}" data-val="${i}">${s}</button>`)
        .join('')}</div>
      <p class="ldesc">${l.desc}</p>
    </div>`,
  ).join('');
  return `${opts.intro ? `<p class="sum">${opts.intro}</p>` : ''}<div class="rungs">${rungs}</div>${rows}
    <label class="verify"><input type="checkbox" data-change="verify" ${L.verify ? 'checked' : ''}> Mark claims on the cards as checked or not</label>`;
}

export function dockHTML(ctx, opts = {}) {
  const E = ctx.engine;
  const tab = ctx.ui.tab;
  const n = E.claims.size + E.failedChecks().length;
  const tabs = [
    ['claims', `Claims vs checks${n ? ` <i>${n}</i>` : ''}`],
    ['log', `Change log${E.changes.length ? ` <i>${E.changes.length}</i>` : ''}`],
    ['layers', 'Layers'],
  ];
  const body = tab === 'claims' ? claimsPanel(E) : tab === 'log' ? changesPanel(E) : layersPanel(ctx.layers, opts.layers);
  return `<div class="tabs" role="tablist">${tabs
    .map(([id, label]) => `<button role="tab" aria-selected="${tab === id}" data-act="tab" data-tab="${id}">${label}</button>`)
    .join('')}</div><div class="tabbody" data-tab="${tab}">${body}</div>`;
}

// Re-renders the dock but keeps the reader's scroll position in the open tab.
export function updateDock(el, ctx, opts) {
  const body = el.querySelector('.tabbody');
  const keep = body && body.dataset.tab === ctx.ui.tab ? body.scrollTop : 0;
  const html = dockHTML(ctx, opts);
  if (html === el._last) return;
  el._last = html;
  el.innerHTML = html;
  el.querySelector('.tabbody').scrollTop = keep;
}

export function briefHTML() {
  return `<div class="brief milk">
    <span class="lbl">Brief for the agent</span>
    <p class="brief-text">${esc(TASK.brief)}</p>
    <p class="brief-sub">A simulated coding agent will build this for ${TASK.app}, a made-up app. The veil decides how much of its work you see while it does.</p>
    <button class="btn-primary" data-act="start">Start the agent</button>
  </div>`;
}
