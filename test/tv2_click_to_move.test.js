// TV2 (2026-09-28, bible/06-Systems/Travel-View.md, Mac: "Even adding the option to tap/click to move to a specific
// location"; his calls: "Both, by target" - a town or a marker by the roads, open ground straight there - and "Cap it
// to what loads cleanly").
//
// Pinned here: the click's ground (player/travelPick.js - the march and its bisection over a table of hills), the
// road planner (systems/travelRoute.js - A* over Hazelnut's compass bytes, a road only where both ends carry the
// edge, the sea refused, the legs folded), the load governor (systems/travelGovernor.js - halved while the view shows
// unbuilt ground, back up a step once it is clean, never under walking pace), the port's own two journeys in Travel
// Options (beginTravelToPoint / beginTravelAlongRoute - the mod's autopilot, legs and stops, and an arrival SAID under
// the view), the view's marks and route projected through the frame, the readout's route line, and the world host's
// wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundHit, canvasPoint, classifyPick, TV_PICK_MAX } from '../src/player/travelPick.js';
import { planRoute, routeLegs, roadShare, edgeKind, ROUTE_COST, OPPOSITE_BIT } from '../src/systems/travelRoute.js';
import { createLoadGovernor, viewReach, unbuiltAround, stepDown, TV_GOV_HOLD_S, TV_GOV_CLEAR_S, TV_GOV_STEP } from '../src/systems/travelGovernor.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT } from '../src/systems/travelOptionsText.js';
import { mapPixelWorldOrigin, MID_LO, P_SIZE } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { modSetting } from '../src/systems/modSettings.js';
import { DIR, DIR_DELTA } from '../src/world/roadNetwork.js';
import { createTravelView, TRAVEL_VIEW_TEXT, travelTripLine } from '../src/scenes/travelView.js';
import { routePath } from '../src/ui/travelViewHud.js';
import { forwardOf, TV_RISE_S } from '../src/player/travelCamera.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const norm = (v) => { const n = Math.hypot(...v); return v.map((c) => c / n); };

// ── THE CLICK'S GROUND ──────────────────────────────────────────────────────────────────────────────────────────────

test('TV2 pick: the ray from the raised eye meets flat ground where the geometry says, to well under a centimetre; the sky meets nothing', () => {
  const eye = [0, 300, 0];
  const dir = norm([0, -1, 1]);   // 45 degrees down, due north
  const hit = groundHit(eye, dir, () => 0);
  assert.ok(hit.point, 'a hit');
  assert.ok(near(hit.point[1], 0), 'on the ground');
  assert.ok(Math.abs(hit.point[2] - 300) < 0.01, `300 m out (${hit.point[2]})`);
  assert.ok(Math.abs(hit.point[0]) < 1e-9);
  assert.equal(hit.unbuilt, false);
  assert.ok(near(hit.dist, 300 * Math.SQRT2, 0.01));
  const sky = groundHit(eye, norm([0, 0.2, 1]), () => 0);
  assert.equal(sky.point, null, 'the sky');
  assert.equal(sky.dist, Infinity);
  assert.equal(groundHit(null, dir, () => 0).point, null, 'no eye, no hit');
  assert.equal(TV_PICK_MAX, 6000, 'the lens\'s far plane');
});

