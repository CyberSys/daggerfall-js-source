// @ts-check
// CSA-B (2026-09-27): A UNITY PREFAB, INSTANTIATED - the node tree a mod's C#
// walks by name.
//
// Come Sail Away builds each boat by instancing a prefab (DFU's
// MeshReplacement.ImportCustomGameobject) and then walking its Transforms:
// `GetChild(i)`, `.name`, `.gameObject.activeSelf`, `SetActive`,
// `localPosition` / `localRotation` / `localScale`, `SetParent`,
// `GetComponent<T>()`, `GetComponentInChildren<T>()`. The port keeps that
// shape, so the mod's walk reads here line for line: a PrefabNode is a
// GameObject and its Transform in one (Unity keeps them one-to-one), with
// its components as the plain records tools/comeSailAwayExtract.mjs wrote
// (vendor/come-sail-away/Models/prefabs.json), each instance holding its OWN
// copy so a runtime edit (a collider's size, a renderer switched off) touches
// that boat alone.
//
// The Unity rules kept:
// - a child's world matrix is its parent's times T * R * S (the rotation a
//   unit quaternion [x, y, z, w], Unity's order);
// - `activeInHierarchy` is `activeSelf` on this node and every ancestor;
// - `getComponentInChildren` searches depth first, this node first, and
//   finds a component only on an ACTIVE node (Unity's includeInactive =
//   false); `getComponentsInChildren` the same, all of them;
// - children keep their order, and a new child goes last;
// - `transform.parent = p` (SetParent with worldPositionStays) keeps the
//   world position and rotation and re-derives the local scale the way
//   Unity's Transform.SetWorldRotationAndScale does: the local scale set to
//   one, the node's world rotation-and-scale inverted, times the one it had,
//   and the local scale read off that product's diagonal - so a node moved
//   under a scaled parent keeps its world size (the helper objects the mod
//   parents this way - a billboard, a light, a baked sail's holder - get a
//   local scale of one over the parent's) and `setParent` (SetParent(p,
//   false)) keeps the local transform as it stands.

import { multiply } from './mat4.js';
import { mat4FromQuatPosScale, quatMultiply, quatRotate } from './quat.js';

const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const ZERO3 = Object.freeze([0, 0, 0]), ONE3 = Object.freeze([1, 1, 1]);
const _rotScratch = new Float32Array(16);   // lossyScaleOf's rotation, read at once (rs3 copies it out)

