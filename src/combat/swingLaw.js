// @ts-check
// SWING-LAW (2026-09-28, Mac: "swing speed is insane", then "Do whatever is the most detailed. I dont care about departure,
// especially if we can do it better"): THE WEAPON IN THE HAND, AS THE SWING LAW READS IT. characters/weaponStates.js holds
// the law (swingFrameSeconds - the tempo of the wielder's Speed, the heft of the weapon's weight against their Strength,
// the handling of its kind) and is a leaf, so what it needs of the player is read here and registered: the held item
// off the equip table - the hand the swing is in (`ctx.usingRightHand`, AUDIT-RR F1's ctx) - its template's base weight
// and whether it takes both hands, and the live Strength. Bare hands and a beast's claws weigh nothing.
//
// Not a DFU member. Ledger A (SWING-LAW).
import { registerSwingReader } from '../characters/weaponStates.js';
import { WEAPON_TYPES } from './fpsWeapon.js';
import { equipTableOf, EQUIP_SLOTS } from '../systems/equip.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { liveStat } from '../systems/statMods.js';

/**
 * What the swing law reads of a swing's wielder, or null without one.
 * @param {{entity?: any, weaponType?: number, usingRightHand?: boolean}|null} ctx
 * @returns {{weaponType: number, weight: number, strength: number, twoHanded: boolean}|null}
 */
export function readSwing(ctx) {
  const entity = ctx?.entity;
  if (!entity) return null;
  const weaponType = Number.isInteger(ctx.weaponType) ? ctx.weaponType : WEAPON_TYPES.Melee;
  const slots = equipTableOf(entity);
  const item = slots?.[ctx.usingRightHand === false ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand] ?? null;
  const bare = !item || weaponType === WEAPON_TYPES.Melee || weaponType === WEAPON_TYPES.Werecreature;
  return {
    weaponType,
    weight: bare ? 0 : (templateByIndex(item.templateIndex)?.baseWeight ?? 0),
    strength: liveStat(entity, 'strength'),
    twoHanded: !bare && getItemHands(item) === ITEM_HANDS.Both,
  };
}

/** Register the reader - at boot (scenes/shared.js), beside the mods' own overrides. */
export function installSwingLaw() { registerSwingReader(readSwing); }
