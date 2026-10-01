// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE CONTRACT BOTH ENDS READ - the battle's works
// on the pass (net/identityToken.js `sx`, a revolt's `sn`), the wire's figures and works (net/wire.js `w`, `n`, the
// targets), the numbers the relay copies (net/fortLaw.js), the Ram Kit as a Stores good and the Siegewright chosen
// (net/professionLaw.js, net/recipeLaw.js), and a revolt as the seat law names it (net/townSeatLaw.js) -
// bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7, 9.2; `06-Systems/Online-Arc.md` SEAT2b (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  siegeWorksPass, campGoodOk, fortMaterialOk, watchtowerPassed, guardPosts, figureVitality, SIEGE_FIGURES, REVOLT, RAM_OFFSET_M,
  fortStandsAt, SIEGEWRIGHT_SOONER_DAYS, RAM_KIT_KEY, gatehouseVitality, ramVitality, barracksGuards, stationSteps,
} from '../src/net/fortLaw.js';
import {
  siegePassValid, siegeWorksValid, SIEGE_PASS_FIELDS, SIEGE_PASS_KINDS, SIEGE_PASS_WORKS, mintSiegeOrder, verifyOrder, orderValid,
} from '../src/net/identityToken.js';
import {
  validSiegeIn, validSiegeOut, SIEGE_OUT_KINDS, SEAT2B_RELAY_MIN, relayKnowsWorks, SIEGE_FIGURE_ID_RE, SIEGE_WORK_IDS,
  SIEGE_FIGURES_MAX, siegeFigureKind, SIEGE_GATE_WIRE_MAX, SIEGE_RAM_WIRE_MAX, RELAY_VERSION,
} from '../src/net/wire.js';
import { RAM_KIT_INPUTS, RAM_KIT_VALUE, RAM_KIT_TEMPLATE_INDEX, materialOf, MINED_KEYS, MATERIAL_FAMILIES, specOk, professionOfFamily } from '../src/net/professionLaw.js';
import { recipeById, recipeOpen, takesQuality, RAM_KIT_TEMPLATE, qualitySteps, craftQuality } from '../src/net/recipeLaw.js';
import { marketCatalogue } from '../src/net/marketLaw.js';
import { BATTLE_LENGTH_MS, battleLengthMs, battlePreferredMs, battleSpanMs, siegeStartMs, battleAnnouncement, chronicleLine, placeBattles } from '../src/net/townSeatLaw.js';
import { SIEGE_LENGTH_MS, siegeVitality } from '../src/net/siegeRef.js';

const { subtle } = webcrypto;
const PAL = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0], [50, 0]];
const CROWN = [...PAL, [60, 0]];
const pass = (o = {}) => ({ o: 'siege', s: 'acct-a', sk: 7, sw: 3, sd: 'attack', st: 'palace', sn: 'siege', sb: 1000, se: 8200, sf: PAL, i: 1, e: 100, ...o });

test('SEAT2b2 THE WORKS A PASS CARRIES (sx): the Walls\' tier, the Gatehouse\'s vitality (a crown\'s always, a palace\'s where it stands), the Barracks\' guards, the Ram Kits and a Ram\'s vitality - a Tourney none, a revolt its Walls alone, a Ram only where a Gatehouse stands (mutants: the crown\'s gate; the palace gate\'s tier; the Siegewright; the Tourney; the revolt\'s Walls; a Ram without a gate)', () => {
  assert.deepEqual(siegeWorksPass({ kind: 'siege', tier: 'crown', forts: {}, rams: 0 }), [0, 20000, 0, 0, 0]);
  assert.deepEqual(siegeWorksPass({ kind: 'siege', tier: 'crown', forts: { walls: 2, gatehouse: 1, barracks: 3 }, rams: 2, siegewright: true }), [2, 30000, 6, 2, 4500]);
  assert.deepEqual(siegeWorksPass({ kind: 'siege', tier: 'palace', forts: { walls: 3, barracks: 1 }, rams: 4 }), [3, 0, 2, 0, 0], 'no Gatehouse at a palace that never raised one - and no Ram');
  assert.deepEqual(siegeWorksPass({ kind: 'siege', tier: 'palace', forts: { walls: 3, gatehouse: 1 }, rams: 1 }), [3, 30000, 0, 1, 3000]);
  assert.deepEqual(siegeWorksPass({ kind: 'tourney', tier: 'palace', forts: { walls: 3, gatehouse: 2, barracks: 3 }, rams: 2 }), [0, 0, 0, 0, 0]);
  assert.deepEqual(siegeWorksPass({ kind: 'revolt', tier: 'crown', forts: { walls: 2, gatehouse: 3, barracks: 3 }, rams: 2 }), [2, 0, 0, 0, 0]);
  assert.deepEqual(siegeWorksPass({ kind: 'siege', tier: 'crown', forts: { walls: 9, gatehouse: -1, barracks: 'x' }, rams: 500 }), [3, 20000, 0, 99, 3000], 'held to their bounds');
  assert.deepEqual([gatehouseVitality(3), ramVitality(true), barracksGuards(2)], [50000, 4500, 4]);
});

