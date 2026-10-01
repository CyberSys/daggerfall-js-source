// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE BATTLE'S WORKS AND FIGURES, THE LAW -
// net/siegeRef.js's copies of net/fortLaw.js's numbers (pinned EQUAL: the relay bundles the leaf and must never bundle
// fortLaw.js, which reads professionLaw.js), the Walls' wave, the Gatehouse and its breach, the Throne behind it, the
// Rams, the Barracks' guards and a revolt's Rebel Captain and twelve - every rule run on the battle newBattle mints.
// bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7; `06-Systems/Online-Arc.md` SEAT2b (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIEGE_UNITS_PER_M, SIEGE_PROTECT_MS, SIEGE_WAVE_MS, SIEGE_LENGTH_MS, SIEGE_FORFEIT_MS, SIEGE_TICK_MS,
  fieldOf, newBattle, newFighter, battleStep, siegeNextWave, siegeNextBeat, siegeReturn, siegeCampPose, siegeCampSide, siegeVitality,
  SIEGE_WALLS, siegeDefendersWaveMs, siegeSideWaveMs, SIEGE_GATEHOUSE, SIEGE_RAM, SIEGE_FIGURE_KINDS, SIEGE_FIGURE_CODE, siegeFigureVitality,
  SIEGE_REVOLT, SIEGE_GUARDS_MAX, SIEGE_REBEL_RING_M, SIEGE_FIGURE_TICK_MS, SIEGE_NO_WORKS, siegeGuardPosts, siegeRebelPosts, siegeRamPoint,
  siegeWorksStep, siegeFiguresStep, siegeWorkBlow, siegeFigureBlow, refereeWorkBlow, siegeMayStrike, siegeFigureRise, siegeWorksFrame,
  siegeFiguresFrame, siegeRamDue,
} from '../src/net/siegeRef.js';
import {
  WALLS_WAVE_STEP_MS, WALLS_WAVE_MIN_MS, defendersWaveMs, GATEHOUSE, RAM, RAM_OFFSET_M, SIEGE_FIGURES, figureVitality, REVOLT,
  barracksGuards, guardPosts, fortMaxTier,
} from '../src/net/fortLaw.js';
import { validSiegeOut, siegeFigureKind, SIEGE_FIGURES_MAX } from '../src/net/wire.js';

const M = SIEGE_UNITS_PER_M;
/** The battle's start - on a crown's 30 s wave, a palace's 20 s and the Walls' 24 s alike. */
const T = 1_800_000_000_000;
const P = (x, z) => [x * M, z * M];
/** A palace's field in metres: Gate, Market, Temple, the Throne, the attackers' camp, the defenders' - a hundred metres
 *  apart, so no guard at one point engages a fighter at another. */
const PALACE = [P(0, 100), P(100, 0), P(-100, 0), P(0, -100), P(0, 200), P(0, -160)];
/** A crown's: its fourth banner, the Palace square, then the Throne and the camps. */
const CROWN = [P(0, 100), P(100, 0), P(-100, 0), P(100, -100), P(0, -100), P(0, 200), P(0, -160)];
const siege = (o = {}) => newBattle({ kind: 'siege', tier: 'crown', startMs: T, field: fieldOf(o.tier === 'palace' ? PALACE : CROWN, o.tier ?? 'crown'), ...o });
const revolt = (o = {}) => newBattle({ kind: 'revolt', tier: 'palace', startMs: T, field: fieldOf(PALACE, 'palace'), ...o });
/** A fighter as the room keeps one (newFighter at Renown 50, its bucket full): `side` at `x`, `z` and `y` metres. */
const fighter = (side, x, z, { y = 0, ...o } = {}) => ({ ...newFighter(50, T - 60_000), side, pose: { x: x * M, y: y * M, z: z * M, yaw: 0, pitch: 0 }, here: true, ...o });
const put = (f, x, z, y = 0) => { f.pose = { ...f.pose, x: x * M, y: y * M, z: z * M }; };
/** A Daedric Dai-Katana held - its bucket 124. */
const DK = { w: 123, m: 9 };
const fig = (b, id) => b.figures.find((g) => g.id === id);
const metresTo = (g, p) => Math.hypot(g.x - p[0], g.z - p[1]) / M;
const beat = (b, fs, from, to, step = SIEGE_TICK_MS) => { const out = []; for (let t = from; t <= to; t += step) out.push(...battleStep(b, fs, t)); return out; };

test('SEAT2b2 THE COPIES: the relay\'s battle law holds fortLaw.js\'s numbers again - the Walls\' step and floor, the Gatehouse\'s blow share, a Ram\'s damage, beat, crew, reach and place, every figure\'s numbers and vitality, the revolt\'s twelve and their wave, the guards\' posts and their bound - pinned EQUAL, since the relay bundles siegeRef.js and must never bundle fortLaw.js (mutants: any number copied; the posts\' order; the guards\' bound; the vitality\'s law)', () => {
  assert.equal(SIEGE_WALLS.stepMs, WALLS_WAVE_STEP_MS);
  assert.equal(SIEGE_WALLS.minMs, WALLS_WAVE_MIN_MS);
  assert.equal(SIEGE_WALLS.tiers, fortMaxTier('walls'));
  for (const base of [5000, 6000, 11000, 20000, 30000]) for (const w of [-1, 0, 1, 2, 3, 4, 2.5, 'x', undefined]) assert.equal(siegeDefendersWaveMs(base, w), defendersWaveMs(base, w), `${base}/${w}`);
  assert.equal(SIEGE_GATEHOUSE.blowShare, GATEHOUSE.blowShare);
  assert.deepEqual({ ...SIEGE_RAM }, { damage: RAM.damage, everyMs: RAM.everyMs, crew: RAM.crew, crewM: RAM.crewM, offsetM: RAM_OFFSET_M });
  assert.deepEqual(JSON.parse(JSON.stringify(SIEGE_FIGURE_KINDS)), JSON.parse(JSON.stringify(SIEGE_FIGURES)));
  for (const k of ['guard', 'rebel', 'captain', 'nobody']) assert.equal(siegeFigureVitality(k), figureVitality(k), k);
  assert.deepEqual(['guard', 'rebel', 'captain'].map(siegeFigureVitality), [350, 302, 400]);
  assert.deepEqual([SIEGE_REVOLT.rebels, SIEGE_REVOLT.rebelsWaveMs], [REVOLT.rebels, REVOLT.rebelsWaveMs]);
  assert.equal(SIEGE_GUARDS_MAX, barracksGuards(3));
  const fields = [fieldOf(PALACE, 'palace'), fieldOf(CROWN, 'crown'), { throne: [1, 2] }, { banners: [[3, 4], [5, 6]] }, null];
  for (const f of fields) for (const n of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 9, 2.7, 'x']) assert.deepEqual(siegeGuardPosts(f, n), guardPosts(f, n), `${JSON.stringify(f)} ${n}`);
  assert.equal(SIEGE_FIGURES_MAX, SIEGE_REVOLT.rebels + 1, 'a revolt\'s Captain and twelve are the wire\'s most rows');
  for (const [id, k] of [['~g1', 'guard'], ['~r12', 'rebel'], ['~c', 'captain']]) assert.equal(SIEGE_FIGURE_CODE[k], siegeFigureKind(id), id);
  assert.deepEqual([SIEGE_FIGURE_TICK_MS, SIEGE_REBEL_RING_M, [...SIEGE_NO_WORKS]], [500, 6, [0, 0, 0, 0, 0]]);
});

