// HOME-PRICE (2026-10-04; asked: "We need to make house pricing make sense online"; offered three ways, the choice was to
// price a house "by what you get (its footprint, scaled by town size) inside a fixed range the server enforces", and the
// sale box to say what the sale really pays, the Empire's account named, every sum with its thousands). Online a door
// asked Daggerfall's price - the model's bounding RADIUS x 1280 - which ran from a few thousand to over a million (a
// hall's door asked 1,274,880 - FIELD BUGS 2026-10-03 HALL-GOLD), any number the client named was taken by the service
// up to ten million, and the sale box asked the deed share of the house's price NOW while the service paid the share of
// what was PAID. The law (net/homeLaw.js homeOnlinePrice), the service's range and its `refund`, the client's registry,
// the door's host and the words. `06-Systems/Economy-Arc.md` HOME-PRICE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import {
  HOME_PRICE_PER_M2, HOME_PRICE_MIN, HOME_PRICE_MAX, HOME_PRICE_STEP, HOME_TOWN_BLOCKS_MAX,
  homeTownFactor, homeOnlinePrice, homePriceOk, homeSaleRefund,
} from '../src/net/homeLaw.js';
import {
  homeTownBlocks, homeFootprintM2, homeSaleOffer, homeRefund, createOnlineHomes,
  homeForSaleLine, homeOfferLines, homeShortLine, homeSaleLines, homeSoldLine, homeBuyRows, homeHallBuyRow, hallOfferLabel,
} from '../src/systems/onlineHomes.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RICH = (name) => ({ name, level: 9, goldPieces: 2_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });

test('HOME-PRICE the law: 300 gold a square metre of ground, raised by the town\'s side (1 at one block, 2.75 at 8 x 8), whole hundreds, never under 5,000 nor over 250,000; a building nobody can measure is not for sale (mutants: the rate; the town factor; the floor; the cap; the rounding; an unmeasured house priced)', () => {
  assert.deepEqual([HOME_PRICE_PER_M2, HOME_PRICE_MIN, HOME_PRICE_MAX, HOME_PRICE_STEP, HOME_TOWN_BLOCKS_MAX], [300, 5_000, 250_000, 100, 64]);
  assert.deepEqual([1, 4, 9, 25, 64].map(homeTownFactor), [1, 1.25, 1.5, 2, 2.75], 'the town\'s side: 1x1, 2x2, 3x3, 5x5, 8x8');
  assert.deepEqual([0, -3, NaN, undefined, 100].map(homeTownFactor), [1, 1, 1, 1, 2.75], 'an unknown size is one block; none past 8 x 8');
  // what a house costs, by its ground and its town
  assert.deepEqual([
    homeOnlinePrice(36, 1),     // a 6 x 6 m cottage in a hamlet
    homeOnlinePrice(100, 9),    // a 10 x 10 m house in a 3 x 3 town
    homeOnlinePrice(144, 64),   // a 12 x 12 m house in an 8 x 8 city
    homeOnlinePrice(53.29, 1),  // 7.3 x 7.3 m: 15,987 - to the nearest hundred
    homeOnlinePrice(4, 64),     // a shed: the floor
    homeOnlinePrice(1600, 64),  // a 40 x 40 m palace: the cap
  ], [10_800, 45_000, 118_800, 16_000, HOME_PRICE_MIN, HOME_PRICE_MAX]);
  assert.deepEqual([homeOnlinePrice(0, 9), homeOnlinePrice(-5, 9), homeOnlinePrice(NaN, 9), homeOnlinePrice(Infinity, 9)], [0, 0, 0, 0], 'nobody can measure it: not for sale');
  // what you get: more ground never costs less, a bigger town never less
  for (let m2 = 10; m2 < 2000; m2 += 7) assert.ok(homeOnlinePrice(m2 + 7, 9) >= homeOnlinePrice(m2, 9));
  for (let b = 1; b < 64; b++) assert.ok(homeOnlinePrice(150, b + 1) >= homeOnlinePrice(150, b));
  // every price the law makes is one the service takes
  for (let m2 = 1; m2 < 3000; m2 += 13) for (const b of [1, 6, 30, 64]) { const p = homeOnlinePrice(m2, b); assert.ok(homePriceOk(p) && p % HOME_PRICE_STEP === 0, `${m2} m2 in ${b} blocks: ${p}`); }
});

