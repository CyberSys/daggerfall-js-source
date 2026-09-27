// @ts-check
// CSA-C (2026-09-27): COME SAIL AWAY'S BOATS PLACED, KEPT AND SAVED -
// ComeSailAway.cs's placement (StartPlacing, StopPlacing, the three
// PlaceBoats, the two RepositionBoats, both PlaceBoatAtRayHits, both
// SetBoatPositionAndDirections, GetMapPixelFromTerrain: 6112-6521), the nodes
// and the visibility (UpdateAllBoatsNodes, both UpdateBoatNodes, both
// UpdateBoatVisibility: 3624-3820), the events that keep a placed boat where
// it stands (OnLoad, OnTransition, OnPositionUpdate, OnPositionUpdateBoat:
// 1943-2072), GetTileMapIndexAtPosition (2101), the lookups
// (GetPlacedBoatWithUID 769, GetHitBoatIndex 1890), the placing click in
// Update (4957), four of the five console commands (56-204) and
// ComeSailAwaySaveData whole.
//
// The C# is one MonoBehaviour; this is its placing half as one runtime over
// the host's seams (`deps`, below), in the C#'s order statement for
// statement. What a later slice owns is named where the C# calls it and not
// run here: the wake and oar particles and the waves (CSA-F), the sounds
// (PlaySlow - CSA-G), sailing and its moving parts (CSA-D), the wind's event
// (CSA-E), the map's markers beyond what the save carries (CSA-I), and the
// items - the two item classes that call StartPlacing, `giveboat`, PackBoat
// (CSA-H).
//
// THE SCENE A RAY MEETS. Physics.Raycast is the host's (`deps.raycast`):
// the port's world as its colliders stand, the boats' own among them
// (world/prefabColliders.js), each hit named as Unity names its collider's
// object - "DeepWaters_Surface" for Iliac Puddle No More's trigger slab over
// the sea, "DeepWaters_Seafloor" for its carved floor - and carrying the
// Terrain its collider sits on, or null.
//
// A TERRAIN is the host's record of one built map pixel (StreamingWorld's
// terrainArray entry and its DaggerfallTerrain): `mapPixelX`, `mapPixelY`,
// `position` (its transform's, the pixel's corner), `tileMap` (the TileMap's
// `.r` bytes, 128 x 128, row by row along z; null before it is built) and
// `sampleHeight(worldPosition)` (Terrain.SampleHeight: the height over the
// terrain's own y). The host hands the same object for the same pixel every
// time, so `==` on it is Unity's.
//
// deps = {
//   pool: { ready(), spawnNow(boat, player) -> boat|null (SpawnBoat), remove(boat) (Object.Destroy) },
//   player() -> { position, rotation }            PlayerObject.transform
//   camera() -> { position, forward }             MainCameraObject.transform
//   currentMapPixel() -> { X, Y }                 PlayerGPS.CurrentMapPixel (a new one each call)
//   isPlayerInside(), blockWaterLevel()           PlayerEnterExit
//   iliacPuddleNoMore() -> bool                   the mod's `IliacPuddleNoMore != null`
//   raycast(origin, direction, maxDistance, { triggers }) -> { distance, point, name, terrain, boat? } | null
//   playerTerrain() -> terrain | null             StreamingWorld.PlayerTerrainTransform
//   terrainAt(x, y) -> terrain | null             StreamingWorld.GetTerrainTransform
//   terrains() -> terrain[]                       StreamingWorld.terrainArray (the reflection GetMapPixelFromTerrain reads)
//   worldCompensation() -> [x, y, z]              StreamingWorld.WorldCompensation
//   hudText(text, delay?), midScreenText(text, seconds), log(text)
//   random: { range(min, max) }                   UnityEngine.Random.Range(int, int)
//   time() -> number                              Time.time
//   persistentDungeonBoats() -> bool              the mod's Compatibility/PersistentDungeonBoats
//   packedItems: { serialize(items), deserialize(records) }   ItemCollection.SerializeItems / DeserializeItems
// }

import { Boat, setLights, HULL_NAMES, CARGO_CONTAINER_IMAGE } from './comeSailAwayBoat.js';
import { quatLookRotation, quatRotate, quatAngleAxis } from '../world/quat.js';
import { transferAll } from './inventory.js';
import { NO_WATER_LEVEL } from '../world/deepWaterSwim.js';

