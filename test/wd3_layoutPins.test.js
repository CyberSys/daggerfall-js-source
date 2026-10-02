// WD3 (2026-10-01, Mac: "ensure this doesn't conflict or regress anything (For example housing customization)") - THE
// HOUSING PROMISE: a town keeps the layout a save's things were made in (src/systems/layoutPins.js). Beautiful Villages
// and Beautiful Cities REPLACE Daggerfall's towns, and a building is known by its key - where it stands - so the house
// bought, the room rented, the quest's building, the item at the smith, the anchor set indoors and the save made
// inside are each stamped with their town's layout when they are made, and a load keeps each town its records hold in
// that layout.
//
// Held here: the stamp's spelling and reading (versions carried, ignored when two layouts are compared, classic as no
// field); which mods CHANGE a town (its location file, a block its grid names; the safe answer for a town the host
// cannot say); the layout a town is served in now (the latch, the pin out, the pin in); the pins a save asks for (the
// strongest record decides; a mod that changes nothing there pins nothing; a town already in its layout needs none);
// the pins installed (the towns whose answer changed); the records read off a save; and every record stamped where it
// is made - the deed, the room, the repair ticket, the anchor, the quest's building site, the cached interior, the
// discoveries (stamped, saved, restored, and forgotten where the layout moved).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAYOUT_MODS, CLASSIC_LAYOUT, HOME_LAYOUTS_WAIT_MS, HOME_LAYOUTS_RETRIES, RECORD_WEIGHT, configureLayoutPins, layoutModTouches, layoutStampOf,
  stampVendors, pinAt, layoutStampAt, layoutStampOfMapId, layoutStampOfPixel, layoutsMatch, layoutStampOfTown, stampLayout,
  layoutLocationKeyOfMapId, pinsFrom, setLayoutPins, vendorsPinnedIn, layoutPins, layoutRecordsOf, _resetLayoutPins,
} from '../src/systems/layoutPins.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { makeLocationKey } from '../src/systems/worldDataVariants.js';
import { HOME_LAYOUT_MODS, homeLayoutOk } from '../src/net/homeLaw.js';
import { allocateHouseToPlayer } from '../src/systems/banking.js';
import { rentRoom } from '../src/systems/tavern.js';
import { leaveForRepair } from '../src/systems/repairService.js';
import { makeAnchor, WORLD_CONTEXT } from '../src/systems/teleportAnchor.js';
import { discoverBuilding, discoveredBuildings, snapshotDiscovery, restoreDiscovery, pruneDiscoveryLayouts } from '../src/systems/discovery.js';
import { createSceneCache, cacheScene, restoreCachedScene, snapshotSceneCache, restoreSceneCache } from '../src/systems/sceneCache.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BV = 'beautiful-villages', BC = 'beautiful-cities';
const VILLAGE = makeLocationKey(17, 958), CITY = makeLocationKey(17, 4), TAVERN = makeLocationKey(23, 210), DUNGEON = makeLocationKey(17, 3);
const MAP_IDS = new Map([[1001, VILLAGE], [1002, CITY], [1003, TAVERN], [1004, DUNGEON]]);
const PIXELS = new Map([['100,200', VILLAGE], ['101,200', CITY], ['102,200', TAVERN]]);
const TOWNS = new Map([['17:Aldleigh', VILLAGE], ['17:Daggerfall', CITY], ['23:The Rusty Mug', TAVERN]]);
const GRIDS = new Map([[VILLAGE, ['FARMAA01.RMB']], [CITY, ['FIGHBM00.RMB', 'TEMPAAH0.RMB']], [TAVERN, ['TVRNAL01.RMB', 'CUSTAA06.RMB']], [DUNGEON, ['GRVEAS01.RMB']]]);

/** The door holding what each mod carries - Villages the village's location and the tavern's block, Cities the city's
 *  location and the shared FIGHBM00 - and the hosts' resolvers; `on` the mods loaded for the game. */
