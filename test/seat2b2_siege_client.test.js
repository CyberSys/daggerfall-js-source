// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE SIEGE'S CLIENT HALF - the relay's works and
// figures folded (net/siegeLink.js; every frame one net/wire.js validSiegeOut admits) and said on the HUD (the Gatehouse
// and its breach, the standing Ram, the kits, the guards, the Throne behind a breach, a defender's wave by the Walls; a
// revolt's Captain, rebels, clock and card - ui/siegeHud.js), the figures and the works stood in the town (scenes/
// siegeFigures.js, over a fake renderer), struck as foes are - only at a relay that knows them and only on the right side
// (net/siegeSession.js, combat/siegeCombat.js), a revolt in the session, its receipt carried and its herald's line, and
// G21's castle door over the real layout path (systems/siegeField.js). The passes are the service's own (mintSiegeOrder
// over siegeWorksPass's works and the client's own field), the receipts the relay's signer's.
// bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7, 9.2, 19; `06-Systems/Online-Arc.md` SEAT2b (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { byClass } from './chargenDom.mjs';
import { validSiegeOut, relayKnowsWorks, RELAY_VERSION } from '../src/net/wire.js';
import { mintSiegeOrder, mintOrder } from '../src/net/identityToken.js';
import { siegeWorksPass, RAM_OFFSET_M } from '../src/net/fortLaw.js';
import { fieldOf, SIEGE_UNITS_PER_M } from '../src/net/siegeRef.js';
import { mintSiegeReceipt } from '../src/net/siegeReceipt.js';
import { battleAnnouncement, chronicleLine, seatWeekStartMs, seatWeekOf } from '../src/net/townSeatLaw.js';
import {
  foldSiege, SIEGE_STATE_EMPTY, readSiegePass, siegeWorksPoints, siegeStrikesAt, siegeClockText, siegeBarLines, siegeWorksLine,
  siegeSelfLines, revoltBarLines, revoltSidesLine, revoltClaimRefusal, REVOLT_CARD_WORDS, REVOLT_CLAIM_REFUSED, SIEGE_CARD_WORDS,
  siegeHudModel, siegeClaimRefusal, SIEGE_CLAIM_REFUSED,
} from '../src/net/siegeLink.js';
import { createSiegeSession, SIEGE_SESSION_TEXT } from '../src/net/siegeSession.js';
import { createSiegeClaims } from '../src/net/siegeClaims.js';
import { createSiegeHerald } from '../src/net/siegeHerald.js';
import { createSiegeHud } from '../src/ui/siegeHud.js';
import { siegeFieldOf, siegeFieldWire, castleFrameOf, SIEGE_FIELD } from '../src/systems/siegeField.js';
import { siegeSwingTarget, SIEGE_WORK_BODY_M } from '../src/combat/siegeCombat.js';
import {
  createSiegeFigures, figureMobile, figurePlace, figureFacing, siegeFigureName, vitalityBarArt, ramArt, barStep, BAR_STEPS, BAR_BROKEN,
  SIEGE_ART, SIEGE_WORK_DRAW, FIGURE_LEAD_MS, FIGURE_EASE_MS,
} from '../src/scenes/siegeFigures.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { dfMeshToModel, DOOR_TYPE, GLOBAL_SCALE } from '../src/world/meshReader.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { RMB_DIMENSION } from '../src/formats/blocksFile.js';
import { trs, multiply } from '../src/world/mat4.js';
import { localAabb, transformedAabb } from '../src/render/frustum.js';
import { doorCornersOf } from '../src/scenes/hallBanners.js';
import { palaceKeysOf, townCentreOf } from '../src/scenes/seatBanners.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';

const { subtle } = webcrypto;
const AT = 1_800_000_000_000;
const NOW_S = Math.floor(AT / 1000);
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
/** A frame the relay may send - asserted admitted by the client's own projection, which hands it on. */
const fr = (o) => { const g = validSiegeOut(o); assert.ok(g, `the relay's frame, admitted: ${JSON.stringify(o).slice(0, 90)}`); return g; };
/** The field this game derives from a town (systems/siegeField.js, SEAT2a's pins' town), as a pass carries it. */
const door = (a, b, box) => ({ door: { a, b }, box });
const FRAMES = new Map([['palace', door([-1, 0, 0], [1, 0, 0], [-10, 0, -20, 10, 10, 0])], ['temple', door([30, 0, -1], [30, 0, 1], [20, 0, -5, 30, 8, 5])]]);
const SF = (tier = 'palace') => siegeFieldWire(402, 151, siegeFieldOf({ frames: FRAMES, palaceKeys: ['palace'], templeKeys: ['temple'], gates: [{ box: [-1, 0, 299, 1, 6, 301] }], centre: [0, 50], tier }));
const KEYS = subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
/** The service's pass for this battle (mintSiegeOrder over siegeWorksPass's works) - its field the one it settled. */
async function passOf({ side = 'attack', kind = 'siege', tier = 'palace', sx = [0, 0, 0, 0, 0], sf = SF(tier) } = {}) {
  const kp = await KEYS;
  return mintSiegeOrder({ s: 'acct-me01', sk: 3021, sw: 20, sd: side, st: tier, sn: kind, sb: NOW_S, se: NOW_S + 7200, sf, sx }, kp.privateKey, { subtle, nowS: NOW_S });
}
/** A battle entered over a fake socket, on the service's pass - `relayV` the relay that welcomed the socket, `passSf` the
 *  field the service settled (this game sends its own, SF). */
async function sessionRig({ side = 'attack', kind = 'siege', tier = 'palace', sx = [0, 0, 0, 0, 0], relayV = RELAY_VERSION, claimsOf = null, passSf = undefined } = {}) {
  const pass = await passOf({ side, kind, tier, sx, sf: passSf ?? SF(tier) });
  const t = { now: AT, said: [], sent: [], hud: [], drawn: [], cleared: 0, relayV, pass };
  t.online = { id: 'me-00001', room: null, status: 'open', terminal: false, mintSiegePass: null, sendSiege: (f) => { t.sent.push(f); return true; } };
  const figures = { frame: (st, o) => t.drawn.push([st, o]), clear: () => { t.cleared++; } };
  t.claims = claimsOf ? claimsOf(t) : null;
  t.ses = createSiegeSession({ online: t.online, pass: async () => ({ ok: true, pass, side, week: 20, window: NOW_S + 7200 }), claims: t.claims, nowMs: () => t.now,
    hud: { update: (m) => t.hud.push(m), hide: () => t.hud.push('hidden') }, say: (x) => t.said.push(x), relayOk: () => true, worksOk: () => relayKnowsWorks(t.relayV), figures });
  t.ses.enter(ANTICLERE, { kind, tier, attackerGuild: kind === 'revolt' ? null : EO, defenderGuild: SH }, SF(tier));
  await settle();
  t.room = t.ses.room();
  t.online.room = t.room;
  return t;
}
const guardRows = () => [['~g1', 0, 13172736, 11403324, 13172736, 11403324, 350, 350, 0, 0], ['~g2', 0, 13172736, 11403400, 13172736, 11403400, 0, 350, 1, 0]];
const revoltRows = (capHp = 400, capDown = 0) => [['~c', 2, 0, 500, 0, 500, capHp, 400, capDown, 0],
  ...Array.from({ length: 12 }, (_, i) => [`~r${i + 1}`, 1, 100 * i, 0, 100 * i, 0, i < 3 ? 0 : 302, 302, i < 3 ? 1 : 0, 0])];

