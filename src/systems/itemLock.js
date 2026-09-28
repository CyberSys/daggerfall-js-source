// @ts-check
// LOCK1 (2026-09-26, the players: "A way to lock/favorite items"): A LOCKED PIECE STAYS YOURS.
//
// The lock is one flag on the item (`locked: true`, declared in systems/itemFields.js, so it rides the save and the
// wire as every other field does), set and cleared from the item's own card and its right-click menu. It closes
// the three ways out of the pack a slip can lose a piece for good - dropping it on the ground, selling it over a
// counter, holding it out in a trade - and nothing else: a locked piece is still worn, used, moved, stowed in the
// wagon or put in a chest, because each of those is a deliberate place and the piece is still the player's there.
// A refusal speaks (the windows say `lockedText`), so a locked piece never reads as a broken button.
//
// Not a DFU member: Daggerfall has no lock. Ledger A.

/** Whether a piece is locked. */
export const isLocked = (/** @type {any} */ item) => item?.locked === true;

/** Lock or unlock a piece; answers whether it could (an item record to write on). Unlocked is the field ABSENT, so
 *  a save of a pack with nothing locked carries not one extra byte. */
export function setLocked(/** @type {any} */ item, /** @type {boolean} */ on) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (on) item.locked = true;
  else delete item.locked;
  return true;
}

/** Flip a piece's lock; answers the lock it now has. */
export function toggleLocked(/** @type {any} */ item) {
  setLocked(item, !isLocked(item));
  return isLocked(item);
}

/** REALM P0.4 (2026-09-28, bible/06-Systems/Realm-Arc.md "Broker items are bound"): A BOUND PIECE IS ITS CHARACTER'S
 *  FOR GOOD. The Sigil Broker's stock is bound as it is bought (sigilBroker.js makeBrokerSale): the gate's stones buy
 *  gear to wear, not gold over a counter (a Regalia plate sold for 117,000 to 222,000) nor a gift to another player.
 *  The three ways a lock closes are closed, and no hand opens them; and a chest or a pile is refused too, since
 *  another player may open it (itemTransfer.js planStore) - the wagon is its own place. `bound: true`, declared in
 *  systems/itemFields.js; everywhere, since an offline sale's gold rides the same save online until phase 1. */
export const isBound = (/** @type {any} */ item) => item?.bound === true;

/** The ways out a lock closes, by the word each window asks with. */
export const LOCK_CLOSES = Object.freeze(['drop', 'sell', 'trade']);

/** Whether a lock - or a binding - refuses `way` for this piece. */
export const lockRefuses = (/** @type {any} */ item, /** @type {string} */ way) => (isLocked(item) || isBound(item)) && LOCK_CLOSES.includes(way);

/** A binding's refusal. */
export const boundText = (/** @type {string} */ name) => `${name || 'That'} is bound to you. It stays in your pack or wagon.`;

/** The refusal, in the windows' own voice - a bound piece's, when the piece is given and bound. */
export const lockedText = (/** @type {string} */ name, /** @type {any} */ item = null) => (isBound(item) ? boundText(name) : `${name || 'That'} is locked. Unlock it first.`);

/** The card's line for a locked piece. */
export const LOCKED_LINE = 'Locked - it will not be dropped, sold or traded.';
/** The card's line for a bound one. */
export const BOUND_LINE = 'Bound to you - it will not be dropped, sold, traded or stored.';
