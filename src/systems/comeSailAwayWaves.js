// @ts-check
// CSA-F (2026-09-27): COME SAIL AWAY'S WAVES - ComeSailAway.cs's
// UpdateWaveMesh (2145-3477, its body from 2797), InitializeWaveTextures
// (1811-1819), the wave object Start builds (1030-1037) and the material it
// wears (the bundle's CurrentMaterial.mat, Models/materials.json), as data
// the runtime keeps and the host draws.
//
// WHAT THE WAVES ARE. Not the open sea's swell: a strip of breakers laid on
// the water along every coast within Waves.Distance map pixels of the
// player. A map pixel is WATER when WOODS.WLD's height there is 2 or less
// (6 under World of Daggerfall's terrain, which the port does not carry) and
// none of four rays dropped at its quarter points meets anything higher
// than a metre over the sea; each water pixel then asks the same of its
// eight neighbours, and every neighbour that is LAND gets a fan from the
// water pixel's inner quarter out to the land pixel's centre (a side), or
// the corner pieces between two (a diagonal). The mesh is in map pixel
// units round the player's own pixel; the object that carries it stands at
// that pixel's centre, a tenth of a metre over the water, 819.2 to a unit.
//
// THE FRAME OF REFERENCE is DFU's floating origin, which the port keeps
// (world/streamingWorld.js): after every recentre the player's own map
// pixel has its corner at x = z = 0 and the world's vertical shift in the
// compensation's y - so the C#'s absolute 204.8 and 614.4, its rays from
// `worldCompensation.y + 500` and its object at (409.6, 34.1 + y, 409.6)
// are the port's as they stand.
//
// KEPT BUG FOR BUG:
// - `currentNeighbors` is taken inside the neighbour loop for EVERY water
//   pixel (its `k == 0 && l == 0` names the middle of each pixel's own
//   three-by-three, not the player's pixel), so the current FixedUpdate
//   reads is the LAST water pixel's - the farthest east, then south;
// - the neighbour rays rise from 500 over the world's origin, not over the
//   compensation the first loop's rise from, and are held to the same
//   compensated metre: after a vertical recentre they start elsewhere;
// - a ray meets whatever collider stands in its way - a boat's deck is
//   land to it, as it is to the C#;
// - an empty list returns before the loop, so the last neighbours stay.

import { recalculateNormals } from '../world/skinnedBake.js';

const f = Math.fround;

/** TryImportTexture(112395, 2, i): the frames Start's InitializeWaveTextures reads, up to its 99. */
export const WAVE_ARCHIVE = 112395;
export const WAVE_RECORD = 2;
export const WAVE_FRAME_LIMIT = 99;
/** ...and what it finds: the mod's thirty-two frames, 112395_2-0 to -31 (Textures/derived.json; pinned), the loop
 *  stopping at the first import that fails. */
export const WAVE_FRAME_COUNT = 32;
/** ComeSailAway.WaterLevel's metre over which a ray's hit is land (`num2 = (int)WaterLevel + 1`). */
export const LAND_MARGIN = 1;
/** UpdateWaveMesh's `num`: the WOODS.WLD height at or under which a pixel may be water (World of Daggerfall's 6). */
export const WATER_HEIGHT_MAP_VALUE = 2;
export const WOD_WATER_HEIGHT_MAP_VALUE = 6;
/** The wave object's lift over the water, and its scale: a map pixel to a unit. */
export const WAVE_LIFT = f(0.1);
export const WAVE_SCALE = f(819.2);
const HALF = f(409.6);
const QUARTER = f(204.8);
const THREE_QUARTERS = f(614.4);
/** The rays: from 500 over, a thousand long. */
const RAY_RISE = 500;
const RAY_REACH = 1000;
const DOWN = Object.freeze([0, -1, 0]);

/** CurrentMaterial.mat (Daggerfall/Dither/Wave): the frames tiled ten times each way, tinted, cut at a half. */
export const WAVE_MATERIAL = Object.freeze({
  tile: Object.freeze([10, 10]),
  color: Object.freeze([0.5, 0.75, 1, 1]),
  cutoff: 0.5,
  ditherStart: 0.5,
  ditherEnd: 1,
});
/**
 * The material's _DitherPattern, BayerDither8x8: its red channel as the bundle stores it, row 0 the texture's
 * first (Unity's bottom) - the 8x8 Bayer matrix at the texture's own rounding. A threshold table, carried as the
 * numbers it is; the shader reads it point-sampled, one texel a screen pixel.
 */
