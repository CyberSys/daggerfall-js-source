// TV1 (2026-09-27, bible/06-Systems/Travel-View.md, Mac: "a sort of zoom out to an overworld style that utilizes
// travel options ... When opening the map, there should be a toggle to go to the overworld style map. Every detail like
// weather patterns, should be 1:1 in this mode"; his call on the height: below the clouds).
//
// THE VIEW'S CAMERA IS A RENDER EYE: `cam.pos` stays on the traveller's head, so the world streams, the weather is
// read and the rain falls where they stand, and the picture is taken from under the cloud deck, 150-450 m up. Pinned
// here: the camera's law (player/travelCamera.js, pure), the host's half driven against a fake host
// (scenes/travelView.js - its states, the input it owns, every way out), the body held out of the head for the view
// (player/mwView.js), the fog and the sun's cascades measured from the traveller (render/fogGlsl.js FOCUS_GLSL,
// render/shadowPass.js, render/renderer.js setFocus), the readout (ui/travelViewHud.js), and the world host's wiring
// by source - the one host the view lives in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_HEIGHT_MIN, TV_HEIGHT_MAX, TV_HEIGHT_DEFAULT, TV_TILT_MIN, TV_TILT_MAX, TV_TILT_DEFAULT, TV_CLOUD_MARGIN, TV_HEIGHT_FLOOR,
  TV_GROUND_CLEAR, TV_RISE_S, TV_FALL_S, TV_ZOOM_STEP, TV_FOCUS_SNAP, TV_BILLBOARD_LEAN, TV_TURN_RATE,
  ceilingFor, heightBand, forwardOf, rightOf, eyeFor, clearHeight, leanedUp, turnToward, initialCamera, zoomTarget,
  orbitBy, turnCamera, stepCamera, blendView, anglesOf, angleDelta,
} from '../src/player/travelCamera.js';
import { createTravelView, TRAVEL_VIEW_TEXT, travelViewLine, TV_CLICK_SLOP, TV_LOOK_ACTIONS } from '../src/scenes/travelView.js';
import { compassDegrees, chevronDegrees, TRAVEL_VIEW_TITLE, TRAVEL_VIEW_HINTS } from '../src/ui/travelViewHud.js';
import { FOG_GLSL, FOCUS_GLSL } from '../src/render/fogGlsl.js';
import { SHADOW_GLSL } from '../src/render/shadowPass.js';
import { VC_PROFILE } from '../src/render/volumetricClouds.js';
import { ACTIONS, DEFAULT_BINDINGS, PORT_ACTIONS, ACTION_GROUPS } from '../src/systems/inputActions.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const deg = (d) => (d * Math.PI) / 180;

// ── THE CAMERA'S LAW ────────────────────────────────────────────────────────────────────────────────────────────────

test('TV1 camera: Mac\'s band - 150 to 450 m over the traveller, 30 to 75 degrees down, and never into the cloud deck (its base less 60 m, a lid weather\'s floor 40 m)', () => {
  assert.deepEqual([TV_HEIGHT_MIN, TV_HEIGHT_MAX, TV_HEIGHT_DEFAULT], [150, 450, 260]);
  assert.ok(near(TV_TILT_MIN, deg(30)) && near(TV_TILT_MAX, deg(75)) && near(TV_TILT_DEFAULT, deg(52)));
  assert.deepEqual([TV_CLOUD_MARGIN, TV_HEIGHT_FLOOR, TV_GROUND_CLEAR], [60, 40, 25]);
  // the deck, per the weather the clouds are drawn for (render/volumetricClouds.js VC_PROFILE) - the view reads the
  // same table the sky does, so the camera is under the very clouds the player sees
  const ceilings = Object.fromEntries(Object.entries(VC_PROFILE).map(([w, r]) => [w, ceilingFor(r.base)]));
  assert.deepEqual(ceilings, { sunny: 450, cloudy: 450, overcast: 450, fog: 90, rain: 450, snow: 450, thunder: 440, sandstorm: 40 });
  assert.equal(ceilingFor(null), 450, 'no deck: the band\'s top');
  assert.equal(ceilingFor(Number.NaN), 450);
  assert.deepEqual(heightBand(450), [150, 450]);
  assert.deepEqual(heightBand(90), [90, 90], 'in fog the band closes on the ceiling');
  assert.deepEqual(heightBand(10), [40, 40], 'and never under the floor');
});

