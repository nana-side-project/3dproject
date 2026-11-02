// probe: the weather pot driven by the island's replayed record, re-placed at the next real dawn after it goes out
import { scienceStep } from '../src/science/step';
import { BAROMETER_POT_PROCESS } from '../src/science/step/barometer-pot';
import { loadIslandWeather, islandWeather } from '../src/world/island-time';
import { toClock, toReal } from '../src/world/process-runner';
await loadIslandWeather();
const PARAMS = { capacityMl: 500, absorptionPpm: 120000, coveragePpm: 763963, sealed: 1, airtightKnown: 1, crackPpm: 0, airLeakTauMin: Number(process.env.TAU ?? 208), tubeBoreMm: 8.9, tubeLengthMm: 350, bulbTauS: 738, tubeForm: 2, tubeOuterMm: 13.9, bulbHeatJPerK: 540, markMm: 5 };
const W = { worldId: 'w', worldEpoch: 'e', worldVersion: 1 };
const start = Date.parse(process.env.FROM ?? '2026-12-01T07:00:00+09:00'), days = Number(process.env.DAYS ?? 3);
const env = (isl: number) => { const w = islandWeather(toReal('island', isl))!; return { sampleId: `e${isl}`, source: 'record' as const, effectiveAt: isl, airTempC: w.air, pressureHPa: w.pressureMeasured }; };
const TR: [number, number, number][] = [];
let st: any = null, runN = 0, from = toClock('island', start), placedAt = start;
const end = toClock('island', start + days * 86400e3), CH = 30 * 60_000; // island 30 min chunks
const ev = { bottom: 0, top: 0, unknown: 0, placed: 0 }; let okMs = 0, reads = 0, life: number[] = [], minX = 1e9;
while (from < end) {
  const to = Math.min(end, from + CH);
  if (!st) { // waiting for the next real dawn
    const real = toReal('island', from), h = new Date(real + 9 * 3600e3).getUTCHours();
    if (h !== 6) { from = to; continue; }
    runN++; ev.placed++; placedAt = real;
  }
  const r = scienceStep({ contract: '0.2.1', requestId: `r${from}`, world: W, runId: `run:${runN}`, ...BAROMETER_POT_PROCESS, catalogVersion: 'civ-sci-test-2', interval: { from, to }, state: st, environment: env(from),
    lots: [{ lotId: 'lot:w', materialId: 'process_water', amount: { value: 250000, unit: 'mg' }, location: 'site:jar' }],
    equipment: [{ equipmentId: 'eq:pot', kind: 'assembled_pot', catalogEntry: 'assembled_pot', catalogVersion: 'civ-sci-test-2', condition: 1, params: PARAMS }], energy: [], seed: 1,
    actions: [{ at: to - 1000, residentId: 'res:l', action: 'read_gauge' }] } as any);
  if (r.status === 'failed') { console.log('FAIL', JSON.stringify(r.diagnostics).slice(0, 300)); break; }
  const c = (r.state as any)?.data?.condition;
  for (const o of r.observations) if (typeof o.value === 'number') { reads++; minX = Math.min(minX, o.value); if (process.env.TRACE && (o.at - from) % 1 === 0) { const w = islandWeather(toReal('island', o.at))!; TR.push([(toReal('island', o.at) - start) / 864e5, o.value as number, w.typhoon ? 1 : 0, w.air, w.pressureMeasured ?? 0] as any); } }
  if (c && c !== 'ok') { (ev as any)[c.replace('spilled-', '')]++; life.push((toReal('island', to) - placedAt) / 3600e3); st = null; }
  else { st = r.state; okMs += to - from; }
  from = to;
}
console.log(JSON.stringify({ bubbles: (globalThis as any).BUBBLES ?? 0, tau: PARAMS.airLeakTauMin, ev, readableShare: +(okMs / (end - toClock('island', start))).toFixed(3), reads, minMark: minX, lifeRealH: life.map((x) => +x.toFixed(2)).slice(0, 12) }));

if (process.env.TRACE) (await import('node:fs')).writeFileSync(process.env.TRACE, JSON.stringify(TR));
