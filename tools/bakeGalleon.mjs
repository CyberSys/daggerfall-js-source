// THE NEW GALLEON'S MODEL, BAKED OUT OF MAC'S BLENDER SCENE.
//
//     node tools/bakeGalleon.mjs [--fbx=src/assets/galleon/source/New_Ship.fbx] [--list]
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
// (FRAME.centreline - she was on Y 0). Her hull is reshaped (95 faces where
// it was 87) - AUDIT GN-B7, measured: a deeper V bottom on a keel 1.08 m
// lower in the scene (0.75 m in her frame, -3.89 to -4.64), a finer entry
// and a forefoot swept up to the stem, and at the bow the wale's two
// forward corners (scene X 21.21) drawn in from 8.37 m off her centreline
// to 7.48 m - corners her upper sides share with her lower ones, so both
// changed, and both now lean out of their own planes (step 2). Six deck
// beams carry her main deck over the gun deck (`deckBeam`); every other
// part is the first's, moved with her, to 3 micrometres. The scene also
// keeps a TWIN of most parts standing in the same place (Shift+D, never
// moved - checked vertex for vertex, `SKIP` twin) and working stations far
// along Y (`SKIP` minY, each said for what it is).
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
//    (CENTRELINE her keel line's Y - her hull object's own): a mirror,
//    which is why every polygon's corners are REVERSED on the way through -
//    Blender's front is counter-clockwise in a right-handed frame and the
//    port's is clockwise in Unity's (renderer.js frontFace(CW)), so the
//    reversal keeps each face's front its front.
//
//    AUDIT GN-B5: WHAT IT CANNOT READ, IT REFUSES BY NAME - never bakes
//    wrong: a file whose GlobalSettings are not this export's axes
//    (EXPORT_AXES), an object parented under another, one carrying a
//    pre/post rotation, a pivot, a rotation or scaling OFFSET or a
//    geometric transform (the bake reads T*R*S only), one MIRRORED by its
//    own transform (a negative determinant: every face of it would bake
//    inside out), and one not standing where it was read (`ROLES`' boxes).
//
//    THE FRAME IS CHOSEN, AND SAID (AUDIT GN-B7: every number measured on
//    this export): SCALE 0.7 makes her 43.8 m from her stem head to her
//    rudder (the bowsprit apart), the length of the galleon she replaces
//    (Come Sail Away's hull 2, 44.1 m - every number the sea fight measured
//    against that hull keeps its sense), and stands her gun deck 4.86 m
//    under her main deck's planking (Mac's scene: 6.94 m). WATERLINE 3
//    (scene metres) puts her keel 4.64 m under the sea - the first
//    export's 3.89, the mod's galleon drew 3.35 - her gun deck 1.08 m and
//    her port sills 1.56 m over it. MIDSHIP 2.7 is the middle of those
//    43.8 m (to 2 cm), so she pivots where she is longest. CENTRELINE
//    (AUDIT GN-B6) is her hull object's own scene Y, to the bit - the bake
//    refuses a hull whose origin is not on it - so a vertex Mac mirrored
//    across her bakes to the same |x| either side.
//
// 2. EACH POLYGON CUT INTO TRIANGLES AS BLENDER CUTS IT (AUDIT GN-B1; GN-B4
//    this account, where the last one called its own fill Blender's):
//    tools/fbxMesh.mjs blenderTessellate, Blender's own tessellation
//    ported - a triangle kept, a quad split on the diagonal Blender
//    takes, an n-gon filled by BLI_polyfill_calc in the plane of its
//    Newell normal, all in single precision - on each polygon as Blender
//    holds it (the mesh's own coordinates, its corners in their own order),
//    the triangles then carried through the mirror as the polygon is.
//    Blender draws a face by its triangles, and a face that is not planar
//    is a different surface under a different cut: since GALLEON-2 her
//    hull's sides lean up to 0.55 m out of their own planes, and the ear
//    clip this bake used to run (an axis dropped, the lowest-index ear
//    first) cut her two lower sides unlike each other - a 22 m wedge 65
//    degrees off her starboard side that her port side lacked, the two
//    half a metre apart in shape - and folded a fin under her port quarter.
//    Blender's cut lays that wedge on BOTH sides (it is how his side, bent
//    at the bow, is drawn), and they stand within 3.3 cm of each other's
//    mirror. Blender itself cuts five of her hull's faces unlike their
//    mirror images - her stern quarters (0.36 m apart) and four quads: Mac
//    drew each the mirror of its partner, but their corners start
//    elsewhere - and the bake keeps that too, as he sees it (pinned in
//    test/auditgalleon_bake.test.js). A polygon
//    its triangles do not TILE is refused by object and number, never
//    patched (tools/fbxMesh.mjs tilingFault: every triangle wound with its
//    face, their areas its area to 1e-6, no part of its plane covered more
//    or fewer times than the face winds about it) - so the bake makes no
//    point and no triangle of its own. Where Mac drew three corners on one
//    line (a gunport's sill, a lintel, the fold of her port inner planking,
//    #76), Blender's fill can cut a triangle of no area along it: it is
//    kept, as Blender keeps it, and draws nothing (world/galleonMesh.js
//    MeshBench drops a triangle of no area). The polygons are kept as well,
//    since a face's texture is chosen per polygon.
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
import { eulerXYZ, polygonsOf, sceneFrame, blenderTessellate, blenderProject, tilingFault } from './fbxMesh.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE_FBX = 'src/assets/galleon/source/New_Ship.fbx';
export const OUT = 'src/assets/galleon/galleon.json';

