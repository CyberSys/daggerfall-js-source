// THE NEW GALLEON'S MODEL, BAKED OUT OF MAC'S BLENDER SCENE.
//
//     node tools/bakeGalleon.mjs [--fbx=src/assets/galleon/source/New_Ship.fbx]
//
// GALLEON (2026-10-01, Mac: "So this model is to replace the current ingame
// gallon model. The doors/hatches should open and close and we will need to
// give this a proper texture, along with a wheel at the helm, the sails and
// ropes, and ensuring cannon fire shoots from the cannon holes properly").
//
// Mac sent three exports - New_Ship.fbx, New_Ship_Access_Hatch.fbx and
// New_Ship_Window_Shutters.fbx - and they are ONE SCENE three times: every
// node of the three trees reads the same but the header's creation stamp
// (measured, node for node). So one is committed, and the hatch and the
// shutter are read out of it by their own objects (`ROLES` below).
//
// GALLEON-2 (2026-10-02, Mac: "Replace it with this updated model"):
// New_Ship_Even_EVEN_newer.fbx, committed over New_Ship.fbx. Read against
// the first, part for part: the ship stands 36.25 m along the scene's Y
// (FRAME.centreline - she was on Y 0); her hull is new below the wale - a
// deeper V bottom on a keel 0.9 m lower, a finer entry and a forefoot
// swept up to the stem (95 faces where it was 87); six deck beams carry
// her main deck over the gun deck (`deckBeam`); and every other part is
// the first's to the micrometre. The scene also keeps a TWIN of most parts
// standing in the same place (Shift+D, never moved - checked vertex for
// vertex, `SKIP` twin) and three more working stations far along Y.
//
// tools/fbxRead.mjs is the reader and tools/fbxMesh.mjs's helpers do the
// polygon work; this is the bake for a SCENE OF PARTS rather than one mesh.
// It does three things and nothing else, and leaves everything that is art
// (which face wears which texture, how a texture lies on it, what a part is
// hung from) to src/world/galleonModel.js, where a test can read it:
//
// 1. EACH OBJECT INTO THE BOAT'S FRAME. A Blender export carries its axis
//    conversion on every object (Lcl Rotation -90 about X, Lcl Scaling 100,
//    UnitScaleFactor 1 - centimetres), so the object's own T*R*S is applied
//    and the file's GlobalSettings (`sceneFrame`) take the result back to
//    Mac's Z-up scene in metres, where the ship's bow is +X and her port side
//    +Y. Come Sail Away's hulls - and so the port's boats - stand in Unity's
//    frame: +x starboard, +y up, +z the bow, the root on the waterline
//    (systems/naval/navalShips.js's header). So a scene point (X, Y, Z) is
//    the boat's ( CENTRELINE - Y, Z - WATERLINE, X - MIDSHIP ) times SCALE
//    (CENTRELINE her keel line's Y, the middle of her hull's beam): a mirror,
//    which is why every polygon's corners are REVERSED on the way through -
//    Blender's front is counter-clockwise in a right-handed frame and the
//    port's is clockwise in Unity's (renderer.js frontFace(CW)), so the
//    reversal keeps each face's front its front.
//
//    THE FRAME IS CHOSEN, AND SAID: SCALE 0.7 makes her 43.8 m from stem to
//    stern, the length of the galleon she replaces (Come Sail Away's hull 2,
//    44.1 m - every number the sea fight measured against that hull keeps
//    its sense), and puts her decks a player's height apart where Mac's
//    scene stood them 7 m apart. WATERLINE 3 (scene metres) sits her V
//    bottom 3.3 m in the water - the old galleon drew 3.35 - with her gun
//    deck 1.1 m and her port sills 1.6 m over the sea. MIDSHIP 2.7 is the
//    middle of her hull's length, so she pivots where she is longest.
//
// 2. EACH POLYGON TRIANGULATED: fanned when convex, ear-clipped when not
//    (tools/fbxMesh.mjs earClip - the hull's sides are 24- to 31-gons with
//    a notch for every gunport). The polygons are kept as well, since a
//    face's texture is chosen per polygon.
//
// 3. THE RUDDER OUT OF THE HULL. Mac modelled it into the hull's own mesh
//    (five faces aft of the sternpost); it turns, so it is its own part.
//
// The output is a JSON a test re-bakes byte for byte
// (test/galleon_model.test.js): the source is committed beside it, so the
// file is a DERIVATION, never a blob.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { readFbx, nodeAt, childNamed, childrenNamed, property70, objectName } from './fbxRead.mjs';
import { eulerXYZ, polygonsOf, earClip, isConvexPolygon, sceneFrame } from './fbxMesh.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE_FBX = 'src/assets/galleon/source/New_Ship.fbx';
export const OUT = 'src/assets/galleon/galleon.json';

