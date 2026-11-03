// Whom the live screen's drone follows (viewer design PROGRAM.md §4, the least of it for trial 3, §7-3). It only reads
// the residents as they are and what the world tells; it gives nothing back. What is going on with each one ranks it:
//   1 a moment decided, a result, a first — it thinks (ponder); a goal set, a try checked, done or failed (its own mind's
//     lines); the island's first of something; a crossing begun or ended; a try's result from the trials' screen (call)
//   2 working together or talking — a talk, the fire's gathering while someone speaks, asking, giving, telling
//   3 work under way — any other task
//   6 at rest — asleep, charging, waiting, looking out, floating (R-017's weak and empty doings), nothing to do
//   (4 the sea's shows and 5 looking back come with trial 4)
//   storms (PROGRAM.md §4, D33): Kamemaru telling of a long swell is rank 1 (once a storm); Dot hauling the raft up in a
//   hurry as a typhoon comes is rank 1 while it hauls
// The drone fleet (ADR 0010, stage 1): what it chooses is a resident's camera (01–04), and one whose camera cannot see
// its resident (visible: fleet.ts) is not chosen — a rank-1 moment waits for it while it is fresh; the one on air, hidden
// a while, is left for one that can be seen. Each passed over so is told to skip() now and then (the trial's log).
// A higher rank cuts in on a lower one, never on its own rank; a line being said is let finish, ten seconds at most. After
// a rank-1 moment the drone stays twenty seconds; on one at rest twelve seconds at most, if any other has something going
// on; on work three minutes, then the next one at work — one trying a goal of its own first. When all are at rest, each one
// awake in turn for six minutes, as before. Every change of whom it follows, and of the rank of the one followed, is told
// to cam() (the trial's log).
// The fixed cameras (stage 2, MULTICAM.md §1–2; src/live/fixed.ts): a place's camera is chosen when something happens
// there (the house, the raft, the fire, a gathering: what the world tells) — as a talk is, cutting in on work and rest,
// once a place each two minutes, held twelve seconds; a scene at a place begins with it — going to one at work or
// talking by a place from elsewhere, eight seconds of the place first; and when all are at rest, the residents awake and
// the places are gone round, 75 seconds each (MULTICAM.md §2: 60–90 s).
const ORDER = ['dot', 'rakko', 'kame', 'lantern'];
const TURN_S = 75, P1_HOLD = 20, REST_MAX = 12, WORK_TURN = 180, LINE_WAIT = 10;
const PLACE_HOLD = 12, OPEN_HOLD = 8, PLACE_GAP = 120, OPEN_GAP = 180, PLACE_FRESH = 20, HERE_M = 12;
/** Which place each kind of the world's events happens at. */
const PLACE_OF: Record<string, string> = { house: 'house', raft: 'beach', pit: 'fire', fire: 'fire', meet: 'house' };
const REST = new Set(['sleep', 'charge', 'rest', 'nap', 'float', 'idle', 'study-rest', 'study-pause', 'bask', 'groom', 'look', 'wander', 'shelter']);
const TALK = new Set(['ask', 'give', 'tell', 'say', 'answer']);
// (the world's events that are rank 1: a first; in its own mind, a goal set or a try's end; a crossing)
const MIND1 = /^[^：]+：(目的|確かめた|違っていた|やりとげた|うまくいかなかった)：/;

export interface DirectorCtx {
  residents(): any | null;
  watched(): any | null;
  watch(r: any): void;
  speaking(): boolean;   // (a line is up on the screen now)
  cam?(who: string, pri: number, kind: string, why: string): void;
  visible?(r: any): boolean;   // (its camera sees it: fleet.ts — none given, all are)
  skip?(who: string, pri: number, why: string): void;   // (passed over, its camera not seeing it: for the log)
  places?(): { subj: { id: string; place: string; no: string }; at: { lx: number; lz: number } }[];   // (the fixed cameras there now)
}
const SKIP_EVERY = 60, HIDDEN_LEAVE = 3;

export const awake = (r: any) => r.act !== 'sleep' && r.task?.kind !== 'sleep' && !(r.task?.kind === 'voyage' && r.task.data?.started);   // (asleep, or away at sea: not followed)

export function rank(R: any, r: any): { pri: number; kind: string } {
  if (!r || !awake(r)) return { pri: 6, kind: 'asleep' };
  const k = r.task?.kind ?? '';
  if (k === 'ponder') return { pri: 1, kind: 'thinking' };
  if (k === 'haul' && r.task.data?.quick) return { pri: 1, kind: 'storm' };
  if (r.talk || (k === 'fire' && r.task.arrived && R.list.some((x: any) => x.saying && x.task?.kind === 'fire'))) return { pri: 2, kind: r.talk ? 'talk' : 'fire' };
  if (TALK.has(k)) return { pri: 2, kind: k };
  if (!k || REST.has(k)) return { pri: 6, kind: k || 'idle' };
  return { pri: 3, kind: k };
}