/** The boat's frame, from Mac's scene (metres, Z up, bow +X). GALLEON-2: `centreline` the scene Y of her keel line,
 *  where the first export stood her on Y 0. AUDIT GN-B6: it is her hull object's own placement, exactly - Lcl
 *  Translation Z -3624.673828125 cm through the file's frame (FBX -Z is the scene's Y, a centimetre a hundredth) - not
 *  her beam halved to 0.1 mm (36.2467, 38 um to starboard of it, split mirror pairs' |x| at the bake's last digit). */
export const FRAME = Object.freeze({ scale: 0.7, waterline: 3, midship: 2.7, centreline: 36.24673828125 });

/** AUDIT GN-B5: the axes this export was written in (Blender's FBX default: Y up, Z front, X right - all positive),
 *  read off its GlobalSettings. tools/fbxMesh.mjs sceneFrame reads the up and coord axes; the front axis it never asks
 *  is what makes the frame right-handed, so a file written in any other axes is refused, never re-derived. */
export const EXPORT_AXES = Object.freeze({ UpAxis: 1, UpAxisSign: 1, FrontAxis: 2, FrontAxisSign: 1, CoordAxis: 0, CoordAxisSign: 1 });

/** AUDIT GN-B5: how far (m, any coordinate of the box) an object may stand from where its role was read. */
export const BOX_SLACK = 0.02;

/**
 * Each of the scene's objects, by the role it plays aboard. Read off the
 * scene itself (tools/bakeGalleon.mjs --list prints every object's box):
 * the names are Blender's defaults, so each role ALSO states where its
 * object stands. AUDIT GN-B5: as its whole scene `box` ([min, max], metres,
 * to the millimetre, read off this export) - BOX_SLACK (2 cm) out in any
 * coordinate and the bake refuses it by name: a re-export that renamed,
 * moved or reshaped one never ships a stair as a hatch (the old test was a
 * point inside the box, which let a gun deck slide 5 cm and a deck beam 59).
 */
