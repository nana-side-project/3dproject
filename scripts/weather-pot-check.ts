// Headless check (science, specs/weather-pot-spill.md 2026-11-02: on both 30-day runs of #209 the weather pot read "air
// in the pot, the tube's water off its mark" again and again — its tube's water has some 2 cm to fall before air gets in
// at its foot, and once in, its marks never come back). On controlled ground, Lantern by habit:
//   1 sets the weather pot at dawn, the coolest of the day — not in the night before, though it stands ready
//   2 its reading stuck (air let in at the tube's foot): opens it at once — the run stopped, its water back on the shelf,
//     none lost — and says so in words (a night that cooled, if it did), never a number
//   3 sets it again at the next dawn: a new setup, its record naming the one before
//   4 the words: "a night that cooled" only when it cooled more (°C) than the air's weight rose (hPa) (science on #214)
//   5 not set while a typhoon is on, dawn or not (science on #214); once it has passed, at dawn again
// (the reading stuck is the science side's own words, put in the step's result here: when it comes is the science
// side's to say — its fix of the pot's first state is its own)
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/weather-pot-check.ts
import * as THREE from 'three';
import { makeResidents, potStuckWords } from '../src/robots/residents';
import { Solids } from '../src/robots/solids';
import { mulberry32 } from '../src/core/math';
import { addLot, assemble } from '../src/world/process-runner';
import { CATALOG, POT_ASSEMBLY } from '../src/world/process-catalog';
import { loadIslandWeather, islandWeather } from '../src/world/island-time';

let now = Date.parse('2026-10-06T03:00:00+09:00');   // (Lantern is up; dawn is an hour and a half away)
Date.now = () => now;
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
Object.defineProperty(globalThis, 'document', { value: { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }), getElementById: () => null } });
let bad = 0;
const want = (what: string, ok: boolean, got = '') => { if (!ok) bad++; console.log(`${what}: ${got} ${ok ? 'ok' : 'FAIL'}`); };
await loadIslandWeather();

Math.random = mulberry32(7);
const f = () => 2, T: any = { ground: f, floor: f, top: f, landCover: () => ({ can: 0, sand: 1 }), vegH: () => 0, solids: new Solids() };
const R: any = makeResidents({ id: 'kayama', lat: 24.37, lon: 124.03, f } as any, T, ['テスト魚'], ['テスト鳥']);
const V = R.village, lab = R.lab, lantern = R.list.find((r: any) => r.id === 'lantern');
R.list.forEach((o: any, i: number) => { if (o !== lantern) { o.pos.set(2000 + i * 200, 2, 2000); o.task = { kind: 'wander', x: o.pos.x, z: o.pos.z, act: 'idle', dur: 1e9, t: 0, arrived: true }; } });
R.setBrain(null);
const POT = 'm03x_air_barometer_pot', hourOf = (ms: number) => (((ms / 3.6e6 + 9) % 24) + 24) % 24;
const run = (secs: number, until?: () => boolean) => { for (let i = 0; i < secs * 4; i++) { now += 250; lantern.battery = 1; R.update(0.25, now, new THREE.Vector3(0, 50, 0)); if (until?.()) return true; } return false; };
// (the weather pot as the tar chain leaves it — its sealed jar with a bamboo tube, made a gauge — and rain water)
const jar = addLot(lab, { materialId: 'fired_pot', amount: { value: 640_000, unit: 'mg' }, location: 'shelf',
  quality: { form: 2, capacity_ml: 500, surface_cm2: 366, absorption_ppm: 120000, coverage_ppm: 990000, sealed: 1, x_tube_ppm: 35_000, tube_bore_mm: 8, tube_length_mm: 350, joint_cover_ppm: 900_000, tube_form: 2, tube_outer_mm: 14, history_complete: 1 } });
