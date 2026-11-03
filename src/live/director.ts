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
// The fixed cameras (stage 2, MULTICAM.md §1–2 and §2-1; src/live/fixed.ts): a place's camera is chosen
//   - for a first of the island's at a place: its card's eight seconds on the place, then the one whose first it is (a
//     change with no card — a piece put on — is as work, rank 3: below)
//   - for a gathering (the fire's, the morning's): the house's wide shot, as long as it lasts
//   - at a scene's beginning: going to one at work or talking by a place from elsewhere, eight seconds of the place first
//   - on long work by a place: the place and the one at work in turn, 35 seconds each (30–40 s)
//   - when all are at rest: the residents awake and the places in turn, 75 seconds each (60–90 s)
// never from one place's camera straight to another's.
// The day's timed sights (TRIAL6.md §1-2, sights.ts): one on a camera of its own — the dawn and the sunset on the beach's
// (07) or from above the island (13), the island round from above — is rank 4, as the sea's shows, but gone to in its
// time over anything below rank 2 (a line being said let finish, ten seconds at most), and only ranks 1 and 2 cut in on
// it. One cut in on is gone back to while its time lasts; the island round, the camera's alone, is then over for the day.
// The round keeps its three minutes; the dawn and the sunset their time. Then the next, as after one at rest. One starting
// to think, or on its way to ask, give or tell (not yet talking), neither keeps a sight waiting nor cuts in on it: what
// "このあと" promised comes at its time (viewer design on #243). How each ended — its time done, cut in on (by what), or
// never on air in its time — is told for the trial's log.
import type { SightId } from './sights';

const ORDER = ['dot', 'rakko', 'kame', 'lantern'];
const TURN_S = 75, P1_HOLD = 20, REST_MAX = 12, WORK_TURN = 180, LINE_WAIT = 10;
const PLACE_HOLD = 12, OPEN_HOLD = 8, OPEN_GAP = 180, HERE_M = 12, ALT_S = 35;
/** Which place's camera shows each first's card (by the first's key — world/milestones.ts — not the event's kind; viewer
 *  design on #241): what stands at the house or is made at its shelf → 06; the raft's → 07; the pots fired → 08. The rest
 *  (the clay pit, the sail woven and the mast cut elsewhere, the crossings, the fibre and the rope) have none. */
const FIRST_PLACE: Record<string, string> = { hut: 'house', 'house-roof': 'house', 'house-walls': 'house', house: 'house', wall: 'house', light: 'house',
  'cook-pot': 'house', retort: 'house', 'weather-pot': 'house', raft: 'beach', rig: 'beach', lash: 'beach', 'fired-pot': 'fire' };
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
  sight?(): { id: SightId; key: string; subj: any } | null;   // (a camera's timed sight in its time now, and the camera for it: sights.ts, main.ts)
  sightEnd?(id: string, how: 'done' | 'cut' | 'missed', why: string): void;   // (how a sight ended: for the trial's log)
}
const SIGHT_PRI = 4, ROUND_S = 180;
/** What a timed sight neither waits for nor is cut in on (viewer design on #243): one starting to think, one on its way to
 *  ask, give or tell — not yet talking. A real rank 1 (a moment decided, a result, a first) and a talk or a gathering
 *  cut in on it as ever. */
