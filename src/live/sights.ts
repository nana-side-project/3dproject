// The day's timed sights on the live screen ("ルマウの一日": viewer design PROGRAM.md §3, TRIAL6.md §1; owner D46, brought
// forward). Fixed to the clock is only what the world has at its hour — the two gatherings, the sun — and what a camera
// alone can make: the dawn and the sunset on the beach, the island round. No resident is moved for them, and a day the
// gatherings do not meet (a typhoon) has none. Pure here: when each one is, which comes next for the top right's
// "このあと", and the lines of the day's card. director.ts puts a camera's sight on air (as the sea's shows, rank 4, which
// only ranks 1 and 2 cut in on); main.ts chooses its camera (07 the beach, 13 above the island); live.ts writes the rest.

export type SightId = 'dawn' | 'morning' | 'round' | 'dusk' | 'today' | 'fire';
/** Each one: its name as "このあと" says it; the word on its band when it is on a camera of its own (MULTICAM.md §3-1);
 *  whether it is a camera's (the director puts it on air); whether the bell rings as it begins (PROGRAM.md §5-3 — the
 *  gatherings have their knocks of wood). */
export const SIGHTS: Record<SightId, { ja: string; en: string; word?: string; wordEn?: string; cam?: true; bell?: true }> = {
  dawn: { ja: '夜明けの浜', en: 'Dawn on the beach', word: '夜明け', wordEn: 'Dawn', cam: true, bell: true },
  morning: { ja: '朝の集まり', en: 'The morning gathering' },
  round: { ja: '島めぐり', en: 'Round the island', word: '島めぐり', wordEn: 'Round the island', cam: true, bell: true },
  dusk: { ja: '夕日の浜', en: 'Sunset on the beach', word: '夕日', wordEn: 'Sunset', cam: true, bell: true },
  today: { ja: 'きょうの島', en: 'Today on the island', bell: true },
  fire: { ja: '焚き火の会', en: 'The evening fire' },
};
export const SIGHT_ORDER: SightId[] = ['dawn', 'morning', 'round', 'dusk', 'today', 'fire'];
/** The island round's time on air (s), and how late after noon it may still begin (min) — a talk let finish first. */
export const ROUND_S = 180, ROUND_LATE_MIN = 10;
/** The day's card: how long it is up (s), how many facts at most. */
export const TODAY_S = 15, TODAY_MAX = 3;
/** "まもなく" from this long before (min). */
export const SOON_MIN = 10;

const H = 3.6e6, MIN = 60e3, DAY = 864e5;
/** The island day's start (its local midnight, ms) and its name (YYYY-MM-DD), at the island's tz. */
export const dayStart = (ms: number, tz: number) => Math.floor((ms + tz * H) / DAY) * DAY - tz * H;
export const dayKey = (ms: number, tz: number) => new Date(dayStart(ms, tz) + tz * H).toISOString().slice(0, 10);

type SunOf = (ms: number) => { rise: number; set: number };
/** Whether the gatherings meet today — not in a typhoon: the residents' own reading (residents.ts meets — the morning's
 *  talk at nine is kept unless a typhoon is on), as the knocks of wood read it (cues.ts gatherCue). */
export const calmOf = (R: { meets?: (hr: number) => boolean } | null | undefined) => !R?.meets || !!R.meets(9);
/** Each one's time on the island day that begins at `mid`: [from, to). The sun's from its rise and set that day
 *  (clock.ts sunEvents): the dawn the twenty minutes before the sun is up, the sunset the thirty before it is down. The
 *  gatherings at the hours the world keeps them (residents.ts: the morning's talk 9:00–9:30; the fire lit 19:24 and out
 *  21:06 — the programme's 19:25–21:05). The round three minutes from noon, the day's card fifteen seconds at 19:00. */
export function sightTimes(mid: number, sun: { rise: number; set: number }): Record<SightId, [number, number]> {
  const h = (x: number) => mid + x * H;
  return {
    dawn: [sun.rise - 20 * MIN, sun.rise],
    morning: [h(9), h(9.5)],
    round: [h(12), h(12) + ROUND_S * 1000],
    dusk: [sun.set - 30 * MIN, sun.set],
    today: [h(19), h(19) + TODAY_S * 1000],
    fire: [h(19 + 25 / 60), h(21 + 5 / 60)],
  };
}
/** How long a camera's sight may be gone to (the window the director reads): the dawn's and the sunset's, their time;
 *  the round's, from noon to ten minutes after (it then keeps its three minutes, director.ts). */
const camWindow = (id: SightId, t: [number, number]): [number, number] => (id === 'round' ? [t[0], t[0] + ROUND_LATE_MIN * MIN] : t);

/** The camera's sight whose time it is now, if any — the dawn, the round, the sunset — with its key for the day; none in
 *  a typhoon (calm: the gatherings' own reading, residents.ts meets). */
