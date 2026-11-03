// science probe: the chosen night against an independent pick — nights listed by the local noon of each day
import { spawnWindow, nightsFromFull } from '../src/eco/spawn';
import { islandDate, setIslandEpoch } from '../src/world/island-time';
import { DOTWORLD } from '../src/data/locations'; const site: any = DOTWORLD;
const DAY = 864e5, H = 36e5;
let bad = 0, years = 0, chosen = 0;
for (const ep of ['2026-11-12T08:00:00+09:00', '2026-11-19T08:00:00+09:00', '2026-12-05T08:00:00+09:00', '2026-10-05T00:00:00+09:00']) {
  setIslandEpoch(Date.parse(ep));
  const start = Date.parse(ep), byYear = new Map<number, { d: number; n: number; got: boolean }[]>();
  for (let d = 0; d < 365 * 4; d++) {
    const noon = Math.floor((start + site.tz * H) / DAY) * DAY + d * DAY + 12 * H - site.tz * H;
    const y = islandDate(noon).year, m = islandDate(noon).month;
    let got = false; for (let t = noon + 4 * H; t < noon + 14 * H; t += 10 * 60e3) if (spawnWindow(t, site)) { got = true; break; }
    const n = nightsFromFull(noon + 8 * H, site);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push({ d, n: m >= 4 && m <= 6 && n >= -3 && n <= 2 ? n : 99, got });
  }
  for (const [y, xs] of byYear) { years++; const c = xs.filter((x) => x.n !== 99); const best = c.length ? c.reduce((a, b) => (Math.abs(b.n) < Math.abs(a.n) ? b : a)) : null; const g = xs.filter((x) => x.got);
    chosen += g.length; if (g.length > 1 || (best ? !(g.length === 1 && g[0].d === best.d) : g.length)) { bad++; if (bad < 6) console.log('MISMATCH', ep, y, JSON.stringify(c), JSON.stringify(g)); } }
}
console.log({ years, chosen, bad });
