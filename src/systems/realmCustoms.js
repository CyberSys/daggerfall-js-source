// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.5 — CUSTOMS: an offline character comes into the realm ONCE.
//
// Mac, decision 3: "Migrate once via customs". The plan is
// bible/06-Systems/Realm-Arc.md, "Customs": loans settled from bank and
// purse; liquid wealth - purse, letters of credit, banks - capped at an
// allowance for the level; Renown from its existing track (the service
// carries the track to the realm's id - server-account/src/realm.js
// customsCarry; CUSTOMS-CARRY, Mac 2026-09-29: and its online homes and
// its guild place, what stood before the realm, which AUDIT REALM2 S2
// had left behind; RENOWN-ACCOUNT: the Renown itself is the account's,
// so the realm character stands at it from its first minute, and the
// track that crosses is its history). Skills,
// attributes and items within the online caps, and a custom class
// re-checked, arrive with phase 4's caps.
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
// each at that price - and (HOUSE-LOSS) takes a whole deed only when the
// deeds by themselves are over; the gold pays the rest. applyCustoms says
// the rule.
// ═══════════════════════════════════════════════════════════════════

import { callInEmpireDebt, SHIP_TYPES } from './banking.js';
import { deductGold } from './court.js';
import { isGoldPieces } from './inventory.js';
// AUDIT REALM2 S1: the allowance and the measure live in the law the service reads too (net/realmGoldLaw.js), which holds
// a customs character's first save to them - re-exported here, their home before it; AUDIT REALM2 T2, T3 and T5's
// counting with them (every container, a boat's hold, a deed at what the realm's bank pays)
import { liquidWorthOf, stashedItemLists, carriedItemLists, liquidWealthOf, deedsOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL, CUSTOMS_HOUSE_PRICE } from '../net/realmGoldLaw.js';

export { stashedItemLists, liquidWealthOf, deedsOf, customsAllowance, CUSTOMS_WEALTH_BASE, CUSTOMS_WEALTH_PER_LEVEL, CUSTOMS_HOUSE_PRICE };
const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
/**
 * CUSTOMS ON A SAVE, in place (hand it a copy). First every loan is called in - the Empire keeps no loan for a
 * newcomer (banking.js callInEmpireDebt at a cap of nothing): the loan's own account, the other accounts, then the
 * purse and its letters; what cannot be paid falls due at once and defaults at the first join, as any call does. Then
 * the wealth left is capped at the allowance for the level: a deed goes only as far as the deeds THEMSELVES are over it
 * (AUDIT REALM2 T3 and HOUSE-LOSS, below), and the gold pays what is still over - what the character left in the world
 * first (AUDIT REALM F2: the stashes, which it cannot see from the door), then the bank (the fullest account first),
 * then the wagon's gold and letters, then the pack's letters, then the purse. A record emptied is gone from its list.
 *
 * AUDIT REALM2 T3: THE DEEDS' RULE. A deed - the ship, or a house - counts at what the realm's bank pays for it, with
 * the pieces bought for its room (deedsOf), and is taken WHOLE or not at all: a deed cannot be partly taken. Customs
 * counted the purse, the letters and the banks alone, so a rich character brought its ship, a house in every region and
 * their pieces in uncounted, to sell there.
 * HOUSE-LOSS (2026-09-29, Mac: "GarySoup lost his house and furniture. I suspect a lot of people lost a ton of
 * belongings"): WHICH DEED GOES, AND WHEN. T3 stripped deeds before a coin of the bank or the purse, so a house - and
 * every piece bought for its room - stayed behind for an excess the bank could have paid many times over (level 10, a
 * furnished house, 60,000 in the bank: the house went, the bank stood). The cap is the same either way; what differs is
 * whether the player keeps the house or the gold, and a whole deed can never be paid back in part. So a deed goes only
 * while the deeds left are over the allowance by themselves: the dearest first - the ship or the house off the copy,
 * the pieces bought for its room with it, everything else in the room left standing - stopping the moment the deeds
 * left fit, and the gold pays the rest, which it always can. The last deed stripped may take more than was over with
 * it, and nothing comes back for that: what the realm's bank would have paid for it never reaches the realm.
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
      const t = take(liquidWorthOf(it));
      if (!t) continue;
      if (isGoldPieces(it)) it.stackCount -= t; else it.value -= t;
      if (!liquidWorthOf(it)) emptied.add(it);
    }
  };
  /** @type {string[]} */
  const deeds = [];
  const owned = deedsOf(snap);
  let held = owned.reduce((s, d) => s + d.value, 0);
  for (const deed of owned) {
    if (held <= allowance) break;   // HOUSE-LOSS: the deeds left fit - the gold pays what is still over
    if (deed.slot) Object.assign(deed.slot, { location: '', mapId: 0, buildingKey: 0 });   // banking.js sellHouse's fresh record
    else snap.ownedShip = SHIP_TYPES.None;
    if (Array.isArray(deed.room?.decor)) deed.room.decor = deed.room.decor.filter((/** @type {any} */ p) => p?.item);   // the owner's own things stand
    deeds.push(deed.slot ? 'house' : 'ship');
    held -= deed.value;
    excess = Math.max(0, excess - deed.value);
  }
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
  return { called: call.called, paid: call.paid, owed: call.owed, wealth, allowance, taken: wealth - liquidWealthOf(snap), deeds };
}