/** The boat's frame, from Mac's scene (metres, Z up, bow +X). GALLEON-2: `centreline` the scene Y of her keel line -
 *  her hull's beam halved, 27.8779 to 44.6156 - where the first export stood her on Y 0. */
export const FRAME = Object.freeze({ scale: 0.7, waterline: 3, midship: 2.7, centreline: 36.2467 });

/**
 * Each of the scene's objects, by the role it plays aboard. Read off the
 * scene itself (tools/bakeGalleon.mjs --list prints every object's box):
 * the names are Blender's defaults, so each role ALSO states where its
 * object must stand (`at`: a point inside its scene box) - a re-export
 * that renamed or moved one fails here by name, never ships a stair as a
 * hatch.
 */
const Y = FRAME.centreline;
export const ROLES = Object.freeze({
  Cube: Object.freeze({ role: 'hull', at: [2, Y + 5, 8] }),
  'Cube.001': Object.freeze({ role: 'gunDeck', at: [0, Y, 4.55] }),
  'Cube.002': Object.freeze({ role: 'mainDeck', at: [0, Y, 11.7] }),
  'Cube.003': Object.freeze({ role: 'hatchAft', at: [-3.9, Y, 13] }),
  'Cube.004': Object.freeze({ role: 'hatchFore', at: [9.3, Y, 11.9] }),
  'Cube.005': Object.freeze({ role: 'castle', at: [-18, Y, 15] }),
  'Cube.006': Object.freeze({ role: 'castleParapet', at: [-15, Y, 19] }),
  'Cube.007': Object.freeze({ role: 'bulkhead', at: [-11.8, Y, 8] }),
  'Cube.008': Object.freeze({ role: 'stairsStarboard', at: [-13, Y - 5.8, 15] }),
  'Cube.009': Object.freeze({ role: 'balustradePort', at: [-10, Y + 7.45, 13] }),
  'Cube.010': Object.freeze({ role: 'stairsPort', at: [-13, Y + 5.8, 15] }),
  'Cube.011': Object.freeze({ role: 'gunportLid', at: [-3.6, Y + 9.3, 7.2] }),
  // GALLEON-2: the deck beams, aft to fore - one role, six objects (galleonModel.js draws them as one)
  'Cube.019': Object.freeze({ role: 'deckBeam', at: [-15.67, Y, 11] }),
  'Cube.013': Object.freeze({ role: 'deckBeam', at: [-7.18, Y, 11] }),
  'Cube.012': Object.freeze({ role: 'deckBeam', at: [0, Y, 11] }),
  'Cube.018': Object.freeze({ role: 'deckBeam', at: [5.86, Y, 11] }),
  'Cube.017': Object.freeze({ role: 'deckBeam', at: [12.86, Y, 11] }),
  'Cube.016': Object.freeze({ role: 'deckBeam', at: [17.66, Y, 11] }),
  'Cube.014': Object.freeze({ role: 'balustradeStarboard', at: [-10, Y - 7.45, 13] }),
  'Cube.015': Object.freeze({ role: 'castleRail', at: [-20, Y, 19.5] }),
  Cylinder: Object.freeze({ role: 'bowsprit', at: [37, Y, 14.5] }),
  'Cylinder.001': Object.freeze({ role: 'mainMast', at: [2.5, Y, 20] }),
  'Cylinder.002': Object.freeze({ role: 'foreMast', at: [15.3, Y, 20] }),
  'Cylinder.003': Object.freeze({ role: 'mainPartner', at: [2.6, Y, 12.2] }),
  'Cylinder.004': Object.freeze({ role: 'mainStep', at: [2.6, Y, 5.3] }),
  'Cylinder.005': Object.freeze({ role: 'foreStep', at: [15.4, Y, 5.3] }),
  'Cylinder.006': Object.freeze({ role: 'forePartner', at: [15.4, Y, 12.2] }),
  'Cylinder.007': Object.freeze({ role: 'crowsNest', at: [2.7, Y, 30] }),
});
/** What the scene keeps and she never wears, each checked to be what it is said to be - so a real part is never
 *  dropped by its name:
 *  - `minY`: another STATION, wholly beyond that scene Y - the whole ship again joined into one object (three of them,
 *    working copies Mac keeps beside the parts) and the spare hatch covers and shutter by the third;
 *  - `twin`: GALLEON-2, a part's copy standing IN its place (a Shift+D never moved), the same corners and faces as
 *    the part it names to the micrometre - its materials' names apart. */