test('TV2 pick: a ridge in front of the flat ground takes the ray first; the march does not step over a thin one; unbuilt ground is crossed and said', () => {
  const eye = [0, 300, 0];
  const dir = norm([0, -1, 2]);   // would land at z = 600 on the flat
  // a ridge 50 m high and 6 m thick at z 400..406 - the ray passes it at y ~100, so it misses; raise it to 120
  const ridge = (hgt) => (x, z) => (z >= 400 && z <= 406 ? hgt : 0);
  assert.ok(Math.abs(groundHit(eye, dir, ridge(50)).point[2] - 600) < 0.01, 'under the ray: the flat');
  const onRidge = groundHit(eye, dir, ridge(120)).point;
  assert.ok(onRidge[2] >= 400 && onRidge[2] <= 406, `a 6 m ridge stops it (${onRidge[2]})`);
  assert.ok(near(onRidge[1], 120), 'standing on the ridge\'s top');
  // unbuilt ground between: -Infinity for z < 100 (the grid not raised there yet), flat beyond
  const holes = (x, z) => (z < 100 ? -Infinity : 0);
  const h = groundHit([0, 300, -200], norm([0, -1, 1.5]), holes);
  assert.ok(h.point && h.unbuilt, 'hit the built ground past the hole, and said it crossed one');
  const allHoles = groundHit(eye, dir, () => -Infinity);
  assert.equal(allHoles.point, null);
  assert.equal(allHoles.unbuilt, true, 'nothing built under the ray at all: "beyond what you can see"');
});

test('TV2 pick: the event\'s viewport point is the canvas\'s own; what was clicked decides the journey (a place, the ground, the water, beyond sight, nothing)', () => {
  assert.deepEqual(canvasPoint(410, 230, { left: 10, top: 30 }), [400, 200]);
  assert.deepEqual(canvasPoint(5, 6, null), [5, 6]);
  const hit = { point: [1, 2, 3], unbuilt: false };
  assert.equal(classifyPick({ hit, place: { name: 'Daggerfall' } }).kind, 'place');
  assert.equal(classifyPick({ hit, place: { name: 'Daggerfall' }, water: true }).kind, 'place', 'a harbour town is a town');
  assert.equal(classifyPick({ hit, water: true }).kind, 'water');
  assert.equal(classifyPick({ hit }).kind, 'ground');
  assert.equal(classifyPick({ hit: { point: null, unbuilt: true } }).kind, 'far');
  assert.equal(classifyPick({ hit: { point: null, unbuilt: false } }).kind, 'none');
  assert.equal(classifyPick({ hit: null }).kind, 'none');
});

// ── THE ROAD PLANNER ────────────────────────────────────────────────────────────────────────────────────────────────

const W = 24, H = 12;
const grid = () => ({ roads: new Uint8Array(W * H), tracks: new Uint8Array(W * H) });
/** Lay a road (both ends' bits) along a list of cells. */
function lay(arr, cells) {
  for (let i = 1; i < cells.length; i++) {
    const [ax, ay] = cells[i - 1], [bx, by] = cells[i];
    const [bit] = DIR_DELTA.find(([, dx, dy]) => dx === bx - ax && dy === by - ay);
    arr[ay * W + ax] |= bit;
    arr[by * W + bx] |= OPPOSITE_BIT[bit];
  }
}
const row = (y, x0, x1) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y]);

test('TV2 route: a step is ON the road only when both ends carry the edge - two roads side by side are not one road; the compass is roadNetwork\'s', () => {
  const g = grid();
  lay(g.roads, row(5, 2, 6));
  const a = 5 * W + 3, b = 5 * W + 4;
  assert.equal(edgeKind(a, b, DIR.E, g.roads, g.tracks), 'road');
  assert.equal(edgeKind(b, a, DIR.W, g.roads, g.tracks), 'road', 'both ways');
  g.roads[6 * W + 3] = DIR.E; g.roads[6 * W + 4] = 0;   // a half edge: A leaves toward B, B does not answer
  assert.equal(edgeKind(6 * W + 3, 6 * W + 4, DIR.E, g.roads, g.tracks), 'open');
  lay(g.tracks, row(8, 2, 4));
  assert.equal(edgeKind(8 * W + 2, 8 * W + 3, DIR.E, g.roads, g.tracks), 'track');
  for (const [bit] of DIR_DELTA) assert.equal(OPPOSITE_BIT[OPPOSITE_BIT[bit]], bit, 'the edge back of the edge back');
  assert.deepEqual(ROUTE_COST, { road: 1, track: 1.6, open: 3.5 });
});

