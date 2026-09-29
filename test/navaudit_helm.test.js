// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE HELM: the aim a look lays (its reach on the
// sea, a ship under the crosshair), the aim's red as the truth of where each gun stops, why a battery will not fire yet,
// the zone stood up and the strikes marked, and the broadside camera. The law is bible/03-World/Naval-Combat.md
// "AUDIT NAV1 - The helm".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AIM_SLOPE, lookReach, aimSolution } from '../src/systems/naval/navalGunnery.js';
import { HULL, batteryOf } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { NAVAL_DEG, shotPosition, segmentBoxEntry } from '../src/systems/naval/navalBallistics.js';
import { hullBoxOf, rigBoxesOf, AIM_CAM_OUT, AIM_CAM_UP, AIM_CAM_AFT, AIM_CAM_TAU, AIM_CAM_CLEAR } from '../src/scenes/navalHost.js';
import { navalHudText } from '../src/ui/navalHud.js';
import { NavalRenderer, NAVAL_STRIDE, aimTone, AIM_TONES, AIM_POST_HALF_W, AIM_POST_HALF_H, AIM_STRIKE_HALF, flatAcross } from '../src/render/navalRender.js';
import { sea } from './navalSea.mjs';

const DEG = NAVAL_DEG;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const ID = [0, 0, 0, 1];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const toward = (from, to) => unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
const r3 = (v) => Math.round(v * 1000) / 1000;
/** The helm's eye in the sea harness: over my Small Ship's quarterdeck at the origin, heading +z (starboard +x). */
const EYE = [0, 5, 0];

/** A sea with my Small Ship at the helm and a merchantman launched far off (she never fires unprovoked). */
async function helm(o = {}) {
  const h = await sea({ hull: HULL.SmallShip, ...o, settings: { ShipsAtSea: 'off', Boarders: false, ...(o.settings ?? {}) } });
  if (o.save) h.host.restoreSaveData(o.save);
  const e = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  return { ...h, e };
}
/** Frames with each ship held where the test put her - her way and heading its own, her turn none. */
function frames(h, held, n = 1, opts = {}) {
  for (let i = 0; i < n; i++) {
    for (const [e, p] of held) { e.ship.pos = [...p.pos]; e.ship.yaw = p.yaw ?? 0; e.ship.speed = p.speed ?? 0; e.ship.yawRate = 0; }
    h.host.frame(0.1, opts);
  }
}
const boxOf = (h, e) => hullBoxOf(e.boat, h.pool.models);

// ── the aim a look lays ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H1 the look\'s reach: where it meets the sea while that point moves out less than AIM_SLOPE a degree of pitch - the zone under the crosshair - and past it straight on at AIM_SLOPE, through the horizon and over it, meeting the first law in its value and its rate (mutants: the slope a radian\'s, the root dropped, the ramp turned back, the laws swapped)', () => {
  const h = 6;
  for (const d of [20, 45, 70]) near(lookReach(-Math.atan2(h, d), h), d, 1e-9, `the sea ${d} m out`);
  // the seam: sin^2(p0) = h / slope
  const slope = AIM_SLOPE / DEG;
  const p0 = Math.asin(Math.sqrt(h / slope));
  const e = 1e-7;
  const rate = (p) => (lookReach(p + e, h) - lookReach(p - e, h)) / (2 * e);
  near(lookReach(-(p0 + 1e-9), h), lookReach(-(p0 - 1e-9), h), 1e-5, 'one value either side of the seam');
  near(rate(-(p0 + 1e-4)), slope, slope * 0.01, 'the sea\'s rate at the seam');
  near(rate(-(p0 - 1e-4)), slope, slope * 1e-4, 'the ramp\'s');
  near(lookReach(-(p0 - DEG), h) - lookReach(-p0, h), AIM_SLOPE, 1e-6, 'a degree past the seam, AIM_SLOPE further');
  assert.ok(lookReach(DEG, h) > lookReach(0, h) && lookReach(0, h) > lookReach(-p0, h), 'on through the horizon and over it');
  for (let p = -40 * DEG; p < 5 * DEG; p += 0.25 * DEG) assert.ok(rate(p) <= slope * 1.0001, `never more than AIM_SLOPE a degree (at ${(p / DEG).toFixed(2)})`);
  // at the default mouse (0.286 degrees a pixel) the long shot moves under 9 m a pixel - the sea's own law threw it 37
  assert.ok(AIM_SLOPE * 0.286 < 9);
  assert.ok(lookReach(-Math.asin(Math.sqrt(10 / slope)), 10) > lookReach(-p0, h), 'a higher eye: its seam further out');
  assert.ok(Number.isFinite(lookReach(-0.2, 0)), 'an eye at the sea still answers');
});