export const COME_SAIL_AWAY_VENDOR = 'come-sail-away';
/** ComeSailAway.WaterLevel (IL 514): `WODTerrain ? 100 : 34` - the port carries no World of Daggerfall terrain. */
export const WATER_LEVEL = 34;
/** ComeSailAway.terrainEdge. */
export const TERRAIN_EDGE = Math.fround(819.2);
/** The placement ray's reach, and the dungeon water plane's. */
export const PLACE_RAY_DISTANCE = 100;
/** Update's `Time.time - placeTime > 0.2f`: the click that asked to place is not the click that places. */
export const PLACE_CLICK_DELAY = Math.fround(0.2);
/** PlayerEnterExit.blockWaterLevel with no water (NoWaterSentinel: deepWaterSwim.js's one home). */
export { NO_WATER_LEVEL };
export const BOAT_PARTS_TEMPLATE = 1320;
export const BOAT_DEED_TEMPLATE = 1321;
/** The console's words (ComeSailAway's nested command classes). */
export const CONSOLE = Object.freeze({
  placeboat: Object.freeze({ name: 'placeboat', description: 'place a boat where the player is looking', usage: 'placeboat [hull] [variant]; No argument will result in random hull and variant. WARNING: only hull 0 is available now and variants only go from 0-6' }),
  printboats: Object.freeze({ name: 'printboats', description: 'lists all placed boats', usage: '' }),
  identifyboat: Object.freeze({ name: 'identifyboat', description: 'Get the index of the boat under the crosshair', usage: 'use command while looking at a boat' }),
  purgeboat: Object.freeze({ name: 'purgeboat', description: 'Destroys the boat at the provided index', usage: 'purgeboat [index]' }),
});

const f = Math.fround;
const V_UP = [0, 1, 0];
const V_FORWARD = [0, 0, 1];

/** Convert.ToInt32(string): null is 0; whitespace and a sign allowed round the digits; anything else a FormatException. */
export function convertToInt32(s) {
  if (s == null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(s))) throw new TypeError(`FormatException: Input string was not in a correct format. ("${s}")`);
  const v = Number.parseInt(String(s).trim(), 10);
  if (v > 2147483647 || v < -2147483648) throw new RangeError(`OverflowException: Value was either too large or too small for an Int32. ("${s}")`);
  return v;
}

/**
 * Plane.Raycast for the plane through (0, h, 0) facing up (`new Plane(Vector3.up, new Vector3(0, h, 0))`): the
 * distance along the ray, or null where Unity answers false (parallel - Mathf.Approximately(vdot, 0) - or behind).
 */
export function upPlaneRaycast(origin, direction, h) {
  const vdot = f(direction[1]);
  const ndot = f(f(-f(origin[1])) - f(-f(h)));   // -Dot(origin, up) - distance, distance = -Dot(up, point)
  if (Math.abs(vdot) < 8 * 1.401298e-45) return null;
  const enter = f(ndot / vdot);
  return enter > 0 ? enter : null;
}

/** `ray.origin + ray.direction * t`, in Unity's floats. */
const alongRay = (o, d, t) => [f(f(o[0]) + f(f(d[0]) * f(t))), f(f(o[1]) + f(f(d[1]) * f(t))), f(f(o[2]) + f(f(d[2]) * f(t)))];

/** GetHullFromMessage / GetVariantFromMessage: the item's `message` is hull * 10 + variant. */
export const hullFromMessage = (message) => Math.trunc(message / 10) % 10;
export const variantFromMessage = (message) => message % 10;

/**
 * GetTileMapIndexAtPosition (2101-2120): the tile under a world position on a terrain - its TileMap's `.r / 4`,
 * the position's offset from the terrain's corner in Unity's floats, each axis's 128th truncated and clamped.
 * -1 for a terrain with no DaggerfallTerrain or no TileMap.
 */
export function tileMapIndexAtPosition(position, terrain) {
  const map = terrain.tileMap;   // a null terrain throws, as `terrainTransform.GetComponent` does
  if (map == null || map.length === 0) return -1;
  const tp = terrain.position;
  const vx = f(f(position[0]) - f(tp[0])), vz = f(f(position[2]) - f(tp[2]));
  const num2 = f(vx / TERRAIN_EDGE), num3 = f(vz / TERRAIN_EDGE);
  const num4 = Math.min(127, Math.max(0, Math.trunc(f(128 * num2))));
  const num5 = Math.min(127, Math.max(0, Math.trunc(f(128 * num3))));
  return map[num5 * 128 + num4] >> 2;
}

const v3 = (o) => (o ? { x: f(o[0]), y: f(o[1]), z: f(o[2]) } : { x: 0, y: 0, z: 0 });
const arr3 = (o) => [f(o?.x ?? 0), f(o?.y ?? 0), f(o?.z ?? 0)];

/**
 * @param {any} deps - see the file's head
 */