test('TV1 camera: the eye stands back along its heading so its line of sight passes through the traveller; right and forward are mat4\'s mirrored law', () => {
  const focus = [100, 20, -50];
  for (const [yaw, tilt, h] of [[0, deg(52), 260], [deg(90), deg(30), 150], [deg(-135), deg(75), 450]]) {
    const { eye, fwd, back } = eyeFor(focus, yaw, tilt, h);
    assert.ok(near(eye[1], focus[1] + h, 1e-9), 'height over the focus');
    assert.ok(near(back, h / Math.tan(tilt), 1e-9));
    const d = Math.hypot(eye[0] - focus[0], eye[1] - focus[1], eye[2] - focus[2]);
    for (let i = 0; i < 3; i++) assert.ok(near(eye[i] + fwd[i] * d, focus[i], 1e-6), `the ray reaches the focus (axis ${i})`);
    assert.ok(near(Math.hypot(...fwd), 1, 1e-12));
  }
  assert.deepEqual(forwardOf(0, 0).map((v) => Math.round(v * 1e9) / 1e9), [0, 0, 1], 'yaw 0 looks down +z');
  assert.deepEqual(rightOf(0).map((v) => Math.round(v * 1e9) / 1e9), [1, 0, -0], 'and the screen\'s right is +x');
  const a = anglesOf(forwardOf(deg(40), deg(-20)));
  assert.ok(near(a.yaw, deg(40), 1e-12) && near(a.pitch, deg(-20), 1e-12), 'angles round-trip');
});

test('TV1 camera: the eye keeps 25 m over the ground under it and over a ridge halfway down to the traveller; an unbuilt pixel is no ground', () => {
  const focus = [0, 0, 0];
  const flat = () => 0;
  assert.equal(clearHeight(focus, 0, deg(52), 260, flat), 260, 'open ground: the height asked for');
  assert.equal(clearHeight(focus, 0, deg(52), 260, () => -Infinity), 260, 'no pixel built: nothing to clear');
  // a hill under the eye: the eye rises until it clears it by exactly TV_GROUND_CLEAR
  const hill = (x, z) => (z < -150 ? 300 : 0);
  const h = clearHeight(focus, 0, deg(52), 260, hill);
  const { eye } = eyeFor(focus, 0, deg(52), h);
  assert.ok(eye[1] >= 300 + TV_GROUND_CLEAR - 1e-6, `the eye (${eye[1].toFixed(1)}) clears the hill`);
  assert.ok(h > 260);
  // a ridge only between: the midpoint rule lifts it
  const ridge = (x, z) => (z < -60 && z > -140 ? 200 : 0);
  const hr = clearHeight(focus, 0, deg(52), 260, ridge);
  const mid = eyeFor(focus, 0, deg(52), hr).eye[1] / 2;
  assert.ok(hr > 260 && mid >= 200 + TV_GROUND_CLEAR - 1e-6, 'the line of sight clears the ridge at its middle');
});

test('TV1 camera: the wheel scales the height by 1.18 a notch inside the band; a drag orbits and tilts, the tilt clamped; the look keys turn by radians', () => {
  assert.equal(TV_ZOOM_STEP, 1.18);
  assert.ok(near(zoomTarget(260, 1, 450), 260 / 1.18, 1e-9), 'a notch up: in');
  assert.ok(near(zoomTarget(260, -1, 450), 260 * 1.18, 1e-9), 'a notch down: out');
  assert.equal(zoomTarget(160, 5, 450), 150, 'never under the band');
  assert.equal(zoomTarget(400, -5, 450), 450, 'never over it');
  assert.equal(zoomTarget(400, -5, 300), 300, 'nor over a low deck');
  const c = initialCamera([0, 0, 0], 1);
  assert.deepEqual({ yaw: c.yaw, tilt: c.tilt, height: c.height, heightTarget: c.heightTarget }, { yaw: 1, tilt: TV_TILT_DEFAULT, height: 260, heightTarget: 260 });
  const o = orbitBy(c, 100, 0);
  assert.ok(near(o.yaw, 1 + 100 * 0.005, 1e-12));
  assert.equal(orbitBy(c, 0, 1e6).tilt, TV_TILT_MAX);
  assert.equal(orbitBy(c, 0, -1e6).tilt, TV_TILT_MIN);
  assert.ok(near(turnCamera(c, 0.25, 0).yaw, 1.25, 1e-12));
});

