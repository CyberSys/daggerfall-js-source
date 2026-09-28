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
/** A chasing band's pace (m/s): a runner's - a slow walker is caught; a quick one, a runner or a rider gets away. */
export const BAND_CHASE_MPS = 5.2;
/** A chase given up past this far (m), or after this long without closing (ms). */
export const BAND_LEASH_M = 900;
export const BAND_GIVE_UP_MS = 120 * 1000;
/** Contact (m): under the Overworld the band must reach the traveller; with the view down it stands as foes this near. */
export const BAND_CONTACT_M = 30;
export const BAND_STAND_M = 140;
/** AUDIT OW5 B2: the nearest a band's anchor stands to the traveller (m) - its members, a pack's spacing about it, never
 *  on top of them. A band stands where it IS, this or farther. */
export const BAND_STAND_MIN_M = 18;
/** AUDIT OW3 T7-1: a contact whose band finds no ground to stand on (the road, a town's rect, a full foe pool) tries again
 *  this often (ms), this many times, before the band is lost - never spent unstood on the first refusal. */
export const BAND_STAND_RETRY_MS = 1500;
export const BAND_STAND_TRIES = 5;
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
  return { id: `b${cx}.${cy}.${life}`, cx, cy, life, seed, night, born: { x, z }, bornMs: life * BAND_LIFE_MS };
}

/** AUDIT OW3 T7-4: the seed a band's MAKE is rolled from - its own stream, never the birth's (whose first draw is under
 *  the spawn chance by construction, so the table's d100 could never pass 45 and its > 80 picks never came). */
export const bandMakeSeed = (band) => (band.seed ^ 0x4d414b45) >>> 0;   // 'MAKE'

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
  const full = legNative(BAND_LEG_MS);
  while (t > 0) {
    const dt = Math.min(t, BAND_LEG_MS);
    const d = legNative(dt);
    // AUDIT OW3 T7-6: a leg's way is chosen by its WHOLE end, whatever part of it is walked - so a leg part-walked never
    // flips mid-way (a band that jumped eighty metres in a quarter second beside the water)
    let go = ok(x + Math.sin(heading) * full, z + Math.cos(heading) * full);
    if (!go) { heading += Math.PI; go = ok(x + Math.sin(heading) * full, z + Math.cos(heading) * full); }
    if (go) { x += Math.sin(heading) * d; z += Math.cos(heading) * d; }
    t -= dt;
    if (dt === BAND_LEG_MS) heading += (r() - 0.5) * Math.PI;   // the next leg bends up to a quarter turn either way
  }
  return { x, z, heading };
}

/** AUDIT OW4 B1: THE BANDS' PIXEL of a MAP pixel - the bands' cells run on native z (a cell's row is z / 32768 / CELL),
 *  the map's y runs the other way (499 - that; mapsFile worldCoordToMapPixel). The host handed the map's y straight in,
 *  and every band stood at the mirror of its latitude across row 249.5 - two hundred kilometres off, nobody ever met one. */
export const bandPixelOf = (mapPixel) => ({ x: mapPixel.x, y: 499 - mapPixel.y });

/**
 * THE BANDS about the traveller's pixel at shared time `ms` (`at` in the bands' own convention - bandPixelOf): every
 * cell within BAND_REACH_PX, this life's band in it.
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
 * the band closes on the feet at BAND_CHASE_MPS. Returns the new position, its nearest and when it last closed, and what
 * happened: 'contact' (within `contact` metres), 'lost' (past the leash, or BAND_GIVE_UP_MS without closing a metre),
 * or null (still running).
 * AUDIT OW5 B5: it closes to the contact's ring and NO NEARER - where it stands is the side it came from. A step was
 * the whole way when it could be, and a band on the traveller's own feet had no bearing at all: the one read there was
 * float noise (a fast frame head-on, or a band riding along through a won roll's grace), and it stood anywhere.
 * @param {{ pos: {x:number,z:number}, feet: {x:number,z:number}, dt: number, scale?: number, contact: number,
 *   gainAt: number, now: number, best: number }} q  `best` its nearest yet (m), `gainAt` when it last came a metre nearer
 *   (`now` and `gainAt` on the chase's own clock - the host's, which a hold does not run)
 */
