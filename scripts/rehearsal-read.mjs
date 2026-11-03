// Reads a rehearsal log (src/ui/rehearsal-log.ts, ?rehearsal) and says how much of it had something worth watching
// (docs/rehearsal/CYCLES.md). Minute by minute, on the time in Japan:
//   strong  a subtitle (sub), a milestone card (card) put up on the live screen, or a trial's result with words to show
//           (not steps-done, its steps taken with nothing to check: not a result for PROGRAM.md §7-2)
//   weak    the status line changed (status)
// and the residents' trials (trial rows: begun, with words fit to show, and how they came out)
// (the day's log — event, shown true — is counted apart: it passed the log's own sifting, but the live screen does not
// put it up)
// It prints the share of minutes with a strong one, with either, the longest run with no strong one, the same share hour
// by hour, the calls to the model, the slow frames, how long each of the drone's ranks was on screen (cam rows) and how
// many of the tries' results were on screen (trial rows). Only minutes the app ran in are counted (it writes a row each
// second); a run is broken where it was not running. Nothing is sent anywhere.
// Usage: node scripts/rehearsal-read.mjs rehearsal-YYYYMMDD-HHMM.ndjson
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/rehearsal-read.mjs <rehearsal-….ndjson>'); process.exit(2); }
const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const minOf = (r) => r.jst.slice(0, 16);   // (YYYY-MM-DDTHH:MM, in Japan)
const step = (m) => new Date(Date.parse(m + ':00+09:00') + 60e3 + 9 * 3600e3).toISOString().slice(0, 16);
const alive = new Set(), strong = new Set(), weak = new Set(), n = { sub: 0, card: 0, shown: 0, status: 0, blank: 0, hidden: 0, error: 0 };
const trials = { start: 0, shown: 0, result: {}, blank: 0 }, sound = {}, cues = { sounded: {}, letGo: {}, hours: {} }, ai = { calls: 0, ok: 0, why: {}, models: {} }, slow = { n: 0, hidden: 0, parts: {} };
let first = '', last = '';
for (const r of rows) {
  if (!r.jst) continue;
  const m = minOf(r);
  if (!first || m < first) first = m; if (m > last) last = m; alive.add(m);   // (a minute the app ran in: it writes a row each second)
  if (r.t === 'sub') { n.sub++; strong.add(m); }
  else if (r.t === 'card') { n.card++; strong.add(m); }
  else if (r.t === 'event' && r.kind === 'cue') {   // (the notification sounds, PROGRAM.md §5-3: each sounded, or let go and why)
    const [c, why] = String(r.text).split('（鳴らさず：'); const k = r.shown ? 'sounded' : 'letGo', w = r.shown ? c : (why ?? '').replace(/）$/, '');
    cues[k][w] = (cues[k][w] ?? 0) + 1; if (r.shown && c !== 'first') cues.hours[m.slice(0, 13)] = (cues.hours[m.slice(0, 13)] ?? 0) + 1;
  }
  else if (r.t === 'event' && r.shown === true) n.shown++;
  else if (r.t === 'status') { n.status++; if (!r.text) n.blank++; weak.add(m); }
  else if (r.t === 'audio') sound[r.state] = (sound[r.state] ?? 0) + 1;
  else if (r.t === 'trial') { if (r.kind === 'start') { trials.start++; if (r.text) trials.shown++; } else { trials.result[r.result] = (trials.result[r.result] ?? 0) + 1; if (r.text && r.result !== 'steps-done') strong.add(m); if (!r.text) trials.blank++; } }   // (a result with words: strong, PROGRAM.md §7-2 — whether its resident was on the screen, the camera's rows will tell)
  else if (r.t === 'event' && r.kind === 'hidden') n.hidden++;
  else if (r.t === 'event' && r.kind === 'error') n.error++;
  else if (r.t === 'ai') {
    ai.calls++; if (r.ok) ai.ok++; else { const w = String(r.why ?? '?'); ai.why[w] = (ai.why[w] ?? 0) + 1; }
    const m = (ai.models[r.model ?? '?'] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    m.calls++; m.input += r.input ?? 0; m.output += r.output ?? 0; m.cacheRead += r.cacheRead ?? 0; m.cacheWrite += r.cacheWrite ?? 0;
  } else if (r.t === 'slow') {
    slow.n++; if (r.hidden) slow.hidden++;
    else for (const [k, v] of Object.entries(r.parts ?? {})) slow.parts[k] = (slow.parts[k] ?? 0) + v;
  }
}
if (!first) { console.log('no rows'); process.exit(1); }
const mins = []; let span = 0; for (let m = first; m <= last; m = step(m)) { span++; if (alive.has(m)) mins.push(m); }
const pct = (a, b) => `${a}/${b} (${b ? Math.round(a / b * 100) : 0}%)`;
let run = 0, best = 0, bestAt = '';
let prev = '';
for (const m of mins) { if (prev && step(prev) !== m) run = 0; prev = m; if (strong.has(m)) run = 0; else if (++run > best) { best = run; bestAt = m; } }
const bestFrom = mins[mins.indexOf(bestAt) - best + 1];
console.log(`${file}: ${first.replace('T', ' ')} – ${last.replace('T', ' ')} (JST), ${mins.length} minutes running${span > mins.length ? ` (${span - mins.length} with nothing written: not running)` : ''}`);
console.log(`minutes with a strong one (subtitle, card, trial result): ${pct(mins.filter((m) => strong.has(m)).length, mins.length)}`);
console.log(`minutes with either (or the status line changing):      ${pct(mins.filter((m) => strong.has(m) || weak.has(m)).length, mins.length)}`);
console.log(`longest run with no strong one: ${best} min${best ? ` (${bestFrom.slice(11)}–${bestAt.slice(11)})` : ''}`);
console.log(`counts: subtitles ${n.sub}, cards ${n.card}, status changes ${n.status} (to blank ${n.blank}); the day's log (not on the live screen) ${n.shown}; tab hidden ${n.hidden}, errors ${n.error}`);
console.log(`sound (a row a minute): ${Object.keys(sound).length ? Object.entries(sound).map(([k, v]) => `${k} ${v} min`).join(', ') : 'not written (a log from before it was)'}`);
{ const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0), list = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', '), most = Math.max(0, ...Object.values(cues.hours));
  console.log(`notification sounds: sounded ${sum(cues.sounded)}${sum(cues.sounded) ? ` (${list(cues.sounded)})` : ''}; let go ${sum(cues.letGo)}${sum(cues.letGo) ? ` (${list(cues.letGo)})` : ''}; most in an hour, the cards' aside: ${most}`); }
