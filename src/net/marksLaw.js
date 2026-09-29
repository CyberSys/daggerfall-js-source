// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MARKS1 (2026-09-28, Mac: "New currency"; "Continue! Remember, this is
// your baby"; "continue") — MARKS, THE SERVER'S CURRENCY: what a Mark is
// worth, where one comes from, where it goes, and every bound both ends
// read. The record is bible/06-Systems/Professions-Arc.md 10.5 (PROF0).
//
// WHY A SECOND CURRENCY. Online gold is the save's ("The GOLD is the
// client's, the economy being the save's" - GUILD1), so anything paid in
// purse gold can be paid by a client that never had it. A Mark is held by
// the account service alone and struck only for an act a server
// witnessed: it is the one thing a modified client cannot print.
//
// THE ONE-WAY DOOR. Marks sell for gold at a Bank of the Empire counter,
// 1 for 8 (a spread that is itself a sink), 300 a UTC day; GOLD NEVER
// BUYS MARKS - that door would strike a Mark from gold a client may not
// have had. There is no route, function or table here that turns gold
// into Marks, and the pins hold that.
//
// The shapes and bounds BOTH ends read - the account service
// (server-account/src/marks.js), which keeps every balance and the one
// ledger, and the client. Pure: no clock, no DOM, no network.
// ═══════════════════════════════════════════════════════════════════

/** The most an account's balance - or a guild's Marks treasury - holds. */
export const MARKS_MAX = 10_000_000;
/** A Mark is worth about this much gold of play (the record's yardstick; the Bank pays less - its spread). */
export const MARK_WORTH_GOLD = 10;

/**
 * THE FAUCETS - only acts a server witnessed, each capped. MARKS1 strikes the first (the gate's receipts); the rest
 * come with their slices, and are named here so the cap is the law before the faucet is built.
 *   gate      - an Oblivion Gate receipt the relay signed and the service counted (WB5b): 50, two a UTC day an account
 *               (FACT: a gate rises every game day - twelve a real day - and gate_kills keys on the game day, so the
 *               gate's own law allows twelve; this is the faucet's). 100 under a Daedric Incursion (SEAT0 9.3, to come).
 *   writ      - a Court writ's pay (PROF1 - BUILT, server-account/src/professions.js): its units x the material's
 *               value x 1.2, 3 an account a UTC day.
 *   honour    - a Siege Honour (SEAT0 6.8): one a siege.
 *   motherlode - a Motherlode find (PROF2): 10, one an account a day.
 */
export const MARKS_FAUCETS = Object.freeze({
  gate: Object.freeze({ amount: 50, perDay: 2 }),
  writ: Object.freeze({ perDay: 3 }),   // PROF1: the pay is each writ's own (professionLaw.js writPay)
});
/** The Bank of the Empire's exchange: Marks for gold, never the other way. */
export const MARKS_BANK = Object.freeze({ goldPerMark: 8, perDay: 300 });
/** One guild deposit or withdrawal of Marks, at most. */
export const MARKS_MOVE_MAX = 1_000_000;
/** The ledger lines a guild's view shows. */
export const MARKS_LEDGER_SHOWN = 50;
/** The weekly report's span, in UTC days. */
export const MARKS_REPORT_DAYS = 7;
/** Marks acts an account may make an hour (an exchange and a guild move each count). */
export const MARKS_OPS_MAX = 120;
export const MARKS_OPS_WINDOW_S = 3600;

/** Every kind of line the one ledger holds, and which way it moves Marks. */
export const MARKS_KINDS = Object.freeze({
  gate: 'mint',               // the relay's receipt, counted
  exchange: 'burn',           // sold to the Bank for gold
  'guild-deposit': 'move',    // a member's balance into the guild's treasury
  'guild-withdraw': 'move',   // the guildmaster's, out of it
  writ: 'mint',               // PROF1: a Court writ filled from the Stores - an act the service witnessed (it took the units)
  respec: 'burn',             // PROF1: a specialisation changed (PROF0 3.3: 1,000 Marks)
  stock: 'burn',              // PROF3: the smith's stock - the fittings no profession yields yet, bought into the Stores (PROF0 24)
  'market-fee': 'burn',       // PROF5: a listing's fee, 1% of its worth, at least 1 (PROF0 10.4)
  'market-tax': 'burn',       // PROF5: a sale's tax, 5% of it - the seller's, from the proceeds
  courier: 'burn',            // PROF5: a courier's fee, the buyer's, on top of the price
  'market-sale': 'move',      // PROF5: a sale's proceeds, the buyer's balance into the seller's
  'order-escrow': 'move',     // PROF5: a buy order's Marks, held while it stands (the ledger's `escrow` end, the order's id)
  'order-fill': 'move',       // PROF5: a fill's pay, out of the order's escrow into the filler's balance
  'order-return': 'move',     // PROF5: what is left of an order's escrow, back to its poster at a cancel or its seventh day
  'bid-escrow': 'move',       // PROF5b: an auction bid and its courier, held while it stands (the `escrow` end, the bid's id)
  'bid-return': 'move',       // PROF5b: an outbid (or a removed auction's) bid's escrow, back to its bidder
  'auction-sale': 'move',     // PROF5b: the winning bid less its tax, out of its escrow into the seller's balance
});

/** The switch the service's config holds (MARKS_OPEN): off, dev (the developers alone), on. */
export const MARKS_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const marksSwitchOf = (v) => (MARKS_SWITCH.includes(v) ? v : 'off');

/** The UTC day a moment falls in - every cap counts by it. */
export const utcDay = (nowS) => Math.floor(nowS / 86400);
/** A whole number of Marks to move: 1 up to `max`. */
export const marksAmountOk = (n, max = MARKS_MOVE_MAX) => Number.isSafeInteger(n) && n >= 1 && n <= max;
/** The gold the Bank pays for `marks`. */
export const exchangeGold = (marks) => marks * MARKS_BANK.goldPerMark;
/** A request id, so an answer lost and asked again is answered again rather than charged twice: 8-40 of [A-Za-z0-9_-]. */
export const MARKS_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;

/** A balance as a person reads it: "1,240 Marks", "1 Mark". */
export const marksText = (n) => `${Number(n).toLocaleString('en-US')} ${n === 1 ? 'Mark' : 'Marks'}`;
