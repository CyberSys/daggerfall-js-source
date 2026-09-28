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
//
// OWS2 (2026-09-28, the player's ask: "You should transition to your boat
// if traveling across water then back onto land when hitting land"): THE
// CROSSING. Given `sea` - the traveller has a boat (at its helm, moored in
// reach, or packed in the pack) - the search walks three layers of the
// grid: ashore with the boat to hand, afloat, and ashore with it left
// behind. A step from a land pixel into the water LAUNCHES the boat
// ('embark'), steps between water pixels are sailed ('sea'), and a step
// out of the water onto land is the LANDFALL ('landfall') - back to hand
// when the boat packs (`again`), else left where it landed. Without `sea`
// the one layer is the law above, unchanged: the sea refused.
// ═══════════════════════════════════════════════════════════════════
import { DIR_DELTA, MAP_W, MAP_H } from '../world/roadNetwork.js';

/** What a step costs, by what it walks on. The open ground's 3.5 makes a road worth a detour of up to three and a half
 *  times its length - Travel Options' reckless (road) and cautious (open) multipliers are 1 and 0.8 by default, so the
 *  road is also the faster walk. */
export const ROUTE_COST = Object.freeze({ road: 1, track: 1.6, open: 3.5 });
/** OWS2: what a crossing's steps cost - a step sailed (`sea`, x sqrt 2 on a diagonal), one into a water pixel with
 *  land about it (`coast`: the route keeps off the shore where the sea is wide, and still threads a strait), and the
 *  launch's or the landfall's own (`shore`, on top of its step: the boat put in or taken out - so no route hops in and
 *  out of the water to save a step). A sailed step costs little more than a road's: the boat makes its way about as
 *  fast as the road walks, and the heuristic's road cost stays under every step (admissible). */
export const SEA_COST = Object.freeze({ sea: 1.2, coast: 1.5, shore: 6 });
/** OWS2: the kinds a crossing's steps are. */
export const SEA_KINDS = Object.freeze(['sea', 'embark', 'landfall']);
/** OWS2: the search's layers - ashore with the boat to hand, afloat, ashore with it left behind (the one layer without
 *  `sea` is the last's law: no launch). */
const ASHORE = 0, AFLOAT = 1, LEFT = 2;

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
 * OWS2: `sea` puts the boat in the search - `start` 'sea' when the traveller is afloat already (at the helm), 'land'
 * with the boat to hand ashore; `again` when a landfall packs it (it launches again later); `goal` 'sea' when the end
 * is a spot on the water (reached afloat), 'land' when it is ashore (the default).
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @param {{ roads?: ArrayLike<number>|null, tracks?: ArrayLike<number>|null, isWater?: (x:number,y:number)=>boolean,
 *   width?: number, height?: number, margins?: readonly number[], maxExpansions?: number,
 *   sea?: { start: 'land'|'sea', again?: boolean, goal?: 'land'|'sea' } | null }} [opts]
 * @returns {{ pixels: {x:number,y:number}[], cost: number, kinds: string[] } | null}
 */
export function planRoute(from, to, { roads = null, tracks = null, isWater = () => false, width = MAP_W, height = MAP_H, margins = ROUTE_MARGINS, maxExpansions = ROUTE_MAX_EXPANSIONS, sea = null } = {}) {
  if (!from || !to) return null;
  if (from.x === to.x && from.y === to.y && !(sea && (sea.start === 'sea') !== (sea.goal === 'sea'))) return { pixels: [{ x: from.x, y: from.y }], cost: 0, kinds: [] };
  // AUDIT DEEP2 B-6: A ROUTE FOUND IN A BOX IS KEPT ONLY WHEN NONE OUTSIDE IT COULD BE CHEAPER. The ladder widened only
  // when a box held no route at all, so a road just past the first box lost to open ground inside it (6.6% of real
  // 24-pixel trips cost more than they should). A path that leaves a box `margin` wide goes margin + 1 pixels out and
  // as many back, at no less than a road's cost a step - so a route costing no more than that is the best there is,
  // and one costing more is searched for again in the next box.
  let best = null;
  for (const margin of margins) {
    const r = search(from, to, { roads, tracks, isWater, width, height, margin, maxExpansions, sea });
    if (r && (!best || r.cost <= best.cost)) best = r;
    if (best && best.cost <= 2 * (margin + 1) * ROUTE_COST.road) return best;
  }
  return best;
}

