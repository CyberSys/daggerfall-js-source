// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.5 — CUSTOMS: an offline character comes into the realm ONCE.
//
// Mac, decision 3: "Migrate once via customs". The plan is
// bible/06-Systems/Realm-Arc.md, "Customs": loans settled from bank and
// purse; liquid wealth - purse, letters of credit, banks - capped at an
// allowance for the level; Renown from its existing track (the service
// carries the track to the realm's id - server-account/src/realm.js
// customsCarry; AUDIT REALM2 S2: never a home or a guild place, which
// were the client's word before the realm). Skills, attributes and
// items within the online caps, and a custom class re-checked, arrive
// with phase 4's caps.
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
import { isGoldPieces } from './inventory.js';
// AUDIT REALM2 S1: the allowance and the measure live in the law the service reads too (net/realmGoldLaw.js), which holds
// a customs character's first save to them - re-exported here, their home before it
import { liquidWorthOf, stashedItemLists, carriedItemLists, liquidWealthOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL } from '../net/realmGoldLaw.js';

export { stashedItemLists, liquidWealthOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL };
const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);

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
      const t = take(liquidWorthOf(it));
      if (!t) continue;
      if (isGoldPieces(it)) it.stackCount -= t; else it.value -= t;
      if (!liquidWorthOf(it)) emptied.add(it);
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
  for (const list of carriedItemLists(snap)) {
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
