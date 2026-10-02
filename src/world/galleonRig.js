// @ts-check
// GALLEON (2026-10-01, Mac: "the sails and ropes"): THE NEW GALLEON'S RIG - her yards, her five sails, and her rope.
//
// Mac's scene stands two bare masts, a crow's nest and a bowsprit; the rig is built here over them, in the boat's frame
// (Unity's: +x starboard, +y up, +z the bow - world/galleonModel.js says where every measurement comes from).
//
// SHE IS RIGGED AS A BRIGANTINE, because two masts carry that rig and it sails every way the old galleon did:
//   - the FORE MAST square - a course and a topsail on their yards;
//   - the MAIN MAST a GAFF mainsail (fore-and-aft, the rig that works to windward) under a square main topsail;
//   - a JIB on the forestay out to the bowsprit's end.
// Every one is a sail as Come Sail Away's own are, so every line of the mod's sailing reads them (systems/
// comeSailAway.js): a node named for its kind (Square / Gaff / Stay) and size (Small / Large) with an Animator on the
// mod's own controllers - the Sail Controller (Stowed, or Unstowed blended by Wind -1..1) and the Staysail Controller
// (five Winds) - overridden with this ship's own clips; the yards and the gaff are BOOM nodes the trim turns about the
// mast (`Booms`, the C# sets each one's whole local rotation), each one's first child its sail, which is where the
// auto-trim asks whether that sail is stowed. The sail power the mod sums (GetSailPower) is what she sails on, so the
// kinds and sizes are her handling - DECLARED in the arc page with the profile they make against the old galleon's two
// large lateens.
//
// A SAIL IS SKINNED AS THE MOD'S ARE (world/skinnedBake.js): one bone per vertex here - a grid of them under the sail's
// Bones node - so a clip can stand every corner of the canvas where it should be, and FixDeformations bakes the cloth
// where the bones are each tenth of a second. Its four poses are positions only: STOWED (furled to its yard, brailed to
// its mast, or rolled down its stay), and Unstowed with the wind at -1 (taken aback, or bellied to port), 0 (hanging)
// and +1 (full, or bellied to starboard) - the blend tree mixes them by Wind, and a CrossFade from one state to the
// other walks every bone between them, so a sail falls from its yard as it is set.
//
// THE ROPE: shrouds with their ratlines and deadeyes on channels outside her rail, the stays fore and aft, backstays,
// the bowsprit's bobstay, a yard's lifts (hung under its boom, so they swing with it) - all still in her frame, one
// mesh - and the running rope that moves: each yard's braces, the courses' and the jib's sheets and the gaff's
// mainsheet, every one a two-bone skinned rope from a bone on the moving spar or the sail's own clew to one on her
// deck, so it follows the trim and the sail's set the way the canvas does.
//
// Not a DFU member. Ledger A (GALLEON).
import { MeshBench, prism, rope, box, sub, add, scl, len, norm, lerp3, sagging } from './galleonMesh.js';
import { TEX, GALLEON_TILE } from './galleonArt.js';
import { pathHash } from './unityAnimator.js';

/** Where the rig stands (the boat's frame, metres), measured off the baked masts (world/galleonModel.js MEASURED). */
export const RIG = Object.freeze({
  mainZ: -0.1225, foreZ: 8.8375,
  deckY: 6.202, mainTopY: 18.683, foreTopY: 16.94, nestFloorY: 18.767, nestTopY: 19.782,
  mainR: 0.55, foreR: 0.5,
  bowspritEnd: Object.freeze([0, 9.1, 27.55]),
  stem: Object.freeze([0, 2.1, 21.6]),
});