test('SEAT2b2 THE WORKS AND THE FIGURES FOLDED (frames net/wire.js validSiegeOut admits): `w` replaces the works, `n` every figure (its down a flag, its walk\'s clock `figuresAt`), a felled figure lies down until its next row and never joins the roll call, a fighter felled by a rebel is the roll call\'s (mutants: each fold)', () => {
  assert.equal(SIEGE_STATE_EMPTY.works, null, 'nothing heard: an older relay\'s battle says no works');
  let s = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'w', g: [14200, 20000], br: 0, r: [2100, 3000, 2, 7], rl: 1 }), AT);
  assert.deepEqual(s.works, { g: [14200, 20000], br: 0, r: [2100, 3000, 2, 7], rl: 1 });
  const rows = [['~g1', 0, 1000, 2000, 1400, 2000, 350, 350, 0, 1], ['~g2', 0, 3000, 2000, 3000, 2000, 0, 350, 1, 0], ['~r1', 1, 10, 20, 30, 40, 302, 302, 0, 2], ['~c', 2, 50, 60, 50, 60, 400, 400, 0, 0]];
  s = foldSiege(s, fr({ k: 'n', n: rows }), AT + 100);
  assert.deepEqual(s.figures[0], { id: '~g1', kind: 0, x: 1000, z: 2000, tx: 1400, tz: 2000, hp: 350, max: 350, down: false, act: 1 });
  assert.deepEqual(s.figures.map((f) => [f.id, f.down, f.act]), [['~g1', false, 1], ['~g2', true, 0], ['~r1', false, 2], ['~c', false, 0]]);
  assert.equal(s.figuresAt, AT + 100, 'the walk\'s clock: when the row was heard');
  s = foldSiege(s, fr({ k: 'st', f: [['peer-0001', 320, 320, 0, 1]] }), AT);
  s = foldSiege(s, fr({ k: 'fell', id: '~g1', by: 'peer-0001' }), AT + 200);
  assert.deepEqual([s.figures[0].down, s.figures[0].hp, s.figures[0].act], [true, 0, 0], 'down until its next row');
  assert.equal(s.figures[2].down, false, 'the rest stand');
  assert.deepEqual([s.roll['~g1'], s.fellAt['~g1']], [undefined, undefined], 'a figure is never a fighter of the roll call');
  s = foldSiege(s, fr({ k: 'fell', id: 'peer-0001', by: '~r1' }), AT + 300);
  assert.deepEqual([s.roll['peer-0001'].down, s.fellAt['peer-0001']], [true, AT + 300], 'a fighter felled by a rebel: the roll call\'s');
  s = foldSiege(s, fr({ k: 'n', n: [rows[3]] }), AT + 400);
  assert.deepEqual(s.figures.map((f) => f.id), ['~c'], 'each frame names every figure standing or down - the rest are gone');
  s = foldSiege(s, fr({ k: 'w', g: 0, br: 0, r: 0, rl: 0 }), AT + 500);
  assert.deepEqual(s.works, { g: 0, br: 0, r: 0, rl: 0 });
});

test('SEAT2b2 THE PASS READ, THE WORKS\' PLACES AND THE SIDE RULE: the service\'s pass read for its frozen works, its kind and its settled field (an unreadable token or another order: nothing); the Gatehouse at the Throne\'s point, a Ram RAM_OFFSET_M before it toward the attackers\' camp; the attackers strike the guards and the Gatehouse, the defenders the Ram, the rebels and their Captain, a spectator nothing (mutants: the order\'s kind; the token\'s shape; the Ram\'s offset and line; each side)', async () => {
  const sx = siegeWorksPass({ kind: 'siege', tier: 'palace', forts: { walls: 3, gatehouse: 1, barracks: 2 }, rams: 2, siegewright: true });
  const pass = await passOf({ sx });
  const c = readSiegePass(pass);
  assert.deepEqual([c.sx, c.sn, c.sd, c.st, c.sf], [[3, 30000, 4, 2, 4500], 'siege', 'attack', 'palace', SF()]);
  const kp = await KEYS;
  const mute = await mintOrder({ s: 'acct-me01', mu: 0 }, kp.privateKey, { subtle, nowS: NOW_S });
  const forged = `v1.${Buffer.from(JSON.stringify({ o: 'siege', sx: [9, 9, 9, 9, 9] })).toString('base64url')}.x`;
  for (const bad of [null, 7, 'v1.p.q', pass.split('.').slice(0, 2).join('.'), `${pass}.x`, `v1.${'A'.repeat(1100)}.x`, mute, forged]) assert.equal(readSiegePass(bad), null, String(bad).slice(0, 30));
  // where the works stand: the field's own arithmetic
  assert.deepEqual(siegeWorksPoints(fieldOf(SF(), 'palace')), { gate: [13172736, 11403324], ram: [13172736, 11403324 + RAM_OFFSET_M * SIEGE_UNITS_PER_M] });
  assert.deepEqual(siegeWorksPoints({ throne: [0, 0], camps: { attack: [-300, 400] } }).ram, [-96, 128], 'four metres along the line to the camp, whichever way it runs');
  assert.deepEqual(siegeWorksPoints({ throne: [5, 5], camps: { attack: [5, 5] } }), { gate: [5, 5], ram: [5, 5] }, 'a camp on the Throne: at the gate');
  assert.equal(siegeWorksPoints(null), null);
  // the side rule
  const ids = ['~gate', '~ram', '~g1', '~g6', '~r1', '~r12', '~c', 'peer-0001'];
  assert.deepEqual(ids.map((id) => siegeStrikesAt('attack', id)), [true, false, true, true, false, false, false, false]);
  assert.deepEqual(ids.map((id) => siegeStrikesAt('defend', id)), [false, true, false, false, true, true, true, false]);
  assert.deepEqual(ids.map((id) => siegeStrikesAt('watch', id)), ids.map(() => false));
});

test('SEAT2b2 THE BAR\'S WORKS (19\'s layout): the Gatehouse\'s vitality or BREACHED; the standing Ram - its vitality, the attackers at it, its swing to the next stroke, held while fewer than two crew it; the kits to come; the guards up and down; the Throne\'s rule "and the Gatehouse breached" where a gate stands, open only with its banners AND the breach; a defender\'s wave by the pass\'s Walls, an attacker\'s the base; the clock past an hour (mutants: each part; the gate\'s rule; the breach\'s; the wave\'s side; the hours)', () => {
  const crown = { seat: 'Wayrest', kind: 'siege', tier: 'crown', attacker: EO, defender: SH };
  let s = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'f', b: [[1, 0, 0], [1, 0, 0], [1, 0, 0], [2, 0, 0]], th: 90, s: AT, e: AT + 2_700_000, n: [3, 2, 0] }), AT);
  assert.ok(siegeBarLines(s, crown, AT)[1].endsWith('THRONE OPEN 50% (3 of 4)'), 'no works heard: an older relay\'s rule, the banners alone');
  assert.equal(siegeWorksLine(s), '');
  s = foldSiege(s, fr({ k: 'w', g: [14200, 20000], br: 0, r: [2100, 3000, 2, 7], rl: 2 }), AT);
  assert.ok(siegeBarLines(s, crown, AT)[1].endsWith('THRONE 50% (3 of 4 and the Gatehouse breached)'), 'three banners of four, the gate standing: shut');
  assert.equal(siegeWorksLine(s), 'GATEHOUSE 14,200 / 20,000    RAM 2,100 / 3,000 - 2 at it, a stroke in 3 s    2 Ram Kits to come');
  s = foldSiege(s, fr({ k: 'w', g: [0, 20000], br: 1, r: 0, rl: 1 }), AT);
  assert.ok(siegeBarLines(s, crown, AT)[1].endsWith('THRONE OPEN 50% (3 of 4 and the Gatehouse breached)'), 'breached: open');
  assert.equal(siegeWorksLine(s), 'GATEHOUSE BREACHED    1 Ram Kit to come');
  const two = foldSiege(s, fr({ k: 'f', b: [[1, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 2_700_000, n: [3, 2, 0] }), AT);
  assert.ok(siegeBarLines(two, crown, AT)[1].endsWith('THRONE 0% (3 of 4 and the Gatehouse breached)'), 'the breach alone opens nothing');
  s = foldSiege(s, fr({ k: 'w', g: [20000, 20000], br: 0, r: [3000, 3000, 1, 4], rl: 0 }), AT);
  assert.equal(siegeWorksLine(s), 'GATEHOUSE 20,000 / 20,000    RAM 3,000 / 3,000 - 1 at it, its swing held');
  s = foldSiege(s, fr({ k: 'n', n: [['~g1', 0, 0, 0, 0, 0, 350, 350, 0, 0], ['~g2', 0, 0, 0, 0, 0, 0, 350, 1, 0], ['~g3', 0, 0, 0, 0, 0, 120, 350, 0, 2]] }), AT);
  assert.equal(siegeWorksLine(s), 'GATEHOUSE 20,000 / 20,000    RAM 3,000 / 3,000 - 1 at it, its swing held    GUARDS 2 up / 1 down');
  assert.ok(siegeWorksLine(foldSiege(s, fr({ k: 'n', n: [['~g1', 0, 0, 0, 0, 0, 350, 350, 0, 0], ['~r1', 1, 0, 0, 0, 0, 302, 302, 0, 0]] }), AT)).endsWith('GUARDS 1 up / 0 down'), 'the guards alone counted');
  const palace = foldSiege(foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'f', b: [[1, 0, 0], [1, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 1_800_000, n: [1, 1, 0] }), AT), fr({ k: 'w', g: 0, br: 0, r: 0, rl: 0 }), AT);
  assert.ok(siegeBarLines(palace, { ...crown, tier: 'palace' }, AT)[1].endsWith('THRONE OPEN 0% (2 of 3)'), 'no Gatehouse: the banners alone');
  // a defender's wave by the Walls (fortLaw.js defendersWaveMs - 20 s, 17, 14, 11), an attacker's the base
  let d = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'st', f: [['me-00001', 320, 320, 0, 2], ['foe-0001', 320, 320, 0, 1]] }), AT);
  d = foldSiege(foldSiege(d, fr({ k: 'fell', id: 'me-00001', by: 'foe-0001' }), AT + 5000), fr({ k: 'fell', id: 'foe-0001', by: 'me-00001' }), AT + 5000);
  assert.deepEqual([0, 1, 2, 3].map((walls) => siegeSelfLines(d, 'me-00001', AT + 5000, { walls })[1]), ['next wave in 15 s', 'next wave in 13 s', 'next wave in 1 s', 'next wave in 10 s']);
  assert.equal(siegeSelfLines(d, 'foe-0001', AT + 5000, { walls: 3 })[1], 'next wave in 15 s', 'an attacker\'s wave is the base');
  assert.equal(siegeHudModel(d, { ...crown, tier: 'palace' }, 'me-00001', AT + 5000, { walls: 2 }).self[1], 'next wave in 1 s', 'the model hands the pass\'s Walls on');
  assert.deepEqual([siegeClockText(7_199_000), siegeClockText(3_600_000), siegeClockText(3_599_000), siegeClockText(61_001)], ['1:59:59', '1:00:00', '59:59', '1:02']);
  assert.equal(siegeHudModel(s, crown, 'me-00001', AT).works, siegeWorksLine(s), 'the model\'s works line');
});

