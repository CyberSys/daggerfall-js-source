// CLIMB4 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I reallty want go to go all in with the
// detai. Liike proer feel to climbing"): THE FEEL. The motor's climb events (motor.js _pkEmit), the camera's law over
// them (player/climbFeel.js - the catch's dip, the sway, the shimmy's and the free climb's rhythm, the pull-up's look,
// the lower's and the corner's and the eject's turn, the leap's kick, the grip's tremble), its view half
// (applyClimbView), the look filter's turn, and every host that draws a first-person view applying it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerMotor } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import { ClimbFeel, applyClimbView, FEEL, bump, tremble } from '../src/player/climbFeel.js';
import { LookFilter, takeFrameLook } from '../src/player/lookFilter.js';
import { lookAt } from '../src/world/mat4.js';
import { PARKOUR_GRIP_LOW } from '../src/player/parkour.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BOX_IDX = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
const blank = { forward: 0, strafe: 0, run: false, jump: false, crouch: false };
const DEG = Math.PI / 180;
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
function world() {
  const col = new Collider(() => 0);
  let n = 0;
  const box = (...b) => col.addMesh(`b${n++}`, new Float32Array([b[0], b[1], b[2], b[3], b[1], b[2], b[3], b[4], b[2], b[0], b[4], b[2], b[0], b[1], b[5], b[3], b[1], b[5], b[3], b[4], b[5], b[0], b[4], b[5]]), BOX_IDX, I);
  return { col, box };
}
function climber(col, skill = 50) {
  return new PlayerMotor(col, { speed: 50, running: 30 }, {
    parkour: { enabled: () => true, inputs: () => ({ climbing: skill, jumping: skill }), say: () => {}, tally: () => {} },
  });
}
/** A stand-in motor for the law alone: its state set by the test. */
function fake(over = {}) {
  return { climbEvents: [], pos: [0, 0, 0], onWall: false, hanging: false, climbMove: null, wallNormal: null, grip: 1, ...over };
}
const frames = (feel, m, n, yaw = 0, each = null) => {
  const outs = [];
  for (let i = 0; i < n; i++) { each?.(i, m); outs.push({ ...feel.update(1 / 60, m, yaw), eye: [...feel.out.eye] }); m.climbEvents = []; }
  return outs;
};

test('CLIMB4 F1: the motor tells the frame its climb - a hold taken and let go, a move begun (its kind, time, rise, the speed it came at), a corner\'s turn, a leap\'s launch, the grip failing', () => {
  const w = world();
  w.box(-3, 0, 1, 3, 2.3, 4);
  const m = climber(w.col);
  m.spawn(0, 0.02, 0.4);
  const seen = [];
  for (let i = 0; i < 120; i++) { m.update(1 / 60, { ...blank, jump: i > 5 && i < 40 }, 0); for (const e of m.climbEvents) seen.push(e); }
  const move = seen.find((e) => e.type === 'move');
  assert.ok(move && move.kind === 'catch' && move.speed >= 0 && Number.isFinite(move.dur) && move.normal, 'a catch: its kind, its time, the speed it came at, the wall');
  assert.ok(seen.some((e) => e.type === 'hold' && e.mode === 'hang'), 'the hold it ends in');
  // the frame's events are the frame's: cleared at the next update
  m.update(1 / 60, blank, 0);
  assert.deepEqual(m.climbEvents, [], 'cleared each update');
  // Crouch lets go: the release
  m.update(1 / 60, { ...blank, crouch: true }, 0);
  m.update(1 / 60, blank, 0);
  assert.ok(seen.concat(m.climbEvents).some((e) => e.type === 'release') || !m.onWall, 'let go');
});

test('CLIMB4 F2: a catch dips the eye and pitches the view down, harder the faster the body came to the lip, and springs back; nothing on the wall, nothing at all', () => {
  const dip = (speed) => {
    const feel = new ClimbFeel();
    const m = fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1], climbMove: { t: 0 } });
    m.climbEvents = [{ type: 'move', kind: 'catch', dur: 0.15, rise: 0.3, speed, way: [0, 0], normal: [0, 0, -1] }];
    const outs = frames(feel, m, 90, 0, (i, mm) => { if (i > 9) mm.climbMove = null; });
    return { low: Math.min(...outs.map((o) => o.eye[1])), pitch: Math.min(...outs.map((o) => o.pitch)), end: outs[outs.length - 1] };
  };
  const soft = dip(0), hard = dip(10);
  assert.ok(soft.low < -0.005, `a catch from a standstill dips the eye (${soft.low.toFixed(3)} m)`);
  assert.ok(hard.low < soft.low * 1.5, `a fall caught at 10 m/s dips it harder (${hard.low.toFixed(3)} m)`);
  assert.ok(hard.pitch < 0, 'and pitches the view down');
  assert.ok(Math.abs(hard.end.eye[1]) < 0.01 && Math.abs(hard.end.pitch) < 0.01, 'sprung back within a second and a half');
  const rest = frames(new ClimbFeel(), fake(), 30);
  assert.ok(rest.every((o) => o.pitch === 0 && o.roll === 0 && o.eye[1] === 0 && o.fov === 0 && o.yaw === 0), 'off the wall with nothing in flight: nothing');
});