function world({ on = [BV, BC], versions = { [BV]: '1.4.2', [BC]: '0.5.0' } } = {}) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  registerWorldDataAsset('location-17-958.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('TVRNAL01.RMB.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('FIGHBM00.RMB.json', {}, null, { priority: 10, vendor: BV });
  registerWorldDataAsset('location-17-4.json', {}, null, { priority: 20, vendor: BC });
  registerWorldDataAsset('FIGHBM00.RMB.json', {}, null, { priority: 20, vendor: BC });
  configureLayoutPins({
    vendorOn: (v) => on.includes(v), vendorVersion: (v) => versions[v] ?? '',
    locationKeyOfMapId: (id) => MAP_IDS.get(id) ?? null, locationKeyOfPixel: (x, y) => PIXELS.get(`${x},${y}`) ?? null,
    gridOf: (k) => GRIDS.get(k) ?? null, locationKeyOfTown: (r, name) => TOWNS.get(`${r}:${name}`) ?? null,
  });
}
const pin = (out = [], inn = [], stamp = CLASSIC_LAYOUT, why = 'house') => ({ out: new Set(out), in: new Set(inn), stamp, why });

test('WD3 the stamp: the layout mods serving a town, `vendor@version` sorted and joined by +, the classic town no field at all; read back as its mods, two stamps one layout whatever versions they name; the service\'s law takes every stamp the pins write', () => {
  world();
  assert.deepEqual(LAYOUT_MODS, [BV, BC]);
  assert.deepEqual(HOME_LAYOUT_MODS, LAYOUT_MODS, 'the service\'s list is the pins\' (net/homeLaw.js)');
  assert.equal(CLASSIC_LAYOUT, 'classic');
  assert.equal(layoutStampOf([BV]), 'beautiful-villages@1.4.2');
  assert.equal(layoutStampOf([BV, BC]), 'beautiful-cities@0.5.0+beautiful-villages@1.4.2', 'sorted - one spelling a layout');
  assert.equal(layoutStampOf([BC, BV, 'detailed-ships']), layoutStampOf([BV, BC]), 'a mod that moves no building is no part of a layout');
  assert.equal(layoutStampOf([]), CLASSIC_LAYOUT);
  configureLayoutPins({ vendorVersion: () => '' });
  assert.equal(layoutStampOf([BV]), 'beautiful-villages@?', 'a version the loader could not say');
  for (const s of [layoutStampOf([BV]), layoutStampOf([BV, BC]), 'beautiful-villages@?']) assert.equal(homeLayoutOk(s), true, s);
  assert.equal(homeLayoutOk(null), true, 'Daggerfall\'s own town');
  for (const bad of ['classic', '', 'beautiful-villages', 'detailed-ships@1.0.0', 'beautiful-villages@1+beautiful-villages@2', 'a'.repeat(97), 42]) assert.equal(homeLayoutOk(bad), false, JSON.stringify(bad));
  assert.deepEqual([...stampVendors('beautiful-cities@0.5.0+beautiful-villages@1.4.2')].sort(), [BC, BV]);
  for (const none of [undefined, null, '', CLASSIC_LAYOUT, 'detailed-ships@1.0.0']) assert.equal(stampVendors(none).size, 0, String(none));
  assert.equal(layoutsMatch('beautiful-villages@1.4.2', 'beautiful-villages@1.5.0'), true, 'a mod updated is the same layout\'s mod');
  assert.equal(layoutsMatch(undefined, CLASSIC_LAYOUT), true, 'a record from before WD3 is classic');
  assert.equal(layoutsMatch('beautiful-villages@1.4.2', CLASSIC_LAYOUT), false);
  assert.equal(layoutsMatch('beautiful-villages@1.4.2', 'beautiful-cities@0.5.0+beautiful-villages@1.4.2'), false);
  const rec = { a: 1 };
  assert.equal(stampLayout(rec, 'beautiful-villages@1.4.2'), rec);
  assert.equal(rec.layout, 'beautiful-villages@1.4.2');
  stampLayout(rec, CLASSIC_LAYOUT);
  assert.equal('layout' in rec, false, 'the classic town writes nothing - a game without the mods saves what it saved before');
  assert.equal(stampLayout(null, 'x'), null);
});

