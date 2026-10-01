// AUDIT CREW (2026-10-01, Mac: "Audit everything") - the pre-merge audit of SHIP-CREW + SEA-REPAIR (#487) and
// CREW-COMPANIONS (#493): six lenses (the companion layer's runtime, combat and the death roads, online, the crew's
// logic and economy, the UI and the wiring, the tests' integrity), each finding verified and pinned red here before
// its fix. Ids: CC-A* the companion layer, CC-B* combat and AI, CC-D* the crew and the repairs, CC-E* co-op.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCompanions } from '../src/systems/naval/crewCompanions.js';
import { createCrewAshore, CATCH_UP_M } from '../src/scenes/crewAshore.js';
import { boatMenuRows, BOAT_VERB } from '../src/systems/csaBoatMenu.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const hand = (name, role = 'Bosun', mobile = 144, gender = 'male') => ({ name, role, mobile, gender });
const settle = () => new Promise((r) => setImmediate(r));

/** A place as the pools are (crewcompanions.test.js's, with a resumeLive spy on the motor). */
function world({ maxHealth = 40 } = {}) {
  const party = createCompanions();
  const state = { place: null, leader: { feet: [0, 0, 0], yaw: 0, grounded: true }, now: 0, knocked: [] };
  const mkPlace = (key, o = {}) => {
    const max = o.maxHealth ?? maxHealth;
    const pool = { key, bodies: [], removed: [], live: [] };
    pool.spawn = (mobile, feet, opts) => {
      const ai = { feet: [...feet], yaw: opts.yaw, resumed: 0, resumeLive() { this.resumed++; this.target = null; } };
      const rec = { mobile, gender: opts.gender, ai, entity: { health: max, maxHealth: max, team: 'PlayerAlly', mobileTeam: 'PlayerAlly' }, dead: false };
      pool.bodies.push(rec); pool.live.push(rec);
      return Promise.resolve(rec);
    };
    pool.remove = (rec) => { rec.dead = true; pool.removed.push(rec); pool.live = pool.live.filter((r) => r !== rec); };
    pool.has = (rec) => pool.live.includes(rec);
    pool.sweep = () => { pool.live.length = 0; };
    return pool;
  };
  const layer = createCrewAshore({ party: () => party, place: () => state.place, leader: () => state.leader, now: () => state.now, onKnocked: (c) => state.knocked.push(c.name) });
  return { party, state, mkPlace, layer };
}

// ── CC-A: the companion layer ────────────────────────────────────────────────────────────────────────────────────

test('AUDIT CC-A1 (blocker): a sweep that empties the pool without marking anyone (clearLive: fast travel, Recall, a passage, a respawn) stands the party again', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric'), 0);
  party.take(7, hand('Brand'), 0);
  const street = mkPlace('street');
  state.place = street;
  layer.frame(); await settle();
  assert.equal(street.live.length, 2);
  street.sweep();   // the key stays the street's pool, as exteriorFoes' does
  state.leader = { feet: [500, 0, 500], yaw: 0, grounded: true };
  layer.frame(); await settle();
  assert.equal(street.live.length, 2, 'both stood again where the player arrived');
  assert.ok(street.live.every((r) => Math.hypot(r.ai.feet[0] - 500, r.ai.feet[2] - 500) < 3));
  assert.deepEqual(layer.bodies(), street.live, 'and the orphans forgotten');
});

test('AUDIT CC-A2: health rides through a door as a SHARE of the whole - a body rolled a smaller pool is not healed by the door, a larger one not hurt by it', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric'), 0);
  const a = mkPlace('street', { maxHealth: 60 });
  state.place = a;
  layer.frame(); await settle();
  a.bodies[0].entity.health = 30;   // half
  layer.frame();
  const b = mkPlace('shop', { maxHealth: 40 });
  state.place = b;
  layer.frame(); await settle();
  assert.equal(b.bodies[0].entity.health, 20, 'half of the new whole');
  const c = mkPlace('cellar', { maxHealth: 80 });
  state.place = c;
  layer.frame(); await settle();
  assert.equal(c.bodies[0].entity.health, 40, 'still half');
});

