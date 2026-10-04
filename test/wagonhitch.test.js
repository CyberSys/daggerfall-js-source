// WAGON-HITCH (2026-10-04, Mac: "the wagon when attached to the horse should show in the overworld if attached and
// currently it sort of rubberbands and doesn't attach to the horse properly"): THE WAGON ON ITS SHAFTS, PINNED BY
// EXECUTION. The mod laid the moving wagon on a trail point and eased it there at 12 per second, so the gap to the
// rider stretched with speed and frame time and sprang back on every stop (measured before the change: 2.5 m standing,
// 3.07 m at the cart's 7.6 m/s, 3.031 / 3.038 on alternating frames; a following team's swung to 0.8 m off its horse
// as it set off). The pins below hold the gap to HITCHED_HORSE_LOCAL_Z at every frame, the drive-off from where the
// wagon stood, the dismount that stands the horse where the rider sat, the height and tilt still eased, the grown draw
// under the Overworld (OW-BIG) and another player's cart wagon held to their rider as drawn here. Mutants:
// tools/mutants/wagonhitch.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeWorld } from './hccWorld.mjs';
import { syntheticWagon41214 } from './hccModel.mjs';
import { TRANSPORT, WAGON_MODE, HORSE_MODE, HITCHED_HORSE_LOCAL_Z, NORMAL_GROUND_OFFSET, WAGON_MODEL_ID } from '../src/systems/horseCartLaw.js';
import { hitchedPoseStep, hitchAxle, WagonHitch } from '../src/systems/horseFollow.js';
import { createHorseCartPool, grownHitchedPosition } from '../src/scenes/horseCartPool.js';
import { HCC_WIRE_KIND } from '../src/systems/horseCartWire.js';
import { CARGO_DEFINITIONS } from '../src/systems/wagon41214.js';
import { quatForward, UNITY_QUAT_IDENTITY } from '../src/world/quat.js';

const L = HITCHED_HORSE_LOCAL_Z;
const hgap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const flat = (y = 0, normal = [0, 1, 0]) => ({ raycastAll: (o, d, max) => (d[1] < 0 && o[1] >= y && o[1] - y <= max ? [{ point: [o[0], y, o[2]], distance: o[1] - y, normal }] : []) });
const freshPose = () => ({ position: [0, 0, 0], rotation: [...UNITY_QUAT_IDENTITY], active: false, lastValidPosition: [0, 0, 0], lastValidRotation: [...UNITY_QUAT_IDENTITY], hasLastValid: false, up: [0, 1, 0], hitch: null });

test('WAGON-HITCH: riding the cart, the wagon hangs HITCHED_HORSE_LOCAL_Z behind the rider at every frame - at speed, on uneven frames, stopping and through a turn (the rubber band: 2.5 m standing, 3.07 m at 7.6 m/s) (mutant: the horizontal eased again)', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  assert.equal(w.mode, TRANSPORT.Cart);
  const gaps = [];
  const pose = () => rt.view().moving.pose;
  const frame = (dt) => { w.now += dt; rt.lateUpdate(dt); gaps.push(hgap(pose().position, w.pos)); };
  for (let i = 0; i < 120; i++) { const dt = i % 2 ? 1 / 30 : 1 / 90; w.pos[2] += 7.6 * dt; frame(dt); }   // the ride, on frames that will not keep time
  for (let i = 0; i < 30; i++) frame(1 / 60);   // the stop
  w.yaw = Math.PI / 2;
  for (let i = 0; i < 90; i++) { w.pos[0] += 7.6 / 60; frame(1 / 60); }   // a hard turn onto +x
  for (const g of gaps) assert.ok(Math.abs(g - L) < 1e-9, `the gap held at ${L}: ${g}`);
  // after the turn it stands behind the rider on the new line, facing the rider
  const p = pose();
  assert.ok(w.pos[0] - p.position[0] > L * 0.99, `behind on the new line: rider ${w.pos}, wagon ${p.position}`);
  const f = quatForward(p.rotation);
  const toRider = [w.pos[0] - p.position[0], 0, w.pos[2] - p.position[2]];
  assert.ok(Math.abs(Math.atan2(f[0], f[2]) - Math.atan2(toRider[0], toRider[2])) < 1e-6, 'the shafts point at the rider');
  assert.ok(Math.abs(p.position[1] - NORMAL_GROUND_OFFSET) < 1e-9, 'a metre over the flat ground, as the mod stands it');
});

