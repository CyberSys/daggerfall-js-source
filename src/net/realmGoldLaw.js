// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P2.2 — A REALM CHARACTER'S GOLD, MOVED ON ITS SAVE: the law both
// ends read. The service pays and credits a realm character's record
// with it (server-account/src/realm.js prepareRealmRecord, for a guild's
// treasury, a founding, a home, a piece of decor); the client's wallet
// pays the same way (systems/court.js deductGold, and the region's bank
// account for what that leaves), pinned equal by test/realm5.test.js.
//
// Mac: "eliminate duping". The plan is bible/06-Systems/Realm-Arc.md
// section 3: "One D1 transaction debits the character and credits the
// treasury. A withdrawal is the reverse." Before this, the client moved
// its own purse and the service moved the treasury, in two writes: a tab
// closed between a deposit and its next checkpoint left the gold in both.
//
// THE WALLET'S OWN ORDER, over plain data. deductGold is DFU's: the coins
// pay when they cover the amount; otherwise the letters of credit pay
// first and the coins after; what is still owed comes off the region's
// bank account (the online wallets - scenes/world.js's guild wallet,
// worldModes.js's home and decor wallets). A credit goes to the purse, or
// to a region's bank account (a home sold), or (GUILD-LETTER) into the
// pack as a letter of credit (a guild withdrawal too heavy to carry). The
// service imports this and never systems/court.js, whose imports the
// Worker does not bundle.
// ═══════════════════════════════════════════════════════════════════
import { decorSaleBack } from './decorLaw.js';   // AUDIT REALM2 T3: what a room's placed pieces pay back

/** The letter of credit's template (systems/inventory.js LETTER_OF_CREDIT_TEMPLATE, pinned equal; a name of its own, so no symbol is declared twice - audit24 wave24). */
export const REALM_LETTER_TEMPLATE = 275;
/** GUILD-LETTER (FIELD BUGS 2026-09-30): THE LETTER OF CREDIT, as the game mints one (systems/inventory.js letterOfCredit,
 *  pinned equal - its name is the item template's, which the Worker does not bundle). One maker for both ends: the
 *  service writes it on the record and the client's wallet into the pack, so the two never differ. */
export const realmLetterOfCredit = (/** @type {number} */ value) => ({ group: 'MiscItems', templateIndex: REALM_LETTER_TEMPLATE, name: 'Letter of Credit', value, stackCount: 1 });

const whole = (/** @type {unknown} */ v) => (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : 0);
/** EMPIRE-ACCOUNT (2026-10-01, Mac: "2" - online, every region one Empire-wide account): A REALM CHARACTER KEEPS ONE
 *  BANK ACCOUNT, the Empire's, at Daggerfall's index (systems/banking.js EMPIRE_ACCOUNT_REGION, pinned equal - the
 *  Worker does not bundle banking.js). Whatever region a wallet names, its gold is that account's. */
export const REALM_EMPIRE_ACCOUNT = 17;
/** The bank account `region`'s gold moves in, in a save - the Empire's (EMPIRE-ACCOUNT; the region's own where a short
 *  table has none) - or null. */
export const accountOfSave = (/** @type {any} */ save, /** @type {unknown} */ region) =>
  (Number.isSafeInteger(region) && /** @type {number} */ (region) >= 0 && Array.isArray(save?.bankAccounts)
    ? save.bankAccounts[REALM_EMPIRE_ACCOUNT] ?? save.bankAccounts[/** @type {number} */ (region)] ?? null : null);
/** The accounts a realm save pays from when `region` names one, in the order they pay: the Empire's (the region's own
 *  where a short table has none), then every other branch still holding gold - a record written before its character
 *  booted since EMPIRE-ACCOUNT, whose client folds them into the Empire's at that boot (banking.js foldEmpireAccounts).
 *  None when `region` names none. */
const accountsOfSave = (/** @type {any} */ save, /** @type {unknown} */ region) => {
  const empire = accountOfSave(save, region);
  if (!empire) return [];
  return [empire, ...save.bankAccounts.filter((/** @type {any} */ a) => a !== empire && !!a && typeof a === 'object')];
};

/** What a save can pay with: its coins, its letters of credit and, when `region` names one, the Empire's account (and
 *  any branch a record not yet folded still holds gold in). */
