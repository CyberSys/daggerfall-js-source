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