test('SEAT2b2 A REVOLT\'S HUD AND CARD (7.7, 9.2, 19): no banners and no Throne - the seat against its holder, the clock past an hour, the Rebel Captain\'s vitality or his fall, the rebels standing of twelve (before they are named: where they wait), the holder\'s side alone; the card in its own words - put down, the Charter holds; the rebels hold, the Charter lapses - the Chronicle\'s line; its receipt carried, no Honours promised, a refusal in a revolt\'s words - and a void siege\'s claim in its own, never "could not be read" (mutants: the bar; the Captain; the count; the side; each title; the line; the honour; the button; each refusal; the void siege\'s)', () => {
  const battle = { seat: 'Anticlere', kind: 'revolt', tier: 'palace', region: 21, attacker: null, defender: SH };
  let s = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 7_200_000, n: [0, 3, 1] }), AT);
  s = foldSiege(s, fr({ k: 'st', f: [['me-00001', 320, 320, 0, 2], ['mate-001', 0, 330, 1, 2], ['mate-002', 300, 310, 0, 2], ['stray-001', 320, 320, 0, 1]] }), AT);
  assert.deepEqual(revoltBarLines(s, battle, AT + 1000), ['ANTICLERE   The Silver Hand <SH>   against the rebels   1:59:59', 'THE REBELS HOLD THE PALACE DOOR']);
  s = foldSiege(s, fr({ k: 'n', n: revoltRows() }), AT);
  assert.equal(revoltBarLines(s, battle, AT)[1], 'REBEL CAPTAIN 400 / 400    REBELS 9 of 12 standing');
  assert.equal(revoltBarLines(foldSiege(s, fr({ k: 'n', n: revoltRows(250) }), AT), battle, AT)[1], 'REBEL CAPTAIN 250 / 400    REBELS 9 of 12 standing');
  assert.equal(revoltBarLines(foldSiege(s, fr({ k: 'n', n: revoltRows(0, 1) }), AT), battle, AT)[1], 'THE REBEL CAPTAIN HAS FALLEN    REBELS 9 of 12 standing');
  assert.equal(revoltSidesLine(s, battle), 'SH  2 up / 1 down');
  const m = siegeHudModel(s, battle, 'me-00001', AT);
  assert.deepEqual([m.bar, m.works, m.sides, m.card], [revoltBarLines(s, battle, AT), '', 'SH  2 up / 1 down', null]);
  // put down: the Chronicle's own sentence, the receipt to carry
  const down = foldSiege(s, fr({ k: 'end', r: 'defend', a: 0, rc: 's1.x.y' }), AT + 2_000_000);
  const card = siegeHudModel(down, battle, 'me-00001', AT + 2_000_000, { claimable: true }).card;
  assert.deepEqual(card, { title: 'THE REVOLT AT ANTICLERE IS PUT DOWN - THE CHARTER HOLDS', line: 'Anticlere rose against the Silver Hand <SH>. The rebel captain fell at the palace door, and the Charter held.',
    honour: REVOLT_CARD_WORDS.kept, claim: true, button: SIEGE_CARD_WORDS.carry });
  assert.ok(chronicleLine({ kind: 'revolt-down', week: 7, data: { guild: SH } }, ANTICLERE).endsWith(card.line.slice(1)), 'the Chronicle\'s own words');
  // run out: the rebels hold, the Charter lapses (a crown's names its Crown Charter)
  const lapsed = foldSiege(s, fr({ k: 'end', r: 'attack', a: 0 }), AT + 7_200_000);
  const c2 = siegeHudModel(lapsed, { ...battle, seat: 'Wayrest', tier: 'crown', region: 23 }, 'me-00001', AT + 7_200_000, { honours: null }).card;
  assert.deepEqual([c2.title, c2.line, c2.honour, c2.claim], ['THE REBELS HOLD WAYREST - THE CHARTER LAPSES',
    'Wayrest rose against the Silver Hand <SH>. The rebels held the palace door, and the Crown Charter of Wayrest lapsed.', REVOLT_CARD_WORDS.carried, false]);
  assert.equal(siegeHudModel(down, battle, 'me-00001', AT, {}).card.honour, '', 'nothing kept, nothing said');
  assert.equal(siegeHudModel(down, battle, 'eye-0001', AT, { watching: true, claimable: true }).card.honour, '', 'a spectator carries nothing');
  // a carry refused for good, in a revolt's words - none speaks of Honours
  assert.deepEqual(['honours-twice', 'battle-none', 'battle-void', 'receipt', 'x'].map((error) => revoltClaimRefusal({ ok: false, error })),
    [REVOLT_CLAIM_REFUSED['honours-twice'], REVOLT_CLAIM_REFUSED['battle-none'], REVOLT_CLAIM_REFUSED['battle-none'], REVOLT_CLAIM_REFUSED.receipt, REVOLT_CLAIM_REFUSED.receipt]);
  assert.equal(siegeHudModel(down, battle, 'me-00001', AT, { honours: revoltClaimRefusal({ ok: false, error: 'honours-twice' }) }).card.honour, 'The revolt\'s end was carried already.');
  assert.doesNotMatch([...Object.values(REVOLT_CLAIM_REFUSED), REVOLT_CARD_WORDS.kept, REVOLT_CARD_WORDS.carried].join(' '), /Your Honour|claim it/);
  // a siege's card keeps its Claim
  const siegeEnd = foldSiege(foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 1_800_000, n: [1, 1, 0] }), AT), fr({ k: 'end', r: 'defend', a: 1, rc: 's1.x.y' }), AT);
  assert.equal(siegeHudModel(siegeEnd, { ...battle, kind: 'siege', attacker: EO }, 'me-00001', AT, { claimable: true }).card.button, SIEGE_CARD_WORDS.claim);
  assert.deepEqual({ ...SIEGE_CARD_WORDS }, { claim: 'Claim', carry: 'Carry' });
  // a siege its Turning voided: the service's `battle-void` (seatSiege.js claimSiege) said as the void it is
  assert.equal(siegeClaimRefusal({ ok: false, error: 'battle-void' }), 'No Honours this battle: the battle was void.');
  assert.equal(siegeHudModel(siegeEnd, { ...battle, kind: 'siege', attacker: EO }, 'me-00001', AT, { honours: siegeClaimRefusal({ ok: false, error: 'battle-void' }) }).card.honour, SIEGE_CLAIM_REFUSED['battle-none']);
});

