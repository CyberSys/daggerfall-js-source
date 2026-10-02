// @ts-check
// NEMESIS-HARM (2026-10-02): WHO LAST HARMED THE PLAYER, when no blow says it. A killing BLOW names its foe (the struck
// seam, systems/sigilSetPowers.js's landed blow); a spell's burn, a lingering effect's round and a poison's tick reach
// the player's hurt with nobody on them. So each leaves its foe here as it lands:
//   - a spell landing on the player (scenes/hostMagic.js applySpellToPlayer - a missile, a blast, a touch);
//   - a lingering effect's round (systems/effects.js runEffectRound - the caster the entry carries);
//   - any foe's blow that reaches the player (the struck seam) - a poisoned weapon's dose rides that blow, and its ticks
//     come later, so this mark lasts longest.
// systems/nemesis.js reads it when a hurt with no blow takes the player's last health. A LEAF: it imports nothing.

/** How long each kind of mark stands (milliseconds of the wall clock). */
export const HARM_MARK_SPELL_MS = 30000;
export const HARM_MARK_STRUCK_MS = 120000;

/** @type {{ entity: any, until: number } | null} */
let _mark = null;

/** A foe's harm reached the player now - its entity stands as the last harm until `ms` passes or another lands. */
export function markPlayerHarm(entity, { ms = HARM_MARK_SPELL_MS, now = Date.now() } = {}) {
  if (!entity || entity.isPlayer) return;
  _mark = { entity, until: now + ms };
}
/** The foe whose harm last reached the player, while its mark stands - or null. */
export function playerHarmMark(now = Date.now()) {
  return _mark && now <= _mark.until ? _mark.entity : null;
}
/** Tests only. */
export function _resetHarmMarkForTests() { _mark = null; }