test('AUDIT NAV1 H2 a look on a ship lays the guns for its very point - its range out along the fire and its own height, the middle gun\'s arc through it; a look on the sea lays its reach out along the look\'s own bearing, measured along the fire (mutants: the point\'s height ignored, the slant taken for the range)', () => {
  const ship = { position: [0, 0, 0], rotation: ID, velocity: [0, 0, 0], hull: HULL.SmallShip };
  const bat = batteryOf(HULL.SmallShip, 'starboard');
  assert.deepEqual(bat.muzzles[2], [8.1, 4.5, -4.5]);
  const at = [85, 6, -4.5];   // on her side, 6 m over the sea, abeam my middle gun
  const aim = aimSolution(ship, 'starboard', { origin: EYE, dir: [1, 0, 0], at }, 0);
  assert.deepEqual(aim.lookPoint, at);
  const mid = aim.launches[2];
  near(shotPosition(mid.p0, mid.v0, (at[0] - mid.p0[0]) / mid.v0[0])[1], at[1], 0.15, 'through her point, at its height');
  // the sea: 30 degrees forward of the beam, 40 m out on the flat from an eye 6 m up
  const eye = [0, 6, 0], d = 40, b = 30 * DEG;
  const sea = aimSolution(ship, 'starboard', { origin: eye, dir: [Math.cos(b) * d, -eye[1], Math.sin(b) * d] }, 0);
  near(sea.lookPoint[0], Math.cos(b) * d, 1e-9); near(sea.lookPoint[2], Math.sin(b) * d, 1e-9);
  assert.equal(sea.lookPoint[1], 0, 'on the sea');
  const cx = bat.muzzles.reduce((s, m) => s + m[0], 0) / bat.muzzles.length;
  near(sea.landings[2].point[0] - bat.muzzles[2][0], Math.cos(b) * d - cx, 0.05, 'out along the fire, from the guns');
});

// ── the aim's red: where each gun stops ─────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H3 the crosshair on her hull lays the broadside into her side: every gun\'s arc ends at her planking - its strike marked where the ball meets her, none on to the sea behind her - and the aim reads red; the same ray on to the sea met it past her, over her; laid, the card is the ship the guns strike, wherever the look is (mutants: the look on a ship ignored, the strikes never walked, the card by the look alone)', async () => {
  const h = await helm();
  const her = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, her]], 3);
  const box = boxOf(h, h.e);
  const side = [box.c[0] - box.h[0], 1.2, 0];   // her near side abeam my guns, 1.2 m over the sea
  const dir = toward(EYE, side);
  h.view.look = { origin: EYE, dir };
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  const m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.state, m.aim.hot], ['starboard', 'ready', true], 'laid, loaded and red');
  const d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 6, 'all six guns into her');
  assert.equal(d.zone.length, 0, 'none on to the sea');
  assert.equal(d.hot, true);
  for (const p of d.strikes) { near(p[0], side[0], 0.5, 'at her side'); near(p[1], side[1], 0.5, 'at the height the crosshair is on'); }
  for (let i = 0; i < 6; i++) assert.deepEqual(d.arcs[i].at(-1).map(r3), d.strikes[i].map(r3), 'each arc ends where its ball strikes');
  const s = EYE[1] / -dir[1];
  assert.ok(EYE[0] + dir[0] * s > box.c[0] + box.h[0], 'where the look met the sea lay beyond her far side');
  assert.equal(navalHudText(m, {}).aim.target, ' - on target');
  assert.equal(m.target?.name, h.e.ship.names.name, 'her card');
  // the look on the sea 26 degrees forward of her, the broadside still square on her: red, and her card
  h.view.look = { origin: EYE, dir: toward(EYE, [box.c[0] - box.h[0], 1, 40]) };
  frames(h, [[h.e, her]]);
  const fwd = h.host.hudModel();
  assert.equal(fwd.aim.hot, true, 'a broadside\'s zone lies forward of the look');
  assert.equal(fwd.target?.name, h.e.ship.names.name, 'the card is the ship the guns strike');
  h.host.cancelAim();
  frames(h, [[h.e, her]]);
  assert.equal(h.host.hudModel().target, null, 'put down: the look\'s own card, and the look is off her');
});

