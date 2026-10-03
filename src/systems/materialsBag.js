// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAG1 (2026-10-03) — THE MATERIALS BAG, IN THE SAVE: the bag the player
// buys at a General Store and the materials it carries, handled as DFU
// handles the wagon (systems/inventorySession.js, itemTransfer.js) - a
// second list beside the pack, `entity.bagItems`, with a weight it may
// not pass (bagLaw.js BAG_KG_LIMIT) - and what a harvest, a withdrawal
// or a station does with the items a material is
// (bible/06-Systems/Materials-Bag.md).
//
// THE BAG IS AN ITEM IN THE PACK, the way the Small Cart is (DFU's
// HasCart reads the cart's template in the pack): owning one is
// holding one. Its own list is the save's (systems/save.js), and a bag
// sold or dropped while it holds anything is refused - the cart's own
// rule (tradeModes.js), so nothing is ever left in a list nobody owns.
//
// ONLY MATERIALS GO IN IT: an item whose group and template are those a
// material mints as (profItems.js mintMaterialItem). The map from an
// item back to its material is BUILT BY MINTING every material once, so
// the bag's rule and the mint can never disagree about what an Oak Log
// is. DFU's own Red Rose looted off a corpse IS a Red Rose - it goes in
// the bag, and counts as held; the service's count (bagLaw.js) is what
// keeps a looted one from becoming a harvested one on the service.
//
// Pure where it can be: every function takes the entity it reads or
// writes; nothing here asks the network.
// ═══════════════════════════════════════════════════════════════════
import { BAG_KG_LIMIT, BAG_WORDS, CARRIED_MAX, hasBag, isBagItem } from '../net/bagLaw.js';
import { PLANT_GROUP_TEMPLATES, FOOD_KEYS, MINED_KEYS, withdrawable } from '../net/professionLaw.js';
import { material } from '../net/nodeLaw.js';
import { mintMaterialItem } from './profItems.js';
import { addItem, totalWeight, effectiveUnitWeightInKg, canHoldAmount, carriedWeight, isSummoned, isEnchanted } from './inventory.js';
import { entityMaxEncumbrance } from '../combat/formulas.js';

/** Whether a list (the pack) holds a Materials Bag, and whether a record is one - net/bagLaw.js's, the one spelling. */
export { hasBag, isBagItem };
/** The bag's list on an entity, made on demand as the wagon's is (`playerEntity.wagonItems ??= []`). */
export function bagItemsOf(entity) {
  if (!entity) return [];
  if (!Array.isArray(entity.bagItems)) entity.bagItems = [];
  return entity.bagItems;
}

/** Every key a material is kept under: the herbs of both groups, the Basket's foods, and every mined, cut, sawn,
 *  skinned or brewed row the law registers. */
export function materialKeys() {
  const herbs = Object.entries(PLANT_GROUP_TEMPLATES).flatMap(([g, list]) => list.map((t) => `${g}:${t}`));
  return [...herbs, ...FOOD_KEYS, ...MINED_KEYS].filter((k) => !!material(k));
}

/** @type {Map<string, string>|null} `group|templateIndex` -> the material key. */
let _byItem = null;
const itemKey = (it) => `${it?.group}|${it?.templateIndex}`;
/** THE MAP FROM AN ITEM TO ITS MATERIAL, built by minting each material - both ways a food mints (Climates & Calories
 *  on or off) - so it is the mint's own inverse. A key with no pack form (the Ram Kit, Arcane Essence) has none. */
function byItem() {
  if (_byItem) return _byItem;
  const m = new Map();
  for (const key of materialKeys()) {
    if (!withdrawable(key)) continue;
    for (const cc of key.startsWith('food:') ? [true, false] : [undefined]) {
      let it = null;
      try { it = mintMaterialItem(key, cc); } catch { it = null; }
      if (it && !m.has(itemKey(it))) m.set(itemKey(it), key);
    }
  }
  // a map built before every template registered would miss its rows forever: keep it only once it holds any
  if (m.size) _byItem = m;
  return m;
}
/** The material an item is, or null. A quest's item, a summoned one or one an enchantment marks is never a material:
 *  it is not what the mint makes. */
export function materialKeyOfItem(item) {
  if (!item || item.questItem || isSummoned(item) || item.equipSlot != null || isEnchanted(item)) return null;
  return byItem().get(itemKey(item)) ?? null;
}
export const isMaterialItem = (item) => materialKeyOfItem(item) != null;

/** How many units of a material the bag and the pack hold together - the `held` a carrying request says. */
export function heldOf(entity, key) {
  let n = 0;
  for (const list of [entity?.items ?? [], entity?.bagItems ?? []]) {
    for (const it of list) if (materialKeyOfItem(it) === key) n += it.stackCount ?? 1;
  }
  return n;
}