export function payableOf(/** @type {any} */ save, /** @type {unknown} */ region = null) {
  const coins = whole(save?.goldPieces);
  const letters = (Array.isArray(save?.items) ? save.items : []).filter((it) => it?.templateIndex === REALM_LETTER_TEMPLATE).reduce((s, it) => s + whole(it.value), 0);
  const bank = accountsOfSave(save, region).reduce((s, a) => s + Math.max(0, Number(a.accountGold) || 0), 0);
  return coins + letters + bank;
}

/**
 * PAY `amount` from a save, in place, as the client's wallet pays: court.js deductGold's order over the coins and the
 * letters, and the shortfall off `region`'s account. Answers false, with nothing changed, when the save cannot pay it
 * all - the wallet asks the same total first (`afford`).
 * @param {any} save @param {number} amount @param {unknown} [region]
 */
export function payFromSave(save, amount, region = null) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !save || typeof save !== 'object') return false;
  if (payableOf(save, region) < amount) return false;
  const purse = whole(save.goldPieces);
  if (amount <= purse) { save.goldPieces = purse - amount; return true; }
  let owed = amount;
  const items = Array.isArray(save.items) ? save.items : [];
  for (;;) {
    const loc = items.find((it) => it?.templateIndex === REALM_LETTER_TEMPLATE);
    if (!loc) break;
    if (owed < (loc.value ?? 0)) { loc.value -= owed; owed = 0; break; }
    owed -= loc.value ?? 0;
    items.splice(items.indexOf(loc), 1);
  }
  if (owed > 0) {
    if (owed <= purse) { save.goldPieces = purse - owed; owed = 0; } else { owed -= purse; save.goldPieces = 0; }
  }
  // payableOf counted it: the accounts are there and cover it - the Empire's first (EMPIRE-ACCOUNT)
  for (const a of accountsOfSave(save, region)) {
    if (!(owed > 0)) break;
    const take = Math.min(owed, Math.max(0, Number(a.accountGold) || 0));
    a.accountGold -= take;
    owed -= take;
  }
  return true;
}

/** CREDIT `amount` to a save, in place: the purse, or `bank`'s account (a home sold - a missing account takes it in the
 *  purse, the gold kept either way). Answers false for an amount that is none.
 *  GUILD-LETTER (FIELD BUGS 2026-09-30): or, `letter` true, A LETTER OF CREDIT worth all of it, at the front of the pack
 *  as the trade window and the bank put one - what the pack cannot carry as coin (a guild withdrawal, which the client
 *  weighs as tradeModes.js sellProceeds does). Only `true` is a letter: any other word is the purse. */
export function creditSave(/** @type {any} */ save, /** @type {number} */ amount, /** @type {{ bank?: number | null, letter?: unknown }} */ { bank = null, letter = false } = {}) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !save || typeof save !== 'object') return false;
  const a = bank == null ? null : accountOfSave(save, bank);
  if (a) a.accountGold = (Number.isFinite(a.accountGold) ? a.accountGold : 0) + amount;
  else if (letter === true) {
    (Array.isArray(save.items) ? save.items : (save.items = [])).unshift(realmLetterOfCredit(amount));
    // the lit light is an index into the pack (save.js lightSourceIndex): it moves with what it names
    if (Number.isSafeInteger(save.lightSourceIndex) && save.lightSourceIndex >= 0) save.lightSourceIndex += 1;
  } else save.goldPieces = whole(save.goldPieces) + amount;
  return true;
}

// ── AUDIT REALM2 S1: WHAT A SAVE HOLDS, MEASURED THE SAME AT BOTH ENDS ──
// Customs (systems/realmCustoms.js) caps a copy at the allowance on the client, and the service now holds a character's
// FIRST save to it (server-account/src/realm.js firstSaveRefusal) - so the measure and the numbers moved here, the law
// the Worker bundles, and realmCustoms.js re-exports them: one home, one count. A service that counted less than the
// client capped would let wealth hide where it does not look; one that counted more would refuse an honest customs.

/** OPEN (Realm-Arc "Customs"): the liquid wealth a character brings in - a base, and this much a level. */
export const CUSTOMS_WEALTH_BASE = 20_000;
export const CUSTOMS_WEALTH_PER_LEVEL = 10_000;
/** The allowance at a level. */
export const customsAllowance = (/** @type {number} */ level) => CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL * Math.max(1, Math.trunc(level) || 1);
/** A CHARACTER BORN ONLINE starts where chargen starts one: level 1, and the gold chargen hands it - 100
 *  (systems/startingGear.js STARTING_GOLD) and what its biography's answers add (BiogFile's GP lines, a handful a file).
 *  The bound is a first setting with room past both; OPEN, as every number of the realm is. */
