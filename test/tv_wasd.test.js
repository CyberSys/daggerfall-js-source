// TV-WASD (2026-09-28, Mac: "Also need to add the ability to travel faster with WASD") - THE OVERWORLD'S KEYS TRAVEL.
// Under the travel view the movement keys walked the traveller at walking pace (TV1); now, while the view is up and no
// journey drives, a held movement key runs the world's clock at the Travel Options spinner's speed, held by TV2's load
// governor, and x1 again the moment the keys are let go, a journey begins or the view comes down.
//
// Pinned here: the law (scenes/travelView.js travelWalkRate) gate by gate; the bar's words; and the world host's own
// governor - its source MOUNTED over the real load governor and the real clock (systems/timeScale.js) - with the
// frame's two "no panel, no scale" nets that spare it, and the ground gate its walk waits on, by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { travelWalkRate, TRAVEL_VIEW_TEXT, TV_MOVE_ACTIONS } from '../src/scenes/travelView.js';
import { createLoadGovernor, unbuiltAround, TV_GOV_HOLD_S } from '../src/systems/travelGovernor.js';
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../src/systems/timeScale.js';
import { travelDriveForward } from '../src/systems/travelAutopilot.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');

test('TV-WASD: the keys travel at the spinner\'s speed (never past its limit) while the view is up, no journey drives, a movement key is held, the body is on its own feet and nothing is paused - else 0, walking pace', () => {
  const up = { viewUp: true, journey: false, moving: true, onFoot: true, paused: false, accel: 10, limit: 100 };
  assert.equal(travelWalkRate(up), 10, 'the spinner\'s x10');
  assert.equal(travelWalkRate({ ...up, accel: 40, limit: 30 }), 30, 'never past the limit in force (a ring walk\'s half limit)');
  assert.equal(travelWalkRate({ ...up, viewUp: false }), 0, 'the view rising, falling or down: walking pace');
  assert.equal(travelWalkRate({ ...up, journey: true }), 0, 'a journey drives: its own ask, not the keys\'');
  assert.equal(travelWalkRate({ ...up, moving: false }), 0, 'the keys let go');
  assert.equal(travelWalkRate({ ...up, onFoot: false }), 0, 'swimming, at a helm or aboard: the keys are the sea\'s');
  assert.equal(travelWalkRate({ ...up, paused: true }), 0, 'a window');
  assert.equal(travelWalkRate({ ...up, accel: 1 }), 0, 'a spinner at x1 is walking pace');
  assert.equal(travelWalkRate({ ...up, accel: 0, limit: 0 }), 0, 'Travel Options off: no spinner, no speed');
  assert.equal(travelWalkRate(), 0);
  assert.deepEqual([...TV_MOVE_ACTIONS], ['MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight'], 'the four keys');
});

test('TV-WASD: the bar says the speed, and the load governor\'s hold beside it', () => {
  assert.equal(TRAVEL_VIEW_TEXT.travelling(10), 'Travelling at ×10');
  assert.equal(TRAVEL_VIEW_TEXT.travelling(10, 5), 'Travelling at ×5 of ×10');
  assert.equal(TRAVEL_VIEW_TEXT.travelling(10, 10), 'Travelling at ×10', 'a hold at the full speed is no hold');
  // PIN MOVED (AUDIT OW5 G3): the keys' speed first - it runs only with no journey driving, and a stopped route kept for the Resume hid it
  assert.match(WORLD, /trip: \(\) => \(tvWalking \? TRAVEL_VIEW_TEXT\.travelling\(tvWalking, tvHeld\) : tvTripLive\(\) \? tvTrip\.line : ''\),/, 'the keys\' speed, else a journey\'s own line');
});

/** world.js's governor, mounted from its own source: `let tvHeld` through the end of travelViewGovern. */
function mountGovernor(env) {
  const from = WORLD.indexOf('  let tvFoeRate = ');   // ENEMY-PACE: the near-enemies pace and its floor ride in front of tvHeld
  const fn = WORLD.indexOf('  function travelViewGovern(dt) {', from);
  const end = WORLD.indexOf('\n  }\n', fn) + 4;
  assert.ok(from >= 0 && fn > from && end > fn, 'the governor\'s source');
  const names = Object.keys(env);
  return new Function(...names, `${WORLD.slice(from, end)}\nreturn { govern: travelViewGovern, holds: tvWalkHoldsTimeScale, walking: () => tvWalking, held: () => tvHeld };`)(...names.map((k) => env[k]));
}

