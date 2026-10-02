// @ts-check
// ARENA2 (2026-10-02): THE HERALD'S CHOICE at the arena's gate - "Watch the exhibition", "Fight on the ladder", "Go
// down to the fighters' hall", "Leave" - what he says before it (the bout on the sand or the next one, the player's next
// ladder bout, the title the arena calls them by) and which choices stand. The full Arena window is ARENA3's; this is
// a keyed choice (ui/talkWindow.js ChoiceWindow), the enhanced dialog on the Plus skin (ui/enhancedDialog.js
// drawEnhancedChoice) and the classic panel on the other. A choice that cannot be taken is not offered, and HIS LINES
// SAY WHY (the house's refusal rule: a sentence, never a button that silently vanishes).
//
// Pure: the clock, the city's bout, the ladder and the player's state in; `{ lines, options }` out, each option
// `{ code, label, act }` (`act` 'watch' | 'fight' | 'hall' | 'leave' - the host's to do). Not a DFU member. Ledger A.

import { ARENA_TEXT } from './arenaText.js';
import { exhibitionFor, nextExhibitionHour, nextLadderBout, ladderTitle } from './arenaLadder.js';

/** A fighter must have this share of their health to be let onto the sand. */
export const FIGHT_HEALTH_MIN = 0.5;

/**
 * @param {{ gameMinutes: number, cityBout?: { a: string, b: string } | null, ladder?: any, healthShare?: number }} o
 */
export function heraldChoice({ gameMinutes, cityBout = null, ladder = null, healthShare = 1 }) {
  const H = ARENA_TEXT.herald;
  const lines = [];
  const hour = Math.floor(Math.max(0, gameMinutes) / 60);
  lines.push(H.greet[hour % H.greet.length]);
  lines.push('');
  const ex = exhibitionFor(gameMinutes);
  const canWatch = !!cityBout || !!ex?.open;
  if (cityBout) lines.push(H.onNow(cityBout.a, cityBout.b));
  else if (!canWatch) { lines.push(H.noWatch); lines.push(H.nextAt(nextExhibitionHour(gameMinutes))); }
  const next = nextLadderBout(ladder);
  const fit = healthShare >= FIGHT_HEALTH_MIN;
  if (!next) lines.push(H.ladderDone);
  else {
    lines.push(H.ladderNext(next.tierName, next.label));
    if (!fit) lines.push(H.noFight);
  }
  const title = ladderTitle(ladder);
  if (title) lines.push(H.title(title));
  const options = [];
  if (canWatch) options.push({ code: 'KeyW', label: H.watch, act: 'watch' });
  if (next && fit) options.push({ code: 'KeyF', label: H.fight, act: 'fight' });
  options.push({ code: 'KeyH', label: H.hall, act: 'hall' });
  options.push({ code: 'KeyL', label: H.leave, act: 'leave' });
  options.push({ code: 'Escape', label: null, act: 'leave' });   // the key alone: Escape leaves him
  return { lines, options, exhibition: ex, next };
}