/** One unit's weight, in kg, as the pack weighs it. */
export function unitKgOf(key) {
  const it = mintMaterialItem(key);
  return it ? effectiveUnitWeightInKg(it) : 0;
}

/** What the bag weighs now, and what it may weigh. */
export const bagWeight = (entity) => totalWeight(entity?.bagItems ?? []);
/** How many more units of a material fit - in the bag (if the pack holds one) and then the pack, by DFU's own
 *  integer law (inventory.js canHoldAmount), never past the service's count's bound. */
export function roomFor(entity, key) {
  const kg = unitKgOf(key);
  const inBag = hasBag(entity?.items) ? Math.max(0, canHoldAmount(CARRIED_MAX, kg, BAG_KG_LIMIT, bagWeight(entity))) : 0;
  const inPack = Math.max(0, canHoldAmount(CARRIED_MAX, kg, entityMaxEncumbrance(entity), carriedWeight(entity)));
  return Math.min(CARRIED_MAX, inBag + inPack);
}

/**
 * THE SERVICE'S UNITS, MINTED WHERE THEY GO: `n` items of a material into the bag first - as many as its weight allows,
 * while the pack holds a bag - then the pack, as many as the carry allows. Each is DFU's AddItem (a stack joins its
 * stack). `{ bag, pack, left }`: how many went where, and how many found no room (the host says they were left).
 * `slowRot` / `noRot` as profItems.js withdrawIntoPack's.
 * @param {any} entity @param {string} key @param {number} n
 * @param {{ cc?: boolean, slowRot?: boolean, noRot?: boolean }} [opts]
 */
export function mintCarried(entity, key, n, { cc, slowRot = false, noRot = false } = {}) {
  const out = { bag: 0, pack: 0, left: 0 };
  if (!entity || !Number.isSafeInteger(n) || n < 1) return out;
  if (!Array.isArray(entity.items)) entity.items = [];
  const kg = unitKgOf(key);
  for (let i = 0; i < n; i++) {
    const item = mintMaterialItem(key, cc);
    if (!item) { out.left += n - i; break; }
    if (slowRot === true) item.slowRot = true;
    if (noRot === true && key.startsWith('food:')) item.noRot = true;
    if (hasBag(entity.items) && canHoldAmount(1, kg, BAG_KG_LIMIT, bagWeight(entity)) >= 1) { addItem(bagItemsOf(entity), item, 'back'); out.bag++; continue; }
    if (canHoldAmount(1, kg, entityMaxEncumbrance(entity), carriedWeight(entity)) >= 1) { addItem(entity.items, item, 'back'); out.pack++; continue; }
    out.left++;
  }
  return out;
}

/**
 * THE ITEMS A DEPOSIT TAKES: `n` units of a material out of the bag first, then the pack - whole stacks and a split of
 * the last - answered as `{ taken, back }`: how many came out, and the undo that puts each back where it was (a refusal
 * gives them back). Never a quest's, a summoned or a worn one (materialKeyOfItem).
 * @param {any} entity @param {string} key @param {number} n
 */
export function takeCarried(entity, key, n) {
  /** @type {{ list: any[], item: any, count: number, whole: boolean }[]} */
  const moves = [];
  let left = Math.max(0, n | 0);
  for (const list of [bagItemsOf(entity), entity?.items ?? []]) {
    for (let i = list.length - 1; i >= 0 && left > 0; i--) {
      const it = list[i];
      if (materialKeyOfItem(it) !== key) continue;
      const count = it.stackCount ?? 1;
      const take = Math.min(left, count);
      if (take === count) { list.splice(i, 1); moves.push({ list, item: it, count, whole: true }); } else { it.stackCount = count - take; moves.push({ list, item: it, count: take, whole: false }); }
      left -= take;
    }
  }
  const taken = moves.reduce((a, m) => a + m.count, 0);
  const back = () => {
    for (const m of moves.reverse()) {
      if (m.whole) addItem(m.list, m.item, 'back');
      else m.item.stackCount = (m.item.stackCount ?? 1) + m.count;
    }
    moves.length = 0;
  };
  return { taken, back };
}

/** THE BAG'S OWN RULE, ahead of the wagon's capacity ladder: only a material goes in it. Null - the ladder decides. */
export function bagStoreRefusal(item) {
  return isMaterialItem(item) ? null : { reason: 'bagOnlyMaterials', text: BAG_WORDS.onlyMaterials };
}

/** Whether a bag may leave the pack - sold, dropped, given: only when it holds nothing, the cart's own rule. */
export const bagMayLeave = (entity) => !(entity?.bagItems?.length > 0);
