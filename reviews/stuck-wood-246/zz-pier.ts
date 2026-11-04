// Headless check (slow): the island does not stop short of firewood with Dot's hands full (science on #221, 11/3 — the
// rand 2 island: Dot held driftwood from before 168 h to 288 h, no tree was offered, and after the 210 h pit fire the
// dry wood stayed short for good). A fresh island from 11/12 8:00 (as the sixth trial's), a stand-in mind choosing at
// random among the steps ready (rand, seed 2), science's harness (robots' batteries kept up, the seagrass regrown), 300
// hours. Every half hour, once the hut is up (before it, Dot fells no tree for firewood: the hut first, as ever — told
// apart): when the world wants firewood (woodWanted), one of the steps that get wood — a tree for firewood (fuel), a tree
// felled (fell), the driftwood set down by the bench taken up (woodtake) — is ready for Dot. Never twelve hours or more
// without one. Also told: how often the driftwood was set down by the bench and taken up again, what lies there at the
// end, the firsts reached, and the pots, the wood and the runs at the end.
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
let errors = 0, since = -1, worst = { len: 0, from: 0, why: '', holding: '' }, wantedHalfHours = 0, beforeHut = 0, ups = 0, downs = 0, lastBench = 0;
const hutN: number = R.places().hutN;
const GETS = /^(fuel|fell|woodtake):/;
// (PROBE_AT=h,h,…: at those hours, the pots, the firewood lots and what the lab has ready — to see why a fire waits)
const probeAt = (process.env.PROBE_AT ?? '').split(',').filter(Boolean).map(Number);
const probe = (h: number) => { const L = Object.values(R.lab.lots) as any[];
  console.log(`probe ${h} h: pots ${L.filter((l) => /pot/.test(l.materialId)).map((l) => `${l.materialId}(crack ${l.quality?.crack ?? 0}, ${l.location}${l.reservedBy ? `, reserved ${l.reservedBy}` : ''})`).join(' ') || '—'}; firewood ${L.filter((l) => l.materialId === 'firewood').map((l) => `${(l.amount.value / 1e6).toFixed(1)}kg w${Math.round((l.quality?.water_ppm ?? 0) / 1000)}k ${l.location}${l.reservedBy ? '*' : ''}`).join(' ')}; ready ${(R.labReady?.() ?? []).join(' ') || '—'}; equipment ${Object.keys(R.lab.equipment).join(' ')}; runs ${R.village.labRuns.map((x: any) => `${x.processId}:${R.lab.runs[x.runId]?.status}`).join(' ') || '—'}; Lantern ${(() => { const ln = R.list.find((r: any) => r.id === 'lantern'); return `${ln.task?.kind ?? '-'}/${ln.act}${ln.task?.data?.processId ? ` ${ln.task.data.processId}` : ''}${ln.task ? ` ${Math.round(ln.task.t)}/${Math.round(ln.task.dur)} s to (${ln.task.x?.toFixed(1)}, ${ln.task.z?.toFixed(1)})` : ''} at (${ln.pos.x.toFixed(1)}, ${ln.pos.y.toFixed(1)}, ${ln.pos.z.toFixed(1)}), ground ${R.T?.h ? R.T.h(ln.pos.x, ln.pos.z).toFixed(1) : '?'}, went ${ln.went ?? '-'}, blocked ${(ln.blocked ?? 0).toFixed?.(1) ?? ln.blocked}, path ${ln.path?.length ?? '-'}`; })()}`); };