test('AUDIT CC-A3: the catch-up stands a body afresh (the motor resumed - no phantom fall billed from the old ledge), and never chases a leader in the air', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric'), 0);
  const street = mkPlace('street');
  state.place = street;
  layer.frame(); await settle();
  const rec = street.live[0];
  rec.ai.feet[0] = CATCH_UP_M + 5;
  layer.frame();
  assert.equal(rec.ai.resumed, 1, 'resumeLive: grounding, fall tracking, target and path forgotten');
  // the leader levitating 10 m up: no catch-up by height (the body would be stood in the air and fall, again and again)
  state.leader = { feet: [rec.ai.feet[0], 10, rec.ai.feet[2]], yaw: 0, grounded: false };
  layer.frame();
  assert.equal(rec.ai.resumed, 1);
  assert.ok(rec.ai.feet[1] < 1, 'he waits below');
});

test('AUDIT CC-A4: a companion stays the player\'s - whatever turned his team, the layer puts him back on the player\'s side and spared', async () => {
  const { party, state, mkPlace, layer } = world();
  party.take(7, hand('Aldric'), 0);
  const street = mkPlace('street');
  state.place = street;
  layer.frame(); await settle();
  const rec = street.live[0];
  rec.entity.team = 'KnightsAndMages'; rec.entity.mobileTeam = 'KnightsAndMages'; rec.shipmate = false;
  layer.frame();
  assert.deepEqual([rec.entity.team, rec.entity.mobileTeam, rec.shipmate], ['PlayerAlly', 'PlayerAlly', true]);
});

test('AUDIT CC-A5 (major): a hand home again stands on her deck - the last of the party back too (the host answers an empty set, never null), and with his sprite', async () => {
  const { crewRoster } = await import('../src/systems/naval/crewLife.js');
  const { createNavalCrew } = await import('../src/scenes/navalCrew.js');
  const { Boat, spawnBoat } = await import('../src/systems/comeSailAwayBoat.js');
  const { ctxFor } = await import('./csaScene.mjs');
  const { readyPool } = await import('./navalSea.mjs');
  const pool = await readyPool();
  const deck = pool.deckOf(2, 0);
  const b = new Boat(2, 0);
  spawnBoat(b, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }));
  const renderer = { createBillboardBatch: (archive) => ({ archive }), destroyBillboardBatch: () => {}, textures: new Map() };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 20 };
  const crew = createNavalCrew({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {}, rand: () => 0.3 });
  const entry = (away) => ({ key: 'mine', boat: b, deck, count: 6, rosterOf: () => crewRoster({ hull: 2, seed: 3, crew: 60 }), seed: 3, faction: null, battle: false, away });
  const step = (away, n = 1) => { for (let i = 0; i < n; i++) { crew.sync([entry(away)]); crew.frame(0.05, [0, 10, 0]); } };
  const member = (i) => crew.ships()[0].life.members[i];
  const sprite = (i) => !!crew.ships()[0].sprites.get(member(i));
  step(new Set());
  await settle();
  step(new Set([1, 2]));
  assert.ok(member(1).gone && member(2).gone, 'two ashore');
  step(new Set([2]), 5);
  assert.ok(!member(1).gone && sprite(1), 'one home: standing, and seen');
  step(new Set(), 5);   // the last home: the host's empty set
  assert.ok(!member(2).gone && sprite(2), 'the last home too');
  assert.equal(crew.ships()[0].life.standing(), 6);
  const w = rd('src/scenes/world.js');
  assert.match(w, /away: naval\?\.awayOf\?\.\(boat\) \?\? NO_HANDS_AWAY/, 'my boats always say who is away');
  assert.match(rd('src/scenes/navalHost.js'), /if \(!boat\?\.uid \|\| !companions\.party\.length \|\| sailing\(\)\) return NO_HANDS_AWAY;/, 'none away: an empty set - and none while I sail (Mac: back on deck)');
});

test('AUDIT CC-A6 (major): the bars come down under a dungeon window - the overlay\'s early return draws them covered too', () => {
  const m = rd('src/scenes/worldModes.js');
  assert.match(m, /if \(dungeonCtx\.uiOverlayActive\) \{[^\n]*host\.drawCompanionBars\?\.\(\{ proj, view, eye: mwv\.eye \}\);[^\n]*dungeonCtx\.drawOverlay\(canvas\); return true; \}/);
});

