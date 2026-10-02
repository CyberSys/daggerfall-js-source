// @ts-check
// ARENA4 (2026-10-02): THE BOUTS' RECEIPTS THIS DEVICE CARRIES TO THE ACCOUNT SERVICE - the gate's carrier's law
// (net/gateClaims.js) for the arena's signature (net/arenaReceipt.js). Design: bible/11-Multiplayer/Arena.md "7. Online".
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS, THIS FILE CARRIES. A receipt the relay hands this socket at a bout's end
// (net/arenaLink.js `rc`) is kept on the device (ARENA_CLAIMS_KEY), one a bout, and offered to `/v1/arena/claim`
// (server-account/src/arena.js claimArena) at once and again while kept, at most every ARENA_CLAIM_RETRY_MS. An answer
// that SETTLES it lets it go: counted, counted before (the other fighter carried it first - a bout between players is
// one row whoever claims it), a ladder win out of the climb's order, not a receipt the relay signed. One that does not
// keeps it: no session yet, the service without the relay's public half, a guest who may still register, the network,
// a refusal the service can mend (its key, a clock). An unsigned receipt is never kept - the service could only decline
// it - and an expired one is let go unasked.
//
// THE DEVICE IS NOT THE ACCOUNT (AUDIT WB A9's law): only the signed-in account's receipts are offered - a ladder
// receipt names it (`s`), a players' one holds it among its two (`f`).
//
// Pure - the call, the store and the clocks are handed in - so the pins drive it without a network.
//
// Not a DFU member. Ledger A (ARENA).
import { readArenaReceipt } from './arenaReceipt.js';

/** The device's receipts not yet settled with the account service. */
export const ARENA_CLAIMS_KEY = 'arena4.claims';
/** The most it keeps; the oldest go first past this. */
export const ARENA_CLAIMS_MAX = 32;
/** The least time between two offers of what is kept, ms. */
export const ARENA_CLAIM_RETRY_MS = 5 * 60 * 1000;
/** The refusals of a receipt the service can mend - kept for the week the receipt carries. */
export const ARENA_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** What the service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function arenaClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';   // counted, counted before, out of order
  return answer?.error === 'receipt' && !ARENA_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}
/** Whose receipt it is: does it name `me`. */
export const arenaReceiptIsMine = (c, me) => !!c && !!me && (c.a === 'l' ? c.s === me : Array.isArray(c.f) && c.f.includes(me));

/**
 * @param {{
 *   claim: (receipt: string) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => (number|null), nowMs?: () => number, me?: () => (string|null),
 *   onCounted?: (data: any) => void, onGuest?: () => void,
 * }} deps `claim` is net/accountClient.js accountArena's - `{ ok, data }` or `{ ok: false, error, why? }`; `onCounted`
 *   told each answer that recorded a bout (its rating, its ladder, its points); `onGuest` once a receipt a guest carried
 */
export function createArenaClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), me = () => null, onCounted = () => {}, onGuest = () => {} }) {
  let busy = false, again = false, lastAt = -Infinity, lastMe;
  const settled = new Set(), guestSaid = new Set();
  const live = (r) => { const c = typeof r === 'string' ? readArenaReceipt(r) : null; const t = nowS(); return c && c.signed && (t == null || c.e > t) ? c : null; };
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(ARENA_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((r) => live(r));
  }
  const keep = (list) => { memory = list; try { store?.set(ARENA_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let recorded = 0;
    try {
      const list = kept();
      keep(list);
      const mine = me();
      for (const r of list) {
        if (!arenaReceiptIsMine(live(r), mine)) continue;
        let answer;
        try { answer = await claim(r); } catch { answer = { ok: false, error: 'offline' }; }
        if (answer?.ok && answer.data?.recorded === true) { recorded++; onCounted(answer.data); }
        else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(r)) { guestSaid.add(r); onGuest(); }
        if (arenaClaimVerdict(answer) === 'done') { settled.add(r); keep(kept().filter((k) => k !== r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket: kept (one a bout - the relay may hand the same one again on a
     *  reconnect) and offered at once. Answers whether it is kept. */
    add(r) {
      const c = live(r);
      if (!c || settled.has(r)) return false;
      const list = kept();
      if (!list.some((k) => k === r || readArenaReceipt(k)?.j === c.j)) keep([...list, r].slice(-ARENA_CLAIMS_MAX));
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once ARENA_CLAIM_RETRY_MS has passed, and at once when another account
     *  signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= ARENA_CLAIM_RETRY_MS;
      const mine = me(), signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((r) => arenaReceiptIsMine(live(r), mine))) { lastAt = t; return false; }
      void flush();
      return true;
    },
    flush,
    kept,
  };
}