export const ROLES = Object.freeze({
  Cube: Object.freeze({ role: 'hull', box: [[-28.597, 27.878, -3.634], [34.033, 44.616, 13.367]] }),
  'Cube.001': Object.freeze({ role: 'gunDeck', box: [[-23.233, 28.924, 4.547], [31.592, 43.569, 4.547]] }),
  'Cube.002': Object.freeze({ role: 'mainDeck', box: [[-24.532, 28.657, 11.486], [32.581, 43.837, 11.86]] }),
  'Cube.003': Object.freeze({ role: 'hatchAft', box: [[-6.283, 34.167, 11.925], [-1.439, 37.403, 14.207]] }),
  'Cube.004': Object.freeze({ role: 'hatchFore', box: [[6.913, 34.456, 11.701], [11.757, 38.038, 12.111]] }),
  'Cube.005': Object.freeze({ role: 'castle', box: [[-25.736, 28.652, 11.172], [-12.009, 43.854, 18.74]] }),
  'Cube.006': Object.freeze({ role: 'castleParapet', box: [[-18.434, 31.642, 18.567], [-12.121, 40.867, 19.797]] }),
  'Cube.007': Object.freeze({ role: 'bulkhead', box: [[-12.126, 28.788, 3.959], [-11.498, 43.705, 11.612]] }),
  'Cube.008': Object.freeze({ role: 'stairsStarboard', box: [[-18.272, 29.466, 11.596], [-7.926, 31.507, 18.707]] }),
  'Cube.009': Object.freeze({ role: 'balustradePort', box: [[-14.12, 43.587, 10.114], [-3.083, 43.81, 17.037]] }),
  'Cube.010': Object.freeze({ role: 'stairsPort', box: [[-18.272, 41.027, 11.596], [-7.926, 43.067, 18.707]] }),
  'Cube.011': Object.freeze({ role: 'gunportLid', box: [[-4.215, 44.421, 7.037], [-2.971, 46.646, 7.385]] }),
  // GALLEON-2: the deck beams, aft to fore - one role, six objects (galleonModel.js draws them as one)
  'Cube.019': Object.freeze({ role: 'deckBeam', box: [[-16.22, 28.991, 10.458], [-15.114, 43.503, 11.565]] }),
  'Cube.013': Object.freeze({ role: 'deckBeam', box: [[-7.727, 28.991, 10.458], [-6.621, 43.503, 11.565]] }),
  'Cube.012': Object.freeze({ role: 'deckBeam', box: [[-0.553, 28.991, 10.458], [0.553, 43.503, 11.565]] }),
  'Cube.018': Object.freeze({ role: 'deckBeam', box: [[5.301, 28.991, 10.458], [6.408, 43.503, 11.565]] }),
  'Cube.017': Object.freeze({ role: 'deckBeam', box: [[12.299, 28.991, 10.458], [13.405, 43.503, 11.565]] }),
  'Cube.016': Object.freeze({ role: 'deckBeam', box: [[17.102, 28.991, 10.458], [18.209, 43.503, 11.565]] }),
  'Cube.014': Object.freeze({ role: 'balustradeStarboard', box: [[-14.12, 28.684, 10.114], [-3.083, 28.907, 17.037]] }),
  'Cube.015': Object.freeze({ role: 'castleRail', box: [[-25.709, 28.661, 18.567], [-12.345, 43.793, 20.567]] }),
  Cylinder: Object.freeze({ role: 'bowsprit', box: [[32.218, 35.605, 12.134], [42.484, 36.887, 16.067]] }),
  'Cylinder.001': Object.freeze({ role: 'mainMast', box: [[1.617, 35.296, 4.102], [3.427, 37.198, 29.69]] }),
  'Cylinder.002': Object.freeze({ role: 'foreMast', box: [[14.422, 35.296, 4.102], [16.232, 37.198, 27.198]] }),
  'Cylinder.003': Object.freeze({ role: 'mainPartner', box: [[0.901, 34.455, 11.615], [4.312, 38.04, 12.839]] }),
  'Cylinder.004': Object.freeze({ role: 'mainStep', box: [[0.901, 34.455, 4.271], [4.312, 38.04, 6.416]] }),
  'Cylinder.005': Object.freeze({ role: 'foreStep', box: [[13.659, 34.455, 4.271], [17.071, 38.04, 6.416]] }),
  'Cylinder.006': Object.freeze({ role: 'forePartner', box: [[13.659, 34.455, 11.615], [17.071, 38.04, 12.839]] }),
  'Cylinder.007': Object.freeze({ role: 'crowsNest', box: [[0.111, 33.528, 28.901], [5.287, 38.968, 31.255]] }),
});
/** What the scene keeps and she never wears, each checked to be what it is said to be - so a real part is never
 *  dropped by its name:
 *  - `minY`: a working STATION, wholly beyond that scene Y. AUDIT GN-B7, each read face for face against the parts:
 *    Cube.022 the FIRST export's ship joined into one object (its hull the first's, her fore hatch cover with it, no
 *    aft cover, lid or beams); Cube.038 a hull BETWEEN the two exports' (79 of her 95 faces, 4 of the first's, 8 of
 *    neither) with her other parts and her beams, no hatch cover or lid; Cube.029 her current parts joined TWICE OVER
 *    (every face of them twice, in place), no hatch cover or lid; and Cube.020, .021 and .023, a spare aft and fore
 *    hatch cover and gunport lid standing beside Cube.038;
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

/** AUDIT GN-B5: the transform properties T*R*S does not carry, each at the value that leaves it out. Blender writes
 *  none of them; a file that does was authored with a pivot or an offset the bake would silently drop. */
