// The speech bubble over the head of the one speaking (viewer design R-024, screens/BUBBLE.md, 2026-10-26; owner 11/3: in
// before trial 5). Instead of the subtitle at the bottom: the line said, as a bubble over the speaker's head — its name,
// the island's letters, a dotted rule, the meaning — its tail pointing at the head. Where it cannot be (the head off the
// screen, behind the camera, hidden by a rock or the ground; no room for it), the subtitle as before; chosen as a line
// begins, never changed half way. Only the picture: what is said is the world's (residents.ts saying/sayIsl/sayEn), read.
// Pure here (the placing, the lines, the times, the two at once); the drawing is live.ts.

/** Sizes in 1080p px (BUBBLE.md §1): scaled with the screen's height. */
export const B = { wMax: 690, padY: 18, padX: 26, tailW: 32, tailH: 16, edge: 96, bottom: 24, cornerIn: 28, step: 12 };
/** The top of each resident's head above its feet (m, as drawn: the models' bounds, scale in), and the point the tail
 *  points at, 12 cm over it (BUBBLE.md §2). */
export const HEAD_TOP: Record<string, number> = { dot: 1.18, lantern: 1.29, kame: 0.55, rakko: 0.44 };
export const OVER_HEAD = 0.12;

/** The meaning in lines (BUBBLE.md §1, §7): Japanese 15 characters a line, broken after a 、 or 。 where one falls in
 *  it, else where the line is full; English about 30, after a sentence or between words. More than three lines: null —
 *  too long for a bubble (the subtitle instead). */
export function bubbleLines(text: string, lang: 'ja' | 'en' = 'ja'): string[] | null {
  const t = text.trim(); if (!t) return [];
  const ja = (atMarks: boolean) => {
    const out: string[] = []; let s = t;
    while (s.length > 15) {
      let cut = -1; if (atMarks) for (let i = 0; i < 15; i++) if (s[i] === '、' || s[i] === '。') cut = i + 1;
      if (cut < 6) cut = 15;   // (no 、 or 。 late enough in it: where the line is full)
      if ('、。」）！？'.includes(s[cut] ?? '')) cut++;   // (never a 、 or a closing mark at a line's head)
      out.push(s.slice(0, cut)); s = s.slice(cut);
    }
    if (s) out.push(s);
    return out;
  };
  const en = (atSentences: boolean) => {
    const out: string[] = []; let line = '';
    for (const w of t.split(/\s+/)) {
      if (line && (line + ' ' + w).length > 30) { out.push(line); line = w; }
      else line = line ? `${line} ${w}` : w;
      if (atSentences && /[.!?]$/.test(w) && line.length > 18) { out.push(line); line = ''; }   // (a sentence ended well along: its own line)
    }
    if (line) out.push(line);
    return out;
  };
  // (broken at the marks if that makes three lines or fewer; else only where the lines are full)
  const lines = lang === 'ja' ? (ja(true).length <= 3 ? ja(true) : ja(false)) : (en(true).length <= 3 ? en(true) : en(false));
  return lines.length > 3 ? null : lines;
}

/** How long a line stays up at least (BUBBLE.md §6): 4 s and 0.15 s a character of its Japanese meaning, 10 s at most —
 *  on the English screen too, counted in the Japanese, so every screen holds it as long. */
export const readMs = (jaChars: number) => Math.min(10_000, 4_000 + 150 * jaChars);

export interface Rect { x: number; y: number; w: number; h: number }
export interface Place extends Rect { side: 'up' | 'left' | 'right'; shift: number; tip: { x: number; y: number }; base: [number, number, number, number] }
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Where a bubble w × h goes for the point tip (px, a screen W × H; BUBBLE.md §2): above it, its bottom edge 16 px over
 *  the point and centred on it, kept 96 px inside the left, right and top edges (only the bubble moves in; the tail still
 *  points at the head). With no room above, beside the head on the side with more room, the tail from its side. Clear of
 *  what is to be avoided (the corner blocks, the card, the other heads, the other bubble): moved along first — sideways
 *  above (half as far again as its own width at most: two speaking side by side), up or down beside (its height). None
 *  found: null (the subtitle). `keep` tries the last
 *  frame's place first, so it does not hop between two. */