test('AUDIT CC-A7: companions take none of the street\'s (or a building\'s) encounter slots', () => {
  assert.match(rd('src/scenes/exteriorFoes.js'), /const activeCount = \(\) => foes\.filter\(\(f\) => !f\.dead && !f\.puppet && !f\.placed && f\.companion == null\)\.length;/);
});

test('AUDIT CC-A8: a quickload lifts the party first (a dungeon\'s save patches foes by number - a companion in the list took another\'s record)', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('async function worldQuickLoad(');
  const body = w.slice(at, at + 4000);
  assert.match(body, /crewAshore\.clear\(\);   \/\/ AUDIT CC-A8/);
});

test('AUDIT CC-A9: a boat with no deed number lists no Companions row (its press could only do nothing)', () => {
  const ids = (s) => boatMenuRows({ boxes: new Set(['drive']), packable: true, naval: true, crewed: true, ...s }).map((r) => r.id);
  assert.ok(ids({ companions: true }).includes(BOAT_VERB.companions));
  assert.ok(!ids({ companions: false }).includes(BOAT_VERB.companions));
  assert.match(rd('src/scenes/world.js'), /naval: navalOn\(\), crewed: !!boat\.crewed, companions: !!boat\.uid,/);
});

test('AUDIT CC-A10: a pause holds the layer (no knock, no stand, no catch-up under a window); the bars show the peers\' companions indoors and underground too', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /function crewAshoreTick\(\) \{\n\s*if \(!navalOn\(\)\) \{ crewAshore\.clear\(\); return; \}\n\s*if \(gamePaused\(\)\) return;/);
  assert.match(w, /for \(const f of _mode\(\) === 'exterior' \? exteriorFoes\.foes : _insidePool\(\)\) \{/);
});

// ── CC-B: combat and AI ──────────────────────────────────────────────────────────────────────────────────────────

import { EnemyAI, FOLLOW_LEASH, FOLLOW_SLACK } from '../src/characters/enemyMotor.js';
import { runTargetMachine, getTargets } from '../src/characters/enemyTargets.js';
import { isTownThreat } from '../src/systems/townWatch.js';

const walkCollider = () => ({
  raycast: (o, d) => (d[1] < -0.5 ? Math.max(0, o[1]) + 0.5 : Infinity),
  capsuleCast: () => ({ dist: Infinity, key: null }),
  move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true }; },
});
const mkSenses = (extra = {}) => ({ gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, ...extra });
function body(feet, { team = 'PlayerEnemy', hostile = true, yaw = 0, companion = null } = {}) {
  const ai = new EnemyAI(walkCollider(), feet, yaw);
  ai.isHostile = hostile;
  return { ai, entity: { team, mobileTeam: team, health: 20, basics: { team } }, companion };
}
const armed = (pool) => (ai, pf, dt) => runTargetMachine(pool.find((c) => c.ai === ai), pool, pf, dt, { infighting: true, playerEntity: { health: 100 } });
const run = (pool, playerFeet, seconds) => {
  const targeting = armed(pool);
  for (let t = 0; t < seconds; t += 1 / 60) for (const f of pool) f.ai.update(1 / 60, playerFeet, mkSenses({ targeting }));
};

