// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2b (2026-10-03, Mac: "plus we need to build motherloads") - THE
// MOTHERLODES ON THIS DEVICE (bible/06-Systems/Professions-Arc.md 6, 35;
// the law is net/motherlodeLaw.js, the service's half
// server-account/src/motherlodes.js):
//
//   - TODAY'S THREE, as the service last said them (`/v1/prof/motherlodes`):
//     read on arrival, every MOTHERLODE_READ_MS, at the UTC day's turn and
//     after a strike - each its pixel, its ore, its hours and its strikers;
//     and the one this account found today.
//   - THE WARNING, every client's own from the shared clock (the gate's
//     omen's way, systems/gateOmen.js): MOTHERLODE_WARN_S ahead of a rising
//     - a Motherlode Sense's 30 minutes - a line in the chat; another as it
//     breaks ground. Each said once a session.
//   - THE WATCH: the relay's `k1` receipts this socket is handed (one every
//     two minutes while the account moves in a town's cell - the relay's
//     word on the pixel its pose stands in), the newest kept for each pixel
//     - a strike carries the Motherlode pixel's to the service.
//   - WHERE IT STANDS: a Motherlode risen and not yet spent stands on its
//     pixel (scenes/mineHost.js), so a change - its rising, its going, its
//     twentieth striker, this account's find - asks the host to stand that
//     pixel again (`onChange`).
// ═══════════════════════════════════════════════════════════════════
import { readWatchReceipt } from './watchReceipt.js';
import { motherlodeOpen, motherlodeWarnS, MOTHERLODE_WATCH_S, MOTHERLODE_STRIKERS, MOTHERLODE_SILVER } from './motherlodeLaw.js';
import { marksText } from './marksLaw.js';

/** The day's Motherlodes read again this often (ms) - their strikers move. */
export const MOTHERLODE_READ_MS = 5 * 60_000;
/** A refused or failed read is asked again this soon (ms). */
export const MOTHERLODE_RETRY_MS = 60_000;
/** The Watch receipts kept: the newest for each of this many pixels. */
export const MOTHERLODE_WATCH_KEPT = 8;
/** A strike's act takes this long at most (s): a receipt is carried only while it will still be fresh at the act's end. */
export const MOTHERLODE_ACT_S = 120;

/** The words. `where` a region's name, `ore` the ore's. */
export const MOTHERLODE_TEXT = Object.freeze({
  warn: (ore, where, minutes) => `The surveyors report a Motherlode of ${ore} about to break ground in ${where} - in ${minutes} minutes. Look for it on your compass.`,
  risen: (ore, where) => `A Motherlode of ${ore} has broken ground in ${where}. The first ${MOTHERLODE_STRIKERS} miners to strike it each find ${marksText(MOTHERLODE_SILVER)}.`,
  watch: 'The Watch has not seen you on the Motherlode\'s ground yet. Stand a moment - it will within two minutes.',
  found: 'You have found your Motherlode today. Another breaks ground tomorrow.',
  full: 'Its twenty miners have struck it. The Motherlode is spent.',
});

/**
 * @param {{
 *   door: { motherlodes: (character: string) => Promise<any> },
 *   character: () => (string|null), me: () => (string|null), nowS: () => number,
 *   onChange?: (lode: any) => void, say?: (text: string) => void,
 *   regionName?: (region: number) => string, oreName?: (material: string) => string, nowMs?: () => number,
 * }} deps `door` net/accountClient.js accountProf's; `me` the signed-in account (a receipt is kept only for it); `nowS`
 *   the shared clock's seconds; `onChange` a Motherlode's standing changed (the host stands its pixel again)
 */