/** CUSTOMS-CARRY (2026-09-29): what the door promises before customs runs, whatever it finds - what crosses beside the
 *  save (the service carries the home and the guild place, realm.js CHARACTER_TABLES), what stays, and the once. */
export const CUSTOMS_PROMISE = Object.freeze([
  'Your online homes and your guild place come with you.',
  'Your offline character stays exactly as it is, loans and gold included, and keeps playing offline.',
  'A character comes into the realm once.',
]);

/** What customs did, in the Online door's words - or, `before` it runs (FIELD 2026-09-29, Dracula/Valentin: "HOW TF WAS
 *  I SUPPOSED TO KNOW YALL WOULD FORCE THE LOANS TO BE PAID"), what it will do: the same report off a copy customs ran
 *  on, told ahead, and the door's promise under it. */
export function customsLines({ called, owed, wealth, allowance, taken, deeds = [] }, { before = false } = {}) {
  const lines = [];
  if (called > 0) {
    lines.push(before
      ? (owed > 0 ? `Customs will call in ${called} gold of loans; ${owed} cannot be paid and falls due.` : `Customs will call in ${called} gold of loans and pay them from your bank and purse.`)
      : (owed > 0 ? `Customs called in ${called} gold of loans; ${owed} could not be paid and falls due.` : `Customs called in ${called} gold of loans, and they are paid.`));
  }
  if (taken > 0) {
    lines.push(before
      ? `You carry ${wealth} gold; the realm lets a character of this level bring ${allowance}. ${taken} will stay behind.`
      : `You carried ${wealth} gold; the realm lets a character of this level bring ${allowance}. ${taken} stays behind.`);
  }
  // AUDIT REALM2 T3: and which deeds stayed behind with it
  const houses = deeds.filter((d) => d === 'house').length;
  const what = [deeds.includes('ship') ? 'your ship' : '', houses > 1 ? `${houses} houses` : houses ? 'a house' : ''].filter(Boolean).join(' and ');
  if (what) lines.push(`Customs counts a deed at what the realm's bank pays for it: ${what} ${before ? 'will stay' : deeds.length > 1 ? 'stay' : 'stays'} behind.`);
  if (!lines.length) lines.push(before ? 'Customs finds nothing to settle.' : 'Customs found nothing to settle.');
  return before ? [...lines, ...CUSTOMS_PROMISE] : lines;
}