test('AUDIT CC-B1 (blocker): no blow of the player\'s turns a companion - both pools\' attack door passes him by, and the dungeon\'s shaft flies past him', () => {
  for (const [p, v] of [['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/dungeonContext.js', 'foe']]) {
    assert.match(rd(p), new RegExp(`function handleAttackFromPlayer\\(${v}, playerFeet = null, peer = false, peerId = null\\) \\{\\n\\s*if \\(!${v}\\?\\.ai \\|\\| ${v}\\.companion != null\\) return;`), p);
  }
  assert.match(rd('src/scenes/dungeonContext.js'), /for \(const f of foes\) \{\n\s*if \(f\.dead \|\| f\.companion != null\) continue;   \/\/ AUDIT CC-B1/);
});

test('AUDIT CC-B2: a companion takes no ally for his foe whatever his team reads, and no ally takes him', () => {
  const pf = [0, 0, 30];
  const turned = body([0, 0, 0], { team: 'KnightsAndMages', companion: 'a' });   // a team a blow reset, before the layer puts it back
  const mate = body([0, 0, 3], { team: 'PlayerAlly', yaw: Math.PI, companion: 'b' });
  assert.equal(getTargets(turned, [turned, mate], pf, { infighting: true }).target, null, 'infighting on');
  assert.equal(getTargets(turned, [turned, mate], pf, { infighting: false }).target, null, 'and off');
  assert.equal(getTargets(mate, [mate, turned], pf, { infighting: false }).target, null, 'nor the other way');
});

test('AUDIT CC-B3 (major): drawn past the leash a companion comes all the way home - a struck one\'s secondary target no longer pins him at the leash', () => {
  const leader = [0, 0, 0];
  const mate = body([0, 0, FOLLOW_LEASH + 1], { team: 'PlayerAlly', companion: 'k', yaw: Math.PI });
  mate.ai.follow = { feet: () => leader, stop: 2.5 };
  const orc = body([0, 0, FOLLOW_LEASH + 4], { team: 'Orcs', yaw: Math.PI });
  mate.ai.target = orc; mate.ai.secondaryTarget = orc;   // struck by it (makeEnemyHostileToAttacker writes both)
  orc.ai.feet[2] = FOLLOW_LEASH + 30;   // it stands off
  run([mate, orc], leader, 12);
  const d = Math.hypot(mate.ai.feet[0], mate.ai.feet[2]);
  assert.ok(d <= 2.5 + FOLLOW_SLACK + 0.5, `home (${d.toFixed(1)} m)`);
  assert.equal(mate.ai.secondaryTarget, null);
});

test('AUDIT CC-B4 (major): a companion never runs out past the leash at a foe standing off there (an archer at 30 m), and never stands idle holding a foe he has never seen', () => {
  const leader = [0, 0, 0];
  const mate = body([0, 0, 0], { team: 'PlayerAlly', companion: 'k' });
  mate.ai.follow = { feet: () => leader, stop: 2.5 };
  const archer = body([0, 0, FOLLOW_LEASH + 10], { team: 'Orcs', yaw: Math.PI });
  archer.ai.update = () => {};   // it stands there
  let far = 0;
  const targeting = armed([mate, archer]);
  for (let t = 0; t < 20; t += 1 / 60) {
    mate.ai.update(1 / 60, leader, mkSenses({ targeting }));
    far = Math.max(far, Math.hypot(mate.ai.feet[0], mate.ai.feet[2]));
  }
  assert.ok(far < 6, `he kept to heel (${far.toFixed(1)} m at the farthest)`);
  // a target held but not pursuable - never seen (no predicted position: through a wall, in the spawn band) or given
  // up on - leaves him following (the classic tick does nothing with it, and he stood idle 15 m out)
  const m2 = body([0, 0, 15], { team: 'PlayerAlly', companion: 'k' });
  m2.ai.follow = { feet: () => leader, stop: 2.5 };
  const ghost = body([0, 0, 18], { team: 'Orcs' });
  m2.ai.target = ghost; m2.ai.predictedTargetPos = null; m2.ai.giveUpTimer = 200;
  assert.equal(m2.ai._followWanted(), true, 'never seen');
  m2.ai.predictedTargetPos = [0, 0, 18]; m2.ai.giveUpTimer = 0;
  assert.equal(m2.ai._followWanted(), true, 'given up');
  m2.ai.giveUpTimer = 200;
  assert.equal(m2.ai._followWanted(), false, 'seen, in reach of the leader: he fights it');
  assert.equal(m2.ai.target, ghost, 'and keeps it');
});

test('AUDIT CC-B5: the pathing motor drops the route it held when it turns from fighting to following and back', () => {
  assert.match(rd('src/ai/enhancedMotor.js'), /if \(this\._following !== this\._wasFollowing\) \{ this\._wasFollowing = this\._following; this\.path = null; this\.repathT = 0; \}/);
});

test('AUDIT CC-B6: a torch thrown indoors or underground passes a companion by (the street\'s already did); the watch stays while a monster fights one', () => {
  assert.match(rd('src/scenes/worldModes.js'), /foes: \(\) => interiorFoePool\(\)\.filter\(\(f\) => !sparedByPlayer\(f\)\),/);
  assert.match(rd('src/scenes/dungeonContext.js'), /collider: \(\) => collider, foes: \(\) => foes\.filter\(\(f\) => !sparedByPlayer\(f\)\),/);
  const monster = { ai: { isHostile: true, target: { companion: 'k', dead: false } }, entity: { team: 'Orcs' } };
  assert.equal(isTownThreat(monster, { inTownRect: () => true }), true);
});

test('AUDIT CC-B7: companions fight a quest\'s foes and its foes fight them', () => {
  const pf = [0, 0, 30];
  const mate = body([0, 0, 0], { team: 'PlayerAlly', companion: 'k' });
  const quest = body([0, 0, 3], { team: 'Orcs', yaw: Math.PI });
  quest.isQuestFoe = true;
  assert.equal(getTargets(mate, [mate, quest], pf, { infighting: true }).target, quest);
  assert.equal(getTargets(quest, [quest, mate], pf, { infighting: true }).target, mate);
});

// ── CC-D: the crew and the repairs ───────────────────────────────────────────────────────────────────────────────

import { sea } from './navalSea.mjs';
import { HULL } from '../src/systems/naval/navalShips.js';
import { createShipCrew, CREW_ORDERS, MORALE_EVENT, LOSSES_WINDOW_S, crewCard } from '../src/systems/naval/shipCrew.js';
import { seaRepair, provisionOffer, storePrice, storesToWhole, STORE_POINTS, STORE_YARD_SHARE } from '../src/systems/naval/navalYard.js';
import { repairCost, REPAIR_PRICE } from '../src/systems/naval/navalDamage.js';
import { mintStores, storesIn, spendStore } from '../src/systems/naval/navalStores.js';
import { hullBuild } from '../src/systems/naval/navalShips.js';

async function atSea({ hull = 420, sail = 160, crew = 24, state = 'afloat', stores = 0, nearPort = false, mates = null } = {}) {
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off', Boarders: false }, where: { nearPort } });
  h.boat.crewed = true;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull, sail, crew, fire: 0, state, barrels: 4, ...(mates ? { mates } : {}) } }, notoriety: {}, day: 1, raids: [] });
  const hold = stores ? [mintStores(stores)] : [];
  h.deps.stores = { count: () => storesIn(hold), spend: () => spendStore(hold), add: (b, n) => { hold.push(mintStores(n)); return true; } };
  h.hold = hold;
  return h;
}

