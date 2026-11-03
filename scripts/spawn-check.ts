// The reef's spawning night at Kayama (eco/spawn.ts; specs/kayama-sea-r031.md, owner 2026-11-02 plan C). Every real
// night over many years, both worlds: is it the spawning night, and if so does it keep the rule —
// Dot's world: island months 4–6, the real moon 3 days before to 2 days after full, its evening 1–4 h after the real
// sunset, at most one night an island year (science's figures: some 41 % of island years have one; the longest real
// gap some 336 days). The Earth: by May's full moon (June's in a year whose May full moon is in the first week of May),
// the same nights and hours, exactly one night a year. Also that the sea's rare event on that evening is the spawning, and never on
// another evening at Kayama.
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/spawn-check.ts   (env ISLAND_YEARS 600, EARTH_YEARS 80)
import { spawnWindow, nightsFromFull as fromFull } from '../src/eco/spawn';
import { islandDate, ISLAND_EPOCH, setIslandEpoch } from '../src/world/island-time';
import { sunEvents } from '../src/time/clock';
import { LOCATIONS, DOTWORLD } from '../src/data/locations';
import { makeRareEvents } from '../src/eco/events';

const DAY = 86400000, HOUR = 3600000;
const earth: any = LOCATIONS.find((l) => l.id === 'kayama'), dot: any = DOTWORLD;
let fail = 0;
const bad = (what: string) => { fail++; if (fail < 20) console.log('  ✗', what); };

