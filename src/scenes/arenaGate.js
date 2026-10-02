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
import { bookmakerChoice, stakeChoice, placeWager, settleBook, bookVerdict, collectWinnings, priceText, exhibitionOdds, priceFor } from '../systems/arenaBook.js';
import { exhibitionFor } from '../systems/arenaLadder.js';
import { fighterIdentity } from '../systems/arenaFighters.js';
import { totalGoldAmount, deductGold, addGold } from '../systems/court.js';

/** The recruiters by their office (world/arenaCity.js ARENA_GATE_PEOPLE `role`) and the banner each keeps. */
export const RECRUITER_BANNER = Object.freeze({ redRecruiter: 'red', blueRecruiter: 'blue' });

/**
 * @param {{
 *   playerEntity: any, gameMinutes: () => number, showOverlay: (w: any) => void, say?: (line: string) => void,
 *   openWindow?: ((page?: string) => any) | null, liveHour?: () => (number|null), begun?: () => boolean,
 * }} deps `openWindow` the host's door to the Arena window (ui/arenaDoor.js), or null where it does not open;
 *   `liveHour` the hour whose exhibition stands on a floor here (its wager waits for its verdict), `begun` whether that
 *   bout's fight has begun (the book shuts at the word)
 */
export function createArenaGate(deps) {
  const P = deps.playerEntity;
  const gm = () => Math.floor(Number(deps.gameMinutes()) || 0);
  const say = (line) => deps.say?.(line);
  /** The league on today's season, written back so the save carries the roll. */
  const league = () => (P.arenaLeague = rollLeague(P.arenaLeague, gm()));
  const choice = (ch, act) => deps.showOverlay(new ChoiceWindow({ lines: ch.lines, options: ch.options.map((o) => ({ code: o.code, label: o.label ?? undefined, action: () => act(o.act, o) })) }));
  const liveHour = () => deps.liveHour?.() ?? null;
  const begun = () => !!deps.begun?.();
  /** The book written back into the league. */
  const setBook = (book) => { P.arenaLeague = { ...league(), book }; };

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

  // ── THE BOOKMAKER ───────────────────────────────────────────────────────────────────────────────────────
  const B = ARENA_TEXT.book;
  /** Every wager that can be settled now, settled (systems/arenaBook.js settleBook) - its winnings owed at the stall. */
  function settle() { setBook(settleBook(league().book, gm(), { liveHour: liveHour() }).book); }
  /** THE VERDICT SEEN of the exhibition of `hour` (the driver's - scenes/arenaBouts.js `exhibitionVerdict`): a wager on it
   *  is settled by what was seen. */
  function verdictSeen(hour, side) {
    setBook(bookVerdict(league().book, hour, side));
    settle();
  }
  /** PLACE a wager of `stake` on fighter `side` of the exhibition of `hour`: `{ ok, text }` - the gold taken from the
   *  purse (coins, then letters - DFU's own payment law, systems/court.js deductGold). */
  function wager(hour, side, stake) {
    const ex = exhibitionFor(gm());
    if (!ex || ex.hour !== hour) return { ok: false, text: B.whyRefused.closed };
    const r = placeWager(league().book, ex, side, stake, { gold: totalGoldAmount(P), begun: begun(), gameMinutes: gm() });
    if (!r.ok) return { ok: false, text: B.whyRefused[r.reason ?? 'closed'] };
    deductGold(P, r.cost);
    setBook(r.book);
    const name = fighterIdentity(ex.seed, side, ex.opponents[side].mobile).name;
    return { ok: true, text: B.taken(r.cost, name, priceText(priceFor(exhibitionOdds(ex)[side]))) };
  }
  /** THE BOOKMAKER'S CHOICE: collect, back a fighter (then the stake), the window, leave. True: it is up. */
  function bookmaker() {
    settle();
    const ch = bookmakerChoice({ league: league(), gameMinutes: gm(), gold: totalGoldAmount(P), begun: begun(), window: typeof deps.openWindow === 'function' });
    choice(ch, (a) => {
      if (a === 'collect') {
        const r = collectWinnings(league().book);
        setBook(r.book);
        if (r.gold > 0) { addGold(P, r.gold); say(B.paid(r.gold)); }
      } else if (a === 'back0' || a === 'back1') {
        const ex = ch.exhibition;
        if (!ex) return;
        const side = a === 'back1' ? 1 : 0;
        const name = fighterIdentity(ex.seed, side, ex.opponents[side].mobile).name;
        const price = priceText(priceFor(exhibitionOdds(ex)[side]));
        choice(stakeChoice({ name, price, gold: totalGoldAmount(P) }), (b, o) => {
          if (b !== 'stake') return;
          const r = wager(ex.hour, side, o.stake);
          say(r.text);
        });
      } else if (a === 'window') deps.openWindow?.('bouts');
    });
    return true;
  }

  return { recruiter, bookmaker, wager, settle, verdictSeen };
}