test('CLIMB4 F3: on the wall - hanging sways a little, the shimmy rolls toward its way with each hand, the free climb bobs hand over hand, the hands taking turns; a failing grip trembles', () => {
  // hanging still: a slow sway, small
  const sway = frames(new ClimbFeel(), fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1] }), 600);
  const rolls = sway.map((o) => o.roll);
  assert.ok(Math.max(...rolls) > 0.1 * DEG && Math.min(...rolls) < -0.1 * DEG && Math.max(...rolls.map(Math.abs)) <= FEEL.SWAY_ROLL_DEG * DEG * 1.05, 'a sway both ways, under its bound');
  // the shimmy (the wall's normal -z: facing it, the hands' right is +x - motor.js _wallStep's `along`): the roll leans
  // the way the hands go
  for (const [dx, sign] of [[0.02, 1], [-0.02, -1]]) {
    const sh = fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1] });
    const shim = frames(new ClimbFeel(), sh, 60, 0, (i, mm) => { mm.pos = [dx * i, 0, 0]; });
    const peak = shim.reduce((a, o) => (Math.abs(o.roll) > Math.abs(a) ? o.roll : a), 0);
    assert.ok(Math.sign(peak) === sign && Math.abs(peak) > 0.5 * DEG, `the shimmy ${sign > 0 ? 'right' : 'left'} rolls that way (${(peak / DEG).toFixed(2)} degrees)`);
    assert.ok(shim.some((o) => o.eye[1] > 0.004), 'and lifts a little with each reach');
  }
  // the free climb: one reach every FEEL.REACH, the eye bobbing, the roll swapping sides each reach
  const fc = fake({ onWall: true, hanging: false, wallNormal: [0, 0, -1] });
  const climb = frames(new ClimbFeel(), fc, 240, 0, (i, mm) => { mm.pos = [0, 0.01 * i, 0]; });
  const ys = climb.map((o) => o.eye[1]);
  assert.ok(Math.max(...ys) > FEEL.CLIMB_BOB * 0.5 && Math.min(...ys) < -FEEL.CLIMB_BOB * 0.5, 'hand over hand: the eye bobs up and down');
  const rollSigns = climb.slice(30).map((o) => Math.sign(o.roll));
  assert.ok(rollSigns.includes(1) && rollSigns.includes(-1), 'the roll swaps from one hand to the other');
  // the grip failing: a tremble that grows as it runs out
  const shake = (grip) => {
    const outs = frames(new ClimbFeel(), fake({ onWall: true, hanging: true, wallNormal: [0, 0, -1], grip }), 300);
    let tv = 0;
    for (let i = 101; i < outs.length; i++) tv += Math.abs(outs[i].roll - outs[i - 1].roll);
    return tv;
  };
  assert.ok(shake(PARKOUR_GRIP_LOW * 0.2) > shake(1) * 3, 'a failing grip trembles far more than a fresh one sways');
  assert.ok(Math.abs(tremble(1.234)) <= 1, 'the tremble is bounded');
});

