// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OWS3 - WARM ASHES' RAIDERS, SEEN COMING (bible/06-Systems/Travel-View.md,
// "OWS - the sea"). The player's ask: "The pirate quest system should work
// like how we're changing enemies and nearby dungeons. Like mount and
// blade, being able to see other players sailing in the overworld and
// other enemy ships".
//
// Warm Ashes - Ships' raid is a roll the traveller never sees: a sea
// crossing by fast travel, three in four in peace, and the ambush
// (systems/warmAshesShips.js). The Overworld's sea has its raiders as
// SHIPS instead: they sail its open water, and a sail that sights a
// traveller at sea gives chase; outsailed it gives up, and the one that
// closes makes the mod's own raid (WAQ_SHIP_SMALLRAID, the ship boarded).
//
// SHARED BY THEIR SEED, never sent: a cell of RAIDER_CELL_PX map pixels
// holds at most one raider a life (RAIDER_LIFE_MS of the shared clock),
// rolled from the cell and the life alone, and it wanders a course that
// is a function of its seed and the clock - so every player in the
// region sees the same sails in the same places at the same minute. A
// chase is the chased traveller's own (TV7's roaming bands' way, on the
// Overworld round's branch).
//
// PLACES ARE NATIVE WORLD UNITS (32768 a map pixel) and a pixel's row
// counts SOUTH from the map's top: z = (499 - row) x 32768 +, MapsFile's
// own two (formats/mapsFile.js mapPixelToWorldCoord / worldCoordToMapPixel)
// - the one law travellerMarks.js keeps too.
//
// PURE: numbers in, ships out.
// ═══════════════════════════════════════════════════════════════════

import { mapPixelToWorldCoord, worldCoordToMapPixel } from '../formats/mapsFile.js';
import { seededRng } from './wind.js';   // mulberry32, the weather's own - one home

export { seededRng };

/** Native world units a map pixel. */
export const NATIVE_PIXEL = 32768;
/** A cell: this many map pixels a side (about 4.9 km). */
export const RAIDER_CELL_PX = 6;
/** A raider's life, of the shared clock - a new roll after it. */
export const RAIDER_LIFE_MS = 20 * 60 * 1000;
/** A cell's chance of a raider in a life. */
export const RAIDER_CHANCE = 0.35;
/** How fast a raider sails its own course (m/s) - a merchantman's reach; and the leg of its course between bends. */
export const RAIDER_SAIL_MPS = 3;
export const RAIDER_LEG_MS = 120000;
/** How far a raider's lookout sees a sail (m): by day, and by night. */
export const RAIDER_SIGHT_M = 1000;
export const RAIDER_SIGHT_NIGHT_M = 500;
/** A chase's way (m/s) - the Large Boat before a fair wind outsails it, becalmed or beating it is caught. */
export const RAIDER_CHASE_MPS = 4.2;
/** A chase given up: the quarry farther than this (m)... */
export const RAIDER_LEASH_M = 3000;
/** ...or this long (ms) without closing on it. */
export const RAIDER_GIVE_UP_MS = 180000;
/** Alongside (m): under the Overworld's view, and in play (where the hulls are not drawn, a ship's length off). */
export const RAIDER_CONTACT_M = 60;
export const RAIDER_CONTACT_PLAY_M = 120;
/** The cells asked about the traveller: every one within this many map pixels. */
export const RAIDER_REACH_PX = 12;
/** What a raider is called on the map - the raid quest's own word ("You've been attacked by pirates"). */
export const RAIDER_LABEL = 'Pirates';
/** The seed's salt: "RAID". */
const RAIDER_SEED = 0x52414944;
const M = NATIVE_PIXEL / 819.2;   // native units a metre

/** A map pixel's native origin corner: its row counted south (MapsFile.MapPixelToWorldCoord). */
export const nativeOfPixel = (px, py) => { const w = mapPixelToWorldCoord(px, py); return { x: w.x, z: w.y }; };
/** The map pixel a native point stands in (MapsFile.WorldCoordToMapPixel). */
export const pixelOfNative = (x, z) => worldCoordToMapPixel(x, z);

const seedOf = (cx, cy, life) => (Math.imul(cx + 1013, 73856093) ^ Math.imul(cy + 2029, 19349663) ^ Math.imul(life + 7, 83492791) ^ RAIDER_SEED) >>> 0;

/**
 * THE RAIDER of a cell in a life, or null: the chance rolled, its birth pixel drawn in the cell and its place within
 * that pixel, refused unless `open(px, py)` (the host's open sea: the pixel and all about it water, the ocean's).
 * @param {{ cx: number, cy: number, life: number, open: (px: number, py: number) => boolean }} q
 */
export function raiderOf({ cx, cy, life, open }) {
  const seed = seedOf(cx, cy, life);
  const r = seededRng(seed);
  if (r() >= RAIDER_CHANCE) return null;
  const px = cx * RAIDER_CELL_PX + Math.floor(r() * RAIDER_CELL_PX), py = cy * RAIDER_CELL_PX + Math.floor(r() * RAIDER_CELL_PX);
  if (!open(px, py)) return null;
  const o = nativeOfPixel(px, py);
  return { id: `r${cx}.${cy}.${life}`, cx, cy, life, seed, born: { x: o.x + r() * NATIVE_PIXEL, z: o.z + r() * NATIVE_PIXEL }, bornMs: life * RAIDER_LIFE_MS, heading0: r() * Math.PI * 2 };
}

