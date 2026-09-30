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
//
// ITS FRAME is her mesh node's (Boat.MeshObject - every collider of every hull hangs under it), baked at rest: the swell
// rolls and pitches that node, never her root, so a point goes into the deck through the node's live world matrix
// (`intoDeck`) and out of it the same way (`outOfDeck`). ONE LEVEL A CELL - the main deck's: where a covered deck
// stands under another (the Small Ship's at 3.64 m under her main deck at 6.77, the Carrack's 6.7 m half deck over
// hers at 3.64) the main deck is the one kept, the other no deck.

export const DECK_CELL = 0.5;
export const DECK_FLAT = Math.cos(30 * Math.PI / 180);
export const DECK_HEADROOM = 1.7;
export const DECK_STEP = 0.4;
export const DECK_INSET = 1;
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
  const y = new Float32Array(nx * nz).fill(NaN);
  if (mainBin != null) {
    const main = mainBin * LEVEL_BIN;
    // flood from every floor at the main deck through floors within DECK_STEP, cell to cell (8 ways)
    const queue = [];
    for (let j = 0; j < cand.length; j++) {
      const hit = cand[j].find((q) => Math.abs(q - main) <= LEVEL_BIN);
      if (hit != null) { y[j] = hit; queue.push(j); }
    }
    for (let h = 0; h < queue.length; h++) {
      const j = queue[h], i = j % nx, k = (j - i) / nx, here = y[j];
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        if (!di && !dk) continue;
        const ii = i + di, kk = k + dk;
        if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
        const n = kk * nx + ii;
        if (!Number.isNaN(y[n])) continue;
        let best = null;
        for (const q of cand[n]) if (Math.abs(q - here) <= DECK_STEP && (best == null || Math.abs(q - here) < Math.abs(best - here))) best = q;
        if (best != null) { y[n] = best; queue.push(n); }
      }
    }
  }
  // kept off every edge
  for (let pass = 0; pass < inset; pass++) {
    const edge = [];
    for (let j = 0; j < y.length; j++) {
      if (Number.isNaN(y[j])) continue;
      const i = j % nx, k = (j - i) / nx;
      const off = (ii, kk) => ii < 0 || kk < 0 || ii >= nx || kk >= nz || Number.isNaN(y[kk * nx + ii]);
      if (off(i - 1, k) || off(i + 1, k) || off(i, k - 1) || off(i, k + 1)) edge.push(j);
    }
    for (const j of edge) y[j] = NaN;
  }
  // her open deck: the largest piece joined by a walk's own steps (`path`'s: within DECK_STEP, no corner cut past an
  // edge) - a cabin under her poop or half deck, a passage walled off, is no deck to stand a muster on or walk
  const piece = new Int32Array(y.length).fill(-1);
  let best = -1, bestN = 0;
  for (let j0 = 0, id = 0; j0 < y.length; j0++) {
    if (Number.isNaN(y[j0]) || piece[j0] >= 0) continue;
    const queue = [j0];
    piece[j0] = id;
    for (let h = 0; h < queue.length; h++) {
      const j = queue[h], i = j % nx, k = (j - i) / nx;
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        if (!di && !dk) continue;
        const ii = i + di, kk = k + dk;
        if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
        const n = kk * nx + ii;
        if (piece[n] >= 0 || Number.isNaN(y[n]) || Math.abs(y[n] - y[j]) > DECK_STEP) continue;
        if (di && dk && (Number.isNaN(y[k * nx + ii]) || Number.isNaN(y[kk * nx + i]))) continue;
        piece[n] = id;
        queue.push(n);
      }
    }
    if (queue.length > bestN) { bestN = queue.length; best = id; }
    id++;
  }
  for (let j = 0; j < y.length; j++) if (piece[j] !== best) y[j] = NaN;
  return deckOf({ cell, minX, minZ, nx, nz, y });
}

/**
 * The deck's questions over a built grid (`buildDeck`'s, or one restored).
 * @param {{ cell: number, minX: number, minZ: number, nx: number, nz: number, y: Float32Array }} g
 */
