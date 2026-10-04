// @ts-check
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE ROADS - where a town's travellers go, when, by which way, and
// where on it they are at any minute of the sky's clock. Pure, like the rest of the living world (LW0 decision 2): the
// towns near (the MAPS rows the host hands, the game's own rows alone so every client reads the same), the way (the
// Travel Options planner's on Hazelnut's roads - `systems/travelRoute.js planRoute` - asked through the host, cached
// there), a seed and the clock in; a party's place out.
//
// A TRAVELLER'S CYCLES. Each traveller (census.js travellerRoster: merchants, adventurers, pilgrims, couriers, the
// small places' pedlars - every town has one, a city six) lives in
// cycles of days (`CYCLE_DAYS`, at the calendar's walking pace; longer at a slower clock's, `paceScale`), offset by
// their own seed. In each cycle they go or stay (`TRIP_CHANCE`); going, they pick a town of the right kind within their
// range (`TRIP_RANGE_PX`: a merchant a town to trade in, the bigger the likelier; a pilgrim a temple's town; a courier
// anywhere), set out at an hour of a morning, walk the way BY DAY (WALK_FROM_H to WALK_TO_H) and camp where night
// finds them, stay a day or two (`STAY_DAYS`), and walk home. A trip that would not fit its cycle at their pace takes
// the next nearer town, or none.
//
// CARAVANS. A merchant takes the town's sellswords under contract to them for the road (up to HIRE_MAX; the town's
// sellswords dealt to its merchants in slot order), and a pilgrim, a courier or a pedlar setting out the same day for the
// same town joins the first such merchant's train - one party, one pace, one timeline. Each a law of the trips alone
// (formCaravans), so a train is the same whichever minute of it is read.
//
// WHAT THE TOWNS SEE. A traveller's home sees an AWAY WINDOW (dayPlan.js schedule: gear, the walk out to the exit
// facing the road, the walk home); the town they go to sees a VISITOR (lodging at a tavern, in by the exit facing the
// road they came, out by it again).
//
// UNITS. Positions in the world's native units (32768 a map pixel, 40 a metre - the bands' and the Overworld's own);
// the route a polyline through its pixels' centres, which is the road itself (Basic Roads paints each road bit from a
// pixel's centre to its edge or corner, travelRoute.js / roadClearance.js), trimmed at each end by the town's own
// half-width so a party walks out of the town's edge, not its middle.
import { lwSeed, lwRng, rollInt, pickWeighted } from './seed.js';
import { seededRng } from '../wind.js';
import { DAY_MIN, DAY_START_MIN } from './dayPlan.js';
import { WORLD_MAP_TERRAIN_DIM as NATIVE_PIXEL } from '../../formats/mapsFile.js';
import { NATIVE_PER_M } from '../travelDungeons.js';

// the native units' one homes: a map pixel the MAPS format's own (mapsFile.js), a metre the travel view's (travelDungeons.js)
export { NATIVE_PIXEL, NATIVE_PER_M };
/** The native units of one RMB block (4096 classic units, 102.4 m). */
export const NATIVE_BLOCK = 4096;
/** The daylight a party walks in (hours of the day). */
export const WALK_FROM_H = 7;
export const WALK_TO_H = 19;
/** Each job's pace on the road, times the street's (a merchant's train at a cart's pace, a courier at a jog). */
export const TRIP_PACE = Object.freeze({ merchant: 0.85, mercenary: 0.85, adventurer: 1.05, courier: 1.3, pilgrim: 0.9, sailor: 1, pedlar: 0.95 });
/** Each job's cycle (days, at the calendar's walking pace). */
export const CYCLE_DAYS = Object.freeze({ merchant: 7, adventurer: 7, pilgrim: 20, courier: 5, pedlar: 6 });
/** The chance a traveller goes in a cycle. */
export const TRIP_CHANCE = Object.freeze({ merchant: 0.9, adventurer: 0.7, pilgrim: 0.5, courier: 0.9, pedlar: 0.85 });
/** The map pixels a job's destination lies within (nearest, farthest). */
export const TRIP_RANGE_PX = Object.freeze({ merchant: [3, 14], adventurer: [3, 12], pilgrim: [3, 18], courier: [4, 18], pedlar: [2, 6] });
/** The days a job stays where it went. */
export const STAY_DAYS = Object.freeze({ merchant: [1, 2], adventurer: [1, 1], pilgrim: [1, 2], courier: [0, 1], pedlar: [0, 1] });
/** The most sellswords a merchant hires for the road. */
export const HIRE_MAX = 3;
/** The farthest a traveller's home can be from a town and still be read for visitors or the roads (map pixels). */
export const TRIP_REACH_PX = 18;
/** The calendar's walking pace (metres a clock minute): DFU's 1.3 m/s over CLASSIC_MINUTES_PER_SECOND. */
export const CALENDAR_MPM = 1.3 / 0.2;