test('CLIMB4 F4: the moves - a pull-up looks up at the lip then down over it, a vault pitches down over the top, a lower looks down over the edge and turns the view to face the wall, a corner turns it with the wall', () => {
  const curve = (kind, extra = {}) => {
    const feel = new ClimbFeel();
    const m = fake({ climbMove: { t: 0 } });
    m.climbEvents = [{ type: 'move', kind, dur: 1, rise: 1.5, speed: 0, turn: 0, way: [0, 0], normal: null, ...extra }];
    let yaw = 0;
    const outs = frames(feel, m, 70, 0, (i, mm) => { mm.climbMove = i < 60 ? { t: i / 60 } : null; });
    for (const o of outs) yaw += o.yaw;
    return { outs, yaw };
  };
  const mantle = curve('mantle').outs.map((o) => o.pitch);
  assert.ok(Math.max(...mantle.slice(0, 25)) > 1 * DEG, 'the pull-up looks up at the lip first');
  assert.ok(Math.min(...mantle.slice(30, 60)) < -2 * DEG, 'then down over it as the body crests');
  assert.ok(Math.min(...curve('vault').outs.map((o) => o.pitch)) < -2 * DEG, 'a vault pitches down over the top');
  const lower = curve('lower', { normal: [0, 0, -1] });
  assert.ok(Math.min(...lower.outs.map((o) => o.pitch)) < -4 * DEG, 'a lower looks down over the edge');
  // facing +z (yaw 0) and lowering onto a wall whose normal is -z... the wall is at +z: already faced
  assert.ok(near(lower.yaw, 0, 1e-3), 'facing the wall already: no turn');
  const back = curve('lower', { normal: [0, 0, 1] });   // the wall at -z: the view turns half round to face it
  assert.ok(near(Math.abs(back.yaw), Math.PI, 0.02), `the view turned to face the wall (${(back.yaw / DEG).toFixed(1)} degrees)`);
  const corner = curve('corner', { turn: Math.PI / 2 });
  assert.ok(near(corner.yaw, Math.PI / 2, 0.02), `a corner turns the view with the wall (${(corner.yaw / DEG).toFixed(1)} degrees)`);
  assert.ok(near(bump(0.5, 0, 1), 1) && bump(0, 0, 1) === 0 && bump(1.2, 0, 1) === 0, 'the bump');
});

test('CLIMB4 F5: leaps - a launch kicks the field of view and the eject turns the view the way it flew; a side leap rolls toward its side', () => {
  const feel = new ClimbFeel();
  const m = fake();
  m.climbEvents = [{ type: 'launch', dir: [0, 0, -1], along: 4.5, up: 3.75 }];
  let yaw = 0;
  const outs = frames(feel, m, 90, 0);
  for (const o of outs) yaw += o.yaw;
  assert.ok(Math.max(...outs.map((o) => o.fov)) > 2, `the field of view kicked (${Math.max(...outs.map((o) => o.fov)).toFixed(1)} degrees)`);
  assert.ok(Math.abs(outs[outs.length - 1].fov) < 0.3, 'and settled');
  assert.ok(near(Math.abs(yaw), Math.PI, 0.02), `the view turned the way it flew (${(yaw / DEG).toFixed(1)} degrees)`);
  // a side leap to the hands' right (the wall's normal -z: +x) rolls right, to the left left
  for (const [wx, sign] of [[1.5, 1], [-1.5, -1]]) {
    const side = new ClimbFeel();
    const s = fake({ climbMove: { t: 0 } });
    s.climbEvents = [{ type: 'move', kind: 'leap', dur: 0.5, rise: 0, speed: 0, turn: 0, way: [wx, 0], normal: [0, 0, -1] }];
    const so = frames(side, s, 30, 0, (i, mm) => { mm.climbMove = { t: i / 30 }; });
    const peak = so.reduce((a, o) => (Math.abs(o.roll) > Math.abs(a) ? o.roll : a), 0);
    assert.ok(Math.sign(peak) === sign && Math.abs(peak) > 1 * DEG, `a leap ${sign > 0 ? 'right' : 'left'} rolls that way (${(peak / DEG).toFixed(2)})`);
  }
});

test('CLIMB4 F6: the view half - pitch up tilts the forward up, roll right lowers the right, the eye offset moves the camera and nothing else; zero effects leave the view untouched', () => {
  const v = lookAt([0, 1.7, 0], [0, 1.7, 1], [0, 1, 0]);
  const base = Float32Array.from(v);
  applyClimbView(v, { pitch: 0, roll: 0, eye: [0, 0, 0], fov: 0, yaw: 0 });
  assert.deepEqual([...v], [...base], 'no effect, no change');
  const fwd = (m) => [-m[2], -m[6], -m[10]];   // the camera's forward in the world: -(the view's third row)
  const right = (m) => [m[0], m[4], m[8]];
  const up = applyClimbView(Float32Array.from(base), { pitch: 10 * DEG, roll: 0, eye: [0, 0, 0] });
  assert.ok(fwd(up)[1] > 0.15, `pitch up tilts the forward up (${fwd(up)[1].toFixed(3)})`);
  const rr = applyClimbView(Float32Array.from(base), { pitch: 0, roll: 10 * DEG, eye: [0, 0, 0] });
  assert.ok(right(rr)[1] < -0.15, `roll right lowers the right (${right(rr)[1].toFixed(3)})`);
  const off = applyClimbView(Float32Array.from(base), { pitch: 0, roll: 0, eye: [0, -0.1, 0] });
  // the camera's position: -R^T t
  const pos = (m) => [-(m[0] * m[12] + m[1] * m[13] + m[2] * m[14]), -(m[4] * m[12] + m[5] * m[13] + m[6] * m[14]), -(m[8] * m[12] + m[9] * m[13] + m[10] * m[14])];
  assert.ok(near(pos(off)[1], 1.6, 1e-5) && near(pos(off)[0], 0) && near(pos(off)[2], 0), `the eye 10 cm down (${pos(off).map((x) => x.toFixed(3))})`);
  assert.deepEqual(fwd(off).map((x) => +x.toFixed(6)), fwd(base).map((x) => +x.toFixed(6)), 'and the look unchanged');
});

