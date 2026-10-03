// BAG1 (2026-10-03) - THE MATERIALS BAG, ON THE CLIENT: the bag a player buys at a General Store, carried as DFU carries
// the wagon - a second list beside the pack, its own weight limit - and every harvest, withdrawal and station that reads
// what it holds (bible/06-Systems/Materials-Bag.md). The law is net/bagLaw.js, the save's hands systems/materialsBag.js,
// the book's flows net/profBook.js; the service's half is test/bag1_service.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/systems/profTemplates.js';
import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import {
  BAG_TEMPLATE, BAG_KG_LIMIT, BAG_BASE_PRICE, BAG_ROW, BAG_CAPACITY, BAG_WORDS, CARRIED_MAX, goodsWhere,
} from '../src/net/bagLaw.js';
import {
  hasBag, bagItemsOf, materialKeyOfItem, isMaterialItem, heldOf, unitKgOf, bagWeight, roomFor, mintCarried, takeCarried,
  bagStoreRefusal, bagMayLeave, isBagItem,
} from '../src/systems/materialsBag.js';
import { mintMaterialItem } from '../src/systems/profItems.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import {
  planBagToggle, hasMaterialsBag, remoteTarget, storeCapacityOf, groundRefusalOf, remoteTargetType, REMOTE_TARGET_TYPES,
} from '../src/systems/inventorySession.js';
import { planStore, REFUSAL } from '../src/systems/itemTransfer.js';
import { localClickDecision } from '../src/systems/tradeModes.js';
import { tradeRefusal, BAG_TRADE_TEXT } from '../src/systems/tradePack.js';
import { tradeableRecord } from '../src/net/realmTradeLaw.js';
import { carriedItemLists } from '../src/net/realmGoldLaw.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { storesFullIn, fullWordsIn, herbKey } from '../src/net/professionLaw.js';
import { harvestHauls } from '../src/ui/haulCards.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const bagItem = () => setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE });
/** A character of strength 50 - a 75 kg pack - with a bag on its back, or none. */
const body = ({ bag = true } = {}) => ({ stats: { strength: 50 }, items: bag ? [bagItem()] : [], bagItems: [], goldPieces: 0 });
const OAK = 'log:oak';   // 2 kg a log
const HERB = 'p1:9';     // 0.25 kg
/** The host's hands on an entity, as scenes/world.js builds them. */
const hands = (e) => ({ held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n), take: (k, n) => takeCarried(e, k, n) });

// ─── THE LAW ────────────────────────────────────────────────────────

test('BAG1 the row: DFU\'s own Backpack picture, weightless as the Small Cart, one to a slot, 250 base (500 at a middling shop - "like 500g"), in the professions\' range; it holds 300 kg - two fifths of a wagon - and the service counts 5,000 of a material carried, the Stores\' own bound (mutants: a weight; a stack; the limit)', () => {
  assert.equal(BAG_TEMPLATE, 600);
  assert.deepEqual([BAG_ROW.worldTextureArchive, BAG_ROW.worldTextureRecord], [205, 44], 'ItemTemplates 89\'s picture');
  assert.equal(BAG_ROW.hasNoEncumbrance, true);
  assert.equal(BAG_ROW.stackable, false);
  assert.equal(BAG_BASE_PRICE, 250);
  assert.equal(BAG_KG_LIMIT, 300);
  assert.deepEqual(BAG_CAPACITY, { kg: 300, name: 'Your Materials Bag' });
  assert.equal(CARRIED_MAX, 5000);
  const it = bagItem();
  assert.deepEqual([it.name, it.value, isBagItem(it), hasBag([it]), hasBag([])], ['Materials Bag', 250, true, true, false]);
});

