// LAB: the day octopus (eco/octopus.ts) close up, in each of its states — walking the reef (forage), tucked in its den,
// jetting away — from the side and from a little above. Usage (a build served at PORT):
// PORT=4174 OUT=octo TAG=after node tools/lab/octo-look.cjs   (SEA kayama; TIME 10:00; STATES 'forage,den,jet'; DIST 1.1)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const OUT = process.env.OUT, TAG = process.env.TAG || 'x', SEA = process.env.SEA || 'kayama'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.setDefaultTimeout(1800000); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://localhost:${process.env.PORT}/?tier=high&debug&lab&time=${process.env.TIME || '10:00'}&wx=clear#${SEA}`, { waitUntil: 'commit' });
  await p.waitForFunction(() => !!(window.seaglass && window.seaglass.cur && window.seaglass.cur.eco), null, { timeout: 600000 });
  await p.addStyleTag({ content: '#newMark, #capRing, #caption { display: none !important; }' });
  // (the sea run on, undrawn, until the octopus has a den)
  const ok = await p.evaluate(() => { const s = window.seaglass; s.endOpening?.(); s.hold(true); const o = s.cur.octopi?.[0]; if (!o) return false;
    const d = s.drone.pos, fx = -Math.sin(s.drone.yaw), fz = -Math.cos(s.drone.yaw); for (let k = 0; k < 400 && !o.placed; k++) { s.U.uTime.value += 0.1; s.cur.eco.step(0.1, s.U.uTime.value, d, fx, fz); } Object.defineProperty(s.cur.eco.env, 'shy', { get: () => 0, set: () => {}, configurable: true }); return o.placed; });   // (held calm: not put to flight by the camera this close)
  if (!ok) { console.log('no octopus'); await b.close(); return; }
  const D = +(process.env.DIST || 1.1);
  for (const st of (process.env.STATES || 'forage,den,jet').split(',')) for (const [v, a, up] of [['side', 1.9, 0.25], ['above', 0.6, 0.9]]) {
    const r = await p.evaluate(async ({ st, a, up, D }) => {
      const s = window.seaglass, o = s.cur.octopi[0];
      o.pos.copy(o.den); o.state = st; o.stateT = st === 'jet' ? 0.6 : 0; o.goal = null;
      s.aim([o.pos.x + 3, o.pos.y + 1, o.pos.z + 3], 0, 0); s.advance(st === 'jet' ? 4 : 25, 0.1);   // (settled into it; a jet caught early)
      o.state = st; if (st === 'jet') o.stateT = 0.6;
      const h = o.head + a, q = o.pos, pos = [q.x + Math.cos(h) * D, q.y + 0.15 * o.size + up * D, q.z + Math.sin(h) * D];
      const t = [q.x, q.y + 0.18 * o.size, q.z], d = [t[0] - pos[0], t[1] - pos[1], t[2] - pos[2]], l = Math.hypot(...d);
      s.aim(pos, Math.atan2(-d[0], -d[2]), Math.asin(d[1] / l)); s.advance(2, 0.05); await new Promise((r) => setTimeout(r, 400));
      return { state: o.state, size: +o.size.toFixed(2), spread: +o.spread.toFixed(2), at: [q.x, q.y, q.z].map((v) => +v.toFixed(1)) };
    }, { st, a, up, D });
    const f = `${OUT}/octo-${st}-${v}-${TAG}.png`; await p.screenshot({ path: f }); console.log(st, v, JSON.stringify(r), f);
  }
  await b.close();
})();