test('WAGON-HITCH: a following team keeps its wagon HITCHED_HORSE_LOCAL_Z off the horse from the first step - it no longer swings onto the horse as the team sets off (measured before: 0.8 m), nor stretches with the horse\'s pace', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) { w.pos[2] += 0.1; step(); }
  w.mode = TRANSPORT.Foot; step(3);
  w.activateMode = 'dialogue'; rt.handleStationaryHorseActivation(1); step();
  assert.equal(rt.view().teamFollowing, true);
  let n = 0;
  for (let i = 0; i < 300; i++) {
    w.pos[2] += 6 / 30; step();
    const v = rt.view();
    if (!v.moving?.pose.active || !v.horse) continue;
    n++;
    assert.ok(Math.abs(hgap(v.moving.pose.position, v.horse.position) - L) < 1e-9, `frame ${i}: ${hgap(v.moving.pose.position, v.horse.position)}`);
  }
  assert.ok(n > 250, `the team was drawn: ${n}`);
});

test('WAGON-HITCH: mounting a parked team drives the wagon off from where it stood - not re-laid behind the camera (mutant: the drive-off seed dropped)', () => {
  const { w, rt, step, state, scene } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 60; i++) { w.pos[2] += 0.1; step(); }
  w.mode = TRANSPORT.Foot; step(3);
  assert.equal(state().Mode, WAGON_MODE.Deployed); assert.equal(state().HorseMode, HORSE_MODE.HitchedToWagon);
  const parked = scene(state().WorldX, state().WorldZ);
  // walk round to its right-hand side, still facing +z: behind the camera is a spot the wagon never stood on
  w.pos = [parked[0] + 2, 0.9, parked[2] + 1.5]; w.yaw = 0; step(2);
  assert.equal(rt.tryUseTransport(TRANSPORT.Cart).succeeded, true);
  step();
  const p = rt.view().moving.pose.position;
  assert.ok(Math.abs(hgap(p, w.pos) - L) < 1e-9, 'on its shafts');
  assert.ok(hgap(p, parked) < 1, `swung from where it was parked: wagon ${p}, parked ${parked}`);
});

test('WAGON-HITCH: a dismount parks the wagon where it hung, and the hitched horse comes to stand where the rider sat', () => {
  const { w, rt, step } = makeWorld();
  step(2); rt.tryUseTransport(TRANSPORT.Cart); step(2);
  for (let i = 0; i < 90; i++) { w.pos[2] += 0.08; w.pos[0] += 0.03; step(); }
  const rider = [...w.pos];
  w.mode = TRANSPORT.Foot; step(3);
  const h = rt.view().horse;
  assert.ok(h?.isInteractive, 'the hitched horse stands');
  assert.ok(hgap(h.position, rider) < 0.05, `the horse where the rider sat: horse ${h.position}, rider ${rider}`);
});

test('WAGON-HITCH: hitchedPoseStep - hidden until it first grounds; kept on its shafts at its last height where the ground is not built; height and tilt eased, facing exact (mutants: the height snapped, the tilt snapped)', () => {
  const hitch = [0, 1, 0];
  let w = hitchedPoseStep({ raycastAll: () => [] }, freshPose(), hitch, [0, 0, 1], L, 1 / 30);
  assert.equal(w.active, false, 'never grounded: not shown (the mod\'s SetActive(false))');
  w = hitchedPoseStep(flat(0), freshPose(), hitch, [0, 0, 1], L, 1 / 30);
  assert.equal(w.active, true);
  assert.deepEqual(w.position.map((v) => +v.toFixed(9)), [0, NORMAL_GROUND_OFFSET, -L], 'laid behind the facing, a metre up');
  assert.deepEqual(w.hitch, hitch);
  // the rider moves on over ground not yet built: still on its shafts, at the height it had
  const lost = hitchedPoseStep({ raycastAll: () => [] }, w, [4, 1, 0], [1, 0, 0], L, 1 / 30);
  assert.equal(lost.active, true);
  assert.ok(Math.abs(hgap(lost.position, [4, 1, 0]) - L) < 1e-9 && lost.position[1] === w.position[1], `kept on its shafts: ${lost.position}`);
  // a step up of a metre under a slope: the height and the tilt ease, the facing does not
  const n = [0, Math.cos(0.3), Math.sin(0.3)];
  const up1 = hitchedPoseStep(flat(1, n), w, [0, 2, 0], [0, 0, 1], L, 1 / 30);
  const posT = 1 - Math.exp(-12 / 30), rotT = 1 - Math.exp(-10 / 30);
  const target = 1 + n[1] * NORMAL_GROUND_OFFSET;   // the slope's ground a metre up its normal
  assert.ok(Math.abs(up1.position[1] - (w.position[1] + (target - w.position[1]) * posT)) < 1e-9, `the height eased by the mod's 12 per second: ${up1.position[1]}`);
  assert.ok(Math.abs(up1.up[2] - rotT * n[2] / Math.hypot(rotT * n[2], 1 - rotT + rotT * n[1])) < 1e-9, `the tilt eased by the mod's 10 per second: ${up1.up}`);
  const f = quatForward(up1.rotation);
  assert.ok(Math.abs(f[0]) < 1e-9 && f[2] > 0, 'still facing the hitch exactly');
});

