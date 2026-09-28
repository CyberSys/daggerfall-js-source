// @ts-check
// RAID4 (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric +
// armor sets"): THE RAID RECEIPTS THIS DEVICE CARRIES TO THE ACCOUNT SERVICE, and the towns defended as the cards say
// them. The gate's carrier's twin (net/gateClaims.js), rung for rung. Design: bible/03-World/Raiding-Parties.md,
// "The rewards (RAID4)".
//
// THE RELAY SIGNS, THE ACCOUNT SERVICE COUNTS AND PAYS, THIS FILE CARRIES. A receipt the relay hands this socket at a
// town's cleanse (systems/raidingParties.js raidRelayWord's `rc`, the same one again after a reconnect) is kept on the
// device (RAID_CLAIMS_KEY) WITH THE CHARACTER THAT FOUGHT IT - the service pays that character its Renown - and offered
// to the account service (`/v1/raid/claim` - server-account/src/raids.js claimRaid) at once, and again while it is
// kept, at most every RAID_CLAIM_RETRY_MS. An answer that SETTLES it lets it go: counted (its Renown handed to the page,
// `onRecorded`), counted before, the day's raids already counted, not a receipt the relay signed, no character to pay.
// One that does not keeps it: no session yet, the service without its public half, a guest who may still register,
// the network, and a refusal the SERVICE can mend (its public half not the relay's pair, a clock off - the gate's
// AUDIT WB A5). An expired receipt is let go unasked; an UNSIGNED one (a relay with no key) is never kept.
//
// THE DEVICE IS NOT THE ACCOUNT (AUDIT WB A9's law): only the signed-in account's receipts are offered (`me`).
//
// Pure - the call, the store and the clocks are handed in - so the pins drive it without a network.
//
// Not a DFU member. Ledger A (RAID1's row).
import { readRaidReceipt } from './raidReceipt.js';

/** The device's raid receipts not yet settled with the account service: `[{ r, ch, nm }]` - the receipt, the
 *  character that fought it, its name. */
export const RAID_CLAIMS_KEY = 'raid4.raidClaims';
/** The most it keeps - a few days of raids; the oldest go first past this. */
export const RAID_CLAIMS_MAX = 24;
/** The least time between two offers of what is kept, ms. */
export const RAID_CLAIM_RETRY_MS = 10 * 60 * 1000;
/** How often a frame asks who is signed in (AUDIT WBX W4's law). */
export const RAID_ME_POLL_MS = 1000;

/** The words. */
export const RAID_CLAIM_TEXT = Object.freeze({
  recorded: (n, xp) => `The town will remember you. Towns defended: ${n}.${xp > 0 ? ` +${xp} Renown XP.` : ''}`,
  guest: 'This town is not on your record yet: only registered accounts keep one. Add a username this week and it counts.',
  dayFull: 'You have been counted for every raid one day allows.',
});

/** The refusals of a receipt the service can mend (the gate's GATE_CLAIM_MENDABLE): kept for the week it carries. */
export const RAID_CLAIM_MENDABLE = Object.freeze(['signature', 'verify-threw', 'future', 'clock']);

/** What the account service's answer does to a kept receipt: 'done' (let it go) or 'keep'. */
export function raidClaimVerdict(answer) {
  if (answer?.ok) return answer.data?.why === 'guest' ? 'keep' : 'done';   // counted, counted before, the day full
  if (answer?.error === 'renown-character') return 'done';   // no character to pay - it never will be
  return answer?.error === 'receipt' && !RAID_CLAIM_MENDABLE.includes(answer.why) ? 'done' : 'keep';
}

/** The towns defended as the account card says them - "3", "None yet" - or null for no record. */
export function raidRecordText(rec) {
  if (!rec || typeof rec !== 'object' || !Number.isSafeInteger(rec.defended) || rec.defended < 0) return null;
  return rec.defended > 0 ? String(rec.defended) : 'None yet';
}

/**
 * @param {{
 *   claim: (receipt: string, character: string, name: string|null) => Promise<any>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   nowS?: () => number, nowMs?: () => number, say?: (text: string) => void,
 *   onRecorded?: (data: any, entry: { r: string, ch: string, nm: string|null }) => void,
 *   me?: () => (string|null),
 * }} deps `claim` is net/accountClient.js accountRaids' - `{ ok, data }` or `{ ok: false, error, why? }`, never a
 *   throw; `me` the signed-in account's id; `onRecorded` hears each counted receipt's answer (its Renown and order)
 */
