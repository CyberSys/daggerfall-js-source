// @ts-check
// AUDIT ARENA-LADDER (2026-10-05, the owner: "ensure climbing the PvE ladder isnt an easy feat"; asked what may be used
// on the sand, "No cheese spells or potions"): THE SAND'S KIT LAW. From the bell to the healers a ladder bout is fought
// with arms, armour and fighting magic. Before it the ladder fell to a pack: potions drunk mid-bout, Levitate over a
// ring the clamp held only across the ground (the beasts, the Orc Warlord and the Grand Champion melee-only below),
// Invisibility no class fighter sees through, a Calm (Charm) on the fighter. So, while the player's own bout is set
// (characters/enemyTargets.js setPlayerBout - a ladder bout, a practice bout and a relay's ladder bout alike):
//   - no potion is drunk (systems/useItem.js's potion arm asks first, and the bottle is kept);
//   - no spell carrying Invisibility, Levitate, Chameleon, Shadow, Charm or Teleport is cast, whatever casts it - a
//     readied spell, an item's (scenes/hostMagic.js wardedHere, the one engine every host runs);
//   - those effects already on the player are taken off while the fight is live (scenes/arenaBouts.js frame) - a
//     Levitate cast at the gate, a ring's Chameleon.
// The port's own: DFU has no arena. Ledger A (ARENA).
import { playerBoutOf } from '../characters/enemyTargets.js';
import { hasActiveEffect, cureAllOfKind } from './effects.js';
import { ARENA_TEXT } from './arenaText.js';

/** The classic effect types barred from the sand: Invisibility 13, Levitate 14, Chameleon 23, Shadow 24, Charm 34
 *  (DFU's Calm of a class foe), Teleport 43 (Recall is its second half). */
export const SAND_BARRED_EFFECTS = Object.freeze([13, 14, 23, 24, 34, 43]);
/** The live effects (systems/effects.js BUFF_KINDS' words) those leave on the player. */
export const SAND_BARRED_KINDS = Object.freeze(['invisNormal', 'invisTrue', 'levitate', 'chameleonNormal', 'chameleonTrue', 'shadeNormal', 'shadeTrue']);

/** The ceiling over the sand, metres above the ring's centre (player/motor.js _keepInArena, scenes/arenaBouts.js ring):
 *  over the highest honest jump (AcrobatMotor's jumpSpeed 4.5 at Jumping 100, the Jump spell and Athleticism - x2.3, 2.7 m)
 *  and under a Levitate's reach over a melee fighter. */
export const SAND_CEILING_M = 4;
/** Is the player on the sand in a bout of their own? */
export const onTheSand = () => playerBoutOf() != null;
/** The refusal of a potion now, or null. */
export const sandPotionRefusal = () => (onTheSand() ? ARENA_TEXT.refuse.potion : null);
/** The refusal of this spell now, or null. */
export const sandSpellRefusal = (sp) => (onTheSand() && (Array.isArray(sp?.effects) ? sp.effects : []).some((e) => e && SAND_BARRED_EFFECTS.includes(e.type)) ? ARENA_TEXT.refuse.magic : null);
/** Take the barred effects off `entity`; answers how many kinds went. */
export function stripSandBarred(entity) {
  let n = 0;
  for (const k of SAND_BARRED_KINDS) if (hasActiveEffect(entity, k)) { cureAllOfKind(entity, k); n++; }
  return n;
}