test('WD3 which mods CHANGE a town: the one carrying its location file, or a block its grid names - a mod that changes nothing there is no part of its stamp; a town the host cannot say is changed by every mod (the safe answer)', () => {
  world();
  assert.equal(layoutModTouches(BV, VILLAGE), true, 'its location file');
  assert.equal(layoutModTouches(BC, VILLAGE), false, 'Cities carries neither the village nor a block of it');
  assert.equal(layoutModTouches(BC, CITY), true);
  assert.equal(layoutModTouches(BV, CITY), true, 'Villages carries FIGHBM00, which the city\'s grid names');
  assert.equal(layoutModTouches(BV, TAVERN), true, 'a roadside tavern changes through its block alone');
  assert.equal(layoutModTouches(BC, TAVERN), false);
  assert.equal(layoutModTouches(BV, DUNGEON), false, 'a graveyard neither touches');
  assert.equal(layoutModTouches(BV, makeLocationKey(40, 9)), true, 'a town whose grid the host cannot say');
  assert.equal(layoutModTouches(BV, null), true);
  assert.equal(layoutModTouches('detailed-ships', VILLAGE), false, 'a mod that is not on the door carries nothing');
});

test('WD3 the layout a town is served in now: the mods loaded for the game that change it - less a pin out, plus a pin in; a map id, a pixel and a discovered town each resolve to it, and a town the host cannot place to the mods as loaded', () => {
  world();
  assert.equal(layoutStampAt(VILLAGE), 'beautiful-villages@1.4.2');
  assert.equal(layoutStampAt(CITY), 'beautiful-cities@0.5.0+beautiful-villages@1.4.2', 'both change the city (its file, and FIGHBM00)');
  assert.equal(layoutStampAt(DUNGEON), CLASSIC_LAYOUT);
  assert.equal(layoutStampOfMapId(1001), layoutStampAt(VILLAGE));
  assert.equal(layoutStampOfPixel(102, 200), 'beautiful-villages@1.4.2');
  assert.equal(layoutStampOfTown('17:Daggerfall'), layoutStampAt(CITY));
  assert.equal(layoutStampOfTown('17:Nowhere'), null, 'a town the host cannot place: neither stamped nor pruned');
  assert.equal(layoutStampOfTown('garbage'), null);
  assert.equal(layoutStampOfMapId(0), layoutStampOf([BV, BC]), 'no town: as the mods loaded serve every town');
  assert.equal(layoutStampOfPixel(NaN, 1), layoutStampOf([BV, BC]));
  assert.equal(layoutLocationKeyOfMapId(1002), CITY); assert.equal(layoutLocationKeyOfMapId(0), null); assert.equal(layoutLocationKeyOfMapId(9), null);
  setLayoutPins(new Map([[CITY, pin([BC])], [VILLAGE, pin([BV])]]));
  assert.equal(layoutStampAt(CITY), 'beautiful-villages@1.4.2', 'a pin out');
  assert.equal(layoutStampAt(VILLAGE), CLASSIC_LAYOUT);
  assert.deepEqual(pinAt(CITY).out, new Set([BC])); assert.equal(pinAt(TAVERN), null);
  world({ on: [] });
  assert.equal(layoutStampAt(VILLAGE), CLASSIC_LAYOUT, 'no mod loaded');
  setLayoutPins(new Map([[VILLAGE, pin([], [BV])]]));
  assert.equal(layoutStampAt(VILLAGE), 'beautiful-villages@1.4.2', 'a pin in - the house bought in the village keeps its village');
  assert.equal(layoutStampAt(TAVERN), CLASSIC_LAYOUT);
});