test('TV1 camera: a frame eases the focus onto the feet (a jump past 60 m taken whole), eases the height toward its target under the ceiling, and lifts it off the ground', () => {
  let c = initialCamera([0, 0, 0], 0);
  // a step: eased, not snapped
  let r = stepCamera(c, { feet: [10, 0, 0], dt: 1 / 60, ceiling: 450 });
  assert.ok(r.camera.focus[0] > 0 && r.camera.focus[0] < 10, 'the focus follows');
  // a jump: whole
  r = stepCamera(c, { feet: [TV_FOCUS_SNAP + 1, 0, 0], dt: 1 / 60, ceiling: 450 });
  assert.equal(r.camera.focus[0], TV_FOCUS_SNAP + 1, 'a teleport is not flown across');
  // the height eases toward the target
  c = { ...c, heightTarget: 400 };
  r = stepCamera(c, { feet: [0, 0, 0], dt: 1 / 60, ceiling: 450 });
  assert.ok(r.camera.height > 260 && r.camera.height < 400);
  // a deck coming down pulls the target and the height under it
  r = stepCamera({ ...c, height: 400, heightTarget: 400 }, { feet: [0, 0, 0], dt: 1 / 60, ceiling: 90 });
  assert.equal(r.camera.heightTarget, 90);
  assert.equal(r.camera.height, 90, 'never above the fog\'s ceiling, even mid-ease');
  // the shown height clears a hill, the kept one does not remember it
  r = stepCamera(initialCamera([0, 0, 0], 0), { feet: [0, 0, 0], dt: 1 / 60, ceiling: 450, heightAt: (x, z) => (z < -100 ? 500 : 0) });
  assert.ok(r.shownHeight > r.camera.height && r.eye[1] >= 525 - 1e-6);
});

test('TV1 camera: the rise and the fall blend the head\'s eye into the sky\'s, smoothstepped; the flats lean back by half the tilt; the traveller turns at 6 rad/s the short way', () => {
  const from = { eye: [0, 1.7, 0], fwd: [0, 0, 1] };
  const to = { eye: [0, 300, -200], fwd: forwardOf(0, -deg(52)) };
  assert.deepEqual(blendView(from, to, 0), from);
  const end = blendView(from, to, 1);
  for (let i = 0; i < 3; i++) assert.ok(near(end.eye[i], to.eye[i], 1e-9) && near(end.fwd[i], to.fwd[i], 1e-9));
  const mid = blendView(from, to, 0.5);
  assert.ok(near(mid.eye[1], (1.7 + 300) / 2, 1e-9), 'smoothstep is a half at a half');
  assert.ok(near(Math.hypot(...mid.fwd), 1, 1e-12));
  assert.equal(TV_BILLBOARD_LEAN, 0.5);
  const up = leanedUp(0, deg(52));
  assert.ok(near(Math.acos(up[1]), deg(26), 1e-12), 'half of 52 degrees');
  assert.ok(up[2] > 0 && near(up[0], 0, 1e-12), 'leaned along the heading (the top away from the eye)');
  assert.deepEqual(leanedUp(1.2, 0), [0, 1, 0], 'no tilt, no lean');
  assert.equal(TV_TURN_RATE, 6);
  assert.ok(near(turnToward(0, 1, 0.1), 0.6, 1e-12));
  assert.equal(turnToward(0, 0.3, 0.1), 0.3, 'within a step: arrived');
  assert.ok(turnToward(deg(170), deg(-170), 0.01) > deg(170), 'the short way round, across the seam');
  assert.ok(near(angleDelta(deg(170), deg(-170)), deg(20), 1e-12));
});

// ── THE HOST'S HALF ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A window just real enough: listeners by type and phase, dispatch in capture order, stop that stops. */
function fakeWin() {
  const L = [];
  return {
    L,
    addEventListener(type, fn, opt) { L.push({ type, fn, capture: opt === true || !!opt?.capture }); },
    removeEventListener(type, fn, opt) { const c = opt === true || !!opt?.capture; const i = L.findIndex((l) => l.type === type && l.fn === fn && l.capture === c); if (i >= 0) L.splice(i, 1); },
    fire(type, props) {
      const e = { type, stopped: false, prevented: false, ...props, preventDefault() { e.prevented = true; }, stopImmediatePropagation() { e.stopped = true; }, stopPropagation() { e.stopped = true; } };
      for (const l of L.filter((x) => x.type === type && x.capture)) { if (e.stopped) break; l.fn(e); }
      if (!e.stopped) e.reachedHost = true;
      return e;
    },
    count: (type) => L.filter((l) => l.type === type).length,
  };
}
function rig(over = {}) {
  const win = fakeWin();
  const canvas = { id: 'canvas', contains: (t) => t === canvas };
  const log = { said: [], picks: [], body: [], cursor: [], hud: [] };
  const w = { feet: [0, 0, 0], yaw: 0.3, allowed: { ok: true }, windowUp: false, danger: false, moving: false, autopilot: false };
  const tv = createTravelView({
    canvas, win,
    feet: () => w.feet, headView: () => ({ eye: [w.feet[0], w.feet[1] + 1.7, w.feet[2]], fwd: forwardOf(w.yaw, 0) }),
    yaw: () => w.yaw, setYaw: (y) => { w.yaw = y; },
    heightAt: () => 0, cloudBase: () => null,
    allowed: () => w.allowed, windowUp: () => w.windowUp, danger: () => w.danger,
    actionsOf: (e) => e.actions ?? [], movementHeld: () => w.moving, autopilot: () => w.autopilot,
    holdBody: (on) => { log.body.push(on); return true; },
    freeCursor: (free) => log.cursor.push(free),
    where: () => 'The wilds of Daggerfall',
    project: (p) => ({ x: 400 + p[0], y: 300 - p[2], front: true }),
    onPick: (x, y) => log.picks.push([x, y]),
    hud: { show: () => log.hud.push('show'), hide: () => log.hud.push('hide'), update: (f) => { log.last = f; } },
    say: (t) => log.said.push(t),
    ...over,
  });
  const run = (s, dt = 1 / 60) => { for (let i = 0; i < Math.ceil(s / dt); i++) tv.frame(dt); };
  return { tv, win, canvas, log, w, run };
}