test('WAGON-HITCH: hitchAxle is the trailer law - the axle on the line from where it was, the length from the hitch; WagonHitch reads a jump past the mod\'s 20 m', () => {
  const a = hitchAxle([0, 0, -10], [3, 5, 0], 2, [1, 0, 0]);
  const d = Math.hypot(3, 10);
  assert.ok(Math.abs(a.axle[0] - (3 - 2 * 3 / d)) < 1e-12 && Math.abs(a.axle[2] - (0 - 2 * 10 / d)) < 1e-12 && a.axle[1] === 5);
  assert.deepEqual(hitchAxle([3, 0, 0], [3, 5, 0], 2, [1, 0, 0]).axle, [1, 5, 0], 'on top of its hitch: behind the facing');
  const j = new WagonHitch();
  assert.equal(j.observe([0, 0, 0]), true, 'nothing observed yet');
  assert.equal(j.observe([0, 0, 19.9]), false);
  assert.equal(j.observe([0, 0, 40]), true, 'a 20.1 m leap');
  j.offset([5, 0, 0]); assert.deepEqual(j.last, [5, 0, 40]);
});

test('WAGON-HITCH x OW-BIG: grownHitchedPosition - the axle g times as far from the hitch on its line, the wheels on the ground found there (mutant: grown about the wagon, not the hitch)', () => {
  const pos = [0, 1, -L], hitch = [0, 1.3, 0];
  assert.equal(grownHitchedPosition(pos, hitch, 1, () => 0), pos, 'off the view: the wagon as it is');
  assert.equal(grownHitchedPosition(pos, null, 8, () => 0), pos, 'no hitch: never grown');
  const asked = [];
  const g8 = grownHitchedPosition(pos, hitch, 8, (q) => { asked.push(q); return 2; });
  assert.deepEqual(g8, [0, 2 + NORMAL_GROUND_OFFSET * 8, -L * 8]);
  assert.deepEqual(asked, [[0, 1.3, -L * 8]], 'the ground sought under the grown axle, near the hitch\'s height');
  assert.deepEqual(grownHitchedPosition(pos, hitch, 8, () => null), [0, 1 - NORMAL_GROUND_OFFSET + NORMAL_GROUND_OFFSET * 8, -L * 8], 'no ground there: the height it had');
});

// ── the pool: a fake renderer and mesh pipeline (test/hcc_pool.test.js's shape)
function fakeRenderer() {
  const r = { draws: [] };
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m) => r.draws.push({ gpu, m: [...m] });
  r.uploadTexture = () => 'k'; r.createBillboardBatch = () => ({ origin: null }); r.destroyBillboardBatch = () => {};
  return r;
}
function fakeMeshes() {
  const gpu = { [WAGON_MODEL_ID]: { id: WAGON_MODEL_ID } };
  for (const d of CARGO_DEFINITIONS) gpu[d.modelId] = { id: d.modelId };
  return { getGpuMesh: async (id) => gpu[id] ?? null, cpuModels: new Map([[WAGON_MODEL_ID, syntheticWagon41214()]]) };
}
const floorCollider = () => ({ surfaceHit: (o, d, max) => (d[1] < 0 && o[1] > 0 && o[1] <= max ? { dist: o[1], key: null, normal: [0, 1, 0] } : { dist: Infinity }) });
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const scaleOf = (m) => Math.hypot(m[0], m[1], m[2]);
const runtimeShowing = (view) => ({ view: () => ({ state: { HorseName: '' }, moving: null, deployed: null, horse: null, teamFollowing: false, horseFollowing: false, persistence: true, ...view }), lateUpdate() {}, horseTargetLabel: '' });

