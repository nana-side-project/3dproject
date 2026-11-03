// Headless check of the drone fleet's choosing (ADR 0010, MULTICAM.md §2; src/live/director.ts with visible/skip): four
// stand-in residents, the director ticked at 10 Hz, each resident's camera seeing it or not as the check says.
//   p1       a rank-1 moment for one its camera cannot see: not gone to while hidden — passed over, told once; once seen
//            again while the moment is fresh, gone to
//   leave    the one on air, hidden more than three seconds, is left for one at work that can be seen ("見えなくなった")
//   work     at the end of a turn at work, the next one at work that can be seen — not a hidden one
//   skip     one passed over is told at most once a minute
// Usage: npx tsx scripts/fleet-director-check.ts
import { makeDirector } from '../src/live/director';

const mk = (id: string, kind: string) => ({ id, act: 'idle', task: kind ? { kind, arrived: true } : null, talk: null as any, saying: '' });
const dot = mk('dot', 'build'), rakko = mk('rakko', 'gather'), kame = mk('kame', 'graze'), lantern = mk('lantern', 'rest');
const R = { list: [dot, rakko, kame, lantern], mind: () => null };
let watched: any = null, t = 0;
const hidden = new Set<string>(), cams: { t: number; who: string; pri: number; kind: string; why: string }[] = [], skips: { t: number; who: string }[] = [];
const D = makeDirector({ residents: () => R, watched: () => watched, watch: (r) => { watched = r; }, speaking: () => false,
  cam: (who, pri, kind, why) => cams.push({ t, who, pri, kind, why }), visible: (r) => !hidden.has(r.id), skip: (who) => skips.push({ t, who }) });
const run = (s: number) => { for (let i = 0; i < s * 10; i++) { t += 0.1; D.tick(0.1); } };
let fail = 0;
const row = (ok: boolean, text: string) => { if (!ok) fail++; console.log(`${text} — ${ok ? 'PASS' : 'FAIL'}`); };

run(0.2);   // (on Dot, at work)
{ // p1
  hidden.add('rakko'); D.trial(rakko, 'confirmed', '浜で待ったら、流木が見えた'); run(5);
  const whileHidden = watched?.id, told = skips.filter((s) => s.who === 'rakko').length;
  hidden.delete('rakko'); run(1);
  row(whileHidden === 'dot' && told === 1 && watched?.id === 'rakko' && cams.at(-1)?.pri === 1, `p1: while hidden on ${whileHidden} (passed over, told ${told}); seen again: on ${watched?.id} (${cams.at(-1)?.kind})`);
}
{ // leave
  run(25);   // (the rank-1 hold over)
  hidden.add('rakko'); run(2); const at2 = watched?.id; run(2.5);
  row(at2 === 'rakko' && watched?.id !== 'rakko' && cams.at(-1)?.why === '見えなくなった', `leave: hidden 2 s still on ${at2}; after 4.5 s on ${watched?.id} (${cams.at(-1)?.why})`);
  hidden.delete('rakko');
}
{ // work
  const on = watched?.id; hidden.add('kame');   // (Rakko and Kamemaru at work, Kamemaru's camera not seeing it; Lantern at rest)
  run(185);
  row(on === 'dot' && watched?.id === 'rakko', `work: after a turn at work, from ${on} to ${watched?.id} — not to Kamemaru, hidden`);
  hidden.clear();
}
{ // skip
  run(61); skips.length = 0; hidden.add('kame');   // (a minute since any was told)
  for (let k = 0; k < 4; k++) { D.trial(kame, 'done', '藻場で食べた'); run(10); }
  const n = skips.filter((s) => s.who === 'kame').length;
  run(30); D.trial(kame, 'done', '藻場で食べた'); run(1);
  const n2 = skips.filter((s) => s.who === 'kame').length;
  row(n === 1 && n2 === 2, `skip: in 40 s told ${n}; after a minute, told again (${n2})`);
}
process.exit(fail ? 1 : 0);