/** AUDIT OW5 S4: how many points along a leg are asked for water - one every RAIDER_LEG_MS's run over this (about 22 m
 *  of its 360), so no leg cuts a land pixel's corner by more than that. */
export const RAIDER_LEG_PROBES = 16;

/**
 * WHERE A RAIDER IS at shared time `ms`, and its heading - its course from birth, leg by leg: each full leg bends up to
 * a quarter turn either way; a leg that is not `sea(x, z)` (native) all along is sailed the other way, and a raider with
 * no water either way lies to. Stateless: every player computes the same.
 * AUDIT OW5 S4: A LEG'S WAY IS CHOSEN BY THE WHOLE LEG (the bands' own AUDIT OW3 T7-6), and a leg part-sailed keeps it.
 * The part-sailed leg asked only its own moving end, so the moment that end touched land it flipped - the raider jumped
 * from a way out to as far the other way (up to 700 m in a breath, within a lookout's sight at once) - and a full leg
 * asked only its end, so it sailed across a cape to water beyond.
 * @returns {{ x: number, z: number, heading: number }}
 */
export function raiderAt(raider, ms, sea) {
  const r = seededRng(raider.seed ^ 0x9e3779b9);
  const t = Math.max(0, Math.min(RAIDER_LIFE_MS, ms - raider.bornMs));
  const legs = Math.floor(t / RAIDER_LEG_MS);
  let x = raider.born.x, z = raider.born.z, h = raider.heading0;
  const step = RAIDER_SAIL_MPS * M * (RAIDER_LEG_MS / 1000);
  const clear = (hd) => {
    for (let k = 1; k <= RAIDER_LEG_PROBES; k++) {
      const f = (step * k) / RAIDER_LEG_PROBES;
      if (!sea(x + Math.sin(hd) * f, z + Math.cos(hd) * f)) return false;
    }
    return true;
  };
  /** The leg sailed `frac` of its length: its way chosen by the whole leg, ahead, else back; neither, it lies to. */
  const sail = (frac) => {
    const way = clear(h) ? h : clear(h + Math.PI) ? h + Math.PI : null;
    if (way == null) return;
    h = way;
    x += Math.sin(h) * step * frac; z += Math.cos(h) * step * frac;
  };
  for (let k = 0; k < legs; k++) {
    sail(1);
    h += (r() - 0.5) * Math.PI;   // the bend at the leg's end
  }
  sail((t - legs * RAIDER_LEG_MS) / RAIDER_LEG_MS);
  return { x, z, heading: h };
}

/**
 * THE RAIDERS about the traveller's map pixel `at` at shared time `ms`: every cell within `reach` pixels, this life's
 * raider in it, where it sails now.
 * @param {{ at: {x:number,y:number}, ms: number, open: (px:number, py:number) => boolean, sea: (x:number, z:number) => boolean, reach?: number }} q
 */
export function raidersNear({ at, ms, open, sea, reach = RAIDER_REACH_PX }) {
  const life = Math.floor(ms / RAIDER_LIFE_MS);
  const c0x = Math.floor((at.x - reach) / RAIDER_CELL_PX), c1x = Math.floor((at.x + reach) / RAIDER_CELL_PX);
  const c0y = Math.floor((at.y - reach) / RAIDER_CELL_PX), c1y = Math.floor((at.y + reach) / RAIDER_CELL_PX);
  const out = [];
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      const raider = raiderOf({ cx, cy, life, open });
      if (raider) out.push({ ...raider, ...raiderAt(raider, ms, sea) });
    }
  }
  return out;
}

/** How far a raider's lookout sees. */
export const raiderSight = (night) => (night ? RAIDER_SIGHT_NIGHT_M : RAIDER_SIGHT_M);

/**
 * ONE STEP OF A CHASE: the raider at `pos` (native) closes on `quarry` at the chase's way, the world's time scale on it.
 * 'contact' alongside; 'lost' past the leash, given up (no metre gained on its best for RAIDER_GIVE_UP_MS), or balked
 * by land (its next place not `sea` - a raider sails no isthmus); else the new place, and its best and when.
 * Metres between them in `left`.
 * @param {{ pos: {x:number,z:number}, quarry: {x:number,z:number}, dt: number, scale: number, contact: number, now: number,
 *   best: number, bestAt: number, sea: (x:number, z:number) => boolean }} q
 */
export function chaseStep({ pos, quarry, dt, scale, contact, now, best, bestAt, sea }) {
  const dx = quarry.x - pos.x, dz = quarry.z - pos.z;
  const dist = Math.hypot(dx, dz) / M;
  const move = Math.min(dist, RAIDER_CHASE_MPS * dt * Math.max(1, scale));
  const k = dist > 0 ? move / dist : 0;
  const next = { x: pos.x + dx * k, z: pos.z + dz * k };
  const left = dist - move;
  if (left <= contact) return { state: 'contact', pos: next, left, best: Math.min(best, left), bestAt: now };
  if (!sea(next.x, next.z)) return { state: 'lost', pos, left: dist, best, bestAt };
  const gained = left < best - 1;
  const b = gained ? left : best, at = gained ? now : bestAt;
  if (left > RAIDER_LEASH_M || now - at > RAIDER_GIVE_UP_MS) return { state: 'lost', pos: next, left, best: b, bestAt: at };
  return { state: 'chase', pos: next, left, best: b, bestAt: at };
}