export function createRaidClaims({ claim, store = null, nowS = () => Math.floor(Date.now() / 1000), nowMs = () => Date.now(), say = () => {}, onRecorded = () => {}, me = () => null }) {
  let busy = false, again = false, lastAt = -Infinity;
  let lastMe, meAt = -Infinity;
  const settled = new Set(), guestSaid = new Set();
  let dayFullSaid = false;
  const live = (r) => { const c = typeof r === 'string' ? readRaidReceipt(r) : null; return c && c.signed && c.e > nowS() ? c : null; };
  const entry = (e) => (e && typeof e === 'object' && live(e.r) && typeof e.ch === 'string' && e.ch ? e : null);
  let memory = [];
  function kept() {
    let v;
    try { v = store ? store.get(RAID_CLAIMS_KEY) : undefined; } catch { v = undefined; }
    return (Array.isArray(v) ? v : v === undefined ? memory : []).filter((e) => entry(e));
  }
  const keep = (list) => { memory = list; try { store?.set(RAID_CLAIMS_KEY, list); } catch { /* memory holds it */ } };

  async function flush() {
    if (busy) { again = true; return 0; }
    busy = true;
    lastAt = nowMs();
    let recorded = 0;
    try {
      const list = kept();
      keep(list);   // the expired go unasked
      const mine = me();
      for (const e of list) {
        if (!mine || live(e.r)?.s !== mine) continue;   // another account's waits for its own sign-in
        let answer;
        try { answer = await claim(e.r, e.ch, e.nm ?? null); } catch { answer = { ok: false, error: 'offline' }; }
        if (answer?.ok && answer.data?.recorded === true) {
          recorded++;
          const n = Number.isSafeInteger(answer.data.defended) ? answer.data.defended : null;
          const xp = Number.isSafeInteger(answer.data.renown?.credited) ? answer.data.renown.credited : 0;
          if (n != null) say(RAID_CLAIM_TEXT.recorded(n, xp));
          onRecorded(answer.data, e);
        } else if (answer?.ok && answer.data?.why === 'guest' && !guestSaid.has(e.r)) {
          guestSaid.add(e.r);
          say(RAID_CLAIM_TEXT.guest);
        } else if (answer?.ok && answer.data?.why === 'day-full' && !dayFullSaid) {
          dayFullSaid = true;
          say(RAID_CLAIM_TEXT.dayFull);
        }
        if (raidClaimVerdict(answer) === 'done') { settled.add(e.r); keep(kept().filter((k) => k.r !== e.r)); }
      }
    } finally { busy = false; }
    if (again) { again = false; void flush(); }
    return recorded;
  }

  return {
    /** A receipt the relay handed this socket, with the character that fought it: kept (one a raid AND account - the
     *  relay re-sends the same one) and offered at once. Answers whether it is kept. */
    add(r, character, name = null) {
      const c = live(r);
      if (!c || settled.has(r) || typeof character !== 'string' || !character) return false;
      const list = kept();
      if (!list.some((k) => { const o = readRaidReceipt(k.r); return k.r === r || (o?.w === c.w && o?.s === c.s); })) {
        keep([...list, { r, ch: character, nm: typeof name === 'string' ? name : null }].slice(-RAID_CLAIMS_MAX));
      }
      void flush();
      return true;
    },
    /** A frame: what is kept is offered again once RAID_CLAIM_RETRY_MS has passed since the last offer - the first frame
     *  of a session at once, and the first after another account signs in. */
    tick() {
      if (busy) return false;
      const t = nowMs(), due = t - lastAt >= RAID_CLAIM_RETRY_MS;
      if (!due && t - meAt < RAID_ME_POLL_MS) return false;
      meAt = t;
      const mine = me(), signedIn = mine !== lastMe;
      lastMe = mine;
      if (!signedIn && !due) return false;
      if (!kept().some((e) => mine && live(e.r)?.s === mine)) { lastAt = nowMs(); return false; }
      void flush();
      return true;
    },
    flush,
    /** What is kept, for the tests and the stats. */
    kept,
  };
}