export function createComeSailAwayRuntime(deps) {
  const random = deps.random ?? { range: (min, max) => min + Math.floor(Math.random() * (max - min)) };
  const log = (s) => deps.log?.(s);

  const state = {
    /** @type {Boat[]} */ AllBoats: [],
    /** @type {Boat|null} */ CurrentBoat: null,   // CSA-D's
    disembarking: null,
    placing: false,
    placeTime: 0,
    /** @type {any} */ placeItem: null,
    /** @type {any[]|null} */ placeItemCollection: null,
    /** @type {Map<any, any[]>} */ PackedCargoes: new Map(),
    /** @type {{ position:number[], label:string, color:any }[]} */ mapMarkers: [],
    TemporaryShip: false,
    sailPosition: 0,
    MoveVectorCurrent: [0, 0, 0],
    MoveVectorTarget: [0, 0, 0],
    windVectorTarget: [0, 0, 1],
    windVectorCurrent: [0, 0, 1],
    currentVectorPrevious: [0, 0, 0],
    wasPaused: false,
  };
  /** A save's record held while the mod's models load (declared: SpawnBoat is synchronous in the C#). */
  let pendingRestore = null;

  // Start (1087-1090): the first wind, 15 x Random.Range(-12, 12) degrees about up off forward
  {
    const num = 15 * random.range(-12, 12);
    const v = quatRotate(quatAngleAxis(num, V_UP), V_FORWARD);
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    state.windVectorTarget = [v[0] / l, v[1] / l, v[2] / l];
    state.windVectorCurrent = [...state.windVectorTarget];
  }

  const isSailing = () => state.CurrentBoat != null && state.disembarking == null;
  const playerRight = () => quatRotate(deps.player().rotation, [1, 0, 0]);
  const sameTerrain = (a, b) => a === b;

  function StartPlacing(item, itemCollection) {
    if (!state.placing) {
      state.placing = true;
      state.placeTime = deps.time();
      state.placeItem = item;
      state.placeItemCollection = itemCollection;
      deps.midScreenText('Place the boat in water', 3);
    }
  }
  function StopPlacing() {
    state.placing = false;
    state.placeItem = null;
  }

  /** SpawnBoat, through the pool. */
  function SpawnBoat(boat) {
    const p = deps.player();
    return deps.pool.spawnNow(boat, { position: [...p.position], rotation: [...p.rotation] });
  }

  /** PlaceBoat(Vector3, Vector3, int hull, int variant, Terrain) (6159-6169). */
  function PlaceBoat(position, direction, hull = 0, variant = 0, terrain = null) {
    const boat = new Boat(hull, variant);
    SpawnBoat(boat);
    state.AllBoats.push(boat);
    SetBoatPositionAndDirection(boat, position, direction, terrain);
    // PlaySlow(boat) - CSA-G's
    return boat;
  }
  /** PlaceBoat(Boat, Vector3, Vector3, Terrain) (6171-6178). */
  function PlaceBoatOnTerrain(newBoat, position, direction, terrain = null) {
    SpawnBoat(newBoat);
    SetBoatPositionAndDirection(newBoat, position, direction, terrain);
    // PlaySlow(newBoat) - CSA-G's
  }
  /** PlaceBoat(Boat, Vector3, Vector3, DFPosition) (6180-6187). */
  function PlaceBoatAtMapPixel(newBoat, position, direction, mapPixel = null) {
    SpawnBoat(newBoat);
    SetBoatPositionAndDirectionAtMapPixel(newBoat, position, direction, mapPixel);
    // PlaySlow(newBoat) - CSA-G's
  }
  /** RepositionBoat(Boat, Vector3, Vector3, Terrain) (6189-6196). */
  function RepositionBoat(boat, position, direction, terrain = null) {
    SetBoatPositionAndDirection(boat, position, direction, terrain);
    UpdateBoatVisibilityOf(boat);
    // PlaySlow(boat) - CSA-G's
  }
  /** RepositionBoat(Boat, Vector3, Vector3, DFPosition) (6198-6205). */
  function RepositionBoatAtMapPixel(boat, position, direction, mapPixel = null) {
    SetBoatPositionAndDirectionAtMapPixel(boat, position, direction, mapPixel);
    UpdateBoatVisibilityOf(boat);
    // PlaySlow(boat) - CSA-G's
  }

  /** The item's half of each arm that places (6328-6341): the deed's UID on the boat, its packed cargo aboard, the item spent unless the boat is crewed. */
  function takePlaceItem(boat) {
    if (state.placeItem != null) {
      boat.uid = state.placeItem.UID;
      if (state.PackedCargoes.has(cargoKey(state.placeItem.UID))) {
        const value = state.PackedCargoes.get(cargoKey(state.placeItem.UID));
        transferAll(value, boat.Cargo.Items);   // ItemCollection.TransferAll: stacked as AddItem stacks, the packed collection emptied and kept
      }
      if (!boat.crewed) removeItem(state.placeItemCollection, state.placeItem);
    }
  }

  /** PlaceBoatAtRayHit(string[] args) (6207-6228): the console's arguments read as the C# reads them. */
  function PlaceBoatAtRayHitArgs(args) {
    let num = 0;
    let variant = 0;
    if (args.length === 0) variant = random.range(0, 7);
    else if (args.length === 1) {
      num = convertToInt32(args[0]);
      if (num === 0) variant = random.range(0, 7);
    } else if (args.length === 2) {
      num = convertToInt32(args[0]);
      variant = convertToInt32(args[1]);
    }
    PlaceBoatAtRayHit(num, variant);
  }

  /** PlaceBoatAtRayHit(int hull, int variant) (6230-6473). */
  function PlaceBoatAtRayHit(hull = 0, variant = 0) {
    if (!deps.pool.ready()) {   // DECLARED: DFU loads a mod's bundle before a game starts; the port's models may still be arriving
      log('[come-sail-away] the boats\' models have not loaded yet - placement aborted');
      StopPlacing();
      return;
    }
    const cam = deps.camera();
    const origin = [...cam.position];
    const l = Math.hypot(cam.forward[0], cam.forward[1], cam.forward[2]) || 1;
    const direction = [cam.forward[0] / l, cam.forward[1] / l, cam.forward[2] / l];   // new Ray normalises
    const val2 = deps.raycast(origin, direction, PLACE_RAY_DISTANCE, { triggers: true });
    const ipnm = !!deps.iliacPuddleNoMore();
    if (val2) {
      if (ipnm && String(val2.name).includes('DeepWaters')) {
        deps.hudText('Boat placed!');
        let boat = null;
        let terrain = null;
        const val5 = deps.raycast(val2.point, [0, -1, 0], PLACE_RAY_DISTANCE, { triggers: false });
        if (val5) terrain = val5.terrain ?? null;
        if (state.placeItem != null && state.placeItem.templateIndex === BOAT_DEED_TEMPLATE) boat = GetPlacedBoatWithUID(state.placeItem.UID);
        if (boat == null) boat = PlaceBoat([...val2.point], playerRight(), hull, variant, terrain);
        else RepositionBoat(boat, [...val2.point], playerRight(), terrain);
        takePlaceItem(boat);
        StopPlacing();
        return;
      }
      if (deps.blockWaterLevel() !== NO_WATER_LEVEL) {
        const num = f(f(f(deps.blockWaterLevel()) * -1) * f(0.025));
        log(`COME SAIL AWAY - PLACING BOAT IN DUNGEON WITH WATER LEVEL AT ${num}`);
        const num2 = upPlaneRaycast(origin, direction, num);
        if (num2 == null) {
          log('COME SAIL AWAY - PLACEMENT DOES NOT INTERSECT WITH PLANE');
          StopPlacing();
          return;
        }
        if (num2 > PLACE_RAY_DISTANCE) {
          log(`COME SAIL AWAY - INTERSECTION WITH WATER PLANE IS TOO FAR AT ${num2}`);
          StopPlacing();
          return;
        }
        if (val2.distance > num2) {
          deps.hudText('Boat placed!');
          const boat2 = PlaceBoat(alongRay(origin, direction, num2), playerRight(), hull, variant);
          boat2.inside = true;
          takePlaceItem(boat2);
          StopPlacing();
          return;
        }
      }
      if (val2.terrain != null && tileMapIndexAtPosition(val2.point, val2.terrain) === 0) {
        deps.hudText('Boat placed!');
        let boat3 = null;
        if (state.placeItem != null && state.placeItem.templateIndex === BOAT_DEED_TEMPLATE) boat3 = GetPlacedBoatWithUID(state.placeItem.UID);
        if (boat3 == null) boat3 = PlaceBoat([...val2.point], playerRight(), hull, variant, val2.terrain);
        else RepositionBoat(boat3, [...val2.point], playerRight(), val2.terrain);
        takePlaceItem(boat3);
        StopPlacing();
      } else {
        deps.midScreenText('Boat can only be placed on water!', 3);
        StopPlacing();
      }
    } else if (ipnm) {
      const num3 = upPlaneRaycast(origin, direction, WATER_LEVEL);
      if (num3 != null) {
        deps.hudText('Boat placed!');
        let boat4 = null;
        if (state.placeItem != null && state.placeItem.templateIndex === BOAT_DEED_TEMPLATE) boat4 = GetPlacedBoatWithUID(state.placeItem.UID);
        if (boat4 == null) boat4 = PlaceBoat(alongRay(origin, direction, num3), playerRight(), hull, variant);
        else RepositionBoat(boat4, alongRay(origin, direction, num3), playerRight(), null);
        takePlaceItem(boat4);
        StopPlacing();
      } else {
        log('COME SAIL AWAY - PLACEMENT DOES NOT INTERSECT WITH PLANE');
        StopPlacing();
      }
    } else {
      deps.hudText('Placement aborted!', 3);
      StopPlacing();
    }
  }

  /** SetBoatPositionAndDirection(Boat, Vector3, Vector3, Terrain) (6475-6487). */
  function SetBoatPositionAndDirection(boat, position, direction, terrain = null) {
    // boat.WakeEmitter.Stop() - CSA-F's
    boat.GameObject.position = [...position];
    boat.GameObject.rotation = quatLookRotation(direction);   // transform.forward = direction
    boat.MapPixel = deps.currentMapPixel();
    if (terrain != null && !sameTerrain(terrain, deps.playerTerrain())) boat.MapPixel = GetMapPixelFromTerrain(terrain);
    UpdateBoatNodes(boat, terrain);
  }
  /** GetMapPixelFromTerrain (6489-6500): the terrain's pixel off the streaming world's own array, or null. */
  function GetMapPixelFromTerrain(terrain) {
    for (const val of deps.terrains()) {
      if (val === terrain) return { X: val.mapPixelX, Y: val.mapPixelY };
    }
    return null;
  }
  /** SetBoatPositionAndDirection(Boat, Vector3, Vector3, DFPosition) (6502-6510). */
  function SetBoatPositionAndDirectionAtMapPixel(boat, position, direction, mapPixel = null) {
    // boat.WakeEmitter.Stop() - CSA-F's
    boat.GameObject.position = [...position];
    boat.GameObject.rotation = quatLookRotation(direction);
    boat.MapPixel = mapPixel;
    UpdateBoatNodesAtMapPixel(boat, mapPixel);
  }

  /** Each node's reading on one terrain: Iliac Puddle No More's height test, else the tile map's water. */
  function readNodes(boat, terrain) {
    if (deps.iliacPuddleNoMore()) {
      for (let j = 0; j < boat.NodeTileMapIndices.length; j++) {
        boat.NodeTileMapIndices[j] = terrain.sampleHeight(boat.Nodes[j].position) < WATER_LEVEL ? 0 : 1;
      }
    } else {
      for (let k = 0; k < boat.NodeTileMapIndices.length; k++) {
        boat.NodeTileMapIndices[k] = tileMapIndexAtPosition(boat.Nodes[k].position, terrain);
      }
    }
  }
  /** Inside, a dungeon with water reads every node as water (3641-3651 / 3685-3695). True when the caller returns. */
  function nodesInside(boat) {
    if (!deps.isPlayerInside()) return false;
    if (deps.blockWaterLevel() !== NO_WATER_LEVEL) boat.NodeTileMapIndices.fill(0);
    return true;
  }
  /** UpdateBoatNodes(Boat, Terrain) (3639-3680): the player's terrain unless one is given. */
  function UpdateBoatNodes(boat, terrain = null) {
    if (nodesInside(boat)) return;
    let val = deps.playerTerrain();
    if (terrain != null) val = terrain;
    readNodes(boat, val);   // a null terrain throws here, as the C#'s NullReferenceException does
  }
  /** UpdateBoatNodes(Boat, DFPosition) (3682-3725): the terrain of the boat's own pixel, none built - nothing read. */
  function UpdateBoatNodesAtMapPixel(boat, mapPixel) {
    if (nodesInside(boat)) return;
    const terrainTransform = deps.terrainAt(mapPixel.X, mapPixel.Y);
    if (terrainTransform == null) return;
    readNodes(boat, terrainTransform);
  }
  /** UpdateAllBoatsNodes (3624-3637). KEPT AS THE C# HAS IT: nothing calls it, and its `MapPixel ==
   *  CurrentMapPixel` compares two DFPosition references, the second a new one each read - never equal. */
  function UpdateAllBoatsNodes() {
    if (state.AllBoats.length < 1 || deps.isPlayerInside()) return;
    for (const allBoat of state.AllBoats) {
      if (allBoat.MapPixel === deps.currentMapPixel()) UpdateBoatNodes(allBoat);
    }
  }

  const pixelsApart = (a, b) => Math.max(Math.abs(a.X - b.X), Math.abs(a.Y - b.Y));
  /** UpdateBoatVisibility() (3727-3782): inside, only a boat placed inside this pixel stands; outside, a boat more
   *  than a pixel off (or placed inside) goes - destroyed when it was placed inside, unless the setting keeps it. */
  function UpdateBoatVisibility() {
    if (state.AllBoats.length < 1) return;
    if (deps.isPlayerInside()) {
      for (const allBoat of state.AllBoats) {
        const cur = deps.currentMapPixel();
        if (allBoat.inside && allBoat.MapPixel.X === cur.X && allBoat.MapPixel.Y === cur.Y) {
          if (!allBoat.GameObject.activeSelf) allBoat.GameObject.setActive(true);
        } else if (allBoat.GameObject.activeSelf) allBoat.GameObject.setActive(false);
      }
      return;
    }
    const list = [];
    for (const allBoat2 of state.AllBoats) {
      if (allBoat2.inside || (allBoat2.MapPixel != null && pixelsApart(deps.currentMapPixel(), allBoat2.MapPixel) > 1)) {
        if (allBoat2.inside && !deps.persistentDungeonBoats()) list.push(allBoat2);
        if (allBoat2.GameObject.activeSelf) allBoat2.GameObject.setActive(false);
      } else {
        if (!allBoat2.GameObject.activeSelf) allBoat2.GameObject.setActive(true);
        UpdateBoatNodesAtMapPixel(allBoat2, allBoat2.MapPixel);
      }
    }
    if (list.length <= 0) return;
    for (const item of list) {
      state.AllBoats.splice(state.AllBoats.indexOf(item), 1);
      deps.pool.remove(item);
    }
  }
  /** UpdateBoatVisibility(Boat) (3784-3818): the one boat, never destroyed; its nodes read whatever it decided. */
  function UpdateBoatVisibilityOf(boat) {
    if (boat == null) return;
    if (deps.isPlayerInside()) {
      const cur = deps.currentMapPixel();
      if (boat.inside && boat.MapPixel.X === cur.X && boat.MapPixel.Y === cur.Y) {
        if (!boat.GameObject.activeSelf) boat.GameObject.setActive(true);
      } else if (boat.GameObject.activeSelf) boat.GameObject.setActive(false);
      return;
    }
    if (boat.inside || (boat.MapPixel != null && pixelsApart(deps.currentMapPixel(), boat.MapPixel) > 1)) {
      if (boat.GameObject.activeSelf) boat.GameObject.setActive(false);
    } else if (!boat.GameObject.activeSelf) boat.GameObject.setActive(true);
    UpdateBoatNodesAtMapPixel(boat, boat.MapPixel);
  }

  /** OnPositionUpdate (1987-2010): FloatingOrigin moved the world. KEPT BUG FOR BUG: a boat that is inactive before
   *  and after its visibility is asked is not moved - a boat out of sight misses every shift made while it is. */
  function OnPositionUpdate(offset) {
    // UpdateWaveMesh() - CSA-F's
    if (state.AllBoats.length < 1) return;
    for (const allBoat of state.AllBoats) {
      if (allBoat.GameObject.activeSelf) {
        OnPositionUpdateBoat(allBoat, offset);
        UpdateBoatVisibilityOf(allBoat);
        continue;
      }
      UpdateBoatVisibilityOf(allBoat);
      if (allBoat.GameObject.activeSelf) OnPositionUpdateBoat(allBoat, offset);
    }
  }
  /** OnPositionUpdateBoat (2012-2064): the boat's root moved by the offset (its particles and the helm are CSA-F's and CSA-D's). */
  function OnPositionUpdateBoat(boat, offset) {
    // boat.WakeEmitter.Stop(), and the wake's and oars' live particles moved with it - CSA-F's
    const p = boat.GameObject.position;
    boat.GameObject.position = [f(f(p[0]) + f(offset[0])), f(f(p[1]) + f(offset[1])), f(f(p[2]) + f(offset[2]))];
    // `if (boat == CurrentBoat)` - the player at the helm and the boat's pixel: CSA-D's
  }

  /** OnLoad (1943-1950). */
  function OnLoad() {
    UpdateBoatVisibility();
    // UpdateWaveMesh() - CSA-F's
  }
  /** OnTransition (1978-1985): into or out of a building or a dungeon. */
  function OnTransition() {
    // ResetTimeScale(false) - CSA-G's
    UpdateBoatVisibility();
    // UpdateWind(...) - CSA-E's; UpdateWaveMesh() - CSA-F's
  }

  /** GetPlacedBoatWithUID (769-786). */
  function GetPlacedBoatWithUID(UID) {
    if (state.AllBoats.length < 1) return null;
    let result = null;
    for (const allBoat of state.AllBoats) {
      if (allBoat.uid === UID) { result = allBoat; break; }
    }
    return result;
  }
  /** GetHitBoatIndex (1890-1902): the boat whose root the hit's object sits under, by index. */
  function GetHitBoatIndex(hit) {
    let result = -1;
    for (let i = 0; i < state.AllBoats.length; i++) {
      if (hit?.root != null && hit.root === state.AllBoats[i].GameObject) { result = i; break; }
    }
    return result;
  }

  /** Update's placing arm (4957-4962), after its pause gate (4188-4192) and while not sailing. */
  function update({ paused = false, activateComplete = false } = {}) {
    if (paused) { state.wasPaused = true; return; }
    // `if (wasPaused && Time.timeScale != 1 && !isTravelling) ResetTimeScale()` - CSA-G's
    state.wasPaused = false;
    if (isSailing()) return;   // the sailing arm - CSA-D's
    if (state.placing && activateComplete && f(f(deps.time()) - f(state.placeTime)) > PLACE_CLICK_DELAY) {
      const hullFromMessage_ = hullFromMessage(state.placeItem.message);
      const variantFromMessage_ = variantFromMessage(state.placeItem.message);
      log(`COME SAIL AWAY - ITEM HULL IS ${hullFromMessage_}`);
      log(`COME SAIL AWAY - ITEM VARIANT IS ${variantFromMessage_}`);
      PlaceBoatAtRayHit(hullFromMessage_, variantFromMessage_);
    }
  }

  // ── the console (56-204) ────────────────────────────────────────────────────
  /** PlaceBoatAtMe.Execute. */
  function consolePlaceBoat(args) {
    if (args.length > 2) return 'Error - Too many arguments, check the usage notes.';
    PlaceBoatAtRayHitArgs(args);
    return 'Attempting to place boat';
  }
  /** PrintBoats.Execute: DFPosition.ToString is "X, Y". */
  function consolePrintBoats() {
    if (state.AllBoats.length < 1) return 'No placed boats!';
    let text = '';
    for (let i = 0; i < state.AllBoats.length; i++) {
      const boat = state.AllBoats[i];
      text = `${text}${i} - ${HULL_NAMES[boat.hull]} at ${boat.MapPixel.X}, ${boat.MapPixel.Y}\n`;
    }
    return text;
  }
  /** IdentifyBoat.Execute. */
  function consoleIdentifyBoat() {
    const cam = deps.camera();
    const l = Math.hypot(cam.forward[0], cam.forward[1], cam.forward[2]) || 1;
    const hit = deps.raycast([...cam.position], [cam.forward[0] / l, cam.forward[1] / l, cam.forward[2] / l], PLACE_RAY_DISTANCE, { triggers: true });
    if (hit) {
      const num = GetHitBoatIndex(hit);
      if (num === -1) return 'Hit object is not a boat!';
      return `Hit object is a boat with index ${num}`;
    }
    return 'Nothing was hit!';
  }
  /** PurgeBoat.Execute. */
  function consolePurgeBoat(args) {
    if (args.length < 1) return 'Error - No arguments provided, check the usage notes.';
    if (args.length > 1) return 'Error - Too many arguments, check the usage notes.';
    const num = convertToInt32(args[0]);
    if (num >= state.AllBoats.length) return 'Error - Index is out of range';
    const boat = state.AllBoats[num];   // a negative index: List's ArgumentOutOfRangeException
    if (boat === undefined) throw new RangeError(`ArgumentOutOfRangeException: Index was out of range. (${num})`);
    state.AllBoats.splice(num, 1);
    deps.pool.remove(boat);
    return `Boat at index ${num} was purged.`;
  }

  // ── ComeSailAwaySaveData ────────────────────────────────────────────────────
  function newSaveData() {
    return {
      worldCompensation: { x: 0, y: 0, z: 0 },
      placedBoats: [],
      placedMapMarkers: [],
      currentBoat: -1,
      TemporaryShip: false,
      sailPosition: 0,
      moveVectorCurrent: { x: 0, y: 0, z: 0 },
      moveVectorTarget: { x: 0, y: 0, z: 0 },
      windVector: { x: 0, y: 0, z: 1 },
      packedCargoes: {},
    };
  }
  function getSaveData() {
    if (pendingRestore) return JSON.parse(JSON.stringify(pendingRestore));   // the record the load handed, until its boats stand
    const data = newSaveData();
    data.worldCompensation = v3(deps.worldCompensation());
    let num = -1;
    if (state.AllBoats.length > 0) {
      for (let i = 0; i < state.AllBoats.length; i++) {
        const b = state.AllBoats[i];
        data.placedBoats.push({
          UID: b.uid,
          Hull: b.hull,
          Variant: b.variant,
          MapPixel: b.MapPixel ? { X: b.MapPixel.X, Y: b.MapPixel.Y } : null,
          Position: v3(b.GameObject.position),
          Direction: v3(quatRotate(b.GameObject.rotation, V_FORWARD)),
          Items: deps.packedItems.serialize(b.Cargo.Items),
          lights: b.LightOn,
          inside: b.inside,
        });
        if (state.CurrentBoat === b) num = i;
      }
    }
    if (state.mapMarkers.length > 0) {
      log('COME SAIL AWAY - SAVING MAP MARKERS!');
      for (const m of state.mapMarkers) data.placedMapMarkers.push({ position: { x: m.position[0], y: m.position[1] }, label: m.label, color: m.color });
    }
    data.currentBoat = num;
    data.TemporaryShip = state.TemporaryShip;
    data.sailPosition = state.sailPosition;
    data.moveVectorCurrent = v3(state.MoveVectorCurrent);
    data.moveVectorTarget = v3(state.MoveVectorTarget);
    data.windVector = v3(state.windVectorCurrent);
    if (state.PackedCargoes.size > 0) {
      data.packedCargoes = {};
      for (const [uid, items] of state.PackedCargoes) data.packedCargoes[uid] = deps.packedItems.serialize(items);
    }
    return data;
  }
  /** RestoreSaveData - held until the models are in (DECLARED), then run whole and followed by OnLoad's visibility. */
  function restoreSaveData(dataIn) {
    if (!deps.pool.ready()) { pendingRestore = dataIn; return; }
    pendingRestore = null;
    applySaveData(dataIn);
  }
  function applySaveData(dataIn) {
    // `if (IsSailing) StopSailing()` - CSA-D's
    if (state.AllBoats.length > 0) {
      for (const allBoat of state.AllBoats) deps.pool.remove(allBoat);
      state.AllBoats.length = 0;
    }
    state.mapMarkers.length = 0;
    const data = { ...newSaveData(), ...dataIn };   // FullSerializer fills a new ComeSailAwaySaveData: a field the record lacks keeps its initializer
    const num = f(f(deps.worldCompensation()[1]) - f(data.worldCompensation?.y ?? 0));
    if (data.placedBoats != null && data.placedBoats.length > 0) {
      for (const placedBoat of data.placedBoats) {
        const boat = new Boat(placedBoat.Hull, placedBoat.Variant);
        boat.uid = placedBoat.UID;
        const p = arr3(placedBoat.Position);
        boat.Position = [p[0], f(p[1] + num), p[2]];
        boat.Direction = arr3(placedBoat.Direction);
        boat.MapPixel = placedBoat.MapPixel ? { X: placedBoat.MapPixel.X, Y: placedBoat.MapPixel.Y } : null;
        boat.inside = !!placedBoat.inside;
        state.AllBoats.push(boat);
        PlaceBoatAtMapPixel(boat, boat.Position, boat.Direction, boat.MapPixel);
        boat.Cargo.Items = deps.packedItems.deserialize(placedBoat.Items ?? []);
        boat.Cargo.ContainerImage = CARGO_CONTAINER_IMAGE;
        setLights(boat, !!placedBoat.lights);
      }
    }
    if (data.placedMapMarkers.length > 0) {
      log('COME SAIL AWAY - LOADED SAVE HAS MAP MARKERS!');
      for (const m of data.placedMapMarkers) {
        AddMapMarker([roundToInt(m.position.x), roundToInt(m.position.y)], m.color, m.label);
      }
    }
    // `if (AllBoats.Count > 0 && currentBoat != -1)`: TemporaryShip, StartSailing, RaiseSails, the move vectors - CSA-D's and CSA-E's
    if (state.AllBoats.length > 0 && data.currentBoat !== -1) {
      state.TemporaryShip = !!data.TemporaryShip;
      state.MoveVectorCurrent = arr3(data.moveVectorCurrent);
      state.MoveVectorTarget = arr3(data.moveVectorTarget);
    }
    state.windVectorCurrent = arr3(data.windVector);
    state.PackedCargoes = new Map();
    for (const [uid, items] of Object.entries(data.packedCargoes ?? {})) state.PackedCargoes.set(cargoKey(uid), deps.packedItems.deserialize(items));
    RunOnUpdateEvents();
  }
  /** RunOnUpdateEvents (1821-1831): the wind's event (CSA-E's listeners), the current's memory cleared. */
  function RunOnUpdateEvents() {
    state.currentVectorPrevious = [0, 0, 0];
  }
  /** AddMapMarker (5695-5701): a marker, once per pixel. */
  function AddMapMarker(mapPixel, color, label = '') {
    if (!state.mapMarkers.some((m) => m.position[0] === mapPixel[0] && m.position[1] === mapPixel[1])) state.mapMarkers.push({ position: mapPixel, label, color });
  }

  /** A frame: a held restore lands the first frame the models are in, then OnLoad's visibility runs for it. */
  function tick() {
    if (pendingRestore && deps.pool.ready()) {
      const data = pendingRestore;
      pendingRestore = null;
      applySaveData(data);
      OnLoad();
    }
  }

  return {
    state,
    get AllBoats() { return state.AllBoats; },
    get placing() { return state.placing; },
    get pendingRestore() { return pendingRestore; },
    isSailing,
    StartPlacing, StopPlacing,
    PlaceBoat, PlaceBoatOnTerrain, PlaceBoatAtMapPixel, RepositionBoat, RepositionBoatAtMapPixel,
    PlaceBoatAtRayHit, PlaceBoatAtRayHitArgs,
    SetBoatPositionAndDirection, SetBoatPositionAndDirectionAtMapPixel, GetMapPixelFromTerrain,
    UpdateBoatNodes, UpdateBoatNodesAtMapPixel, UpdateAllBoatsNodes, UpdateBoatVisibility, UpdateBoatVisibilityOf,
    OnPositionUpdate, OnPositionUpdateBoat, OnLoad, OnTransition,
    GetPlacedBoatWithUID, GetHitBoatIndex, AddMapMarker,
    update, tick,
    console: { placeboat: consolePlaceBoat, printboats: consolePrintBoats, identifyboat: consoleIdentifyBoat, purgeboat: consolePurgeBoat },
    newSaveData, getSaveData, restoreSaveData,
  };
}

/** PackedCargoes' key: the item's UID as the save writes it (a JSON object's key is a string). */
const cargoKey = (uid) => String(uid);
/** Mathf.RoundToInt: the .5 tie to the even integer (System.Math.Round's default). */
function roundToInt(v) {
  const fl = Math.floor(v);
  const r = v - fl;
  return r > 0.5 ? fl + 1 : r < 0.5 ? fl : (fl % 2 === 0 ? fl : fl + 1);
}
/** ItemCollection.RemoveItem. */
function removeItem(list, item) {
  if (!list) return;
  const i = list.indexOf(item);
  if (i >= 0) list.splice(i, 1);
}
