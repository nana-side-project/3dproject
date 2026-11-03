// Headless check of the speech bubbles (viewer design R-024, screens/BUBBLE.md; src/live/bubble.ts — pure):
//   lines    the meaning in lines: Japanese 15 a line, after a 、 or 。 where one falls, no 、 at a line's head; English
//            about 30; more than three lines: none (the subtitle)
//   read     how long a line is held at least: 4 s + 0.15 s a character, 10 s at most (20 characters: 7 s)
//   above    on each of the screens the stream is seen at: over the head, centred, its bottom 16 px (1080p) over the
//            point; 96 px inside the edges
//   edge     a head near the left edge: the bubble alone moved in, the tail still at the head, its root 28 px in from
//            the corner
//   beside   a head near the top: beside it, on the side with more room
//   avoid    the corner block and another head in its way: moved sideways clear of them; boxed in: none (the subtitle)
//   keep     two places as good: the last frame's kept (no hopping)
//   behind   a head behind the camera: pointed at from the bottom edge, on the side it went
//   talk     a line keeps the form it began with; held its reading time after a short voice, 0.4 s after a long one;
//            another speaking: the last faint until read; a third: the oldest gone at once; the same one again: no
//            faint one; the subtitle goes with the voice
// Usage: npx tsx scripts/bubble-check.ts
import { bubbleLines, readMs, placeBubble, tipOnScreen, makeTalk, overlaps, B, type Rect } from '../src/live/bubble';

let fail = 0;
const row = (ok: boolean, text: string) => { if (!ok) fail++; console.log(`${text} — ${ok ? 'PASS' : 'FAIL'}`); };
const near = (a: number, b: number, e = 0.6) => Math.abs(a - b) <= e;

{ // lines
  const a = bubbleLines('浜で待ったら、流木が打ち上がってきたよ。これで筏の部材が足りる。');
  const b = bubbleLines('ねえ、いっしょに来ない？');
  const c = bubbleLines('あ'.repeat(50));
  const e = bubbleLines('If you wait on the beach, driftwood comes in. That makes enough for the raft.', 'en');
  row(!!a && a.length <= 3 && a.every((l) => [...l].length <= 16) && a[0].endsWith('、') && !a.some((l) => /^[、。]/.test(l)) && a.join('') === '浜で待ったら、流木が打ち上がってきたよ。これで筏の部材が足りる。'
    && b?.length === 1 && c === null && !!e && e.every((l) => l.length <= 34) && e.length <= 3,
    `lines: ja ${JSON.stringify(a)}; short ${JSON.stringify(b)}; 50 chars ${c}; en ${JSON.stringify(e)}`);
}
row(readMs(20) === 7000 && readMs(0) === 4000 && readMs(60) === 10000, `read: 20 chars ${readMs(20)} ms, 0 ${readMs(0)}, 60 ${readMs(60)}`);

