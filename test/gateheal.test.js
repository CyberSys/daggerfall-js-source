// GATE-HEAL (2026-10-01, Mac: "Can we add a line on the damage round up showing the amount healed?" - asked which healing,
// he chose each challenger's): HEALING ON THE ROUND-UP. Each fighter's game says what healed it and by whom (itself, or
// the mate whose spell it was); the relay believes it within the receiver's own heal bucket and credits the HEALER; the
// kill's chart carries each healer's figure, and the round-up shows a Healed column whenever anyone healed.
//
//   the brain     net/gateBrain.js applyHeal, healRef, the bucket; damageChart's `hl`
//   the wire      `heal` ([[by, n], ...] - '' myself, else the caster's peer id); a chart row's `hl`; the relay's door
//   the relay     a heal credited to the caster by the peer id its socket says, or to the one healed
//   the session   no `heal` to a relay that would junk it
//   the court     scenes/gateCourt.js - the health watch, a mate's heal by its own door, the word out
//   the chart     ui/gateDamageChart.js - the Healed column, wide and narrow
//   the plumbing  scenes/world.js - the ally-cast door tells the court; the court's word goes out as `heal`
//
// Design: bible/11-Multiplayer/World-Bosses.md section 18.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COURTS, COURT_CENTRE, HIT_KINDS, HEAL_REF_BASE, HEAL_REF_LV, HEAL_REFILL_S, HEAL_DEPTH_X, healRef,
  newFight, joinFight, applyHeal, applyHit, damageChart, stateOf, dpsRef,
} from '../src/net/gateBrain.js';
import { validGateIn, validGateOut, GATE_KINDS, GATE_HEAL_ROWS_MAX, GATE_HEAL_WIRE_MAX, GATE_HEAL_RELAY_MIN, relaySupportsGateHeal, GATE_BRAIN_V, RELAY_VERSION } from '../src/net/wire.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { GATE_STATE_EMPTY } from '../src/net/gateLink.js';
import { createGateCourt, HEAL_SEND_MS, HEAL_GAP_MS } from '../src/scenes/gateCourt.js';
import { courtToDungeon } from '../src/world/gateArena.js';
import { damageChartModel, drawGateDamageChart, DAMAGE_CHART_TEXT, DAMAGE_CHART_DELAY_MS, DAMAGE_CHART_CSS } from '../src/ui/gateDamageChart.js';
import { destroyGateBossBar } from '../src/ui/gateBossBar.js';
import { destroyGateMarksCard } from '../src/ui/gateMarksView.js';
import { destroyGateGround } from '../src/ui/gateGroundView.js';
import { fakeRooms } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T0 = 1_000_000;
const C0 = COURTS[0], ON = { x: C0[0] + 3, z: C0[1] + 4 };
function fightOf(n = 3, lv = 10) {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn', null);
  for (let i = 0; i < n; i++) assert.ok(joinFight(f, `s${i + 1}`, `P${i + 1}`, lv, T0, true));
  return f;
}

// ═══ THE BRAIN ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-HEAL the brain: a heal is credited to its HEALER - the mate whose spell it was, or the one healed - believed within the receiver\'s heal bucket (HEAL_DEPTH_X references deep, a reference refilled over HEAL_REFILL_S), and never a part in the fight (mutants: credited to the receiver; the bucket uncapped; never refilled)', () => {
  assert.equal(healRef(10), HEAL_REF_BASE + HEAL_REF_LV * 10);
  const f = fightOf(3, 10), ref = healRef(10), depth = HEAL_DEPTH_X * ref;
  assert.equal(applyHeal(f, 's2', 's1', 40, ON, T0 + 1000), 40);
  assert.deepEqual([f.players.s1.healed, f.players.s2.healed ?? 0], [40, 0], 'the caster\'s, not the one healed');
  assert.equal(applyHeal(f, 's2', 's2', 15, ON, T0 + 1000), 15, 'a heal of its own');
  assert.equal(f.players.s2.healed, 15);
  // the receiver's bucket: spent by what it says it was healed, whoever healed it
  assert.equal(applyHeal(f, 's2', 's3', 1e5, ON, T0 + 1000), depth - 55, 'clipped at the bucket');
  assert.equal(applyHeal(f, 's2', 's3', 50, ON, T0 + 1000), 0, 'empty');
  const half = HEAL_REFILL_S * 500;
  assert.ok(Math.abs(applyHeal(f, 's2', 's3', 1e5, ON, T0 + 1000 + half) - ref / 2) < 1e-6, 'half a reference back in half the refill');
  assert.equal(applyHeal(f, 's1', 's3', 30, ON, T0 + 1000), 30, 'another receiver\'s bucket is its own');
  // nothing else of the fight moved
  for (const k of ['s1', 's2', 's3']) assert.deepEqual([f.players[k].dealt, f.players[k].clipped], [0, 0]);
  assert.deepEqual(f.threat ?? {}, {}, 'no threat');
});

