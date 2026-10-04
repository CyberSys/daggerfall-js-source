// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE TOWN'S WAYS - a resident's walk from one place to another,
// on the town's own CityNavigation grid (world/cityNavigation.js, DFU's navgrid: 1.6 m cells, a building's footprint
// weight 0, the ground's weight by its tile). DFU's walkers never path - they seek a neighbour by weight - so this is
// the port's: an A* over the same grid, four neighbours as the walkers step, each step's cost the tile's weight read
// the way DFU reads it ("Roads are great!" - a road the cheapest, stone the dearest), so a resident keeps to the
// streets as DFU's walkers lean to them. Only the STATIC weight is read (`weightAt` drops the walkers' occupancy flag):
// the same grid answers the same way for every reader, and a path is the same path on every client.
//
// PURE but for its scratch: each grid keeps one set of search arrays (a stamp per search, so nothing is cleared), so
// a town's thousand walks a day allocate nothing past the first.
import { NAV_CELL, HALF_CELL } from '../../world/cityNavigation.js';

/** A step's cost by its tile's weight: a road (15) 1, grass (12) 1.3, the average (7) 1.8, dirt (6) 1.9, stone (4) 2.1. */
export const stepCost = (weight) => 1 + (15 - weight) / 10;
/** The most cells one search opens before it gives up (a walk across the largest city opens a few thousand). */
export const PATH_MAX_EXPANSIONS = 120000;

const NEIGHBOURS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

/** @type {WeakMap<object, { stamp: Int32Array, g: Float32Array, from: Int32Array, closed: Int32Array, heap: Int32Array, f: Float32Array, order: Int32Array, search: number }>} */
const scratchOf = new WeakMap();
function scratch(nav) {
  const n = nav.width * nav.height;
  let s = scratchOf.get(nav);
  if (!s || s.stamp.length !== n) {
    s = { stamp: new Int32Array(n), g: new Float32Array(n), from: new Int32Array(n), closed: new Int32Array(n),
      heap: new Int32Array(n), f: new Float32Array(n), order: new Int32Array(n), search: 0 };
    scratchOf.set(nav, s);
  }
  return s;
}

/**
 * The cheapest four-neighbour way from cell `a` to cell `b` over cells of weight above zero - the cells, both ends
 * included - or null (an end unwalkable, no way between, or the search past `maxExpansions`). Ties break on the order
 * cells were opened, so the answer is one answer.
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number }} nav
 * @param {number[]} a - [gx, gy] @param {number[]} b - [gx, gy]
 * @param {{ maxExpansions?: number }} [opts]
 * @returns {number[][]|null}
 */
export function findTownPath(nav, a, b, { maxExpansions = PATH_MAX_EXPANSIONS } = {}) {
  const W = nav.width, H = nav.height;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  if (!a || !b || !inb(a[0], a[1]) || !inb(b[0], b[1])) return null;
  if (!(nav.weightAt(a[0], a[1]) > 0) || !(nav.weightAt(b[0], b[1]) > 0)) return null;
  const start = a[1] * W + a[0], goal = b[1] * W + b[0];
  if (start === goal) return [[a[0], a[1]]];
  const s = scratch(nav);
  const id = ++s.search;
  const { stamp, g, from, closed, heap, f, order } = s;
  let size = 0, opened = 0;
  const hOf = (i) => Math.abs((i % W) - b[0]) + Math.abs(((i / W) | 0) - b[1]);
  const less = (i, j) => (f[i] < f[j] || (f[i] === f[j] && order[i] < order[j]));
  const push = (i) => {
    let k = size++;
    heap[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!less(heap[k], heap[p])) break;
      const t = heap[k]; heap[k] = heap[p]; heap[p] = t; k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heap[0] = heap[--size];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < size && less(heap[l], heap[m])) m = l;
      if (r < size && less(heap[r], heap[m])) m = r;
      if (m === k) break;
      const t = heap[k]; heap[k] = heap[m]; heap[m] = t; k = m;
    }
    return top;
  };
  stamp[start] = id; g[start] = 0; from[start] = -1; f[start] = hOf(start); order[start] = opened++;
  push(start);
  let expansions = 0;
  while (size > 0) {
    const cur = pop();
    if (closed[cur] === id) continue;
    closed[cur] = id;
    if (cur === goal) {
      const out = [];
      for (let i = cur; i !== -1; i = from[i]) out.push([i % W, (i / W) | 0]);
      return out.reverse();
    }
    if (++expansions > maxExpansions) return null;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const w = nav.weightAt(nx, ny);
      if (!(w > 0)) continue;
      const ni = ny * W + nx;
      if (closed[ni] === id) continue;
      const ng = g[cur] + stepCost(w);
      if (stamp[ni] === id && ng >= g[ni]) continue;
      stamp[ni] = id; g[ni] = ng; from[ni] = cur; f[ni] = ng + hOf(ni); order[ni] = opened++;
      push(ni);
    }
  }
  return null;
}

