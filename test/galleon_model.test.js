// GALLEON (2026-10-01, Mac: "So this model is to replace the current ingame gallon model. The doors/hatches should open
// and close and we will need to give this a proper texture, along with a wheel at the helm, the sails and ropes, amd
// ensuring cannon fire shoots from the cannon holes properly") - the new galleon held to her model: the bake to the
// bytes, her parts facing out, her guns firing from her ports, her shutters, hatches and doors, her helm, her rig, her
// pictures, the loader's fallback, and HULL_BUILDS' Small Ship measured off her.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { bakeGalleon, galleonJson, toBoat, SOURCE_FBX, OUT, FRAME, ROLES } from '../tools/bakeGalleon.mjs';
import {
  galleonPrefab, GALLEON_PREFAB_ID, GALLEON_HULL_NODE, MEASURED, HELM, GUN, GALLEON_BATTERIES, HATCH_OPEN_DEG, LID_OPEN_DEG,
  WHEEL_TURNS, RUDDER_DEG,
} from '../src/world/galleonModel.js';
import { SAILS } from '../src/world/galleonRig.js';
import { galleonArt, galleonGlow, registerGalleonArt, _resetGalleonArt, GALLEON_ARCHIVE, TEX } from '../src/world/galleonArt.js';
import { createGalleonGunDeck, recoilAt, HOLD_S, RUN_IN_X, RUN_OUT_X, RECOIL, KICK_S, HAUL_S } from '../src/systems/naval/galleonGunDeck.js';
import { loadComeSailAwayModels, CSA_MODEL_URLS, GALLEON_MODEL_URL } from '../src/systems/comeSailAwayModels.js';
import { animatorOf, colliderBounds } from '../src/systems/comeSailAwayBoat.js';
import { HULL, hullBuild } from '../src/systems/naval/navalShips.js';
import { quatEuler } from '../src/world/unityAnimator.js';
import { scene, MODELS } from './csaScene.mjs';
import { sea } from './navalSea.mjs';

const bakeJson = JSON.parse(readFileSync(new URL(`../${OUT}`, import.meta.url), 'utf8'));
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
/** Whether two rotations are one (q and -q alike). */
const sameTurn = (q, r, eps = 1e-4) => Math.abs(Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]) - 1) < eps;
/** A Small Ship placed by the runtime, and the scene she stands in. */
const placed = () => { const s = scene(); const boat = s.place(HULL.SmallShip, 0); return { s, boat }; };
const nodeNamed = (boat, name) => [...boat.GameObject.walk()].find((n) => n.name === name) ?? null;
/** Möller-Trumbore: the distance along a ray to a triangle, or null. */
function rayTri(o, d, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const t0 = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) / det;
  if (u < 0 || u > 1) return null;
  const q = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
  if (v < 0 || u + v > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
  return t > 0 ? t : null;
}
/** The nearest of a mesh's triangles a ray meets within `max` (her frame), or null. */
function rayMesh(g, o, d, max) {
  let best = null;
  const P = g.positions, I = g.indices;
  for (let t = 0; t < I.length; t += 3) {
    const v = (i) => [P[I[t + i] * 3], P[I[t + i] * 3 + 1], P[I[t + i] * 3 + 2]];
    const h = rayTri(o, d, v(0), v(1), v(2));
    if (h != null && h <= max && (best == null || h < best)) best = h;
  }
  return best;
}