test('AUDIT NAV1 H4 the crosshair on her canvas: round shot is laid for her hull - her centre at her box\'s middle height, never the sail a ball flies on through - and the Small Ship\'s chain chasers for the canvas itself, the rig their mark (mutants: round shot laid for the canvas, chain laid for the hull, the rig never asked)', async () => {
  const h = await helm();
  const abeam = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, abeam]], 3);
  const box = boxOf(h, h.e), rig = rigBoxesOf(h.e.boat)[0];
  const sail = [rig.c[0] - rig.h[0] - 0.05, 22, 0];
  assert.ok(sail[0] > box.c[0] - box.h[0], 'her canvas stands inboard of her side');
  h.view.look = { origin: EYE, dir: toward(EYE, sail) };
  h.host.attackInput(true);
  frames(h, [[h.e, abeam]]);
  let d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 6, 'the broadside into her hull');
  const top = box.c[1] + box.h[1];
  for (const p of d.strikes) { near(p[0], box.c[0] - box.h[0], 0.6, 'through her side'); assert.ok(p[1] < top - 1, `under her top (${p[1].toFixed(2)})`); }
  assert.equal(h.host.hudModel().aim.hot, true);
  h.host.cancelAim();
  // dead ahead and broadside on: the chasers (chain) on her canvas, 14 m up
  const ahead = { pos: [0, 0, 90], yaw: Math.PI / 2 };
  frames(h, [[h.e, ahead]], 2);
  const rig2 = rigBoxesOf(h.e.boat)[0], box2 = boxOf(h, h.e);
  const canvas = [0, 14, rig2.c[2] - rig2.h[0] - 0.05];
  const dir = toward(EYE, canvas);
  const atSide = (box2.c[2] - box2.h[0] - EYE[2]) / dir[2];
  assert.ok(EYE[1] + dir[1] * atSide > box2.c[1] + box2.h[1], 'the look clears her hull to meet her canvas');
  h.view.look = { origin: EYE, dir };
  h.host.attackInput(true);
  frames(h, [[h.e, ahead]]);
  const m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.gun, m.aim.hot], ['bow', 'chain', true]);
  d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 2, 'both chasers into her rig');
  for (const p of d.strikes) near(p[1], 14, 1, 'at the canvas the crosshair is on');
});

