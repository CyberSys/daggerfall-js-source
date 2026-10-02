// ARENA1 (2026-10-02): THE ARENA OF DAGGERFALL STANDS IN THE CITY - the colosseum's block in Daggerfall's grid, the
// city's building list stripped of what the old block drew, the gate's people, and the undercroft below.
//
// Mac, 2026-10-02: "This is to be a centerpoint that fits in the middle of Daggerfall city"; asked, the arena takes
// GEMSAL03, the city's centre-east block (cell 4,3 - the same block in Daggerfall's own layout and under Beautiful
// Cities), "Move them to a new house" for a home that stood there, and Kamer's 32-block dungeon "becomes the arena's
// undercroft". bible/11-Multiplayer/Arena.md "1. The building" is the design; this module is its law:
//
// - THE BLOCK. ARENADAG.RMB is the port's own (vendor/daggerfall-arena/Arena/ARENADAG.RMB.json, cut out of Kamer's
//   DFARENA.RMB by tools/daggerfallArenaExtract.mjs): his 118 props, his 29 lights, the colosseum (864102), his
//   ground and automap, the 43600 stair down to the undercroft - and the gate's people this slice adds
//   (ARENA_GATE_PEOPLE). No building. It is served through the world-data door at a fixed index past any BSA
//   (formats/worldDataReplacement.js registerPortBlock), so DFU's new-block sequence is untouched.
// - THE CELL. Every read of Daggerfall (region 17, location 1231) - MAPS.BSA's, Beautiful Cities' file, a pinned
//   town's - has cell (4,3) named ARENADAG.RMB (formats/mapsFile.js getLocation -> the door's editLocation). It is NOT
//   a layout mod and not a switch: the arena stands in every layout, so no layout pin speaks for it.
// - THE STRIP. The location's building list loses exactly the entries the old block's named buildings DREW, by the
//   same draw every reader makes (systems/talkTopics.js drawNamedBuildings, the grid's block order): every other
//   building keeps its name, its faction and its quality. The city keeps its MapId, LocationId 50026 and its castle
//   dungeon 50027 - the quest tables' permanent places (DaggerfallCity1/2, DaggerfallCastle/1/2) are untouched.
// - THE UNDERCROFT. Kamer's dungeon (Arena/undercroft.json) as a location record of its own, kept off the travel
//   map: the 43600 stair in ARENADAG.RMB is its door (the hosts' door lists - scenes/world.js, scenes/exterior.js -
//   hand that door this record), under the city's pixel, with its own location id (55398) and map id (Kamer's
//   211207) so a save made in it re-enters it and a quest of the castle's is never satisfied in it.
// - THE DISPLACED RECORDS. A record keyed to a building of the old cell names no building now (layoutPins.js
//   recordStands answers false - `arenaRecordDisplaced`): a room is honoured at any inn of the city, a ticket at any
//   smith, a quest site is chosen again; a house deed is moved once (systems/arenaMove.js).

import { registerPortBlock, registerLocationEdit, installWorldDataReplacement } from '../formats/worldDataReplacement.js';
import { drawNamedBuildings } from '../systems/talkTopics.js';
import { configureLayoutPins, layoutLocationKeyOfMapId } from '../systems/layoutPins.js';
import { LOCATION_TYPES, DUNGEON_TYPES } from '../formats/mapsFile.js';
import { registerCustomModel } from './customModels.js';
import { ARENA_MODEL_ID, buildArenaModel } from './arenaModel.js';
import ARENA_BLOCK_JSON from '../../vendor/daggerfall-arena/Arena/ARENADAG.RMB.json' with { type: 'json' };
import UNDERCROFT_JSON from '../../vendor/daggerfall-arena/Arena/undercroft.json' with { type: 'json' };
import ARENA_MODEL_INDEX from '../../vendor/daggerfall-arena/Models/864102.json' with { type: 'json' };

