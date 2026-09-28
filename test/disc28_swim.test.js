// DISC28-G (2026-09-28, Discord, in Veraten: "the swimming physics persisted after leaving the water ... I rose way up
// and then fell into the void").
//
// Not a stale swim flag - every dungeon host re-reads it from the player's own block each frame, and DFU's test is
// height alone against a water plane that covers the whole block. The swimmer TUNNELLED UP THROUGH A CEILING that was
// under that plane. A swimmer is crouched to 0.9 (axis 0.2) and a move is stepped at up to 0.2625, so a stroke up into
// a ceiling brought the LOWER sphere within its radius of the face while the head was still beneath it - and PH1's
// one-way floor, which is right for a body straddling a floor, set the whole body ON the ceiling's top. Outside the
// level, still under the block's water plane, the player swam on up with nothing to meet, then out of the water, and
// fell with no floor under the dungeon. DFU's CharacterController sweeps and never crosses a plane.
//
// A rising pass now meets ceilings: the one-way floor is a floor only below the head's centre. Driven through the real
// collider, the real motor and the real Deep Waters stroke.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor, CAPSULE_RADIUS } from '../src/player/motor.js';
import { createSwimMovement } from '../src/scenes/deepWatersSwimMove.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function quad(y, flip) {
  return { p: new Float32Array([-20, y, -20, 20, y, -20, 20, y, 20, -20, y, 20]), i: new Uint32Array(flip ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) };
}
/** A corridor shell - floor at -6, ceiling face at -1 with nothing above it - under a block water plane at +8. */
function corridor() {
  const c = new Collider(() => -Infinity);   // the dungeon: no heightAt floor to catch anything
  let q = quad(-6); c.addMesh('dungeon', q.p, q.i, I);
  q = quad(-1, true); c.addMesh('dungeon', q.p, q.i, I);
  return c;
}
const SURF = 8;

/** Space held (float up), the Run stroke toggling - the report's own inputs - for `secs` at `fps`. Answers the
 *  highest the feet ever stood. */
function swimUp(fps, stats, mult = 1, secs = 6) {
  const c = corridor();
  const m = new PlayerMotor(c, stats);
  m.pos = [0, -3, 0]; m.grounded = false;
  const sm = createSwimMovement({ settings: () => ({ swimSpeedMultiplier: mult, enableSwimStroke: true }), collider: () => c });
  const ent = { fatigue: 1e9, stats: { strength: 60, endurance: 60 }, strength: 60, endurance: 60 };
  const dt = 1 / fps, pitch = 1.0;
  let t = 0, run = false, top = -Infinity;
  for (let k = 0; k < Math.round(secs * fps); k++) {
    t += dt;
    m.waterSurfaceY = SURF;
    m.isPlayerSwimming = m.swimming = m.pos[1] + m.height / 2 + 1.25 - 0.95 < SURF;
    m.update(dt, { forward: 0, strafe: 0, run: false, jump: true, up: true, down: false, crouch: false }, 0, pitch);
    if (k % 3 === 0) run = !run;
    sm.update({
      now: t, dt, player: m, entity: ent, loadGrace: false, outdoorSwimming: false, anySwimming: !!m.swimming,
      input: { forward: 0, strafe: 0, up: true, down: false, run }, yaw: 0, pitch,
      lookDir: [0, Math.sin(pitch), Math.cos(pitch)], cameraY: m.pos[1] + 0.8, oceanY: null, seafloorY: () => null,
    });
    top = Math.max(top, m.pos[1]);
  }
  return top;
}

for (const fps of [45, 30, 20]) {
  test(`DISC28-G: at ${fps} fps a swimmer stroking up into an underwater ceiling stays under it`, () => {
    const top = swimUp(fps, { speed: 90, running: 60, swimming: 90 });
    assert.ok(top <= -1 - 0.9 + 1e-3, `the crouched body's top never passes the ceiling (feet reached ${top.toFixed(3)})`);
  });
}

test('DISC28-G: a slow swimmer on a doubled stroke - the other reported band - stays under it too', () => {
  const top = swimUp(45, { speed: 50, running: 50, swimming: 30 }, 2);
  assert.ok(top <= -1.9 + 1e-3, `feet reached ${top.toFixed(3)}`);
});

test('DISC28-G: one rising step whose lower sphere reaches the face while the head is under it is a ceiling', () => {
  const c = corridor();
  // crouched 0.9: head centre at feet + 0.55; put it 0.36 under the face (just clear), then rise one full step
  const feet = [0, -1 - 0.55 - CAPSULE_RADIUS - 0.01, 0];
  c.move(feet, 0, CAPSULE_RADIUS * 0.75, 0, 0.9, false);
  assert.ok(feet[1] < -1, `still under the ceiling (${feet[1].toFixed(3)})`);
  assert.ok(feet[1] <= -1 - 0.9 + 1e-3, 'pressed against it from below, not set on its top');
});

test('DISC28-G: PH1 still holds rising - a STANDING body whose lower sphere sank under a floor, head above it, is set on it', () => {
  const c = new Collider(() => -Infinity);
  const q = quad(0); c.addMesh('dungeon', q.p, q.i, I);
  const feet = [0, -0.2, 0];   // lower sphere's centre 0.15 above the feet: 0.05 under the floor, the head far above
  c.move(feet, 0, 0.05, 0, 1.8, false);
  assert.ok(feet[1] >= -1e-3 && feet[1] <= 0.05 + 1e-3, `set on the floor and risen from it, never pushed through (${feet[1].toFixed(3)})`);
});

test('DISC28-G: PH1 still holds at rest - a crouched body sunk under a floor it is not rising into is set on it', () => {
  const c = new Collider(() => -Infinity);
  const q = quad(0); c.addMesh('dungeon', q.p, q.i, I);
  const feet = [0, -0.3, 0];   // crouched, head under the plane too: the case the rising law leaves to PH1
  c.move(feet, 0, 0, 0, 0.9, false);
  assert.ok(feet[1] > -0.3, `not pushed down out of the floor (${feet[1].toFixed(3)})`);
});