test('GATE-HEAL the brain: refused - a receiver or a healer who is no fighter of this fight, a heal of nothing, a receiver off the laid floor or with no pose, a fight fallen, the Wrath come or due (mutants: a stranger credited; the floor unchecked; after the fall)', () => {
  const f = fightOf(2, 10);
  assert.equal(applyHeal(f, 'nobody', 's1', 10, ON, T0 + 1000), 0, 'a stranger healed');
  assert.equal(applyHeal(f, 's2', 'nobody', 10, ON, T0 + 1000), 0, 'a stranger\'s heal');
  for (const n of [0, -5, NaN, Infinity]) assert.equal(applyHeal(f, 's2', 's1', n, ON, T0 + 1000), 0, String(n));
  assert.equal(applyHeal(f, 's2', 's1', 10, null, T0 + 1000), 0, 'no pose');
  assert.equal(applyHeal(f, 's2', 's1', 10, { x: COURTS[2][0], z: COURTS[2][1] }, T0 + 1000), 0, 'a court not laid');
  const late = fightOf(2, 10);
  assert.equal(applyHeal(late, 's2', 's1', 10, ON, late.wrathAt), 0, 'midnight');
  late.wrath = { at: T0 }; assert.equal(applyHeal(late, 's2', 's1', 10, ON, T0 + 1000), 0, 'the Wrath');
  const done = fightOf(2, 10);
  done.fell = { at: T0 + 500, top: [], n: 2 };
  assert.equal(applyHeal(done, 's2', 's1', 10, ON, T0 + 1000), 0, 'he has fallen');
  assert.equal(f.players.s1.healed ?? 0, 0);
});

test('GATE-HEAL the chart: each healer\'s row carries `hl` (whole), none for one who healed nothing; a checkpoint keeps what was healed and the bucket; a fight from before it reads none (mutants: `hl` on every row; the figure lost to a checkpoint)', () => {
  const f = fightOf(3, 10);
  applyHit(f, 's1', 60, HIT_KINDS.Spell, ON, T0 + 1000);
  applyHit(f, 's2', 30, HIT_KINDS.Spell, ON, T0 + 1000);
  applyHeal(f, 's1', 's3', 25, ON, T0 + 1000);
  f.players.s3.stoodMs = 1000;
  const dm = damageChart(f);
  assert.deepEqual(dm.map((r) => [r.n, r.hl]), [['P1', undefined], ['P2', undefined], ['P3', 25]], 'the healer, who dealt nothing, on the chart with it');
  const copy = JSON.parse(JSON.stringify(f));
  assert.deepEqual(damageChart(copy), dm);
  assert.equal(applyHeal(copy, 's1', 's3', 1e5, ON, T0 + 1000), f.players.s1.hb, 'the bucket kept');
  const old = fightOf(2, 10);
  for (const p of Object.values(old.players)) { delete p.healed; delete p.hb; delete p.hbAt; }
  applyHit(old, 's1', 10, HIT_KINDS.Spell, ON, T0 + 1000);
  assert.ok(damageChart(old).every((r) => !('hl' in r)));
  assert.ok(applyHeal(old, 's2', 's1', 10, ON, T0 + 1000) === 10, 'a bucket from before it starts full');
  void dpsRef; void stateOf;
});

