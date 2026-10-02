// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF9 (2026-10-02, Mac: "2 and 4" - Cooking, the first of the
// Apothecary's three) - A DISH IN THE PACK (bible/06-Systems/
// Professions-Arc.md 9.3, 35): the piece a craft at the fire mints, and
// what eating it does.
//
// THE PIECE. Template 685-688 (systems/profTemplates.js - a Climates &
// Calories food's row under its own name), DFU's miscellany, one a
// serving, its provenance the service's and its maker the cook; its
// COOK'S HAND the record's (recipeLaw dishHand): a Chef's feast lasts
// half again (`chef`), a Provisioner's dish never spoils (`noRot` -
// survival/food.js rotFoodDay). No quality: a dish's worth is its effect.
//
// EATING IT. A dish is food by C&C's own law (profTemplates.js
// registerFoods): with the arc on it is eaten by C&C's own eat
// (survival/items.js eatFood - imported, never typed again: the hunger
// it must meet, its stage, its sickness, its words), and refused as any
// meal is; with the arc off it is simply eaten. Eaten, its effect is
// laid on - DFU's own Fortify Attribute entries for the attributes
// (effects.js assignModBundle's bundle, a buff of the player's own), the
// port's own `dishStamina` for the Tart's stamina (scenes/shared.js
// fatigueLossMultiplierFor divides the drain by it) - for its minutes, in
// game minutes a magic round each. The same dish eaten again while it
// lasts RENEWS it, never stacks. A FEAST is the whole party's (9.3): the
// host's share door (setFeastShare - world.js, online) sends its spell
// record to every party mate at the table through ALLY-CAST's own frame
// (systems/allyCast.js allyCastFrame, at recipeLaw DISH_LEVEL), and the
// mate's client lays it on as a mate's gift - no relay change.
//
// C&C'S OWN COOKING STAYS C&C'S (9.3): a Raw Fish turned to Cooked Fish
// at a fire (scenes/camps.js openCook) is the mod's, untouched, and
// earns nothing - the service never sees it.
// ═══════════════════════════════════════════════════════════════════
import {
  recipeById, dishOf, dishMinutes, DISH_TEMPLATES, DISH_ICON, HAND_CHEF, HAND_PROVISIONER, PROVENANCE_RE, makerName, dishSpell,
} from '../net/recipeLaw.js';
import { setItemFields, mintCondition, registerItemUseHandler } from './itemTemplates.js';
import { eatFood } from './survival/items.js';
import { foodName } from './survival/food.js';
import { survivalOn, survivalRules } from './survival/switch.js';
import { SURVIVAL_RULES } from './survival/difficulty.js';
import { inflictDisease } from './diseases.js';
import { assignModBundle, removeBundleNamed } from './effects.js';
import { PROF_ITEM_GROUP } from './profTemplates.js';

/** The Tart's effect's kind (9.3: "stamina regained +20%"): the port's own - no DFU effect lengthens a stamina. */
export const DISH_STAMINA_KIND = 'dishStamina';
/** The Tart's +20%: a minute's stamina drain divided by this while it lasts. */
export const DISH_STAMINA_DIVISOR = 1.2;

/**
 * A DISH minted from a craft's answer (or a market's piece) - `{ recipe, maker, hand }` and its provenance - or null
 * for a recipe that is no dish. Fresh (C&C's stage 0), named its own.
 * @param {{ recipe: string, maker?: string|null, hand?: number|null }} made @param {string} provenance
 */
