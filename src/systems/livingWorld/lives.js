// @ts-check
// LW4 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVES - who holds a traveller's place in their town, cycle by
// cycle. The road kills (trouble.js); a traveller slain is slain for good, their place stands empty while the town
// mourns, and a newcomer takes it - a new name, a new face, a new trade's record - and the town's talk remembers the one
// who went. Pure, like the rest of the living world (LW0 decision 2): no save holds who died, so every reader's world
// holds the same dead and the same newcomers, and a slot's whole history is a short read of its own seeded dice.
//
// THE FATE. Each traveller slot rolls its fate once a cycle - its own cycle (trips.js cycleOf), a sellsword's its
// contract merchant's (formCaravans' contract: the slot's own deal, never who holds it) - against its job's HAZARD.
// A roll under it is a death that cycle, COUNTED unless another roll under it fell in the VACANT_CYCLES before (a
// place standing empty has nobody in it to die; the rule reads the rolls alone, so a slot's history is never a chain).
// A counted death empties the place for the VACANT_CYCLES after; the newcomer holds it from the cycle after that - the
// census's own mint with the death's cycle in the seed (census.js mintResident's `gen`), `L<map>.t<slot>~<cycle>`.
// The death plays out where it falls: on that cycle's trip (trouble.js - a fated death is always ON the road: ownTrip
// sets out whatever the cycle's chance said), or, a cycle with no trip to make, abroad and unseen.
//
// A CHARACTER'S OWN TURNS (LW0 decision 6). A player who fights beside a party can turn a fate: a member the road
// would have taken, alive when the fight is won, was SPARED; one cut down beside them FELL. Both are the character's
// (the LivingWorld record), keyed by the PLACE and the cycle (`<place>@<cycle>` - the census's id, which holder held it
// that cycle being the dice's own answer), and read here over the dice - the world is shared, what one player changed
// in it is theirs.
import { lwRoll } from './seed.js';

/** A slot's chance a cycle of dying on the road, by job (a sailor's is the sea's, LW5) - a town of a dozen travellers
 *  loses one every season or so: a merchant one cycle in about 170, a sellsword one in 100, an adventurer one in 80. */
export const HAZARD = Object.freeze({ merchant: 0.006, mercenary: 0.01, adventurer: 0.012, pilgrim: 0.006, courier: 0.004, pedlar: 0.004 });
/** The cycles a place stands empty after a death. */
export const VACANT_CYCLES = 3;
const FATE = 0x46415445;   // 'FATE'

/**
 * @typedef {{ spared?: Set<string>|null, fallen?: Set<string>|null }} Turns - a character's own turns of fate,
 *   `<place>@<cycle>`
 */

/** A resident's place: the census's id, whichever generation holds it (`L<map>.t<slot>`). @param {{ id: string }} res */
export const placeKeyOf = (res) => String(res.id).replace(/~\d+$/, '');
/** A turn's key - the place and the cycle. @param {{ id: string }} res @param {number} k */
export const turnKey = (res, k) => `${placeKeyOf(res)}@${k}`;

/** Does a slot's fate roll under its hazard in cycle `k` - its own dice, then the character's turns. @param {any} res @param {number} k @param {Turns} [turns] */
export function fateHits(res, k, turns) {
  const key = turnKey(res, k);
  if (turns?.fallen?.has(key)) return true;
  if (turns?.spared?.has(key)) return false;
  const h = HAZARD[/** @type {keyof typeof HAZARD} */ (res.job)] ?? 0;
  return h > 0 && lwRoll(res.town, res.slot, k, FATE) < h;
}

/** Is a death in cycle `k` counted - its fate under the hazard and none in the VACANT_CYCLES before. @param {any} res @param {number} k @param {Turns} [turns] */
export function deathCounted(res, k, turns) {
  if (!fateHits(res, k, turns)) return false;
  for (let j = k - VACANT_CYCLES; j < k; j++) if (fateHits(res, j, turns)) return false;
  return true;
}

/**
 * THE PLACE in cycle `k`: `holder` the generation holding it (null: the census's own; a number: the cycle of the death
 * the newcomer came after), or `vacant` while it stands empty, and `dies` whether its holder dies this cycle.
 * `res` is the slot's census resident (its id, town, slot and job - the dice are the slot's, whoever holds it).
 * @param {any} res @param {number} k @param {Turns} [turns]
 * @returns {{ vacant: boolean, holder: number|null, dies: boolean, since: number|null }}
 */
export function placeAt(res, k, turns) {
  let last = null;
  // back from the cycle to the first counted death (a slot's hazard is percents a cycle: a few dozen cycles at most) -
  // to the world's first cycle, never a window, so a death long ago never falls out of the reading and back to the census
  for (let j = k - 1; j >= 0; j--) if (deathCounted(res, j, turns)) { last = j; break; }
  if (last != null && k - last <= VACANT_CYCLES) return { vacant: true, holder: null, dies: false, since: last };
  // the holder: the newcomer after the last death; before it, the generations back (each the death that came before it)
  return { vacant: false, holder: last, dies: deathCounted(res, k, turns), since: last };
}