export function bandChaseStep({ pos, feet, dt, scale = 1, contact, gainAt, now, best }) {
  const dx = feet.x - pos.x, dz = feet.z - pos.z;
  const dist = Math.hypot(dx, dz) / NATIVE_PER_M;   // metres
  const step = Math.min(Math.max(0, dist - contact), BAND_CHASE_MPS * dt * Math.max(1, scale));
  const k = dist > 1e-6 ? (step / dist) : 0;
  const np = { x: pos.x + dx * k, z: pos.z + dz * k };
  const left = dist - step;
  // AUDIT OW3 T7-3: closing is a METRE nearer than the nearest yet, and the clock runs from the last one - a band gaining
  // a few centimetres a frame closed on nobody (the nearest was the last frame's) and gave every chase up at two minutes
  const gained = left < best - 1;
  const closer = gained ? left : best, at = gained ? now : gainAt;
  if (left <= contact) return { pos: np, dist: left, best: closer, gainAt: at, what: 'contact' };
  if (left > BAND_LEASH_M || now - at > BAND_GIVE_UP_MS) return { pos: np, dist: left, best: closer, gainAt: at, what: 'lost' };
  return { pos: np, dist: left, best: closer, gainAt: at, what: null };
}

/** A band's words over its marker: its kind and its number ("Orcs, 4"). */
export function bandLabel(kindName, n) {
  const k = String(kindName ?? '').trim();
  return k ? `${k}, ${n}` : `A band, ${n}`;
}

// ── TV7b - THE CHASE, SHARED ─────────────────────────────────────────────────────────────────────────────────────────
// A band is the same for everyone without a word; its CHASE is the chased player's. The chaser's client says so in its
// own foes frame under `bd` (as the World of Daggerfall camps' `st`/`sp` ride - validated here, at the reader, never by
// the relay, which reads a frame's record count and nothing else: no relay change): each band it chases with where it
// is, and each band that fought or lost the trail, so every reader shows the chase and none stands that band again.

/** A band's id on the wire: `b<cx>.<cy>.<life>`. */
export const BAND_ID_RE = /^b-?\d{1,4}\.-?\d{1,4}\.\d{1,9}$/;
/** The most bands one frame may name. */
export const BANDS_WIRE_MAX = 8;
/** A chase word heard is believed this long (ms) - a frame every FOES_MS, so a chaser that stopped saying so is gone. */
export const BAND_WORD_MS = 3000;
/** The world's extent in native units - a band's place is inside it. */
const WORLD_NATIVE_W = 1000 * 32768, WORLD_NATIVE_H = 500 * 32768;

/**
 * The band word I say: `[[id, x, z, 1], ...]` for each band chasing me (its place, native, whole units), then
 * `[[id, 0, 0, 2], ...]` for the bands spent here (fought or lost), newest first - at most BANDS_WIRE_MAX in all.
 * @param {Map<string, {pos: {x:number, z:number}}>} chases
 * @param {string[]} spent
 */
export function bandWordOf(chases, spent) {
  const out = [];
  for (const [id, c] of chases ?? []) { if (out.length >= BANDS_WIRE_MAX) break; out.push([id, Math.round(c.pos.x), Math.round(c.pos.z), 1]); }
  for (const id of spent ?? []) { if (out.length >= BANDS_WIRE_MAX) break; out.push([id, 0, 0, 2]); }
  return out;
}

/** A band word heard, projected: the valid entries, each band once, at most BANDS_WIRE_MAX. */
export function validBandWord(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [], seen = new Set();
  for (const e of raw) {
    if (out.length >= BANDS_WIRE_MAX) break;
    if (!Array.isArray(e) || e.length !== 4) continue;
    const [id, x, z, flag] = e;
    if (typeof id !== 'string' || !BAND_ID_RE.test(id) || seen.has(id)) continue;
    if (flag !== 1 && flag !== 2) continue;
    if (flag === 1 && !(Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x <= WORLD_NATIVE_W && z <= WORLD_NATIVE_H)) continue;
    seen.add(id);
    out.push([id, flag === 1 ? x : 0, flag === 1 ? z : 0, flag]);
  }
  return out;
}

/** AUDIT OW3 T7-9: a band id's life, and whether a word naming it can be about a band near me - this life's or the one
 *  just over, a cell within the reach about my pixel. A peer's word naming any other is nobody's band here: never kept,
 *  so what a peer says is bounded by what could be about me (a hostile one grew the tables a hundred ids a second). */
export const bandLifeOf = (id) => Number(String(id).slice(String(id).lastIndexOf('.') + 1));
export function bandNearMe(id, at, life) {
  const m = /^b(-?\d+)\.(-?\d+)\.(\d+)$/.exec(String(id));
  if (!m) return false;
  const l = Number(m[3]);
  if (l !== life && l !== life - 1) return false;
  const reach = BAND_REACH_PX + BAND_CELL_PX;
  return Math.abs(Number(m[1]) * BAND_CELL_PX - at.x) <= reach && Math.abs(Number(m[2]) * BAND_CELL_PX - at.y) <= reach;
}

/** Two players chasing one band (both saw it in the same breath): the lower id keeps it - every client answers alike. */
export const chaseYields = (mine, theirs) => String(theirs) < String(mine);