// ── the bake ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON THE BAKE: Mac\'s export baked to the boat\'s frame is the file committed, byte for byte - every role at the place it was read at, the rudder\'s five faces split off the hull, the scene\'s second station skipped, the source\'s hash and frame carried (mutants: a role misplaced, the rudder kept on the hull, the frame unread)', () => {
  const bytes = readFileSync(new URL(`../${SOURCE_FBX}`, import.meta.url));
  const baked = bakeGalleon(bytes);
  assert.equal(galleonJson(baked), readFileSync(new URL(`../${OUT}`, import.meta.url), 'utf8'), 'tools/bakeGalleon.mjs re-makes galleon.json to the byte');
  assert.equal(baked.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(baked.frame, { ...FRAME });
  const roles = baked.parts.map((p) => p.role);
  assert.deepEqual([...roles].sort(), [...Object.values(ROLES).map((r) => r.role), 'rudder'].sort(), 'every role once, and her rudder');
  assert.equal(baked.parts.find((p) => p.role === 'rudder').polygons.length, 5, 'the rudder\'s five faces');
  // the frame: Blender's scene (Z up, the stem to -Y) into the boat's (Y up, +Z the bow, +X starboard), 0.7 of it, the
  // waterline and the midship taken off
  assert.deepEqual(toBoat([FRAME.midship, 0, FRAME.waterline]), [-0, 0, 0]);
  assert.deepEqual(toBoat([FRAME.midship + 10, -1, FRAME.waterline + 2]), [0.7, 1.4, 7]);
});

test('GALLEON HER PARTS FACE OUT: every baked part, the hull\'s planking to the crow\'s nest, winds its faces outward (the front face Unity draws) - a positive volume each, her closed hatch covers and her shutter shut fast (mutants: the winding flipped)', () => {
  for (const p of bakeJson.parts) {
    const P = p.positions, T = p.triangles;
    let vol = 0;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
    }
    assert.ok(vol > 0, `${p.role}: faces out (${vol.toFixed(3)})`);
  }
});

// ── the guns ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON THE GUNS FIRE FROM HER PORTS: five guns a side, each muzzle at its port\'s middle a hair outside her planking - its line in from the muzzle meets none of her hull through the port and her planking a port\'s width aside; each gun run out reaches it, run in stands clear of the shutter; her chasers over her bow rail and her barrels over her stern, all as HULL_BUILDS reads them (mutants: a muzzle off its port, inside her planking, the battery not hers)', () => {
  const b = hullBuild(HULL.SmallShip);
  assert.deepEqual(b.broadside.map((m) => [...m]), GALLEON_BATTERIES.broadside.map((m) => [...m]), 'HULL_BUILDS\' Small Ship broadside is her ports\'');
  assert.deepEqual(b.bow.muzzles.map((m) => [...m]), GALLEON_BATTERIES.bow.map((m) => [...m]));
  assert.deepEqual(b.stern.muzzles.map((m) => [...m]), GALLEON_BATTERIES.stern.map((m) => [...m]));
  assert.equal(b.broadside.length, 5);
  const hull = MODELS.geometry('galleon:hull:collider');
  b.broadside.forEach((m, i) => {
    near(m[2], MEASURED.portZ[i], 1e-9, `gun ${i} at its port`);
    assert.ok(m[1] > MEASURED.portSillY + 0.3 && m[1] < MEASURED.portTopY - 0.3, `gun ${i}: between the sill and the lintel (${m[1]})`);
    assert.ok(m[0] > MEASURED.hullOuterX && m[0] < MEASURED.hullOuterX + 0.2, `gun ${i}: a hair outside her planking (${m[0]})`);
    // the ball's way out: from inside her (the gun deck, a metre in) to the muzzle, through the port - and the same
    // line a port's width aside meets her planking
    for (const [s, z] of [[1, m[2]], [-1, m[2]]]) {
      const from = [s * (MEASURED.hullInnerX - 1), m[1], z], dir = [s, 0, 0];
      assert.equal(rayMesh(hull, from, dir, Math.abs(m[0] - from[0]) + 0.01), null, `gun ${i} ${s > 0 ? 'starboard' : 'port'}: out through the port`);
      const aside = [from[0], m[1], z + MEASURED.portHalfW + 0.25];
      assert.ok(rayMesh(hull, aside, dir, 3) != null, `gun ${i}: her planking beside the port`);
    }
    near(GUN.runOutX + GUN.muzzleX, m[0], 0.05, `gun ${i} run out: its muzzle at the ball's`);
    assert.ok(GUN.runInX + GUN.muzzleX < MEASURED.hullOuterX - 0.05, `gun ${i} run in: clear of the shutter`);
  });
  for (const m of b.bow.muzzles) assert.ok(m[2] < b.bowZ && m[1] > MEASURED.railY, 'a chaser over her bow rail');
  for (const m of b.stern.muzzles) assert.ok(m[2] < b.aftZ && m[1] < MEASURED.castleRoofY, 'the barrels astern under her castle');
});