export function placeBubble(o: { W: number; H: number; tip: { x: number; y: number }; w: number; h: number; avoid: Rect[]; keep?: { side: Place['side']; shift: number } | null }): Place | null {
  const { W, H, tip, w, h } = o, u = H / 1080, m = B.edge * u, gap = B.tailH * u, tw = (B.tailW * u) / 2, inset = B.cornerIn * u + tw;
  const fits = (r: Rect) => r.x >= m - 0.5 && r.x + r.w <= W - m + 0.5 && r.y >= m - 0.5 && r.y + r.h <= H - B.bottom * u + 0.5 && !o.avoid.some((a) => overlaps(r, a));
  const up = (shift: number): Place | null => {
    const x = clamp(tip.x - w / 2, m, W - m - w) + shift, y = tip.y - gap - h, r = { x, y, w, h };
    if (!fits(r)) return null;
    const bx = clamp(tip.x, x + inset, x + w - inset);
    return { ...r, side: 'up', shift, tip, base: [bx - tw, y + h, bx + tw, y + h] };
  };
  const beside = (side: 'left' | 'right', shift: number): Place | null => {
    const x = side === 'right' ? tip.x + gap : tip.x - gap - w, y = clamp(tip.y - h / 2, m, H - B.bottom * u - h) + shift, r = { x, y, w, h };
    if (!fits(r)) return null;
    const by = clamp(tip.y, y + inset, y + h - inset), ex = side === 'right' ? x : x + w;
    return { ...r, side, shift, tip, base: [ex, by - tw, ex, by + tw] };
  };
  const shifts = (most: number) => { const s = [0]; for (let k = B.step * u; k <= most; k += B.step * u) s.push(k, -k); return s; };
  const roomAbove = tip.y - gap - h >= m - 0.5;
  const sides: ('left' | 'right')[] = tip.x < W / 2 ? ['right', 'left'] : ['left', 'right'];
  const tryAt = (side: Place['side'], shift: number) => (side === 'up' ? up(shift) : beside(side, shift));
  if (o.keep && (o.keep.side === 'up') === roomAbove) { const p = tryAt(o.keep.side, o.keep.shift); if (p) return p; }
  if (roomAbove) { for (const s of shifts(w * 1.5)) { const p = up(s); if (p) return p; } return null; }
  for (const side of sides) for (const s of shifts(h)) { const p = beside(side, s); if (p) return p; }
  return null;
}

/** The point the tail points at, kept on the screen: a head gone past an edge (or behind the camera) is pointed at from
 *  that edge — for the rest of a line it began as a bubble (BUBBLE.md §3). */
export function tipOnScreen(p: { x: number; y: number; front: boolean }, W: number, H: number) {
  const k = H / 1080 * 8;
  if (!p.front) return { x: clamp(W - p.x, k, W - k), y: H - k };   // (behind the camera: below, on the side it went)
  return { x: clamp(p.x, k, W - k), y: clamp(p.y, k, H - k) };
}

/** A line said, as the screen keeps it: whose, as a bubble or the subtitle, since when, its voice ended when, how long
 *  it is held at least; faint once another has begun to speak. */
export interface Said { key: string; who: string; mode: 'bubble' | 'sub'; start: number; end: number | null; read: number; faint: boolean }

/** The lines on the screen (BUBBLE.md §4, §6): one for the one speaking now; when another begins, the last stays
 *  faint until it has been up its reading time, then goes — two at most (a third: the oldest at once). The one speaking
 *  again: its new line in place of its last. A line goes 0.4 s after its voice, never before its reading time; the
 *  subtitle as before, with the voice. `decide` chooses bubble or subtitle as a line begins. */
export function makeTalk(decide: (line: { key: string; who: string; ja: number }) => 'bubble' | 'sub') {
  let cur: Said | null = null, prev: Said | null = null;
  return {
    tick(now: number, line: { key: string; who: string; ja: number } | null): { cur: Said | null; prev: Said | null } {
      if (line && line.key !== cur?.key) {
        prev = cur && cur.mode === 'bubble' && cur.who !== line.who && now < cur.start + cur.read ? { ...cur, faint: true, end: cur.end ?? now } : null;
        cur = { key: line.key, who: line.who, mode: 'sub', start: now, end: null, read: readMs(line.ja), faint: false };
        cur.mode = decide(line);
      }
      if (!line && cur && cur.end === null) cur.end = now;
      if (cur && cur.end !== null && (cur.mode === 'sub' || now >= Math.max(cur.start + cur.read, cur.end + 400))) cur = null;
      if (prev && now >= prev.start + prev.read) prev = null;
      return { cur, prev };
    },
    /** The faint one let go at once (the one speaking now cannot be kept clear of it). */
    dropPrev() { prev = null; },
  };
}
