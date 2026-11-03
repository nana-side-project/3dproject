// Headless check of the day's timed sights (viewer design PROGRAM.md §3, TRIAL6.md §1; src/live/sights.ts, director.ts
// with a sight, cues.ts):
//   times    the dawn the twenty minutes before the sun is up, the round from noon (it may begin until ten past), the sunset
//            the thirty before it is down; none in a typhoon
//   next     "このあと": later, まもなく ten minutes before, いま while on (no time); a round over for the day passed by; one on
//            air past its window still いま; the day's card only on a day with something for it; the night's next "あすの
//            朝", after midnight "このあと"; in a typhoon tomorrow's; the English words
//   today    the day's card: one of each — a try's result (those that held first), a first's card, a stage of the way — then
//            more in that order, three at most; a stage whose first had its card, once; nothing, no card; in English no
//            try's words yet
//   go       a sight in its time over one at work: its camera at once, held all its time (no turn); its time over: the next
//   round    the round keeps its three minutes though its window lasts, then is over for the day
//   rank 1   a moment decided cuts in on the sunset; after its twenty seconds, the sunset again (its time lasting); on the
//            round: the round over, not gone back to
//   rank 2   a talk cuts in on the sunset; the talk over, the sunset again
//   wait     a line being said as a sight begins: let finish (ten seconds at most); a rank-1 moment held: waited for
//   gather   a gathering while the beach's camera has the dawn: the house's wide shot
//   bell     the sight's bell as strong as a gathering's knocks, and counted in the three minutes
// Usage: npx tsx scripts/sights-check.ts
import { sightNow, nextSight, nextWords, todayLines, sightTimes, dayStart, calmOf, emptyDay, ROUND_S } from '../src/live/sights';
import { makeDirector } from '../src/live/director';
import { makeCues, CUE_RANK, type Cue } from '../src/live/cues';