/** The sails: their yards' (or gaff's) height, their size, their kind - each one's node names say what the mod reads. */
export const SAILS = Object.freeze([
  Object.freeze({ key: 'ForeCourse', kind: 'square', size: '', mast: 'fore', yardY: 12.2, drop: 4.35, headW: 11.0, footW: 12.6, yardSpan: 12.4 }),
  Object.freeze({ key: 'ForeTopsail', kind: 'square', size: 'Small', mast: 'fore', yardY: 16.35, drop: 3.75, headW: 8.0, footW: 10.0, yardSpan: 9.4 }),
  Object.freeze({ key: 'MainTopsail', kind: 'square', size: 'Small', mast: 'main', yardY: 17.65, drop: 4.2, headW: 8.6, footW: 10.4, yardSpan: 10.0 }),
  Object.freeze({ key: 'MainGaff', kind: 'gaff', size: 'Large', mast: 'main', boomY: 7.75, throatY: 12.75, peak: Object.freeze([7.2, -6.9]), clewZ: -8.0, boomLen: 8.6 }),
  Object.freeze({ key: 'Jib', kind: 'stay', size: 'Large' }),
]);
/** A square sail's canvas grid (columns across, rows down) and a fore-and-aft sail's (along the foot, up the luff). */
export const GRID = Object.freeze({ square: Object.freeze([9, 8]), gaff: Object.freeze([8, 7]), stay: Object.freeze([8, 7]) });
/** A clip's length (s): a CrossFade between the sail's states runs SAIL_ANIMATION_SPEED (2) of these. */
export const SAIL_CLIP_S = 1;

const nodeOf = (name, { p = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1], c = [], kids = [], active = true } = {}) => ({ name, active, layer: 0, tag: 0, position: [...p], rotation: [...r], scale: [...s], components: c, children: kids });
const constClip = (name, curves, length = 0, loop = true) => ({ name, start: 0, stop: length, sampleRate: 60, loop, wrapMode: 0, denseRate: 60, denseBegin: 0, events: [], curves });
const posCurve = (path, p) => ({ path: pathHash(path), attribute: 'position', components: p.map((v) => ({ constant: Math.fround(v) })) });

// ── the canvas ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A square sail's corner positions (its boom's frame: the yard on the mast's axis line at y 0, `d` before it) in a
 *  pose: 'center' hanging, 'full' bellied forward, 'aback' pressed back, 'stowed' furled on the yard. */
export function squareSailPose(sail, d, mastR, pose) {
  const [NU, NV] = GRID.square;
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = j / (NV - 1);
    const w = sail.headW + (sail.footW - sail.headW) * v;
    let x = (u - 0.5) * w, y = -0.18 - v * sail.drop, z = d + 0.06;
    const arch = Math.sin(Math.PI * u);
    if (pose === 'center') z -= 0.1 * arch * v;
    else if (pose === 'full') {
      const belly = 0.15 * sail.footW * arch * Math.sin(Math.PI * (0.15 + 0.8 * v));
      z += belly; y += 0.07 * sail.drop * arch * v; x *= 1 - 0.035 * Math.sin(Math.PI * v);
    } else if (pose === 'aback') {
      z -= Math.min(0.1 * sail.footW, d - mastR - 0.06) * arch * Math.sin(Math.PI * v) + 0.04 * v;
    } else if (pose === 'stowed') {
      const phi = j * 1.25 + u * 0.4;
      x = (u - 0.5) * (sail.headW - 0.2);
      y = -0.34 + 0.13 * Math.cos(phi);
      z = d + 0.16 + 0.13 * Math.sin(phi);
    }
    out.push([x, y, z]);
  }
  return out;
}

/** The gaff mainsail's corners (its boom's frame: the main mast's axis at the boom's height) in a pose: 'center',
 *  'port' / 'starboard' bellied to that side, 'stowed' brailed in to the mast. */
