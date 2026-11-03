import { loadIslandWeather, islandWeather, setIslandEpoch, islandDate } from '../src/world/island-time';
const T0 = Date.parse('2026-11-12T08:00:00+09:00'); setIslandEpoch(T0); await loadIslandWeather();
for (const h of [0, 97.6, 216, 266, 291, 360, 480, 670.2, 720]) { const t = T0 + h * 3.6e6, d = islandDate(t), w = islandWeather(t)!; console.log(h, JSON.stringify(d), 'air', w.air, 'p', w.pressureMeasured); }
let minP = 1e9, at = 0; for (let t = T0; t < T0 + 720 * 3.6e6; t += 6e5) { const p = islandWeather(t)!.pressureMeasured ?? 1e9; if (p < minP) { minP = p; at = t; } } console.log('minP', minP, (at - T0) / 3.6e6);
process.exit(0);
