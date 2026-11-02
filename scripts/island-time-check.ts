// Headless check (ADR 0006, 0007): Dot's world's own time and weather.
//  1 the calendar: an island year is four real weeks; it began on island June 1st; the day keeps the real clock
//  2 the weather: the Earth's past record replayed on the island's calendar — a typhoon in the first island summer
//  3 a typhoon on the island: everyone takes shelter, the evening custom waits; once it passes the beds and the rocky
//    bottom are torn up, something washes up, and each has it in its record
//  5 the sea's seasons on the island's calendar (science on #166, #212): what comes by the season — the whales' months,
//    a manta's months — and the sea's warmth go by the island's month in Dot's world, the day's draws (a manta's day, the
//    day's lot of fish) by the real day: the island's month as at that real day's noon, the real day's date — a manta's
//    day never changes within a real day, and comes about as often as its month says. The Earth's seas keep the Earth's
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/island-time-check.ts
import * as THREE from 'three';
import { makeResidents } from '../src/robots/residents';
import { Solids } from '../src/robots/solids';
import { mulberry32 } from '../src/core/math';
import { skyState, seaTemp } from '../src/time/clock';
import { DOTWORLD, LOCATIONS } from '../src/data/locations';
import { mantaDay } from '../src/eco/events';
import { ISLAND_RATE, islandDate, islandWait, islandWeather, loadIslandWeather, type IslandWeather } from '../src/world/island-time';

let bad = 0;
const want = (what: string, ok: boolean, got = '') => { if (!ok) bad++; console.log(`${what}: ${got} ${ok ? 'ok' : 'FAIL'}`); };
const t0 = Date.parse('2026-10-05T00:00:00+09:00'), H = 3.6e6;