const UNREAD_TRANSFORM = Object.freeze([
  ['PreRotation', [0, 0, 0]], ['PostRotation', [0, 0, 0]], ['RotationOffset', [0, 0, 0]], ['RotationPivot', [0, 0, 0]],
  ['ScalingOffset', [0, 0, 0]], ['ScalingPivot', [0, 0, 0]],
  ['GeometricTranslation', [0, 0, 0]], ['GeometricRotation', [0, 0, 0]], ['GeometricScaling', [1, 1, 1]],
]);

/** AUDIT GN-B5: the file is in this export's axes (EXPORT_AXES), or the bake refuses it, naming what differs. */
function assertExportAxes(tree) {
  const gs = nodeAt(tree.nodes, 'GlobalSettings');
  if (!gs) throw new Error('no GlobalSettings in this FBX - the bake reads its axes there');
  for (const [key, want] of Object.entries(EXPORT_AXES)) {
    const got = property70(gs, key)?.[0];
    if (got === undefined || Number(got) !== want) {
      throw new Error(`GlobalSettings ${key} is ${got} where this export's is ${want} - the bake reads Blender's FBX axes (${Object.entries(EXPORT_AXES).map(([k, v]) => `${k} ${v}`).join(', ')}) and no other; export with Forward -Z, Up Y`);
    }
  }
}

const det3 = (a) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);

/** AUDIT GN-B6: an Euler angle (degrees) within a microradian of a quarter turn IS that quarter turn. Blender's
 *  exporter writes its axis conversion (-90 about X) into every root object's rotation through single precision, and
 *  the noise is a float32 step or two: the hull's reads -90.0000093 (0.16 urad), which tilts her mirror plane enough
 *  that a vertex Mac mirrored exactly bakes 1.6 um off its pair - across the bake's last digit for five of them. No
 *  modelled rotation is a microradian off a quarter turn; nothing here moves more than 2.8 um (her main mast's head). */
const quarterTurn = (deg) => { const q = Math.round(deg / 90) * 90; return Math.abs(deg - q) * (Math.PI / 180) <= 1e-6 ? q : deg; };

/** Every Mesh model with its Geometry, materials and placement, from a parsed FBX: `local` its mesh's own vertices (as
 *  Blender holds them - AUDIT GN-B1 cuts its faces there), `scene` the same placed in Mac's scene, `origin` where its
 *  own origin stands in the scene (AUDIT GN-B6). */
