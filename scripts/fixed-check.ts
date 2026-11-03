// Headless check of the fixed cameras (the drone fleet, stage 2 — viewer design MULTICAM.md §1–3; src/live/fixed.ts and
// director.ts with places):
//   which    the house's from the first day; the beach's once the raft is laid; the firing ground's once a fire has
//            burned; the field's once sown — three at most, in that order
//   where    on open ground: 8–15 m off, 3–6 m above, every line to the thing clear; trunks round it on some sides: it
//            stands on a clear side; the same answer each time; never in a tree's crown
//   words    the house: nothing yet / being built / up to the roof / standing (the lamp at night); the beach: half
//            lashed / here / out at sea; the fire: burning / drying; never a count
//   event    something happens at the house while Dot works there: the house's camera, twelve seconds, then Dot again
//            (no opening shot, the scene being there already); the same place again within two minutes: not (the
//            opening shot of a scene counts)
//   open     going to one at work by a place from far off: the place eight seconds first, then the one there
//   round    all at rest: the residents awake and the places in turn, 75 s each
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

// the director with places: four stand-ins, the house at the origin
const mk = (id: string, kind: string, x: number, z: number) => ({ id, act: 'idle', task: kind ? { kind, arrived: true } : null, talk: null as any, saying: '', pos: { x, y: 1, z } });
const dot = mk('dot', 'build', 3, 2), rakko = mk('rakko', 'gather', 300, 40), kame = mk('kame', 'graze', -200, 90), lantern = mk('lantern', 'rest', 150, -260);
const R = { list: [dot, rakko, kame, lantern], mind: () => null };
const subj = (id: string, no: string) => ({ id, place: id, no });
const HOUSE = subj('house', '06'), BEACH = subj('beach', '07');
let placeList = [{ subj: HOUSE, at: { lx: 0, lz: 0 } }, { subj: BEACH, at: { lx: 300, lz: 30 } }];
let watched: any = null, t = 0;
const cams: { t: number; who: string; pri: number; kind: string; why: string }[] = [];
const D = makeDirector({ residents: () => R, watched: () => watched, watch: (r) => { watched = r; }, speaking: () => false, cam: (who, pri, kind, why) => cams.push({ t, who, pri, kind, why }), places: () => placeList });
const run = (s: number) => { for (let i = 0; i < s * 10; i++) { t += 0.1; D.tick(0.1); } };
run(0.2);
{ // event
  const start = watched?.id; run(125);   // (on Dot, at work at the house: the opening shot of the house past its two minutes)
  const before = watched?.id; D.event('house', 'ドットが小屋に柱を立てた', dot); run(1); const on = watched?.id, k = cams.at(-1)?.kind;
  run(12.5); const back = watched?.id;
  D.event('house', 'ドットが小屋に梁を渡した', dot); run(1); const again = watched?.id;
  row(before === 'dot' && on === 'house' && k === 'place' && back === 'dot' && again === 'dot', `event: on ${before} (began ${start}); the house's event → ${on} (${k}); 12 s → ${back}; again within 2 min → ${again}`);
}
{ // open (a director of its own, nothing shown yet: Rakko on air far off and at rest, Dot at work by the house)
  const d2 = mk('dot', 'build', 3, 2), r2 = mk('rakko', 'rest', 300, 40), k2 = mk('kame', 'sleep', -200, 90), l2 = mk('lantern', 'sleep', 150, -260);
  k2.act = 'sleep'; l2.act = 'sleep';
  const R2 = { list: [d2, r2, k2, l2], mind: () => null }, c2: typeof cams = [];
  let w2: any = r2, t2 = 0;
  const D2 = makeDirector({ residents: () => R2, watched: () => w2, watch: (r) => { w2 = r; }, speaking: () => false, cam: (who, pri, kind, why) => c2.push({ t: t2, who, pri, kind, why }), places: () => [{ subj: HOUSE, at: { lx: 0, lz: 0 } }] });
  for (let i = 0; i < 300; i++) { t2 += 0.1; D2.tick(0.1); }
  const seq = c2.map((c) => `${c.who}:${c.kind}`), iH = c2.findIndex((c) => c.who === 'house'), toDot = c2.slice(iH + 1).find((c) => c.who === 'dot');
  row(iH >= 0 && /場所から/.test(c2[iH].why) && !!toDot && Math.abs(toDot.t - c2[iH].t - 8) < 1.2, `open: ${seq.join(' → ')}; the house ${(toDot && toDot.t - c2[iH].t)?.toFixed(1)} s before Dot`);
}
{ // round
  for (const r of R.list) r.task = { kind: 'rest', arrived: true } as any;
  cams.length = 0; run(400);
  const who = cams.map((c) => c.who), gaps = cams.slice(1).map((c, i) => c.t - cams[i].t);
  row(who.includes('house') && who.includes('beach') && who.includes('dot') && gaps.slice(1).every((g) => g > 70 && g < 80), `round: ${who.join(' → ')}; each ${gaps.map((g) => g.toFixed(0)).join(', ')} s (the first from part way)`);
}
{ // rank 1 (a director of its own: on the house's camera after something happened there)
  const d3 = mk('dot', 'build', 3, 2), k3 = mk('kame', 'graze', -200, 90), R3 = { list: [d3, k3], mind: () => null }, c3: typeof cams = [];
  let w3: any = null, t3 = 0;
  const D3 = makeDirector({ residents: () => R3, watched: () => w3, watch: (r) => { w3 = r; }, speaking: () => false, cam: (who, pri, kind, why) => c3.push({ t: t3, who, pri, kind, why }), places: () => [{ subj: HOUSE, at: { lx: 0, lz: 0 } }] });
  const go = (s: number) => { for (let i = 0; i < s * 10; i++) { t3 += 0.1; D3.tick(0.1); } };
  go(200); D3.event('house', 'ドットが小屋に板を張った', d3); go(1); const on = w3?.id;
  D3.trial(k3, 'confirmed', '藻場で食べた'); go(1); const cut = w3?.id;
  row(on === 'house' && cut === 'kame' && c3.at(-1)?.pri === 1, `rank 1: on ${on}; a moment decided → ${cut} (${c3.at(-1)?.kind})`);
}
process.exit(fail ? 1 : 0);