test('SEAT2b2 THE PASS\'S WORKS AND A REVOLT\'S PASS: sx five whole numbers in their bounds, a Ram only with a gate and a vitality, a Tourney\'s and a revolt\'s gate, guards and Rams none, never on a Royal Tourney\'s; a revolt\'s side the holder\'s or a spectator\'s - never an attacker (mutants: each bound; the coupling; the kind rule; the revolt\'s attackers; sx absent allowed)', () => {
  assert.deepEqual([...SIEGE_PASS_FIELDS], ['sk', 'sw', 'sd', 'st', 'sn', 'sb', 'se', 'sf', 'sx']);
  assert.deepEqual([...SIEGE_PASS_KINDS], ['siege', 'tourney', 'royal', 'revolt']);
  assert.deepEqual({ ...SIEGE_PASS_WORKS }, { walls: 3, gate: 60000, guards: 6, rams: 99, ramHp: 9000 });
  assert.equal(siegePassValid(pass()), true, 'no sx: an older service\'s pass');
  assert.equal(siegePassValid(pass({ sx: [3, 30000, 6, 2, 4500] })), true);
  for (const bad of [[4, 0, 0, 0, 0], [0, 60001, 0, 0, 0], [0, 0, 7, 0, 0], [0, 1, 0, 100, 1], [0, 1, 0, 1, 9001], [0, 0, 0, 1, 3000], [0, 1, 0, 1, 0], [0, 1, 0, 0, 3000],
    [0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0.5, 0, 0, 0, 0], [-1, 0, 0, 0, 0], 'x']) assert.equal(siegeWorksValid(bad, 'siege'), false, JSON.stringify(bad));
  assert.equal(siegeWorksValid([0, 0, 0, 0, 0], 'tourney'), true);
  assert.equal(siegeWorksValid([1, 0, 0, 0, 0], 'tourney'), false, 'a Tourney fights over no works');
  assert.equal(siegeWorksValid([2, 0, 0, 0, 0], 'revolt'), true);
  for (const bad of [[0, 20000, 0, 0, 0], [0, 0, 2, 0, 0], [0, 1, 0, 1, 1]]) assert.equal(siegeWorksValid(bad, 'revolt'), false, JSON.stringify(bad));
  assert.equal(siegeWorksValid([0, 0, 0, 0, 0], 'royal'), false);
  assert.equal(siegeWorksValid(undefined, 'royal'), true);
  assert.equal(siegePassValid(pass({ sn: 'revolt', sd: 'defend', sx: [1, 0, 0, 0, 0] })), true);
  assert.equal(siegePassValid(pass({ sn: 'revolt', sd: 'watch' })), true);
  assert.equal(siegePassValid(pass({ sn: 'revolt', sd: 'attack' })), false, 'a revolt\'s attackers are the relay\'s rebels');
  assert.equal(siegePassValid(pass({ sn: 'revolt', sd: 'duel' })), false);
  assert.equal(siegePassValid(pass({ sn: 'revolt', sd: 'defend', st: 'crown', sf: CROWN })), true, 'a revolt\'s field is a siege\'s');
  assert.equal(siegePassValid(pass({ sn: 'revolt', sd: 'defend', se: 1000 + 7201 })), false, 'two hours at most');
  assert.equal(siegePassValid(pass({ sn: 'riot' })), false);
  assert.equal(orderValid({ o: 'mute', s: 'acct-a', mu: 1, sx: [0, 0, 0, 0, 0], i: 1, e: 100 }), false, 'a pass\'s works on no other order');
});