test('GALLEON THE GUN DECK AT WORK: a battery laid opens its side\'s shutters and runs its guns out over a second and more, the other side shut and run in; a gun fired kicks RECOIL m inboard in KICK_S and is hauled out over HAUL_S; HOLD_S past the last word the side runs in and shuts - read off the nodes alone, a hull without them left be (mutants: the other side laid, no recoil, the hold dropped, a gun never run in)', () => {
  const { s, boat } = placed();
  const deck = createGalleonGunDeck();
  const run = (from, secs) => { let t = from; for (; t < from + secs - 1e-9; t += 0.05) { deck.step([boat], t); for (const n of boat.GameObject.walk()) for (const c of n.getComponents('Animator')) c.animator?.update(0.05); } return t; };
  let r = deck.read(boat, 0);
  assert.deepEqual([r.starboard.guns.length, r.port.guns.length, r.starboard.open.length, r.port.open.length], [5, 5, 5, 5], 'five guns and five shutters a side');
  assert.ok(r.starboard.guns.every((x) => Math.abs(x - RUN_IN_X) < 1e-9), 'run in to load');
  deck.lay(boat, 'starboard', 0);
  let t = run(0, 0.5);
  r = deck.read(boat, t);
  assert.ok(r.starboard.laid && !r.port.laid);
  assert.ok(r.starboard.open.every(Boolean) && !r.port.open.some(Boolean), 'her starboard shutters up, her port ones shut');
  assert.ok(r.starboard.guns.every((x) => x > RUN_IN_X + 0.2 && x < RUN_OUT_X), `running out (${r.starboard.guns.map((x) => x.toFixed(2))})`);
  t = run(t, 1.5);
  assert.ok(deck.read(boat, t).starboard.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-9), 'run out');
  // the shutters as her model has them: up past level, on the top hinge
  const lid = nodeNamed(boat, 'GunportStarboard2');
  assert.ok(sameTurn(lid.localRotation, quatEuler(0, 0, LID_OPEN_DEG)), 'the shutter stands open at LID_OPEN_DEG');
  // the middle gun fires: kicked in, hauled out
  deck.fired(boat, 'starboard', 2, t);
  const shot = t;
  t = run(t, KICK_S + 0.05);
  near(deck.read(boat, t).starboard.guns[2], RUN_OUT_X - RECOIL, 0.05, 'kicked back RECOIL');
  assert.ok(deck.read(boat, t).starboard.guns[1] === RUN_OUT_X, 'its neighbours stand');
  t = run(t, HAUL_S);
  near(deck.read(boat, t).starboard.guns[2], RUN_OUT_X, 1e-6, 'hauled out again');
  near(recoilAt(0), 0, 1e-12, 'nothing before the kick'); near(recoilAt(KICK_S), RECOIL, 1e-12, 'the kick'); near(recoilAt(KICK_S + HAUL_S), 0, 1e-12, 'out');
  // HOLD_S past the shot: run in and shut
  t = run(t, shot + HOLD_S + 2 - t);
  r = deck.read(boat, t);
  assert.ok(!r.starboard.laid && r.starboard.guns.every((x) => Math.abs(x - RUN_IN_X) < 1e-9) && !r.starboard.open.some(Boolean), 'run in to load, shut');
  // a hull of another build: none of her nodes, nothing asked
  const other = s.place(HULL.Carrack, 0);
  deck.lay(other, 'starboard', t);
  deck.step([other], t + 1);
  assert.equal(deck.read(other), null, 'a Carrack carries no galleon\'s gun deck');
});

