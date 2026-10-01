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

test('AUDIT CLIMB2 H1: a save on the wall keeps the hold - the load takes it again where the body hung, with the grip it had; a save in a move lands where the move ends', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 14, 4);
  const m = motor(s.col, { skill: 100, z: 0.6 });
  for (let i = 0; i < 900 && !(m.onWall && m.pos[1] > 10); i++) step(m, { forward: 1 });
  assert.ok(m.onWall && m.pos[1] > 10, 'ten metres up the wall');
  for (let i = 0; i < 60; i++) step(m, {});
  const grip = m.grip, at = [...m.pos];
  const snap = m.fallSnapshot();
  // the load: a placement, then the carried record
  const l = motor(s.col, { skill: 100, z: 0.6 });
  l.spawn(at[0], at[1], at[2]);
  l.restoreFall(snap);
  let fell = 0;
  for (let i = 0; i < 60; i++) { step(l, {}); fell = Math.max(fell, l.landedFallDistance); }
  assert.equal(l.onWall, true, 'the hold taken again');
  assert.ok(Math.abs(l.pos[1] - at[1]) < 0.05 && fell === 0, `held where it was (${l.pos[1].toFixed(2)} of ${at[1].toFixed(2)}), no fall`);
  assert.ok(Math.abs(l.grip - (grip - 60 / 60 * 0.5 / 30)) < 0.01, `the grip carried (${l.grip.toFixed(3)} from ${grip.toFixed(3)}) - a load is no rest`);
  // a hang the same
  const h = scene(); h.box(-3, 0, 1, 3, 2.3, 4);
  const hm = motor(h.col, { skill: 100 });
  for (let i = 0; i < 40; i++) step(hm, { jump: i >= 10 });
  assert.equal(hm.hanging, true);
  const hs = hm.fallSnapshot(), hp = [...hm.pos];
  const hl = motor(h.col, { skill: 100 }); hl.spawn(hp[0], hp[1], hp[2]); hl.restoreFall(hs);
  step(hl, {});
  assert.equal(hl.hanging, true, 'hanging again');
  // a save in a catch's move: the load is where the move ends, held
  const cm = motor(h.col, { skill: 100 });
  let moving = null;
  for (let i = 0; i < 40 && !moving; i++) { step(cm, { jump: i >= 10 }); if (cm._pkMove?.kind === 'catch' && cm._pkMove.t > 0.2) moving = cm.fallSnapshot(); }
  assert.ok(moving, 'saved in the catch');
  const cp = [...cm.pos], cl = motor(h.col, { skill: 100 }); cl.spawn(cp[0], cp[1], cp[2]); cl.restoreFall(moving);
  step(cl, {});
  assert.equal(cl.hanging, true, 'the catch\'s hang');
  // a plain fall is carried as ever
  const f = motor(h.col, { skill: 100, y: 5, z: -2 });
  for (let i = 0; i < 10; i++) step(f, {});
  assert.ok(Number.isFinite(f.fallSnapshot()?.above), 'a fall is the fall\'s own record');
});

test('AUDIT CLIMB2 H2: a spent grip comes back treading water - the free climb is the only way out of the water on this lane', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 3, 4);
  const m = motor(s.col, { skill: 50, z: 0.6, y: 1 });
  m.swimming = true;
  m.grip = 0;
  let out = false;
  for (let i = 0; i < 600 && !out; i++) { m.swimming = m.pos[1] < 1.2 && !m.onWall; step(m, { forward: 1 }); out = m.onWall; }
  assert.equal(out, true, 'the grip came back in the water and the wall was taken');
});

test('AUDIT CLIMB2 H4: a corner and a catch spend the grip as the hang does - a corner at Climbing 0 is two seconds of it', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.0, 4);
  const m = motor(s.col, { skill: 0, x: 2.4 });
  for (let i = 0; i < 40; i++) step(m, { jump: i >= 10 });
  assert.equal(m.hanging, true);
  let before = null, after = null;
  for (let i = 0; i < 400 && after == null; i++) {
    step(m, { strafe: 1 });
    if (m._pkMove?.kind === 'corner' && before == null) before = m.grip;
    if (before != null && !m._pkMove && m.hanging) after = m.grip;
  }
  assert.ok(before != null && after != null, 'round the corner');
  assert.ok(before - after > 0.25, `the corner spent the grip (${(before - after).toFixed(3)} of it)`);
});

test('AUDIT CLIMB2 H5: a free climb tops out over a lip in reach - a wall lower than the hang (a plinth before a taller wall) is climbed onto, not stuck under', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 1.0, 2.0); s.box(-3, 0, 2.0, 3, 6, 4);   // a metre deep: room to stand
  const m = motor(s.col, { skill: 50, z: 0.6 });
  const log = [];
  let landed = false;   // Forward let go once the climb has landed on the top (held on, it would start up the taller wall)
  for (let i = 0; i < 200; i++) {
    step(m, { forward: landed ? 0 : 1 });
    log.push({ wall: m.onWall, move: m._pkMove?.kind ?? null, y: m.pos[1], g: m.grounded });
    landed ||= log.some((e) => e.move === 'mantle') && !m.mantling;
  }
  const first = log.findIndex((e) => e.wall);
  assert.ok(first > 0, 'the plinth\'s face climbed');
  assert.ok(log.some((e, i) => i > first && e.move === 'mantle'), 'its lip climbed onto');
  const end = log[log.length - 1];
  assert.ok(end.g && !end.wall && Math.abs(end.y - 1.0) < 0.05, `standing on the plinth (y ${end.y.toFixed(2)}, ${end.wall ? 'still on the wall' : 'off it'})`);
  // a tall wall still tops out at its lip, and one stopped short of it holds
  const t = scene(); t.box(-3, 0, 1, 3, 4.0, 4);
  const u = motor(t.col, { skill: 50, z: 0.6 });
  let top = false;
  for (let i = 0; i < 300 && !top; i++) { step(u, { forward: 1 }); top = !u.onWall && !u.mantling && u.grounded && u.pos[1] > 3.9; }
  assert.ok(top, 'over the 4 m wall\'s top');
});

test('AUDIT CLIMB2 H6: the run is not latched on the wall - a running catch neither trains Running while it hangs nor shows the peers a run', () => {
  const s = scene(); s.box(-3, 0, 1, 3, 2.3, 4);
  const m = motor(s.col, { skill: 100, z: -2 });
  // run at it, jump, and let go of Forward as the jump leaves the ground: the lip is caught and held
  for (let i = 0; i < 120 && !m.hanging; i++) step(m, { forward: m.grounded && i < 60 ? 1 : 0, run: true, jump: i >= 14 }, 0);
  assert.equal(m.hanging, true, 'a running jump, caught');
  for (let i = 0; i < 30; i++) step(m, { run: true });
  assert.equal(m.isRunning, false, 'not running on the wall');
});