export const REALM_BIRTH_LEVEL = 1;
export const REALM_BIRTH_WEALTH_MAX = 10_000;

/** The gold-piece template (systems/inventory.js GOLD_TEMPLATE; isGoldPieces reads the group with it). Pinned equal
 *  (test/auditrealm2_service.test.js): the Worker bundles no systems/. */
const COINS_TEMPLATE = 276;
const isCoins = (/** @type {any} */ it) => it?.group === 'Currency' && it?.templateIndex === COINS_TEMPLATE;
const isLetter = (/** @type {any} */ it) => it?.templateIndex === REALM_LETTER_TEMPLATE;
/** A record's liquid worth: a gold-piece item's count, a letter of credit's value - anything else none. */
export const liquidWorthOf = (/** @type {any} */ it) => (isCoins(it) ? Math.max(0, it?.stackCount ?? 0) : isLetter(it) ? Math.max(0, it?.value ?? 0) : 0);
const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
/** Come Sail Away's record in a save's per-mod slot (systems/comeSailAway.js COME_SAIL_AWAY_VENDOR, pinned equal - that
 *  module is the mod's runtime, which neither the Online door nor the Worker loads). */
const CSA_VENDOR = 'come-sail-away';

/**
 * AUDIT REALM F2: WHAT THE PLAYER LEFT IN THE WORLD - every list of the character's own things a save carries outside its
 * pack and wagon, where gold and letters of credit lie as items: in each cached scene (sceneCache.js), a house's chests,
 * the piles dropped in a room or on a street, and the storage pieces' contents (DECOR1c `decorItems`, an online home's
 * too); and the piles the save's own host rides in its `world` bag - a dungeon's `droppedLoot`, the open air's `piles`.
 * Customs read the purse, the pack's letters, the wagon's gold and the banks alone, so letters stowed in the wagon, gold
 * in a house chest or a storage piece and a pile left on the floor all crossed uncapped.
 *
 * AUDIT REALM2 T5: AND EVERY PILE AND CONTAINER BESIDE THEM. F2 left a treasure pile, a body and a shop's shelf to the
 * world, and a dungeon's `piles` (its treasure) with them - but the pack stores anything in any of them
 * (itemTransfer.js planStore; a closed shop's shelf opens both ways), and the save carries what they hold
 * (dungeonContext.js collectWorld) - so every container counts, both pile lists of the world bag whichever host wrote
 * it, and a dungeon's fallen (`foes` with `dead`: a body is a container; a living foe's purse is its own).
 * AUDIT REALM2 T2: AND A BOAT'S HOLD - each placed boat's `Items` and each packed boat's cargo (comeSailAway.js
 * getSaveData), the mod's record in the save: an ordinary container the pack fills, which customs never read.
 * @param {any} snap
 */
export function stashedItemLists(snap) {
  const out = [];
  for (const scene of Array.isArray(snap?.sceneCache?.scenes) ? snap.sceneCache.scenes : []) {
    for (const c of scene?.lootContainers ?? []) out.push(...lists(c?.items));
    for (const pile of scene?.droppedPiles ?? []) out.push(...lists(pile?.items));
    for (const held of Object.values(scene?.decorItems ?? {})) out.push(...lists(held));
  }
  const world = snap?.world;
  for (const pile of [...(world?.piles ?? []), ...(world?.droppedLoot ?? [])]) out.push(...lists(pile?.items));
  for (const foe of world?.foes ?? []) if (foe?.dead) out.push(...lists(foe.items));
  const csa = snap?.modData?.[CSA_VENDOR];
  for (const boat of csa?.placedBoats ?? []) out.push(...lists(boat?.Items));
  out.push(...lists(...Object.values(csa?.packedCargoes ?? {})));
  return out;
}
/** Every list of the character's own things where liquid wealth can lie, in the order customs takes from them: the
 *  stashes, then the wagon, then the pack. (The banks and the purse are counts, not lists.) */
export const carriedItemLists = (/** @type {any} */ snap) => [...stashedItemLists(snap), ...lists(snap?.wagonItems), ...lists(snap?.items)];

/** OPEN (AUDIT REALM2 T3), as the allowance is: the price customs counts a Daggerfall house at. The realm's bank buys a
 *  house back at the deed's share of its building's model radius x 1280 (banking.js houseSellPrice), a measure no save
 *  carries - the bank reads it off the building at its counter - and a Daggerfall house costs tens of thousands
 *  (net/homeLaw.js, HOME_PRICE_MAX's note), so every house counts at the deed's share of the top of that range. */
