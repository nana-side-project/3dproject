// The night the reef spawns at Kayama (science: specs/kayama-sea-r031.md §3 and the owner's decisions of 2026-10-27 and
// 2026-11-02). In the Sekisei lagoon the Acropora spawn on a night from three days before the full moon of May to two
// days after it (a June full moon in some years), one to four hours after sunset.
// - Dot's world (owner, 2026-11-02, plan C): the island's months 4 to 6, the real moon 3 days before to 2 days after
//   full, 1 to 4 hours after the real sunset; at most one night an island year — the first in the window that has it
//   all. (An island month is some 2.3 real days and the moon keeps the real month, so some island years have none.)
// - The Earth's Kayama: 3 nights before May's full moon (the first dated in May) to 2 after — or June's, in a year whose
//   May full moon comes in the first week of May (proposed: the sea not yet warm enough so early) — 1 to 4 hours after
//   sunset; one night a year, the first in the window.
// A world's fact, the same for everyone who looks: worked out from the real moment alone, nothing drawn at random.
import { sunEvents } from '../time/clock';
import { moon } from '../time/astro';
import { islandDate } from '../world/island-time';

interface Site { lat: number; lon: number; tz: number; tide: { amp: number; lag: number }; world?: string }
const DAY = 86400000, HOUR = 3600000, HALF = 29.530589 / 2;

/** Days from the nearest full moon at this moment: negative before it, positive after. */
export function fromFull(ms: number, site: Site) { return moon(ms, site.lat, site.lon).age - HALF; }

/** The evening of the site's local day that this moment falls in: from an hour after sunset to four hours after. */
function evening(ms: number, site: Site): [number, number] {
  const set = sunEvents(ms, site).set;
  return [set + HOUR, set + 4 * HOUR];
}

const local = (ms: number, site: Site) => new Date(ms + site.tz * HOUR);
/** The Earth's spawning full moon this year (its local date): May's (the first dated in May) — or, when that comes in
 *  the first week of May, the next, in June. */
function earthFull(year: number, site: Site) {
  const may1 = Math.floor(Date.UTC(year, 4, 1) / DAY), may31 = may1 + 30;
  let fd = Infinity;
  for (const d of [0, 10, 20, 30]) { const f = fullDay((may1 + d) * DAY + 12 * HOUR - site.tz * HOUR, site); if (f >= may1 && f <= may31) fd = Math.min(fd, f); }
  return fd - may1 < 7 ? fullDay((fd + 29.5) * DAY + 12 * HOUR - site.tz * HOUR, site) : fd;
}
/** The local date (days since 1970) of a moment. */
const dayNo = (ms: number, site: Site) => Math.floor((ms + site.tz * HOUR) / DAY);
/** The local date of the full moon nearest this moment. */
function fullDay(ms: number, site: Site) {
  let t = ms - fromFull(ms, site) * DAY;
  for (let k = 0; k < 3; k++) t -= fromFull(t, site) * DAY;   // (again: the moon's pace is not even — to within minutes)
  return dayNo(t, site);
}
/** How many nights this night is from the full moon's: by local date, -3 (three before) .. +2 (two after). */
export function nightsFromFull(mid: number, site: Site) { return dayNo(mid, site) - fullDay(mid, site); }
/** Whether this night (the middle of its evening) is in the season and the moon: not yet whether it is the first.
 *  The season is the month of the real day at noon — in Dot's world the island's month then (as the sea's env.month). */
function fits(mid: number, site: Site) {
  const noon = dayNo(mid, site) * DAY + 12 * HOUR - site.tz * HOUR;
  if (!site.world) { const n = dayNo(mid, site) - earthFull(local(noon, site).getUTCFullYear(), site); return n >= -3 && n <= 2; }
  const n = nightsFromFull(mid, site);
  if (n < -3 || n > 2) return false;
  const m = islandDate(noon).month; return m >= 4 && m <= 6;
}
/** Which year the night belongs to (the island's year in Dot's world). */
const yearOf = (mid: number, site: Site) => { const noon = dayNo(mid, site) * DAY + 12 * HOUR - site.tz * HOUR; return site.world ? islandDate(noon).year : local(noon, site).getUTCFullYear(); };

const cache = new Map<string, [number, number] | null>();
/** The spawning night's evening, if this moment is in it: [start, end] (ms), or null. */
export function spawnWindow(ms: number, site: Site): [number, number] | null {
  const [a, b] = evening(ms, site);
  if (ms < a || ms > b) return null;
  const key = `${site.world ?? 'earth'}:${site.lat}:${site.lon}:${a}`;
  if (cache.has(key)) return cache.get(key)!;
  const mid = (a + b) / 2;
  let ok = fits(mid, site);
  // the first such night of its year: none on the nights before it, back to the year's start (or the season's)
  for (let k = 1; ok && k <= 40; k++) {
    const [pa, pb] = evening(mid - k * DAY, site), pm = (pa + pb) / 2;
    if (yearOf(pm, site) !== yearOf(mid, site)) break;
    if (fits(pm, site)) ok = false;
  }
  const w: [number, number] | null = ok ? [a, b] : null;
  if (cache.size > 64) cache.clear();
  cache.set(key, w);
  return w;
}
