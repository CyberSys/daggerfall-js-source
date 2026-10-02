// @ts-check
// GALLEON (2026-10-01, Mac: "So this model is to replace the current ingame gallon model. The doors/hatches should
// open and close and we will need to give this a proper texture, along with a wheel at the helm, the sails and ropes,
// and ensuring cannon fire shoots from the cannon holes properly. I really need you to go all in and make this
// something special"): THE NEW GALLEON - Mac's ship, built as Come Sail Away builds a hull.
//
// Come Sail Away's hull 2 (the Small Ship, the mod's `Galleon`) is a prefab the C# instances and walks BY NAME
// (systems/comeSailAwayBoat.js GetBoatTransforms): its MeshCollider the boat's frame, its DrivePosition the helm, its
// triggers what the player activates, its Booms and Sails the rig the wind fills, its RudderObject the wheel and the
// rudder, its lanterns, crew and modifiers. So the new galleon is that prefab again - `galleonPrefab` makes the tree,
// every node the walk reads under the name it reads it by - over Mac's model (src/assets/galleon/galleon.json, baked
// by tools/bakeGalleon.mjs) and the parts built here, and systems/comeSailAwayModels.js `withGalleon` stands it in for
// prefab 112412. Everything that sails, steers, boards, lights, saves, fights and goes online on hull 2 then reads her
// without a line of it knowing she is new.
//
// WHAT IS MAC'S AND WHAT IS BUILT. His: the hull with its ten gunports, the gun deck and the main deck with their two
// hatchways, the stern castle with its doorway, the bulkhead below with its own, the stairs, the masts, the crow's
// nest, the bowsprit, the rudder (his hull's, cut out to turn), the two hatch covers and the gunport shutter. Built
// here: their textures (world/galleonArt.js), the doors that hang in his two doorways, the shutter at all ten ports,
// stairs down each hatchway, the guns behind the ports and the chasers on the bow, the helm's wheel and its pedestal,
// the rig (world/galleonRig.js), the rope ladders over the side. Come Sail Away's own small things are hers as they
// were the old galleon's - the anchor, the stove, the lanterns' hooks, the crate, the flag, the wake - stood in her.
//
// WHAT OPENS AND CLOSES rides the mod's own Door Controller (systems/comeSailAway.js TriggerDoor: activate it, its
// Animator's Opened turns over, Daggerfall's door clips play): the castle's door and the bulkhead's swing on their
// hinges, each hatch cover lifts on its starboard edge, and each gunport's shutter swings up on its top - those ten
// are not the player's to work, the guns' (systems/naval/galleonGunDeck.js) open them as a broadside is laid.
//
// THE FRAME is Unity's, the boat's: +x starboard, +y up, +z the bow, the root on the waterline - every measurement
// below is read off the bake (its frame, tools/bakeGalleon.mjs FRAME: Mac's metres x 0.7) and pinned against it
// (test/galleon_model.test.js). Not a DFU member. Ledger A (GALLEON).
import { GALLEON_ARCHIVE, TEX, GALLEON_TILE, BANDS } from './galleonArt.js';
import { MeshBench, colliderOf, prism, rope, box, planarUv, newell, sub, add, scl, dot, norm, len } from './galleonMesh.js';
import { buildRig, RIG } from './galleonRig.js';
import { pathHash } from './unityAnimator.js';
import { mat4FromQuatPosScale } from './quat.js';
import { multiply } from './mat4.js';

/** The prefab she stands in for: Come Sail Away's hull 2 (FIRST_HULL_MODEL_ID + 2). */
export const GALLEON_PREFAB_ID = 112412;
/** The node the boat's frame is (Boat.MeshObject): her hull, carrying the first MeshCollider of the tree. */
export const GALLEON_HULL_NODE = 'NewGalleon';

/** Her measurements in the boat's frame (metres): each read off the bake - the scene's number x 0.7, the waterline and
 *  the midship taken off (tools/bakeGalleon.mjs FRAME) - and pinned there. */
export const MEASURED = Object.freeze({
  mainDeckY: 6.202, mainDeckUnderY: 5.943, gunDeckY: 1.085, railY: 6.923,
  castleRoofY: 11.018, castleCeilingY: 10.577, castleFrontZ: -10.297, castleFrontInnerZ: -10.493, castleAftZ: -19.908,
  hullOuterX: 5.859, hullInnerX: 5.11,
  portZ: Object.freeze([-7.595, -4.417, -0.714, 2.8105, 6.5135]), portHalfW: 0.371, portSillY: 1.561, portTopY: 2.926,
  hatchAft: Object.freeze({ z0: -5.971, z1: -3.178, halfX: 1.071 }), hatchFore: Object.freeze({ z0: 3.318, z1: 6.111, halfX: 1.071 }),
  gangway: Object.freeze({ z0: -0.581, z1: 1.575, sillY: 6.314 }),
  castleDoor: Object.freeze({ halfX: 0.777, y0: 6.181, y1: 8.771, z: -10.395 }),
  bulkheadDoor: Object.freeze({ halfX: 0.777, y0: 1.085, y1: 3.675, z: -10.16 }),
  rudderPivotZ: -18.228,
  // GALLEON-2: her six deck beams over the gun deck (Mac's second export), aft to fore - each 0.775 m fore and aft,
  // their feet `underY`, their heads in the main deck
  beams: Object.freeze({ z: Object.freeze([-12.857, -6.912, -1.89, 2.208, 7.107, 10.469]), halfZ: 0.387, underY: 5.221, halfX: 5.079 }),
});

/** The slope of the ramps her castle's stair wells run down under her two flights (a face's normal's y between
 *  these, 34 degrees off level): the treads her collider, never the ramp under them. */
export const WELL_RAMP_NY = Object.freeze([0.75, 0.9]);
/** The helm: the wheel's hub (on the castle's roof, inside its low parapet), and where the helmsman stands - far
 *  enough behind it, and its rim low enough, that the eye at the helm looks over it to the bow (the mod's own galleon
 *  stood its wheel 1.4 m before its DrivePosition and a metre under it). */
