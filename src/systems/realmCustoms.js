// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.5 — CUSTOMS: an offline character comes into the realm ONCE.
//
// Mac, decision 3: "Migrate once via customs". The plan is
// bible/06-Systems/Realm-Arc.md, "Customs": loans settled from bank and
// purse; liquid wealth - purse, letters of credit, banks - capped at an
// allowance for the level; Renown from its existing track (the service
// carries the track, the homes and the guild to the realm's id -
// server-account/src/realm.js carryOnlineLife; RENOWN-ACCOUNT: the
// Renown itself is the account's, so the realm character stands at it
// from its first minute, and the track that crosses is its history).
// Skills, attributes and items within the online caps, and a custom
// class re-checked, arrive with phase 4's caps.
//
// THIS RUNS ON A COPY OF THE SAVE, never on the local slot: the offline
// character stays exactly what it was and keeps playing offline. What
// crosses is the copy customs made, and only once - the service refuses
// the same offline id a second time.
//
// THE ALLOWANCE IS OPEN. The plan left its number to Mac; the one here
// (CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL a level) is a first
// setting, named so it can be moved in one place.
//
// AUDIT REALM2 T3: A DEED IS WEALTH TOO. The realm's bank buys a ship, a
// house and the pieces placed in them back for gold, so customs counts
// each at that price and takes whole deeds when the total is over -
// applyCustoms says the rule.
// ═══════════════════════════════════════════════════════════════════

import { callInEmpireDebt, ownsShip, ownedShipType, shipSellPrice, SHIP_TYPES, SHIP_INTERIOR_MAP_IDS, DEED_SELL_MULT } from './banking.js';   // AUDIT REALM2 T3: and what it buys back
import { deductGold } from './court.js';
import { LETTER_OF_CREDIT_TEMPLATE, isGoldPieces } from './inventory.js';
import { interiorSceneName } from './sceneCache.js';   // AUDIT REALM2 T3: the room a deed's pieces stand in
import { BUILDING_KEY_0 } from './talkTopics.js';   // AUDIT REALM2 T3: the no-key key both ship interiors are filed under
import { decorSaleBack } from '../net/decorLaw.js';   // AUDIT REALM2 T3: what a room's placed pieces pay back

/** OPEN (Realm-Arc "Customs"): the liquid wealth a character brings in - a base, and this much a level. */
export const CUSTOMS_WEALTH_BASE = 20_000;
export const CUSTOMS_WEALTH_PER_LEVEL = 10_000;
/** The allowance at a level. */
export const customsAllowance = (/** @type {number} */ level) => CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL * Math.max(1, Math.trunc(level) || 1);

const isLetter = (/** @type {any} */ it) => it?.templateIndex === LETTER_OF_CREDIT_TEMPLATE;
/** A record's liquid worth: a gold-piece item's count, a letter of credit's value - anything else none. */
const liquidOf = (/** @type {any} */ it) => (isGoldPieces(it) ? Math.max(0, it?.stackCount ?? 0) : isLetter(it) ? Math.max(0, it?.value ?? 0) : 0);
const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
/** Come Sail Away's record in a save's per-mod slot (systems/comeSailAway.js COME_SAIL_AWAY_VENDOR, pinned equal - that
 *  module is the mod's runtime, which the Online door never loads). */
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
const carriedLists = (/** @type {any} */ snap) => [...stashedItemLists(snap), ...lists(snap?.wagonItems), ...lists(snap?.items)];

/** OPEN (AUDIT REALM2 T3), as the allowance is: the price customs counts a Daggerfall house at. The realm's bank buys a
 *  house back at the deed's share of its building's model radius x 1280 (banking.js houseSellPrice), a measure no save
 *  carries - the bank reads it off the building at its counter - and a Daggerfall house costs tens of thousands
 *  (net/homeLaw.js, HOME_PRICE_MAX's note), so every house counts at the deed's share of the top of that range. */