test('BAG1 the words: where a harvest\'s goods went - the Stores for an older book, else the bag, the pack or both as the mint put them, and what had no room left where it was gathered (mutants: the pack said as the bag; the left-behind unsaid)', () => {
  assert.equal(goodsWhere({ carry: false }), 'to your Stores');
  assert.equal(goodsWhere({ carry: true, put: { bag: 3, pack: 0, left: 0 } }), 'to your bag');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 2, left: 0 } }), 'to your pack');
  assert.equal(goodsWhere({ carry: true, put: { bag: 1, pack: 2, left: 0 } }), 'to your bag and pack');
  assert.equal(goodsWhere({ carry: true, put: { bag: 4, pack: 0, left: 1 } }), 'to your bag - 1 left where it was gathered: no room');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 1, left: 3 } }), 'to your pack - 3 left where they were gathered: no room');
  assert.match(BAG_WORDS.where, /Every General Store sells the bag/);
});

// ─── THE SAVE'S HANDS ───────────────────────────────────────────────

test('BAG1 an item is a material only as the mint makes it - both of a food\'s skins, every herb, log and hide; never a quest\'s, a summoned, a worn or an enchanted one (mutants: the map unbuilt; a quest item counted)', () => {
  for (const k of [OAK, HERB, 'hide:bear', 'food:meat']) assert.equal(materialKeyOfItem(mintMaterialItem(k)), k, k);
  assert.equal(materialKeyOfItem(mintMaterialItem('food:meat', true)), 'food:meat', 'Climates & Calories\' Raw Meat');
  assert.equal(materialKeyOfItem(mintMaterialItem('food:meat', false)), 'food:meat', 'and the Basket\'s');
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(HERB), questItem: true }), null);
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(HERB), timeForItemToDisappear: 99 }), null);
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(OAK), equipSlot: 3 }), null);
  assert.equal(materialKeyOfItem(bagItem()), null, 'the bag is no material');
  assert.equal(isMaterialItem(setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 })), false);
  assert.equal(bagStoreRefusal(setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 })).text, BAG_WORDS.onlyMaterials);
  assert.equal(bagStoreRefusal(mintMaterialItem(OAK)), null);
});

test('BAG1 a mint fills the bag first, under its 300 kg, then the pack under the character\'s own carry, and says what found no room; a character with no bag mints into the pack alone (mutants: the pack first; the bag past its limit; the left-behind dropped)', () => {
  const e = body();
  assert.equal(unitKgOf(OAK), 2);
  assert.equal(roomFor(e, OAK), 150 + 37, '150 logs in the bag, 37 in a 75 kg pack');
  assert.deepEqual(mintCarried(e, OAK, 200), { bag: 150, pack: 37, left: 13 });
  assert.equal(bagWeight(e), 300);
  assert.equal(heldOf(e, OAK), 187, 'the bag and the pack, together');
  assert.equal(roomFor(e, OAK), 0);
  const none = body({ bag: false });
  assert.deepEqual(mintCarried(none, HERB, 5), { bag: 0, pack: 5, left: 0 });
  assert.equal(none.bagItems.length, 0, 'no bag, nothing into its list');
  assert.equal(heldOf(none, HERB), 5);
  const dry = body();
  assert.deepEqual(mintCarried(dry, 'food:meat', 2, { slowRot: true }), { bag: 2, pack: 0, left: 0 });
  assert.equal(bagItemsOf(dry)[0].slowRot, true, 'a Butcher\'s meat, slow to rot, in the bag as in the pack');
});

test('BAG1 a deposit takes from the bag first, then the pack - whole stacks and a split of the last - and its undo puts back exactly what it took (mutants: the pack first; the split lost on the undo)', () => {
  const e = body();
  mintCarried(e, HERB, 3);
  e.items.push(...[mintMaterialItem(HERB)].map((it) => ({ ...it, stackCount: 4 })));
  assert.equal(heldOf(e, HERB), 7);
  const t = takeCarried(e, HERB, 5);
  assert.equal(t.taken, 5);
  assert.equal(heldOf(e, HERB), 2);
  assert.equal(e.bagItems.length, 0, 'the bag\'s three first');
  assert.equal(e.items.find((i) => materialKeyOfItem(i) === HERB).stackCount, 2, 'then two of the pack\'s four');
  t.back();
  assert.equal(heldOf(e, HERB), 7);
  assert.equal(e.bagItems.reduce((a, i) => a + (i.stackCount ?? 1), 0), 3, 'the bag\'s back in the bag');
  const short = takeCarried(e, HERB, 9);
  assert.equal(short.taken, 7, 'what there is - the caller gives it back');
  short.back();
  assert.equal(heldOf(e, HERB), 7);
});

