// ARENA1 (2026-10-02): A HOUSE THE ARENA TOOK, MOVED - ONCE, OFFLINE. Mac, 2026-10-02: "Move them to a new house."
//
// GEMSAL03 (Daggerfall's cell 4,3) stood fifteen houses and a house of the Academics; the arena's block stands none
// (world/arenaCity.js). A deed whose building key names a building of that cell names nothing now, so at the first
// load that stands the arena the deed is moved: to an unowned house of the same type elsewhere in Daggerfall (any
// house when none of its type is free), never one another record holds or an active quest's, chosen by the house
// market's own generator (systems/banking.js housesForSale: xorshift32) seeded by the city's map id and the old key
// - one answer for one save, whatever order the city's buildings were read in. Its scene goes with it (the decor
// placed in it, the furniture taken out, the chests, the floor - systems/sceneCache.js renameScene, its permanence
// too), the old cell's discovered buildings are forgotten, the new house is discovered as the player's residence, and
// the Daggerfall Bank says so in a letter (systems/arenaText.js) and the notebook.
//
// Online homes are the account service's (ARENA4): the service moves each home row in one migration - see
// bible/11-Multiplayer/Arena.md "ARENA1 record". Every other record keyed to the cell (a rented room, a repair
// ticket, a quest site, an inside save, a Recall anchor) needs no move: layoutPins.recordStands answers false for it
// (world/arenaCity.js arenaRecordDisplaced) and each system's own law for a building that is not there takes it.

import { inArenaCell, arenaRecordDisplaced, ARENA_REGION } from '../world/arenaCity.js';
import { interiorSceneName, renameScene } from './sceneCache.js';
import { isResidence } from '../world/buildingNames.js';

/** The market's generator (banking.js housesForSale), seeded by what names this move. */
function pick(n, mapId, oldKey) {
  let seed = ((mapId * 0x9e3779b1) ^ (oldKey + 1)) >>> 0 || 1;
  // a few steps, not one: the market's seeds differ in their high bits (a map id), these in their low (a key)
  for (let i = 0; i < 4; i++) {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
  }
  return Math.floor((seed / 0x100000000) * n);
}

/**
 * The house a displaced deed moves to, or null. `summaries` is the city's building list as it stands now
 * (world/buildingSummaries.js - the arena's cell holds none); `oldType` the type the old house was; `held` the building
 * keys another record of the save holds in the city; `isActiveQuestBuilding(summary)` the market's own exclusion.
 */
export function arenaHouseFor({ mapId, oldKey, oldType }, summaries, { held = new Set(), isActiveQuestBuilding = null } = {}) {
  const free = (summaries ?? []).filter((s) => s.buildingKey > 0 && !inArenaCell(s.buildingKey) && !held.has(s.buildingKey)
    && !(isActiveQuestBuilding?.(s) ?? false)).sort((a, b) => a.buildingKey - b.buildingKey);
  let list = free.filter((s) => s.buildingType === oldType);
  if (!list.length) list = free.filter((s) => isResidence(s.buildingType));
  return list.length ? list[pick(list.length, mapId, oldKey)] : null;
}

/**
 * The move, on the save's records. `houses` banking's per-region deeds; `summaries`, `oldTypeOf(buildingKey)`,
 * `held`, `isActiveQuestBuilding` as above; `scenes` the save's scene cache; the hooks the host's (each optional):
 * `undiscoverCell()`, `discover(summary)`, `addNote(text)`, `notice()`. `displaced(rec)` defaults to the arena's
 * law. Answers { from, to, name } for a deed moved, else null.
 */
export function moveArenaRecords({ houses, summaries, oldTypeOf, held = new Set(), isActiveQuestBuilding = null, scenes = null, displaced = arenaRecordDisplaced } = {}, hooks = {}) {
  const slot = houses?.[ARENA_REGION];
  if (!slot || !(slot.buildingKey > 0) || !displaced(slot)) return null;
  const from = slot.buildingKey;
  const to = arenaHouseFor({ mapId: slot.mapId, oldKey: from, oldType: oldTypeOf?.(from) ?? null }, summaries, { held, isActiveQuestBuilding });
  if (!to) return null;
  if (scenes) renameScene(scenes, interiorSceneName(slot.mapId, from), interiorSceneName(slot.mapId, to.buildingKey));
  slot.buildingKey = to.buildingKey;
  hooks.undiscoverCell?.();
  hooks.discover?.(to);
  hooks.addNote?.(to);
  hooks.notice?.(to);
  return { from, to: to.buildingKey, name: to.name ?? '' };
}
