// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MARKS1 (2026-09-28) — THIS DEVICE'S MARKS: the balance as the account
// service last said it, the Bank's sale carried to its end, and a guild's
// Marks moved. The service keeps every Mark (server-account/src/marks.js);
// this is what a client may do with them, and the law is
// src/net/marksLaw.js.
//
// ASYNC NEVER DROPS. A sale burns Marks on the service and pays gold into
// the save; the two can part only if the answer is lost. So every act
// carries its own request id, and a sale whose answer did not come is
// KEPT (MARKS_PENDING_KEY) - asked again with the same id, which the
// service answers with the sale it already made (`repeat`), never a
// second one - until it settles, this session or the next the same
// character plays. The gold is paid then, into the account at the bank
// the sale was made at: a sale lost is never gold lost, and never gold
// twice.
//
// Pure - the door, the store and the ids are handed in - so the pins drive
// it without a network.
// ═══════════════════════════════════════════════════════════════════
import { MARKS_BANK, MARKS_MOVE_MAX, marksAmountOk, marksText, exchangeGold } from './marksLaw.js';
import { accountRefusalText } from './accountClient.js';

/** A sale whose answer did not come, kept to be asked again. */
export const MARKS_PENDING_KEY = 'marks1.pendingSale';
/** How many times one press asks before the sale is left to settle later. */
export const MARKS_TRIES = 3;
/** The answers a sale is asked again after (the service did not say no): the network, the service's own fault. */
const RETRY = Object.freeze(['offline', 'server']);

/** The words. */
export const MARKS_TEXT = Object.freeze({
  struck: (n, balance) => `${marksText(n)} struck to your account. You hold ${marksText(balance)}.`,
  capped: 'The gate is on your record. The counting-houses strike Marks for two gates a day.',
  sold: (marks, gold) => `The Bank buys ${marksText(marks)} for ${gold.toLocaleString('en-US')} gold, paid into your account here.`,
  kept: 'The Bank has your Marks and will pay when the counting-house answers.',
  settled: (marks, gold) => `The Bank has finished counting: ${marksText(marks)} bought for ${gold.toLocaleString('en-US')} gold, paid into your account.`,
  movedIn: (marks) => `${marksText(marks)} put in.`,
  movedOut: (marks) => `${marksText(marks)} taken out.`,
});

/** A request id: `m` and fifteen of base 36, from the handed-in randomness (crypto's by default). */
export function mintMarksRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `m${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountMarks>,
 *   store?: { get: (k: string) => any, set: (k: string, v: any) => void }|null,
 *   character?: () => (string|null),
 *   rid?: () => string,
 * }} deps `character` the character this device plays now (a kept sale pays only it)
 */
export function createMarksBook({ door, store = null, character = () => null, rid = () => mintMarksRid() }) {
  const state = { balance: /** @type {number|null} */ (null), today: /** @type {any} */ (null), open: /** @type {boolean|null} */ (null) };
  let _memory = null;   // the kept sale, when the store refuses writes
  const kept = () => { try { const v = store?.get(MARKS_PENDING_KEY); return v && typeof v === 'object' ? v : _memory; } catch { return _memory; } };
  const keep = (v) => { _memory = v; try { store?.set(MARKS_PENDING_KEY, v); } catch { /* memory holds it */ } };

  const noteAnswer = (data) => { if (Number.isSafeInteger(data?.balance)) state.balance = data.balance; };

  /** Asks one act until the service answers it (or says no), at most MARKS_TRIES times. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < MARKS_TRIES; i++) {
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !RETRY.includes(r?.error)) return r;
    }
    return r;
  }

  return {
    state,
    /** The balance and today's counts, from the service; a closed currency or a guest reads `open` false. */
    async refresh() {
      const r = await ask(() => door.balance());
      if (r?.ok) { state.open = true; state.balance = r.data.balance; state.today = r.data.today ?? null; }
      else if (r?.error === 'marks-closed' || r?.error === 'marks-need-account') { state.open = false; state.balance = null; }
      return r;
    },
    /** The balance a gate's strike or an account card answered. */
    set(balance) { if (Number.isSafeInteger(balance)) { state.balance = balance; state.open = true; } },
    /** The line a gate claim's `marks` says, or null for none (a service from before it, or Marks not this account's). */
    strikeLine(marks) {
      if (!marks || typeof marks !== 'object') return null;
      if (Number.isSafeInteger(marks.balance)) this.set(marks.balance);
      if (marks.struck > 0) return MARKS_TEXT.struck(marks.struck, marks.balance);
      return marks.why === 'cap' ? MARKS_TEXT.capped : null;
    },

    /**
     * SELL `marks` TO THE BANK: burnt on the service, then `credit(gold, where)` - the host's, into the account at this
     * bank. A sale not answered is kept, with `where`, and paid when it settles.
     * @returns {Promise<{ ok: boolean, text: string, gold?: number }>}
     */
    async sell(marks, credit, where = null) {
      if (!marksAmountOk(marks, MARKS_BANK.perDay)) return { ok: false, text: accountRefusalText('bad-marks') };
      if (kept()) return { ok: false, text: MARKS_TEXT.kept };   // one sale at a time - the last must settle first
      const sale = { rid: rid(), marks, character: character(), where };
      keep(sale);
      const r = await ask(() => door.exchange(marks, sale.rid));
      if (r?.ok) {
        keep(null);
        noteAnswer(r.data);
        const gold = Number.isSafeInteger(r.data?.gold) ? r.data.gold : exchangeGold(marks);
        credit(gold, where);
        return { ok: true, gold, text: MARKS_TEXT.sold(marks, gold) };
      }
      if (RETRY.includes(r?.error)) return { ok: false, text: MARKS_TEXT.kept };
      keep(null);   // the service said no: nothing burnt, nothing owed
      return { ok: false, text: accountRefusalText(r?.error) };
    },
    /** A kept sale, asked again - paid to `credit` only while the character that made it plays. Answers the line, or null. */
    async settle(credit) {
      const sale = kept();
      if (!sale || typeof sale.rid !== 'string' || !Number.isSafeInteger(sale.marks)) { if (sale) keep(null); return null; }
      if (sale.character != null && sale.character !== character()) return null;   // another character's gold waits for it
      const r = await ask(() => door.exchange(sale.marks, sale.rid));
      if (r?.ok) {
        keep(null);
        noteAnswer(r.data);
        const gold = Number.isSafeInteger(r.data?.gold) ? r.data.gold : exchangeGold(sale.marks);
        credit(gold, sale.where ?? null);
        return MARKS_TEXT.settled(sale.marks, gold);
      }
      if (!RETRY.includes(r?.error)) keep(null);
      return null;
    },
    /** Whether a sale waits to settle. */
    get pending() { return !!kept(); },

    /** A guild's Marks treasury: in (any member) or out (the guildmaster's), from and to this account's balance. */
    async moveGuild(characterId, marks, out = false) {
      if (!marksAmountOk(marks, MARKS_MOVE_MAX)) return { ok: false, text: accountRefusalText('bad-marks') };
      const id = rid();
      const r = await ask(() => (out ? door.guildWithdraw(characterId, marks, id) : door.guildDeposit(characterId, marks, id)));
      if (r?.ok) { noteAnswer(r.data); return { ok: true, guildMarks: r.data.guildMarks, text: out ? MARKS_TEXT.movedOut(marks) : MARKS_TEXT.movedIn(marks) }; }
      return { ok: false, error: r?.error ?? 'server', text: accountRefusalText(r?.error) };
    },
  };
}