// ─── THE INVENTORY WINDOW ───────────────────────────────────────────

test('BAG1 the bag button: no bag says where to buy one; with one, a press shows it and hides the wagon, a second hides it; showing, it is the remote list, its own capacity, no floor, a target of its own (mutants: the bag shown with the wagon; the bag a floor)', () => {
  const noBag = planBagToggle({ items: () => [] }, {});
  assert.deepEqual([noBag.ok, noBag.refusal.text], [false, BAG_WORDS.none]);
  const e = body();
  const deps = { items: () => e.items, bagItems: () => e.bagItems, wagonItems: () => ['cart'], dropRefusal: () => 'not here' };
  assert.equal(hasMaterialsBag(e.items), true);
  assert.deepEqual(planBagToggle(deps, { usingWagon: true }), { ok: true, usingBag: true, usingWagon: false });
  assert.deepEqual(planBagToggle(deps, { usingBag: true }), { ok: true, usingBag: false, usingWagon: false });
  mintCarried(e, HERB, 2);
  assert.equal(remoteTarget(deps, { usingBag: true }), e.bagItems);
  assert.equal(storeCapacityOf(deps, { usingBag: true }), BAG_CAPACITY);
  assert.equal(groundRefusalOf(deps, { usingBag: true }), null, 'the bag is no floor - a house\'s word never reaches it');
  assert.equal(groundRefusalOf(deps, {}), 'not here');
  assert.equal(remoteTargetType(deps, { usingBag: true }), REMOTE_TARGET_TYPES.Bag);
});

test('BAG1 a loaded bag stays: it leaves the pack - dropped, stored, sold - only empty; it is never traded to a player nor sent through the realm (mutants: a loaded bag dropped; a loaded bag sold; the bag traded)', () => {
  const bag = bagItem();
  assert.deepEqual(planStore(bag, { bagLoaded: true }), { ok: false, refusal: REFUSAL.bagLoaded });
  assert.equal(REFUSAL.bagLoaded.text, BAG_WORDS.notEmpty);
  assert.notDeepEqual(planStore(bag, { bagLoaded: false }).refusal, REFUSAL.bagLoaded, 'empty, it goes as any item');
  assert.notDeepEqual(planStore(mintMaterialItem(OAK), { bagLoaded: true }).refusal, REFUSAL.bagLoaded, 'the rule is the bag\'s alone');
  assert.deepEqual(localClickDecision('Sell', bag, { bagLoaded: true }), { kind: 'refuse', refusal: 'bagLoaded' });
  assert.notEqual(localClickDecision('Sell', bag, { bagLoaded: false }).kind, 'refuse');
  assert.equal(tradeRefusal(bag), BAG_TRADE_TEXT);
  assert.equal(tradeableRecord(bag), false);
  assert.equal(bagMayLeave({ bagItems: [] }), true);
  assert.equal(bagMayLeave({ bagItems: [mintMaterialItem(OAK)] }), false);
  // every window that plans a move says whether the bag is loaded
  for (const f of ['src/ui/enhancedInventory.js', 'src/ui/nativeInventory.js', 'src/ui/enhancedTrade.js', 'src/ui/nativeTrade.js']) {
    assert.match(src(f), /bagLoaded/, f);
  }
});

test('BAG1 bought: every General Store shelves one online, after the horse and the cart, to a character who carries none; offline none (mutants: offline; a second bag)', () => {
  const where = globalThis.location;
  try {
    const shelf = (e) => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, e, { rolls: () => 0.5, torchesFromItems: false });
    globalThis.location = { search: '?online' };
    const on = shelf({ items: [], level: 1 });
    const i = on.findIndex((it) => it.templateIndex === BAG_TEMPLATE);
    assert.ok(i > 0, 'shelved');
    assert.equal(on[i].group, 'UselessItems2');
    assert.ok(on.slice(0, i).some((it) => it.group === 'Transportation'), 'after the horse and the cart');
    assert.equal(shelf({ items: [bagItem()], level: 1 }).some((it) => it.templateIndex === BAG_TEMPLATE), false, 'one to a character');
    globalThis.location = { search: '' };
    assert.equal(shelf({ items: [], level: 1 }).some((it) => it.templateIndex === BAG_TEMPLATE), false, 'offline nothing gathers into it');
  } finally { globalThis.location = where; }
});