test('WD3 the pins a save asks for: the strongest record of a town decides (a house, a room, a quest site, an inside save or an anchor, a repair ticket); a town already in its layout needs none; a mod pinned out only where it changes the town, in only where the stamp names it', () => {
  world();
  assert.deepEqual(RECORD_WEIGHT, { house: 5, room: 4, quest: 3, inside: 2, anchor: 2, repair: 1 });
  const v = 'beautiful-villages@1.4.2', both = 'beautiful-cities@0.5.0+beautiful-villages@1.4.2';
  // everything made in the towns as the mods serve them now: nothing to pin
  assert.equal(pinsFrom([{ locationKey: VILLAGE, stamp: v, kind: 'house' }, { locationKey: CITY, stamp: both, kind: 'room' }, { locationKey: DUNGEON, stamp: undefined, kind: 'quest' }]).size, 0);
  // a house bought in the classic village before the mod: the mod pinned out
  let pins = pinsFrom([{ locationKey: VILLAGE, stamp: undefined, kind: 'house' }]);
  assert.deepEqual([...pins.keys()], [VILLAGE]);
  assert.deepEqual(pins.get(VILLAGE), pin([BV], [], CLASSIC_LAYOUT, 'house'));
  // the strongest record wins: a house (classic) over a repair ticket (made since, in the village)
  pins = pinsFrom([{ locationKey: VILLAGE, stamp: v, kind: 'repair' }, { locationKey: VILLAGE, stamp: undefined, kind: 'house' }, { locationKey: VILLAGE, stamp: v, kind: 'room' }]);
  assert.deepEqual(pins.get(VILLAGE).out, new Set([BV]));
  assert.equal(pins.get(VILLAGE).why, 'house');
  pins = pinsFrom([{ locationKey: CITY, stamp: v, kind: 'anchor' }, { locationKey: CITY, stamp: both, kind: 'quest' }]);
  assert.equal(pins.size, 0, 'the quest site outranks the anchor, and it stands in the city as served');
  // a city room from Villages-only days: Cities pinned out, Villages kept
  pins = pinsFrom([{ locationKey: CITY, stamp: v, kind: 'room' }]);
  assert.deepEqual(pins.get(CITY), pin([BC], [], v, 'room'));
  // a tavern record made classic: only Villages changes it, so only Villages is pinned out
  assert.deepEqual(pinsFrom([{ locationKey: TAVERN, stamp: CLASSIC_LAYOUT, kind: 'inside' }]).get(TAVERN).out, new Set([BV]));
  // records of no town, or of a town the host cannot place, ask nothing
  assert.equal(pinsFrom([{ locationKey: null, stamp: undefined, kind: 'house' }, { locationKey: -1, kind: 'house' }, null]).size, 0);
  assert.equal(pinsFrom(undefined).size, 0);
  // the mods switched off since: a house bought in the village pins Villages IN, and only Villages
  world({ on: [] });
  pins = pinsFrom([{ locationKey: VILLAGE, stamp: v, kind: 'house' }, { locationKey: CITY, stamp: both, kind: 'house' }, { locationKey: DUNGEON, stamp: undefined, kind: 'house' }]);
  assert.deepEqual(pins.get(VILLAGE), pin([], [BV], v, 'house'));
  assert.deepEqual(pins.get(CITY).in, new Set([BV, BC]));
  assert.equal(pins.has(DUNGEON), false);
});

