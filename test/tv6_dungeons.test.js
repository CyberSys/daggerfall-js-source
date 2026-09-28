// TV6 - THE DUNGEONS, DISCOVERED ON APPROACH (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28:
// "Discover on approach"). The pure law (systems/travelDungeons.js), the readout's unnamed mark, and the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_DUNGEON_TYPES, TV_DUNGEON_MAX, TV_DUNGEON_FIND_M, NATIVE_PER_M, dungeonFoundText, dungeonRows, spawnedPixels, nearDungeons, dungeonApproach,
  dungeonToFind,
} from '../src/systems/travelDungeons.js';
import { LOCATION_TYPES, getMapPixelID } from '../src/formats/mapsFile.js';
import { TV_FAR_RANGE } from '../src/systems/travelFarPlaces.js';
import { ARRIVAL_BUFFER } from '../src/systems/travelAutopilot.js';
import { spawnedMapId } from '../src/world/spawnedDungeons.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const loc = (name, locationType) => ({ name, mapTableData: { locationType } });
/** A map row as systems/mapDirectory.js buildMapDict makes it (the key is the pixel id; the MapId carries more bits). */
const mapRow = (x, y, locationType) => ({ id: getMapPixelID(x, y), mapID: (0x100000 | getMapPixelID(x, y)) >>> 0, regionIndex: 17, mapIndex: x, locationType, dungeonType: 0, discovered: false });
/** A map dict of rows, keyed as buildMapDict keys them. */
const dictOf = (rows) => new Map(rows.map((r) => [r.id, r]));
/** A spawned clone as world/spawnedDungeons.js synthesizeDungeonLocation stands it (the fields the list reads). */
const spawnLoc = (x, y, name = `Old Keep (${x},${y})`) => ({ name, spawned: true, mapTableData: { locationType: LOCATION_TYPES.DungeonKeep, mapId: spawnedMapId(1, x, y) } });

test('TV6 law: the dungeons are the travel map\'s own filter (labyrinth, keep, ruin, graveyard, coven) - never a town, a temple or a farm; AUDIT OW3 D3: gathered once off the MAP ROWS, each on its own pixel', () => {
  const L = LOCATION_TYPES;
  assert.deepEqual([...TV_DUNGEON_TYPES].sort((a, b) => a - b), [L.DungeonLabyrinth, L.DungeonKeep, L.DungeonRuin, L.Graveyard, L.Coven].sort((a, b) => a - b));
  const dict = dictOf([mapRow(10, 20, L.DungeonKeep), mapRow(11, 20, L.TownCity), mapRow(12, 20, L.HomeFarms), mapRow(13, 21, L.Graveyard),
    mapRow(999, 499, L.DungeonRuin), mapRow(15, 22, L.ReligionTemple), mapRow(0, 0, L.Coven)]);
  const rows = dungeonRows(dict);
  assert.deepEqual(rows.map((g) => [g.x, g.y, g.row.locationType]), [[10, 20, L.DungeonKeep], [13, 21, L.Graveyard], [999, 499, L.DungeonRuin], [0, 0, L.Coven]],
    'the dungeons\' rows, each at the pixel its id names (the corners too), nothing else');
  assert.equal(rows[0].row, dict.get(getMapPixelID(10, 20)), 'the row itself, carried');
  assert.deepEqual(dungeonRows(null), []);
});

