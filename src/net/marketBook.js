// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET'S BOOK: what the
// Market tab reads and every act it asks (server-account/src/market.js,
// bible/06-Systems/Professions-Arc.md 26).
//
// THE BOARD'S SHAPE (net/noticeBook.js): a minute's cache of every read -
// a refusal too - a slow service showing the last good view, marked stale;
// every act one at a time, given up after the door's fifteen seconds and
// tried again on the words that mean "not yet" (offline, server).
//
// THE PROFESSIONS' SHAPE (net/profBook.js): what moves a piece in or out
// of the save is KEPT before it is asked (ASYNC NEVER DROPS) - a piece
// listed (taken out of the pack first, put back on a refusal), a piece
// bought here, a piece cancelled back, a piece collected - and let go on
// the answer BEFORE the piece is minted, so a mint that throws is never a
// second mint; a kept act whose answer was lost is asked again with the
// same id when the tab next settles, and the service's `repeat` answers it.
// ═══════════════════════════════════════════════════════════════════

import { MARKET_RID_RE } from './marketLaw.js';

export const MARKET_KEPT_KEY = 'prof5.kept';
export const MARKET_CACHE_MS = 60_000;
export const MARKET_TRIES = 3;
export const MARKET_RETRY_MS = Object.freeze([400, 1500]);
/** How long an order's, a fill's or a withdrawal's id is kept for a press asked again (the lost answer's re-ask). */
export const MARKET_ID_MS = 10 * 60_000;
const RETRY = Object.freeze(['offline', 'server']);
const SHUT = Object.freeze(['market-closed', 'prof-need-account', 'no-session', 'auth']);
/** What the Market tab says while a kept act waits for its answer. */
export const MARKET_KEPT_TEXT = 'The counting-house has your order and will settle it when it answers.';

const wait = (ms) => new Promise((res) => setTimeout(res, ms));
/** A request id: `k` and fifteen of [a-z0-9] (MARKET_RID_RE's shape). */
export function mintMarketRid() {
  const b = new Uint8Array(15);
  globalThis.crypto.getRandomValues(b);
  let s = 'k';
  for (const x of b) s += (x % 36).toString(36);
  return s;
}

/**
 * @param {{ door: any, storage?: Storage|null, character: () => (string|null), now?: () => number,
 *   marks?: { set?: (n: number) => void } | null, sleep?: (ms: number) => Promise<void> }} o
 */