test('SEAT2b2 THE PASS MINTED: mintSiegeOrder signs the works where given and leaves them off where not; the room reads them back (mutants: the works dropped from the mint)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const o = { s: 'acct-a', sk: 7, sw: 3, sd: 'defend', st: 'palace', sn: 'siege', sb: 1000, se: 8200, sf: PAL };
  const withWorks = await mintSiegeOrder({ ...o, sx: [1, 30000, 2, 1, 3000] }, kp.privateKey, { subtle, nowS: 900 });
  const v = await verifyOrder(withWorks, kp.publicKey, { subtle, nowS: 900, kind: 'siege' });
  assert.equal(v.ok, true);
  assert.deepEqual(v.claims.sx, [1, 30000, 2, 1, 3000]);
  const bare = await verifyOrder(await mintSiegeOrder(o, kp.privateKey, { subtle, nowS: 900 }), kp.publicKey, { subtle, nowS: 900, kind: 'siege' });
  assert.equal(bare.ok, true);
  assert.equal('sx' in bare.claims, false);
  await assert.rejects(mintSiegeOrder({ ...o, sn: 'revolt', sd: 'attack' }, kp.privateKey, { subtle, nowS: 900 }), TypeError);
});

test('SEAT2b2 THE WIRE\'S TARGETS: a blow may strike a peer, a relay-run figure or a work; a cast a peer or a figure (no spell harms stone or timber); a challenge peers alone; no figure id is a peer\'s (mutants: the work on a cast; a figure on a challenge; the figure pattern)', () => {
  const blow = (to) => validSiegeIn({ k: 'blow', to, w: 120, m: 3, d: 30, r: 0 });
  for (const to of ['~g1', '~g6', '~r1', '~r12', '~c', '~gate', '~ram', 'peer-1']) assert.equal(blow(to)?.to, to, to);
  for (const to of ['~g0', '~g7', '~r0', '~r13', '~cc', '~gates', '~', 'g1']) assert.equal(blow(to), null, to);
  assert.equal(validSiegeIn({ k: 'cast', to: '~r3', d: 40 })?.to, '~r3');
  assert.equal(validSiegeIn({ k: 'cast', to: '~gate', d: 40 }), null);
  assert.equal(validSiegeIn({ k: 'cast', to: '~ram', d: 40 }), null);
  assert.equal(validSiegeIn({ k: 'ask', to: '~c' }), null);
  assert.equal(validSiegeIn({ k: 'yes', to: '~g1' }), null);
  assert.equal(validSiegeIn({ k: 'ask', to: 'peer-1' })?.to, 'peer-1');
  assert.deepEqual([...SIEGE_WORK_IDS], ['~gate', '~ram']);
  assert.equal(SIEGE_FIGURE_ID_RE.test('peer'), false);
  assert.deepEqual(['~g4', '~r9', '~c', 'x'].map(siegeFigureKind), [0, 1, 2, -1]);
  assert.equal(SEAT2B_RELAY_MIN, 144);
  assert.deepEqual(['world143', 'world144', 'world145', 'w144', null].map(relayKnowsWorks), [false, true, true, false, false]);
  assert.ok(Number(/\d+/.exec(RELAY_VERSION)[0]) >= 143);
});