export const BAYER_8X8 = Object.freeze([
  3, 192, 50, 239, 16, 204, 63, 251,
  129, 66, 177, 114, 141, 78, 188, 126,
  34, 224, 20, 208, 47, 235, 30, 220,
  161, 98, 145, 82, 173, 110, 157, 94,
  12, 200, 59, 247, 8, 196, 55, 243,
  137, 75, 184, 122, 133, 71, 180, 118,
  43, 231, 27, 216, 39, 228, 24, 212,
  169, 106, 153, 90, 165, 102, 149, 86,
]);

/** LoadSettings (838-839): `(2f - (float)(Speed / 100)) * 0.125f` - the INTEGER division, kept. */
export const waveFrameTimeOf = (speed) => f(f(2 - Math.trunc(Number(speed) / 100)) * f(0.125));
/** LoadSettings (836-837): the dither's end half the Length, its start the Fade's share of that. */
export function waveDitherOf(length, fade) {
  const waveLength = f(f(length) * f(0.5));
  return { start: f(f(fade) * waveLength), end: waveLength };
}
/** DaggerfallDateTime.IsDay: DawnHour 6 to DuskHour 18. */
export const isDayHour = (hour) => hour >= 6 && hour < 18;

/**
 * Update's wave arm (4769-4799), one frame: the timer runs up to the frame time and the frame after it steps -
 * forward by day, back by night, round the ends. Returns the new `{ index, timer, changed }`.
 */
export function stepWaveFrame(index, timer, frameTime, dt, count, day) {
  if (timer < frameTime) return { index, timer: f(timer + dt), changed: false };
  let i = index;
  if (day) i = i < count - 1 ? i + 1 : 0;
  else i = i > 0 ? i - 1 : count - 1;
  return { index: i, timer: 0, changed: true };
}

/**
 * UpdateWaveMesh past its gate (2803-3476). `ctx`:
 *   heightMapValue(x, y)                       WoodsFileReader.GetHeightMapValue
 *   raycast(origin, direction, maxDistance)    Physics.Raycast past the Player and Ignore Raycast layers -> { point } | null
 *   mapPixel { X, Y }                          PlayerGPS.CurrentMapPixel
 *   worldCompensation [x, y, z]                StreamingWorld.WorldCompensation
 *   waveDistance, waterLevel, wodTerrain
 * Returns the object's position, and - when any pixel was water - the last water pixel's neighbours and the mesh
 * (null when no piece was laid: SetVertices is never reached).
 */
