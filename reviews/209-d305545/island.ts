// Science probe (not committed): a fresh island with no mind (BRAIN=none) or a stand-in (rand); every 2 h Kamemaru and
// Lantern, every 6 h the wood, clay and pots, and at the end the world's firsts and why work may be stuck.
import './node-land';
import * as THREE from 'three';
let now = Date.parse(process.env.START ?? '2026-11-05T06:00:00+09:00'); Date.now = () => now;
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
const { mulberry32 } = await import('../src/core/math'); Math.random = mulberry32(Number(process.env.SEED ?? 5));
const { loadLand } = await import('../src/ocean/land');
const { DOTWORLD } = await import('../src/data/locations');
const loc: any = DOTWORLD; await loadLand('kayama', loc.land.half, loc.land.far);
const { buildOcean } = await import('../src/ocean/build');
const fakeEl = () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }), addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: fakeEl, createElementNS: fakeEl, getElementById: () => null } });
const { loadIslandWeather, islandWeather } = await import('../src/world/island-time');
const { regrowBed } = await import('../src/robots/body');
await loadIslandWeather();
const pick = mulberry32(99), BR = process.env.BRAIN ?? 'none';
const R: any = buildOcean(loc).residents;
R.setBrain(async (i: any) => { const o = (i.options ?? []).filter((x: any) => x.ready !== false); if (BR === 'none' || !o.length) return null; const p = o[Math.floor(pick() * o.length)]; return { goal: { text: 'テスト', why: 'テスト' }, plan: [p.id] }; });
const t0 = now, hrs = () => ((now - t0) / 3.6e6).toFixed(1), rows: string[] = [], log: string[] = [];
R.onEvent = (kind: string, text: string) => { if (/storm|haul|prep|raft|voyage|chop/.test(kind) || (kind === 'science' && /油|野焼き|灯|器/.test(String(text)))) if (log.length < 600) log.push(`${hrs()}h ${kind} ${String(text).slice(0, 160)}`); };
const SEASONED = 300_000, cam = new THREE.Vector3(0, 50, 0), HOURS = Number(process.env.HOURS ?? 140); let errors = 0;
const by = (id: string) => R.list.find((r: any) => r.id === id);
for (let s = 0; s < HOURS * 3600; s++) {
  now += 1000;
  try { R.update(1, now, cam); } catch (e) { errors++; }
  if (s % 60 === 0) R.setWeather(islandWeather(now));
  for (const r of R.list) if (!r.sp.living) r.battery = Math.max(r.battery, 0.3);
  if (s % 7200 === 0) { const k = by('kame'), ln = by('lantern'); for (const b of R.beds ?? []) regrowBed(b, now); rows.push(`K ${hrs()}h LN ${ln.task?.kind ?? ln.act}/${ln.holding || '-'} DOT ${by('dot').task?.kind ?? by('dot').act}/${by('dot').holding || '-'} kameHunger ${k.hunger.toFixed(2)}`); }
  if (s % 21600 === 0) { const L = Object.values(R.lab.lots) as any[], m = (f: (l: any) => boolean) => +(L.filter(f).reduce((n, l) => n + l.amount.value, 0) / 1e6).toFixed(1), wood = (l: any) => l.materialId === 'firewood', dry = (l: any) => wood(l) && (l.quality?.water_ppm ?? 1e6) <= SEASONED;
    rows.push(`L ${hrs()}h wood green ${m((l) => wood(l) && !dry(l))} seasoned ${m(dry)} clay ${m((l) => ['raw_clay', 'settled_clay', 'prepared_clay'].includes(l.materialId))} pots g/d/f ${['green_pot', 'dry_pot', 'fired_pot'].map((id) => L.filter((l) => l.materialId === id).length).join('/')} equip ${Object.keys(R.lab.equipment).map((e: string) => e.replace('eq:', '')).filter((e: string) => !/fixture|rack|clay_pit/.test(e)).join(',')} felled ${(R.village.felled ?? []).length} fuel ${(R.village.felled ?? []).filter((f: any) => f.fuel).length}`); }
  await Promise.resolve(); await Promise.resolve();
}
const V = R.village, rel = (x: any) => (typeof x === 'number' && x > 0 ? +((x - t0) / 3.6e6).toFixed(1) : x);
console.log(JSON.stringify({ BR, HOURS, SEED: process.env.SEED, errors }));
console.log('FIRSTS', JSON.stringify(Object.fromEntries(Object.entries(V.firsts ?? {}).map(([k, x]) => [k, rel(x)]))), 'labDoneLast', JSON.stringify((V.labDone ?? []).slice(-12).map((x: any) => `${rel(x.at)}h ${x.processId}${x.ok ? '' : ' x'}`)));
const d = by('dot'), ln = by('lantern');
console.log('END', JSON.stringify({ labReady: R.labReady?.(), labRuns: V.labRuns.map((x: any) => x.processId), dot: { task: d.task?.kind, holding: d.holding, diary: d.diary.slice(-6).map((e: any) => e.text.slice(0, 50)) }, lantern: { task: ln.task?.kind, holding: ln.holding, diary: ln.diary.slice(-6).map((e: any) => e.text.slice(0, 50)) }, raft: V.raft, treasures: (V.treasures ?? []).length, lots: (Object.values(R.lab.lots) as any[]).filter((l) => /firewood|pot/.test(l.materialId)).map((l) => [l.materialId, +(l.amount.value / 1e6).toFixed(2), l.quality?.water_ppm, l.quality?.capacity_ml, l.reservedBy ?? '']) }));
console.log('STORMS', JSON.stringify((V.stormLog ?? []).map((x: any) => ({ at: rel(x.at), warned: x.warned, saved: x.saved, lost: x.lost }))), 'swell', JSON.stringify(V.swellGuess));
console.log(rows.join('\n')); console.log('log\n' + log.join('\n'));
process.exit(0);
