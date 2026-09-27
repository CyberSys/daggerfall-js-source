// @ts-check
// CSA-C (2026-09-27): A PREFAB'S COLLIDERS, AND THE RAY THAT MEETS THEM -
// Physics.Raycast over the BoxColliders and MeshColliders of an instanced
// prefab (world/prefabNode.js), as Unity answers it. Come Sail Away's
// placement ray and its `identifyboat` both ask Physics.Raycast what they
// meet, and a boat already standing is among the answers: its hull, its
// masts, its doors and flag cubes (MeshColliders and BoxColliders), and the
// trigger boxes of its activations (112400-112406) and of the bed.
//
// The rules kept:
// - ONLY an active object's enabled collider is in the scene
//   (activeInHierarchy, and the component's m_Enabled): the variants the
//   boat did not choose, and the built-in Plane the prefabs carry switched
//   off, answer nothing.
// - A TRIGGER answers only when the query takes triggers:
//   QueryTriggerInteraction.UseGlobal reads Physics.queriesHitTriggers,
//   Unity's default true; Ignore passes them over.
// - A BoxCollider is its m_Center and m_Size in its object's own frame,
//   carried by the object's whole transform (a turned, scaled box is still
//   a box in its own frame).
// - A MeshCollider is its mesh's triangles, met from either face - the
//   port's standing reading of DFU's MeshColliders (player/collider.js,
//   systems/automapPick.js: "both faces") - and a CONVEX one is the convex
//   hull of its mesh's vertices (convexHullPlanes; PhysX's hull cooking
//   caps a hull at 255 polygons, which no hull these meshes make reaches,
//   and a flat set of points cooks no hull at all - it answers nothing).
// - A ray whose origin is inside a box or a convex hull does not hit it
//   (Physics.Raycast: "Raycasts will not detect Colliders for which the
//   Raycast origin is inside the Collider"). A triangle mesh has no inside.
// - The nearest hit within maxDistance wins; its distance runs along the
//   ray's unit direction and its point is origin + direction x distance.
//
// Each collider is tested in its object's own frame: the ray's origin and
// direction taken back through the object's matrix, the direction left
// unnormalised, so a hit's parameter there IS the world distance (the map
// is affine: origin + t x direction lands on local origin + t x local
// direction).

/** The inverse of an affine column-major 4x4, or null when it is singular. */
export function invertAffine(m) {
  const a00 = m[0], a10 = m[1], a20 = m[2], a01 = m[4], a11 = m[5], a21 = m[6], a02 = m[8], a12 = m[9], a22 = m[10];
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  if (!det) return null;
  const k = 1 / det;
  // the inverse of the 3x3 block, row by row
  const i00 = c00 * k, i01 = (a02 * a21 - a01 * a22) * k, i02 = (a01 * a12 - a02 * a11) * k;
  const i10 = c01 * k, i11 = (a00 * a22 - a02 * a20) * k, i12 = (a02 * a10 - a00 * a12) * k;
  const i20 = c02 * k, i21 = (a01 * a20 - a00 * a21) * k, i22 = (a00 * a11 - a01 * a10) * k;
  const tx = m[12], ty = m[13], tz = m[14];
  return [
    i00, i10, i20, 0,
    i01, i11, i21, 0,
    i02, i12, i22, 0,
    -(i00 * tx + i01 * ty + i02 * tz), -(i10 * tx + i11 * ty + i12 * tz), -(i20 * tx + i21 * ty + i22 * tz), 1,
  ];
}

const xformPoint = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const xformDir = (m, d) => [
  m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
  m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
  m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
];

/**
 * Every collider in the scene under `root`: an active object's BoxCollider or MeshCollider that is switched on,
 * depth first in child order.
 * @param {any} root - a PrefabNode
 * @returns {{ node:any, collider:any }[]}
 */
export function collidersOf(root) {
  const out = [];
  const stack = root ? [root] : [];
  while (stack.length) {
    const n = stack.pop();
    if (!n.activeSelf) continue;
    for (const c of n.components) {
      if ((c.type === 'BoxCollider' || c.type === 'MeshCollider') && c.m_Enabled !== false) out.push({ node: n, collider: c });
    }
    for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
  }
  return out;
}

/**
 * The slab test from OUTSIDE a box: the entry distance, or null for a miss, a box behind the ray, or an origin
 * inside it.
 * @param {number[]} o @param {number[]} d - need not be unit
 * @param {number[]} min @param {number[]} max
 */