/**
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {import('./census.js').LwTown} LwTown
 * @typedef {{ pixels: { x: number, y: number }[], kinds?: string[] }} RoutePlan - travelRoute.js planRoute's answer
 * @typedef {{ pts: number[][], cum: number[], len: number, kinds: string[] }} Way - a route as a walked line (native)
 * @typedef {{
 *   townsNear: (px: number, py: number, rMax: number) => LwTown[],
 *   routeOf: (a: LwTown, b: LwTown) => (RoutePlan | null | undefined),
 *   rosterOf: (town: LwTown) => Resident[],
 *   templeTown?: (town: LwTown) => boolean,
 * }} TripWorld - the host's: towns near a pixel (the game's own rows, populated); the planner's way between two towns
 *   (undefined while it is being asked, null for none); a town's travellers (census.js travellerRoster)
 * @typedef {{ id: string, kind: string, leader: Resident, party: Resident[], from: LwTown, to: LwTown, way: Way,
 *   pace: number, outT0: number, outT1: number, backT0: number, backT1: number, trim0: number, trim1: number }} Trip
 */

/** How much slower a clock's walking pace is than the calendar's (online's sky walks half as far a minute). @param {number} mpm */
export const paceScale = (mpm) => Math.max(1, CALENDAR_MPM / Math.max(0.1, mpm));

/** The minutes of daylight walking between two minutes of the clock. @param {number} a @param {number} b */
export function walkedMinutes(a, b) {
  if (!(b > a)) return 0;
  const from = WALK_FROM_H * 60, to = WALK_TO_H * 60;
  let total = 0;
  let day = Math.floor(a / DAY_MIN);
  for (; day * DAY_MIN < b; day++) {
    const lo = Math.max(a, day * DAY_MIN + from), hi = Math.min(b, day * DAY_MIN + to);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

/** The minute of the clock at which `minutes` of daylight walking from `a` are done. @param {number} a @param {number} minutes */
export function whenWalked(a, minutes) {
  let left = Math.max(0, minutes);
  const from = WALK_FROM_H * 60, to = WALK_TO_H * 60;
  let day = Math.floor(a / DAY_MIN);
  let t = a;
  for (let guard = 0; guard < 4000; guard++, day++) {
    const lo = Math.max(t, day * DAY_MIN + from), hi = day * DAY_MIN + to;
    if (hi > lo) {
      if (hi - lo >= left) return lo + left;
      left -= hi - lo;
    }
    t = (day + 1) * DAY_MIN;
  }
  return t;
}

/** A planner's route as a walked line through its pixels' centres (native units). @param {RoutePlan} plan @returns {Way} */
export function wayOf(plan) {
  const pts = (plan?.pixels ?? []).map((p) => [p.x * NATIVE_PIXEL + NATIVE_PIXEL / 2, (499 - p.y) * NATIVE_PIXEL + NATIVE_PIXEL / 2]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] ?? 0, kinds: [...(plan?.kinds ?? [])] };
}

/** The point `s` native units along a way, and the way it faces (a world yaw: 0 +z, +PI/2 +x). @param {Way} way @param {number} s */
export function wayAt(way, s) {
  const { pts, cum } = way;
  if (!pts.length) return { x: 0, z: 0, yaw: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], yaw: 0 };
  const d = Math.max(0, Math.min(way.len, s));
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = cum[i] - cum[i - 1];
  const k = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}