test('AUDIT NAV1 H5 the red is where she WILL be: each arc is walked against her box moved on by her way over the ball\'s time aloft - a stern that will have sailed clear of the foremost gun\'s line is no strike, the same stern lying still is; and the aim reads the hulls as this frame stands them (mutants: her way ignored, the aim read off the last frame\'s hulls)', async () => {
  const h = await helm();
  const bat = batteryOf(HULL.SmallShip, 'starboard').muzzles;
  const fore = bat.at(-1)[2];   // my foremost gun's line (z 6)
  // her stern 2.5 m aft of that line, way on 6 m/s ahead: 1.2 s aloft carries her 7 m on
  const still = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, still]], 3);
  const b0 = boxOf(h, h.e);
  const sternOff = b0.c[2] - b0.h[2] - 0;   // her stern, from her position (z)
  const z = fore - 2.5 - sternOff;
  const lying = { pos: [90, 0, z], yaw: 0 };
  frames(h, [[h.e, lying]], 2);
  const box = boxOf(h, h.e);
  const side = [box.c[0] - box.h[0], 1.2, fore - 1];
  h.view.look = { origin: EYE, dir: toward(EYE, side) };
  h.host.attackInput(true);
  frames(h, [[h.e, lying]]);
  let d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 1, 'lying still: the foremost gun strikes her stern');
  near(d.strikes[0][2], fore, 0.05);
  assert.equal(h.host.hudModel().aim.hot, true);
  const sailing = { pos: [90, 0, z], yaw: 0, speed: 6 };
  frames(h, [[h.e, sailing]]);
  const now = boxOf(h, h.e);
  assert.ok(now.c[2] - now.h[2] < fore, 'her stern still across that line as the aim is read');
  d = h.host.drawFrame().aim;
  assert.equal(d.strikes.length, 0, 'under way: she is clear of it when the ball gets there');
  assert.equal(h.host.hudModel().aim.hot, false);
  // this frame's hulls: moved out of the fire, she is out of it the same frame
  frames(h, [[h.e, lying]]);
  assert.equal(h.host.hudModel().aim.hot, true);
  frames(h, [[h.e, { pos: [90, 0, 400], yaw: 0 }]]);
  assert.equal(h.host.hudModel().aim.hot, false, 'the frame she moves');
  // a ship going down is struck by nothing
  frames(h, [[h.e, lying]]);
  assert.equal(h.host.hudModel().aim.hot, true);
  h.e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  frames(h, [[h.e, lying]]);
  assert.equal(h.e.ship.damage.state, SHIP_STATES.sinking);
  assert.equal(h.host.drawFrame().aim.strikes.length, 0, 'going down');
  assert.equal(h.host.hudModel().aim.hot, false);
});

// ── why the guns will not fire yet ─────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H6 why the guns will not fire yet - loading (the seconds left), braced, no barrels, crippled: each the aim line\'s tail, dimmed; the zone grey; never red however true the lay; the arcs still where it would go (mutants: red while loading, the state unread, the seconds dropped)', async () => {
  const h = await helm();
  const her = { pos: [90, 0, 0], yaw: 0 };
  frames(h, [[h.e, her]], 3);
  const box = boxOf(h, h.e);
  h.view.look = { origin: EYE, dir: toward(EYE, [box.c[0] - box.h[0], 1.2, 0]) };
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  assert.equal(h.host.hudModel().aim.hot, true);
  h.host.attackInput(false);   // the broadside
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  let m = h.host.hudModel();
  assert.equal(m.aim.state, 'reloading');
  assert.ok(m.aim.left > 0 && m.aim.left < 13);
  assert.equal(m.aim.hot, false, 'never red while loading');
  let t = navalHudText(m, {}).aim;
  assert.deepEqual([t.target, t.dim, t.hot], [` - reloading ${m.aim.left.toFixed(1)} s`, true, false]);
  let d = h.host.drawFrame().aim;
  assert.deepEqual([d.ready, d.hot], [false, false]);
  assert.ok(d.strikes.length > 0, 'the arcs still end at her side');
  assert.deepEqual(aimTone(d), AIM_TONES.idle, 'grey');
  frames(h, [[h.e, her]], 5);
  assert.ok(h.host.hudModel().aim.left < m.aim.left, 'counting down');
  // braced: the port side is loaded
  h.view.look = { origin: EYE, dir: [-1, -0.05, 0] };
  frames(h, [[h.e, her]], 1, { brace: true });
  m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.state], ['port', 'braced']);
  assert.equal(navalHudText(m, {}).aim.target, ' - braced');
  // no barrels: four rolled off the stern
  h.host.cancelAim();
  h.view.look = { origin: EYE, dir: [0, -0.3, -1] };
  for (let i = 0; i < 4; i++) { h.host.attackInput(true); frames(h, [[h.e, her]]); h.host.attackInput(false); frames(h, [[h.e, her]], 13); }
  h.host.attackInput(true);
  frames(h, [[h.e, her]]);
  m = h.host.hudModel();
  assert.deepEqual([m.aim.side, m.aim.state, m.aim.barrel], ['stern', 'empty', true]);
  t = navalHudText(m, {}).aim;
  assert.deepEqual([t.target, t.dim], [' - no barrels', true]);
  assert.equal(h.host.drawFrame().aim.ready, false);
  // crippled
  const w = await helm({ save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  w.view.look = { origin: EYE, dir: [1, -0.05, 0] };
  w.host.attackInput(true);
  frames(w, []);
  m = w.host.hudModel();
  assert.equal(m.aim.state, 'crippled');
  assert.equal(navalHudText(m, {}).aim.target, ' - guns silent');
  // loaded and laid on the sea: the plain line
  const f = navalHudText({ ...m, aim: { ...m.aim, state: 'ready', hot: false } }, {}).aim;
  assert.deepEqual([f.target, f.dim], ['', false]);
});

