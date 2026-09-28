// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - A STORES MATERIAL AS DFU'S OWN
// ITEM: its name, and the items a withdrawal mints into the pack
// (bible/06-Systems/Professions-Arc.md 7, 22; law 3 - the Stores are
// one way: nothing here puts an item back in).
//
// AN HERB is a plant template in its group - PlantIngredients1 or 2, as
// the material key says (net/professionLaw.js) - minted exactly as DFU's
// loot mints one (itemTemplates.js setItemFields + mintCondition), so it
// is the northern or southern plant DFU names and DFU's potion maker
// takes by its template (systems/potions.js - the done-when: "An herb
// picked online reaches DFU's potion maker by the pack").
//
// A BASKET FOOD becomes, when it is withdrawn, the template Foraging's
// own code would make at that moment (FORAGE0 14.6): Climates &
// Calories' Apple and Orange while C&C is on, else Foraging's; the
// Mushroom and the Egg Foraging's always - foragingInstall.js
// createForagingItem, the mod's own mint.
//
// PROF2: A METAL OR A GEM is DFU's own item in its own group
// (MetalIngredients, Gems), minted as the herbs are; an ORE, an INGOT or
// STONE is its registered template (systems/profTemplates.js, 610-674) in
// DFU's miscellany - the item DFU's own ItemCollection would hold for it.
// ═══════════════════════════════════════════════════════════════════
import { material } from '../net/nodeLaw.js';
import { minedMaterial } from '../net/professionLaw.js';
import { setItemFields, mintCondition, templateByIndex } from './itemTemplates.js';
import { addItem } from './inventory.js';
import { itemNameParts } from './itemInfo.js';
import { FT, fruitTemplate } from './foragingLaw.js';
import { createForagingItem } from './foragingInstall.js';
import { survivalOn } from './survival/switch.js';
import { PROF_ITEM_GROUP } from './profTemplates.js';   // PROF2: the ores', ingots' and stone's group (and their rows, registered)

/** The template a food key withdraws as, C&C on or off. */
export function foodTemplate(key, cc) {
  if (key === 'food:apple') return fruitTemplate('Apple', cc);
  if (key === 'food:orange') return fruitTemplate('Orange', cc);
  if (key === 'food:mushroom') return FT.Mushroom;
  if (key === 'food:egg') return FT.Egg;
  return null;
}

/** One item of a material, as DFU (or Foraging) mints it - or null for a key the Stores never hold. */
export function mintMaterialItem(key, cc = survivalOn()) {
  const m = material(key);
  if (!m) return null;
  if (m.family === 'herbs' || m.group) {   // an herb, and PROF2's DFU metals and gems: DFU's own item in its own group
    return mintCondition(setItemFields({ group: m.group, templateIndex: m.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  }
  if (m.family === 'food') { const t = foodTemplate(key, cc); return t ? createForagingItem(t) : null; }
  if (!templateByIndex(m.templateIndex)) return null;   // a template not registered (Charcoal, before Logging) mints nothing
  return mintCondition(setItemFields({ group: PROF_ITEM_GROUP, templateIndex: m.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
}

/** A material's name as the Stores tab and the toasts say it: DFU's own ("Red Rose", "Twigs (northern)"), the Basket's
 *  food as the template it would withdraw as now. */
export function materialLabel(key, cc = survivalOn()) {
  const m = material(key);
  if (!m) return String(key ?? '');
  if (m.family === 'herbs') return itemNameParts({ group: m.group, templateIndex: m.templateIndex }).name;
  if (m.family === 'food') { const t = foodTemplate(key, cc); return templateByIndex(t)?.name ?? String(key); }
  return templateByIndex(m.templateIndex)?.name ?? minedMaterial(key)?.name ?? String(key);   // PROF2: DFU's name, or the row's
}

/** "Red Roses (northern)": a name's plural for a count, the group's word kept at the end. English's few irregulars
 *  the plants and foods carry are named; the rest take an s. */
const PLURAL_SAME = Object.freeze(['Twigs', 'Green Leaves', 'Root Tendrils', 'Green Berries', 'Red Berries', 'Yellow Berries', 'Red Flowers', 'Yellow Flowers', 'Ginkgo Leaves', 'Bamboo', 'Clover', 'Aloe',
  // PROF2: the metals and the matter the ground gives are counted as mass ("30 Iron", "12 Mithril Ore", "40 Rough Stone")
  'Mercury', 'Tin', 'Brass', 'Lodestone', 'Sulphur', 'Lead', 'Iron', 'Copper', 'Silver', 'Gold', 'Platinum',
  'Moonstone Ore', 'Dwarven Scrap', 'Mithril Ore', 'Adamantium Ore', 'Ebony Ore', 'Orichalcum Ore', 'Rough Stone', 'Cut Stone', 'Charcoal',
  'Jade', 'Turquoise', 'Malachite', 'Amber']);
const PLURAL_OF = Object.freeze({ Cactus: 'Cacti', 'Pine Branch': 'Pine Branches', Ruby: 'Rubies' });
export function materialCountLabel(key, n, cc = survivalOn()) {
  const full = materialLabel(key, cc);
  if (n === 1) return full;
  const m = /^(.*?)( \((?:northern|southern)\))?$/.exec(full);
  const base = m?.[1] ?? full;
  const tail = m?.[2] ?? '';
  const plural = PLURAL_OF[base] ?? (PLURAL_SAME.includes(base) ? base : `${base}s`);
  return `${plural}${tail}`;
}

/**
 * WITHDRAWN INTO THE PACK: `n` items of the material, each added as DFU's AddItem adds (a stackable one joins its
 * stack). Answers how many were added.
 * @param {{ items?: any[] }} entity
 */
export function withdrawIntoPack(entity, key, n, cc = survivalOn()) {
  if (!entity || !Number.isSafeInteger(n) || n < 1) return 0;
  if (!Array.isArray(entity.items)) entity.items = [];
  let added = 0;
  for (let i = 0; i < n; i++) {
    const item = mintMaterialItem(key, cc);
    if (!item) break;
    addItem(entity.items, item, 'back');
    added++;
  }
  return added;
}