test('SEAT2b2 THE WIRE\'S WORKS AND FIGURES: `w` the Gatehouse and its breach, the standing Ram, the kits left; `n` each figure\'s id, kind, place, target, vitality, fall and act; `fell` with a figure on either side - every bound refused past (mutants: each bound; the kind agreeing with the id; a duplicate figure; a breach with no gate)', () => {
  assert.deepEqual([...SIEGE_OUT_KINDS].slice(-2), ['w', 'n']);
  assert.deepEqual(validSiegeOut({ k: 'w', g: [12000, 30000], br: 0, r: [2500, 3000, 2, 7], rl: 1 }), { k: 'w', g: [12000, 30000], br: 0, r: [2500, 3000, 2, 7], rl: 1 });
  assert.deepEqual(validSiegeOut({ k: 'w', g: 0, br: 0, r: 0, rl: 0 }), { k: 'w', g: 0, br: 0, r: 0, rl: 0 });
  assert.deepEqual(validSiegeOut({ k: 'w', g: [0, 20000], br: 1, r: 0, rl: 0 })?.br, 1);
  for (const bad of [{ g: [20001, 20000], br: 0, r: 0, rl: 0 }, { g: [0, 60001], br: 0, r: 0, rl: 0 }, { g: 0, br: 1, r: 0, rl: 0 }, { g: 0, br: 0, r: [1, 9001, 0, 0], rl: 0 },
    { g: 0, br: 0, r: [10, 9, 0, 0], rl: 0 }, { g: 0, br: 0, r: [1, 10, 49, 0], rl: 0 }, { g: 0, br: 0, r: [1, 10, 0, 11], rl: 0 }, { g: 0, br: 0, r: 0, rl: 100 }, { g: 0, br: 2, r: 0, rl: 0 }]) {
    assert.equal(validSiegeOut({ k: 'w', ...bad }), null, JSON.stringify(bad));
  }
  const row = (id, kind) => [id, kind, 100, 200, 120, 220, 300, 350, 0, 1];
  const n = { k: 'n', n: [row('~g1', 0), row('~r12', 1), row('~c', 2)] };
  assert.deepEqual(validSiegeOut(n), n);
  assert.equal(validSiegeOut({ k: 'n', n: [row('~g1', 1)] }), null, 'the kind agrees with the id');
  assert.equal(validSiegeOut({ k: 'n', n: [row('~g1', 0), row('~g1', 0)] }), null, 'one row a figure');
  assert.equal(validSiegeOut({ k: 'n', n: Array.from({ length: 14 }, (_, i) => row(i ? `~r${((i - 1) % 12) + 1}` : '~c', i ? 1 : 2)) }), null);
  assert.equal(SIEGE_FIGURES_MAX, REVOLT.rebels + 1, 'a revolt\'s Captain and twelve (fortLaw.js REVOLT, pinned equal)');
  for (const bad of [[...row('~g1', 0).slice(0, 6), 351, 350, 0, 1], [...row('~g1', 0).slice(0, 6), 1, 1001, 0, 1], [...row('~g1', 0).slice(0, 8), 2, 1], [...row('~g1', 0).slice(0, 9), 3], ['~g1', 0, 2e9, 0, 0, 0, 1, 1, 0, 0]]) {
    assert.equal(validSiegeOut({ k: 'n', n: [bad] }), null, JSON.stringify(bad));
  }
  assert.deepEqual(validSiegeOut({ k: 'fell', id: '~g2', by: 'peer-1' }), { k: 'fell', id: '~g2', by: 'peer-1' });
  assert.deepEqual(validSiegeOut({ k: 'fell', id: 'peer-1', by: '~r4' }), { k: 'fell', id: 'peer-1', by: '~r4' });
  assert.equal(validSiegeOut({ k: 'fell', id: '~gate', by: 'peer-1' }), null, 'a work does not fall - it is breached');
  assert.equal(validSiegeOut({ k: 'hp', id: '~g1', h: 1, m: 350 }), null, 'a figure\'s vitality rides its row');
  assert.deepEqual([SIEGE_GATE_WIRE_MAX, SIEGE_RAM_WIRE_MAX], [SIEGE_PASS_WORKS.gate, SIEGE_PASS_WORKS.ramHp], 'pinned equal to the pass\'s bounds');
});

