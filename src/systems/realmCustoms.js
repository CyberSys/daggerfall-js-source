// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.5 — CUSTOMS: an offline character comes into the realm ONCE.
//
// Mac, decision 3: "Migrate once via customs". The plan is
// bible/06-Systems/Realm-Arc.md, "Customs": loans settled from bank and
// purse; liquid wealth - purse, letters of credit, banks - capped at an
// allowance for the level; Renown from its existing track (the service
// carries the track, the homes and the guild to the realm's id -
// server-account/src/realm.js carryOnlineLife). Skills, attributes and
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
import { LETTER_OF_CREDIT_TEMPLATE, isGoldPieces } from './inventory.js';

/** OPEN (Realm-Arc "Customs"): the liquid wealth a character brings in - a base, and this much a level. */
export const CUSTOMS_WEALTH_BASE = 20_000;
export const CUSTOMS_WEALTH_PER_LEVEL = 10_000;
/** The allowance at a level. */
export const customsAllowance = (/** @type {number} */ level) => CUSTOMS_WEALTH_BASE + CUSTOMS_WEALTH_PER_LEVEL * Math.max(1, Math.trunc(level) || 1);

const isLetter = (/** @type {any} */ it) => it?.templateIndex === LETTER_OF_CREDIT_TEMPLATE;
const wagonGoldOf = (/** @type {any} */ snap) => (Array.isArray(snap.wagonItems) ? snap.wagonItems : []).filter((it) => isGoldPieces(it));

/** The liquid wealth a save holds: its purse, its letters of credit, the gold in its wagon and every bank account. */
export function liquidWealthOf(/** @type {any} */ snap) {
  const purse = Math.max(0, snap?.goldPieces ?? 0);
  const letters = (Array.isArray(snap?.items) ? snap.items : []).filter(isLetter).reduce((s, it) => s + Math.max(0, it.value ?? 0), 0);
  const wagon = wagonGoldOf(snap ?? {}).reduce((s, it) => s + Math.max(0, it.stackCount ?? 0), 0);
  const banks = (Array.isArray(snap?.bankAccounts) ? snap.bankAccounts : []).reduce((s, a) => s + Math.max(0, a?.accountGold ?? 0), 0);
  return purse + letters + wagon + banks;
}

/**
 * CUSTOMS ON A SAVE, in place (hand it a copy). First every loan is called in - the Empire keeps no loan for a
 * newcomer (banking.js callInEmpireDebt at a cap of nothing): the loan's own account, the other accounts, then the
 * purse and its letters; what cannot be paid falls due at once and defaults at the first join, as any call does. Then
 * the liquid wealth left is capped at the allowance for the level: the excess is taken from the bank (the fullest
 * account first), then the wagon's gold, then the letters of credit, then the purse. Answers what customs did.
 * @param {any} snap
 */
export function applyCustoms(snap) {
  const accounts = Array.isArray(snap.bankAccounts) ? snap.bankAccounts : [];
  const call = callInEmpireDebt(accounts, { deductGold: (/** @type {number} */ n) => deductGold(snap, n) }, { cap: 0, nowMinutes: Math.floor(snap.classicMinutes ?? 0) });
  const allowance = customsAllowance(snap.level);
  const wealth = liquidWealthOf(snap);
  let excess = Math.max(0, wealth - allowance);
  const take = (/** @type {number} */ have) => { const t = Math.min(excess, Math.max(0, have)); excess -= t; return t; };
  for (const a of [...accounts].sort((x, y) => (y?.accountGold ?? 0) - (x?.accountGold ?? 0))) {
    if (!excess) break;
    a.accountGold -= take(a.accountGold ?? 0);
  }
  for (const it of wagonGoldOf(snap)) {
    if (!excess) break;
    it.stackCount -= take(it.stackCount ?? 0);
  }
  if (Array.isArray(snap.wagonItems)) snap.wagonItems = snap.wagonItems.filter((it) => !isGoldPieces(it) || it.stackCount > 0);
  for (const it of (Array.isArray(snap.items) ? snap.items : []).filter(isLetter)) {
    if (!excess) break;
    it.value -= take(it.value ?? 0);
  }
  if (Array.isArray(snap.items)) snap.items = snap.items.filter((it) => !isLetter(it) || it.value > 0);
  if (excess) snap.goldPieces = Math.max(0, (snap.goldPieces ?? 0) - take(snap.goldPieces ?? 0));
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
