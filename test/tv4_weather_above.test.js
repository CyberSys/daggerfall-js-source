// TV4 (2026-09-28, bible/06-Systems/Travel-View.md, Mac: "Every detail like weather patterns, should be 1:1 in this
// mode").
//
// Pinned here: the curtains stood in the world for the view (render/rainCurtains.js - which cells fall, where the veil
// stands and how tall, its fade as the eye comes over it, the chord law in its shader, the fog from the traveller, the
// pass's own state), the four weather readings from the air measured against the laws that already hold them (the
// cloud shadow's square covers everything the view's fog lets through; the far ring under an exp fog is fog at its
// nearest edge, so its gate changes nothing; a strike's column stands on the traveller's ground), and the world host's
// wiring by source. The frame itself is proven in a browser by tools/travelViewProbe.mjs (TV4's four checks).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  curtainsOf, curtainClock, CURTAINS_MAX, CURTAIN_REACH_M, CURTAIN_BELOW_M, CURTAIN_FS, CURTAIN_VS, CURTAIN_CLOCK_PERIOD, CURTAIN_FALL_HZ,
  CURTAIN_RAIN_COLOR, CURTAIN_SNOW_COLOR, CURTAIN_FOOT_MARGIN_M, CURTAIN_FOOT_SAMPLES, lowestGround, RainCurtainsRenderer,
} from '../src/render/rainCurtains.js';
import { CURTAIN_SHARE, CURTAIN_EXT, CURTAIN_INTO, CURTAIN_FALL, SHADOW_EXTENT, PIXEL_METRES, VC_PROFILE, cellOf } from '../src/render/volumetricClouds.js';
import { FOG_SETTINGS, scaleFogForDistance, fogForWeather } from '../src/world/weather.js';
import { LAND_VIEW_MAX, LAND_VIEW_DEFAULT } from '../src/world/landView.js';
import { strikeColumn } from '../src/systems/lightning.js';
import { TV_HEIGHT_MAX, TV_TILT_MIN } from '../src/player/travelCamera.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ── THE CURTAINS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('TV4 curtains: the cells that FALL stand a veil - rain, the storm\'s heavier, snow paler; fog, cloud and a sandstorm stand none - VC7c\'s own cells and law', () => {
  const at = { focus: [0, 101.7, 0], eye: [0, 400, -300], ground: 100 };
  const cells = ['rain', 'thunder', 'snow', 'fog', 'cloudy', 'overcast', 'sandstorm', 'sunny'].map((w, i) => cellOf(w, 1000 + i * 10, 2000, 800));
  const got = curtainsOf(cells.filter(Boolean), at);
  assert.equal(got.length, 3, 'rain, thunder, snow');
  assert.deepEqual(Object.keys(CURTAIN_FALL).sort(), ['rain', 'snow', 'thunder']);
  const [r] = got.filter((c) => c.kind === 0).slice(0, 1);
  assert.equal(r.radius, 800 * CURTAIN_SHARE, 'the fall comes out of the core');
  assert.equal(r.depth, CURTAIN_EXT * CURTAIN_FALL.rain[0]);
  assert.equal(got.filter((c) => c.kind === 1).length, 1, 'snow, its own kind');
  const base = VC_PROFILE.rain.base + (VC_PROFILE.rain.top - VC_PROFILE.rain.base) * CURTAIN_INTO;
  assert.deepEqual(r.centre, [1000, 100 - CURTAIN_BELOW_M, 2000], 'its foot under the traveller\'s ground - the world\'s depth cuts it where the land is');
  assert.ok(near(r.height, 100 + base - (100 - CURTAIN_BELOW_M)), 'up a little into the cell it falls from');
  assert.deepEqual(CURTAIN_RAIN_COLOR.length, 3); assert.ok(CURTAIN_SNOW_COLOR[0] > CURTAIN_RAIN_COLOR[0], 'snow paler');
});