test('SEAT2b2 THE WALLS\' WAVE: the defenders rise 3 s sooner a tier of Walls - never under 5 s, never past three tiers - the attackers on the tier\'s own; a return\'s wave its own side\'s (siegeReturn); a revolt\'s holder\'s side keeps its Walls and musters at the ATTACKERS\' camp, a siege\'s defenders at their own (mutants: the side; the step; the floor; the tiers; the return\'s wave; the revolt\'s camp)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((w) => siegeSideWaveMs('crown', 'defend', w)), [30000, 27000, 24000, 21000, 21000]);
  assert.deepEqual([0, 1, 2, 3].map((w) => siegeSideWaveMs('palace', 'defend', w)), [20000, 17000, 14000, 11000]);
  assert.deepEqual([siegeSideWaveMs('crown', 'attack', 3), siegeSideWaveMs('palace', 'attack', 3), siegeSideWaveMs('palace', null, 3), siegeSideWaveMs(undefined, 'defend', 1), siegeSideWaveMs('crown', 'defend')],
    [30000, 20000, 20000, 17000, 30000], 'the attackers\' and the unsided on the tier\'s own; an unknown tier a palace\'s; no Walls named none');
  assert.equal(siegeDefendersWaveMs(6000, 3), 5000, 'never under five seconds');
  // a return: the defender's wave behind the Walls, the attacker's the tier's
  const b = siege({ works: [2, 20000, 0, 0, 0] });
  assert.equal(b.walls, 2);
  const d = fighter('defend', 0, 0), a = fighter('attack', 0, 0);
  const now = T + 31_000;
  assert.equal(siegeReturn(b, d, now), true);
  assert.equal(siegeReturn(b, a, now), true);
  assert.deepEqual([d.upAt, a.upAt], [T + 48_000, T + 60_000], 'the defender at the Walls\' 24 s, the attacker at the crown\'s 30');
  assert.deepEqual([d.pose.x, d.pose.z, a.pose.x, a.pose.z], [...CROWN[6], ...CROWN[5]], 'each at its own camp');
  // a revolt: the holder's side - a pass's `defend` - at the attackers' camp, on the Walls' wave the pass carries
  const r = revolt({ works: [3, 0, 0, 0, 0] });
  assert.deepEqual([siegeCampSide(r, 'defend'), siegeCampSide(b, 'defend'), siegeCampSide(b, 'attack')], ['attack', 'defend', 'attack']);
  const camp = siegeCampPose(r, 'defend', { y: 7, yaw: 1 });
  assert.deepEqual([camp.x, camp.y, camp.z, camp.yaw], [PALACE[4][0], 7, PALACE[4][1], 1], 'the attackers\' camp, the height and facing kept');
  const h = fighter('defend', 0, 0);
  assert.equal(siegeReturn(r, h, T + 5000), true);
  assert.deepEqual([h.pose.x, h.pose.z, h.upAt], [...PALACE[4], siegeNextWave(T + 5000, 11000)], 'back at the attackers\' camp, on the Walls\' 11 s');
});