test('TV2 route: along a road the route IS the road; round a hill it takes the road\'s long way when that is cheaper than the open; a short hop across a field stays across the field', () => {
  const g = grid();
  lay(g.roads, row(5, 1, 20));
  const along = planRoute({ x: 1, y: 5 }, { x: 20, y: 5 }, { ...g, width: W, height: H });
  assert.equal(along.pixels.length, 20);
  assert.ok(along.kinds.every((k) => k === 'road'));
  assert.ok(near(along.cost, 19));
  // a U-shaped road: 2..14 on row 2, down col 14 to row 8, back along row 8 - from (2,2) to (2,8)
  const u = grid();
  lay(u.roads, [...row(2, 2, 14), ...Array.from({ length: 6 }, (_, i) => [14, 3 + i]), ...row(8, 2, 14).reverse().slice(1)]);
  const around = planRoute({ x: 2, y: 2 }, { x: 2, y: 8 }, { ...u, width: W, height: H });
  assert.ok(around.kinds.includes('open'), 'six pixels across the field (21 open) beat thirty on the road');
  assert.ok(around.cost <= 6 * ROUTE_COST.open + 1e-9);
  // ...but a long way round is taken when the field is wide
  const v = grid();
  lay(v.roads, [...row(2, 2, 4), [5, 3], [6, 4], [7, 5], [8, 6], [9, 7], ...row(8, 10, 12)]);
  const diag = planRoute({ x: 2, y: 2 }, { x: 12, y: 8 }, { ...v, width: W, height: H });
  assert.ok(diag.kinds.every((k) => k === 'road'), 'the road the whole way');
  assert.equal(roadShare(diag.kinds), 1);
  assert.equal(roadShare([]), 0);
  assert.equal(roadShare(['road', 'open']), 0.5);
});

test('TV2 route: the sea is refused - the route goes round by the land bridge, or there is none; the two ends may stand on it; the same pixel is a route of one', () => {
  const g = grid();
  const wall = (x, y) => x === 10 && y !== 11;   // a channel down column 10, crossable only at y 11
  const r = planRoute({ x: 5, y: 3 }, { x: 15, y: 3 }, { ...g, width: W, height: H, isWater: wall });
  assert.ok(r, 'a route');
  assert.ok(r.pixels.some((p) => p.x === 10 && p.y === 11), 'by the bridge');
  assert.ok(!r.pixels.some((p) => wall(p.x, p.y)), 'and never through the water');
  assert.equal(planRoute({ x: 5, y: 3 }, { x: 15, y: 3 }, { ...g, width: W, height: H, isWater: (x) => x === 10 }), null, 'no bridge: no route');
  const toSea = planRoute({ x: 5, y: 3 }, { x: 10, y: 3 }, { ...g, width: W, height: H, isWater: (x) => x === 10 });
  assert.ok(toSea, 'a harbour town on its water pixel is still reached');
  const one = planRoute({ x: 4, y: 4 }, { x: 4, y: 4 }, { ...g, width: W, height: H });
  assert.deepEqual(one.pixels, [{ x: 4, y: 4 }]);
  assert.equal(planRoute(null, { x: 1, y: 1 }), null);
});

test('TV2 route: the legs fold a straight run on one kind of ground into its last pixel - the autopilot aims down the road, not at every pixel\'s middle', () => {
  const px = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [5, 2], [6, 2]].map(([x, y]) => ({ x, y }));
  assert.deepEqual(routeLegs(px, ['road', 'road', 'road', 'road', 'road', 'road']), [
    { x: 3, y: 0, kind: 'road' }, { x: 5, y: 2, kind: 'road' }, { x: 6, y: 2, kind: 'road' },
  ]);
  assert.deepEqual(routeLegs(px.slice(0, 4), ['road', 'open', 'open']), [{ x: 1, y: 0, kind: 'road' }, { x: 3, y: 0, kind: 'open' }], 'a change of ground is a new leg');
  assert.deepEqual(routeLegs([{ x: 0, y: 0 }]), []);
});

// ── THE LOAD GOVERNOR ───────────────────────────────────────────────────────────────────────────────────────────────

