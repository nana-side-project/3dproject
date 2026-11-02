// LAB: the islands on the horizon (ocean/horizon.ts) from the beach and the lagoon: toward the island to the south
// (小浜島), west (西表島) and east (石垣島), by day, at sunset and at night. Usage (a build served at PORT):
// PORT=4174 OUT=hz node tools/lab/horizon-look.cjs   (SEA planet; TIMES '10:00,17:50,21:00'; VIEWS 'south,west,east')
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const OUT = process.env.OUT, SEA = process.env.SEA || 'planet'; fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const TIME of (process.env.TIMES || '10:00,17:50,21:00').split(',')) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage(); p.setDefaultTimeout(1800000); p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.goto(`http://localhost:${process.env.PORT}/?tier=high&debug&lab&time=${TIME}&wx=clear#${SEA}`, { waitUntil: 'commit' });
    await p.waitForFunction(() => !!(window.seaglass && window.seaglass.cur && window.seaglass.cur.eco), null, { timeout: 600000 });
    await p.addStyleTag({ content: '#newMark, #capRing, #caption { display: none !important; }' });
    // (bearings from the island's middle: 小浜島 about 220°, 西表島 260°, 石垣島 70° — north is -z, east +x)
    const V = { south: [220, -40, -210, 2.5], west: [262, -60, -180, 2.5], east: [70, 760, -260, 3] };
    for (const v of (process.env.VIEWS || 'south,west,east').split(',')) {
      const [brg, x, z, y] = V[v];
      const r = await p.evaluate(async ({ brg, x, z, y }) => {
        const s = window.seaglass; s.endOpening?.(); s.hold(true);
        const a = brg * Math.PI / 180, dx = Math.sin(a), dz = -Math.cos(a);
        s.aim([x, y, z], Math.atan2(-dx, -dz), 0.02); s.advance(20, 0.1); await new Promise((r) => setTimeout(r, 600));
        let n = 0; s.cur.group.traverse((o) => { if (o.userData.horizon) n++; });
        return { horizonMeshes: n };
      }, { brg, x, z, y });
      const f = `${OUT}/hz-${v}-${TIME.replace(':', '')}.png`; await p.screenshot({ path: f }); console.log(v, TIME, JSON.stringify(r), f);
    }
    await ctx.close();
  }
  await b.close();
})();