test('TV1 host: the view rises only where the host allows it and no foe is near - the refusal said; up, the body is held, the cursor freed, the input taken and the readout shown', () => {
  const r = rig();
  r.w.allowed = { ok: false, why: TRAVEL_VIEW_TEXT.indoors };
  assert.equal(r.tv.enter(), false);
  assert.deepEqual(r.log.said, [TRAVEL_VIEW_TEXT.indoors]);
  r.w.allowed = { ok: true };
  r.w.danger = true;
  assert.equal(r.tv.enter(), false);
  assert.equal(r.log.said.at(-1), TRAVEL_VIEW_TEXT.enemies);
  r.w.danger = false;
  assert.equal(r.win.count('pointerdown'), 0, 'nothing listens while it is down');
  assert.equal(r.tv.enter(), true);
  assert.equal(r.tv.state, 'rising');
  assert.deepEqual(r.log.body, [true], 'the body out of the head');
  assert.deepEqual(r.log.cursor, [true], 'the cursor free');
  assert.deepEqual(r.log.hud, ['show']);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'wheel', 'contextmenu', 'keydown', 'keyup']) {
    assert.equal(r.win.count(t), 1, `${t}: one listener, on the capture phase`);
    assert.ok(r.win.L.find((l) => l.type === t).capture);
  }
  assert.equal(r.tv.enter(), true, 'a second press while rising is the same view');
  assert.equal(r.win.count('pointerdown'), 1);
});

test('TV1 host: it rises over TV_RISE_S from the head\'s own eye, stays up, and falls over TV_FALL_S back into it - then every hold is let go', () => {
  const r = rig();
  r.tv.enter();
  const first = r.tv.frame(1 / 60);
  assert.ok(first.eye[1] < 20, 'the first frame is still at the head');
  assert.equal(first.state, 'rising');
  r.run(TV_RISE_S);
  const up = r.tv.frame(1 / 60);
  assert.equal(up.state, 'up');
  assert.equal(up.fullyUp, true);
  assert.ok(up.eye[1] > 200, `up (${up.eye[1].toFixed(0)} m)`);
  assert.ok(up.pitch < -deg(40), 'looking down');
  assert.deepEqual(up.focus.map(Math.round), [0, 0, 0], 'the focus is the traveller');
  assert.deepEqual(up.right.map((v) => Math.round(v * 1e6) / 1e6), rightOf(up.yaw).map((v) => Math.round(v * 1e6) / 1e6));
  assert.ok(up.up[1] < 1, 'the flats leaned');
  r.tv.exit('button');
  assert.equal(r.tv.state, 'falling');
  r.run(TV_FALL_S / 2);
  assert.equal(r.tv.state, 'falling');
  r.run(TV_FALL_S);
  assert.equal(r.tv.state, 'off');
  assert.equal(r.tv.frame(1 / 60), null, 'off: no camera');
  assert.deepEqual(r.log.body, [true, false], 'the body handed back');
  assert.deepEqual(r.log.cursor, [true, false], 'the look back');
  assert.deepEqual(r.log.hud, ['show', 'hide']);
  assert.equal(r.win.count('pointerdown') + r.win.count('keydown') + r.win.count('wheel'), 0, 'every listener with it');
});

