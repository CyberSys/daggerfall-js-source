// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1a (2026-09-30, Mac: "Finish the seats") — THIS DEVICE'S SEATS:
// whether the seats are open to this account (the service's SEATS_OPEN),
// the seats the witnesses confirmed as the service last said them, and
// the seat this client stands in reported once a UTC day
// (bible/11-Multiplayer/Seats-Arc.md 3.2: "A client standing in a seat
// town online reports {key, name, region, tier, pixel} once a day").
//
// A seat is DRAWN off the client's own derivation (systems/townSeats.js):
// "a client never draws, lists or honours a seat its own derivation
// lacks" - the service's list says which of them the witnesses confirmed
// (what a pledge and a claim will need, SEAT1b-c). The service keeps the
// registry (server-account/src/townSeats.js); the law both ends read is
// net/townSeatLaw.js.
//
// SEAT1b: AND THIS DEVICE'S HALF OF INFLUENCE (Seats-Arc 4.1-4.2) - the
// standings at a seat, read for the board's Seat tab and kept a little;
// a pledge set or taken down; Tribute paid under its own request id; and
// the Watch's receipts the relay hands this socket (net/watchReceipt.js),
// kept - on the device, the signed-in account's alone, a seat's own
// pixel's alone - until the account service has counted them, a claim
// every SEAT_WATCH_CLAIM_EVERY_MS or as soon as a claim's worth is held.
//
// Pure - the door, the storage and the clock are handed in.
// ═══════════════════════════════════════════════════════════════════
import { SEAT_REPORT_EVERY_S, SEAT_WATCH_CLAIM_MAX, seatReportOf, seatKeyOk } from './townSeatLaw.js';
import { accountRefusalText } from './accountClient.js';
import { readWatchReceipt } from './watchReceipt.js';
import { mintMarksRid } from './marksBook.js';

/** How long a list read is kept before the next is asked, ms. */
export const SEAT_LIST_CACHE_MS = 5 * 60_000;
/** Where this device keeps the day it last reported each seat: { [key]: UTC day }. */
export const SEAT_REPORTED_KEY = 'seat1.reported';
/** The seats remembered - a player who wanders the Bay does not grow the key for ever. */
export const SEAT_REPORTED_MAX = 200;
/** The answers that say the seats are not open to THIS account now. */
const SHUT = Object.freeze(['seats-closed', 'no-session', 'auth']);
/** SEAT1b: how long a seat's standings are kept before they are asked again, ms. */
export const SEAT_STANDINGS_CACHE_MS = 30_000;
/** SEAT1b: where this device keeps the Watch's receipts not yet counted - `[{ r, s, i, e }]`, each its receipt, its
 *  account, and when it was issued and expires (the relay's clock). */
export const SEAT_WATCH_KEY = 'seat1.watch';
/** SEAT1b: the most kept - a day's ticks (the service counts no more than that an account a day anyway). */
export const SEAT_WATCH_HELD_MAX = 60;
/** SEAT1b: the longest a held receipt waits before the kept ones are claimed, ms. */
export const SEAT_WATCH_CLAIM_EVERY_MS = 10 * 60_000;
/** SEAT1b: the answers after which a claim's receipts are let go - counted, or refused for good (a watch claim answers
 *  each receipt's fate in its `why`, and none of them is mended by asking again). */
const WATCH_SETTLED = Object.freeze(['bad-watch', 'seats-need-account']);

/** A developer's chat word (SEAT0 3.2: "`/seat strike <key>`"): `{ op: 'strike', key }`, `{ error }` in words, or null
 *  when the line is not /seat. NEVER GUARDED HERE (RED1's law): whether this player may is the service's question. */