test('SEAT2b2 THE GATEHOUSE: a crown\'s and a palace\'s where it stands, its vitality the pass\'s, AT THE THRONE\'S POINT; an attacker\'s blow deals a tenth of its clipped damage, rounded, at least 1 - judged by the referee\'s own checks (the side, the clock, the striker\'s bucket, the weapon and its kind, the reach to the Throne\'s point at the field\'s ground); at nought BREACHED for good, its Ram gone and no kit fielded after (mutants: the share; the rounding; the floor of one; the clip; the side; the reach; the ground; the clock; the breach)', () => {
  const b = siege({ works: [0, 20000, 0, 2, 3000] });
  assert.deepEqual([b.gate, b.breached, b.ramsLeft, b.ramHp, b.ram, b.walls], [{ hp: 20000, max: 20000 }, false, 2, 3000, null, 0]);
  assert.equal(siege({ tier: 'palace' }).gate, null, 'a palace whose pass names no Gatehouse has none');
  assert.deepEqual(siege({ tier: 'palace', works: [3, 30000, 0, 0, 0] }).gate, { hp: 30000, max: 30000 }, 'a palace whose Gatehouse stands');
  const a = fighter('attack', 0, -103);   // three metres before the Throne's point
  const d = fighter('defend', 0, -103);
  let clock = T;
  const hit = (d0, o = {}) => { clock += 1000; return siegeWorkBlow(b, o.by ?? a, '~gate', { from: (o.by ?? a).pose, held: DK, d: d0, r: 0, ...o }, o.now ?? clock); };
  battleStep(b, [a, fighter('attack', 0, 200), fighter('defend', 0, -160)], T);   // a beat: the field's ground (0) kept
  assert.equal(b.ground, 0);
  assert.deepEqual(hit(124), { ok: true, dealt: 12, fell: false, why: null }, 'a tenth of 124, rounded down');
  assert.deepEqual([hit(4).dealt, hit(15).dealt, hit(125).dealt, hit(5000).dealt], [1, 2, 12, 12], 'at least 1; 1.5 rounds up; the clip first');
  assert.equal(hit(300, { held: { w: -1, m: 0 } }).dealt, 11, 'a fist\'s 112, a tenth');
  assert.equal(b.gate.hp, 20000 - 12 - 1 - 2 - 12 - 12 - 11);
  assert.equal(a.dealt, 12 + 1 + 2 + 12 + 12 + 11, 'the striker\'s count is what the gate took');
  assert.equal(hit(124, { by: d }).why, 'side', 'a defender never strikes its own gate');
  assert.equal(siegeWorkBlow(b, { ...a, side: null }, '~gate', { from: a.pose, held: DK, d: 124 }, clock).why, 'side', 'nor an unsided fighter');
  assert.equal(siegeWorkBlow(b, null, '~gate', { from: a.pose, held: DK, d: 124 }, clock).why, 'side');
  assert.equal(hit(124, { held: null }).why, 'weapon');
  assert.equal(hit(124, { r: 1 }).why, 'weapon', 'a sword shoots nothing');
  put(a, 0, -105.6);
  assert.equal(hit(124).why, 'reach', 'five and a half metres and a hair from the Throne\'s point');
  put(a, 0, -105.4);
  assert.equal(hit(124).ok, true);
  put(a, 0, -101, 9);
  assert.equal(hit(124).why, 'reach', 'nine metres up a wall: the gate stands on the field\'s ground');
  put(a, 0, -103);
  assert.equal(hit(0.5).dealt, 0, 'a blow of nothing deals nothing - the floor of one is a blow\'s');
  assert.equal(hit(124, { now: T - 1 }).why, 'time', 'not before the start');
  assert.equal(hit(124, { now: b.endMs }).why, 'time', 'nor at its end');
  for (let i = 0; i < 4; i++) assert.equal(siegeWorkBlow(b, a, '~gate', { from: a.pose, held: DK, d: 124, r: 0 }, clock + 1000).ok, true, `blow ${i + 1} in the instant`);
  assert.equal(siegeWorkBlow(b, a, '~gate', { from: a.pose, held: DK, d: 124, r: 0 }, clock + 1000).why, 'rate', 'the striker\'s own bucket');
  clock += 2000;
  // the breach
  b.gate.hp = 7;
  const last = hit(124);
  assert.deepEqual([last.dealt, last.fell, b.gate.hp, b.breached, b.ram, b.ramsLeft], [7, true, 0, true, null, 0], 'breached - never past what is left, and no kit fielded after');
  assert.equal(hit(124).why, 'no-work', 'a breach is for good');
  assert.deepEqual(siegeWorksStep(b, [], T + 60_000), [], 'and no Ram comes');
  b.result = 'attack';
  assert.equal(hit(124).why, 'time', 'nor once it is over');
  // before any beat has found the field's ground, the striker's own height stands in for it
  const fresh = siege({ works: [0, 20000, 0, 0, 0] });
  const tall = fighter('attack', 0, -100, { y: 50 });
  assert.equal(siegeWorkBlow(fresh, tall, '~gate', { from: tall.pose, held: DK, d: 124, r: 0 }, T + 100).dealt, 12);
  // refereeWorkBlow: the referee's own checks on a stand-in, the work's share after
  const w = { hp: 50 };
  const s = fighter('defend', 0, 0);
  assert.deepEqual(refereeWorkBlow(s, w, { from: s.pose, at: { x: 0, y: 0, z: 2 * M }, held: DK, d: 40 }, T), { ok: true, dealt: 40, fell: false, why: null }, 'a share of one: the whole');
  assert.deepEqual(refereeWorkBlow(s, w, { from: s.pose, at: { x: 0, y: 0, z: 2 * M }, held: DK, d: 999 }, T), { ok: true, dealt: 10, fell: true, why: null }, 'never past what is left');
  assert.equal(refereeWorkBlow(s, w, { from: s.pose, at: { x: 0, y: 0, z: 2 * M }, held: DK, d: 9 }, T).why, 'no-work');
  assert.equal(refereeWorkBlow({ ...s, down: true }, { hp: 5 }, { from: s.pose, at: s.pose, held: DK, d: 9 }, T).why, 'down', 'a fallen striker');
});

test('SEAT2b2 THE THRONE BEHIND THE BREACH: where a Gatehouse stands the Throne opens only while the banners rule holds AND it is breached - a crown 3 of 4, a palace with its own Gatehouse 2 of 3; a palace without one, and a crown whose pass carries no works (an older service\'s), open on the banners alone as before (mutants: the breach\'s gate; the banners\' rule kept)', () => {
  const far = [fighter('defend', 0, -160), fighter('defend', 0, -160)];
  const breach = (b) => { b.gate.hp = 1; const by = fighter('attack', 0, -102); return siegeWorkBlow(b, by, '~gate', { from: by.pose, held: DK, d: 124, r: 0 }, b.at + 500); };
  // a crown with its Gatehouse: three of four held, an attacker alone at the Throne
  const k = siege({ works: [0, 20000, 0, 0, 0] });
  for (const i of [0, 1, 2]) k.banners[i].side = 'attack';
  const atk = fighter('attack', 0, -100);
  beat(k, [atk, ...far], T, T + 10_000);
  assert.deepEqual([k.throne, k.reached], [0, false], 'shut behind its Gatehouse');
  assert.equal(breach(k).fell, true);
  beat(k, [atk, ...far], T + 11_000, T + 20_000);
  assert.deepEqual([k.throne, k.reached], [10, true], 'breached: open, and held');
  k.banners[2].side = 'defend';
  beat(k, [atk, ...far], T + 21_000, T + 25_000);
  assert.equal(k.throne, 5, 'breached, two of four: shut again - the banners\' rule still holds');
  // a palace whose Gatehouse stands: two of three, and breached
  const p = siege({ tier: 'palace', works: [3, 30000, 0, 0, 0] });
  p.banners[0].side = 'attack'; p.banners[1].side = 'attack';
  beat(p, [atk, ...far], T, T + 10_000);
  assert.equal(p.throne, 0, 'a palace\'s own gate shuts its Throne too');
  breach(p);
  beat(p, [atk, ...far], T + 11_000, T + 15_000);
  assert.equal(p.throne, 5);
  // a palace without one, a crown named by an older service's pass: the banners alone
  const q = siege({ tier: 'palace' });
  q.banners[0].side = 'attack'; q.banners[1].side = 'attack';
  beat(q, [atk, ...far], T, T + 5000);
  assert.equal(q.throne, 5, 'no Gatehouse: two of three opens it');
  const old = siege({});
  assert.deepEqual([old.gate, old.figures, old.ramsLeft, old.walls], [null, [], 0, 0], 'no works on the pass: none in the battle');
  for (const i of [0, 1, 2]) old.banners[i].side = 'attack';
  beat(old, [atk, ...far], T, T + 5000);
  assert.equal(old.throne, 5, 'three of four, as SEAT2a\'s crown');
});