// ── the aim drawn ───────────────────────────────────────────────────────────────────────────────────────────────────

function recordingGl() {
  const consts = { ARRAY_BUFFER: 'ARRAY_BUFFER', TRIANGLES: 'TRIANGLES', ONE: 'ONE', ONE_MINUS_SRC_ALPHA: 'ONE_MINUS_SRC_ALPHA', BLEND: 'BLEND', DEPTH_TEST: 'DEPTH_TEST', CULL_FACE: 'CULL_FACE', TEXTURE_2D: 'TEXTURE_2D', LEQUAL: 'LEQUAL', LESS: 'LESS' };
  let ids = 0;
  return new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
}
function standInRenderer() {
  const view = new Float32Array(16); view[0] = 1; view[5] = 1; view[10] = 1; view[15] = 1;
  return {
    gl: recordingGl(), _proj: new Float32Array(16), _view: view, _camPos: [0, 5, 0], _ambient: [0.3, 0.3, 0.3], _sunColor: [1, 1, 1], _sunScale: 1,
    _lightDir: [0, 1, 0], _fogColor: [0.5, 0.5, 0.6], _fogMode: 1, _fogDensity: 0.001, _fogRange: [10, 900], _dwFog: new Float32Array(4), _focus: new Float32Array(4), markForeignPass() {},
  };
}
/** Quad `q`'s six vertices' positions, and its first vertex's colour. */
const quad = (pass, q) => Array.from({ length: 6 }, (_, k) => [...pass.data.slice((q * 6 + k) * NAVAL_STRIDE, (q * 6 + k) * NAVAL_STRIDE + 3)]);
const colour = (pass, q) => [...pass.data.slice(q * 6 * NAVAL_STRIDE + 5, q * 6 * NAVAL_STRIDE + 9)].map(r3);