test('TV2 cap: the clock runs as asked while the view is clean; unbuilt ground for TV_GOV_HOLD_S halves it (to the spinner\'s step), again and again down to walking pace', () => {
  const gov = createLoadGovernor({ max: 100 });
  assert.equal(gov.step(0.1, { unbuilt: 0, requested: 40 }), 40);
  assert.equal(gov.step(TV_GOV_HOLD_S / 2, { unbuilt: 3, requested: 40 }), 40, 'a glimpse of a hole is not yet a hole');
  assert.equal(gov.step(TV_GOV_HOLD_S / 2, { unbuilt: 3, requested: 40 }), 20, 'halved');
  assert.equal(gov.step(TV_GOV_HOLD_S, { unbuilt: 3, requested: 40 }), 10);
  assert.equal(gov.step(TV_GOV_HOLD_S, { unbuilt: 3, requested: 40 }), 5);
  assert.equal(gov.step(TV_GOV_HOLD_S, { unbuilt: 3, requested: 40 }), 1, 'five halved is under a step: walking pace');
  assert.equal(gov.step(TV_GOV_HOLD_S, { unbuilt: 3, requested: 40 }), 1, 'never under it');
  assert.equal(stepDown(37), 35);
  assert.equal(stepDown(2.5), 1);
  assert.equal(stepDown(0), 1);
  assert.equal(gov.step(0.1, { unbuilt: 0, requested: 0 }), 1, 'a spinner at nothing is walking pace');
});

test('TV2 cap: clean for TV_GOV_CLEAR_S and the ceiling climbs a step, up to the top and never past what the player asked; reset forgets', () => {
  const gov = createLoadGovernor({ max: 30 });
  gov.step(TV_GOV_HOLD_S, { unbuilt: 1, requested: 20 });
  assert.equal(gov.ceiling, 10);
  assert.equal(gov.step(TV_GOV_CLEAR_S - 0.01, { unbuilt: 0, requested: 20 }), 10, 'not clean long enough');
  assert.equal(gov.step(0.02, { unbuilt: 0, requested: 20 }), 10 + TV_GOV_STEP);
  gov.step(TV_GOV_CLEAR_S, { unbuilt: 0, requested: 20 });
  assert.equal(gov.step(0, { unbuilt: 0, requested: 20 }), 20, 'up to the spinner');
  for (let i = 0; i < 5; i++) gov.step(TV_GOV_CLEAR_S, { unbuilt: 0, requested: 20 });
  assert.equal(gov.ceiling, 30, 'the ceiling to its top');
  assert.equal(gov.step(0, { unbuilt: 0, requested: 20 }), 20, 'and the clock still the spinner\'s');
  gov.step(TV_GOV_HOLD_S, { unbuilt: 1, requested: 20 });
  assert.equal(gov.ceiling, 10);
  gov.reset();
  assert.equal(gov.ceiling, 30);
  // a hole mid-climb restarts the clean clock
  const g2 = createLoadGovernor({ max: 100 });
  g2.step(TV_GOV_HOLD_S, { unbuilt: 1, requested: 40 });
  g2.step(TV_GOV_CLEAR_S - 1, { unbuilt: 0, requested: 40 });
  g2.step(0.01, { unbuilt: 1, requested: 40 });
  assert.equal(g2.step(1.5, { unbuilt: 0, requested: 40 }), 20, 'the clean clock began again after the hole');
});

test('TV2 cap: the view\'s reach is where the top of the picture meets the ground; above the horizon it is the grid\'s; the count is the square\'s unbuilt pixels', () => {
  const deg = (d) => (d * Math.PI) / 180;
  const r = viewReach({ height: 300, pitch: deg(-52), fovY: deg(60) });
  assert.ok(near(r, 300 / Math.tan(deg(22)), 1e-6));
  assert.ok(near(viewReach({ height: 300, pitch: deg(-52), fovY: deg(60), back: 100 }), 300 / Math.tan(deg(22)) - 100, 1e-6));
  assert.equal(viewReach({ height: 300, pitch: deg(-30), fovY: deg(60), far: 5000 }), 5000, 'the top edge at the horizon');
  const built = new Set(['5,5', '4,5', '6,5']);
  assert.equal(unbuiltAround({ x: 5, y: 5 }, 1, (x, y) => built.has(`${x},${y}`)), 6);
  assert.equal(unbuiltAround({ x: 5, y: 5 }, 0, (x, y) => built.has(`${x},${y}`)), 0);
});