test('SEAT2b2 THE FIGURES\' NUMBERS: each kind\'s vitality a siege fighter\'s at its Renown (the Captain 7.7\'s 50), its blow, swing, reach, walk, leash and aggro; the revolt\'s twelve and their thirty-second wave; the guards\' posts - the Throne first, then the banners, round again; a Ram four metres before the gate (mutants: a number; the post order)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(SIEGE_FIGURES)), {
    guard: { renown: 25, blow: [10, 30], swingMs: 1500, reachM: 2.5, speedMps: 5, leashM: 16, aggroM: 12 },
    rebel: { renown: 1, blow: [8, 22], swingMs: 1600, reachM: 2.5, speedMps: 4.5, leashM: 24, aggroM: 16 },
    captain: { renown: 50, blow: [16, 36], swingMs: 1300, reachM: 2.5, speedMps: 4.5, leashM: 8, aggroM: 10 },
  });
  assert.deepEqual(['guard', 'rebel', 'captain'].map(figureVitality), [350, 302, 400]);
  for (const k of ['guard', 'rebel', 'captain']) assert.equal(figureVitality(k), siegeVitality(SIEGE_FIGURES[k].renown), `${k}: siegeRef.js siegeVitality's law`);
  assert.deepEqual({ ...REVOLT }, { captainRenown: 50, rebels: 12, windowMs: 7200000, rebelsWaveMs: 30000 });
  assert.equal(SIEGE_FIGURES.captain.renown, REVOLT.captainRenown);
  assert.equal(RAM_OFFSET_M, 4);
  const field = { throne: [9, 9], banners: [[1, 1], [2, 2], [3, 3]] };
  assert.deepEqual(guardPosts(field, 2), [[9, 9], [1, 1]]);
  assert.deepEqual(guardPosts(field, 6), [[9, 9], [1, 1], [2, 2], [3, 3], [9, 9], [1, 1]]);
  assert.deepEqual(guardPosts({ throne: [9, 9], banners: [[1, 1], [2, 2], [3, 3], [4, 4]] }, 6), [[9, 9], [1, 1], [2, 2], [3, 3], [4, 4], [9, 9]]);
  assert.deepEqual([guardPosts(field, 0), guardPosts(null, 4), guardPosts(field, 9).length], [[], [], 6]);
});

test('SEAT2b2 THE WATCHTOWERS\' WORD, THE SIEGEWRIGHT\'S DAY AND THE HALLS\' STEPS: a challenger past - strictly - half the defence at tier 1, a quarter at tier 2, never without a tower or a defence; a Siegewright\'s project a day sooner; a seat\'s Forge, Workshop or Apothecary a step a tier on its professions\' crafts, beside the clean act, Masterwork the ceiling (mutants: strictness; the share; the day; the station\'s steps)', () => {
  assert.deepEqual([watchtowerPassed(501, 1000, 1), watchtowerPassed(500, 1000, 1), watchtowerPassed(251, 1000, 2), watchtowerPassed(250, 1000, 2), watchtowerPassed(999, 1000, 0), watchtowerPassed(5, 0, 2)],
    [true, false, true, false, false, false]);
  assert.equal(SIEGEWRIGHT_SOONER_DAYS, 1);
  assert.deepEqual([1, 2, 3].map((t) => fortStandsAt(0, t, { siegewright: true }) / 86400), [1, 3, 6]);
  assert.deepEqual([1, 2, 3].map((t) => fortStandsAt(0, t) / 86400), [2, 4, 7]);
  const sword = recipeById('longsword:iron'), bow = recipeById('shortbow:oak');
  assert.equal(stationSteps(sword.profession, { forge: 2 }), 2);
  assert.equal(stationSteps(bow.profession, { forge: 2, workshop: 1 }), 1);
  assert.deepEqual([qualitySteps(sword, { clean: true, station: 2 }), qualitySteps(sword, { station: 1 }), qualitySteps(sword, {}), qualitySteps(sword, { station: 7 }), qualitySteps(sword, { station: -1 })], [3, 1, 0, 3, 0]);
  assert.equal(craftQuality(3, qualitySteps(sword, { clean: true, station: 2 })), 4, 'nothing past Masterwork');
});