test('AUDIT CC-D1 (major): a store is a fixed share of the WORK, priced at STORE_YARD_SHARE of the yard\'s - never a fraction of a whole ship for 25 gold - and repairs at sea refuse in port, where the shipwright is', async () => {
  assert.equal(STORE_YARD_SHARE, 0.7);
  assert.equal(storePrice(), Math.round(STORE_POINTS * REPAIR_PRICE.hull * STORE_YARD_SHARE), 'a store costs 70% of what the yard asks for its work');
  // the work of a whole Small Ship wreck in stores, against the yard's price for it
  const b = hullBuild(HULL.SmallShip);
  const dmg = { hull: 0, maxHull: b.hullHp, sail: 0, maxSail: b.sailHp, crew: 0, maxCrew: 0 };
  const n = storesToWhole(dmg);
  const yard = repairCost(dmg);
  assert.ok(n * storePrice() >= 0.6 * yard && n * storePrice() <= 0.8 * yard, `the stores for a whole wreck (${n} at ${storePrice()}) cost about 70% of the yard's ${yard}`);
  // the yard stocks her hold to what makes her whole from nothing
  const o = provisionOffer({ stores: 0, stock: storesToWhole({ ...dmg }), morale: null, crew: 0, crewed: false, gold: 1e9 });
  assert.equal(o.rows[0].missing, n);
  assert.equal(o.rows[0].price, storePrice());
  // seaRepair counts its work in points (canvas at its yard price's share of the hull's)
  const r = seaRepair({ hull: 0, maxHull: 100, sail: 0, maxSail: 100 }, 1000, { crewed: true, crewShare: 1, budget: Infinity });
  assert.ok(Math.abs(r.work - (100 + 100 * REPAIR_PRICE.sail / REPAIR_PRICE.hull)) < 1e-6, 'hull points and canvas points at half');
  // in port: refused, with the shipwright named
  const h = await atSea({ hull: 210, stores: 10, nearPort: true });
  assert.equal(h.host.giveOrder(h.boat, CREW_ORDERS.repair).ok, false);
  assert.ok(h.log.say.some((l) => /shipwright/.test(l)), 'the yard is here');
});