/**
 * A path's cells as the walked line: the cell centres where it turns, both ends kept (location-frame metres, the
 * navgrid's own `navToWorld`), and its length.
 * @param {number[][]} cells @returns {{ pts: number[][], len: number, cum: number[] }}
 */
export function pathLine(cells) {
  /** @type {number[][]} */
  const pts = [];
  const at = (c) => [c[0] * NAV_CELL + HALF_CELL, c[1] * NAV_CELL + HALF_CELL];
  for (let i = 0; i < cells.length; i++) {
    if (i === 0 || i === cells.length - 1) { pts.push(at(cells[i])); continue; }
    const p = cells[i - 1], c = cells[i], n = cells[i + 1];
    if ((c[0] - p[0]) !== (n[0] - c[0]) || (c[1] - p[1]) !== (n[1] - c[1])) pts.push(at(c));
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, len: cum[cum.length - 1] ?? 0, cum };
}

/**
 * The point `s` metres along a walked line (clamped to its ends), and the way it faces there (a world yaw: 0 is +z,
 * as the walkers' own DIR_YAW reads it).
 * @param {{ pts: number[][], len: number, cum: number[] }} line @param {number} s
 * @returns {{ x: number, z: number, yaw: number }}
 */
export function pointAlong(line, s) {
  const { pts, cum } = line;
  if (!pts.length) return { x: 0, z: 0, yaw: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], yaw: 0 };
  const d = Math.max(0, Math.min(line.len, s));
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1];
  const t = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

/**
 * THE TOWN'S PATH BOOK: walks asked once, kept by their two ends (most of a town's day is the same few dozen walks).
 * `get` answers a kept line or null; `want` asks for one (a search, now) and answers it; `budget` how many searches a
 * frame may make - the host spends it so a crowd arriving never costs one frame a hundred searches.
 * @param {{ width: number, height: number, weightAt: (gx: number, gy: number) => number }} nav
 * @param {{ max?: number }} [opts]
 */
export function createPathBook(nav, { max = 768 } = {}) {
  /** @type {Map<number, { pts: number[][], len: number, cum: number[] } | null>} - kept in the order searched, the
   *  oldest leaving first past `max` */
  const book = new Map();
  const keyOf = (a, b) => ((a[1] * nav.width + a[0]) * 1048576 + (b[1] * nav.width + b[0]));
  let budget = Infinity;
  return {
    /** @param {number[]} a @param {number[]} b */
    get: (a, b) => book.get(keyOf(a, b)),
    /** @param {number[]} a @param {number[]} b */
    want(a, b) {
      const k = keyOf(a, b);
      if (book.has(k)) return book.get(k);
      if (budget <= 0) return undefined;
      budget--;
      const cells = findTownPath(nav, a, b);
      const line = cells ? pathLine(cells) : null;
      book.set(k, line);
      if (book.size > max) book.delete(book.keys().next().value);
      return line;
    },
    /** This frame's searches. @param {number} n */
    budget(n) { budget = n; },
    size: () => book.size,
  };
}