test('AUDIT NAV1 H7 the aim drawn: each ball\'s fall stood up as a post of light over its mark and turned to the eye, a strike marked where it meets her, brass laid, red on her, grey when the battery cannot fire (mutants: the posts never laid, the post lying flat, the grey ignored)', () => {
  const pass = new NavalRenderer(standInRenderer());
  const zone = [[0, 0, -60], [3, 0, -60]];
  pass.draw({ aim: { arcs: [], zone, strikes: [], hot: false, ready: true, radius: 2, posts: true } });
  assert.equal(pass.drawn, 4, 'two marks on the sea, two posts over them');
  const post = quad(pass, 2);
  const ys = post.map((p) => p[1]);
  near(Math.min(...ys), 0, 1e-6, 'standing on the sea'); near(Math.max(...ys), 2 * AIM_POST_HALF_H, 1e-5, 'its height');
  const xs = post.map((p) => p[0]), zs = post.map((p) => p[2]);
  near(Math.max(...xs) - Math.min(...xs), 2 * AIM_POST_HALF_W, 1e-5, 'across the eye\'s line');
  near(Math.max(...zs) - Math.min(...zs), 0, 1e-5, 'turned square to it');
  assert.deepEqual(colour(pass, 0), AIM_TONES.laid.zone.map(r3));
  assert.deepEqual(colour(pass, 2), AIM_TONES.laid.post.map(r3));
  pass.draw({ aim: { arcs: [], zone, hot: false, radius: 2 } });
  assert.equal(pass.drawn, 2, 'no posts asked, none stood');
  pass.draw({ aim: { arcs: [], zone: [], strikes: [[0, 4, -50]], hot: true, ready: true, posts: true } });
  assert.equal(pass.drawn, 1, 'the strike');
  const s = quad(pass, 0);
  near(Math.max(...s.map((p) => p[1])) - Math.min(...s.map((p) => p[1])), 2 * AIM_STRIKE_HALF, 1e-5);
  assert.deepEqual(colour(pass, 0), AIM_TONES.hot.strike.map(r3), 'red on her');
  pass.draw({ aim: { arcs: [], zone: [zone[0]], hot: true, ready: false, radius: 2, posts: true } });
  assert.deepEqual(colour(pass, 0), AIM_TONES.idle.zone.map(r3), 'grey, however true the lay');
  assert.deepEqual(colour(pass, 1), AIM_TONES.idle.post.map(r3));
  assert.deepEqual(aimTone({ hot: true, ready: true }), AIM_TONES.hot);
  assert.deepEqual(aimTone({ hot: false }), AIM_TONES.laid);
  const f = flatAcross([10, 0, 0], [0, 5, 0], 0.5);
  assert.deepEqual([r3(f[0]) + 0, f[1] + 0, r3(Math.abs(f[2]))], [0, 0, 0.5]);
});