function rig({ spinner = 10, limit = 100 } = {}) {
  const w = { keys: new Set(), view: { active: true, state: 'up' }, journey: false, swimming: false, boat: null, paused: false, unbuilt: new Set() };
  const env = {
    travelControlUI: { get isShowing() { return w.journey; }, timeAcceleration: spinner, accelerationLimit: () => limit },
    travelOptions: { get state() { return { autopilot: w.journey ? {} : null }; } },
    travelWalkRate, TV_MOVE_ACTIONS,
    travelView: w.view,   // a live object: the tests move its state
    held: (keys, a) => keys.has(a), keys: w.keys,
    walkMode: true, playerSpawned: true,
    player: { get isPlayerSwimming() { return w.swimming; } },
    csaBoatUnderMe: () => w.boat, gamePaused: () => w.paused,
    setWorldTimeScale: setTimeScale, worldTimeScale: timeScale, resetTimeScale,
    travelAsked: 20, csaHoldsTimeScale: () => false,
    travelGovernor: createLoadGovernor({ max: MAX_TIME_SCALE }),
    state: { terrainDistance: 3 }, playerTravelPixel: () => ({ x: 100, y: 200 }), tvGroundGenNow: () => w.unbuilt.size,
    unbuiltAround, built: { has: (k) => !w.unbuilt.has(k) },
    journeyThreatCap: () => ({ cap: Infinity }), journeySlowSaid: () => {},   // OW6: no enemy about (test/ow6_slowdown.test.js runs the cap)
  };
  return { w, g: mountGovernor(env) };
}

test('TV-WASD host: the world\'s own governor (mounted) runs the clock at the keys\' speed while they are held under the view, x1 again the moment they are let go', () => {
  resetTimeScale();
  const { w, g } = rig();
  g.govern(1 / 60);
  assert.equal(timeScale(), 1, 'no key held: walking pace');
  w.keys.add('MoveForwards');
  g.govern(1 / 60);
  assert.equal(timeScale(), 10, 'W held: the spinner\'s x10');
  assert.equal(g.walking(), 10);
  assert.equal(g.holds(), true, 'the frame\'s nets spare it');
  w.keys.clear();
  g.govern(1 / 60);
  assert.equal(timeScale(), 1, 'let go: x1 at once');
  assert.equal(g.walking(), 0);
  assert.equal(g.holds(), false);
  resetTimeScale();
});

test('TV-WASD host (AUDIT OW5 G4): the page losing the focus with a key held lets the keys\' travel go - the key\'s keyup never comes, and the clock ran on at the spinner\'s rate', () => {
  resetTimeScale();
  const { w, g } = rig();
  const had = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let focused = true;
  Object.defineProperty(globalThis, 'document', { value: { hasFocus: () => focused }, configurable: true, writable: true });
  try {
    w.keys.add('MoveForwards');
    g.govern(1 / 60);
    assert.equal(timeScale(), 10, 'W held, the page focused: x10');
    focused = false;
    g.govern(1 / 60);
    assert.equal(timeScale(), 1, 'the focus lost with W still held: x1 at once');
    assert.equal(g.walking(), 0);
  } finally {
    if (had) Object.defineProperty(globalThis, 'document', had); else delete globalThis.document;
    resetTimeScale();
  }
});

test('TV-WASD host: the load governor holds the keys\' travel to what the land raises, as it holds a journey - and the bar is told', () => {
  resetTimeScale();
  const { w, g } = rig({ spinner: 40 });
  w.keys.add('MoveLeft');
  w.unbuilt.add('101,200');   // a pixel of the ring the view can see, not yet raised
  g.govern(0.1);
  assert.equal(timeScale(), 40, 'the first frame: the full speed');
  g.govern(TV_GOV_HOLD_S);
  assert.equal(timeScale(), 20, 'the hole stood a quarter second: halved');
  assert.equal(g.held(), 20, 'the bar says ×20 of ×40');
  assert.equal(g.walking(), 40);
  resetTimeScale();
});

