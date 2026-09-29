// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - THE NEW MATERIALS AS ITEMS: the ores
// (610-615), the ingots (620-630) and the stone (673-674), registered as
// custom templates in the professions' reserved range (PROF0 4.8, law
// 2), as the Sigil Stone (570, systems/gateSpoils.js) and Foraging's
// twelve (1600-1611) are. The rows are the law's (net/professionLaw.js
// ORES, INGOTS, STONES); this file only writes them in DFU's
// ItemTemplates.txt columns.
//
// REGISTERED AT IMPORT, AND IMPORTED BY THE SAVE (systems/save.js): an
// ingot withdrawn online rides the save like any item, and a save loaded
// in any scene - the fixed city, a standalone dungeon, offline - must
// still know what template 620 is, or the item has no name, no picture
// and no weight. (Offline nothing makes one: the Stores are online's.)
//
// THE PICTURE is DFU's own (law 6): an ore and stone Lodestone's lump
// (TEXTURE.254 record 66), an ingot Iron's bar (record 63) - recoloured
// by DFU's own law, GetItemImage's ChangeDye with the metal's DyeColor
// over the WeaponsAndArmor swatch (ItemHelper.cs:473-476; systems/
// itemTemplates.js inventoryItemImage reads `iconDye`), the way DFU tells
// an Ebony blade from an Iron one. A silver one is DFU's Silver, which
// is Unchanged, as a silver blade is.
//
// NEVER SHELVED, NEVER LOOT: rarity 10 and no custom-items-for-group
// registration, so a shop's shelf and a pile never mint one - the Stores
// are the one door (law 3).
// ═══════════════════════════════════════════════════════════════════
import { registerCustomTemplates, registerKitDye } from './itemTemplates.js';
import { DYE_COLORS } from '../characters/dyes.js';
import { ORES, INGOTS, STONES, TIER_VALUES } from '../net/professionLaw.js';
import { REPAIR_KIT_TEMPLATE } from '../net/recipeLaw.js';

/** The group every new material mints in: DFU's miscellany (UselessItems2), where Foraging's own items sit - not an
 *  ingredient group, so no maker takes one for an ingredient. */
export const PROF_ITEM_GROUP = 'UselessItems2';
/** Weights (kg): an ore as DFU's Iron (0.5), an ingot twice it, stone a heavy lump. */
const WEIGHT = Object.freeze({ ore: 0.5, ingot: 1, 'stone:rough': 3, 'stone:cut': 2.5 });
/** A gold price in DFU's metals' scale (Iron 6, Platinum 30): 8 x the tier's Marks value, an ingot two and a half
 *  times its ore's; stone the cheapest thing in a pack. */
const priceOf = (m) => (m.key === 'stone:rough' ? 2 : m.key === 'stone:cut' ? 5
  : Math.round(8 * TIER_VALUES[m.tier - 1] * (m.key.startsWith('ingot:') ? 2.5 : 1)));
const weightOf = (m) => WEIGHT[m.key] ?? (m.key.startsWith('ingot:') ? WEIGHT.ingot : WEIGHT.ore);

/** Every row, in DFU's columns and the port's two (`stackable`, `iconDye`). */
export const MINING_TEMPLATE_ROWS = Object.freeze([...ORES, ...INGOTS, ...STONES].map((m) => Object.freeze({
  index: m.templateIndex,
  name: m.name,
  baseWeight: weightOf(m),
  hitPoints: 50,
  capacityOrTarget: 0,
  basePrice: priceOf(m),
  enchantmentPoints: 0,
  rarity: 10,
  variants: 0,
  drawOrderOrEffect: 0,
  isBluntWeapon: false,
  isLiquid: false,
  isOneHanded: false,
  isIngredient: false,
  worldTextureArchive: m.icon[0],
  worldTextureRecord: m.icon[1],
  playerTextureArchive: 0,
  playerTextureRecord: 0,
  stackable: true,
  ...(m.dye ? { iconDye: DYE_COLORS[m.dye] } : {}),
})));
registerCustomTemplates(MINING_TEMPLATE_ROWS);

// ─── PROF3: THE REPAIR KIT (PROF0 4.8: 692, DFU's Warhammer picture) ───
/** The anvil's consumable (systems/smithItems.js): the Warhammer's own world picture (TEXTURE.214 record 3), dyed per
 *  kit by the metal it mends (`kitDye`: the item's `kitMetal`, DFU's DyeColor for that material). Not stackable - each
 *  kit is its own piece, its own provenance. */
export const REPAIR_KIT_ROW = Object.freeze({
  index: REPAIR_KIT_TEMPLATE, name: 'Repair Kit', baseWeight: 1.5, hitPoints: 1, capacityOrTarget: 0, basePrice: 20,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 214, worldTextureRecord: 3, playerTextureArchive: 0,
  playerTextureRecord: 0, stackable: false, kitDye: true,
});
registerCustomTemplates([REPAIR_KIT_ROW]);
/** DFU's metal names by material, the dye each kit takes. */
const KIT_DYES = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
/** A kit's dye, by the metal it mends, or null. */
export const kitDye = (item) => (Number.isInteger(item?.kitMetal) ? DYE_COLORS[KIT_DYES[item.kitMetal]] ?? null : null);
registerKitDye(kitDye);
