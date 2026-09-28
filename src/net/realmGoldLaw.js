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
// to a region's bank account (a home sold). The service imports this and
// never systems/court.js, whose imports the Worker does not bundle.
// ═══════════════════════════════════════════════════════════════════

/** The letter of credit's template (systems/inventory.js LETTER_OF_CREDIT_TEMPLATE, pinned equal; a name of its own, so no symbol is declared twice - audit24 wave24). */
export const REALM_LETTER_TEMPLATE = 275;

const whole = (/** @type {unknown} */ v) => (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : 0);
/** The bank account of `region` in a save, or null. */
export const accountOfSave = (/** @type {any} */ save, /** @type {unknown} */ region) =>
  (Number.isSafeInteger(region) && /** @type {number} */ (region) >= 0 && Array.isArray(save?.bankAccounts) ? save.bankAccounts[/** @type {number} */ (region)] ?? null : null);

/** What a save can pay with: its coins, its letters of credit and, when `region` names one, that region's account. */
export function payableOf(/** @type {any} */ save, /** @type {unknown} */ region = null) {
  const coins = whole(save?.goldPieces);
  const letters = (Array.isArray(save?.items) ? save.items : []).filter((it) => it?.templateIndex === REALM_LETTER_TEMPLATE).reduce((s, it) => s + whole(it.value), 0);
  const bank = Math.max(0, Number(accountOfSave(save, region)?.accountGold) || 0);
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
  if (owed > 0) accountOfSave(save, region).accountGold -= owed;   // payableOf counted it: the account is there and covers it
  return true;
}

/** CREDIT `amount` to a save, in place: the purse, or `bank`'s account (a home sold - a missing account takes it in the
 *  purse, the gold kept either way). Answers false for an amount that is none. */
export function creditSave(/** @type {any} */ save, /** @type {number} */ amount, /** @type {{ bank?: number | null }} */ { bank = null } = {}) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !save || typeof save !== 'object') return false;
  const a = bank == null ? null : accountOfSave(save, bank);
  if (a) a.accountGold = (Number.isFinite(a.accountGold) ? a.accountGold : 0) + amount;
  else save.goldPieces = whole(save.goldPieces) + amount;
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

/** The gold-piece template (systems/inventory.js GOLD_TEMPLATE; isGoldPieces reads the group with it) and the containers
 *  of a scene that are the player's to fill (systems/sceneCache.js LOOT_CONTAINER_TYPES DroppedLoot and HouseContainers):
 *  a house's own chests and a pile the player dropped - never a shop's shelves, a body or a treasure pile, which are the
 *  world's loot, not the character's. Pinned equal (test/auditrealm2_service.test.js): the Worker bundles no systems/. */
const COINS_TEMPLATE = 276;
const PLAYER_FILLED = Object.freeze([3, 5]);
const isCoins = (/** @type {any} */ it) => it?.group === 'Currency' && it?.templateIndex === COINS_TEMPLATE;
const isLetter = (/** @type {any} */ it) => it?.templateIndex === REALM_LETTER_TEMPLATE;
/** A record's liquid worth: a gold-piece item's count, a letter of credit's value - anything else none. */
export const liquidWorthOf = (/** @type {any} */ it) => (isCoins(it) ? Math.max(0, it?.stackCount ?? 0) : isLetter(it) ? Math.max(0, it?.value ?? 0) : 0);
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
export const carriedItemLists = (/** @type {any} */ snap) => [...stashedItemLists(snap), ...lists(snap?.wagonItems), ...lists(snap?.items)];

/** The liquid wealth a save holds: its purse, every bank account, and every gold-piece item and letter of credit the
 *  character owns wherever it lies - the pack, the wagon, and what it left in the world (stashedItemLists). */
export function liquidWealthOf(/** @type {any} */ snap) {
  const purse = Math.max(0, snap?.goldPieces ?? 0);
  const banks = (Array.isArray(snap?.bankAccounts) ? snap.bankAccounts : []).reduce((s, a) => s + Math.max(0, a?.accountGold ?? 0), 0);
  const items = carriedItemLists(snap).reduce((s, list) => s + list.reduce((t, it) => t + liquidWorthOf(it), 0), 0);
  return purse + banks + items;
}