// ═══ THE WIRE ══════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-HEAL the wire: `heal` - one to GATE_HEAL_ROWS_MAX rows, each healer once (\'\' myself, else a peer id), whole points to GATE_HEAL_WIRE_MAX, projected row by row; a chart row\'s `hl` whole and bounded (a bad one is no chart, never a refused kill); the relay that hears it (mutants: a healer twice; a fraction; the projection skipped)', () => {
  assert.ok(GATE_KINDS.includes('heal'));
  assert.deepEqual(validGateIn({ k: 'heal', h: [['', 12], ['peer-0009', 30]], junk: 1 }), { k: 'heal', h: [['', 12], ['peer-0009', 30]] });
  for (const bad of [
    { k: 'heal' }, { k: 'heal', h: [] }, { k: 'heal', h: Array.from({ length: GATE_HEAL_ROWS_MAX + 1 }, (_, i) => [`peer-${1000 + i}`, 1]) },
    { k: 'heal', h: [['', 12], ['', 3]] }, { k: 'heal', h: [['', 0]] }, { k: 'heal', h: [['', 1.5]] }, { k: 'heal', h: [['', GATE_HEAL_WIRE_MAX + 1]] },
    { k: 'heal', h: [['a b', 5]] }, { k: 'heal', h: [[7, 5]] }, { k: 'heal', h: [['', 5, 1]] }, { k: 'heal', h: 'x' },
  ]) assert.equal(validGateIn(bad), null, JSON.stringify(bad).slice(0, 80));
  assert.equal(relaySupportsGateHeal(`world${GATE_HEAL_RELAY_MIN - 1}`), false);
  assert.equal(relaySupportsGateHeal(`world${GATE_HEAL_RELAY_MIN}`), true);
  assert.ok(relaySupportsGateHeal(RELAY_VERSION), 'this tree\'s relay hears it');
  const row = { n: 'Ann', l: 10, d: 500, x: 0, h: 3, b: 90, f: 0 };
  assert.equal(validGateOut({ k: 'fell', at: 9, top: [], n: 1, dm: [{ ...row, hl: 120 }] }).dm[0].hl, 120);
  assert.ok(!('hl' in validGateOut({ k: 'fell', at: 9, top: [], n: 1, dm: [row] }).dm[0]));
  for (const hl of [-1, 1.5, 'x', 2e9]) {
    const g = validGateOut({ k: 'fell', at: 9, top: [], n: 1, dm: [{ ...row, hl }] });
    assert.ok(g && g.dm === undefined, `a bad heal (${hl}): no chart, the fall kept`);
  }
});

// ═══ THE RELAY ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-HEAL the relay: a fighter\'s `heal` credits the caster its socket\'s peer id names, or the one healed; a peer id of no fighter credits nobody; a word from a socket not in the fight is junk; a fallen fighter\'s word counts (said after the fall); the kill\'s chart carries the figures (mutants: credited to the receiver; the peer id never read)', async () => {
  const DAY = 202, TT = gateTimes(DAY);
  const realNow = Date.now; let clock = TT.openAt + 1000; Date.now = () => clock;
  try {
    const r = fakeRooms({ now: () => clock }).room(gateRoomKey(DAY));
    const at = (x, z, extra = {}) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0, ...extra });
    const a = r.connect(); await r.hello(a, 'peer-0001', at(0, 10));
    const b = r.connect(); await r.hello(b, 'peer-0002', at(3, 10));
    const c = r.connect(); await r.hello(c, 'peer-0003', at(-3, 10));
    for (const s of [a, b]) await r.raw(s, JSON.stringify({ t: 'gate', k: 'in', lv: 10, bv: GATE_BRAIN_V }));
    const f = r.room._fight, sub = (id) => `acct-${id}`;
    await r.raw(b, JSON.stringify({ t: 'gate', k: 'heal', h: [['peer-0001', 40], ['', 15], ['peer-0003', 9], ['peer-7777', 9]] }));
    assert.deepEqual([f.players[sub('peer-0001')].healed, f.players[sub('peer-0002')].healed], [40, 15], 'the caster, and itself');
    assert.equal(f.players[sub('peer-0003')], undefined, 'one who never said `in` is no fighter, credited nothing');
    const junk = c.meters?.junk ?? 0;
    await r.raw(c, JSON.stringify({ t: 'gate', k: 'heal', h: [['', 10]] }));
    assert.equal(c.meters?.junk ?? 0, junk + 1, 'not in the fight: junk');
    assert.equal(f.players[sub('peer-0003')], undefined);
    // a fallen fighter's late word still counts
    await r.pose(a, at(0, 10, { dd: 1 }));
    await r.raw(a, JSON.stringify({ t: 'gate', k: 'heal', h: [['', 7]] }));
    assert.equal(f.players[sub('peer-0001')].healed, 47);
  } finally { Date.now = realNow; }
});

// ═══ THE SESSION ═══════════════════════════════════════════════════════════════════════════════════════════════════