{ // 1 the calendar
  const a = islandDate(t0), b = islandDate(t0 + 28 * 24 * H), wk = islandDate(t0 + 7 * 24 * H);
  want('1 it began on island June 1st, year 1, summer', a.year === 1 && a.month === 6 && a.day === 1 && a.season === '夏', a.label);
  want('1 four real weeks are an island year', b.year === 2 && b.month === 6 && b.day === 1, b.label);
  want('1 a real week is about a season (91 island days)', Math.abs(wk.dayOfYear - a.dayOfYear - 91) <= 1, wk.label);
  want('1 what is only waited for runs at the same rate', Math.abs(islandWait(ISLAND_RATE * H) - H) < 1);
}
await loadIslandWeather();
let typhoonAt = 0;
{ // 2 the weather
  const w = islandWeather(t0)!;
  want('2 the record is there: measured at the station (JMA Ishigaki), with its original time', !!w && w.ok && w.record.station === 'jma-47918' && w.pressureMeasured! > 900 && /^2024-06-01T00:00/.test(w.record.at), w ? `${w.pressureMeasured} hPa at ${w.record.at}` : 'none');
  for (let m = 0; m < 28 * 24 * 60 && !typhoonAt; m += 10) if (islandWeather(t0 + m * 60e3)!.typhoon) typhoonAt = t0 + m * 60e3;
  const d = typhoonAt ? islandDate(typhoonAt) : null, tw = typhoonAt ? islandWeather(typhoonAt)! : null;
  want('2 a typhoon in the first island summer, from the record (low pressure, gale)', !!d && d.month === 7 && tw!.pressure < 996 && tw!.gust >= 20, d ? `${d.label} ${tw!.pressure} hPa, gusts ${tw!.gust} m/s` : 'none');
}
{ // 3 a typhoon on the island
  let now = Date.parse('2026-10-03T01:00:00Z'); Date.now = () => now; Math.random = mulberry32(5);
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }), getElementById: () => null } });
  const f = (x: number) => (x < 0 || x > 300 ? -3 : 2), T: any = { ground: f, floor: f, top: f, landCover: () => ({ can: 0, sand: 1 }), vegH: () => 0, solids: new Solids() };
  const R: any = makeResidents({ id: 'kayama', lat: 24.37, lon: 124.03, f } as any, T, ['テスト魚'], ['テスト鳥']);
  R.setBrain(null);
  // Lantern's real-island home (x = 405) is sea in this fixture; keep the walker on land and the animals in the sea.
  const lantern = R.list.find((r: any) => r.id === 'lantern');
  lantern.sp.home = [260, lantern.sp.home[1]]; lantern.pos.set(lantern.sp.home[0], f(lantern.sp.home[0]), lantern.sp.home[1]);
  want('3 walking residents start and shelter on dry ground', R.list.filter((r: any) => !r.sp.swims).every((r: any) => f(r.pos.x) > 0.3 && f(r.sp.home[0]) > 0.3));
  const run = (secs: number) => { for (let i = 0; i < secs * 4; i++) { now += 250; R.update(0.25, now, new THREE.Vector3(0, 50, 0)); } };
  run(5);
  const fair = { ...islandWeather(t0)!, typhoon: false } as IslandWeather, gale = { ...fair, typhoon: true, pressure: 985, gust: 33, wind: 18 } as IslandWeather;
  const grass0 = R.beds.map((b: any) => b.grass), stock0 = R.patches.reduce((n: number, p: any) => n + Object.values(p.stock).reduce((a: number, b: any) => a + b, 0), 0);
  R.setWeather(fair); run(5);
  R.setWeather(gale); run(10);
  want('3 in a typhoon everyone takes shelter', R.list.every((r: any) => r.task?.kind === 'shelter'), R.list.map((r: any) => `${r.id}:${r.task?.kind}`).join(' '));
  want('3 …and each has it in its record', R.list.every((r: any) => r.diary.some((e: any) => e.key === 'weather' && /台風が来た/.test(e.text))));
  R.setWeather(fair); run(5);
  const grass1 = R.beds.map((b: any) => b.grass), stock1 = R.patches.reduce((n: number, p: any) => n + Object.values(p.stock).reduce((a: number, b: any) => a + b, 0), 0);
  want('3 once it has passed, no one is still sheltering', R.list.every((r: any) => r.task?.kind !== 'shelter'));
  want('3 the beds and the rocky bottom are torn up', grass1.every((g: number, i: number) => g < grass0[i] * 0.5 + 1e-6) && stock1 <= stock0 / 2 + R.patches.length, `grass ${grass0.map((g: number) => g.toFixed(2))} → ${grass1.map((g: number) => g.toFixed(2))}, prey ${stock0} → ${stock1}`);
  want('3 …and it is in their record that it passed', R.list.every((r: any) => r.diary.some((e: any) => e.key === 'weather' && /台風が過ぎた/.test(e.text))));
}
{ // 4 the sea in the record: the swell, its period and where it comes from, and the thunder rule
  const ty = islandWeather(Date.parse('2026-10-08T16:40:00Z'))!;   // (island July 24th: the record's typhoon, 2024-07-24)
  want('4 every hour has its sea: wave, swell, period, direction', [ty.wave, ty.swell, ty.swellPeriod, ty.swellDir].every((x) => typeof x === 'number'), `wave ${ty.wave} m, swell ${ty.swell} m every ${ty.swellPeriod} s from ${ty.swellDir}°`);
  want('4 the typhoon\'s sea is high and long', (ty.wave ?? 0) > 3 && (ty.swellPeriod ?? 0) >= 9);
  // (a long swell runs ahead of the deep ones: in the two island days before they came in, the swell's period passed 9 s
  // — for most, not all; and long swells come with no storm after them too)
  const W2 = islandWait(48 * 3.6e6); let was = false, last = -1e15, deep = 0, ahead = 0;
  for (let t = t0; t < t0 + 84 * 86400e3; t += 300e3) {
    const w = islandWeather(t)!;
    if (w.typhoon && !was && t - last > W2 && w.pressure < 996) { deep++; for (let u = t - W2; u < t; u += 300e3) if ((islandWeather(u)!.swellPeriod ?? 0) >= 9) { ahead++; break; } }
    if (w.typhoon) last = t; was = w.typhoon;
  }
  want('4 most deep typhoons have a long swell before them', deep >= 3 && ahead * 2 > deep, `${ahead} of ${deep}`);
  let n = 0, th = 0; for (let t = t0; t < t0 + 28 * 86400e3; t += 1800e3) { n++; if (islandWeather(t)!.thunder) th++; }
  want('4 thunder now and then, not often (a typhoon in heavy rain, or a downpour)', th > 0 && th / n < 0.02, `${(th / n * 100).toFixed(2)}% of the time`);
}
{ // 5 the sea's seasons on the island's calendar
  const kayama = LOCATIONS.find((l) => l.id === 'kayama')!, a = skyState(t0, DOTWORLD), e = skyState(t0, kayama);
  want('5 Dot\'s world: the island\'s month (June) and the real day (the 5th); Kayama on the Earth: October 5th', a.month === 6 && a.mday === 5 && e.month === 10 && e.mday === 5, `${a.month}/${a.mday}, ${e.month}/${e.mday}`);
  const jst = (t: number) => new Date(t + 9 * H), dayOf = (t: number) => jst(t).toISOString().slice(0, 10), noon = (t: number) => Date.parse(`${dayOf(t)}T12:00:00+09:00`);
  let asNoon = true, realDay = true, months = new Set<number>(); const perDay = new Map<string, Set<string>>();
  for (let t = t0; t < t0 + 28 * 24 * H; t += H / 4) {
    const s = skyState(t, DOTWORLD);
    if (s.month !== islandDate(noon(t)).month) asNoon = false;
    if (s.mday !== jst(t).getUTCDate()) realDay = false;
    months.add(s.month); (perDay.get(dayOf(t)) ?? perDay.set(dayOf(t), new Set()).get(dayOf(t))!).add(`${s.month}-${s.mday}:${mantaDay(DOTWORLD, s)}`);
  }
  const changed = [...perDay.values()].filter((v) => v.size > 1).length;
  want('5 every quarter hour through an island year: the island\'s month as at the real day\'s noon, the real day; all twelve months', asNoon && realDay && months.size === 12, `${months.size} months`);
  want('5 a manta\'s day does not change within a real day', changed === 0, `${changed} of ${perDay.size} real days changed`);
  // (how often: three real years of days, each by its island month's chance — 0.35 for the winter months, 0.5 for May to October)
  const by: Record<string, [number, number]> = {};
  for (let d = 0; d < 3 * 365; d++) { const t = Date.parse('2026-10-05T12:00:00+09:00') + d * 24 * H, s = skyState(t, DOTWORLD), p = DOTWORLD.mantaPass!.p[s.month - 1], k = p.toFixed(2); by[k] ??= [0, 0]; by[k][0]++; if (mantaDay(DOTWORLD, s)) by[k][1]++; }
  const near = Object.entries(by).every(([p, [n, y]]) => Math.abs(y / n - +p) < 0.08);
  want('5 a manta\'s day as often as its island month says (a real day each, not thirteen draws)', near && (by['0.35']?.[0] ?? 0) > 100, Object.entries(by).map(([p, [n, y]]) => `p ${p}: ${y}/${n}`).join(', '));
  const t1 = Date.parse('2026-10-19T12:00:00+09:00'), d1 = islandDate(t1), p = DOTWORLD.mantaPass!.p;
  want('5 a manta\'s months by the island\'s: mid-October on the Earth is early December on the island (0.35, not 0.5)', p[skyState(t1, DOTWORLD).month - 1] === 0.35 && p[skyState(t1, kayama).month - 1] === 0.5, `${d1.label}`);
  let warm = t0, hi = -1; for (let t = t0; t < t0 + 28 * 24 * H; t += H) { const c = seaTemp(t, DOTWORLD.lat, DOTWORLD.tempYear!, DOTWORLD.world); if (c > hi) { hi = c; warm = t; } }
  const w = islandDate(warm);
  want('5 the sea is warmest in the island\'s late August', w.month === 8 && w.day >= 15, `${w.label} ${hi.toFixed(1)}°C`);
}
console.log(bad ? `FAIL (${bad})` : 'PASS');
process.exit(bad ? 1 : 0);
