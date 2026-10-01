// AUDIT CREW (2026-10-01, Mac: "Audit everything") - the pre-merge audit of SHIP-CREW + SEA-REPAIR (#487) and
// CREW-COMPANIONS (#493): six lenses (the companion layer's runtime, combat and the death roads, online, the crew's
// logic and economy, the UI and the wiring, the tests' integrity), each finding verified and pinned red here before
// its fix. Ids: CC-A* the companion layer, CC-B* combat and AI, CC-D* the crew and the repairs, CC-E* co-op.
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