test('TV4 curtains: within reach of the traveller and no further, nearest first and at most CURTAINS_MAX; a young system\'s thinner; a storm\'s clip keeps its veil inside its disc', () => {
  const at = { focus: [0, 0, 0], eye: [0, 300, -200] };
  const cell = (x, z, fall = 1, extra = {}) => ({ x, z, r: 1000, base: 600, top: 2600, fall, fallKind: 0, ...extra });
  const far = CURTAIN_REACH_M + 1000 * CURTAIN_SHARE;
  assert.equal(curtainsOf([cell(far + 1, 0)], at).length, 0, 'past the reach');
  assert.equal(curtainsOf([cell(far - 1, 0)], at).length, 1, 'its rim within it');
  const many = Array.from({ length: 12 }, (_, i) => cell(2000 + i * 300, 0));
  const got = curtainsOf(many.reverse(), at);
  assert.equal(got.length, CURTAINS_MAX);
  assert.deepEqual(got.map((c) => c.centre[0]), got.map((c) => c.centre[0]).sort((a, b) => a - b), 'nearest first');
  assert.equal(curtainsOf([cell(3000, 0, 0.5)], at)[0].depth, CURTAIN_EXT * 0.5, 'a young system\'s rain is young too (grownCell\'s fall)');
  assert.equal(curtainsOf([cell(3000, 0, 0)], at).length, 0, 'nothing falls, no veil');
  assert.equal(curtainsOf([cell(3000, 0, 1, { clip: [9000, 0, 2000] })], at).length, 0, 'outside the disc its front paints within');
  assert.equal(curtainsOf([cell(3000, 0, 1, { clip: [3200, 0, 2000] })], at).length, 1);
  assert.deepEqual(curtainsOf(null, at), []);
});

test('TV4 curtains: the veil thins to nothing as the eye comes over it - the rain the traveller stands in is their own particles\'', () => {
  const c = { x: 0, z: 0, r: 1000, base: 600, top: 2600, fall: 1, fallKind: 0 };
  const R = 1000 * CURTAIN_SHARE;
  const alphaAt = (ex, fx = R * 3) => curtainsOf([c], { focus: [fx, 0, 0], eye: [ex, 300, 0] })[0]?.alpha ?? 0;
  assert.equal(alphaAt(R * 2), 1, 'from outside it: whole');
  assert.equal(alphaAt(R * 0.8), 0, 'the eye over its core: gone');
  const mid = alphaAt(R);
  assert.ok(mid > 0 && mid < 1, `across its rim it fades (${mid})`);
  // AUDIT TV D2: the traveller inside it with the eye still out - the storm's whole chord stood in front of their own ground
  assert.equal(alphaAt(R * 2, R * 0.5), 0, 'the traveller in the rain: it is theirs, not a wall between them and the eye');
  assert.ok(alphaAt(R * 2, R) > 0 && alphaAt(R * 2, R) < 1, 'at its rim: fading');
});