export const HELM = Object.freeze({ hub: Object.freeze([0, MEASURED.castleRoofY + 0.92, -12.9]), stand: Object.freeze([0, MEASURED.castleRoofY, -14.25]), wheelR: 0.54 });
/** The guns: each port's gun, run out (its muzzle a hair outside her planking) and run in (to load). */
export const GUN = Object.freeze({ muzzleX: 1.75, runOutX: 4.16, runInX: 3.06, axisY: 2.2435, chaserY: 7.45 });
/** Her five sides' guns as HULL_BUILDS reads them (systems/naval/navalShips.js): the starboard muzzles (the port side
 *  their mirror), the bow chasers, the barrels' drop astern. */
export const GALLEON_BATTERIES = Object.freeze({
  broadside: Object.freeze(MEASURED.portZ.map((z) => Object.freeze([MEASURED.hullOuterX + 0.09, GUN.axisY, z]))),
  bow: Object.freeze([Object.freeze([-1.15, GUN.chaserY, 19.15]), Object.freeze([1.15, GUN.chaserY, 19.15])]),
  stern: Object.freeze([Object.freeze([0, 5.4, -20.6])]),
});

// ── the bake's parts, textured ─────────────────────────────────────────────────────────────────────────────────────

/** Which picture a face of a baked part wears, and how it lies on it: `{ rec, uv(p) }` - or, a face of a livery (the
 *  hull's side, the castle's, the stern's), `{ band, u(p) }`: the livery's slices by height (galleonArt.js BANDS),
 *  each 64 texels tall, that bakedPartGeometry cuts the face into, u along her as the livery tiles. */
export function faceSkin(role, n, c) {
  const tiled = (rec) => ({ rec, uv: (p) => planarUv(p, n, GALLEON_TILE[keyOf(rec)]) });
  const banded = (name) => ({ band: BANDS[name], u: (p) => planarUv(p, n, [GALLEON_TILE[name][0], 1])[0] });
  const up = n[1] > 0.7, down = n[1] < -0.7;
  switch (role) {
    case 'hull': {
      // a gunport's throat: its sill, lintel and cheeks, painted red inside as the lids are
      if (c[1] > 1.4 && c[1] < 3.1 && Math.abs(c[0]) > 4.9 && Math.abs(c[0]) < 6.1 && Math.abs(n[0]) < 0.3) return tiled(TEX.lid);
      if (up) return tiled(c[1] > 6.3 ? TEX.trim : TEX.hullInner);
      const core = [0, c[1], Math.max(-14, Math.min(14, c[2]))];
      if (dot(n, sub(core, c)) > 0) return tiled(TEX.hullInner);   // a face looking in toward her keel line: the ceiling planks
      if (n[1] < -0.55) return tiled(TEX.hullBottom);
      return banded('hullSide');
    }
    case 'rudder': return tiled(TEX.hullBottom);
    // GALLEON-2: a deck beam is a squared oak timber, its grain along it (athwartships) on its sides and its foot
    case 'deckBeam': return { rec: TEX.trim, uv: (p) => [p[0] / GALLEON_TILE.trim[0], (Math.abs(n[1]) > 0.7 ? p[2] : p[1]) / GALLEON_TILE.trim[1]] };
    case 'gunDeck': return tiled(TEX.deck);
    case 'mainDeck': return tiled(up ? TEX.deck : down ? TEX.underDeck : TEX.trim);   // GALLEON-2: under it, her beams are Mac's
    case 'castle': {
      const out = dot(n, sub(c, [0, 8.4, -15.1])) > 0;
      if (Math.abs(c[0]) < 0.85 && c[2] > -10.6 && Math.abs(n[2]) < 0.3 && c[1] < 9.2) return tiled(TEX.trim);   // the doorway's jambs and head
      if (!up && !down && Math.abs(n[1]) > 0.4 && c[1] > 9) return tiled(TEX.trim);   // the stairwells' cut
      if (out) {
        if (up) return tiled(TEX.deck);
        if (n[2] < -0.25 && c[1] > 7.6) return banded('sternWindows');
        if (down) return tiled(TEX.hullInner);
        return banded('castle');
      }
      return tiled(down ? TEX.beams : up ? TEX.deck : TEX.hullInner);
    }
    case 'castleRail': case 'castleParapet': {
      const out = dot(n, sub(c, [0, c[1], -15.0])) > 0;
      if (up || down) return tiled(TEX.trim);
      return out ? banded('castle') : tiled(TEX.trim);
    }
    case 'stairsPort': case 'stairsStarboard': return tiled(up ? TEX.deck : TEX.trim);
    case 'bulkhead': return tiled(Math.abs(c[0]) < 0.85 && Math.abs(n[2]) < 0.3 ? TEX.trim : TEX.hullInner);
    case 'mainMast': case 'foreMast': case 'bowsprit': return tiled(TEX.spar);
    case 'crowsNest': return tiled(up ? TEX.deck : TEX.trim);
    case 'hatchAft': case 'hatchFore': return tiled(up || down ? TEX.grate : TEX.trim);
    default: return tiled(TEX.trim);
  }
}
const keyOf = (rec) => Object.keys(TEX).find((k) => TEX[k] === rec);

/** The positions of a baked part as points. */
const pointsOf = (part) => { const out = []; for (let i = 0; i < part.positions.length; i += 3) out.push([part.positions[i], part.positions[i + 1], part.positions[i + 2]]); return out; };

/**
 * A baked part as the port draws it: each polygon's triangles flat on its own normal, wearing its face's picture -
 * moved by `offset` (a hinge's: its part re-based on the node that turns it). GALLEON-2: or several parts of one role
 * as one mesh (`part` a list - her six deck beams), each face its own picture as alone.
 */
export function bakedPartGeometry(part, { offset = [0, 0, 0], role = Array.isArray(part) ? part[0].role : part.role, keep = null } = {}) {
  const bench = new MeshBench();
  for (const one of Array.isArray(part) ? part : [part]) benchPart(bench, one, { offset, role, keep });
  return bench.finish();
}
/** One baked part's faces onto `bench` (bakedPartGeometry's). */
function benchPart(bench, part, { offset, role, keep }) {
  const pts = pointsOf(part).map((p) => sub(p, offset));
  part.polygons.forEach((poly, k) => {
    const ring = poly.map((i) => pts[i]);
    const n = norm(newell(ring));
    if (keep && !keep(n)) return;
    const c = scl(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length);
    const skin = faceSkin(role, n, add(c, offset));
    for (let t = 0; t < part.triangleOf.length; t++) {
      if (part.triangleOf[t] !== k) continue;
      const [a, b, cc] = [part.triangles[t * 3], part.triangles[t * 3 + 1], part.triangles[t * 3 + 2]].map((i) => pts[i]);
      if ('band' in skin) bandTri(bench, skin, n, offset, a, b, cc);
      else bench.tri(skin.rec, a, b, cc, skin.uv(add(a, offset)), skin.uv(add(b, offset)), skin.uv(add(cc, offset)), n);
    }
  });
}