export function rayBoxEntry(o, d, min, max) {
  let tMin = -Infinity, tMax = Infinity;
  for (let a = 0; a < 3; a++) {
    if (d[a] === 0) {
      if (o[a] < min[a] || o[a] > max[a]) return null;
      continue;
    }
    let t0 = (min[a] - o[a]) / d[a], t1 = (max[a] - o[a]) / d[a];
    if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin > tMax) return null;
  }
  return tMin >= 0 ? tMin : null;
}

/** Moller-Trumbore, either face: the ray's parameter at the triangle, or null. */
function rayTriangle(o, d, p, i0, i1, i2) {
  const ax = p[i0 * 3], ay = p[i0 * 3 + 1], az = p[i0 * 3 + 2];
  const e1x = p[i1 * 3] - ax, e1y = p[i1 * 3 + 1] - ay, e1z = p[i1 * 3 + 2] - az;
  const e2x = p[i2 * 3] - ax, e2y = p[i2 * 3 + 1] - ay, e2z = p[i2 * 3 + 2] - az;
  const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det === 0) return null;
  const inv = 1 / det;
  const tx = o[0] - ax, ty = o[1] - ay, tz = o[2] - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 ? t : null;
}

/** A triangle mesh's nearest hit (either face), or null. @param {{ positions: ArrayLike<number>, indices: ArrayLike<number> }} g */
export function rayMeshEntry(o, d, g) {
  let best = null;
  const p = g.positions, ix = g.indices;
  for (let k = 0; k + 2 < ix.length; k += 3) {
    const t = rayTriangle(o, d, p, ix[k], ix[k + 1], ix[k + 2]);
    if (t != null && (best == null || t < best)) best = t;
  }
  return best;
}

/**
 * The convex hull of a point set as its faces' planes (outward normal n, n . x = d), incremental: a first
 * tetrahedron, then each point outside the hull so far replaces the faces it sees with a fan from their horizon.
 * Null for fewer than four points or a flat set (no volume - PhysX cooks no hull from it).
 * @param {ArrayLike<number>} positions - xyz triples
 * @returns {{ n:number[], d:number }[]|null}
 */
export function convexHullPlanes(positions) {
  const count = Math.floor(positions.length / 3);
  if (count < 4) return null;
  const P = (i) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) { const q = P(i); for (let a = 0; a < 3; a++) { if (q[a] < lo[a]) lo[a] = q[a]; if (q[a] > hi[a]) hi[a] = q[a]; } }
  const eps = 1e-9 * Math.max(1, hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  // the first tetrahedron: the lowest x, the farthest from it, the farthest from their line, the farthest from their plane
  let i0 = 0;
  for (let i = 1; i < count; i++) if (positions[i * 3] < positions[i0 * 3]) i0 = i;
  let i1 = -1, best = eps;
  for (let i = 0; i < count; i++) { const l = Math.hypot(...sub(P(i), P(i0))); if (l > best) { best = l; i1 = i; } }
  if (i1 < 0) return null;
  const axis = sub(P(i1), P(i0));
  let i2 = -1; best = eps;
  for (let i = 0; i < count; i++) { const l = Math.hypot(...cross(axis, sub(P(i), P(i0)))); if (l > best) { best = l; i2 = i; } }
  if (i2 < 0) return null;
  const n0 = cross(axis, sub(P(i2), P(i0)));
  let i3 = -1; best = eps * Math.hypot(...n0);
  for (let i = 0; i < count; i++) { const l = Math.abs(dot(n0, sub(P(i), P(i0)))); if (l > best) { best = l; i3 = i; } }
  if (i3 < 0) return null;
  /** @type {{ v:number[], n:number[], d:number, dead:boolean }[]} */
  const faces = [];
  const addFace = (a, b, c) => {
    const n = cross(sub(P(b), P(a)), sub(P(c), P(a)));
    const l = Math.hypot(...n) || 1;
    const u = [n[0] / l, n[1] / l, n[2] / l];
    faces.push({ v: [a, b, c], n: u, d: dot(u, P(a)), dead: false });
  };
  const tet = [i0, i1, i2, i3];
  for (const [a, b, c, o] of [[0, 1, 2, 3], [0, 3, 1, 2], [0, 2, 3, 1], [1, 3, 2, 0]]) {
    const n = cross(sub(P(tet[b]), P(tet[a])), sub(P(tet[c]), P(tet[a])));
    if (dot(n, sub(P(tet[o]), P(tet[a]))) > 0) addFace(tet[a], tet[c], tet[b]); else addFace(tet[a], tet[b], tet[c]);
  }
  for (let i = 0; i < count; i++) {
    if (i === i0 || i === i1 || i === i2 || i === i3) continue;
    const q = P(i);
    const visible = faces.filter((f) => !f.dead && dot(f.n, q) - f.d > eps);
    if (!visible.length) continue;
    const edges = new Set();
    for (const f of visible) for (let e = 0; e < 3; e++) edges.add(`${f.v[e]},${f.v[(e + 1) % 3]}`);
    const horizon = [];
    for (const f of visible) {
      for (let e = 0; e < 3; e++) {
        const a = f.v[e], b = f.v[(e + 1) % 3];
        if (!edges.has(`${b},${a}`)) horizon.push([a, b]);
      }
      f.dead = true;
    }
    for (const [a, b] of horizon) addFace(a, b, i);
  }
  return faces.filter((f) => !f.dead).map((f) => ({ n: f.n, d: f.d }));
}