export const CUSTOMS_HOUSE_PRICE = 100_000;
/** The realm's bank's buy-back and where it files a ship's room, as the game has them - systems/banking.js DEED_SELL_MULT,
 *  SHIP_PRICES, shipSellPrice, ownedShipType, ownsShip and SHIP_INTERIOR_MAP_IDS, talkTopics.js BUILDING_KEY_0 (the
 *  no-key key both ship interiors are filed under) and sceneCache.js interiorSceneName. Pinned equal
 *  (test/auditrealm2_service.test.js): the Worker bundles no systems/. */
const DEED_SELL_MULT = 0.85;
const SHIP_PRICES = Object.freeze([100000, 200000]);
const shipSellPrice = (/** @type {number} */ ship) => Math.trunc((ship >= 0 ? SHIP_PRICES[ship] : 0) * DEED_SELL_MULT);
const ownedShipType = (/** @type {any} */ player) => player?.ownedShip ?? -1;
const ownsShip = (/** @type {any} */ player) => ownedShipType(player) !== -1;
const SHIP_INTERIOR_MAP_IDS = Object.freeze([1050578, 2102157]);
const BUILDING_KEY_0 = 1 << 24;
const interiorSceneName = (/** @type {number} */ mapId, /** @type {number} */ buildingKey) => `DaggerfallInterior [MapID=${mapId}, BuildingKey=${buildingKey}]`;

/** AUDIT REALM2 T3: THE DEEDS THE REALM'S BANK BUYS BACK - the ship at shipSellPrice and each house at the deed's share
 *  of CUSTOMS_HOUSE_PRICE, each with what the pieces placed in its own room pay back (net/decorLaw.js decorSaleBack:
 *  half of each one's `paid`, on its removal or the sale; the owner's own things cost nothing). A room no deed of the
 *  character's stands for pays nothing: nobody can take a piece out. (T3 sorted them dearest first, the order it took
 *  them in; RESTORE takes none, so no order is asked.)
 *  RESTORE (Mac: "Keep all, can't sell"): A DEED THAT CAME THROUGH CUSTOMS IS NONE OF THEM - its slot `crossed`, or the
 *  ship's `shipCrossed` (systems/realmCustoms.js crossDeeds): the realm's bank buys it back for nothing (banking.js
 *  sellHouse, sellShip), and the pieces bought for its room were set to pay nothing back as it crossed.
 *  @param {any} snap @returns {{ slot: any, room: any, value: number }[]} */
export function deedsOf(snap) {
  const scenes = Array.isArray(snap?.sceneCache?.scenes) ? snap.sceneCache.scenes : [];
  const roomOf = (/** @type {string} */ name) => scenes.find((s) => s?.sceneName === name) ?? null;
  const deeds = [];
  if (ownsShip(snap) && !snap.shipCrossed) {
    const ship = ownedShipType(snap);
    deeds.push({ slot: null, room: roomOf(interiorSceneName(SHIP_INTERIOR_MAP_IDS[ship], BUILDING_KEY_0)), value: shipSellPrice(ship) });
  }
  for (const slot of Array.isArray(snap?.houses) ? snap.houses : []) {
    if (slot?.buildingKey > 0 && !slot.crossed) deeds.push({ slot, room: roomOf(interiorSceneName(slot.mapId, slot.buildingKey)), value: Math.trunc(CUSTOMS_HOUSE_PRICE * DEED_SELL_MULT) });
  }
  for (const d of deeds) d.value += decorSaleBack(d.room?.decor);
  return deeds;
}

/** The wealth a save holds that the realm pays out in gold: its purse, every bank account, every gold-piece item and
 *  letter of credit the character owns wherever it lies - the pack, the wagon, and what it left in the world
 *  (stashedItemLists) - and (AUDIT REALM2 T3) each deed at what the realm's bank buys it back for (deedsOf). */
export function liquidWealthOf(/** @type {any} */ snap) {
  const purse = Math.max(0, snap?.goldPieces ?? 0);
  const banks = (Array.isArray(snap?.bankAccounts) ? snap.bankAccounts : []).reduce((s, a) => s + Math.max(0, a?.accountGold ?? 0), 0);
  const items = carriedItemLists(snap).reduce((s, list) => s + list.reduce((t, it) => t + liquidWorthOf(it), 0), 0);
  const deeds = deedsOf(snap).reduce((s, d) => s + d.value, 0);
  return purse + banks + items + deeds;
}