test('BAG1 the save keeps the bag\'s list, and the realm counts it with the pack and the wagon (mutants: the list unsaved; the realm blind to it)', () => {
  const e = { ...body(), isPlayer: true };
  mintCarried(e, OAK, 4);
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 100 }))));
  assert.equal(q.bagItems.length, 1);
  assert.equal(heldOf(q, OAK), 4);
  assert.equal(materialKeyOfItem(q.bagItems[0]), OAK);
  const lists = carriedItemLists({ items: [{ a: 1 }], bagItems: [{ b: 2 }], wagonItems: [] });
  assert.ok(lists.some((l) => l.some((x) => x.b === 2)), 'the bag\'s list is the record\'s to count');
});

// ─── THE BOOK ───────────────────────────────────────────────────────

test('BAG1 the book carries: a harvest asks with `carry` and the held count, never the material\'s name; the answer\'s goods are minted ONCE into the bag - a second settle of the same harvest mints nothing; the haul card says Carried (mutants: the material sent; minted twice; the Stores\' count said)', async () => {
  const e = body();
  const asked = [];
  let answer = { ok: false, error: 'offline' };
  const door = { account: () => 'a', harvest: async (b) => { asked.push(b); return answer; } };
  let n = 0;
  let t = 1_000_000;   // the harvest's own UTC day (its `at` is 1)
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', now: () => t, rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait, carry: hands(e) });
  assert.equal(book.carrying(), true);
  mintCarried(e, HERB, 2);
  const r0 = await book.harvest({ node: 'n1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  assert.equal(r0.kept, true);
  assert.deepEqual([asked[0].carry, asked[0].held, 'material' in asked[0]], [true, 2, false]);
  answer = { ok: true, data: { carry: true, material: HERB, qty: 3, carried: { material: HERB, own: 5, bought: 0 }, xp: 2, track: { profession: 'herbalism', xp: 2, rank: 0 } } };
  t += 60_000;
  await book.pump();
  assert.equal(heldOf(e, HERB), 5, 'three more, minted');
  assert.equal(e.bagItems.reduce((a, i) => a + (i.stackCount ?? 1), 0), 5, 'into the bag');
  assert.deepEqual(book.carried(HERB), { material: HERB, own: 5, bought: 0 });
  assert.equal(book.storesHeld(HERB), 0, 'the Stores untouched');
  assert.equal(book.held(HERB), 5, 'a station may use what is carried');
  t += 60_000;
  await book.pump();
  assert.equal(heldOf(e, HERB), 5, 'nothing minted twice');
  // TWO TABS settling one kept harvest at once (one storage): both ask, both are answered - the goods minted by the one
  // that lets it go, never by both
  const shared = memStorage();
  const eA = body(), eB = body();
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = { account: () => 'a', harvest: async () => { await gate; return answer; } };
  let t2 = 1_000_000;
  const offline = createProfBook({ door: { account: () => 'a', harvest: async () => ({ ok: false, error: 'offline' }) }, storage: shared, character: () => 'c', now: () => t2, sleep: noWait, carry: hands(eA) });
  await offline.harvest({ node: 'n2', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  const tabA = createProfBook({ door: slow, storage: shared, character: () => 'c', now: () => t2, sleep: noWait, carry: hands(eA) });
  const tabB = createProfBook({ door: slow, storage: shared, character: () => 'c', now: () => t2, sleep: noWait, carry: hands(eB) });
  t2 += 60_000;
  const both = [tabA.pump(), tabB.pump()];
  release();
  await Promise.all(both);
  assert.equal(heldOf(eA, HERB) + heldOf(eB, HERB), 3, 'three herbs answered, three minted - once');
  const [card] = harvestHauls(answer.data);
  assert.equal(card.where, 'Carried');
  assert.equal(card.held, 5);
  assert.match(src('src/ui/haulCards.js'), /tag: Number\.isSafeInteger\(l\.held\) \? `\$\{l\.where \?\? 'Stores'\} \$\{num\(l\.held\)\}`/);
});

test('BAG1 a deposit: the items out of the bag first, the service asked with what was held; refused, they come back; no answer, they stay out and the settle asks again with the same id (mutants: the items kept on a refusal; a new id each ask)', async () => {
  const e = body();
  mintCarried(e, HERB, 6);
  const asked = [];
  let answer = { ok: false, error: 'carried-short' };
  const door = { account: () => 'a', deposit: async (...a) => { asked.push(a); return answer; } };
  let n = 0;
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait, carry: hands(e) });
  const refused = await book.deposit(HERB, 4);
  assert.equal(refused.ok, false);
  assert.deepEqual(asked[0].slice(0, 5), ['c', HERB, 4, 6, 'all'], 'the character, the material, the units, what was held, the order');
  assert.equal(heldOf(e, HERB), 6, 'given back');
  answer = { ok: false, error: 'offline' };
  const lost = await book.deposit(HERB, 4);
  assert.equal(lost.kept, true);
  assert.equal(heldOf(e, HERB), 2, 'out, and waiting');
  assert.equal(book.pendingDeposits, 1);
  answer = { ok: true, data: { store: { material: HERB, own: 4, bought: 0 }, carried: { material: HERB, own: 2, bought: 0 } } };
  await book.settle(() => {});
  assert.equal(book.pendingDeposits, 0);
  assert.equal(asked.at(-1)[5], asked.at(-2)[5], 'one deposit, one id');
  assert.equal(book.storesHeld(HERB), 4);
  assert.equal(heldOf(e, HERB), 2);
  assert.deepEqual(await book.deposit(HERB, 9), { ok: false, error: 'carried-short' }, 'never more than is carried');
  assert.equal(heldOf(e, HERB), 2);
});

test('BAG1 a station\'s shortfall goes into the Stores first - bought before own, never gold\'s - every input covered before any moves; what cannot be covered moves nothing (mutants: the spend order; a partial move)', async () => {
  const e = body();
  mintCarried(e, OAK, 10);
  mintCarried(e, HERB, 1);
  const asked = [];
  const door = {
    account: () => 'a',
    deposit: async (c, m, q, held, order) => { asked.push([m, q, held, order]); return { ok: true, data: { store: { material: m, own: q, bought: 0 }, carried: { material: m, own: held - q, bought: 0 } } }; },
    harvest: async () => ({ ok: true, data: { carry: true, material: OAK, qty: 0, carried: { material: OAK, own: 10, bought: 0 } } }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e) });
  await book.harvest({ node: 'n', kind: 'trees', climate: 231, region: 21, act: {}, at: 1 });   // the count, as the service said it
  const short = await book.ensureInStores([{ key: OAK, n: 4 }, { key: HERB, n: 3 }]);
  assert.deepEqual([short.ok, short.error, short.material], [false, 'materials-short', HERB]);
  assert.equal(asked.length, 0, 'nothing moved for the input that could be covered');
  assert.equal(accountRefusalText('materials-short'), 'You do not have that many - in your Stores, your Materials Bag and your pack together.');
  const ok = await book.ensureInStores([{ key: OAK, n: 3 }, { key: OAK, n: 1 }]);
  assert.deepEqual(ok, { ok: true, moved: 4 });
  assert.deepEqual(asked, [[OAK, 4, 10, 'spend']], 'summed by material, bought first');
  assert.equal(heldOf(e, OAK), 6);
  assert.deepEqual(await book.ensureInStores([{ key: OAK, n: 4 }]), { ok: true, moved: 0 }, 'the Stores hold it now');
  const plain = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  assert.deepEqual(await plain.ensureInStores([{ key: OAK, n: 99 }]), { ok: true, moved: 0 }, 'a book that does not carry spends the Stores as it always has');
});

test('BAG1 full: a carrying book\'s node is full when neither the bag nor the pack has room for one more, or the count is at its bound - said as such; an older book\'s is the Stores\' (mutants: the Stores read for a carrying book)', () => {
  const e = body();
  const book = createProfBook({ door: { account: () => 'a' }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e) });
  assert.equal(storesFullIn(book, OAK), false);
  mintCarried(e, OAK, 187);
  assert.equal(storesFullIn(book, OAK), true, 'no room for one more log');
  assert.equal(storesFullIn(book, HERB), false, 'a lighter herb still fits... ');
  assert.equal(fullWordsIn(book), BAG_WORDS.noRoom);
  const plain = createProfBook({ door: { account: () => 'a' }, storage: memStorage(), character: () => 'c', sleep: noWait });
  assert.equal(fullWordsIn(plain), 'Stores full');
  assert.equal(storesFullIn(plain, OAK), false);
});

