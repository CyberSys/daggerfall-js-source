// GUIDE3 (2026-09-29, Mac: "How can we set the foundation and improve the
// quest system substantially? Like really modernize it, make it more
// accessible", then, of the Quest Guide arc: "This is your baby. Take
// your time"): THE HERALD - a quest's news, said where the enhanced skin
// says news.
//
// WHAT DFU SAYS. Nothing. A quest's `log` is a bare addLogStep, `end
// quest` files the notebook in silence, and a clock inside its last day
// is a number the player must open the logbook to read. DISC6's player
// said what the silence costs (bible/01-Overview/Field-Bugs-2026-09-23.md):
// "Theres no quest notification when you killed all monsters and no quest
// update in the log". The quest's OWN words - its `say` popups - are the
// quest's and stay exactly where they are; what the herald adds is the
// journal's news, that it changed, which DFU never said at all.
//
// WHERE IT SAYS IT. The enhanced skin's notice stack (ui/enhancedNotice.js,
// ENH-NOTICE1/3): one toast per quest - its kind first ("New quest",
// "Journal updated", "Under a day left", "Quest completed", "Quest
// ended"), then its title, then one line: the newest entry's opening
// (ui/questRail.js entryOpening) or the time left. The stack is
// `aria-live` polite, so a screen reader says the news the parchment never
// could. The classic skin never draws it - DFU says nothing, and the
// classic skin is DFU's - and the enhanced skin's `quest-herald` switch
// (systems/features.js) takes it off: Ledger A row "A QUEST'S NEWS IS A
// NOTICE".
//
// THE MODEL IS ONE HOME, THE DRAW IS THE STACK'S (ui/levelNotice.js's
// shape, LV2): the queue and its clock live in QuestHerald below, pure -
// no DOM, no clock of its own - and the draw hands its frame to
// drawEnhancedToasts each HUD frame, as ui/hudText.js hands PopupText's.
//
// WHO FEEDS IT. The quest bridge (scenes/questBridge.js), after each
// machine tick: one lens look a tick, and only while the herald is
// listening - so a player who never hears it never pays for the look.
//
// ITS CLOCK IS THE HUD'S. ui/hud.js drawHud - the one call all four hosts
// make - draws it and ticks it with the frame's REAL seconds (a news line
// is the port's page, not the world's: at a journey's time scale it would
// otherwise be gone before it was read), and the tick is dead under any
// open window, DFU's own HUD law (DaggerfallUI.cs:429-433, which
// midScreenText keeps): news that lands as a window opens waits for the
// window to close rather than expiring unread.

import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { drawEnhancedToasts, releaseEnhancedToasts } from './enhancedNotice.js';
import { entryOpening, remainWords } from './questRail.js';   // the rail, never the lens: the HUD imports this face (entryOpening's own comment says why)

/** The switch's prefs key (systems/features.js row `quest-herald`). */
export const HERALD_PREF = 'questHerald';
/** The toasts' owner in the notice stack. */
export const HERALD_OWNER = 'quest-herald';
/** How long a notice holds, in real seconds the HUD is showing. */
export const HERALD_SECONDS = 7;
/** The most quests the herald speaks for at once; the oldest news goes
 *  first. Every word of it is in the journal - the herald only points. */
export const HERALD_MAX = 3;

/** The port's own words. Nothing here is TEXT.RSC: DFU has no such line. */
export const HERALD_WORDS = Object.freeze({
  started: 'New quest',
  updated: 'Journal updated',
  urgent: 'Under a day left',
  completed: 'Quest completed',
  ended: 'Quest ended',
});
/** The time-left line: remainWords' own phrase, the journal's "Time remains" count. */
export const heraldTimeLeft = (seconds) => `${remainWords(seconds)} left`;

/** ONE TOAST PER QUEST, so two pieces of news for one quest inside one
 *  notice's life are one notice - and the one that stands is the one a
 *  player most needs: an ending is the last word, a new quest stays new
 *  while its first entries land, and a deadline outranks a routine
 *  entry. */
const RANK = Object.freeze({ updated: 0, urgent: 1, started: 2, completed: 3, ended: 3 });