export function gaffSailPose(sail, mastR, pose) {
  const [NU, NV] = GRID.gaff;
  const luffZ = -(mastR + 0.12);
  const tack = [0, 0.32, luffZ], clew = [0, 0.32, sail.clewZ];
  const throat = [0, sail.throatY - sail.boomY - 0.15, luffZ], peak = [0, sail.peak[0] - 0.12, sail.peak[1]];
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = j / (NV - 1);
    const foot = lerp3(tack, clew, u), head = lerp3(throat, peak, u);
    let p = lerp3(foot, head, v);
    const arch = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.1 + 0.85 * v));
    if (pose === 'port') p[0] -= 1.1 * arch;
    else if (pose === 'starboard') p[0] += 1.1 * arch;
    else if (pose === 'center') p[0] += 0.12 * arch;
    else if (pose === 'stowed') {
      const luff = lerp3(tack, throat, v);
      const k = 0.07 + 0.05 * Math.sin(u * Math.PI * 3);
      p = lerp3(luff, p, k);
      p[0] += 0.18 * Math.sin(u * 7 + v * 3);
    }
    out.push(p);
  }
  return out;
}

/** The jib's corners (the boat's frame) in a pose: 'center', 'port' / 'starboard' (bellied to that side, the two
 *  halves of the Staysail Controller's five Winds at their halves), 'stowed' rolled down its stay. */
export function jibPose(pose, k = 1) {
  const [NU, NV] = GRID.stay;
  const head = [0, RIG.foreTopY - 0.45, RIG.foreZ + 0.62];
  const tack = [0, RIG.bowspritEnd[1] + 0.12, RIG.bowspritEnd[2] - 0.35];
  const clew = [0, 7.85, 16.6];
  const out = [];
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
    const u = i / (NU - 1), v = j / (NV - 1);
    const foot = lerp3(tack, clew, u);
    let p = lerp3(foot, head, v);
    const arch = Math.sin(Math.PI * u) * (1 - v) * 1.6 * Math.sin(Math.PI * (0.2 + 0.6 * (1 - v)));
    if (pose === 'port') p[0] -= 1.0 * k * arch;
    else if (pose === 'starboard') p[0] += 1.0 * k * arch;
    else if (pose === 'center') p[0] += 0.1 * arch;
    else if (pose === 'stowed') {
      const stay = lerp3(tack, head, Math.min(1, v * 0.97 + u * 0.03));
      p = [stay[0] + 0.12 * Math.sin(u * 6 + j), stay[1] - 0.12, stay[2] + 0.06 * Math.cos(u * 5)];
    }
    out.push(p);
  }
  return out;
}

/**
 * A sail's skinned canvas: both faces of its grid (each face its own vertices, so its normals face its own way),
 * every vertex on the bone of its grid point, the bind poses those bones' rest (`rest`, the grid in the mesh's frame).
 */
export function canvasGeometry(rest, [NU, NV]) {
  const nGrid = NU * NV;
  const positions = new Float32Array(nGrid * 2 * 3), normals = new Float32Array(nGrid * 2 * 3), uvs = new Float32Array(nGrid * 2 * 2);
  const blendIndices = new Uint16Array(nGrid * 2);
  for (let side = 0; side < 2; side++) for (let k = 0; k < nGrid; k++) {
    const v = side * nGrid + k;
    positions.set(rest[k], v * 3);
    const i = k % NU, j = Math.floor(k / NU);
    uvs[v * 2] = side ? 1 - i / (NU - 1) : i / (NU - 1);
    uvs[v * 2 + 1] = 1 - j / (NV - 1);
    blendIndices[v] = k;
  }
  const idx = [];
  for (let j = 0; j + 1 < NV; j++) for (let i = 0; i + 1 < NU; i++) {
    const a = j * NU + i, b = a + 1, c = a + NU, d = c + 1;
    idx.push(a, b, d, a, d, c);                                      // one face
    idx.push(nGrid + a, nGrid + d, nGrid + b, nGrid + a, nGrid + c, nGrid + d);   // and the other, wound the other way
  }
  const indices = Uint32Array.from(idx);
  const bindPoses = rest.map((p) => translation(scl(p, -1)));
  return { vertexCount: nGrid * 2, positions, normals, uvs, indices, subMeshes: [{ startIndex: 0, primitiveCount: indices.length / 3 }], blendIndices, bindPoses, aabb: boxOf(rest) };
}

