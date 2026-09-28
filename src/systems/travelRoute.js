// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV2 - THE ROAD PLANNER (bible/06-Systems/Travel-View.md).
//
// Mac's call: a click on a town or a marker is reached BY THE ROADS. The
// roads are Hazelnut's - Basic Roads' four arrays, one byte a map pixel,
// a bit for each edge a path leaves through (systems/travelPaths.js's
// compass, world/roadNetwork.js's DIR, one law) - the very bytes Travel
// Options' own follow key walks. A step from pixel A to its neighbour B
// is ON the road only when A's byte carries the edge toward B and B's
// carries the edge back: two roads side by side are not one road.
//
// A* over the 1000x500 pixel grid, 8-connected: a road step costs 1, a
// track 1.6, the open ground between 3.5 (x sqrt 2 on a diagonal), and
// the sea is refused - a route never swims (the traveller could, and
// Travel Options stops a journey at the ocean's climate anyway). So a
// town two pixels off across a field is walked to across the field, and
// one six pixels off round a hill is reached by the road round it.
//
// NOT world/roadNetwork.js's route(): that one LAYS roads (it prices
// climbing and prefers the roads it already laid), this one WALKS them,
// and a third copy of either law is what AUDIT 68 exists to stop. Both
// read DIR_DELTA, so the compass is still one table.
//
// PURE: arrays in, pixels out. The legs a journey walks come out of
// `routeLegs`, which folds a straight run of steps into one leg so the
// autopilot aims down the road rather than at every pixel's middle.
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA, MAP_W, MAP_H } from '../world/roadNetwork.js';

/** What a step costs, by what it walks on. The open ground's 3.5 makes a road worth a detour of up to three and a half
 *  times its length - Travel Options' reckless (road) and cautious (open) multipliers are 1 and 0.8 by default, so the
 *  road is also the faster walk. */
export const ROUTE_COST = Object.freeze({ road: 1, track: 1.6, open: 3.5 });
/** The search's box about the two ends, widened in turn until a route is found. Pixels. */
export const ROUTE_MARGINS = Object.freeze([6, 20, 60]);
/** The most cells one search may expand before it gives up - a guard, never reached by a route the view can show. */
export const ROUTE_MAX_EXPANSIONS = 200000;

/** The edge back: N<->S, NE<->SW, E<->W, SE<->NW. */
export const OPPOSITE_BIT = Object.freeze({ 128: 8, 64: 4, 32: 2, 16: 1, 8: 128, 4: 64, 2: 32, 1: 16 });

/**
 * What a step from cell `a` to cell `b` through edge `bit` walks on: 'road', 'track' or 'open'.
 * @param {ArrayLike<number>|null} roads
 * @param {ArrayLike<number>|null} tracks
 */
export function edgeKind(a, b, bit, roads, tracks) {
  const back = OPPOSITE_BIT[bit];
  if (roads && (roads[a] & bit) && (roads[b] & back)) return 'road';
  if (tracks && (tracks[a] & bit) && (tracks[b] & back)) return 'track';
  return 'open';
}

/** A binary heap of [priority, value] - the open set. */
class Heap {
  constructor() { this.p = []; this.v = []; }
  get size() { return this.p.length; }
  push(pri, val) {
    const p = this.p, v = this.v;
    let i = p.length;
    p.push(pri); v.push(val);
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (p[j] <= pri) break;
      p[i] = p[j]; v[i] = v[j]; i = j;
    }
    p[i] = pri; v[i] = val;
  }
  pop() {
    const p = this.p, v = this.v;
    const top = v[0];
    const lp = p.pop(), lv = v.pop();
    if (p.length) {
      let i = 0;
      const n = p.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mp = lp;
        if (l < n && p[l] < mp) { m = l; mp = p[l]; }
        if (r < n && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break;
        p[i] = p[m]; v[i] = v[m]; i = m;
      }
      p[i] = lp; v[i] = lv;
    }
    return top;
  }
}

/**
 * THE ROUTE from pixel `from` to pixel `to`, both ends included, or null when the sea (or the search's guard) leaves
 * none. `isWater(x, y)` refuses a pixel - never the two ends, which the traveller already stands on or asked for.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {{ roads?: ArrayLike<number>|null, tracks?: ArrayLike<number>|null, isWater?: (x:number,y:number)=>boolean,
 *   width?: number, height?: number, margins?: readonly number[], maxExpansions?: number }} [opts]
 * @returns {{ pixels: {x:number,y:number}[], cost: number, kinds: string[] } | null}
 */