for (let s = 0; s < HOURS * 3600; s++) {
  now += 1000;
  try { R.update(1, now, cam); } catch (e) { errors++; }
  if (s % 60 === 0) R.setWeather(islandWeather(now));
  for (const r of R.list) if (!r.sp.living) r.battery = Math.max(r.battery, 0.3);
  if (s % 7200 === 0) for (const b of R.beds ?? []) regrowBed(b, now);
  { const b = R.village.benchWood ?? 0; if (b > lastBench) ups += b - lastBench; else if (b < lastBench) downs += lastBench - b; lastBench = b; }
  if (s >= 86*3600 && s < 89*3600 && s % (Number(process.env.EVERY ?? 600)) === 0) { const ln = R.list.find((r: any) => r.id === 'lantern'), tk = ln.task, T = R.T, h = (x: number, z: number) => +(T.h(x, z)).toFixed(2);
    console.log(`L ${(s/3600).toFixed(2)}h pos ${ln.pos.x.toFixed(2)},${ln.pos.z.toFixed(2)} G ${h(ln.pos.x, ln.pos.z)} wet ${!!ln.wet} hold ${ln.holding||'-'} task ${tk?.kind}/${tk?.opt ?? ''} to ${tk ? tk.x.toFixed(2)+','+tk.z.toFixed(2) : ''} G ${tk ? h(tk.x, tk.z) : ''} t ${tk?.t?.toFixed(0)} arr ${tk?.arrived} goal ${ln.goal ? [ln.goal.x.toFixed(2), ln.goal.z.toFixed(2), ln.goal.none].join(',') : '-'} Ggoal ${ln.goal ? h(ln.goal.x, ln.goal.z) : ''} path ${ln.path ? (ln.path.pts?.length ?? '?') + ' i' + (ln.path.i ?? '?') + ' next ' + JSON.stringify(ln.path.pts?.[ln.path.i ?? 0]) : '-'} blocked ${ln.blocked?.toFixed(1)} went ${ln.went} walk ${ln.walk?.toFixed(2)} head ${ln.head?.toFixed(2)} act ${ln.act}`); }
  if (probeAt.length && s % 3600 === 0 && probeAt.includes(s / 3600)) probe(s / 3600);
  if (s % 1800 === 0) {
    const why: string = R.woodWanted(), hut = dot.stats.built >= hutN, opts: any[] = why && hut ? R.talkDev.optionsFor(dot, R.talkDev.agentOf(dot)) : [];
    const got = !why || !hut || opts.some((o) => GETS.test(o.id) && o.ready !== false);
    if (why) wantedHalfHours++;
    if (why && !hut) beforeHut++;
    if (got) since = -1;
    else { if (since < 0) since = now; const len = (now - since) / 3.6e6; if (len > worst.len) worst = { len, from: hrs(since), why, holding: dot.holding || '-' }; }
  }
  await Promise.resolve(); await Promise.resolve();
}
const V = R.village, L = Object.values(R.lab.lots) as any[], kg = (f: (l: any) => boolean) => +(L.filter(f).reduce((n, l) => n + l.amount.value, 0) / 1e6).toFixed(1);
const fw = (l: any) => l.materialId === 'firewood', dry = (l: any) => (l.quality?.water_ppm ?? 1e6) <= 300_000;
const firsts = Object.entries(V.firsts ?? {}).filter(([, x]) => typeof x === 'number' && (x as number) > 0).map(([k, x]) => `${k} ${hrs(x as number)}h`);
console.log(`run: ${HOURS} h from ${START}, rand seed ${process.env.SEED ?? 2}; errors ${errors}; firewood wanted ${wantedHalfHours / 2} h of it (${beforeHut / 2} h before the hut was up)`);
console.log(`driftwood set down by the bench ${ups} times, taken up again ${downs}, lying there at the end ${V.benchWood ?? 0}; Dot at the end ${dot.task?.kind ?? dot.act}, holding ${dot.holding || '-'}`);
console.log(`firsts: ${firsts.join(', ')}`);
const lots = (f: (l: any) => boolean) => L.filter((l) => fw(l) && f(l)).map((l) => (l.amount.value / 1e6).toFixed(1) + (l.reservedBy ? '*' : '')).join(' ');
console.log(`firewood lots at the end (kg; * reserved): green ${lots((l) => !dry(l)) || '—'}; seasoned ${lots(dry) || '—'}; trees felled ${(V.felled ?? []).length}`);
console.log(`ready in the lab at the end: ${(R.labReady?.() ?? []).join(' ') || '—'}; Lantern ${(() => { const ln = R.list.find((r: any) => r.id === 'lantern'); return `${ln.task?.kind ?? ln.act}`; })()}`);
console.log(`at the end: pots green/dry/fired ${['green_pot', 'dry_pot', 'fired_pot'].map((m) => L.filter((l) => l.materialId === m).length).join('/')}; firewood green ${kg((l) => fw(l) && !dry(l))} kg, seasoned ${kg((l) => fw(l) && dry(l))} kg; runs ${V.labRuns.map((x: any) => `${x.processId}:${R.lab.runs[x.runId]?.status}`).join(' ') || '—'}`);
const ok = worst.len < STALL_H && errors === 0;
console.log(`the hut up, the longest time firewood was wanted with no step to get wood ready for Dot: ${worst.len.toFixed(1)} h${worst.len ? ` (from ${worst.from} h, ${worst.why}, holding ${worst.holding})` : ''} — ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