test('HOME-PRICE the measures: the ground is the model\'s box, width by depth, at the renderer\'s metres a unit; a town\'s size is its exterior\'s width by height (mutants: the height read for the depth; the scale once; the town\'s width alone)', () => {
  assert.equal(GLOBAL_SCALE, 0.025);
  assert.equal(homeFootprintM2({ x: 400, y: 9999, z: 480 }, GLOBAL_SCALE), 120, '10 m by 12 m - the height is no ground');
  assert.deepEqual([homeFootprintM2(null, GLOBAL_SCALE), homeFootprintM2({ x: 0, y: 1, z: 400 }, GLOBAL_SCALE), homeFootprintM2({ x: NaN, z: 1 }, GLOBAL_SCALE)], [0, 0, 0]);
  assert.equal(homeTownBlocks({ exterior: { exteriorData: { width: 3, height: 4 } } }), 12);
  assert.deepEqual([homeTownBlocks(null), homeTownBlocks({ exterior: {} }), homeTownBlocks({ exterior: { exteriorData: { width: 0, height: 4 } } })], [0, 0, 0]);
});

test('HOME-PRICE the service holds the range: a claim at Daggerfall\'s price (a build from before) is asked to update, one under the floor too, and nothing is paid or seated; one inside it lands; a price that is no number is no building (mutants: the range unread; the floor; the update unsaid)', async () => {
  const s = await standService();
  const who = await s.registered('Aldric');
  const R = await seatRealm(s.env, who.secret, 'Aldric', RICH('Aldric'));
  const claim = (buildingKey, price) => s.call('/v1/homes/claim', { mapId: 77, buildingKey, region: 17, character: R.id, price, realm: R.at(), layout: null }, who.secret);
  for (const [key, price] of [[3, 600_100], [4, HOME_PRICE_MAX + 1], [5, HOME_PRICE_MIN - 1], [6, 1]]) {
    assert.equal((await claim(key, price)).body?.error, 'home-update', `${price}: asked to update`);
    assert.equal(s.env.DB._raw.prepare('SELECT 1 FROM homes WHERE building_key = ?').get(key), undefined, `${price}: nothing seated`);
  }
  assert.equal(accountRefusalText('home-update'), 'This game is out of date. Reload it to buy a home.');
  assert.deepEqual([(await claim(7, 0)).body?.error, (await claim(7, 2.5)).body?.error, (await claim(7, '42000')).body?.error], ['bad-home', 'bad-home', 'bad-home']);
  const ok = await claim(8, HOME_PRICE_MAX);
  assert.equal(ok.status, 200, 'the top of the range lands');
  // a hall is a home: the same range, the same word (halls.js buyHall)
  assert.match(src('server-account/src/halls.js'), /!homeRegionOk\(region\) \|\| !Number\.isSafeInteger\(price\) \|\| !\(price > 0\)\) return \{ error: 'bad-home' \};\n\s*if \(!homePriceOk\(price\)\) return \{ error: 'home-update' \};/);
});

test('HOME-PRICE the sale pays what was PAID, and the town says so to my own: a record\'s house its deed share of `paid`, a house from before the realm of its `price`, a carried-in one nothing (crossed); another account hears no sum (mutants: the refund off the price for a record; another\'s told; a crossed house refunded)', async () => {
  const s = await standService();
  const who = await s.registered('Aldric');
  const other = await s.registered('Mara');
  const R = await seatRealm(s.env, who.secret, 'Aldric', RICH('Aldric'));
  const raw = s.env.DB._raw;
  const row = (key, charId, price, paid) => raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid) VALUES (77, ?, ?, ?, 'Aldric', 17, 'private', ?, 1, ?)")
    .run(key, who.id, charId, price, paid);
  row(3, R.id, 600_100, 600_100);    // bought on the record at Daggerfall's price, before HOME-PRICE
  row(4, R.id, 600_100, 0);          // carried in through customs
  row(5, 'char-old', 42_000, 0);     // a home from before the realm
  const town = async (w) => Object.fromEntries((await s.call('/v1/homes/town', { mapId: 77, character: R.id }, w.secret)).body.homes.map((h) => [h.buildingKey, h]));
  const mine = await town(who);
  assert.deepEqual([mine[3].refund, mine[4].refund, mine[5].refund], [homeSaleRefund(600_100), undefined, homeSaleRefund(42_000)]);
  assert.equal(mine[4].crossed, true);
  assert.ok(Object.values(await town(other)).every((h) => !('refund' in h) && !('price' in h)), 'another account learns nothing of what was paid');
  // and what the sale pays is that sum
  const sold = await s.call('/v1/homes/release', { mapId: 77, buildingKey: 3, realm: R.at() }, who.secret);
  assert.deepEqual([sold.status, sold.body?.refund], [200, mine[3].refund]);
});