/** A town's half-width on the ground (native), for the trim at each end of a way: its blocks' side, halved, and a margin. @param {LwTown} town */
export const townTrim = (town) => (Math.ceil(Math.sqrt(Math.max(1, town.blocks | 0))) * NATIVE_BLOCK) / 2 + NATIVE_BLOCK / 2;

/** A traveller's cycle holding `day`: its number, its first day and its length (days). @param {Resident} res @param {number} day @param {number} scale */
export function cycleOf(res, day, scale) {
  const len = Math.max(2, Math.round((CYCLE_DAYS[/** @type {keyof typeof CYCLE_DAYS} */ (res.job)] ?? 8) * scale));
  const phase = lwSeed(res.town, res.slot, 0x6379) % len;   // 'cy'
  const k = Math.floor((day + phase) / len);
  return { k, start: k * len - phase, len };
}

/**
 * The trip a traveller makes in cycle `k` (only the traveller's own choice - no caravan yet), null for none, undefined
 * while a way it needs is still being asked.
 * @param {Resident} res @param {LwTown} home @param {number} k @param {TripWorld} world @param {{ mpm: number }} o
 * @returns {Trip|null|undefined}
 */
export function ownTrip(res, home, k, world, { mpm }) {
  const chance = TRIP_CHANCE[/** @type {keyof typeof TRIP_CHANCE} */ (res.job)];
  if (!(chance > 0)) return null;
  const scale = paceScale(mpm);
  const len = Math.max(2, Math.round((CYCLE_DAYS[/** @type {keyof typeof CYCLE_DAYS} */ (res.job)] ?? 8) * scale));
  const phase = lwSeed(res.town, res.slot, 0x6379) % len;
  const start = k * len - phase;
  const rng = lwRng(res.town, res.slot, k, 0x74726970);   // 'trip'
  if (rng() >= chance) return null;
  const [rMin, rMax] = TRIP_RANGE_PX[/** @type {keyof typeof TRIP_RANGE_PX} */ (res.job)] ?? [3, 12];
  const near = world.townsNear(home.px ?? 0, home.py ?? 0, rMax)
    .filter((t) => t.mapId !== home.mapId && Math.max(Math.abs((t.px ?? 0) - (home.px ?? 0)), Math.abs((t.py ?? 0) - (home.py ?? 0))) >= rMin);
  if (!near.length) return null;
  /** @type {Record<string, number>} */
  const weights = {};
  for (const t of near) {
    const d = Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
    const size = Math.pow(Math.max(1, t.blocks | 0), 0.7);
    let w = res.job === 'merchant' ? size / (1 + d / 8) : res.job === 'pilgrim' ? ((world.templeTown?.(t) ? 6 : 0.2) * size) / (1 + d / 12) : 1 / (1 + d / 10);
    if (res.job === 'adventurer') w = size / (1 + d / 6);
    weights[String(t.mapId)] = w;
  }
  // the pick, then the towns nearer than it, the farthest of them first - the trip most like the one chosen that fits
  const pick = pickWeighted(rng, weights);
  const first = near.find((t) => String(t.mapId) === pick);
  if (!first) return null;
  const dist = (t) => Math.hypot((t.px ?? 0) - (home.px ?? 0), (t.py ?? 0) - (home.py ?? 0));
  const nearer = near.filter((t) => t !== first && dist(t) < dist(first)).sort((a, b) => dist(b) - dist(a) || a.mapId - b.mapId);
  const order = [first, ...nearer];
  const pace = (TRIP_PACE[/** @type {keyof typeof TRIP_PACE} */ (res.job)] ?? 1) * mpm * NATIVE_PER_M;   // native a clock minute
  const [sLo, sHi] = STAY_DAYS[/** @type {keyof typeof STAY_DAYS} */ (res.job)] ?? [1, 1];
  const stay = rollInt(rng, sLo, sHi);
  const departH = res.job === 'adventurer' ? 6 + rng() * 2 : 7 + rng() * 2;
  const offsetRoll = rng();
  for (const to of order) {
    const plan = world.routeOf(home, to);
    if (plan === undefined) return undefined;
    if (!plan || !(plan.pixels?.length >= 2)) continue;
    const way = wayOf(plan);
    const trim0 = Math.min(townTrim(home), way.len * 0.4), trim1 = Math.min(townTrim(/** @type {LwTown} */ (to)), way.len * 0.4);
    const walk = Math.max(0, way.len - trim0 - trim1) / pace;   // minutes of daylight walking, each way
    const estDays = 2 * Math.ceil(walk / ((WALK_TO_H - WALK_FROM_H) * 60)) + stay + 1;
    if (estDays > len - 1) continue;
    const dayOffset = Math.floor(offsetRoll * (len - estDays));
    const outT0 = (start + dayOffset) * DAY_MIN + Math.floor(departH * 60);
    const outT1 = whenWalked(outT0, walk);
    const arriveDay = Math.floor(outT1 / DAY_MIN);
    // home again: after the days' stay, of a morning; with no stay, a rest of two hours (in by noon) or the next morning
    const morning = (d) => d * DAY_MIN + 7 * 60 + (lwSeed(res.town, res.slot, k, 0x6261) % 120);   // 'ba'
    const backT0 = Math.max(outT1 + 60, stay > 0 ? morning(arriveDay + stay) : (outT1 - arriveDay * DAY_MIN < 12 * 60 ? outT1 + 120 : morning(arriveDay + 1)));
    const backT1 = whenWalked(backT0, walk);
    if (backT1 > (start + len) * DAY_MIN + DAY_START_MIN) continue;
    return { id: `${res.id}:${k}`, kind: res.job, leader: res, party: [res], from: home, to: /** @type {LwTown} */ (to), way, pace,
      outT0, outT1, backT0, backT1, trim0, trim1 };
  }
  return null;
}