/** Is the herald listening? The enhanced skin, the player's switch - and
 *  a page to say it on: node drives the hosts headless (the suite, the
 *  probes), where there is no stack to hear it and so nothing worth a
 *  look (ui/mapSkin.js heldMapWorn's reason). */
export const heraldOn = () => isEnhanced() && !!getPref(HERALD_PREF) && typeof document !== 'undefined';

/** A notice's third line, for the news that stands: the newest entry's
 *  opening, the time left, or nothing for an ending. */
function lineOf(type, event, view) {
  if (type === 'started' || type === 'updated') return entryOpening(view?.latest?.lines);
  if (type === 'urgent') {
    const s = event.type === 'urgent' ? event.clockSeconds : view?.clockSeconds;
    return Number.isFinite(s) ? heraldTimeLeft(s) : '';
  }
  return '';
}

/**
 * THE QUEUE. Pure: every moment is handed in - a lens look to `hear`,
 * a HUD frame's seconds to `tick` - so a test can drive a whole evening
 * of quests in a millisecond.
 */
export class QuestHerald {
  constructor() {
    /** { seq, id, type, title, main, line, left } - oldest first. */
    this.rows = [];
    this._seq = 0;
  }

  /** A lens look (`{ quests, events }`, ui/questLens.js): each event is
   *  news for its quest's one notice. */
  hear(seen) {
    const views = new Map((seen?.quests ?? []).map((q) => [q.id, q]));
    for (const event of seen?.events ?? []) {
      if (!Object.hasOwn(HERALD_WORDS, event?.type)) continue;
      const at = this.rows.findIndex((r) => r.id === event.id);
      const was = at >= 0 ? this.rows[at] : null;
      const type = was && RANK[was.type] > RANK[event.type] ? was.type : event.type;
      const row = {
        seq: was?.seq ?? ++this._seq,
        id: event.id,
        type,
        title: event.title ?? was?.title ?? '',
        main: !!event.main,
        line: lineOf(type, event, views.get(event.id)),
        left: HERALD_SECONDS,
      };
      if (was) this.rows[at] = row; else this.rows.push(row);
    }
    while (this.rows.length > HERALD_MAX) this.rows.shift();
    return this.rows.length;
  }

  /** `dt` real seconds of a showing HUD: a notice past its time goes. */
  tick(dt) {
    if (!(dt > 0)) return;
    for (const r of this.rows) r.left -= dt;
    this.rows = this.rows.filter((r) => r.left > 0);
  }

  /** The toasts' frame: one row list and one id per notice (ui/enhancedNotice.js drawEnhancedToasts). */
  frame() {
    return {
      ids: this.rows.map((r) => r.seq),
      rows: this.rows.map((r) => [
        { text: HERALD_WORDS[r.type], cls: 'herald-kind' },
        { text: r.title, cls: r.main ? 'herald-title main' : 'herald-title' },
        ...(r.line ? [{ text: r.line, cls: 'herald-line' }] : []),
      ]),
    };
  }

  clear() { this.rows = []; }
}

/** THE ONE QUEUE: one player, one HUD, one journal (ui/levelNotice.js's reason). */
export const questHerald = new QuestHerald();

/**
 * ONE HUD FRAME OF THE HERALD. `hidden` is the HUD's own hide gate (a
 * window over it, the HUD toggled off): the notices hide and their clock
 * stops, and nothing is released. Off - the classic skin or the switch -
 * it REACHES ITS HIDE DOOR (AUDIT 64 F37: a DOM overlay stays painted
 * until told otherwise): the queue empties and the toasts slide out.
 * Returns the live toasts, for a test.
 */
export function drawQuestHerald({ hidden = false, dt = 0, doc = (typeof document === 'undefined' ? null : document) } = {}) {
  if (!heraldOn()) {
    if (questHerald.rows.length) questHerald.clear();
    releaseEnhancedToasts(HERALD_OWNER);
    return [];
  }
  if (!hidden) questHerald.tick(dt);
  return drawEnhancedToasts({ ...questHerald.frame(), visible: !hidden }, doc, HERALD_OWNER);
}