function search(from, to, { roads, tracks, isWater, width, height, margin, maxExpansions, sea }) {
  const x0 = Math.max(0, Math.min(from.x, to.x) - margin), x1 = Math.min(width - 1, Math.max(from.x, to.x) + margin);
  const y0 = Math.max(0, Math.min(from.y, to.y) - margin), y1 = Math.min(height - 1, Math.max(from.y, to.y) + margin);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const local = (x, y) => (y - y0) * bw + (x - x0);
  const cells = bw * bh, layers = sea ? 3 : 1;   // OWS2: a state is a cell in a layer
  const g = new Float64Array(cells * layers).fill(Infinity);
  const came = new Int32Array(cells * layers).fill(-1);
  const via = new Uint8Array(cells * layers);   // the kind of step the state was reached by: an index into NAMES
  const closed = new Uint8Array(cells * layers);
  const h = (x, y) => { const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y); return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * ROUTE_COST.road; };
  const goal = local(to.x, to.y);
  const startLayer = !sea ? 0 : sea.start === 'sea' ? AFLOAT : ASHORE;
  const seaGoal = !!sea && sea.goal === 'sea';
  const goalOk = (layer) => !sea || (seaGoal ? layer === AFLOAT : layer !== AFLOAT);
  // OWS2: land about a water pixel - a sailed step into it is a coast's
  const nearLand = (x, y) => {
    for (const [, dx, dy] of DIR_DELTA) if (!isWater(x + dx, y + dy)) return true;
    return false;
  };
  const start = startLayer * cells + local(from.x, from.y);
  g[start] = 0;
  const open = new Heap();
  open.push(h(from.x, from.y), start);
  let expanded = 0, reached = -1;
  const KIND = { road: 0, track: 1, open: 2 };
  while (open.size) {
    const c = open.pop();
    if (closed[c]) continue;
    closed[c] = 1;
    const layer = Math.floor(c / cells), cell = c - layer * cells;
    if (cell === goal && goalOk(layer)) { reached = c; break; }
    if (++expanded > maxExpansions) return null;
    const cx = x0 + (cell % bw), cy = y0 + Math.floor(cell / bw);
    const ca = cy * width + cx;
    for (const [bit, dx, dy] of DIR_DELTA) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const n = local(nx, ny);
      const diag = dx && dy ? Math.SQRT2 : 1;
      // OWS2: a spot on the water asked for is water, whatever its pixel's byte (a bay in a land pixel)
      const wet = isWater(nx, ny) || (seaGoal && n === goal);
      let nl = layer, kindIx, step;
      if (sea && layer === AFLOAT) {
        if (wet) {
          // afloat: a boat never sails through a corner of the land (a diagonal between two land pixels)
          if (dx && dy && !isWater(cx + dx, cy) && !isWater(cx, cy + dy)) continue;
          kindIx = 3; step = diag * (nearLand(nx, ny) ? SEA_COST.coast : SEA_COST.sea);
        } else {
          // the landfall: the step up the beach, and the boat taken out - to hand again when it packs
          nl = sea.again ? ASHORE : LEFT; kindIx = 5; step = diag * ROUTE_COST.open + SEA_COST.shore;
        }
      } else {
        if (wet && (seaGoal || n !== goal)) {   // a place's own pixel on the water is walked into (the harbour town), a spot on it sailed to
          if (!(sea && layer === ASHORE)) continue;   // no boat to hand: the sea refused
          nl = AFLOAT; kindIx = 4; step = diag * SEA_COST.sea + SEA_COST.shore;   // the launch
        } else {
          // AUDIT DEEP T2-5: nor through a corner of the sea - a diagonal between two water pixels is a swim (the roads' own
          // ROADS 6, whose stricter half would refuse a coast road's own diagonal)
          if (dx && dy && isWater(cx + dx, cy) && isWater(cx, cy + dy)) continue;
          const kind = edgeKind(ca, ny * width + nx, bit, roads, tracks);
          kindIx = KIND[kind]; step = diag * ROUTE_COST[kind];
        }
      }
      const ns = nl * cells + n;
      if (closed[ns]) continue;
      const ng = g[c] + step;
      if (ng < g[ns]) { g[ns] = ng; came[ns] = c; via[ns] = kindIx; open.push(ng + h(nx, ny), ns); }
    }
  }
  if (reached < 0) return null;
  const pixels = [];
  const kinds = [];
  const NAMES = ['road', 'track', 'open', 'sea', 'embark', 'landfall'];
  for (let c = reached; c !== -1; c = came[c]) {
    const cell = c % cells;
    pixels.push({ x: x0 + (cell % bw), y: y0 + Math.floor(cell / bw) });
    if (c !== start) kinds.push(NAMES[via[c]]);
  }
  pixels.reverse(); kinds.reverse();
  return { pixels, cost: g[reached], kinds };
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

/** How much of a route is on a road or a track - the readout's "by the road" line. 0..1. OWS2: a road or a track
 *  alone - a step sailed is on neither. */
export function roadShare(kinds) {
  if (!kinds?.length) return 0;
  return kinds.filter((k) => k === 'road' || k === 'track').length / kinds.length;
}
/** AUDIT DEEP T2-1's law, and OWS2's: no water pixel on the straight line between two pixels (the resume's, and the
 *  Overworld's spot walk that asks whether the way to it crosses the water). */
export function dryLine(a, b, isWater) {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let s = 1; s <= n; s++) if (isWater(Math.round(a.x + ((b.x - a.x) * s) / n), Math.round(a.y + ((b.y - a.y) * s) / n))) return false;
  return true;
}
/** OWS2: does a route put to sea - a launch, a step sailed or a landfall in it. */
export const crossesWater = (kinds) => !!kinds?.some((k) => SEA_KINDS.includes(k));
