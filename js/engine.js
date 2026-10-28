import { SCRIPT, INITIAL_PAGE, toggleSegment, mobileSegment } from './data.js';

// Seconds of run time after each kind of event before the next one plays.
const GAP = { status: 0.9, say: 1.7, think: 2.1, tool: 0.6, artifact: 1.0, question: 0.4, subagent: 0.8 };
const RESOLVED = ['text', 'short', 'more', 'plain', 'cmd', 'out', 'result', 'label', 'patch'];

export function fmt(t) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Replays the scripted run on a clock. Steering inserts new events at the cursor,
// so whatever the designer changes plays out next, in order.
export class Engine {
  constructor() {
    this.listeners = new Set();
    this.speed = 1;
    this.reset();
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(kind = 'change') {
    for (const fn of this.listeners) fn(kind);
  }

  reset() {
    this.state = { toggle: 'new', savings: null, flags: {}, page: { ...INITIAL_PAGE } };
    this.queue = SCRIPT.slice();
    this.cursor = 0;
    this.log = [];
    this.byId = new Map();
    this.clock = 0;
    this.nextAt = 0.4;
    this.started = false;
    this.playing = false;
    this.waiting = null;
    this.done = false;
    this.tokens = 0;
    this.steps = 0;
    this.versions = [];
    this.claims = new Map();
    this.changes = [];
    this.uid = 0;
  }

  note(text) {
    this.changes.push({ at: this.clock, text });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.playing = true;
    this.note('You gave the agent the brief');
    this.emit();
  }

  play() {
    if (!this.started) return this.start();
    if (this.done || this.waiting) return;
    this.playing = true;
    this.emit();
  }

  pause() {
    this.playing = false;
    this.emit();
  }

  setSpeed(n) {
    this.speed = n;
    this.emit();
  }

  tick(dt) {
    if (!this.playing || this.waiting || this.done) return;
    this.clock += dt * this.speed;
    let changed = false;
    while (!this.waiting && this.cursor < this.queue.length && this.clock >= this.nextAt) {
      if (this.playNext()) changed = true;
    }
    if (!this.waiting && this.cursor >= this.queue.length && this.clock >= this.nextAt) {
      this.done = true;
      this.playing = false;
      changed = true;
    }
    this.emit(changed ? 'change' : 'tick');
  }

  // Plays straight through to the next question, or to the end.
  skip() {
    if (!this.started) {
      this.started = true;
      this.note('You gave the agent the brief');
    }
    while (!this.waiting && this.cursor < this.queue.length) {
      this.clock = Math.max(this.clock, this.nextAt);
      this.playNext();
    }
    if (!this.waiting) {
      this.clock = Math.max(this.clock, this.nextAt);
      this.done = true;
      this.playing = false;
    } else {
      this.playing = true;
    }
    this.emit();
  }

  resolve(tpl) {
    const ev = { ...tpl };
    for (const k of RESOLVED) if (typeof ev[k] === 'function') ev[k] = ev[k](this.state);
    if (!ev.id || this.byId.has(ev.id)) ev.id = `${ev.id || 'x'}_${++this.uid}`;
    return ev;
  }

  playNext() {
    const tpl = this.queue[this.cursor++];
    if (tpl.if && !tpl.if(this.state)) return false;
    const ev = this.resolve(tpl);
    ev.at = this.nextAt;
    ev.seq = this.log.length;
    ev.rev = 0;
    if (ev.type === 'think') ev.step = ++this.steps;
    this.tokens += ev.tokens || 0;
    if (ev.type === 'artifact') {
      Object.assign(this.state.page, ev.patch);
      ev.v = this.versions.length + 1;
      ev.snapshot = { ...this.state.page };
      this.versions.push(ev);
    }
    if (tpl.effect) tpl.effect(this.state);
    if (ev.claims) for (const c of ev.claims) this.claims.set(c.id, { ...c, by: ev.id, at: ev.at });
    if (ev.resolves) {
      const c = this.claims.get(ev.resolves.claim);
      if (c) Object.assign(c, { checkedBy: ev.resolves.checkedBy, resolvedAt: ev.at });
    }
    if (ev.decision) ev.decision = { ...ev.decision, chosen: null };
    if (ev.type === 'question') {
      ev.answer = null;
      this.waiting = ev;
    }
    this.log.push(ev);
    this.byId.set(ev.id, ev);
    this.nextAt = ev.at + (ev.dur || 0) + (ev.gap ?? GAP[ev.type] ?? 1);
    return true;
  }

  isRunning(ev) {
    return !!ev.dur && this.clock < ev.at + ev.dur;
  }

  answer(qid, optId) {
    const q = this.byId.get(qid);
    if (!q || q.type !== 'question' || q.answer) return;
    q.answer = optId;
    q.rev++;
    this.state[q.key] = optId;
    const opt = q.options.find(o => o.id === optId);
    this.note(`You answered "${q.text}" with "${opt.label}"`);
    this.waiting = null;
    this.nextAt = Math.max(this.nextAt, this.clock + 0.4);
    this.playing = true;
    this.emit();
  }

  // The designer rejects a decision; the agent undoes it and takes the chosen route.
  steer(evId, choice) {
    const ev = this.byId.get(evId);
    const d = ev && ev.decision;
    if (!d || d.chosen) return;
    d.chosen = choice;
    ev.rev++;
    for (const x of this.log) {
      if (x.assumes === d.key && x.seq > ev.seq) {
        x.superseded = true;
        x.rev++;
      }
      if (x.decisionOf === evId) x.rev++;
    }
    this.state[d.key] = choice;
    const opt = d.options.find(o => o.id === choice);
    this.note(`You redirected "${d.made}" to "${opt.label}"`);
    this.insert(toggleSegment(this.state, choice));
  }

  askCheck(claimId) {
    const c = this.claims.get(claimId);
    if (!c || c.asked || c.fix !== 'mobile') return;
    c.asked = true;
    c.askedAt = this.clock;
    this.note(`You asked it to check "${c.text}"`);
    this.insert(mobileSegment(this.state));
  }

  insert(events) {
    const wasDone = this.done;
    this.queue.splice(this.cursor, 0, ...events);
    if (wasDone) this.queue.push({ type: 'status', text: 'Done: the pricing page is ready', tokens: 100 });
    this.done = false;
    this.nextAt = Math.max(this.nextAt, this.clock + 0.5);
    if (this.started && !this.waiting) this.playing = true;
    this.emit();
  }

  get status() {
    for (let i = this.log.length - 1; i >= 0; i--) if (this.log[i].type === 'status') return this.log[i].text;
    return null;
  }

  // checked: every check passed. fixed: a check failed, a later one passed.
  claimStatus(c) {
    const checks = c.checkedBy.map(id => this.byId.get(id)).filter(Boolean);
    if (!checks.length) return { state: c.asked ? 'checking' : 'unchecked', checks };
    const last = checks[checks.length - 1];
    if (checks.every(x => x.ok)) return { state: 'checked', checks };
    return { state: last.ok ? 'fixed' : 'failed', checks };
  }

  failedChecks() {
    return this.log
      .filter(ev => ev.type === 'tool' && ev.check && ev.ok === false)
      .map(f => ({
        f,
        passedBy: this.log.find(
          g => g.seq > f.seq && g.type === 'tool' && g.check && g.ok && g.touches?.some(k => f.touches?.includes(k)) && g.tool === f.tool,
        ),
      }));
  }
}
