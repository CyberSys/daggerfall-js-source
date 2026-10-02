// @ts-check
// ARENA3 (2026-10-02, Mac: "join a team (red and blue)"; "Joining a team comes with it's own enhanced UI"): THE GATE'S
// PEOPLE WHO ARE NOT THE HERALD - the Red and Blue Banners' recruiters, and (with the book) the bookmaker - answered in
// ONE place for both hosts that stand the colosseum (scenes/world.js, the streaming world; scenes/exterior.js, the city
// alone), so the two never drift. Design: bible/11-Multiplayer/Arena.md "3. The teams", "5. The Arena window".
//
// Each person's word is a keyed choice (ui/talkWindow.js ChoiceWindow - the enhanced dialog on the Plus skin, the panel
// on the classic one) built by the pure law (systems/arenaHerald.js recruiterChoice); this file only does what a choice
// asks - joins the banner, quits it (asked twice), opens the Arena window on its Team page - and says what was done.
// The league rides the player (`playerEntity.arenaLeague`, systems/save.js), rolled to the season on every read.
//
// Not a DFU member. Ledger A (ARENA).

import { ChoiceWindow } from '../ui/talkWindow.js';
import { recruiterChoice, quitAsk } from '../systems/arenaHerald.js';
import { joinBanner, quitBanner, rollLeague } from '../systems/arenaLeague.js';
import { ARENA_TEXT } from '../systems/arenaText.js';

/** The recruiters by their office (world/arenaCity.js ARENA_GATE_PEOPLE `role`) and the banner each keeps. */
export const RECRUITER_BANNER = Object.freeze({ redRecruiter: 'red', blueRecruiter: 'blue' });

/**
 * @param {{
 *   playerEntity: any, gameMinutes: () => number, showOverlay: (w: any) => void, say?: (line: string) => void,
 *   openWindow?: ((page?: string) => any) | null,
 * }} deps `openWindow` the host's door to the Arena window (ui/arenaDoor.js), or null where it does not open
 */
export function createArenaGate(deps) {
  const P = deps.playerEntity;
  const gm = () => Math.floor(Number(deps.gameMinutes()) || 0);
  const say = (line) => deps.say?.(line);
  /** The league on today's season, written back so the save carries the roll. */
  const league = () => (P.arenaLeague = rollLeague(P.arenaLeague, gm()));
  const choice = (ch, act) => deps.showOverlay(new ChoiceWindow({ lines: ch.lines, options: ch.options.map((o) => ({ code: o.code, label: o.label ?? undefined, action: () => act(o.act) })) }));

  /** A RECRUITER's choice (`role` 'redRecruiter' | 'blueRecruiter'). True: it is up. */
  function recruiter(role) {
    const banner = RECRUITER_BANNER[role];
    if (!banner) return false;
    const name = ARENA_TEXT.teams.name[banner];
    const ch = recruiterChoice({ banner, league: league(), gameMinutes: gm(), window: typeof deps.openWindow === 'function' });
    choice(ch, (a) => {
      if (a === 'join') {
        const r = joinBanner(league(), banner, gm());
        P.arenaLeague = r.league;
        if (r.ok) { say(ARENA_TEXT.recruiter.joined(name)); deps.openWindow?.('team'); }
      } else if (a === 'quit') {
        choice(quitAsk(banner), (b) => {
          if (b !== 'quit') return;
          const r = quitBanner(league(), gm());
          P.arenaLeague = r.league;
          if (r.ok) say(ARENA_TEXT.recruiter.quitDone(name));
        });
      } else if (a === 'window') deps.openWindow?.('team');
    });
    return true;
  }

  return { recruiter };
}
