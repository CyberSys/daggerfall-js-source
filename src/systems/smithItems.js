// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF3 (2026-09-28, Mac: "Lets keep moving") - THE PIECE A CRAFT MADE
// (bible/06-Systems/Professions-Arc.md 9.2, 24): minted as DFU mints
// it and the quality laid on it after.
//
// DFU'S OWN ITEM FIRST. A weapon is ItemBuilder.CreateWeapon's
// (combat/enemyEquipment.js weaponOfMaterial - its material's value and
// condition), a piece of armour CreateArmor's (armorOfMaterial - plate
// 0x0200 + the metal, chain 0x0100), a tool Foraging's own mint
// (foragingInstall.js createForagingItem). THEN THE QUALITY: the
// condition's and the weight's multipliers, and for a Superior and a
// Masterwork one Loot Rarity roll (lootRarity.js applyRarity), rolled
// off the product record's seed so the piece is the record's on every
// client; a Masterwork takes the maker's mark for its name
// (itemInfo.js itemNameParts). A tool's quality is its life.
//
// THE PIECE CARRIES `quality`, `provenance` and `maker` (itemFields.js),
// riding the save as Loot Rarity's `rarity` does; the signed record is
// the service's (`products`), the id the piece's.
//
// THE REPAIR KIT (692): the anvil's consumable - a quarter of an item's
// condition, once, on the most-worn weapon or armour of its metal the
// pack holds. Its row is registered with the ores and ingots
// (profTemplates.js), so any scene the save loads in knows it.
//
// PROF4 (2026-09-28, Mac: "Continue"; Professions-Arc.md 25): AND THE
// WORKBENCH'S. A staff or a bow is DFU's weapon at its wood's material,
// its quality the smith's weapons'; arrows are CreateWeapon's arrow arm
// at twenty, no quality and no provenance (DFU mints a quiver at
// condition 0, one stack - a mark would split it); furniture is DFU's
// Furniture template, its quality its worth (the condition's multiplier
// on its value, never a Loot Rarity roll), the mark on a Masterwork and
// on every piece a Master Joiner makes (`marked`); the Basket Foraging's
// own, its quality its life.
// ═══════════════════════════════════════════════════════════════════
import {
  recipeById, QUALITY_EFFECTS, TOOL_LIFE, MASTERWORK, REPAIR_KIT_TEMPLATE, KIT_REPAIR, FIELD_KIT_REPAIR, INGOT_MATERIAL, ARMOR_PLATE,
  ARMOR_CHAIN, PROVENANCE_RE, makerName, QUALITY_NAMES,
} from '../net/recipeLaw.js';
import { minedMaterial } from '../net/professionLaw.js';
import { weaponOfMaterial, armorOfMaterial, createWeapon } from '../combat/enemyEquipment.js';
import { setItemFields, mintCondition, templateByIndex, registerItemUseHandler } from './itemTemplates.js';
import { registerTabledLootHandler, registerEnemyLootExtra } from './loot.js';   // REPAIR-EASE: the field kit's two loot doors
import { itemLongName } from './itemInfo.js';
import './profTemplates.js';   // the Repair Kit's row (692), registered with the ores and ingots
import { applyRarity, rarityEligible, RARE_FLAVOURS } from './lootRarity.js';
import { unitWeightInKg } from './inventory.js';
import { seededRng } from './wind.js';
import { createForagingItem } from './foragingInstall.js';

/** DFU's metal names by material (itemInfo.js MATERIAL_NAMES' first ten) - a kit's word and its dye. */
const METALS = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);

/** A kit's worth: 10 gold and 10 a tier of its metal. */
const kitValue = (tier) => 10 + 10 * tier;

// ─── THE PIECE ───────────────────────────────────────────────────────

/**
 * One piece of a craft's answer - `{ recipe, quality, seed, maker, marked }` and the piece's `provenance` - as the pack
 * (or, furniture, the home's things) holds it, or null for a recipe this client does not know.
 * @param {{ recipe: string, quality: number, seed: number, maker?: string|null, marked?: boolean }} made
 * @param {string} provenance
 */
