// Headless check of the fixed cameras (the drone fleet, stage 2 — viewer design MULTICAM.md §1–3; src/live/fixed.ts and
// director.ts with places):
//   which    the house's from the first day; the beach's once the raft is laid; the firing ground's once a fire has
//            burned; the field's once sown — three at most, in that order
//   where    on open ground: 8–15 m off, 3–6 m above, every line to the thing clear; trunks round it on some sides: it
//            stands on a clear side; the same answer each time; never in a tree's crown
//   words    the house: nothing yet / being built / up to the roof / standing (the lamp at night); the beach: half
//            lashed / here / out at sea; the fire: burning / drying; never a count
//   event    a piece put on at the house, no card: as work (rank 3), no cut for it (MULTICAM.md §2-1 from here on)
//   open     going to one at work by a place from far off: the place eight seconds first, then the one there
//   first    a first of the island's at the house: the card's eight seconds on the house, then Dot (rank 1)
//   gather   the fire's gathering: the house's wide shot while it lasts, one shot; ended, elsewhere
//   work     long work by the house: the house and Dot in turn, 35 s each; after three minutes, the next one at work
//   round    all at rest: the residents awake with the places between them, 75 s each — never a place after a place
//   rank 1   a moment decided cuts in on a place on air
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/fixed-check.ts
import { placeSpots, placesOn, placeFixed, placeWords, panAt } from '../src/live/fixed';
import { lineClear, type Solid } from '../src/live/fleet';
import { makeDirector } from '../src/live/director';

let fail = 0;
const row = (ok: boolean, text: string) => { if (!ok) fail++; console.log(`${text} — ${ok ? 'PASS' : 'FAIL'}`); };
const flat = { h: () => 1, over: () => -1e9 };
const solids = (list: Solid[]) => ({ each: (x: number, z: number, rad: number, f: (s: Solid) => void) => { for (const s of list) if (Math.abs(s.x - x) < rad + s.r && Math.abs(s.z - z) < rad + s.r) f(s); } });

{ // which
  const base = { hut: { x: 0, y: 1, z: 0 }, pit: { x: 3, y: 1, z: 3 }, plots: [{ x: -1, z: 5, s: 0 }], raft: { x: NaN, z: NaN, parts: 0 }, fired: false };
  const day1 = placesOn(placeSpots(base, flat.h)).map((p) => p.no);
  const later = placesOn(placeSpots({ ...base, raft: { x: 40, z: 2, parts: 2 }, fired: true }, flat.h)).map((p) => p.no);
  const all = placesOn(placeSpots({ ...base, raft: { x: 40, z: 2, parts: 6 }, fired: true, plots: [{ x: -1, z: 5, s: 2 }] }, flat.h)).map((p) => p.no);
  const laidNoParts = placeSpots({ ...base, raft: { x: 40, z: 2, parts: 0 } }, flat.h).beach;
  row(day1.join() === '06' && later.join() === '06,07,08' && all.join() === '06,07,08' && laidNoParts === null, `which: day 1 ${day1}; raft and fire ${later}; all four there ${all}; raft place with nothing on it ${laidNoParts}`);
}
{ // where
  const t = { x: 0, y: 1, z: 0 }, p = placeFixed(t, flat, null)!;
  const d = Math.hypot(p.x - t.x, p.z - t.z), up = p.y - t.y;
  const open = !!p && d >= 8 - 1e-6 && d <= 15 + 1e-6 && up >= 3 - 1e-6 && up <= 6 + 1e-6 && lineClear(p, { x: 0, y: 1.5, z: 0 }, flat, null);
  // (trunks closing it in on all sides but the south-east)
  const ring: Solid[] = []; for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; if (a > 0.2 && a < 1.4) continue; ring.push({ x: Math.cos(a) * 4, z: Math.sin(a) * 4, r: 0.5, y0: 0, y1: 20, kind: 'trunk' }); }
  const q = placeFixed(t, flat, solids(ring))!, qa = Math.atan2(q.z, q.x), again = placeFixed(t, flat, solids(ring))!;
  const crown = { h: () => 1, over: (x: number, z: number) => (Math.hypot(x, z) > 9 ? 9 : -1e9) };   // (a wood all round past 9 m, its crowns 4.6–8.5 m)
  const c = placeFixed(t, crown, null);
  row(open && qa > 0.2 && qa < 1.4 && again.x === q.x && again.z === q.z && (!c || Math.hypot(c.x, c.z) <= 9 || c.y >= 8.5 || c.y <= 1 + 0.4 * 8),
    `where: open ${d.toFixed(1)} m off, ${up.toFixed(1)} m up; shut in but the south-east → at ${(qa * 180 / Math.PI).toFixed(0)}°, the same again ${again.x === q.x}; in a wood → ${c ? `(${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})` : 'none'}`);
}
{ // words
  const st = (o: any) => ({ here: [], built: 0, roofN: 18, hutN: 24, raft: { parts: 0, n: 6, away: false }, firing: false, boiling: false, drying: false, lit: false, night: false, ...o });
  const w = [placeWords('house', st({})), placeWords('house', st({ built: 5 })), placeWords('house', st({ built: 20 })), placeWords('house', st({ built: 24 })), placeWords('house', st({ built: 24, night: true, lit: true })),
    placeWords('beach', st({ raft: { parts: 3, n: 6, away: false } })), placeWords('beach', st({ raft: { parts: 6, n: 6, away: false } })), placeWords('beach', st({ raft: { parts: 6, n: 6, away: true } })),
    placeWords('fire', st({ firing: true })), placeWords('fire', st({}))];
  row(JSON.stringify(w) === JSON.stringify(['', '建てている途中', '屋根まで', 'できている', '灯りがともっている', '組みかけの筏', '筏がある', '筏は海に出ている', '火が燃えている', '']) && !w.some((x) => /\d/.test(x)) && Math.abs(panAt(15)) <= 0.07,
    `words: ${w.map((x) => x || '（名前だけ）').join(' / ')}`);
}

