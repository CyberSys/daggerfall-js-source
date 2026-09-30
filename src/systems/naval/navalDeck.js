// @ts-check
// DECK-WALK (2026-09-29, Mac: "There's an issue where enemies/allys can navigate on the railing of ships") - A SHIP'S
// WALKABLE DECK, read off her own colliders: where a body may stand, walk and be put.
//
// WHY THEY WALKED THE RAIL. A hull's collider is its whole visual mesh, and a Come Sail Away bulwark is a ramp: the
// Galleon's rises 43-49 degrees from 0.41 m over her 6.77 m deck to a rail top at 7.7, the Carrack's 50-56 degrees
// from the deck itself - every face under the capsule's SLOPE_LIMIT_DEG 70 (motor.js), so every one of them is floor
// to the collider's one-way rule, and a 1.8 m capsule driven into it climbed the rail and walked off it into the sea;
// the enemy motor's own obstacle probe reads a ramp as climbable. Nothing told a body where the deck was: the
// boarding's spots were blind rays over the hull's box (one of the Galleon's sixteen stood on her outer bow at 5.21
// m, others on her lower deck and in the Carrack's hold).
//
// THE DECK. A hull's triangles in her own frame, rasterised on a DECK_CELL grid over her extent: every surface under
// each cell's centre, and of those the FLOORS - a face within DECK_FLAT of level, with DECK_HEADROOM clear above it
// to the next surface (a boom, a yard, a quarterdeck's underside) and no wall through the cell rising off it (a mast,
// a gun's side, a cabin's: a wall's footprint marks every cell its edges cross, never only a centre it happens to
// cover). The deck is the floors that join the MAIN DECK (the level most of her floor stands at) cell to cell within
// DECK_STEP (a stair's tread) - so a rail's top, a mast's cap and a spar are no deck, however flat - kept DECK_INSET
// cells off every edge (the rail, a hatch), and of that her OPEN deck alone: the largest piece a walk joins (measured:
// the Small Ship's poop cabin and the Carrack's rooms under her half deck are pieces walled off from it). What it
// answers: whether a point is deck (`walkable`), the deck point nearest any point (`clamp` - a body pushed off it is
// put back on its edge; `nearest`, the cell's centre), well-spread spots to stand a muster on (`spots`), and a walk
// across it (`path`, A* cell to cell within DECK_STEP, the corners cut where the straight line is deck).
// AUDIT NAV2 F32: kept off her walls and her open side only, never off a bench (the Large Boat's midship thwarts, 0.6
// to 0.72 m: the inset took 18 of the 30 cells between them and left her 12, the Pirate Sloop's and the Coasting
// Trader's whole deck), and not kept off at all where that would take more than half her deck (the Rowboat's 4 of 13).
//
// ITS FRAME is her mesh node's (Boat.MeshObject - every collider of every hull hangs under it), baked at rest: the swell
// rolls and pitches that node, never her root, so a point goes into the deck through the node's live world matrix
// (`intoDeck`) and out of it the same way (`outOfDeck`). ONE LEVEL A CELL - the main deck's: where a covered deck
// stands under another (the Small Ship's at 3.64 m under her main deck at 6.77, the Carrack's 6.7 m half deck over
// hers at 3.64) the main deck is the one kept, the other no deck.
// AUDIT NAV2 F34: EVERY LEVEL A CELL HOLDS, AT HER MAIN DECK OR OVER IT - one level a cell cut the Small Ship's
// forecastle stair at 8.55 (the cells under its upper treads were her main deck beneath them), and the leash dragged a
// body on her forecastle 2.5 m down, one on her poop 3.2 m down and 4.3 m across: a player there was out of every
// boarder's reach. Her floors join cell to cell within DECK_JOIN, the motors' own step; her open deck is the grid's own
// `y`, its highest floor a cell (a stair's tread over the deck it climbs from), and every other piece is baked beside
// it (`more`: her poop, her cabins, the room under her forecastle - `heightAt`, `pieceAt` and `clamp` answer per
// piece), so a body stays on the piece it stands on. Under her main deck (her lower deck, her hold, a galley's rowers)
// nothing is deck. And every floor of hers whatever its level (`floors`) is what standing aboard her is (`under`).

import { STEP_OFFSET } from '../../player/motor.js';   // AUDIT NAV2 F34: the motors' own step

export const DECK_CELL = 0.5;
export const DECK_FLAT = Math.cos(30 * Math.PI / 180);
export const DECK_HEADROOM = 1.7;
export const DECK_STEP = 0.4;
export const DECK_INSET = 1;
/** AUDIT NAV2 F34: the most a walk climbs cell to cell - the motors' own step (a stair's riser, a coaming), and the
 *  join between two of her floors. */
