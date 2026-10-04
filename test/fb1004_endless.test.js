// ENDLESS-STOCK (2026-10-04, Mac: "I want the gathering bag to be unlimited purchases in stores. It shouldnt run out,
// same with campfires"). A shop shelf is a container: a purchase took its row off for good, so a General Store's one
// Materials Bag and its two to four Campfires sold out for the day - and online a shelf is the whole building's. Now a
// bag or a Campfire bought is put back on the shelf it came from, fresh, by commitTrade's Buy arm; a row stolen from a
// closed shop's shelf is not (bible/01-Overview/Field-Bugs-2026-10-04.md).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/systems/profTemplates.js';
import { stockShopShelf, isEndlessStock, restockEndless } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { BAG_TEMPLATE, isBagItem } from '../src/net/bagLaw.js';
import { isCampfireKit, createSurvivalItem, TEMPLATE } from '../src/systems/survival/items.js';
import { setSharedClock } from '../src/systems/worldTick.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const where = globalThis.location;
afterEach(() => { globalThis.location = where; setSharedClock(null); });
/** A General Store's first shelf, online, as worldModes.js openShelf stocks it - the bag and the Campfires on it. */
function onlineShelf() {
  globalThis.location = { search: '?online' };
  setSharedClock(() => 1000);   // REST2: online the Campfire is the rest's
  return stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, { items: [], level: 1 }, { rolls: () => 0.5, torchesFromItems: false, shelfIndex: 0 });
}
const count = (items, pred) => items.filter(pred).reduce((a, it) => a + (it.stackCount ?? 1), 0);
/** commitTrade's Buy arm (worldModes.js), its shelf half: each staged row off the shelf, then the endless ones back. */
function buy(shelf, staged) {
  for (const it of staged) { const i = shelf.indexOf(it); if (i >= 0) shelf.splice(i, 1); }
  return restockEndless(shelf, staged);
}

test('ENDLESS-STOCK: a Materials Bag bought is back on the shelf - bought five times over, the shelf still sells one, never the record the buyer took (mutants: the bag not endless; the restock unwired)', () => {
  const shelf = onlineShelf();
  assert.equal(count(shelf, isBagItem), 1, 'the shelf, as stocked, holds one');
  const bought = [];
  for (let i = 0; i < 5; i++) {
    const bag = shelf.find(isBagItem);
    assert.ok(bag, `purchase ${i + 1}: a bag to buy`);
    assert.equal(buy(shelf, [bag]), 1);
    bought.push(bag);
  }
  assert.equal(count(shelf, isBagItem), 1, 'one on the shelf still - never more, never none');
  const left = shelf.find(isBagItem);
  assert.ok(!bought.includes(left), 'a fresh record, not one in a buyer\'s pack');
  assert.deepEqual([left.templateIndex, left.group, left.value > 0], [BAG_TEMPLATE, 'UselessItems2', true], 'minted as the shelf mints it');
});

test('ENDLESS-STOCK: Campfires bought are back on the shelf, one for each bought - three in one purchase give back three, each a full fresh Campfire (mutants: the Campfire not endless; the bag minted for a Campfire)', () => {
  const shelf = onlineShelf();
  const stocked = count(shelf, isCampfireKit);
  assert.ok(stocked >= 2 && stocked <= 4, `two to four, as REST2 stocks them (${stocked})`);
  for (let i = 0; i < 10; i++) buy(shelf, [shelf.find(isCampfireKit)]);
  assert.equal(count(shelf, isCampfireKit), stocked, 'ten bought, and the shelf holds what it was stocked with');
  const three = shelf.filter(isCampfireKit).slice(0, 2).concat(createSurvivalItem(TEMPLATE.Campfire));
  for (const it of three) it.currentCondition = 1;   // used, as a bought one may be by the time a purchase is read
  const before = count(shelf, isCampfireKit) - 2;
  assert.equal(buy(shelf, three), 3);
  assert.equal(count(shelf, isCampfireKit), before + 3);
  assert.ok(shelf.filter(isCampfireKit).every((it) => !three.includes(it) && it.currentCondition === it.maxCondition), 'fresh and whole');
});

test('ENDLESS-STOCK: only the bag and the Campfire - the horse, the cart and the rest of a shelf sell out as before; nothing is put on a shelf that is not a list (mutants: every row endless)', () => {
  const shelf = onlineShelf();
  const others = shelf.filter((it) => !isEndlessStock(it));
  assert.ok(others.some((it) => it.group === 'Transportation'), 'the horse and the cart are on it');
  const before = shelf.length;
  assert.equal(buy(shelf, others), 0, 'none of them comes back');
  assert.equal(shelf.length, before - others.length);
  assert.deepEqual([isEndlessStock(null), isEndlessStock({ templateIndex: TEMPLATE.Campfire, group: 'Weapons' })], [false, false], 'a Campfire is the survival group\'s template');
  assert.equal(restockEndless(null, [shelf.find(isBagItem)]), 0);
});

test('ENDLESS-STOCK wired: both purchases put the endless rows back after they take them - the counter\'s (commitTrade\'s Buy arm) and the keyed list\'s (doBuy); no other door does, so a row stolen from a closed shop is never restocked (by source)', () => {
  const w = src('src/scenes/worldModes.js');
  assert.match(w, /if \(i >= 0\) shelf\.items\.splice\(i, 1\);\n\s+if \(!isFurnishing\(it\)\) addItem\(playerEntity\.items, it\);\n\s+\}\n\s+decorDeliver\(staged\.filter\(isFurnishing\)\);[^\n]*\n\s+restockEndless\(shelf\.items, staged\);/, 'the counter');
  const buyArm = w.slice(w.indexOf('function commitTrade(shelf, mode, staged, price, proceeds'), w.indexOf("} else if (mode === 'Sell' || mode === 'SellMagic') {"));
  assert.match(buyArm, /restockEndless\(shelf\.items, staged\)/, 'inside the Buy arm');
  const doBuy = w.slice(w.indexOf('function doBuy(shelf, it) {'), w.indexOf('function doSell(shelf, it) {'));
  assert.match(doBuy, /shelf\.items\.splice\(at, 1\);[\s\S]*\) addItem\(playerEntity\.items, it\);\n\s+restockEndless\(shelf\.items, \[it\]\);/, 'the keyed list, after the row is taken');
  assert.equal(w.match(/restockEndless\(/g).length, 2, 'those two alone');
});