export function createMotherlodeBook({ door, character, me, nowS, onChange = () => {}, say = () => {}, regionName = (r) => `region ${r}`, oreName = (m) => m, nowMs = () => Date.now() }) {
  const state = {
    /** today's UTC day as read, its Motherlodes (`struck` each), this account's find today (a key) */
    day: /** @type {number|null} */ (null),
    lodes: /** @type {any[]} */ ([]),
    found: /** @type {string|null} */ (null),
  };
  let readAt = -Infinity, busy = false, readFor = '';
  /** the lines said this session, by `warn|key` and `risen|key`; the standing each lode was last stood with */
  const said = new Set();
  const stood = new Map();
  /** pixel `x,y` -> { r, i } - the newest Watch receipt for each pixel this account stood in */
  const watches = new Map();
  const hear = (fn, ...a) => { try { fn(...a); } catch (e) { console.warn('[motherlode]', e?.message ?? e); } };

  /** Whether a Motherlode stands for this account now - risen, not gone, not spent, not the day's find made. */
  const standing = (l, t) => motherlodeOpen(l, t) && (l.struck ?? 0) < MOTHERLODE_STRIKERS && !state.found;
  /** The host told of every Motherlode whose standing moved since it was last stood. */
  function settle(t) {
    for (const l of state.lodes) {
      const now = standing(l, t);
      if (stood.get(l.key) !== now) { stood.set(l.key, now); hear(onChange, l); }
    }
  }

  async function read() {
    const c = character();
    if (!c || busy) return null;
    busy = true;
    try {
      let r;
      try { r = await door.motherlodes(c); } catch { r = { ok: false, error: 'offline' }; }
      readFor = `${me() ?? ''}|${c}`;
      if (!r?.ok) { readAt = nowMs() - MOTHERLODE_READ_MS + MOTHERLODE_RETRY_MS; return r; }
      readAt = nowMs();
      const d = r.data ?? {};
      state.day = Number.isSafeInteger(d.day) ? d.day : null;
      state.lodes = Array.isArray(d.lodes) ? d.lodes.filter((l) => l && typeof l.key === 'string') : [];
      state.found = typeof d.found === 'string' ? d.found : null;
      settle(nowS());
      return r;
    } finally { busy = false; }
  }

  return {
    state,
    /** The day's read asked now (a strike's answer, a sign-in). */
    read,
    /**
     * EVERY FRAME (the host's): the read when it is due - arrival, its five minutes, the UTC day's turn, another
     * character or account - then the warnings and the risings said, and every change of standing handed on. `sense`
     * whether this character's Mining stands under Motherlode Sense (30 minutes' warning).
     */
    tick({ sense = false } = {}) {
      const t = nowS();
      const today = Math.floor(t / 86400);
      const who = `${me() ?? ''}|${character() ?? ''}`;
      if (!busy && (nowMs() - readAt >= MOTHERLODE_READ_MS || (state.day != null && state.day !== today) || who !== readFor)) void read();
      const ahead = motherlodeWarnS(sense);
      for (const l of state.lodes) {
        if (state.day !== today) break;
        const where = regionName(l.region), ore = oreName(l.material);
        if (t >= l.opensAt - ahead && t < l.opensAt && !said.has(`warn|${l.key}`)) {
          said.add(`warn|${l.key}`);
          say(MOTHERLODE_TEXT.warn(ore, where, Math.max(1, Math.ceil((l.opensAt - t) / 60))));
        }
        if (motherlodeOpen(l, t) && (l.struck ?? 0) < MOTHERLODE_STRIKERS && !said.has(`risen|${l.key}`)) {
          said.add(`risen|${l.key}`);
          say(MOTHERLODE_TEXT.risen(ore, where));
        }
      }
      settle(t);
    },
    /** A Watch receipt the relay handed this socket - kept, the newest for its pixel, where it is this account's. */
    watch(r) {
      const c = readWatchReceipt(r);
      if (!c || !c.signed || c.s !== me()) return false;
      const k = `${c.x},${c.y}`;
      if ((watches.get(k)?.i ?? -Infinity) >= c.i) return false;
      watches.delete(k);
      watches.set(k, { r, i: c.i });
      while (watches.size > MOTHERLODE_WATCH_KEPT) watches.delete(watches.keys().next().value);
      return true;
    },
    /** The receipt a strike begun now on pixel (`x`, `y`) carries - one fresh enough to stand at the act's end - or
     *  null: the relay has not seen this account there lately. */
    watchFor(x, y) {
      const w = watches.get(`${x},${y}`);
      return w && w.i >= nowS() + MOTHERLODE_ACT_S - MOTHERLODE_WATCH_S ? w.r : null;
    },
    /** The Motherlodes standing on pixel (`px`, `py`) now, for this account - the host stands them. */
    standingOn(px, py) {
      const t = nowS();
      return state.lodes.filter((l) => l.x === px && l.y === py && state.day === Math.floor(t / 86400) && standing(l, t));
    },
    /** Every Motherlode standing now, wherever it is - the compass's. */
    standingAll() {
      const t = nowS();
      return state.lodes.filter((l) => state.day === Math.floor(t / 86400) && standing(l, t));
    },
    /** A lode by its node key. */
    lodeOf: (key) => state.lodes.find((l) => l.key === key) ?? null,
    /** Whether this account's Motherlode today is found. */
    found: () => state.found,
    /** A strike's answer heard: the find, the count - and the change of standing handed on; then read again. */
    heard(data) {
      if (!data?.motherlode) return;
      state.found = typeof data.node === 'string' ? data.node : state.found;
      const l = state.lodes.find((x) => x.key === data.node);
      if (l && Number.isSafeInteger(data.lode?.struck)) l.struck = data.lode.struck;
      settle(nowS());
    },
  };
}
