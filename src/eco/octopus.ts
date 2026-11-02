// ワモンダコ (Octopus cyanea), the day octopus: it walks the reef probing for crabs, flushes through
// passing-cloud colour displays, blanches and jets away when the drone crowds it, and spends the
// night tucked in its den.
import * as THREE from 'three';
import { clamp, smooth, R, rr, hyp } from '../core/math';
import { mat } from '../render/common';
import { LIMIT } from '../ocean/scenery';
import { zx, zz } from '../ocean/zone';
import { activity, logEvent, oneOf, type Env, type Subject } from './env';

// The body (unit size: the mantle about half a unit long, the arms about one). Built in the shape it has at rest;
// the arms are laid out by the vertex shader, which follows each one's centre line from the crown to its tip.
//   aPart 0 the body: the mantle — a soft sac, its tip back and up — drawn on through the head (the eyes in their
//          bulges, either side) to the crown the arms grow from. One smooth surface: no seam where head meets arms
//   aPart 1 an arm: a long tapering tube, flattened on its underside (the suckers' side), its tip fine
//   aPart 2 an eye: the eyeball, set into its bulge; the iris gold, the pupil a level bar
//   aPart 3 the web: a shallow skin between neighbouring arms near their bases, following both
//   aPart 4 the funnel: a short soft tube low on the side of the head
// aArm: which arm (0-7), or for the web the arm on one side (the other is the next); aT: along the arm (0 at the
// crown, 1 at the tip), or for the web how far out; aCs: the point's place round the arm (x across, y up), unit
// radius — or for the web, how far across from the one arm to the next
const ARM_SEG = 52, ARM_SIDES = 12, CROWN = new THREE.Vector3(0, 0.07, 0.05), CROWN_R = 0.13;
function octopusGeometry() {
  const P: number[] = [], N: number[] = [], part: number[] = [], arm: number[] = [], at: number[] = [], cs: number[] = [], I: number[] = [];
  const vtx = (p: THREE.Vector3, n: THREE.Vector3, pt: number, a: number, t: number, cx: number, cy: number) => { P.push(p.x, p.y, p.z); N.push(n.x, n.y, n.z); part.push(pt); arm.push(a); at.push(t); cs.push(cx, cy); return P.length / 3 - 1; };
  // the body: rings along a bent axis from the mantle's tip to the crown, each a little wider than tall
  const U = 30, V = 28, ax = (u: number) => {
    // (the axis: the mantle's tip back and up, curving down through the head to the crown)
    const a = new THREE.Vector3(0, 0.46, -0.46), m = new THREE.Vector3(0, 0.36, -0.12), c = CROWN.clone();
    return a.multiplyScalar((1 - u) * (1 - u)).add(m.multiplyScalar(2 * u * (1 - u))).add(c.multiplyScalar(u * u));
  };
  const rad = (u: number) => {
    // (the sac widest a third of the way, narrowing at the neck, the head a little fuller, flaring to the crown)
    const sac = Math.sin(Math.min(1, u / 0.62) * Math.PI) * 0.205, head = Math.exp(-(((u - 0.76) / 0.09) ** 2)) * 0.035;
    return Math.max(0.012, sac * (u < 0.62 ? 1 : 0)) + (u >= 0.5 ? smooth(0.5, 0.62, u) * 0.11 + head + smooth(0.86, 1, u) * (CROWN_R - 0.11) : 0) * (u < 0.62 ? smooth(0.5, 0.62, u) : 1);
  };
  const ring: number[][] = [];
  for (let i = 0; i <= U; i++) {
    const u = i / U, c = ax(u), t = ax(Math.min(1, u + 0.01)).sub(ax(Math.max(0, u - 0.01))).normalize();
    const side = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(t, side).normalize().negate();
    const row: number[] = [];
    for (let j = 0; j <= V; j++) {
      const an = (j / V) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
      let r = rad(u);
      // the eyes' bulges, high on either side of the head; and the mantle a little lumpy, as a soft sac is
      const eyeA = Math.exp(-(((u - 0.74) / 0.07) ** 2)) * (Math.exp(-(((an - 0.45) / 0.42) ** 2)) + Math.exp(-(((an - (Math.PI - 0.45)) / 0.42) ** 2)));
      r += eyeA * 0.045 + (u < 0.6 ? 0.008 * Math.sin(an * 3 + u * 9) * Math.sin(u * 13) : 0);
      const o = side.clone().multiplyScalar(ca * r * 1.08).addScaledVector(up, sa * r * (u < 0.62 ? 0.92 : 0.82));
      row.push(vtx(c.clone().add(o), o.clone().normalize(), 0, 0, u, ca, sa));
    }
    ring.push(row);
  }
  for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) { const a = ring[i][j], b = ring[i][j + 1], c = ring[i + 1][j], d = ring[i + 1][j + 1]; I.push(a, c, b, b, c, d); }
  // the eyes: set into the bulges, looking out and a little forward
  for (const sx of [-1, 1]) {
    const c = ax(0.74), an = sx > 0 ? 0.45 : Math.PI - 0.45, r = rad(0.74) + 0.03;
    const t = ax(0.75).sub(ax(0.73)).normalize(), up = new THREE.Vector3().crossVectors(t, new THREE.Vector3(1, 0, 0)).normalize().negate();
    const ctr = c.clone().addScaledVector(new THREE.Vector3(1, 0, 0), Math.cos(an) * r * 1.08).addScaledVector(up, Math.sin(an) * r * 0.82);
    const g = new THREE.SphereGeometry(0.036, 16, 12), gp = g.attributes.position, st = P.length / 3;
    for (let k = 0; k < gp.count; k++) { const q = new THREE.Vector3(gp.getX(k), gp.getY(k), gp.getZ(k)); vtx(ctr.clone().add(q), q.clone().normalize(), 2, sx, 0, q.x / 0.036 * sx, q.y / 0.036); }
    const gi = g.index!.array; for (let k = 0; k < gi.length; k++) I.push(st + gi[k]);
  }
  // the funnel: a short tube on the left of the head, low, opening forward-down
  { const base = ax(0.68).add(new THREE.Vector3(-0.1, -0.07, 0)), dir = new THREE.Vector3(-0.35, -0.35, 1).normalize(), st = P.length / 3, S = 10, L = 0.09;
    const s1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(), s2 = new THREE.Vector3().crossVectors(s1, dir);
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= S; j++) { const an = j / S * 6.283, r = 0.03 * (1 - i / 4 * 0.35), n = s1.clone().multiplyScalar(Math.cos(an)).addScaledVector(s2, Math.sin(an)); vtx(base.clone().addScaledVector(dir, L * i / 4).addScaledVector(n, r), n, 4, 0, i / 4, Math.cos(an), Math.sin(an)); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < S; j++) { const a = st + i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1; I.push(a, b, c, b, d, c); } }
  // the arms: rings round each one's centre line (laid out in the shader); the position is unused but its length
  for (let a = 0; a < 8; a++) {
    const st = P.length / 3;
    for (let i = 0; i <= ARM_SEG; i++) for (let j = 0; j <= ARM_SIDES; j++) {
      const an = j / ARM_SIDES * Math.PI * 2;
      vtx(new THREE.Vector3(0, i / ARM_SEG, 0), new THREE.Vector3(Math.cos(an), Math.sin(an), 0), 1, a, i / ARM_SEG, Math.cos(an), Math.sin(an));
    }
    for (let i = 0; i < ARM_SEG; i++) for (let j = 0; j < ARM_SIDES; j++) { const a0 = st + i * (ARM_SIDES + 1) + j, b0 = a0 + 1, c0 = a0 + ARM_SIDES + 1, d0 = c0 + 1; I.push(a0, b0, c0, b0, d0, c0); }
  }
  // the web: a strip between each arm and the next, from the crown out to a fifth of the way along
  for (let a = 0; a < 8; a++) {
    const st = P.length / 3, W = 6, Tn = 8;
    for (let i = 0; i <= Tn; i++) for (let j = 0; j <= W; j++) vtx(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 3, a, i / Tn * 0.2, j / W, 0);
    for (let i = 0; i < Tn; i++) for (let j = 0; j < W; j++) { const a0 = st + i * (W + 1) + j, b0 = a0 + 1, c0 = a0 + W + 1, d0 = c0 + 1; I.push(a0, b0, c0, b0, d0, c0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aArm', new THREE.Float32BufferAttribute(arm, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 1));
  g.setAttribute('aCs', new THREE.Float32BufferAttribute(cs, 2));
  g.setIndex(I);
  // (the body's normals smoothed over its own surface, the eyes' and funnel's kept as built)
  g.computeVertexNormals();
  return g;
}
const GEO = octopusGeometry();
// (the simpler body this replaces was built of more pieces, and three.js drew an id for each from Math.random — 18 more
// than now, and 2 more for its copies: drawn all the same, so the world's later draws, and the island's days, stay as they were)
for (let k = 0; k < 20; k++) THREE.MathUtils.generateUUID();

// The arms' centre lines, worked out in the vertex shader for each point (a few short steps along the arm, so each
// can bend its own way): spread, they reach out over the reef from the crown and lie along it, the tips lifting and
// curling over to the side; walking, a wave runs out along each, the arms on either side out of step; in the den
// (spread low) they are drawn in short and coiled; jetting (spread 0), they stream out together behind the crown, the mantle leading.
const ARM_GLSL = /* glsl */ `
uniform float uSpread; uniform float uWalk; uniform float uSeed; uniform float uJet;
const float ARM_L = 0.98;
float armTh(float a){ return a * 0.785398 + 0.39; }
// how thick the arm is at s (0 crown .. 1 tip)
float armR(float s){ return 0.058 * pow(1.0 - s, 0.85) + 0.004; }
// a point on arm a's centre line at s, spread (laid out over the reef) and trailing (streamed behind)
vec3 armSpread(float a, float s){
  float th = armTh(a), ph = uSeed + a * 2.17, side = mod(a, 2.0) * 2.0 - 1.0;
  float reach = mix(0.42, 1.0, smoothstep(0.25, 0.9, uSpread));               // (in the den: drawn in)
  float curlK = mix(5.5, 2.2, smoothstep(0.25, 0.9, uSpread)) * (0.7 + 0.3 * sin(uTime * 0.5 + ph));
  vec3 p = vec3(0.0); float h = th, ds = 1.0 / 24.0, L = ARM_L * reach;
  for (int k = 0; k < 24; k++) {
    float u = (float(k) + 0.5) * ds;
    if (u > s) break;
    float w = sin(uTime * 1.5 + ph - u * 7.0) * uWalk * 0.9 * u * (0.6 + 0.4 * side);  // (the walking wave, out along it)
    float wig = sin(uTime * 0.7 + ph * 1.3 - u * 5.0) * 0.18 * u;                     // (never quite still)
    float hd = h + (w * 6.0 + wig * 4.0 + side * curlK * u * u * 1.6) * ds;              // (the tip coiling over to its side)
    p += vec3(sin(hd), 0.0, cos(hd)) * L * min(ds, s - float(k) * ds);
    h = hd;
  }
  // its height: from the crown down to the reef within the first fifth, along it, the tip lifting as it curls
  float lift = mix(0.18, 0.06, smoothstep(0.25, 0.9, uSpread)) * smoothstep(0.55, 1.0, s) * (0.6 + 0.4 * sin(uTime * 0.6 + ph));
  p.y = mix(0.0, -0.06, smoothstep(0.0, 0.22, s)) - 0.09 * s * s * smoothstep(0.25, 0.9, uSpread) + lift;   // (draped down over the curve of the rock)
  return vec3(CROWN_X, CROWN_Y, CROWN_Z) + vec3(sin(th), 0.0, cos(th)) * CROWN_R * 0.75 + p;
}
vec3 armTrail(float a, float s){
  float th = armTh(a), ph = uSeed + a * 2.17;
  // (out from the crown straight away from the mantle, along the body's own line: the mantle leads, the arms
  // follow in a close bundle, drawn together past the crown and fanning a little toward the tips)
  vec3 D = vec3(0.0, -0.607, 0.794), e1 = vec3(1.0, 0.0, 0.0), e2 = vec3(0.0, 0.794, 0.607);
  vec3 ro = e1 * sin(th) + e2 * cos(th), rt = e1 * cos(th) - e2 * sin(th);
  float r = CROWN_R * 0.55 * (1.0 - 0.45 * smoothstep(0.0, 0.3, s)) + 0.05 * s * s;
  return vec3(CROWN_X, CROWN_Y, CROWN_Z) + ro * r + D * ARM_L * 1.05 * s + rt * sin(uTime * 3.0 + ph - s * 6.0) * 0.03 * s;
}
vec3 armC(float a, float s){ return mix(armTrail(a, s), armSpread(a, s), uSpread); }
`;

function octopusMaterial() {
  const C = `#define CROWN_X ${CROWN.x.toFixed(3)}\n#define CROWN_Y ${CROWN.y.toFixed(3)}\n#define CROWN_Z ${CROWN.z.toFixed(3)}\n#define CROWN_R ${CROWN_R.toFixed(3)}\n`;
  return mat(
    C + ARM_GLSL + `attribute float aPart; attribute float aArm; attribute float aT; attribute vec2 aCs;
     varying vec3 vWp; varying vec3 vN; varying vec3 vL; varying float vPart; varying float vT; varying float vUnder; varying vec2 vCs;
     void main(){
       vec3 p = position; vec3 n = normal; float t = aT, under = 0.0;
       // jetting, the mantle squeezes in time with the strokes that drive it
       if (aPart < 0.5) p -= n * uJet * (0.5 + 0.5 * sin(uTime * 9.0)) * 0.025 * sin(3.14159 * min(1.0, t / 0.62));
       if (aPart > 0.5 && aPart < 1.5) {
         // round the arm's centre line: its frame from the line's own direction; flattened underneath
         vec3 c = armC(aArm, t), c2 = armC(aArm, min(1.0, t + 0.02)), c0 = armC(aArm, max(0.0, t - 0.02));
         vec3 tg = normalize(c2 - c0 + vec3(0.0, 0.0, 1e-5));
         vec3 sd = normalize(cross(vec3(0.0, 1.0, 0.0), tg) + vec3(1e-5, 0.0, 0.0)), up = normalize(cross(tg, sd));
         float r = armR(t), y = aCs.y < 0.0 ? aCs.y * 0.55 : aCs.y * 0.92;
         p = c + (sd * aCs.x * 1.05 + up * y) * r;
         n = normalize(sd * aCs.x + up * (aCs.y < 0.0 ? aCs.y * 1.6 : aCs.y));
         under = smoothstep(-0.2, -0.75, aCs.y);
       } else if (aPart > 2.5 && aPart < 3.5) {
         // the web: across from this arm to the next, sagging toward the crown between them
         float a2 = mod(aArm + 1.0, 8.0);
         vec3 pa = armC(aArm, t), pb = armC(a2, t), sa = pa + normalize(cross(vec3(0.0, 1.0, 0.0), armC(aArm, t + 0.02) - armC(aArm, max(0.0, t - 0.02)))) * armR(t) * 0.6;
         vec3 sb = pb - normalize(cross(vec3(0.0, 1.0, 0.0), armC(a2, t + 0.02) - armC(a2, max(0.0, t - 0.02)))) * armR(t) * 0.6;
         float k = aCs.x;
         vec3 mid = mix(sa, sb, k), cr = vec3(CROWN_X, CROWN_Y - 0.01, CROWN_Z);
         p = mix(mid, cr, sin(k * 3.14159) * 0.35 * smoothstep(0.0, 0.2, t)) + vec3(0.0, 0.012, 0.0) * sin(k * 3.14159);
         n = vec3(0.0, 1.0, 0.0);
         t = t * 0.5;
       }
       vec4 w = modelMatrix * vec4(p, 1.0);
       vWp = w.xyz; vN = normalize(mat3(modelMatrix) * n); vL = p; vPart = aPart; vT = t; vUnder = under; vCs = aCs;
       gl_Position = projectionMatrix * viewMatrix * w;
     }`,
    `uniform vec3 uCamo; uniform float uAlarm; uniform float uSeed;
     varying vec3 vWp; varying vec3 vN; varying vec3 vL; varying float vPart; varying float vT; varying float vUnder; varying vec2 vCs;
     // a ridged noise: a fine net of darker lines between paler patches (the reticulate skin), not spots
     float ridge(vec2 q){ return 1.0 - abs(vn2(q) * 2.0 - 1.0); }
     void main(){
       vec3 n = normalize(vN); vec3 V = normalize(uCamPos - vWp); if (dot(n, V) < 0.0) n = -n;
       float arm = step(0.5, vPart) * step(vPart, 1.5), web = step(2.5, vPart) * step(vPart, 3.5), eye = step(1.5, vPart) * step(vPart, 2.5);
       // where on the body this is, for its patterns: along the arm and round it, or over the body's surface
       vec2 q = mix(vL.xz * 7.0 + vL.y * 5.0, vec2(vT * 7.0, atan(vCs.y, vCs.x) * 0.9), arm);   // (along an arm, drawn out: no rings)
       float upp = length(fwidth(q));
       float big = vn2(q * 0.6 + uSeed), mid = vn2(q * 1.7 - uSeed);
       float net = pow(ridge(q * 2.6 + uSeed * 0.3), 4.0) * aaK(2.6, upp);                  // (the dark net)
       float wr = (vn2(q * 6.0 + 3.0) - 0.5) * aaK(6.0, upp);                               // (fine wrinkles: soft, fading with distance)
       // the skin's own relief on the light: wrinkles and the soft lumps of the papillae, low
       n = normalize(n + (vec3(wr, 0.0, -wr) * 0.25) * (1.0 - eye));
       // the colour: the rock's, mottled light and dark in big soft patches, the net between them darker, the
       // patches paler where they lie apart — and a dark cloud passing over it, out along the arms
       vec3 camo = uCamo * vec3(0.78, 0.66, 0.56) * (0.55 + 0.6 * big + 0.15 * mid);   // (the rock's colours, warmer and darker: a living thing on it)
       camo = mix(camo, vec3(0.86, 0.8, 0.7), smoothstep(0.62, 0.86, big) * 0.35);
       camo *= 1.0 - 0.38 * net;
       float along = mix(vL.z * 6.0 - vL.y * 4.0, -vT * 4.0, arm);
       float cloud = smoothstep(0.45, 0.95, sin(along * 1.3 - uTime * 2.0 + uSeed) * 0.5 + 0.5) * (1.0 - uAlarm);
       camo = mix(camo, camo * 0.5, cloud * mix(0.5, 0.3, arm));   // (softer over the arms: a shadow passing, not bands)
       // alarmed: a flush of dark red-brown, the net blanched pale
       vec3 alarm = mix(vec3(0.36, 0.13, 0.09) * (0.8 + 0.4 * big), vec3(0.8, 0.72, 0.64), net * 0.45);
       vec3 alb = mix(camo, alarm, uAlarm);
       // the arms' undersides pale, ridged across where the suckers run (soft bands, no cups)
       float band = (sin(vT * 230.0) * 0.5 + 0.5) * aaK(36.0, length(fwidth(vT * 6.28))) * vUnder;
       alb = mix(alb, vec3(0.9, 0.82, 0.74) * (0.88 + 0.12 * band), vUnder * 0.75 * arm);
       alb = mix(alb, alb * 0.85, web * 0.3);                                                // (the web a shade darker, thinner)
       // the eye: gold, a level bar of a pupil, a dark rim; wet and bright
       if (eye > 0.5) {
         vec2 e = vCs;
         float pupil = 1.0 - smoothstep(0.12, 0.2, abs(e.y) + max(abs(e.x) - 0.42, 0.0) * 1.5);
         float iris = smoothstep(0.98, 0.7, length(e));
         alb = mix(uCamo * 0.6, mix(vec3(0.82, 0.68, 0.32), vec3(0.03), pupil), iris);
       }
       vec3 col = shade(alb, vWp, n, 0.5);
       // soft and a little translucent: the light comes round its edges; and wet — a soft sheen toward the sun
       float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
       col += absorbSeen(alb * vec3(1.0, 0.8, 0.7) * fr * 0.25 * (uAmb * 0.4 + uSunI * 0.3), vWp.y);
       vec3 hv = normalize(SUN + V);
       col += absorbSeen(vec3(0.9, 0.95, 1.0) * pow(max(dot(n, hv), 0.0), mix(28.0, 90.0, eye)) * mix(0.07, 0.6, eye) * uSunI, vWp.y);
       gl_FragColor = vec4(col, 1.0);
     }`,
    { uniforms: { uSpread: { value: 1 }, uWalk: { value: 0 }, uJet: { value: 0 }, uSeed: { value: Math.random() * 20 }, uCamo: { value: new THREE.Color(0.55, 0.42, 0.3) }, uAlarm: { value: 0 } },
      opts: { side: THREE.DoubleSide } });
}

// a still model for the field guide
export function octopusModel() { return new THREE.Mesh(GEO, octopusMaterial()); }

type State = 'den' | 'forage' | 'jet' | 'settle';
const STATUS: Record<State, string> = { den: '巣穴から様子をうかがっている', forage: '岩の上を歩いて餌を探している', jet: 'ジェット噴射で逃げている', settle: '体の色を周りに合わせている' };

export function makeOctopi(oc: any, count: number, rock: number[]) {
  const list: any[] = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(GEO, octopusMaterial());
    m.frustumCulled = false;
    const o: any = { mesh: m, pos: new THREE.Vector3(), den: new THREE.Vector3(), head: 0, t: R() * 50, state: 'den' as State, stateT: 0, placed: false,
      spread: 0.3, walk: 0, alarm: 0, jet: 0, size: rr(0.55, 0.8), goal: null as THREE.Vector3 | null, up: new THREE.Vector3(0, 1, 0) };
    m.scale.setScalar(o.size);
    (m.material as THREE.ShaderMaterial).uniforms.uCamo.value.setRGB(rock[0] * 1.05, rock[1] * 0.9, rock[2] * 0.75);
    o.subject = { key: `octopus:${i}`, label: 'ワモンダコ', kind: 'octopus', prio: 2.1, size: 0.9, pos: () => (o.placed ? o.pos : null), status: () => STATUS[o.state as State], live: () => o.placed } as Subject;
    oc.group.add(m);
    list.push(o);
  }
  return list;
}

const _v = new THREE.Vector3(), _g = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _ax = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qj = new THREE.Quaternion();
// the surface it crawls on: terrain and everything standing on it (rock, coral), smoothed over about
// its own size so that a coral head is a rounded mound with sides to cling to, not a stepped block
function surf(T: any, x: number, z: number) {
  let c = 0, mx = -1e9;
  for (let k = 0; k < 7; k++) {
    const a = k * 1.0472, r = k === 6 ? 0 : 0.55, v = solid(T, x + Math.cos(a) * r, z + Math.sin(a) * r);
    c += k === 6 ? v * 2 : v; mx = Math.max(mx, v);
  }
  return (c / 8) * 0.75 + mx * 0.25;
}
// terrain and the obstacle grid, interpolated between cells (the grid's own lookup takes the tallest
// neighbour, which is right for keeping clear of things but makes a staircase to walk on)
function solid(T: any, x: number, z: number) {
  const h = T.h(x, z), O = T.obst;
  if (!O) return h;
  const N = O.N, fx = Math.min(N - 1.001, Math.max(0, x + O.half - 0.5)), fz = Math.min(N - 1.001, Math.max(0, z + O.half - 0.5));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = O.a, k = j * N + i;
  const g = (q: number) => Math.max(a[q], h);
  return (g(k) * (1 - u) + g(k + 1) * u) * (1 - v) + (g(k + N) * (1 - u) + g(k + N + 1) * u) * v;
}
// how steep the surface is here (rise over run), and its gradient in g
function slope(T: any, x: number, z: number, g: THREE.Vector3) {
  const e = 0.45;
  g.set((surf(T, x + e, z) - surf(T, x - e, z)) / (2 * e), 0, (surf(T, x, z + e) - surf(T, x, z - e)) / (2 * e));
  return hyp(g.x, g.z);
}
export function updateOctopi(oc: any, dt: number, env: Env, cam: THREE.Vector3, fx: number, fz: number) {
  const T = oc.T, act = activity('day', env);
  for (const o of oc.octopi || []) {
    o.t += dt; o.stateT += dt;
    const dx = o.pos.x - cam.x, dz = o.pos.z - cam.z;
    if ((!o.placed || dx * dx + dz * dz > 75 * 75) && (o.retry = (o.retry ?? 0) - dt) <= 0) {
      // a den in the reef ahead of the drone; failing that (the camera ashore, looking inland), anywhere in
      // the water round about; and if there is no water near at all, nowhere for now (never on dry land)
      let best: [number, number] | null = null, bs = 0;
      const near = !o.placed;
      for (let k = 0; k < 40; k++) {
        const ahead = k < 30, d = ahead ? (near ? rr(10, 30) : rr(30, 45)) : rr(10, 60), lat = ahead ? (R() * 2 - 1) * 18 : 0;
        const a = ahead ? 0 : R() * Math.PI * 2, ux = ahead ? fx : Math.cos(a), uz = ahead ? fz : Math.sin(a);
        const x = zx(cam.x + ux * d - uz * lat), z = zz(cam.z + uz * d + ux * lat);
        const r = T.reef(x, z), h = T.h(x, z);
        if (h > -0.9 || !T.wet(x, z, 1.5)) continue;
        // a crevice at the foot of rock or coral: reef here, and something standing higher close by
        let rise = 0; for (let k2 = 0; k2 < 6; k2++) { const a2 = k2 * 1.047; rise = Math.max(rise, surf(T, x + Math.cos(a2) * 0.9, z + Math.sin(a2) * 0.9) - surf(T, x, z)); }
        const sc = 0.01 + r * (h > -18 ? 1 : 0.3) * (0.4 + Math.min(1, rise / 0.8));
        if (sc > bs) { bs = sc; best = [x, z]; }
        if (k === 29 && best) break;
      }
      if (best) {
        o.den.set(best[0], surf(T, best[0], best[1]), best[1]);
        o.pos.copy(o.den); o.up.set(0, 1, 0); o.state = 'den'; o.stateT = 0; o.placed = true; o.goal = null;
      } else if (!o.placed) o.retry = 2;
      else { o.placed = false; o.retry = 2; }
    }
    o.mesh.visible = o.placed;
    if (!o.placed) continue;
    const camD = o.pos.distanceTo(cam);
    const st = o.state as State;
    // decide
    if (st === 'den') { if (act > 0.6 && o.stateT > rr(20, 60) && (camD > 3 || env.shy <= 0)) { o.state = 'forage'; o.stateT = 0; } }
    else if (st === 'forage') {
      if (camD < 2.4 * Math.min(1, env.shy * 3)) { o.state = 'jet'; o.stateT = 0; o.head = Math.atan2(o.pos.z - cam.z, o.pos.x - cam.x); logEvent(env, 'octopus', oneOf(['ワモンダコが色を変えて、ジェット噴射で逃げた', 'ワモンダコが白く色を抜き、墨を残すように飛び去った', 'ドローンに驚いたワモンダコが、脚をそろえて一気に泳ぎ去った']), o.pos.x, o.pos.z, () => o.pos); }
      else if (act < 0.4 || o.stateT > 150) { o.goal = o.den.clone(); if (hyp(o.pos.x - o.den.x, o.pos.z - o.den.z) < 0.5) { o.state = 'den'; o.stateT = 0; } }
    } else if (st === 'jet') { if (o.stateT > 2.4) { o.state = 'settle'; o.stateT = 0; } }
    else if (st === 'settle') { if (o.stateT > 6) { o.state = act > 0.5 ? 'forage' : 'den'; o.stateT = 0; if (o.state === 'den') o.pos.copy(o.den); } }

    // act
    let speed = 0, spread = 1, walk = 0, alarm = 0, lift = 0;
    if (o.state === 'den') { spread = 0.25; lift = -0.08; }
    else if (o.state === 'forage') {
      // probe along the reef: the next spot is a crack or the edge of a coral head near the den
      if (!o.goal || hyp(o.pos.x - o.goal.x, o.pos.z - o.goal.z) < 0.4) {
        let best: THREE.Vector3 | null = null, bs = -1;
        for (let k = 0; k < 10; k++) {
          const a = R() * Math.PI * 2, r = rr(0.8, 3.5);
          const gx = zx(o.den.x + Math.cos(a) * r * 1.6), gz = zz(o.den.z + Math.sin(a) * r * 1.6);
          if (!T.wet(gx, gz, 0.6)) continue;
          const sc = T.reef(gx, gz) + Math.min(1, slope(T, gx, gz, _g)) * 0.8 + R() * 0.3;
          if (sc > bs) { bs = sc; best = new THREE.Vector3(gx, 0, gz); }
        }
        o.goal = best ?? o.den.clone();
      }
      const gx = o.goal.x - o.pos.x, gz = o.goal.z - o.pos.z;
      let d = Math.atan2(gz, gx) - o.head; d = Math.atan2(Math.sin(d), Math.cos(d));
      o.head += d * Math.min(1, dt * 0.8);
      const pause = Math.sin(o.t * 0.4) > 0.3 ? 0 : 1;   // stop now and then to probe a crevice
      speed = 0.16 * pause; walk = pause;
    } else if (o.state === 'jet') { speed = 1.8 * (1 - o.stateT / 2.6); spread = 0; alarm = 1; lift = 0.6 * Math.sin(Math.min(1, o.stateT / 2.4) * Math.PI); }
    else if (o.state === 'settle') { alarm = 1 - smooth(0, 5, o.stateT); }
    o.spread += (spread - o.spread) * Math.min(1, dt * (o.state === 'jet' ? 6 : 1.2));
    o.walk += (walk - o.walk) * Math.min(1, dt * 2);
    o.jet += ((o.state === 'jet' ? 1 : 0) - o.jet) * Math.min(1, dt * (o.state === 'jet' ? 6 : 1.5));
    o.alarm += (alarm - o.alarm) * Math.min(1, dt * (alarm > o.alarm ? 8 : 1));
    // Crawling keeps to the surface, up and down its sides: speed is along the surface, so on a steep
    // flank the octopus creeps up or down it rather than hopping onto the top or dropping off the edge.
    const k = slope(T, o.pos.x, o.pos.z, _g);
    const along = o.state === 'jet' ? 1 : 1 / Math.sqrt(1 + k * k * 1.6);
    o.pos.x = zx(o.pos.x + Math.cos(o.head) * speed * along * dt);
    o.pos.z = zz(o.pos.z + Math.sin(o.head) * speed * along * dt);
    const floorY = surf(T, o.pos.x, o.pos.z);
    if (o.state === 'jet' || o.state === 'settle') o.pos.y += (Math.max(floorY + lift, o.pos.y - dt * 0.4) - o.pos.y) * Math.min(1, dt * 3);   // (sinks back down after a jet)
    else o.pos.y += (floorY + lift - o.pos.y) * Math.min(1, dt * 6);
    // lie against the surface: the body's up is the surface normal (flat on top, sideways on a wall),
    // pressed a little closer on steep sides, where it flattens as octopuses do
    _n.set(-_g.x, 1, -_g.z).normalize();
    if (o.state === 'jet') _n.set(0, 1, 0);
    o.up.lerp(_n, Math.min(1, dt * 3)).normalize();
    _f.set(Math.cos(o.head), 0, Math.sin(o.head)); _f.addScaledVector(o.up, -_f.dot(o.up)).normalize();
    _r.crossVectors(o.up, _f).normalize();
    _m.makeBasis(_r, o.up, _f);
    _q.setFromRotationMatrix(_m);
    // jetting it goes mantle first: turned about so the mantle points the way it goes, and pitched level along
    // the body's line (crown to mantle tip), the arms streaming out behind
    if (o.state === 'jet') _q.multiply(_qj.setFromAxisAngle(_ax.set(0, 1, 0), Math.PI)).multiply(_qj.setFromAxisAngle(_ax.set(1, 0, 0), -0.652));
    o.mesh.quaternion.slerp(_q, Math.min(1, dt * (o.state === 'settle' ? 2 : 5)));
    const steep = 1 - o.up.y;
    o.mesh.scale.set(o.size, o.size * (1 - steep * 0.25), o.size);
    o.mesh.position.copy(o.pos).addScaledVector(o.up, -steep * 0.05 * o.size);
    const u = (o.mesh.material as THREE.ShaderMaterial).uniforms;
    u.uSpread.value = o.spread; u.uWalk.value = o.walk; u.uJet.value = o.jet; u.uAlarm.value = o.alarm;
    void _v;
  }
}