export function deckOf(g) {
  const { cell, minX, minZ, nx, nz, y } = g;
  const cellOf = (x, z) => {
    const i = Math.floor((x - minX) / cell), k = Math.floor((z - minZ) / cell);
    return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i;
  };
  const centre = (j) => { const i = j % nx, k = (j - i) / nx; return [minX + (i + 0.5) * cell, y[j], minZ + (k + 0.5) * cell]; };
  /** The deck cell whose square lies nearest `(x, z)`, -1 for none: rings out from the point's own cell (clamped onto
   *  the grid), stopping once no farther ring can hold a nearer square - ring r + 1 lies r cells off at the least. */
  let ringBest = -1, ringD = Infinity, qx = 0, qz = 0;
  const visit = (i, k) => {
    if (i < 0 || k < 0 || i >= nx || k >= nz) return;
    const j = k * nx + i;
    if (Number.isNaN(y[j])) return;
    const x0 = minX + i * cell, z0 = minZ + k * cell;
    const dx = qx < x0 ? x0 - qx : qx > x0 + cell ? qx - x0 - cell : 0;
    const dz = qz < z0 ? z0 - qz : qz > z0 + cell ? qz - z0 - cell : 0;
    const d = dx * dx + dz * dz;
    if (d < ringD) { ringD = d; ringBest = j; }
  };
  const nearestCell = (x, z) => {
    if (!count) return -1;
    ringBest = -1; ringD = Infinity; qx = x; qz = z;
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
   *  (the walk's own corner rule), stepping no more than DECK_STEP from one cell to the next. */
  const lineOnDeck = (p0, p1) => {
    let i = Math.floor((p0[0] - minX) / cell), k = Math.floor((p0[2] - minZ) / cell);
    const i1 = Math.floor((p1[0] - minX) / cell), k1 = Math.floor((p1[2] - minZ) / cell);
    if (i < 0 || k < 0 || i >= nx || k >= nz || Number.isNaN(y[k * nx + i])) return false;
    const dx = p1[0] - p0[0], dz = p1[2] - p0[2], si = Math.sign(dx), sk = Math.sign(dz);
    const tdx = si ? cell / Math.abs(dx) : Infinity, tdz = sk ? cell / Math.abs(dz) : Infinity;
    let tx = si ? (minX + (si > 0 ? i + 1 : i) * cell - p0[0]) / dx : Infinity;
    let tz = sk ? (minZ + (sk > 0 ? k + 1 : k) * cell - p0[2]) / dz : Infinity;
    let was = y[k * nx + i];
    const on = (ii, kk) => ii >= 0 && kk >= 0 && ii < nx && kk < nz && !Number.isNaN(y[kk * nx + ii]) && Math.abs(y[kk * nx + ii] - was) <= DECK_STEP;
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
  const deck = {
    ...g,
    /** How many cells are deck. */
    count,
    /** Whether `(x, z)` (her frame) stands on deck. */
    walkable(x, z) { const j = cellOf(x, z); return j >= 0 && !Number.isNaN(y[j]); },
    /** The deck's height under `(x, z)`, or NaN off it. */
    heightAt(x, z) { const j = cellOf(x, z); return j >= 0 ? y[j] : NaN; },
    /** The centre of the deck cell nearest `(x, z)` - `[x, y, z]` in her frame - or null for a hull with no deck. */
    nearest(x, z) {
      const j = nearestCell(x, z);
      return j < 0 ? null : centre(j);
    },
    /**
     * The deck point nearest `(x, z)` - the point itself on deck, else the nearest point of the nearest cell's square,
     * a hair inside it - `[x, y, z]` in her frame, written into `out`; null for a hull with no deck. A body pushed off
     * her deck is put back on its edge, sliding along it as it presses, never snapped to a cell's centre.
     * @param {number} x @param {number} z @param {number[]} [out]
     */
    clamp(x, z, out = [0, 0, 0]) {
      const j = nearestCell(x, z);
      if (j < 0) return null;
      const i = j % nx, k = (j - i) / nx, e = cell * 1e-3;
      const x0 = minX + i * cell, z0 = minZ + k * cell;
      out[0] = Math.min(x0 + cell - e, Math.max(x0 + e, x));
      out[1] = y[j];
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
    /** `n` spots spread across the deck - farthest-point sampling from the cell nearest her middle - `[x, y, z]`. */
    spots(n) {
      if (!count || n <= 0) return [];
      const cells = [];
      for (let j = 0; j < y.length; j++) if (!Number.isNaN(y[j])) cells.push(j);
      const mid = deck.nearest(sx / count, sz / count);
      const out = [mid];
      const far = new Float64Array(cells.length).fill(Infinity);
      while (out.length < Math.min(n, cells.length)) {
        const last = out[out.length - 1];
        let best = -1, bestD = -1;
        for (let q = 0; q < cells.length; q++) {
          const c = centre(cells[q]);
          far[q] = Math.min(far[q], (c[0] - last[0]) ** 2 + (c[2] - last[2]) ** 2);
          if (far[q] > bestD) { bestD = far[q]; best = q; }
        }
        if (bestD <= 0) break;
        out.push(centre(cells[best]));
      }
      return out;
    },
    /**
     * A walk from `a` to `b` (her frame, `[x, z]`): the deck cells' centres from the one nearest `a` to the one nearest
     * `b`, cell to cell within DECK_STEP, the corners cut where the straight line between two stays on deck; null when
     * no walk joins them.
     */
    path(a, b) {
      const s = deck.nearest(a[0], a[1]), e = deck.nearest(b[0], b[1]);
      if (!s || !e) return null;
      const js = cellOf(s[0], s[2]), je = cellOf(e[0], e[2]);
      stamp = (stamp + 1) >>> 0 || 1;
      if (stamp === 1) { seen.fill(0); shut.fill(0); }
      heapF.length = 0; heapJ.length = 0;
      const ex = e[0], ez = e[2];
      const h = (j) => { const i = j % nx, k = (j - i) / nx; return Math.hypot(minX + (i + 0.5) * cell - ex, minZ + (k + 0.5) * cell - ez); };
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
          if (shut[n] === stamp || Number.isNaN(y[n]) || Math.abs(y[n] - y[j]) > DECK_STEP) continue;
          if (di && dk && (Number.isNaN(y[k * nx + ii]) || Number.isNaN(y[kk * nx + i]))) continue;   // no corner cut past the edge
          const c = cost[j] + (di && dk ? Math.SQRT2 : 1) * cell;
          if (seen[n] !== stamp || c < cost[n]) { seen[n] = stamp; cost[n] = c; from[n] = j; heapPush(c + h(n), n); }
        }
      }
      if (shut[je] !== stamp) return null;
      const cells = [];
      for (let j = je; j !== -1; j = from[j]) cells.push(j);
      cells.reverse();
      // the corners cut: from each corner on, the farthest cell ahead whose straight line from it stays on deck (a
      // walk's cost linear in its length)
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