function gateRig(relayV) {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const log = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {};
  try { s.join(gateRoomKey(202), { x: 25.6, y: 0, z: 45, yaw: 0 }); const ws = sockets[0]; ws.open(); ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, v: relayV }); return { s, ws }; } finally { console.log = log; console.warn = warn; }
}
test('GATE-HEAL the session: a `heal` goes only to a relay that hears it - an older one junks an unknown gate word (mutant: the door dropped)', () => {
  const old = gateRig(`world${GATE_HEAL_RELAY_MIN - 1}`);
  assert.equal(old.s.gateHealOk, false);
  assert.equal(old.s.sendGate({ k: 'heal', h: [['', 5]] }), false);
  assert.equal(old.s.sendGate({ k: 'in', lv: 10 }), true, 'the rest of the gate as ever');
  const now = gateRig(RELAY_VERSION);
  assert.equal(now.s.sendGate({ k: 'heal', h: [['', 5]] }), true);
  assert.deepEqual(JSON.parse(now.ws.sent.at(-1)), { t: 'gate', k: 'heal', h: [['', 5]] });
});

// ═══ THE COURT ═════════════════════════════════════════════════════════════════════════════════════════════════════

function court() {
  destroyGateBossBar(); destroyGateMarksCard(); destroyGateGround();
  const link = { st: { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 1, hp: 800, max: 1000, fighters: 3, wrathAt: 1e12, md: null }, state() { return this.st; } };
  const clock = { t: 10_000 }, me = { health: 50, maxHealth: 100 }, sent = [];
  let open = true;
  const c = createGateCourt({
    renderer: null, gl: null, link, now: () => clock.t, audio: { play3d() {}, play3dId() {} },
    cam: () => courtToDungeon(0, 1.7, -10), feet: () => courtToDungeon(0, 0, 4), player: () => me, say() {},
    sendHeal: (h) => { if (!open) return false; sent.push({ t: clock.t, ...h }); return true; },
  });
  const frame = (dt = 16) => { clock.t += dt; c.frame(); };
  return { c, link, clock, me, sent, frame, shut: (v) => { open = !v; } };
}

test('GATE-HEAL the court: a rise in my health between two frames, standing at both, is my healing; a blow, a fall and a revival are none; a gap in my frames counts nothing; nor a fight fallen (mutants: a revival counted; the gap believed; the watch after the fall)', () => {
  const h = court();
  h.frame(); h.frame();
  h.me.health = 70; h.frame();
  h.me.health = 60; h.frame();
  h.me.health = 0; h.frame(); h.me.health = 100; h.frame();
  h.me.health = 80; h.frame(); h.clock.t += HEAL_GAP_MS + 1; h.me.health = 95; h.frame();
  h.clock.t += HEAL_SEND_MS; h.frame();
  assert.deepEqual(h.sent.map((m) => m.h), [[['', 20]]], 'the potion alone');
  h.link.st = { ...h.link.st, fell: { at: h.clock.t, top: [], n: 3 } };
  h.me.health = 99; h.frame(); h.clock.t += HEAL_SEND_MS; h.frame();
  assert.equal(h.sent.length, 1, 'nothing once he has fallen');
  h.c.leave();
});

test('GATE-HEAL the court: a mate\'s spell is the caster\'s - said by its own door with the caster\'s peer id, taken as seen so never counted again nor as mine; out as one word at most every HEAL_SEND_MS, each healer once, whole points with the fractions kept; what is owed goes as the court is left; a word the relay would not hear is kept (mutants: a mate\'s heal counted twice; the fractions dropped; the leave forgetting)', () => {
  const h = court();
  h.frame(); h.frame();
  assert.equal(h.c.healedBy('peer-0009', 25), true);
  h.me.health += 25; h.frame();
  assert.deepEqual(h.sent.map((m) => m.h), [[['peer-0009', 25]]], 'the caster\'s, at once - none of it mine');
  h.me.health += 10.5; h.frame();
  h.me.health += 10.75; h.frame();
  assert.equal(h.sent.length, 1, 'not again inside HEAL_SEND_MS');
  h.clock.t += HEAL_SEND_MS; h.frame();
  assert.deepEqual(h.sent.at(-1).h, [['', 21]], 'mine, whole points - the quarter kept for the next');
  h.me.health += 0.8; h.frame(); h.clock.t += HEAL_SEND_MS; h.frame();
  assert.deepEqual(h.sent.at(-1).h, [['', 1]], 'the quarter and four-fifths more: a whole point');
  h.shut(true);
  h.me.health += 3; h.frame(); h.clock.t += HEAL_SEND_MS; h.frame();
  assert.equal(h.sent.length, 3, 'a word that did not go');
  h.shut(false);
  h.c.leave();
  assert.deepEqual(h.sent.at(-1).h, [['', 3]], 'kept (with the quarter), and sent as the court is left');
  assert.equal(h.c.healedBy('peer-0009', 5), false, 'outside a fight, nobody\'s');
});