test('SEAT2b2 THE RAMS: fielded one at a time - the first at the start, four metres before the gate on the line to the attackers\' camp; crewed by two standing attackers within 3 m (flat, on the field\'s ground) its swing fills, paused - never emptied - while not, a beat counting five seconds at most; each 10 s of crewed time strikes the Gatehouse for 500; a defender\'s blow strikes it whole, an attacker\'s never; at nought gone, the next at the attackers\' next wave; none past the breach (mutants: the place; the crew\'s count, reach, side and height; the pause; the damage; the beat; the clamp; the fresh Ram\'s first beat; the next\'s wave; the kits; the breach)', () => {
  const b = siege({ works: [3, 20000, 0, 2, 3000] });
  const ram = siegeRamPoint(b.field);
  assert.deepEqual(ram, P(0, -96), 'four metres before the Throne\'s point, toward the attackers\' camp');
  assert.deepEqual(siegeRamPoint({ throne: [0, 0], camps: { attack: [2 * M, 0] } }), [2 * M, 0], 'a camp nearer than that: at the camp');
  assert.deepEqual(siegeRamPoint({ throne: [5, 5], camps: { attack: [5, 5] } }), [5, 5], 'a camp on the gate: at the gate');
  const c1 = fighter('attack', 0, -96), c2 = fighter('attack', 2.9, -96), d1 = fighter('defend', 0, -160), d2 = fighter('defend', 0, -160);
  const fs = [c1, c2, d1, d2];
  assert.deepEqual(siegeWorksStep(b, fs, T - 1000), [], 'not before the start');
  assert.equal(siegeRamDue(b), true);
  assert.deepEqual(siegeWorksStep(b, fs, T), [{ k: 'ram' }], 'the first at the start');
  assert.deepEqual(b.ram, { hp: 3000, max: 3000, swing: 0, crew: 2, at: ram });
  assert.deepEqual([b.ramsLeft, siegeRamDue(b)], [1, false], 'one at a time');
  assert.deepEqual(validSiegeOut(siegeWorksFrame(b)), { k: 'w', g: [20000, 20000], br: 0, r: [3000, 3000, 2, 0], rl: 1 });
  for (let t = T + 1000; t < T + 10_000; t += 1000) siegeWorksStep(b, fs, t);
  assert.deepEqual([b.ram.swing, b.gate.hp], [9000, 20000], 'nine crewed seconds (the fielding beat counts none)');
  assert.deepEqual(siegeWorksStep(b, fs, T + 10_000), [{ k: 'rammed', hp: 19500 }], 'ten: 500');
  assert.equal(b.ram.swing, 0);
  siegeWorksStep(b, fs, T + 11_000); siegeWorksStep(b, fs, T + 12_000);
  put(c2, 3.1, -96);
  for (let t = T + 13_000; t <= T + 16_000; t += 1000) siegeWorksStep(b, fs, t);
  assert.deepEqual([b.ram.crew, b.ram.swing], [1, 2000], 'one crewman: paused, never emptied');
  put(c2, 0, -96, 9);
  siegeWorksStep(b, fs, T + 17_000);
  assert.deepEqual([b.ram.crew, b.ram.swing], [1, 2000], 'nine metres over the field is no crewman');
  put(c2, 0, -98.9);
  const d3 = fighter('defend', 0, -96);
  siegeWorksStep(b, [...fs, d3], T + 18_000);
  assert.deepEqual([b.ram.crew, b.ram.swing], [2, 3000], 'back: it fills again - a defender at it crews nothing');
  siegeWorksStep(b, fs, T + 30_000);
  assert.equal(b.ram.swing, 8000, 'a late beat counts five seconds at most');
  assert.deepEqual(validSiegeOut(siegeWorksFrame(b)), { k: 'w', g: [19500, 20000], br: 0, r: [3000, 3000, 2, 8], rl: 1 });
  c1.down = true;
  siegeWorksStep(b, fs, T + 31_000);
  assert.deepEqual([b.ram.crew, b.ram.swing], [1, 8000], 'a fallen crewman crews nothing');
  c1.down = false; c1.here = false;
  siegeWorksStep(b, fs, T + 32_000);
  assert.equal(b.ram.crew, 1, 'nor one gone from the room');
  c1.here = true;
  siegeWorksStep(b, fs, T + 33_000);
  assert.deepEqual(siegeWorksStep(b, fs, T + 38_000), [{ k: 'rammed', hp: 19000 }], 'nine seconds and five more: a strike');
  assert.equal(b.ram.swing, 4000, 'and the four seconds past it carried to the next');
  // a defender's blow: whole; an attacker's never
  const now = T + 38_500;
  assert.equal(siegeWorkBlow(b, c1, '~ram', { from: c1.pose, held: DK, d: 124, r: 0 }, now).why, 'side');
  assert.deepEqual(siegeWorkBlow(b, d3, '~ram', { from: d3.pose, held: DK, d: 500, r: 0 }, now), { ok: true, dealt: 124, fell: false, why: null }, 'its whole clipped damage');
  put(d3, 0, -101.6);
  assert.equal(siegeWorkBlow(b, d3, '~ram', { from: d3.pose, held: DK, d: 124, r: 0 }, now + 250).why, 'reach', 'judged to the Ram\'s own point');
  put(d3, 0, -96);
  b.ram.hp = 100;
  assert.equal(siegeWorkBlow(b, d3, '~ram', { from: d3.pose, held: DK, d: 124, r: 0 }, now + 500).fell, true);
  assert.deepEqual([b.ram, b.ramAt, b.ramsLeft], [null, T + 60_000, 1], 'gone; the next at the attackers\' next wave (the crown\'s 30 s - never the Walls\' 21)');
  assert.deepEqual(validSiegeOut(siegeWorksFrame(b)), { k: 'w', g: [19000, 20000], br: 0, r: 0, rl: 1 });
  assert.equal(siegeWorkBlow(b, d3, '~ram', { from: d3.pose, held: DK, d: 124, r: 0 }, now + 1000).why, 'side', 'no Ram standing to strike');
  assert.deepEqual(siegeWorksStep(b, fs, T + 59_000), [], 'not before its wave');
  assert.deepEqual(siegeWorksStep(b, fs, T + 60_000), [{ k: 'ram' }]);
  assert.deepEqual([b.ram.hp, b.ram.swing, b.ram.crew, b.ramsLeft], [3000, 0, 2, 0], 'the second, crewed at once, its swing from its own fielding');
  b.ram.hp = 1;
  siegeWorkBlow(b, d3, '~ram', { from: d3.pose, held: DK, d: 124, r: 0 }, T + 60_500);
  assert.deepEqual(siegeWorksStep(b, fs, T + 120_000), [], 'no kits left: no Ram');
  assert.equal(siegeWorksFrame(b).r, 0);
  // the Ram breaches, and its own work done is gone; no kit fielded past the breach
  const e = siege({ works: [0, 20000, 0, 3, 3000] });
  siegeWorksStep(e, fs, T);
  e.gate.hp = 400;
  for (let t = T + 1000; t < T + 10_000; t += 1000) siegeWorksStep(e, fs, t);
  assert.deepEqual(siegeWorksStep(e, fs, T + 10_000), [{ k: 'rammed', hp: 0 }, { k: 'breach' }], 'breached by its swing');
  assert.deepEqual([e.breached, e.ram, e.ramsLeft, siegeRamDue(e)], [true, null, 0, false]);
  assert.deepEqual(validSiegeOut(siegeWorksFrame(e)), { k: 'w', g: [0, 20000], br: 1, r: 0, rl: 0 });
  // no Gatehouse, no works to step
  const n = siege({ tier: 'palace', works: [3, 0, 0, 0, 0] });
  assert.deepEqual([siegeWorksStep(n, fs, T), siegeWorksFrame(n)], [[], null], 'a palace with no Gatehouse fields no Ram and says no works');
  assert.equal(siegeMayStrike(n, c1, '~gate'), false);
});