export class PrefabNode {
  /**
   * @param {string} name
   * @param {{ active?: boolean, layer?: number, tag?: number, position?: number[], rotation?: number[], scale?: number[], components?: any[] }} [o]
   */
  constructor(name, { active = true, layer = 0, tag = 0, position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], components = [] } = {}) {
    this.name = name;
    this.activeSelf = active;
    this.layer = layer;
    this.tag = tag;
    this.localPosition = [...position];
    this.localRotation = [...rotation];
    this.localScale = [...scale];
    /** @type {any[]} */
    this.components = components;
    /** @type {PrefabNode|null} */
    this.parent = null;
    /** @type {PrefabNode[]} */
    this.children = [];
    /** @type {PrefabNode|null} the root of the prefab instance this node came from (instantiatePrefab) */
    this.prefabRoot = null;
    /** @type {Map<string, PrefabNode>|null} on an instance's root: its nodes by prefab path */
    this.prefabPaths = null;
  }

  get childCount() { return this.children.length; }
  getChild(i) { return this.children[i]; }

  /** Unity's SetParent(parent, false): the local transform is kept as it stands. */
  setParent(parent) {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = parent;
    if (parent) parent.children.push(this);
    return this;
  }

  /** `transform.parent = parent` - Unity's SetParent(parent, worldPositionStays: true). */
  setParentKeepWorld(parent) {
    const worldPosition = this.position;
    const worldRotation = this.rotation;
    const worldRS = rs3(this.worldMatrix());
    this.setParent(parent);
    this.rotation = worldRotation;
    this.position = worldPosition;
    // Transform.SetWorldRotationAndScale
    this.localScale = [1, 1, 1];
    const m = mul3(inv3(rs3(this.worldMatrix())), worldRS);
    this.localScale = [m[0], m[4], m[8]];
    return this;
  }

  /** Transform.position: the node's origin in its root's frame; setting it moves the local position to match. */
  get position() { const m = this.worldMatrix(); return [m[12], m[13], m[14]]; }
  set position(p) { this.localPosition = this.parent ? this.parent.inverseTransformPoint(p) : [...p]; }
  /** Transform.rotation: the local rotations multiplied down from the root (scale never enters it). */
  get rotation() { return this.parent ? quatMultiply(this.parent.rotation, this.localRotation) : [...this.localRotation]; }
  set rotation(q) { this.localRotation = this.parent ? normalizeQuat(quatMultiply(quatInverse(this.parent.rotation), q)) : [...q]; }
  /** Transform.lossyScale: the world rotation undone from the world rotation-and-scale, its diagonal. */
  get lossyScale() { return this.lossyScaleOf(this.worldMatrix()); }
  /** AUDIT PRE-MERGE 0928 R5: lossyScale over the node's world matrix already in hand (a walk's), the same arithmetic. */
  lossyScaleOf(world) {
    const r = rs3(mat4FromQuatPosScale(this.rotation, ZERO3, ONE3, _rotScratch));
    const m = mul3(transpose3(r), rs3(world));
    return [m[0], m[4], m[8]];
  }
  /** Transform.InverseTransformPoint: a point in the root's frame, in this node's. */
  inverseTransformPoint(p) {
    const m = this.worldMatrix();
    const inv = inv3(rs3(m));
    const d = [p[0] - m[12], p[1] - m[13], p[2] - m[14]];
    return [inv[0] * d[0] + inv[1] * d[1] + inv[2] * d[2], inv[3] * d[0] + inv[4] * d[1] + inv[5] * d[2], inv[6] * d[0] + inv[7] * d[1] + inv[8] * d[2]];
  }
  /** Transform.InverseTransformVector: a vector in the root's frame, in this node's - its rotation and scale undone,
   *  no position. */
  inverseTransformVector(v) {
    const inv = inv3(rs3(this.worldMatrix()));
    return [inv[0] * v[0] + inv[1] * v[1] + inv[2] * v[2], inv[3] * v[0] + inv[4] * v[1] + inv[5] * v[2], inv[6] * v[0] + inv[7] * v[1] + inv[8] * v[2]];
  }
  /** Transform.forward: the node's rotation of +Z. */
  get forward() { return quatRotate(this.rotation, [0, 0, 1]); }

  setActive(v) { this.activeSelf = !!v; }
  get activeInHierarchy() {
    for (let n = /** @type {PrefabNode|null} */ (this); n; n = n.parent) if (!n.activeSelf) return false;
    return true;
  }

  /** T * R * S of this node alone. */
  localMatrix() { return mat4FromQuatPosScale(this.localRotation, this.localPosition, this.localScale); }
  /** The node's matrix in its root's frame (the root's own transform included). */
  worldMatrix() {
    const local = this.localMatrix();
    return this.parent ? multiply(this.parent.worldMatrix(), local) : local;
  }
  /** A point in the node's frame, in its root's frame. */
  transformPoint(p) {
    const m = this.worldMatrix();
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }

  getComponent(type) { return this.components.find((c) => c.type === type) ?? null; }
  getComponents(type) { return this.components.filter((c) => c.type === type); }
  addComponent(c) { this.components.push(c); return c; }

  /** Depth first, this node first; only a component on an active node (Unity's default). */
  getComponentInChildren(type) {
    return this.activeInHierarchy ? findActive(this, type) : null;
  }
  getComponentsInChildren(type, out = []) {
    if (this.activeInHierarchy) collectActive(this, type, out);
    return out;
  }

  /** The node whose slash-joined names from here are `path` ('' is this node), or null. */
  find(path) {
    if (!path) return this;
    let n = /** @type {PrefabNode|null} */ (this);
    for (const part of path.split('/')) { n = n?.children.find((c) => c.name === part) ?? null; if (!n) return null; }
    return n;
  }
  /** This node's path from `root` (Unity's AnimationUtility path: the root's own name not included). */
  pathFrom(root) {
    const parts = [];
    for (let n = /** @type {PrefabNode|null} */ (this); n && n !== root; n = n.parent) parts.unshift(n.name);
    return parts.join('/');
  }
  /** Every node of the subtree, depth first, this one first. */
  *walk() { yield this; for (const ch of this.children) yield* ch.walk(); }
}

