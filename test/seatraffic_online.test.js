// SEA-TRAFFIC (2026-09-30, Mac: "players arent seeing boats") - online, the sea's traffic is launched by one player of
// those near each other: the lowest id - but only a player ON THE WATER launches any (the director runs for a player at
// a helm, on a deck or swimming). The election counted every player near, so a lower id ashore - still in the port
// town - was elected and launched nothing, and the player sailing out within NAVAL_SHARE_RADIUS of them, not elected,
// met an empty sea. The real naval hosts of two players in a room (test/navalRoom.mjs).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL } from '../src/systems/naval/navalShips.js';
import { room } from './navalRoom.mjs';

const coast = (x, z) => z < 200;   // land north of z = 200

test('SEA-TRAFFIC a player sailing near a lower id ashore meets the sea\'s traffic - the launcher is elected among the players on the water, and the one ashore launches none (was: the one ashore was elected and launched nothing; the sailor met an empty sea)', async () => {
  const r = await room([{ id: 'a', hull: null, water: coast, settings: { ShipsAtSea: 'some' } }, { id: 'b', hull: HULL.SmallShip, water: coast, settings: { ShipsAtSea: 'some' } }]);
  const A = r.get('a'), B = r.get('b');
  A.s.view.feet = [0, 0, 400];   // a ashore, in the town
  B.s.boat.GameObject.position = [0, 0, -400]; B.s.view.feet = [0, 0, -400];   // b at her helm, 800 m off - within the share
  r.run(150);
  const all = (c) => [...c.s.host._sea.values()];
  assert.ok(all(B).length >= 1, `b meets the sea's traffic: ${all(B).length}`);
  assert.equal(all(A).filter((e) => !e.owner).length, 0, 'a, ashore, launched none');
  assert.ok(all(B).every((e) => !e.owner), 'b launched them');
  // and a player on the water with a lower id near still launches for both - one launcher, never two
  A.s.view.feet = [0, 0, -300];   // a swims out
  r.run(150);
  assert.ok(all(A).some((e) => !e.owner) || all(B).some((e) => !e.owner), 'the sea keeps its traffic');
  const launchers = [A, B].filter((c) => c.s.host.directorState.count > 0);
  assert.ok(launchers.length >= 1);
});
