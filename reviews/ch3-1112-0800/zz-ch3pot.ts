// probe (not committed): chapter-3 weather pot from the hour it was set out to the end, on the new island's calendar;
// reads every READ real hours (like Lantern's ~0.23 h), re-placed at the next real dawn if it stops (#214). Then the
// hypo3 shape (science/reviews specs/weather-pot-hypothesis.md §3) scored with residents.ts's own rules.
import { scienceStep } from '../src/science/step';
import { BAROMETER_POT_PROCESS } from '../src/science/step/barometer-pot';
import { loadIslandWeather, islandWeather, setIslandEpoch, ISLAND_RATE } from '../src/world/island-time';
import { toClock, toReal } from '../src/world/process-runner';
import fs from 'node:fs';
const T0 = Date.parse('2026-11-12T08:00:00+09:00'); setIslandEpoch(T0);
await loadIslandWeather();
const PARAMS = { capacityMl: 500, absorptionPpm: 120000, coveragePpm: 763963, sealed: 1, airtightKnown: 1, crackPpm: 0, airLeakTauMin: 208, tubeBoreMm: 8.9, tubeLengthMm: 350, bulbTauS: 738, tubeForm: 2, tubeOuterMm: 13.9, bulbHeatJPerK: 540, markMm: 5 };
const W = { worldId: 'w', worldEpoch: 'e', worldVersion: 1 };
const P = Number(process.env.PLACED), END = Number(process.env.HOURS ?? 720), READ = Number(process.env.READ ?? 0.23);
const DAY = 24 * 3.6e6 / ISLAND_RATE;   // one island day in real ms
const env = (isl: number) => { const w = islandWeather(toReal('island', isl))!; return { sampleId: `e${isl}`, source: 'record' as const, effectiveAt: isl, airTempC: w.air, pressureHPa: w.pressureMeasured }; };
let st: any = null, runN = 1, real = T0 + P * 3.6e6;
const reads: { t: number; mark: number; air: number; run: number }[] = [], stops: number[] = [];
while (real < T0 + END * 3.6e6) {
  const nx = real + READ * 3.6e6;
  if (!st && runN > 1 || (st === 'wait')) { const h = new Date(real + 9 * 3600e3).getUTCHours(); if (h !== 6) { real = nx; continue; } st = null; }
  const from = toClock('island', real), to = toClock('island', nx);
  const r = scienceStep({ contract: '0.2.1', requestId: `r${from}`, world: W, runId: `run:${runN}`, ...BAROMETER_POT_PROCESS, catalogVersion: 'civ-sci-test-2', interval: { from, to }, state: st, environment: env(from),
    lots: [{ lotId: 'lot:w', materialId: 'process_water', amount: { value: 250000, unit: 'mg' }, location: 'site:jar' }],
    equipment: [{ equipmentId: 'eq:pot', kind: 'assembled_pot', catalogEntry: 'assembled_pot', catalogVersion: 'civ-sci-test-2', condition: 1, params: PARAMS }], energy: [], seed: 1,
    actions: [{ at: to - 1000, residentId: 'res:l', action: 'read_gauge' }] } as any);
  if (r.status === 'failed') { console.log('FAIL', JSON.stringify(r.diagnostics).slice(0, 300)); break; }
  for (const o of r.observations) if (typeof o.value === 'number') reads.push({ t: nx, mark: o.value as number, air: islandWeather(real)!.air, run: runN });
  const c = (r.state as any)?.data?.condition;
  if (c && c !== 'ok') { stops.push(+((nx - T0) / 3.6e6).toFixed(1)); st = 'wait'; runN++; } else st = r.state;
  real = nx;
}
// storms as residents.ts counts them (a return within an island day is the same storm)
const storms: { at: number; end?: number }[] = [];
for (let t = T0; t < T0 + END * 3.6e6; t += 60_000) { const w = islandWeather(t)!, last = storms[storms.length - 1];
  if (w.typhoon) { if (!last || last.end !== undefined && t - last.end >= DAY) storms.push({ at: t }); else if (last.end !== undefined && t - last.end < DAY) last.end = undefined; }
  else if (last && last.end === undefined) last.end = t; }