// ═══ THE CHART ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-HEAL the round-up: a Healed column, last, whenever anyone healed - every row its figure (0 for none) - and none in a court nobody healed in; after the host\'s on a Legion-Lord night; on a narrow screen in the share\'s place; drawn into its own cell (mutants: the column always; never; the narrow fold)', () => {
  const at = { since: 0, now: DAMAGE_CHART_DELAY_MS + 100 };
  const row = (n, d, more = {}) => ({ n, l: 10, d, x: 0, h: 3, b: 50, f: 0, ...more });
  const m = damageChartModel({ at: 1, top: [], n: 2, dm: [row('Ann', 900), row('Bo', 100, { hl: 1234 })] }, at);
  assert.equal(m.healed, true);
  assert.deepEqual(m.head, [...DAMAGE_CHART_TEXT.head, '', DAMAGE_CHART_TEXT.heal]);
  assert.deepEqual(m.rows.map((r) => r.heal), ['0', '1,234']);
  const plain = damageChartModel({ at: 1, top: [], n: 1, dm: [row('Ann', 900)] }, at);
  assert.equal(plain.healed, false);
  assert.deepEqual(plain.head, DAMAGE_CHART_TEXT.head);
  assert.ok(!('heal' in plain.rows[0]));
  const both = damageChartModel({ at: 1, top: [], n: 1, dm: [row('Ann', 900, { a: 100, hl: 50 })] }, at);
  assert.deepEqual(both.head.slice(-2), [DAMAGE_CHART_TEXT.host, DAMAGE_CHART_TEXT.heal]);
  assert.notEqual(m.key, damageChartModel({ at: 1, top: [], n: 2, dm: [row('Ann', 900), row('Bo', 100, { hl: 1235 })] }, at).key, 'a figure moved: the rows rewritten');
  const css = DAMAGE_CHART_CSS, narrow = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  assert.match(css, /\n\.wb-dmg-row > \.wb-dmg-heal \{ display: none; \}/);
  assert.match(css, /\n\.wb-dmg-healed \.wb-dmg-row > \.wb-dmg-heal \{ display: block; \}/);
  assert.match(narrow, /\.wb-dmg-healed \.wb-dmg-row > \.wb-dmg-share \{ display: none; \}/);
  assert.match(narrow, /\.wb-dmg-healed \.wb-dmg-row > \.wb-dmg-heal \{ display: block; \}/);
  // drawn: the class and the cell
  const doc = fakeDoc();
  drawGateDamageChart(m, { doc });
  const root = doc.body.children[0];
  assert.equal(root.className, 'wb-dmg-chart wb-dmg-healed');
  const [, , head, first] = root.children;
  assert.equal(head.children.at(-1).textContent, 'Healed');
  assert.equal(root.children[4].children.at(-1).textContent, '1,234', 'Bo\'s row');
  assert.equal(first.children.at(-1).textContent, '0');
  drawGateDamageChart(null, { doc });
});

/** A document that keeps what is made of it (the chart's own pins' shape). */
function fakeDoc() {
  const el = (tag) => {
    const n = { tagName: tag, children: [], style: {}, attrs: {}, className: '', textContent: '', id: '' };
    n.append = (...k) => { n.children.push(...k); };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    return n;
  };
  const body = el('body'), head = el('head');
  return { body, head, createElement: el, getElementById: () => null };
}

// ═══ THE PLUMBING ══════════════════════════════════════════════════════════════════════════════════════════════════

test('GATE-HEAL the plumbing, read: the ally-cast door tells the court what a mate\'s spell moved and whose it was; the court\'s word goes out as the wire\'s `heal`; the relay judges it by applyHeal from the receiver\'s own pose (mutants: the door silent; the word never sent)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const healed = Math\.max\(0, Math\.trunc\(playerEntity\.health - before\)\);[\s\S]{0,200}if \(healed > 0\) gateCourt\?\.healedBy\?\.\(id, healed\);/);
  assert.match(w, /sendHeal: \(heal\) => !!online\?\.sendGate\?\.\(\{ k: 'heal', \.\.\.heal \}\),/);
  const r = read('server/src/index.js');
  assert.match(r, /if \(m\.k === 'heal'\) \{\n\s*const pose = a\.pose \? this\._courtOf\(a\.pose\) : null;/);
  assert.match(r, /const healer = by === '' \? a\.sub : \[\.\.\.this\._all\(\)\]\.find\(\(\[, b\]\) => b\.id === by\)\?\.\[1\]\?\.sub \?\? null;\n\s*if \(healer\) applyHeal\(f, a\.sub, healer, n, pose, now\);/);
});