test('SEAT2b2 THE READOUT: the works\' line the bar\'s third, written as it changes and shown only while it says something; the card\'s button in the model\'s words - a revolt\'s Carry, a siege\'s Claim; updated, never rebuilt (mutants: the works line; its hiding; the button\'s words)', () => {
  const hud = createSiegeHud(document, { onClaim: () => {} });
  const battle = { seat: 'Wayrest', kind: 'siege', tier: 'crown', attacker: EO, defender: SH };
  let s = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 2_700_000, n: [1, 1, 0] }), AT);
  hud.update(siegeHudModel(s, battle, 'me-00001', AT));
  const bar = byClass(hud.node, 'sg-bar')[0], works = byClass(hud.node, 'sg-works')[0];
  assert.equal(bar.children[2], works, 'the bar\'s third line');
  assert.equal(works.style.display, 'none', 'nothing to say: not shown');
  s = foldSiege(s, fr({ k: 'w', g: [9000, 20000], br: 0, r: 0, rl: 3 }), AT);
  hud.update(siegeHudModel(s, battle, 'me-00001', AT));
  assert.deepEqual([works.style.display, works.textContent], ['', 'GATEHOUSE 9,000 / 20,000    3 Ram Kits to come']);
  assert.equal(byClass(hud.node, 'sg-works')[0], works, 'updated, never rebuilt');
  const end = foldSiege(s, fr({ k: 'end', r: 'defend', a: 0, rc: 's1.x.y' }), AT);
  hud.update(siegeHudModel(end, { ...battle, kind: 'revolt', attacker: null }, 'me-00001', AT, { claimable: true }));
  const button = byClass(hud.node, 'sg-card')[0].querySelector('button');
  assert.deepEqual([button.textContent, button.style.display, works.style.display], ['Carry', '', 'none'], 'a revolt\'s receipt is carried; its bar names no works');
  hud.update(siegeHudModel(end, battle, 'me-00001', AT, { claimable: true }));
  assert.equal(button.textContent, 'Claim');
  hud.destroy();
});

test('SEAT2b2 STRUCK ONLY AT world144 AND ON THE RIGHT SIDE (the contract\'s item 3): at an older relay no figure and no work is a target (it closes the socket on one); the attackers strike a standing guard and the unbreached Gatehouse - a blow, a harmful cast at the guard, never a cast at the gate, never a heal at a figure; the defenders the Ram while it stands, never the gate or a guard; a spectator nothing (mutants: the relay\'s gate; the side rule; a guard down; the breach; the Ram\'s vitality; the cast at a work; the heal at a figure)', async () => {
  const t = await sessionRig({ side: 'attack', relayV: 'world143' });
  t.ses.onSiege(fr({ k: 'st', f: [['me-00001', 320, 320, 0, 1], ['foe-0001', 320, 320, 0, 2]] }), t.room);
  t.ses.onSiege(fr({ k: 'w', g: [20000, 20000], br: 0, r: [3000, 3000, 0, 0], rl: 1 }), t.room);
  t.ses.onSiege(fr({ k: 'n', n: guardRows() }), t.room);
  const blow = { w: 113, m: 3, d: 30, r: 0 };
  assert.deepEqual(['~gate', '~g1', 'foe-0001'].map((id) => t.ses.canStrike(id)), [false, false, true], 'an older relay: the fighters alone');
  assert.deepEqual([t.ses.blow('~gate', blow), t.ses.blow('~g1', blow), t.ses.cast('~g1', 20), t.ses.targets()], [false, false, false, []]);
  t.relayV = RELAY_VERSION;
  assert.deepEqual(t.ses.targets(), ['~g1', '~gate'], 'the guard standing and the gate whole - never the Ram, never a guard down');
  assert.deepEqual([t.ses.blow('~gate', blow), t.ses.blow('~g1', blow), t.ses.blow('~g2', blow), t.ses.blow('~ram', blow), t.ses.blow('foe-0001', blow)], [true, true, false, false, true]);
  assert.deepEqual([t.ses.cast('~g1', 20), t.ses.cast('~gate', 20), t.ses.cast('~g1', 20, true), t.ses.canCast('~gate'), t.ses.canCast('~g1')], [true, false, false, false, true]);
  assert.deepEqual(t.sent.filter((f) => f.k !== 'in'), [{ k: 'blow', to: '~gate', ...blow }, { k: 'blow', to: '~g1', ...blow }, { k: 'blow', to: 'foe-0001', ...blow }, { k: 'cast', to: '~g1', d: 20, h: 0 }]);
  t.ses.onSiege(fr({ k: 'w', g: [0, 20000], br: 1, r: 0, rl: 0 }), t.room);
  assert.equal(t.ses.canStrike('~gate'), false, 'breached: no target');
  t.ses.onSiege(fr({ k: 'w', g: [0, 20000], br: 0, r: 0, rl: 0 }), t.room);
  assert.equal(t.ses.canStrike('~gate'), false, 'a gate at nought is struck no more');
  // the defenders: the Ram
  const d = await sessionRig({ side: 'defend' });
  d.ses.onSiege(fr({ k: 'w', g: [20000, 20000], br: 0, r: [100, 3000, 2, 3], rl: 0 }), d.room);
  d.ses.onSiege(fr({ k: 'n', n: guardRows() }), d.room);
  assert.deepEqual(['~ram', '~gate', '~g1'].map((id) => d.ses.canStrike(id)), [true, false, false]);
  assert.deepEqual(d.ses.targets(), ['~ram']);
  d.ses.onSiege(fr({ k: 'w', g: [20000, 20000], br: 0, r: [0, 3000, 2, 3], rl: 0 }), d.room);
  assert.equal(d.ses.canStrike('~ram'), false, 'a Ram at nought is gone');
  // a spectator: nothing
  const e = await sessionRig({ side: 'watch' });
  e.ses.onSiege(fr({ k: 'w', g: [20000, 20000], br: 0, r: [100, 3000, 2, 3], rl: 0 }), e.room);
  e.ses.onSiege(fr({ k: 'n', n: guardRows() }), e.room);
  assert.deepEqual([e.ses.targets(), e.ses.canStrike('~g1'), e.ses.blow('~ram', blow), e.ses.cast('~g1', 5)], [[], false, false, false]);
  assert.deepEqual([relayKnowsWorks('world143'), relayKnowsWorks('world144'), RELAY_VERSION], [false, true, 'world144']);
});

test('SEAT2b2 THE REVOLT IN THE SESSION (7.7): its pass a siege\'s - the holder\'s side `defend`, a spectator `watch` - read for its kind; the holder\'s side told it musters at the camp outside the gate; its HUD a revolt\'s, its wave the defenders\' by its Walls; it strikes the rebels and their Captain; its receipt kept by the claims and carried, the card promising no Honours, a refusal in a revolt\'s words (mutants: the kind; the words; the HUD\'s kind; the refusal\'s words)', async () => {
  const kp = await KEYS;
  const answers = [];
  const t = await sessionRig({ side: 'defend', kind: 'revolt', sx: [2, 0, 0, 0, 0],
    claimsOf: (rig) => createSiegeClaims({ claim: async (r) => { answers.push(r); return { ok: true, result: 'defend', honours: null }; }, me: () => 'acct-me01', nowMs: () => rig.now, onClaimed: (a, r) => rig.ses.claimed(a, r) }) });
  assert.equal(t.said.at(-1), SIEGE_SESSION_TEXT.revolt('defend'));
  assert.match(t.said.at(-1), /Muster at the camp outside the gate/);
  t.ses.onSiege(fr({ k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 7_200_000, n: [0, 1, 0] }), t.room);
  t.ses.onSiege(fr({ k: 'st', f: [['me-00001', 320, 320, 0, 2]] }), t.room);
  t.ses.onSiege(fr({ k: 'n', n: revoltRows() }), t.room);
  assert.deepEqual(t.ses.targets(), ['~c', '~r4', '~r5', '~r6', '~r7', '~r8', '~r9', '~r10', '~r11', '~r12'], 'the Captain and the rebels standing');
  t.ses.tick();
  assert.equal(t.hud.at(-1).bar[1], 'REBEL CAPTAIN 400 / 400    REBELS 9 of 12 standing', 'a revolt\'s bar');
  t.ses.onSiege(fr({ k: 'fell', id: 'me-00001', by: '~c' }), t.room);
  t.ses.tick();
  assert.equal(t.hud.at(-1).self[1], `next wave in ${Math.ceil(((Math.floor(AT / 14000) + 1) * 14000 - AT) / 1000)} s`, 'the holder\'s side: the defenders\' wave, by the revolt\'s Walls (tier 2: 14 s)');
  // its end: the receipt the relay signed, kept and carried; the card promising no Honours
  const rc = await mintSiegeReceipt({ s: 'acct-me01', sk: 3021, sw: 20, sd: 'defend', r: 'defend', a: 0, h: 1 }, kp.privateKey, { subtle, nowS: NOW_S });
  t.ses.onSiege(fr({ k: 'end', r: 'defend', a: 0, rc }), t.room);
  await settle();
  assert.deepEqual([answers, t.claims.list()], [[rc], []], 'carried at once, and let go once the service took it');
  t.ses.tick();
  assert.deepEqual([t.hud.at(-1).card.title, t.hud.at(-1).card.honour, t.hud.at(-1).card.claim], ['THE REVOLT AT ANTICLERE IS PUT DOWN - THE CHARTER HOLDS', REVOLT_CARD_WORDS.carried, false]);
  t.ses.claimed({ ok: false, error: 'honours-twice' });
  t.ses.tick();
  assert.equal(t.hud.at(-1).card.honour, REVOLT_CLAIM_REFUSED['honours-twice'], 'a refusal in a revolt\'s words');
  // a spectator of a revolt
  const w = await sessionRig({ side: 'watch', kind: 'revolt' });
  assert.equal(w.said.at(-1), SIEGE_SESSION_TEXT.revolt('watch'));
  w.ses.onSiege(fr({ k: 'n', n: revoltRows() }), w.room);
  assert.deepEqual(w.ses.targets(), []);
  // a siege's words stand
  assert.equal((await sessionRig({ side: 'attack' })).said.at(-1), SIEGE_SESSION_TEXT.entered('attack'));
});

