// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE SIEGE
// RECEIPTS THIS DEVICE CARRIES TO THE ACCOUNT SERVICE - the gate's claims' twin (net/gateClaims.js). A fighter's `s1`
// receipt (net/siegeReceipt.js), handed by the relay at the battle's end, is the battle's result for the service and the
// fighter's own Honours claim; it is kept on the device (SIEGE_CLAIMS_KEY) and offered (`/v1/seats/siege/claim`,
// net/townSeatBook.js claimSiege) at once, and again while it is kept, at most every SIEGE_CLAIM_RETRY_MS.
//
// AN ANSWER THAT SETTLES IT lets it go: claimed (with Honours or without), claimed before (`honours-twice`), its battle
// void or gone (`battle-none`), not a receipt the relay signed (`receipt`, but for the refusals the SERVICE can mend:
// its public half not the relay's pair, or a clock - `signature`, `verify-threw`, `future`, `clock`). Anything else keeps
// it: the network, no session yet, the service without its key, another account signed in here (`not-yours` - it waits
// for its own). A receipt carries a week and an expired one is let go unasked; an UNSIGNED one is never kept.
//
// THE DEVICE IS NOT THE ACCOUNT: receipts are kept with the account they name, and only the signed-in account's are
// offered. A store that refuses writes keeps the list in this session's memory.
//
// Pure - the call, the store and the clocks are handed in.
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { readSiegeReceipt, readRoyalReceipt } from './siegeReceipt.js';

/** The device's siege receipts not yet settled with the account service. */
export const SIEGE_CLAIMS_KEY = 'seat2a.siegeClaims';
/** The most it keeps - a season's worth of battles. */
export const SIEGE_CLAIMS_MAX = 16;
/** The least time between two offers of what is kept, ms. */
export const SIEGE_CLAIM_RETRY_MS = 10 * 60 * 1000;
/** A `receipt` refusal the service can mend - kept, and offered again. */
const MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);
/** Whether an answer settles a receipt (let go) or keeps it. */
export function siegeClaimSettles(r) {
  if (r?.ok) return true;
  if (r?.error === 'honours-twice' || r?.error === 'battle-none') return true;
  if (r?.error === 'receipt') return !MENDABLE.includes(r?.why);
  return false;
}

/**
 * THE CARRIER. `claim(receipt)` the book's call (`{ ok, ... }` or `{ ok: false, error, why? }`), `me()` the signed-in
 * account's id (null: none), `nowMs()`, `storage` (a Storage, or null), `onClaimed(answer, claims)` said for a settled
 * claim that the service took. CROWN1 part two: the same carrier for a Royal Tourney's bouts (createRoyalClaims) - its
 * store's key, its receipt's reader, its own settling answers and how many it keeps.
 */
export function createSiegeClaims({ claim, me = () => null, nowMs = () => Date.now(), storage = null, onClaimed = null,
  storeKey = SIEGE_CLAIMS_KEY, read = readSiegeReceipt, settles = siegeClaimSettles, max = SIEGE_CLAIMS_MAX }) {
  /** @type {string[]} */
  let kept = [];
  try { const v = JSON.parse(storage?.getItem(storeKey) ?? '[]'); if (Array.isArray(v)) kept = v.filter((x) => typeof x === 'string' && read(x)); } catch { kept = []; }
  let offeredAt = -Infinity;
  let busy = false;
  const save = () => { try { storage?.setItem(storeKey, JSON.stringify(kept)); } catch { /* memory keeps it */ } };
  const live = (r, nowS) => { const c = read(r); return !!c && c.signed && c.e > nowS; };
  return {
    /** The receipts kept. */
    list: () => kept.slice(),
    /** A receipt the relay handed this socket: kept (signed, unexpired, not already held), and offered at once. */
    keep(r) {
      const nowS = Math.floor(nowMs() / 1000);
      if (!live(r, nowS) || kept.includes(r)) return false;
      kept.push(r);
      if (kept.length > max) kept = kept.slice(-max);
      save();
      offeredAt = -Infinity;
      return true;
    },
    /** Offer what is kept, the signed-in account's own, unless offered within SIEGE_CLAIM_RETRY_MS (`force`: now).
     *  Answers how many settled. */
    async offer({ force = false } = {}) {
      const now = nowMs(), nowS = Math.floor(now / 1000);
      if (busy || (!force && now - offeredAt < SIEGE_CLAIM_RETRY_MS)) return 0;
      const who = me();
      if (!who) return 0;
      busy = true; offeredAt = now;
      let settled = 0;
      try {
        kept = kept.filter((r) => live(r, nowS));
        for (const r of kept.slice()) {
          if (read(r)?.s !== who) continue;
          let a;
          try { a = await claim(r); } catch { a = { ok: false, error: 'offline' }; }
          if (!settles(a)) continue;
          kept = kept.filter((x) => x !== r);
          settled++;
          if (a?.ok) onClaimed?.(a, r);
        }
      } finally { busy = false; save(); }
      return settled;
    },
  };
}

// ─── CROWN1 part two: A ROYAL TOURNEY'S BOUTS (Seats-Arc 7.6) ─────────────────────────────────────────────────────
/** The device's bout receipts not yet settled with the account service. */
export const ROYAL_CLAIMS_KEY = 'crown1.royalClaims';
/** The most it keeps - a busy week of bouts won. */
export const ROYAL_CLAIMS_MAX = 40;
/** Whether an answer settles a bout's receipt: counted or not, the tourney gone or over, a receipt that is not the
 *  relay's (but for the refusals the service can mend). */
export function royalClaimSettles(r) {
  if (r?.ok) return true;
  if (r?.error === 'royal-none' || r?.error === 'royal-over') return true;
  if (r?.error === 'receipt') return !MENDABLE.includes(r?.why);
  return false;
}
/** THE BOUTS' CARRIER - createSiegeClaims's, over `t1` receipts (`/v1/seats/royal/claim`). */
export const createRoyalClaims = (o) => createSiegeClaims({ ...o, storeKey: ROYAL_CLAIMS_KEY, read: readRoyalReceipt, settles: royalClaimSettles, max: ROYAL_CLAIMS_MAX });
