// Headless check (viewer design PROGRAM.md §5-3, the notification sounds; trial 4): which sound, and when (pure:
// src/live/cues.ts):
//   A a try's sound: held (confirmed, done) bright, not held (refuted, not yet, failed) low, decided one soft note; its
//     steps taken with nothing to check, or no words on the screen: none
//   B one every three minutes at most: one too soon is let go, not kept for later; a card's (first) sounds all the same
//     and does not count; nor does the small knock five minutes before a gathering — a result a minute after it sounds
//     (viewer design on #215)
//   C two together: the stronger (a card over a try's result, a result over a try decided, over the customs)
//   D never over a voice: it waits for the voice to end; one that goes on too long lets a try's sound go — a card's
//     sounds all the same, after three seconds (the card is on for eight)
//   E the gatherings: a knock five minutes before each, two as it begins; none on a day the custom does not keep (a
//     typhoon); past midnight the clock's turn is no crossing
// Usage: npx tsx scripts/live-cues-check.ts
import { makeCues, trialCue, gatherCue, CUE_GAP_MS, type Cue } from '../src/live/cues';

let bad = 0;
const want = (what: string, ok: boolean, got = '') => { if (!ok) bad++; console.log(`${what}: ${got} ${ok ? 'ok' : 'FAIL'}`); };
const rig = () => {
  const played: Cue[] = [], log: string[] = []; let talk = false;
  const c = makeCues((x) => played.push(x), () => talk, (x, s, why) => log.push(`${x}:${s ? 'sounded' : why}`));
  return { c, played, log, talk: (on: boolean) => { talk = on; } };
};
const run = (c: ReturnType<typeof makeCues>, from: number, to: number) => { for (let t = from; t <= to; t += 100) c.tick(t); };
{ // A
  const k = (kind: string, result?: string, text: string | null = '燃える木を探す') => trialCue({ kind, result, text });
  const got = [k('result', 'confirmed'), k('result', 'done'), k('result', 'refuted'), k('result', 'not-yet'), k('result', 'failed'), k('start'), k('result', 'steps-done'), k('result', 'confirmed', null), trialCue(undefined)];
  want('A a try\'s sound: held bright, not held low, decided soft; none for steps taken or no words', JSON.stringify(got) === JSON.stringify(['good', 'good', 'bad', 'bad', 'bad', 'decided', null, null, null]), JSON.stringify(got));
}
{ // B
  const { c, played, log } = rig();
  c.want('good', 0); run(c, 0, 1000);
  c.want('decided', 60_000); run(c, 60_000, 61_000);
  c.want('first', 90_000); run(c, 90_000, 90_500);
  c.want('bad', CUE_GAP_MS + 10); run(c, CUE_GAP_MS + 10, CUE_GAP_MS + 1000);
  run(c, CUE_GAP_MS + 1000, CUE_GAP_MS + 300_000);
  want('B one every three minutes: one too soon let go, not kept; a card\'s all the same, not counted', played.join(' ') === 'good first bad' && log.includes('decided:3分以内'), `${played.join(' ')} | ${log.join(' ')}`);
  const k = rig(); k.c.want('gather-soon', 0); run(k.c, 0, 1000); k.c.want('good', 60_000); run(k.c, 60_000, 61_000);
  want('B the small knock before a gathering is not counted: a result a minute after it sounds', k.played.join(' ') === 'gather-soon good', `${k.played.join(' ')} | ${k.log.join(' ')}`);
}
{ // C
  const { c, played } = rig();
  c.want('decided', 0); c.want('good', 100); run(c, 0, 1000);
  const r2 = rig(); r2.c.want('good', 0); r2.c.want('first', 50); run(r2.c, 0, 1000);
  const r3 = rig(); r3.c.want('gather', 0); r3.c.want('decided', 100); r3.c.want('gather-soon', 150); run(r3.c, 0, 1000);
  want('C two together: the stronger', played.join() === 'good' && r2.played.join() === 'first' && r3.played.join() === 'decided', `${played} / ${r2.played} / ${r3.played}`);
}
{ // D
  const a = rig(); a.talk(true); a.c.want('good', 0); run(a.c, 0, 3000); const during = a.played.length; a.talk(false); run(a.c, 3000, 3200);
  const b = rig(); b.talk(true); b.c.want('decided', 0); run(b.c, 0, 12_000);
  const d = rig(); d.talk(true); d.c.want('first', 0); run(d.c, 0, 2900); const cardEarly = d.played.length; run(d.c, 2900, 3200);
  want('D never over a voice: after it ends; a try\'s let go if it goes on, a card\'s sounds all the same', during === 0 && a.played.join() === 'good' && b.played.length === 0 && b.log.includes('decided:声が続いた') && cardEarly === 0 && d.played.join() === 'first',
    `${during} → ${a.played} / ${b.played} ${b.log} / ${d.played}`);
}
{ // E
  const at = [8.85, 18.9] as const, keeps = () => true, storm = () => false;
  const steps: (Cue | null)[] = []; let prev = 8.5;
  for (let h = 8.5; h <= 9.2; h += 1 / 120) { steps.push(gatherCue(prev, h, at, keeps)); prev = h; }
  const heard = steps.filter(Boolean), soonAt = steps.indexOf('gather-soon'), beginAt = steps.indexOf('gather');
  const night = gatherCue(23.99, 0.01, at, keeps), none = gatherCue(18.8, 18.95, at, storm);
  want('E the gatherings: a knock five minutes before, two as it begins; none in a typhoon; none at midnight', heard.join() === 'gather-soon,gather' && beginAt - soonAt === 10 && night === null && none === null && gatherCue(23.9, 0.2, [0.1], keeps) === 'gather',
    `${heard} (${beginAt - soonAt} half-minutes apart); midnight ${night}; typhoon ${none}`);
}
console.log(bad ? `FAIL (${bad})` : 'all ok');
process.exit(bad ? 1 : 0);