export const SKIP = Object.freeze({
  'Cube.020': Object.freeze({ minY: 60 }), 'Cube.021': Object.freeze({ minY: 60 }), 'Cube.022': Object.freeze({ minY: 60 }),
  'Cube.023': Object.freeze({ minY: 60 }), 'Cube.029': Object.freeze({ minY: 60 }), 'Cube.038': Object.freeze({ minY: 60 }),
  'Cube.044': Object.freeze({ twin: 'Cube' }), 'Cube.043': Object.freeze({ twin: 'Cube.001' }), 'Cube.042': Object.freeze({ twin: 'Cube.002' }),
  'Cube.041': Object.freeze({ twin: 'Cube.005' }), 'Cube.040': Object.freeze({ twin: 'Cube.006' }), 'Cube.039': Object.freeze({ twin: 'Cube.007' }),
  'Cube.035': Object.freeze({ twin: 'Cube.008' }), 'Cube.034': Object.freeze({ twin: 'Cube.009' }), 'Cube.033': Object.freeze({ twin: 'Cube.010' }),
  'Cube.032': Object.freeze({ twin: 'Cube.012' }), 'Cube.031': Object.freeze({ twin: 'Cube.013' }), 'Cube.030': Object.freeze({ twin: 'Cube.014' }),
  'Cube.028': Object.freeze({ twin: 'Cube.015' }), 'Cube.027': Object.freeze({ twin: 'Cube.016' }), 'Cube.026': Object.freeze({ twin: 'Cube.017' }),
  'Cube.025': Object.freeze({ twin: 'Cube.018' }), 'Cube.024': Object.freeze({ twin: 'Cube.019' }),
  'Cylinder.015': Object.freeze({ twin: 'Cylinder' }), 'Cylinder.014': Object.freeze({ twin: 'Cylinder.001' }),
  'Cylinder.013': Object.freeze({ twin: 'Cylinder.002' }), 'Cylinder.012': Object.freeze({ twin: 'Cylinder.003' }),
  'Cylinder.011': Object.freeze({ twin: 'Cylinder.004' }), 'Cylinder.010': Object.freeze({ twin: 'Cylinder.005' }),
  'Cylinder.009': Object.freeze({ twin: 'Cylinder.006' }), 'Cylinder.008': Object.freeze({ twin: 'Cylinder.007' }),
});
/** The rudder's faces in the hull's mesh: aft of the sternpost, within this half-thickness of the centreline. */
export const RUDDER = Object.freeze({ aftOf: -23.3, halfThickness: 0.2 });