/**
 * THE TOWN'S TRIPS on the road or away at minute `t` - every traveller's own trips of the cycles that can hold it, the
 * caravans made (sellswords hired, pilgrims and couriers joined), each party's trip once (its leader's). Undefined
 * while a way is still being asked.
 * @param {LwTown} town @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {Trip[]|undefined}
 */
export function townTrips(town, t, world, o) {
  const scale = paceScale(o.mpm);
  const day = Math.floor(t / DAY_MIN);
  const roster = world.rosterOf(town);
  let pending = false;
  // a traveller's trip of a cycle never changes: the book keeps it (o.memo), and asks again only while it waits on a way
  /** @param {Resident} res @param {number} k */
  const tripOf = (res, k) => {
    const key = `${res.id}:${k}`;
    let trip = o.memo?.get(key);
    if (trip === undefined) { trip = ownTrip(res, town, k, world, o); if (trip !== undefined) o.memo?.set(key, trip); }
    if (trip === undefined) pending = true;
    return trip ?? null;
  };
  /** @type {Trip[]} */
  const trips = [];
  for (const res of roster) {
    if (!(TRIP_CHANCE[/** @type {keyof typeof TRIP_CHANCE} */ (res.job)] > 0)) continue;
    const cyc = cycleOf(res, day, scale);
    for (const k of [cyc.k - 1, cyc.k]) {
      const trip = tripOf(res, k);
      if (trip && trip.backT1 > t - DAY_MIN && trip.outT0 < t + DAY_MIN) trips.push(trip);
    }
  }
  if (pending) return undefined;
  const made = formCaravans(town, trips, roster, tripOf, scale);
  return pending ? undefined : made;
}

/** The jobs that ride in a merchant's train when it sets out the day they do, for the town they go to. */
const JOINS = new Set(['pilgrim', 'courier', 'pedlar']);

