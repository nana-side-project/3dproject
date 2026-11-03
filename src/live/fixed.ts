// The drone fleet, stage 2 (viewer design MULTICAM.md §1, §3-1; owner 11/3: in before trial 5): fixed cameras at the
// island's places — 06 the house (the hut's place, from the island's first day, before it stands), 07 the beach (once
// the raft is laid there), 08 the firing ground (the fire pit, once a fire has burned there), 09 the field (once sown).
// Three at most, the first that are there in that order. Each stands where it was first put for the island's whole
// life (kept in this browser with the island's calendar, apart from what the residents know), 8–15 m off and 3–6 m up,
// where its place is not hidden and the fewest leaves lie between; it turns its head very slowly. What its band says is
// the world's own: who is there and what they are doing, else the thing's state now, else the place's name alone.
// Pure here; main.ts puts the camera there, director.ts chooses it, live.ts writes its band.
import { lineClear, inLeaves, type Ground, type SolidsLike, type Pose } from './fleet';

export type PlaceId = 'house' | 'beach' | 'fire' | 'field';
/** The places in their order (06–09): number, the island's word (none yet for the field), names. */
export const PLACES: { id: PlaceId; no: string; isl: string | null; ja: string; en: string }[] = [
  { id: 'house', no: '06', isl: 'hata', ja: '家', en: 'The house' },
  { id: 'beach', no: '07', isl: 'mau', ja: '浜', en: 'The beach' },
  { id: 'fire', no: '08', isl: 'hi', ja: '野焼きの場', en: 'The firing ground' },
  { id: 'field', no: '09', isl: null, ja: '畑', en: 'The field' },
];
export const FIXED_MAX = 3;
/** How near a resident is to be "here" for a place's band, and for its scene to begin with the place (m). */
export const HERE_M = 12;

export interface Spot { x: number; y: number; z: number }
/** Where each place's thing stands now, from the world's values as read (residents' places(), village): null while
 *  there is none yet (and none decided). */
export function placeSpots(w: { hut: Spot; pit: Spot; plots: { x: number; z: number; s: number }[]; raft: { x: number; z: number; parts: number }; fired: boolean }, h: (x: number, z: number) => number): Record<PlaceId, Spot | null> {
  const sown = w.plots.filter((p) => p.s > 0);
  const mid = sown.length ? { x: sown.reduce((a, p) => a + p.x, 0) / sown.length, z: sown.reduce((a, p) => a + p.z, 0) / sown.length } : null;
  return {
    house: w.hut,
    beach: Number.isFinite(w.raft.x) && w.raft.parts > 0 ? { x: w.raft.x, y: h(w.raft.x, w.raft.z), z: w.raft.z } : null,
    fire: w.fired ? w.pit : null,
    field: mid ? { x: mid.x, y: h(mid.x, mid.z), z: mid.z } : null,
  };
}
/** The places that have a camera now: those there, in order, three at most. */
export const placesOn = (spots: Record<PlaceId, Spot | null>) => PLACES.filter((p) => spots[p.id]).slice(0, FIXED_MAX);

/** Where a fixed camera stands for the thing at t (MULTICAM.md §1): of some forty points 8–15 m off and 3–6 m above its
 *  ground, those not in the ground or in a tree's crown, whose lines to the thing (its foot, middle and top, and a step
 *  either side) are clear of the ground and of what cannot be gone through; of those, the one with the most lines clear
 *  and the fewest leaves on them, about 11 m off and 4.5 m up — the same answer each time for the same island. */
export function placeFixed(t: Spot, T: Ground, solids?: SolidsLike | null, tall = 2.5): Pose | null {
  const g0 = t.y, aims = [0.3, tall * 0.5, tall].flatMap((up) => [-1.5, 0, 1.5].map((side) => ({ up, side })));
  let best: { s: number; p: Pose } | null = null;
  for (const d of [8, 10.5, 13, 15]) for (let k = 0; k < 12; k++) for (const up of [3, 4.5, 6]) {
    const a = (k / 12) * Math.PI * 2, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d, y = Math.max(g0 + up, T.h(x, z) + 1.5);
    if (inLeaves(T, x, y, z)) continue;
    let clear = 0, leaves = 0;
    for (const m of aims) {
      const px = t.x - Math.sin(a) * m.side, pz = t.z + Math.cos(a) * m.side, to = { x: px, y: g0 + m.up, z: pz };
      if (!lineClear({ x, y, z }, to, T, solids)) continue;
      clear++;
      for (let f = 0.1; f < 0.95; f += 0.1) if (inLeaves(T, x + (to.x - x) * f, y + (to.y - y) * f, z + (to.z - z) * f)) leaves++;
    }
    if (clear < aims.length * 0.6) continue;
    const s = clear * 10 - leaves * 2 - Math.abs(d - 11) - Math.abs(up - 4.5) * 0.5;
    if (!best || s > best.s + 1e-9) best = { s, p: { x, y, z, ang: a, off: 0, el: 0, dist: d, lx: t.x, ly: g0 + tall * 0.4, lz: t.z } };
  }
  return best?.p ?? null;
}
/** Its slow turn of the head (rad, about its line to the thing): a few degrees each way over a minute. */
export const panAt = (sec: number) => Math.sin((sec / 60) * Math.PI * 2) * 0.07;

/** What a fixed camera's band says of its place (MULTICAM.md §3-1): 1. those here (by the residents' order) — the first
 *  one's doing is the line, and who is here the small line; 2. none here: the thing as it is now; 3. neither: the
 *  place's name alone (the line empty). Never a count. */
export function placeWords(id: PlaceId, s: { here: string[]; built: number; roofN: number; hutN: number; raft: { parts: number; n: number; away: boolean }; firing: boolean; boiling: boolean; drying: boolean; lit: boolean; night: boolean }): string {
  if (id === 'house') {
    if (s.night && s.lit) return '灯りがともっている';
    return s.built <= 0 ? '' : s.built < s.roofN ? '建てている途中' : s.built < s.hutN ? '屋根まで' : 'できている';
  }
  if (id === 'beach') return s.raft.away ? '筏は海に出ている' : s.raft.parts <= 0 ? '' : s.raft.parts < s.raft.n ? '組みかけの筏' : '筏がある';
  if (id === 'fire') return s.firing || s.boiling ? '火が燃えている' : s.drying ? '器を乾かしている' : '';
  return '';
}
