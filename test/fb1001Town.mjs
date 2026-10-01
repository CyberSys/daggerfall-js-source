// FB1001 (FIELD BUGS 2026-10-01) - A TOWN OF THE PRODUCERS' OWN, for the yard's pins: one RMB block laid out by the
// real layout (world/locationLayout.js layoutLocation over world/rmbLayout.js), its ground stamped into the pixel by the
// real setLocationTiles (world/terrainTiles.js) and the pixel's tilemap minted by the real terrain kernel
// (world/terrainGen.js generatePixelTerrain - the road painter's mask with it when a network is handed in), and each
// building's yard frame and footprint taken as scenes/world.js buildPixel takes them (its two lines, transcribed: that
// host needs ARENA2 to construct). "TEST THE SHAPE THE PRODUCER MINTS" - the tiles a yard reads are the very bytes the
// terrain draws and the feet read.
import { layoutLocation, RMB_SIDE } from '../src/world/locationLayout.js';
import { setLocationTiles, getLocationTerrainTileOrigin } from '../src/world/terrainTiles.js';
import { generatePixelTerrain } from '../src/world/terrainGen.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { makeBuildingKey } from '../src/systems/talkTopics.js';
import { RMB_DIMENSION } from '../src/formats/blocksFile.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { MAP_W, MAP_H } from '../src/world/roadNetwork.js';
import { trs, multiply } from '../src/world/mat4.js';
import { transformedAabb } from '../src/render/frustum.js';

/** The distantland fake woods (test/terrainworker.test.js's): the kernel's three-method surface. */
export const fakeWoods = {
  getHeightMapValuesRange1Dim(mx, my, d) {
    const a = new Float32Array(d * d);
    for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) a[r + c * d] = 20 + 7 * Math.sin((mx + r) * 0.7) + 5 * Math.cos((my + c) * 1.1);
    return a;
  },
  getLargeHeightMapValuesRange(mx, my, span) {
    const d = span * 3;
    const a = new Float32Array(d * d);
    for (let x = 0; x < d; x++) for (let y = 0; y < d; y++) a[x + y * d] = 3 + 2 * Math.sin((mx * 3 + x) * 0.5 + (my * 3 - y) * 0.3);
    return a;
  },
  getHeightMapValue(px, py) { return (px * 7 + py * 3) % 200; },
};

/** A house model's box (its own frame, metres): 8 wide, 6 deep, 6 high. */
export const HOUSE_BOX = Object.freeze([-4, 0, -3, 4, 6, 3]);
/** The models: a house, and the bench a yard is furnished with (3 m long, 0.6 m deep). */
export const HOUSE_MODEL = 7000;
export const BENCH_MODEL = 41001;
export const CHAIR_MODEL = 41000;

const tile = (record) => ({ textureRecord: record, tileBitfield: record, isRotated: false, isFlipped: false });
/**
 * One town block: `houses` its buildings' subrecords ([xPos, zPos] in the block's own units - a house at the
 * subrecord's origin, as Daggerfall stands one), `ground(tileX, tileY)` its ground tile's record (16 x 16, tileY rising
 * with the world's z - setLocationTiles' own reading, groundTiles[x][15 - y]).
 */
export function townBlock({ houses, ground }) {
  const groundTiles = Array.from({ length: 16 }, (_, x) => Array.from({ length: 16 }, (__, row) => tile(ground(x, 15 - row))));
  return {
    index: 0, name: 'FBYARD01.RMB',
    rmbBlock: {
      subRecords: houses.map(([xPos, zPos]) => ({
        xPos, zPos, yRotation: 0,
        exterior: { block3dObjectRecords: [{ modelId: String(HOUSE_MODEL), modelIdNum: HOUSE_MODEL, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 }] },
      })),
      misc3dObjectRecords: [],
      fldHeader: { groundData: { groundTiles } },
    },
  };
}

/**
 * THE TOWN'S PIXEL, as world.js buildPixel stands it: `{ built, frames, keys, at }` - `built` the pixel's entry (its
 * homeTown, homeFrames, tilemapBytes and the painter's `paths`, as world.js keeps them), `keys` the houses' building
 * keys in order, `ground` the town's floor (y). `network` - `{ roads, tracks }` masks for this pixel (roadNetwork.js
 * DIR), the road painter's; none, no painter.
 */
export function townPixel({ houses, ground, network = null, px = 207, py = 213, mapId = 7, floor = 40 }) {
  const block = townBlock({ houses, ground });
  const dfLocation = { exterior: { exteriorData: { width: 1, height: 1, blockNames: [block.name] } }, mapTableData: { locationType: 0, mapId }, climate: { groundArchive: 302 } };
  const maps = { getRmbBlockName: () => block.name };
  const blocks = { checkName: (n) => n, getBlockByName: () => block, getBlockIndex: () => 0, getBlock: () => block };
  // the location's tiles, stamped (world.js: setLocationTiles over the seed), then the kernel
  const seed = new Uint8Array(128 * 128);
  const locationRect = setLocationTiles(dfLocation, maps, blocks, seed);
  let roads = null;
  if (network) {
    roads = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
    roads.roads[py * MAP_W + px] = network.roads ?? 0;
    roads.tracks[py * MAP_W + px] = network.tracks ?? 0;
  }
  const { tilemapBytes, paths } = generatePixelTerrain({ woods: fakeWoods, px, py, tilemap: seed, locationRect, hasLocation: true, climateType: 231, roads });
  // world.js buildPixel: the location's origin, each building's own place and the box round its models (HOME-YARD)
  const loc = layoutLocation(dfLocation, maps, blocks);
  const tileSide = TERRAIN_SIZE / 128;
  const tilePos = getLocationTerrainTileOrigin(dfLocation);
  const locLocal = [tilePos.x * tileSide, floor, tilePos.y * tileSide];
  const homeFrames = new Map();
  const keys = [];
  for (const b of loc.blocks) {
    const originMatrix = trs(locLocal[0] + b.originX, locLocal[1], locLocal[2] + b.originZ, 0, 0, 0);
    for (const placed of b.layout.models) {
      const local = multiply(originMatrix, placed.matrix);
      const box = transformedAabb(HOUSE_BOX, local);
      const homeKey = makeBuildingKey(b.x, b.y, placed.recordIndex);
      const at = [locLocal[0] + b.originX + placed.recordAt[0], locLocal[1] + placed.recordAt[1], locLocal[2] + b.originZ + placed.recordAt[2]];
      if (!homeFrames.has(homeKey)) { homeFrames.set(homeKey, { at, box: [...box] }); keys.push(homeKey); }
    }
  }
  const built = { px, py, homeTown: mapId, homeFrames, homeRegion: 17, tilemapBytes, paths };
  return { built, keys, locLocal, floor, tilemapBytes, paths, block };
}

/** A block-local point (metres, the block's own frame - x east, z north from its south-west corner) in its pixel. */
export const blockLocal = (town, x, z) => [town.locLocal[0] + x, town.floor, town.locLocal[2] + z];
/** A subrecord's position for a house standing at block-local (x, z). */
export const houseAt = (x, z) => [Math.round(x / GLOBAL_SCALE), Math.round(RMB_DIMENSION - z / GLOBAL_SCALE)];
export { RMB_SIDE };