/**
 * THE CARAVANS - each a law of the trips alone, never of which of them a reader happened to ask about (a train read on
 * the third day of its walk is the train that set out):
 *  - A merchant's SELLSWORDS are the town's own under contract to them: the town's sellswords in slot order, dealt to its
 *    merchants in slot order (the first to the first, round again), and a trip takes its merchant's first `want` of them
 *    (the trip's own roll, 0 to HIRE_MAX). A merchant's trips never overlap (each fits its cycle), so neither do theirs.
 *  - A pilgrim's, courier's or pedlar's trip that sets out the day a merchant's does, for the same town, JOINS that
 *    merchant's train - the first merchant in slot order with such a trip - and walks its timeline, its pace.
 * `tripOf(res, k)` the town's traveller's own trip of a cycle (townTrips' book); pure over it.
 * @param {LwTown} town @param {Trip[]} trips - the window's own trips
 * @param {Resident[]} roster @param {(res: Resident, k: number) => Trip|null} tripOf @param {number} scale
 * @returns {Trip[]}
 */
export function formCaravans(town, trips, roster, tripOf, scale) {
  const merchants = roster.filter((r) => r.job === 'merchant').sort((a, b) => a.slot - b.slot);
  const sellswords = roster.filter((r) => r.job === 'mercenary').sort((a, b) => a.slot - b.slot);
  const dayOf = (/** @type {Trip} */ tr) => Math.floor(tr.outT0 / DAY_MIN);
  /** The merchant's trip a joiner's rides in, or null. @param {Trip} j */
  const trainOf = (j) => {
    const d = dayOf(j);
    for (const m of merchants) {
      const mt = tripOf(m, cycleOf(m, d, scale).k);
      if (mt && mt.to.mapId === j.to.mapId && dayOf(mt) === d) return mt;
    }
    return null;
  };
  /** @type {Trip[]} */
  const out = [];
  for (const tr of trips) {
    if (tr.kind === 'merchant') {
      const mi = merchants.findIndex((m) => m.id === tr.leader.id);
      const want = seededRng(lwSeed(tr.leader.town, tr.leader.slot, tr.outT0 | 0, 0x68697265))() * (HIRE_MAX + 1) | 0;   // 'hire'
      const hired = mi < 0 ? [] : sellswords.filter((_, i) => i % merchants.length === mi).slice(0, want);
      const d = dayOf(tr);
      const joined = [];
      for (const r of roster) {
        if (!JOINS.has(r.job)) continue;
        const jt = tripOf(r, cycleOf(r, d, scale).k);
        if (jt && jt.to.mapId === tr.to.mapId && dayOf(jt) === d && trainOf(jt)?.id === tr.id) joined.push(r);
      }
      out.push({ ...tr, party: [tr.leader, ...hired, ...joined] });
    } else if (!(JOINS.has(tr.kind) && trainOf(tr))) out.push(tr);
  }
  return out;
}

/**
 * Where a party is at minute `t`: 'out' or 'back' on the road (walking by day, `camp` by night), 'stay' at the town it
 * went to, 'home' before and after. On the road, `x`/`z` its place (native) and `yaw` the way it walks.
 * @param {Trip} trip @param {number} t
 * @returns {{ phase: 'home'|'out'|'stay'|'back', x?: number, z?: number, yaw?: number, camp?: boolean, s?: number }}
 */