test('WD3 the pins installed: the towns whose answer changed - pinned, released, pinned otherwise - and no others; the packs a pin lets in; the door\'s oracle is the module\'s', () => {
  world();
  let changed = setLayoutPins(new Map([[VILLAGE, pin([BV])], [CITY, pin([BC])]]));
  assert.deepEqual([...changed].sort(), [VILLAGE, CITY].sort());
  changed = setLayoutPins(new Map([[VILLAGE, pin([BV])], [CITY, pin([BC])]]));
  assert.equal(changed.size, 0, 'the same pins again: nothing to read again');
  changed = setLayoutPins(new Map([[VILLAGE, pin([BV])], [CITY, pin([BC, BV])], [TAVERN, pin([], [BV])]]));
  assert.deepEqual([...changed].sort(), [CITY, TAVERN].sort());
  assert.deepEqual([...vendorsPinnedIn()], [BV]);
  changed = setLayoutPins(new Map());
  assert.deepEqual([...changed].sort(), [VILLAGE, CITY, TAVERN].sort(), 'released');
  assert.equal(layoutPins().size, 0);
  assert.equal(setLayoutPins(null).size, 0);
  assert.match(src('src/systems/layoutPins.js'), /export const pinAt = \(locationKey\) => _pins\.get\(locationKey\) \?\? null;\nsetLayoutPinOracle\(pinAt\);/, 'the door asks this module');
  assert.equal(HOME_LAYOUTS_WAIT_MS, 6000); assert.equal(HOME_LAYOUTS_RETRIES, 4);
});

test('WD3 a save\'s building-keyed records, as the pins read them: deeds, rooms, quest sites and repair tickets by their town\'s map id (a key and a town each, or nothing), an anchor only inside a building, the save itself made inside one', () => {
  world();
  const houses = [{ mapId: 1001, buildingKey: 0x10203, layout: 'beautiful-villages@1.4.2' }, { mapId: 0, buildingKey: 0 }, { mapId: 1002, buildingKey: 0 }, null];
  const rooms = [{ mapId: 1003, buildingKey: 0x305 }];
  const sites = [{ mapId: 1002, buildingKey: 0x10101, layout: 'beautiful-cities@0.5.0' }, { mapId: 1002, buildingKey: 0 }];
  const repairs = [{ buildingKey: 9, mapId: 1001 }, { buildingKey: 9 }];
  const recs = layoutRecordsOf({ houses, rooms, sites, repairs, anchor: { insideBuilding: true, pixel: { x: 101, y: 200 }, layout: 'x' }, inside: { pixel: { x: 102, y: 200 } } });
  assert.deepEqual(recs, [
    { locationKey: VILLAGE, stamp: 'beautiful-villages@1.4.2', kind: 'house' },
    { locationKey: TAVERN, stamp: undefined, kind: 'room' },
    { locationKey: CITY, stamp: 'beautiful-cities@0.5.0', kind: 'quest' },
    { locationKey: VILLAGE, stamp: undefined, kind: 'repair' },
    { locationKey: CITY, stamp: 'x', kind: 'anchor' },
    { locationKey: TAVERN, stamp: undefined, kind: 'inside' },
  ]);
  assert.deepEqual(layoutRecordsOf({ anchor: { insideBuilding: false, pixel: { x: 1, y: 1 } } }), [], 'an anchor outdoors names no building');
  assert.deepEqual(layoutRecordsOf(), []);
  assert.deepEqual(layoutRecordsOf({ houses: [{ mapId: 5, buildingKey: 1 }] }, { locationKeyOfMapId: () => 77 }), [{ locationKey: 77, stamp: undefined, kind: 'house' }], 'the resolvers may be handed in');
});

