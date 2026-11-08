// LAB: the moon seen from just over the sea, at the given times (and date): the camera 2 m up, looking straight at it,
// then a wider view toward it. Usage (a build served at PORT):
// PORT=4174 OUT=moon TAG=after [SEA=redsea] [DATE=2026-11-24] [TIMES='05:15,15:32'] node tools/lab/moon-look.cjs
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const OUT = process.env.OUT, TAG = process.env.TAG, SEA = process.env.SEA || 'redsea'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.setDefaultTimeout(1200000); p.on('pageerror', (e) => console.log('ERR', e.message));
  for (const T of (process.env.TIMES || '15:32,20:30').split(',')) {
    await p.goto(`http://localhost:${process.env.PORT}/?tier=high&debug&lab${process.env.DATE ? "&date=" + process.env.DATE : ""}&time=${T}&wx=clear#${SEA}`, { waitUntil: 'commit' });
    await p.waitForFunction(() => !!(window.seaglass && window.seaglass.cur), null, { timeout: 600000 });
    await p.addStyleTag({ content: '#newMark, #capRing, #caption { display: none !important; }' });
    for (const [v, fov] of [['near', 0], ['wide', 1]]) {
      const r = await p.evaluate(async ({ fov }) => {
        const s = window.seaglass; s.endOpening?.(); s.hold(true);
        const m = s.U.uAirMoon.value, c = s.drone.pos;
        const yaw = Math.atan2(-m.x, -m.z), pitch = Math.asin(m.y) * (fov ? 0.4 : 1);
        s.aim([c.x, 2, c.z], yaw, pitch); s.advance(1.5, 0.05); await new Promise((r) => setTimeout(r, 500));
        return { moonY: +m.y.toFixed(3), illum: +s.U.uMoonIllum.value.toFixed(3), sunY: +s.U.uAirSun.value.y.toFixed(3) };
      }, { fov });
      const f = `${OUT}/moon-${process.env.DATE || ''}${T.replace(':', '')}-${v}-${TAG}.png`; await p.screenshot({ path: f }); console.log(T, v, JSON.stringify(r), f);
    }
  }
  await b.close();
})();