let fail = 0;
const row = (ok: boolean, text: string) => { if (!ok) fail++; console.log(`${text} — ${ok ? 'PASS' : 'FAIL'}`); };
const TZ = 9, H = 3.6e6, MIN = 60e3;
const MID = dayStart(Date.UTC(2026, 10, 12, 3, 0), TZ);   // (11/12, the island's local midnight)
const at = (h: number, m = 0, d = 0) => MID + d * 864e5 + h * H + m * MIN;
const sun = (ms: number) => { const mid = dayStart(ms, TZ); return { rise: mid + 6.2 * H, set: mid + 17.6 * H }; };   // (06:12, 17:36)
const hhmm = (ms: number, tz: number) => { const d = new Date(ms + tz * H); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const day = new Date(MID + TZ * H).toISOString().slice(0, 10);

{ // times
  const got = [at(6, 0), at(6, 13), at(12, 5), at(12, 9), at(12, 11), at(17, 30), at(17, 37)].map((ms) => sightNow(ms, TZ, sun, true)?.id ?? '-');
  const storm = sightNow(at(12, 1), TZ, sun, false), t = sightTimes(MID, sun(MID));
  row(got.join() === 'dawn,-,round,round,-,dusk,-' && storm === null && hhmm(t.dawn[0], TZ) === '05:52' && hhmm(t.dusk[0], TZ) === '17:06' && hhmm(t.fire[0], TZ) === '19:25' && sightNow(at(12, 5), TZ, sun, true)?.key === `round:${day}`,
    `times: 06:00 06:13 12:05 12:09 12:11 17:30 17:37 → ${got.join(' ')}; typhoon at 12:01 → ${storm}; dawn from ${hhmm(t.dawn[0], TZ)}, sunset from ${hhmm(t.dusk[0], TZ)}, fire ${hhmm(t.fire[0], TZ)}`);
}
{ // next
  const say = (ms: number, o: Parameters<typeof nextSight>[3], en = false) => { const n = nextSight(ms, TZ, sun, o); if (!n) return '-'; const w = nextWords(n, TZ, en, hhmm); return `${w.k} ${w.tm} ${w.name}`.replace(/\s+/g, ' ').trim(); };
  const c = { calm: true, today: false };
  const got = {
    later: say(at(11, 30), c), soon: say(at(11, 52), c), now: say(at(12, 1), c),
    over: say(at(12, 1), { ...c, over: (k) => k === `round:${day}` }), late: say(at(12, 12), { ...c, on: 'round' }),
    noCard: say(at(18, 58), c), card: say(at(18, 58), { ...c, today: true }), night: say(at(22, 0), c), small: say(at(2, 0), c),
    storm: say(at(10, 0), { ...c, calm: false }), en: say(at(22, 0), c, true), morning: say(at(8, 55), c),
  };
  const want = { later: 'このあと 12:00 島めぐり', soon: 'まもなく 12:00 島めぐり', now: 'いま 島めぐり', over: 'このあと 17:06 夕日の浜', late: 'いま 島めぐり',
    noCard: 'このあと 19:25 焚き火の会', card: 'まもなく 19:00 きょうの島', night: 'あすの朝 05:52 夜明けの浜', small: 'このあと 05:52 夜明けの浜',
    storm: 'あすの朝 05:52 夜明けの浜', en: 'Tomorrow morning 05:52 Dawn on the beach', morning: 'まもなく 09:00 朝の集まり' };
  const bad = Object.keys(want).filter((k) => (got as any)[k] !== (want as any)[k]);
  row(!bad.length, `next: ${Object.entries(got).map(([k, v]) => `${k} 「${v}」`).join(' / ')}${bad.length ? ` (wrong: ${bad.join(', ')})` : ''}`);
  row(calmOf({ meets: (h: number) => h >= 8.85 && h < 9.5 }) && !calmOf({ meets: () => false }) && calmOf(null), 'next: calm read from the gatherings\' own reading (a typhoon: none meet)');
}
{ // today
  const esc = (t: string) => t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
  const rec = { ...emptyDay('d'), results: [
    { who: 'dot', name: 'ドット', head: '違っていた', words: '濡れた薪でも燃える', held: false, at: at(10) },
    { who: 'kame', name: 'カメマル', head: '確かめた', words: '藻場で海草が増えた', held: true, at: at(11) },
    { who: 'lantern', name: 'ランタン', head: 'やりとげた', words: '灯皿を焼く', held: true, at: at(12) }],
    firsts: [{ key: 'raft', name: 'ドット', text: 'ドットの筏ができた', at: at(9) }] };
  const steps = [{ w: '筏', at: at(9), key: 'raft' }, { w: '小屋', at: at(8), key: 'hut' }];
  const ja = todayLines(rec, steps, false, esc), none = todayLines(emptyDay('d'), [], false, esc);
  const en = todayLines(rec, [{ w: 'hut', at: at(8), key: 'hut' }], true, esc, (k, n) => (k === 'raft' ? `${n}'s raft is built` : null));
  const more = todayLines({ ...rec, firsts: [] }, [], false, esc);
  row(JSON.stringify(ja) === JSON.stringify(['カメマル　確かめた：藻場で海草が増えた', 'ドットの筏ができた', '道のり　小屋']) && none.length === 0 && JSON.stringify(en) === JSON.stringify(["ドット's raft is built", 'The way: hut'])
    && JSON.stringify(more) === JSON.stringify(['カメマル　確かめた：藻場で海草が増えた', 'ランタン　やりとげた：灯皿を焼く', 'ドット　違っていた：濡れた薪でも燃える']),
    `today: ${ja.join(' / ')}; nothing → ${none.length} lines; English → ${en.join(' / ')}; tries only → ${more.join(' / ')}`);
}

// the director with a sight — each case a director of its own, the house at the origin
const mk = (id: string, kind: string, x: number, z: number) => ({ id, act: 'idle', task: kind ? { kind, arrived: true } : null as any, talk: null as any, saying: '', pos: { x, y: 1, z } });
const HOUSE = { id: 'house', place: 'house', no: '06' }, BEACH = { id: 'beach', place: 'beach', no: '07' };
const SKY = (k: string) => ({ id: 'sky', sky: k, no: '13' });
type Cam = { t: number; who: string; pri: number; kind: string; why: string };
function stage(list: any[], places: any[] = [{ subj: HOUSE, at: { lx: 0, lz: 0 } }]) {
  const R = { list, mind: () => null }, cams: Cam[] = [];
  let w: any = null, t = 0, sight: any = null, talk = false;
  const D = makeDirector({ residents: () => R, watched: () => w, watch: (r) => { w = r; }, speaking: () => talk, cam: (who, pri, kind, why) => cams.push({ t, who, pri, kind, why }), places: () => places, sight: () => sight });
  return { D, cams, on: () => w, t: () => t, sight: (s: any) => { sight = s; }, talk: (on: boolean) => { talk = on; },
    run: (s: number) => { for (let i = 0; i < s * 10; i++) { t += 0.1; D.tick(0.1); } }, until: (f: () => boolean, s = 120) => { for (let i = 0; i < s * 10 && !f(); i++) { t += 0.1; D.tick(0.1); } } };
}
const DUSK = { id: 'dusk', key: `dusk:${day}`, subj: SKY('dusk') }, ROUND = { id: 'round', key: `round:${day}`, subj: SKY('round') };
{ // go
  const dot = mk('dot', 'build', 60, 40), S = stage([dot, mk('kame', 'graze', -200, 90)]);
  S.run(5); const before = S.on()?.id; S.sight(DUSK); S.run(1);
  const went = S.on() === DUSK.subj, c = S.cams.at(-1);
  S.run(600); const held = S.on() === DUSK.subj, cuts = S.cams.filter((x) => x.t > 6).length;
  S.sight(null); S.run(1);
  row(before === 'dot' && went && c?.kind === 'sight' && c.pri === 4 && held && cuts === 0 && S.on()?.id === 'dot' && S.cams.at(-1)?.why === '見どころの終わり' && S.D.sightOver(DUSK.key),
    `go: on ${before}; the sunset's time → ${went ? '13' : 'not the sky'} (${c?.kind}, rank ${c?.pri}); ten minutes on, still on it ${held} with ${cuts} cuts; its time over → ${S.on()?.id} (${S.cams.at(-1)?.why})`);
}
{ // round
  const S = stage([mk('dot', 'build', 60, 40), mk('kame', 'graze', -200, 90)]);
  S.run(5); S.sight(ROUND); S.run(1); const t0 = S.t();
  S.until(() => S.on() !== ROUND.subj, 400); const len = S.t() - t0;
  S.run(60); const back = S.on() === ROUND.subj;
  row(Math.abs(len - ROUND_S) < 1.5 && !back && S.D.sightOver(ROUND.key), `round: on the sky ${len.toFixed(1)} s (its window still open), then ${S.on()?.id}; gone back to ${back}; over for the day ${S.D.sightOver(ROUND.key)}`);
}
{ // rank 1
  const dot = mk('dot', 'build', 60, 40), kame = mk('kame', 'graze', -200, 90), S = stage([dot, kame]);
  S.run(5); S.sight(DUSK); S.run(30);
  S.D.trial(kame, 'confirmed', '藻場で食べた'); S.run(1); const cut = S.on()?.id, pri = S.cams.at(-1)?.pri;
  S.run(25); const back = S.on() === DUSK.subj;
  const R2 = stage([dot, kame]); R2.run(5); R2.sight(ROUND); R2.run(30); R2.D.trial(kame, 'confirmed', '藻場で食べた'); R2.run(1); const rcut = R2.on()?.id; R2.run(40);
  row(cut === 'kame' && pri === 1 && back && rcut === 'kame' && R2.on() !== ROUND.subj && R2.D.sightOver(ROUND.key),
    `rank 1: on the sunset, a moment decided → ${cut} (rank ${pri}); after its twenty seconds → ${back ? 'the sunset again' : S.on()?.id}; on the round → ${rcut}, then ${R2.on()?.id ?? R2.on()?.sky} (the round over ${R2.D.sightOver(ROUND.key)})`);
}
{ // rank 2
  const dot = mk('dot', 'build', 60, 40), kame = mk('kame', 'graze', 70, 40), S = stage([dot, kame]);
  S.run(5); S.sight(DUSK); S.run(10);
  const tk = { a: dot, b: kame }; dot.talk = tk; kame.talk = tk; S.run(1); const cut = S.on()?.id;
  S.run(20); dot.talk = null; kame.talk = null; S.run(2);
  row((cut === 'dot' || cut === 'kame') && S.on() === DUSK.subj, `rank 2: on the sunset, a talk → ${cut}; the talk over → ${S.on() === DUSK.subj ? 'the sunset again' : S.on()?.id}`);
}
{ // wait
  const dot = mk('dot', 'build', 60, 40), kame = mk('kame', 'graze', -200, 90), S = stage([dot, kame]);
  S.run(5); S.talk(true); S.sight(DUSK); S.run(4); const waiting = S.on()?.id; S.talk(false); S.run(1); const after = S.on() === DUSK.subj;
  const L = stage([dot, kame]); L.run(5); L.talk(true); L.sight(DUSK); L.run(11); const capped = L.on() === DUSK.subj;
  const P = stage([dot, kame]); P.run(5); P.D.trial(kame, 'confirmed', '藻場で食べた'); P.run(1); P.sight(DUSK); P.run(5); const held = P.on()?.id; P.run(20);
  row(waiting === 'dot' && after && capped && held === 'kame' && P.on() === DUSK.subj,
    `wait: a line being said → still ${waiting}, its end → the sunset ${after}; a line going on → the sunset after ten seconds ${capped}; a rank-1 moment held → ${held}, then the sunset ${P.on() === DUSK.subj}`);
}
{ // gather (the dawn on the beach's camera, and the fire's gathering)
  const dot = mk('dot', 'build', 200, 40), S = stage([dot, mk('kame', 'graze', -200, 90)], [{ subj: HOUSE, at: { lx: 0, lz: 0 } }, { subj: BEACH, at: { lx: 300, lz: 30 } }]);
  const DAWN = { id: 'dawn', key: `dawn:${day}`, subj: BEACH };
  S.run(5); S.sight(DAWN); S.run(1); const on = S.on()?.id, kind = S.cams.at(-1)?.kind;
  dot.task = { kind: 'fire', arrived: true }; dot.saying = 'こんばんは';   // (at the fire, speaking: the gathering)
  S.run(1);
  row(on === 'beach' && kind === 'sight' && S.on() === HOUSE && S.cams.at(-1)?.kind === 'gather', `gather: the dawn on ${on} (${kind}); a gathering → ${S.on()?.id} (${S.cams.at(-1)?.kind})`);
}
{ // bell
  const played: Cue[] = [], log: string[] = [];
  const c = makeCues((x) => played.push(x), () => false, (x, s, why) => log.push(`${x}:${s ? 'sounded' : why}`));
  c.want('sight', 0); for (let t = 0; t <= 1000; t += 100) c.tick(t);
  c.want('good', 60_000); for (let t = 60_000; t <= 61_000; t += 100) c.tick(t);
  row(CUE_RANK.sight === CUE_RANK.gather && played.join() === 'sight' && log.includes('good:3分以内'), `bell: as strong as a gathering (${CUE_RANK.sight}); sounded ${played.join()}, a result a minute after → ${log.at(-1)}`);
}
process.exit(fail ? 1 : 0);