export function sceneObjects(tree) {
  const objects = nodeAt(tree.nodes, 'Objects');
  if (!objects) throw new Error('no Objects section in this FBX');
  assertExportAxes(tree);
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
    for (const [prop, identity] of UNREAD_TRANSFORM) {
      const v = property70(model, prop);
      if (v && v.some((x, i) => Math.abs(Number(x) - identity[i]) > 1e-9)) throw new Error(`${name} carries ${prop} ${JSON.stringify(v)} - the bake reads T*R*S only`);
    }
    if (Number(property70(model, 'RotationOrder')?.[0] ?? 0) !== 0) throw new Error(`${name}: rotation order is not XYZ Euler`);
    const geoLink = links.find((l) => l.kind === 'OO' && l.dst === id && byId.get(l.src)?.name === 'Geometry');
    const geo = geoLink ? byId.get(geoLink.src) : null;
    if (!geo) throw new Error(`${name} has no Geometry`);
    const materials = links.filter((l) => l.kind === 'OO' && l.dst === id && byId.get(l.src)?.name === 'Material').map((l) => objectName(byId.get(l.src).props[1]));
    const S = (property70(model, 'Lcl Scaling') ?? [1, 1, 1]).map(Number);
    const R = eulerXYZ((property70(model, 'Lcl Rotation') ?? [0, 0, 0]).map(Number).map(quarterTurn));
    const T = (property70(model, 'Lcl Translation') ?? [0, 0, 0]).map(Number);
    const m = frame.m;
    // AUDIT GN-B5: a transform that mirrors (a negative scale, an odd number of them) turns every face it carries
    // inside out - the bake's own mirror reverses each polygon's corners on the strength of the frame alone. The
    // determinant of the whole linear map, the file's frame times R times S, says so whatever the rotation.
    const det = det3([0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (m[r * 3] * R[c] + m[r * 3 + 1] * R[3 + c] + m[r * 3 + 2] * R[6 + c]) * S[c])));
    if (!(det > 0)) throw new Error(`${name}'s transform ${det < 0 ? 'mirrors it' : 'flattens it'} (scale ${JSON.stringify(S)}, determinant ${det.toPrecision(4)}) - ${det < 0 ? 'its faces would bake inside out' : 'it would bake flat'}; apply the scale in Blender (Ctrl+A) before exporting`);
    // the object's T*R*S into FBX world space, then the file's frame into the scene (metres, Z up)
    const place = (p) => {
      const s = [p[0] * S[0], p[1] * S[1], p[2] * S[2]];
      const w = [R[0] * s[0] + R[1] * s[1] + R[2] * s[2] + T[0], R[3] * s[0] + R[4] * s[1] + R[5] * s[2] + T[1], R[6] * s[0] + R[7] * s[1] + R[8] * s[2] + T[2]];
      return [m[0] * w[0] + m[1] * w[1] + m[2] * w[2], m[3] * w[0] + m[4] * w[1] + m[5] * w[2], m[6] * w[0] + m[7] * w[1] + m[8] * w[2]];
    };
    const raw = childNamed(geo, 'Vertices')?.props[0];
    const pvi = childNamed(geo, 'PolygonVertexIndex')?.props[0];
    if (!raw || !pvi) throw new Error(`${name}'s Geometry carries no Vertices/PolygonVertexIndex`);
    const local = [], scene = [];
    for (let i = 0; i < raw.length; i += 3) {
      local.push([raw[i], raw[i + 1], raw[i + 2]]);
      scene.push(place([raw[i], raw[i + 1], raw[i + 2]]));
    }
    const matLayer = childNamed(geo, 'LayerElementMaterial');
    const matIndex = matLayer ? childNamed(matLayer, 'Materials')?.props[0] : null;
    const matMap = matLayer ? childNamed(matLayer, 'MappingInformationType')?.props[0] : null;
    const polygons = polygonsOf(pvi);
    const polyMaterial = polygons.map((_, k) => (matIndex ? (matMap === 'AllSame' ? matIndex[0] : matIndex[k]) : -1));
    out.push({ name, local, scene, origin: place([0, 0, 0]), polygons, polyMaterial, materials });
  }
  return out;
}

/**
 * AUDIT GN-B1: POLYGON `k` OF AN OBJECT CUT AS BLENDER CUTS IT, OR REFUSED. Its corners as Blender holds them - the
 * mesh's own coordinates, in the polygon's own order - through tools/fbxMesh.mjs blenderTessellate; then the cut is
 * held to its face (tilingFault: in the plane the fill worked in, each triangle's area judged on its corners in 3D,
 * so one standing edge-on to the face is caught too), and a polygon it does not tile is refused, naming the object
 * and the polygon, never patched - no point made along an edge, no fill of the bake's own. Returns corner-index
 * triples, each wound as the polygon is.
 */
