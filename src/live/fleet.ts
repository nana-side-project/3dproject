// The drone fleet, stage 1 (ADR 0010; viewer design MULTICAM.md, D35): a camera for each resident — 01 Dot, 02 Rakko,
// 03 Kamemaru, 04 Lantern — kept always, though only the one on air is drawn. Each knows where it would be (as the
// watching camera: behind its resident, a little above and to one side) and whether it sees its resident there. Only
// for the picture: nothing of it goes to a resident (ADR 0010 §5).

/** The camera's number for each resident (the band's `NN DORON`). */
export const DORON: Record<string, string> = { dot: '01', rakko: '02', kame: '03', lantern: '04' };

export interface Ground {
  h(x: number, z: number): number;                                  // the bare ground (or the sea's floor)
  over?: ((x: number, z: number) => number) | null;                 // ashore: the treetops (none: −1e9)
}
export interface Solid { x: number; z: number; r: number; y0: number; y1: number; kind?: string }
export interface SolidsLike { each(x: number, z: number, rad: number, f: (s: Solid) => void): void }
export interface Who { id: string; pos: { x: number; y: number; z: number }; head?: number; sp?: { living?: boolean } }
export interface Pose { x: number; y: number; z: number; ang: number; off: number; el: number; dist: number; lx: number; ly: number; lz: number }
export interface Sight { seen: boolean; leaves: number; why: '' | 'ground' | 'solid' | 'leaves' }

/** The watching camera's own: 5.5 m off, 0.3 rad up, 0.45 rad to one side of behind (main.ts watch). */
export const DIST = 5.5, EL = 0.3, OFF = 0.45;
/** The sides it may stand on, in turn: behind and to one side, the other side, further round, nearly at the side. */
export const OFFS = [OFF, -OFF, 1.1, -1.1, 1.8, -1.8];
/** Leaves on the way it may see through (m, the longest of its three lines): more, and it does not see. */
export const LEAVES_MAX = 3;
const STEP = 0.5;

/** Its middle and its head above its feet: a turtle is low, a robot taller (main.ts watch's mid). */
export const midOf = (r: Who) => (r.sp?.living ? 0.3 : 0.55);
export const headOf = (r: Who) => (r.sp?.living ? 0.55 : 1.05);

/** Where the camera for r stands at side off: as the watching camera — behind where it heads, a little above, clear of
 *  the ground — looking at its middle. */
export function poseFor(r: Who, T: Ground, off = OFF, dist = DIST, el = EL): Pose {
  const h = r.head ?? 0, fx = Math.sin(h), fz = Math.cos(h), ang = Math.atan2(-fz, -fx) + off;
  const ce = Math.cos(el), se = Math.sin(el), mid = midOf(r);
  const x = r.pos.x + Math.cos(ang) * ce * dist, z = r.pos.z + Math.sin(ang) * ce * dist;
  const y = Math.max(r.pos.y + mid + se * dist, T.h(x, z) + 0.3, 0.25);
  return { x, y, z, ang, off, el, dist, lx: r.pos.x, ly: r.pos.y + mid, lz: r.pos.z };
}

/** Inside a tree's crown at (x, y, z): under the treetops, above the bare trunks (the lower two fifths). */
export function inLeaves(T: Ground, x: number, y: number, z: number) {
  const top = T.over ? T.over(x, z) - 0.5 : -1e9; if (top < -1e8) return false;
  const g = T.h(x, z), tall = top - g;
  return tall > 1.2 && y < top && y > g + 0.4 * tall;
}

/** Whether the camera at p sees r: its head, middle and feet, three lines looked along each 0.5 m — the ground, what
 *  cannot be gone through (solids.ts: trunks, rocks, posts…) — and the leaves on the way (the longest line's, m). The
 *  last 0.4 m by r is not looked at (what it stands at, works at). */
export function sightOf(p: Pose, r: Who, T: Ground, solids?: SolidsLike | null): Sight {
  let leaves = 0;
  for (const up of [headOf(r), midOf(r), 0.08]) {
    const tx = r.pos.x, ty = r.pos.y + up, tz = r.pos.z;
    const L = Math.hypot(tx - p.x, ty - p.y, tz - p.z), n = Math.max(1, Math.floor((L - 0.4) / STEP));
    let lv = 0;
    for (let k = 1; k <= n; k++) {
      const f = (k * STEP) / L, x = p.x + (tx - p.x) * f, y = p.y + (ty - p.y) * f, z = p.z + (tz - p.z) * f;
      if (y < T.h(x, z) - 0.05) return { seen: false, leaves: Math.max(leaves, lv), why: 'ground' };
      let hit = false;
      solids?.each(x, z, 0.1, (s) => { if (!hit && y > s.y0 && y < s.y1 && Math.hypot(s.x - x, s.z - z) < s.r) hit = true; });
      if (hit) return { seen: false, leaves: Math.max(leaves, lv), why: 'solid' };
      if (inLeaves(T, x, y, z)) lv += STEP;
    }
    leaves = Math.max(leaves, lv);
  }
  return leaves > LEAVES_MAX ? { seen: false, leaves, why: 'leaves' } : { seen: true, leaves, why: '' };
}

/** Whether the line from a to b is clear of the ground and of what cannot be gone through (solids.ts) — looked along each
 *  0.5 m, the last 0.4 m by b not looked at. Leaves do not count (the plants in the way are seen through, #155): for the
 *  speech bubble, whether the speaker's head is in sight (BUBBLE.md §3). */
export function lineClear(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, T: Ground, solids?: SolidsLike | null): boolean {
  const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), n = Math.max(1, Math.floor((L - 0.4) / STEP));
  for (let k = 1; k <= n; k++) {
    const f = (k * STEP) / L, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, z = a.z + (b.z - a.z) * f;
    if (y < T.h(x, z) - 0.05) return false;
    let hit = false;
    solids?.each(x, z, 0.1, (s) => { if (!hit && y > s.y0 && y < s.y1 && Math.hypot(s.x - x, s.z - z) < s.r) hit = true; });
    if (hit) return false;
  }
  return true;
}

/** The camera for r: the side it stands on now if it sees from there, else the first side in turn that does; null when
 *  none does (hidden: not chosen). */
export function camFor(r: Who, T: Ground, solids?: SolidsLike | null, now = OFF): { pose: Pose; sight: Sight } | null {
  for (const off of [now, ...OFFS.filter((o) => o !== now)]) {
    const pose = poseFor(r, T, off), sight = sightOf(pose, r, T, solids);
    if (sight.seen) return { pose, sight };
  }
  return null;
}

/** How far apart two places are for the cut (m): within this, cut straight; further, through the sky (MULTICAM.md §3). */
export const NEAR_M = 60;
/** The sky between two places: high over the way between them, looking down the way to where it goes — 3–5 s. */
export function skyPose(from: { x: number; z: number }, to: { x: number; y: number; z: number }, T: Ground): Pose {
  const mx = from.x + (to.x - from.x) * 0.35, mz = from.z + (to.z - from.z) * 0.35;
  const y = Math.max(T.h(mx, mz), T.over ? T.over(mx, mz) : -1e9, 0) + 38;
  return { x: mx, y, z: mz, ang: 0, off: 0, el: 0, dist: 0, lx: to.x, ly: to.y, lz: to.z };
}