export const DECK_JOIN = STEP_OFFSET;
/** AUDIT NAV2 F32: a bench's top over the floor it stands on (m) - a seat, under a body's hip (the Large Boat's
 *  thwarts stand 0.6 to 0.72 m): a deck is kept off her walls and her open side, never off one. */
export const DECK_BENCH = 0.9;
/** The level histogram's bin (m) the main deck is read off. */
const LEVEL_BIN = 0.25;
/** A near-vertical face (|n.y| under this share of its length) has no height at a point: a wall, a mast's side. */
const WALL_NY = 0.05;

/**
 * A world point into a deck's frame: through the inverse of her mesh node's world matrix `m` (column-major, affine),
 * written into `out` - no matrix made.
 * @param {ArrayLike<number>} m @param {ArrayLike<number>} p @param {number[]} [out]
 */
export function intoDeck(m, p, out = [0, 0, 0]) {
  const a00 = m[0], a10 = m[1], a20 = m[2], a01 = m[4], a11 = m[5], a21 = m[6], a02 = m[8], a12 = m[9], a22 = m[10];
  const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  const k = det ? 1 / det : 0;
  const x = p[0] - m[12], y = p[1] - m[13], z = p[2] - m[14];
  out[0] = (c00 * x + (a02 * a21 - a01 * a22) * y + (a01 * a12 - a02 * a11) * z) * k;
  out[1] = (c01 * x + (a00 * a22 - a02 * a20) * y + (a02 * a10 - a00 * a12) * z) * k;
  out[2] = (c02 * x + (a01 * a20 - a00 * a21) * y + (a00 * a11 - a01 * a10) * z) * k;
  return out;
}

/**
 * A deck point out to the world through her mesh node's world matrix `m`, written into `out`.
 * @param {ArrayLike<number>} m @param {ArrayLike<number>} q @param {number[]} [out]
 */