test('AUDIT CC-D2: a crewed boat with every hand lost still mends - her captain at the work alone - and never holds an order that does nothing', async () => {
  const h = await atSea({ hull: 210, crew: 0, stores: 10 });
  assert.equal(h.host.giveOrder(h.boat, CREW_ORDERS.repair).ok, true);
  const before = h.host.hudModel().ship.hull;
  for (let t = 0; t < 60; t += 0.1) h.host.frame(0.1);
  assert.ok(h.host.hudModel().ship.hull > before, 'mended');
});

test('AUDIT CC-D3: the standing order rides the save', () => {
  const c = createShipCrew({ seed: 3 });
  c.give(CREW_ORDERS.guns);
  const back = createShipCrew({ seed: 3, record: JSON.parse(JSON.stringify(c.snapshot())) });
  assert.equal(back.order, CREW_ORDERS.guns);
  assert.equal(createShipCrew({ seed: 3, record: { ...c.snapshot(), order: 'mutiny' } }).order, CREW_ORDERS.stand, 'a bad one stands down');
});

test('AUDIT CC-D4: a fight\'s losses cap lapses LOSSES_WINDOW_S after the last loss - a boarding\'s dead no longer spend the next fight\'s', () => {
  const c = createShipCrew({ seed: 3 });
  c.event('handLost', 5);
  const after = c.morale;
  c.event('handLost', 5);
  assert.equal(c.morale, after, 'one fight, capped');
  c.tick(LOSSES_WINDOW_S + 1, {});
  c.event('handLost', 5);
  assert.ok(c.morale < after, 'a new fight costs again');
  c.event('handLost', NaN);
  assert.ok(Number.isFinite(c.morale), 'no NaN');
  const d = createShipCrew({ seed: 3 });
  d.tick(1e6, { atSea: true });
  const m = d.morale;
  d.tick(0.01, { atSea: true });
  assert.equal(d.morale, m, 'a huge step spent at once, no backlog drained a point a frame');
});

test('AUDIT CC-D5: one round of grog a port day, and a prize\'s hold lifts spirits once', async () => {
  assert.equal(provisionOffer({ stores: 0, morale: 40, crew: 24, crewed: true, gold: 1e4, grogToday: true }).rows.find((r) => r.id === 'grog').missing, 0, 'today\'s round drunk');
  const h = await atSea({ stores: 0, nearPort: true });
  h.deps.gold = () => 1e4; h.deps.pay = () => {};
  let y = null;
  h.deps.openYard = (m) => { y = m; return true; };
  h.host.frame(0.1);
  h.host.activate();
  assert.ok(y, 'the yard\'s window');
  assert.equal(y.buyProvision('grog').ok, true);
  assert.equal(y.buyProvision('grog').ok, false, 'not twice a day');
  assert.match(rd('src/scenes/navalHost.js'), /if \(all\.length > left\.length && !_plundered\.has\(hold\)\) \{ _plundered\.add\(hold\); crewEvent\(boat \?\? boatInPlay\(\), 'plunder'\); \}/);
});

test('AUDIT CC-D6: the hands stand on her deck as they were named - their class and sex off her saved crew, not a seed that moves with the session', () => {
  assert.match(rd('src/scenes/world.js'), /rosterOf: \(\) => navalMyRoster\(boat, seed, crew\)/);
});