const round4 = (v) => Math.round(v * 1e4) / 1e4 + 0;   // + 0: never a -0 in the file

/** A scene point (metres, Z up, bow +X) in the boat's frame. */
export function toBoat([x, y, z], frame = FRAME) {
  return [(frame.centreline - y) * frame.scale, (z - frame.waterline) * frame.scale, (x - frame.midship) * frame.scale];
}

/** Every Mesh model with its Geometry, materials and scene placement, from a parsed FBX. */
export function sceneObjects(tree) {
  const objects = nodeAt(tree.nodes, 'Objects');
  if (!objects) throw new Error('no Objects section in this FBX');
  const byId = new Map(objects.children.map((o) => [String(o.props[0]), o]));
  const links = childrenNamed(nodeAt(tree.nodes, 'Connections'), 'C').map((c) => ({ kind: c.props[0], src: String(c.props[1]), dst: String(c.props[2]) }));
  const frame = sceneFrame(tree);
  const out = [];
  for (const model of childrenNamed(objects, 'Model')) {
    if (model.props[2] !== 'Mesh') continue;
    const id = String(model.props[0]);
    const name = objectName(model.props[1]);
    const parent = links.find((l) => l.kind === 'OO' && l.src === id);
    if (!parent || parent.dst !== '0') throw new Error(`${name} is parented under object ${parent?.dst} - the bake reads root objects only`);
    for (const [prop, identity] of [['PreRotation', [0, 0, 0]], ['PostRotation', [0, 0, 0]], ['RotationPivot', [0, 0, 0]], ['ScalingPivot', [0, 0, 0]], ['GeometricTranslation', [0, 0, 0]], ['GeometricRotation', [0, 0, 0]], ['GeometricScaling', [1, 1, 1]]]) {
      const v = property70(model, prop);
      if (v && v.some((x, i) => Math.abs(Number(x) - identity[i]) > 1e-9)) throw new Error(`${name} carries ${prop} ${JSON.stringify(v)} - the bake reads T*R*S only`);
    }
    if (Number(property70(model, 'RotationOrder')?.[0] ?? 0) !== 0) throw new Error(`${name}: rotation order is not XYZ Euler`);
    const geoLink = links.find((l) => l.kind === 'OO' && l.dst === id && byId.get(l.src)?.name === 'Geometry');
    const geo = geoLink ? byId.get(geoLink.src) : null;
    if (!geo) throw new Error(`${name} has no Geometry`);
    const materials = links.filter((l) => l.kind === 'OO' && l.dst === id && byId.get(l.src)?.name === 'Material').map((l) => objectName(byId.get(l.src).props[1]));
    const S = (property70(model, 'Lcl Scaling') ?? [1, 1, 1]).map(Number);
    const R = eulerXYZ((property70(model, 'Lcl Rotation') ?? [0, 0, 0]).map(Number));
    const T = (property70(model, 'Lcl Translation') ?? [0, 0, 0]).map(Number);
    const m = frame.m;
    // the object's T*R*S into FBX world space, then the file's frame into the scene (metres, Z up)
    const place = (p) => {
      const s = [p[0] * S[0], p[1] * S[1], p[2] * S[2]];
      const w = [R[0] * s[0] + R[1] * s[1] + R[2] * s[2] + T[0], R[3] * s[0] + R[4] * s[1] + R[5] * s[2] + T[1], R[6] * s[0] + R[7] * s[1] + R[8] * s[2] + T[2]];
      return [m[0] * w[0] + m[1] * w[1] + m[2] * w[2], m[3] * w[0] + m[4] * w[1] + m[5] * w[2], m[6] * w[0] + m[7] * w[1] + m[8] * w[2]];
    };
    const raw = childNamed(geo, 'Vertices')?.props[0];
    const pvi = childNamed(geo, 'PolygonVertexIndex')?.props[0];
    if (!raw || !pvi) throw new Error(`${name}'s Geometry carries no Vertices/PolygonVertexIndex`);
    const scene = [];
    for (let i = 0; i < raw.length; i += 3) scene.push(place([raw[i], raw[i + 1], raw[i + 2]]));
    const matLayer = childNamed(geo, 'LayerElementMaterial');
    const matIndex = matLayer ? childNamed(matLayer, 'Materials')?.props[0] : null;
    const matMap = matLayer ? childNamed(matLayer, 'MappingInformationType')?.props[0] : null;
    const polygons = polygonsOf(pvi);
    const polyMaterial = polygons.map((_, k) => (matIndex ? (matMap === 'AllSame' ? matIndex[0] : matIndex[k]) : -1));
    out.push({ name, scene, polygons, polyMaterial, materials });
  }
  return out;
}