export const SEAT_USAGE = 'Usage: /seat strike <seat key> - the map id a developer sees on the seat.';
export function parseSeatCommand(text) {
  const m = /^\/seat(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, key, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const k = Number(key);
  if (String(op ?? '').toLowerCase() !== 'strike' || !/^\d+$/.test(key ?? '') || !seatKeyOk(k) || more.length) return { error: SEAT_USAGE };
  return { op: 'strike', key: k };
}

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountSeats>,
 *   storage?: { getItem: (k: string) => (string|null), setItem: (k: string, v: string) => void }|null,
 *   nowMs?: () => number,
 *   me?: () => (string|null), character?: () => (string|null), rid?: () => string,
 *   isSeatPixel?: (x: number, y: number) => boolean, relayNowS?: () => (number|null),
 * }} deps SEAT1b: `me` the signed-in account's id, `character` the character standing here, `rid` a fresh request id
 *   (the Marks' own shape), `isSeatPixel` whether this client's own derivation holds a seat at a map pixel, `relayNowS`
 *   the relay's clock (null unheard - a receipt's life is the relay's)
 */
export function createTownSeatBook({ door, storage = null, nowMs = () => Date.now(), me = () => null, character = () => null, rid = () => mintMarksRid(), isSeatPixel = () => false, relayNowS = () => null }) {
  /** whether the seats are open to this account, as the last read said: true, false, or null not yet asked */
  let open = null;
  let data = null, at = -Infinity, pending = null;
  /** @type {Map<number, string>} the confirmed seats' states, by key */
  let states = new Map();
  /** SEAT1c: each confirmed seat's holder and this week's battle at it, by key */
  let dress = new Map();
  let reported = null;
  const reportedTable = () => {
    if (reported) return reported;
    reported = {};
    try {
      const v = JSON.parse(storage?.getItem?.(SEAT_REPORTED_KEY) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) reported = v;
    } catch { /* a bad key reads as none */ }
    return reported;
  };
  const writeReported = (t) => {
    const keep = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, SEAT_REPORTED_MAX);
    reported = Object.fromEntries(keep);
    try { storage?.setItem?.(SEAT_REPORTED_KEY, JSON.stringify(reported)); } catch { /* this page keeps it */ }
  };
  const dayNow = () => Math.floor(nowMs() / 1000 / SEAT_REPORT_EVERY_S);
  /** SEAT1b: each seat's standings as last read, `{ at, data }` by key; the Tribute asked and its one request id */
  const standingsAt = new Map();
  /** @type {{ ask: string, rid: string }|null} */
  let tributeAsk = null;
  /** SEAT1b: the Watch's receipts held - read from the device once, kept in memory where the store refuses writes */
  let watchList = null, watchBusy = false;
  const watchHeld = () => {
    if (watchList) return watchList;
    watchList = [];
    try {
      const v = JSON.parse(storage?.getItem?.(SEAT_WATCH_KEY) ?? 'null');
      if (Array.isArray(v)) watchList = v.filter((w) => w && typeof w.r === 'string' && typeof w.s === 'string' && Number.isSafeInteger(w.i) && Number.isSafeInteger(w.e)).slice(-SEAT_WATCH_HELD_MAX);
    } catch { /* a bad key reads as none */ }
    return watchList;
  };
  const writeWatch = (list) => {
    watchList = list;
    try { storage?.setItem?.(SEAT_WATCH_KEY, JSON.stringify(list)); } catch { /* this page keeps them */ }
  };

  /** The confirmed seats: the last answer inside SEAT_LIST_CACHE_MS (a refusal too), else the service's. */
  function read({ force = false } = {}) {
    if (!force && nowMs() - at < SEAT_LIST_CACHE_MS) return Promise.resolve({ data, error: open === false ? 'seats-closed' : null });
    if (pending) return pending;
    pending = (async () => {
      let r;
      try { r = await door.list(); } catch { r = { ok: false, error: 'offline' }; }
      pending = null;
      // a session not yet there is asked again at the next ask (a player who signs in sees the seats then); any other
      // answer, a refusal too, holds the list's minutes
      at = r?.error === 'no-session' ? -Infinity : nowMs();
      if (r?.ok) {
        open = true; data = r.data;
        states = new Map((data?.seats ?? []).map((s) => [s.key, s.state]));
        dress = new Map((data?.seats ?? []).map((s) => [s.key, { holder: s.holder ?? null, battle: s.battle ?? null }]));
        return { data, error: null };
      }
      if (SHUT.includes(r?.error)) { open = false; data = null; states = new Map(); dress = new Map(); }
      return { data, error: r?.error ?? 'server' };
    })();
    return pending;
  }

  return {
    read,
    /** Whether the seats are open to this account, as the last read said (null before any). */
    get open() { return open; },
    /** A seat's state as the witnesses say it - 'confirmed', 'disputed', or null (unconfirmed, or not read). */
    stateOf: (key) => states.get(key) ?? null,
    /** The last list read, or null. */
    get data() { return data; },
    /** SEAT1c: a seat this client derived, dressed in what the service last said of it - its holder and this week's battle
     *  there (both null for an unheld, quiet one, or a seat not read yet). */
    dressed: (seat) => (seat ? { ...seat, holder: dress.get(seat.key)?.holder ?? null, battle: dress.get(seat.key)?.battle ?? null } : null),
    /** SEAT1c: the guildmaster gives up a Charter at its board - `{ ok, text }`, the list and standings read afresh after. */
    async relinquish(seat) {
      let r;
      try { r = await door.relinquish(character(), seat.key); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      if (r?.ok) at = -Infinity;
      return r?.ok ? { ok: true, text: `Your guild has given up the Charter of ${seat.name}.` } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /**
     * THE SEAT THIS CLIENT STANDS IN, REPORTED - once a UTC day a seat (this device's), only while the seats are open to
     * this account. Answers whether a report was sent. A refusal is quiet: the town is the same town either way.
     * @param {any} seat the client's own derivation (systems/townSeats.js)
     */
    async witness(seat) {
      const s = seatReportOf(seat);
      if (!s || open !== true) return false;
      const t = reportedTable();
      if (t[String(s.key)] === dayNow()) return false;
      t[String(s.key)] = dayNow();
      writeReported(t);
      try { await door.witness(s); } catch { /* the next day asks again */ }
      return true;
    },
    // ─── SEAT1b: INFLUENCE ─────────────────────────────────────────
    /** A seat's standings (`/v1/seats/standings`, with this character's own guild): the last answer inside
     *  SEAT_STANDINGS_CACHE_MS, else the service's. `{ data, error }`. */
    async standings(key, { force = false } = {}) {
      const kept = standingsAt.get(key);
      if (!force && kept && nowMs() - kept.at < SEAT_STANDINGS_CACHE_MS) return { data: kept.data, error: null };
      let r;
      try { r = await door.standings(key, character()); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) { standingsAt.set(key, { at: nowMs(), data: r.data }); return { data: r.data, error: null }; }
      if (SHUT.includes(r?.error)) open = false;
      return { data: kept?.data ?? null, error: r?.error ?? 'server' };
    },
    /** A pledge to `seat` for this week (an Officer's or the guildmaster's) - `{ ok, text }`, the standings read afresh after. */
    async pledge(seat) {
      let r;
      try { r = await door.pledge(character(), seat.key); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      return r?.ok ? { ok: true, text: `Your guild is pledged to ${seat.name} this week.` } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** The pledge in `region` taken down - `{ ok, text }`. */
    async unpledge(region) {
      let r;
      try { r = await door.pledge(character(), null, region); } catch { r = { ok: false, error: 'offline' }; }
      standingsAt.clear();
      return r?.ok ? { ok: true, text: 'The pledge is taken down.' } : { ok: false, text: accountRefusalText(r?.error) };
    },
    /** TRIBUTE: `marks` Drakes of the guild's treasury burnt on its pledge at `seat` (the guildmaster's) - `{ ok, text }`.
     *  ONE REQUEST ID A PAYMENT: the same seat and sum asked again after an answer that never came carries the same id, so
     *  the service answers it `repeat` rather than burning twice; any answer lets the id go. */
    async tribute(seat, marks) {
      const ask = `${seat.key}:${marks}`;
      if (tributeAsk?.ask !== ask) tributeAsk = { ask, rid: rid() };
      const id = tributeAsk.rid;
      let r;
      try { r = await door.tribute(character(), seat.key, marks, id); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || (r?.error && !['offline', 'server', 'timeout'].includes(r.error))) { if (tributeAsk?.rid === id) tributeAsk = null; }
      standingsAt.clear();
      if (!r?.ok) return { ok: false, text: accountRefusalText(r?.error) };
      return { ok: true, text: r.data?.repeat ? 'That Tribute was already paid.' : `Tribute paid to ${seat.name}: ${marks} Drakes burnt, ${r.data?.influence ?? marks / 10} influence.` };
    },
    /**
     * THE WATCH'S TICK, KEPT (net/online.js `onWatch`): a signed receipt for the signed-in account, in a seat's own pixel as
     * this client derives the seats, still alive by the relay's clock - kept on the device until it is counted. Answers
     * whether it was kept. Nothing is kept while the seats are shut to this account.
     */
    keepWatch(r) {
      const c = readWatchReceipt(r);
      const t = relayNowS();
      if (!c || !c.signed || open === false || c.s !== me() || !isSeatPixel(c.x, c.y) || (t != null && c.e <= t)) return false;
      const list = watchHeld().filter((w) => t == null || w.e > t);   // the dead let go as a new one comes
      if (list.some((w) => w.r === r)) return false;
      list.push({ r, s: c.s, i: c.i, e: c.e });
      writeWatch(list.slice(-SEAT_WATCH_HELD_MAX));
      return true;
    },
    /** How many receipts this device holds for the signed-in account. */
    watchHeldCount: () => watchHeld().filter((w) => w.s === me()).length,
    /**
     * THE KEPT TICKS CLAIMED (`/v1/seats/watch`) - the signed-in account's, SEAT_WATCH_CLAIM_MAX at a time, once a claim's
     * worth is held or the oldest has waited SEAT_WATCH_CLAIM_EVERY_MS (`force` now). An answer lets the claimed ones go
     * (counted or not - each receipt's fate is the service's, never mended by asking again); no answer keeps them.
     * Answers the service's `{ counted, why }`, or null for no claim.
     */
    async claimWatch({ force = false } = {}) {
      if (watchBusy || open !== true) return null;
      const who = me();
      const t = relayNowS();
      const mine = watchHeld().filter((w) => w.s === who && (t == null || w.e > t));
      if (!mine.length) return null;
      const oldest = Math.min(...mine.map((w) => w.i)) * 1000;
      if (!force && mine.length < SEAT_WATCH_CLAIM_MAX && (t == null ? nowMs() : t * 1000) - oldest < SEAT_WATCH_CLAIM_EVERY_MS) return null;
      const batch = mine.slice(0, SEAT_WATCH_CLAIM_MAX);
      watchBusy = true;
      let r;
      try { r = await door.watch(character(), batch.map((w) => w.r)); } catch { r = { ok: false, error: 'offline' }; } finally { watchBusy = false; }
      const settled = r?.ok || WATCH_SETTLED.includes(r?.error) || SHUT.includes(r?.error);
      if (settled) {
        const gone = new Set(batch.map((w) => w.r));
        writeWatch(watchHeld().filter((w) => !gone.has(w.r)));
        if (r?.ok) standingsAt.clear();
      }
      return r?.ok ? r.data : null;
    },
    /** The chat's `/seat strike <key>`: a developer's strike - the list read afresh after. */
    async strike(key) {
      let r;
      try { r = await door.strike(key); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) { at = -Infinity; return { ok: true, text: `Seat ${key} is struck from the registry (${r.data?.reports ?? 0} reports).` }; }
      return { ok: false, text: accountRefusalText(r?.error) };
    },
  };
}