test('SEAT2b2 THE SESSION OWNS THE DRAWING (EVERY ALLOCATION HAS AN OWNER): each frame in the battle\'s room the figures and the works are drawn from its state at the works\' places its pass\'s field gives, on the relay\'s clock; out of the room, at a leave and at another entry they are cleared; the pass\'s kind, not the Seat tab\'s, chooses the HUD (mutants: the draw; each clear; the points; the kind)', async () => {
  // the service settled another field than this game derived (an attacker's and a defender's agreeing): the pass's is the room's
  const settled = siegeFieldWire(402, 152, siegeFieldOf({ frames: FRAMES, palaceKeys: ['palace'], templeKeys: ['temple'], gates: [{ box: [-1, 0, 299, 1, 6, 301] }], centre: [0, 50], tier: 'palace' }));
  const t = await sessionRig({ side: 'attack', passSf: settled });
  t.ses.tick();
  assert.equal(t.drawn.length, 1);
  assert.deepEqual(t.drawn[0][1], { points: { gate: [13172736, 11370556], ram: [13172736, 11370556 + RAM_OFFSET_M * SIEGE_UNITS_PER_M] }, now: AT });
  assert.equal(t.drawn[0][0], t.ses.state, 'the session\'s own state');
  const cleared = t.cleared;
  t.online.room = 'interior:3021:7';
  t.ses.tick();
  assert.deepEqual([t.drawn.length, t.cleared], [1, cleared + 1], 'a building\'s room: cleared, not drawn');
  t.online.room = t.room;
  t.ses.tick();
  assert.equal(t.drawn.length, 2, 'back in the street: drawn again');
  t.ses.leave();
  assert.equal(t.cleared, cleared + 2, 'the battle left: cleared');
  t.ses.enter(ANTICLERE, { kind: 'siege', tier: 'palace', attackerGuild: EO, defenderGuild: SH }, SF());
  assert.equal(t.cleared, cleared + 3, 'another entry: the last one\'s cleared');
  await settle();
  // the pass's kind chooses: a Seat tab that said siege, a pass that says revolt
  const r = await sessionRig({ side: 'defend', kind: 'revolt' });
  r.ses.enter(ANTICLERE, { kind: 'siege', tier: 'palace', attackerGuild: EO, defenderGuild: SH }, SF());
  await settle();
  r.online.room = r.ses.room();
  r.ses.tick();
  assert.match(r.hud.at(-1).bar[0], /against the rebels/);
  // an unreadable pass leaves the Seat tab's kind and this game's own field
  const said = [], drawn = [];
  const online = { id: 'me-00001', room: null, status: 'open', terminal: false, mintSiegePass: null, sendSiege: () => true };
  const ses = createSiegeSession({ online, pass: async () => ({ ok: true, pass: 'v1.p.q', side: 'attack', week: 20, window: NOW_S + 7200 }), nowMs: () => AT, say: (x) => said.push(x), relayOk: () => true,
    figures: { frame: (st, o) => drawn.push(o), clear() {} } });
  ses.enter(ANTICLERE, { kind: 'siege', tier: 'palace', attackerGuild: EO, defenderGuild: SH }, SF());
  await settle();
  online.room = ses.room();
  ses.tick();
  assert.deepEqual(drawn[0].points, siegeWorksPoints(fieldOf(SF(), 'palace')), 'this game\'s own field');
  assert.equal(said.at(-1), SIEGE_SESSION_TEXT.entered('attack'));
});

test('SEAT2b2 THE SWING\'S BODY (combat/siegeCombat.js): the nearest body whose middle - half its height up, the fallback\'s where it names none - the host\'s test admits; none admitted, none; a work\'s body the post it stands to (mutants: the nearest; the middle; the fallback; the work\'s posts)', () => {
  const eye = [0, 1.6, 0];
  const bodies = [{ id: 'far', feet: [0, 0, 3], height: 1.8 }, { id: 'near', feet: [0, 0, 1], height: 1.8 }, { id: '~gate', feet: [0, 0, 2], height: SIEGE_WORK_BODY_M.gate }];
  const asked = [];
  assert.equal(siegeSwingTarget(eye, bodies, (dist, c) => { asked.push(c); return dist <= 2.5; }), 'near');
  assert.deepEqual(asked, [[0, 0.9, 3], [0, 0.9, 1]], 'each middle half its height up - a farther one than the best never asked');
  assert.equal(siegeSwingTarget(eye, bodies, () => false), null);
  assert.equal(siegeSwingTarget(eye, [bodies[0], bodies[2]], () => true), '~gate', 'the nearer admitted');
  let got = null;
  siegeSwingTarget(eye, [{ id: 'x', feet: [0, 0, 1] }], (d, c) => { got = c; return true; }, 2);
  assert.deepEqual(got, [0, 1, 1], 'a body naming no height takes the fallback');
  assert.deepEqual({ ...SIEGE_WORK_BODY_M }, { gate: 3, ram: 2.2 });
});

/** A renderer that keeps what it is asked: batches made and freed, textures uploaded and released. */
function fakeRenderer() {
  const r = { textures: new Map(), made: [], freed: [], uploaded: [], released: [] };
  r.createBillboardBatch = (archive, record, size, centers) => { const b = { archive, record, size, centers, origin: null, frame: null, bounds: [0, 0, 0, 1] }; r.made.push(b); return b; };
  r.destroyBillboardBatch = (b) => { r.freed.push(b); };
  r.uploadTexture = (archive, record, c32) => { r.textures.set(`${archive}_${record}`, c32); r.uploaded.push([archive, record]); return {}; };
  r.releaseTexture = (archive, record) => { r.textures.delete(`${archive}_${record}`); r.released.push([archive, record]); return true; };
  return r;
}
/** A sprite archive as the host's door hands it (a TextureFile's surface). */
const sprite = () => ({ recordCount: 30, getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) });
/** The drawing over the fake renderer: natives to metres, the ground 10 m up (none built west of -500 m). */
function figuresRig() {
  const r = fakeRenderer(), asked = [];
  const figs = createSiegeFigures({ renderer: r, getTexture: (a) => { asked.push(a); return sprite(); }, uploadRecordFrame: (a, rec, f) => r.textures.set(`${a}_${rec}#${f}`, {}),
    toScene: (x, z) => [x / 40, z / 40], groundAt: (x) => (x < -500 ? -Infinity : 10), eye: () => [0, 1.6, -100], rolls: () => 0.5 });
  return { r, figs, asked };
}
const recOf = (b) => Number(String(b.record).split('#')[0]);