/**
 * BLENDER'S OWN FILL, for the faces an ear clip cannot take. The hull's sides were cut with their gunports by a
 * boolean, and what it leaves is n-gons that TOUCH THEMSELVES: a 24-gon runs round four ports through the edges between
 * them, its corners visiting the same point twice. tools/fbxMesh.mjs earClip (rightly, for a garment) refuses one; but
 * Blender draws it - BLI_polyfill_calc, an ear clip in the face's own plane in which a corner that only TOUCHES an
 * ear (on its edge, or on one of its own corners) does not block it, and which, finding no ear at all, clips one
 * anyway rather than leave the face open - and what Blender drew is what Mac modelled. So the same fill here: the
 * polygon projected as earClip projects it (the winding kept), an ear any corner whose triangle is convex and holds no
 * other corner STRICTLY inside, ears taken lowest index first, and when none is left the most convex corner clipped.
 * Returns triangles as index triples into `pts`.
 */
export function polyfill(pts) {
  const n = pts.length;
  if (n === 3) return [[0, 1, 2]];
  const nrm = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    nrm[0] += (a[1] - b[1]) * (a[2] + b[2]); nrm[1] += (a[2] - b[2]) * (a[0] + b[0]); nrm[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const k = [0, 1, 2].reduce((best, i) => (Math.abs(nrm[i]) > Math.abs(nrm[best]) ? i : best), 0);
  const [ia, ib] = k === 0 ? [1, 2] : k === 1 ? [2, 0] : [0, 1];
  const flip = nrm[k] < 0 ? -1 : 1;
  const p2 = pts.map((p) => [p[ia], p[ib] * flip]);
  let span = 0;
  for (const p of p2) span = Math.max(span, Math.abs(p[0]), Math.abs(p[1]));
  const eps = 1e-9 * Math.max(1, span * span);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const strictlyInside = (p, a, b, c) => !same(p, a) && !same(p, b) && !same(p, c) && cross(a, b, p) > eps && cross(b, c, p) > eps && cross(c, a, p) > eps;
  const ring = pts.map((_, i) => i);
  const tris = [];
  while (ring.length > 3) {
    let cut = -1, best = -1, bestTurn = -Infinity;
    for (let r = 0; r < ring.length && cut < 0; r++) {
      const i0 = ring[(r + ring.length - 1) % ring.length], i1 = ring[r], i2 = ring[(r + 1) % ring.length];
      const turn = cross(p2[i0], p2[i1], p2[i2]);
      if (turn > bestTurn) { bestTurn = turn; best = r; }
      if (turn <= eps) continue;   // reflex or flat - not an ear
      let clear = true;
      for (const j of ring) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (strictlyInside(p2[j], p2[i0], p2[i1], p2[i2])) { clear = false; break; }
      }
      if (clear) cut = r;
    }
    if (cut < 0) cut = best;   // Blender's desperate mode: no ear - the most convex corner goes anyway
    tris.push([ring[(cut + ring.length - 1) % ring.length], ring[cut], ring[(cut + 1) % ring.length]]);
    ring.splice(cut, 1);
  }
  tris.push([ring[0], ring[1], ring[2]]);
  return tris;
}

