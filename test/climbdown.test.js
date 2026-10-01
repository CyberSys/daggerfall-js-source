// CLIMB-DOWN (2026-10-01, Mac: "So plsyers can get stuck on the very top of roofs"): the enhanced climb took players
// up every wall, and nothing brought them back down. A free climb tops out over a roof's parapet onto the roof inside -
// and from there the vault and the clamber refuse the parapet (the drop past it would hurt), the plain jump cannot clear
// it, and a press against it starts a free climb of its inner face that can only stand up again: walled in on the roof
// for good. Found beside it: a slow climb up from the TERRAIN never left the ground - the collider's last-resort floor
// clamp took any body within its 2 cm skin of the terrain back down to it, rising or not, and the free climb at Climbing
// 0 asks 1.7 cm a step (the classic climb, a third of the walk, below Speed 25 the same). Every test here was RED on the
// code before its fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { registerParkourGate, offsetMove } from '../src/player/parkour.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];

/** A terrain at y 0 (the heightmap's floor, not a mesh) and solid boxes. */
function scene() {
  const col = new Collider(() => 0);
  let n = 0;
  const box = (x0, y0, z0, x1, y1, z1) => col.addMesh(`b${n++}`, new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]), BOX_IDX, I);
  return { col, box };
}
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };

test('CLIMB-DOWN T1: a body rising off the terrain rises - the floor clamp holds up what sinks, never pulls down what climbs', () => {
  const { col } = scene();
  for (const dy of [0.005, 0.01, 0.017, 0.019]) {
    const feet = [0, 0, 0];
    col.move(feet, 0, dy, 0, 1.8, false);
    assert.ok(Math.abs(feet[1] - dy) < 1e-9, `a ${dy} m rise from the terrain kept (at ${feet[1]})`);
  }
  // what the clamp is for: a body below the terrain is put back on it, and a body resting on it stands
  const sunk = [0, -0.3, 0];
  col.move(sunk, 0, 0.01, 0, 1.8, false);
  assert.equal(sunk[1], 0, 'a body under the terrain is put on it');
  const rest = [0, 0.01, 0];
  assert.equal(col.move(rest, 0, 0, 0, 1.8, true).grounded, true, 'a body a centimetre over it, still, stands on it');
  assert.equal(rest[1], 0);
});

test('CLIMB-DOWN T1: the free climb at Climbing 0 and the classic climb at Speed 10 go up a wall that stands on the terrain', () => {
  const { col, box } = scene();
  box(-3, 0, -3, 3, 8, 3);
  for (const skill of [0, 10]) {
    const m = new PlayerMotor(col, { speed: 50, running: 30 }, {
      parkour: { enabled: () => true, inputs: () => ({ climbing: skill }), say: () => {}, tally: () => {} },
    });
    m.spawn(0, 0.02, -4);
    let top = 0;
    for (let i = 0; i < 400; i++) { m.update(1 / 60, { ...blank, forward: 1 }, 0); if (m.onWall) top = Math.max(top, m.pos[1]); }
    assert.ok(top > 2, `the free climb at Climbing ${skill} went up (to ${top.toFixed(2)} m)`);
  }
  const c = new PlayerMotor(col, { speed: 10, running: 30 }, {
    climbing: { inputs: () => ({ climbing: 100, luck: 50 }), tally: () => {}, say: () => {}, rolls: () => 0 },
  });
  c.spawn(0, 0.02, -4);
  let top = 0;
  for (let i = 0; i < 400; i++) { c.update(1 / 60, { ...blank, forward: 1 }, 0); if (c.climb?.isClimbing) top = Math.max(top, c.pos[1]); }
  assert.ok(top > 2, `the classic climb at Speed 10 went up (to ${top.toFixed(2)} m)`);
});

// ---- the way down ----------------------------------------------------------------------------------------------

