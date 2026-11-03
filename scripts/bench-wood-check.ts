// Headless check (science on #221, 11/3 — the rand 2 island stopped with driftwood in Dot's hands: no tree was offered):
// on the real island of Dot's world, the hut and the raft done, two dry pots waiting and no firewood, a mind of its own:
//  A driftwood in hand: the tree for firewood is offered all the same (said: the driftwood set down by the bench first);
//    the trees felled to open land wait for empty hands, as before
//  B chosen: Dot walks to the bench and sets the driftwood down — it lies there, seen (not a bare count) — the diary says
//    so, and on to the tree, the same step: felled, and the step's result says what was done
//  C its hands free and the driftwood by the bench: a step to take it up again; taken, it is in hand and gone from there
//  D a stone in hand: the tree for firewood shown, not ready, and why; no trees to fell
//  E a save from before: no driftwood by the bench (0), and none drawn
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/bench-wood-check.ts
import './node-land';
import * as THREE from 'three';

let sim = Date.parse('2026-10-08T07:00:00+09:00');
Date.now = () => sim;
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
const { mulberry32 } = await import('../src/core/math'); Math.random = mulberry32(17);
const { loadLand } = await import('../src/ocean/land');
const { DOTWORLD } = await import('../src/data/locations');
const { addLot } = await import('../src/world/process-runner');
const { loadIslandWeather } = await import('../src/world/island-time'); await loadIslandWeather();
const loc: any = DOTWORLD;
await loadLand('kayama', loc.land.half, loc.land.far);
const { buildOcean } = await import('../src/ocean/build');
const fakeEl = () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }), addEventListener() {}, removeEventListener() {} });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: fakeEl, createElementNS: fakeEl, getElementById: () => null } });
const WX = { ok: true, at: 0, cloud: 0.3, rain: 0, code: 2, wind: 3, windDir: 90, gust: 5, pressure: 1012, typhoon: false, source: 'test', record: { station: 'test', at: '' } };
const R: any = buildOcean(loc).residents;
let bad = 0;
const want = (what: string, ok: boolean, got = '') => { if (!ok) bad++; console.log(`${what}: ${got} — ${ok ? 'PASS' : 'FAIL'}`); };
const dot = R.list.find((r: any) => r.id === 'dot'), V = R.village, lab = R.lab, cam = new THREE.Vector3();
R.setWeather(WX);
// (the hut up, the raft whole and the south island reached; two pots dried and no firewood: the world wants wood)
dot.stats.built = 24; V.raft.parts = 6; V.map.seen['south-near'] = { word: 'x', at: 0 }; V.map.reached['south-near'] = true;
for (const k of Object.keys(lab.lots)) if (lab.lots[k].materialId === 'firewood') delete lab.lots[k];
for (let i = 0; i < 2; i++) addLot(lab, { materialId: 'dry_pot', amount: { value: 1_420_000, unit: 'mg' }, location: 'shelf', quality: { form: 1, capacity_ml: 3000, wall_mm: 8, dry_stage: 2, crack: 0, history_complete: 1 } });
// (its mind chooses what the check asks: the first ready step whose id starts so)
let asked = '';
R.setBrain(async (i: any) => { const o = (i.options ?? []).find((x: any) => x.ready !== false && x.id.startsWith(asked)); return o ? { goal: { text: 'テスト', why: 'テスト' }, plan: [o.id] } : null; });
const run = async (secs: number, until?: () => boolean) => { for (let i = 0; i < secs; i++) { sim += 1000; cam.set(dot.pos.x, 30, dot.pos.z); R.update(1, sim, cam); if (i % 20 === 0) { await Promise.resolve(); await Promise.resolve(); } if (until?.()) return true; } return false; };
const opts = () => R.talkDev.optionsFor(dot, R.talkDev.agentOf(dot)) as any[];
const benchWoodSeen = () => R.benchWoodDrawn() as number;   // (the logs drawn beside the bench)
{ // A
  dot.holding = 'wood'; dot.task = null;
  const o = opts(), fuel = o.find((x) => x.id.startsWith('fuel:')), fell = o.filter((x) => x.id.startsWith('fell:'));
  dot.holding = ''; const free = opts().filter((x) => x.id.startsWith('fell:')).length; dot.holding = 'wood';
  want('A driftwood in hand: the tree for firewood offered, said to be set down first; no trees to fell till the hands are free', !!fuel && fuel.ready !== false && /手の流木は、先に作業台の脇に置く/.test(fuel.label) && fell.length === 0 && free > 0,
    `${fuel ? `${fuel.id} ready ${fuel.ready !== false}` : 'no fuel step'}; ${fell.length} to fell with it in hand, ${free} with the hands free`);
}
{ // B
  asked = 'fuel:';
  await run(600, () => dot.task?.kind === 'woodstow');
  const toBench = dot.task?.kind === 'woodstow';
  await run(900, () => V.benchWood > 0);
  const setDown = V.benchWood === 1 && dot.holding === '' && dot.task?.kind === 'fell', fellOpt = dot.task?.opt ?? '';
  const said = dot.diary.some((e: any) => e.text === '流木を作業台の脇に置いて、木を切りに行った');
  const drawn = benchWoodSeen();
  asked = 'zzz';   // (nothing more of its own meanwhile)
  await run(1800, () => dot.diary.some((e: any) => /^薪にするため、林のオオハマボウを切り倒した/.test(e.text)));
  const felled = dot.diary.some((e: any) => /^薪にするため、林のオオハマボウを切り倒した/.test(e.text));
  const res = JSON.stringify(R.talkDev.agentOf(dot).results ?? []), told = res.includes('流木を作業台の脇に置いて、木を切りに行った') && res.includes(fellOpt);
  want('B to the bench, the driftwood set down (seen there), said; on to the tree, the same step; felled; the result says what was done', toBench && setDown && fellOpt.startsWith('fuel:') && said && drawn === 1 && felled && told,
    `to the bench ${toBench}; set down ${setDown} (by the bench ${V.benchWood}, drawn ${drawn}, the step still ${fellOpt}); diary ${said}; felled ${felled}; result ${told}`);
}
{ // C
  await run(120, () => !dot.task);
  const o = opts(), take = o.find((x) => x.id === 'woodtake:bench');
  asked = 'woodtake:';
  await run(900, () => dot.holding === 'wood');
  want('C hands free, the driftwood by the bench: a step to take it up; taken', !!take && take.ready !== false && /作業台の脇に置いた流木を手に取る（1本）/.test(take.label) && dot.holding === 'wood' && V.benchWood === 0 && benchWoodSeen() === 0,
    `${take ? take.label : 'no step'}; holding '${dot.holding}', by the bench ${V.benchWood}`);
}
{ // D
  asked = 'zzz'; dot.task = null; dot.holding = 'stone';
  const o = opts(), fuel = o.find((x) => x.id.startsWith('fuel:')), fell = o.filter((x) => x.id.startsWith('fell:'));
  want('D a stone in hand: the tree for firewood shown, not ready, and why; no trees to fell', !!fuel && fuel.ready === false && fuel.needs === '手があいていること（いま石を持っている）' && fell.length === 0,
    `${fuel ? `ready ${fuel.ready}, needs 「${fuel.needs}」` : 'no fuel step'}; ${fell.length} to fell`);
  dot.holding = '';
}
{ // E
  R.save?.();
  const key = [...store.keys()].find((k) => k.startsWith('seaglass.residents')), saved = key ? JSON.parse(store.get(key)!) : null;
  if (saved?.village) { saved.village.benchWood = undefined; delete saved.village.benchWood; store.set(key!, JSON.stringify(saved)); }
  const R2: any = buildOcean(loc).residents;
  want('E a save from before: no driftwood by the bench', !!saved?.village && R2.village.benchWood === 0, `saved under ${key ?? 'none'}; read back ${R2.village.benchWood}`);
}
process.exit(bad ? 1 : 0);