/** A face's corners projected into its own plane as polyfill projects them (the dominant axis of its Newell normal,
 *  flipped so the face winds counter-clockwise there). */
function facePlane(pts) {
  const nrm = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nrm[0] += (a[1] - b[1]) * (a[2] + b[2]); nrm[1] += (a[2] - b[2]) * (a[0] + b[0]); nrm[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const k = [0, 1, 2].reduce((best, i) => (Math.abs(nrm[i]) > Math.abs(nrm[best]) ? i : best), 0);
  const [ia, ib] = k === 0 ? [1, 2] : k === 1 ? [2, 0] : [0, 1];
  const flip = nrm[k] < 0 ? -1 : 1;
  return pts.map((p) => [p[ia], p[ib] * flip]);
}
/** A face's winding about a point of its plane - the face as it fills, nought outside it (in a port bridged into it). */
function windingOf(p2, q) {
  let w = 0;
  for (let e = 0; e < p2.length; e++) {
    const a = p2[e], b = p2[(e + 1) % p2.length];
    const c = (b[0] - a[0]) * (q[1] - a[1]) - (q[0] - a[0]) * (b[1] - a[1]);
    if (a[1] <= q[1]) { if (b[1] > q[1] && c > 0) w++; } else if (b[1] <= q[1] && c < 0) w--;
  }
  return w;
}
/** Whether every triangle of a fill lies in its face: each one's middle within the face's winding. */
export function fillInside(pts, tris) {
  const p2 = facePlane(pts);
  return tris.every(([a, b, c]) => {
    const area = (p2[b][0] - p2[a][0]) * (p2[c][1] - p2[a][1]) - (p2[c][0] - p2[a][0]) * (p2[b][1] - p2[a][1]);
    return Math.abs(area) < 1e-9 || windingOf(p2, [(p2[a][0] + p2[b][0] + p2[c][0]) / 3, (p2[a][1] + p2[b][1] + p2[c][1]) / 3]) !== 0;
  });
}

/**
 * THE FACE BY ITS WINDING, for a face neither clip fills inside itself: the port side's inner planking is a 24-gon that
 * runs round her ports and folds back along their lintels, and no ear is left in it - the fill's desperate corner laid
 * two triangles over two of her ports from inside (test/galleon_model.test.js shoots through them). Its winding is the
 * planking with the ports open, so it is filled as that: the plane cut into slabs at every corner's abscissa, each slab
 * between the face's edges that span it, a trapezoid (two triangles) wherever the winding is not nought. A slab's corner
 * on an edge between its ends is a point of the face's own, found along that edge. Returns `{ points, tris }`: the
 * corners and the points made, the triangles as index triples into them (counter-clockwise in the face's plane).
 */
export function slabFill(pts) {
  const p2 = facePlane(pts), n = pts.length;
  const xs = [...new Set(p2.map((p) => +p[0].toFixed(7)))].sort((a, b) => a - b);
  const points = pts.map((p) => [...p]), made = new Map(), tris = [];
  /** The point where edge `e` stands at abscissa `x` - a corner of the face's own, or one made along the edge. */
  const at = (e, x) => {
    const a = p2[e], b = p2[(e + 1) % n];
    const t = (x - a[0]) / (b[0] - a[0]);
    if (Math.abs(t) < 1e-9) return e;
    if (Math.abs(t - 1) < 1e-9) return (e + 1) % n;
    const key = `${e}:${x}`;
    if (!made.has(key)) {
      const A = pts[e], B = pts[(e + 1) % n];
      made.set(key, points.length);
      points.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
    }
    return made.get(key);
  };
  const yAt = (e, x) => { const a = p2[e], b = p2[(e + 1) % n]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); };
  for (let s = 0; s + 1 < xs.length; s++) {
    const x0 = xs[s], x1 = xs[s + 1], xm = (x0 + x1) / 2;
    const span = [];
    for (let e = 0; e < n; e++) {
      const a = p2[e][0], b = p2[(e + 1) % n][0];
      if (Math.min(a, b) <= x0 + 1e-7 && Math.max(a, b) >= x1 - 1e-7 && Math.abs(b - a) > 1e-9) span.push(e);
    }
    span.sort((e, f) => yAt(e, xm) - yAt(f, xm));
    for (let k = 0; k + 1 < span.length; k++) {
      const lo = span[k], hi = span[k + 1];
      if (!(yAt(hi, xm) - yAt(lo, xm) > 1e-9) || windingOf(p2, [xm, (yAt(lo, xm) + yAt(hi, xm)) / 2]) === 0) continue;
      const A = at(lo, x0), B = at(lo, x1), C = at(hi, x1), D = at(hi, x0);
      if (B !== C) tris.push([A, B, C]);
      if (A !== D) tris.push([A, C, D]);
    }
  }
  return { points, tris };
}