/**
 * GALLEON-2: a livery's triangle cut at its band's slice heights (her frame's - `offset` the part's) into the pieces each
 * 64-texel slice wears: each piece its slice's record, v up that slice (1 its top row). The outer slices take what lies
 * past the band's ends, v held at their edge (her faces lie inside their bands - a pin reads it).
 */
function bandTri(bench, { band, u }, n, offset, a, b, c) {
  const S = band.recs.length, h = (band.y1 - band.y0) / S;
  for (let k = 0; k < S; k++) {
    const top = k === 0 ? Infinity : band.y1 - k * h, bottom = k === S - 1 ? -Infinity : band.y1 - (k + 1) * h;
    const piece = clipY(clipY([a, b, c], offset[1], bottom, 1), offset[1], top, -1);
    if (piece.length < 3) continue;
    const y0 = band.y1 - (k + 1) * h;
    const uv = (p) => { const w = add(p, offset); return [u(w), Math.min(1, Math.max(0, (w[1] - y0) / h))]; };
    for (let i = 1; i + 1 < piece.length; i++) bench.tri(band.recs[k], piece[0], piece[i], piece[i + 1], uv(piece[0]), uv(piece[i]), uv(piece[i + 1]), n);
  }
}
/** The part of a convex polygon on one side of the level `y` (her frame: a point's y plus `dy`) - `keep` 1 above it,
 *  -1 below; its corners in order, the level's crossings among them. */
function clipY(poly, dy, y, keep) {
  if (!Number.isFinite(y)) return poly;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = keep * (p[1] + dy - y), sq = keep * (q[1] + dy - y);
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]); }
  }
  return out;
}

// ── the parts built here ───────────────────────────────────────────────────────────────────────────────────────────

/** A hatch cover in its hinge's frame: the box Mac made (his fore cover's - both covers are it), lying closed with
 *  its starboard edge on the hinge and the rest of it to port. */
export function hatchCoverGeometry(cover) {
  const bench = new MeshBench();
  const [hx, hy, hz] = cover.half;
  // the hinge is its top starboard edge: the cover spans x -2hx..0, y -2hy..0 under it
  box(bench, TEX.grate, [-hx, -hy, 0], [hx, hy, hz], { tile: GALLEON_TILE.grate, skip: [0, 1, 4, 5] });
  box(bench, TEX.trim, [-hx, -hy, 0], [hx, hy, hz], { tile: GALLEON_TILE.trim, skip: [2, 3] });
  // the battens' frame along it, a ring bolt to lift it by
  for (const s of [-1, 1]) box(bench, TEX.trim, [-hx, 0.02, s * (hz - 0.08)], [hx - 0.04, 0.02, 0.08], { tile: GALLEON_TILE.trim });
  prism(bench, TEX.iron, [-hx * 2 + 0.25, 0, 0], [-hx * 2 + 0.25, 0.06, 0], 0.09, 0.09, 6);
  return bench.finish();
}

/** A door leaf in its hinge's frame: the leaf to +x of the hinge, its foot on the hinge's height, `w` wide and `h`
 *  tall; planked, strapped and ringed (doorArt, the whole face). */
export function doorLeafGeometry(w, h, t = 0.08) {
  const bench = new MeshBench();
  box(bench, TEX.door, [w / 2, h / 2, 0], [w / 2, h / 2, t / 2], { uvFace: (fi, k) => {
    const q = [[0, 0], [0, 1], [1, 1], [1, 0]][k];
    return fi === 4 ? [1 - q[0], q[1]] : fi === 5 ? q : [q[0] * 0.08, q[1]];
  } });
  return bench.finish();
}

/** A gunport shutter in its hinge's frame (the starboard side's: the port side's node is the same turned about y):
 *  Mac's shutter - 0.87 along her, 1.55 down from its hinge, 0.1 thick - hanging closed down her side, its strake-red
 *  face out. */
export function lidGeometry() {
  const bench = new MeshBench();
  const hw = 0.434, L = 1.554, t = 0.098;
  box(bench, TEX.lid, [t / 2, -L / 2, 0], [t / 2, L / 2, hw], { uvFace: (fi, k) => {
    const q = [[0, 0], [0, 1], [1, 1], [1, 0]][k];
    return fi === 0 || fi === 1 ? q : [q[0] * 0.1, q[1] * 0.1];
  } });
  // the hinge's two iron eyes on the hull side of it
  for (const z of [-0.26, 0.26]) prism(bench, TEX.iron, [-0.02, 0.02, z - 0.07], [-0.02, 0.02, z + 0.07], 0.05, 0.05, 6);
  return bench.finish();
}

/** A gun: its carriage and trucks under the barrel, in the gun's frame (its muzzle down +x, its foot on the gun deck
 *  at y 0). `barrel` the barrel alone (it rides the same node: the whole gun runs out and recoils). */