test('HOME-PRICE the client: the registry keeps my own home\'s refund, a claim shows the share of what the service holds for it, and the door\'s sale asks the service\'s sum before its own (mutants: the refund dropped; the claim\'s price unread; the offer off the price)', async () => {
  const answer = [{ buildingKey: 3, owner: 'Aldric', entry: 'private', mine: true, character: 'r-1', refund: 510_085 }, { buildingKey: 4, owner: 'Mara', entry: 'public', mine: false, refund: 'lots' }];
  const api = {
    town: async () => ({ ok: true, data: { homes: answer } }),
    claim: async () => ({ ok: true, data: { ok: true, repeat: true, home: { entry: 'private', price: 90_000 } } }),
  };
  const homes = createOnlineHomes({ api, character: () => 'r-1' });
  await homes.ensure(77);
  assert.deepEqual([homes.homeAt(77, 3).refund, homes.homeAt(77, 4).refund], [510_085, null], 'a word the law would not say is none');
  await homes.claim({ mapId: 77, buildingKey: 9, region: 17, price: 45_000 });
  assert.equal(homes.homeAt(77, 9).refund, homeRefund(90_000), 'the price the service holds - a repeat\'s, the first claim\'s');
  assert.equal(homeSaleOffer(homes.homeAt(77, 3), 45_000), 510_085, 'the service\'s sum, never the house\'s price now');
  assert.equal(homeSaleOffer({ refund: null }, 45_000), homeRefund(45_000), 'an older service: the share of the price now');
  assert.equal(homeSaleOffer(null, 45_000), homeRefund(45_000));
});

test('HOME-PRICE the hosts: every door\'s building carries its town\'s size (world.js, exterior.js - the interiors and the dungeon price no door); the door prices by ground and town, never Daggerfall\'s radius; the sale asks the service\'s sum (mutants: a host without the size; the radius back; the sale off the price)', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /townMapId: \(dfLoc\.mapTableData\?\.mapId \?\? 0\) >>> 0, townBlocks: homeTownBlocks\(dfLoc\),/);
  assert.match(src('src/scenes/exterior.js'), /regionIndex: dfLocation\.regionIndex, townBlocks: homeTownBlocks\(dfLocation\),/);
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /function homeListPrice\(bd\) \{\n\s*const price = homeOnlinePrice\(houseFootprintM2\(bd\), bd\?\.townBlocks \?\? 0\);\n\s*return homePriceOk\(price\) \? price : 0;\n\s*\}/);
  assert.match(m, /if \(!homePurchasable\(bd, \{ isActiveQuestBuilding: questSiteHere \}\)\) return 0;\n\s*return homeListPrice\(bd\);\n\s*\}/);
  assert.match(m, /return homeFootprintM2\(arch\.getMesh\(rec\)\?\.size, GLOBAL_SCALE\);/);
  assert.match(m, /const refund = homeSaleOffer\(home, homeListPrice\(bd\)\);\n\s*townTalk\?\.showOverlay\?\.\(new ChoiceWindow\(\{\n\s*lines: homeSaleLines\(refund\),/);
  assert.doesNotMatch(m, /\bhousePrice\(/, 'no door asks Daggerfall\'s radius x 1280 online');
});

test('HOME-PRICE the words: every sum with its thousands, and online the gold comes from and goes to the Empire\'s account - never "this region\'s" (mutants: a bare number; the region named)', () => {
  assert.equal(homeForSaleLine(118_800), 'Can be your home: 118,800 gold');
  assert.deepEqual(homeOfferLines(45_000), ['This house can be your home.', 'It costs 45,000 gold, from your purse and your account at the Bank of the Empire.', 'Buy it?']);
  assert.equal(homeShortLine(45_000), 'You need 45,000 gold, in your purse and your account at the Bank of the Empire together.');
  assert.deepEqual(homeSaleLines(510_085).slice(0, 2), ['Sell your home for 510,085 gold?', 'The gold goes to your account at the Bank of the Empire. Anything left inside is lost.']);
  assert.equal(homeSoldLine(38_250, 1_200, 0), 'You sold your home. 39,450 gold went to your account at the Bank of the Empire, 1,200 of it for its placed pieces.');
  assert.equal(homeBuyRows(45_000, true)[1].label, 'Click again to buy: 45,000 gold');
  assert.equal(homeHallBuyRow(100_000, { name: 'The Hand', rank: 0, hall: null }).label, 'Buy it for The Hand: 150,000 gold from the treasury');
  assert.equal(hallOfferLabel(100_000, { name: 'The Hand' }), 'G - buy it for The Hand: 150,000 gold from the treasury');
});
