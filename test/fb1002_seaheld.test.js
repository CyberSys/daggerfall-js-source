// FIELD BUGS 2026-10-02 - SEA-HELD. Mac, testing sailing: "your ship can get stuck at sea in place". With Deep Waters on
// (Iliac Puddle No More), Come Sail Away reads a node as water by its ground's height, Terrain.SampleHeight under 34 m -
// and the open sea stands 6 mm under that line (step 579, 33.994 m: FIELD-CSA2). World of Daggerfall levels a site's
// ground AFTER the tiles are read (LocationLoader.AddLocation on OnPromoteTerrainData), lerping EVERY sample of its pixel
// toward the site's mean by 1 / (distance + 1): one rock field on a headland lifts the whole pixel's sea over the line,
// while its tiles stay water and Deep Waters carves and draws a sea there. Every node read land, the boat was beached
// (more than three nodes off water) and nothing moved her; and the C# reads her nodes only when she moves, so she lay
// there for good. And a bow run onto a shore could not back off it: the oars' astern asked the BOW's node. The pins,
// each red on the code before:
//   SEA-SHOAL   - a carved cell's ground is its seafloor (DW-B's law, the host's heightAt's): the boat's Terrain
//                 (world.js csaTerrainOf, mounted) reads the floor there, so the lifted sea is water again and she rows
//   BEACH-READ  - a beached boat's nodes are read again each frame she lies still: when the ground under her is put
//                 right (the carve come after her nodes were read) she comes off; a beach stays a beach
//   ASTERN      - back asks the STERN's node, the water she backs into: a bow on a shore backs off it, a stern on one
//                 refuses
// Every pin runs the real modules: the sampler's sea (world/terrainSampler.js), World of Daggerfall's flatten
// (world/wodLocationLoader.js), Unity's SampleHeight (world/terrainSurface.js), the carve's floor read
// (scenes/deepWatersHost.js carvedFloorLocalY) and Come Sail Away's runtime over the vendored hulls (test/csaScene.mjs).
// `01-Overview/Field-Bugs-2026-10-02.md`.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as surface from '../src/world/terrainSurface.js';
import { generateSamples, HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { flattenForLocation } from '../src/world/wodLocationLoader.js';
import { carvedFloorLocalY } from '../src/scenes/deepWatersHost.js';
import { VERTEX_GRID_SIZE, HOLES_RESOLUTION } from '../src/world/deepWaterFloor.js';
import { WATER_LEVEL } from '../src/systems/comeSailAway.js';
import { HULL_NAMES } from '../src/systems/comeSailAwayBoat.js';
import { scene } from './csaScene.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');
const SMALL_SHIP = HULL_NAMES.indexOf('Small Ship');
const H = HEIGHTMAP_DIMENSION;
/** The host's own floor read (scenes/deepWatersHost.js) - pinned to its line below. */
const DEEP_WATERS = { floorLocalY(entry, lx, lz) { return carvedFloorLocalY(entry?.deepWaters, lx, lz); } };
/** world.js's csaTerrainOf - the Terrain the runtime reads its nodes on - mounted as field_csa2 mounts it, Deep Waters'
 *  host in scope, over the pixel at the scene's origin (csaScene's terrain stands there: its corner at 0, 0, 0). */
function mountTerrainOf() {
  const i = WORLD.indexOf('  const csaTerrainOf = (p) => {');
  assert.ok(i >= 0, 'csaTerrainOf');
  const body = WORLD.slice(i, WORLD.indexOf('\n  };\n', i) + 5);
  const state = { pixelTranslation: (px, py, o) => { o[0] = 0; o[1] = 0; o[2] = 0; return o; } };
  const names = ['_csaTerrains', 'state', 'TERRAIN_SIZE', 'deepWaters', ...Object.keys(surface)];
  return new Function(...names, `${body}\nreturn csaTerrainOf;`)(new WeakMap(), state, TERRAIN_SIZE, DEEP_WATERS, ...Object.values(surface));
}
/** The sea as the sampler writes it: a WOODS.WLD of nought round the pixel - every sample the ocean elevation. */
const SEA_WOODS = { getHeightMapValuesRange1Dim: (x, y, d) => new Uint8Array(d * d), getLargeHeightMapValuesRange: () => new Uint8Array(81) };
const flatSea = () => generateSamples(SEA_WOODS, 208, 215);
/** The headland: samples 100..128 along both axes (640 m on), standing at twice the sea's height (68 m). */
const HEADLAND = 100;
const onHeadland = (x, z) => x >= HEADLAND && z >= HEADLAND;
/** A coastal pixel: the open sea, a headland in its far corner, and a World of Daggerfall site on it - its rect four
 *  samples a side - levelled by the mod's own flatten. */