/** GALLEON-2: whether two objects are one shape - the same faces on the same corners, each within a micrometre. */
function sameShape(a, b) {
  if (a.scene.length !== b.scene.length || a.polygons.length !== b.polygons.length) return false;
  if (!a.scene.every((p, i) => p.every((v, k) => Math.abs(v - b.scene[i][k]) < 1e-6))) return false;
  return a.polygons.every((p, i) => p.length === b.polygons[i].length && p.every((v, j) => v === b.polygons[i][j]));
}

/** A scene box: { min, max } over some points. */
function boxOf(points) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return { min, max };
}
const inBox = (p, b, pad = 0.05) => p.every((v, k) => v >= b.min[k] - pad && v <= b.max[k] + pad);

/**
 * One part: its scene polygons over a subset of the object's vertices, re-indexed, into the boat's frame - the
 * positions, each polygon's corners in the port's winding, its triangles, and which polygon each triangle is of.
 */
function bakePart(role, object, polyIds) {
  const remap = new Map();
  const positions = [];
  const take = (vi) => {
    if (!remap.has(vi)) {
      remap.set(vi, positions.length / 3);
      positions.push(...toBoat(object.scene[vi]).map(round4));
    }
    return remap.get(vi);
  };
  const polygons = [], triangles = [], triangleOf = [], material = [];
  let clipped = 0;
  for (const k of polyIds) {
    const poly = object.polygons[k];
    if (poly.length < 3) throw new Error(`${object.name}: a polygon with ${poly.length} corners is not a face`);
    const pts = poly.map((vi) => object.scene[vi]);
    let tris, extra = [];
    if (poly.length === 3 || isConvexPolygon(pts)) {
      tris = [];
      for (let i = 1; i + 1 < poly.length; i++) tris.push([0, i, i + 1]);
    } else {
      // a simple concave face clips as tools/fbxMesh.mjs clips one; a face that touches itself, as Blender fills it -
      // and one neither fills inside itself, by its winding (slabFill)
      try { tris = earClip(pts); } catch { tris = polyfill(pts); }
      if (!fillInside(pts, tris)) { const f = slabFill(pts); tris = f.tris; extra = f.points.slice(pts.length); }
      clipped++;
    }
    const ring = poly.map(take);
    const made = extra.map((q) => { positions.push(...toBoat(q).map(round4)); return positions.length / 3 - 1; });
    const at = (i) => (i < ring.length ? ring[i] : made[i - ring.length]);
    const p = polygons.length;
    polygons.push([...ring].reverse());   // the mirror: the port's winding
    material.push(object.polyMaterial[k] >= 0 ? object.materials[object.polyMaterial[k]] ?? null : null);
    for (const [a, b, c] of tris) { triangles.push(at(a), at(c), at(b)); triangleOf.push(p); }
  }
  return { role, object: object.name, positions, polygons, material, triangles, triangleOf, clipped };
}