test('GALLEON THE HOST STANDS HER GUN DECK: at her armed helm a look to starboard lays her starboard battery - its shutters up, its guns run out, her port side shut - and the release fires it out of those ports, each gun kicking back as its own ball leaves (the shot field\'s muzzle, its index the port\'s) (mutants: the lay unwired, the fired unwired)', async () => {
  const h = await sea({ hull: HULL.SmallShip });
  h.view.look = { origin: [0, 5, 0], dir: [1, -0.05, 0] };
  h.host.attackInput(true);
  h.run(2);
  let r = h.host.gunDeckOf(h.boat);
  assert.ok(r.starboard.laid && !r.port.laid, 'her starboard battery laid');
  assert.ok(r.starboard.open.every(Boolean) && !r.port.open.some(Boolean), 'its shutters up, her port ones shut');
  assert.ok(r.starboard.guns.every((x) => Math.abs(x - RUN_OUT_X) < 1e-6), `run out (${r.starboard.guns.map((x) => x.toFixed(2))})`);
  h.host.attackInput(false);
  const kicked = new Set();
  for (let i = 0; i < 30; i++) {
    h.run(0.05);
    r = h.host.gunDeckOf(h.boat);
    r.starboard.guns.forEach((x, k) => { if (x < RUN_OUT_X - RECOIL / 2) kicked.add(k); });
  }
  assert.deepEqual([...kicked].sort(), [0, 1, 2, 3, 4], 'each gun kicked back as its ball left');
  assert.ok(r.port.guns.every((x) => Math.abs(x - RUN_IN_X) < 1e-6), 'her port guns stood in');
});

// ── her hatches, doors and helm ─────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HER HATCHES AND DOORS OPEN AND CLOSE: each hatch cover and each door carries a DoorTrigger the walk sizes to its collider and files under BoardTriggers; Come Sail Away\'s TriggerDoor turns its Opened over - the covers lift on their starboard edge to HATCH_OPEN_DEG, the doors swing aft - and back (mutants: no trigger, the trigger unsized, the clip unread)', () => {
  const { s, boat } = placed();
  const doors = new Map(boat.BoardTriggers.filter((t) => /^(Hatch|CastleDoor|BulkheadDoor)/.test(t.parent?.name)).map((t) => [t.parent.name, t]));
  assert.deepEqual([...doors.keys()].sort(), ['BulkheadDoor', 'CastleDoor', 'HatchAft', 'HatchFore']);
  for (const [name, trigger] of doors) {
    const box = trigger.getComponent('BoxCollider');
    const b = colliderBounds({ models: MODELS }, trigger.parent, trigger.parent.getComponent('MeshCollider'));
    assert.ok(Math.abs(box.m_Size.x - (b.size[0] + 0.01)) < 1e-4 && box.m_IsTrigger !== false, `${name}: the trigger is its collider's box`);
  }
  const step = (secs) => { for (let t = 0; t < secs; t += 0.25) s.frame(); };
  const hatch = doors.get('HatchFore').parent, door = doors.get('CastleDoor').parent;
  const shut = [...hatch.localRotation], doorShut = [...door.localRotation];
  s.rt.turnDoor(doors.get('HatchFore'));
  s.rt.turnDoor(doors.get('CastleDoor'));
  step(3);
  assert.equal(animatorOf(hatch).GetBool('Opened'), true);
  assert.ok(sameTurn(hatch.localRotation, quatEuler(0, 0, HATCH_OPEN_DEG)), `the cover up past upright (${hatch.localRotation.map((v) => v.toFixed(3))})`);
  assert.ok(!sameTurn(door.localRotation, doorShut, 1e-2), 'the door swung');
  s.rt.turnDoor(doors.get('HatchFore'));
  s.rt.turnDoor(doors.get('CastleDoor'));
  step(3);
  assert.ok(sameTurn(hatch.localRotation, shut) && sameTurn(door.localRotation, doorShut), 'both shut again');
});