export function fillFace(object, k) {
  const poly = object.polygons[k];
  if (poly.length < 3) throw new Error(`${object.name} polygon #${k}: ${poly.length} corners is not a face`);
  const corners = poly.map((vi) => object.local[vi]);
  const tris = blenderTessellate(corners);
  const fault = tilingFault(blenderProject(corners), tris, corners);
  if (fault) throw new Error(`${object.name} polygon #${k} (${poly.length} corners): Blender's cut does not tile it - ${fault}. Fix the face in Blender before exporting.`);
  return tris;
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
const mm = (b) => [b.min.map((v) => Math.round(v * 1000) / 1000 + 0), b.max.map((v) => Math.round(v * 1000) / 1000 + 0)];

/**
 * One part: its scene polygons over a subset of the object's vertices, re-indexed, into the boat's frame - the
 * positions (the source's corners and no others), each polygon's corners in the port's winding, its triangles, which
 * polygon each triangle is of, and (AUDIT GN-B7) `split`: how many of its polygons were cut, four corners or more -
 * the rest were triangles already.
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
  let split = 0;
  for (const k of polyIds) {
    const poly = object.polygons[k];
    const tris = fillFace(object, k);   // AUDIT GN-B1: Blender's cut, or refused; GN-B3: on its own corners alone
    const ring = poly.map(take);
    const p = polygons.length;
    polygons.push([...ring].reverse());   // the mirror: the port's winding
    material.push(object.polyMaterial[k] >= 0 ? object.materials[object.polyMaterial[k]] ?? null : null);
    // AUDIT GN-B1: each triangle through the mirror as its polygon goes - (a, b, c) wound with the face in Mac's scene,
    // (a, c, b) with it in hers
    for (const [a, b, c] of tris) { triangles.push(ring[a], ring[c], ring[b]); triangleOf.push(p); }
    if (poly.length > 3) split++;
  }
  return { role, object: object.name, positions, polygons, material, triangles, triangleOf, split };
}

/** The bake: the FBX's bytes in, the galleon's parts out. Pure. `tree` is the bytes parsed - a test hands in one it
 *  has changed, to see the bake refuse it. */
export function bakeGalleon(fbxBytes, tree = readFbx(fbxBytes)) {
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
    // AUDIT GN-B5: where it was read, to BOX_SLACK in every coordinate of its box
    const b = boxOf(o.scene);
    const off = Math.max(...[b.min, b.max].flatMap((end, e) => end.map((v, k) => Math.abs(v - r.box[e][k]))));
    if (!(off <= BOX_SLACK)) throw new Error(`${o.name} (${r.role}) was read standing in the box ${JSON.stringify(r.box)} and stands in ${JSON.stringify(mm(b))} - ${(off * 100).toFixed(1)} cm out where ${BOX_SLACK * 100} cm is let pass; read the scene again (--list) before re-baking`);
    seen.add(o.name);
    const all = o.polygons.map((_, k) => k);
    if (r.role === 'hull') {
      // AUDIT GN-B6: her centreline is this object's own Y, to the bit - or her mirror pairs bake unequal
      if (o.origin[1] !== FRAME.centreline) throw new Error(`the hull's origin stands at scene Y ${o.origin[1]} and FRAME.centreline is ${FRAME.centreline} - set the centreline to the hull's Y`);
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
    parts,
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
      // AUDIT GN-B5: the box as ROLES records it, to the millimetre
      console.log(`${o.name.padEnd(14)} ${(ROLES[o.name]?.role ?? (SKIP[o.name] ? '(skipped)' : '?')).padEnd(20)} ${JSON.stringify(mm(boxOf(o.scene)))}  ${o.polygons.length} polygons`);
    }
  } else {
    const baked = bakeGalleon(bytes);
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, galleonJson(baked));
    console.log(`${fbx} -> ${OUT}`);
    for (const p of baked.parts) console.log(`  ${p.role.padEnd(20)} ${p.object.padEnd(14)} ${String(p.positions.length / 3).padStart(4)} vertices ${String(p.polygons.length).padStart(3)} polygons ${String(p.triangles.length / 3).padStart(4)} triangles${p.split ? ` (${p.split} cut)` : ''}`);
  }
}