// hypo3: the rise over an island day, less Lantern's own warmth coefficient times the warming over that day
const H = (t: number) => +((t - T0) / 3.6e6).toFixed(1);
const ago = (i: number) => { const t = reads[i].t - DAY; let b = -1; for (let j = i; j >= 0; j--) { if (reads[j].run !== reads[i].run) break; if (Math.abs(reads[j].t - t) < DAY * 0.5 && (b < 0 || Math.abs(reads[j].t - t) < Math.abs(reads[b].t - t))) b = j; } return b; };
const dm: number[] = [], da: number[] = [];
let k = 0, h3: any = null; const notes: string[] = []; const sc = { hits: 0, falses: 0, misses: 0, leads: [] as number[] };
const SS = storms.map((s) => ({ ...s, caught: false, settled: false, seen: false })); let status = "testing", firstJudge: any = null, first: any = null;
const judge = (t: number) => { const wrong = sc.falses + sc.misses, s = sc.hits >= 2 && sc.hits >= wrong ? 'held' : wrong >= 3 && sc.hits * 2 < wrong ? 'doubted' : 'testing'; if (s !== status) { status = s; notes.push(`${H(t)}h ${s} (${sc.hits}/${sc.falses}/${sc.misses})`); if (!firstJudge && s !== 'testing') firstJudge = { at: H(t), s }; } };
let alarm: any = null, mark = 0; const resid: number[] = [];
for (let i = 0; i < reads.length; i++) {
  const t = reads[i].t;
  // settle alarms and storms as hypoTick
  if (h3 && alarm && t - alarm.at > DAY) { if (!alarm.matched) { sc.falses++; first ??= { at: H(t), what: "false" }; mark = Math.max(mark, alarm.mark + 2); judge(t); } alarm = null; }
  for (const s of SS) if (h3 && s.at >= h3.at) {
    if (!s.seen && t >= s.at) { s.seen = true; if (alarm && !alarm.matched && s.at - alarm.at <= DAY) { s.caught = true; alarm.matched = true; sc.leads.push(Math.round((s.at - alarm.at) / 3.6e6 * ISLAND_RATE)); } }
    if (!s.settled && s.end !== undefined && t - s.end > DAY) { s.settled = true; if (s.caught) sc.hits++; else sc.misses++; first ??= { at: H(t), what: s.caught ? "hit" : "miss" }; judge(t); } }
  if (i > 0 && reads[i - 1].run === reads[i].run) { dm.push(reads[i].mark - reads[i - 1].mark); da.push(reads[i].air - reads[i - 1].air); }
  const j = ago(i); if (j < 0) continue;
  if (dm.length > 4) { let sxy = 0, sxx = 0; for (let n = 0; n < dm.length; n++) { sxy += dm[n] * da[n]; sxx += da[n] * da[n]; } k = sxx > 0 ? sxy / sxx : 0; }
  const r = (reads[i].mark - reads[j].mark) - k * (reads[i].air - reads[j].air); resid.push(r);
  if (!h3) { if (resid.length >= 16) { mark = Math.round(Math.max(...resid)) + 2; h3 = { at: t, k: +k.toFixed(2), mark }; } continue; }
  if (alarm || r < mark) continue;
  alarm = { at: t, mark: Math.round(r) };
  const inS = SS.find((s) => t >= s.at && (s.end === undefined || t <= s.end));
  if (inS) { alarm.matched = true; if (!inS.caught) { inS.caught = true; sc.leads.push(-Math.round((t - inS.at) / 3.6e6 * ISLAND_RATE)); } }
}
// what the pot showed before and during each storm
const per = storms.map((s) => { const e = s.end ?? T0 + END * 3.6e6, pre = reads.filter((r) => r.t >= s.at - DAY && r.t < s.at), dur = reads.filter((r) => r.t >= s.at && r.t <= e);
  const rises = (xs: typeof reads) => xs.filter((r, n) => n > 0 && r.mark > xs[n - 1].mark).length;
  return { at: H(s.at), end: H(e), preN: pre.length, preMax: pre.length ? Math.max(...pre.map((r) => r.mark)) : null, preRises: rises(pre), durN: dur.length, durMax: dur.length ? Math.max(...dur.map((r) => r.mark)) : null, durRises: rises(dur), dur2: dur.filter((r) => r.mark >= 2).length }; });
const out = { placed: P, reads: reads.length, stops, storms: per, h3: h3 && { ...h3, at: H(h3.at), kFinal: +k.toFixed(2), markFinal: mark }, score: sc, status, firstJudge, first, notes, tail: reads.filter((r) => H(r.t) >= 674 && H(r.t) < 684).map((r) => [H(r.t), r.mark]) };
console.log(JSON.stringify(out));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ ...out, trace: reads.map((r) => [H(r.t), r.mark, r.air]) }));
process.exit(0);