export function gunGeometry() {
  const bench = new MeshBench();
  const axis = GUN.axisY - MEASURED.gunDeckY;
  // the cheeks and the bed between them
  for (const s of [-1, 1]) box(bench, TEX.trim, [-0.05, axis * 0.46, s * 0.27], [0.62, axis * 0.42, 0.07], { tile: GALLEON_TILE.trim });
  box(bench, TEX.trim, [-0.05, 0.26, 0], [0.6, 0.06, 0.22], { tile: GALLEON_TILE.trim });
  // the trucks
  for (const x of [-0.48, 0.38]) prism(bench, TEX.trim, [x, 0.17, -0.38], [x, 0.17, 0.38], 0.17, 0.17, 8, { smooth: true });
  // the barrel: breech to muzzle, its reinforcing rings, the swell at its mouth, the cascabel, the trunnions
  prism(bench, TEX.iron, [-0.62, axis, 0], [GUN.muzzleX, axis, 0], 0.2, 0.13, 10, { smooth: true, tileV: 1 });
  for (const [x, r] of [[-0.5, 0.215], [0.15, 0.19], [0.8, 0.165]]) prism(bench, TEX.iron, [x, axis, 0], [x + 0.08, axis, 0], r, r, 10, { smooth: true });
  prism(bench, TEX.iron, [GUN.muzzleX - 0.16, axis, 0], [GUN.muzzleX, axis, 0], 0.165, 0.16, 10, { smooth: true });
  prism(bench, TEX.iron, [-0.62, axis, 0], [-0.8, axis, 0], 0.09, 0.05, 8, { smooth: true });
  prism(bench, TEX.iron, [0.2, axis, -0.33], [0.2, axis, 0.33], 0.065, 0.065, 8, { smooth: true });
  // the breeching rope from the cascabel to either side of her
  for (const s of [-1, 1]) rope(bench, TEX.rope, [[-0.8, axis, 0], [-0.4, axis - 0.1, s * 0.5], [0.9, axis - 0.15, s * 0.62]], 0.03);
  return bench.finish();
}

/** A chaser: a light gun on a swivel over her bow rail, its muzzle down +z. In its post's frame (the post's foot on the
 *  deck at y 0). */
export function chaserGeometry(height) {
  const bench = new MeshBench();
  prism(bench, TEX.trim, [0, 0, 0], [0, height - 0.12, 0], 0.11, 0.09, 6);
  box(bench, TEX.iron, [0, height - 0.06, 0], [0.16, 0.06, 0.06], { tile: GALLEON_TILE.iron });
  prism(bench, TEX.iron, [0, height, -0.55], [0, height, 0.95], 0.11, 0.08, 8, { smooth: true });
  prism(bench, TEX.iron, [0, height, -0.55], [0, height + 0.04, -0.9], 0.03, 0.03, 4);   // its tiller
  return bench.finish();
}

/** The ship's wheel in its own frame (the hub at the origin, the axle along z): a rim on eight spokes whose turned
 *  handles stand out past it, an inner ring, the hub and its brass cap. */
export function wheelGeometry(R = HELM.wheelR) {
  const bench = new MeshBench();
  const N = 16;
  const ringOf = (r, w, d, rec) => {
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
      const p = (a, rr, z) => [Math.cos(a) * rr, Math.sin(a) * rr, z];
      const o0 = p(a0, r + w, -d), o1 = p(a1, r + w, -d), i0 = p(a0, r - w, -d), i1 = p(a1, r - w, -d);
      const O0 = p(a0, r + w, d), O1 = p(a1, r + w, d), I0 = p(a0, r - w, d), I1 = p(a1, r - w, d);
      const mid = (a0 + a1) / 2, out = [Math.cos(mid), Math.sin(mid), 0];
      const uv = [[k / N * 4, 0], [(k + 1) / N * 4, 0], [(k + 1) / N * 4, 0.1], [k / N * 4, 0.1]];
      bench.quad(rec, o0, o1, O1, O0, uv, out);
      bench.quad(rec, i0, i1, I1, I0, uv, scl(out, -1));
      bench.quad(rec, o0, o1, i1, i0, uv, [0, 0, -1]);
      bench.quad(rec, O0, O1, I1, I0, uv, [0, 0, 1]);
    }
  };
  ringOf(R, 0.045, 0.05, TEX.trim);
  ringOf(R * 0.5, 0.025, 0.035, TEX.trim);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, d = [Math.cos(a), Math.sin(a), 0];
    prism(bench, TEX.trim, scl(d, 0.1), scl(d, R + 0.05), 0.028, 0.024, 6, { smooth: true });
    prism(bench, TEX.trim, scl(d, R + 0.05), scl(d, R + 0.22), 0.032, 0.026, 6, { smooth: true });
    prism(bench, TEX.gilt, scl(d, R + 0.22), scl(d, R + 0.26), 0.036, 0.0, 6, { smooth: true, caps: [true, false] });
  }
  prism(bench, TEX.trim, [0, 0, -0.1], [0, 0, 0.1], 0.13, 0.13, 10, { smooth: true });
  prism(bench, TEX.gilt, [0, 0, -0.1], [0, 0, -0.16], 0.08, 0.04, 10, { smooth: true });
  return bench.finish();
}

/** The wheel's pedestal: a binnacle box forward of it, the axle's iron to the hub, a lamp hood on top. In her frame. */
export function helmPedestalGeometry() {
  const bench = new MeshBench();
  const [hx, hy, hz] = HELM.hub;
  const y0 = MEASURED.castleRoofY;
  box(bench, TEX.trim, [hx, y0 + 0.55, hz + 0.42], [0.26, 0.55, 0.22], { tile: GALLEON_TILE.trim });
  box(bench, TEX.gilt, [hx, y0 + 1.12, hz + 0.42], [0.28, 0.03, 0.24], { tile: GALLEON_TILE.gilt });
  prism(bench, TEX.iron, [hx, hy, hz + 0.2], [hx, hy, hz + 0.05], 0.05, 0.05, 6, { smooth: true });
  prism(bench, TEX.gilt, [hx, y0 + 1.15, hz + 0.42], [hx, y0 + 1.42, hz + 0.42], 0.16, 0.06, 8, { smooth: true });
  return bench.finish();
}

/** Stairs down a hatchway: from the main deck's edge of the hole down to the gun deck at `pitch`, `dir` the way
 *  they descend along z (+1 toward the bow, -1 aft). Treads, risers, and a stringer each side. */
