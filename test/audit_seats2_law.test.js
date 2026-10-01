// AUDIT-SEATS II (2026-10-01, Mac: "Lets do a comprehensive audit on everything. I just want perfection"): THE SHARED
// LAW'S FINDINGS FIXED - each finding's id in its test's name (bible/06-Systems/Online-Arc.md AUDIT-SEATS II).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeFieldValid } from '../src/net/identityToken.js';
import { SIEGE_RESULTS } from '../src/net/siegeReceipt.js';
import { SIEGE_END_RESULTS } from '../src/net/wire.js';
import { chronicleLine } from '../src/net/townSeatLaw.js';

const M = 40;   // siegeRef.js SIEGE_UNITS_PER_M

test('AUDIT-SEATS II R1/R2 THE FIELD\'S GROUND ON THE PASS: a field\'s points are `[x, z]` (an older client\'s) or `[x, z, g]` - `g` the ground\'s height there, bounded as a coordinate - every point the one shape; a field mixing them, or of another arity, refused (mutants: the arity; the mixing; the height\'s bound)', () => {
  const flat = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * M, z * M]);
  const ground = flat.map(([x, z]) => [x, z, 12 * M]);
  assert.equal(siegeFieldValid(flat, 'palace'), true, 'an older client\'s field');
  assert.equal(siegeFieldValid(ground, 'palace'), true, 'the ground signed at every point');
  assert.equal(siegeFieldValid([...ground.slice(0, 5), flat[5]], 'palace'), false, 'one shape or the other, never both');
  assert.equal(siegeFieldValid(ground.map((p) => [...p, 0]), 'palace'), false, 'no fourth number');
  assert.equal(siegeFieldValid(ground.map(([x, z]) => [x, z, 2e9]), 'palace'), false, 'the height bounded as a coordinate');
  assert.equal(siegeFieldValid(ground.map(([x, z]) => [x, z, 1.5]), 'palace'), false, 'whole units');
  assert.equal(siegeFieldValid([[23600000, 5000000, 480]], 'crown', 'royal'), true, 'a Royal Tourney\'s ring, its ground signed');
});

test('AUDIT-SEATS II D1/L3/R3 A BATTLE ITS ROOM LOST (17: "A room lost for more than 5 minutes - or a forced deploy - voids the siege"): `void` a receipt\'s result and a room\'s end, the two lists pinned equal; a revolt so voided its own Chronicle line - the Charter standing for now (mutants: the receipt\'s word; the end\'s; the line)', () => {
  assert.ok(SIEGE_RESULTS.includes('void'));
  assert.deepEqual([...SIEGE_END_RESULTS], [...SIEGE_RESULTS]);
  const seat = { key: 3021, name: 'Anticlere', tier: 'palace' };
  assert.equal(chronicleLine({ kind: 'revolt-void', week: 5, data: { guild: { name: 'the Silver Hand', tag: 'SH' } } }, seat),
    'In week 5, Anticlere rose against the Silver Hand <SH>, but the battle was void; the Charter of Anticlere stands for now.');
});
