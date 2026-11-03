// Headless check (ADR 0010, MULTICAM.md §2: the drone fleet's cameras see their residents — pure: src/live/fleet.ts):
//   A open ground: the camera behind and to one side sees its resident — head, middle, feet — no leaves on the way
//   B a trunk on the way: not from that side (solid); the camera stands on the other side instead
//   C a rise of the ground between: not seen (ground)
//   D leaves on the way: a little (under 3 m), seen and counted; much, not seen (leaves)
//   E nothing seen from any side (shut in by trunks all round): no camera — not chosen
//   F the sky between two places: high above the way, looking to where it goes
//   G for two seconds after a cut, nothing is out of sight and there is no "behind the camera" to put one (eco/unseen.ts:
//     unseen, behind), then as before
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/fleet-check.ts
import { poseFor, sightOf, camFor, skyPose, OFF, LEAVES_MAX, type Solid } from '../src/live/fleet';
import { unseen, behind, holdUnseen } from '../src/eco/unseen';

let bad = 0;
const want = (what: string, ok: boolean, got = '') => { if (!ok) bad++; console.log(`${what}: ${got} ${ok ? 'ok' : 'FAIL'}`); };
const flat = { h: () => 1, over: () => -1e9 };
const solids = (list: Solid[]) => ({ each: (x: number, z: number, rad: number, f: (s: Solid) => void) => { for (const s of list) if (Math.abs(s.x - x) < rad + s.r && Math.abs(s.z - z) < rad + s.r) f(s); } });
const dot = { id: 'dot', pos: { x: 0, y: 1, z: 0 }, head: 0, sp: { living: false } };   // (heading +z: behind it is −z)
{ // A
  const p = poseFor(dot, flat), s = sightOf(p, dot, flat, solids([]));
  const back = Math.hypot(p.x, p.z);
  want('A open ground: seen from behind and to one side, no leaves', s.seen && s.leaves === 0 && p.z < 0 && Math.abs(back - 5.5 * Math.cos(0.3)) < 0.01 && p.y > dot.pos.y, `at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}) ${JSON.stringify(s)}`);
}
{ // B
  const p = poseFor(dot, flat), mid = { x: p.x / 2, z: p.z / 2 };
  const trunk = solids([{ x: mid.x, z: mid.z, r: 0.35, y0: 1, y1: 9, kind: 'trunk' }]);
  const s = sightOf(p, dot, flat, trunk), c = camFor(dot, flat, trunk);
  want('B a trunk on the way: not from that side; from the other', !s.seen && s.why === 'solid' && !!c && c.pose.off === -OFF && c.sight.seen, `${s.why}; then off ${c?.pose.off}`);
}
{ // C
  const p = poseFor(dot, flat), hill = { h: (x: number, z: number) => (Math.hypot(x - p.x / 2, z - p.z / 2) < 0.8 ? 4 : 1), over: () => -1e9 };
  const s = sightOf(p, dot, hill, null);
  want('C a rise of the ground between: not seen', !s.seen && s.why === 'ground', JSON.stringify(s));
}
{ // D
  // (a crown over the middle of the way, its treetops at 4.2 m and its leaves from 2.1 to 3.7 m: the lines pass through it)
  const p = poseFor(dot, flat), low = (len: number) => ({ h: () => 1, over: (x: number, z: number) => (Math.hypot(x - p.x / 2, z - p.z / 2) < len / 2 ? 1 + 3.2 : -1e9) });
  const a = sightOf(p, dot, low(2), null), b = sightOf(p, dot, low(5), null);
  want('D a little leaves: seen, counted; much: not seen', a.seen && a.leaves > 0 && a.leaves <= LEAVES_MAX && !b.seen && b.why === 'leaves', `${JSON.stringify(a)} / ${JSON.stringify(b)}`);
}
{ // E
  const ring: Solid[] = []; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; ring.push({ x: Math.cos(a) * 2, z: Math.sin(a) * 2, r: 0.45, y0: 0, y1: 12, kind: 'trunk' }); }
  const c = camFor(dot, flat, solids(ring));
  want('E shut in all round: no camera', c === null, c ? `off ${c.pose.off}` : 'none');
}
{ // F
  const to = { x: 200, y: 1, z: 40 }, s = skyPose({ x: 0, z: 0 }, to, flat);
  want('F the sky between: high above the way, looking to where it goes', s.y > 30 && s.x > 0 && s.x < to.x && s.lx === to.x && s.lz === to.z, `at (${s.x.toFixed(0)}, ${s.y.toFixed(0)}, ${s.z.toFixed(0)})`);
}
{ // G
  let t = 1000; const real = performance.now; (performance as any).now = () => t;
  const oc = { loc: { water: { fog: 0.02 }, pelagic: true }, T: { top: () => -20 } }, far = () => unseen(oc, 0, -3, -60, { x: 0, y: -3, z: 0 }, 0, 1);   // (60 m dead behind)
  const back = () => behind(oc, { x: 0, z: 0 }, 0, 1, 40, 2);
  const before = far(), bBefore = back(); holdUnseen(2000); t += 1900; const during = far(), bDuring = back(); t += 200; const after = far(), bAfter = back();
  (performance as any).now = real;
  want('G two seconds after a cut: nothing out of sight, nowhere behind the camera; then as before', before && !during && after && !!bBefore && bDuring === null && !!bAfter,
    `unseen ${before} → ${during} → ${after}; behind ${!!bBefore} → ${bDuring} → ${!!bAfter}`);
}
console.log(bad ? `FAIL (${bad})` : 'all ok');
process.exit(bad ? 1 : 0);
