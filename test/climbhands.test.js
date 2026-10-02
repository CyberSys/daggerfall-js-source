// CLIMB-HANDS (2026-10-02, Mac: "Here are two textures for the first person view (not morrowind)" / "whenever you look
// away from the wall" / "mirrored" / "Definitely animate the arms for when you are climbing, or shifting left to right
// climbing/on a ledge"): THE CLASSIC LANE'S HANDS ON THE WALL. Design: bible/03-World/Parkour-Arc.md (CLIMB-HANDS).
// THE LAW EXECUTES: which climbs draw hands, the two fists (the left one mirrored, thumbs in), never a cut sleeve, the
// look off the wall (the reach on the side looked to, mirrored to the left), the shimmy's leading hand, the free climb's
// hands in turn, a catch's hands coming up, the trembling grip, the hands off the wall; the draw; and the wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ClimbHands, createClimbHands, climbHandsWanted, lookOffWall, wallYawOf, HANDS, NATIVE_H, NATIVE_W, GRIP_ART, REACH_ART } from '../src/combat/climbHands.js';
import { climbRigInput } from '../src/player/climbPose.js';
import { PARKOUR_HAND_SPAN } from '../src/player/parkour.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const DEG = Math.PI / 180;
const N = [0, 0, -1];   // the wall's face points -z: facing it is yaw 0, and the climber's right along it is +x
const hang = (track = [0, 1, 0], extra = {}) => ({ mode: 'hang', normal: N, track, feet: track, grip: 1, move: null, ...extra });
const climb = (track = [0, 1, 0], extra = {}) => ({ ...hang(track, extra), mode: 'climb' });
const settle = (h, c, view = { yaw: 0, pitch: 0 }, s = 1) => { for (let i = 0; i < s * 60; i++) h.update(1 / 60, c, view); return h.out; };
const grip = (out, side) => out.grips.find((g) => g.side === side) ?? null;

test('CLIMB-HANDS which climbs draw: the motor\'s hang and free climb, and a move in flight - never DFU\'s own climb, a leap\'s free flight or off the wall', () => {
  assert.equal(climbHandsWanted(null), false);
  assert.equal(climbHandsWanted(hang()), true);
  assert.equal(climbHandsWanted(climb()), true);
  assert.equal(climbHandsWanted({ move: { kind: 'mantle', t: 0 } }), true);
  assert.equal(climbHandsWanted({ mode: 'climb', classic: true, normal: N }), false, 'DFU\'s climb keeps WeaponManager\'s empty screen');
  assert.equal(climbHandsWanted({ mode: null, flight: { dir: [0, 0, 1] } }), false);
  // the snapshot says which climb it is
  assert.equal(climbRigInput({ climb: { isClimbing: true }, bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0 }, 0).classic, true);
  assert.equal(climbRigInput({ onWall: true, hanging: true, wallNormal: N, bodyFeetAt: () => [0, 0, 0], bodyYawFor: () => 0 }, 0).classic, false);
});

test('CLIMB-HANDS the hold: two fists come up from below, the left as painted and the right mirrored (thumbs in), each sleeve running off the bottom', () => {
  const h = new ClimbHands();
  h.update(1 / 60, hang(), { yaw: 0 });
  const first = h.out.present;
  assert.ok(first > 0 && first < 1, 'eased in, not cut');
  const out = settle(h, hang());
  assert.equal(out.present, 1);
  const L = grip(out, 'L'), R = grip(out, 'R');
  assert.ok(L && R, 'both hands');
  assert.deepEqual([L.flip, R.flip], [false, true], 'the painting is a left hand (its thumb on its right): the right is the mirror');
  assert.ok(L.x + L.w / 2 < NATIVE_W / 2 && R.x + R.w / 2 > NATIVE_W / 2, 'each on its own side');
  assert.ok(Math.abs(R.w / R.h - GRIP_ART.w / GRIP_ART.h) < 1e-9, 'the painting\'s aspect');
  for (const g of out.grips) assert.ok(g.y + g.h > NATIVE_H + HANDS.BOTTOM_SLACK / 2, 'the sleeve runs off the bottom');
  assert.equal(out.reach, null, 'facing the wall, no reach');
});

