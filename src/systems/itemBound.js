// @ts-check
// SS1 (2026-09-27, Mac: "make sigil stones bound items and stackable"): A BOUND PIECE IS NEVER HANDED TO ANOTHER PLAYER.
//
// Binding is the item's own nature, not the player's choice: its template row says `bound` (the Sigil Stone's does -
// systems/gateSpoils.js), so every such piece is bound, one minted before the row said so included, and no field on
// the record can unbind it. It closes the one way a piece passes from one player to another - the trade (TRADE1,
// systems/tradePack.js: never put on the table, and a peer's lot carrying one refused whole) - and nothing else: a
// bound piece is still dropped, sold over a counter, stowed and spent, because each of those stays between the player
// and the game. The lock (LOCK1, itemLock.js) is the player's own word and closes more; the two never mix.
//
// Not a DFU member: Daggerfall has no other player to hand a piece to. Ledger A.
import { templateByIndex } from './itemTemplates.js';

/** Whether a piece is bound: its template row binds it. */
export const isBound = (/** @type {any} */ item) => templateByIndex(item?.templateIndex)?.bound === true;

/** The trade's refusal, in its own voice (tradePack.js tradeRefusal's other words). */
export const BOUND_TRADE_TEXT = 'Bound items cannot be traded.';

/** The card's line for a bound piece. */
export const BOUND_LINE = 'Bound - it cannot be traded.';