/** Every point of the body inside the boxes, exactly (a capsule against an axis-aligned box, the axis every 1 cm). */
function overlap(boxes, feet, height, r = 0.35) {
  let worst = 0;
  for (let y = feet[1] + r; y <= feet[1] + height - r + 1e-9; y += 0.01) {
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      const dx = Math.max(x0 - feet[0], 0, feet[0] - x1), dy = Math.max(y0 - y, 0, y - y1), dz = Math.max(z0 - feet[2], 0, feet[2] - z1);
      worst = Math.max(worst, r - Math.hypot(dx, dy, dz));
    }
  }
  return worst;
}
/** A tower `H` tall on the terrain, 6 m square, a parapet `ph` tall and `pw` thick round its flat top (none at 0). */
function tower(H, ph = 0, pw = 0) {
  const col = new Collider(() => 0), boxes = [];
  let n = 0;
  const box = (...b) => { boxes.push(b); col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX_IDX, I); };
  box(-3, 0, -3, 3, H, 3);
  if (ph > 0) { box(-3, H, -3, 3, H + ph, -3 + pw); box(-3, H, 3 - pw, 3, H + ph, 3); box(-3, H, -3, -3 + pw, H + ph, 3); box(3 - pw, H, -3, 3, H + ph, 3); }
  return { col, boxes };
}
const state = (m) => (m._pkMove ? `move:${m._pkMove.kind}` : m._wall ? m._wall.mode : m.grounded ? 'ground' : 'air');
function climber(col, { skill = 50, said = [] } = {}) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill, jumping: skill }), say: (l) => said.push(l), tally: () => {} },
  });
}
/** Drive `m` facing `yaw` by `script(i, m, ctx)` for `steps`; answers the states passed, the hardest landing, the
 *  deepest the body went into `boxes` while the hands held it or moved it, and the eye's biggest rise in one step of a
 *  lower. */
function drive(m, boxes, yaw, script, steps) {
  const seen = [], ctx = {};
  let fell = 0, deepest = 0, eyeRise = 0, prevEye = null;
  for (let i = 0; i < steps; i++) {
    m.update(1 / 60, { ...blank, ...script(i, m, ctx) }, yaw);
    if (m.landedFallDistance) fell = Math.max(fell, m.landedFallDistance);
    if (m._pkMove || m._wall) deepest = Math.max(deepest, overlap(boxes, m.pos, m.height));
    if (m._pkMove?.kind === 'lower') { if (prevEye != null) eyeRise = Math.max(eyeRise, m.eye[1] - prevEye); prevEye = m.eye[1]; } else prevEye = null;
    const s = state(m);
    if (seen[seen.length - 1] !== s) seen.push(s);
  }
  return { seen, fell, deepest, eyeRise };
}
/** Walk up to within half a metre of z = `stopZ` (facing -z), tap Jump, wait for the hang, then hold Back. */
const overTheParapet = (stopZ) => (i, m, c) => {
  if (!c.at) { if (m.pos[2] > stopZ + 0.5) return { forward: 1 }; c.at = 1; return {}; }
  if (c.at === 1) { c.at = 2; return { jump: true }; }
  if (c.at === 2) { if (m.hanging) c.at = 3; return {}; }
  return { forward: -1 };
};
/** Crouch, walk to the edge, and once hanging hold Back. */
const crouchToTheEdge = (i, m, c) => {
  if (i === 0) return { crouch: true };
  if (!c.hung) { if (m.hanging) { c.hung = true; return {}; } return { forward: 1 }; }
  return { forward: -1 };
};

test('CLIMB-DOWN T2: walled in on a roof - Jump at a thin parapet over a drop climbs over it into a hang on the far side, and Back climbs down to the street', () => {
  for (const [ph, pw] of [[1.0, 0.25], [1.1, 0.15], [0.8, 0.12]]) {
    const { col, boxes } = tower(8, ph, pw);
    // the trap as it was: the climb up the outside tops out INSIDE the parapet
    const up = climber(col);
    up.spawn(0, 0.02, -4);
    for (let i = 0; i < 1500 && !(up.grounded && up.pos[1] > 7.9); i++) up.update(1 / 60, { ...blank, forward: 1 }, 0);
    assert.ok(up.grounded && up.pos[1] > 7.9 && up.pos[2] > -3 + pw, `the free climb topped out inside the ${ph} x ${pw} parapet`);
    // and the way out
    const m = climber(col);
    m.spawn(0, 8.02, 0);
    const r = drive(m, boxes, Math.PI, overTheParapet(-3 + pw), 1500);
    assert.deepEqual(r.seen.slice(0, 4), ['ground', 'move:mantle', 'move:lower', 'hang'], `over the parapet into a hang (${r.seen.join(' > ')})`);
    assert.ok(m.pos[1] < 0.05 && m.grounded, `down the wall to the street (at ${m.pos[1].toFixed(2)})`);
    assert.ok(r.fell < 0.5, `no fall on the way: the hardest landing ${r.fell.toFixed(2)} m`);
    assert.ok(r.deepest < 0.035, `never into the stone: ${r.deepest.toFixed(3)} m`);
  }
});