test('SEAT2b2 THE FIGURES STOOD IN THE TOWN (scenes/siegeFigures.js; DECIDED looks, Ledger A): a guard the City Watch, a rebel a Rogue (odd) or a Thief (even), the Captain a Warrior, each its own DFU sprite on the town\'s ground - walking at its kind\'s speed from its row toward where it walks (never past its reach, never far past its row), striking on the attack frames, flinching at a blow, down as its corpse until its row rises; a row gone, its batch freed; over ground not built, neither drawn nor struck; once a frame; cleared whole (mutants: each look; the walk; the lead; the reach; the facing; the ease; the strike; the flinch; the corpse; the rise; the drop; the ground; the latch; the clear)', async () => {
  assert.deepEqual(['~g1', '~g6', '~r1', '~r2', '~r11', '~r12', '~c', 'peer-0001', '~gate'].map(figureMobile), [146, 146, 136, 138, 136, 138, 144, null, null]);
  assert.deepEqual(['~g3', '~r7', '~c', 'peer-0001', '~gate'].map(siegeFigureName), ['a town guard', 'a rebel', 'the Rebel Captain', null, null]);
  // the walk (the room's units; a guard 5 m/s, a rebel 4.5, each 2.5 m reach)
  const walker = { id: '~g1', kind: 0, x: 0, z: 0, tx: 4000, tz: 0, hp: 350, max: 350, down: false, act: 1 };
  assert.deepEqual(figurePlace(walker, AT, AT), [0, 0]);
  assert.deepEqual(figurePlace(walker, AT, AT + 500), [100, 0], 'a guard\'s 5 m/s: 2.5 m in half a second');
  assert.deepEqual(figurePlace(walker, AT, AT + 5000), [200, 0], `never more than FIGURE_LEAD_MS (${FIGURE_LEAD_MS} ms) past its row`);
  assert.deepEqual(figurePlace({ ...walker, tx: 250 }, AT, AT + 1000), [150, 0], 'its reach short of where it walks');
  assert.deepEqual(figurePlace({ ...walker, tx: 80 }, AT, AT + 1000), [0, 0], 'within reach already: it stands');
  assert.deepEqual(figurePlace({ ...walker, kind: 1, id: '~r1' }, AT, AT + 500), [90, 0], 'a rebel\'s 4.5 m/s');
  assert.deepEqual(figurePlace({ ...walker, tx: 3000, tz: 4000 }, AT, AT + 500), [60, 80]);
  assert.deepEqual([figurePlace({ ...walker, act: 2 }, AT, AT + 500), figurePlace({ ...walker, down: true }, AT, AT + 500)], [[0, 0], [0, 0]], 'a striker and a felled one stay');
  assert.equal(figureFacing(walker, 1), Math.PI / 2);
  assert.equal(figureFacing({ ...walker, tx: 0, tz: -10 }, 0), Math.PI);
  assert.deepEqual([figureFacing({ ...walker, tx: 0, tz: 0 }, 1.25), figureFacing({ ...walker, down: true }, 1.25)], [1.25, 1.25], 'nowhere to face, or down: as it was');
  // stood
  const { r, figs, asked } = figuresRig();
  const rows = [['~g1', 0, 0, 0, 4000, 0, 350, 350, 0, 1], ['~r1', 1, 4000, 0, 4000, 0, 302, 302, 0, 0], ['~r2', 1, 8000, 0, 8040, 0, 302, 302, 0, 2], ['~c', 2, 12000, 0, 12000, 0, 0, 400, 1, 0]];
  let s = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'n', n: rows }), AT);
  figs.frame(s, { now: AT });
  assert.deepEqual(figs.batches(), [], 'the art still loading: nothing stood yet');
  await settle(); figs.frame(s, { now: AT }); await settle(); figs.frame(s, { now: AT });
  let bs = figs.batches();
  assert.deepEqual(bs.map((b) => b.archive), [ENEMY_BASICS[146].maleTexture, ENEMY_BASICS[136].maleTexture, ENEMY_BASICS[138].maleTexture, ENEMY_BASICS[144].corpseTexture.archive]);
  assert.deepEqual(figs.batches(), [], 'once a frame: a frame not drawn hands back none');
  assert.deepEqual(bs.map((b) => [...b.origin]), [[0, 10, 0], [100, 10, 0], [200, 10, 0], [300, 10, 0]], 'where the rows stand, on the town\'s ground');
  assert.ok(MOVE_RECS.includes(recOf(bs[0])) && IDLE_RECS.includes(recOf(bs[1])) && ATTACK_RECS.includes(recOf(bs[2])), `walking, standing, striking: ${bs.map((b) => b.record)}`);
  assert.equal(bs[3].record, `${ENEMY_BASICS[144].corpseTexture.record}#0`, 'the Captain down: his corpse');
  assert.deepEqual(figs.targets().map((b) => [b.id, b.feet, b.height > 0]), [['~g1', [0, 10, 0], true], ['~r1', [100, 10, 0], true], ['~r2', [200, 10, 0], true]], 'the standing struck - never the felled');
  assert.ok(asked.includes(ENEMY_BASICS[144].maleTexture) && asked.includes(ENEMY_BASICS[144].corpseTexture.archive));
  // walking on: eased toward its place (FIGURE_EASE_MS), the striker swinging, a blow flinching the standing one
  figs.frame(s, { now: AT + 250 });
  bs = figs.batches();
  assert.ok(Math.abs(bs[0].origin[0] - (50 * (1 - Math.exp(-250 / FIGURE_EASE_MS))) / 40) < 1e-9, `eased toward its walk: ${bs[0].origin[0]}`);
  s = foldSiege(s, fr({ k: 'n', n: [rows[0], ['~r1', 1, 4000, 0, 4000, 0, 200, 302, 0, 0], rows[2], rows[3]] }), AT + 250);
  figs.frame(s, { now: AT + 300 });
  bs = figs.batches();
  assert.ok(HURT_RECS.includes(recOf(bs[1])), `a blow taken: it flinches (${bs[1].record})`);
  // the Captain rises at his post, far off: snapped there, himself again
  s = foldSiege(s, fr({ k: 'n', n: [rows[0], rows[1], rows[2], ['~c', 2, -8000, 0, -8000, 0, 400, 400, 0, 0]] }), AT + 400);
  figs.frame(s, { now: AT + 400 });
  bs = figs.batches();
  assert.deepEqual([bs[3].archive, bs[3].origin[0]], [ENEMY_BASICS[144].maleTexture, -200], 'risen: his sprite, at his post');
  assert.ok(bs.every((b) => b.bounds[3] === Math.hypot(b.size.w, b.size.h) / 2), 'each cull sphere follows its picture (his corpse\'s was another)');
  assert.equal(figs.targets().length, 4);
  // a row gone: its batch freed; over ground not built: neither drawn nor struck
  const made = r.made.length;
  s = foldSiege(s, fr({ k: 'n', n: [rows[0], ['~r1', 1, -40000, 0, -40000, 0, 302, 302, 0, 0]] }), AT + 500);
  figs.frame(s, { now: AT + 500 });
  bs = figs.batches();
  assert.equal(figs.size, 2, 'two rows: two figures');
  assert.deepEqual(bs.map((b) => b.archive), [ENEMY_BASICS[146].maleTexture], 'the one over unbuilt ground not drawn');
  assert.deepEqual(figs.targets().map((b) => b.id), ['~g1']);
  assert.equal(r.freed.length, 3, 'the two rows gone and the one over unbuilt ground, freed');
  assert.equal(r.made.length, made, 'nothing made');
  // cleared whole
  figs.clear();
  assert.deepEqual([figs.size, figs.batches(), figs.targets()], [0, [], []]);
  assert.ok(r.made.every((b) => r.freed.includes(b)), 'every batch made, freed');
});
const MOVE_RECS = [0, 1, 2, 3, 4], ATTACK_RECS = [5, 6, 7, 8, 9], HURT_RECS = [10, 11, 12, 13, 14], IDLE_RECS = [15, 16, 17, 18, 19];