test('CLIMB-HANDS looking away: past LOOK_FROM_DEG both fists drop out and the reaching arm alone comes up on that side - as painted to the right, mirrored to the left', () => {
  const near = settle(new ClimbHands(), hang(), { yaw: (HANDS.LOOK_FROM_DEG - 5) * DEG });
  assert.equal(near.reach, null, 'a glance along the wall is no reach');
  assert.equal(near.grips.length, 2);
  const right = settle(new ClimbHands(), hang(), { yaw: 85 * DEG });
  assert.ok(right.reach, 'turned right: the reach');
  assert.deepEqual([right.reach.side, right.reach.flip], ['R', false]);
  assert.ok(right.reach.x + right.reach.w > NATIVE_W - 10 && right.reach.x + right.reach.w <= NATIVE_W, 'at the right edge, the open hand whole');
  assert.ok(right.reach.x >= NATIVE_W / 2, 'the whole arm in the right half');
  assert.ok(Math.abs(right.reach.w / right.reach.h - REACH_ART.w / REACH_ART.h) < 1e-9);
  assert.equal(right.grips.length, 0, 'the angled arm alone - no fist (Mac: "Only use the angled arm")');
  const left = settle(new ClimbHands(), hang(), { yaw: -85 * DEG });
  assert.deepEqual([left.reach.side, left.reach.flip], ['L', true], 'turned left: mirrored');
  assert.ok(left.reach.x >= 0 && left.reach.x < 10, 'at the left edge');
  assert.ok(left.reach.x + left.reach.w <= NATIVE_W / 2, 'the whole arm in the left half');
  assert.equal(left.grips.length, 0);
  // on the free climb too, and a move in flight keeps the hold's hands
  assert.ok(settle(new ClimbHands(), climb(), { yaw: 90 * DEG }).reach);
  assert.equal(settle(new ClimbHands(), { ...hang(), move: { kind: 'mantle', t: 0.1, split: 0.5 } }, { yaw: 90 * DEG }).reach, null);
  // the turn is read off the wall's own face, wrapped
  assert.ok(Math.abs(wallYawOf([1, 0, 0]) + Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(lookOffWall(hang(), 2 * Math.PI + 0.3) - 0.3) < 1e-12);
});

test('CLIMB-HANDS the shimmy: the hand the body goes toward lifts and reaches first, then the other closes up - and a stop finishes onto a grip', () => {
  for (const dir of [1, -1]) {
    const h = new ClimbHands();
    settle(h, hang([0, 1, 0]));
    const lead = dir > 0 ? 'R' : 'L', trail = dir > 0 ? 'L' : 'R';
    const rest = { [lead]: grip(h.out, lead).y, [trail]: grip(h.out, trail).y };
    let x = 0, leadUp = 0, trailUp = 0, firstLift = null;
    const step = PARKOUR_HAND_SPAN / 40;
    for (let i = 0; i < 40; i++) {
      x += dir * step;
      h.update(1 / 60, hang([x, 1, 0]), { yaw: 0 });
      const l = rest[lead] - grip(h.out, lead).y, tr = rest[trail] - grip(h.out, trail).y;
      if (i < 20) leadUp = Math.max(leadUp, l); else trailUp = Math.max(trailUp, tr);
      if (firstLift === null && Math.max(l, tr) > 4) firstLift = l > tr ? lead : trail;
    }
    assert.equal(firstLift, lead, `going ${dir > 0 ? 'right' : 'left'} the ${lead} hand reaches first`);
    assert.ok(leadUp > HANDS.SHIMMY_LIFT * 0.7 && trailUp > HANDS.SHIMMY_LIFT * 0.7, 'each lifts in its half');
    // stopped a quarter of a cycle in: the hand settles back onto a grip
    for (let i = 0; i < 10; i++) { x += dir * step; h.update(1 / 60, hang([x, 1, 0]), { yaw: 0 }); }
    for (let i = 0; i < 60; i++) h.update(1 / 60, hang([x, 1, 0]), { yaw: 0 });
    assert.ok(Math.abs(h.shimmyPhase * 2 - Math.round(h.shimmyPhase * 2)) < 1e-3, 'on a half cycle\'s end');
  }
});

test('CLIMB-HANDS the free climb: hand over hand, a reach every FEEL.REACH climbed, the hands taking turns - and no lift shows the cut sleeve', () => {
  const h = new ClimbHands();
  settle(h, climb([0, 1, 0]));
  let y = 1, rUp = 0, lUp = 0, both = 0;
  const restY = grip(h.out, 'R').y;
  for (let i = 0; i < 120; i++) {
    y += 0.01;
    h.update(1 / 60, climb([0, y, 0]), { yaw: 0 });
    const r = restY - grip(h.out, 'R').y, l = restY - grip(h.out, 'L').y;
    rUp = Math.max(rUp, r); lUp = Math.max(lUp, l);
    if (r > 6 && l > 6) both++;
    for (const g of h.out.grips) assert.ok(g.y >= NATIVE_H - g.h - 1e-9, 'never lifted past the slack');
  }
  assert.ok(rUp > 15 && lUp > 15, 'each hand reaches');
  assert.equal(both, 0, 'one at a time');
});

test('CLIMB-HANDS the moves and the grip: a catch brings the hands up onto the hold, a mantle presses them down off the screen, a failing grip trembles them, and off the wall they go', () => {
  const h = new ClimbHands();
  settle(h, hang());
  const rest = grip(h.out, 'R').y;
  h.update(1 / 60, { ...hang(), move: { kind: 'catch', t: 0.02 } }, { yaw: 0 });
  assert.ok(grip(h.out, 'R').y > rest + 30, 'a catch starts with the hands below');
  h.update(1 / 60, { ...hang(), move: { kind: 'catch', t: 0.4 } }, { yaw: 0 });
  assert.ok(Math.abs(grip(h.out, 'R').y - rest) < 4, 'and has them on the hold by its CATCH_IN');
  h.update(1 / 60, { ...hang(), move: { kind: 'mantle', t: 0.98, split: 0.5 } }, { yaw: 0 });
  assert.equal(h.out.grips.length, 0, 'over the top the hands are gone down off the screen');
  // the grip failing
  const steady = new ClimbHands(), weak = new ClimbHands();
  let dSteady = 0, dWeak = 0;
  settle(steady, hang()); settle(weak, hang({ grip: 0.05 }));
  for (let i = 0; i < 30; i++) {
    const a = grip(steady.update(1 / 60, hang(), { yaw: 0 }), 'R').x, b = grip(weak.update(1 / 60, hang([0, 1, 0], { grip: 0.05 }), { yaw: 0 }), 'R').x;
    if (i) { dSteady += Math.abs(a - steady._px); dWeak += Math.abs(b - weak._px); }
    steady._px = a; weak._px = b;
  }
  assert.ok(dWeak > dSteady * 3, 'the weak grip shakes');
  // off the wall: eased out, then nothing
  h.update(1 / 60, null, { yaw: 0 });
  assert.ok(h.out.present > 0 && h.out.present < 1);
  settle(h, null);
  assert.deepEqual([h.out.present, h.out.grips.length, h.out.reach], [0, 0, null]);
  // looked straight down off the wall, the hands are over the head
  assert.equal(settle(new ClimbHands(), hang(), { yaw: 0, pitch: -85 * DEG }).grips.length, 0);
});

test('CLIMB-HANDS the draw: Mac\'s two paintings, loaded once, each box a screen quad on DFU\'s design surface, the mirror by its uv', async () => {
  const quads = [], uploads = [];
  const renderer = { uploadTexture: (kind, key, img) => { uploads.push(key); return { key, img }; }, drawScreenQuad: (tex, rect, uv) => quads.push({ tex, rect, uv }) };
  const png = (w, h) => ({ width: w, height: h, data: new Uint8Array(w * h * 4) });   // decodePng's shape
  const asked = [];
  const hands = createClimbHands({ renderer, fetchBytes: async (f) => { asked.push(f); return f; }, decode: async (f) => (f.includes('grip') ? png(GRIP_ART.w, GRIP_ART.h) : png(REACH_ART.w, REACH_ART.h)) });
  const canvas = { width: 640, height: 400 };
  for (let i = 0; i < 60; i++) hands.update(1 / 60, hang(), { yaw: 85 * DEG });
  assert.equal(hands.draw(canvas), false, 'the first ask draws nothing');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(hands.draw(canvas), true);
  assert.deepEqual(asked, ['art/climb-reach.png']);
  assert.equal(uploads.length, 1, 'only what is drawn is asked for');
  assert.equal(quads.length, 1, 'the reach alone');
  const reach = quads.find((q) => q.tex.key.includes('reach'));
  assert.equal(reach.uv, undefined, 'to the right: as painted');
  for (let i = 0; i < 60; i++) hands.update(1 / 60, hang(), { yaw: 0 });
  hands.draw(canvas);
  await new Promise((r) => setTimeout(r, 0));
  quads.length = 0;
  hands.draw(canvas);
  assert.deepEqual(quads.map((q) => q.uv ?? null), [null, { u0: 1, v0: 0, u1: 0, v1: 1 }], 'facing the wall: the left as painted, the right its mirror');
  assert.equal(quads[0].rect.h, HANDS.GRIP_H * 2, 'scaled to the canvas');
  assert.equal(uploads.length, 2, 'each painting once');
  assert.equal(hands.draw(null), false);
});

test('CLIMB-HANDS by source: the rig steps the law on the frame\'s climb and draws it on the classic lane under the spell hands\' vetoes, above the sheathe gates; the paintings are on the allow-list', () => {
  const rig = rd('src/combat/weaponRig.js');
  assert.match(rig, /_climbLower = climbLowerStep\(_climbLower, climbing, dt\);\n\s*climbHands\.update\(dt, camNow\?\.climb \?\? null, camNow \?\? \{\}\);/);
  assert.match(rig, /if \(c && !paralyzed && !fpArm\.active\(\) && !eotbHidesWeapon\(\) && !sheetWindowUp\(\)\) climbHands\.draw\(c, \{ tint: fpTint \}\);/);
  assert.ok(rig.indexOf('climbHands.draw(c') < rig.indexOf('const torchOnly = !shown()'), 'above the sheathe gates');
  const doctrine = rd('test/doctrine.test.js');
  assert.match(doctrine, /'public\/art\/climb-grip\.png', "OURS - Mac's own/);
  assert.match(doctrine, /'public\/art\/climb-reach\.png', "OURS - Mac's own/);
});