/** The entry into a convex hull, or null for a miss, a hull behind the ray, or an origin inside it. */
export function rayConvexEntry(o, d, planes) {
  let tEnter = -Infinity, tExit = Infinity;
  for (const pl of planes) {
    const denom = pl.n[0] * d[0] + pl.n[1] * d[1] + pl.n[2] * d[2];
    const s = pl.n[0] * o[0] + pl.n[1] * o[1] + pl.n[2] * o[2] - pl.d;   // above zero: outside this face
    if (denom === 0) { if (s > 0) return null; continue; }
    const t = -s / denom;
    if (denom < 0) { if (t > tEnter) tEnter = t; } else if (t < tExit) tExit = t;
    if (tEnter > tExit) return null;
  }
  return tEnter >= 0 ? tEnter : null;
}

const _hulls = new WeakMap();   // mesh geometry -> its hull's planes (null: none)
/** A mesh geometry's hull, built once. */
export function hullOf(g) {
  if (!_hulls.has(g)) _hulls.set(g, convexHullPlanes(g.positions));
  return _hulls.get(g);
}

/**
 * Physics.Raycast over one prefab tree's colliders: the nearest hit, or null.
 * @param {any} root - a PrefabNode
 * @param {number[]} origin
 * @param {number[]} dir - unit
 * @param {number} maxDistance
 * @param {{ triggers?: boolean, geometry: (collider:any, node:any) => ({ positions: ArrayLike<number>, indices: ArrayLike<number> }|null) }} opts
 *   `triggers` false is QueryTriggerInteraction.Ignore; `geometry` answers a MeshCollider's mesh in its object's frame
 * @returns {{ distance:number, point:number[], node:any, collider:any }|null}
 */
export function raycastColliders(root, origin, dir, maxDistance, { triggers = true, geometry }) {
  let best = null;
  for (const { node, collider } of collidersOf(root)) {
    if (collider.m_IsTrigger && !triggers) continue;
    const inv = invertAffine(node.worldMatrix());
    if (!inv) continue;
    const o = xformPoint(inv, origin), d = xformDir(inv, dir);
    let t = null;
    if (collider.type === 'BoxCollider') {
      const c = collider.m_Center ?? { x: 0, y: 0, z: 0 }, s = collider.m_Size ?? { x: 1, y: 1, z: 1 };
      const hx = Math.abs(s.x) / 2, hy = Math.abs(s.y) / 2, hz = Math.abs(s.z) / 2;
      t = rayBoxEntry(o, d, [c.x - hx, c.y - hy, c.z - hz], [c.x + hx, c.y + hy, c.z + hz]);
    } else {
      const g = geometry(collider, node);
      if (!g) continue;
      if (collider.m_Convex) { const h = hullOf(g); t = h ? rayConvexEntry(o, d, h) : null; }
      else t = rayMeshEntry(o, d, g);
    }
    if (t != null && t <= maxDistance && (!best || t < best.distance)) best = { distance: t, node, collider };
  }
  if (!best) return null;
  return { ...best, point: [origin[0] + dir[0] * best.distance, origin[1] + dir[1] * best.distance, origin[2] + dir[2] * best.distance] };
}

/** Unity's built-in meshes a collider may name, as triangles (the Plane's 10 x 10 grid is one plane: two triangles meet it alike). */
export const BUILTIN_COLLIDER_MESHES = Object.freeze({
  Plane: Object.freeze({ positions: Object.freeze([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), indices: Object.freeze([0, 2, 1, 0, 3, 2]) }),
  Cube: Object.freeze({
    positions: Object.freeze([-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5]),
    indices: Object.freeze([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]),
  }),
});
