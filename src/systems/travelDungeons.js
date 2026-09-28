// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV6 - THE DUNGEONS, DISCOVERED ON APPROACH (bible/06-Systems/Travel-View.md, THE OVERHAUL).
//
// Mac (2026-09-28): "Random encounters and nearby dungeons implemented should somehow be detailed implemented into the
// new overworld ... Like a true overhaul for the new overworld"; his call "Discover on approach". Every dungeon within
// TV_FAR_RANGE of the traveller stands on the Overworld: a discovered one is a plate with its name and distance (a
// journey there, as a far town is), an undiscovered one an unnamed mark at its place. Coming within TV_DUNGEON_FIND_M of
// an undiscovered one DISCOVERS it and says so - a departure from DFU (PlayerGPS discovers on the location's rect and
// says nothing), Mac's call, on the enhanced interface alone.
//
// A dungeon is DFU's travel-map "dungeons" filter (the map's pixel colours 0-4): a labyrinth, a keep, a ruin, a
// graveyard, a coven.
//
// PURE: the host hands the index, the discovery test and each dungeon's middle; the list is rebuilt when the
// traveller's pixel (or what is known) changes, and the find is asked a few times a second.
// ═══════════════════════════════════════════════════════════════════
import { LOCATION_TYPES } from '../formats/mapsFile.js';
import { TV_FAR_RANGE } from './travelFarPlaces.js';

/** The dungeons the Overworld speaks for - the travel map's own "dungeons" filter. */
export const TV_DUNGEON_TYPES = Object.freeze(new Set([LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep,
  LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard, LOCATION_TYPES.Coven]));
/** The most dungeons marked at once, the nearest first. */
export const TV_DUNGEON_MAX = 12;
/** How near an undiscovered dungeon's middle the traveller comes to find it (metres). */
export const TV_DUNGEON_FIND_M = 1000;
/** Native world units a metre (a map pixel is 32768 units, 819.2 m). */
export const NATIVE_PER_M = 32768 / 819.2;

/** The words a find says. */
export const dungeonFoundText = (name) => `You have found ${name}.`;

/**
 * The world's dungeons, once: `{ x, y, loc }` for every location of TV_DUNGEON_TYPES in the host's pixel index (a Map
 * of "x,y" -> the location, world.js locationIndex).
 * @param {Map<string, any>} index
 */
export function dungeonPixels(index) {
  const out = [];
  for (const [key, loc] of index ?? []) {
    if (!loc?.name || !TV_DUNGEON_TYPES.has(loc.mapTableData?.locationType)) continue;
    const c = key.indexOf(',');
    out.push({ x: Number(key.slice(0, c)), y: Number(key.slice(c + 1)), loc });
  }
  return out;
}

/**
 * THE DUNGEONS about pixel `at`, within `range` (a circle, map pixels), nearest first, at most `max`. Each
 * `{ x, y, loc, d, found }` - `found` whether it is discovered (`isFound(x, y)`), `d` in map pixels.
 * @param {{ at: {x:number,y:number}, dungeons: Array<{x:number,y:number,loc:any}>, isFound: (x:number, y:number) => boolean,
 *   range?: number, max?: number }} q
 */
export function nearDungeons({ at, dungeons, isFound, range = TV_FAR_RANGE, max = TV_DUNGEON_MAX }) {
  const out = [];
  for (const g of dungeons ?? []) {
    const d = Math.hypot(g.x - at.x, g.y - at.y);
    if (d > range) continue;
    out.push({ x: g.x, y: g.y, loc: g.loc, d, found: !!isFound(g.x, g.y) });
  }
  out.sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y);
  return out.slice(0, max);
}

/**
 * THE FIND: the undiscovered dungeon whose middle (`mid(g)`, native units) lies within TV_DUNGEON_FIND_M of the
 * traveller's feet (native `{x, z}`), the nearest - or null.
 * @param {{ feet: {x:number,z:number}, list: Array<any>, mid: (g:any) => ({x:number,z:number}|null) }} q
 */
export function dungeonToFind({ feet, list, mid }) {
  let best = null, bestD = TV_DUNGEON_FIND_M * NATIVE_PER_M;
  for (const g of list ?? []) {
    if (g.found) continue;
    const m = mid(g);
    if (!m) continue;
    const d = Math.hypot(m.x - feet.x, m.z - feet.z);
    if (d <= bestD) { best = g; bestD = d; }
  }
  return best;
}