test('CLIMB-DOWN T3: crouch walked to a roof\'s edge lowers the body over it into a hang - the eye only sinking - and Back climbs down; standing, the walk off it falls as ever', () => {
  const { col, boxes } = tower(8);
  for (const skill of [0, 50, 100]) {
    const m = climber(col, { skill });
    m.spawn(0, 8.02, 0);
    const r = drive(m, boxes, Math.PI, crouchToTheEdge, 1500);
    assert.deepEqual(r.seen.slice(0, 3), ['ground', 'move:lower', 'hang'], `Climbing ${skill}: lowered into a hang (${r.seen.join(' > ')})`);
    assert.ok(r.eyeRise < 0.01, `Climbing ${skill}: the eye never rose over the edge (${r.eyeRise.toFixed(3)} m a step)`);
    assert.ok(r.deepest < 0.035, `Climbing ${skill}: never into the stone: ${r.deepest.toFixed(3)} m`);
    assert.ok(m.pos[1] < 4, `Climbing ${skill}: on the way down (at ${m.pos[1].toFixed(2)})`);
    if (skill >= 50) assert.ok(r.fell < 0.5 && m.grounded && m.pos[1] < 0.05, `Climbing ${skill}: down to the street unhurt (${r.fell.toFixed(2)})`);
  }
  const w = climber(col);
  w.spawn(0, 8.02, 0);
  const r = drive(w, boxes, Math.PI, (i) => ({ forward: i < 200 ? 1 : 0 }), 400);
  assert.ok(!r.seen.includes('move:lower') && r.fell > 7, 'walked off standing: the fall, as ever');
});

test('CLIMB-DOWN T4: crouched down a pitched roof, the eave is a hand-hold - 20 to 45 degrees', () => {
  for (const pitch of [20, 30, 40, 45]) {
    const col = new Collider(() => 0);
    col.addMesh('walls', new Float32Array([-3, 0, -2, 3, 0, -2, 3, 8, -2, -3, 8, -2, -3, 0, 2, 3, 0, 2, 3, 8, 2, -3, 8, 2]), BOX_IDX, I);
    const t = Math.tan((pitch * Math.PI) / 180), ridge = 8 + 2 * t;
    col.addMesh('roof', new Float32Array([-3, 8, -2, 3, 8, -2, 3, ridge, 0, -3, ridge, 0, -3, 8, 2, 3, 8, 2]), [0, 2, 1, 0, 3, 2, 4, 5, 2, 4, 2, 3], I);
    const m = climber(col);
    m.spawn(0, ridge + 0.05, -0.3);
    const r = drive(m, [], Math.PI, crouchToTheEdge, 1500);
    assert.ok(r.seen.includes('hang'), `${pitch} degrees: hung from the eave (${r.seen.join(' > ')})`);
    assert.ok(r.fell < 0.5 && m.pos[1] < 0.05, `${pitch} degrees: down to the ground unhurt (${r.fell.toFixed(2)})`);
  }
});

test('CLIMB-DOWN T5: a parapet wide enough to stand on - climbed onto, then crouched off its outer edge into a hang', () => {
  const { col, boxes } = tower(8, 1.2, 0.3);
  const m = climber(col);
  m.spawn(0, 8.02, 0);
  drive(m, boxes, Math.PI, overTheParapet(-2.7), 200);
  assert.ok(m.grounded && m.pos[1] > 9.1, `Jump at it stood the body on it (at ${m.pos[1].toFixed(2)})`);
  const r = drive(m, boxes, Math.PI, crouchToTheEdge, 1500);
  assert.ok(r.seen.includes('move:lower') && r.fell < 0.5 && m.pos[1] < 0.05, `off its outer edge into a hang and down (${r.seen.join(' > ')}, ${r.fell.toFixed(2)})`);
  assert.ok(r.deepest < 0.035, `never into the stone: ${r.deepest.toFixed(3)} m`);
});

