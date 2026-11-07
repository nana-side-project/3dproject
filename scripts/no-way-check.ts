// Headless check (a way not found, science soak on the island 2026-10-21 B). On the residents' island as built:
//  1 the pier's way: from its landing on the shore along the deck as far as it is laid, all ground one walks on; Dot, a plank
//    in hand and six planks down, gets from home to the deck's end and lays the seventh (the paths' grid, a metre to the
//    cell, found no way along the deck that runs aslant of it — "no way" every few seconds, for hours)
//  2 a place walled round: no way to it, and not looked for again for a while — two minutes of tries, the island searched
//    once, not every five seconds
//  3 the pier walled off at its landing: the deck task comes to nothing three times, then is set aside and other work
//    chosen; the frames stay light
//  4 off the deck by its landing, something solid there (science on #221, 11/4 — the rand 2 island at 88 h: Lantern on the
//    deck with a stone for the shore, the landing within a trunk's reach, was sent back to the landing every step and
//    stood there for hours): Lantern gets from the deck to where it hands the stone out, and lays it, within a minute
//  6 a plank only over a post: four planks and one post, none laid; the posts up, it is (science on #221, 11/7)
//  5 not a step nearer in half an hour (its legs held still): given up as held up — 進めなかった, the place noted among
//    those it found no way to, and set aside; three times so in one place, it works itself free of it; a slow walk that
//    runs out of time is only that — 時間がかかりすぎた, nothing noted
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/no-way-check.ts
import './node-land';
import * as THREE from 'three';
import { performance } from 'node:perf_hooks';

let sim = Date.parse('2026-12-04T14:00:00+09:00');
Date.now = () => sim;
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
const { mulberry32 } = await import('../src/core/math'); Math.random = mulberry32(7);
const { loadLand } = await import('../src/ocean/land');
const { DOTWORLD } = await import('../src/data/locations');
const loc: any = DOTWORLD;
await loadLand('kayama', loc.land.half, loc.land.far);
const { buildOcean } = await import('../src/ocean/build');
const fakeEl = () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }), addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {}, width: 64, height: 64 });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: fakeEl, createElementNS: fakeEl, getElementById: () => null } });

let bad = 0;
const want = (what: string, ok: boolean, got: unknown = '') => { if (!ok) bad++; console.log(`${what}: ${got} ${ok ? 'ok' : 'FAIL'}`); };
const cam = new THREE.Vector3(0, 50, 0);
// (an island with the pier six planks down, Dot at home with the seventh)
const island = () => {
  const R: any = buildOcean(loc).residents, v = R.village;
  v.pier = 'build'; v.bases = 4; v.posts = 4; v.deck = 6; R.pierHost.drawPier();
  const dot = R.list.find((r: any) => r.id === 'dot');
  dot.holding = 'plank'; dot.task = null; dot.pos.x = dot.sp.home[0]; dot.pos.z = dot.sp.home[1];
  return { R, v, dot };
};
const run = (R: any, s: number, each?: () => void) => { let worst = 0, sum = 0, slow = 0; for (let i = 0; i < s; i++) { sim += 1000; const t = performance.now(); R.update(1, sim, cam); const ms = performance.now() - t; sum += ms; worst = Math.max(worst, ms); if (ms > 150) slow++; each?.(); } return { mean: sum / s, worst, slow }; };
const ring = (R: any, x: number, z: number, rad: number) => { for (let a = 0; a < 6.28; a += 0.5 / rad) R.solids.add({ kind: 'rock', x: x + Math.cos(a) * rad, z: z + Math.sin(a) * rad, r: 0.45, y0: -5, y1: 5 }); };