export function mintPiece({ recipe, quality, seed, maker = null, marked = false }, provenance) {
  const r = recipeById(recipe);
  if (!r || typeof provenance !== 'string' || !PROVENANCE_RE.test(provenance)) return null;
  const mark = makerName(maker);
  if (r.kind === 'siege') return null;   // PROF4: the Ram Kit is the Stores' (and made with the sieges)
  if (r.kind === 'arrows') {
    // PROF4: CreateWeapon's arrow arm (combat/enemyEquipment.js), the stack the recipe's - no quality, no provenance
    const arrows = createWeapon(r.templateIndex, 0, () => 0);
    arrows.stackCount = r.stack ?? 1;
    return arrows;
  }
  /** @type {any} */
  let item;
  if (r.kind === 'kit') {
    const m = INGOT_MATERIAL[r.metal];
    item = mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: REPAIR_KIT_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
    item.name = `${METALS[m]} Repair Kit`;
    item.kitMetal = m;
    item.value = kitValue(minedMaterial(r.metal).tier);
    item.recipe = r.id;   // AUDIT 31 H3: the recipe it was minted of, read before any look-alike's
    item.provenance = provenance;
    if (mark) item.maker = mark;
    return item;
  }
  const q = Math.max(0, Math.min(MASTERWORK, quality | 0));
  if (r.kind === 'furniture') {
    // PROF4: DFU's Furniture template (the furnisher's own mint, systems/shopStock.js), its quality its worth
    item = mintCondition(setItemFields({ group: 'Furniture', templateIndex: r.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
    const base = templateByIndex(r.templateIndex);
    item.value = Math.max(1, Math.round((base?.basePrice ?? item.value ?? 1) * QUALITY_EFFECTS[q].condition));
    if (base?.name) item.name = base.name;
    item.quality = q;
    item.recipe = r.id;
    item.provenance = provenance;
    if (mark) item.maker = mark;
    if (marked === true && q !== MASTERWORK) item.marked = true;   // a Master Joiner's (a Masterwork's mark is its own)
    return item;
  }
  if (r.kind === 'tool') {
    item = createForagingItem(r.templateIndex);
    if (!item) return null;
    item.maxCondition = item.currentCondition = TOOL_LIFE[q];   // FORAGE0 14.7: a tool's quality is its life
  } else {
    item = r.kind === 'weapon' || r.kind === 'staff' || r.kind === 'bow' ? weaponOfMaterial(r.templateIndex, r.material) : armorOfMaterial(r.templateIndex, r.material);   // PROF4: a staff's or a bow's material its wood's
    const eff = QUALITY_EFFECTS[q];
    if (eff.rarity && rarityEligible(item)) { applyRarity(item, eff.rarity, seededRng(seed >>> 0)); item.isIdentified = true; }
    item.maxCondition = item.currentCondition = Math.max(1, Math.round(item.maxCondition * eff.condition));
    if (eff.weight !== 1) item.weightInKg = Math.round(unitWeightInKg({ ...item, weightInKg: undefined }) * eff.weight * 100) / 100;
    if (q === MASTERWORK && mark) item.name = templateByIndex(r.templateIndex)?.name ?? item.name;   // the mark is its name (itemNameParts)
  }
  item.quality = q;
  item.recipe = r.id;   // AUDIT 31 H3: an Ebony and a Warforged piece mint the same template and material
  item.provenance = provenance;
  if (mark) item.maker = mark;
  return item;
}

/**
 * AUDIT 30 C2: whether a piece is still what its record mints - no enchantment but its quality's roll (a Rare's one
 * flavour, of its group's), none written by the item maker (DFU's own door writes over `enchantments`). What crosses the
 * market is minted again from its record at the other end, so a piece enchanted since would lose what it was paid for.
 * @param {any} item
 */
export function asMinted(item) {
  if (!item?.provenance || item.legendary || item.customEnchantments?.length) return false;
  const e = item.enchantments ?? [];
  if (item.rarity !== 'rare') return e.length === 0;
  const roll = RARE_FLAVOURS[item.group] ?? RARE_FLAVOURS.Jewellery;
  return e.length === 1 && roll.some((f) => f.type === e[0]?.type && f.param === e[0]?.param);
}

/** Every piece of a craft's answer, minted - two of a Quartermaster's kit. @param {any} data */
export const mintPieces = (data) => (data?.pieces ?? []).map((p) => mintPiece(data, p.provenance)).filter(Boolean);

/** PROF6 (Professions-Arc 28): whether a crafted piece is of a recipe - DFU's group, template and material (a kit's
 *  metal) as the recipe mints them - so the Work tab offers a commission only the pieces that answer it (the service
 *  asks the piece's own record: writs.js fulfilCommission). */
export function pieceOfRecipe(item, recipeId) {
  if (typeof item?.recipe === 'string') return item.recipe === recipeId;   // AUDIT 31 H3: its own record's, where it keeps one
  const s = mintPiece({ recipe: recipeId, quality: 1, seed: 0 }, '0000000000000000');
  if (!s || !item) return false;
  return item.group === s.group && item.templateIndex === s.templateIndex && (item.material ?? 0) === (s.material ?? 0)
    && (item.kitMetal ?? null) === (s.kitMetal ?? null);
}
/** PROF4: whether a minted piece is furniture - the home's things (DECOR2b's furnishings), never the pack. */
export const isCraftedFurniture = (item) => item?.group === 'Furniture';

// ─── THE REPAIR KIT'S USE ────────────────────────────────────────────

/** Whether a kit of metal `m` mends an item: a weapon of the metal, a plate piece of it, and Steel's the chain too. */
export function kitMends(m, item) {
  if (m === FIELD_KIT && item?.maxCondition > 0) return item.group === 'Weapons' || item.group === 'Armor';   // REPAIR-EASE: any metal
  if (!item || !Number.isInteger(m) || !(item.maxCondition > 0)) return false;
  if (item.group === 'Weapons') return item.material === m;
  if (item.group === 'Armor') return item.material === ARMOR_PLATE + m || (m === 1 && item.material === ARMOR_CHAIN);
  return false;
}
/**
 * A KIT USED (PROF0 9.3: "repairs 25% of an item's condition, once"): the most-worn item of its metal the list holds - the
 * lowest share of its condition left, an equipped one first on a tie - mended by a quarter of its condition, never past
 * whole; the kit spent. Answers the item mended and its share before and after, or null when nothing of the metal wants
 * mending (the kit kept).
 * @param {any} kit
 * @param {any[]} items
 */
export function useRepairKit(kit, items) {
  if (!kit || kit.templateIndex !== REPAIR_KIT_TEMPLATE || !Array.isArray(items)) return null;
  const metal = kit.fieldKit === true ? FIELD_KIT : kit.kitMetal;   // REPAIR-EASE: a field kit mends any metal, by less
  const want = items.filter((it) => it !== kit && kitMends(metal, it) && it.currentCondition < it.maxCondition);
  if (!want.length) return null;
  const share = (it) => it.currentCondition / it.maxCondition;
  want.sort((a, b) => share(a) - share(b) || (b.equipSlot != null ? 1 : 0) - (a.equipSlot != null ? 1 : 0));
  const it = want[0];
  const before = share(it);
  it.currentCondition = Math.min(it.maxCondition, it.currentCondition + Math.ceil(it.maxCondition * (kit.fieldKit === true ? FIELD_KIT_REPAIR : KIT_REPAIR)));
  const i = items.indexOf(kit);
  if (i >= 0) items.splice(i, 1);
  return { item: it, before, after: share(it) };
}
/** The kit's metal's word, for its refusal ("Nothing of Mithril here wants mending."). */
export const kitMetalName = (kit) => METALS[kit?.kitMetal] ?? 'its metal';

/** A kit used from the pack (useItem.js's delegate arm): the most-worn piece of its metal mended, or the kit kept and
 *  said so. Offline as online - a kit is the pack's, and mending asks no service. */
export function repairKitUse(item, collection) {
  const done = useRepairKit(item, collection);
  if (!done) return { kind: 'repairKit', text: item?.fieldKit === true ? 'Nothing here wants mending.' : `Nothing of ${kitMetalName(item)} here wants mending.` };   // REPAIR-EASE
  // AUDIT 30 C8: a marked piece's name is its maker's - "Silverthorn's Longsword", never "The Silverthorn's"
  const long = itemLongName(done.item);
  const named = typeof done.item.maker === 'string' && long.startsWith(`${done.item.maker}'s `);
  return { kind: 'repairKit', text: `${named ? long : `The ${long}`} is mended: ${Math.round(done.before * 100)}% to ${Math.round(done.after * 100)}%.` };
}
/** REPAIR-EASE: the field kit's `metal` in kitMends - any weapon or armour. */
export const FIELD_KIT = 'any';
/** REPAIR-EASE: the chance, in percent, a dungeon pile (keys J-O, where DFU's own map and potion roll) holds a field
 *  kit, and a foe with a loot table carries one. */
export const FIELD_KIT_PILE_CHANCE = 6;
export const FIELD_KIT_ENEMY_CHANCE = 3;
/** REPAIR-EASE: a Field Repair Kit - the Repair Kit's template and picture, undyed, worth 15 gold. */
export function mintFieldRepairKit() {
  const item = mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: REPAIR_KIT_TEMPLATE, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  item.name = 'Field Repair Kit';
  item.fieldKit = true;
  item.value = 15;
  return item;
}
/** REPAIR-EASE: one roll of `pct` percent, and a field kit into `items` on a hit. Answers whether one was added. */
export function maybeAddFieldKit(items, pct, rolls = Math.random) {
  if (!Array.isArray(items) || !(rolls() * 100 < pct)) return false;
  items.push(mintFieldRepairKit());
  return true;
}
/** Every host's install (scenes/shared.js): the Repair Kit's use on the item-use door; REPAIR-EASE: and the field kit
 *  into the loot - a J-O pile on LootTables.OnLootSpawned, a looting foe on the enemy-extras hook. */
export function installSmithing() {
  registerItemUseHandler(REPAIR_KIT_TEMPLATE, repairKitUse);
  registerTabledLootHandler('field-repair-kit', ({ key, items, rolls }) => {
    const i = typeof key === 'string' ? key.charCodeAt(0) - 64 : 0;
    if (i >= 10 && i <= 15) maybeAddFieldKit(items, FIELD_KIT_PILE_CHANCE, rolls);
  });
  registerEnemyLootExtra('field-repair-kit', ({ items, rolls }) => maybeAddFieldKit(items, FIELD_KIT_ENEMY_CHANCE, rolls));
}

/** What a craft says it made: "You made a Fine Mithril Longsword." - "two Mithril Repair Kits" for a Quartermaster's;
 *  PROF4: "20 Arrows"; a table waits among the home's things. */
export function craftedText(pieces) {
  if (!pieces.length) return 'You made nothing.';
  const it = pieces[0];
  if ((it.stackCount ?? 1) > 1) return `You made ${it.stackCount} ${itemLongName(it)}s`;
  const name = itemLongName(it);
  // a piece whose name is its maker's mark ("Silverthorn's Mithril Longsword") takes no article and no quality word -
  // PROF4 found PROF3 saying "an Silverthorn's..." whenever the maker's name began with a vowel
  const marked = typeof it.maker === 'string' && it.maker && (it.quality === MASTERWORK || it.marked === true);
  const word = !marked && Number.isInteger(it.quality) && !Number.isInteger(it.kitMetal) ? `${QUALITY_NAMES[it.quality]} ` : '';
  const one = marked ? name : `${/^[AEIOU]/.test(word || name) ? 'an' : 'a'} ${word}${name}`;
  if (isCraftedFurniture(it)) return `You made ${one} - it waits among your things for a room to stand in`;
  return pieces.length > 1 ? `You made ${pieces.length} ${name}s` : `You made ${one}`;
}
/** What a craft whose answer did not come says: kept, and made when it does. */
export const CRAFT_KEPT_TEXT = 'The anvil rang, but no word came back - the work is kept, and made when the word comes.';
/** AUDIT 30 A4: the workbench's own (Carpentry's work is planed, not struck). */
export const BENCH_KEPT_TEXT = 'The shavings fell, but no word came back - the work is kept, and made when the word comes.';