test('GALLEON HER HELM: a wheel on the castle\'s roof before the helmsman\'s place, turned WHEEL_TURNS hard over and the rudder RUDDER_DEG on its post, both by the mod\'s Rudder Wheel Controller\'s TurnAngle through her own clips - her helm taken, sail made, the helm put hard over each way; the DriveTrigger at the wheel and the DrivePosition behind it on her roof (mutants: the wheel still, the rudder still, the sides swapped)', () => {
  const { s, boat } = placed();
  const wheel = nodeNamed(boat, 'HelmWheel'), rudder = nodeNamed(boat, 'HelmRudder');
  assert.ok(wheel && rudder && wheel.parent === boat.RudderObject && rudder.parent === boat.RudderObject, 'both under her RudderObject');
  assert.deepEqual([...boat.DriveTrigger.parent.localPosition], [...HELM.hub], 'the helm\'s trigger at the wheel');
  assert.deepEqual([...boat.DrivePosition.localPosition], [...HELM.stand]);
  near(HELM.stand[1], MEASURED.castleRoofY, 1e-9, 'the helmsman on her roof');
  assert.ok(HELM.stand[2] < HELM.hub[2], 'behind the wheel');
  const wind = () => { s.rt.state.windVectorCurrent = [0, 0, 1.5]; s.rt.state.windVectorTarget = [0, 0, 1.5]; };   // astern
  s.helm(boat);
  wind();
  s.rt.RaiseSails();
  for (const [key, sign] of [['MoveRight', 1], ['MoveLeft', -1]]) {
    s.held.clear();
    s.held.add(key);
    for (let i = 0; i < 40; i++) { wind(); s.frame(); }
    assert.equal(animatorOf(boat.RudderObject).stateName, 'Sailing');
    assert.ok(sameTurn(wheel.localRotation, quatEuler(0, 0, -sign * WHEEL_TURNS * 360)), `the wheel hard ${sign > 0 ? 'right' : 'left'} (${wheel.localRotation.map((v) => v.toFixed(3))})`);
    assert.ok(sameTurn(rudder.localRotation, quatEuler(0, -sign * RUDDER_DEG, 0)), `the rudder over ${-sign * RUDDER_DEG}`);
  }
});