test('SEAT2b2 THE GUARDS (7.5\'s Barracks): posted the Throne first, then the banners, round again (`~g1`..), a guard\'s 350 vitality; each beat a standing guard keeps its foe while the foe stands fair - here, attacking, unprotected, on the field\'s ground - within its leash of the post, else engages the nearest fair attacker within its aggro; walks to it at 5 m/s, stopping at its reach, and strikes within reach and the referee\'s slack when its swing is due (a roll in 10-30, every 1.5 s); a fall\'s wave the attacker\'s own; home to its post with none (mutants: the posts; the side; the aggro; the leash; the keep; the nearest; protection; height; the walk; the stop; the strike\'s reach; the swing; the roll; the fall\'s wave)', () => {
  const b = siege({ works: [3, 20000, 6, 0, 0] });
  assert.deepEqual(b.figures.map((g) => [g.id, g.kind, ...g.post]), [['~g1', 'guard', ...CROWN[4]], ['~g2', 'guard', ...CROWN[0]], ['~g3', 'guard', ...CROWN[1]], ['~g4', 'guard', ...CROWN[2]], ['~g5', 'guard', ...CROWN[3]], ['~g6', 'guard', ...CROWN[4]]]);
  assert.ok(b.figures.every((g) => g.hp === 350 && g.max === 350 && !g.down && g.x === g.post[0] && g.z === g.post[1]));
  assert.deepEqual(revolt({}).figures.filter((g) => g.kind === 'guard'), [], 'never in a revolt');
  assert.deepEqual(newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(PALACE, 'palace'), works: [0, 0, 0, 0, 0] }).figures, [], 'nor a Tourney');
  const odd = newBattle({ kind: 'tourney', tier: 'palace', startMs: T, field: fieldOf(PALACE, 'palace'), works: [0, 20000, 6, 2, 3000] });
  assert.deepEqual([odd.gate, odd.figures, odd.ramsLeft], [null, [], 0], 'works no pass would carry: a Tourney fights over none of them');
  const nogate = siege({ tier: 'palace', works: [0, 0, 0, 2, 3000] });
  assert.deepEqual([nogate.gate, nogate.ramsLeft, nogate.ramHp], [null, 0, 0], 'no Ram Kit fielded where no Gatehouse stands');
  const one = siege({ works: [0, 20000, 1, 0, 0] });
  const g = fig(one, '~g1');
  const far = [fighter('defend', 0, -160), fighter('defend', 0, -160)];
  const fs = { a: fighter('attack', 0, -113), d1: far[0], d2: far[1] };
  const roll = () => 0;
  // aggro: 13 m off, within the leash (16 m of the post) - not engaged
  assert.deepEqual(siegeFiguresStep(one, fs, T, roll), []);
  assert.deepEqual([g.target, g.act], [null, 0], 'past its aggro');
  // engaged at 10 m: it walks 2.5 m a half-second beat, strikes inside 5.5 m when its swing is due
  put(fs.a, 0, -110);
  siegeFiguresStep(one, fs, T + 500, roll);
  assert.deepEqual([g.target, g.act, metresTo(g, CROWN[4]), g.tx, g.tz], ['a', 1, 2.5, ...P(0, -110)], 'engaged: it walks at it');
  assert.deepEqual(siegeFiguresStep(one, fs, T + 1000, roll), [{ k: 'hit', id: '~g1', to: 'a', h: 390, m: 400, fell: false }], 'five metres off - inside its reach and the slack: struck for the roll\'s least');
  assert.deepEqual([metresTo(g, CROWN[4]), g.act, g.swingAt], [5, 2, T + 2500]);
  siegeFiguresStep(one, fs, T + 1500, () => 0.999);
  assert.deepEqual([metresTo(g, CROWN[4]), g.act, fs.a.hp], [7.5, 1, 390], 'it closes to its reach; its swing not due');
  siegeFiguresStep(one, fs, T + 2000, roll);
  assert.deepEqual([metresTo(g, CROWN[4]), g.act], [7.5, 0], 'at its reach it stands');
  assert.deepEqual(siegeFiguresStep(one, fs, T + 2500, () => 0.999)[0].h, 360, 'the roll\'s most: 30');
  assert.equal(siegeFiguresStep(one, fs, T + 4000, () => 0.5)[0].h, 340, 'a middling roll: 20');
  // the leash: a foe kept past the aggro while within 16 m of the post; let go past it
  put(fs.a, 0, -115.9);
  siegeFiguresStep(one, fs, T + 4500, roll);
  assert.equal(g.target, 'a', 'kept at 15.9 m of the post, though 8.4 m from the guard is inside its aggro anyway');
  g.x = CROWN[4][0]; g.z = CROWN[4][1];   // set back at its post: the foe is 15.9 m off now, past its aggro
  siegeFiguresStep(one, fs, T + 5000, roll);
  assert.equal(g.target, 'a', 'a foe it holds it keeps past its aggro, within the leash');
  put(fs.a, 0, -116.1);
  siegeFiguresStep(one, fs, T + 5500, roll);
  assert.deepEqual([g.target, g.tx, g.tz], [null, ...CROWN[4]], 'past the leash: let go, home to its post');
  // the nearest fair attacker; never a defender, a protected, a fallen, a gone or a floating one
  const two = siege({ works: [0, 20000, 1, 0, 0] });
  const h = fig(two, '~g1');
  const many = { near: fighter('attack', 0, -108), nearer: fighter('attack', 0, -104, { safeTo: T + 9000 }), dfn: fighter('defend', 0, -101), down: fighter('attack', 0, -101, { down: true }), gone: fighter('attack', 1, -100, { here: false }), fly: fighter('attack', 0, -101, { y: 9 }), aside: fighter('attack', 5, -100), d1: far[0], d2: far[1], d3: fighter('defend', 0, -160), last: fighter('attack', -10, -100) };
  siegeFiguresStep(two, many, T, roll);
  assert.equal(h.target, 'aside', 'the nearest fair one: five metres - the nearer protected, the defender, the fallen, the gone and the floater passed');
  delete many.aside;
  siegeFiguresStep(two, many, T + 500, roll);
  assert.equal(h.target, 'near', 'its foe gone: the next nearest, eight metres');
  // a foe up a wall within the field's 8 m but out of a sword's reach of the ground: never struck
  const tall = siege({ works: [0, 20000, 1, 0, 0] });
  const t1 = fig(tall, '~g1');
  const up = { a: fighter('attack', 0, -102.5, { y: 6 }), d1: far[0], d2: far[1], d3: fighter('defend', 0, -160) };
  for (let t = T; t <= T + 5000; t += 500) siegeFiguresStep(tall, up, t, roll);
  assert.deepEqual([t1.target, up.a.hp], ['a', 400], 'six metres above the ground: engaged, never reached');
  // a fall: the attacker's own wave - the crown's 30 s, the Walls are the defenders'
  const fall = siege({ works: [3, 20000, 1, 0, 0] });
  const v = { a: fighter('attack', 0, -102, { hp: 5 }), d1: far[0], d2: far[1] };
  assert.deepEqual(siegeFiguresStep(fall, v, T + 1000, roll), [{ k: 'hit', id: '~g1', to: 'a', h: 0, m: 400, fell: true }], 'never past what is left');
  assert.deepEqual([v.a.down, v.a.upAt], [true, T + 30_000], 'down until the attackers\' wave');
  siegeFiguresStep(fall, v, T + 1500, roll);
  assert.equal(fig(fall, '~g1').target, null, 'a fallen foe is no foe');
  assert.deepEqual(siegeFiguresStep(siege({ works: [0, 20000, 1, 0, 0] }), { a: fighter('attack', 0, -102), d1: far[0], d2: far[1] }, T - 500, roll), [], 'nothing before the start');
  const over = siege({ works: [0, 20000, 1, 0, 0] });
  over.result = 'defend';
  assert.deepEqual(siegeFiguresStep(over, { a: fighter('attack', 0, -101), d1: far[0], d2: far[1] }, T + 500, roll), [], 'nor after the end');
  // a rebel set far off its post walks home at its pace - a beat counting five seconds at most, however long the silence
  const home = revolt({});
  const rb = fig(home, '~r1');
  battleStep(home, [], T);
  rb.x = rb.post[0] + 30 * M;
  siegeFiguresStep(home, {}, T + 60_000, roll);
  assert.ok(Math.abs(metresTo(rb, rb.post) - 7.5) < 1e-9, 'four and a half metres a second for five seconds: 22.5 of its 30');
});