test('TV-WASD host: a journey\'s ask wins over the keys; the view down, a window, swimming or a helm put the clock back to one; a view cut by a door is no longer spared', () => {
  resetTimeScale();
  const { w, g } = rig();
  w.keys.add('MoveForwards');
  g.govern(1 / 60);
  assert.equal(timeScale(), 10);
  w.journey = true;
  g.govern(1 / 60);
  assert.equal(timeScale(), 20, 'the journey\'s own ask (the mod\'s x20)');
  assert.equal(g.walking(), 0);
  w.journey = false;
  g.govern(1 / 60);
  assert.equal(timeScale(), 10);
  for (const [what, set, unset] of [
    ['a window', () => { w.paused = true; }, () => { w.paused = false; }],
    ['swimming', () => { w.swimming = true; }, () => { w.swimming = false; }],
    ['at a helm', () => { w.boat = {}; }, () => { w.boat = null; }],
    ['the view falling', () => { w.view.state = 'falling'; }, () => { w.view.state = 'up'; }],
  ]) {
    set();
    g.govern(1 / 60);
    assert.equal(timeScale(), 1, what);
    unset();
    g.govern(1 / 60);
    assert.equal(timeScale(), 10, `${what} over: the keys travel again`);
  }
  // a door cuts the view before the frame's net asks (world.js AUDIT DEEP X-1): the scale is no longer spared
  w.view.active = false;
  assert.equal(g.holds(), false, 'the view gone: the net resets the scale');
  g.govern(1 / 60);
  assert.equal(timeScale(), 1);
  resetTimeScale();
});

test('TV-WASD host: the frame\'s two "a scale with no panel is a journey over" nets spare the keys\' travel; the keys\' walk waits for the ground the way they move the body', () => {
  assert.match(WORLD, /if \(!travelControlUI\?\.isShowing && worldTimeScale\(\) !== 1 && !csaHoldsTimeScale\(\) && !tvWalkHoldsTimeScale\(\)\) resetTimeScale\(\);   \/\/ CSA-G: a scale the helm's time keys set/, 'the net above every mode gate');
  assert.match(WORLD, /if \(!travelControlUI\?\.isShowing && worldTimeScale\(\) !== 1 && !csaHoldsTimeScale\(\) && !tvWalkHoldsTimeScale\(\)\) resetTimeScale\(\);   \/\/ the panel gone is the journey over/, 'the net after the mod\'s update');
  assert.match(WORLD, /const tvWalkHoldsTimeScale = \(\) => tvWalking > 0 && !!travelView\?\.active;/);
  assert.match(WORLD, /travelViewGovern\(dt\);[^\n]*\n\s*const travelScale = worldTimeScale\(\);/, 'governed before the frame reads its scale');
  // the ground gate: after the journey's own drive, on the keys' own heading
  const drive = WORLD.indexOf('        if (_travelDrive) {\n          cam.yaw = (_travelDrive.yaw * Math.PI) / 180;');
  const gate = WORLD.indexOf('        if (tvWalking && !_travelDrive && (axes.forward || axes.strafe)) {', drive);
  const motor = WORLD.indexOf('player.update(dt, paralyzed ?', drive);
  assert.ok(drive > 0 && gate > drive && motor > gate, 'the keys\' gate after the journey\'s, before the motor');
  assert.match(WORLD.slice(gate, motor), /const way = cam\.yaw \+ Math\.atan2\(axes\.strafe, axes\.forward\);\n\s*if \(travelDriveForward\(\{ feet: _feet, yaw: way, heightAt, lookahead: travelLookahead\(dt, travelScale\), streaming: !!\(building \|\| queue\.length \|\| inFlight\.size\), forward: 1 \}\) === 0\) \{ axes\.forward = 0; axes\.strafe = 0; \}/);
  // the heading law: D alone walks the motor's right, (cos, 0, -sin) - at yaw 0 that is +x; a hole there holds it
  const heightAt = (x) => (x > 50 ? -Infinity : 0);
  const way = (yaw, strafe, forward) => yaw + Math.atan2(strafe, forward);
  assert.equal(travelDriveForward({ feet: [0, 0, 0], yaw: way(0, 1, 0), lookahead: 64, heightAt, streaming: true, forward: 1 }), 0, 'strafing right into the hole: held');
  assert.equal(travelDriveForward({ feet: [0, 0, 0], yaw: way(0, 0, 1), lookahead: 64, heightAt, streaming: true, forward: 1 }), 1, 'forward, along +z: the ground is there');
});