// ── her rig ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HER RIG: five sails by Come Sail Away\'s names - three square (two of them small), a large gaff and a large staysail - on four booms the walk finds; raised, each comes down off its yard and the canvas hangs set, lowered it is furled again; every set sail over her roof, untrimmed, stands in HULL_BUILDS\' rig boxes, which stand over her roof (mutants: a kind misnamed, the canvas still, a box short of her canvas)', () => {
  // her booms home (the auto trim off): the canvas as the rig boxes measure it, square to her
  const s = scene({ settings: { 'SailingAssist.AutoTrimming': false } });
  const boat = s.place(HULL.SmallShip, 0);
  assert.deepEqual(boat.Sails.map((n) => n.name), ['ForeCourseSquareSail', 'ForeTopsailSquareSmallSail', 'MainTopsailSquareSmallSail', 'MainGaffLargeSail', 'JibStayLargeSail']);
  assert.equal(boat.Sails.length, SAILS.length);
  assert.deepEqual([boat.SailsSquare.length, boat.SailsGaff.length, boat.SailsStay.length, boat.SailsLateen.length, boat.SailsSmall.length, boat.SailsLarge.length, boat.Booms.length], [3, 1, 1, 0, 2, 2, 4]);
  const skins = [...boat.GameObject.walk()].map((n) => n.getComponent('SkinnedMeshRenderer')).filter(Boolean);
  assert.ok(skins.filter((r) => r.m_Bones.length > 20).length >= SAILS.length, 'each sail skinned, a bone a vertex');
  const pts = () => [...boat.GameObject.walk()].filter((n) => /^B\d+$/.test(n.name)).map((n) => { const m = n.worldMatrix(); return [m[12], m[13], m[14]]; });
  const wind = () => { s.rt.state.windVectorCurrent = [0, 0, 1.5]; s.rt.state.windVectorTarget = [0, 0, 1.5]; };   // astern: no square sail kept furled
  const frames = (n) => { for (let i = 0; i < n; i++) { wind(); s.frame(); } };
  s.helm(boat);
  frames(8);
  const furled = pts();
  s.rt.RaiseSails();
  frames(16);
  assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === false), 'raised: every sail unstowed');
  const set = pts();
  const moved = set.filter((p, i) => Math.hypot(p[0] - furled[i][0], p[1] - furled[i][1], p[2] - furled[i][2]) > 0.5).length;
  assert.ok(moved > set.length / 2, `the canvas comes down off its yards (${moved} of ${set.length})`);
  // the rig boxes: over her roof, and every point of her set canvas over it within them
  const b = hullBuild(HULL.SmallShip);
  for (const [mn] of b.rig) assert.ok(mn[1] >= b.top - 1e-9, 'a rig box over her roof');
  const inv = boat.MeshObject.worldMatrix();
  const local = (p) => [p[0] - inv[12], p[1] - inv[13], p[2] - inv[14]];   // she stands unturned
  const out = set.map(local).filter((p) => p[1] > b.top + 0.3 && !b.rig.some(([mn, mx]) => p.every((v, k) => v >= mn[k] - 0.3 && v <= mx[k] + 0.3)));
  assert.deepEqual(out.map((p) => p.map((v) => +v.toFixed(2))), [], 'her set canvas inside her rig boxes');
  s.rt.LowerSails();
  frames(16);
  assert.ok(boat.Sails.every((n) => animatorOf(n).GetBool('Stowed') === true), 'lowered: furled');
});

// ── her pictures ────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HER PICTURES: painted at load from numbers alone - the same bytes every time - a record a TEX entry under GALLEON_ARCHIVE, each a power of two; registered with the vendor textures once (seventeen stand-ins), her stern windows alone glowing by night (mutants: a picture seeded off the clock, registered twice, the glow everywhere)', async () => {
  const hash = (art) => createHash('sha256').update(JSON.stringify(art.map(([r, p]) => [r, p.width, p.height, Buffer.from(p.data).toString('base64')]))).digest('hex');
  const a = galleonArt(), b = galleonArt();
  assert.equal(hash(a), hash(b), 'the same bytes');
  assert.deepEqual(a.map(([r]) => r), Object.values(TEX), 'a picture a record, in record order');
  for (const [r, p] of a) {
    assert.ok(p.width > 0 && (p.width & (p.width - 1)) === 0 && (p.height & (p.height - 1)) === 0, `record ${r}: a power of two`);
    assert.equal(p.data.length, p.width * p.height * 4);
  }
  assert.ok(galleonGlow(TEX.sternWindows), 'her stern windows glow');
  assert.equal(galleonGlow(TEX.hullSide), null, 'nothing else');
  _resetGalleonArt();
  const added = [];
  const add = (entries) => { added.push(...entries); return entries.length; };
  assert.equal(registerGalleonArt(add), Object.keys(TEX).length);
  assert.equal(registerGalleonArt(add), 0, 'once');
  assert.ok(added.every((e) => e.archive === GALLEON_ARCHIVE && e.standIn === true && e.frame === 0 && typeof e.build === 'function'), 'stand-ins under her own archive');
  const built = await added.find((e) => e.record === TEX.castle).build();
  assert.deepEqual([built.width, built.height], [a.find(([r]) => r === TEX.castle)[1].width, a.find(([r]) => r === TEX.castle)[1].height], 'built as painted');
  _resetGalleonArt();
});