test('AUDIT TV D1/D3: the curtains come in with the view as OPACITY, never as a darker colour; the foot reaches under the LOWEST land about the veil (a valley under the storm), never above the traveller\'s own rule', () => {
  // D3: the foot
  const c = { x: 5000, z: 0, r: 1000, base: 600, top: 2600, fall: 1, fallKind: 0 };
  const R = 1000 * CURTAIN_SHARE;
  const at = { focus: [0, 101.7, 0], eye: [0, 400, -300], ground: 100 };
  assert.equal(curtainsOf([c], at)[0].centre[1], 100 - CURTAIN_BELOW_M, 'no host land: the traveller\'s rule');
  const valley = (x, z) => (Math.hypot(x - 5000, z) > R * 0.9 ? -900 : -200);
  const v = curtainsOf([c], { ...at, groundAt: valley })[0];
  assert.equal(v.centre[1], -900 - CURTAIN_FOOT_MARGIN_M, 'the valley floor at its rim, less the margin');
  const top0 = curtainsOf([c], at)[0];
  assert.ok(near(v.centre[1] + v.height, top0.centre[1] + top0.height), 'the top stays in the cell it falls from');
  const hill = () => 800;
  assert.equal(curtainsOf([c], { ...at, groundAt: hill })[0].centre[1], 100 - CURTAIN_BELOW_M, 'a highland: never above the old foot');
  assert.equal(lowestGround(() => -Infinity, 0, 0, 10), Infinity, 'land unknown everywhere: nothing learned');
  const asked = [];
  lowestGround((x, z) => { asked.push([x, z]); return 0; }, 0, 0, 10);
  assert.equal(asked.length, CURTAIN_FOOT_SAMPLES + 1, 'the rim and the centre');
  assert.ok(asked.some(([x, z]) => x === 0 && z === 0));
  // D1: the fade
  const calls = [];
  const gl = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[A-Z_]+$/.test(k) ? k : (...a) => { calls.push([k, ...a]); }) });
  const u = Object.fromEntries(['uVP', 'uCentre', 'uRadius', 'uHeight', 'uEye', 'uDepth', 'uAlpha', 'uTime', 'uColor', 'uLight', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uDwFog', 'uFocus'].map((n) => [n, n]));
  const fake = { gl, u, program: 'p', vao: 'v', count: 6, _vp: new Float32Array(16), drawn: 0 };
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const list = [{ centre: [0, 0, 0], radius: 100, height: 500, depth: 0.001, kind: 0, alpha: 1 }];
  const drawn = RainCurtainsRenderer.prototype.draw.call(fake, list, I, I, [0, 10, 0], 1, { light: 0.8, fade: 0.25 });
  assert.equal(drawn, 1);
  const f1 = (n) => calls.filter((x) => x[0] === 'uniform1f' && x[1] === n).map((x) => x[2]);
  assert.deepEqual(f1('uAlpha'), [0.25], 'the rise fades its opacity');
  assert.deepEqual(f1('uLight'), [0.8], 'and leaves its colour the frame\'s own');
  calls.length = 0;
  assert.equal(RainCurtainsRenderer.prototype.draw.call(fake, list, I, I, [0, 10, 0], 1, { light: 0.8, fade: 0 }), 0, 'nothing risen: nothing drawn');
  assert.equal(calls.length, 0, 'and nothing touched');
});

test('TV4 curtains: THE CHORD - a front face\'s optical depth is the line of sight\'s path through the solid cylinder, a back face\'s none; streaks slide down with the fall on a wrapped clock; fogged from the traveller; premultiplied', () => {
  assert.match(CURTAIN_FS, /float c = len > 1e-3 \? max\(0\.0, dot\(vNormal, toEye \/ len\)\) : 0\.0;\n\s*float chord = 2\.0 \* uRadius \* c;/, '2 R cos, and zero facing away');
  assert.match(CURTAIN_FS, /float a = \(1\.0 - exp\(-tau\)\) \* top \* uAlpha \* fogFactorAt\(vWorld\);/);
  assert.match(CURTAIN_FS, /o = vec4\(uColor \* uLight \* a, a\);   \/\/ premultiplied/);
  assert.match(CURTAIN_FS, /uniform vec4 uFocus;/, 'the fog block\'s focus - the traveller\'s');
  assert.match(CURTAIN_VS, /vec3 p = uCentre \+ vec3\(n\.x \* uRadius, aUV\.y \* uHeight, n\.y \* uRadius\);/);
  assert.equal(CURTAIN_CLOCK_PERIOD % (1 / CURTAIN_FALL_HZ), 0, 'a whole number of falls over the clock - no stutter at the wrap');
  assert.equal(curtainClock(CURTAIN_CLOCK_PERIOD + 3), 3);
  assert.equal(curtainClock(-1), CURTAIN_CLOCK_PERIOD - 1);
  const src = rd('src/render/rainCurtains.js');
  assert.match(src, /gl\.blendFunc\(gl\.ONE, gl\.ONE_MINUS_SRC_ALPHA\);\n\s*gl\.depthMask\(false\);\n\s*gl\.disable\(gl\.CULL_FACE\);/, 'over the frame, no depth written, both faces to the shader');
  assert.match(src, /if \(U\.uFocus\) gl\.uniform4fv\(U\.uFocus, fog\?\.focus \?\? NO_FOCUS\);/);
  assert.match(src, /gl\.enable\(gl\.CULL_FACE\);\n\s*gl\.depthMask\(true\);\n\s*gl\.disable\(gl\.BLEND\);/, 'and the state handed back');
});

// ── THE REST OF THE WEATHER, FROM THE AIR ───────────────────────────────────────────────────────────────────────────