test('TV6 law: the dungeons about the traveller - within the far range\'s circle, nearest first, at most TV_DUNGEON_MAX, each saying whether it is found, keyed by its map id, its place read off the live index', () => {
  const at = { x: 100, y: 100 };
  const rows = [];
  const index = new Map();
  for (let i = 1; i <= 30; i++) { rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) }); if (i !== 20) index.set(`${100 + i},100`, loc(`D${i}`, 7)); }
  rows.push({ x: 100 + TV_FAR_RANGE, y: 100 + 1, row: mapRow(100 + TV_FAR_RANGE, 101, 7) });   // inside the square, outside the circle
  index.set(`${100 + TV_FAR_RANGE},101`, loc('Past the circle', 7));
  const locAt = (x, y) => index.get(`${x},${y}`);
  const found = new Set(['102,100']);
  const list = nearDungeons({ at, dungeons: rows, locAt, isFound: (x, y) => found.has(`${x},${y}`) });
  assert.equal(TV_DUNGEON_MAX, 12);
  assert.equal(list.length, TV_DUNGEON_MAX);
  assert.deepEqual(list.map((g) => g.loc.name).slice(0, 3), ['D1', 'D2', 'D3'], 'nearest first');
  assert.deepEqual(list.map((g) => g.found).slice(0, 3), [false, true, false]);
  assert.equal(list[0].key, `dng:${mapRow(101, 100, 7).mapID}`, 'a row\'s key is its map id\'s');
  assert.equal(list[0].row.mapID, mapRow(101, 100, 7).mapID);
  assert.ok(list.every((g) => g.d <= TV_FAR_RANGE && g.spawn === false));
  assert.equal(nearDungeons({ at, dungeons: [rows.at(-1)], locAt, isFound: () => false }).length, 0, 'the range is a circle');
  // the index is read at the ask - a place that came (or went) since the rows were gathered is seen
  assert.equal(nearDungeons({ at, dungeons: rows, locAt, isFound: () => false, max: 40 }).length, TV_FAR_RANGE - 1, 'the 20th row has no place yet (and 25-30 lie past the circle)');
  index.set('120,100', loc('Late', 7));
  index.delete('101,100');
  const again = nearDungeons({ at, dungeons: rows, locAt, isFound: () => false, max: 40 });
  assert.equal(again.length, TV_FAR_RANGE - 1, 'one gone, one come');
  assert.deepEqual([again[0].loc.name, again.find((g) => g.x === 120)?.loc.name], ['D2', 'Late']);
});

test('AUDIT OW3 D3: FILTERED, THEN CAPPED - a row with no named place in the index, one a spawn stands on, and a FOUND one inside the grid (TV2\'s plate) spend none of the twelve; an unfound one inside the grid is a lair and counts', () => {
  const at = { x: 100, y: 100 };
  const rows = [];
  const index = new Map();
  for (let i = 1; i <= 30; i++) rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) });
  for (let i = 4; i <= 30; i++) index.set(`${100 + i},100`, loc(`D${i}`, 7));   // 101-103: rows the index has no place for
  index.set('104,100', loc('', 7));   // a nameless one
  index.set('105,100', spawnLoc(105, 100));   // a spawn stands on the row's pixel (a row with no exterior is never indexed)
  const found = new Set(['106,100', '107,100', '110,100']);
  const q = { at, dungeons: rows, locAt: (x, y) => index.get(`${x},${y}`), isFound: (x, y) => found.has(`${x},${y}`), grid: 9 };
  const list = nearDungeons(q);
  assert.equal(list.length, TV_DUNGEON_MAX, 'twelve marked - none of the unmarkable took a slot');
  assert.deepEqual(list.map((g) => g.loc.name), ['D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19'],
    '106 and 107 found inside the grid are TV2\'s; 108 and 109 unfound inside it are lairs; 110 found past it a plate');
  assert.deepEqual(list.map((g) => g.found).slice(0, 4), [false, false, true, false]);
  assert.ok(!list.some((g) => g.x === 105), 'the spawn\'s pixel is not a row\'s (unsaid, it is nobody\'s)');
  assert.deepEqual(nearDungeons({ ...q, grid: -1 }).map((g) => g.loc.name).slice(0, 3), ['D6', 'D7', 'D8'], 'no grid: every found one is marked here');
  assert.equal(nearDungeons({ ...q, max: 3 }).at(-1).loc.name, 'D10', 'the cap is taken of what is marked');
});