// ── THE JOURNEYS ────────────────────────────────────────────────────────────────────────────────────────────────────

function travelRig(over = {}) {
  const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
  const state = { pos: at(500, 250), pixel: { x: 500, y: 250 }, climate: 231, enemies: false, location: null };
  const said = [], boxed = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => state.location, hasCurrentLocation: () => !!state.location,
    localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => state.climate,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => state.enemies, diseaseCount: () => 0,
    say: (l) => said.push(l), messageBox: (l) => boxed.push(l),
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null,
    pushWindow: (w) => { w.show(); },   // the world host's own: the panel is shown, not stacked
    ...over,
  });
  const go = (px, py, dx, dz) => { state.pixel = { x: px, y: py }; state.pos = at(px, py, dx, dz); return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  return { to, state, said, boxed, ui, at, go };
}

test('TV2 journey: a spot on open ground - the mod\'s autopilot aimed at one path\'s width about the point, the panel up, and the arrival SAID (a box would bring the view down)', () => {
  const r = travelRig();
  const spot = r.at(501, 250, 9000, 20000);
  assert.equal(r.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...spot }, false, { quiet: true, name: TRAVEL_VIEW_TEXT.spot }), true);
  const ap = r.to.state.autopilot;
  assert.ok(ap, 'the autopilot drives');
  assert.deepEqual(ap.destinationWorldRect, rectOf(spot.x - P_SIZE / 2, spot.z - P_SIZE / 2, P_SIZE, P_SIZE));
  assert.deepEqual(ap.destinationMapPixel, { x: 501, y: 250 });
  assert.equal(r.ui.isShowing, true, 'the Travel Options panel rides along');
  assert.equal(r.to.destinationName, null, 'a spot is not a named journey - as the mod\'s own coordinate journey is not');
  assert.equal(r.ui.destinationName, TRAVEL_VIEW_TEXT.spot);
  assert.ok(r.to.route, 'the view\'s own');
  const d = r.go(500, 250);
  assert.equal(d.drive.arrived, false);
  assert.ok(d.drive.forward > 0);
  r.go(501, 250, 9000, 20000);
  r.go(501, 250, 9000, 20000);
  assert.deepEqual(r.said, [TRAVEL_OPTIONS_TEXT.MsgArrived], 'said');
  assert.deepEqual(r.boxed, [], 'never boxed');
  assert.equal(r.to.state.autopilot, null);
  assert.equal(r.to.route, null, 'and the route is over');
  // without `quiet` the arrival is the mod's own box
  const b = travelRig();
  b.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...spot });
  b.go(501, 250, 9000, 20000); b.go(501, 250, 9000, 20000);
  assert.deepEqual(b.boxed, [TRAVEL_OPTIONS_TEXT.MsgArrived]);
});