export function buildWaveMesh({ heightMapValue, raycast, mapPixel, worldCompensation, waveDistance, waterLevel, wodTerrain = false }) {
  const wcy = f(worldCompensation[1]);
  const position = [HALF, f(f(f(waterLevel) + WAVE_LIFT) + wcy), HALF];
  const currentMapPixel = mapPixel;
  let num = WATER_HEIGHT_MAP_VALUE;
  const num2 = Math.trunc(waterLevel) + LAND_MARGIN;
  if (wodTerrain) num = WOD_WATER_HEIGHT_MAP_VALUE;
  const landAbove = f(wcy + num2);
  const hitsLand = (origin) => {
    const hit = raycast(origin, DOWN, RAY_REACH);
    return !!hit && f(hit.point[1]) > landAbove;   // Debug.DrawRay's green, red and yellow draw nothing
  };
  /** @type {Array<[number, number]>} */
  const list = [];
  for (let i = -waveDistance; i < waveDistance + 1; i++) {
    for (let j = -waveDistance; j < waveDistance + 1; j++) {
      if (heightMapValue(currentMapPixel.X + i, currentMapPixel.Y + j) > num) continue;
      const vx = f(f(819.2) * i), vz = f(f(819.2) * -j);
      const top = f(wcy + RAY_RISE);
      let flag = true;
      if (hitsLand([f(QUARTER + vx), top, f(QUARTER + vz)])) flag = false;
      if (hitsLand([f(THREE_QUARTERS + vx), top, f(QUARTER + vz)])) flag = false;
      if (hitsLand([f(QUARTER + vx), top, f(THREE_QUARTERS + vz)])) flag = false;
      if (hitsLand([f(THREE_QUARTERS + vx), top, f(THREE_QUARTERS + vz)])) flag = false;
      if (flag) list.push([currentMapPixel.X + i, currentMapPixel.Y + j]);
    }
  }
  if (list.length <= 0) return { position, neighbors: undefined, mesh: null };
  /** @type {number[][]} */
  const list2 = [];   // the vertices, [x, z] (y is nought) - one entry a vertex, so `list2.length` is List<Vector3>.Count
  /** @type {number[]} */
  const list3 = [];   // the triangles
  /** @type {number[][]} */
  const list4 = [];   // the uvs
  /** @type {boolean[][] | undefined} */
  let currentNeighbors;
  for (const item of list) {
    const val8 = [f(item[0] - currentMapPixel.X), f(currentMapPixel.Y - item[1])];
    /** One `count = list2.Count` block: its vertices off val8, its uvs, its triangles off count. */
    const piece = (count, verts, uvs, tris) => {
      for (const [x, z] of verts) list2.push([f(val8[0] + f(x)), f(val8[1] + f(z))]);
      for (const [u, v] of uvs) list4.push([f(u), f(v)]);
      for (const t of tris) list3.push(count + t);
    };
    const array = [[false, false, false], [false, false, false], [false, false, false]];
    for (let k = -1; k < 2; k++) {
      for (let l = -1; l < 2; l++) {
        if (heightMapValue(item[0] + k, item[1] + l) > num) {
          array[k + 1][l + 1] = true;
        } else {
          // val9: the neighbour's centre, from the corner of the player's pixel; the rays from 500 over it (kept)
          const cx = f(f(HALF + f(val8[0] * f(819.2))) + f(f(k) * f(819.2)));
          const cz = f(f(HALF + f(val8[1] * f(819.2))) + f(f(-l) * f(819.2)));
          if (hitsLand([f(cx - QUARTER), RAY_RISE, f(cz - QUARTER)])) array[k + 1][l + 1] = true;   // back + left
          if (hitsLand([f(cx + QUARTER), RAY_RISE, f(cz - QUARTER)])) array[k + 1][l + 1] = true;   // back + right
          if (hitsLand([f(cx - QUARTER), RAY_RISE, f(cz + QUARTER)])) array[k + 1][l + 1] = true;   // forward + left
          if (hitsLand([f(cx + QUARTER), RAY_RISE, f(cz + QUARTER)])) array[k + 1][l + 1] = true;   // forward + right
        }
        if (k === 0 && l === 0) currentNeighbors = array;   // every pixel's own middle (kept)
      }
    }
    if (array[1][0]) {
      let count = list2.length;
      piece(count, [[0.25, 0.25], [-0.25, 0.25], [-0.5, 0.5], [0, 1], [0.5, 0.5]], [[0.25, 1], [0.75, 1], [1, 0.75], [0.5, 0.25], [0, 0.75]], [0, 1, 4, 1, 2, 4, 2, 3, 4]);
      if (array[0][0]) {
        if (array[0][1]) {
          count = list2.length;
          piece(count, [[-0.5, 0.5], [-1, 1], [0, 1]], [[1, 0.75], [1.5, 0.25], [0.5, 0.25]], [0, 1, 2]);
        } else {
          count = list2.length;
          piece(count, [[-0.5, 0.5], [-0.5, 1], [0, 1]], [[1, 0.75], [1, 0.25], [0.5, 0.25]], [0, 1, 2]);
          count = list2.length;
          piece(count, [[-0.25, 0.25], [-0.5, 0.25], [-0.5, 0.5]], [[0.75, 1], [1, 1], [1, 0.75]], [0, 1, 2]);
        }
      } else if (!array[0][1]) {
        count = list2.length;
        piece(count, [[-0.25, 0.25], [-0.75, 0.25], [-0.5, 0.5]], [[0.75, 1], [1.25, 1], [1, 0.75]], [0, 1, 2]);
      }
      if (array[2][0]) {
        if (array[2][1]) {
          count = list2.length;
          piece(count, [[0.5, 0.5], [0, 1], [1, 1]], [[0, 0.75], [0.5, 0.25], [-0.5, 0.25]], [0, 1, 2]);
        } else {
          count = list2.length;
          piece(count, [[0.5, 0.5], [0, 1], [0.5, 1]], [[0, 0.75], [0.5, 0.25], [0, 0.25]], [0, 1, 2]);
          count = list2.length;
          piece(count, [[0.5, 0.25], [0.25, 0.25], [0.5, 0.5]], [[0, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
        }
      } else if (!array[2][1]) {
        count = list2.length;
        piece(count, [[0.75, 0.25], [0.25, 0.25], [0.5, 0.5]], [[-0.25, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
      }
    }
    if (array[0][1]) {
      let count2 = list2.length;
      piece(count2, [[-0.25, 0.25], [-0.25, -0.25], [-0.5, -0.5], [-1, 0], [-0.5, 0.5]], [[0.25, 1], [0.75, 1], [1, 0.75], [0.5, 0.25], [0, 0.75]], [0, 1, 4, 1, 2, 4, 2, 3, 4]);
      if (array[0][2]) {
        if (array[1][2]) {
          count2 = list2.length;
          piece(count2, [[-0.5, -0.5], [-1, -1], [-1, 0]], [[1, 0.75], [1.5, 0.25], [0.5, 0.25]], [0, 1, 2]);
        } else {
          count2 = list2.length;
          piece(count2, [[-0.5, -0.5], [-1, -0.5], [-1, 0]], [[1, 0.75], [1, 0.25], [0.5, 0.25]], [0, 1, 2]);
          count2 = list2.length;
          piece(count2, [[-0.25, -0.25], [-0.25, -0.5], [-0.5, -0.5]], [[0.75, 1], [1, 1], [1, 0.75]], [0, 1, 2]);
        }
      } else if (!array[1][2]) {
        count2 = list2.length;
        piece(count2, [[-0.25, -0.25], [-0.25, -0.75], [-0.5, -0.5]], [[0.75, 1], [1.25, 1], [1, 0.75]], [0, 1, 2]);
      }
      if (array[0][0]) {
        if (array[1][0]) {
          count2 = list2.length;
          piece(count2, [[-0.5, 0.5], [-1, 0], [-1, 1]], [[0, 0.75], [0.5, 0.25], [-0.5, 0.25]], [0, 1, 2]);
        } else {
          count2 = list2.length;
          piece(count2, [[-0.5, 0.5], [-1, 0], [-1, 0.5]], [[0, 0.75], [0.5, 0.25], [0, 0.25]], [0, 1, 2]);
          count2 = list2.length;
          piece(count2, [[-0.25, 0.5], [-0.25, 0.25], [-0.5, 0.5]], [[0, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
        }
      } else if (!array[1][0]) {
        count2 = list2.length;
        piece(count2, [[-0.25, 0.75], [-0.25, 0.25], [-0.5, 0.5]], [[-0.25, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
      }
    }
    if (array[1][2]) {
      let count3 = list2.length;
      piece(count3, [[-0.25, -0.25], [0.25, -0.25], [0.5, -0.5], [0, -1], [-0.5, -0.5]], [[0.25, 1], [0.75, 1], [1, 0.75], [0.5, 0.25], [0, 0.75]], [0, 1, 4, 1, 2, 4, 2, 3, 4]);
      if (array[2][2]) {
        if (array[2][1]) {
          count3 = list2.length;
          piece(count3, [[0.5, -0.5], [1, -1], [0, -1]], [[1, 0.75], [1.5, 0.25], [0.5, 0.25]], [0, 1, 2]);
        } else {
          count3 = list2.length;
          piece(count3, [[0.5, -0.5], [0.5, -1], [0, -1]], [[1, 0.75], [1, 0.25], [0.5, 0.25]], [0, 1, 2]);
          count3 = list2.length;
          piece(count3, [[0.25, -0.25], [0.5, -0.25], [0.5, -0.5]], [[0.75, 1], [1, 1], [1, 0.75]], [0, 1, 2]);
        }
      } else if (!array[2][1]) {
        count3 = list2.length;
        piece(count3, [[0.25, -0.25], [0.75, -0.25], [0.5, -0.5]], [[0.75, 1], [1.25, 1], [1, 0.75]], [0, 1, 2]);
      }
      if (array[0][2]) {
        if (array[0][1]) {
          count3 = list2.length;
          piece(count3, [[-0.5, -0.5], [0, -1], [-1, -1]], [[0, 0.75], [0.5, 0.25], [-0.5, 0.25]], [0, 1, 2]);
        } else {
          count3 = list2.length;
          piece(count3, [[-0.5, -0.5], [0, -1], [-0.5, -1]], [[0, 0.75], [0.5, 0.25], [0, 0.25]], [0, 1, 2]);
          count3 = list2.length;
          piece(count3, [[-0.5, -0.25], [0.25, -0.25], [-0.5, -0.5]], [[0, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
        }
      } else if (!array[0][1]) {
        count3 = list2.length;
        piece(count3, [[-0.75, -0.25], [0.25, -0.25], [-0.5, -0.5]], [[-0.25, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
      }
    }
    if (!array[2][1]) {
      continue;
    }
    let count4 = list2.length;
    piece(count4, [[0.25, -0.25], [0.25, 0.25], [0.5, 0.5], [1, 0], [0.5, -0.5]], [[0.25, 1], [0.75, 1], [1, 0.75], [0.5, 0.25], [0, 0.75]], [0, 1, 4, 1, 2, 4, 2, 3, 4]);
    if (array[2][0]) {
      if (array[1][0]) {
        count4 = list2.length;
        piece(count4, [[0.5, 0.5], [1, 1], [1, 0]], [[1, 0.75], [1.5, 0.25], [0.5, 0.25]], [0, 1, 2]);
      } else {
        count4 = list2.length;
        piece(count4, [[0.5, 0.5], [1, 0.5], [1, 0]], [[1, 0.75], [1, 0.25], [0.5, 0.25]], [0, 1, 2]);
        count4 = list2.length;
        piece(count4, [[0.25, 0.25], [0.25, 0.5], [0.5, 0.5]], [[0.75, 1], [1, 1], [1, 0.75]], [0, 1, 2]);
      }
    } else if (!array[1][0]) {
      count4 = list2.length;
      piece(count4, [[0.25, 0.25], [0.25, 0.75], [0.5, 0.5]], [[0.75, 1], [1.25, 1], [1, 0.75]], [0, 1, 2]);
    }
    if (array[2][2]) {
      if (array[1][2]) {
        count4 = list2.length;
        piece(count4, [[0.5, -0.5], [1, 0], [1, -1]], [[0, 0.75], [0.5, 0.25], [-0.5, 0.25]], [0, 1, 2]);
        continue;
      }
      count4 = list2.length;
      piece(count4, [[0.5, -0.5], [1, 0], [1, -0.5]], [[0, 0.75], [0.5, 0.25], [0, 0.25]], [0, 1, 2]);
      count4 = list2.length;
      piece(count4, [[0.25, -0.5], [0.25, -0.25], [0.5, -0.5]], [[0, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
    } else if (!array[1][2]) {
      count4 = list2.length;
      piece(count4, [[0.25, -0.75], [0.25, -0.25], [0.5, -0.5]], [[-0.25, 1], [0.25, 1], [0, 0.75]], [0, 1, 2]);
    }
  }
  if (list2.length <= 0) return { position, neighbors: currentNeighbors, mesh: null };
  // SetVertices, SetTriangles (submesh 0, its bounds), SetUVs(0), RecalculateNormals
  const n = list2.length;
  const vertices = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) { vertices[v * 3] = list2[v][0]; vertices[v * 3 + 1] = 0; vertices[v * 3 + 2] = list2[v][1]; }
  const indices = Uint32Array.from(list3);
  const uvs = Float32Array.from(list4.flat());
  const normals = recalculateNormals(vertices, indices, [{ startIndex: 0, primitiveCount: indices.length / 3 }]);
  return { position, neighbors: currentNeighbors, mesh: { vertices, uvs, indices, normals } };
}