test('AUDIT OW3 D1: THE SPAWNED DUNGEONS - read off the live index, marked only once the spawned feature has told of them, under `spawn:<map id>`, named once filed; within the circle, nearest first among the rows, sharing the twelve', () => {
  const index = new Map([['105,100', spawnLoc(105, 100)], ['110,100', loc('Castle Dread', 7)], ['120,104', spawnLoc(120, 104)], ['1,1', { name: 'Odd', mapTableData: {} }]]);
  const spawns = spawnedPixels(index);
  assert.deepEqual(spawns.map((s) => [s.x, s.y, s.loc.name]), [[105, 100, 'Old Keep (105,100)'], [120, 104, 'Old Keep (120,104)']], 'the spawns alone, at their pixels');
  assert.deepEqual(spawnedPixels(null), []);
  const at = { x: 100, y: 100 };
  const told = new Set(), filed = new Set();
  const q = { at, dungeons: [], locAt: () => null, isFound: () => false, spawns, spawnKnown: (s) => told.has(`${s.x},${s.y}`) || filed.has(`${s.x},${s.y}`),
    spawnFound: (s) => filed.has(`${s.x},${s.y}`) };
  assert.deepEqual(nearDungeons(q), [], 'unsaid: nothing - the feature never says a spawn before its pixel is entered');
  assert.deepEqual(nearDungeons({ ...q, spawnKnown: undefined, spawnFound: undefined }), [], 'and none is told by default');
  told.add('105,100');
  let list = nearDungeons(q);
  assert.equal(list.length, 1);
  assert.deepEqual({ key: list[0].key, spawn: list[0].spawn, found: list[0].found, row: list[0].row, d: list[0].d, name: list[0].loc.name },
    { key: `spawn:${spawnedMapId(1, 105, 100)}`, spawn: true, found: false, row: null, d: 5, name: 'Old Keep (105,100)' }, 'said, not filed: a mark with no name');
  filed.add('105,100');
  assert.equal(nearDungeons(q)[0].found, true, 'filed: named, a journey');
  filed.add('120,104');
  assert.deepEqual(nearDungeons(q).map((g) => g.x), [105, 120]);
  assert.deepEqual(nearDungeons({ ...q, range: 10 }).map((g) => g.x), [105], 'the circle holds the spawns too');
  // never one without a name
  assert.deepEqual(nearDungeons({ ...q, spawns: [{ x: 106, y: 100, loc: spawnLoc(106, 100, '') }, { x: 107, y: 100, loc: null }], spawnKnown: () => true }), []);
  // the rows and the spawns: one order, one cap
  const rows = [], idx = new Map();
  for (let i = 2; i <= 20; i++) { rows.push({ x: 100 + i, y: 100, row: mapRow(100 + i, 100, 7) }); idx.set(`${100 + i},100`, loc(`D${i}`, 7)); }
  list = nearDungeons({ ...q, at, dungeons: rows, locAt: (x, y) => idx.get(`${x},${y}`), spawns: [{ x: 101, y: 100, loc: spawnLoc(101, 100) }], spawnKnown: () => true });
  assert.equal(list.length, TV_DUNGEON_MAX);
  assert.deepEqual(list.map((g) => g.spawn).slice(0, 2), [true, false], 'the spawn at one pixel ahead of the row at two');
  assert.equal(list.at(-1).loc.name, 'D12', 'and it took a slot of the twelve');
});

test('AUDIT OW3 D1: THE FIND never takes a spawn (the feature files its own on its pixel\'s entry; a kilometre reaches next door); A WALK TO ONE ends at its exterior\'s edge on the traveller\'s side, grown by the arrival buffer', () => {
  const m = (x, z) => ({ x, z });
  const list = [{ key: 's', spawn: true, found: false, mid: m(0, 10 * NATIVE_PER_M) }, { key: 'r', spawn: false, found: false, mid: m(0, 900 * NATIVE_PER_M) }];
  assert.equal(dungeonToFind({ feet: m(0, 0), list, mid: (g) => g.mid }).key, 'r', 'the nearer spawn passed over');
  assert.equal(dungeonToFind({ feet: m(0, 0), list: list.slice(0, 1), mid: (g) => g.mid }), null);
  assert.equal(ARRIVAL_BUFFER, 800);
  const rect = { minX: 10000, maxX: 14096, minZ: 20000, maxZ: 24096 };
  assert.deepEqual(dungeonApproach(rect, m(0, 22000)), m(10000 - ARRIVAL_BUFFER, 22000), 'from the west: its west edge, a buffer out, level with the feet');
  assert.deepEqual(dungeonApproach(rect, m(90000, 90000)), m(14096 + ARRIVAL_BUFFER, 24096 + ARRIVAL_BUFFER), 'from the north-east: its corner');
  assert.deepEqual(dungeonApproach(rect, m(12000, 3000)), m(12000, 20000 - ARRIVAL_BUFFER));
  assert.deepEqual(dungeonApproach(rect, m(9500, 21000)), m(9500, 21000), 'already at its door: where the feet are');
  assert.deepEqual(dungeonApproach(rect, m(0, 0), 0), m(10000, 20000), 'the buffer is a parameter');
});