test('TV2 journey: by the roads - each leg a pixel\'s middle, the SAME autopilot re-aimed leg after leg (BeginPathTravel\'s InitTargetRect), the last leg the place itself with the arrival buffer; a named journey to the mod', () => {
  const r = travelRig();
  const summary = { pixel: { x: 503, y: 250 }, name: 'Ripwych', mapId: 42, regionIndex: 17, locationIndex: 3 };
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'track' }, { x: 503, y: 250, kind: 'road' }];
  assert.equal(r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true }), true);
  assert.equal(r.to.destinationName, 'Ripwych', 'named: LocationPause and the resume prompt know it');
  assert.equal(r.ui.destinationName, 'Ripwych');
  const first = r.to.state.autopilot;
  const mid = (px, py) => { const o = mapPixelWorldOrigin(px, py); return rectOf(o.x + MID_LO, o.z + MID_LO, P_SIZE, P_SIZE); };
  assert.deepEqual(first.destinationWorldRect, mid(501, 250));
  assert.equal(first.speedMultiplier, r.to.settings.recklessTravelMultiplier, 'a road leg: reckless');
  r.go(500, 250);
  r.go(501, 250); r.go(501, 250);   // into the leg's pixel, at its middle
  assert.equal(r.to.state.autopilot, first, 'the same autopilot');
  assert.equal(r.to.route.i, 1);
  assert.deepEqual(first.destinationWorldRect, mid(502, 250), 're-aimed at the next middle');
  assert.equal(first.speedMultiplier, r.to.settings.cautiousTravelMultiplier, 'a track leg: cautious');
  r.go(502, 250); r.go(502, 250);
  const last = r.to.state.autopilot;
  assert.notEqual(last, first, 'the place\'s own leg');
  assert.equal(last.isLocation, true);
  const o = mapPixelWorldOrigin(503, 250);
  assert.equal(last.destinationWorldRect.xMin, o.x + 16000 - 800, 'grown by ARRIVAL_BUFFER, as the mod\'s location journey');
  r.go(503, 250, 16300, 16300); r.go(503, 250, 16300, 16300);
  assert.deepEqual(r.said, [TRAVEL_OPTIONS_TEXT.MsgArrived]);
  assert.equal(r.to.destinationName, null);
  assert.equal(r.to.route, null);
});

test('TV2 journey: the mod\'s stops still stop it (a foe near: boxed); interrupted, it RESUMES on its road from the nearest leg ahead; a journey of the mod\'s replaces it', () => {
  const r = travelRig();
  const summary = { pixel: { x: 505, y: 250 }, name: 'Ripwych', mapId: 42 };
  const legs = [501, 502, 503, 504, 505].map((x) => ({ x, y: 250, kind: 'road' }));
  r.to.beginTravelAlongRoute({ legs, summary }, false, { quiet: true });
  r.state.enemies = true;
  r.go(500, 250);
  assert.deepEqual(r.boxed, [TRAVEL_OPTIONS_TEXT.MsgEnemies], 'the mod\'s own refusal, its own box');
  r.state.enemies = false;
  r.to.interruptTravel();
  assert.equal(r.to.state.autopilot, null);
  assert.ok(r.to.route, 'the route outlives the interruption');
  r.state.pixel = { x: 503, y: 251 };
  r.to.resumeTravel();
  assert.equal(r.to.route.i, 2, 'the nearest leg ahead of where they stand now');
  const o = mapPixelWorldOrigin(503, 250);
  assert.equal(r.to.state.autopilot.destinationWorldRect.xMin, o.x + MID_LO);
  r.to.beginTravel({ pixel: { x: 520, y: 250 }, name: 'Daggerfall', mapId: 7 });
  assert.equal(r.to.route, null, 'the mod\'s journey replaces the view\'s');
  r.to.clearTravelDestination();
  assert.equal(r.to.beginTravelAlongRoute({ legs: [] }), false, 'no end, no journey');
});

// ── THE VIEW'S MARKS AND ROUTE ──────────────────────────────────────────────────────────────────────────────────────