export function planRoute(from, to, { roads = null, tracks = null, isWater = () => false, width = MAP_W, height = MAP_H, margins = ROUTE_MARGINS, maxExpansions = ROUTE_MAX_EXPANSIONS } = {}) {
  if (!from || !to) return null;
  if (from.x === to.x && from.y === to.y) return { pixels: [{ x: from.x, y: from.y }], cost: 0, kinds: [] };
  // AUDIT DEEP2 B-6: A ROUTE FOUND IN A BOX IS KEPT ONLY WHEN NONE OUTSIDE IT COULD BE CHEAPER. The ladder widened only
  // when a box held no route at all, so a road just past the first box lost to open ground inside it (6.6% of real
  // 24-pixel trips cost more than they should). A path that leaves a box `margin` wide goes margin + 1 pixels out and
  // as many back, at no less than a road's cost a step - so a route costing no more than that is the best there is,
  // and one costing more is searched for again in the next box.
  let best = null;
  for (const margin of margins) {
    const r = search(from, to, { roads, tracks, isWater, width, height, margin, maxExpansions });
    if (r && (!best || r.cost <= best.cost)) best = r;
    if (best && best.cost <= 2 * (margin + 1) * ROUTE_COST.road) return best;
  }
  return best;
}

function search(from, to, { roads, tracks, isWater, width, height, margin, maxExpansions }) {
  const x0 = Math.max(0, Math.min(from.x, to.x) - margin), x1 = Math.min(width - 1, Math.max(from.x, to.x) + margin);
  const y0 = Math.max(0, Math.min(from.y, to.y) - margin), y1 = Math.min(height - 1, Math.max(from.y, to.y) + margin);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const local = (x, y) => (y - y0) * bw + (x - x0);
  const g = new Float64Array(bw * bh).fill(Infinity);
  const came = new Int32Array(bw * bh).fill(-1);
  const via = new Uint8Array(bw * bh);   // the edge kind the cell was reached by: 0 road, 1 track, 2 open
  const closed = new Uint8Array(bw * bh);
  const h = (x, y) => { const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y); return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * ROUTE_COST.road; };
  const start = local(from.x, from.y), goal = local(to.x, to.y);
  g[start] = 0;
  const open = new Heap();
  open.push(h(from.x, from.y), start);
  let expanded = 0;
  const KIND = { road: 0, track: 1, open: 2 };
  while (open.size) {
    const c = open.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    if (c === goal) break;
    if (++expanded > maxExpansions) return null;
    const cx = x0 + (c % bw), cy = y0 + Math.floor(c / bw);
    const ca = cy * width + cx;
    for (const [bit, dx, dy] of DIR_DELTA) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const n = local(nx, ny);
      if (closed[n]) continue;
      if (n !== goal && isWater(nx, ny)) continue;
      // AUDIT DEEP T2-5: nor through a corner of the sea - a diagonal between two water pixels is a swim (the roads' own
      // ROADS 6, whose stricter half would refuse a coast road's own diagonal)
      if (dx && dy && isWater(cx + dx, cy) && isWater(cx, cy + dy)) continue;
      const kind = edgeKind(ca, ny * width + nx, bit, roads, tracks);
      const step = (dx && dy ? Math.SQRT2 : 1) * ROUTE_COST[kind];
      const ng = g[c] + step;
      if (ng < g[n]) { g[n] = ng; came[n] = c; via[n] = KIND[kind]; open.push(ng + h(nx, ny), n); }
    }
  }
  if (!Number.isFinite(g[goal])) return null;
  const pixels = [];
  const kinds = [];
  const NAMES = ['road', 'track', 'open'];
  for (let c = goal; c !== -1; c = came[c]) {
    pixels.push({ x: x0 + (c % bw), y: y0 + Math.floor(c / bw) });
    if (c !== start) kinds.push(NAMES[via[c]]);
  }
  pixels.reverse(); kinds.reverse();
  return { pixels, cost: g[goal], kinds };
}

/**
 * THE LEGS a journey walks: the route's pixels after the first, a straight run of same-direction steps on the same
 * kind of ground folded into its last pixel. The last leg is always the route's last pixel. Each leg carries the kind
 * it walks on (the host's speed: a road leg reckless, the rest cautious - Travel Options' own two multipliers).
 * @param {{x:number,y:number}[]} pixels
 * @param {string[]} kinds - kinds[i] is the step from pixels[i] to pixels[i + 1]
 * @returns {{ x:number, y:number, kind:string }[]}
 */
export function routeLegs(pixels, kinds = []) {
  const legs = [];
  for (let i = 1; i < pixels.length; i++) {
    const dx = pixels[i].x - pixels[i - 1].x, dy = pixels[i].y - pixels[i - 1].y;
    const kind = kinds[i - 1] ?? 'open';
    const next = pixels[i + 1];
    const same = next && next.x - pixels[i].x === dx && next.y - pixels[i].y === dy && (kinds[i] ?? 'open') === kind;
    if (!same) legs.push({ x: pixels[i].x, y: pixels[i].y, kind });
  }
  return legs;
}

/** How much of a route is on a road or a track - the readout's "by the road" line. 0..1. */
export function roadShare(kinds) {
  if (!kinds?.length) return 0;
  return kinds.filter((k) => k !== 'open').length / kinds.length;
}