test('WAGON-HITCH x OW-BIG: under the Overworld my cart\'s wagon is drawn grown with the traveller about its hitch; a following team and a parked wagon stay their size', async () => {
  const renderer = fakeRenderer();
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0 });
  const pose = { active: true, position: [0, NORMAL_GROUND_OFFSET, -L], rotation: [...UNITY_QUAT_IDENTITY], hitch: [0, 1.3, 0] };
  const rt = runtimeShowing({ moving: { pose, wheel: { angle: 0 }, cargoTier: 0, interaction: false } });
  pool.attach(rt); pool.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; pool.draw(renderer);
  assert.ok(Math.abs(scaleOf(renderer.draws[0].m) - 1) < 1e-9, 'off the view: its own size');
  renderer.draws.length = 0; pool.draw(renderer, null, { selfGrow: 8, grow: () => 99 });
  const body = renderer.draws[0].m;
  assert.ok(Math.abs(scaleOf(body) - 8) < 1e-9, 'grown with the traveller\'s own step, never the peers\' law');
  const at = [body[12], body[13], body[14]], want = [0, NORMAL_GROUND_OFFSET * 8, -L * 8];
  assert.ok(at.every((v, i) => Math.abs(v - want[i]) < 1e-5), `its axle eight hitch-lengths back, its wheels on the ground: ${at}`);   // the matrix is Float32
  const following = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0 });
  following.attach(runtimeShowing({ teamFollowing: true, moving: { pose, wheel: { angle: 0 }, cargoTier: 0, interaction: true } }));
  following.frame(1 / 30, [0, 2, 5]); await flush();
  renderer.draws.length = 0; following.draw(renderer, null, { selfGrow: 8 });
  assert.ok(Math.abs(scaleOf(renderer.draws[0].m) - 1) < 1e-9, 'a following team\'s wagon beside its own-size horse is not grown');
});

test('WAGON-HITCH: another player\'s cart wagon hangs from their rider as drawn here - on its shafts at every frame, where the eased word ran behind; a parked wagon is never pulled (mutant: the anchor ignored)', async () => {
  const renderer = fakeRenderer();
  let anchor = [0, 0, 0];
  const pool = createHorseCartPool({ renderer, meshes: fakeMeshes(), collider: floorCollider, now: () => 0, selfId: () => 'me', peerAnchor: (id) => (id === 'p1' ? anchor : null) });
  pool.attach(runtimeShowing({}));
  const word = (z) => ({ w: [HCC_WIRE_KIND.Trailing, 0, NORMAL_GROUND_OFFSET, z - L, 0, 0, 0, 1, 0, 0] });
  pool.applyOwner('p1', word(0), (p) => p, 1);
  pool.frame(1 / 30, [0, 2, 5]); await flush();   // a peer's wagon starts the parts' build
  for (let i = 0; i < 60; i++) {
    anchor = [0, 0, i * 0.25];   // their rider, drawn moving at 7.5 m/s
    if (i % 6 === 0) pool.applyOwner('p1', word(anchor[2] - 1), (p) => p, i);   // a word that comes late and lags
    pool.frame(1 / 30, [0, 2, 5]);
    const p = pool.peers.get('p1');
    assert.ok(Math.abs(hgap(p.shownWagon, anchor) - L) < 1e-9, `frame ${i}: ${hgap(p.shownWagon, anchor)}`);
    assert.ok(p.shownWagon[2] < anchor[2], 'behind the rider');
  }
  renderer.draws.length = 0; pool.draw(renderer, null, { selfGrow: 8, grow: (q) => (q === pool.peers.get('p1').hitch ? 6 : 1) });
  assert.ok(Math.abs(scaleOf(renderer.draws[0].m) - 6) < 1e-9, 'grown by the OW-PEERS law at their rider');
  // a parked wagon with the same anchor is a wagon in the world: the word's own place
  pool.applyOwner('p1', { w: [HCC_WIRE_KIND.Deployed, 40, NORMAL_GROUND_OFFSET, 40, 0, 0, 0, 1, 0, 0] }, (p) => p, 99);
  for (let i = 0; i < 90; i++) pool.frame(1 / 30, [0, 2, 5]);
  const p = pool.peers.get('p1');
  assert.ok(hgap(p.shownWagon, [40, 0, 40]) < 0.01 && p.hitch === null, `parked where its word stands: ${p.shownWagon}`);
});

test('WAGON-HITCH: the world host hands the pool another player\'s cart rider and the Overworld\'s two grows (THE FOUR HOSTS: exterior.js has no travel view and no peers; worldModes.js and dungeonContext.js draw no wagon)', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /peerAnchor: \(id\) => \{ const sh = _peerMapPoses\.get\(id\); return sh && \(sh\.rd \| 0\) === 2 \? onlineToScene\(sh\) : null; \}/);
  assert.match(world, /hcc\.draw\(renderer, null, tvf \? \{ selfGrow: tvf\.grow, grow: peerGrow \} : undefined\);/);
  for (const host of ['worldModes.js', 'dungeonContext.js']) assert.doesNotMatch(readFileSync(new URL(`../src/scenes/${host}`, import.meta.url), 'utf8'), /hcc\.draw\(/, `${host} draws no wagon`);
});
