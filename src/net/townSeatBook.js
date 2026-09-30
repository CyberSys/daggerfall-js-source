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
// Pure - the door, the storage and the clock are handed in.
// ═══════════════════════════════════════════════════════════════════
import { SEAT_REPORT_EVERY_S, seatReportOf, seatKeyOk } from './townSeatLaw.js';
import { accountRefusalText } from './accountClient.js';

/** How long a list read is kept before the next is asked, ms. */
export const SEAT_LIST_CACHE_MS = 5 * 60_000;
/** Where this device keeps the day it last reported each seat: { [key]: UTC day }. */
export const SEAT_REPORTED_KEY = 'seat1.reported';
/** The seats remembered - a player who wanders the Bay does not grow the key for ever. */
export const SEAT_REPORTED_MAX = 200;
/** The answers that say the seats are not open to THIS account now. */
const SHUT = Object.freeze(['seats-closed', 'no-session', 'auth']);

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
 * }} deps
 */
export function createTownSeatBook({ door, storage = null, nowMs = () => Date.now() }) {
  /** whether the seats are open to this account, as the last read said: true, false, or null not yet asked */
  let open = null;
  let data = null, at = -Infinity, pending = null;
  /** @type {Map<number, string>} the confirmed seats' states, by key */
  let states = new Map();
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
        return { data, error: null };
      }
      if (SHUT.includes(r?.error)) { open = false; data = null; states = new Map(); }
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
    /** The chat's `/seat strike <key>`: a developer's strike - the list read afresh after. */
    async strike(key) {
      let r;
      try { r = await door.strike(key); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok) { at = -Infinity; return { ok: true, text: `Seat ${key} is struck from the registry (${r.data?.reports ?? 0} reports).` }; }
      return { ok: false, text: accountRefusalText(r?.error) };
    },
  };
}
