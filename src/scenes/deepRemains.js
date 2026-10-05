// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW6b (2026-10-05, bible/06-Systems/Living-World.md "LW6b"): THE FALLEN IN THE DEEP - the dead of a dive left in its
// dungeon, to be found. Mac: "You can find them dungeon diving ... explore a dynamic world". LW6's companies go down
// into the dungeons near their towns and some never come up (trips.js diveTrip, trouble.js diveTrouble); their town
// says so (DIVE_NEWS). This lays what the deep kept where a player can find it.
//
// WHO. The host's word (trips.js fallenIn): the dead of the dives into this dungeon, from the minute the deep took them
// for DEEP_REMAINS_MIN - passed by, before they reach here, a hand's dead and one who fell at the player's side (their
// bodies are the pool's own corpses), one the player saw spared, and any of a company the player met this time (its end
// is what happened, LW6).
// WHERE. At one of the places the dungeon's own foes stand (`spots()`: its random enemy markers' floors), the one their
// key deals (`restAt`) - every reader the same.
// WHAT. Their body - their class's corpse picture - with what they carried (`lay`: a pile of the dungeon's own). Laid
// ONCE in this character's world (`laid`, `mark`: the relations' `laid`); the dungeon's own pile from then - its scene's
// cache keeps it, the player loots it. On the way in it is simply there (the dungeon as it is); one the deep takes while
// the player is down lies where they are not (beyond DEEP_LAY_M).
// FOUND. The player coming near one ("The remains of Ada Lark, of Wayrest.") hears whose it is - once a visit, while
// the pile lies there (`there`).
//
// EVERY ALLOCATION HAS AN OWNER: the piles are the dungeon's (its droppedLoot, its scene cache); this layer keeps only
// the keys it told this visit - `clear()` (the dungeon left) forgets them.
// ═══════════════════════════════════════════════════════════════════
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';

/** How near the player comes to know the remains (m). */
export const DEEP_NOTICE_M = 4;
/** After the way in, remains are laid only this far from the player (m) - never under their eyes. */
export const DEEP_LAY_M = 15;

/** The resting place a fallen's key deals among `n` (-1: none). @param {string} key @param {number} n */
export const restAt = (key, n) => (n > 0 ? lwSeed(textSeed(key), 0x72657374) % n : -1);   // 'rest'

/**
 * @param {{
 *   spots: () => number[][],
 *   laid: (key: string) => boolean,
 *   mark: (key: string) => void,
 *   lay: (res: any, feet: number[]) => any,
 *   there: (feet: number[]) => boolean,
 *   feet: () => (number[] | null),
 *   say: (text: string) => void,
 *   townName: (res: any) => string,
 * }} deps - `lay(res, feet)` the dungeon's pile for them (null: not laid); `there(feet)` whether a pile still lies there
 */
export function createDeepRemains(deps) {
  const told = new Set();
  let arriving = true;
  return {
    /**
     * One beat: each of `remains` (the host's, already passed by) not yet laid in this character's world laid at its
     * place - at once on the way in, else beyond DEEP_LAY_M of the player; one near the player told.
     * @param {readonly { key: string, res: any }[]} remains
     */
    frame(remains) {
      const spots = deps.spots();
      if (!spots.length) return;
      const feet = deps.feet();
      for (const r of remains) {
        const at = spots[restAt(r.key, spots.length)];
        const away = !feet || Math.hypot(at[0] - feet[0], at[2] - feet[2]) > DEEP_LAY_M;
        if (!deps.laid(r.key)) {
          if (!(arriving || away) || !deps.lay(r.res, at)) continue;
          deps.mark(r.key);
        }
        if (told.has(r.key) || !feet || Math.hypot(at[0] - feet[0], at[2] - feet[2]) > DEEP_NOTICE_M || Math.abs(at[1] - feet[1]) > 3 || !deps.there(at)) continue;
        told.add(r.key);
        const town = deps.townName(r.res);
        deps.say(town ? `The remains of ${r.res.name}, of ${town}.` : `The remains of ${r.res.name}.`);
      }
      if (feet) arriving = false;
    },
    /** The remains told this visit (the probes; the pins). */
    told: () => [...told],
    clear() { told.clear(); arriving = true; },
  };
}