{ // 1
  const { R, v, dot } = island(), P = R.pierHost;
  const [lx, lz] = P.landing(), [sx, sz] = P.plankStand(6);
  let worst = Infinity; for (let k = 0; k <= 40; k++) { const x = lx + (sx - lx) * k / 40, z = lz + (sz - lz) * k / 40; worst = Math.min(worst, P.G(x, z)); if (!isFinite(R.walkCost(x, z))) worst = -Infinity; }
  want('1 the pier\'s way, landing to the deck\'s end: ground one walks on all along', worst >= 0.3, `lowest ${worst.toFixed(2)} m, ${Math.hypot(sx - lx, sz - lz).toFixed(1)} m`);
  const r = run(R, 900, () => {});
  want('1 Dot, a plank in hand, from home to the deck\'s end: the seventh plank laid', v.deck === 7, `deck ${v.deck}, frames mean ${r.mean.toFixed(1)} ms`);
}
{ // 2
  const { R, dot } = island(); dot.holding = '';
  const h = dot.sp.home, tx = h[0] + 30, tz = h[1];
  ring(R, tx, tz, 3);
  const go = () => { if (!dot.task || dot.task.kind !== 'survey') dot.task = { kind: 'survey', x: tx, z: tz, act: 'look', dur: 5, t: 0, arrived: false }; };
  go(); const r = run(R, 120, go);
  const w = R.noWayHost.at(dot, tx, tz);
  want('2 a place walled round: no way to it', dot.went === 'no way' && !!w, `went ${dot.went}, tried ${w?.n ?? 0} times`);
  want('2 not looked for again for a while: one slow frame in two minutes of tries, not one every five seconds', r.slow <= 1 && w && w.n >= 3, `${r.slow} frames over 150 ms, worst ${r.worst.toFixed(0)} ms, mean ${r.mean.toFixed(1)} ms`);
}
{ // 3
  const { R, v, dot } = island(), P = R.pierHost;
  const [lx, lz] = P.landing(); ring(R, lx, lz, 3.2);
  const kinds: string[] = []; let last = '';
  const r = run(R, 1200, () => { const k = dot.task?.kind ?? ''; if (k && k !== last) kinds.push(k); last = k; });
  const decks = R.noWayHost.at(dot, ...P.plankStand(6))?.n ?? 0, other = kinds.filter((k) => k !== 'deck').length;   // (each try set out and found no way within the one frame)
  want('3 the pier walled off: the deck task set aside after three tries', decks === 3 && R.noWayHost.setAside(dot, ...P.plankStand(6)) && v.deck === 6, `no way to the deck's end ${decks} times in twenty minutes, set aside ${R.noWayHost.setAside(dot, ...P.plankStand(6))}`);
  want('3 other work chosen, the frames light', other >= 1 && r.mean < 20, `${other} other tasks (${[...new Set(kinds)].slice(0, 6).join(', ')}), mean ${r.mean.toFixed(1)} ms, ${r.slow} slow`);
}
{ // 4
  // (as on the rand 2 island at 88 h: three foundation stones down, a post, four planks; by the pier's root a trunk, the landing
  // within its reach, and a rock — put there, in the pier's own frame, where this island has none of its own)
  sim = Date.parse('2026-12-04T23:40:00+09:00');   // (Lantern's hours)
  const { R, v, dot } = island(), P = R.pierHost; dot.holding = '';
  v.bases = 3; v.posts = 1; v.deck = 4; P.drawPier();
  const at = (t: number, s: number) => { const [x, z] = P.along(t); return [x + P.at.dz * s, z - P.at.dx * s] as [number, number]; };
  const put = (kind: string, t: number, s: number, r: number, y0: number, y1: number) => {
    const [x, z] = at(t, s); let there = false; R.solids.each(x, z, 0.2, (o: any) => { if (o.kind === kind && Math.hypot(o.x - x, o.z - z) < 0.15) there = true; });
    if (!there) R.solids.add({ kind, x, z, r, y0, y1 });
  };
  put('trunk', -0.65, -0.27, 0.55, 0.33, 4.94); put('rock', -0.64, 0.09, 0.49, 0.55, 1.08);
  const ln = R.list.find((r: any) => r.id === 'lantern'), [lx, lz] = at(0.27, -0.56), [tx, tz] = P.along(-0.8);
  ln.pos.set(lx, P.G(lx, lz), lz); ln.holding = 'stone'; ln.wet = false; ln.battery = 1;
  ln.task = { kind: 'base', x: tx, z: tz, act: 'work', dur: 6, t: 0, arrived: false };
  const tOf = (x: number, z: number) => (x - P.at.x) * P.at.dx + (z - P.at.z) * P.at.dz;
  let k = 0, laid = -1, where = '', legs = NaN;
  run(R, 60, () => { k++; if (laid < 0 && ln.task?.kind === 'base' && !ln.task.arrived) legs = ln.walk; if (laid < 0 && v.bases === 4) { laid = k; where = `t ${tOf(ln.pos.x, ln.pos.z).toFixed(2)} on the pier's line, holding ${ln.holding || 'nothing'}`; } });
  const said = ln.diary.some((e: any) => e.text === '桟橋の土台石を据えた');
  want('4 off the deck by its landing, a trunk there: Lantern to the shore with its stone, and lays it, within a minute', laid > 0 && said,
    `${laid > 0 ? `laid in ${laid} s, at ${where}` : `not laid (stones ${v.bases}), still at t ${tOf(ln.pos.x, ln.pos.z).toFixed(2)}, its legs ${(+legs).toFixed(2)}`}`);
}
{ // 5
  sim = Date.parse('2026-12-04T13:00:00+09:00');   // (no gathering in the next hours)
  const held = (speed: number) => { const o = island(); o.dot.holding = ''; o.dot.sp.speed = speed;
    for (const x of o.R.list) if (x !== o.dot) x.task = { kind: 'wander', x: x.pos.x, z: x.pos.z, act: 'idle', dur: 1e9, t: 0, arrived: true };   // (the others resting where they are)
    return o; };
  const survey = (dot: any, tx: number, tz: number, label: string) => () => { dot.battery = 1; if (!dot.task || dot.task.kind !== 'survey') dot.task = { kind: 'survey', x: tx, z: tz, act: 'look', dur: 5, t: 0, arrived: false, opt: `survey:${label}`, label }; };
  const said = (dot: any, text: string) => dot.diary.some((e: any) => e.text.startsWith(text));
  // (places on the land round its home, so far off, that a way is found to)
  const round = (R: any, dot: any, d: number) => { const h = dot.sp.home, out: [number, number][] = [];
    for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, x = h[0] + Math.cos(a) * d, z = h[1] + Math.sin(a) * d; if (isFinite(R.walkCost(x, z)) && R.pierHost.G(x, z) > 0.4) out.push([x, z]); } return out; };
  {
    // (three places one way off — a way found to each; the first: given up as held up, noted, and a moment later set aside;
    // then the other two, from the same spot: three times held up there, it works itself free)
    const { R, dot } = held(0), p0 = [dot.pos.x, dot.pos.z], [[ax, az]] = round(R, dot, 10), h = dot.sp.home;
    const to = [1, 1.3, 1.6].map((f) => [h[0] + (ax - h[0]) * f, h[1] + (az - h[1]) * f] as [number, number]);
    const go = survey(dot, to[0][0], to[0][1], '見る1');
    for (let i = 0; i < 1900 && !said(dot, '見る1：'); i++) run(R, 1, go);
    const n1 = R.noWayHost.at(dot, ...to[0])?.n ?? 0, gaveUp = said(dot, '見る1：進めなかった');
    run(R, 5, go);
    want('5 its legs held, half an hour not a step nearer: given up as held up, the place noted, then set aside', gaveUp && n1 === 1 && R.noWayHost.setAside(dot, ...to[0]),
      `「見る1：進めなかった」 ${gaveUp}; noted ${n1} time(s) after half an hour, set aside ${R.noWayHost.setAside(dot, ...to[0])} a moment later`);
    to.slice(1).forEach(([x, z], i) => run(R, 1805, survey(dot, x, z, `見る${i + 2}`)));
    const freed = Math.hypot(dot.pos.x - p0[0], dot.pos.z - p0[1]), n = to.filter((_, i) => said(dot, `見る${i + 1}：進めなかった`)).length;
    const how = to.map((_, i) => dot.diary.find((e: any) => e.text.startsWith(`見る${i + 1}：`))?.text ?? `見る${i + 1}：—`).join(' / ');
    want('5 three times held up in one place: it works itself free of it', n === 3 && freed >= 0.6, `${n} of 3 given up as held up (${how}); then ${freed.toFixed(2)} m from where it stood`);
  }
  {
    const { R, dot } = held(0.01), [[tx, tz]] = round(R, dot, 40), p0 = [dot.pos.x, dot.pos.z];
    run(R, 1805, survey(dot, tx, tz, '遠くを見る'));
    const late = said(dot, '遠くを見る：時間がかかりすぎた'), w = R.noWayHost.at(dot, tx, tz);
    want('5 a slow walk that runs out of time: only that, nothing noted', late && !w?.n, `「遠くを見る：時間がかかりすぎた」 ${late}; ${Math.hypot(dot.pos.x - p0[0], dot.pos.z - p0[1]).toFixed(1)} m on in the half hour; noted ${w?.n ?? 0}`);
  }
}
{ // 6
  // (a plank only over a post — science on #221, 11/7: four planks down and one post, Dot with a plank in hand lays none; at
  // the bench it shapes a piece, not a plank; with the posts up it lays it)
  sim = Date.parse('2026-12-04T13:00:00+09:00');
  const { R, v, dot } = island(); v.bases = 4; v.posts = 1; v.deck = 4; R.pierHost.drawPier();
  dot.task = null; run(R, 120);
  const laid1 = v.deck;
  v.posts = 4; R.pierHost.drawPier(); dot.holding = 'plank'; dot.task = null; run(R, 600);
  want('6 four planks and one post: no fifth plank laid over nothing; with the posts up, it is', laid1 === 4 && v.deck >= 5, `with one post ${laid1} planks; with four, ${v.deck}`);
}
console.log(bad ? `\n${bad} FAILED` : '\nall ok');
process.exit(bad ? 1 : 0);