function viewRig(over = {}) {
  const log = { picks: [], marked: [], last: null, hooks: null };
  const win = { addEventListener() {}, removeEventListener() {} };
  const tv = createTravelView({
    canvas: {}, win,
    feet: () => [0, 0, 0], headView: () => ({ eye: [0, 1.7, 0], fwd: forwardOf(0, 0) }),
    yaw: () => 0, setYaw: () => {}, heightAt: () => 0, cloudBase: () => null,
    allowed: () => ({ ok: true }), windowUp: () => false, actionsOf: () => [],
    project: (p) => ({ x: 100 + p[0], y: 100 - p[2], front: p[2] >= 0 }),
    onPick: (x, y) => log.picks.push([x, y]), onMark: (k) => log.marked.push(k),
    marks: () => [{ key: 'place:1', at: [10, 0, 20], label: 'Ripwych', kind: 'place', pick: true }, { key: 'behind', at: [0, 0, -5], label: '' }],
    route: () => [[0, 0, 0], [0, 0, 10], [0, 0, -3]],
    trip: () => 'To Ripwych, by the road',
    hud: { show: (h) => { log.hooks = h; }, hide: () => {}, update: (f) => { log.last = f; } },
    schedule: () => null, cancel: () => {},
    ...over,
  });
  return { tv, log };
}

test('TV2 view: the marks and the route are WORLD points the view projects through the frame; the trip rides along; a plate takes a click only while the view is up', () => {
  const { tv, log } = viewRig();
  tv.enter();
  log.hooks.onMark('place:1');
  assert.deepEqual(log.marked, [], 'rising: no journeys from a camera still on its way up');
  for (let i = 0; i < 90; i++) tv.frame(TV_RISE_S / 60);
  assert.equal(tv.state, 'up');
  tv.drawHud();
  const m = log.last.marks;
  assert.deepEqual(m[0], { key: 'place:1', x: 110, y: 80, front: true, label: 'Ripwych', kind: 'place', pick: true, edge: false });   // TV3: `edge` rides along
  assert.equal(m[1].front, false, 'behind the eye: hidden, not drawn at the origin');
  assert.deepEqual(log.last.route.map((p) => p.front), [true, true, false]);
  assert.equal(log.last.trip, 'To Ripwych, by the road');
  log.hooks.onMark('place:1');
  assert.deepEqual(log.marked, ['place:1']);
});

test('TV2 readout: the route line moves to its first point, lines through the rest, and breaks where a point falls behind the eye', () => {
  assert.equal(routePath([{ x: 1.4, y: 2.6, front: true }, { x: 10, y: 20, front: true }, { x: 5, y: 5, front: false }, { x: 30, y: 40, front: true }, { x: 31, y: 41, front: true }]),
    'M1 3 L10 20 M30 40 L31 41');
  assert.equal(routePath([]), '');
  assert.equal(routePath([null, { x: NaN, y: 1, front: true }, { x: 2, y: 2, front: true }]), 'M2 2');
  assert.equal(travelTripLine({ name: 'Ripwych', share: 0.8 }), 'To Ripwych, by the road');
  assert.equal(travelTripLine({ name: 'Ripwych', share: 0.2 }), 'To Ripwych, across country');
  assert.equal(travelTripLine({ spot: true }), 'To the marked spot');
  assert.match(TRAVEL_VIEW_TEXT.held(20, 40), /×20 of ×40/);
});

// ── THE WORLD HOST'S WIRING ─────────────────────────────────────────────────────────────────────────────────────────