const SCREENS: [string, number, number][] = [['1080p', 1920, 1080], ['720p', 1280, 720], ['PC', 1440, 900], ['phone landscape', 844, 390], ['phone landscape small', 667, 375], ['phone landscape large', 932, 430]];
{ // above
  const bad: string[] = [];
  for (const [name, W, H] of SCREENS) {
    const u = H / 1080, w = 420 * u, h = 180 * u, tip = { x: W * 0.55, y: H * 0.62 }, p = placeBubble({ W, H, tip, w, h, avoid: [] });
    const ok = !!p && p.side === 'up' && near(p.x + w / 2, tip.x) && near(p.y + h, tip.y - B.tailH * u) && p.x >= B.edge * u - 0.5 && p.y >= B.edge * u - 0.5 && p.x + w <= W - B.edge * u + 0.5;
    if (!ok) bad.push(`${name} ${JSON.stringify(p)}`);
  }
  row(!bad.length, `above: ${SCREENS.length} screens${bad.length ? ` — ${bad.join(' / ')}` : ''}`);
}
{ // edge
  const W = 1920, H = 1080, tip = { x: 140, y: 700 }, p = placeBubble({ W, H, tip, w: 500, h: 180, avoid: [] });
  row(!!p && near(p.x, B.edge) && p.tip.x === tip.x && near(p.base[0], p.x + B.cornerIn) && p.base[1] === p.y + 180, `edge: bubble at x ${p?.x}, tail root ${p?.base[0]}–${p?.base[2]}, tip ${p?.tip.x}`);
}
{ // beside
  const W = 1920, H = 1080, l = placeBubble({ W, H, tip: { x: 600, y: 150 }, w: 400, h: 180, avoid: [] }), r = placeBubble({ W, H, tip: { x: 1400, y: 150 }, w: 400, h: 180, avoid: [] });
  row(l?.side === 'right' && near(l.x, 600 + B.tailH) && r?.side === 'left' && near(r.x + 400, 1400 - B.tailH) && l.base[0] === l.x, `beside: head at the top left → ${l?.side}; top right → ${r?.side}`);
}
{ // avoid
  const W = 1920, H = 1080, brand: Rect = { x: 80, y: 40, w: 520, h: 360 }, head: Rect = { x: 900, y: 350, w: 120, h: 150 };
  const a = placeBubble({ W, H, tip: { x: 420, y: 560 }, w: 500, h: 180, avoid: [brand] });
  const b = placeBubble({ W, H, tip: { x: 960, y: 620 }, w: 500, h: 180, avoid: [head] });
  const c = placeBubble({ W, H, tip: { x: 960, y: 620 }, w: 500, h: 180, avoid: [{ x: 0, y: 0, w: W, h: 600 }] });
  row(!!a && !overlaps(a, brand) && a.side === 'up' && !!b && !overlaps(b, head) && Math.abs(b.shift) <= 500 && c === null,
    `avoid: past the corner block shifted ${a?.shift?.toFixed(0)} px; past a head ${b?.shift?.toFixed(0)} px; boxed in → ${c}`);
}
{ // keep
  const W = 1920, H = 1080, head: Rect = { x: 935, y: 300, w: 50, h: 150 };   // (right over the middle: as good either side)
  const first = placeBubble({ W, H, tip: { x: 960, y: 620 }, w: 400, h: 180, avoid: [head] });
  const again = placeBubble({ W, H, tip: { x: 962, y: 620 }, w: 400, h: 180, avoid: [head], keep: first });
  const kept = placeBubble({ W, H, tip: { x: 958, y: 620 }, w: 400, h: 180, avoid: [head], keep: { side: 'up', shift: -(first?.shift ?? 0) } });
  row(!!first && first.shift !== 0 && again?.shift === first.shift && kept?.shift === -(first.shift), `keep: first ${first?.shift?.toFixed(0)}; next frame ${again?.shift?.toFixed(0)}; kept the other ${kept?.shift?.toFixed(0)}`);
}
{ // behind
  const t = tipOnScreen({ x: 300, y: 500, front: false }, 1920, 1080), o = tipOnScreen({ x: 2500, y: 500, front: true }, 1920, 1080);
  row(t.x === 1620 && t.y === 1072 && o.x === 1912 && o.y === 500, `behind: pointed at from (${t.x}, ${t.y}); off the right edge (${o.x}, ${o.y})`);
}
{ // talk
  let form: 'bubble' | 'sub' = 'bubble', asked = 0;
  const T = makeTalk(() => { asked++; return form; });
  const L = (who: string, n = 10) => ({ key: `${who}|${n}`, who, ja: n });
  let s = T.tick(0, L('dot')); form = 'sub'; s = T.tick(500, L('dot'));
  const kept = s.cur?.mode === 'bubble' && asked === 1;
  s = T.tick(1000, null); const held = !!T.tick(5400, null).cur; s = T.tick(5600, null); const gone = !s.cur;   // (10 chars: held 5.5 s)
  form = 'bubble'; T.tick(6000, L('dot', 2)); T.tick(10900, L('dot', 2)); T.tick(11000, null); const after = !!T.tick(11350, null).cur; s = T.tick(11450, null); const after2 = !s.cur;   // (2 chars: 4.3 s; a voice of 5 s: 0.4 s after it)
  T.tick(20000, L('dot')); s = T.tick(21000, L('rakko'));
  const faint = s.prev?.who === 'dot' && s.prev.faint && s.cur?.who === 'rakko';
  s = T.tick(22000, L('kame')); const third = s.prev?.who === 'rakko' && s.cur?.who === 'kame';
  s = T.tick(26500, L('kame')); const readOut = !s.prev;   // (rakko's 10 chars: 5.5 s from 21 s)
  s = T.tick(27000, L('kame', 3)); const same = !s.prev && s.cur?.key === 'kame|3';
  form = 'sub'; T.tick(40000, L('lantern')); s = T.tick(40100, null); const subGone = !s.cur;
  row(kept && held && gone && after && after2 && faint && third && readOut && same && subGone,
    `talk: form kept ${kept}; held to its reading time ${held}/${gone}; 0.4 s after a long voice ${after}/${after2}; the last faint ${faint}; a third ${third}; read out ${readOut}; the same again ${same}; subtitle with the voice ${subGone}`);
}
process.exit(fail ? 1 : 0);
