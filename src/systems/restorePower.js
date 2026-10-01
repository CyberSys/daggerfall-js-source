// @ts-check
// MANA-SHOP (FIELD BUGS 2026-10-01 #6: "Potions are durability. Mages could basically kill for free. Potions makes
// them cost to use magic. Gold sink same as repairs for melee"; Mac chose "Everywhere, 1 g/point"): ONLINE, RESTORE
// POWER IS THE MAGE'S REPAIR BILL.
//
// MANA-HALF (systems/rest.js) stops a rest at half the pool online; this is the other half. Restore Power is the one
// potion that gives magicka back (HealSpellPoints, 5 + 4 a level - potions.js), and before this it was all but out of
// reach: only temples and the Dark Brotherhood sold potions, to members, one random recipe of twenty a slot, a
// quality's handful a day - and at a flat price, so its gold a point fell as its drinker rose (5 at level 1, 0.5 at
// 20). Online:
//   - THE PRICE is what the potion restores at the buyer's level, a gold a point (RESTORE_POWER_GOLD_PER_POINT), before
//     the haggle - 9 at level 1, 45 at 10, 85 at 20. It replaces the shop's quality multiplier and ESSENTIALS-HALF for
//     this potion; a holiday's half still lands. A SALE reads the same cost (tradeModes.js), so REALM P0.4's half
//     keeps buying to sell back from paying.
//   - THE SUPPLY: every alchemist's shelf carries RESTORE_POWER_SHELF of them every day (shopStock.js stockShopShelf),
//     and the Mages Guild's magic-items counter sells them to anyone - its own magic shelf to a member of rank 3 and
//     up, the potions alone to everyone else (scenes/worldModes.js).
// Offline, Daggerfall's price and Daggerfall's shelves. Not a DFU member: Ledger A.
import { POTION_RECIPES, potionRecipeKey, potionBundle } from './potions.js';
import { rollMagnitude } from './spellcast.js';
import { createPotion } from './loot.js';
import { isPotion } from './useItem.js';
import { isOnlinePage } from './onlineLane.js';

const RECIPE = /** @type {any} */ (POTION_RECIPES.find((/** @type {any} */ r) => r.name === 'restorePower'));
/** Restore Power's recipe key - the cauldron's hash of its four ingredients, as every bottle of it carries. */
export const RESTORE_POWER_KEY = potionRecipeKey(RECIPE?.ingredients);
/** MANA-SHOP: the gold a point of magicka costs online, before the haggle. */
export const RESTORE_POWER_GOLD_PER_POINT = 1;
/** MANA-SHOP: how many an alchemist's shelf carries online, every day. */
export const RESTORE_POWER_SHELF = 20;

/** Whether a piece is a bottle of Restore Power. */
export const isRestorePower = (/** @type {any} */ item) => isPotion(item) && item.potionRecipeKey === RESTORE_POWER_KEY;

/** What one bottle restores to a drinker of `level` - the drink's own law (hostMagic.js drinkPotion: the bundle at
 *  the drinker's effective level), read at its low end; Restore Power's ranges are a single number. */
export function restorePowerMagnitude(/** @type {number} */ level) {
  const effect = potionBundle(RESTORE_POWER_KEY)?.effects?.[0];
  if (!effect) return 0;
  return rollMagnitude(effect, Math.max(1, Math.trunc(level) || 1), () => 0);
}

/** MANA-SHOP: one bottle's cost at a counter online, before the haggle - what it restores at `level`, a gold a point
 *  (at least a gold). Null where the law does not stand: offline, a piece that is not Restore Power, or no level to
 *  price by - the counter's own cost then stands. */
export function restorePowerCost(/** @type {any} */ item, /** @type {number | null | undefined} */ level, { online = isOnlinePage() } = {}) {
  if (!online || !isRestorePower(item) || !(Number(level) >= 1)) return null;
  return Math.max(1, Math.round(restorePowerMagnitude(Number(level)) * RESTORE_POWER_GOLD_PER_POINT));
}

/** MANA-SHOP: a stack of `count` bottles, as the shelf mints one. */
export function restorePowerStack(count = RESTORE_POWER_SHELF) {
  const potion = createPotion(RESTORE_POWER_KEY);
  potion.stackCount = Math.max(1, Math.trunc(count) || 1);
  return potion;
}

/** MANA-SHOP: the Mages Guild's counter that sells Restore Power online - its magic-items merchant (MG_BuyMagicItems,
 *  the only Mages Guild service that hands over goods). A member of rank 3 and up sees the potions on its magic shelf;
 *  anyone else, member or not, is sold the potions alone where Daggerfall answers "members only" or 3100. */
export const MAGES_MANA_SERVICE = 'BuyMagicItems';
export const magesSellRestorePower = (/** @type {any} */ guild, /** @type {string} */ service, { online = isOnlinePage() } = {}) =>
  online && guild?.name === 'MagesGuild' && service === MAGES_MANA_SERVICE;