// ── the loader ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON THE LOADER: the new galleon over hull 2 when her model answers; when it does not, or will not build, hull 2 is the mod\'s own galleon and it says so once - never no ship; the mod\'s files never among hers (mutants: the fallback dropped, the warning every time, her URL among the mod\'s)', async () => {
  const fileFetch = (deny = null, swap = null) => async (url) => {
    if (deny && url === deny) return { ok: false, status: 404 };
    if (swap && url === swap.url) return { ok: true, json: async () => swap.json };
    const bytes = readFileSync(new URL(url));
    return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
  };
  assert.ok(Object.values(CSA_MODEL_URLS).every((u) => u.includes('vendor/come-sail-away/Models/')) && GALLEON_MODEL_URL.endsWith('src/assets/galleon/galleon.json'));
  const warns = [];
  const log = { warn: (...a) => warns.push(a) };
  const hers = await loadComeSailAwayModels(fileFetch(), CSA_MODEL_URLS, log);
  assert.equal(hers.galleon, true);
  assert.ok(hers.prefab(GALLEON_PREFAB_ID).children.some((c) => c.name === GALLEON_HULL_NODE), 'her hull under prefab 112412');
  assert.equal(warns.length, 0);
  const missing = await loadComeSailAwayModels(fileFetch(GALLEON_MODEL_URL), CSA_MODEL_URLS, log);
  assert.equal(missing.galleon, false, 'her model missing: the mod\'s own galleon');
  assert.equal(warns.length, 1);
  const broken = await loadComeSailAwayModels(fileFetch(null, { url: GALLEON_MODEL_URL, json: { ...bakeJson, parts: [] } }), CSA_MODEL_URLS, log);
  assert.equal(broken.galleon, false, 'her model broken: the mod\'s own galleon');
  assert.equal(warns.length, 2);
  assert.match(String(warns[1][0]), /would not build/);
  // the prefab builder alone, as the loader calls it
  assert.throws(() => galleonPrefab({ ...bakeJson, parts: [] }, JSON.parse(readFileSync(new URL('../vendor/come-sail-away/Models/prefabs.json', import.meta.url), 'utf8'))), /the bake has no /);
});

// ── HULL_BUILDS' Small Ship ─────────────────────────────────────────────────────────────────────────────────────────

test('GALLEON HULL_BUILDS\' SMALL SHIP IS HERS: her box her MeshCollider\'s bounds (her hull\'s planking and her castle\'s) - stem, stern, half beam, keel and roof to the centimetre; her deck her main deck, her half beam at it inside her planking (mutants: the mod\'s galleon\'s numbers back)', () => {
  const { boat } = placed();
  const b = hullBuild(HULL.SmallShip);
  assert.equal(boat.MeshObject.name, GALLEON_HULL_NODE, 'her hull the boat\'s frame');
  const m = boat.MeshObject.worldMatrix();
  const bounds = colliderBounds({ models: MODELS }, boat.MeshObject, boat.MeshCollider);
  const lo = [bounds.min[0] - m[12], bounds.min[1] - m[13], bounds.min[2] - m[14]], hi = [bounds.max[0] - m[12], bounds.max[1] - m[13], bounds.max[2] - m[14]];
  near(b.bowZ, hi[2], 0.006, 'her stem'); near(b.aftZ, lo[2], 0.006, 'her stern');
  near(b.halfWidth, Math.max(hi[0], -lo[0]), 0.006, 'her half beam'); near(b.keel, lo[1], 0.006, 'her keel'); near(b.top, hi[1], 0.006, 'her roof');
  near(b.deck, MEASURED.mainDeckY, 0.01, 'her deck');
  assert.ok(b.beam > 5.3 && b.beam < MEASURED.hullOuterX, `her half beam at her deck (${b.beam})`);
});