export function makeDirector(ctx: DirectorCtx) {
  // (its own reckoning: who it is on, why and since when; rank-1 moments waiting their turn)
  let shot = { id: '', pri: 6, kind: '', since: 0, hold: 0, after: null as null | { n: any; pri: number; kind: string; why: string } }, clock = 0, turn = 0, dirT = 0;
  // (the places: when each was last on, what has happened at each)
  const placeAt: Record<string, number> = {}, placeCalls: { id: string; at: number; why: string }[] = [];
  const places = () => ctx.places?.() ?? [];
  const placeNear = (r: any) => (r?.pos ? places().find((p) => Math.hypot(r.pos.x - p.at.lx, r.pos.z - p.at.lz) <= HERE_M) ?? null : null);
  const calls: { id: string; kind: string; why: string; at: number }[] = [];
  const call = (r: any, kind: string, why: string) => { if (r?.id && ORDER.includes(r.id)) { calls.push({ id: r.id, kind, why: why.slice(0, 80), at: clock }); if (calls.length > 12) calls.shift(); } };
  const ownGoal = (R: any, r: any) => { const g = R.mind?.(r)?.goal; return !!g && g.by !== 'habit'; };
  // (its camera sees it; one passed over for not being seen, told now and then)
  const skipped: Record<string, number> = {};
  const can = (r: any, pri = 3) => {
    if (!r || !ctx.visible || ctx.visible(r)) return true;
    if (clock - (skipped[r.id] ?? -1e9) >= SKIP_EVERY) { skipped[r.id] = clock; ctx.skip?.(r.id, pri, 'hidden'); }
    return false;
  };
  let hiddenFor = 0;
  function next(R: any) {
    // (the round: the residents awake, then the places)
    const now = ctx.watched(), seq: any[] = [...ORDER.map((id) => R.list.find((x: any) => x.id === id)).filter((r: any) => r && awake(r)), ...places().map((p) => p.subj)];
    const i = now ? seq.findIndex((x) => x.id === now.id) : -1;
    for (let k = 1; k <= seq.length; k++) { const r = seq[(i + k) % seq.length]; if (r && (r.place || r === now || can(r))) return r; }
    return now ?? R.list.find((x: any) => x.id === 'dot');
  }
  function follow(n: any, pri: number, kind: string, why: string, open = true) {
    const was = ctx.watched();
    // (a scene at a place, come to from elsewhere: the place first, then the one there)
    const p = open && !n.place && pri > 1 ? placeNear(n) : null;
    if (p && was?.id !== p.subj.id && !(was && !was.place && placeNear(was)?.subj.id === p.subj.id) && clock - (placeAt[p.subj.id] ?? -1e9) >= OPEN_GAP) {
      placeAt[p.subj.id] = clock; ctx.watch(p.subj); ctx.cam?.(p.subj.id, pri, 'place', `場所から：${why}`);
      shot = { id: p.subj.id, pri, kind: 'place', since: clock, hold: clock + OPEN_HOLD, after: { n, pri, kind, why } }; turn = TURN_S; return;
    }
    if (n !== was) ctx.watch(n);
    if (n !== was || shot.id !== n.id) ctx.cam?.(n.id, pri, kind, why);
    if (n.place) placeAt[n.id] = clock;
    shot = { id: n.id, pri, kind, since: clock, hold: pri === 1 ? clock + P1_HOLD : n.place && kind === 'place' ? clock + PLACE_HOLD : 0, after: null }; turn = TURN_S;
  }
  function direct(R: any) {
    const r = ctx.watched();
    if (!r) { const n = next(R); if (n) { const k = rank(R, n); follow(n, k.pri, k.kind, 'start'); } return; }
    // (the one on air, its camera not seeing it a while: as if at rest, so another that can be seen is gone to)
    hiddenFor = !r.place && ctx.visible && !ctx.visible(r) ? hiddenFor + 0.5 : 0;
    if (shot.id !== r.id) { shot = { id: r.id, pri: r.place ? 6 : rank(R, r).pri, kind: r.place ? 'place' : rank(R, r).kind, since: clock, hold: 0, after: null }; turn = TURN_S; }   // (followed by another hand: its turn begins now)
    // (a place on air: while its time lasts, only a rank-1 moment cuts in; after it, the one it opened on, else as one at rest)
    const placeHeld = !!r.place && shot.hold > clock, held = !r.place && shot.hold > clock;
    if (r.place && !placeHeld && shot.after) { const a = shot.after; shot.after = null; follow(a.n, a.pri, a.kind, a.why, false); return; }
    const cur = held ? { pri: 1, kind: shot.kind } : r.place ? { pri: placeHeld ? 2 : 6, kind: 'place' } : rank(R, r);
    // (rank 1: what has just happened, or one starting to think — the line being said let finish, ten seconds at most)
    while (calls.length && clock - calls[0].at > 30) calls.shift();
    const live = R.list.filter((x: any) => awake(x));
    const thinking = live.find((x: any) => x !== r && x.task?.kind === 'ponder'), hauling = live.find((x: any) => x !== r && x.task?.kind === 'haul' && x.task.data?.quick);
    const c = calls.find((x) => x.id !== r.id || !held);
    const p1 = c ? { r: R.list.find((x: any) => x.id === c.id), kind: c.kind, why: c.why, call: c } : thinking ? { r: thinking, kind: 'thinking', why: '考え始めた', call: null }
      : hauling ? { r: hauling, kind: 'storm', why: '台風が来て、急いで筏を引き上げている', call: null } : null;
    if (p1?.r && p1.r !== r && awake(p1.r) && cur.pri > 1 && can(p1.r, 1)) {
      if (!ctx.speaking() || (p1.call ? clock - p1.call.at : 0) > LINE_WAIT) { if (p1.call) calls.splice(calls.indexOf(p1.call), 1); follow(p1.r, 1, p1.kind, p1.why); return; }
      return;   // (waiting for the line to end)
    }
    if (p1?.r === r && p1.call) { calls.splice(calls.indexOf(p1.call), 1); shot.hold = clock + P1_HOLD; shot.kind = p1.kind; shot.pri = 1; ctx.cam?.(r.id, 1, p1.kind, p1.why); return; }   // (on it already: it stays)
    if (held || placeHeld) return;
    // (something happened at a place: its camera, as a talk cuts in — not on a line being said; once a place each two minutes)
    while (placeCalls.length && clock - placeCalls[0].at > PLACE_FRESH) placeCalls.shift();
    const pc = cur.pri > 2 && !ctx.speaking() ? placeCalls.find((c) => c.id !== r.id && clock - (placeAt[c.id] ?? -1e9) >= PLACE_GAP && places().some((p) => p.subj.id === c.id)) : null;
    if (pc) { placeCalls.splice(placeCalls.indexOf(pc), 1); follow(places().find((p) => p.subj.id === pc.id)!.subj, 2, 'place', pc.why); return; }
    // (rank 2 cuts in on 3 and 6: two at work together, talking, at the fire)
    if (cur.pri > 2) { const t = live.find((x: any) => x !== r && rank(R, x).pri === 2 && can(x, 2)); if (t) { const k = rank(R, t); follow(t, 2, k.kind, k.kind === 'talk' ? '話している' : k.kind === 'fire' ? '焚き火の会' : '頼み・知らせ'); return; } }
    // (at rest: twelve seconds, if another has something going on; at work: three minutes — one trying a goal of its own first)
    const best = () => live.filter((x: any) => x !== r && rank(R, x).pri <= 3 && can(x)).sort((a: any, b: any) => rank(R, a).pri - rank(R, b).pri || Number(ownGoal(R, b)) - Number(ownGoal(R, a)))[0];
    if ((cur.pri === 6 && clock - shot.since >= REST_MAX) || (cur.pri === 3 && clock - shot.since >= WORK_TURN) || hiddenFor >= HIDDEN_LEAVE) {
      const b = best(); if (b) { const k = rank(R, b); follow(b, k.pri, k.kind, hiddenFor >= HIDDEN_LEAVE ? '見えなくなった' : ownGoal(R, b) ? '試みの途中' : '仕事の途中'); hiddenFor = 0; return; }
    }
    if (cur.pri !== shot.pri) ctx.cam?.(r.id, cur.pri, cur.kind, '同じ住人の、していることが変わった');   // (the same one, its rank changed: for the time each rank is on screen)
    if (cur.pri !== shot.pri || cur.kind !== shot.kind) { shot.pri = cur.pri; shot.kind = cur.kind; }
    // (all at rest, or the one followed gone to sleep: as before, the next one awake)
    if ((turn <= 0 && cur.pri >= 6) || (!r.place && !awake(r) && turn < TURN_S - 30)) {
      const n = next(R);
      if (n && n !== r) { const k = n.place ? { pri: 6, kind: 'place' } : rank(R, n); follow(n, k.pri, k.kind, r.place || awake(r) ? 'じゅんばん' : '眠った', false); } else turn = TURN_S;
    }
  }
  return {
    /** Each frame: the drone's reckoning, twice a second. */
    tick(dt: number) { const R = ctx.residents(); if (!R) return; turn -= dt; clock += dt; if ((dirT -= dt) <= 0) { dirT = 0.5; direct(R); } },
    /** What the world tells (residents' onEvent), ranked. */
    event(kind: string, text: string, r: any, meta?: { milestone?: string }) {
      if (meta?.milestone) call(r, 'first', text);
      else if (kind === 'mind' && MIND1.test(text)) call(r, /目的/.test(text.split('：')[1]) ? 'decided' : 'result', text);
      else if (kind === 'map' || kind === 'sail' || kind === 'raft') call(r, 'crossing', text);
      else if (kind === 'weather' && /長いうねりに気づいた/.test(text)) call(r, 'storm', text);
      // (at a place: its camera may be chosen — the world's own event, at the place it happens)
      const pl = PLACE_OF[kind]; if (pl && !meta?.milestone) { placeCalls.push({ id: pl, at: clock, why: text.slice(0, 80) }); if (placeCalls.length > 8) placeCalls.shift(); }
    },
    /** A try's result, from the trials' screen (PROGRAM.md §1): rank 1. */
    trial(r: any, outcome: string, text: string) { call(r, `result:${outcome}`, text); },
  };
}
