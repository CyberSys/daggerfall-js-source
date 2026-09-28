// TV6 - THE DUNGEONS, DISCOVERED ON APPROACH (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28:
// "Discover on approach"). The pure law (systems/travelDungeons.js), the readout's unnamed mark, and the host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_DUNGEON_TYPES, TV_DUNGEON_MAX, TV_DUNGEON_FIND_M, NATIVE_PER_M, dungeonFoundText, dungeonPixels, nearDungeons, dungeonToFind,
} from '../src/systems/travelDungeons.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { TV_FAR_RANGE } from '../src/systems/travelFarPlaces.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const loc = (name, locationType) => ({ name, mapTableData: { locationType } });

test('TV6 law: the dungeons are the travel map\'s own filter (labyrinth, keep, ruin, graveyard, coven) - never a town, a temple or a farm; gathered once off the pixel index', () => {
  const L = LOCATION_TYPES;
  assert.deepEqual([...TV_DUNGEON_TYPES].sort((a, b) => a - b), [L.DungeonLabyrinth, L.DungeonKeep, L.DungeonRuin, L.Graveyard, L.Coven].sort((a, b) => a - b));
  const index = new Map([
    ['10,20', loc('Castle Dread', L.DungeonKeep)], ['11,20', loc('Daggerfall', L.TownCity)], ['12,20', loc('The Old Farm', L.HomeFarms)],
    ['13,21', loc('Old Barrows', L.Graveyard)], ['14,22', loc('', L.DungeonRuin)], ['15,22', loc('Shrine', L.ReligionTemple)],
  ]);
  assert.deepEqual(dungeonPixels(index).map((g) => [g.x, g.y, g.loc.name]), [[10, 20, 'Castle Dread'], [13, 21, 'Old Barrows']], 'the dungeons with a name, nothing else');
  assert.deepEqual(dungeonPixels(null), []);
});

test('TV6 law: the dungeons about the traveller - within the far range\'s circle, nearest first, at most TV_DUNGEON_MAX, each saying whether it is found', () => {
  const at = { x: 100, y: 100 };
  const dungeons = [];
  for (let i = 1; i <= 30; i++) dungeons.push({ x: 100 + i, y: 100, loc: loc(`D${i}`, 7) });
  dungeons.push({ x: 100 + TV_FAR_RANGE, y: 100 + 1, loc: loc('Past the circle', 7) });   // inside the square, outside the circle
  const found = new Set(['102,100']);
  const list = nearDungeons({ at, dungeons, isFound: (x, y) => found.has(`${x},${y}`) });
  assert.equal(TV_DUNGEON_MAX, 12);
  assert.equal(list.length, TV_DUNGEON_MAX);
  assert.deepEqual(list.map((g) => g.loc.name).slice(0, 3), ['D1', 'D2', 'D3'], 'nearest first');
  assert.deepEqual(list.map((g) => g.found).slice(0, 3), [false, true, false]);
  assert.ok(list.every((g) => g.d <= TV_FAR_RANGE));
  assert.equal(nearDungeons({ at, dungeons: [dungeons.at(-1)], isFound: () => false }).length, 0, 'the range is a circle');
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
  assert.match(src, /return k === 'place' \|\| k === 'far' \|\| k === 'dest' \|\| k === 'target' \|\| k === 'party' \|\| k === 'lair' \? k : 'traveller';/, 'the lair look');
  assert.equal(hud.TRAVEL_VIEW_MARK_COLORS.lair, '#b0443a');
  assert.match(src, /look === 'lair' \? C\.lair/);
});

test('TV6 host: the dungeons gathered once, listed on a pixel or a find, marked found (a far plate, a journey) or not (the lair); the find on the enhanced interface outdoors, through the port\'s own store, said on the screen', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ dungeonPixels, nearDungeons, dungeonToFind, dungeonFoundText, NATIVE_PER_M \} from '\.\.\/systems\/travelDungeons\.js';/);
  assert.match(w, /_tvDungeonPx \?\?= dungeonPixels\(locationIndex\)/);
  assert.match(w, /if \(tvDng\.at && tvDng\.at\.x === at\.x && tvDng\.at\.y === at\.y && tvDng\.dg === dg\) return tvDng\.list;/, 'kept between pixels and finds');
  assert.match(w, /marks\.push\(\{ key: g\.key, at: tvSceneKept\(g, g\.x, g\.z, TV_PLACE_LIFT\), label: g\.summary\.loc\.name, sub: farDistanceText\(km\), kind: 'far', pick: true, edge: true \}\);/, 'a found one: a far plate, a journey');
  assert.match(w, /marks\.push\(\{ key: g\.key, at: tvSceneKept\(g, g\.x, g\.z, TV_PLACE_LIFT\), label: '\?', kind: 'lair' \}\);/, 'the rest: an unnamed lair, no journey, never held at the edge');
  assert.match(w, /if \(!isEnhanced\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \|\| !walkMode \|\| !playerSpawned\) return;/, 'the find: the enhanced interface, outdoors');
  assert.match(w, /if \(discoverLocation\(g\.row\.mapID, \{ regionName: maps\.getRegionName\(g\.row\.regionIndex\), locationName: g\.loc\.name \}\)\) townTalk\.say\(dungeonFoundText\(g\.loc\.name\), 5\);/, 'the port\'s own store, and said');
  assert.match(w, /tvFar = \{ at: null, near: -1, list: \[\] \};   \/\/ TV5: nor the far places\n\s*tvDng = \{ at: null, dg: -1, list: \[\] \};   \/\/ TV6: nor the dungeons\n/, 'a load forgets them');
  assert.match(w, /dungeonFindFrame\(performance\.now\(\)\);   \/\/ TV6/, 'the find asked every frame (itself four times a second)');
  assert.match(w, /const plate = tvPlates\.list\.find\(\(p\) => p\.key === key\) \?\? tvFar\.list\.find\(\(p\) => p\.key === key\) \?\? tvDng\.list\.find\(\(p\) => p\.key === key && p\.summary\);/, 'a found dungeon\'s plate is its journey');
});