/** Daggerfall city: region 17, location 1231 (LocationId 50026). */
export const ARENA_REGION = 17;
export const ARENA_LOCATION = 1231;
/** systems/worldDataVariants.js makeLocationKey(17, 1231) - the layout pins' key for the city. */
export const ARENA_LOCATION_KEY = ARENA_LOCATION * 100 + ARENA_REGION;
/** The cell the arena takes: (x, y) in the 8 x 8 grid - GEMSAL03 in both layouts. */
export const ARENA_CELL = Object.freeze([4, 3]);
/** The port's block, and its fixed index (world/gateArena.js's GATECOURT.RDB stands at 900000). */
export const ARENA_BLOCK = 'ARENADAG.RMB';
export const ARENA_BLOCK_INDEX = 900100;
/** The undercroft's identity: Kamer's location id and map id (his "Arena of Daggerfall"). */
export const UNDERCROFT_LOCATION_ID = 55398;
export const UNDERCROFT_MAP_ID = 211207;

/** Whether a building key names a building of the arena's cell: DFU's key is (x << 16) + (y << 8) + record. */
export const inArenaCell = (buildingKey) => buildingKey > 0 && (buildingKey >> 16) === ARENA_CELL[0] && ((buildingKey >> 8) & 0xff) === ARENA_CELL[1];
/** Whether a location is Daggerfall city. */
export const isArenaCity = (loc) => loc?.regionIndex === ARENA_REGION && loc?.locationIndex === ARENA_LOCATION;

/**
 * THE GATE'S PEOPLE (ARENA1's placeholder for ARENA2/3): flats in Daggerfall's person archives (world/rdbLayout.js
 * NPC_FLAT_ARCHIVES - the activation ray meets them) with a faction (RMBLayout's street-NPC rule, a non-zero
 * FactionID), at the colosseum's gate - the north arch, between Kamer's two lamp posts, facing the market (cell 4,4).
 * Each its own record `Position` (the flat's identity, StaticNPC's name seed) so the hosts know the Herald by it.
 * Factions are Daggerfall's own (FACTION.TXT): the Court of Daggerfall 595, the People of Daggerfall 518, the Royal
 * Guard 372. Block coordinates (RMB units: z negative into the block).
 */
export const ARENA_GATE_PEOPLE = Object.freeze([
  Object.freeze({ role: 'herald', archive: 183, record: 5, faction: 595, x: 2025, z: -200, position: 0x41524e01 }),
  Object.freeze({ role: 'warden', archive: 183, record: 2, faction: 372, x: 1930, z: -232, position: 0x41524e02 }),
  Object.freeze({ role: 'warden', archive: 183, record: 3, faction: 372, x: 2120, z: -232, position: 0x41524e03 }),
  Object.freeze({ role: 'redRecruiter', archive: 182, record: 25, faction: 518, x: 1740, z: -160, position: 0x41524e04 }),
  Object.freeze({ role: 'blueRecruiter', archive: 182, record: 28, faction: 518, x: 2310, z: -160, position: 0x41524e05 }),
  Object.freeze({ role: 'bookmaker', archive: 182, record: 24, faction: 518, x: 2440, z: -120, position: 0x41524e06 }),
]);
/** The gate person a stood street NPC is, by its record's identity, or null. */
export function arenaGatePersonOf(pn) {
  if (!pn) return null;
  return ARENA_GATE_PEOPLE.find((p) => p.position === pn.position && p.archive === pn.textureArchive && p.record === pn.textureRecord) ?? null;
}

/** The port's block JSON: Kamer's (vendored) with the gate's people stood in it. Pure. */
export function arenaBlockJson(vendored = ARENA_BLOCK_JSON) {
  const rmb = vendored.RmbBlock;
  return {
    ...vendored,
    RmbBlock: {
      ...rmb,
      MiscFlatObjectRecords: [
        ...rmb.MiscFlatObjectRecords,
        ...ARENA_GATE_PEOPLE.map((p) => ({ Position: p.position, XPos: p.x, YPos: 0, ZPos: p.z, TextureArchive: p.archive, TextureRecord: p.record, FactionID: p.faction, Flags: 0 })),
      ],
    },
  };
}