// the director with places — each case a director of its own, the house at the origin, the beach far off
const mk = (id: string, kind: string, x: number, z: number) => ({ id, act: 'idle', task: kind ? { kind, arrived: true } : null as any, talk: null as any, saying: '', pos: { x, y: 1, z } });
const subj = (id: string, no: string) => ({ id, place: id, no });
const HOUSE = subj('house', '06'), BEACH = subj('beach', '07');
type Cam = { t: number; who: string; pri: number; kind: string; why: string };
function stage(list: any[], places = [{ subj: HOUSE, at: { lx: 0, lz: 0 } }, { subj: BEACH, at: { lx: 300, lz: 30 } }], start: any = null) {
  const R = { list, mind: () => null }, cams: Cam[] = [];
  let w: any = start, t = 0;
  const D = makeDirector({ residents: () => R, watched: () => w, watch: (r) => { w = r; }, speaking: () => false, cam: (who, pri, kind, why) => cams.push({ t, who, pri, kind, why }), places: () => places });
  return { D, cams, on: () => w?.id as string, set: (r: any) => { w = r; }, run: (s: number) => { for (let i = 0; i < s * 10; i++) { t += 0.1; D.tick(0.1); } }, until: (f: () => boolean, s = 120) => { for (let i = 0; i < s * 10 && !f(); i++) { t += 0.1; D.tick(0.1); } }, time: () => t };
}
{ // event (a piece put on, no card: as work — no cut for it)
  const dot = mk('dot', 'build', 3, 2), S = stage([dot, mk('kame', 'graze', -200, 90)]);
  S.run(12); const first = S.cams.map((c) => c.who).join('→');   // (the opening of the house, then Dot)
  S.D.event('house', 'ドットが小屋に柱を立てた', dot); S.run(1); const on = S.on();
  row(first === 'house→dot' && on === 'dot', `event: began ${first}; a piece put on at the house → still ${on}`);
}
{ // open
  const d = mk('dot', 'build', 3, 2), r = mk('rakko', 'rest', 300, 40), S = stage([d, r, { ...mk('kame', 'sleep', -200, 90), act: 'sleep' }], undefined, r);
  S.run(30);
  const seq = S.cams.map((c) => `${c.who}:${c.kind}`), iH = S.cams.findIndex((c) => c.who === 'house'), toDot = S.cams.slice(iH + 1).find((c) => c.who === 'dot');
  row(iH >= 0 && /場所から/.test(S.cams[iH].why) && !!toDot && Math.abs(toDot.t - S.cams[iH].t - 8) < 1.2, `open: ${seq.join(' → ')}; the house ${(toDot && toDot.t - S.cams[iH].t)?.toFixed(1)} s before Dot`);
}
{ // first
  const dot = mk('dot', 'build', 3, 2), S = stage([dot, mk('kame', 'graze', -200, 90)]);
  S.run(15); const before = S.on();
  S.D.event('house', 'ドットが小屋の屋根を葺き終えた', dot, { milestone: 'hut' }); S.run(1);
  const on = S.on(), why = S.cams.at(-1)?.why ?? '', at = S.time(); S.until(() => S.on() === 'dot', 20);
  row(before === 'dot' && on === 'house' && /初めて/.test(why) && Math.abs(S.time() - at - 7.5) < 1.5 && S.cams.at(-1)?.pri === 1, `first: on ${before}; a first at the house → ${on} (${why.slice(0, 12)}…), then ${S.on()} after ${(S.time() - at + 1).toFixed(1)} s (rank ${S.cams.at(-1)?.pri})`);
}
{ // gather
  const dot = mk('dot', 'fire', 3, 2), rakko = mk('rakko', 'fire', 4, 3), S = stage([dot, rakko, mk('kame', 'graze', -200, 90)]);
  dot.saying = 'きょうは流木が多かったね';
  S.run(60); const during = S.on(), rows = S.cams.length;
  dot.task = { kind: 'build', arrived: true }; rakko.task = { kind: 'gather', arrived: true }; dot.saying = '';
  S.run(30); const after = S.on();
  row(during === 'house' && S.cams.filter((c) => c.who === 'house').length === 1 && rows <= 2 && after !== 'house', `gather: the fire's gathering → ${during} for a minute in one shot (${rows} rows); ended → ${after}`);
}
{ // work
  const dot = mk('dot', 'build', 3, 2), S = stage([dot, mk('kame', 'graze', -200, 90)]);
  S.run(200); const seq = S.cams.map((c) => c.who), gaps = S.cams.slice(1).map((c, i) => c.t - S.cams[i].t);
  const iK = seq.indexOf('kame'), turns = seq.slice(0, iK < 0 ? seq.length : iK);
  row(turns.length >= 5 && turns.every((w, i) => w === (i % 2 ? 'dot' : 'house')) && gaps.slice(1, turns.length - 1).every((g) => g > 33 && g < 37) && iK > 0 && S.cams[iK].t > 175,
    `work: ${seq.join(' → ')}; each ${gaps.map((g) => g.toFixed(0)).join(', ')} s; the next at work after ${iK > 0 ? S.cams[iK].t.toFixed(0) : '—'} s`);
}
{ // round
  const L = ['dot', 'rakko', 'kame', 'lantern'].map((id, i) => mk(id, 'rest', 100 + i * 80, -100)), S = stage(L);
  S.run(500); const who = S.cams.map((c) => c.who), gaps = S.cams.slice(1).map((c, i) => c.t - S.cams[i].t), placeTwice = who.some((w, i) => i > 0 && ['house', 'beach'].includes(w) && ['house', 'beach'].includes(who[i - 1]));
  row(who.includes('house') && who.includes('beach') && !placeTwice && gaps.slice(1).every((g) => g > 70 && g < 80), `round: ${who.join(' → ')}; each ${gaps.map((g) => g.toFixed(0)).join(', ')} s`);
}
{ // rank 1 (on the house's camera in turn with Dot at work)
  const dot = mk('dot', 'build', 3, 2), kame = mk('kame', 'graze', -200, 90), S = stage([dot, kame], [{ subj: HOUSE, at: { lx: 0, lz: 0 } }]);
  S.run(20); S.until(() => S.on() === 'house', 40); const on = S.on();
  S.D.trial(kame, 'confirmed', '藻場で食べた'); S.run(1);
  row(on === 'house' && S.on() === 'kame' && S.cams.at(-1)?.pri === 1, `rank 1: on ${on}; a moment decided → ${S.on()} (${S.cams.at(-1)?.kind})`);
}
process.exit(fail ? 1 : 0);
