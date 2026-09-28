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
// ═══════════════════════════════════════════════════════════════════

import { callInEmpireDebt } from './banking.js';
import { deductGold } from './court.js';
import { LETTER_OF_CREDIT_TEMPLATE, isGoldPieces } from './inventory.js';
import { LOOT_CONTAINER_TYPES } from './sceneCache.js';   // AUDIT REALM F2: which of a scene's containers are the player's to fill

/** OPEN (Realm-Arc "Customs"): the liquid wealth a character brings in - a base, and this much a level. */
export const CUSTOMS_WEALTH_BASE = 20_000;
export const CUSTOMS_WEALTH_PER_LEVEL = 10_000;
/** The allowance at a level. */
export const customsAllowance = (/** @type {number} */ level) => CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL * Math.max(1, Math.trunc(level) || 1);

const isLetter = (/** @type {any} */ it) => it?.templateIndex === LETTER_OF_CREDIT_TEMPLATE;
/** A record's liquid worth: a gold-piece item's count, a letter of credit's value - anything else none. */
const liquidOf = (/** @type {any} */ it) => (isGoldPieces(it) ? Math.max(0, it?.stackCount ?? 0) : isLetter(it) ? Math.max(0, it?.value ?? 0) : 0);
/** The containers of a scene that are the player's to fill (sceneCache.js): a house's own chests and a pile the player
 *  dropped - never a shop's shelves, a body or a treasure pile, which are the world's loot, not the character's. */
const PLAYER_FILLED = Object.freeze([LOOT_CONTAINER_TYPES.DroppedLoot, LOOT_CONTAINER_TYPES.HouseContainers]);
const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);

/**
 * AUDIT REALM F2: WHAT THE PLAYER LEFT IN THE WORLD - every list of the character's own things a save carries outside its
 * pack and wagon, where gold and letters of credit lie as items: in each cached scene (sceneCache.js), a house's chests,
 * the piles dropped in a room or on a street, and the storage pieces' contents (DECOR1c `decorItems`, an online home's
 * too); and the piles the save's own host rides in its `world` bag - a dungeon's `droppedLoot` (its `piles` are the
 * dungeon's treasure), the open air's `piles`. Customs read the purse, the pack's letters, the wagon's gold and the banks
 * alone, so letters stowed in the wagon, gold in a house chest or a storage piece and a pile left on the floor all
 * crossed uncapped.
 * @param {any} snap
 */
export function stashedItemLists(snap) {
  const out = [];
  for (const scene of Array.isArray(snap?.sceneCache?.scenes) ? snap.sceneCache.scenes : []) {
    for (const c of scene?.lootContainers ?? []) if (PLAYER_FILLED.includes(c?.containerType)) out.push(...lists(c.items));
    for (const pile of scene?.droppedPiles ?? []) out.push(...lists(pile?.items));
    for (const held of Object.values(scene?.decorItems ?? {})) out.push(...lists(held));
  }
  const world = snap?.world;
  for (const pile of (snap?.dungeon ? world?.droppedLoot : world?.piles) ?? []) out.push(...lists(pile?.items));
  return out;
}
/** Every list of the character's own things where liquid wealth can lie, in the order customs takes from them: the
 *  stashes, then the wagon, then the pack. (The banks and the purse are counts, not lists.) */
const carriedLists = (/** @type {any} */ snap) => [...stashedItemLists(snap), ...lists(snap?.wagonItems), ...lists(snap?.items)];

/** The liquid wealth a save holds: its purse, every bank account, and every gold-piece item and letter of credit the
 *  character owns wherever it lies - the pack, the wagon, and what it left in the world (stashedItemLists). */
export function liquidWealthOf(/** @type {any} */ snap) {
  const purse = Math.max(0, snap?.goldPieces ?? 0);
  const banks = (Array.isArray(snap?.bankAccounts) ? snap.bankAccounts : []).reduce((s, a) => s + Math.max(0, a?.accountGold ?? 0), 0);
  const items = carriedLists(snap).reduce((s, list) => s + list.reduce((t, it) => t + liquidOf(it), 0), 0);
  return purse + banks + items;
}

/**
 * CUSTOMS ON A SAVE, in place (hand it a copy). First every loan is called in - the Empire keeps no loan for a
 * newcomer (banking.js callInEmpireDebt at a cap of nothing): the loan's own account, the other accounts, then the
 * purse and its letters; what cannot be paid falls due at once and defaults at the first join, as any call does. Then
 * the liquid wealth left is capped at the allowance for the level: the excess is taken from what the character left in
 * the world first (AUDIT REALM F2: the stashes, which it cannot see from the door), then the bank (the fullest account
 * first), then the wagon's gold and letters, then the pack's letters, then the purse. A record emptied is gone from its
 * list. Answers what customs did.
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
  return { called: call.called, paid: call.paid, owed: call.owed, wealth, allowance, taken: Math.max(0, wealth - allowance) - excess };
}

/** What customs did, in the Online door's words. */
export function customsLines({ called, owed, wealth, allowance, taken }) {
  const lines = [];
  if (called > 0) lines.push(owed > 0 ? `Customs called in ${called} gold of loans; ${owed} could not be paid and falls due.` : `Customs called in ${called} gold of loans, and they are paid.`);
  if (taken > 0) lines.push(`You carried ${wealth} gold; the realm lets a character of this level bring ${allowance}. ${taken} stays behind.`);
  if (!lines.length) lines.push('Customs found nothing to settle.');
  return lines;
}