export function companionGeometry(topZ, dir, halfX = 0.72, pitch = 48) {
  const bench = new MeshBench();
  const top = MEASURED.mainDeckY, bottom = MEASURED.gunDeckY;
  const rise = 0.3, steps = Math.round((top - bottom) / rise);
  const r = (top - bottom) / steps, run = r / Math.tan((pitch * Math.PI) / 180);
  for (let i = 1; i <= steps; i++) {
    const y = top - i * r, z0 = topZ + dir * (i - 1) * run, z1 = topZ + dir * i * run;
    box(bench, TEX.deck, [0, y - 0.04, (z0 + z1) / 2], [halfX, 0.04, Math.abs(z1 - z0) / 2 + 0.02], { tile: GALLEON_TILE.deck });
  }
  const zEnd = topZ + dir * steps * run;
  for (const s of [-1, 1]) {
    const a = [s * (halfX + 0.05), top - 0.1, topZ], b = [s * (halfX + 0.05), bottom + 0.1, zEnd];
    prism(bench, TEX.trim, a, b, 0.09, 0.09, 4, { tileV: 2, twist: Math.PI / 4 });
    rope(bench, TEX.rope, [add(a, [0, 0.95, 0]), add(b, [0, 0.95, 0])], 0.03);   // the manrope to hold
  }
  return { geometry: bench.finish(), bottomZ: zEnd, steps, rise: r, run };
}

/** A rope ladder down her side from the gangway to the water: two side ropes against the hull and the rungs between.
 *  The starboard one (`s` -1 mirrors it to port - the rungs' wood has no hand). */
export function ropeLadderGeometry(s = 1) {
  const bench = new MeshBench();
  const g = MEASURED.gangway, zc = (g.z0 + g.z1) / 2;
  const path = (dz) => [[s * 5.38, g.sillY + 0.15, zc + dz], [s * 5.93, 2.45, zc + dz], [s * 5.93, 0.05, zc + dz]];
  for (const dz of [-0.24, 0.24]) rope(bench, TEX.rope, path(dz), 0.03);
  for (let y = 0.35; y < g.sillY - 0.1; y += 0.34) {
    const x = y > 2.45 ? 5.93 - ((y - 2.45) / (g.sillY + 0.15 - 2.45)) * (5.93 - 5.38) : 5.93;
    box(bench, TEX.trim, [s * (x + 0.04), y, zc], [0.03, 0.025, 0.25], { tile: GALLEON_TILE.trim });
  }
  return bench.finish();
}

// ── the clips ──────────────────────────────────────────────────────────────────────────────────────────────────────

const constClip = (name, curves) => ({ name, start: 0, stop: 0, sampleRate: 60, loop: true, wrapMode: 0, denseRate: 60, denseBegin: 0, events: [], curves });
const eulerCurve = (path, e) => ({ path: pathHash(path), attribute: 'euler', components: e.map((v) => ({ constant: Math.fround(v) })) });
/** A hatch cover lifts on its starboard edge past upright, to lean clear of the hatchway. */
export const HATCH_OPEN_DEG = -105;
/** A shutter swings up on its top to stand out from her side, a little short of level - as Mac's stands. */
export const LID_OPEN_DEG = 84;
/** The wheel turns this many times hard over each way, and the rudder this far. */
export const WHEEL_TURNS = 1.25;
export const RUDDER_DEG = 35;

/** The clips and overrides the doors, hatches, shutters and the helm play, over the mod's own controllers. */
export function galleonClips() {
  const clips = {}, overrides = {};
  const pair = (ov, closed, opened) => {
    clips[`${ov} Closed`] = constClip(`${ov} Closed`, [eulerCurve('', closed)]);
    clips[`${ov} Opened`] = constClip(`${ov} Opened`, [eulerCurve('', opened)]);
    overrides[ov] = { base: 'Door Controller', clips: [['Door Closed', `${ov} Closed`], ['Door Opened', `${ov} Opened`]] };
  };
  pair('galleon2/Hatch', [0, 0, 0], [0, 0, HATCH_OPEN_DEG]);
  pair('galleon2/Gunport', [0, 0, 0], [0, 0, LID_OPEN_DEG]);
  // the helm: the Rudder Wheel Controller's ten Sailing clips (TurnAngle -1 .. 1, the 0.2 steps the mod's own galleon
  // used), the wheel turned about its axle and the rudder about its post
  const swaps = [];
  for (const [side, sign] of /** @type {const} */ ([['Left', -1], ['Right', 1]])) {
    for (let i = 0; i < 5; i++) {
      const t = sign * (0.2 + 0.2 * i);   // the threshold this clip answers
      const name = `galleon2/Rudder Sailing ${side} ${i}`;
      clips[name] = constClip(name, [eulerCurve('HelmWheel', [0, 0, -t * WHEEL_TURNS * 360]), eulerCurve('HelmRudder', [0, -t * RUDDER_DEG, 0])]);
      swaps.push([`Rudder Wheel Sailing ${side} ${i}`, name]);
    }
  }
  overrides['galleon2/Rudder'] = { base: 'Rudder Wheel Controller', clips: swaps };
  return { clips, overrides };
}