test('SEAT2b2 THE RAM KIT MADE: Carpentry rank 60, open now - 40 Oak Planks, 20 Iron Ingots, 4 Bear Hide - a siege work with no quality; a Stores good of the Siege Works worth its inputs (108), never on the market, a camp\'s writ\'s and never a stockpile\'s; its writ Carpentry\'s; the Siegewright chosen (mutants: the later; the inputs; the value; the market; the camp; the family\'s craft; the spec)', () => {
  const r = recipeById('ramkit:oak');
  assert.equal(r.later, undefined);
  assert.equal(recipeOpen(r, 59), false);
  assert.equal(recipeOpen(r, 60), true);
  assert.deepEqual(r.inputs.map((i) => [i.key, i.n]), [['plank:oak', 40], ['ingot:iron', 20], ['hide:bear', 4]]);
  assert.deepEqual(RAM_KIT_INPUTS.map(([k, n]) => [k, n]), r.inputs.map((i) => [i.key, i.n]), 'one home');
  assert.equal(takesQuality(r), false);
  assert.equal(RAM_KIT_TEMPLATE, 690);
  assert.equal(RAM_KIT_TEMPLATE_INDEX, 690);
  assert.equal(RAM_KIT_VALUE, 40 * 2 + 20 * 1 + 4 * 2);
  assert.deepEqual(materialOf(RAM_KIT_KEY, () => 1), { key: 'work:ram', family: 'works', tier: 5, value: 108, templateIndex: 690 });
  assert.deepEqual(MATERIAL_FAMILIES.at(-1), ['works', 'Siege Works']);
  assert.equal(MINED_KEYS.includes(RAM_KIT_KEY), false);
  assert.equal(marketCatalogue().some((m) => m.key === RAM_KIT_KEY), false);
  assert.deepEqual([campGoodOk(RAM_KIT_KEY), fortMaterialOk(RAM_KIT_KEY), campGoodOk('stone:cut'), campGoodOk('metal:iron')], [true, false, true, false]);
  assert.equal(professionOfFamily('works'), 'carpentry');
  assert.equal(specOk('carpentry', 100, 'siegewright'), true);
});

test('SEAT2b2 A REVOLT AS THE SEAT LAW NAMES IT: two hours in the holder\'s window (a crown\'s too), its block two hours, placed beside the holder\'s other battles; its announcement, and the Chronicle\'s three lines - 9.2\'s own sentence for one put down (mutants: the length; the window; the announcement; each line)', () => {
  assert.equal(BATTLE_LENGTH_MS.revolt, REVOLT.windowMs);
  assert.deepEqual(SIEGE_LENGTH_MS, BATTLE_LENGTH_MS, 'the relay\'s copy, pinned equal');
  assert.equal(battleLengthMs({ kind: 'revolt', tier: 'crown' }), 7200000);
  assert.equal(battleSpanMs({ kind: 'revolt', tier: 'crown' }), 7200000);
  const w = { day: 2, hour: 21 };
  assert.equal(battlePreferredMs(40, { kind: 'revolt', tier: 'crown', kingdom: 'daggerfall', window: w }), siegeStartMs(40, 2, 21), 'a crown\'s revolt keeps the holder\'s window, not the crown slot');
  const { placed } = placeBattles(40, [
    { key: 5, kind: 'revolt', tier: 'palace', attacker: null, defender: 'g1', window: w },
    { key: 9, kind: 'siege', tier: 'palace', attacker: 'g2', defender: 'g1', window: w },
  ]);
  assert.equal(placed[0].startsAt, siegeStartMs(40, 2, 21));
  assert.equal(placed[0].endsAt - placed[0].startsAt, 7200000);
  assert.equal(placed[1].moved, true, 'the holder fights no two at once');
  const at = Date.UTC(2026, 9, 7, 20);
  assert.equal(battleAnnouncement({ kind: 'revolt', startsAt: at, defenderGuild: { name: 'Ebon Oath', tag: 'EO' } }, 'Anticlere'),
    'Anticlere has risen against Ebon Oath <EO>. Its rebels hold the palace door; the Rebel Captain must fall by the window\'s end, or the Charter lapses. Battle is joined Wednesday at 20:00 UTC.');
  const seat = { key: 1, name: 'Anticlere', tier: 'palace' };
  const line = (kind) => chronicleLine({ kind, week: 5, data: { guild: { name: 'the Silver Hand', tag: 'SH' } } }, seat);
  assert.equal(line('revolt'), 'In week 5, Anticlere rose against the Silver Hand <SH>.');
  assert.equal(line('revolt-down'), 'In week 5, Anticlere rose against the Silver Hand <SH>. The rebel captain fell at the palace door, and the Charter held.');
  assert.equal(line('revolt-lapsed'), 'In week 5, Anticlere rose against the Silver Hand <SH>. The rebels held the palace door, and the Charter of Anticlere lapsed.');
});