/** A two-bone skinned rope from `a` to `b` (the mesh's frame): a thin prism whose `a` ring rides bone 0 and `b` ring
 *  bone 1, its bind poses those two points. */
export function ropeGeometry(a, b, r = 0.03, sides = 4) {
  const bench = new MeshBench();
  prism(bench, TEX.rope, a, b, r, r, sides, { caps: [false, false], smooth: true, tileV: GALLEON_TILE.rope[1] });
  const g = bench.finish();
  const blendIndices = new Uint16Array(g.vertexCount);
  const ab = sub(b, a), L2 = Math.max(1e-9, ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]);
  for (let v = 0; v < g.vertexCount; v++) {
    const p = [g.positions[v * 3], g.positions[v * 3 + 1], g.positions[v * 3 + 2]];
    const t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / L2;
    blendIndices[v] = t > 0.5 ? 1 : 0;
  }
  return { ...g, slots: undefined, blendIndices, bindPoses: [translation(scl(a, -1)), translation(scl(b, -1))] };
}

/** A translation as a column-major 4x4. */
export function translation(t) {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1; m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
const boxOf = (pts) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
  return { center: [0, 1, 2].map((k) => (min[k] + max[k]) / 2), extent: [0, 1, 2].map((k) => (max[k] - min[k]) / 2) };
};

// ── the spars ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** A yard: tapered from its slings to its arms, an iron band at each quarter, its footrope sagging under it, and its
 *  lifts up to the mast's axis (so they swing with it). In the boom's frame. */