function coastWithSite() {
  const s = flatSea();
  const sea = s[0];
  for (let x = 0; x < H; x++) for (let z = 0; z < H; z++) if (onHeadland(x, z)) s[x * H + z] = sea * 2;
  flattenForLocation(s, { x: 108, y: 108, width: 4, height: 4 });
  return s;
}
/** Deep Waters' carve of that pixel: every sea cell a hole (Unity's holes: false is carved), the headland's cells
 *  ground; the floor 20 m under the sea. */
function carveOf() {
  const holes = new Uint8Array(HOLES_RESOLUTION * HOLES_RESOLUTION);
  for (let cz = 0; cz < HOLES_RESOLUTION; cz++) for (let cx = 0; cx < HOLES_RESOLUTION; cx++) holes[cz * HOLES_RESOLUTION + cx] = onHeadland(cx, cz) ? 1 : 0;
  return { holes, floor: { vertexLocalY: new Float32Array(VERTEX_GRID_SIZE * VERTEX_GRID_SIZE).fill(14) } };
}
/** Points of the open sea, the boat's water among them, and two far off the site. */
const SEA_POINTS = [[100, 200], [400, 50], [50, 600], [600, 300], [10, 10]];

/** The helm on `samples` (the scene's pixel, the host's Terrain over it), Deep Waters on: a Small Ship placed at `at`
 *  facing north, and taken. `roll(n, keys)` holds the keys `n` frames and answers how far she went. */
function helmOn(p, { at = [100, 34, 200] } = {}) {
  const terrain = mountTerrainOf()(p);
  const s = scene({ terrains: [terrain] });
  s.deps.iliacPuddleNoMore = () => true;
  const boat = s.helm(s.place(SMALL_SHIP, 0, at, [0, 0, 1]));
  const roll = (n, keys) => {
    const from = boat.GameObject.position.slice();
    s.held.clear();
    for (const k of keys) s.held.add(k);
    for (let i = 0; i < n; i++) s.frame();
    s.held.clear();
    const to = boat.GameObject.position;
    return { moved: Math.hypot(to[0] - from[0], to[2] - from[2]), dz: to[2] - from[2] };
  };
  return { s, boat, roll, terrain, nodes: () => [...boat.NodeTileMapIndices] };
}

test('SEA-SHOAL: one World of Daggerfall site on a coastal pixel lifts the WHOLE pixel\'s sea over the 34 m line (the flatten, 1 / (distance + 1), runs after the tiles are read); the boat\'s Terrain reads a carved cell\'s seafloor, so the carved sea is water and she rows - and a sea the mod has not carved reads as its heightmap stands', () => {
  // the mechanism, the real flatten over the sampler's sea
  const before = flatSea();
  const coast = coastWithSite();
  for (const [lx, lz] of SEA_POINTS) {
    assert.ok(surface.terrainSampleHeightAt(before, lx, lz) < WATER_LEVEL, `(${lx}, ${lz}) the open sea, before the site: water`);
    assert.ok(surface.terrainSampleHeightAt(coast, lx, lz) >= WATER_LEVEL, `(${lx}, ${lz}) ${surface.terrainSampleHeightAt(coast, lx, lz)}: over the line once the site is levelled, ${Math.hypot(lx - 700, lz - 700).toFixed(0)} m from it`);
  }
  // the host's Terrain over the carve: the seafloor there, the headland's ground where it is not carved
  const terrainOf = mountTerrainOf();
  const p = { px: 10, py: 20, samples: coast, tilemapBytes: null, deepWaters: carveOf() };
  const t = terrainOf(p);
  for (const [lx, lz] of SEA_POINTS) assert.equal(t.sampleHeight([lx, 34, lz]), 14, `(${lx}, ${lz}) the carved cell's seafloor`);
  assert.ok(t.sampleHeight([730, 34, 730]) > 60, 'the headland: its ground, not carved');
  const bare = terrainOf({ px: 10, py: 20, samples: coast, tilemapBytes: null, deepWaters: null });
  assert.ok(bare.sampleHeight([100, 34, 200]) >= WATER_LEVEL, 'no carve: the heightmap as it stands (the shore\'s law kept)');
  assert.match(src('src/scenes/deepWatersHost.js'), /floorLocalY\(entry, lx, lz\) \{ return carvedFloorLocalY\(entry\?\.deepWaters, lx, lz\); \}/, 'the host\'s floor read is the one mounted here');
  // the boat on it: every node water, the oars move her
  const h = helmOn(p);
  assert.deepEqual(h.nodes(), [0, 0, 0, 0, 0], 'every node on the carved sea is water (they read land, all five: beached)');
  assert.equal(h.s.rt.IsBeached(h.boat), false);
  const r = h.roll(24, ['MoveForwards']);
  assert.ok(r.dz > 1, `she rows (${r.dz.toFixed(2)} m)`);
  assert.deepEqual(h.nodes(), [0, 0, 0, 0, 0]);
});