export function outOfDeck(m, q, out = [0, 0, 0]) {
  const x = q[0], y = q[1], z = q[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

/**
 * The deck of a hull.
 * @param {{ positions: ArrayLike<number>, indices: ArrayLike<number> }[]} meshes - triangles in the hull's own frame
 * @param {{ minX: number, maxX: number, minZ: number, maxZ: number }} extent
 * @param {{ cell?: number, inset?: number }} [opts]
 */
export function buildDeck(meshes, extent, { cell = DECK_CELL, inset = DECK_INSET } = {}) {
  const nx = Math.max(1, Math.ceil((extent.maxX - extent.minX) / cell));
  const nz = Math.max(1, Math.ceil((extent.maxZ - extent.minZ) / cell));
  const minX = extent.minX, minZ = extent.minZ;
  /** @type {number[][]} every surface's height under each cell's centre */
  const surf = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} of those, the flat ones' */
  const flat = Array.from({ length: nx * nz }, () => []);
  /** @type {number[][]} every wall's [bottom, top] through each cell, flattened - a near-vertical face has no height at
   *  a point, so its footprint marks every cell its edges cross (a mast's 0.4 m between two cells' centres, a cabin's
   *  side) with its whole height */
  const walls = Array.from({ length: nx * nz }, () => []);
  const wallEdge = (x0, z0, x1, z1, lo, hi) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (cell * 0.25)));
    let last = -1;
    for (let q = 0; q <= n; q++) {
      const i = Math.floor((x0 + (x1 - x0) * q / n - minX) / cell), k = Math.floor((z0 + (z1 - z0) * q / n - minZ) / cell);
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      const j = k * nx + i;
      if (j !== last) { walls[j].push(lo, hi); last = j; }
    }
  };
  for (const m of meshes) {
    const p = m.positions, ix = m.indices;
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ax = p[a], ay = p[a + 1], az = p[a + 2], bx = p[b], by = p[b + 1], bz = p[b + 2], cx = p[c], cy = p[c + 1], cz = p[c + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
      const len = Math.hypot(nX, nY, nZ);
      if (!(len > 1e-12)) continue;
      if (Math.abs(nY) < WALL_NY * len) {
        const lo = Math.min(ay, by, cy), hi = Math.max(ay, by, cy);
        wallEdge(ax, az, bx, bz, lo, hi); wallEdge(bx, bz, cx, cz, lo, hi); wallEdge(cx, cz, ax, az, lo, hi);
        continue;
      }
      const isFlat = Math.abs(nY) >= DECK_FLAT * len;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell - 0.5)), i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - minX) / cell - 0.5));
      const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / cell - 0.5)), k1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz, cz) - minZ) / cell - 0.5));
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-12) continue;
      for (let k = k0; k <= k1; k++) {
        const z = minZ + (k + 0.5) * cell;
        for (let i = i0; i <= i1; i++) {
          const x = minX + (i + 0.5) * cell;
          const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
          const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
          const y = l1 * ay + l2 * by + l3 * cy;
          surf[k * nx + i].push(y);
          if (isFlat) flat[k * nx + i].push(y);
        }
      }
    }
  }
  // each cell's candidate floors: a flat face with DECK_HEADROOM clear to the next surface above it, and no wall in the
  // cell rising more than a tread off it within a head's height (a coaming, a stair's riser, the hull's side below are
  // no wall to it)
  /** @type {number[][]} */
  const cand = surf.map((all, j) => {
    const out = [];
    const w = walls[j];
    for (const y of flat[j]) {
      let clear = true;
      for (const o of all) if (o > y + 1e-3 && o < y + DECK_HEADROOM) { clear = false; break; }
      for (let q = 0; clear && q < w.length; q += 2) if (w[q + 1] > y + DECK_STEP && w[q] < y + DECK_HEADROOM) clear = false;
      if (clear && !out.some((q) => Math.abs(q - y) < 1e-3)) out.push(y);
    }
    return out.sort((q, r) => r - q);
  });
  // the main deck: the level most floors stand at
  const bins = new Map();
  for (const c of cand) for (const y of c) { const b = Math.round(y / LEVEL_BIN); bins.set(b, (bins.get(b) ?? 0) + 1); }
  let mainBin = null, most = 0;
  for (const [b, n] of bins) if (n > most || (n === most && mainBin != null && b > mainBin)) { most = n; mainBin = b; }
  const N = nx * nz;
  const y = new Float32Array(N).fill(NaN);
  if (mainBin == null) return deckOf({ cell, minX, minZ, nx, nz, y });
  const main = mainBin * LEVEL_BIN;
  // AUDIT NAV2 F34: every floor at her main deck or over it a node, as many a cell as stand in it (a floor keeps a
  // head's room over it, so no two in one cell lie within a step of each other) - `lv` their levels, a cell's from `at`
  const at = new Int32Array(N + 1), lv = [];
  for (let j = 0; j < N; j++) { at[j] = lv.length; for (let q = cand[j].length - 1; q >= 0; q--) if (cand[j][q] >= main - LEVEL_BIN) lv.push(cand[j][q]); }
  at[N] = lv.length;
  const M = lv.length, nodeCell = new Int32Array(M);
  for (let j = 0; j < N; j++) for (let a = at[j]; a < at[j + 1]; a++) nodeCell[a] = j;
  /** The live node of cell `c` a step of the motors' from `h` (DECK_JOIN), -1 for none. */
  const joined = (c, h, live) => { for (let a = at[c]; a < at[c + 1]; a++) if (live[a] && Math.abs(lv[a] - h) <= DECK_JOIN) return a; return -1; };
  /** AUDIT NAV2 F32: whether cell `c` beside a floor at `h` holds a bench - her floor running on under it, and
   *  everything over that floor within a head's room a plank's face or its edge, between a step and DECK_BENCH over it
   *  (the Large Boat's thwarts) - never a wall standing on the floor (a crate's side, a mast, a cabin's), nor her side's
   *  ramp. */
  const bench = (c, h) => {
    let floor = NaN;
    for (const q of flat[c]) if (Math.abs(q - h) <= DECK_STEP && !(Math.abs(floor - h) <= Math.abs(q - h))) floor = q;
    if (Number.isNaN(floor)) return false;
    let seat = false;
    for (const s of surf[c]) {
      if (!(s > floor + 1e-3 && s < floor + DECK_HEADROOM)) continue;
      if (s <= floor + DECK_STEP || s > floor + DECK_BENCH || !flat[c].includes(s)) return false;
      seat = true;
    }
    const w = walls[c];
    for (let q = 0; q < w.length; q += 2) {
      if (!(w[q + 1] > floor + DECK_STEP && w[q] < floor + DECK_HEADROOM)) continue;
      if (w[q] <= floor + DECK_STEP || w[q + 1] > floor + DECK_BENCH) return false;
      seat = true;
    }
    return seat;
  };
  /** Her nodes kept `passes` cells off every edge and pieced: `live`, each one's `piece`, the largest the `open` one. */
  const settle = (passes) => {
    const live = new Uint8Array(M).fill(1);
    // kept off every edge - AUDIT NAV2 F32: of her walls and her open side, never of a bench
    for (let pass = 0; pass < passes; pass++) {
      const edge = [];
      for (let a = 0; a < M; a++) {
        if (!live[a]) continue;
        const j = nodeCell[a], i = j % nx, k = (j - i) / nx, h = lv[a];
        const off = (ii, kk) => ii < 0 || kk < 0 || ii >= nx || kk >= nz || (joined(kk * nx + ii, h, live) < 0 && !bench(kk * nx + ii, h));
        if (off(i - 1, k) || off(i + 1, k) || off(i, k - 1) || off(i, k + 1)) edge.push(a);
      }
      for (const a of edge) live[a] = 0;
    }
    // her pieces: the floors a walk's own steps join (`path`'s: within DECK_JOIN, no corner cut past an edge) - a cabin
    // under her poop or half deck, a passage walled off, is no open deck to stand a muster on or walk
    const piece = new Int32Array(M).fill(-1), sizes = [];
    for (let a0 = 0; a0 < M; a0++) {
      if (!live[a0] || piece[a0] >= 0) continue;
      const id = sizes.length, queue = [a0];
      piece[a0] = id;
      for (let q = 0; q < queue.length; q++) {
        const a = queue[q], j = nodeCell[a], i = j % nx, k = (j - i) / nx, h = lv[a];
        for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
          if (!di && !dk) continue;
          const ii = i + di, kk = k + dk;
          if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
          const b = joined(kk * nx + ii, h, live);
          if (b < 0 || piece[b] >= 0) continue;
          if (di && dk && (joined(k * nx + ii, h, live) < 0 || joined(kk * nx + i, h, live) < 0)) continue;
          piece[b] = id;
          queue.push(b);
        }
      }
      sizes.push(queue.length);
    }
    let open = -1;
    for (let p = 0; p < sizes.length; p++) if (open < 0 || sizes[p] > sizes[open]) open = p;
    return { live, piece, open, count: open < 0 ? 0 : sizes[open] };
  };
  // AUDIT NAV2 F32: kept off her edges while that leaves her the half of her open deck (the Rowboat's lost 9 of 13)
  let s = settle(inset);
  if (inset > 0) { const bare = settle(0); if (s.count * 2 < bare.count) s = bare; }
  // her open deck the grid's own, its highest floor a cell (a stair's tread over the deck it climbs from); AUDIT NAV2
  // F34: every other floor kept beside it with its piece - 0 her open deck's (the deck under her stair), from 1 her
  // others (her poop, her cabins, the room under her forecastle)
  const top = new Int32Array(N).fill(-1);
  for (let a = 0; a < M; a++) if (s.live[a] && s.piece[a] === s.open) { y[nodeCell[a]] = lv[a]; top[nodeCell[a]] = a; }
  const moreAt = new Int32Array(N + 1), moreY = [], morePiece = [], ids = new Map();
  for (let j = 0; j < N; j++) {
    moreAt[j] = moreY.length;
    for (let a = at[j]; a < at[j + 1]; a++) {
      if (!s.live[a] || a === top[j]) continue;
      let p = 0;
      if (s.piece[a] !== s.open) { p = ids.get(s.piece[a]) ?? ids.size + 1; ids.set(s.piece[a], p); }
      moreY.push(lv[a]); morePiece.push(p);
    }
  }
  moreAt[N] = moreY.length;
  // AUDIT NAV2 F36: and every floor of hers whatever its level (her lower deck, her hold, her rowers', a rail's top)
  const floorAt = new Int32Array(N + 1), floorY = [];
  for (let j = 0; j < N; j++) { floorAt[j] = floorY.length; for (const q of cand[j]) floorY.push(q); }
  floorAt[N] = floorY.length;
  return deckOf({ cell, minX, minZ, nx, nz, y, more: { at: moreAt, y: Float32Array.from(moreY), piece: Int32Array.from(morePiece) }, floors: { at: floorAt, y: Float32Array.from(floorY) } });
}