test('CLIMB-DOWN T6: no hang under the terrain - a lip lower than the hang\'s 1.8 m outdoors is walked off crouched, and a jump at it is a mantle, never a hang with the feet in the ground', () => {
  const { col, boxes } = tower(1.5);
  const m = climber(col);
  m.spawn(0, 1.52, 0);
  const r = drive(m, boxes, Math.PI, (i) => (i === 0 ? { crouch: true } : { forward: 1 }), 300);
  assert.ok(!r.seen.includes('hang') && !r.seen.includes('move:lower'), `walked off (${r.seen.join(' > ')})`);
  // CLIMB2's own catch, as it was: at Climbing 0 Jump held at a wall 1.6 to 1.75 m tall caught its lip and hung the
  // feet 5 to 20 cm in the ground (the fit asked the meshes, never the terrain)
  for (const h of [1.6, 1.7, 1.75]) {
    const { col: c2 } = tower(h);
    const j = climber(c2, { skill: 0 });
    j.spawn(0, 0.02, -3.4);
    let low = Infinity;
    for (let i = 0; i < 120; i++) { j.update(1 / 60, { ...blank, jump: i > 10 && i < 60 }, 0); if (j.onWall || j._pkMove) low = Math.min(low, j.pos[1]); }
    assert.ok(low > -0.03, `a ${h} m wall: the hands never held the feet in the ground (lowest ${low.toFixed(3)})`);
  }
});

test('CLIMB-DOWN T7: a save in the middle of the climb over a parapet keeps the hang it ends in, not the point over the drop it passes', () => {
  const { col } = tower(8, 1.0, 0.25);
  const m = climber(col);
  m.spawn(0, 8.02, 0);
  for (let i = 0; i < 200 && !(m._pkMove?.next); i++) {
    m.update(1 / 60, { ...blank, forward: m.pos[2] > -2.25 ? 1 : 0, jump: m.pos[2] <= -2.25 }, Math.PI);
  }
  assert.ok(m._pkMove?.next, 'mid-climb over the parapet');
  const snap = m.fallSnapshot();
  assert.equal(snap.hold?.mode, 'hang', 'the save keeps the hang it ends in');
  const end = [m.pos[0] + snap.to[0], m.pos[1] + snap.to[1], m.pos[2] + snap.to[2]];
  assert.ok(end[1] < 7.5 && end[2] < -3, `...outside the parapet, under its lip (${end.map((v) => v.toFixed(2))})`);
  // loaded there, the body takes the hold again
  const l = climber(col);
  l.spawn(m.pos[0], m.pos[1], m.pos[2]);
  l.restoreFall(snap);
  l.update(1 / 60, blank, Math.PI);
  assert.ok(l.hanging, 'loaded hanging under the parapet');
});

test('CLIMB-DOWN T8: Roleplay & Realism\'s gate refuses the lower - the line said once, and the crouched body held at the edge rather than walked off it', () => {
  const { col } = tower(8);
  const said = [];
  registerParkourGate(() => 'You can\'t climb whilst holding your weapon.');
  try {
    const m = climber(col, { said });
    m.spawn(0, 8.02, 0);
    const r = drive(m, [], Math.PI, (i) => (i === 0 ? { crouch: true } : { forward: 1 }), 300);
    assert.ok(!r.seen.includes('move:lower'), 'not lowered');
    assert.ok(m.grounded && m.pos[1] > 7.9 && m.pos[2] > -3, `held at the edge (z ${m.pos[2].toFixed(2)})`);
    assert.deepEqual(said, ['You can\'t climb whilst holding your weapon.'], 'said once');
  } finally {
    registerParkourGate(null);
  }
});

test('CLIMB-DOWN T9: a recentre or a deck carrying a chained move carries the part still to come', () => {
  const { col } = tower(8, 1.0, 0.25);
  const m = climber(col);
  m.spawn(0, 8.02, 0);
  for (let i = 0; i < 200 && !(m._pkMove?.next); i++) {
    m.update(1 / 60, { ...blank, forward: m.pos[2] > -2.25 ? 1 : 0, jump: m.pos[2] <= -2.25 }, Math.PI);
  }
  const next = m._pkMove?.next;
  assert.ok(next, 'mid-climb over the parapet');
  const to = [...next.to], lip = next.hang.lipY;
  offsetMove(m._pkMove, [100, -5, 50]);
  assert.deepEqual(next.to, [to[0] + 100, to[1] - 5, to[2] + 50], 'the drop into the hang shifted with the world');
  assert.equal(next.hang.lipY, lip - 5, 'and the lip it hangs from');
});
