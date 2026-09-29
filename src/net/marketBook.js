// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET'S BOOK: what the
// Market tab reads and every act it asks (server-account/src/market.js,
// bible/06-Systems/Professions-Arc.md 26).
//
// THE BOARD'S SHAPE (net/noticeBook.js): a minute's cache of every read -
// a refusal too - a slow service showing the last good view, marked stale;
// every act one at a time, given up after the door's fifteen seconds and
// tried again on the words that mean "not yet" (offline, server, the
// account gate's minute spent), and kept through the ones that mean "not
// now" (no session yet, a session let go - AUDIT 30 C1).
//
// THE PROFESSIONS' SHAPE (net/profBook.js): what moves a piece in or out
// of the save is KEPT before it is asked (ASYNC NEVER DROPS) - a piece
// listed (taken out of the pack first, put back on a refusal), a piece
// bought here, a piece cancelled back, a piece collected - and let go on
// the answer BEFORE the piece is minted, so a mint that throws is never a
// second mint; a kept act whose answer was lost is asked again with the
// same id when the tab next settles, and the service's `repeat` answers it.
//
// PROF5b: an auction posted is a listed piece's act (kept, put back on a refusal) with its own route; a bid is an
// order's (its id kept for a press asked again - it moves Marks, and the won piece comes by delivery).
// ═══════════════════════════════════════════════════════════════════

import { MARKET_RID_RE } from './marketLaw.js';

export const MARKET_KEPT_KEY = 'prof5.kept';
export const MARKET_CACHE_MS = 60_000;
export const MARKET_TRIES = 3;
export const MARKET_RETRY_MS = Object.freeze([400, 1500]);
/** How long an order's, a fill's or a withdrawal's id is kept for a press asked again (the lost answer's re-ask). */
export const MARKET_ID_MS = 10 * 60_000;
/** A shut market is asked again this often (AUDIT 30 U11: a shut read hid the tab for the session's life). */
export const MARKET_CLOSED_RECHECK_MS = 300_000;
/** The answers an act is asked again after: the network, the service's own fault, the account gate's minute spent
 *  (AUDIT 30 C1: its 429 comes before any route, so it says nothing about the act). */
const RETRY = Object.freeze(['offline', 'server', 'rate']);
/** AUDIT 30 C1: the answers that say nothing about the act's row - kept, and asked again once there is a session (net/
 *  profBook.js WAIT). Letting them go put a listed piece back in the pack while it stood listed, and lost a purchase. */
const WAIT = Object.freeze(['no-session', 'auth']);
/** The answers that say the market is not this account's now. */
const SHUT = Object.freeze(['market-closed', 'prof-need-account']);
/** AUDIT 30 U9: the answers that say the view a press was made from has moved - the minute's cache is let go. PROF5b: a
 *  bid another overtook; AUDIT 31 B8: a bid that leads already, a bid standing on one's own auction, a bid overtaken as
 *  it was decided - each says the view is older than the auction. */
export const MARKET_MOVED = Object.freeze(['market-gone', 'market-short', 'market-price-moved', 'auction-low', 'auction-leading', 'auction-bid-standing',
  'auction-moved']);
const MOVED = MARKET_MOVED;
/** AUDIT 31 H1: the answers that say a piece taken out of the save is ELSEWHERE on the service - another's, listed,
 *  on its way to the account, standing in a home. The save's piece was a copy (a save restored past the act that moved
 *  it): it is never put back, and a settle takes it out of the save. */
