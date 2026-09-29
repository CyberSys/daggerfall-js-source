// @ts-check
// REALM P0.5 (2026-09-28, Mac: "eliminate duping"; bible/06-Systems/Realm-Arc.md, "a periodic online autosave"):
// THE CHARACTER IS SAVED AS IT PLAYS ONLINE, not only as it leaves.
//
// Until phase 1 moves an online character's truth to the account service, its save is this browser's, and the exit
// save (ONLINE-AUTOSAVE1, scenes/world.js `beforeunload`) is skipped where it matters most: a tab another took the seat
// from, a death screen, a crash, a killed browser. A second tab that loads the save from before a trade holds the goods
// the first tab traded away - a dupe (rollback vector 1). So online:
//   - every ONLINE_CHECKPOINT_MS of real time the character is saved, quietly, to every slot the exit save writes;
//   - a trade's goods leaving the pack, coming back or arriving are saved at once, so the giver's loss is on disk
//     before the frame that hands the goods over is sent.
// Refused where the exit save is (a tab out of the seat; the death screen, where exitAutosaveNames answers no slot) and
// while a duel is in play (its borrowed health and spells are not the character's). Offline nothing changes.

/** Real milliseconds between two periodic checkpoints. */
export const ONLINE_CHECKPOINT_MS = 120_000;

/**
 * Whether a checkpoint may be written now.
 *
 * AUDIT LIVED1b S1 (F2, K2): and not while a RaiseTime waits for its walk (`walkWaiting`, worldTick.js ownWalkWaiting).
 * Online a sentence, the fortnight, a cure's minute, TrainPc's hours and the dungeon rest's calendar move the
 * character's clock barely, and the next unpaused tick walks the span (Lived-Time); a window stands between, and the
 * checkpoint wrote the moved clock under it - the load then re-anchored every marker to it and the span was never
 * walked (a sentence's spells never ran out, its 112-day drift never paid; a dungeon rest's loan reminders lost). DFU
 * can save only once Update has caught up. The last checkpoint stands; the next is written when the walk has been.
 * @param {{ online?: boolean, spawned?: boolean, seatOut?: boolean, duel?: boolean, walkWaiting?: boolean }} at
 */
export function checkpointAllowed({ online = false, spawned = false, seatOut = false, duel = false, walkWaiting = false } = {}) {
  return !!online && !!spawned && !seatOut && !duel && !walkWaiting;
}

/** Whether the periodic checkpoint is due, `nowMs` and `lastMs` on one clock. */
export const checkpointDue = (/** @type {number} */ nowMs, /** @type {number} */ lastMs) => Number.isFinite(nowMs) && nowMs - lastMs >= ONLINE_CHECKPOINT_MS;

/**
 * A trade pack (systems/tradePack.js) whose every change of the pack is checkpointed: `take` (the goods out, before the
 * commit frame is queued - net/tradeSession.js _maybeCommit), `restore` (the goods back) and `give` (the peer's goods
 * in). The rest of the pack passes through.
 * @param {any} pack @param {(why: string) => unknown} checkpoint
 */
export function checkpointedTradePack(pack, checkpoint) {
  return {
    ...pack,
    take(/** @type {any} */ entries, /** @type {number} */ gold) {
      const handle = pack.take(entries, gold);
      if (handle) checkpoint('trade');
      return handle;
    },
    restore(/** @type {any} */ handle) { pack.restore(handle); checkpoint('trade'); },
    give(/** @type {any} */ received, /** @type {number} */ gold) { pack.give(received, gold); checkpoint('trade'); },
  };
}
