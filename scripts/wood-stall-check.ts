// Headless check (slow): the island does not stop short of firewood with Dot's hands full (science on #221, 11/3 — the
// rand 2 island: Dot held driftwood from before 168 h to 288 h, no tree was offered, and after the 210 h pit fire the
// dry wood stayed short for good). A fresh island from 11/12 8:00 (as the sixth trial's), a stand-in mind choosing at
// random among the steps ready (rand, seed 2), science's harness (robots' batteries kept up, the seagrass regrown), 300
// hours. Every half hour: when the world wants firewood (woodWanted), one of the steps that get wood — a tree for
// firewood (fuel), a tree felled (fell), the driftwood set down by the bench taken up (woodtake) — is ready for Dot.
// Never twelve hours or more without one. Also told: how often the driftwood was set down by the bench, what lies there
// at the end, and the firsts reached.
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/wood-stall-check.ts   (HOURS, SEED, START to change the run)
import './node-land';
import * as THREE from 'three';
const START = process.env.START ?? '2026-11-12T08:00:00+09:00';
let now = Date.parse(START); Date.now = () => now;
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
const { mulberry32 } = await import('../src/core/math'); Math.random = mulberry32(Number(process.env.SEED ?? 2));
const { loadLand } = await import('../src/ocean/land');
const { DOTWORLD } = await import('../src/data/locations');
const loc: any = DOTWORLD; await loadLand('kayama', loc.land.half, loc.land.far);
const { buildOcean } = await import('../src/ocean/build');
const fakeEl = () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }), addEventListener() {}, removeEventListener() {} });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: fakeEl, createElementNS: fakeEl, getElementById: () => null } });
const { loadIslandWeather, islandWeather, setIslandEpoch } = await import('../src/world/island-time');
setIslandEpoch(Date.parse(START));
const { regrowBed } = await import('../src/robots/body');
await loadIslandWeather();
const pick = mulberry32(99);
const R: any = buildOcean(loc).residents;
R.setBrain(async (i: any) => { const o = (i.options ?? []).filter((x: any) => x.ready !== false); if (!o.length) return null; const p = o[Math.floor(pick() * o.length)]; return { goal: { text: 'テスト', why: 'テスト' }, plan: [p.id] }; });
const HOURS = Number(process.env.HOURS ?? 300), STALL_H = 12, cam = new THREE.Vector3(0, 50, 0), t0 = now;
const dot = R.list.find((r: any) => r.id === 'dot'), hrs = (ms: number) => +((ms - t0) / 3.6e6).toFixed(1);
let errors = 0, since = -1, worst = { len: 0, from: 0, why: '', holding: '' }, wantedHalfHours = 0;
const GETS = /^(fuel|fell|woodtake):/;
for (let s = 0; s < HOURS * 3600; s++) {
  now += 1000;
  try { R.update(1, now, cam); } catch (e) { errors++; }
  if (s % 60 === 0) R.setWeather(islandWeather(now));
  for (const r of R.list) if (!r.sp.living) r.battery = Math.max(r.battery, 0.3);
  if (s % 7200 === 0) for (const b of R.beds ?? []) regrowBed(b, now);
  if (s % 1800 === 0) {
    const why: string = R.woodWanted(), opts: any[] = why ? R.talkDev.optionsFor(dot, R.talkDev.agentOf(dot)) : [];
    const got = !why || opts.some((o) => GETS.test(o.id) && o.ready !== false);
    if (why) wantedHalfHours++;
    if (got) since = -1;
    else { if (since < 0) since = now; const len = (now - since) / 3.6e6; if (len > worst.len) worst = { len, from: hrs(since), why, holding: dot.holding || '-' }; }
  }
  await Promise.resolve(); await Promise.resolve();
}
const set = dot.diary.filter((e: any) => /流木を作業台の脇に置/.test(e.text)).length, V = R.village;
const firsts = Object.entries(V.firsts ?? {}).filter(([, x]) => typeof x === 'number' && (x as number) > 0).map(([k, x]) => `${k} ${hrs(x as number)}h`);
console.log(`run: ${HOURS} h from ${START}, rand seed ${process.env.SEED ?? 2}; errors ${errors}; firewood wanted ${wantedHalfHours / 2} h of it`);
console.log(`driftwood set down by the bench ${set} times, lying there at the end ${V.benchWood ?? 0}; Dot holding at the end ${dot.holding || '-'}`);
console.log(`firsts: ${firsts.join(', ')}`);
const ok = worst.len < STALL_H && errors === 0;
console.log(`the longest time firewood was wanted with no step to get wood ready for Dot: ${worst.len.toFixed(1)} h${worst.len ? ` (from ${worst.from} h, ${worst.why}, holding ${worst.holding})` : ''} — ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