export function createMarketBook({ door, storage = null, character, now = () => Date.now(), marks = null, sleep = wait }) {
  const state = {
    /** null until the service has answered; false while the market is shut to this account */
    open: /** @type {boolean|null} */ (null),
    balance: /** @type {number|null} */ (null),
    /** what is on its way to this account (the service's `road`) */
    road: /** @type {any[]} */ ([]),
    counts: { listings: 0, orders: 0 },
  };
  const account = () => { try { return door.account?.() ?? null; } catch { return null; } };
  const slot = () => `${account() ?? ''}|${character() ?? ''}`;

  // ─── THE KEPT ACTS ─────────────────────────────────────────────────
  let _memory = null;
  const table = () => {
    if (_memory) return _memory;
    try {
      const v = JSON.parse(storage?.getItem?.(MARKET_KEPT_KEY) ?? 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  };
  const writeTable = (t) => { try { storage?.setItem?.(MARKET_KEPT_KEY, JSON.stringify(t)); _memory = null; } catch { _memory = t; } };
  const KINDS = ['lists', 'buys', 'cancels', 'collects'];
  const keptOf = (key = slot()) => {
    const k = table()[key];
    return Object.fromEntries(KINDS.map((n) => [n, Array.isArray(k?.[n]) ? k[n] : []]));
  };
  const writeKept = (kept, key = slot()) => {
    const t = { ...table() };
    if (KINDS.some((n) => kept[n].length)) t[key] = kept; else delete t[key];
    writeTable(t);
  };
  const keep = (kind, entry) => { const k = keptOf(); k[kind] = [...k[kind].filter((x) => x.rid !== entry.rid), entry]; writeKept(k); };
  /** Let a kept act go; whether it was kept here (a repeat answered elsewhere mints nothing). */
  const letGo = (kind, rid) => { const k = keptOf(); const had = k[kind].some((x) => x.rid === rid); k[kind] = k[kind].filter((x) => x.rid !== rid); writeKept(k); return had; };

  /** One ask, up to MARKET_TRIES times with a wait between; the service's no is final at once. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < MARKET_TRIES; i++) {
      if (i > 0) await sleep(MARKET_RETRY_MS[Math.min(i - 1, MARKET_RETRY_MS.length - 1)]);
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !RETRY.includes(r?.error)) return r;
    }
    return r;
  }
  /** What every answer carries: the balance (the Marks book told too - PROF0 26), the road, the counts. */
  function heard(r) {
    if (SHUT.includes(r?.error)) state.open = false;
    const d = r?.ok ? r.data : null;
    if (!d) return r;
    state.open = true;
    if (Number.isSafeInteger(d.balance)) { state.balance = d.balance; try { marks?.set?.(d.balance); } catch { /* the Marks book's own */ } }
    if (Array.isArray(d.road)) state.road = d.road;
    if (d.counts) state.counts = { listings: d.counts.listings | 0, orders: d.counts.orders | 0 };
    return r;
  }
  const kept = (r) => RETRY.includes(r?.error);

  // ─── THE READS ─────────────────────────────────────────────────────
  const cache = new Map();
  const keyOf = (view, q) => [view, q.region, q.family ?? '', q.tier ?? '', q.material ?? ''].join('|');
  const pending = new Map();
  /** A view of the market: the minute's cache unless `force`; a failed read shows the last good one, stale. */
  async function read(view, q, { force = false } = {}) {
    const key = keyOf(view, q);
    const hit = cache.get(key);
    if (!force && hit && now() - hit.at < MARKET_CACHE_MS) return { ok: !hit.error, data: hit.data, error: hit.error, stale: hit.stale };
    if (pending.has(key)) return pending.get(key);
    const p = (async () => {
      const r = heard(await ask(() => door.read({ character: character(), view, ...q })));
      const e = { at: now(), data: r?.ok ? r.data : hit?.data ?? null, error: r?.ok ? null : (r?.error ?? 'server'), stale: !r?.ok && !!hit?.data };
      cache.set(key, e);
      return { ok: !!r?.ok, data: e.data, error: e.error, stale: e.stale };
    })();
    pending.set(key, p);
    try { return await p; } finally { pending.delete(key); }
  }
  const forget = () => cache.clear();

  // ─── THE ACTS ──────────────────────────────────────────────────────
  let _busy = null;
  /** One act at a time: a press while one is under way is that one. */
  const once = (fn) => (_busy ??= (async () => { try { return await fn(); } finally { _busy = null; } })());
  const ids = new Map();
  const idFor = (key) => {
    let v = ids.get(key);
    if (v && now() - v.at > MARKET_ID_MS) v = null;
    if (!v) ids.set(key, v = { id: mintMarketRid(), at: now() });
    return v.id;
  };
  const done = (key) => ids.delete(key);
  const answered = (r) => { if (r?.ok) forget(); return r; };

  /** A kept act asked (or asked again): let go on the answer, the piece minted once after; kept on silence. */
  async function keptAct(kind, entry, send, mint) {
    const r = heard(await ask(send));
    if (r?.ok) {
      const had = letGo(kind, entry.rid);
      forget();
      if (had && r.data?.piece) { try { mint?.(r.data.piece, kind); } catch (e) { console.warn('[market] mint', e); } }
      return { ok: true, data: r.data };
    }
    if (kept(r)) return { ok: false, kept: true, error: r?.error, text: MARKET_KEPT_TEXT };
    letGo(kind, entry.rid);
    return { ok: false, error: r?.error ?? 'server' };
  }

  const book = {
    state,
    read,
    cached: (view, q) => cache.get(keyOf(view, q))?.data ?? null,
    forget,
    /** Kept acts waiting for an answer. */
    get pending() { const k = keptOf(); return KINDS.reduce((n, kind) => n + k[kind].length, 0); },

    /**
     * LIST a material (`req.kind` 'material') or a piece: the piece taken out of the save first (`take`), kept with the
     * request, put back (`putBack`) if the service refuses it.
     * @param {any} req @param {{ item: any, where: string, take: () => boolean, putBack: (item: any, where: string) => void }|null} [piece]
     */
    list(req, piece = null) {
      return once(async () => {
        const rid = mintMarketRid();
        const body = { character: character(), ...req, rid };
        if (req.kind === 'piece') {
          if (!piece?.take?.()) return { ok: false, error: 'bad-provenance' };
          keep('lists', { rid, body, item: piece.item, where: piece.where });
          const r = heard(await ask(() => door.list(body)));
          if (r?.ok) { letGo('lists', rid); forget(); return { ok: true, data: r.data }; }
          if (kept(r)) return { ok: false, kept: true, error: r?.error, text: MARKET_KEPT_TEXT };
          letGo('lists', rid);
          try { piece.putBack(piece.item, piece.where); } catch (e) { console.warn('[market] put back', e); }
          return { ok: false, error: r?.error ?? 'server' };
        }
        const k = `list|${JSON.stringify(req)}`;
        const r = answered(heard(await ask(() => door.list({ ...body, rid: idFor(k) }))));
        if (r?.ok || !kept(r)) done(k);
        return r;
      });
    },
    /** BUY: a piece bought here minted on the answer (kept before asked); a material into the Stores (`store`). */
    buy(req, mint) {
      return once(async () => {
        const rid = mintMarketRid();
        const body = { character: character(), ...req, rid };
        keep('buys', { rid, body });
        return keptAct('buys', { rid }, () => door.buy(body), mint);
      });
    },
    /** CANCEL a listing: a piece answered back and minted; a material's units into the Stores. */
    cancel(listing, mint) {
      return once(async () => {
        const rid = mintMarketRid();
        keep('cancels', { rid, listing });
        return keptAct('cancels', { rid }, () => door.cancel(character(), listing, rid), mint);
      });
    },
    /** COLLECT a piece that has arrived (or come back). */
    collect(delivery, mint) {
      return once(async () => {
        const rid = mintMarketRid();
        keep('collects', { rid, delivery });
        return keptAct('collects', { rid }, () => door.collect(character(), delivery, rid), mint);
      });
    },
    /** A buy ORDER posted, a FILL, an order WITHDRAWN - each with its id kept for a press asked again. */
    order(req) {
      const k = `order|${JSON.stringify(req)}`;
      return once(async () => { const r = answered(heard(await ask(() => door.order({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    fill(req) {
      const k = `fill|${JSON.stringify(req)}`;
      return once(async () => { const r = answered(heard(await ask(() => door.fill({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    unorder(order) {
      const k = `unorder|${order}`;
      return once(async () => { const r = answered(heard(await ask(() => door.unorder(order, idFor(k))))); if (!kept(r)) done(k); return r; });
    },
    report: (listing) => once(async () => answered(heard(await ask(() => door.report(listing))))),
    remove: (listing) => once(async () => answered(heard(await ask(() => door.remove(listing))))),

    /**
     * SETTLE: every kept act asked again with its own id (a list whose answer never came, a buy, a cancel, a collect),
     * and every piece on the road that has arrived for this character collected - each minted once.
     * @param {(piece: any, why: string) => void} mint @param {(item: any, where: string) => void} putBack
     */
    settle(mint, putBack) {
      return once(async () => {
        const k = keptOf();
        let settled = 0;
        for (const l of k.lists) {
          const r = heard(await ask(() => door.list(l.body)));
          if (r?.ok) { letGo('lists', l.rid); settled++; }
          else if (!kept(r)) { letGo('lists', l.rid); try { putBack(l.item, l.where); } catch (e) { console.warn('[market] put back', e); } settled++; }
        }
        for (const b of k.buys) if ((await keptAct('buys', b, () => door.buy(b.body), mint)).ok) settled++;
        for (const c of k.cancels) if ((await keptAct('cancels', c, () => door.cancel(character(), c.listing, c.rid), mint)).ok) settled++;
        for (const c of k.collects) if ((await keptAct('collects', c, () => door.collect(character(), c.delivery, c.rid), mint)).ok) settled++;
        const me = character();
        for (const d of state.road.filter((x) => x.kind === 'piece' && x.ready && x.character === me)) {
          if (keptOf().collects.some((c) => c.delivery === d.id)) continue;
          const rid = mintMarketRid();
          keep('collects', { rid, delivery: d.id });
          if ((await keptAct('collects', { rid }, () => door.collect(me, d.id, rid), mint)).ok) settled++;
        }
        if (settled) forget();
        return { ok: true, settled };
      });
    },
    /** The kept acts of this slot (a test's and the tab's "waiting" line). */
    _kept: () => keptOf(),
    /** The rid shape, for a test. */
    ridOk: (r) => MARKET_RID_RE.test(r),
  };
  return book;
}