export const PIECE_GONE = Object.freeze(['market-not-yours', 'market-listed', 'market-uncollected', 'market-standing']);
/** AUDIT 31 H1: a piece another act of the counting-house holds (this book's kept listing, or the writs' kept fill). */
export const PIECE_KEPT_ERROR = 'piece-kept';
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
 *   marks?: { set?: (n: number) => void } | null, stores?: { apply?: (s: any) => void } | null,
 *   holds?: ((provenance: string) => boolean) | null, sleep?: (ms: number) => Promise<void> }} o `stores` - the
 *   professions' book (AUDIT 30 U1: what an answer says of the Stores is its count too); `holds` - AUDIT 31 H1: whether
 *   another book keeps an act on a piece (the writs' kept fill), so it is not taken twice
 */
export function createMarketBook({ door, storage = null, character, now = () => Date.now(), marks = null, stores = null, holds = null, sleep = wait }) {
  let _shut = /** @type {number|null} */ (null);
  const state = {
    /** null until the service has answered; false while the market is shut to this account - asked again after
     *  MARKET_CLOSED_RECHECK_MS (AUDIT 30 U11) */
    _open: /** @type {boolean|null} */ (null),
    get open() { return this._open === false && _shut != null && now() - _shut >= MARKET_CLOSED_RECHECK_MS ? null : this._open; },
    set open(v) { this._open = v; _shut = v === false ? now() : null; },
    balance: /** @type {number|null} */ (null),
    /** what is on its way to this account (the service's `road`) */
    road: /** @type {any[]} */ ([]),
    counts: { listings: 0, orders: 0, bids: 0 },
    /** PROF5b: the Marks this account's bids hold (standing, or outbid and not yet back) */
    held: 0,
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
  /** AUDIT 31 B2: every kept act's slot is the one it was pressed in - read once, at the press, never again after an
   *  await (a quick-load between put a piece back into another character, and left the first one's kept to go again). */
  const keep = (kind, entry, key = slot()) => { const k = keptOf(key); k[kind] = [...k[kind].filter((x) => x.rid !== entry.rid), entry]; writeKept(k, key); };
  /** Let a kept act go; whether it was kept here (a repeat answered elsewhere mints nothing). */
  const letGo = (kind, rid, key = slot()) => {
    const k = keptOf(key);
    const had = k[kind].some((x) => x.rid === rid);
    k[kind] = k[kind].filter((x) => x.rid !== rid);
    writeKept(k, key);
    return had;
  };
  /** AUDIT 31 H1: the pieces this book keeps an act on (a kept listing or auction), this slot's. */
  const keptPieces = () => new Set(keptOf().lists.map((l) => l.body?.provenance).filter(Boolean));
  /** AUDIT 31 B1: a kept act needs an account to be kept under - pressed with none, it was kept under no one's slot and
   *  never asked again once one signed in (the piece lost). */
  const signedIn = () => !!account();

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
  /** What every answer carries: the balance (the Marks book told too - PROF0 26), the road, the counts, and (AUDIT 30
   *  U1) the Stores counts it moved - one material's `store`, or a read's `stores`, the deliveries it landed. */
  function heard(r) {
    if (SHUT.includes(r?.error)) state.open = false;
    if (MOVED.includes(r?.error)) forget();
    const d = r?.ok ? r.data : null;
    if (!d) return r;
    state.open = true;
    if (Number.isSafeInteger(d.balance)) { state.balance = d.balance; try { marks?.set?.(d.balance); } catch { /* the Marks book's own */ } }
    if (Array.isArray(d.road)) state.road = d.road;
    if (d.counts) state.counts = { listings: d.counts.listings | 0, orders: d.counts.orders | 0, bids: d.counts.bids | 0 };
    if (Number.isSafeInteger(d.held)) state.held = d.held;
    for (const st of [d.store, ...(Array.isArray(d.stores) ? d.stores : [])]) {
      if (st && typeof st.material === 'string') { try { stores?.apply?.(st); } catch { /* the professions' book's own */ } }
    }
    return r;
  }
  const kept = (r) => RETRY.includes(r?.error) || WAIT.includes(r?.error);

  // ─── THE READS ─────────────────────────────────────────────────────
  const cache = new Map();
  // AUDIT 29g: a search's matches are keyed APART from no search - a search that matched nothing (`materials: []`, which
  // the service answers with no rows) was keyed as the unfiltered view, and each was served the other's cached rows
  const keyOf = (view, q) => [view, q.region, q.family ?? '', q.tier ?? '', q.material ?? '', q.materials == null ? '' : `?${q.materials.join(',')}`].join('|');
  const pending = new Map();
  /** AUDIT 30 C6: the acts answered so far - a read begun before an act's answer is overtaken by it, and asked again. */
  let gen = 0;
  /** A view of the market: the minute's cache unless `force`; a failed read shows the last good one, stale. A read an
   *  act's answer overtook tells nothing (its balance is older than the act's) and is read again (AUDIT 30 C6). */
  async function read(view, q, { force = false } = {}) {
    const key = keyOf(view, q);
    const hit = cache.get(key);
    if (!force && hit && now() - hit.at < MARKET_CACHE_MS) return { ok: !hit.error, data: hit.data, error: hit.error, stale: hit.stale };
    const g = gen;
    const pk = `${g}|${key}`;
    if (pending.has(pk)) return pending.get(pk);
    const p = (async () => {
      const a = await ask(() => door.read({ character: character(), view, ...q }));
      if (g !== gen) return null;
      const r = heard(a);
      const e = { at: now(), data: r?.ok ? r.data : hit?.data ?? null, error: r?.ok ? null : (r?.error ?? 'server'), stale: !r?.ok && !!hit?.data };
      cache.set(key, e);
      return { ok: !!r?.ok, data: e.data, error: e.error, stale: e.stale };
    })();
    pending.set(pk, p);
    let out;
    try { out = await p; } finally { pending.delete(pk); }
    return out ?? read(view, q, { force: true });
  }
  function forget() { cache.clear(); gen++; }

  // ─── THE ACTS ──────────────────────────────────────────────────────
  let _busy = null, _busyKey = null;
  /** One act at a time: a press of the act under way is that act; AUDIT 30 C5: any other while one is under way (the
   *  opening settle's included) is refused `market-busy` - it was handed the other act's answer, and said done. */
  const once = (key, fn) => {
    if (_busy) return _busyKey === key ? _busy : Promise.resolve({ ok: false, error: 'market-busy' });
    _busyKey = key;
    return (_busy = (async () => { try { return await fn(); } finally { _busy = null; _busyKey = null; } })());
  };
  const ids = new Map();
  /** AUDIT 31 B4: an id is its slot's - another character's press of the same act is never answered as this one's. */
  const idFor = (key) => {
    const k = `${slot()}|${key}`;
    let v = ids.get(k);
    if (v && now() - v.at > MARKET_ID_MS) v = null;
    if (!v) ids.set(k, v = { id: mintMarketRid(), at: now() });
    return v.id;
  };
  const done = (key) => ids.delete(`${slot()}|${key}`);
  const answered = (r) => { if (r?.ok) forget(); return r; };

  /** A kept act asked (or asked again): let go on the answer, the piece minted once after; kept on silence - and (AUDIT 31
   *  B2) kept while the save is another character's than the one it was pressed in: that one's settle mints it. */
  async function keptAct(kind, entry, send, mint, key = slot()) {
    const r = heard(await ask(send));
    if (slot() !== key) return { ok: false, kept: true, error: 'other-character', text: MARKET_KEPT_TEXT };
    if (r?.ok) {
      const had = letGo(kind, entry.rid, key);
      forget();
      if (had && r.data?.piece) { try { mint?.(r.data.piece, kind); } catch (e) { console.warn('[market] mint', e); } }
      return { ok: true, data: r.data };
    }
    if (kept(r)) return { ok: false, kept: true, error: r?.error, text: MARKET_KEPT_TEXT };
    letGo(kind, entry.rid, key);
    return { ok: false, error: r?.error ?? 'server' };
  }

  /** A piece posted (listed, or PROF5b auctioned): out of the save first, kept with its request and its route, let go on
   *  the answer, put back on a refusal, kept on silence. AUDIT 31: never without an account to keep it under (B1), never
   *  a piece another kept act holds (H1), the slot the press's (B2), and never put back when the service says the piece
   *  is elsewhere (H1 - the save's was a copy) or when it was not ours to put back (a settle answered it first). */
  async function postPiece(route, body, piece) {
    if (!signedIn()) return { ok: false, error: 'no-session' };
    if (body.provenance && (keptPieces().has(body.provenance) || holds?.(body.provenance))) return { ok: false, error: PIECE_KEPT_ERROR };
    if (!piece?.take?.()) return { ok: false, error: 'piece-held' };   // AUDIT 31 H8: the save would not give it up - never "only a crafted piece lists"
    const key = slot();
    keep('lists', { rid: body.rid, body, item: piece.item, where: piece.where, ...(route === 'list' ? {} : { route }) }, key);
    const r = heard(await ask(() => door[route](body)));
    if (r?.ok) { letGo('lists', body.rid, key); forget(); return { ok: true, data: r.data }; }
    if (kept(r) || slot() !== key) return { ok: false, kept: true, error: r?.error, text: MARKET_KEPT_TEXT };
    const had = letGo('lists', body.rid, key);
    if (had && !PIECE_GONE.includes(r?.error)) { try { piece.putBack(piece.item, piece.where); } catch (e) { console.warn('[market] put back', e); } }
    return { ok: false, error: r?.error ?? 'server' };
  }

  const book = {
    state,
    read,
    cached: (view, q) => cache.get(keyOf(view, q))?.data ?? null,
    forget,
    /** AUDIT 30 U12: an act under way (the market's own, not the board window's). */
    get busy() { return !!_busy; },
    /** AUDIT 30 U6: a balance another book heard (the Weavers' counter's purchase). */
    told(balance) { if (Number.isSafeInteger(balance)) state.balance = balance; },
    /** Kept acts waiting for an answer. */
    get pending() { const k = keptOf(); return KINDS.reduce((n, kind) => n + k[kind].length, 0); },

    /**
     * LIST a material (`req.kind` 'material') or a piece: the piece taken out of the save first (`take`), kept with the
     * request, put back (`putBack`) if the service refuses it.
     * @param {any} req @param {{ item: any, where: string, take: () => boolean, putBack: (item: any, where: string) => void }|null} [piece]
     */
    list(req, piece = null) {
      return once(`list|${JSON.stringify(req)}`, async () => {
        const rid = mintMarketRid();
        const body = { character: character(), ...req, rid };
        if (req.kind === 'piece') return postPiece('list', body, piece);
        const k = `list|${JSON.stringify(req)}`;
        const r = answered(heard(await ask(() => door.list({ ...body, rid: idFor(k) }))));
        if (r?.ok || !kept(r)) done(k);
        return r;
      });
    },
    /** BUY: a piece bought here minted on the answer (kept before asked); a material into the Stores (`store`). */
    buy(req, mint) {
      return once(`buy|${req?.listing}|${req?.units}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        const rid = mintMarketRid();
        const body = { character: character(), ...req, rid };
        const key = slot();
        keep('buys', { rid, body }, key);
        return keptAct('buys', { rid }, () => door.buy(body), mint, key);
      });
    },
    /** CANCEL a listing: a piece answered back and minted; a material's units into the Stores. */
    cancel(listing, mint) {
      return once(`cancel|${listing}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        const rid = mintMarketRid();
        const key = slot(), me = character();
        keep('cancels', { rid, listing }, key);
        return keptAct('cancels', { rid }, () => door.cancel(me, listing, rid), mint, key);
      });
    },
    /** COLLECT a piece that has arrived (or come back). */
    collect(delivery, mint) {
      return once(`collect|${delivery}`, async () => {
        if (!signedIn()) return { ok: false, error: 'no-session' };
        const rid = mintMarketRid();
        const key = slot(), me = character();
        keep('collects', { rid, delivery }, key);
        return keptAct('collects', { rid }, () => door.collect(me, delivery, rid), mint, key);
      });
    },
    /** PROF5b: AN AUCTION of a Masterwork - `req` `{ region, provenance, wear, opening, hubs }` - posted as a listed
     *  piece is (out of the save first, kept, put back on a refusal). */
    auction(req, piece) {
      return once(`auction|${JSON.stringify(req)}`, async () => postPiece('auction', { character: character(), ...req, rid: mintMarketRid() }, piece));
    },
    /** PROF5b: A BID - `req` `{ region, auction, amount, hubs }` - its id kept for a press asked again (the lost answer's). */
    bid(req) {
      const k = `bid|${JSON.stringify(req)}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.bid({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    /** A buy ORDER posted, a FILL, an order WITHDRAWN - each with its id kept for a press asked again. */
    order(req) {
      const k = `order|${JSON.stringify(req)}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.order({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    fill(req) {
      const k = `fill|${JSON.stringify(req)}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.fill({ character: character(), ...req, rid: idFor(k) })))); if (!kept(r)) done(k); return r; });
    },
    unorder(order) {
      const k = `unorder|${order}`;
      return once(k, async () => { const r = answered(heard(await ask(() => door.unorder(order, idFor(k))))); if (!kept(r)) done(k); return r; });
    },
    report: (listing) => once(`report|${listing}`, async () => answered(heard(await ask(() => door.report(listing))))),
    remove: (listing) => once(`remove|${listing}`, async () => answered(heard(await ask(() => door.remove(listing))))),

    /**
     * SETTLE: every kept act asked again with its own id (a list whose answer never came, a buy, a cancel, a collect),
     * and every piece on the road that has arrived for this character collected - each minted once.
     * @param {(piece: any, why: string) => void} mint @param {(item: any, where: string) => void} putBack
     * @param {((item: any, where: string) => void)|null} [drop] AUDIT 30 C3: a listed piece out of the save - a kept list
     *   answered here was taken out of a save that may not have been kept since (a crash, a seat handed over)
     */
    settle(mint, putBack, drop = null) {
      const go = () => once('settle', async () => {
        // AUDIT 31 B2: the slot the settle began in, and the character with it - a quick-load mid-settle stops it
        const key = slot(), me = character();
        const here = () => slot() === key;
        const k = keptOf(key);
        let settled = 0;
        for (const l of k.lists) {
          const r = heard(await ask(() => (l.route === 'auction' ? door.auction(l.body) : door.list(l.body))));   // PROF5b: an auction's own route
          if (!here()) break;
          if (r?.ok) { letGo('lists', l.rid, key); try { drop?.(l.item, l.where); } catch (e) { console.warn('[market] drop', e); } settled++; }
          else if (!kept(r)) {
            letGo('lists', l.rid, key);
            // AUDIT 31 H1: a piece the service says is elsewhere was a copy in the save - out of it, never back in
            if (PIECE_GONE.includes(r?.error)) { try { drop?.(l.item, l.where); } catch (e) { console.warn('[market] drop', e); } }
            else { try { putBack(l.item, l.where); } catch (e) { console.warn('[market] put back', e); } }
            settled++;
          }
        }
        for (const b of k.buys) if (here() && (await keptAct('buys', b, () => door.buy(b.body), mint, key)).ok) settled++;
        for (const c of k.cancels) if (here() && (await keptAct('cancels', c, () => door.cancel(me, c.listing, c.rid), mint, key)).ok) settled++;
        for (const c of k.collects) if (here() && (await keptAct('collects', c, () => door.collect(me, c.delivery, c.rid), mint, key)).ok) settled++;
        for (const d of state.road.filter((x) => x.kind === 'piece' && x.ready && x.character === me)) {
          if (!here() || keptOf(key).collects.some((c) => c.delivery === d.id)) continue;
          const rid = mintMarketRid();
          keep('collects', { rid, delivery: d.id }, key);
          if ((await keptAct('collects', { rid }, () => door.collect(me, d.id, rid), mint, key)).ok) settled++;
        }
        if (settled) forget();
        return { ok: true, settled };
      });
      // AUDIT 31 B10: a settle asked while another act is under way waits for it, never refused and never asked again
      return _busy && _busyKey !== 'settle' ? _busy.then(go, go) : go();
    },
    /** AUDIT 31 H1: whether this book keeps an act on a piece (the writs' book asks, and the host's pickers). */
    holdsPiece: (provenance) => keptPieces().has(provenance),
    /** The kept acts of this slot (a test's and the tab's "waiting" line). */
    _kept: () => keptOf(),
    /** The rid shape, for a test. */
    ridOk: (r) => MARKET_RID_RE.test(r),
  };
  return book;
}
