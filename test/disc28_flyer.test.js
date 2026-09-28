// DISC28-H (2026-09-28, Discord: the Dragonslayer quest's dragonling "stuck in the floor").
//
// Quest B0B70Y16 places a Dragonling (id 40, behaviour Flying) at a dungeon marker, and Meaner Monsters - on by default,
// forced on online - scales its texture 2.5x, so its idle sprite is several metres tall. A flyer hangs on its marker as
// DFU's does (the transform is the sprite's centre), which puts its FEET half that sprite below the marker: 1.5-2 m
// under a floor the marker stood half a metre above. DFU's CharacterController pushes a start overlap out; the port's
// collider pushed the middle and head spheres DOWN from the face they were under, and the dragonling flew on held half
// in the ground - drawn sunk on every peer as well, whose puppet mirrors the owner's feet (and whose own build re-hung
// the streamed FEET as a centre, half a sprite lower still).
//
// The hang is floored at the floor under the marker, and a streamed puppet's feet are taken as feet. Driven through
// the real collider with the flying motor's own move (enemyMotor.js: keepFloor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { flyerSpawnFeet, feetFromCentre, enemyControllerHeight } from '../src/characters/enemyAnchor.js';
import { Collider } from '../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function box(x0, y0, z0, x1, y1, z1) {
  const p = [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1];
  const i = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  return { p: new Float32Array(p), i: new Uint32Array(i) };
}
/** A room: a slab floor with its top at 0, a slab ceiling at 6. */
function room() {
  const c = new Collider(() => -Infinity);
  let b = box(-40, -0.2, -40, 40, 0, 40); c.addMesh('dungeon', b.p, b.i, I);
  b = box(-40, 6, -40, 40, 6.2, 40); c.addMesh('dungeon', b.p, b.i, I);
  return c;
}
/** The builder's own floor read (dungeonContext.js buildFoeAt's floorUnder), over the real collider. */
const floorUnder = (c, m, idleH) => { const d = c.raycast([m[0], m[1] + 0.2, m[2]], [0, -1, 0], idleH / 2 + 0.4); return Number.isFinite(d) ? m[1] + 0.2 - d : null; };

/** The flying motor's pursuit, as the report's own: at a target's face 1.25 up, a floor-avoid lift when heading down. */
function chase(c, feet, idleH, steps = 600) {
  const h = enemyControllerHeight(idleH, 'Flying');
  let lowest = Infinity;
  for (let k = 0; k < steps; k++) {
    const cy = feet[1] + idleH / 2, dy = 1.25 - cy, m = Math.hypot(1, dy);
    const d = [1 / m, dy / m];
    if (d[1] < 0 && Number.isFinite(c.raycast([feet[0], cy, feet[2]], [0, -1, 0], h / 2 + 1))) d[1] = 0.1;
    c.move(feet, d[0] * 4 / 60, d[1] * 4 / 60, 0, h, true, true);
    lowest = Math.min(lowest, feet[1]);
  }
  return lowest;
}

for (const idleH of [4, 5, 6]) {
  test(`DISC28-H: a ${idleH} m flyer at a marker half a metre off the floor starts on the floor and never sinks into it`, () => {
    const c = room();
    const marker = [0, 0.5, 0];
    const feet = flyerSpawnFeet(marker, idleH, floorUnder(c, marker, idleH));
    assert.ok(feet[1] >= -1e-6, `starts on or above the floor (${feet[1].toFixed(3)})`);
    const lowest = chase(c, feet, idleH);
    assert.ok(lowest >= -0.01, `and flies above it (lowest feet ${lowest.toFixed(3)})`);
  });
}

test('DISC28-H: the old hang, unfloored, is the bug - the same flyer starts under the floor and is held there', () => {
  const c = room();
  const feet = feetFromCentre([0, 0.5, 0], 5);
  assert.ok(feet[1] < -1.5);
  assert.ok(chase(c, feet, 5) < -1, 'held under the floor');
});

test('DISC28-H: a bat on a marker high under the ceiling keeps DFU\'s hang exactly - the ceiling-bats law', () => {
  const c = room();
  const marker = [0, 5.2, 0];
  assert.equal(floorUnder(c, marker, 1), null, 'no floor within its reach');
  assert.deepEqual(flyerSpawnFeet(marker, 1, floorUnder(c, marker, 1)), [0, 4.7, 0]);
  assert.deepEqual(flyerSpawnFeet([0, 5.2, 0], 1, 0), [0, 4.7, 0], 'a floor far below changes nothing');
  assert.deepEqual(flyerSpawnFeet([0, 0.5, 0], 5, null), [0, -2, 0], 'no floor read: the hang as it was');
  // the read starts 0.2 above the marker, so a face it meets above the centre is no floor BENEATH the marker - never lifted onto it
  assert.deepEqual(flyerSpawnFeet([0, 0.5, 0], 5, 0.6), [0, -2, 0], 'a surface above the marker is not the floor under it');
});

test('DISC28-H: the builder floors the hang, and both streamed-puppet stands take the owner\'s feet as feet', () => {
  const d = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(d, /const floorUnder = \(\) => \{ const d = collider\.raycast\(\[e\.x, e\.y \+ 0\.2, e\.z\], \[0, -1, 0\], idleH \/ 2 \+ 0\.4\);/);
  assert.equal([...d.matchAll(/x: r\.f\[0\], y: r\.f\[1\], z: r\.f\[2\], spawnDistanceType: 0 \}, false, \{ feetGiven: true \}\)/g)].length, 2);
  assert.doesNotMatch(d, /x: r\.f\[0\], y: r\.f\[1\], z: r\.f\[2\], spawnDistanceType: 0 \}, false\);/, 'no streamed feet re-hung as a centre');
});
