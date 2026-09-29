// DEATH PENALTY (2026-09-24, Mac: "add deathpenalty 25% of the gold you
// have with you" - "online mode only ofc").
//
// WHY ONLINE ONLY IS THE WHOLE SHAPE. Offline, a death ends the run
// (endRunToTitleMenu: the video, then the title, or F11 for the last
// save), so there is no continuing purse to take from. Online, a death
// RESPAWNS you (D-ONLINE1) - half health, the nearest safe place - and
// that is free, which is the gap this closes: the fall now costs a
// quarter of the coin you were carrying.
//
// "WITH YOU" IS THE PURSE. player.goldPieces is the counter (systems/
// inventory.js, E4). Not the bank account (the bank is where a careful
// player keeps it - that is the trade-off the penalty exists to create),
// and not letters of credit (paper, and deductGold's own order treats it
// separately).
//
// ROUNDED DOWN, in the player's favour: 3 gold loses nothing, 100 loses 25.
// There is no switch: an online rule the player could turn off would be no
// rule, and offline nothing reads it.
import { goldPiecesOf } from './inventory.js';

export const DEATH_GOLD_FRACTION = 0.25;

/** What a purse of `gold` loses to a death. Any input that is not a usable count loses nothing. */
export function deathGoldLoss(gold) {
  const g = Number.isFinite(gold) ? Math.max(0, Math.floor(gold)) : 0;
  return Math.floor(g * DEATH_GOLD_FRACTION);
}

/**
 * AUDIT 28 B5: THE LOSS THE DEATH SCREEN SAID. The screen reads it once, as the player falls; the respawn takes THAT -
 * never a quarter of a purse that grew while the player lay dead (a party mate's bounty clear pays the dead too) -
 * capped at what the purse holds. A Resurrect spares it: the screen's word is for the respawn, and a rescue is none.
 * One player a page, so one statement a page; null when no screen has spoken since the last respawn.
 */
let _stated = null;
/** The death screen's word - or null to withdraw it (a Resurrect). */
export function stateDeathLoss(lost) { _stated = Number.isSafeInteger(lost) && lost >= 0 ? lost : null; }
/** What the screen said, if it has spoken since the last respawn (a test's seam, and the Resurrect's line). */
export const statedDeathLoss = () => _stated;

/** Takes the penalty off the player's purse - the loss the death screen said, if it spoke, else a quarter of the purse
 *  now - never more than the purse holds. Returns the gold lost (0 when there was none to take). */
export function applyDeathPenalty(player) {
  if (!player) return 0;
  const purse = goldPiecesOf(player);
  const lost = Math.max(0, Math.min(purse, _stated ?? deathGoldLoss(purse)));
  _stated = null;   // spent: the next death speaks for itself
  if (lost > 0) player.goldPieces = purse - lost;
  return lost;
}

/** The line the respawn says after the flavour text; empty when nothing was lost. */
export const deathPenaltyText = (lost) => (lost > 0 ? `Death claimed ${lost} gold from your purse.` : '');

/** The death screen's lines about the loss (Mac's own wording) - one is drawn per death, and every one
 *  carries the amount. Each is a function of the count so a line can say "coin" or "coins" properly. */
export const DEATH_PENALTY_LINES = Object.freeze([
  (n) => `Dropped in the dirt, your ${n} gold feeds the shadows.`,
  (n, raw) => `${n} ${raw === 1 ? 'coin scatters' : 'coins scatter'} into the void, leaving only your corpse behind.`,
  (n) => `The reaper collects his toll in gold, not blood: ${n} gold.`,
  (n) => `Your fortune of ${n} gold vanished into the abyss where you fell.`,
]);

/** One of the lines above for a loss of `lost` gold; empty when nothing was lost. `roll` is Math.random's shape,
 *  so a test can pick a line. The caller draws ONCE per death (a screen redraws every frame). */
export function deathPenaltyLine(lost, roll = Math.random) {
  if (!(lost > 0)) return '';
  const pool = DEATH_PENALTY_LINES;
  return pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))](lost.toLocaleString('en-US'), lost);
}
