// Headless check (science, reviews/201-f18a02d: on seed 2 Lantern carried a find from 252 to 330 hours, going again and
// again to a corner of the shelf it could not reach — its hands full, the pit fire waiting). On controlled ground, the
// residents by habit:
//   1 Lantern with a find goes to the shelf's stand and puts it on the shelf, its hands free
//   2 three tries that did not get there: the fourth time it sets the find down where it is — kept with the finds, said
//     so, its hands free
// Usage: npx tsx --import ./scripts/node-assets.mjs scripts/shelve-check.ts
import * as THREE from 'three';
import { makeResidents } from '../src/robots/residents';
import { Solids } from '../src/robots/solids';
import { mulberry32 } from '../src/core/math';

let now = Date.parse('2026-10-03T12:00:00Z');   // (21:00 on the island: Lantern is up)
Date.now = () => now;
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } });
Object.defineProperty(globalThis, 'document', { value: { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }), getElementById: () => null } });
let bad = 0;
const want = (what: string, ok: boolean, got = '') => { if (!ok) bad++; console.log(`${what}: ${got} ${ok ? 'ok' : 'FAIL'}`); };

Math.random = mulberry32(5);
const f = () => 2, T: any = { ground: f, floor: f, top: f, landCover: () => ({ can: 0, sand: 1 }), vegH: () => 0, solids: new Solids() };
const R: any = makeResidents({ id: 'kayama', lat: 24.37, lon: 124.03, f } as any, T, ['テスト魚'], ['テスト鳥']);
const V = R.village, lantern = R.list.find((r: any) => r.id === 'lantern');
R.list.forEach((o: any, i: number) => { if (o !== lantern) { o.pos.set(2000 + i * 200, 2, 2000); o.task = { kind: 'wander', x: o.pos.x, z: o.pos.z, act: 'idle', dur: 1e9, t: 0, arrived: true }; } });
R.setBrain(null);
const run = (secs: number, until?: () => boolean) => { for (let i = 0; i < secs * 20; i++) { now += 50; R.update(0.05, now, new THREE.Vector3(0, 50, 0)); if (until?.()) return true; } return false; };
const carry = () => { lantern.pos.set(72, 2, -142); R.drift.kind = 0; R.drift.by = 'lantern'; lantern.holding = 'drift'; lantern.task = null; lantern.battery = 1; };
{ // 1
  const n = V.treasures.length; carry();
  run(240, () => !lantern.holding);
  want('1 Lantern puts its find on the shelf, from the shelf\'s stand', !lantern.holding && V.treasures.length === n + 1 && (lantern.mo.shelveTries ?? 0) === 0, `holding '${lantern.holding}', finds ${n} → ${V.treasures.length}`);
}
{ // 2
  const n = V.treasures.length; carry(); lantern.mo.shelveTries = 3;
  run(5, () => !lantern.holding);
  want('2 three tries that did not get there: set down where it is, kept with the finds, said so', !lantern.holding && V.treasures.length === n + 1 && lantern.diary.some((e: any) => /を棚まで運べなかったので、その場に置いた/.test(e.text)),
    `holding '${lantern.holding}', finds ${n} → ${V.treasures.length}; ${lantern.diary.at(-1)?.text}`);
}
console.log(bad ? `FAIL (${bad})` : 'all ok');
process.exit(bad ? 1 : 0);
