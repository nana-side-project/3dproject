// The notification sounds of the live screen (viewer design PROGRAM.md §5-3): which to sound, and when. The sounds
// themselves are audio.ts's (cue). The same sound for the same kind of moment, so that one looking away learns "that
// sound: look". At most one every three minutes — a card's (a first on the island, a chapter's start or end) excepted;
// two at once, the stronger; never over a voice: after it ends (§5-1). Only from what the screen already shows; it
// gives nothing back to the world.

/** first: a card (three clear notes); good / bad: a try come out, as it held or not (two notes, bright or low);
 *  decided: a try decided and said (one soft note); gather: a gathering beginning (two knocks of wood); gather-soon:
 *  five minutes before (one knock, small). */
export type Cue = 'first' | 'good' | 'bad' | 'decided' | 'gather' | 'gather-soon';
/** Which wins when two come together (PROGRAM.md §4's order: a first, a try's result, a try decided, the customs). */
export const CUE_RANK: Record<Cue, number> = { first: 5, good: 4, bad: 4, decided: 3, gather: 2, 'gather-soon': 1 };
/** One every three minutes at most; a moment to see whether a stronger one comes with it; how long one waits for a
 *  voice to end before it is let go — a card's, shorter, then sounds all the same (it is on the screen for eight). */
export const CUE_GAP_MS = 180_000, CUE_TOGETHER_MS = 400, CUE_VOICE_WAIT_MS = 10_000, CUE_CARD_WAIT_MS = 3_000;

/** How a try came out, as its sound: held (confirmed, done) or not (refuted, not yet, failed); its steps taken with
 *  nothing to check, none. Only one with words on the screen. */
export function trialCue(t: { kind: string; result?: string; text?: string | null } | undefined): Cue | null {
  if (!t?.text) return null;
  if (t.kind === 'start') return 'decided';
  return t.result === 'confirmed' || t.result === 'done' ? 'good' : t.result === 'refuted' || t.result === 'not-yet' || t.result === 'failed' ? 'bad' : null;
}

export interface CueLog { (cue: Cue, sounded: boolean, why: string): void }
export function makeCues(play: (c: Cue) => void, speaking: () => boolean, log: CueLog = () => {}) {
  let last = -Infinity, pend: { c: Cue; at: number } | null = null;
  const drop = (why: string) => { if (pend) log(pend.c, false, why); pend = null; };
  return {
    /** A moment the screen shows: sounded at the next tick that may, or let go. */
    want(c: Cue, now: number) {
      if (pend && CUE_RANK[c] <= CUE_RANK[pend.c]) { log(c, false, `${pend.c}と重なった`); return; }
      if (pend) log(pend.c, false, `${c}と重なった`);
      pend = { c, at: pend?.at ?? now };
    },
    tick(now: number): Cue | null {
      if (!pend) return null;
      const card = pend.c === 'first';
      if (!card && now - pend.at < CUE_TOGETHER_MS) return null;
      if (!card && now - last < CUE_GAP_MS) { drop('3分以内'); return null; }
      if (speaking()) { if (now - pend.at < (card ? CUE_CARD_WAIT_MS : CUE_VOICE_WAIT_MS)) return null; if (!card) { drop('声が続いた'); return null; } }
      const c = pend.c; pend = null; if (!card) last = now;
      play(c); log(c, true, ''); return c;
    },
  };
}

/** The gatherings' sounds, from the island's clock: a knock five minutes before each, two as it begins — only when the
 *  custom keeps that day (meets: the residents' own reading — not in a typhoon). at: the hours they begin (local). */
export function gatherCue(prevHr: number, hr: number, at: readonly number[], meets: (hr: number) => boolean): Cue | null {
  const crossed = (h: number) => (prevHr <= hr ? prevHr < h && h <= hr : prevHr < h || h <= hr);   // (past midnight too)
  for (const h of at) { if (crossed(h) && meets(h)) return 'gather'; if (crossed(h - 5 / 60) && meets(h)) return 'gather-soon'; }
  return null;
}