const NO_SPOTS = Object.freeze([]);

/**
 * The deck's questions over a built grid (`buildDeck`'s, or one restored). AUDIT NAV2 F34: `more`, her floors other
 * than her open deck's own a cell (a cell's from `at`, each its `piece` - 0 her open deck, from 1 her others), and F36
 * `floors`, every floor of hers at any level - neither in a grid made of `y` alone.
 * @param {{ cell: number, minX: number, minZ: number, nx: number, nz: number, y: Float32Array,
 *   more?: { at: Int32Array, y: Float32Array, piece: Int32Array } | null, floors?: { at: Int32Array, y: Float32Array } | null }} g
 */
export function deckOf(g) {
  const { cell, minX, minZ, nx, nz, y } = g;
  const more = g.more ?? null, floors = g.floors ?? null;
  const cellOf = (x, z) => {
    const i = Math.floor((x - minX) / cell), k = Math.floor((z - minZ) / cell);
    return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i;
  };
  const centre = (j) => { const i = j % nx, k = (j - i) / nx; return [minX + (i + 0.5) * cell, y[j], minZ + (k + 0.5) * cell]; };
  /** AUDIT NAV2 F34: piece `p`'s floor in cell `j` - her open deck's own (0), else one of `more` - or NaN. */
  const levelOf = (j, p) => {
    if (p <= 0) return y[j];
    if (more) for (let n = more.at[j]; n < more.at[j + 1]; n++) if (more.piece[n] === p) return more.y[n];
    return NaN;
  };
  let pieces = 1;
  if (more) for (let n = 0; n < more.piece.length; n++) if (more.piece[n] >= pieces) pieces = more.piece[n] + 1;
  /** The deck cell whose square lies nearest `(x, z)`, -1 for none: rings out from the point's own cell (clamped onto
   *  the grid), stopping once no farther ring can hold a nearer square - ring r + 1 lies r cells off at the least.
   *  AUDIT NAV2 F34: a cell of piece `ringPiece`'s (her open deck's, 0, unless asked). */
  let ringBest = -1, ringD = Infinity, qx = 0, qz = 0, ringPiece = 0;
  const visit = (i, k) => {
    if (i < 0 || k < 0 || i >= nx || k >= nz) return;
    const j = k * nx + i;
    if (Number.isNaN(ringPiece ? levelOf(j, ringPiece) : y[j])) return;
    const x0 = minX + i * cell, z0 = minZ + k * cell;
    const dx = qx < x0 ? x0 - qx : qx > x0 + cell ? qx - x0 - cell : 0;
    const dz = qz < z0 ? z0 - qz : qz > z0 + cell ? qz - z0 - cell : 0;
    const d = dx * dx + dz * dz;
    if (d < ringD) { ringD = d; ringBest = j; }
  };
  const nearestCell = (x, z, p = 0) => {
    if (!count || p >= pieces) return -1;
    ringBest = -1; ringD = Infinity; qx = x; qz = z; ringPiece = p > 0 ? p : 0;
    const ci = Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cell)));
    const ck = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cell)));
    const far = Math.max(ci, nx - 1 - ci, ck, nz - 1 - ck);
    for (let r = 0; r <= far; r++) {
      for (let k = ck - r; k <= ck + r; k++) {
        if (k === ck - r || k === ck + r) for (let i = ci - r; i <= ci + r; i++) visit(i, k);
        else { visit(ci - r, k); visit(ci + r, k); }
      }
      if (ringBest >= 0 && ringD <= (r * cell) ** 2) break;
    }
    return ringBest;
  };
  /** Whether the straight line from `p0` to `p1` stays on deck: every cell it crosses (a grid walk, never samples - a
   *  sample steps over the corner two blocked cells share), and at a corner it passes through both cells beside it too
   *  (the walk's own corner rule), stepping no more than DECK_JOIN from one cell to the next. */
  const lineOnDeck = (p0, p1) => {
    let i = Math.floor((p0[0] - minX) / cell), k = Math.floor((p0[2] - minZ) / cell);
    const i1 = Math.floor((p1[0] - minX) / cell), k1 = Math.floor((p1[2] - minZ) / cell);
    if (i < 0 || k < 0 || i >= nx || k >= nz || Number.isNaN(y[k * nx + i])) return false;
    const dx = p1[0] - p0[0], dz = p1[2] - p0[2], si = Math.sign(dx), sk = Math.sign(dz);
    const tdx = si ? cell / Math.abs(dx) : Infinity, tdz = sk ? cell / Math.abs(dz) : Infinity;
    let tx = si ? (minX + (si > 0 ? i + 1 : i) * cell - p0[0]) / dx : Infinity;
    let tz = sk ? (minZ + (sk > 0 ? k + 1 : k) * cell - p0[2]) / dz : Infinity;
    let was = y[k * nx + i];
    const on = (ii, kk) => ii >= 0 && kk >= 0 && ii < nx && kk < nz && !Number.isNaN(y[kk * nx + ii]) && Math.abs(y[kk * nx + ii] - was) <= DECK_JOIN;
    for (let n = Math.abs(i1 - i) + Math.abs(k1 - k); (i !== i1 || k !== k1) && n >= 0; n--) {
      if (Math.abs(tx - tz) < 1e-9) {   // through a corner
        if (!on(i + si, k) || !on(i, k + sk)) return false;
        i += si; k += sk; tx += tdx; tz += tdz;
      } else if (tx < tz) { i += si; tx += tdx; } else { k += sk; tz += tdz; }
      if (!on(i, k)) return false;
      was = y[k * nx + i];
    }
    return i === i1 && k === k1;
  };
  // the walk's scratch, made once a deck: a cell's cost and step back are this walk's while `seen` holds its stamp
  const cost = new Float64Array(y.length), from = new Int32Array(y.length), seen = new Uint32Array(y.length), shut = new Uint32Array(y.length);
  const heapF = [], heapJ = [];
  let stamp = 0;
  const heapPush = (f, j) => {
    let n = heapF.length;
    heapF.push(f); heapJ.push(j);
    while (n > 0) {
      const up = (n - 1) >> 1;
      if (heapF[up] <= f) break;
      heapF[n] = heapF[up]; heapJ[n] = heapJ[up]; n = up;
    }
    heapF[n] = f; heapJ[n] = j;
  };
  const heapPop = () => {
    const top = heapJ[0], lastF = heapF.pop(), lastJ = heapJ.pop();
    const len = heapF.length;
    if (len) {
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1;
        let m = n, mf = lastF;
        if (l < len && heapF[l] < mf) { m = l; mf = heapF[l]; }
        if (r < len && heapF[r] < mf) { m = r; mf = heapF[r]; }
        if (m === n) break;
        heapF[n] = heapF[m]; heapJ[n] = heapJ[m]; n = m;
      }
      heapF[n] = lastF; heapJ[n] = lastJ;
    }
    return top;
  };
  let count = 0, sx = 0, sz = 0;
  for (let j = 0; j < y.length; j++) if (!Number.isNaN(y[j])) { count++; const c = centre(j); sx += c[0]; sz += c[2]; }
  /** AUDIT NAV2 F58: the spots made, a count's once (frozen); her cells' centres laid out once for them. */
  const spotsMade = new Map();
  let spotCells = null, spotX = null, spotZ = null;
  const deck = {
    ...g,
    /** How many cells are deck. */
    count,
    /** Whether `(x, z)` (her frame) stands on deck. */
    walkable(x, z) { const j = cellOf(x, z); return j >= 0 && !Number.isNaN(y[j]); },
    /** The deck's height under `(x, z)`, or NaN off it. AUDIT NAV2 F34: of every piece's floors there the one nearest
     *  `h` when it is asked (a body's own height - her deck under her stair, the tread over it, her poop over her
     *  cabin); her open deck's own when it is not.
     *  @param {number} x @param {number} z @param {number} [h] */
    heightAt(x, z, h) {
      const j = cellOf(x, z);
      if (j < 0) return NaN;
      if (h == null || !more) return y[j];
      let best = y[j], d = Number.isNaN(best) ? Infinity : Math.abs(best - h);
      for (let n = more.at[j]; n < more.at[j + 1]; n++) { const e = Math.abs(more.y[n] - h); if (e < d) { d = e; best = more.y[n]; } }
      return best;
    },
    /** AUDIT NAV2 F34: the piece whose floor under `(x, z)` stands nearest `h` - 0 her open deck, from 1 her others (her
     *  poop, a cabin) - or -1 off every floor of hers there. @param {number} x @param {number} z @param {number} h */
    pieceAt(x, z, h) {
      const j = cellOf(x, z);
      if (j < 0) return -1;
      let best = Number.isNaN(y[j]) ? -1 : 0, d = best < 0 ? Infinity : Math.abs(y[j] - h);
      if (more) for (let n = more.at[j]; n < more.at[j + 1]; n++) { const e = Math.abs(more.y[n] - h); if (e < d) { d = e; best = more.piece[n]; } }
      return best;
    },
    /**
     * AUDIT NAV2 F36: whether a floor of hers - any, at any level: her decks, her hold, a galley's rowers', a rail's top
     * - stands under a point: within `reach` of `(x, z)` (her frame), no more than a step over `h` and no more than a
     * head's room under it (feet up on her rail, a gun, a crate). Standing aboard her.
     * @param {number} x @param {number} z @param {number} h @param {number} [reach]
     */
    under(x, z, h, reach = 0) {
      const r = Math.ceil(reach / cell), ci = Math.floor((x - minX) / cell), ck = Math.floor((z - minZ) / cell);
      const lo = h - DECK_HEADROOM, hi = h + DECK_STEP, rr = reach * reach;
      for (let k = Math.max(0, ck - r); k <= Math.min(nz - 1, ck + r); k++) {
        for (let i = Math.max(0, ci - r); i <= Math.min(nx - 1, ci + r); i++) {
          const x0 = minX + i * cell, z0 = minZ + k * cell;
          const dx = x < x0 ? x0 - x : x > x0 + cell ? x - x0 - cell : 0, dz = z < z0 ? z0 - z : z > z0 + cell ? z - z0 - cell : 0;
          if (dx * dx + dz * dz > rr) continue;
          const j = k * nx + i;
          if (floors) { for (let n = floors.at[j]; n < floors.at[j + 1]; n++) if (floors.y[n] >= lo && floors.y[n] <= hi) return true; continue; }
          if (y[j] >= lo && y[j] <= hi) return true;
          if (more) for (let n = more.at[j]; n < more.at[j + 1]; n++) if (more.y[n] >= lo && more.y[n] <= hi) return true;
        }
      }
      return false;
    },
    /** The centre of the deck cell nearest `(x, z)` - `[x, y, z]` in her frame - or null for a hull with no deck. */
    nearest(x, z) {
      const j = nearestCell(x, z);
      return j < 0 ? null : centre(j);
    },
    /**
     * The deck point nearest `(x, z)` - the point itself on deck, else the nearest point of the nearest cell's square,
     * a hair inside it - `[x, y, z]` in her frame, written into `out`; null for a hull with no deck. A body pushed off
     * her deck is put back on its edge, sliding along it as it presses, never snapped to a cell's centre. AUDIT NAV2
     * F34: of `piece` - her open deck (0) unless another is asked (the one a body stood on: her poop, a cabin).
     * @param {number} x @param {number} z @param {number[]} [out] @param {number} [piece]
     */
    clamp(x, z, out = [0, 0, 0], piece = 0) {
      const j = nearestCell(x, z, piece);
      if (j < 0) return null;
      const i = j % nx, k = (j - i) / nx, e = cell * 1e-3;
      const x0 = minX + i * cell, z0 = minZ + k * cell;
      out[0] = Math.min(x0 + cell - e, Math.max(x0 + e, x));
      out[1] = piece > 0 ? levelOf(j, piece) : y[j];
      out[2] = Math.min(z0 + cell - e, Math.max(z0 + e, z));
      return out;
    },
    /**
     * Her rail's deck point on `side` (+1 her starboard, her frame's +x; -1 port) at `z`: the outermost deck cell of the
     * row there - or of the nearest row with deck - `[x, y, z]` its centre, into `out`; null for a hull with no deck.
     * (The deck point nearest a point far abeam is her widest cell whatever `z` is asked - a tapered hull's rail is no
     * clamp's.)
     * @param {number} side @param {number} z @param {number[]} [out]
     */
    rail(side, z, out = [0, 0, 0]) {
      if (!count) return null;
      const k0 = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cell)));
      for (let r = 0; r < nz; r++) {
        for (let pass = 0; pass < (r ? 2 : 1); pass++) {
          const k = pass ? k0 + r : k0 - r;
          if (k < 0 || k >= nz) continue;
          for (let n = 0; n < nx; n++) {
            const i = side > 0 ? nx - 1 - n : n, j = k * nx + i;
            if (Number.isNaN(y[j])) continue;
            out[0] = minX + (i + 0.5) * cell; out[1] = y[j]; out[2] = minZ + (k + 0.5) * cell;
            return out;
          }
        }
      }
      return null;
    },
    /** `n` spots spread across the deck - farthest-point sampling from the cell nearest her middle - `[x, y, z]`.
     *  AUDIT NAV2 F58: made once a count and kept, frozen, the spots too (every caller reads or copies them - world.js
     *  navalDeckSpots, crewLife.js), each pass's distances off her cells' centres laid out once in Float64Arrays (the
     *  float32 a Float32Array rounds to would break a tie another way than the fresh sampling's): a centre made a cell a
     *  pass was the Large Galley's spots(24) 1.3 ms and 3.7 MB, every crew stood and every boarding. */
    spots(n) {
      if (!count || n <= 0) return NO_SPOTS;
      let made = spotsMade.get(n);
      if (made) return made;
      if (!spotCells) {
        spotCells = new Int32Array(count); spotX = new Float64Array(count); spotZ = new Float64Array(count);
        for (let j = 0, q = 0; j < y.length; j++) {
          if (Number.isNaN(y[j])) continue;
          const i = j % nx, k = (j - i) / nx;
          spotCells[q] = j; spotX[q] = minX + (i + 0.5) * cell; spotZ[q] = minZ + (k + 0.5) * cell; q++;
        }
      }
      const out = [Object.freeze(deck.nearest(sx / count, sz / count))];
      const far = new Float64Array(count).fill(Infinity);
      while (out.length < Math.min(n, count)) {
        const last = out[out.length - 1], lx = last[0], lz = last[2];
        let best = -1, bestD = -1;
        for (let q = 0; q < count; q++) {
          const dx = spotX[q] - lx, dz = spotZ[q] - lz, d = dx * dx + dz * dz;
          if (d < far[q]) far[q] = d;
          if (far[q] > bestD) { bestD = far[q]; best = q; }
        }
        if (bestD <= 0) break;
        out.push(Object.freeze(centre(spotCells[best])));
      }
      made = Object.freeze(out);
      spotsMade.set(n, made);
      return made;
    },
    /**
     * A walk from `a` to `b` (her frame, `[x, z]`): the deck cells' centres from the one nearest `a` to the one nearest
     * `b`, cell to cell within DECK_JOIN (AUDIT NAV2 F34: the motors' own step - up her stair onto her forecastle), the
     * corners cut where the straight line between two stays on deck; null when no walk joins them.
     */
    path(a, b) {
      const s = deck.nearest(a[0], a[1]), e = deck.nearest(b[0], b[1]);
      if (!s || !e) return null;
      const js = cellOf(s[0], s[2]), je = cellOf(e[0], e[2]);
      stamp = (stamp + 1) >>> 0 || 1;
      if (stamp === 1) { seen.fill(0); shut.fill(0); }
      heapF.length = 0; heapJ.length = 0;
      const ex = e[0], ez = e[2];
      // AUDIT NAV2 F61: the straight line home a square root of its own - Math.hypot's care for overflow is 1.6x the cost,
      // on metres of deck it guards nothing
      const h = (j) => { const i = j % nx, k = (j - i) / nx, dx = minX + (i + 0.5) * cell - ex, dz = minZ + (k + 0.5) * cell - ez; return Math.sqrt(dx * dx + dz * dz); };
      cost[js] = 0; from[js] = -1; seen[js] = stamp;
      heapPush(h(js), js);
      while (heapF.length) {
        const j = heapPop();
        if (shut[j] === stamp) continue;
        shut[j] = stamp;
        if (j === je) break;
        const i = j % nx, k = (j - i) / nx;
        for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
          if (!di && !dk) continue;
          const ii = i + di, kk = k + dk;
          if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
          const n = kk * nx + ii;
          if (shut[n] === stamp || Number.isNaN(y[n]) || Math.abs(y[n] - y[j]) > DECK_JOIN) continue;
          if (di && dk && !(Math.abs(y[k * nx + ii] - y[j]) <= DECK_JOIN && Math.abs(y[kk * nx + i] - y[j]) <= DECK_JOIN)) continue;   // no corner cut past the edge (AUDIT NAV2 F34: nor past a drop - a stair's tread beside the deck it climbs from)
          const c = cost[j] + (di && dk ? Math.SQRT2 : 1) * cell;
          if (seen[n] !== stamp || c < cost[n]) { seen[n] = stamp; cost[n] = c; from[n] = j; heapPush(c + h(n), n); }
        }
      }
      if (shut[je] !== stamp) return null;
      const cells = [];
      for (let j = je; j !== -1; j = from[j]) cells.push(j);
      cells.reverse();
      // the corners cut: from each corner on, the farthest cell ahead whose straight line from it stays on deck - AUDIT
      // NAV2 F61: each line walked cell by cell from its corner, so the cut is quadratic in the walk's cells at the
      // worst (a long straight run: every cell ahead tried, each line as long as the run so far), never linear
      const out = [centre(cells[0])];
      let at = 0;
      while (at < cells.length - 1) {
        let next = at + 1;
        const p0 = centre(cells[at]);
        for (let q = at + 2; q < cells.length && lineOnDeck(p0, centre(cells[q])); q++) next = q;
        out.push(centre(cells[next]));
        at = next;
      }
      return out;
    },
  };
  return deck;
}