test('AUDIT CC-D7: a knock after a load still costs her crew - the event lands on the saved record of a boat not yet stood', async () => {
  const h = await atSea({ mates: { morale: 60, hires: 2, hands: [{ name: 'Aldric', role: 'First Mate', mobile: 144, gender: 'male', fights: 0, boardings: 0 }, { name: 'Brand', role: 'Bard', mobile: 134, gender: 'male', fights: 0, boardings: 0 }] } });
  h.host.companionKnocked({ boat: 99, name: 'x', gender: 'male' });   // no such boat: nothing
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4, mates: { morale: 60, hires: 2, hands: [{ name: 'Aldric', role: 'First Mate', mobile: 144, gender: 'male', fights: 0, boardings: 0 }] } } }, notoriety: {}, day: 1, raids: [] });
  h.host.companionKnocked({ boat: 42, name: 'Aldric', gender: 'male' });
  assert.equal(h.host.getSaveData().boats[42].mates.morale, 60 + MORALE_EVENT.knocked);
});

test('AUDIT CC-D8: the plate says her repairs while the order stands; the card marks a hand ashore; the next hand answers for a First Mate ashore', () => {
  assert.match(rd('src/scenes/navalHost.js'), /repairing: !!st\.repairing, repairOrdered: st\.crew\.order === CREW_ORDERS\.repair,/);
  assert.match(rd('src/ui/navalHud.js'), /ship\.repairOrdered \? 'Crippled - her crew stands to the repairs'/);
  const lines = crewCard({ morale: 60, hands: [{ name: 'Aldric', role: 'First Mate', fights: 0, boardings: 0 }, { name: 'Brand', role: 'Bard', fights: 1, boardings: 0 }] }, { ashore: new Set(['Aldric']) });
  assert.ok(lines.some((l) => /^Aldric, First Mate.*ashore with you/.test(l)));
  assert.match(rd('src/scenes/navalHost.js'), /const mateOf = \(boat, st\) =>/);
});

// ── CC-E: co-op - the companions' fights across the clients ──────────────────────────────────────────────────────

import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

function craftCfg({ hpPerLevel = 4, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()], ['ENEMY003.CFG', craftCfg({ speed: 60 })]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const poolRig = () => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {}, currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 } },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.5,
});
const netAs = (id, hits) => ({ selfId: () => id, room: () => 'world:3,12', onPeerHit: (h, fate) => { hits.push(h); fate?.sent?.(); return true; }, toWire: (f) => [f[0], f[1], f[2]], toScene: (p) => [p[0], p[1], p[2]] });

test('AUDIT CC-E1 (major, Mac: "Full co-op combat now"): on the street my companion fights another player\'s foe and its foes fight him - each blow to the body\'s owner, where it is real', async () => {
  const hitsA = [], hitsB = [];
  const A = createExteriorFoes(poolRig()), B = createExteriorFoes(poolRig());   // me (mac), and bob
  A.setNet(netAs('mac-0001', hitsA)); B.setNet(netAs('bob-0002', hitsB));
  const mate = await A.spawnFoe(0, [10, 0, 10], { feetGiven: true, allied: true, loose: true, transient: true });
  mate.companion = '42:Aldric'; mate.shipmate = true;
  const orc = await B.spawnFoe(3, [12, 0, 12], { feetGiven: true });
  // the frames cross: bob stands my companion as MY ally and a companion his foes may fight; I stand his orc
  const fa = A.foesFrame(true);
  assert.deepEqual(fa.cp, [mate.seq], 'my frame names my companion');
  B.applyFoes('mac-0001', fa); A.applyFoes('bob-0002', B.foesFrame(true));
  await new Promise((r) => setTimeout(r, 0));
  const mateThere = B.foes.find((f) => f.puppet === 'mac-0001');
  const orcHere = A.foes.find((f) => f.puppet === 'bob-0002');
  assert.ok(mateThere && orcHere, 'each stood on the other client');
  assert.equal(mateThere.companion, `peer:mac-0001:${mate.seq}`);
  assert.equal(mateThere.entity.team, 'PlayerAlly');
  // bob's orc mauls my companion's puppet: the blow comes to ME, and lands on my companion
  mateThere.hurtFromFoe(5, [1, 0, 0], orc);
  const fb = hitsB.find((h) => h.fb === 1);
  assert.ok(fb, 'bob sends the foe\'s blow to me');
  assert.deepEqual([fb.to, fb.i, fb.sf], ['mac-0001', mate.seq, orc.seq]);
  const h0 = mate.entity.health;
  assert.equal(A.applyHit('bob-0002', fb), true);
  assert.equal(mate.entity.health, h0 - 5, 'it lands on my companion');
  assert.equal(mate.ai.target, orcHere, 'and he turns on the orc');
  // my companion strikes bob's orc: the blow goes to bob as an ally's, the orc turns on my companion
  orcHere.hurtFromFoe(7, [0, 0, 1], mate);
  const al = hitsA.find((h) => h.al === 1);
  assert.ok(al, 'I send my companion\'s blow to bob');
  assert.deepEqual([al.to, al.i, al.ac], ['bob-0002', orc.seq, mate.seq]);
  const o0 = orc.entity.health;
  assert.equal(B.applyHit('mac-0001', al), true);
  assert.equal(orc.entity.health, o0 - 7, 'it lands on his orc');
  assert.equal(orc.ai.target, mateThere, 'which turns on my companion, not on me');
  // and nothing else of a puppet's harm goes anywhere (a foe's blow on another's foe is that owner's simulation)
  const n = hitsA.length;
  orcHere.hurtFromFoe(3, [0, 0, 1], await A.spawnFoe(3, [11, 0, 11], { feetGiven: true }));
  assert.equal(hitsA.length, n);
});