test('TV1 host: a window, a door out of the open air or a death CUTS the view at once; a foe near brings it down; dispose takes it all', () => {
  for (const [why, set] of [['a window', (w) => { w.windowUp = true; }], ['a door', (w) => { w.allowed = { ok: false }; }]]) {
    const r = rig();
    r.tv.enter();
    r.run(TV_RISE_S);
    set(r.w);
    assert.equal(r.tv.frame(1 / 60), null, `${why}: cut`);
    assert.equal(r.tv.state, 'off');
    assert.deepEqual(r.log.body, [true, false]);
    assert.deepEqual(r.log.cursor, [true, false]);
  }
  const f = rig();
  f.tv.enter();
  f.run(TV_RISE_S);
  f.w.danger = true;
  f.tv.frame(1 / 60);
  assert.equal(f.tv.state, 'falling', 'a foe near: down to the traveller\'s eyes, not cut');
  const d = rig();
  d.tv.enter();
  d.tv.dispose();
  assert.equal(d.tv.state, 'off');
  assert.equal(d.win.count('keydown'), 0);
});

test('TV1 host: THE VIEW OWNS THE CANVAS WHILE UP - a click is a pick, a drag past the slop orbits and picks nothing, the wheel zooms, the right button and the context menu never reach the host; the DOM beside it keeps its own', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  // a click
  let e = r.win.fire('pointerdown', { target: r.canvas, pointerId: 1, clientX: 100, clientY: 100, button: 0 });
  assert.ok(e.stopped && e.prevented, 'taken on the capture phase');
  assert.ok(r.win.fire('mousedown', { target: r.canvas, button: 0 }).stopped, 'the host\'s Mouse0 never hears it');
  r.win.fire('pointerup', { target: r.canvas, pointerId: 1, clientX: 102, clientY: 101, button: 0 });
  assert.deepEqual(r.log.picks, [[102, 101]], 'a press that did not travel is a pick');
  // a drag
  const yaw0 = r.tv.camera.yaw;
  r.win.fire('pointerdown', { target: r.canvas, pointerId: 2, clientX: 100, clientY: 100, button: 0 });
  r.win.fire('pointermove', { target: r.canvas, pointerId: 2, clientX: 100 + TV_CLICK_SLOP + 20, clientY: 100 });
  r.win.fire('pointerup', { target: r.canvas, pointerId: 2, clientX: 100 + TV_CLICK_SLOP + 20, clientY: 100, button: 0 });
  assert.equal(r.log.picks.length, 1, 'a drag picks nothing');
  assert.ok(r.tv.camera.yaw > yaw0, 'the drag turned the view');
  // the right button: never the swing
  assert.ok(r.win.fire('mousedown', { target: r.canvas, button: 2 }).stopped);
  assert.ok(r.win.fire('contextmenu', { target: r.canvas }).stopped);
  // the wheel
  const h0 = r.tv.camera.heightTarget;
  assert.ok(r.win.fire('wheel', { target: r.canvas, deltaY: -100 }).stopped);
  assert.ok(r.tv.camera.heightTarget < h0, 'rolled up: in');
  // the DOM around the canvas keeps its clicks (the readout's button, the travel panel, the chat)
  const dom = { id: 'button' };
  assert.equal(r.win.fire('pointerdown', { target: dom, pointerId: 3, clientX: 0, clientY: 0, button: 0 }).stopped, false);
  assert.equal(r.win.fire('wheel', { target: dom, deltaY: -100 }).stopped, false);
  // rising, a click is no pick
  const q = rig();
  q.tv.enter();
  q.win.fire('pointerdown', { target: q.canvas, pointerId: 1, clientX: 5, clientY: 5, button: 0 });
  q.win.fire('pointerup', { target: q.canvas, pointerId: 1, clientX: 5, clientY: 5, button: 0 });
  assert.deepEqual(q.log.picks, [], 'only once the view is up');
});

test('TV1 host: the pause key brings it down (and never opens the pause); the look keys turn the view, not the traveller; movement is camera-relative while no journey drives', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  assert.deepEqual([...TV_LOOK_ACTIONS], ['TurnLeft', 'TurnRight', 'LookUp', 'LookDown']);
  // a look key
  const yaw0 = r.tv.camera.yaw;
  assert.ok(r.win.fire('keydown', { code: 'ArrowRight', actions: ['TurnRight'] }).stopped, 'the host never turns the traveller');
  r.tv.steer(0.5);
  assert.ok(r.tv.camera.yaw > yaw0, 'the view turned');
  r.win.fire('keyup', { code: 'ArrowRight', actions: ['TurnRight'] });
  const yaw1 = r.tv.camera.yaw;
  r.tv.steer(0.5);
  assert.equal(r.tv.camera.yaw, yaw1, 'released: still');
  // an ordinary key is the host's
  assert.equal(r.win.fire('keydown', { code: 'KeyW', actions: ['MoveForwards'] }).stopped, false);
  // movement turns the traveller toward the view's heading
  r.tv.frame(1 / 60);
  r.w.yaw = r.tv.camera.yaw + 1;
  r.w.moving = true;
  r.tv.steer(0.05);
  assert.ok(near(r.w.yaw, r.tv.camera.yaw + 1 - 0.3, 1e-9), 'toward the view, at the turn rate');
  r.w.autopilot = true;
  const held = r.w.yaw;
  r.tv.steer(0.05);
  assert.equal(r.w.yaw, held, 'a journey drives: its heading is the autopilot\'s');
  // the pause key: down, swallowed
  const esc = r.win.fire('keydown', { code: 'Escape', actions: ['Escape'] });
  assert.ok(esc.stopped, 'the pause never opens under the view');
  assert.equal(r.tv.state, 'falling');
});