test('BEACH-READ: a boat beached by a reading the ground has since put right comes off - her nodes are read again each frame she lies still (the C# reads them only when she moves, and a beached boat never moves); a beach stays a beach, and no terrain under the player throws nothing', () => {
  const p = { px: 10, py: 20, samples: coastWithSite(), tilemapBytes: null, deepWaters: null };
  const h = helmOn(p);   // the carve not come yet (DW-A's bake read on its worker, the floor after it)
  assert.deepEqual(h.nodes(), [1, 1, 1, 1, 1], 'read on the lifted heightmap: all five land');
  assert.equal(h.s.rt.IsBeached(h.boat), true);
  h.s.frame();   // her first frame at the helm takes the moved arm - the C#'s read, the collision with it
  h.s.deps.sphereCastAll = () => [{ point: [100, 34, 150], distance: 30, name: 'Rock', root: null, terrain: false, entity: false }];   // a rock astern
  assert.equal(h.roll(8, ['MoveForwards']).moved, 0, 'beached: the oars move nothing');
  assert.deepEqual(h.s.rt.state.collisionDirections, [], 'and lying still she sweeps nothing');
  p.deepWaters = carveOf();   // the carve comes
  h.s.frame();
  assert.deepEqual(h.nodes(), [0, 0, 0, 0, 0], 'read again where she lies: water');
  assert.equal(h.s.rt.state.collisionDirections.length, 2, 'and her collision with them, the frame she comes off (both sweeps)');
  h.s.deps.sphereCastAll = () => [];
  const r = h.roll(24, ['MoveForwards']);
  assert.ok(r.dz > 1, `off, and rowing (${r.dz.toFixed(2)} m)`);
  // a beach stays a beach: on the headland's ground every reading is land, every frame
  const beach = helmOn({ px: 10, py: 20, samples: coastWithSite(), tilemapBytes: null, deepWaters: carveOf() }, { at: [730, 34, 730] });
  assert.deepEqual(beach.nodes(), [1, 1, 1, 1, 1]);
  assert.equal(beach.roll(24, ['MoveForwards']).moved, 0, 'still beached');
  assert.deepEqual(beach.nodes(), [1, 1, 1, 1, 1]);
  // no built terrain under the player while she lies beached: nothing read, nothing thrown (the C#'s throw is on a move)
  const none = helmOn({ px: 10, py: 20, samples: coastWithSite(), tilemapBytes: null, deepWaters: null });
  none.s.frame();   // her first frame at the helm takes the moved arm (the last place it holds is not hers) - the C#'s read
  none.s.deps.playerTerrain = () => null;
  assert.doesNotThrow(() => { for (let i = 0; i < 8; i++) none.s.frame(); });
  assert.deepEqual(none.nodes(), [1, 1, 1, 1, 1], 'read on nothing: as they were');
});

test('ASTERN: back asks the STERN\'s node, the water she backs into - a bow run onto a shore backs off it (it asked the bow\'s, and the centre\'s water rowed her on in); a stern on a shore refuses back and still rows ahead; forward asks the centre\'s, as the C# does', () => {
  // a straight shore north of her: samples 33 on (211.2 m) stand at twice the sea; her bow's node (219.9 m) on it
  const north = flatSea();
  for (let x = 0; x < H; x++) for (let z = 33; z < H; z++) north[x * H + z] = north[0] * 2;
  const bow = helmOn({ px: 10, py: 20, samples: north, tilemapBytes: null, deepWaters: null });
  assert.deepEqual(bow.nodes(), [0, 1, 0, 0, 0], 'the bow on the shore, the rest afloat');
  const back = bow.roll(80, ['MoveBackwards']);   // the shore's line crossed 204.9 m on: 15 m astern
  assert.ok(back.dz < -15, `she backs off it (${back.dz.toFixed(2)} m)`);
  assert.deepEqual(bow.nodes(), [0, 0, 0, 0, 0], 'off the shore');
  // a shore south of her: samples to 28 (179.2 m) on it; her stern's node (175.7 m) there
  const south = flatSea();
  for (let x = 0; x < H; x++) for (let z = 0; z <= 28; z++) south[x * H + z] = south[0] * 2;
  const stern = helmOn({ px: 10, py: 20, samples: south, tilemapBytes: null, deepWaters: null });
  assert.deepEqual(stern.nodes(), [0, 0, 1, 0, 0], 'the stern on the shore');
  assert.equal(stern.roll(24, ['MoveBackwards']).moved, 0, 'back: refused - the stern would go up the shore');
  assert.ok(stern.roll(24, ['MoveForwards']).dz > 1, 'ahead: the centre\'s water, as the C# asks');
});