export function partyAt(trip, t) {
  const { way, pace, trim0, trim1 } = trip;
  const walk = Math.max(0, way.len - trim0 - trim1);
  const daylight = (m) => { const h = (((m % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60; return h >= WALK_FROM_H && h < WALK_TO_H; };
  if (t < trip.outT0 || t >= trip.backT1) return { phase: 'home' };
  if (t < trip.outT1) {
    const s = trim0 + Math.min(walk, pace * walkedMinutes(trip.outT0, t));
    const p = wayAt(way, s);
    return { phase: 'out', x: p.x, z: p.z, yaw: p.yaw, camp: !daylight(t), s };
  }
  if (t < trip.backT0) return { phase: 'stay' };
  const s = way.len - trim1 - Math.min(walk, pace * walkedMinutes(trip.backT0, t));
  const p = wayAt(way, s);
  return { phase: 'back', x: p.x, z: p.z, yaw: p.yaw + Math.PI, camp: !daylight(t), s };
}

/** The way a trip leaves its home toward (a world yaw, off its way's first leg past the town's trim). @param {Trip} trip */
export const leavingYaw = (trip) => wayAt(trip.way, trip.trim0 + 1).yaw;
/** The way a trip comes into the town it goes to from (a world yaw out of that town toward the road). @param {Trip} trip */
export const arrivingYaw = (trip) => wayAt(trip.way, trip.way.len - trip.trim1 - 1).yaw + Math.PI;

/**
 * A home town's away windows for a resident on `day` - each trip of theirs (their own, or a caravan they ride with)
 * touching the living day: out at its first minute, home at its last; armed where they carry a class.
 * @param {Resident} res @param {Trip[]} trips - townTrips' answer for the day
 * @returns {{ t0: number, t1: number, yaw: number, armed: boolean }[]}
 */
export function awayOf(res, trips) {
  const out = [];
  for (const tr of trips) if (tr.party.some((p) => p.id === res.id)) out.push({ t0: tr.outT0, t1: tr.backT1, yaw: leavingYaw(tr), armed: res.cls != null });
  return out.sort((a, b) => a.t0 - b.t0);
}

/**
 * The visitors a town has on `day`: the parties of the towns within TRIP_REACH_PX staying in it that day - each member
 * with the minute they come in (at the exit facing the road they came), the minute they leave by it, and its way.
 * Undefined while a way is still being asked.
 * @param {LwTown} town @param {number} day @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @returns {{ res: Resident, trip: Trip, inT: number, outT: number, yaw: number }[] | undefined}
 */
export function visitorsOf(town, day, world, o) {
  const D0 = day * DAY_MIN + DAY_START_MIN, D1 = D0 + DAY_MIN;
  const out = [];
  let pending = false;
  for (const from of world.townsNear(town.px ?? 0, town.py ?? 0, TRIP_REACH_PX)) {
    if (from.mapId === town.mapId) continue;
    const trips = townTrips(from, D0 + DAY_MIN / 2, world, o);
    if (trips === undefined) { pending = true; continue; }
    for (const tr of trips) {
      if (tr.to.mapId !== town.mapId || !(tr.outT1 < D1 && tr.backT0 > D0)) continue;
      for (const res of tr.party) out.push({ res, trip: tr, inT: tr.outT1, outT: tr.backT0, yaw: arrivingYaw(tr) });
    }
  }
  return pending ? undefined : out;
}

/**
 * The parties on the road within `rPx` map pixels of a pixel at minute `t` - every town within reach of it (a trip
 * runs at most TRIP_REACH_PX from its home), each party's place. `pending` while a way is still being asked (the
 * parties whose ways are known are answered meanwhile).
 * @param {number} px @param {number} py @param {number} t @param {TripWorld} world @param {{ mpm: number, memo?: Map<string, Trip|null> }} o
 * @param {number} [rPx]
 * @returns {{ parties: { trip: Trip, at: ReturnType<typeof partyAt> }[], pending: boolean }}
 */
export function partiesNear(px, py, t, world, o, rPx = 6) {
  const parties = [];
  let pending = false;
  for (const town of world.townsNear(px, py, rPx + TRIP_REACH_PX)) {
    const trips = townTrips(town, t, world, o);
    if (trips === undefined) { pending = true; continue; }
    for (const trip of trips) {
      const at = partyAt(trip, t);
      if (at.phase !== 'out' && at.phase !== 'back') continue;
      const ppx = Math.floor(/** @type {number} */ (at.x) / NATIVE_PIXEL), ppy = 499 - Math.floor(/** @type {number} */ (at.z) / NATIVE_PIXEL);
      if (Math.max(Math.abs(ppx - px), Math.abs(ppy - py)) <= rPx) parties.push({ trip, at });
    }
  }
  return { parties, pending };
}