test('SEAT2b2 A GUARD FELLED AND RISEN, AND A GUARD\'S CONTEST: an attacker fells a guard through the referee itself (its `felled`, Honours\' "felled a foe"); a defender never strikes one; it rises at its post at the defenders\' wave (the Walls\' own), whole, protected 3 s; a standing guard at a banner or the Throne CONTESTS it - frozen - and RAISES NOTHING (mutants: the side; the felled; the rise\'s wave; the rise\'s post, vitality and protection; the contest; the raise)', () => {
  const b = siege({ works: [2, 20000, 6, 0, 0] });
  const g = fig(b, '~g2');   // at the Gate
  const a = fighter('attack', 0, 103), d = fighter('defend', 0, 103);
  battleStep(b, [a, d, fighter('defend', 0, -160)], T);
  siegeFiguresStep(b, { a, d }, T + 50, () => 0);
  assert.deepEqual([g.target, g.act, g.tx, g.tz], ['a', 2, a.pose.x, a.pose.z], 'the Gate\'s guard on the attacker, striking');
  assert.equal(siegeFigureBlow(b, d, '~g2', { from: d.pose, held: DK, d: 124, r: 0 }, T + 100).why, 'side', 'a defender never strikes the holder\'s guard');
  assert.equal(siegeMayStrike(b, a, '~g2'), true);
  assert.equal(siegeMayStrike(b, a, '~r1'), false, 'no rebel in a siege');
  assert.equal(siegeMayStrike(b, { ...a, side: 'watch' }, '~g2'), false);
  const blows = [124, 124, 124].map((dmg, i) => siegeFigureBlow(b, a, '~g2', { from: a.pose, held: DK, d: dmg, r: 0 }, T + 100 + i));
  assert.deepEqual(blows.map((r) => [r.dealt, r.fell]), [[124, false], [124, false], [102, true]], 'three blows: never past what is left');
  assert.deepEqual([g.down, g.hp, a.felled, g.upAt, g.act, g.tx, g.tz], [true, 0, 1, T + 24_000, 0, g.x, g.z], 'felled - the attacker\'s foe felled; it rises at the Walls\' 24 s; it stands still where it fell');
  assert.equal(siegeFigureRise(b, g, T + 100), T + 24_000);
  assert.equal(siegeFigureBlow(b, a, '~g2', { from: a.pose, held: DK, d: 124, r: 0 }, T + 1200).why, 'down', 'a fallen guard takes no blow');
  assert.equal(siegeFigureBlow(b, a, '~g2', { from: a.pose, held: DK, d: 124, r: 0 }, b.endMs).why, 'time', 'nothing at the end');
  assert.equal(siegeFigureBlow(b, a, '~g3', { from: a.pose, held: DK, d: 124, r: 0 }, T - 1).why, 'time', 'nor before the start');
  const high = fighter('attack', 101, 0, { y: 9 });
  assert.equal(siegeFigureBlow(b, high, '~g3', { from: high.pose, held: DK, d: 124, r: 0 }, T + 200).why, 'reach', 'nine metres up a wall: the Market\'s guard stands on the field\'s ground');
  g.x += 10 * M;   // where it fell
  const fs = { a, d };
  assert.deepEqual(siegeFiguresStep(b, fs, T + 23_500, () => 0).filter((e) => e.id === '~g2'), [], 'not before its wave');
  assert.deepEqual(siegeFiguresStep(b, fs, T + 24_000, () => 0).filter((e) => e.id === '~g2'), [{ k: 'rise', id: '~g2' }]);
  assert.deepEqual([g.down, g.hp, g.x, g.z, g.safeTo], [false, 350, ...CROWN[0], T + 24_000 + SIEGE_PROTECT_MS], 'risen whole at its post, protected');
  assert.equal(siegeFigureBlow(b, a, '~g2', { from: a.pose, held: DK, d: 124, r: 0 }, T + 25_000).why, 'protected');
  // a guard contests: an attacker at its banner raises nothing while it stands; the guard alone raises nothing for the holder
  const c = siege({ works: [0, 20000, 6, 0, 0] });
  const atk = fighter('attack', 0, 100), dfs = [fighter('defend', 0, -160), fighter('defend', 0, -160)];
  beat(c, [atk, ...dfs], T, T + 30_000);
  assert.deepEqual([c.banners[0].side, c.banners[0].raise], ['defend', 0], 'frozen by the Gate\'s guard: never raised');
  fig(c, '~g2').down = true; fig(c, '~g2').upAt = null;
  beat(c, [atk, ...dfs], T + 31_000, T + 51_000);
  assert.equal(c.banners[0].side, 'attack', 'its guard down: raised in twenty');
  const g2 = fig(c, '~g2');
  g2.down = false;
  beat(c, [...dfs], T + 52_000, T + 80_000);
  assert.deepEqual([c.banners[0].side, c.banners[0].by], ['attack', null], 'a guard alone raises nothing for the holder');
  const back = fighter('defend', 0, 100);
  beat(c, [back, ...dfs], T + 81_000, T + 101_000);
  assert.equal(c.banners[0].side, 'defend', 'a defender beside it raises it, as ever');
  // the guard's contest has the banner's own radius
  g2.z = CROWN[0][1] - 8.5 * M;
  beat(c, [atk, ...dfs], T + 102_000, T + 105_000);
  assert.deepEqual([c.banners[0].by, c.banners[0].raise], ['attack', 4], 'its guard eight and a half metres off: the attacker raises it');
  g2.z = CROWN[0][1] - 6 * M;
  beat(c, [atk, ...dfs], T + 106_000, T + 110_000);
  assert.deepEqual([c.banners[0].side, c.banners[0].raise], ['defend', 4], 'six metres off, within the 8 m: contested, frozen');
  // a guard at the Throne contests the attackers' hold
  const t = siege({ works: [0, 20000, 6, 0, 0] });
  for (const i of [0, 1, 2]) t.banners[i].side = 'attack';
  t.gate.hp = 1;
  const breaker = fighter('attack', 0, -102);
  siegeWorkBlow(t, breaker, '~gate', { from: breaker.pose, held: DK, d: 124, r: 0 }, T + 100);
  assert.equal(t.breached, true);
  beat(t, [breaker, ...dfs], T + 1000, T + 10_000);
  assert.equal(t.throne, 0, 'the Throne\'s two guards standing: contested, frozen');
  for (const id of ['~g1', '~g6', '~g5']) { fig(t, id).down = true; fig(t, id).upAt = null; }
  beat(t, [breaker, ...dfs], T + 11_000, T + 15_000);
  assert.equal(t.throne, 5, 'its guards down: held');
  fig(t, '~g6').down = false;
  beat(t, [breaker, ...dfs], T + 16_000, T + 20_000);
  assert.equal(t.throne, 5, 'one back: frozen again');
});