/** The bake: the FBX's bytes in, the galleon's parts out. Pure. */
export function bakeGalleon(fbxBytes) {
  const tree = readFbx(fbxBytes);
  const objects = sceneObjects(tree);
  const parts = [];
  const seen = new Set();
  const byName = new Map(objects.map((o) => [o.name, o]));
  for (const o of objects) {
    const skip = SKIP[o.name];
    if (skip) {
      if (skip.twin) {
        const t = byName.get(skip.twin);
        if (!t || !sameShape(o, t)) throw new Error(`${o.name} was to be ${skip.twin}'s twin in its place and is not`);
      } else {
        const b = boxOf(o.scene);
        if (!(b.min[1] > skip.minY)) throw new Error(`${o.name} was to be another station (beyond Y ${skip.minY}) and stands at Y ${b.min[1].toFixed(2)}`);
      }
      continue;
    }
    const r = ROLES[o.name];
    if (!r) throw new Error(`${o.name} plays no role aboard - name it in ROLES (or SKIP) after reading the scene`);
    const b = boxOf(o.scene);
    if (!inBox(r.at, b)) throw new Error(`${o.name} (${r.role}) was to stand round ${JSON.stringify(r.at)} and its box is ${JSON.stringify(b.min.map((v) => +v.toFixed(2)))}..${JSON.stringify(b.max.map((v) => +v.toFixed(2)))}`);
    seen.add(o.name);
    const all = o.polygons.map((_, k) => k);
    if (r.role === 'hull') {
      const rudder = all.filter((k) => o.polygons[k].every((vi) => o.scene[vi][0] < RUDDER.aftOf && Math.abs(o.scene[vi][1] - FRAME.centreline) <= RUDDER.halfThickness));
      if (rudder.length !== 5) throw new Error(`the hull's rudder was five faces aft of ${RUDDER.aftOf} and ${rudder.length} were found`);
      parts.push(bakePart('hull', o, all.filter((k) => !rudder.includes(k))));
      parts.push(bakePart('rudder', o, rudder));
    } else parts.push(bakePart(r.role, o, all));
  }
  const missing = Object.keys(ROLES).filter((n) => !seen.has(n));
  if (missing.length) throw new Error(`the scene has none of ${missing.join(', ')}`);
  return {
    bake: 'tools/bakeGalleon.mjs',
    source: SOURCE_FBX,
    sha256: createHash('sha256').update(fbxBytes).digest('hex'),
    creator: childNamed(tree.nodes, 'Creator')?.props[0] ?? null,
    frame: { ...FRAME },
    parts: parts.map(({ clipped, ...p }) => ({ ...p, earClipped: clipped })),
  };
}

/** The bake as the file holds it: one part a line, so a re-bake that moves a part is one line of the diff. */
export function galleonJson(baked) {
  const { parts, ...head } = baked;
  const lines = parts.map((p) => `    ${JSON.stringify(p)}`);
  return `${JSON.stringify(head, null, 2).replace(/\n}$/, '')},\n  "parts": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
  const fbx = opt('fbx', SOURCE_FBX);
  const bytes = readFileSync(fbx);
  if (args.includes('--list')) {
    for (const o of sceneObjects(readFbx(bytes))) {
      const b = boxOf(o.scene);
      console.log(`${o.name.padEnd(14)} ${(ROLES[o.name]?.role ?? (SKIP[o.name] ? '(skipped)' : '?')).padEnd(20)} ${b.min.map((v) => v.toFixed(2)).join(',')} .. ${b.max.map((v) => v.toFixed(2)).join(',')}  ${o.polygons.length} polygons`);
    }
  } else {
    const baked = bakeGalleon(bytes);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, galleonJson(baked));
    console.log(`${fbx} -> ${OUT}`);
    for (const p of baked.parts) console.log(`  ${p.role.padEnd(20)} ${p.object.padEnd(14)} ${String(p.positions.length / 3).padStart(4)} vertices ${String(p.polygons.length).padStart(3)} polygons ${String(p.triangles.length / 3).padStart(4)} triangles${p.earClipped ? ` (${p.earClipped} ear-clipped)` : ''}`);
  }
}
