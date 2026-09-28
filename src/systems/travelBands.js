// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV7 - THE ROAMING BANDS (bible/06-Systems/Travel-View.md, THE OVERHAUL).
//
// Mac (2026-09-28): "think mount and blade and how you can see enemies in the overworld. Like a true overhaul for the
// new overworld"; his calls "Roaming parties" and "Shared per area". Enemy bands roam the wilderness and are seen from
// the Overworld; one that SPOTS the traveller CHASES; one that reaches them stands as the real foes it was.
//
// SHARED WITH NOTHING SENT: a band is BORN of the land and the shared clock - a pure function of (a cell of map pixels,
// a life's bucket of shared milliseconds) and BAND_SEED, as TV4's storms are of the weather's - so every player in an
// area computes the same bands, where they are and where they wander, and nobody tells anybody. What the band IS (its
// members) is Daggerfall's own tables, rolled from the band's own seed by the host (campEncounters rollGroupComposition,
// the climate x day/night table - none in a town's rect by day); where it wanders is a seeded walk that turns back off
// water and out of towns (the host's `ok`). Only a CHASE is one player's (the chased one simulates it).
//
// PURE: the host hands the clock, the land's test and the traveller's feet; everything here is arithmetic.
// ═══════════════════════════════════════════════════════════════════
import { seededRng } from './wind.js';
import { NATIVE_PER_M } from './travelDungeons.js';   // one home: native units a metre

/** The band's world: a cell of this many map pixels square has one chance of a band a life. */
export const BAND_CELL_PX = 2;
/** A band's life, real milliseconds on the shared clock - born at its bucket's start, gone at its end. */
export const BAND_LIFE_MS = 12 * 60 * 1000;
/** The chance a cell holds a band in a life (by day, by night). */
export const BAND_CHANCE_DAY = 0.3;
export const BAND_CHANCE_NIGHT = 0.45;
/** A wandering band's pace (m/s) and how long it keeps one heading (ms). */
export const BAND_WANDER_MPS = 1.3;
export const BAND_LEG_MS = 75 * 1000;
/** How far a band sees a traveller (m), by day and by night. */
export const BAND_SIGHT_DAY_M = 320;
export const BAND_SIGHT_NIGHT_M = 190;
/** A chasing band's pace (m/s): a runner's - a walker is caught, a rider gets away. */
export const BAND_CHASE_MPS = 5.2;
/** A chase given up past this far (m), or after this long without closing (ms). */
export const BAND_LEASH_M = 900;
export const BAND_GIVE_UP_MS = 120 * 1000;
/** Contact (m): under the Overworld the band must reach the traveller; with the view down it stands as foes this near. */
export const BAND_CONTACT_M = 30;
export const BAND_STAND_M = 140;
/** The bands the host is asked about: the cells within this many map pixels of the traveller. */
export const BAND_REACH_PX = 6;
const PIXEL_NATIVE = 32768;
/** The bands' own salt - a band is never a storm. */
const BAND_SEED = 0x42414e44;   // 'BAND'

/** A cell's life's seed. */
const seedOf = (cx, cy, life) => (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(life, 83492791) ^ BAND_SEED) >>> 0;

/**
 * THE BAND a cell holds in a life, or null: `{ id, cx, cy, life, seed, born: {x, z} (native), bornMs }`. `night` is
 * whether the life begins at night (the host's clock); `ok(x, z)` the land's test (not water, not a town's rect).
 * @param {{ cx: number, cy: number, life: number, night: boolean, ok: (x: number, z: number) => boolean }} q
 */
export function bandOf({ cx, cy, life, night, ok }) {
  const seed = seedOf(cx, cy, life);
  const r = seededRng(seed);
  if (r() >= (night ? BAND_CHANCE_NIGHT : BAND_CHANCE_DAY)) return null;
  const span = BAND_CELL_PX * PIXEL_NATIVE;
  const x = cx * span + r() * span, z = cy * span + r() * span;
  if (!ok(x, z)) return null;   // born in the water or a town: no band this life
  return { id: `b${cx}.${cy}.${life}`, cx, cy, life, seed, born: { x, z }, bornMs: life * BAND_LIFE_MS };
}

