// The live screen (?live): the island streamed as it is, through "the observation window" (docs/proposals/viewer-
// design-2026-10-16/screens/README.md, v2 2026-10-17). It only reads the world as it already is — who is being followed,
// the words the world has for what it is doing, the island's date and time — and gives nothing back: no sense(), no
// options, nothing to a resident's mind. The app's own controls are put away; the drone follows the residents by what is
// going on with each (director.ts).
// Fonts are the stream PC's own files (OFL, @fontsource): no request leaves the machine for them.
import '@fontsource/zen-old-mincho/500.css';
import '@fontsource/zen-old-mincho/600.css';
import '@fontsource/cormorant-sc/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './live.css';
import { islandDate } from '../world/island-time';
import { localTimeString } from '../time/clock';
import { trimStatus, wrapStatus, subtitleLines } from './status-line';
import { glyphs, LEX } from '../robots/islandlang';
import { luminance, brightTenth, hazeFor, hazeStyle } from './scrim';
import { statusEn, firstEn, asLine, FIXED_EN, NAMES_EN } from './en';
import { captionSender } from './captions';
import { makeDirector, awake } from './director';
import { chapter1 } from '../world/chapter1';
import { chapter2 } from '../world/chapter2';
import { chapterView, startCard, endCard, goneCard, chapter2View, startCard2, endCard2, chapterShown } from './chapter-line';
import { makeCues, trialCue, gatherCue, type Cue } from './cues';
import { B, bubbleLines, placeBubble, tipOnScreen, makeTalk, overlaps, type Place, type Rect } from './bubble';
import { PLACES, HERE_M, placeWords, type PlaceId } from './fixed';
import type { Pose } from './fleet';

