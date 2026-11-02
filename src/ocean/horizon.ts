// The islands round about on the horizon (the start island's decision, 2026-10-27 §3; docs/proposals/start-island-
// 2026-10-27): 小浜島 2.6 km to the south-west — Dot's "island to the south", the first crossing —, 西表島 to the west,
// 石垣島 to the east, 竹富島, 黒島 and the small ones between: their shapes and colours from the land's own data
// (scripts/bake-horizon.py: the survey's elevations and aerial photographs), where they truly are. The look only:
// nothing here can be reached, walked or found.
//  - Drawn as the sky is (ocean/scenery.ts): the camera sees 460 m, so each point is drawn in the direction it truly
//    lies from the camera — sunk by the Earth's curve (with the air's bending), hazed by the air between — but at
//    300 m, at the back of everything: whatever is nearer is drawn over it, as it should be; what is further (the sky,
//    the sun and the moon in it, the stars — ocean/air.ts puts them at the very back) is hidden behind it. Among
//    themselves, the nearer island in front, each by its true distance.
//  - Seen only from above the water.
import * as THREE from 'three';
import { mat } from '../render/common';
import { AIRLIT } from '../render/airlit';
import { mulberry32 } from '../core/math';

interface Grid { west: number; north: number; cell: number; nx: number; nz: number }
async function pixels(url: string) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  return g.getImageData(0, 0, bmp.width, bmp.height).data;
}

// the land of one grid, as a surface: a vertex at each cell's middle, the cells with land at a corner drawn (the sea's
// own just under the water, so each island's shore runs down into it)
function gridGeometry(G: Grid, H: Uint8ClampedArray, C: Uint8ClampedArray, step: number) {
  const { nx, nz, cell, west, north } = G, h = (i: number, j: number) => H[(j * nx + i) * 4] * step;
  const P: number[] = [], N: number[] = [], Col: number[] = [], I: number[] = [], at = new Int32Array(nx * nz).fill(-1);
  const land = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz && H[(j * nx + i) * 4] > 0;
  const vert = (i: number, j: number) => {
    const k = j * nx + i; if (at[k] >= 0) return at[k];
    const y = land(i, j) ? h(i, j) : -4;
    const hx = (land(Math.min(nx - 1, i + 1), j) ? h(i + 1, j) : -4) - (land(Math.max(0, i - 1), j) ? h(i - 1, j) : -4);
    const hz = (land(i, Math.min(nz - 1, j + 1)) ? h(i, j + 1) : -4) - (land(i, Math.max(0, j - 1)) ? h(i, j - 1) : -4);
    const n = new THREE.Vector3(-hx / (2 * cell), 1, -hz / (2 * cell)).normalize();
    P.push(west + (i + 0.5) * cell, y, north + (j + 0.5) * cell); N.push(n.x, n.y, n.z);
    const q = k * 4; Col.push(C[q] / 255, C[q + 1] / 255, C[q + 2] / 255);
    return (at[k] = P.length / 3 - 1);
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (!land(i, j) && !land(i + 1, j) && !land(i, j + 1) && !land(i + 1, j + 1)) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    I.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(Col, 3));
  g.setIndex(I);
  return g;
}

const horizonMat = () => mat(
  `attribute vec3 aCol; varying vec3 vCol; varying vec3 vN; varying vec3 vWp; varying float vD;
   void main(){
     vec3 v = position - uCamPos; float d = length(v.xz);
     // (the Earth's curve, the air's bending taken off: what lies d off is sunk by d^2 / 2R x 0.87)
     v.y -= d * d / (2.0 * 6371000.0) * 0.87;
     vec3 dir = normalize(v);
     gl_Position = projectionMatrix * viewMatrix * vec4(uCamPos + dir * 300.0, 1.0);
     // (at the back of everything near — 460 m is the furthest anything else is — the nearer island in front)
     gl_Position.z = mix(0.99990, 0.999985, clamp(d / 45000.0, 0.0, 1.0)) * gl_Position.w;
     if (uCamPos.y < uSeaH) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // (from under the water: not seen)
     vCol = aCol; vN = normal; vWp = uCamPos + v; vD = length(v);
   }`,
  `${AIRLIT}
   varying vec3 vCol; varying vec3 vN; varying vec3 vWp; varying float vD;
   void main(){
     vec3 n = normalize(vN), dir = normalize(vWp - uCamPos);
     // the photograph's colour, a little deeper (from overhead, the light it was taken in is in it already), lit as now
     vec3 alb = pow(vCol, vec3(1.15)) * 0.9;
     vec3 col = airLit(alb, n, vWp, 0.0);
     // the air between: the further off, the more of the sky's colour at the horizon, more in rain and cloud
     float vis = mix(26000.0, 7000.0, max(uCloud * 0.7, uRain));
     float k = 1.0 - exp(-vD / vis);
     col = mix(col, skyAir(normalize(vec3(dir.x, max(dir.y, 0.0) * 0.3, dir.z)), -1.0), k);
     gl_FragColor = vec4(col, 1.0);
   }`,
  { opts: { depthWrite: true } });

/** Builds the islands round about once their data has come (an island's sea only: those with real land), into group. */
export function buildHorizon(group: THREE.Group) {
  const env = (import.meta as any).env;
  if (!env || typeof document === 'undefined') return;   // (headless, outside the app's build: nothing to see)
  const base = `${env.BASE_URL}land/horizon`;
  fetch(`${base}.json`).then((r) => r.json()).then(async (meta: Record<string, any>) => {
    const grids = await Promise.all(['far', 'near'].filter((n) => meta[n]).map(async (name) => {
      const [H, C] = await Promise.all([pixels(`${base}_${name}_h.png`), pixels(`${base}_${name}_c.png`)]);
      return { name, G: meta[name] as Grid, H, C };
    }));
    // (three.js's ids for what is made here from a stream of their own: made whenever the data comes, they must not take
    // the world's Math.random draws, on which the island's days depend)
    const keepM = Math.random; Math.random = mulberry32(0x686f727a);
    try {
      const m = horizonMat();
      for (const { name, G, H, C } of grids) {
        const mesh = new THREE.Mesh(gridGeometry(G, H, C, meta.step), m);
        mesh.frustumCulled = false; mesh.renderOrder = -0.9; mesh.userData.horizon = name;
        group.add(mesh);
      }
    } finally { Math.random = keepM; }
  }).catch(() => { /* none to be had: the horizon stays open */ });
}