export function yardGeometry(span, d, liftH) {
  const bench = new MeshBench();
  const half = span / 2;
  prism(bench, TEX.spar, [0, 0, d], [half, 0, d], 0.17, 0.08, 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  prism(bench, TEX.spar, [0, 0, d], [-half, 0, d], 0.17, 0.08, 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  for (const x of [-half * 0.5, half * 0.5]) prism(bench, TEX.iron, [x - 0.06, 0, d], [x + 0.06, 0, d], 0.16, 0.16, 8, { smooth: true });
  // the parrel holding it to the mast
  box(bench, TEX.trim, [0, 0, d * 0.55], [0.22, 0.16, d * 0.45], { tile: GALLEON_TILE.trim });
  // its footrope, and its lifts to the masthead over it
  for (const s of [-1, 1]) {
    rope(bench, TEX.rope, sagging([s * 0.25, -0.05, d + 0.08], [s * (half - 0.15), -0.05, d + 0.08], 0.45, 6), 0.022);
    rope(bench, TEX.rope, [[s * (half - 0.2), 0.05, d], [0, liftH, 0.1]], 0.024);
  }
  return bench.finish();
}

/** The gaff and its boom, in the gaff-boom's frame (the main mast's axis at the boom's height): the boom aft along the
 *  foot, the gaff up to the peak, their jaws about the mast. */
export function gaffSparsGeometry(sail, mastR) {
  const bench = new MeshBench();
  const z0 = -(mastR + 0.05);
  prism(bench, TEX.spar, [0, 0.18, z0], [0, 0.18, -sail.boomLen], 0.16, 0.11, 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  const throat = [0, sail.throatY - sail.boomY, z0], peak = [0, sail.peak[0], sail.peak[1]];
  prism(bench, TEX.spar, throat, peak, 0.13, 0.08, 8, { tileV: GALLEON_TILE.spar[1], smooth: true });
  // the jaws: a dark collar half round the mast at each
  for (const y of [0.18, throat[1]]) box(bench, TEX.trim, [0, y, -mastR * 0.4], [mastR + 0.08, 0.1, mastR * 0.5], { tile: GALLEON_TILE.trim });
  // the peak halyard, from the peak up to the masthead's axis - it swings with the gaff
  rope(bench, TEX.rope, [peak, [0, RIG.mainTopY - 0.7 - sail.boomY, -0.1]], 0.025);
  return bench.finish();
}

// ── the standing rope ───────────────────────────────────────────────────────────────────────────────────────────────

/** Where each shroud stands: its head on the mast, its foot on the channel outside her rail. */
export function shroudLines() {
  const lines = [];
  for (const s of [-1, 1]) {
    for (const z of [-3.5, -2.7, -1.9, -1.1]) lines.push({ mast: 'main', side: s, head: [s * 0.42, RIG.nestFloorY - 0.75, RIG.mainZ - 0.15], foot: [s * 5.74, 6.62, z] });
    for (const z of [6.2, 7.0, 7.8]) lines.push({ mast: 'fore', side: s, head: [s * 0.38, RIG.foreTopY - 0.85, RIG.foreZ - 0.1], foot: [s * 5.74, 6.62, z] });
  }
  return lines;
}

/** The standing rigging, still in her frame, as the meshes it is drawn in - each mast's shrouds with their deadeyes,
 *  the ratlines across each pair and the channel they stand on (`mainShrouds`, `foreShrouds`), the stays and the
 *  bobstay (`stays`), the backstays (`backstays`) and the flagstaff over the crow's nest (`flagstaff`): a box a piece,
 *  never one round the whole rig from her bowsprit's end to her castle - a box that wide and tall stood higher the
 *  more she heeled (a sinking's list read its corner for her masthead). */
export function standingRiggingGeometry() {
  const lines = shroudLines();
  const shrouds = (mast) => {
    const bench = new MeshBench();
    const own = lines.filter((l) => l.mast === mast);
    for (const l of own) {
      rope(bench, TEX.rope, [l.head, add(l.foot, [0, 0.42, 0])], 0.032);
      // the deadeyes and the chainplate down to the channel
      prism(bench, TEX.trim, add(l.foot, [0, 0.3, 0]), add(l.foot, [0, 0.52, 0]), 0.11, 0.11, 6, { smooth: true });
      prism(bench, TEX.iron, add(l.foot, [0, -0.35, 0]), add(l.foot, [0, 0.3, 0]), 0.03, 0.03, 4);
    }
    // the ratlines: a rung across each neighbouring pair of the mast's shrouds every 0.42 m
    for (const s of [-1, 1]) {
      const set = own.filter((l) => l.side === s);
      for (let k = 0; k + 1 < set.length; k++) {
        const a = set[k], b = set[k + 1];
        const at = (l, y) => { const lo = add(l.foot, [0, 0.55, 0]); const t = (y - lo[1]) / (l.head[1] - lo[1]); return lerp3(lo, l.head, t); };
        for (let y = 7.25; y < Math.min(a.head[1], b.head[1]) - 1.6; y += 0.42) rope(bench, TEX.rope, [at(a, y), at(b, y)], 0.014, { sides: 3 });
      }
    }
    // the channels: a plank outside the hull under the mast's shrouds (from her side, 5.37 m out at this height, to
    // the deadeyes)
    for (const s of [-1, 1]) {
      if (mast === 'main') box(bench, TEX.trim, [s * 5.62, 6.55, -2.3], [0.26, 0.07, 1.65], { tile: GALLEON_TILE.trim });
      else box(bench, TEX.trim, [s * 5.62, 6.55, 7.0], [0.26, 0.07, 1.25], { tile: GALLEON_TILE.trim });
    }
    return bench.finish();
  };
  // the stays: the forestay out to the bowsprit's end, the main stay to the fore mast's foot, the bobstay under
  const stays = new MeshBench();
  rope(stays, TEX.rope, [[0, RIG.foreTopY - 0.3, RIG.foreZ + 0.45], RIG.bowspritEnd], 0.045);
  rope(stays, TEX.rope, [[0, RIG.nestFloorY - 0.4, RIG.mainZ + 0.5], [0, RIG.deckY + 1.6, RIG.foreZ - 0.55]], 0.05);
  rope(stays, TEX.rope, [RIG.bowspritEnd, RIG.stem], 0.04);
  // the backstays: the main's to the castle's rail, the fore's to her rail abaft the gangway
  const backstays = new MeshBench();
  for (const s of [-1, 1]) {
    rope(backstays, TEX.rope, [[s * 0.35, RIG.nestFloorY - 0.55, RIG.mainZ - 0.3], [s * 5.05, 12.05, -11.2]], 0.035);
    rope(backstays, TEX.rope, [[s * 0.3, RIG.foreTopY - 0.6, RIG.foreZ - 0.25], [s * 5.38, 6.85, 3.2]], 0.032);
  }
  // the flagstaff over the crow's nest
  const flagstaff = new MeshBench();
  prism(flagstaff, TEX.spar, [0, RIG.nestFloorY, RIG.mainZ + 0.05], [0, RIG.nestTopY + 1.6, RIG.mainZ + 0.05], 0.09, 0.05, 6, { smooth: true, tileV: 2 });
  return { mainShrouds: shrouds('main'), foreShrouds: shrouds('fore'), stays: stays.finish(), backstays: backstays.finish(), flagstaff: flagstaff.finish() };
}

// ── the rig as nodes ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The rig: its nodes (to hang under the hull's node), the meshes they name, and its clips and overrides.
 * `cx` is the prefab builder's (world/galleonModel.js): `mesh(key, geometry)` registers a mesh, `comp(record)` a
 * component and answers its index, `skinned(node, key, bones, root)` asks for a SkinnedMeshRenderer whose bone pointers
 * are filled in once the tree's paths are known.
 */
export function buildRig(cx) {
  const kids = [];
  const clips = {}, overrides = {};
  const mastOf = (m) => (m === 'fore' ? { z: RIG.foreZ, r: RIG.foreR } : { z: RIG.mainZ, r: RIG.mainR });
  const meshNode = (name, key, geometry, opts = {}) => {
    cx.mesh(key, geometry);
    return nodeOf(name, { ...opts, c: [cx.comp({ type: 'MeshFilter', m_Mesh: { mesh: key } }), cx.comp({ type: 'MeshRenderer', m_Enabled: true, materials: geometry.slots.map((s) => ({ ...s })) })] });
  };
  /** A sail's node, its bones and its skinned canvas: `poses` { stowed, left, center, right } (each the grid), its
   *  controller the base it overrides. */
  const sailNode = (sailName, poses, grid, base, sailKey) => {
    const bonesName = `${sailKey}SailBones`, meshName = `${sailKey}SailMesh`;
    const rest = poses.center;
    const bones = rest.map((p, k) => nodeOf(`B${k}`, { p }));
    const bonesNode = nodeOf(bonesName, { kids: bones });
    const geometry = canvasGeometry(rest, grid);
    const key = `galleon:sail:${sailKey}`;
    cx.mesh(key, geometry);
    const texChild = nodeOf(`${cx.archive}_${TEX.canvas}`);   // ApplyGameTextures' slot 0: the canvas
    const meshNode = nodeOf(meshName, { kids: [texChild] });
    cx.skinned(meshNode, key, bones, bonesNode, [{ material: 'galleon-canvas' }]);
    const clipName = (pose) => `galleon2/${sailKey} ${pose}`;
    const curvesOf = (grid2) => grid2.map((p, k) => posCurve(`${bonesName}/B${k}`, p));
    const ovName = `galleon2/${sailKey}`;
    if (base === 'Staysail Controller') {
      clips[clipName('Stowed')] = constClip(clipName('Stowed'), curvesOf(poses.stowed), SAIL_CLIP_S, false);
      for (const [slot, g] of [['Left', poses.left], ['Center Left', poses.centerLeft], ['Center', poses.center], ['Center Right', poses.centerRight], ['Right', poses.right]]) {
        clips[clipName(slot)] = constClip(clipName(slot), curvesOf(g), SAIL_CLIP_S, false);
      }
      overrides[ovName] = { base, clips: [['Sail Stowed', clipName('Stowed')], ['Staysail Unstowed Left', clipName('Left')], ['Staysail Unstowed Center Left', clipName('Center Left')], ['Staysail Unstowed Center', clipName('Center')], ['Staysail Unstowed Center Right', clipName('Center Right')], ['Staysail Unstowed Right', clipName('Right')]] };
    } else {
      for (const [slot, g] of [['Stowed', poses.stowed], ['Left', poses.left], ['Center', poses.center], ['Right', poses.right]]) clips[clipName(slot)] = constClip(clipName(slot), curvesOf(g), SAIL_CLIP_S, false);
      overrides[ovName] = { base, clips: [['Sail Stowed', clipName('Stowed')], ['Sail Unstowed Left', clipName('Left')], ['Sail Unstowed Center', clipName('Center')], ['Sail Unstowed Right', clipName('Right')]] };
    }
    const sail = nodeOf(sailName, { c: [cx.comp({ type: 'Animator', m_Enabled: true, m_Controller: { controller: ovName }, m_ApplyRootMotion: false })], kids: [bonesNode, meshNode] });
    return { sail, bones, bonesNode };
  };
  /** A running rope: a two-bone skinned line between two nodes' points (`a` on node A, `b` on node B, each a bone
   *  placed at its node's local point). */
  const running = (name, a, b) => {
    const meshName = `${name}Line`;
    const key = `galleon:rope:${name}`;
    const geometry = ropeGeometry(a.world, b.world, 0.028);
    cx.mesh(key, geometry);
    const meshNode = nodeOf(meshName, { kids: [nodeOf(`${cx.archive}_${TEX.rope}`)] });
    cx.skinned(meshNode, key, [a.bone, b.bone], null, [{ material: 'galleon-rope' }], true);
    return meshNode;
  };

  // the yards and their square sails
  const squareSails = {};
  for (const s of SAILS.filter((x) => x.kind === 'square')) {
    const m = mastOf(s.mast);
    const d = m.r + 0.24;
    const boomName = `${s.key}SquareBoom`;
    const poses = {
      stowed: squareSailPose(s, d, m.r, 'stowed'), left: squareSailPose(s, d, m.r, 'aback'),
      center: squareSailPose(s, d, m.r, 'center'), right: squareSailPose(s, d, m.r, 'full'),
    };
    const { sail, bones } = sailNode(`${s.key}Square${s.size}Sail`, poses, GRID.square, 'Sail Controller', s.key);
    const yard = meshNode(`${s.key}Yard`, `galleon:yard:${s.key}`, yardGeometry(s.yardSpan, d, 1.3));
    // the yard's arms, as bones for its braces (under the boom, so they turn with it)
    const armP = nodeOf(`${s.key}YardArmPort`, { p: [-(s.yardSpan / 2 - 0.2), 0, d] });
    const armS = nodeOf(`${s.key}YardArmStarboard`, { p: [s.yardSpan / 2 - 0.2, 0, d] });
    const boom = nodeOf(boomName, { p: [0, s.yardY, m.z], kids: [sail, yard, armP, armS] });   // the sail FIRST: the auto-trim reads the boom's first child
    kids.push(boom);
    squareSails[s.key] = { s, boom, bones, armP, armS, d };
  }
  // the gaff mainsail on its boom
  const g = SAILS.find((x) => x.kind === 'gaff');
  const mm = mastOf(g.mast);
  const gPoses = { stowed: gaffSailPose(g, mm.r, 'stowed'), left: gaffSailPose(g, mm.r, 'port'), center: gaffSailPose(g, mm.r, 'center'), right: gaffSailPose(g, mm.r, 'starboard') };
  const gSail = sailNode(`${g.key}${g.size}Sail`, gPoses, GRID.gaff, 'Sail Controller', g.key);
  const gSpars = meshNode(`${g.key}Spars`, 'galleon:gaff', gaffSparsGeometry(g, mm.r));
  const gEnd = nodeOf(`${g.key}SheetBlock`, { p: [0, 0.18, -g.boomLen + 0.3] });
  const gBoom = nodeOf(`${g.key}Boom`, { p: [0, g.boomY, mm.z], kids: [gSail.sail, gSpars, gEnd] });   // 'Gaff' and 'Boom' in its name: the auto-trim's gaff arm turns it
  kids.push(gBoom);
  // the jib on the forestay (in her own frame: no boom turns it)
  const jPoses = { stowed: jibPose('stowed'), left: jibPose('port'), centerLeft: jibPose('port', 0.5), center: jibPose('center'), centerRight: jibPose('starboard', 0.5), right: jibPose('starboard') };
  const jib = sailNode('JibStayLargeSail', jPoses, GRID.stay, 'Staysail Controller', 'Jib');
  kids.push(jib.sail);

  // the standing rigging
  const standing = standingRiggingGeometry();
  for (const [name, key] of [['MainShrouds', 'mainShrouds'], ['ForeShrouds', 'foreShrouds'], ['Stays', 'stays'], ['Backstays', 'backstays'], ['Flagstaff', 'flagstaff']]) {
    kids.push(meshNode(name, `galleon:rigging:${key}`, standing[key]));
  }

  // the running rope: a deck bone for each rope's foot, every one in her frame
  const deckBone = (name, p) => { const n = nodeOf(name, { p }); kids.push(n); return { bone: n, world: p }; };
  const local = (boomNode, child) => add(boomNode.position, child.position);
  for (const { s, boom, armP, armS } of Object.values(squareSails)) {
    const aft = s.mast === 'fore' ? 3.0 : -6.5;   // a fore yard's braces lead aft to the main channels, the main's to the castle
    const yDeck = s.mast === 'fore' ? 6.95 : 11.9;
    for (const [arm, side] of [[armP, -1], [armS, 1]]) {
      const foot = deckBone(`${s.key}BraceBelay${side > 0 ? 'Starboard' : 'Port'}`, [side * 5.3, yDeck, s.mast === 'fore' ? aft : -10.6]);
      kids.push(running(`${s.key}Brace${side > 0 ? 'Starboard' : 'Port'}`, { bone: arm, world: local(boom, arm) }, foot));
    }
  }
  // the fore course's sheets, from its two clews (its foot's corner bones) aft to her rail
  {
    const { s, boom, bones } = squareSails.ForeCourse;
    const [NU, NV] = GRID.square;
    for (const [k, side] of [[(NV - 1) * NU, -1], [NV * NU - 1, 1]]) {
      const foot = deckBone(`ForeCourseSheetBelay${side > 0 ? 'Starboard' : 'Port'}`, [side * 5.25, 6.95, 4.2]);
      kids.push(running(`ForeCourseSheet${side > 0 ? 'Starboard' : 'Port'}`, { bone: bones[k], world: add(add(boom.position, [0, 0, 0]), bones[k].position) }, foot));
    }
    void s;
  }
  // the gaff's mainsheet, from its boom's end down to the castle's front
  kids.push(running('MainGaffSheet', { bone: gEnd, world: local(gBoom, gEnd) }, deckBone('MainGaffSheetBelay', [0, 11.05, -10.6])));
  // the jib's sheets, from its clew to either rail by the fore mast
  {
    const [NU] = GRID.stay;
    const clewBone = jib.bones[NU - 1];
    for (const side of [-1, 1]) kids.push(running(`JibSheet${side > 0 ? 'Starboard' : 'Port'}`, { bone: clewBone, world: clewBone.position }, deckBone(`JibSheetBelay${side > 0 ? 'Starboard' : 'Port'}`, [side * 3.4, 6.95, 13.6])));
  }
  return { kids, clips, overrides };
}

export { len, norm };
