// ═══════════════════════════════════════════════════════════════════
// FORAGE4 (2026-09-28, Mac: "Continue! Remember, this is your baby"):
// FORAGING'S ONLINE WAIT, COMPOSED FOR A HOST - bible/06-Systems/
// Foraging.md 13.1. Online the shared clock is nobody's to move
// (WORLD5), so Quest Actions Extension's `raise time by H:MM` is a wait
// the player sits through instead: the busy page C&C's hunt already has
// (ui/huntWindow.js - THE ONE CONSTRUCTION SEAM, with `ask`, `escape`
// and `result` off and `interruptWhen` a foe near), at C&C's
// HUNT_WAIT_PER_HOUR real seconds a game hour (huntRealSeconds,
// imported, not copied).
//
//   entity         - the player; `foragingWait` on it is the wait's
//                    record - `{ seconds, label }` - so the seconds
//                    left ride the save and a reload reopens the page
//                    with them (systems/save.js ENTITY_FIELDS)
//   showOverlay(w) - the slot; overlayActive() - whether a window
//                    holds it (the tool's result box, the pack)
//   enemiesNear()  - the rest test, the host's (duel included)
//   online()       - the shared clock is on
//
// THE ORDER: the tool's result box and the pack close first - the page
// opens only when the slot is free; then the page takes the slot; the
// quest's own boxes (a bonus's line) are held behind it and shown, in
// order, when it ends (`holds` / `hold`). A second wait joins the
// first (`extend`). A foe near ends the page with what is left
// forgiven; so does a window that takes the slot from under it (the
// page's dispose). The quest machine never pauses: the page holds the
// player, not the quest.
// ═══════════════════════════════════════════════════════════════════

import { HuntWindow } from '../ui/huntWindow.js';
import { huntRealSeconds } from '../systems/survival/hunting.js';

/** The page's line: the quest's own DisplayName, the author's words ("Chop and Gather Wood..."). */
export const waitLine = (label) => `${label || 'Time passes'}...`;
/** The longest wait a record may hold: eight game hours, the build's Mining quadruple (Q7) - more than any wait the
 *  patched pack can raise, so a save edited to a day of waiting is cut to this, never obeyed. */
export const FORAGING_WAIT_MAX_SECONDS = huntRealSeconds(8 * 60);
/** A saved record, made safe: `{ seconds, label }` with finite seconds in (0, the max] and a short string label, or null. */
export function saneWait(r) {
  if (!r || typeof r !== 'object' || !Number.isFinite(r.seconds) || r.seconds <= 0) return null;
  return { seconds: Math.min(FORAGING_WAIT_MAX_SECONDS, r.seconds), label: typeof r.label === 'string' ? r.label.slice(0, 60) : null };
}

export function createForagingWait({ entity, showOverlay = null, overlayActive = () => false, enemiesNear = () => false, online = () => true } = {}) {
  let _win = null;
  const _held = [];

  const record = () => {
    if (!entity) return null;
    const r = entity.foragingWait;
    if (r == null) return null;
    const sane = saneWait(r);
    if (!sane) { entity.foragingWait = null; return null; }
    if (sane.seconds !== r.seconds || sane.label !== r.label) entity.foragingWait = sane;
    return entity.foragingWait;
  };
  const pending = () => (record()?.seconds ?? 0) > 0;

  function release() {
    while (_held.length && !pending() && !_win) {
      const fn = _held.shift();
      try { fn(); } catch (e) { console.warn('[foragingWait] a held box threw', e); }
    }
  }

  /** The quest's `raise time by`, online: `gameSeconds` of the clock as a wait of real seconds, joined to any standing. */
  function add(gameSeconds, label = null) {
    if (!entity || !(gameSeconds > 0)) return 0;
    const real = huntRealSeconds(gameSeconds / 60);
    const r = record();
    if (r && r.seconds > 0) {
      const joined = Math.min(FORAGING_WAIT_MAX_SECONDS, r.seconds + real);
      _win?.extend(joined - r.seconds);
      r.seconds = joined;
    } else {
      entity.foragingWait = { seconds: real, label: label ?? null };
    }
    return real;
  }

  function open() {
    const r = record();
    _win = new HuntWindow({
      busy: waitLine(r.label), seconds: r.seconds,
      ask: false, escape: false, result: false, interruptWhen: () => !!enemiesNear(),
      onClosed: () => {
        _win = null;
        if (entity) entity.foragingWait = null;   // done, or forgiven: a foe near, or the slot taken
        release();
      },
    });
    showOverlay?.(_win);
    return _win;
  }

  /** Every frame: the page opens when the slot is free, and its seconds left are written back for the save. */
  function tick() {
    if (!entity) return null;
    if (!online()) {
      // the offline lane has no waits: a save made mid-wait online and loaded offline forgives what was left
      if (record()) entity.foragingWait = null;
      release();
      return null;
    }
    if (_win) {
      if (!_win.done && entity.foragingWait) entity.foragingWait.seconds = _win.remaining;
      return _win;
    }
    if (!pending() || overlayActive()) return null;
    return open();
  }

  return {
    add, tick,
    /** Whether a quest box must wait: a wait stands, or is pending behind the slot. */
    holds: () => pending() || !!_win,
    /** A quest box held behind the wait, run in order when it ends. */
    hold(fn) { if (typeof fn === 'function') _held.push(fn); },
    get window() { return _win; },
  };
}