test('WD3 every record is stamped where it is made: the deed, the room, the repair ticket (its town beside its key), the anchor set indoors - each with its town\'s layout now, and nothing at all in a classic town', () => {
  world();
  const houses = [{}, {}];
  const slot = allocateHouseToPlayer(houses, 1, { buildingKey: 0x10203, mapId: 1001, location: 'Aldleigh' });
  assert.equal(slot.layout, 'beautiful-villages@1.4.2');
  assert.equal('layout' in allocateHouseToPlayer([{}], 0, { buildingKey: 7, mapId: 1004 }), false, 'a classic town\'s deed is the deed it always was');
  const rooms = [];
  const room = rentRoom(rooms, { days: 1, nowMinutes: 0, mapId: 1002, buildingKey: 0x305, name: 'The Rusty Mug', rolls: () => 0 });
  assert.equal(room.layout, 'beautiful-cities@0.5.0+beautiful-villages@1.4.2');
  const renewed = rentRoom(rooms, { room, days: 1, nowMinutes: 0 });
  assert.equal(renewed.layout, room.layout, 'a renewal keeps the stamp the room was let under');
  const item = {};
  leaveForRepair(item, 0x10203, 60, 100, 1003);
  assert.deepEqual(item.repairData, { buildingKey: 0x10203, timeStarted: 100, repairTime: 60, mapId: 1003, layout: 'beautiful-villages@1.4.2' });
  const old = {};
  leaveForRepair(old, 0x10203, 60, 100);
  assert.deepEqual(old.repairData, { buildingKey: 0x10203, timeStarted: 100, repairTime: 60 }, 'a caller with no town: a ticket that holds none');
  const inside = makeAnchor({ worldContext: WORLD_CONTEXT.Interior, pixel: { x: 101, y: 200 }, nativeX: 0, nativeZ: 0, buildingKey: 0x10101 });
  assert.equal(inside.layout, 'beautiful-cities@0.5.0+beautiful-villages@1.4.2');
  assert.equal('layout' in makeAnchor({ worldContext: WORLD_CONTEXT.Exterior, pixel: { x: 101, y: 200 }, nativeX: 0, nativeZ: 0 }), false, 'outdoors: no building');
  // ...and the sites whose record lives elsewhere, by source: the quest's building site, the online claim, the inside save, the cached interior
  assert.match(src('src/systems/quest/place.js'), /this\.sitePending = false;\n {4}this\._stampSiteLayout\(\);/);
  assert.match(src('src/systems/quest/place.js'), /if \(sd\?\.siteType === SITE_TYPES\.Building && sd\.buildingKey > 0\) stampLayout\(sd, layoutStampOfMapId\(sd\.mapId\)\);/);
  assert.match(src('src/systems/onlineHomes.js'), /const stamp = layoutStampOfMapId\(mapId\);\n {4}const layout = stamp && stamp !== CLASSIC_LAYOUT \? stamp : null;/);
  assert.match(src('src/scenes/world.js'), /if \(interior\) \{ const at = playerTravelPixel\(\); stampLayout\(interior, layoutStampOfPixel\(at\.x, at\.y\)\); \}/);
  assert.match(src('src/scenes/worldModes.js'), /if \(townKey != null\) stampLayout\(state, layoutStampAt\(townKey\)\);\n {4}cacheScene\(sceneCache\(\), name, state\);/);
});

test('WD3 an interior\'s cached scene carries its town\'s layout through the save, and is restored only into that layout - an ordinary one cached in another layout goes, a permanent one is kept for its own', () => {
  const cache = createSceneCache();
  cacheScene(cache, 'interior:1001:66051', { lootContainers: [], layout: 'beautiful-villages@1.4.2' });
  cacheScene(cache, 'interior:1004:7', { lootContainers: [], layout: '' });
  const back = createSceneCache();
  restoreSceneCache(back, JSON.parse(JSON.stringify(snapshotSceneCache(cache))));
  assert.equal(restoreCachedScene(back, 'interior:1001:66051').layout, 'beautiful-villages@1.4.2');
  assert.equal('layout' in restoreCachedScene(back, 'interior:1004:7'), false, 'a classic town\'s scene carries none');
  const W = src('src/scenes/worldModes.js');
  assert.match(W, /if \(townKey != null && !layoutsMatch\(data\.layout, layoutStampAt\(townKey\)\)\) \{\n {6}if \(containsPermanentScene\(sceneCache\(\), name\)\) cacheScene\(sceneCache\(\), name, data\);\n {6}console\.warn\(`\[layout\] \$\{name\}: cached in another layout of this town - not restored`\);\n {6}return;\n {4}\}/);
});