const eq = assemble(lab, jar.lotId, POT_ASSEMBLY, now).equipment!, id = `eq:${POT_ASSEMBLY.kind}`;
lab.equipment[id] = { ...lab.equipment[eq.equipmentId], equipmentId: id }; delete lab.equipment[eq.equipmentId];
addLot(lab, { materialId: 'process_water', amount: { value: 400_000, unit: 'mg' }, location: 'shelf', quality: { history_complete: 1 } });
const water = () => Object.values(lab.lots).filter((l: any) => l.materialId === 'process_water').reduce((a: number, l: any) => a + l.amount.value, 0);
const water0 = water();
// (the step as it is; once asked, its next result carries the science side's words for air let in)
let stickAt = Infinity;
const base = CATALOG.find((e) => e.processId === POT)!;
R.setCatalog(CATALOG.map((e) => e.processId !== POT ? e : { ...e, step: (req: any) => {
  const res: any = base.step(req);
  if (now >= stickAt && res.status === 'running') { stickAt = Infinity; res.observations = [...res.observations, { at: req.interval.from, channel: res.observations[0]?.channel ?? 'instrument:eq', quantity: 'level', text: '管の下の端まで水が下がり、外の空気が泡になって壺に入った' }]; }
  return res;
} }));
const placed = () => (V.gaugeLog ?? []).filter((g: any) => g.processId === POT && g.placed);
const potRun = () => V.labRuns.find((x: any) => x.processId === POT);

{ // 1
  run(60);
  const before = R.labReady().includes(POT) || placed().length > 0;
  run(8 * 3600, () => placed().length > 0);
  const p = placed()[0], h = p ? hourOf(p.at) : NaN;
  want('1 the weather pot set at dawn — not in the night before, though it stands ready', !before && !!p && h >= 4.5 && h <= 7.5, `set at ${h.toFixed(2)} h`);
}
let firstRun = '';
{ // 2
  firstRun = potRun()?.runId ?? '';
  run(3600);
  stickAt = now;
  const n = lantern.diary.length;
  run(4 * 3600, () => !potRun());
  const said = lantern.diary.slice(n).map((e: any) => e.text), line = said.find((t: string) => /天気の壺：.*壺に空気が入った。栓を開けて、置き直す/.test(t)) ?? '';
  const st = lab.runs[firstRun]?.status ?? (R.lab.runsDone ?? []).find?.((r: any) => r.runId === firstRun)?.status;
  want('2 its reading stuck: opened at once — the run ended, its water back on the shelf, none lost; said in words', !!firstRun && !potRun() && water() === water0 && !!line && !/\d/.test(line) && said.some((t: string) => /途中でやめた/.test(t)),
    `${firstRun} ${st ?? 'ended'}; water ${water0} → ${water()}; "${line}"`);
}
{ // 3
  run(26 * 3600, () => placed().length > 1);
  const p = placed()[1], h = p ? hourOf(p.at) : NaN;
  want('3 set again at the next dawn: a new setup, its record naming the one before', !!p && h >= 4.5 && h <= 7.5 && p.placed.from === firstRun && p.runId !== firstRun && lantern.diary.some((e: any) => /置き直した/.test(e.text)),
    `set at ${h.toFixed(2)} h, from ${p?.placed.from}, why ${p?.placed.why}`);
}
{ // 5
  stickAt = now; run(4 * 3600, () => !potRun());
  const n = placed().length, storm = () => R.setWeather({ ...islandWeather(now)!, typhoon: true });
  storm(); const at = now; run(30 * 3600, () => { if ((now - at) % 60_000 === 0) storm(); return placed().length > n; });
  const during = placed().length > n;
  run(60); const offered = R.labReady().includes(POT);
  R.setWeather(islandWeather(now)); run(30 * 3600, () => placed().length > n);
  const p = placed()[n], h = p ? hourOf(p.at) : NaN;
  want('5 not set while a typhoon is on, dawn or not; once it has passed, at dawn again', !!potRun() && !during && !offered && !!p && h >= 4.5 && h <= 7.5, `in the typhoon: set ${during}, offered ${offered}; after: set at ${h.toFixed(2)} h`);
}
{ // 4
  const w = [potStuckWords('in', 3, 1, true), potStuckWords('in', 3, 1, false), potStuckWords('in', 1, 2.5, true), potStuckWords('in', 2, -3, true), potStuckWords('in', -1, 3, true), potStuckWords('over', 3, 0, true)];
  want('4 the words: cooled more than the air rose — a night that cooled; else only that air got in', JSON.stringify(w) === JSON.stringify(['冷えた夜に、壺に空気が入った', '冷えて、壺に空気が入った', '壺に空気が入った', '冷えた夜に、壺に空気が入った', '壺に空気が入った', '管の上から水があふれた']), w.join(' / '));
}
console.log(bad ? `FAIL (${bad})` : 'all ok');
process.exit(bad ? 1 : 0);
