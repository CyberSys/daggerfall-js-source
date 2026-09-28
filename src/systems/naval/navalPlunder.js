// @ts-check
// NAV-D (2026-09-28, Mac: "actual sailing ships to the world that players can encounter and pillage") - THE PRIZE:
// what a taken ship's hold gives up, and what her captor can make of her. The port's own; pure - the host draws the
// items through DFU's own loot tables (systems/loot.js generateItems, LootTables.GenerateRandomLoot).
//
// A HOLD IS LOTS. A ship carries one lot for each tier of its class's cargo (navalShips.js `cargo`, 1-4), each lot a
// draw of DFU's treasure tables under a key that fits her trade (HOLD_KEYS): a pirate's plunder is gold, jewels and
// arms ('S', 'E', 'Q'), a merchantman's cloth, spices and books ('Q', 'N', 'P', 'J'), a navy's its armoury ('T', 'F',
// 'J'). A flagship's last lot is the captain's strongbox - 'J', whatever her trade. The keys are drawn from the
// ship's seed, so the hold is the same whoever takes her.
//
// THE CAPTOR'S CHOICE is Black Flag's, in Daggerfall's words - one of:
//   Repair   - her timber and cordage to your own ship: REPAIR_SHARE of your hull and sails made good
//   Powder   - her powder and fire barrels: your barrels filled (navalShips.js BARREL.stock) and every battery loaded
//   Press    - her crew pressed to your guns: PRESS_SHARE of your crew's losses made good
// - and then her fate: SCUTTLE her (she sinks) or SET HER ADRIFT (she drifts, taken - no one takes her twice).
//
// FLOTSAM. A ship sunk rather than taken gives up FLOTSAM_OF her lots as casks afloat (navalShots.js dropFlotsam),
// each a lot of her hold; a boat that sails through one hauls it into its own cargo.

import { mulberry32 } from '../../combat/bloodArt.js';

export const HOLD_KEYS = Object.freeze({
  pirate: Object.freeze(['S', 'E', 'Q']),
  merchant: Object.freeze(['Q', 'N', 'P', 'J']),
  navy: Object.freeze(['T', 'F', 'J']),
});
/** The flagship's strongbox. */
export const STRONGBOX_KEY = 'J';
/** The captor's choices. @type {readonly ('repair'|'powder'|'press')[]} */
export const CHOICES = Object.freeze(['repair', 'powder', 'press']);
export const REPAIR_SHARE = 0.4;
export const PRESS_SHARE = 0.6;
/** The share of a sunk ship's lots that float free (at least one). */
export const FLOTSAM_OF = 0.5;
/**
 * The rarity tier a lot is rolled at (systems/lootRarity.js pileSource - the dungeon tiers' own scale, 3 a cemetery to
 * 18 a dragon's den): a merchantman's cargo a mine's (5), a pirate's plunder a human stronghold's (6), a navy's armoury
 * a giant's hold's (8), a flagship's strongbox a barbarian chief's (11).
 */
export const HOLD_RARITY_TIER = Object.freeze({ merchant: 5, pirate: 6, navy: 8 });
export const STRONGBOX_RARITY_TIER = 11;
/** A lot's rarity tier: its ship's trade's, or the strongbox's. */
export const holdTier = (shipClass, strongbox = false) => (strongbox ? STRONGBOX_RARITY_TIER : HOLD_RARITY_TIER[shipClass?.faction] ?? HOLD_RARITY_TIER.merchant);

/** The keys of a ship's hold, one a lot, from her seed. */
export function holdKeys(shipClass, seed) {
  const keys = HOLD_KEYS[shipClass.faction] ?? HOLD_KEYS.merchant;
  const rng = mulberry32((seed ^ 0x401d) >>> 0);
  const lots = Math.max(1, Math.min(4, shipClass.cargo | 0));
  const out = [];
  for (let i = 0; i < lots; i++) out.push(keys[Math.floor(rng() * keys.length) % keys.length]);
  if (shipClass.flagship) out[out.length - 1] = STRONGBOX_KEY;
  return out;
}