test('SEAT2b2 THE WORKS DRAWN (the port\'s own art, painted at runtime): the Gatehouse\'s vitality a bar over the Throne\'s point, a step of BAR_STEPS, broken once BREACHED; the Ram an engine at its point facing the gate (DFU\'s side-record flip), its bar over it; a work struck while it stands; each picture painted once and every one released at the clear (mutants: the bar\'s steps; the breach; the rise; the Ram\'s place and facing; the bodies; the art; the release)', () => {
  assert.deepEqual([barStep(0), barStep(0.5), barStep(1), barStep(0.001), barStep(2), barStep(-1)], [0, 16, 32, 1, 32, 0]);
  assert.equal(BAR_STEPS, 32);
  const px = (c32, x, y) => { const o = ((c32.height - 1 - y) * c32.width + x) * 4; return [...c32.colors.slice(o, o + 4)]; };   // top-down (x, y) in the upload's order
  const red = (c32) => { let n = 0; for (let i = 0; i < c32.colors.length; i += 4) if (c32.colors[i] > 150 && c32.colors[i + 1] < 90) n++; return n; };
  assert.deepEqual([red(vitalityBarArt(0)), red(vitalityBarArt(16)), red(vitalityBarArt(32))], [0, 31 * 6, 62 * 6], 'the share in red, row by row inside the frame');
  const broken = vitalityBarArt(0, true);
  assert.equal([...broken.colors].filter((v, i) => i % 4 === 3 && v === 0).length, 24, 'the crack, clear');
  assert.deepEqual([px(broken, 0, 0), px(vitalityBarArt(16), 1, 1), px(vitalityBarArt(16), 40, 4)], [[220, 190, 120, 255], [226, 74, 52, 255], [24, 18, 14, 255]], 'its brass frame, its lit top, the rest dark');
  const ram = ramArt();
  assert.deepEqual([ram.width, ram.height, px(ram, 2, 18), px(ram, 62, 18)[3], px(ram, 16, 33)], [64, 40, [118, 118, 126, 255], 0, [44, 32, 22, 255]], 'its iron head to the left, nothing past its log\'s end, a wheel\'s hub');
  // drawn
  const { r, figs } = figuresRig();
  const points = siegeWorksPoints({ throne: [4000, 4000], camps: { attack: [4000, 8000] } });
  let s = foldSiege(SIEGE_STATE_EMPTY, fr({ k: 'w', g: [10000, 20000], br: 0, r: [1500, 3000, 2, 3], rl: 1 }), AT);
  figs.frame(s, { points, now: AT });
  let bs = figs.batches();
  assert.deepEqual(bs.map((b) => [b.archive, b.record]), [[SIEGE_ART.bar, 16], [SIEGE_ART.ram, 0], [SIEGE_ART.bar, 16]]);
  assert.deepEqual(bs.map((b) => [...b.origin]), [[100, 10 + SIEGE_WORK_DRAW.gateBar.rise, 100], [100, 10, 104], [100, 10 + SIEGE_WORK_DRAW.ramBar.rise, 104]]);
  assert.deepEqual(figs.works().map((b) => [b.id, b.feet, b.height]), [['~gate', [100, 10, 100], 3], ['~ram', [100, 10, 104], 2.2]]);
  assert.deepEqual(r.uploaded, [[SIEGE_ART.bar, 16], [SIEGE_ART.ram, 0]], 'each picture painted once, the two bars sharing a step');
  assert.deepEqual([bs[0].size, bs[2].size], [SIEGE_WORK_DRAW.gateBar, SIEGE_WORK_DRAW.ramBar]);
  // the Ram faces the gate: seen from either side, mirrored as DFU mirrors a side record
  const side = (eyeX) => { const q = createSiegeFigures({ renderer: fakeRenderer(), toScene: (x, z) => [x / 40, z / 40], groundAt: () => 10, eye: () => [eyeX, 1.6, 104] }); q.frame(s, { points, now: AT }); return q.batches()[1].size.w; };
  assert.deepEqual([Math.sign(side(110)), Math.sign(side(90))], [1, -1], 'its head to the gate whichever side it is seen from: from the east the gate (south) is to the left, as drawn; from the west, mirrored');
  // breached: the broken bar, no target; the Ram gone, its batches freed
  s = foldSiege(s, fr({ k: 'w', g: [0, 20000], br: 1, r: 0, rl: 0 }), AT);
  figs.frame(s, { points, now: AT });
  bs = figs.batches();
  assert.deepEqual(bs.map((b) => b.record), [BAR_BROKEN]);
  assert.deepEqual(figs.works(), [], 'nothing to strike');
  assert.equal(r.freed.length, 2, 'the Ram and its bar, freed');
  // a whole Gatehouse at nought before its breach is said: drawn, never struck
  figs.frame(foldSiege(s, fr({ k: 'w', g: [0, 20000], br: 0, r: [0, 3000, 0, 0], rl: 0 }), AT), { points, now: AT });
  assert.deepEqual(figs.works(), []);
  // no works heard, or no field: none drawn
  figs.frame(foldSiege(s, fr({ k: 'w', g: 0, br: 0, r: 0, rl: 0 }), AT), { points, now: AT });
  assert.deepEqual(figs.batches(), []);
  figs.frame(s, { points: null, now: AT });
  assert.deepEqual(figs.batches(), []);
  figs.frame(foldSiege(s, fr({ k: 'w', g: [5000, 20000], br: 0, r: [100, 3000, 2, 3], rl: 0 }), AT), { points, now: AT });
  assert.equal(figs.batches().length, 3, 'standing as the battle is left');
  figs.clear();
  assert.deepEqual(r.released.map(([a, rec]) => `${a}_${rec}`).sort(), r.uploaded.map(([a, rec]) => `${a}_${rec}`).sort(), 'every picture painted, released');
  assert.ok(r.made.every((b) => r.freed.includes(b)));
});

test('SEAT2b2 THE HERALD\'S REVOLT: a revolt the seats\' list names (its holder `against`, no challenger) announced in red in its own words - battleAnnouncement\'s revolt arm - at the Turning and at its marks after (mutants: the herald reads the revolt\'s holder)', () => {
  const week = seatWeekOf(AT);
  const startS = Math.floor(seatWeekStartMs(week) / 1000) + 3 * 86400;
  const list = [{ key: 3021, battle: { kind: 'revolt', guild: null, against: SH, startsAt: startS, endsAt: startS + 7200, moved: false, state: 'scheduled' } }];
  const said = [];
  let now = seatWeekStartMs(week) + 1000;
  const h = createSiegeHerald({ seats: () => list, fightOf: async () => null, nameOf: (k) => (k === 3021 ? 'Anticlere' : null), say: (text, at) => { said.push([text, at]); return true; }, nowMs: () => now });
  h.tick();
  const line = battleAnnouncement({ kind: 'revolt', startsAt: startS * 1000, moved: false, defenderGuild: SH }, 'Anticlere');
  assert.deepEqual(said, [[line, seatWeekStartMs(week)]]);
  assert.match(line, /^Anticlere has risen against the Silver Hand <SH>\. Its rebels hold the palace door/);
  now = startS * 1000 - 3_600_000 + 1;
  h.tick();
  assert.deepEqual(said.at(-1), [line, startS * 1000 - 3_600_000], 'an hour before');
});