test('SEAT2b2 THE REVOLT (7.7): two hours; the holder\'s banners inert - none raised, no Throne, no forfeit; the Rebel Captain (`~c`, 400) at the palace door and twelve rebels (`~r1`..`~r12`, 302) on a ring about it; the rebels and the Captain fight the holder\'s side; the Captain felled puts it down (`defend`), the clock out with him standing is the rebels\' (`attack`); a felled rebel rises at its post every 30 s, the Captain never (mutants: the length; the inert banners; the Throne; the forfeit; the posts; the foe\'s side; the Captain\'s end; the clock\'s end; the rebels\' wave; the Captain\'s never)', () => {
  const r = revolt({ works: [1, 0, 0, 0, 0] });
  assert.deepEqual([r.endMs - T, r.gate, r.ramsLeft, r.walls], [SIEGE_LENGTH_MS.revolt, null, 0, 1]);
  assert.deepEqual(r.banners.map((bn) => bn.side), ['defend', 'defend', 'defend']);
  assert.deepEqual(r.figures.map((g) => g.id), ['~c', ...Array.from({ length: 12 }, (_, i) => `~r${i + 1}`)]);
  assert.deepEqual([fig(r, '~c').hp, fig(r, '~c').post, fig(r, '~r1').hp], [400, PALACE[3], 302]);
  const posts = siegeRebelPosts(r.field);
  assert.deepEqual(posts.captain, PALACE[3]);
  assert.equal(new Set(posts.rebels.map(String)).size, 12, 'twelve places');
  for (const q of posts.rebels) assert.ok(Math.abs(Math.hypot(q[0] - PALACE[3][0], q[1] - PALACE[3][1]) / M - SIEGE_REBEL_RING_M) < 0.05, 'each six metres off the door');
  assert.deepEqual(r.figures.slice(1).map((g) => g.post), posts.rebels);
  const [dx, dz] = PALACE[3], ring = SIEGE_REBEL_RING_M * M;
  assert.deepEqual([posts.rebels[0], posts.rebels[3], posts.rebels[6], posts.rebels[9]], [[dx + ring, dz], [dx, dz + ring], [dx - ring, dz], [dx, dz - ring]], 'a twelfth of a turn apart, the first due east of the door');
  // inert: the holder's side at a banner, at the Throne; nobody at all for ten minutes - nothing moves, nothing ends
  const h = fighter('defend', 0, 100), h2 = fighter('defend', 0, -100);
  beat(r, [h, h2], T, T + 60_000);
  assert.deepEqual([r.banners.map((bn) => [bn.side, bn.raise]), r.throne, r.result], [[['defend', 0], ['defend', 0], ['defend', 0]], 0, null]);
  const lone = revolt({});
  beat(lone, [], T, T + SIEGE_FORFEIT_MS + 5000, 5000);
  assert.equal(lone.result, null, 'no forfeit: nobody came, and the clock runs');
  // the rebels fight the holder's side, never an attacker
  const fs = { h: fighter('defend', 0, -107), a: fighter('attack', 0, -101), d1: fighter('defend', 0, -160) };
  siegeFiguresStep(r, fs, T + 61_000, () => 0);
  assert.equal(fig(r, '~c').target, 'h', 'the Captain engages the holder\'s fighter seven metres off (his leash is eight) - never the nearer attacker');
  put(fs.h, 0, -108.1);
  fig(r, '~c').target = null;
  siegeFiguresStep(r, fs, T + 61_250, () => 0);
  assert.equal(fig(r, '~c').target, null, 'past his eight-metre leash: the Captain keeps the door');
  assert.ok(r.figures.every((g) => g.target !== 'a'), 'never an attacker');
  assert.deepEqual([siegeMayStrike(r, fs.h, '~c'), siegeMayStrike(r, fs.h, '~r7'), siegeMayStrike(r, fs.a, '~c'), siegeMayStrike(r, fs.h, '~g1'), siegeMayStrike(r, fs.h, '~gate')], [true, true, false, false, false]);
  // a rebel felled rises at its post every 30 s; the Captain never
  const s = fighter('defend', 0, -100);
  battleStep(r, [s, fighter('defend', 0, -160), fighter('defend', 0, -160)], T + 61_500);
  const rb = fig(r, '~r4');
  put(s, rb.x / M, rb.z / M + 1);
  for (let i = 0; i < 3; i++) siegeFigureBlow(r, s, '~r4', { from: s.pose, held: DK, d: 124, r: 0 }, T + 62_000 + i);
  assert.deepEqual([rb.down, rb.upAt, s.felled], [true, T + 90_000, 1], 'down until the next thirty seconds');
  assert.deepEqual(battleStep(r, [s], T + 62_500), [], 'a rebel\'s fall ends nothing - the Captain\'s alone');
  assert.equal(siegeFigureRise(r, fig(r, '~c'), T), null, 'the Captain never rises');
  siegeFiguresStep(r, {}, T + 90_000, () => 0);
  assert.deepEqual([rb.down, rb.hp, rb.x, rb.z], [false, 302, ...rb.post], 'risen whole at its post');
  const cap = fig(r, '~c');
  put(s, cap.x / M, cap.z / M + 1);
  for (let i = 0; i < 4; i++) siegeFigureBlow(r, s, '~c', { from: s.pose, held: DK, d: 124, r: 0 }, T + 91_000 + i);
  assert.deepEqual([cap.down, cap.upAt], [true, null], 'the Captain felled, for good');
  siegeFiguresStep(r, {}, T + 3600_000, () => 0);
  assert.equal(cap.down, true, 'an hour on: still down');
  assert.deepEqual(battleStep(r, [s], T + 91_500), [{ k: 'end', result: 'defend' }], 'put down');
  // the clock out with the Captain standing: the rebels'
  const out = revolt({});
  battleStep(out, [], T);
  assert.equal(battleStep(out, [], T + SIEGE_LENGTH_MS.revolt - 1000).length, 0);
  assert.deepEqual(battleStep(out, [], T + SIEGE_LENGTH_MS.revolt), [{ k: 'end', result: 'attack' }], 'the rebels hold');
  assert.deepEqual([out.raised, out.reached], [false, false], 'no banner raised, no Throne reached: `a` 0 and `th` 0 on every receipt');
});