/**
 * THE EDIT: Daggerfall's cell (4,3) named ARENADAG.RMB and the building list stripped of exactly what the cell's
 * old block drew. In place, once (an edited location - the door's cached one - is left as it is). `maps` notes the
 * town whose blocks are read (a pinned town's blocks come in its layout); `blocksFile` reads them. Without a blocks
 * file nothing is edited - the strip cannot be drawn, and a grid renamed without it would rename every building
 * after the cell. Answers what it did, or null.
 */
export function standArenaInLocation(dfLocation, maps, blocksFile) {
  if (!isArenaCity(dfLocation)) return null;
  const ed = dfLocation.exterior?.exteriorData;
  if (!ed?.blockNames || !Array.isArray(dfLocation.exterior.buildings) || !blocksFile) return null;
  const [cx, cy] = ARENA_CELL;
  if (cx >= ed.width || cy >= ed.height) return null;
  const at = cy * ed.width + cx;
  if (ed.blockNames[at] === ARENA_BLOCK) return { block: ARENA_BLOCK, stripped: 0, already: true };
  // the draw, in the readers' order (y outer, x inner), up to the cell - nothing after it changes what it drew
  const list = [];
  let cell = null;
  for (let y = 0; y < ed.height && !cell; y++) {
    for (let x = 0; x < ed.width; x++) {
      const name = maps?.getRmbBlockName ? maps.getRmbBlockName(dfLocation, x, y) : ed.blockNames[y * ed.width + x];
      const dfBlock = blocksFile.getBlockByName(name);
      const b = { dfBlock, x, y };
      if (dfBlock) list.push(b);
      if (x === cx && y === cy) { cell = b; break; }
    }
  }
  const { drawn } = drawNamedBuildings(dfLocation.exterior.buildings, list, { locationIndex: dfLocation.locationIndex ?? 0 });
  const strip = new Set(drawn.get(cell) ?? []);
  const old = ed.blockNames[at];
  dfLocation.exterior.buildings = dfLocation.exterior.buildings.filter((b) => !strip.has(b));
  dfLocation.exterior.buildingCount = dfLocation.exterior.buildings.length;
  ed.blockNames = ed.blockNames.slice();
  ed.blockNames[at] = ARENA_BLOCK;
  ed.arenaTook = old;   // the block the cell stood before - a moved deed's house type is read off it (systems/arenaMove.js)
  return { block: old, stripped: strip.size };
}

/**
 * THE UNDERCROFT as a location record: Kamer's dungeon under Daggerfall's pixel - the city's region, climate and
 * place, the dungeon's own location id and map id, never in the region's lists (no travel map row, no quest pick).
 * Its dungeon blocks are classic RDBs (BLOCKS.BSA); the names decode as MAPS.BSA's do.
 */