// ── the broadside camera ─────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV1 H8 the broadside camera: while a broadside is laid the eye eases over AIM_CAM_TAU to AIM_CAM_OUT past that battery\'s ports, AIM_CAM_UP over them and AIM_CAM_AFT toward her stern - smoothstepped - and home again on the release, the eye its own once there; AIM_CAM_CLEAR short of a ship alongside; never for the chasers, never crippled, never with the Broadside camera off (mutants: the setting unread, the ease, the smoothstep, the guard, the chasers taken)', async () => {
  const h = await helm();
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]], 2);
  const own = [0, 5, 0];
  assert.equal(h.host.aimEye(own, 0.1), own, 'nothing laid: the eye its own');
  h.view.look = { origin: own, dir: [1, -0.05, 0] };
  h.host.attackInput(true);
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  const bat = batteryOf(HULL.SmallShip, 'starboard').muzzles;
  const c = bat.reduce((s, m) => [s[0] + m[0] / bat.length, s[1] + m[1] / bat.length, s[2] + m[2] / bat.length], [0, 0, 0]);
  const want = [c[0] + AIM_CAM_OUT, c[1] + AIM_CAM_UP, c[2] - AIM_CAM_AFT];
  const k = 1 - Math.exp(-0.1 / AIM_CAM_TAU), s = k * k * (3 - 2 * k);
  const first = h.host.aimEye(own, 0.1);
  for (let i = 0; i < 3; i++) near(first[i], own[i] + (want[i] - own[i]) * s, 1e-9, 'eased, smoothstepped');
  let eye = null;
  for (let i = 0; i < 40; i++) eye = h.host.aimEye(own, 0.1);
  for (let i = 0; i < 3; i++) near(eye[i], want[i], 1e-6, 'over her ports');
  h.host.cancelAim();
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  const back = h.host.aimEye(own, 0.1);
  assert.ok(back[0] < eye[0] && back[0] > own[0], 'on its way home');
  for (let i = 0; i < 60; i++) eye = h.host.aimEye(own, 0.1);
  assert.equal(eye, own, 'home: the eye its own again');
  // a ship alongside: the way out stops AIM_CAM_CLEAR short of her side
  const alongside = { pos: [20, 0, 0], yaw: 0 };
  frames(h, [[h.e, alongside]], 2);
  h.host.attackInput(true);
  frames(h, [[h.e, alongside]]);
  for (let i = 0; i < 40; i++) eye = h.host.aimEye(own, 0.1);
  const entry = segmentBoxEntry(c, want, boxOf(h, h.e), AIM_CAM_CLEAR);
  assert.ok(entry && entry.t > 0 && entry.t < 1, 'her side across the camera\'s way');
  for (let i = 0; i < 3; i++) near(eye[i], entry.point[i], 1e-6, 'short of her side');
  // the chasers: no broadside camera
  h.host.cancelAim();
  h.view.look = { origin: own, dir: [0, -0.05, 1] };
  h.host.attackInput(true);
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]]);
  assert.equal(h.host.hudModel().aim.side, 'bow');
  for (let i = 0; i < 60; i++) eye = h.host.aimEye(own, 0.1);
  assert.equal(eye, own, 'over the bow the eye stays');
  // the Broadside camera off
  const off = await helm({ settings: { AimCamera: false } });
  off.view.look = { origin: own, dir: [1, -0.05, 0] };
  off.host.attackInput(true);
  frames(off, []);
  assert.equal(off.host.hudModel().aim.side, 'starboard');
  assert.equal(off.host.aimEye(own, 0.1), own, 'switched off');
  // crippled
  const w = await helm({ save: { v: 1, boats: { 42: { hull: 0, sail: 0, crew: 24, fire: 0, state: 'wrecked', barrels: 4 } }, notoriety: {}, day: 1, raids: [] } });
  w.view.look = { origin: own, dir: [1, -0.05, 0] };
  w.host.attackInput(true);
  frames(w, []);
  assert.equal(w.host.hudModel().aim.state, 'crippled');
  assert.equal(w.host.aimEye(own, 0.1), own, 'a crippled ship\'s guns are silent - no camera for them');
});

test('AUDIT NAV1 H9 the world wires it: the broadside camera\'s eye is the frame\'s - the view built from it, the look\'s ray started from it through _dwEyeOffset - never the travel view\'s; the Broadside camera is a part of the Naval Combat row, each player\'s own, read as AimCamera (mutants: the eye unwired, the part unread)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /renderer\.setFocus\(tvf \? cam\.pos : null, !!tvf && tvf\.blend >= 0\.5\);[^\n]*\n(\s*\/\/[^\n]*\n)+\s*if \(naval && !tvf\) mwv\.eye = naval\.aimEye\(mwv\.eye, dt\);\n\s*const view = betterAmbience\.view\(lookAt\(mwv\.eye,/);
  assert.match(w, /for \(let i = 0; i < 3; i\+\+\) _dwEyeOffset\[i\] = mwv\.eye\[i\] - cam\.pos\[i\];/);
  assert.match(w, /origin: \[cam\.pos\[0\] \+ _dwEyeOffset\[0\], cam\.pos\[1\] \+ _dwEyeOffset\[1\], cam\.pos\[2\] \+ _dwEyeOffset\[2\]\]/);
  assert.match(w, /key === 'AimCamera' \? getPref\('naval-aim-camera'\) !== false/);
  const f = src('systems/features.js');
  assert.match(f, /Object\.freeze\(\{ store: 'prefs', key: 'naval-aim-camera', initial: true, online: 'player' \}\)/);
  assert.match(f, /Object\.freeze\(\{ key: 'naval-aim-camera', label: 'Broadside camera' \}\)/);
});