test('SEAT2b2 THE BEAT AND THE FRAMES: half a second while the battle is joined and a figure stands or a Ram is crewed, a second otherwise (and before the start); a fallen figure\'s wave and the next Ram\'s are marks; `w` and `n` as the wire reads them - a figure\'s row its id, kind, place, goal, vitality, fall and act, in whole room units (mutants: the busy beat; the crewed beat; the marks; the frames\' fields)', () => {
  const b = siege({ works: [0, 20000, 2, 1, 3000] });
  assert.equal(siegeNextBeat(b, T - 5000), T - 4000, 'a second before the start, figures or none');
  assert.equal(siegeNextBeat(b, T), T + SIEGE_FIGURE_TICK_MS, 'joined, its guards standing');
  for (const g of b.figures) { g.down = true; g.upAt = T + 30_000; }
  assert.equal(siegeNextBeat(b, T + 100), T + 1100, 'all fallen: a second');
  assert.equal(siegeNextBeat(b, T + 29_700), T + 30_000, 'a fallen guard\'s wave is a mark');
  for (const g of b.figures) g.upAt = null;
  b.ram = { hp: 3000, max: 3000, swing: 0, crew: 2, at: [0, 0] };
  assert.equal(siegeNextBeat(b, T + 100), T + 600, 'a crewed Ram: half a second');
  b.ram.crew = 1;
  assert.equal(siegeNextBeat(b, T + 100), T + 1100, 'uncrewed: a second');
  b.ram = null; b.ramAt = T + 30_000;
  assert.equal(siegeNextBeat(b, T + 29_800), T + 30_000, 'the next Ram\'s time is a mark');
  b.result = 'attack';
  b.figures[0].down = false;
  assert.equal(siegeNextBeat(b, T + 31_000), T + 32_000, 'over: no half-second beat');
  assert.equal(siegeNextBeat(siege({}), T + 100), T + 1100, 'a battle with no works beats each second, as before');
  // the frames
  const r = revolt({});
  const n = siegeFiguresFrame(r);
  assert.equal(n.n.length, SIEGE_FIGURES_MAX);
  assert.deepEqual(validSiegeOut(n), n, 'a revolt\'s thirteen rows, as the wire reads them');
  const c = fig(r, '~c');
  c.x = 12.6; c.z = -3.4; c.tx = 99.5; c.tz = 7; c.hp = 123; c.down = true; c.act = 2;
  assert.deepEqual(siegeFiguresFrame(r).n[0], ['~c', 2, 13, -3, 100, 7, 123, 400, 1, 2]);
  assert.deepEqual(siegeFiguresFrame(r).n[1].slice(0, 2), ['~r1', 1]);
  assert.equal(siegeFiguresFrame(siege({})), null, 'no figures: no frame');
  assert.equal(siegeWorksFrame(r), null, 'a revolt has no works to say');
  const w = siege({ works: [0, 20000, 0, 2, 4500] });
  assert.deepEqual(validSiegeOut(siegeWorksFrame(w)), { k: 'w', g: [20000, 20000], br: 0, r: 0, rl: 2 }, 'before the first is fielded');
  w.ram = { hp: 4000, max: 4500, swing: 9999, crew: 60, at: [0, 0] };
  assert.deepEqual(siegeWorksFrame(w).r, [4000, 4500, 48, 9], 'the crew at most a roll call\'s, the swing in whole seconds');
  assert.equal(siegeVitality(SIEGE_FIGURE_KINDS.guard.renown), 350);
  assert.equal(SIEGE_WAVE_MS.crown, 30000);
});