export function undercroftLocation(city, spec = UNDERCROFT_JSON) {
  const name = spec.Name;
  const letters = ['N', 'W', 'L', 'S', 'B', 'M'];
  const header = (isInterior) => ({
    alwaysOne1: 1, x: city.exterior?.recordElement?.header?.x ?? 0, y: city.exterior?.recordElement?.header?.y ?? 0,
    isExterior: isInterior ? 0 : 32768, unknown1: 0, unknown2: isInterior ? spec.Unknown2 ?? 0 : 0, alwaysOne2: 1,
    locationId: spec.LocationId, isInterior: isInterior ? 1 : 0, exteriorLocationId: isInterior ? spec.LocationId : 0, locationName: name,
  });
  return {
    loaded: true, regionName: city.regionName, name, regionIndex: city.regionIndex, locationIndex: city.locationIndex,
    hasDungeon: true, politic: city.politic, climate: city.climate,
    mapTableData: { ...city.mapTableData, mapId: UNDERCROFT_MAP_ID, locationType: LOCATION_TYPES.DungeonKeep, dungeonType: DUNGEON_TYPES[spec.DungeonType] ?? DUNGEON_TYPES.HumanStronghold, discovered: true, key: 0, locationId: spec.LocationId },
    exterior: city.exterior,
    dungeon: {
      recordElement: { doorCount: 0, doors: [], header: header(true) },
      header: { nullValue1: 0, unknown1: 0, unknown2: 0, blockCount: spec.Blocks.length, unknown3: null },
      blocks: spec.Blocks.map((b) => ({
        x: b.X, z: b.Z, isStartingBlock: !!b.IsStartingBlock, blockName: b.BlockName,
        blockIndex: Math.max(0, letters.indexOf(b.BlockName[0])), blockNumber: Number(b.BlockName.slice(1, 8)) || 0,
      })),
    },
    arenaUndercroft: true,
  };
}
/** Whether a location is the undercroft. */
export const isArenaUndercroft = (loc) => !!loc?.arenaUndercroft && loc?.dungeon?.recordElement?.header?.locationId === UNDERCROFT_LOCATION_ID;
/** Whether a door entry of a host's list is the undercroft's stair: a dungeon entrance of the arena's block. */
export const isUndercroftDoor = (e, dungeonEntranceType) => e?.dfBlock?.name === ARENA_BLOCK && e?.door?.doorType === dungeonEntranceType;

/** A record keyed to a building of the arena's cell in Daggerfall city (its map id the city's - the layout pins'
 *  resolver says which town a map id is). */
export const arenaRecordDisplaced = (rec, keyOfMapId = layoutLocationKeyOfMapId) =>
  !!rec && inArenaCell(rec.buildingKey) && keyOfMapId(rec.mapId ?? rec.mapID) === ARENA_LOCATION_KEY;

/** Where the colosseum's binary is served from (the build emits it beside the bundle). */
export const ARENA_MODEL_BIN_URL = new URL('../../vendor/daggerfall-arena/Models/864102.bin', import.meta.url).href;

let _installed = null;
/**
 * Once: the block and the city's edit on the door, the displaced-record law on the layout pins, and the colosseum
 * registered as model 864102 once its binary is read (`readBin`, a fetch by default - NEVER TRAPS: a binary that
 * will not load is a colosseum not drawn, said once; the block, its props and the city's edit stand regardless).
 */
export function installArena({ readBin = null, log = console } = {}) {
  if (_installed) return _installed;
  installWorldDataReplacement();
  registerPortBlock(ARENA_BLOCK, arenaBlockJson(), ARENA_BLOCK_INDEX);
  registerLocationEdit(standArenaInLocation);
  configureLayoutPins({ recordDisplaced: (rec) => arenaRecordDisplaced(rec) });
  const read = readBin ?? (async () => {
    const r = await globalThis.fetch(ARENA_MODEL_BIN_URL);
    if (!r?.ok) throw new Error(`${ARENA_MODEL_BIN_URL}: ${r?.status ?? 'no answer'}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  _installed = (async () => {
    try {
      const bin = await read();
      registerCustomModel(ARENA_MODEL_ID, (ctx) => buildArenaModel(ARENA_MODEL_INDEX, bin, (id) => ctx?.classicModel?.(id) ?? null), () => true,
        { climateFree: true, needs: [...new Set(ARENA_MODEL_INDEX.pieces.map((p) => p.model))] });
      return true;
    } catch (e) {
      log?.warn?.('[arena] the colosseum\'s model did not load - its block stands without it', e?.message ?? e);
      return false;
    }
  })();
  return _installed;
}
/** Test seam. */
export function _resetArena() { _installed = null; }