/** The lots that float free when she sinks: FLOTSAM_OF of them, at least one - the first of her keys. */
export function flotsamKeys(shipClass, seed) {
  const keys = holdKeys(shipClass, seed);
  return keys.slice(0, Math.max(1, Math.round(keys.length * FLOTSAM_OF)));
}

/**
 * The hold, drawn: every lot's items through `generate(key, tier)` (the host's DFU loot roll at the player's level,
 * its rarity at the lot's tier - `holdTier`), one list - what the loot window opens on.
 */
export function drawHold(shipClass, seed, generate) {
  const items = [];
  const keys = holdKeys(shipClass, seed);
  keys.forEach((key, i) => {
    const strongbox = !!shipClass.flagship && i === keys.length - 1;
    for (const it of generate(key, holdTier(shipClass, strongbox)) ?? []) items.push(it);
  });
  return items;
}

/**
 * What a choice does to the captor's ship: `{ repair?: { hull, sail }, barrels?: n, reload?: true, crew?: n }`.
 * @param {'repair'|'powder'|'press'} choice
 * @param {{ maxHull: number, hull: number, maxSail: number, sail: number, maxCrew: number, crew: number }} mine
 * @param {{ barrelStock?: number }} [armament]
 */
export function choiceEffect(choice, mine, { barrelStock = 0 } = {}) {
  if (choice === 'repair') return { repair: { hull: Math.round(mine.maxHull * REPAIR_SHARE), sail: Math.round(mine.maxSail * REPAIR_SHARE) } };
  if (choice === 'powder') return { barrels: barrelStock, reload: true };
  if (choice === 'press') return { crew: Math.ceil((mine.maxCrew - mine.crew) * PRESS_SHARE) };
  return {};
}

/** The three choices' names, as the plunder window says them. */
export const CHOICE_TITLES = Object.freeze({ repair: 'Timber and cordage', powder: 'Powder and shot', press: 'Press her crew' });

/**
 * A choice as the window offers it: `{ id, title, detail, useful }` - what it would make good on the captor's ship
 * NOW (the effect bounded by what is missing), and whether it would make anything good at all (a sound ship's timber,
 * a whole crew's pressed men, a loaded battery's powder are offered and refused - the tile stands, greyed, with why).
 * @param {'repair'|'powder'|'press'} choice
 * @param {{ maxHull: number, hull: number, maxSail: number, sail: number, maxCrew: number, crew: number }} mine
 * @param {{ barrelStock?: number, barrels?: number, barrelGuns?: boolean, loaded?: boolean }} [armament]
 */
export function choiceOffer(choice, mine, { barrelStock = 0, barrels = 0, barrelGuns = false, loaded = false } = {}) {
  const fx = choiceEffect(choice, mine, { barrelStock });
  const title = CHOICE_TITLES[choice] ?? choice;
  if (choice === 'repair') {
    const hull = Math.max(0, Math.min(fx.repair.hull, Math.round(mine.maxHull - mine.hull)));
    const sail = Math.max(0, Math.min(fx.repair.sail, Math.round(mine.maxSail - mine.sail)));
    const useful = hull > 0 || sail > 0;
    return { id: choice, title, useful, detail: useful ? `Mend ${[hull > 0 ? `${hull} of hull` : null, sail > 0 ? `${sail} of canvas` : null].filter(Boolean).join(' and ')}` : 'Your ship is sound' };
  }
  if (choice === 'powder') {
    const topUp = barrelGuns && barrels < barrelStock;
    const useful = !loaded || topUp;
    return { id: choice, title, useful, detail: useful ? `Every gun loaded${barrelGuns ? ` - fire barrels to ${barrelStock}` : ''}` : 'Your guns are loaded' };
  }
  if (choice === 'press') {
    const n = Math.max(0, fx.crew | 0);
    return { id: choice, title, useful: n > 0, detail: mine.maxCrew <= 0 ? 'No berths for them' : n > 0 ? `${n} ${n === 1 ? 'hand' : 'hands'} to your guns` : 'Your crew is whole' };
  }
  return { id: choice, title, useful: false, detail: '' };
}