test('TV6 law: THE FIND - the nearest UNDISCOVERED dungeon whose middle is within TV_DUNGEON_FIND_M of the feet; a found one, one too far or one with no middle is never found', () => {
  assert.equal(TV_DUNGEON_FIND_M, 1000);
  assert.equal(NATIVE_PER_M, 40);
  const m = (x, z) => ({ x, z });
  const list = [
    { key: 'a', found: false, mid: m(0, 1001 * NATIVE_PER_M) },   // just past it
    { key: 'c', found: false, mid: m(0, 400 * NATIVE_PER_M) },   // the nearest - ahead of a farther one in the list
    { key: 'b', found: false, mid: m(0, 900 * NATIVE_PER_M) },
    { key: 'd', found: true, mid: m(0, 10 * NATIVE_PER_M) },     // found already
    { key: 'e', found: false, mid: null },
  ];
  const got = dungeonToFind({ feet: m(0, 0), list, mid: (g) => g.mid });
  assert.equal(got.key, 'c');
  assert.equal(dungeonToFind({ feet: m(0, 0), list: list.slice(0, 1), mid: (g) => g.mid }), null, 'a kilometre and a metre: not yet');
  assert.equal(dungeonToFind({ feet: m(0, 0), list: [{ found: false, mid: m(0, 1000 * NATIVE_PER_M) }], mid: (g) => g.mid })?.found, false, 'a kilometre exactly: found');
  assert.equal(dungeonFoundText('Castle Dread'), 'You have found Castle Dread.');
});

test('TV6 readout: an undiscovered dungeon is an unnamed mark - its own look, a "?" and no journey', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const src = rd('src/ui/travelViewHud.js');
  assert.match(src, /return k === 'place' \|\| k === 'far' \|\| k === 'dest' \|\| k === 'target' \|\| k === 'party' \|\| k === 'lair'( \|\| k === 'band')? \? k : 'traveller';/, 'the lair look');
  assert.equal(hud.TRAVEL_VIEW_MARK_COLORS.lair, '#b0443a');
  assert.match(src, /look === 'lair' \? C\.lair/);
});

test('TV6 host: the dungeons gathered once, listed on a pixel or a find, marked found (a far plate, a journey) or not (the lair); the find on the enhanced interface outdoors, through the port\'s own store, said on the screen', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ dungeonRows, spawnedPixels, nearDungeons, dungeonApproach, dungeonToFind, dungeonFoundText, NATIVE_PER_M \} from '\.\.\/systems\/travelDungeons\.js';/);
  assert.match(w, /_tvDungeonRows \?\?= dungeonRows\(mapDict\)/, 'AUDIT OW3 D3: gathered once off the map rows');
  assert.doesNotMatch(w, /\?\?= dungeon\w*\(locationIndex\)/, 'AUDIT OW3 D3: never a one-time snapshot of the live index');
  assert.match(w, /if \(tvDng\.at && tvDng\.at\.x === at\.x && tvDng\.at\.y === at\.y && tvDng\.dg === dg && tvDng\.grid === grid && tvDng\.n === n\) return tvDng\.list;/, 'kept between pixels and finds (and while the grid and the index hold)');
  assert.match(w, /if \(g\.found\) \{\n\s*if \(!g\.spawn && `far:\$\{g\.row\.mapID\}` === farEnd\) continue;/, 'a found one past the grid (the list keeps no other): a plate, but the journey\'s own end is its flag');
  assert.match(w, /marks\.push\(\{ key: g\.key, at: tvSceneKept\(g, g\.x, g\.z, TV_PLACE_LIFT\), label: g\.loc\.name, sub: farDistanceText\(km\), kind: 'far', pick: true, edge: true \}\);/, 'a found one: a far plate, a journey');
  assert.match(w, /marks\.push\(\{ key: g\.key, at: tvSceneKept\(g, g\.x, g\.z, TV_PLACE_LIFT\), label: '\?', kind: 'lair' \}\);/, 'the rest: an unnamed lair, no journey, never held at the edge');
  assert.match(w, /if \(!isEnhanced\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \|\| !walkMode \|\| !playerSpawned\) return;/, 'the find: the enhanced interface, outdoors');
  assert.match(w, /if \(discoverLocation\(g\.row\.mapID, \{ regionName: maps\.getRegionName\(g\.row\.regionIndex\), locationName: g\.loc\.name \}\)\) townTalk\.say\(dungeonFoundText\(g\.loc\.name\), 5\);/, 'the port\'s own store, and said');
  assert.match(w, /tvFar = \{ at: null, near: -1, list: \[\] \};   \/\/ TV5: nor the far places\n\s*tvDng = \{ at: null, dg: -1, list: \[\] \};   \/\/ TV6: nor the dungeons\n/, 'a load forgets them');
  assert.match(w, /dungeonFindFrame\(performance\.now\(\)\);   \/\/ TV6/, 'the find asked every frame (itself four times a second)');
  assert.match(w, /const plate = tvPlates\.list\.find\(\(p\) => p\.key === key\) \?\? tvFar\.list\.find\(\(p\) => p\.key === key\) \?\? tvDng\.list\.find\(\(p\) => p\.key === key && p\.summary\);/, 'a found dungeon\'s plate is its journey');
});