export const CUSTOMS_HOUSE_PRICE = 100_000;

/** AUDIT REALM2 T3: THE DEEDS THE REALM'S BANK BUYS BACK - the ship at shipSellPrice and each house at the deed's share
 *  of CUSTOMS_HOUSE_PRICE, each with what the pieces placed in its own room pay back (net/decorLaw.js decorSaleBack:
 *  half of each one's `paid`, on its removal or the sale; the owner's own things cost nothing) - the dearest first, the
 *  order customs strips them in. A room no deed of the character's stands for pays nothing: nobody can take a piece out.
 *  @param {any} snap @returns {{ slot: any, room: any, value: number }[]} */
function deedsOf(snap) {
  const scenes = Array.isArray(snap?.sceneCache?.scenes) ? snap.sceneCache.scenes : [];
  const roomOf = (/** @type {string} */ name) => scenes.find((s) => s?.sceneName === name) ?? null;
  const deeds = [];
  if (ownsShip(snap)) {
    const ship = ownedShipType(snap);
    deeds.push({ slot: null, room: roomOf(interiorSceneName(SHIP_INTERIOR_MAP_IDS[ship], BUILDING_KEY_0)), value: shipSellPrice(ship) });
  }
  for (const slot of Array.isArray(snap?.houses) ? snap.houses : []) {
    if (slot?.buildingKey > 0) deeds.push({ slot, room: roomOf(interiorSceneName(slot.mapId, slot.buildingKey)), value: Math.trunc(CUSTOMS_HOUSE_PRICE * DEED_SELL_MULT) });
  }
  for (const d of deeds) d.value += decorSaleBack(d.room?.decor);
  return deeds.sort((a, b) => b.value - a.value);
}

/** The wealth a save holds that the realm pays out in gold: its purse, every bank account, every gold-piece item and
 *  letter of credit the character owns wherever it lies - the pack, the wagon, and what it left in the world
 *  (stashedItemLists) - and (AUDIT REALM2 T3) each deed at what the realm's bank buys it back for (deedsOf). */
export function liquidWealthOf(/** @type {any} */ snap) {
  const purse = Math.max(0, snap?.goldPieces ?? 0);
  const banks = (Array.isArray(snap?.bankAccounts) ? snap.bankAccounts : []).reduce((s, a) => s + Math.max(0, a?.accountGold ?? 0), 0);
  const items = carriedLists(snap).reduce((s, list) => s + list.reduce((t, it) => t + liquidOf(it), 0), 0);
  const deeds = deedsOf(snap).reduce((s, d) => s + d.value, 0);
  return purse + banks + items + deeds;
}

/**
 * CUSTOMS ON A SAVE, in place (hand it a copy). First every loan is called in - the Empire keeps no loan for a
 * newcomer (banking.js callInEmpireDebt at a cap of nothing): the loan's own account, the other accounts, then the
 * purse and its letters; what cannot be paid falls due at once and defaults at the first join, as any call does. Then
 * the wealth left is capped at the allowance for the level: the excess is taken from what the character left in the
 * world first (AUDIT REALM F2: the stashes, which it cannot see from the door), then from its deeds (AUDIT REALM2 T3,
 * below), then the bank (the fullest account first), then the wagon's gold and letters, then the pack's letters, then
 * the purse. A record emptied is gone from its list.
 *
 * AUDIT REALM2 T3: THE DEEDS' RULE. A deed - the ship, or a house - counts at what the realm's bank pays for it, with
 * the pieces bought for its room (deedsOf), and is taken WHOLE or not at all: a deed cannot be partly taken. While the
 * stashes leave an excess, customs strips the dearest deed left - the ship or the house off the copy, the pieces bought
 * for its room with it, and everything else in the room left standing - and stops the moment the rest is within the
 * allowance. The last deed stripped may take more than the excess with it, and nothing comes back for that: what the
 * realm's bank would have paid for it never reaches the realm. Customs counted the purse, the letters and the banks
 * alone, so a rich character brought its ship, a house in every region and their pieces in uncounted, to sell there.
 * Answers what customs did - `taken` counts a deed at its price, and `deeds` names those that stayed behind.
 * @param {any} snap
 */