test('AUDIT CC-E2 (major): underground my companion rides the room\'s own lane (`cp`), stood as my ally by everyone; his blows on the room\'s foes and theirs on him reach the body\'s owner', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.doesNotMatch(rd('src/scenes/world.js'), /if \(f\) f\._loose = false; return f;/, 'no longer kept off the lane');
  assert.match(d, /if \(!qt && f\.companion != null && !f\.dead\) cp\.push\(i\);/);
  assert.match(d, /comp = validLooseSeqs\(data\.cp\);/);
  assert.match(d, /companionPuppet\(f, lo && comp\.has\(r\.i\)\); f\._heirElse/);
  assert.match(d, /if \(coop\) opts\.onFoeHit\?\.\(\{ own: 1, to: foe\._ownFrom, k: _locationKey, i: foe\._ownI, \.\.\.coop \}\);/, 'own-lane bodies');
  assert.match(d, /if \(coop\?\.al === 1\) opts\.onFoeHit\?\.\(\{ \.\.\.\(foe\._encId != null \? \{ i: foe\._encId, xs: 1 \} : \{ i: pi \}\), \.\.\.coop \}\);/, 'the room\'s foes, as a joiner');
  assert.match(d, /if \(data\.fb === 1\) \{\n\s*if \(!f \|\| f\.dead \|\| f\.companion == null/, 'the foe\'s blow lands on my companion');
  assert.match(d, /rec\.hurtFromFoe = \(dmg, dir, striker = null\) => damageFoe\(rec, dmg, null, dir \?\? null, \{ fromPlayer: false, striker \}\);/);
  assert.match(d, /dealDamage: \(tt, d\) => tt\.hurtFromFoe\?\.\(d, fwd, f\),/);
});

test('AUDIT CC-E3/E4: a companion lifted on the street makes the next frame whole (the room lets him go at once); a ship another stands that strikes to my guns cheers my crew', async () => {
  const hits = [];
  const A = createExteriorFoes(poolRig());
  A.setNet(netAs('mac-0001', hits));
  const mate = await A.spawnFoe(0, [10, 0, 10], { feetGiven: true, allied: true, loose: true, transient: true });
  mate.companion = '42:Aldric'; mate.shipmate = true;
  A.foesFrame(true);
  assert.equal(A.foesFrame(false), null, 'nothing changed');
  A.removeFoe(mate);
  assert.equal(A.foesFrame(false)?.full, 1, 'whole');
  assert.match(rd('src/scenes/navalHost.js'), /if \(was === SHIP_STATES\.afloat && dmg\.state === SHIP_STATES\.struck && clock - \(e\.myBlowAt \?\? -Infinity\) <= SINK_CREDIT_S\) crewEvent\(boatInPlay\(\) \?\? myBoat\(\), 'win'\);/);
});