test('AUDIT OW3 D1 host: the spawns off the live index, told as the spawned feature tells them (its line this session, or the pixel entry\'s filing - the name), the list kept only while the index holds (lifted and run)', async () => {
  const { discoverLocation, hasDiscoveredLocationId } = await import('../src/systems/discovery.js');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const grid = Math\.max\(1, state\.terrainDistance \?\? 3\), n = locationIndex\.size;/, 'the grid\'s reach, and the index\'s churn');
  assert.match(w, /nearDungeons\(\{ at, grid, dungeons: \(_tvDungeonRows \?\?= dungeonRows\(mapDict\)\), locAt: \(x, y\) => locationIndex\.get\(`\$\{x\},\$\{y\}`\),\n\s*isFound: \(x, y\) => !!tvPlaceSummary\(x, y\), spawns: spawnedPixels\(locationIndex\), spawnKnown: tvSpawnKnown, spawnFound: tvSpawnFound \}\)/,
    'the rows, the live index, the spawns read afresh - and the grid handed in, so TV2\'s own spend no slot');
  assert.match(w, /tvDng = \{ at, dg, grid, n, list \};/);
  const m = /\n {2}(const tvSpawnFound = [^\n]*;)\n {2}(const tvSpawnKnown = [^\n]*;)\n/.exec(w);
  assert.ok(m, 'the two tests the host hands the list');
  const said = new Set();
  const { tvSpawnFound, tvSpawnKnown } = new Function('hasDiscoveredLocationId', '_announcedSpawnPixels', `${m[1]} ${m[2]} return { tvSpawnFound, tvSpawnKnown };`)(hasDiscoveredLocationId, said);
  const s = { x: 105, y: 100, loc: spawnLoc(105, 100) };
  assert.deepEqual([tvSpawnKnown(s), tvSpawnFound(s)], [false, false], 'unsaid: unknown');
  said.add('105,100');
  assert.deepEqual([tvSpawnKnown(s), tvSpawnFound(s)], [true, false], 'said (announceNearbySpawns\' set): known, no name');
  said.clear();
  discoverLocation(spawnedMapId(1, 105, 100), { regionName: 'Daggerfall', locationName: s.loc.name });   // syncTopics\' pixel-entry filing (a load keeps it)
  assert.deepEqual([tvSpawnKnown(s), tvSpawnFound(s)], [true, true], 'filed: known, and named');
  assert.equal(tvSpawnKnown({ x: 106, y: 100, loc: spawnLoc(106, 100) }), false, 'its neighbour is not');
  // the two sets it reads are the feature's own
  assert.match(w, /if \(!loc\?\.spawned \|\| _announcedSpawnPixels\.has\(key\)\) return;   \/\/ the player's own pixel, once\n\s*_announcedSpawnPixels\.add\(key\);/);
  assert.match(w, /if \(dfLocation\) \{\n\s*discoverLocation\(dfLocation\.mapTableData\.mapId, \{/, 'the pixel entry files whatever the index holds there, a spawn too');
});

test('AUDIT OW3 D1 host: a spawn\'s plate is a walk to its door - TV2\'s spot journey to its exterior\'s edge, asked of the live list (an unnamed or a vanished spawn walks nowhere); the click reaches it before the place plates (lifted and run)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(key === 'dest'\) \{[^\n]*\n\s*if \(key\.startsWith\('spawn:'\)\) \{ travelViewSpawnWalk\(key\); return; \}[^\n]*\n\s*const plate = /, 'the click');
  const m = /\n {2}(function travelViewSpawnWalk\(key\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the walk');
  const rect = { minX: 10000, maxX: 14096, minZ: 20000, maxZ: 24096 };
  const list = [{ key: 'spawn:1', found: true, px: 105, py: 100, rect }, { key: 'spawn:2', found: false, px: 106, py: 100, rect }];
  let canGo = true;
  const walks = [];
  const walk = new Function('d', `const { travelViewDungeons, travelViewCanGo, state, player, dungeonApproach, travelViewWalkTo, tvSceneOf } = d; return ${m[1]};`)({
    travelViewDungeons: () => list, travelViewCanGo: () => canGo, state: { worldCoords: (p) => ({ x: p[0], y: 0, z: p[2] }) }, player: { pos: [0, 5, 22000] },
    dungeonApproach, tvSceneOf: (x, z, lift) => [x, lift, z], travelViewWalkTo: (point, pix) => { walks.push({ point, pix }); return true; },
  });
  assert.equal(walk('spawn:1'), true);
  assert.deepEqual(walks, [{ point: [10000 - ARRIVAL_BUFFER, 0, 22000], pix: { x: 105, y: 100 } }], 'to its west edge, a buffer out, on its own pixel');
  assert.equal(walk('spawn:2'), false, 'unnamed: no journey');
  assert.equal(walk('spawn:9'), false, 'gone from the live list: none');
  canGo = false;
  assert.equal(walk('spawn:1'), false, 'the gate every click passes');
  assert.equal(walks.length, 1);
});

test('AUDIT OW3 D2: THE ARRIVAL GUARD - no dungeon is found while the world is being moved (a fast travel, a Recall, a respawn, a load: the feet read mid-arrival lie up to a kilometre from where they land); the bands\' frame stands down the same (the find lifted and run)', () => {
  const w = rd('src/scenes/world.js');
  const m = /\n {2}let _tvFindAt = 0;\n {2}(function dungeonFindFrame\(now\) \{\n[\s\S]*?\n {2}\})\n/.exec(w);
  assert.ok(m, 'the find');
  let busy = true;
  const filed = [], lines = [];
  const g = { key: 'dng:1', found: false, spawn: false, row: { mapID: 1, regionIndex: 17 }, loc: { name: 'Castle Dread' }, x: 0, z: 500 * NATIVE_PER_M };
  const frame = new Function('d', `let _tvFindAt = 0; const { isEnhanced, modes, walkMode, playerSpawned, worldMoveBusy, state, player, dungeonToFind, travelViewDungeons, discoverLocation, maps, townTalk, dungeonFoundText } = d; return ${m[1]};`)({
    isEnhanced: () => true, modes: { mode: 'exterior' }, walkMode: true, playerSpawned: true, worldMoveBusy: () => busy,
    state: { worldCoords: () => ({ x: 0, y: 0, z: 0 }) }, player: { pos: [0, 0, 0] }, dungeonToFind, travelViewDungeons: () => [g],
    discoverLocation: (id, info) => { filed.push([id, info.locationName]); return true; }, maps: { getRegionName: () => 'Daggerfall' },
    townTalk: { say: (t) => lines.push(t) }, dungeonFoundText,
  });
  frame(1000);
  assert.deepEqual([filed, lines], [[], []], 'mid-arrival: nothing found, nothing said, nothing saved');
  busy = false;
  frame(1100);
  assert.deepEqual(filed, [], 'and the quarter second holds');
  frame(1300);
  assert.deepEqual(filed, [[1, 'Castle Dread']], 'landed: found');
  assert.deepEqual(lines, ['You have found Castle Dread.']);
  assert.match(w, /function bandFrame\(now\) \{\n\s*if \(worldMoveBusy\(\)\) return;/, 'the bands: the one guard line, first');
  assert.match(w, /function worldMoveBusy\(\) \{\n(\s*\/\/[^\n]*\n)*\s*return _seasonStraightening \|\| _traveling \|\| _teleporting \|\| _recalling \|\| _respawning \|\| _loading/, 'the one question every mover answers');
});