test('WD3 the discoveries: a town\'s found buildings carry the layout they were found in, through the save; a load where the layout moved forgets them (the town itself stays found), a town in its layout or one the host cannot place keeps them', () => {
  world();
  restoreDiscovery(null);
  discoverBuilding('17:Aldleigh', { buildingKey: 0x10203, name: 'The Smithy', buildingType: 0 });
  discoverBuilding('17:Daggerfall', { buildingKey: 0x10101, name: 'The Bank of Daggerfall', buildingType: 0 });
  discoverBuilding('17:Nowhere', { buildingKey: 5, name: 'A House', buildingType: 0 });
  discoverBuilding('23:The Rusty Mug', { buildingKey: 9, name: 'The Rusty Mug', buildingType: 0 });
  const snap = JSON.parse(JSON.stringify(snapshotDiscovery()));
  assert.deepEqual(snap.layouts, { '17:Aldleigh': 'beautiful-villages@1.4.2', '17:Daggerfall': 'beautiful-cities@0.5.0+beautiful-villages@1.4.2', '23:The Rusty Mug': 'beautiful-villages@1.4.2' });
  restoreDiscovery(snap);
  assert.equal(pruneDiscoveryLayouts(), 0, 'every town in the layout it was found in');
  // the next game loads with Cities switched off: the city moved, the village and the tavern did not
  world({ on: [BV] });
  assert.equal(pruneDiscoveryLayouts(), 1);
  assert.deepEqual(discoveredBuildings('17:Daggerfall'), [], 'the city\'s buildings are forgotten');
  assert.equal(discoveredBuildings('17:Aldleigh').length, 1);
  assert.equal(discoveredBuildings('17:Nowhere').length, 1, 'a town the host cannot place is kept as it is');
  // a save from before WD3 carries no layouts: its towns were classic - found again in a village, they are forgotten
  restoreDiscovery({ buildings: { '17:Aldleigh': { 66051: { buildingKey: 66051, displayName: 'The Smithy' } } } });
  assert.equal(pruneDiscoveryLayouts(), 1);
  assert.equal(snapshotDiscovery().layouts, undefined, 'and a game without the mods writes no layouts at all');
  restoreDiscovery(null);
});

test('WD3 the load: the save\'s towns in the layouts its things were made in, before its place is built - online only the service\'s homes pin, a pack a pin lets in is on the door first, each changed town read again and rebuilt where it stands, and discoveries pruned', () => {
  const W = src('src/scenes/world.js');
  const at = W.indexOf('async function applyLayoutPins(extras = null) {');
  assert.ok(at > 0);
  const body = W.slice(at, W.indexOf('\n  async function worldQuickLoad', at));
  assert.match(body, /const records = homeLayoutsOnline \? \(_serverLayoutRecords \?\? \[\]\) : layoutRecordsOf\(\{\n {6}houses: playerEntity\.houses, rooms: playerEntity\.rentedRooms,/);
  assert.match(body, /repairs: \(playerEntity\.otherItems \?\? \[\]\)\.map\(\(it\) => it\?\.repairData\)\.filter\(Boolean\),\n {6}anchor: playerEntity\.anchorPosition,/);
  assert.match(body, /for \(const v of \[\.\.\.pin\.in\]\) if \(!\(await ensureWorldDataPack\(v\)\)\) pin\.in\.delete\(v\);/);
  assert.match(body, /const changed = setLayoutPins\(pins\);/);
  assert.match(body, /if \(built\.has\(pixelKey\)\) \{[\s\S]{0,120}destroyPixel\(px, py, \{ collectLoose: false \}\);\n {8}queue\.push\(\{ px, py \}\);/);
  assert.match(body, /const forgotten = pruneDiscoveryLayouts\(\);/);
  assert.match(W, /await applyLayoutPins\(extras\);   \/\/ WD3: the save's towns in the layouts its things were made in, before its place is built/);
  assert.match(src('src/scenes/dungeonContext.js'), /if \(session\) opts\.layoutPinsLoaded\?\.\(extras\);/);
});