export interface LiveCtx {
  residents(): any | null;           // the island's residents, once the island is built
  watched(): any | null;             // the one the drone follows now
  watch(r: any): void;               // follow this one
  clockMs(): number;
  tz(): number;
  cam?(who: string, pri: number, kind: string, why: string): void;   // (each change of who is followed, for the log: ?rehearsal)
  visible?(r: any): boolean;         // (the drone fleet, ADR 0010: its camera sees it — src/live/fleet.ts)
  skip?(who: string, pri: number, why: string): void;   // (one passed over, its camera not seeing it: for the log)
  bridging?(): boolean;              // (the sky between two places, 3–5 s: no band on it — MULTICAM.md §3-1)
  cue?(c: Cue): void;                // a notification sound (audio.ts cue; PROGRAM.md §5-3)
  speaking?(): boolean;              // a resident's voice sounding now (a notification sound waits for it to end)
  cueLog?(c: Cue, sounded: boolean, why: string): void;   // (each sounded or let go, for the log: ?rehearsal)
  /** Where r's head is on the screen (px; the point over it the bubble's tail points at), and — sight asked — whether
   *  the camera on air sees it (BUBBLE.md §3). */
  headAt?(r: any, sight?: boolean): { x: number; y: number; front: boolean; on: boolean; seen: boolean } | null;
  /** The fixed cameras there now (stage 2, src/live/fixed.ts): each place's subject and where its camera looks. */
  places?(): { subj: { id: PlaceId; place: PlaceId; no: string }; at: Pose }[];
  /** A place's things as the world has them now, for its band (fixed.ts placeWords). */
  placeState?(id: PlaceId): { built: number; roofN: number; hutN: number; raft: { parts: number; n: number; away: boolean }; firing: boolean; boiling: boolean; drying: boolean; lit: boolean } | null;
}
/** The drone's number for each one it follows (01–04; 13 is the island round, later). */
const DORON: Record<string, string> = { dot: '01', rakko: '02', kame: '03', lantern: '04' };
const DORON_ORDER = Object.keys(DORON);
export function makeLive(ctx: LiveCtx) {
  document.body.classList.add('live');
  // (?lang=en: the same window in English — the world's words turned on this side only: src/live/en.ts; ?captions=<url>:
  // what is said, and the island's firsts, sent as captions to the stream PC's own sender, tools/live/captions.mjs — in
  // their own language, English unless ?captionLang=ja: a Japanese screen carries English captions, viewer design v2 §6)
  const q = new URLSearchParams(location.search), en = q.get('lang') === 'en', captions = captionSender(q.get('captions'));
  const capEn = q.get('captionLang') !== 'ja';
  const nameIn = (r: any, inEn: boolean) => (inEn ? NAMES_EN[r?.v?.name] ?? r?.v?.name : r?.v?.name) ?? '';
  const nameOf = (r: any) => nameIn(r, en);
  const dateOf = (ms: number) => { const d = islandDate(ms); return en ? FIXED_EN.date(d.year, d.month, d.day) : `島暦${d.year}年 ${d.month}月${d.day}日`; };
  const root = document.createElement('div'); root.id = 'live'; if (en) root.classList.add('en');
  root.innerHTML = `
    <div class="brand"><div class="en">UTSUSHIYO PROJECT</div><div class="ja"><i class="ser">Series 1</i>${en ? FIXED_EN.brand : 'ルマウ'}</div></div>
    <div class="when"><div><span class="date"></span><span class="time"></span></div><div class="ai">${en ? FIXED_EN.ai : '住人はAIです ・ 映像は自動で撮影しています'}</div></div>
    <div class="chap fade off"><div class="c1"><span class="no"></span><span class="nm"></span><span class="dy"></span></div><div class="way fade"></div><div class="cargo fade"></div></div>
    <div class="band fade off"><div class="doron"><span class="n"></span>DORON</div>
      <div class="who"><span class="isl-name"></span><span class="name"></span><span class="line"></span></div><div class="status fade"></div><div class="trial fade off"><span class="k"></span><span class="t"></span></div></div>
    <div class="card fade off"><div class="rule"></div><div class="head">${en ? FIXED_EN.first : '島で初めて'}</div><div class="what"></div><div class="at"></div><div class="rule"></div></div>
    <div class="sub fade off"><div class="who"><span class="line"></span><span class="name"></span></div><div class="isl-line"></div><div class="tr"></div></div>`;
  document.body.appendChild(root);
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const band = $('.band'), status = $('.status'), trialEl = $('.band .trial');
  const measure = document.createElement('canvas').getContext('2d')!;
  let tick = 0, shownFor = '', shownText = '', swapT = 0;

  // (the line fits the band's width at its own size and face: broken after a 、 or 。 if not)
  const fits = (line: string) => { measure.font = `500 ${status.style.fontSize || getComputedStyle(status).fontSize} ${en ? "'Cormorant Garamond'" : "'Zen Old Mincho'"}`; return measure.measureText(line).width <= innerWidth * 0.5 - innerHeight / 1080 * 24; };
  function show(r: any, text: string) {
    const line = en ? statusEn(trimStatus(text)) : trimStatus(text);   // (English the table does not have: no line, the name alone)
    const lines = line ? wrapStatus(en ? asLine(line) : line, fits) : [];
    status.innerHTML = lines.map((l) => `<span>${l.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</span>`).join('');
    const pl = r.place ? PLACES.find((x) => x.id === r.place) : null;   // (a place's camera: its number and the place's name — MULTICAM.md §3-1)
    $('.doron .n').textContent = pl?.no ?? DORON[r.id] ?? '13';
    $('.band .who .name').textContent = pl ? (en ? pl.en : pl.ja) : nameOf(r);
    $('.band .who .isl-name').innerHTML = pl ? (pl.isl ? glyphs([pl.isl], 'isl', 1.25) : '') : islName(r);
    ($('.band .who .line')).style.setProperty('--c', pl ? 'var(--ink2)' : r.sp?.color ?? '#fff');
  }
  // A place's band (MULTICAM.md §3-1): those here (in the residents' order) — the first one's doing the line, who is here the
  // small line; none here: the thing as it is now (fixed.ts placeWords); neither: the place's name alone.
  const hereAt = (R: any, r: any) => { const a = ctx.places?.().find((p) => p.subj.id === r.id)?.at; return a ? DORON_ORDER.map((id) => R.list.find((x: any) => x.id === id)).filter((x: any) => x && Math.hypot(x.pos.x - a.lx, x.pos.z - a.lz) <= HERE_M && awake(x)) : []; };
  function placeText(R: any, r: any): string {
    const here = hereAt(R, r); if (here.length) return R.status(here[0]) as string;
    const st = ctx.placeState?.(r.place); if (!st) return '';
    const hr = ((ctx.clockMs() / 3.6e6 + ctx.tz()) % 24 + 24) % 24;
    return placeWords(r.place, { ...st, here: [], night: hr < 5 || hr >= 18.5 });
  }

  const esc = (t: string) => t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
  const islName = (r: any) => { const w = (LEX as Record<string, string>)[r.id]; return w ? glyphs([w], 'isl', 1.25) : ''; };
  // (who is speaking, of the one followed and whoever it is with: the followed one, the one it talks with, or one
  // speaking near it at the fire)
  const speaker = (R: any, r: any) => {
    if (r.place) return hereAt(R, r).find((x: any) => x.saying) ?? null;   // (a place on air: one of those here speaking)
    if (r.saying) return r;
    const o = r.talk ? (r.talk.a === r ? r.talk.b : r.talk.a) : null; if (o?.saying) return o;
    return R.list.find((x: any) => x !== r && x.saying && Math.hypot(x.pos.x - r.pos.x, x.pos.z - r.pos.z) < 20) ?? null;
  };
  // The subtitle (viewer design v2 §4) — now only for a line that cannot be a bubble (BUBBLE.md §3: the head off the
  // screen or hidden, no room): while it is up the band steps back, and at the bottom centre — who speaks, the line in
  // the island's letters, its meaning (broken after its first sentence when long).
  const sub = $('.sub');
  let subKey = '';
  function subtitle(sp: any | null, key: string, r: any) {
    if (key === subKey) return; subKey = key;
    if (!sp) { sub.classList.add('off'); if (r && !ctx.bridging?.()) band.classList.remove('off'); return; }
    const said = en ? sp.sayEn ?? '' : sp.saying;   // (in English, its own English line: none, and only the island's letters show)
    band.classList.add('off');
    const fill = () => {
      ($('.sub .who .line')).style.setProperty('--c', sp.sp?.color ?? '#fff');
      $('.sub .who .name').textContent = nameOf(sp);
      $('.sub .isl-line').innerHTML = sp.sayIsl?.length ? glyphs(sp.sayIsl, 'isl', 1.25) : '';
      $('.sub .tr').innerHTML = said ? subtitleLines(said, en ? 'en' : 'ja').map((l) => `<span>${esc(l)}</span>`).join('') : '';
      sub.classList.remove('off');
    };
    if (sub.classList.contains('off')) fill(); else { sub.classList.add('off'); setTimeout(() => { if (subKey === key) fill(); }, 600); }
  }

  // The speech bubbles (R-024, screens/BUBBLE.md; the placing, lines and times in src/live/bubble.ts): a line said is a
  // bubble over the speaker's head when its head is in the picture and in sight as the line begins and there is room;
  // else the subtitle. The bubble follows the head smoothly (sideways in 0.2 s, up and down in 0.6 s: no bobbing), kept
  // clear of the corner blocks, the card, the other heads and the other bubble; at a cut it is at once where it belongs.
  // When another begins to speak, the last stays faint until read. The band stays (only faint where a bubble lies on it).
  const SVGNS = 'http://www.w3.org/2000/svg', bubLayer = document.createElement('div'); bubLayer.className = 'bubs';
  const tails = document.createElementNS(SVGNS, 'svg'); tails.classList.add('tails'); bubLayer.appendChild(tails); root.appendChild(bubLayer);
  interface Bub { el: HTMLElement; tail: SVGPolygonElement; key: string; who: any; ax: number; ay: number; place: Place | null; set: boolean }
  const bubs: Bub[] = [0, 1, 2, 3].map(() => {   // (the one speaking, the faint one before it, and those going)
    const el = document.createElement('div'); el.className = 'bub off';
    el.innerHTML = '<div class="nm"></div><div class="isl-line"></div><div class="dots"></div><div class="tr"></div>';
    bubLayer.appendChild(el);
    const tail = document.createElementNS(SVGNS, 'polygon'); tail.classList.add('off'); tails.appendChild(tail);
    return { el, tail, key: '', who: null, ax: 0, ay: 0, place: null, set: false };
  });
  const bubOf = (key: string) => bubs.find((b) => b.key === key) ?? null;
  function fillBub(b: Bub, sp: any, key: string, lines: string[]) {
    Object.assign(b, { key, who: sp, place: null, set: false });
    const u = innerHeight / 1080;
    b.el.style.setProperty('--c', sp.sp?.color ?? '#8aa');
    b.el.classList.remove('faint'); b.tail.classList.remove('faint');
    (b.el.querySelector('.nm') as HTMLElement).textContent = nameOf(sp);
    const isl = b.el.querySelector('.isl-line') as HTMLElement; isl.innerHTML = sp.sayIsl?.length ? glyphs(sp.sayIsl, 'isl', 1.25) : '';
    // (the island's letters 30 px high — less when long, down to 22 px, to keep within the bubble's widest)
    const svg = isl.querySelector('svg'), vb = svg?.getAttribute('viewBox')?.split(' ').map(Number);
    if (svg && vb) svg.style.height = `${Math.max(22 * u, Math.min(30 * u, ((B.wMax - 2 * B.padX) * u * vb[3]) / vb[2]))}px`;
    (b.el.querySelector('.tr') as HTMLElement).innerHTML = lines.map((l) => `<span>${esc(l)}</span>`).join('');
    b.el.classList.toggle('bare', !lines.length);   // (no meaning on this screen: the island's letters alone)
  }
  function letGo(b: Bub) {
    b.el.classList.add('off'); b.tail.classList.add('off');
    const k = b.key; setTimeout(() => { if (b.key === k && b.el.classList.contains('off')) { b.key = ''; b.who = null; } }, 450);
  }
  /** What a bubble keeps clear of: the corner blocks and the card as they are up, the other heads in the picture. */
  function avoidFor(b: Bub): Rect[] {
    const u = innerHeight / 1080, pad = 16 * u, out: Rect[] = [];
    for (const sel of ['.brand', '.chap', '.when', '.card']) {
      const el = $(sel); if (el.classList.contains('off')) continue;
      const r = el.getBoundingClientRect(); if (r.width) out.push({ x: r.left - pad, y: r.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad });
    }
    for (const o of ctx.residents()?.list ?? []) {
      if (o === b.who) continue;
      const hp = ctx.headAt?.(o, false); if (hp?.on) out.push({ x: hp.x - 60 * u, y: hp.y - 30 * u, w: 120 * u, h: 150 * u });
    }
    return out;
  }
  /** The bubble placed for its speaker's head now (eased); true if a place clear of all was found this frame (else it
   *  keeps where it was). */
  function drawBub(b: Bub, dt: number, extra: Rect[]): boolean {
    const hp = ctx.headAt?.(b.who, false); if (!hp) return false;
    const W = innerWidth, H = innerHeight, t = tipOnScreen(hp, W, H);
    if (!b.set || Math.hypot(t.x - b.ax, t.y - b.ay) > H * 0.25) { b.ax = t.x; b.ay = t.y; b.set = true; }   // (a cut: at once)
    else { b.ax += (t.x - b.ax) * (1 - Math.exp(-dt / 0.2)); b.ay += (t.y - b.ay) * (1 - Math.exp(-dt / 0.6)); }
    const p = placeBubble({ W, H, tip: { x: b.ax, y: b.ay }, w: b.el.offsetWidth, h: b.el.offsetHeight, avoid: [...avoidFor(b), ...extra], keep: b.place });
    if (p) b.place = p;
    const q = b.place; if (!q) return false;
    const tip = p ? q.tip : { x: b.ax, y: b.ay };
    b.el.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`;
    b.el.style.transformOrigin = `${((q.base[0] + q.base[2]) / 2 - q.x).toFixed(1)}px ${((q.base[1] + q.base[3]) / 2 - q.y).toFixed(1)}px`;   // (the faint one shrinks toward its tail)
    b.tail.setAttribute('points', `${q.base[0].toFixed(1)},${q.base[1].toFixed(1)} ${q.base[2].toFixed(1)},${q.base[3].toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)}`);
    return !!p;
  }
  /** As a line begins: a bubble, if the head is in the picture and in sight, the line short enough, and room for it. */
  function decide(sp: any, key: string): 'bubble' | 'sub' {
    if (!ctx.headAt || ctx.bridging?.()) return 'sub';   // (the sky between two places: the subtitle, as on #228)
    const lines = bubbleLines(en ? sp.sayEn ?? '' : sp.saying, en ? 'en' : 'ja'), hp = ctx.headAt(sp);
    const b = bubs.find((x) => !x.key);
    if (!lines || !hp?.on || !hp.seen || !b) return 'sub';
    fillBub(b, sp, key, lines);
    const others = bubs.filter((x) => x !== b && x.key && x.place && !x.el.classList.contains('off')).map((x) => x.place!);
    if (drawBub(b, 0, others) || (b.place = null, drawBub(b, 0, []))) { b.el.classList.remove('off'); b.tail.classList.remove('off'); return 'bubble'; }
    b.key = ''; b.who = null; return 'sub';
  }
  let speakerNow: any = null, talking = false, capKey = '';
  const talk = makeTalk((line) => decide(speakerNow, line.key));
  function talkTick(R: any, r: any, dt: number) {
    const sp = r ? speaker(R, r) : null, key = sp ? `${sp.id}|${sp.saying}` : '';
    if (sp && key !== capKey) {   // (YouTube's captions as before, a line each, bubble or subtitle: BUBBLE.md §7)
      capKey = key; const cap = capEn ? sp.sayEn ?? '' : sp.saying;
      if (cap) captions.send(`${nameIn(sp, capEn)}: ${cap}`, ctx.clockMs());
    }
    speakerNow = sp;
    const { cur, prev } = talk.tick(performance.now(), sp ? { key, who: sp.id, ja: [...sp.saying].length } : null);
    talking = !!cur;
    subtitle(cur?.mode === 'sub' ? sp : null, cur?.mode === 'sub' ? cur.key : '', r);
    const cb = cur?.mode === 'bubble' ? bubOf(cur.key) : null, pb = prev ? bubOf(prev.key) : null;
    for (const b of bubs) if (b.key && b !== cb && b !== pb && !b.el.classList.contains('off')) letGo(b);
    let pr: Rect[] = [];
    if (pb) {
      pb.el.classList.add('faint'); pb.tail.classList.add('faint');
      drawBub(pb, dt, []);
      if (pb.place) {   // (as it is drawn: 92 % about the root of its tail, and a little room round it)
        const q = pb.place, ox = (q.base[0] + q.base[2]) / 2, oy = (q.base[1] + q.base[3]) / 2, k = innerHeight / 1080 * 10, s = 0.92;
        pr = [{ x: ox + (q.x - ox) * s - k, y: oy + (q.y - oy) * s - k, w: q.w * s + 2 * k, h: q.h * s + 2 * k }];
      }
    }
    if (cb && !drawBub(cb, dt, pr) && pb) { talk.dropPrev(); letGo(pb); drawBub(cb, 0, []); }   // (the faint one in the way: it goes)
    const br = band.getBoundingClientRect(), bandR = { x: br.left, y: br.top, w: br.width, h: br.height };
    band.classList.toggle('dim', [cb, pb].some((b) => b?.place && !b.el.classList.contains('off') && overlaps(b.place, bandR)));
  }

  const director = makeDirector({ residents: ctx.residents, watched: ctx.watched, watch: ctx.watch, cam: ctx.cam, speaking: () => talking, visible: ctx.visible, skip: ctx.skip, places: ctx.places });
  function update(dt: number) {
    const R = ctx.residents();
    if (!R) return;
    director.tick(dt);   // (whom the drone follows: director.ts)
    const r = ctx.watched();
    talkTick(R, r, dt);   // (every frame: a line begins and ends with the voice; a bubble follows its head)
    // (the sky between two places: no band on it; the next one's band comes in after it, as for another one followed)
    if (ctx.bridging?.()) { band.classList.add('off'); shownFor = ''; }
    if ((tick -= dt) > 0) return; tick = 1;   // (the words read once a second)
    $('.when .date').textContent = dateOf(ctx.clockMs());
    $('.when .time').textContent = localTimeString(ctx.clockMs(), ctx.tz());
    chapterLine(R);
    if (!r || ctx.bridging?.()) { band.classList.add('off'); return; }
    if (r.place) hereLine(R, r); else trialLine(r);
    const text = trimStatus(r.place ? placeText(R, r) : (R.status(r) as string));   // (as it is shown: the metres still to go taken out, or the line would fade out and back with the same words each time they change — science, #121)
    if (r.id !== shownFor) {   // (another one followed: the band fades out, changes, fades in)
      band.classList.add('off'); shownFor = r.id; shownText = text; swapT = 0.6;
      setTimeout(() => { show(r, text); if (!subKey) band.classList.remove('off'); }, 600);
    } else if (text !== shownText && (swapT -= 1) <= 0) {   // (its doing changed: the line alone fades and changes)
      shownText = text; status.classList.add('off');
      setTimeout(() => { show(r, text); status.classList.remove('off'); }, 600);
    }
  }
  // The trial line under the status (PROGRAM.md §1-2, R-030): what the one followed is trying, in its own words, while a
  // goal of its own lasts (never its habits); for 12 s after a result, how its last try came out, in the words that try
  // was shown in — 確かめた, 違っていた, やりとげた (only as the world checked it), まだ届かない, やってみた (its steps
  // taken, nothing to check), うまくいかなかった ・ the world's reason — then what it is trying now, or nothing until
  // it decides. Its words only: none that fail the rule (residents.ts trialWords), and none on the English screen until
  // there are English words. Two lines at most (live.css).
  const TRIAL_K: Record<string, [string, string, boolean]> = { confirmed: ['確かめた', 'Confirmed', true], refuted: ['違っていた', 'Not so', false], done: ['やりとげた', 'Done', true], 'not-yet': ['まだ届かない', 'Not there yet', false], 'steps-done': ['やってみた', 'Tried it', false], failed: ['うまくいかなかった', "Didn't work", false] };
  let trialShown = '';
  /** A place on air: who is here, small, in the trial line's place — 「ここにいる　ドット・カメマル」, a line of each one's colour. */
  function hereLine(R: any, r: any) {
    const here = hereAt(R, r), key = here.length ? `here|${r.id}|${here.map((x: any) => x.id).join(',')}` : '';
    if (key === trialShown) return; trialShown = key;
    if (!key) { trialEl.classList.add('off'); return; }
    $('.band .trial .k').textContent = en ? 'Here' : 'ここにいる'; trialEl.classList.remove('gold');
    $('.band .trial .t').innerHTML = here.map((x: any) => `<span class="here" style="--c:${x.sp?.color ?? '#fff'}">${esc(nameOf(x))}</span>`).join(en ? ', ' : '・');
    trialEl.classList.remove('off');
  }
  function trialLine(r: any) {
    const d = r?.tried, fresh = !!d?.text && ctx.clockMs() - d.at < 12e3, t = r?.trial;
    const k = fresh ? TRIAL_K[d.result] : t?.active ? (['試み', 'Trying', true] as [string, string, boolean]) : null;
    const head = k ? `${k[0]}${fresh && d.result === 'failed' && d.outcome ? ` ・ ${d.outcome}` : ''}` : '';
    const words = (fresh ? d.text : t?.active ? t.text : '') ?? '';
    const key = k && words && !en ? `${r.id}|${head}|${words}` : '';
    if (key === trialShown) return; trialShown = key;
    if (!key) { trialEl.classList.add('off'); return; }
    $('.band .trial .k').textContent = head; trialEl.classList.toggle('gold', k![2]);
    $('.band .trial .t').textContent = words;
    trialEl.classList.remove('off');
  }
  // The chapter at the top left (PROGRAM.md §2-1, plan B — CHAPTER1_END.md §4): its name and day, the way (done in sea
  // green, the next underlined in sand, the rest faint), what was brought in four words (sand when nearly gone or gone);
  // a word changed is swapped over 0.6 s. Its cards: the start (the question) when the first load has just come, the end
  // when the south island's load is on the shelf — each once (kept in this browser), and only as it happens, not on
  // opening the page later. A minute after chapter 1's end card, chapter 2 (PROGRAM.md §2-2, D34): its start card comes,
  // and the block fades over to it as the card is on (chapterShown); it has no load's line. It ends with the first lamp:
  // its end card a minute after the first lamp's own, the block two minutes more, then gone until chapter 3 has its words.
  // An island whose first lamp was lit before has no chapter 2: chapter 1's block goes two minutes after its end.
  let chapShown = 0, chapSwapAt = 0, start2Waiting = false;
  const chap = $('.chap'), shownPart: Record<string, string> = {}, sep = `<span class="sep">${en ? '·' : '・'}</span>`;
  const once = (k: string) => { try { if (localStorage.getItem(k)) return false; localStorage.setItem(k, '1'); } catch { /* the card all the same */ } return true; };
  const swap = (sel: string, html: string) => {
    if (shownPart[sel] === html) return; const el = $(sel), first = shownPart[sel] === undefined; shownPart[sel] = html;
    if (first) { el.innerHTML = html; return; }
    el.classList.add('off'); setTimeout(() => { if (shownPart[sel] === html) { el.innerHTML = html; el.classList.remove('off'); } }, 600);
  };
  function chapterLine(R: any) {
    const c = R.village ? chapter1(R.village) : null, c2 = R.village ? chapter2(R.village) : null, now = ctx.clockMs();
    const two = !!c2 && now >= c2.began + 60e3;
    if (c) {
      if (now - c.began < 5 * 60e3 && once(`seaglass.chapter1:${c.began}:start`)) { const k = startCard(en); queue.push({ head: k.head, text: esc(k.what), at: c.began }); }
      if (c.ended !== null && now - c.ended < 5 * 60e3 && once(`seaglass.chapter1:${c.began}:end`)) { const k = endCard(c, en); queue.push({ head: k.head, text: esc(k.what), at: c.ended }); }
      // (what was brought run out: a world's event in the milestone's card, not the chapter's end — D33)
      for (const m of ['clay', 'bamboo'] as const) { const at = c.gone[m]; if (at !== null && at > 0 && now - at < 5 * 60e3 && once(`seaglass.chapter1:${c.began}:${m}-gone`)) { const k = goneCard(m, en); queue.push({ head: k.head, text: esc(k.what), at }); } }
    }
    if (c2 && two) {
      if (now - c2.began < 6 * 60e3 && once(`seaglass.chapter2:${c2.began}:start`)) { const k = startCard2(en); start2Waiting = true; queue.push({ head: k.head, text: esc(k.what), at: c2.began + 60e3, shown: () => { start2Waiting = false; } }); }
      if (c2.ended !== null && c2.ended > 0 && now >= c2.ended + 60e3 && now - c2.ended < 6 * 60e3 && once(`seaglass.chapter2:${c2.began}:end`)) { const k = endCard2(en); queue.push({ head: k.head, text: esc(k.what), at: c2.ended + 60e3 }); }
    }
    const n = chapterShown(c, c2, now, start2Waiting);
    if (!n) { chap.classList.add('off'); return; }
    // (another chapter: the block fades out, changes, fades in)
    if (n !== chapShown) {
      if (chapShown && !chap.classList.contains('off')) { chap.classList.add('off'); chapSwapAt = performance.now() + 600; return; }
      if (performance.now() < chapSwapAt) return;
      chapShown = n; for (const k of Object.keys(shownPart)) delete shownPart[k];
    }
    const v = n === 2 ? chapter2View(c2!, now, ctx.tz(), en) : chapterView(c!, now, ctx.tz(), en);
    $('.chap .no').textContent = v.no; $('.chap .nm').textContent = v.name; $('.chap .dy').textContent = v.day;
    swap('.chap .way', v.way.map((x) => `<span class="${x.k}">${esc(x.w)}</span>`).join(sep));
    swap('.chap .cargo', v.cargo ? `${esc(v.cargo.label)}${v.cargo.items.map((x) => `<span class="lv${x.low ? ' low' : ''}">${esc(x.w)}</span>`).join(sep)}` : '');
    chap.classList.remove('off');
  }
  // The haze under each group of words (src/live/scrim.ts): once a second, right after the frame is drawn, the picture
  // shrunk to 64 × 36; the bright tenth of what lies behind each group sets its haze, eased over a second (CSS).
  const SW = 64, SH = 36, shrink = document.createElement('canvas'); shrink.width = SW; shrink.height = SH;
  const sctx = shrink.getContext('2d', { willReadFrequently: true })!;
  const groups = ['.brand', '.when', '.chap', '.band', '.sub', '.card'].map((sel) => { const el = $(sel), haze = document.createElement('div'); haze.className = 'haze'; root.insertBefore(haze, root.firstChild); return { el, haze, h: 0 }; });
  let sampleAt = 0;
  function sample(canvas: HTMLCanvasElement) {
    const now = performance.now(); if (now - sampleAt < 1000) return; sampleAt = now;
    try { sctx.drawImage(canvas, 0, 0, SW, SH); } catch (e) { return; }
    const px = sctx.getImageData(0, 0, SW, SH).data, sx = SW / innerWidth, sy = SH / innerHeight;
    for (const g of groups) {
      const r = g.el.getBoundingClientRect(), shown = r.width > 0 && !g.el.classList.contains('off');
      const pad = innerHeight / 1080 * 28, x0 = Math.max(r.left - pad * 1.5, r.left - (innerWidth - r.right)), y0 = r.top - pad, w = Math.min(r.width + pad * 3, innerWidth - x0), hh = r.height + pad * 2;   // (never past the screen's edge)
      Object.assign(g.haze.style, { left: `${x0}px`, top: `${y0}px`, width: `${w}px`, height: `${hh}px` });
      const lum: number[] = [];
      for (let y = Math.max(0, Math.floor(r.top * sy)); y <= Math.min(SH - 1, Math.floor(r.bottom * sy)); y++)
        for (let x = Math.max(0, Math.floor(r.left * sx)); x <= Math.min(SW - 1, Math.floor(r.right * sx)); x++) { const i = (y * SW + x) * 4; lum.push(luminance(px[i], px[i + 1], px[i + 2])); }
      g.h = shown ? hazeFor(brightTenth(lum)) : 0;
      const st = hazeStyle(g.h), u = innerHeight / 1080;
      g.haze.style.setProperty('--black', st.black.toFixed(3));
      g.haze.style.setProperty('--bright', st.bright.toFixed(3));
      g.haze.style.setProperty('--blur', `${(st.blurPx * u).toFixed(2)}px`);
    }
    // (the bubbles' ground a shade darker when the picture is dark — night: BUBBLE.md §8, the "dark" of v2 §5)
    const all: number[] = []; for (let i = 0; i < px.length; i += 4) all.push(luminance(px[i], px[i + 1], px[i + 2]));
    bubLayer.classList.toggle('night', hazeFor(brightTenth(all)) === 0);
  }
  /** For the stream's log (the test week): how hazy each group is now, 0–1. */
  const haze = () => Object.fromEntries(groups.map((g, i) => [['brand', 'when', 'chap', 'band', 'sub', 'card'][i], +g.h.toFixed(3)]));

  // The milestone card (viewer design v2 §4): when the world marks an event the first of its kind on the island, at the
  // upper centre between two gold hair lines — "島で初めて", the event's own sentence (to its first 。), the island's
  // date and time — for about eight seconds, then it fades. Several at once wait their turn. The chapter's own cards
  // (its start and end) take the same place with their own heading.
  const card = $('.card'), queue: { head?: string; text: string; at: number; shown?: () => void }[] = [];
  let cardT = 0;
  // The notification sounds (PROGRAM.md §5-3, src/live/cues.ts): a card's three notes as it shows; a try's as it is decided
  // or comes out (words on the screen only); the gatherings' knocks, from the island's clock. On the viewer's own time:
  // one every three minutes at most, the card's excepted.
  const cues = makeCues((c) => ctx.cue?.(c), () => ctx.speaking?.() ?? false, (c, sounded, why) => ctx.cueLog?.(c, sounded, why));
  let cueHr = -1;
  function cueTick() {
    const R = ctx.residents(), hr = ((ctx.clockMs() / 3.6e6 + ctx.tz()) % 24 + 24) % 24, now = performance.now();
    if (cueHr >= 0 && R?.meets && R.meetAt) { const g = gatherCue(cueHr, hr, R.meetAt, R.meets); if (g) cues.want(g, now); }
    cueHr = hr; cues.tick(now);
  }
  function event(kind: string, text: string, r: any, meta?: { milestone?: string; trial?: { kind: string; result?: string; text: string | null } }) {
    director.event(kind, text, r, meta);   // (ranked for the drone)
    // (a trial begun or come out, with words to show: rank 1 — not its steps taken with nothing to check, which may be many:
    // on one already followed, only the heading changes, PROGRAM.md §4)
    if (meta?.trial?.text && meta.trial.result !== 'steps-done') director.trial(r, meta.trial.result ?? 'start', meta.trial.text);
    { const c = en ? null : trialCue(meta?.trial); if (c) cues.want(c, performance.now()); }   // (no words on the English screen yet: no sound for them)
    if (!meta?.milestone) return;
    const ja = trimStatus(text.split('。')[0]), esc1 = (t: string) => t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
    const html = en ? firstEn(meta.milestone, r?.v?.name ?? '', true) : esc1(ja);
    if (html) queue.push({ text: html, at: ctx.clockMs() });   // (a first the English table does not have: no card rather than one in the wrong tongue)
    const cap = capEn ? firstEn(meta.milestone, r?.v?.name ?? '') : ja;
    if (cap) captions.send(`${capEn ? FIXED_EN.first : '島で初めて'}: ${cap}`, ctx.clockMs());
  }
  function cardTick(dt: number) {
    if (cardT > 0) { cardT -= dt; if (cardT <= 0) card.classList.add('off'); return; }
    if (cardT > -0.8) { cardT -= dt; return; }   // (a breath between two cards)
    const m = queue.shift(); if (!m) return;
    $('.card .head').textContent = m.head ?? (en ? FIXED_EN.first : '島で初めて');
    $('.card .what').innerHTML = m.text;   // (escaped as it was made: only an island's word in italics)
    $('.card .at').innerHTML = `${esc(dateOf(m.at))} <span class="t">${localTimeString(m.at, ctx.tz())}</span>`;
    card.classList.remove('off'); cardT = 8; m.shown?.(); cues.want('first', performance.now());
  }

  /** A try's result, for the trials' screen (PROGRAM.md §1): the drone goes to the one whose try it was (rank 1). */
  const trial = (r: any, outcome: string, text: string) => director.trial(r, outcome, text);
  return { update: (dt: number) => { update(dt); cardTick(dt); cueTick(); }, sample, haze, event, trial };
}