test('SEAT2b2 G21\'S CASTLE DOOR OVER THE REAL LAYOUT PATH (6.2: "the Gatehouse stands at the castle\'s entrance in the city"): a crown city block of the producers\' own - a palace with its building door and the castle\'s entrance with its dungeon door (DFU\'s LoadVertices reads archive 56 as one), laid out by the real layout and measured as scenes/world.js\'s build measures them - stands a crown\'s Throne, defenders\' camp and Palace square before the castle\'s entrance, a palace seat\'s before its palace door; a model with no dungeon door gives none (mutants: the door\'s type; the corners; the box; the first)', () => {
  const S = GLOBAL_SCALE;
  const quad = (archive, pts) => ({ textureArchive: archive, textureRecord: 1, totalTriangles: 2, planes: [{ points: pts.map(([x, y, z]) => ({ x, y, z, nx: 0, ny: 0, nz: -1, u: 0, v: 0 })) }] });
  // a model of the producer's own (world/meshReader.js dfMeshToModel): a back wall ten metres deep, its door on the front face
  const model = (doorArchive) => dfMeshToModel({ totalVertices: 8, totalTriangles: 4, subMeshes: [quad(300, [[-200, 0, 400], [200, 0, 400], [200, -400, 400], [-200, -400, 400]]), quad(doorArchive, [[-40, 0, 0], [40, 0, 0], [40, -120, 0], [-40, -120, 0]])] }, () => ({ width: 64, height: 64 }));
  const cpus = new Map([[9001, model(74)], [9002, model(56)], [9003, dfMeshToModel({ totalVertices: 4, totalTriangles: 2, subMeshes: [quad(300, [[0, 0, 0], [80, 0, 0], [80, -80, 0], [0, -80, 0]])] }, () => ({ width: 64, height: 64 }))]]);
  assert.deepEqual([cpus.get(9001).doors.map((d) => d.type), cpus.get(9002).doors.map((d) => d.type), cpus.get(9003).doors], [[DOOR_TYPE.BUILDING], [DOOR_TYPE.DUNGEON_ENTRANCE], []]);
  const obj = (id) => ({ modelId: String(id), modelIdNum: id, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 });
  const block = { index: 0, name: 'SEATCAST.RMB', rmbBlock: {
    subRecords: [{ xPos: 1000, zPos: 3000, yRotation: 0, exterior: { block3dObjectRecords: [obj(9001)] } }, { xPos: 2000, zPos: 2000, yRotation: 0, exterior: { block3dObjectRecords: [obj(9003)] } },
      { xPos: 3000, zPos: 1000, yRotation: 0, exterior: { block3dObjectRecords: [obj(9002)] } }],
    misc3dObjectRecords: [], fldHeader: { buildingDataList: [{ buildingType: 16 }, { buildingType: 1 }, { buildingType: 1 }],
      groundData: { groundTiles: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2, isRotated: false, isFlipped: false }))) } } } };
  const loc = layoutLocation({ exterior: { exteriorData: { width: 1, height: 1, blockNames: [block.name] } }, mapTableData: { locationType: 0, mapId: 5023 }, climate: { groundArchive: 302 } },
    { getRmbBlockName: () => block.name }, { checkName: (n) => n, getBlockByName: () => block });
  // scenes/world.js buildPixel, its lines transcribed: each placed model's matrix and box, a building's frame and first door, the castle's
  const locLocal = [100, 40, 200];
  const frames = new Map();
  let castle = null;
  for (const b of loc.blocks) {
    const originMatrix = trs(locLocal[0] + b.originX, locLocal[1], locLocal[2] + b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const cpu = cpus.get(placed.modelIdNum);
      const local = multiply(originMatrix, placed.matrix);
      const box = transformedAabb(localAabb(cpu.positions), local);
      const homeKey = makeBuildingKey(b.x, b.y, placed.recordIndex);
      if (!frames.has(homeKey)) frames.set(homeKey, { at: [locLocal[0] + b.originX + placed.recordAt[0], locLocal[1] + placed.recordAt[1], locLocal[2] + b.originZ + placed.recordAt[2]], box: [...box] });
      const hf = frames.get(homeKey);
      if (cpu.doors && cpu.doors.length) {
        if (hf && !hf.door) hf.door = doorCornersOf(cpu.doors[0], local);
        if (!castle) castle = castleFrameOf(cpu.doors, local, box);
      }
    }
  }
  const castleZ = locLocal[2] + (RMB_DIMENSION - 1000) * S, castleX = locLocal[0] + 3000 * S;
  // to the millimetre: the layout's matrices are single floats (world/mat4.js)
  assert.ok(castle && Math.abs((castle.door.a[0] + castle.door.b[0]) / 2 - castleX) < 1e-3 && Math.abs(castle.door.a[2] - castleZ) < 1e-3, `the castle's door where its block stands it: ${JSON.stringify(castle?.door)}`);
  const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-3;
  const base = { frames, palaceKeys: palaceKeysOf(loc.blocks, makeBuildingKey), centre: townCentreOf(frames) };
  const crown = siegeFieldOf({ ...base, tier: 'crown', castle });
  assert.ok(near(crown.throne, [castleX, castleZ - SIEGE_FIELD.thronePaceM]), `the Throne a pace before the castle's entrance: ${crown.throne}`);
  assert.ok(near(crown.camps.defend, [castleX, castleZ - SIEGE_FIELD.defendCampM]) && near(crown.banners[3], [castleX, castleZ - SIEGE_FIELD.squareM]), 'its camp and its Palace square before it');
  const palaceZ = locLocal[2] + (RMB_DIMENSION - 3000) * S, palaceX = locLocal[0] + 1000 * S;
  assert.ok(near(siegeFieldOf({ ...base, tier: 'palace', castle }).throne, [palaceX, palaceZ - SIEGE_FIELD.thronePaceM]), 'a palace seat\'s Throne at its palace door');
  assert.equal(siegeFieldWire(590, 166, crown).length, 7, 'a crown\'s pass carries it');
  // a model with no dungeon door gives none; the box is the frame's own copy
  assert.equal(castleFrameOf(cpus.get(9001).doors, trs(0, 0, 0, 0, 0, 0), [0, 0, 0, 1, 1, 1]), null, 'a palace\'s building door is no castle\'s');
  assert.equal(castleFrameOf([], trs(0, 0, 0, 0, 0, 0), [0, 0, 0, 1, 1, 1]), null);
  assert.equal(castleFrameOf(cpus.get(9002).doors, trs(0, 0, 0, 0, 0, 0), [0, 0, 0]), null, 'no box, no frame');
  const twoDoors = dfMeshToModel({ totalVertices: 8, totalTriangles: 4, subMeshes: [quad(56, [[-40, 0, 0], [40, 0, 0], [40, -120, 0], [-40, -120, 0]]), quad(56, [[200, 0, 0], [280, 0, 0], [280, -120, 0], [200, -120, 0]])] }, () => ({ width: 64, height: 64 })).doors;
  const box = [0, 0, 0, 1, 1, 1], frame = castleFrameOf([...cpus.get(9001).doors, ...twoDoors], trs(0, 0, 0, 0, 0, 0), box);
  box[0] = 99;
  assert.deepEqual([frame.box[0], frame.door.a, frame.door.b], [0, [-40 * S, 0, 0], [40 * S, 120 * S, 0]], 'the first dungeon door of two, through its matrix; the box copied');
});

test('SEAT2b2 THE WORLD\'S WIRING by source (the four hosts: scenes/world.js wired; exterior.js, worldModes.js and dungeonContext.js host no siege - Seats-Arc 15.1): the figures made with the session and passed to it, struck only at a relay that knows them; the swing\'s bodies, the arrows\' and the cast engine\'s - a siege\'s figures and works, never a work for a spell, named; a blow and a spell through the session\'s side rule; drawn on the exterior\'s flats axis; G21\'s castle door in the build and the field (mutants: each wire)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /siegeFigures = createSiegeFigures\(\{ renderer, getTexture, uploadRecordFrame, toScene: \(x, z\) => state\.localFromWorld\(x, z\), groundAt: \(x, z\) => heightAt\(x, z\), eye: \(\) => cam\.pos \}\);/);
  assert.match(w, /worksOk: \(\) => online\.worksOk === true, figures: siegeFigures, relayOk: \(\) => online\.siegeOk,/);
  assert.match(w, /if \(battle === siegeSession && siegeFigures\) \{\n\s*for \(const b of siegeFigures\.targets\(\)\) if \(siegeSession\.canStrike\(b\.id\)\) out\.push\(b\);\n\s*if \(!spell\) for \(const b of siegeFigures\.works\(\)\) if \(siegeSession\.canStrike\(b\.id\)\) out\.push\(b\);/);
  assert.match(w, /const bodies = battleFoeBodies\(siegeSession, true\);/);
  assert.match(w, /name: peerName\(b\.id\) \?\? siegeFigureName\(b\.id\) \?\? 'a foe'/);
  assert.match(w, /if \(!siegeSession\?\.canCast\(peerId\)\) return false;/);
  assert.match(w, /if \(!to \|\| !battle\?\.active\(\) \|\| !\(battle\.canStrike \? battle\.canStrike\(to\) : battle\.foes\(\)\.includes\(to\)\)\) return false;/);
  assert.match(w, /const bodies = battleFoeBodies\(battle\);\n\s*if \(!bodies\.length\) return false;\n\s*const best = siegeSwingTarget\(eye, bodies, \(dist, c\) => \{/);
  assert.match(w, /return playerMeleeCanHit\(dist, !!inViewFn\?\.\(c\), !Number\.isFinite\(wall\) \|\| wall >= dist - 1e-3\);\n\s*\}, CAPSULE_HEIGHT\);\n\s*if \(!best\) return false;\n\s*siegeStrikeOut\(best, 'melee'/);
  assert.match(w, /if \(siegeFigures && _mode\(\) === 'exterior'\) livePersonBatches\.push\(\.\.\.siegeFigures\.batches\(\)\);/);
  assert.match(w, /if \(!pixelCastle\) pixelCastle = castleFrameOf\(cpu\.doors, local, box\);/);
  assert.match(w, /\n\s*castle: pixelCastle,/);
  for (const f of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(rd(f), /createSiegeFigures|createSiegeSession|castleFrameOf/, `${f} hosts no siege`);
});

test('SEAT2b2 THE SOCKET KNOWS THE WORKS: the battle socket\'s `worksOk` true only where the welcoming relay is world144 or later - a relay that fights sieges but not their works keeps it false, so nothing is struck there (mutants: the welcome never asked; the floor)', async () => {
  const { OnlineSession } = await import('../src/net/online.js');
  const { siegeRoomKey } = await import('../src/net/siegeRef.js');
  const AT = 1_800_000_000_000;
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() {}
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
  }
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'shh-shh-shh-0001', WebSocketImpl: FakeWS, now: () => AT });
  o.mintSiegePass = async (room) => `v1.siege.${room.length}`;
  assert.equal(o.worksOk, false, 'nothing known before a welcome');
  o.join(siegeRoomKey(5023, 20), { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  const ws = sockets.at(-1);
  ws.open(); await settle();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null, now: AT, v: 'world143' });
  assert.deepEqual([o.siegeOk, o.worksOk], [true, false], 'a relay that fights sieges but not their works');
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], host: 'mac-0001', world: null, now: AT, v: 'world144' });
  assert.equal(o.worksOk, true);
  assert.equal(relayKnowsWorks('world144'), true);
});