const soft = (kind: string) => kind === 'thinking' || TALK.has(kind);
/** A camera's own subject — a place's (06–09) or the sky's (13) — not a resident. */
const camera = (r: any) => !!(r?.place || r?.sky);
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
  let shot = { id: '', pri: 6, kind: '', since: 0, scene: 0, hold: 0, after: null as null | { n: any; pri: number; kind: string; why: string; scene: number } }, clock = 0, turn = 0, dirT = 0;
  // (the places: when each was last on, what has happened at each)
  const placeAt: Record<string, number> = {};
  const places = () => ctx.places?.() ?? [];
  const placeNear = (r: any) => (r?.pos ? places().find((p) => Math.hypot(r.pos.x - p.at.lx, r.pos.z - p.at.lz) <= HERE_M) ?? null : null);
  const calls: { id: string; kind: string; why: string; at: number; place?: string }[] = [];
  const call = (r: any, kind: string, why: string, place?: string) => { if (r?.id && ORDER.includes(r.id)) { calls.push({ id: r.id, kind, why: why.slice(0, 80), at: clock, place }); if (calls.length > 12) calls.shift(); } };
  const ownGoal = (R: any, r: any) => { const g = R.mind?.(r)?.goal; return !!g && g.by !== 'habit'; };
  // (its camera sees it; one passed over for not being seen, told now and then)
  const skipped: Record<string, number> = {};
  const can = (r: any, pri = 3) => {
    if (!r || !ctx.visible || ctx.visible(r)) return true;
    if (clock - (skipped[r.id] ?? -1e9) >= SKIP_EVERY) { skipped[r.id] = clock; ctx.skip?.(r.id, pri, 'hidden'); }
    return false;
  };
  let hiddenFor = 0;
  // (the timed sight on air, or last on air before what cut in on it; those over for the day; a line waited for)
  let sightShot: null | { id: SightId; key: string; subj: any; at: number } = null, sightWait = 0, dueKey = '';
  const over = new Set<string>(), aired = new Set<string>();
  function sightGo(s: { id: SightId; key: string; subj: any }, why: string) {
    if (ctx.watched() !== s.subj) ctx.watch(s.subj);
    ctx.cam?.(s.subj.id, SIGHT_PRI, 'sight', why);
    sightShot = { ...s, at: clock }; aired.add(s.key);
    shot = { id: s.subj.id, pri: SIGHT_PRI, kind: 'sight', since: clock, scene: clock, hold: 0, after: null }; turn = TURN_S;
  }
  function next(R: any) {
    // (the residents awake with the places between them — never from a place straight to a place)
    const now = ctx.watched(), res: any[] = ORDER.map((id) => R.list.find((x: any) => x.id === id)).filter((r: any) => r && awake(r)), pl = places().map((p) => p.subj), seq: any[] = [];
    for (let k = 0; k < Math.max(res.length, pl.length); k++) { if (res[k]) seq.push(res[k]); if (pl[k]) seq.push(pl[k]); }
    const i = now ? seq.findIndex((x) => x.id === now.id) : -1;
    for (let k = 1; k <= seq.length; k++) { const r = seq[(i + k) % seq.length]; if (r && (r.place ? !now?.place : r === now || can(r))) return r; }
    return now ?? R.list.find((x: any) => x.id === 'dot');
  }
  /** A place's camera on air for a while, then the one it is about (the opening of a scene, a first's card, long work). */
  function placeThen(p: { subj: any }, n: any, pri: number, kind: string, why: string, hold: number, scene = clock) {
    placeAt[p.subj.id] = clock;
    if (ctx.watched() !== p.subj) ctx.watch(p.subj);
    ctx.cam?.(p.subj.id, pri, 'place', why);
    shot = { id: p.subj.id, pri, kind: 'place', since: clock, scene, hold: clock + hold, after: { n, pri, kind, why, scene } }; turn = TURN_S;
  }
  function follow(n: any, pri: number, kind: string, why: string, open = true, scene = clock) {
    const was = ctx.watched();
    // (one at a gathering — the fire's, the morning's: the house's wide shot instead, the ring's heads in it)
    if (!n.place && kind === 'fire') { const home = places().find((p) => p.subj.id === 'house'); if (home) { n = home.subj; kind = 'gather'; why = '集まり'; } }
    // (a scene at a place, come to from elsewhere — not from another place's camera: the place first, then the one there)
    const p = open && !n.place && pri > 1 && !was?.place ? placeNear(n) : null;
    if (p && !(was && placeNear(was)?.subj.id === p.subj.id) && clock - (placeAt[p.subj.id] ?? -1e9) >= OPEN_GAP) { placeThen(p, n, pri, kind, `場所から：${why}`, OPEN_HOLD); return; }
    if (n !== was) ctx.watch(n);
    if (n !== was || shot.id !== n.id) ctx.cam?.(n.id, pri, kind, why);
    if (n.place) placeAt[n.id] = clock;
    shot = { id: n.id, pri, kind, since: clock, scene, hold: pri === 1 ? clock + P1_HOLD : n.place && (kind === 'place' || kind === 'gather') ? clock + PLACE_HOLD : 0, after: null }; turn = TURN_S;
  }
  function direct(R: any) {
    const r = ctx.watched();
    if (!r) { const n = next(R); if (n) { const k = rank(R, n); follow(n, k.pri, k.kind, 'start'); } return; }
    // (the one on air, its camera not seeing it a while: as if at rest, so another that can be seen is gone to)
    hiddenFor = !camera(r) && ctx.visible && !ctx.visible(r) ? hiddenFor + 0.5 : 0;
    if (shot.id !== r.id) { shot = { id: r.id, pri: camera(r) ? 6 : rank(R, r).pri, kind: r.place ? 'place' : r.sky ? 'sky' : rank(R, r).kind, since: clock, scene: clock, hold: 0, after: null }; turn = TURN_S; }   // (followed by another hand: its turn begins now)
    // (a timed sight on air, its time over — the round's three minutes, the dawn's or the sunset's window: the next, as
    // after one at rest; cut in on: the round over for the day, the dawn and the sunset gone back to while they last)
    const s = ctx.sight?.() ?? null; if (!s) sightWait = 0;
    // (a sight's time gone by with it never on air: told)
    if (dueKey && dueKey !== s?.key) { if (!aired.has(dueKey)) ctx.sightEnd?.(dueKey.split(':')[0], 'missed', '時刻のうちに出なかった'); dueKey = ''; }
    if (s && !aired.has(s.key) && !over.has(s.key)) dueKey = s.key;
    const onSight = !!sightShot && shot.kind === 'sight' && r === sightShot.subj;
    if (onSight) {
      const ss = sightShot!;
      if (ss.id === 'round' ? clock - ss.at >= ROUND_S : s?.key !== ss.key) {
        over.add(ss.key); sightShot = null; ctx.sightEnd?.(ss.id, 'done', ss.id === 'round' ? '3分見せた' : '時刻が終わった');
        const nx = next(R), n = nx && nx !== r ? nx : R.list.find((x: any) => x.id === 'dot');   // (none else awake: back to Dot, as at night)
        if (n) { const k = camera(n) ? { pri: 6, kind: 'place' } : rank(R, n); follow(n, k.pri, k.kind, '見どころの終わり', false); }
        return;
      }
    } else if (sightShot) { ctx.sightEnd?.(sightShot.id, 'cut', shot.kind); if (sightShot.id === 'round') over.add(sightShot.key); sightShot = null; }
    const sightDue = !!s && !onSight && !over.has(s.key), softHold = sightDue && soft(shot.kind);
    // (a place on air: while its time lasts, only what outranks it cuts in; after it, the one it was about, else as one at rest)
    const placeHeld = !!r.place && !onSight && shot.hold > clock, held = !camera(r) && shot.hold > clock;
    if (r.place && !onSight && !placeHeld && shot.after) { const a = shot.after; shot.after = null; follow(a.n, a.pri, a.kind, a.why, false, a.scene); return; }
    const cur = onSight ? { pri: SIGHT_PRI, kind: 'sight' } : held ? { pri: 1, kind: shot.kind } : camera(r) ? { pri: placeHeld ? shot.pri : 6, kind: r.place ? 'place' : 'sky' } : rank(R, r);
    // (rank 1: what has just happened, or one starting to think — the line being said let finish, ten seconds at most)
    while (calls.length && clock - calls[0].at > 30) calls.shift();
    const live = R.list.filter((x: any) => awake(x));
    const thinking = onSight || sightDue ? undefined : live.find((x: any) => x !== r && x.task?.kind === 'ponder'), hauling = live.find((x: any) => x !== r && x.task?.kind === 'haul' && x.task.data?.quick);
    const c = calls.find((x) => x.id !== r.id || !held);
    const p1 = c ? { r: R.list.find((x: any) => x.id === c.id), kind: c.kind, why: c.why, call: c } : thinking ? { r: thinking, kind: 'thinking', why: '考え始めた', call: null }
      : hauling ? { r: hauling, kind: 'storm', why: '台風が来て、急いで筏を引き上げている', call: null } : null;
    if (p1?.r && p1.r !== r && awake(p1.r) && cur.pri > 1 && can(p1.r, 1)) {
      if (!ctx.speaking() || (p1.call ? clock - p1.call.at : 0) > LINE_WAIT) {
        if (p1.call) calls.splice(calls.indexOf(p1.call), 1);
        // (a first at a place: its card's eight seconds on the place's camera, then the one whose first it is — not from another place's)
        const at = p1.call?.kind === 'first' && p1.call.place && (!r.place || onSight) ? places().find((p) => p.subj.id === p1.call!.place) : null;
        if (at) placeThen(at, p1.r, 1, p1.kind, `初めて：${p1.why}`, OPEN_HOLD); else follow(p1.r, 1, p1.kind, p1.why);
        return;
      }
      return;   // (waiting for the line to end)
    }
    if (p1?.r === r && p1.call) {   // (on it already: it stays — a first at a place, its card's eight seconds on the place first)
      calls.splice(calls.indexOf(p1.call), 1);
      const at = p1.call.kind === 'first' && p1.call.place ? places().find((p) => p.subj.id === p1.call!.place) : null;
      if (at) { placeThen(at, r, 1, p1.kind, `初めて：${p1.why}`, OPEN_HOLD); return; }
      shot.hold = clock + P1_HOLD; shot.kind = p1.kind; shot.pri = 1; ctx.cam?.(r.id, 1, p1.kind, p1.why); return;
    }
    if (!softHold && (held || (placeHeld && shot.pri <= 2))) return;
    // (a gathering — the fire's, the morning's: the house's wide shot while it lasts, the ring's heads in it — MULTICAM.md §2-1, BUBBLE.md §10)
    const gather = live.find((x: any) => rank(R, x).kind === 'fire'), home = gather ? places().find((p) => p.subj.id === 'house') : null;
    if (home && (r === home.subj ? !placeHeld : (!r.place || onSight) && (cur.pri > 2 || cur.kind === 'fire'))) { follow(home.subj, 2, 'gather', '集まり'); return; }
    if (cur.pri > 2 || (sightDue && soft(cur.kind))) { const t = live.find((x: any) => x !== r && rank(R, x).pri === 2 && (!(onSight || sightDue) || !soft(rank(R, x).kind)) && can(x, 2)); if (t) { const k = rank(R, t); follow(t, 2, k.kind, k.kind === 'talk' ? '話している' : k.kind === 'fire' ? '焚き火の会' : '頼み・知らせ'); return; } }
    // (a timed sight in its time, not on: gone to over anything below rank 2, and over one starting to think or on its way
    // to ask — a line being said let finish, ten seconds at most; on: only a real rank 1, a talk or a gathering cut in, above)
    if (sightDue && (cur.pri > 2 || soft(cur.kind))) {
      if (ctx.speaking() && clock - (sightWait || (sightWait = clock)) < LINE_WAIT) return;
      sightWait = 0; sightGo(s, `定時の見どころ：${s.id}`); return;
    }
    if (onSight) return;
    // (long work by a place: the place's camera and the one at work in turn, 35 s each — the scene's three minutes kept)
    if (!r.place && cur.pri === 3 && clock - shot.since >= ALT_S) { const p = placeNear(r); if (p) { placeThen(p, r, 3, cur.kind, '仕事の場所', ALT_S, shot.scene); return; } }
    // (at rest: twelve seconds, if another has something going on; at work: three minutes — one trying a goal of its own first)
    // (on a place's camera in turn with one at work: not that one again)
    const best = () => live.filter((x: any) => x !== r && x !== shot.after?.n && rank(R, x).pri <= 3 && can(x)).sort((a: any, b: any) => rank(R, a).pri - rank(R, b).pri || Number(ownGoal(R, b)) - Number(ownGoal(R, a)))[0];
    if ((cur.pri === 6 && clock - shot.since >= REST_MAX) || (cur.pri === 3 && clock - shot.scene >= WORK_TURN) || hiddenFor >= HIDDEN_LEAVE) {
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
      if (meta?.milestone) call(r, 'first', text, FIRST_PLACE[meta.milestone]);
      else if (kind === 'mind' && MIND1.test(text)) call(r, /目的/.test(text.split('：')[1]) ? 'decided' : 'result', text);
      else if (kind === 'map' || kind === 'sail' || kind === 'raft') call(r, 'crossing', text);
      else if (kind === 'weather' && /長いうねりに気づいた/.test(text)) call(r, 'storm', text);
    },
    /** A try's result, from the trials' screen (PROGRAM.md §1): rank 1. */
    trial(r: any, outcome: string, text: string) { call(r, `result:${outcome}`, text); },
    /** The timed sight on air now (its id and its key for the day), if any. */
    sightOn: () => (sightShot && shot.kind === 'sight' && ctx.watched() === sightShot.subj ? { id: sightShot.id, key: sightShot.key } : null),
    /** Whether a sight is over for the day (its time done on air, or the round cut in on). */
    sightOver: (key: string) => over.has(key),
    /** Whether a sight has been on air (いま from then on, "このあと": viewer design on #243). */
    sightAired: (key: string) => aired.has(key),
  };
}