/** GetComponentInChildren below a node already known active: an inactive child and all under it are passed over. */
function findActive(n, type) {
  const own = n.getComponent(type);
  if (own) return own;
  for (const ch of n.children) {
    if (!ch.activeSelf) continue;
    const found = findActive(ch, type);
    if (found) return found;
  }
  return null;
}
function collectActive(n, type, out) {
  out.push(...n.getComponents(type));
  for (const ch of n.children) if (ch.activeSelf) collectActive(ch, type, out);
}

// 3x3 matrices row by row: [m00 m01 m02 m10 m11 m12 m20 m21 m22].
/** The rotation-and-scale block of a column-major 4x4. */
const rs3 = (m) => [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
const mul3 = (a, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
};
const transpose3 = (a) => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
function inv3(a) {
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = a;
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  if (!det) return [0, 0, 0, 0, 0, 0, 0, 0, 0];   // Matrix3x3f::Invert of a singular matrix: the port answers zero, never NaN
  const k = 1 / det;
  return [
    c00 * k, (a02 * a21 - a01 * a22) * k, (a01 * a12 - a02 * a11) * k,
    c01 * k, (a00 * a22 - a02 * a20) * k, (a02 * a10 - a00 * a12) * k,
    c02 * k, (a01 * a20 - a00 * a21) * k, (a00 * a11 - a01 * a10) * k,
  ];
}
const quatInverse = (q) => { const n = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3] || 1; return [-q[0] / n, -q[1] / n, -q[2] / n, q[3] / n]; };
const normalizeQuat = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };

/** A deep copy of a component record, so an instance's edits are its own. */
const copy = (c) => (c && typeof c === 'object' ? JSON.parse(JSON.stringify(c)) : c);

/**
 * A prefab's tree (prefabs.json's `prefabs[id]`) as PrefabNodes, each
 * component its own copy of the shared record it indexes.
 * @param {{ name:string, active:boolean, layer:number, tag:number, position:number[], rotation:number[], scale:number[], components:number[], children:any[] }} tree
 * @param {any[]} components the shared table
 */
export function instantiatePrefab(tree, components) {
  /** @type {Map<string, PrefabNode>} */
  const byPath = new Map();
  const build = (t, path) => {
    const node = new PrefabNode(t.name, {
      active: t.active, layer: t.layer, tag: t.tag, position: t.position, rotation: t.rotation, scale: t.scale,
      components: t.components.map((i) => copy(components[i])),
    });
    if (!byPath.has(path)) byPath.set(path, node);   // Transform.Find's first match (no pointer in the files names a shared path - pinned)
    for (const ch of t.children) build(ch, `${path}/${ch.name}`).setParent(node);
    return node;
  };
  const root = build(tree, tree.name);
  for (const n of root.walk()) n.prefabRoot = root;
  root.prefabPaths = byPath;
  return root;
}

/**
 * A component's `{ node: path }` pointer (a bone, a root bone, a sub-emitter's
 * owner) as the node of `node`'s own instance it names - the path is the
 * prefab's, from its root's prefab name, so a renamed root still answers.
 */
export function resolveNodePointer(node, pointer) {
  if (!pointer || typeof pointer.node !== 'string') return null;
  return node.prefabRoot?.prefabPaths?.get(pointer.node) ?? null;
}

export const IDENTITY_MATRIX = IDENTITY;