export function applyCustoms(snap) {
  const accounts = Array.isArray(snap.bankAccounts) ? snap.bankAccounts : [];
  const call = callInEmpireDebt(accounts, { deductGold: (/** @type {number} */ n) => deductGold(snap, n) }, { cap: 0, nowMinutes: Math.floor(snap.classicMinutes ?? 0) });
  const allowance = customsAllowance(snap.level);
  const wealth = liquidWealthOf(snap);
  let excess = Math.max(0, wealth - allowance);
  const take = (/** @type {number} */ have) => { const t = Math.min(excess, Math.max(0, have)); excess -= t; return t; };
  /** @type {Set<any>} */
  const emptied = new Set();
  const takeFrom = (/** @type {any[]} */ list) => {
    for (const it of list) {
      if (!excess) return;
      const t = take(liquidOf(it));
      if (!t) continue;
      if (isGoldPieces(it)) it.stackCount -= t; else it.value -= t;
      if (!liquidOf(it)) emptied.add(it);
    }
  };
  for (const list of stashedItemLists(snap)) takeFrom(list);
  /** @type {string[]} */
  const deeds = [];
  for (const deed of deedsOf(snap)) {
    if (!excess) break;
    if (deed.slot) Object.assign(deed.slot, { location: '', mapId: 0, buildingKey: 0 });   // banking.js sellHouse's fresh record
    else snap.ownedShip = SHIP_TYPES.None;
    if (Array.isArray(deed.room?.decor)) deed.room.decor = deed.room.decor.filter((/** @type {any} */ p) => p?.item);   // the owner's own things stand
    deeds.push(deed.slot ? 'house' : 'ship');
    excess = Math.max(0, excess - deed.value);
  }
  for (const a of [...accounts].sort((x, y) => (y?.accountGold ?? 0) - (x?.accountGold ?? 0))) {
    if (!excess) break;
    a.accountGold -= take(a.accountGold ?? 0);
  }
  for (const list of lists(snap.wagonItems, snap.items)) takeFrom(list);
  if (excess) snap.goldPieces = Math.max(0, (snap.goldPieces ?? 0) - take(snap.goldPieces ?? 0));
  // the records customs emptied leave their lists, in place - a list is held by its container, its pile or its piece
  for (const list of carriedLists(snap)) {
    for (let i = list.length - 1; i >= 0; i--) if (emptied.has(list[i])) list.splice(i, 1);
  }
  return { called: call.called, paid: call.paid, owed: call.owed, wealth, allowance, taken: wealth - liquidWealthOf(snap), deeds };
}

/** What customs did, in the Online door's words. */
export function customsLines({ called, owed, wealth, allowance, taken, deeds = [] }) {
  const lines = [];
  if (called > 0) lines.push(owed > 0 ? `Customs called in ${called} gold of loans; ${owed} could not be paid and falls due.` : `Customs called in ${called} gold of loans, and they are paid.`);
  if (taken > 0) lines.push(`You carried ${wealth} gold; the realm lets a character of this level bring ${allowance}. ${taken} stays behind.`);
  // AUDIT REALM2 T3: and which deeds stayed behind with it
  const houses = deeds.filter((d) => d === 'house').length;
  const what = [deeds.includes('ship') ? 'your ship' : '', houses > 1 ? `${houses} houses` : houses ? 'a house' : ''].filter(Boolean).join(' and ');
  if (what) lines.push(`Customs counts a deed at what the realm's bank pays for it: ${what} ${deeds.length > 1 ? 'stay' : 'stays'} behind.`);
  if (!lines.length) lines.push('Customs found nothing to settle.');
  return lines;
}