/**
 * WHERE A WANDERING BAND IS at shared time `ms` (native `{x, z}`, and its heading): leg by leg from its birth, each leg a
 * seeded heading at BAND_WANDER_MPS; a leg whose end fails `ok` turns back the way it came.
 * @param {any} band
 * @param {number} ms
 * @param {(x: number, z: number) => boolean} ok
 */
export function wanderAt(band, ms, ok) {
  const r = seededRng((band.seed ^ 0x5157) >>> 0);
  let x = band.born.x, z = band.born.z, heading = r() * Math.PI * 2;
  let t = Math.max(0, Math.min(BAND_LIFE_MS, ms - band.bornMs));
  const legNative = (dt) => (BAND_WANDER_MPS * dt / 1000) * NATIVE_PER_M;
  while (t > 0) {
    const dt = Math.min(t, BAND_LEG_MS);
    const d = legNative(dt);
    let nx = x + Math.sin(heading) * d, nz = z + Math.cos(heading) * d;
    if (!ok(nx, nz)) { heading += Math.PI; nx = x + Math.sin(heading) * d; nz = z + Math.cos(heading) * d; if (!ok(nx, nz)) { nx = x; nz = z; } }
    x = nx; z = nz;
    t -= dt;
    if (dt === BAND_LEG_MS) heading += (r() - 0.5) * Math.PI;   // the next leg bends up to a quarter turn either way
  }
  return { x, z, heading };
}

/**
 * THE BANDS about the traveller's pixel at shared time `ms`: every cell within BAND_REACH_PX, this life's band in it.
 * @param {{ at: {x:number,y:number}, ms: number, night: boolean, ok: (x:number, z:number) => boolean, reach?: number }} q
 */
export function bandsNear({ at, ms, night, ok, reach = BAND_REACH_PX }) {
  const life = Math.floor(ms / BAND_LIFE_MS);
  const c0x = Math.floor((at.x - reach) / BAND_CELL_PX), c1x = Math.floor((at.x + reach) / BAND_CELL_PX);
  const c0y = Math.floor((at.y - reach) / BAND_CELL_PX), c1y = Math.floor((at.y + reach) / BAND_CELL_PX);
  const out = [];
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const b = bandOf({ cx, cy, life, night, ok });
    if (b) out.push(b);
  }
  return out;
}

/** How far a band sees: shorter by night. */
export const bandSight = (night) => (night ? BAND_SIGHT_NIGHT_M : BAND_SIGHT_DAY_M);

/**
 * ONE STEP OF A CHASE (`dt` real seconds, `scale` the journey's time scale - a band on the map keeps the map's pace):
 * the band closes on the feet at BAND_CHASE_MPS. Returns the new position and what happened: 'contact' (within `contact`
 * metres), 'lost' (past the leash, or too long without closing), or null (still running).
 * @param {{ pos: {x:number,z:number}, feet: {x:number,z:number}, dt: number, scale?: number, contact: number,
 *   since: number, now: number, best: number }} q  `since` the chase's start, `best` its nearest yet (m)
 */
export function chaseStep({ pos, feet, dt, scale = 1, contact, since, now, best }) {
  const dx = feet.x - pos.x, dz = feet.z - pos.z;
  const dist = Math.hypot(dx, dz) / NATIVE_PER_M;   // metres
  const step = Math.min(dist, BAND_CHASE_MPS * dt * Math.max(1, scale));
  const k = dist > 1e-6 ? (step / dist) : 0;
  const np = { x: pos.x + dx * k, z: pos.z + dz * k };
  const left = dist - step;
  const closer = Math.min(best, left);
  if (left <= contact) return { pos: np, dist: left, best: closer, what: 'contact' };
  if (left > BAND_LEASH_M || (now - since > BAND_GIVE_UP_MS && left >= best - 1)) return { pos: np, dist: left, best: closer, what: 'lost' };
  return { pos: np, dist: left, best: closer, what: null };
}

/** A band's words over its marker: its kind and its number ("Orcs, 4"). */
export function bandLabel(kindName, n) {
  const k = String(kindName ?? '').trim();
  return k ? `${k}, ${n}` : `A band, ${n}`;
}