// ── the prefab ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** @typedef {{ p?: readonly number[], r?: readonly number[], s?: readonly number[], c?: number[], kids?: any[], active?: boolean }} NodeOpts */
/** @param {string} name @param {NodeOpts} [opts] */
const nodeOf = (name, { p = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1], c = [], kids = [], active = true } = {}) => ({ name, active, layer: 0, tag: 0, position: [...p], rotation: [...r], scale: [...s], components: c, children: kids });
const yaw = (deg) => { const a = (deg * Math.PI) / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
const clone = (t) => JSON.parse(JSON.stringify(t));
const findNode = (t, name) => { if (!t) return null; if (t.name === name) return t; for (const c of t.children) { const f = findNode(c, name); if (f) return f; } return null; };

/**
 * The new galleon as Come Sail Away's data: her prefab tree (component indices into `[...csaComponents, ...components]`),
 * the components she adds, her meshes by key (the CSA geometry shape), and the clips and overrides she adds.
 * @param {any} bake - galleon.json
 * @param {{ prefabs: Record<string, any>, components: any[] }} csa - Come Sail Away's prefabs.json (its galleon's
 *   small things are copied out of hull 2's own tree)
 */
export function galleonPrefab(bake, csa) {
  const base = csa.components.length;
  const components = [];
  /** @type {Record<string, any>} */
  const meshes = {};
  const skinnedLater = [];
  const comp = (c) => { components.push(c); return base + components.length - 1; };
  const mesh = (key, geometry) => { if (!geometry) throw new Error(`galleon: ${key} built nothing`); meshes[key] = geometry; return key; };
  const renderer = (geometry) => comp({ type: 'MeshRenderer', m_Enabled: true, materials: geometry.slots.map((s) => ({ ...s })) });
  /** A node drawing `geometry` (registered as `key`), with a MeshCollider over the same triangles when `collider`.
   *  @param {string} name @param {string} key @param {any} geometry @param {NodeOpts & { collider?: boolean }} [opts] */
  const meshNode = (name, key, geometry, { collider = false, ...opts } = {}) => {
    mesh(key, geometry);
    const c = [comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), renderer(geometry)];
    if (collider) { mesh(`${key}:collider`, colliderOf(geometry)); c.push(comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: `${key}:collider` } })); }
    return nodeOf(name, { ...opts, c: [...c, ...(opts.c ?? [])] });
  };
  const boxCollider = (center, size) => comp({ type: 'BoxCollider', m_Enabled: true, m_IsTrigger: false, m_Center: { x: center[0], y: center[1], z: center[2] }, m_Size: { x: size[0], y: size[1], z: size[2] } });
  const animator = (controller) => comp({ type: 'Animator', m_Enabled: true, m_Controller: { controller }, m_ApplyRootMotion: false });
  const cx = {
    archive: GALLEON_ARCHIVE, mesh, comp,
    skinned: (node, key, bones, rootBone, materials, rope = false) => skinnedLater.push({ node, key, bones, rootBone, materials, rope }),
  };

  const part = (role) => { const p = bake.parts.find((x) => x.role === role); if (!p) throw new Error(`galleon: the bake has no ${role}`); return p; };
  const baked = (role, name, opts = {}) => meshNode(name, `galleon:${role}`, bakedPartGeometry(part(role)), { collider: true, ...opts });
  const old = csa.prefabs[String(GALLEON_PREFAB_ID)];
  const fromOld = (name, at = {}) => {
    const n = clone(findNode(old, name));
    if (!n) throw new Error(`galleon: Come Sail Away's galleon has no ${name}`);
    if (at.p) n.position = [...at.p];
    if (at.r) n.rotation = [...at.r];
    if (at.name) n.name = at.name;
    return n;
  };
  const M = MEASURED;
  const kids = [];

  // ── her own: the board, the triggers before the doors (the walk files a door's trigger under BoardTriggers - kept -
  //    and BoardTriggers[0] is a gangway's) ──
  const g = M.gangway, gz = (g.z0 + g.z1) / 2;
  for (const s of [1, -1]) {
    // the board trigger outside her at the gangway, three metres a side (the mod's scale), its BoardPosition on her
    // deck inside the gap, facing in
    const t = [s * 6.6, 2.4, gz];
    const stand = [s * 4.3, M.mainDeckY + 0.05, gz];
    kids.push(nodeOf('BoardTrigger', { p: t, s: [3, 3, 3], kids: [nodeOf('BoardPosition', { p: scl(sub(stand, t), 1 / 3), r: yaw(s > 0 ? -90 : 90), s: [1 / 3, 1 / 3, 1 / 3] })] }));
  }
  kids.push(nodeOf('DriveTrigger', { p: HELM.hub }));
  kids.push(nodeOf('DrivePosition', { p: HELM.stand }));

  // ── Mac's model ──
  // the castle, its rail and its parapet draw on their own nodes and stand in the HULL's collider (below): the hull's
  // box is the shots' target (scenes/navalHost.js hullBoxOf - her MeshCollider's bounds), and a ball into her castle
  // strikes her as one into her side does
  for (const [role, name] of [['castle', 'Castle'], ['castleParapet', 'CastleParapet'], ['castleRail', 'CastleRail']]) kids.push(meshNode(name, `galleon:${role}`, bakedPartGeometry(part(role))));
  for (const [role, name] of [['gunDeck', 'GunDeck'], ['mainDeck', 'MainDeck'],
    ['bulkhead', 'Bulkhead'], ['stairsPort', 'StairsPort'], ['stairsStarboard', 'StairsStarboard'], ['balustradePort', 'BalustradePort'], ['balustradeStarboard', 'BalustradeStarboard'],
    ['mainMast', 'MainMast'], ['foreMast', 'ForeMast'], ['mainPartner', 'MainPartner'], ['mainStep', 'MainStep'], ['forePartner', 'ForePartner'], ['foreStep', 'ForeStep'],
    ['crowsNest', 'CrowsNest'], ['bowsprit', 'Bowsprit']]) kids.push(baked(role, name));
  // GALLEON-2: her deck beams, one node over the six (a collider too - nothing aboard reaches them but a ladder's
  // climber's hand)
  const beamParts = bake.parts.filter((x) => x.role === 'deckBeam');
  if (!beamParts.length) throw new Error('galleon: the bake has no deckBeam');
  kids.push(meshNode('DeckBeams', 'galleon:deckBeams', bakedPartGeometry(beamParts), { collider: true }));

  // the hatch covers: Mac's fore cover is both (his aft one he left propped open), each on a hinge at its starboard edge
  const fore = part('hatchFore');
  const fp = pointsOf(fore);
  const fmin = [0, 1, 2].map((k) => Math.min(...fp.map((p) => p[k]))), fmax = [0, 1, 2].map((k) => Math.max(...fp.map((p) => p[k])));
  const cover = { half: [(fmax[0] - fmin[0]) / 2, (fmax[1] - fmin[1]) / 2, (fmax[2] - fmin[2]) / 2] };
  const coverY = (fmin[1] + fmax[1]) / 2;
  const hatch = (name, hole) => {
    const zc = (hole.z0 + hole.z1) / 2 + ((fmin[2] + fmax[2]) / 2 - (M.hatchFore.z0 + M.hatchFore.z1) / 2);
    const hinge = [cover.half[0], coverY + cover.half[1], zc];
    return meshNode(name, 'galleon:hatchCover', hatchCoverGeometry(cover), { collider: true, p: hinge, c: [animator('galleon2/Hatch')], kids: [nodeOf('DoorTrigger')] });
  };
  // the stairs down each hatchway, built before the covers so a ray down the open hatch meets them
  const aftStairs = companionGeometry(M.hatchAft.z1, -1);
  const foreStairs = companionGeometry(M.hatchFore.z1, -1);
  kids.push(meshNode('CompanionAft', 'galleon:companionAft', aftStairs.geometry, { collider: true }));
  kids.push(meshNode('CompanionFore', 'galleon:companionFore', foreStairs.geometry, { collider: true }));
  kids.push(hatch('HatchAft', M.hatchAft));
  kids.push(hatch('HatchFore', M.hatchFore));

  // the doors in his two doorways, hinged on their port jambs, swinging aft
  const door = (name, d) => meshNode(name, `galleon:door:${name}`, doorLeafGeometry(d.halfX * 2 - 0.04, d.y1 - d.y0 - 0.02), { collider: true, p: [-d.halfX + 0.02, d.y0 + 0.01, d.z], c: [animator('Door Controller')], kids: [nodeOf('DoorTrigger')] });
  kids.push(door('CastleDoor', M.castleDoor));
  kids.push(door('BulkheadDoor', M.bulkheadDoor));

  // the shutters and the guns behind them: five ports a side, the port side's nodes the starboard's turned about y
  mesh('galleon:gunportLid', lidGeometry());
  mesh('galleon:gun', gunGeometry());
  const lidComps = () => [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:gunportLid' } }), renderer(meshes['galleon:gunportLid'])];
  for (const [sideName, s] of /** @type {const} */ ([['Starboard', 1], ['Port', -1]])) {
    M.portZ.forEach((z, i) => {
      kids.push(nodeOf(`Gunport${sideName}${i}`, { p: [s * (M.hullOuterX + 0.02), M.portTopY + 0.07, z], r: yaw(s > 0 ? 0 : 180), c: [...lidComps(), animator('galleon2/Gunport')] }));
      kids.push(nodeOf(`Gun${sideName}${i}`, { p: [s * GUN.runInX, M.gunDeckY, z], r: yaw(s > 0 ? 0 : 180), c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:gun' } }), renderer(meshes['galleon:gun']), boxCollider([-0.05, 0.55, 0], [1.25, 1.1, 0.8])] }));
    });
  }
  // the bow chasers on their swivels over her rail
  mesh('galleon:chaser', chaserGeometry(GUN.chaserY - M.mainDeckY));
  for (const [i, m] of GALLEON_BATTERIES.bow.entries()) {
    kids.push(nodeOf(`BowChaser${i}`, { p: [m[0], M.mainDeckY, m[2] - 0.95], c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:chaser' } }), renderer(meshes['galleon:chaser'])] }));
  }

  // the helm: its pedestal (still), and the RudderObject the mod's Rudder Wheel Controller turns - the wheel on its
  // axle and the rudder on its post, both its children
  kids.push(meshNode('HelmPedestal', 'galleon:helmPedestal', helmPedestalGeometry(), { c: [boxCollider([0, M.castleRoofY + 0.6, HELM.hub[2] + 0.42], [0.6, 1.2, 0.5])] }));
  mesh('galleon:wheel', wheelGeometry());
  const rudderPart = part('rudder');
  const rudderPivot = [0, 0, M.rudderPivotZ];
  mesh('galleon:rudder', bakedPartGeometry(rudderPart, { offset: rudderPivot }));
  kids.push(nodeOf('RudderObject', {
    c: [animator('galleon2/Rudder')],
    kids: [
      nodeOf('HelmWheel', { p: HELM.hub, c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:wheel' } }), renderer(meshes['galleon:wheel'])] }),
      nodeOf('HelmRudder', { p: rudderPivot, c: [comp({ type: 'MeshFilter', m_Mesh: { mesh: 'galleon:rudder' } }), renderer(meshes['galleon:rudder'])] }),
    ],
  }));

  // the rig
  const rig = buildRig(cx);
  kids.push(...rig.kids);

  // ── Come Sail Away's own small things, stood in her ──
  const D = M.mainDeckY, G = M.gunDeckY, R = M.castleRoofY;
  kids.push(nodeOf('ActiveObject', { kids: [fromOld('GalleonAnchor', { p: [4.05, 5.85, 15.9] })] }));
  kids.push(nodeOf('IdleObject', { kids: [
    fromOld('GalleonAnchorDeployed', { p: [4.05, 5.85, 15.9] }),
    meshNode('RopeLadderStarboard', 'galleon:ladderStarboard', ropeLadderGeometry(1)),
    meshNode('RopeLadderPort', 'galleon:ladderPort', ropeLadderGeometry(-1)),
  ] }));
  // the crew, by the posts the mod's galleon gave them (and its triggers under the four that carry one)
  const crew = (name, flat, at, trigger = null) => nodeOf(name, { p: at, kids: [nodeOf(`BillboardHelper-${flat}:1`), ...(trigger ? [nodeOf(trigger, { p: [0, 1, 0] })] : [])] });
  kids.push(crew('OfficerStanding1', '182_025', [2.1, R, -16.6], 'StatusTrigger'));
  kids.push(crew('Coxswain', '346_006', [-2.1, R, -16.7], 'PositionTrigger'));
  kids.push(crew('Boatswain', '182_035', [-2.6, D, 2.3], 'VariantTrigger'));
  kids.push(crew('Quartermaster', '182_020', [-2.3, D, 7.3], 'CargoTrigger'));
  kids.push(crew('Master-At-Arms', '183_004', [2.4, G, -1.9]));
  kids.push(crew('Cook', '182_008', [-1.6, G, 10.6]));
  kids.push(fromOld('GalleonCargo', { p: [-3.3, D, 6.6], r: yaw(-20) }));
  kids.push(fromOld('Stove', { p: [-3.1, G, 11.4], r: yaw(45) }));
  // the bed in the great cabin under the castle's roof
  kids.push(nodeOf('BedObject', { p: [3.55, D, -16.2], r: yaw(-90) }));
  // the lanterns: two on the stern rail and the great one at her taffrail, two flanking the castle's door, three
  // hanging in the gun deck - from her beams (GALLEON-2: the second, third and fifth, aft to fore) - and one in the cabin
  const lanternFlat = () => nodeOf('BillboardHelper-210_027:2');
  const pole = clone(findNode(old, 'LanternHookStandPoleShort'));
  for (const s of [-1, 1]) kids.push({ ...clone(pole), position: [s * 2.35, R, -18.7], rotation: yaw(s * -150) });
  const stand = fromOld('LanternHookStandPlank', { p: [0, R, -19.05], r: yaw(180), name: 'LanternHookStandTaffrail' });
  kids.push(stand);
  const hook = clone(findNode(old, 'LanternHook'));
  for (const s of [-1, 1]) kids.push({ ...clone(hook), name: s < 0 ? 'LanternHookDoorPort' : 'LanternHookDoorStarboard', position: [s * 1.45, M.castleDoor.y1 + 0.2, M.castleFrontZ + 0.02], rotation: yaw(180) });
  for (const [i, k] of [1, 2, 4].entries()) kids.push(nodeOf(i ? `LanternHanging (${i})` : 'LanternHanging', { p: [0, M.beams.underY - 0.01, M.beams.z[k]], kids: [lanternFlat()] }));
  kids.push(nodeOf('LanternHanging (3)', { p: [0, M.castleCeilingY - 0.05, -15.4], kids: [lanternFlat()] }));
  // her colours over the crow's nest, on the flagstaff the rig stands there
  kids.push(fromOld('FlagObject', { p: [0, RIG.nestTopY + 1.45, RIG.mainZ + 0.05] }));

  // her hull: the node the boat's frame is, every other part under it - its collider her hull's planking and her
  // castle's, one mesh (the first MeshCollider of the tree: Boat.MeshCollider, whose box SpawnBoat stands her five
  // nodes off and the sea fight aims at)
  const hullGeometry = bakedPartGeometry(part('hull'));
  // (her castle's there but for the ramps its stair wells slope down under her two flights: the treads stand on them,
  // and at a flight's head the ramp rose 4 cm through the top tread - a roof over it to the walk, the flight cut short
  // of her castle's top: systems/naval/navalDeck.js)
  const castleSolid = bakedPartGeometry(part('castle'), { keep: (n) => !(n[1] > WELL_RAMP_NY[0] && n[1] < WELL_RAMP_NY[1]) });
  mesh('galleon:hull:collider', colliderOf(mergeGeometries([hullGeometry, castleSolid, meshes['galleon:castleRail'], meshes['galleon:castleParapet']])));
  const hull = meshNode(GALLEON_HULL_NODE, 'galleon:hull', hullGeometry, { kids, c: [comp({ type: 'MeshCollider', m_Enabled: true, m_IsTrigger: false, m_Convex: false, m_Mesh: { mesh: 'galleon:hull:collider' } })] });
  const root = nodeOf(String(GALLEON_PREFAB_ID), { kids: [
    fromOld('WakeObject', { p: [0, 0.1, 2.2] }),
    hull,
    fromOld('Modifiers'),
  ] });

  // ── the skinned renderers' bones, now the tree's paths are known ──
  const paths = new Map(), rest = new Map();
  const walk = (n, path, parentM) => {
    const m = multiply(parentM, mat4FromQuatPosScale(n.rotation, n.position, n.scale), new Float32Array(16));
    paths.set(n, path); rest.set(n, m);
    for (const c of n.children) walk(c, `${path}/${c.name}`, m);
  };
  walk(root, root.name, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  for (const k of skinnedLater) {
    const at = rest.get(k.node);
    if (!at) throw new Error('galleon: a skinned renderer outside the tree');
    // Unity's bind pose: the bone's rest world inverse, times the renderer's rest world
    const geometry = meshes[k.key];
    geometry.bindPoses = k.bones.map((b) => multiply(invertRigid(rest.get(b)), at, new Float32Array(16)));
    k.node.components.push(comp({
      type: 'SkinnedMeshRenderer', m_Enabled: true, m_Mesh: { mesh: k.key }, m_Materials: k.materials,
      m_Bones: k.bones.map((b) => ({ node: paths.get(b) })), m_RootBone: k.rootBone ? { node: paths.get(k.rootBone) } : null,
      m_AABB: { m_Center: { x: geometry.aabb.center[0], y: geometry.aabb.center[1], z: geometry.aabb.center[2] }, m_Extent: { x: geometry.aabb.extent[0], y: geometry.aabb.extent[1], z: geometry.aabb.extent[2] } },
    }));
  }

  const own = galleonClips();
  return {
    prefab: root, components, meshes,
    animation: { clips: { ...own.clips, ...rig.clips }, overrides: { ...own.overrides, ...rig.overrides } },
  };
}

/** Several geometries as one (their triangles, re-indexed; their sub-meshes run together - a collider's read). */
export function mergeGeometries(list) {
  const geos = list.filter(Boolean);
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.vertexCount; ni += g.indices.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
  let v = 0, i = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const g of geos) {
    positions.set(g.positions, v * 3); normals.set(g.normals, v * 3); uvs.set(g.uvs, v * 2);
    for (let k = 0; k < g.indices.length; k++) indices[i + k] = g.indices[k] + v;
    for (let k = 0; k < g.positions.length; k += 3) for (let d = 0; d < 3; d++) { const x = g.positions[k + d]; if (x < min[d]) min[d] = x; if (x > max[d]) max[d] = x; }
    v += g.vertexCount; i += g.indices.length;
  }
  return { vertexCount: nv, positions, normals, uvs, indices, subMeshes: [{ startIndex: 0, primitiveCount: ni / 3 }], slots: [], blendIndices: null, bindPoses: null,
    aabb: { center: [0, 1, 2].map((d) => (min[d] + max[d]) / 2), extent: [0, 1, 2].map((d) => (max[d] - min[d]) / 2) } };
}

/** The inverse of a rotation-translation(-scale-free) column-major 4x4: R^T, -R^T t. */
function invertRigid(m) {
  const o = new Float32Array(16);
  o[0] = m[0]; o[1] = m[4]; o[2] = m[8];
  o[4] = m[1]; o[5] = m[5]; o[6] = m[9];
  o[8] = m[2]; o[9] = m[6]; o[10] = m[10];
  o[12] = -(o[0] * m[12] + o[4] * m[13] + o[8] * m[14]);
  o[13] = -(o[1] * m[12] + o[5] * m[13] + o[9] * m[14]);
  o[14] = -(o[2] * m[12] + o[6] * m[13] + o[10] * m[14]);
  o[15] = 1;
  return o;
}

export { len };