console.log(`trials begun: ${trials.start} (with words fit to show ${trials.shown}); results: ${Object.entries(trials.result).map(([k, v]) => `${k} ${v}`).join(', ') || '—'} (with no words to show ${trials.blank})`);
console.log('hour by hour (strong / either):');
const hours = [...new Set(mins.map((m) => m.slice(0, 13)))];
for (const h of hours) { const hm = mins.filter((m) => m.startsWith(h)); console.log(`  ${h.slice(5).replace('T', ' ')}時  ${pct(hm.filter((m) => strong.has(m)).length, hm.length)}  ${pct(hm.filter((m) => strong.has(m) || weak.has(m)).length, hm.length)}`); }
console.log(`model calls: ${ai.calls}, ok ${ai.ok}${Object.keys(ai.why).length ? `; failed: ${Object.entries(ai.why).map(([k, v]) => `${k} ×${v}`).join(', ')}` : ''}`);
// (tokens by model, for the cost: what each model's prices are is left to the reader — the cache's read and written are
// apart from the input, as the API counts them; a log from before they were written has none)
for (const [k, v] of Object.entries(ai.models)) console.log(`  ${k}: ${v.calls} calls; tokens in ${v.input}, out ${v.output}, cache read ${v.cacheRead}, cache written ${v.cacheWrite}`);
console.log(`slow frames (over 250 ms): ${slow.n} (${slow.hidden} while hidden); time in them by part: ${Object.entries(slow.parts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)} ms`).join(', ') || '—'}`);

// (the drone: how long each rank was on screen, from its cam rows — each one holds until the next, or until the app stopped
// writing for more than five seconds; and the tries' results that were on screen: a result row whose resident the drone
// was on then, or went to within RESULT_S seconds — PROGRAM.md §4-7, §7-2)
const RESULT_S = 10, ms = (r) => Date.parse(r.jst);
const cams = rows.filter((r) => r.t === 'cam').sort((a, b) => ms(a) - ms(b));
if (cams.length) {
  const ticks = rows.filter((r) => r.t === 'sec').map(ms).sort((a, b) => a - b);
  const until = (t0, t1) => {   // (the time the app ran between t0 and t1: its seconds, in steps of no more than 5 s)
    let s = 0, prev = t0;
    for (const t of ticks) { if (t <= t0) continue; if (t > t1) break; s += Math.min(5e3, t - prev); prev = t; }
    return s + Math.min(5e3, Math.max(0, t1 - prev));
  };
  const byPri = {}, lastAt = ticks.at(-1) ?? ms(cams.at(-1));
  cams.forEach((c, i) => { const end = i + 1 < cams.length ? ms(cams[i + 1]) : lastAt; byPri[c.pri] = (byPri[c.pri] ?? 0) + until(ms(c), end); });
  const total = Object.values(byPri).reduce((a, b) => a + b, 0) || 1, NAME = { 1: '1 decided/result/first', 2: '2 together/talking', 3: '3 work', 4: '4 sea', 5: '5 looking back', 6: '6 at rest' };
  console.log(`the drone (cam rows ${cams.length}): ${Object.keys(byPri).sort().map((p) => `${NAME[p] ?? p} ${(byPri[p] / 60e3).toFixed(1)} min (${Math.round(byPri[p] / total * 100)}%)`).join(', ')}`);
  // (the drone fleet, ADR 0010 / MULTICAM.md §5: a shot is a cam row with another one than the row before it. Each camera's
  // time, the shots an hour, a shot's length on average by day (6–21 h) and by night, the ones passed over for not being
  // seen (cam-skip rows: written once a minute at most for each), and the cuts through the sky (cam-sky rows))
  const DORON = { dot: '01', rakko: '02', kame: '03', lantern: '04' }, shots = cams.filter((c, i) => i === 0 || c.who !== cams[i - 1].who);
  const byCam = {}, lens = { day: [], night: [] };
  shots.forEach((c, i) => { const end = i + 1 < shots.length ? ms(shots[i + 1]) : lastAt, len = until(ms(c), end), k = `${DORON[c.who] ?? '13'} ${c.who}`; byCam[k] = (byCam[k] ?? 0) + len; const h = new Date(ms(c) + 9 * 3600e3).getUTCHours(); (h >= 6 && h < 21 ? lens.day : lens.night).push(len); });
  const camTotal = Object.values(byCam).reduce((a, b) => a + b, 0) || 1, hours = until(ms(cams[0]), lastAt) / 3600e3 || 1, avg = (a) => (a.length ? `${(a.reduce((x, y) => x + y, 0) / a.length / 1e3).toFixed(0)} s (${a.length})` : '—');
  const skips = rows.filter((r) => r.t === 'event' && r.kind === 'cam-skip').length, skies = rows.filter((r) => r.t === 'event' && r.kind === 'cam-sky' && !String(r.text).startsWith('→')).length;
  const sides = rows.filter((r) => r.t === 'event' && r.kind === 'cam-side').length;   // (cut to another side of the one on air, hidden from where it was)
  console.log(`the cameras: ${Object.keys(byCam).sort().map((k) => `${k} ${(byCam[k] / 60e3).toFixed(1)} min (${Math.round(byCam[k] / camTotal * 100)}%)`).join(', ')}`);
  console.log(`  shots ${shots.length}, ${(shots.length / hours).toFixed(1)} an hour; a shot on average: day ${avg(lens.day)}, night ${avg(lens.night)}; through the sky ${skies}; to another side, hidden ${sides}; passed over, not seen ${skips} (${Math.round(skips / Math.max(1, skips + shots.length) * 100)}% of the choices)`);
  const results = rows.filter((r) => r.t === 'trial' && r.kind === 'result' && r.result !== 'steps-done');   // (§7-2: steps-done is not counted)
  if (results.length) {
    const onAt = (t) => { let who = ''; for (const c of cams) { if (ms(c) > t) break; who = c.who; } return who; };
    const seen = results.filter((r) => onAt(ms(r)) === r.who || cams.some((c) => c.who === r.who && ms(c) >= ms(r) && ms(c) - ms(r) <= RESULT_S * 1e3));
    console.log(`tries' results on screen: ${seen.length}/${results.length} (${Math.round(seen.length / results.length * 100)}%)`);
  } else console.log("tries' results on screen: no trial rows (the trials' screen writes them)");
}