test('TV2 host wiring: the click is a ray from the VIEW\'s eye through this frame, met with the built ground; a known place under it (its rect grown) is reached by the roads, the ground walked to, the water and the unseen refused', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const \[sx, sy\] = canvasPoint\(clientX, clientY, canvas\.getBoundingClientRect\(\)\);/, 'the canvas\'s own pixels (tapRay reads them)');
  assert.match(w, /rayDirFromScreen\(sx, sy, canvas\.clientWidth, canvas\.clientHeight, _lastProj, _lastView, travelView\.eye, worldViewportRect\(/, 'from the eye the frame was drawn from');
  assert.match(w, /const hit = groundHit\(travelView\.eye, dir, \(x, z\) => heightAt\(x, z\)\);/);
  assert.match(w, /if \(!row \|\| !travelCheckDiscovered\(row\)\) return null;/, 'an undiscovered place has no name to go to - DFU\'s own law, the travel map\'s');
  assert.match(w, /const TV_PLACE_GROW = 6144;/);
  assert.match(w, /woods\.getHeightMapValue\(px, py\) <= WATER_BYTE/, 'the water: roadsProducer\'s own byte law');
  assert.match(w, /if \(what\.kind === 'place'\) travelViewRouteTo\(what\.place\);\n\s*else if \(what\.kind === 'ground'\) travelViewWalkTo\(hit\.point, pix\);\n\s*else if \(what\.kind === 'water'\) townTalk\.say\(TRAVEL_VIEW_TEXT\.water\);\n\s*else if \(what\.kind === 'far'\) townTalk\.say\(TRAVEL_VIEW_TEXT\.far\);/);
  assert.match(w, /if \(!travelOptions\) \{ townTalk\.say\(TRAVEL_VIEW_TEXT\.noJourneys\); return false; \}/, 'no Travel Options, no journeys - said');
  assert.match(w, /if \(areEnemiesNearby\(exteriorFoePool\(\)\)\) \{ townTalk\.say\(TRAVEL_VIEW_TEXT\.enemies\); return false; \}/);
  assert.match(w, /planRoute\(from, summary\.pixel, \{ roads: net\?\.roads \?\? null, tracks: net\?\.tracks \?\? null, isWater: tvWater \}\)/, 'Hazelnut\'s bytes, whichever source raised them');
  assert.match(w, /travelOptions\.beginTravelAlongRoute\(\{ legs: routeLegs\(plan\.pixels, plan\.kinds\), summary, name: summary\.name \}, false, \{ quiet: true \}\)/);
  assert.match(w, /travelOptions\.beginTravelToPoint\(\{ pixel: pix, x: n\.x, z: n\.z \}, false, \{ quiet: true, name: TRAVEL_VIEW_TEXT\.spot \}\)/);
  for (const dep of [/onPick: \(x, y\) => onTravelViewPick\(x, y\),/, /onMark: \(key\) => onTravelViewMark\(key\),/, /marks: travelViewMarks,/, /route: travelViewRoute,/, /trip: \(\) => \(tvTripLive\(\) \? tvTrip\.line : ''\),/]) assert.match(w, dep);
});

test('TV2 host wiring: THE CAP - governed before the frame reads the travel scale, only while the view is up over a running journey, over the pixels the view can reach; handed back whole when either ends; the panel told', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /travelViewGovern\(dt\);[^\n]*\n\s*const travelScale = worldTimeScale\(\);/, 'this frame\'s scale is the governed one');
  assert.match(w, /const journey = !!travelControlUI\?\.isShowing && !!travelOptions\?\.state\?\.autopilot;/);
  assert.match(w, /if \(tvHeld != null\) \{ tvHeld = null; if \(journey\) setWorldTimeScale\(travelControlUI\.timeAcceleration\); \}\n\s*travelGovernor\.reset\(\);/, 'the spinner\'s own rate back');
  assert.match(w, /viewReach\(\{ height: cam0\.height, pitch: -cam0\.tilt, fovY: fieldOfView\(\), far: Infinity \}\)/);
  assert.match(w, /const radius = Math\.max\(1, Math\.min\(grid, Math\.ceil\(reach \/ TERRAIN_SIZE\)\)\);/, 'never past the grid - what the grid does not keep it never builds');
  assert.match(w, /unbuiltAround\(playerTravelPixel\(\), radius, \(x, y\) => x < 0 \|\| y < 0 \|\| x >= 1000 \|\| y >= 500 \|\| built\.has\(`\$\{x\},\$\{y\}`\)\)/);
  assert.match(w, /held: tvHeld,/, 'the travel panel says the clock is held');
  const panel = rd('src/ui/enhancedTravelControl.js');
  assert.match(panel, /put\(parts\.accel, 'accel', held != null \? `×\$\{held\} \/ ×\$\{accel\}` : `×\$\{accel\}`\);/);
  assert.match(rd('src/ui/enhancedPlusStyle.js'), /\.travelpanel-accel\.held \{/);
  assert.match(rd('src/ui/enhancedStyle.js'), /\.travelpanel-accel\.held \{/);
});