export function mintDish({ recipe, maker = null, hand = null }, provenance) {
  const r = recipeById(recipe);
  if (!r || r.kind !== 'dish' || typeof provenance !== 'string' || !PROVENANCE_RE.test(provenance)) return null;
  /** @type {any} */
  const item = mintCondition(setItemFields({ group: PROF_ITEM_GROUP, templateIndex: r.templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
  item.name = dishOf(r.id)?.name ?? item.name;
  item.recipe = r.id;
  item.provenance = provenance;
  const mark = makerName(maker);
  if (mark) item.maker = mark;
  if (hand === HAND_PROVISIONER) item.noRot = true;   // 3.3: a Provisioner's dish never spoils
  if (hand === HAND_CHEF && dishOf(r.id)?.effect.party === true) item.chef = true;   // 3.3: a Chef's feast lasts half again
  return item;
}
/** Whether an item is one of the dishes. */
export const isDish = (item) => !!item && DISH_TEMPLATES.includes(item.templateIndex) && recipeById(item.recipe)?.kind === 'dish';
/** The hand a minted dish carries, as recipeLaw counts it. */
export const handOfDish = (item) => (item?.chef === true ? HAND_CHEF : item?.noRot === true ? HAND_PROVISIONER : null);

/**
 * A DISH'S EFFECT LAID ON `entity` - renewed, never stacked (the same dish's bundle taken off first). The attributes as
 * DFU's own Fortify Attribute entries, one bundle (the HUD's buff row, the party card's - PARTY-BUFFS), each `minutes`
 * rounds with DFU's initial round run (assignModBundle - the shape applySpell gives a mate's copy of a feast); the Tart's
 * stamina as the port's own kind. Answers the bundle's entries.
 * @param {any} entity @param {any} d a recipeLaw DISHES row @param {number|null} [hand]
 */
export function feedEffect(entity, d, hand = null, rolls = Math.random) {
  if (!entity || !d) return [];
  while (removeBundleNamed(entity, d.name)) { /* every bundle of the dish's name - renewed, never stacked */ }
  const rounds = dishMinutes(d, hand);
  const stats = Object.entries(d.effect.stats ?? {});
  if (!stats.length) {
    const e = assignModBundle(entity, { name: d.name, kind: DISH_STAMINA_KIND, rounds, sinks: {}, rolls });
    e.bundleIcon = DISH_ICON;
    return [e];
  }
  const out = [];
  for (const [stat, magnitude] of stats) {
    if (!out.length) {
      const e = assignModBundle(entity, { name: d.name, kind: 'fortifyAttribute', rounds, sinks: {}, rolls });
      Object.assign(e, { stat, magnitude, bundleIcon: DISH_ICON });
      out.push(e);
      continue;
    }
    const first = out[0];
    // the bundle's next entry: its tags the first's, DFU's initial round taken as the first's was (effects.js pushActive)
    const e = { kind: 'fortifyAttribute', stat, magnitude, roundsRemaining: rounds - 1, bundleId: first.bundleId, bundleName: first.bundleName,
      bundleType: first.bundleType, bundleIcon: DISH_ICON, bundleSelfCast: true };
    (entity.activeEffects ??= []).push(e);
    out.push(e);
  }
  return out;
}
/** The Tart's stamina (scenes/shared.js fatigueLossMultiplierFor): a minute's drain's multiplier - 1 / 1.2 while a
 *  `dishStamina` entry stands, else 1. */
export const dishStaminaFactor = (entity) => ((entity?.activeEffects ?? []).some((a) => a.kind === DISH_STAMINA_KIND && !a.ended && a.roundsRemaining > 0) ? 1 / DISH_STAMINA_DIVISOR : 1);

/** The host's share of a feast with the party at the table (world.js, online): `(spell, name) => [names shared with]`. */
let _share = /** @type {((spell: any, name: string) => string[])|null} */ (null);
/** World.js registers it online; null takes it down (offline a feast is the eater's alone). */
export function setFeastShare(fn) { _share = typeof fn === 'function' ? fn : null; }
/** What eating a feast shared says: "The feast is shared with Ann and Bob." */
export function feastSharedLine(names) {
  const list = [...new Set((names ?? []).filter(Boolean))];
  if (!list.length) return null;
  return `The feast is shared with ${list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`}.`;
}

/**
 * A DISH USED from the pack (useItem.js's delegate arm): eaten by C&C's own law where the arc is on (its refusal its
 * own), simply eaten where it is off; its effect laid on; a feast shared with the party at the table. useItem's shape.
 * @param {any} item @param {any[]} collection @param {{ entity?: any, nowMinute?: number, rolls?: () => number }} [opts]
 */
export function dishUse(item, collection, { entity = null, nowMinute = 0, rolls = Math.random } = {}) {
  if (!isDish(item)) return null;
  const d = dishOf(item.recipe);
  if (!d) return null;
  let out;
  if (survivalOn()) {
    out = eatFood(item, collection, { entity, now: nowMinute, rolls, currentDay: Math.trunc(nowMinute / 1440), inflict: inflictDisease, rules: survivalRules() ?? SURVIVAL_RULES.casual });
    if (!out || out.kind !== 'ate') return out ?? { kind: 'none' };
  } else {
    const i = Array.isArray(collection) ? collection.indexOf(item) : -1;
    if (i >= 0) collection.splice(i, 1);
    out = { kind: 'ate', text: `You eat the ${foodName(item)}.` };
  }
  const hand = handOfDish(item);
  feedEffect(entity, d, hand, rolls);
  const lines = [out.text];
  if (d.effect.party === true) {
    const sp = dishSpell(d, hand);
    const line = feastSharedLine(sp && _share ? _share(sp, d.name) : []);
    if (line) lines.push(line);
  }
  return { ...out, text: lines.join(' '), dish: d.id };
}

/** Every host's install (scenes/shared.js): the dishes' use on the item-use door - offline as online, a dish is the
 *  pack's. */
export function installCooking() {
  for (const t of DISH_TEMPLATES) registerItemUseHandler(t, dishUse);
}