test('TV1 host: the readout - the traveller\'s ring on the projected feet, the chevron along the heading, the compass on the view\'s heading, the place line, the hints by hand', () => {
  const r = rig();
  r.tv.enter();
  r.run(TV_RISE_S + 0.1);
  r.tv.drawHud();
  assert.deepEqual(r.log.last.feet, { x: 400, y: 300, front: true });
  assert.equal(r.log.last.where, 'The wilds of Daggerfall');
  assert.ok(r.log.last.heading != null);
  assert.equal(r.log.last.fade, 1);
  assert.equal(compassDegrees(0), -0);
  assert.equal(compassDegrees(Math.PI / 2), -90, 'facing east, north is to the left');
  assert.equal(chevronDegrees({ x: 0, y: 0, front: true }, { x: 0, y: -10, front: true }), 0, 'up the screen');
  assert.equal(chevronDegrees({ x: 0, y: 0, front: true }, { x: 10, y: 0, front: true }), 90, 'to the right');
  assert.equal(chevronDegrees({ x: 0, y: 0, front: true }, { x: 10, y: 0, front: false }), null, 'off screen: keep the last');
  assert.equal(TRAVEL_VIEW_TITLE, 'Overworld');
  assert.match(TRAVEL_VIEW_HINTS.mouse, /Click to travel/);
  assert.match(TRAVEL_VIEW_HINTS.touch, /Pinch to zoom/);
  assert.equal(travelViewLine({ place: 'Daggerfall', region: 'Daggerfall' }), 'Daggerfall, Daggerfall');
  assert.equal(travelViewLine({ near: 'Ripwych', region: 'Daggerfall' }), 'Near Ripwych, Daggerfall');
  assert.equal(travelViewLine({ region: 'Wrothgarian Mountains' }), 'The wilds of Wrothgarian Mountains');
});

// ── THE FOCUS: THE WEATHER IS THE TRAVELLER'S ──────────────────────────────────────────────────────────────────────

