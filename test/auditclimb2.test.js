// AUDIT CLIMB2 (2026-10-01, Mac: "Hey audit this and ensure its perfection before we merge"): the enhanced climb's
// second slice - the hang, the shimmy, the grip and the free climb - audited in four lenses: fidelity to the ask and the
// calls, an adversarial read of the code, the climb against hostile geometry, and the hosts and the records
// (bible/03-World/Parkour-Arc.md, AUDIT CLIMB2). Every finding below was pinned here RED on the CLIMB2 code before its
// fix. The geometry is boxes; the body's overlap with them is measured EXACTLY (a capsule against an axis-aligned box),
// never through the collider's own resolve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor, CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];

/** A floor at `floorY` and solid boxes, kept for the exact overlap measure. */
function scene(floorY = 0) {
  const col = new Collider(() => -100);
  const boxes = [];
  col.addMesh('floor', new Float32Array([-20, floorY, -20, 20, floorY, -20, 20, floorY, 20, -20, floorY, 20]), [0, 1, 2, 0, 2, 3], I);
  let n = 0;
  const box = (x0, y0, z0, x1, y1, z1, key = `b${n++}`) => {
    col.addMesh(key, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), BOX_IDX, I);
    boxes.push([x0, y0, z0, x1, y1, z1]);
  };
  return { col, box, boxes };
}

/** How deep a capsule at these feet, this tall, sits in any of the boxes - the axis sampled every centimetre, each
 *  sample's distance to the box against the radius. */
function overlap(boxes, feet, height = CAPSULE_HEIGHT, r = CAPSULE_RADIUS) {
  let worst = 0;
  for (let y = feet[1] + r; y <= feet[1] + height - r + 1e-9; y += 0.01) {
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      const dx = Math.max(x0 - feet[0], 0, feet[0] - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - feet[2], 0, feet[2] - z1);
      worst = Math.max(worst, r - Math.hypot(dx, dy, dz));
    }
  }
  return worst;
}

function motor(col, { skill = 50, x = 0, y = 0.02, z = 0.4, yaw = 0 } = {}) {
  const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
    climbing: { inputs: () => ({ climbing: skill, luck: 50 }), tally: () => {}, say: () => {}, rolls: () => 0 },
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill }) },
  });
  m.spawn(x, y, z);
  m._yaw = yaw;
  return m;
}
const step = (m, input = {}, yaw = 0) => m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, crouch: false, ...input }, yaw);
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;

test('AUDIT CLIMB2 A1: a free climb begun at the floor and let go of is no hold - the body stands, as the classic climb\'s own "ground too near" abort has it', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 6, 4);
  const m = motor(s.col, { skill: 0, z: 0.6 });
  let started = -1;
  for (let i = 0; i < 120 && started < 0; i++) { step(m, { forward: 1 }); if (m.onWall) started = i; }
  assert.ok(started > 0, 'Forward held against the wall began a free climb');
  for (let i = 0; i < 30; i++) step(m, {});   // Forward let go, the feet still on the floor
  assert.equal(m.onWall, false, 'standing on the floor is no hold on the wall');
  assert.equal(m.grounded, true);
  // and a climber who comes down to within the classic's 0.12 of the floor and stops is standing too
  const d = motor(s.col, { skill: 50, z: 0.6 });
  for (let i = 0; i < 200 && !(d.onWall && d.pos[1] > 0.6); i++) step(d, { forward: 1 });
  assert.ok(d.onWall && d.pos[1] > 0.6, 'up the wall');
  for (let i = 0; i < 200 && d.pos[1] > 0.1; i++) step(d, { forward: -1 });
  for (let i = 0; i < 10; i++) step(d, {});
  assert.equal(d.onWall, false, 'down at the floor and still: standing');
  // a climber held still well up the wall stays on it
  const h = motor(s.col, { skill: 50, z: 0.6 });
  for (let i = 0; i < 200 && !(h.onWall && h.pos[1] > 1); i++) step(h, { forward: 1 });
  for (let i = 0; i < 30; i++) step(h, {});
  assert.equal(h.onWall, true, 'held a metre up the wall');
});

test('AUDIT CLIMB2 A3: Left and Right kept while the key is held are kept round a corner, never into the next hold - a new wall asks the look afresh', () => {
  const s = scene();
  s.box(-6, 0, 1, 6, 2.3, 4);        // A, faced looking +z
  s.box(-6, 0, -9, 6, 2.3, -6.6);    // B, faced looking -z from z = -6.2
  const m = motor(s.col, { skill: 100 });
  for (let i = 0; i < 40; i++) step(m, { jump: i >= 10 }, 0);
  assert.equal(m.hanging, true, 'hanging on A');
  for (let i = 0; i < 20; i++) step(m, { strafe: 1 }, Math.PI);   // looking away from A, Right: the look's right is -x
  assert.ok(m.pos[0] < -0.2, `the look's right (${m.pos[0].toFixed(2)})`);
  step(m, { strafe: 1, crouch: true }, Math.PI);                   // let go, Right still held
  for (let i = 0; i < 40; i++) step(m, { strafe: 1 }, Math.PI);
  assert.equal(m.onWall, false);
  m.spawn(0, 0.02, -6.2);                                          // before B, facing it (-z), Right still held
  for (let i = 0; i < 40; i++) step(m, { strafe: 1, jump: i >= 10 }, Math.PI);
  assert.equal(m.hanging, true, 'hanging on B');
  const x0 = m.pos[0];
  for (let i = 0; i < 30; i++) step(m, { strafe: 1, jump: true }, Math.PI);
  assert.ok(m.pos[0] < x0 - 0.2, `Right on B is the look's right (-x), not A's held one (moved ${(m.pos[0] - x0).toFixed(2)})`);
  assert.ok(overlap(s.boxes, m.pos) < 0.03);
});