test('TV4 shadows: the cloud shadow\'s square covers everything the view\'s fog lets through, at the widest band and the furthest grid - so the shadows over the whole view are the clouds\' own, unchanged', () => {
  const nearEdge = SHADOW_EXTENT / 2 - PIXEL_METRES / 2;   // the square snaps to the pixel grid: its nearest edge off the traveller
  const back = TV_HEIGHT_MAX / Math.tan(TV_TILT_MIN);   // the eye's furthest stand-back
  for (const w of ['sunny', 'cloudy', 'overcast']) {
    const fog = scaleFogForDistance(fogForWeather(w), LAND_VIEW_MAX);
    assert.equal(fog.mode, 'linear', `${w}: the far ring's weather`);
    assert.ok(fog.end + back <= nearEdge, `${w}: fogged out at ${fog.end + back} m, the shadow to ${nearEdge} m`);
  }
  for (const [w, row] of Object.entries(FOG_SETTINGS)) {
    if (row.mode !== 'exp' || w === 'interior' || w === 'dungeon') continue;
    assert.ok(Math.exp(-row.density * nearEdge) < 1e-6, `${w}: nothing seen past the shadow's edge`);
  }
});

test('TV4 far ring: under an exp fog the ring\'s nearest edge is already fog at the default grid - the gate that hides it hides nothing a traveller would see; under light weather (linear) it stands as ever', () => {
  const ringNear = LAND_VIEW_DEFAULT * PIXEL_METRES;
  for (const w of ['rainy', 'snowy', 'heavy', 'sandstorm']) assert.ok(Math.exp(-FOG_SETTINGS[w].density * ringNear) < 1e-4, `${w}: fog at ${ringNear} m`);
  const farRing = rd('test/farring.test.js');
  assert.match(farRing, /exp fog \(weather\) hides the ring/, 'the gate stands, pinned where it was');
  assert.match(rd('src/scenes/world.js'), /if \(farRing && fogNow\.mode === 'linear'\)/);
});

test('TV4 lightning: a strike\'s column stands on the traveller\'s ground - from the raised eye its foot hung 448 m in the air', () => {
  const head = [0, 101.7, 0], raised = [0, 550, -350];
  const onGround = strikeColumn(head, 3000, 0, 500, 1.7);
  assert.ok(Math.abs(onGround.groundY - 100) < 1, 'from the head, the ground');
  const fromAir = strikeColumn(raised, 3000, 0, 500, 1.7);
  assert.ok(fromAir.groundY > 500, 'from the raised eye it would be in the air - the bug');
  assert.match(rd('src/scenes/world.js'), /stormLights\.frame\(\{ seconds: now \/ 1000, eye: tvf \? cam\.pos : mwv\.eye, distant: struckFar,/);
});

test('TV4 host wiring: the curtains built on the enhanced lane, drawn under the travel view alone from the weather map\'s own cells, lit by the frame and fogged by its fog from the traveller, then the renderer told', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const rainCurtains = isEnhanced\(\) \? \(\(\) => \{ try \{ return new RainCurtainsRenderer\(renderer\.gl\); \}/);
  assert.match(w, /if \(tvf && rainCurtains\) \{\n\s*const curtains = curtainsOf\(fieldCellsHere\(\), \{ focus: cam\.pos, eye: mwv\.eye, ground: player\.feetAt\(\)\[1\], groundAt: tvGroundAt \}\);/, 'the clouds\' own cells, the shared minute');
  assert.match(w, /\{ light: lit, fade: Math\.min\(1, tvf\.blend \* 1\.5\), fog:/, 'AUDIT TV D1: the rise is opacity');
  assert.match(w, /const tvGroundAt = \(x, z\) => \{ const n = state\.worldCoords\(\[x, 0, z\]\); return tvSceneOf\(n\.x, n\.z\)\[1\]; \};/, 'AUDIT TV D3: the grid\'s land, the far ring\'s past it');
  assert.match(w, /fog: \{ mode: renderer\._fogMode, density: renderer\._fogDensity, range: renderer\._fogRange, camPos: renderer\._camPos, focus: renderer\._focus, dw: renderer\._dwFog \} \}\)\) renderer\.markForeignPass\(\);/);
  assert.ok(w.indexOf('rainCurtains.draw(curtains') > w.indexOf('gatePool.drawPass(proj, view'), 'after the world and its other foreign passes');
});