// ─── THE HOST ───────────────────────────────────────────────────────

test('BAG1 wired: the world host hands the book its hands on the bag and the pack, mints each answer there, reaches the Stores in a town, and puts a writ\'s shortfall in first; the potion maker spends the bag (by source)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /mint: \(key, n\) => \{ const got = mintCarried\(playerEntity, key, n, carryOpts\(key\)\);/);
  assert.match(w, /take: \(key, n\) => \{\n\s+const t = takeCarried\(playerEntity, key, n\);/);
  assert.match(w, /const _storesReached = \(\) => \(modes\?\.mode \?\? 'exterior'\) !== 'dungeon' && _musicInLocationRect\(\)/);
  assert.match(w, /const ready = await profBook\.ensureInStores\(\[\{ key: material, n: Number\(ask\.units\) \|\| 0 \}\]\);/);
  assert.match(src('src/scenes/worldModes.js'), /bagItems/);
  assert.match(src('src/systems/save.js'), /bagItems/);
});

// ─── DONE WHEN: THROUGH THE REAL WORKER ─────────────────────────────

const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}

test('BAG1 done when: a new character gathers into the pack with no bag, buys a bag and gathers into it; the herbs go into the Stores from the Stores page and come back out into the bag - every count the service\'s, through the real Worker', async () => {
  const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
  const realNow = Date.now;
  Date.now = () => NOON * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
    const mac = await s.registered('Mac');
    const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
    const e = body({ bag: false });
    const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait, carry: hands(e) });
    assert.equal((await book.refresh()).ok, true);
    const patches = [];
    for (let x = 300; x < 700 && patches.length < 2; x++) {
      const p = herbPatches({ x, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false }).find((q) => q.tier === 1);
      if (p) patches.push({ x, y: 200, ...p });
    }
    const gather = (p) => book.harvest({
      node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(NOON), slot: p.slot }), kind: 'herbs', climate: WOODS, region: ANTICLERE,
      act: { clean: false, bruised: false }, at: NOON - 2, material: herbKey(p.herb, ANTICLERE),
    });
    const r1 = await gather(patches[0]);
    assert.equal(r1.ok, true, JSON.stringify(r1));
    const k1 = r1.data.material;
    assert.deepEqual(r1.data.put, { bag: 0, pack: r1.data.qty, left: 0 }, 'no bag yet: the pack');
    assert.equal(heldOf(e, k1), r1.data.qty);
    e.items.push(bagItem());   // bought at a General Store
    const r2 = await gather(patches[1]);
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.data.put.bag, r2.data.qty, 'into the bag');
    const k2 = r2.data.material;
    // the Stores page's Put in, in town
    const d = await book.deposit(k2, r2.data.qty);
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(book.storesHeld(k2), r2.data.qty);
    assert.equal(heldOf(e, k2) - (k1 === k2 ? r1.data.qty : 0), 0, 'out of the bag');
    // and back out, carried
    const minted = [];
    const w = await book.withdraw(k2, 1, (k, q) => minted.push(mintCarried(e, k, q)));
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.deepEqual(minted, [{ bag: 1, pack: 0, left: 0 }]);
    assert.equal(book.storesHeld(k2), r2.data.qty - 1);
    assert.equal(book.carried(k2).own, (k1 === k2 ? r1.data.qty : 0) + 1, 'counted as carried again');
  } finally { Date.now = realNow; }
});