test('TV1 focus: the fog and the sun\'s cascades measure from the focus - the camera while none is set (w 0), so the default is today\'s law; declared once however many blocks a program takes', () => {
  assert.match(FOCUS_GLSL, /^#ifndef DAG_FOCUS\n#define DAG_FOCUS\nuniform vec4 uFocus;\nvec3 focusOrigin\(\) \{ return uFocus\.w > 0\.5 \? uFocus\.xyz : uCamPos; \}\n#endif$/);
  assert.match(FOG_GLSL, /float d = length\(worldPos - focusOrigin\(\)\);/);
  assert.ok(FOG_GLSL.startsWith(FOCUS_GLSL), 'the fog block carries the guard');
  assert.match(SHADOW_GLSL, /float d = length\(wp - focusOrigin\(\)\);/, 'the cascade pick');
  assert.ok(SHADOW_GLSL.includes(FOCUS_GLSL), 'and so does the receiver block');
  // a program with both blocks: the guard keeps it to one declaration after the preprocessor
  const both = `${SHADOW_GLSL}\n${FOG_GLSL}`;
  assert.equal((both.match(/uniform vec4 uFocus;/g) ?? []).length, 2, 'written twice...');
  assert.equal((both.match(/#ifndef DAG_FOCUS/g) ?? []).length, 2, '...each behind the same guard');
  // the renderer: every fog table looks the uniform up, the one upload sends it, setFocus sets w, the sun map stands on it
  const r = rd('src/render/renderer.js');
  assert.equal((r.match(/focus: gl\.getUniformLocation\([A-Za-z.]+, 'uFocus'\)/g) ?? []).length, 3, 'the water, the world programs\' factory, the character quad');
  assert.match(r, /focus: u\('uFocus'\)/, 'the lane\'s tables');
  assert.match(r, /if \(prog\.focus\) gl\.uniform4fv\(prog\.focus, this\._focus\);/);
  assert.match(r, /eye: this\._shadowEye\(\), lightDir, sunScale: this\._sunScale, pointLights: this\._pointLights, carried: this\._pointCarried,/);
});

test('TV1 focus: setFocus writes w 1 with the point and w 0 without it, moving the frame stamp only on a change; the sun map stands on the focus while set', async () => {
  const { Renderer } = await import('../src/render/renderer.js');
  const fake = { _focus: new Float32Array(4), _camPos: new Float32Array([1, 2, 3]), _frameStamp: 0 };
  Renderer.prototype.setFocus.call(fake, null);
  assert.equal(fake._frameStamp, 0, 'none to none: nothing re-sent');
  Renderer.prototype.setFocus.call(fake, [10, 20, 30]);
  assert.deepEqual([...fake._focus], [10, 20, 30, 1]);
  assert.equal(fake._frameStamp, 1);
  assert.deepEqual([...Renderer.prototype._shadowEye.call(fake)], [10, 20, 30]);
  Renderer.prototype.setFocus.call(fake, null);
  assert.deepEqual([...fake._focus], [0, 0, 0, 0]);
  assert.equal(fake._frameStamp, 2);
  assert.deepEqual([...Renderer.prototype._shadowEye.call(fake)], [1, 2, 3], 'the camera again');
});

// ── THE WORLD HOST'S WIRING ─────────────────────────────────────────────────────────────────────────────────────────

test('TV1 host wiring: the frame draws from the view\'s eye risen out of the body\'s own camera, the fog from the traveller\'s head, the sky and the flats turned to the view, no grass, hand or crosshair plaque from the air', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /eyeOverride: travelView\?\.active \? travelView\.eye : null,/);
  assert.match(w, /const tvf = travelView\?\.frame\(dt, \{ eye: mwv0\.ownEye \?\? mwv0\.eye, fwd \}\) \?\? null;\n\s*const mwv = tvf \? \{ \.\.\.mwv0, eye: tvf\.eye \} : mwv0;\n\s*const viewFwd = tvf \? tvf\.fwd : fwd;\n\s*renderer\.setFocus\(tvf \? cam\.pos : null\);/);
  assert.match(w, /lookAt\(mwv\.eye, \[mwv\.eye\[0\] \+ viewFwd\[0\], mwv\.eye\[1\] \+ viewFwd\[1\], mwv\.eye\[2\] \+ viewFwd\[2\]\], \[0, 1, 0\]\)/);
  assert.match(w, /sky\.draw\(tvf \? tvf\.yaw : cam\.yaw, tvf \? tvf\.pitch : cam\.pitch, fieldOfView\(\),/);
  assert.match(w, /const _bbYaw = tvf \? tvf\.yaw : cam\.yaw;/);
  assert.match(w, /const bbUp = tvf \? tvf\.up : UP_Y;/);
  assert.equal((w.match(/renderer\.drawBillboards\(.*, camRight, bbUp\);/g) ?? []).length, 3, 'the flats, the missiles, the townsfolk');
  assert.match(w, /renderer\.recordShadowBillboards\(castBatches, camRight, UP_Y\)/, 'their shadows stand upright');
  assert.match(w, /if \(labGrass && !tvf\) \{/);
  assert.match(w, /if \(walkMode && playerSpawned && !tvf\) weaponRig\.draw\(\{ paralyzed \}\);/);
  assert.match(w, /if \(tvf\) hideWorldPlaque\(\);/);
  assert.match(w, /travelView\?\.steer\(dt\);/);
  assert.match(w, /travelView\?\.drawHud\(\);/);
  assert.match(w, /audio\.setListener\(cam\.pos, tvf \? \[viewFwd\[0\], 0, viewFwd\[2\]\] : fwd\);/);
  // the cursor toggle cannot take the view's free cursor back, and the loop's death takes the view with it
  assert.match(w, /bindCursorToggle\(canvas, \(\) => gamePaused\(\) \|\| \(modes\?\.modalWindowUp\?\.\(\) \?\? false\) \|\| !!travelView\?\.active,/);
  assert.match(w, /destroyWorldPlaque\(\); travelView\?\.dispose\(\); disposeTravelViewHud\(\); return;/);
  // the view's host deps: the deck the sky draws, the foes the map refuses on, the body held, the cursor freed
  assert.match(w, /cloudBase: \(\) => VC_PROFILE\[weather\]\?\.base \?\? null,/);
  assert.match(w, /danger: \(\) => areEnemiesNearby\(exteriorFoePool\(\)\),/);
  assert.match(w, /holdBody: \(on\) => mwViewHoldThird\(on\),/);
  assert.match(w, /freeCursor: \(free\) => \{ setCursorActive\(free\); if \(free\) releaseLook\(\); else requestLook\(canvas\); \},/);
  // the gate: the enhanced lane, a walking body in the open air, alive and above the water - each refusal said
  const gate = w.slice(w.indexOf('const travelViewAllowed = () => {'), w.indexOf('const travelViewWhere = () => {'));
  for (const [why, re] of [['enhanced', /if \(!isEnhanced\(\)\) return \{ ok: false, why: TRAVEL_VIEW_TEXT\.enhancedOnly \};/], ['walking', /if \(params\.has\('fly'\) \|\| !walkMode \|\| !playerSpawned\) return \{ ok: false \};/],
    ['open air', /if \(\(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) return \{ ok: false, why: TRAVEL_VIEW_TEXT\.indoors \};/], ['alive', /if \(!\(\(playerEntity\.health \?\? 0\) > 0\)\) return \{ ok: false \};/],
    ['above the water', /if \(dwPlayer\?\.submerged\) return \{ ok: false, why: TRAVEL_VIEW_TEXT\.underwater \};/]]) assert.match(gate, re, `the gate refuses ${why}`);
  // THE FOUR HOSTS RULE: the view is this host's alone, and the other three never grow one
  for (const f of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    assert.doesNotMatch(rd(f), /createTravelView|travelView\./, `${f} has no travel view`);
  }
  assert.match(rd('src/scenes/travelView.js'), /THE FOUR HOSTS RULE names all four - world\.js WIRED; exterior\.js, the\s*\n\/\/ dev scene's fixed city, NOT WIRED on purpose/);
});

test('TV1 key: TravelView is the port\'s own action, appended, drawn in the Windows group and SHIPPED UNBOUND - the map\'s door is the way in', () => {
  assert.equal(ACTIONS.at(-1), 'TravelView', 'appended - a saved file resolves the rest by position');
  assert.ok(PORT_ACTIONS.includes('TravelView'));
  assert.equal(DEFAULT_BINDINGS.find(([, a]) => a === 'TravelView'), undefined, 'no default key');
  const windows = ACTION_GROUPS.find((g) => g.name === 'Windows' || g.title === 'Windows' || g.label === 'Windows');
  assert.ok(windows?.rows.some((r) => r.action === 'TravelView'), 'the pane draws it');
  assert.match(rd('src/scenes/world.js'), /if \(act === 'TravelView'\) \{ if \(!travelView\?\.active\) travelView\?\.enter\(\); return true; \}/);
});

test('TV1 body: the seam holds whichever body answers out of the head for the view, hands it back as it found it, and hides every first-person piece while it holds', async () => {
  const mv = await import('../src/player/mwView.js');
  const { eotbCamera } = await import('../src/player/eotbCamera.js');
  const src = rd('src/player/mwView.js');
  // the EOTB lane, when it can draw: held into third, handed back to first
  mv.setEotbBodyReady(() => true);
  try {
    assert.equal(mv.eotbLane(), true, 'the sprite lane opens once its body can draw - the arm below must run, not skip');
    {
      if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
      assert.equal(mv.mwViewHoldThird(true), true);
      assert.equal(eotbCamera.thirdPerson(), true, 'out of the head');
      assert.equal(mv.mwViewHeldThird(), 'eotb');
      assert.deepEqual(mv.mwViewHides(), { weapon: true, horse: true, spellHands: true }, 'no hand, horse or weapon on the raised camera');
      assert.equal(mv.mwViewHoldThird(false), true);
      assert.equal(eotbCamera.thirdPerson(), false, 'back into the head it was in');
      // a player already in third person stays there
      eotbCamera.toggleOffset(true);
      mv.mwViewHoldThird(true);
      mv.mwViewHoldThird(false);
      assert.equal(eotbCamera.thirdPerson(), true, 'the view hands back what it found');
      eotbCamera.toggleOffset(false);
    }
  } finally { mv.setEotbBodyReady(() => false); }
  assert.equal(mv.mwViewHeldThird(), undefined, 'nothing held');
  // the Morrowind rig: out by the restore door, back by the head's own door; the saddle holds nothing (RIDE-POV)
  assert.match(src, /if \(fpArm\.canThirdPerson\(\) && !mounted\) \{/);
  assert.match(src, /else if \(h\.changed && h\.lane === 'mw'\) mwIntoHead\(\);/);
  // the frame hands the view's eye to the sprite and keeps the body's own for the rise
  assert.match(src, /cameraPos: eyeOverride \?\? out\.eye/);
  assert.match(src, /return eyeOverride \? \{ \.\.\.out, eye: eyeOverride, ownEye: out\.eye \} : out;/);
  assert.match(src, /return eyeOverride \? \{ \.\.\.eye, eye: eyeOverride, ownEye: eye\.eye \} : eye;/);
});