test('CLIMB4 F7: the look filter takes the climb\'s turn as owed look - paid out under its smoothing - and never as the frame\'s mouse look (the weapon widget does not sway to it)', () => {
  const f = new LookFilter();
  const cam = { yaw: 0, pitch: 0 };
  takeFrameLook();
  f.turn(1.0);
  assert.deepEqual(takeFrameLook(), [0, 0], 'not latched as the frame\'s look');
  for (let i = 0; i < 120; i++) f.tick(1 / 60, cam, { smoothing: 0.5 });
  assert.ok(near(cam.yaw, 1.0, 1e-3), `paid out (${cam.yaw.toFixed(4)})`);
});

test('CLIMB4 F8: every host that draws a first-person view frames the feel after its motor and lays its view half on the view - first person only - and the climb\'s kick and pitch on every lens of the frame', () => {
  const read = (f) => readFileSync(new URL(`../src/scenes/${f}.js`, import.meta.url), 'utf8');
  const w = read('world');
  assert.match(w, /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter\);/, 'world: one per body, the look filter its turn\'s');
  assert.ok(w.indexOf('climbFeel.frame(dt);') > w.lastIndexOf('cam.pos = player.eyeAt();', w.indexOf('climbFeel.frame(dt);')), 'world: framed after the eye');
  assert.match(w, /const view = betterAmbience\.view\(lookAt\(mwv\.eye[^\n]*\n\s*climbFeel\.view\(view, !tvf && !mwv\.thirdPerson\);/, 'world: the view half, first person, never the travel view');
  assert.match(w, /perspective\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), worldAspect/, 'world: the kick on the lens');
  assert.match(w, /sky\.draw\([^;]*cam\.pitch \+ climbFeel\.pitch\(\), fieldOfView\(\) \+ climbFeel\.fovRad\(\)/, 'world: the sky takes the pitch and the kick');
  assert.match(w, /fovY: fieldOfView\(\) \+ climbFeel\.fovRad\(\)/, 'world: so does the far ring');
  assert.match(w, /createWorldModes\(\{\n\s*climbFeel,/, 'world: the modal frames take the one handle');
  const wm = read('worldModes');
  assert.match(wm, /host\.climbFeel\?\.frame\(dt\);/, 'worldModes: framed');
  assert.ok(wm.indexOf('host.climbFeel?.frame(dt);') > wm.indexOf('cam.pos = player.eyeAt();   // EV1: the interpolated render eye\n    // DC1'), 'worldModes: after its eye');
  assert.match(wm, /const view = betterAmbience\.view\(lookAt\(mwv\.eye[^\n]*\n\s*host\.climbFeel\?\.view\(view, !decorTool\.flying\(\) && !mwv\.thirdPerson\);/, 'worldModes: the view half, never the decorator\'s free camera');
  assert.match(wm, /perspective\(fieldOfView\(\) \+ \(host\.climbFeel\?\.fovRad\(\) \?\? 0\)/, 'worldModes: the kick');
  const ex = read('exterior');
  assert.match(ex, /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter\);/);
  assert.match(ex, /climbFeel\.view\(view, walkMode && !riding && !mwv\.thirdPerson\);/, 'exterior: first person, never the ride view');
  assert.match(ex, /fieldOfView\(\) \+ climbFeel\.fovRad\(\),/);
  assert.match(ex, /sky\.draw\(Math\.atan2\(dx, dz\), Math\.atan2\(dy, horiz\) \+ climbFeel\.pitch\(\), fieldOfView\(\) \+ climbFeel\.fovRad\(\)/);
  const dg = read('dungeon');
  assert.match(dg, /const climbFeel = createClimbFeelHost\(\(\) => player, cam, lookFilter\);/);
  assert.match(dg, /climbFeel\.view\(view, walkMode && !mwv\.thirdPerson\);/, 'dungeon: first person, never the fly-cam');
  assert.match(dg, /perspective\(fieldOfView\(\) \+ climbFeel\.fovRad\(\)/);
  for (const [f, s] of [['world', w], ['exterior', ex], ['dungeon', dg]]) {
    assert.ok(s.indexOf('climbFeel.frame(dt);') > s.lastIndexOf('cam.pos = player.eyeAt();', s.indexOf('climbFeel.frame(dt);')), `${f}: framed after the eye`);
  }
});