// Dot's world
{
  const Y = +(process.env.ISLAND_YEARS || 600), end = ISLAND_EPOCH + Y * 28 * DAY;
  const byYear = new Map<number, number[]>(), nights: number[] = [];
  for (let d = ISLAND_EPOCH; d < end; d += DAY) {
    const ev = sunEvents(d + 12 * HOUR, dot), mid = ev.set + 2.5 * HOUR, w = spawnWindow(mid, dot);
    if (!w) continue;
    const id = islandDate(ev.noon), f = fromFull(mid, dot);
    if (id.month < 4 || id.month > 6) bad(`dot: island month ${id.month}`);
    if (f < -3 || f > 2) bad(`dot: ${f} nights from full`);
    if (Math.abs(w[0] - (ev.set + HOUR)) > 1000 || Math.abs(w[1] - (ev.set + 4 * HOUR)) > 1000) bad('dot: not 1–4 h after sunset');
    // (outside the evening the same night: no)
    if (spawnWindow(ev.set + 0.5 * HOUR, dot) || spawnWindow(ev.set + 4.5 * HOUR, dot)) bad('dot: outside the evening');
    byYear.set(id.year, [...(byYear.get(id.year) ?? []), mid]); nights.push(mid);
  }
  const first = islandDate(ISLAND_EPOCH).year, last = islandDate(end).year - 1, years = last - first;
  for (const [y, l] of byYear) if (l.length > 1) bad(`dot: island year ${y} has ${l.length} nights`);
  let gap = 0; for (let i = 1; i < nights.length; i++) gap = Math.max(gap, (nights[i] - nights[i - 1]) / DAY);
  const share = byYear.size / years;
  if (share < 0.3 || share > 0.55) bad(`dot: ${(share * 100).toFixed(0)} % of island years`);
  console.log(`Dot's world: ${years} island years — a spawning night in ${byYear.size} (${(share * 100).toFixed(0)} %), longest real gap ${gap.toFixed(0)} days`);
}
// a new island (#225: its calendar begins afresh, on island June 1st, the moment it begins): the night follows its own
// calendar — asked again the same evening once the start has changed, the answer is the new island's, not the old one's
{
  const listFrom = (start: number, n: number) => {
    setIslandEpoch(start);
    const out: string[] = [];
    for (let d = start; out.length < n && d < start + 800 * DAY; d += DAY) {
      const ev = sunEvents(d + 12 * HOUR, dot), mid = ev.set + 2.5 * HOUR;
      if (spawnWindow(mid, dot)) out.push(new Date(mid + 9 * HOUR).toISOString().slice(0, 10));
    }
    return out;
  };
  const old = listFrom(ISLAND_EPOCH, 3), fresh = listFrom(Date.parse('2026-11-12T00:00:00+09:00'), 3);
  // (and back: the same answers as before the change)
  if (listFrom(ISLAND_EPOCH, 3).join() !== old.join()) bad('a new island: back on the first, its nights changed');
  if (fresh[0] !== '2027-05-22') bad(`a new island begun 11/12 0:00: first night ${fresh[0]} (science: 2027-05-22)`);
  setIslandEpoch(ISLAND_EPOCH);
  console.log(`a new island: begun 10/5 — ${old.join(', ')}; begun 11/12 0:00 — ${fresh.join(', ')}`);
}
// the Earth
{
  const Y = +(process.env.EARTH_YEARS || 80), y0 = 2026;
  let june = 0;
  for (let y = y0; y < y0 + Y; y++) {
    const got: number[] = [];
    for (let d = Date.UTC(y, 3, 1, 3); d < Date.UTC(y, 7, 1); d += DAY) {
      const ev = sunEvents(d, earth), mid = ev.set + 2.5 * HOUR;
      if (spawnWindow(mid, earth)) got.push(mid);
    }
    if (got.length !== 1) { bad(`earth ${y}: ${got.length} nights`); continue; }
    const m = new Date(got[0] + 9 * HOUR).getUTCMonth() + 1, f = fromFull(got[0], earth);
    // (the night's full moon: dated in May — after its first week — or in June)
    const fm = new Date(Date.UTC(1970, 0, 1) + (Math.floor((got[0] + 9 * HOUR) / DAY) - f) * DAY);
    if (!((fm.getUTCMonth() === 4 && fm.getUTCDate() > 7) || fm.getUTCMonth() === 5)) bad(`earth ${y}: by the full moon of ${fm.toISOString().slice(0, 10)}`);
    if (m < 4 || m > 6) bad(`earth ${y}: month ${m}`);
    if (f < -3 || f > 2) bad(`earth ${y}: ${f} nights from full`);
    if (m === 6) june++;
    if (process.env.LIST) console.log(`  ${y}: ${new Date(got[0] + 9 * HOUR).toISOString().slice(0, 10)} (${f >= 0 ? '+' : ''}${f} nights)`);
  }
  console.log(`the Earth: ${Y} years — one night each year; in June ${june}`);
}
// the sea's rare events at Kayama: the spawning only on that evening, and then all but surely the one chosen
{
  let on = 0, off = 0, wrong = 0;
  for (const loc of [dot, earth]) {
    const ev = makeRareEvents({ loc }), y = loc.world ? undefined : 2027;
    for (let d = loc.world ? ISLAND_EPOCH : Date.UTC(y!, 3, 20, 3); d < (loc.world ? ISLAND_EPOCH + 120 * DAY : Date.UTC(y!, 5, 20)); d += DAY) {
      const sv = sunEvents(d + 12 * HOUR, loc);
      for (const h of [0.5, 2.5, 6]) {
        const ms = sv.set + h * HOUR, night = spawnWindow(ms, loc);
        const env: any = { ms, t: 0, night: 1, day: 0, twilight: 0, month: 5, mday: 15 };
        const ks = ev.kinds(env), w = ks.find((k) => k.id === 'spawning')!.w, tot = ks.reduce((a, k) => a + k.w, 0);
        if (night) { on++; if (w / tot < 0.8) { wrong++; bad(`${loc.world ?? 'earth'}: spawning ${(w / tot * 100).toFixed(0)} % of the chances on its night`); } }
        else { off++; if (w > 0) { wrong++; bad(`${loc.world ?? 'earth'}: spawning possible on another evening`); } }
      }
    }
  }
  console.log(`the sea's rare events: ${on} moments on the night (spawning the likeliest), ${off} not (none) — ${wrong ? 'wrong ' + wrong : 'ok'}`);
}
console.log(fail ? `FAIL (${fail})` : 'PASS');
process.exit(fail ? 1 : 0);