export function sightNow(ms: number, tz: number, sunOf: SunOf, calm: boolean): { id: SightId; key: string } | null {
  if (!calm) return null;
  const t = sightTimes(dayStart(ms, tz), sunOf(ms)), day = dayKey(ms, tz);
  for (const id of SIGHT_ORDER) {
    if (!SIGHTS[id].cam) continue;
    const [a, b] = camWindow(id, t[id]);
    if (ms >= a && ms < b) return { id, key: `${id}:${day}` };
  }
  return null;
}

export interface Next { id: SightId; at: number; state: 'later' | 'soon' | 'now'; tomorrow: boolean }
/** The top right's "このあと" (PROGRAM.md §3, TRIAL6.md §1-4): the next sight, always one — "まもなく" from ten minutes
 *  before, "いま" while it is on (a camera's: in its window or on air), the night's next as "あすの朝". Not today's in a
 *  typhoon (tomorrow's are shown as they would be: the world decides), not a camera's over for the day (the round cut in
 *  on), not the day's card on a day with nothing for it. */
export function nextSight(ms: number, tz: number, sunOf: SunOf, o: { calm: boolean; over?: (key: string) => boolean; on?: SightId | null; today?: boolean }): Next | null {
  for (const d of [0, 1]) {
    const mid = dayStart(ms, tz) + d * DAY, t = sightTimes(mid, sunOf(mid + 12 * H)), day = dayKey(mid, tz);
    for (const id of SIGHT_ORDER) {
      if (d === 0 && (!o.calm || (id === 'today' && !o.today) || o.over?.(`${id}:${day}`))) continue;
      const [a, b] = SIGHTS[id].cam ? camWindow(id, t[id]) : t[id], on = d === 0 && o.on === id;
      if (!on && ms >= b) continue;
      return { id, at: t[id][0], state: on || ms >= a ? 'now' : a - ms <= SOON_MIN * MIN ? 'soon' : 'later', tomorrow: d === 1 };
    }
  }
  return null;
}
/** "このあと" as it is written: its heading, the time (none while it is on), the name. */
export function nextWords(n: Next, tz: number, en: boolean, hhmm: (ms: number, tz: number) => string): { k: string; tm: string; name: string } {
  const k = n.state === 'now' ? (en ? 'Now' : 'いま') : n.state === 'soon' ? (en ? 'Soon' : 'まもなく') : n.tomorrow ? (en ? 'Tomorrow morning' : 'あすの朝') : en ? 'Next' : 'このあと';
  return { k, tm: n.state === 'now' ? '' : hhmm(n.at, tz), name: en ? SIGHTS[n.id].en : SIGHTS[n.id].ja };
}

/** What the day's card is made from — what the screen showed in the day, as it showed it (kept in this browser): the
 *  tries' results with words, the firsts' cards. The chapter's stages done are read from the world's record as the card is
 *  made (steps). */
export interface DayRec {
  day: string;
  results: { who: string; name: string; head: string; words: string; held: boolean; at: number }[];
  firsts: { key: string; name: string; text: string; at: number }[];
}
export const emptyDay = (day: string): DayRec => ({ day, results: [], firsts: [] });
/** The day's card (TRIAL6.md §1-5, PROGRAM.md §1-3): the day's facts, three at most — a try's result (確かめた・違っていた・
 *  やりとげた: whose, in the words its try was shown in; those that held first), a first on the island (its card's own
 *  sentence), a stage of the chapter's way done (its word on the way) — one of each in that order, then more in the same
 *  order (a stage whose first's card is among them, once). None: no card. Nothing new is written: only the words the
 *  screen had shown. As HTML (esc: the words escaped; firstEn's English is HTML already, an island's word in italics). */
export function todayLines(rec: DayRec, steps: { w: string; at: number; key: string }[], en: boolean, esc: (t: string) => string, firstEn?: (key: string, name: string) => string | null): string[] {
  const results = en ? [] : rec.results.slice().sort((a, b) => Number(b.held) - Number(a.held) || a.at - b.at).map((x) => esc(`${x.name}　${x.head}：${x.words}`));
  const firsts = rec.firsts.slice().sort((a, b) => a.at - b.at).map((x) => (en ? firstEn?.(x.key, x.name) ?? null : esc(x.text))).filter((x): x is string => !!x);
  const carded = new Set(rec.firsts.map((x) => x.key));
  const ways = steps.filter((x) => !carded.has(x.key)).sort((a, b) => a.at - b.at).map((x) => esc(en ? `The way: ${x.w}` : `道のり　${x.w}`));
  const lists = [results, firsts, ways], out: string[] = [];
  for (let k = 0; out.length < TODAY_MAX && lists.some((l) => l.length > k); k++) for (const l of lists) if (l[k] !== undefined && out.length < TODAY_MAX) out.push(l[k]);
  return out;
}
