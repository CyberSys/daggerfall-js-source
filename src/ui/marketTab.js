// @ts-check
// PROF5 (2026-09-29, Mac: "Continue"): THE MARKET TAB of the Notice Board (bible/06-Systems/Professions-Arc.md 10.1,
// 10.2, 21's wireframe, 26) - drawn inside the board's window (ui/noticeWindow.js), beside Notices and Work.
//
// FIVE VIEWS, in the wireframe's row: MATERIALS (the Bay's listings of a material - search, family, tier - cheapest
// first, each "here" or its region with its courier and time, its 7-day median and line; the picked row's "Buy N for P
// Marks + C courier?"; the Weavers' counter's Linen and Wool), CRAFTED (the pieces listed - each its name as its record
// mints it, its quality, maker and wear), MY LISTINGS (this account's, Cancel; List a Stores material or a crafted
// piece), ORDERS (the region's buy orders, Fill N from the Stores; this account's, Withdraw; Post an order) and HISTORY
// (the week's traded materials and their lines; "Your trades"). Above them, while anything travels, ON THE ROAD; below,
// Your Marks.
//
// Every act goes through the window's one-at-a-time door (`ui.run`), and every piece that enters or leaves the save
// goes through the market book's kept acts (net/marketBook.js).
//
// AUDIT 30: a search names the catalogue's materials and the service reads those (U2 - it filtered the hundred
// cheapest of everything, and a listed rarity read "Nothing listed"); an answer to a view since left is dropped (U3);
// the opening settle is an act through the door (U4); a number typed moves only the words that hang on it - never a
// full redraw that swallowed the next press - and the field keeps the focus through a read's redraw (U8, A12); a
// press the market says has moved reads again (U9); a piece that arrives while the tab stands is collected (U10);
// what must fail is not offered (U13); the rows run cheapest landed first (U16); one Mark is one Mark (U17); a row's
// courier is the pick's (U18); the shared clock (U21); every field named (U22).
//
// PROF5b (Professions-Arc 27): AUCTIONS beside Crafted - every open auction of a Masterwork, ending soonest first, the
// standing bid or the opening, the time left, the picked row's Bid at the next bid (or "Your bid leads", or the seller's
// Cancel while no bid stands); "An auction (Masterworks)" in the List form; the account's auctions and bids under My
// listings; what the bids hold beside "Your Marks".
import { accountRefusalText } from '../net/accountClient.js';
import {
  MARKET_VIEWS, MARKET_FAMILIES, CRAFTED_FAMILIES, MARKET_PRICE_MAX, MARKET_UNITS_MAX, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX,
  listingFee, saleTax, courierFee, wearOf, wearText, medianText, marketCatalogue, AUCTION_S, AUCTION_RAISE_PCT, AUCTION_LATE_S, AUCTION_BID_MAX,
} from '../net/marketLaw.js';
import { QUALITY_NAMES, MASTERWORK } from '../net/recipeLaw.js';
import { marksText } from '../net/marksLaw.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e?.stopPropagation?.(); return onPress(); };
  return b;
};
/** A number field, named (AUDIT 30 U22) and keyed for the focus a redraw keeps (U8). */
const numberInput = (value, min, max, label, focus) => {
  const i = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-num'));
  i.type = 'number'; i.min = String(min); i.max = String(max); i.value = String(value);
  i.setAttribute('aria-label', label);
  i.setAttribute('data-focus', focus);
  return i;
};
const select = (options, value, onChange, label = null) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select market-select'));
  if (label) s.setAttribute('aria-label', label);
  for (const [v, label] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, label)); o.value = v; if (v === value) o.selected = true; s.append(o); }
  s.onchange = () => onChange(s.value);
  return s;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** The units a picked row offers first, and its courier quotes for (AUDIT 30 U18). */
const PICK_UNITS = 20;
/** AUDIT 30 U9: the words that say the view a press was made from has moved - it is read again. */
const MOVED = ['market-gone', 'market-short', 'market-price-moved', 'auction-low'];   // PROF5b: a bid another overtook - its next read again
/** AUDIT 30 U11: the words that say the market is not this account's. */
const SHUT = ['market-closed', 'prof-need-account'];
const plural = (n, one) => `${n.toLocaleString('en-US')} ${one}${n === 1 ? '' : 's'}`;
/** "32 minutes", "2 hours", "arrived". */
export function arrivalText(atS, nowS) {
  const s = (Number(atS) || 0) - nowS;
  if (s <= 0) return 'arrived';
  const m = Math.ceil(s / 60);
  return m < 90 ? plural(m, 'minute') : plural(Math.round(m / 60), 'hour');
}
/** "2 days ago", "3 hours ago", "just now". */
const agoText = (atS, nowS) => {
  const s = Math.max(0, nowS - (Number(atS) || 0));
  if (s >= 86400) return `${plural(Math.floor(s / 86400), 'day')} ago`;
  if (s >= 3600) return `${plural(Math.floor(s / 3600), 'hour')} ago`;
  return 'just now';
};

/**
 * A material's line (10.2): its seven days' medians, a small polyline over the days that sold, scaled to its own low and
 * high. Nothing with fewer than two days sold.
 * @param {Array<number|null>} line
 */
export function medianLineNode(line) {
  const pts = (line ?? []).map((v, i) => [i, v]).filter(([, v]) => v != null);
  const doc = globalThis.document;
  if (pts.length < 2 || !doc.createElementNS) return null;
  const NS = 'http://www.w3.org/2000/svg';
  const vals = pts.map(([, v]) => Number(v));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 16');
  svg.setAttribute('class', 'market-line');
  svg.setAttribute('aria-hidden', 'true');
  const poly = doc.createElementNS(NS, 'polyline');
  poly.setAttribute('points', pts.map(([i, v]) => `${((Number(i) / 6) * 58 + 1).toFixed(1)},${(hi === lo ? 8 : 15 - ((Number(v) - lo) / (hi - lo)) * 14).toFixed(1)}`).join(' '));
  svg.append(poly);
  return svg;
}

/**
 * THE TAB.
 * @param {{
 *   book: any, stores: () => Map<string, { material: string, own: number, bought: number }>,
 *   region: number, regionName: string, regionNameOf: (r: number) => string, hubs: Record<string, number[]>,
 *   name: (key: string) => string, countName: (key: string, n: number) => string,
 *   pieces: () => Array<{ item: any, where: string, name: string }>, take: (item: any, where: string) => boolean,
 *   putBack: (item: any, where: string) => void, mint: (piece: any, why: string) => void, pieceName: (piece: any) => string,
 *   drop?: (item: any, where: string) => void,
 *   weavers: ReadonlyArray<{ key: string, marks: number }>, stock: (key: string, n: number) => Promise<{ ok: boolean, text?: string }>,
 * }} m the host's market (scenes/world.js); `drop` - a piece a settled listing took, out of the save (AUDIT 30 C3)
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => Promise<void>, rerender: () => void, nowS: () => number,
 *   alive: () => boolean }} ui the window's
 */
export function createMarketTab(m, ui) {
  const st = {
    view: 'materials', family: /** @type {string|null} */ (null), tier: 0, query: '', picked: /** @type {string|null} */ (null),
    qty: 1, data: /** @type {any} */ (null), error: /** @type {string|null} */ (null), stale: false, loading: false,
    list: { kind: 'material', material: '', units: 1, price: 1, piece: '' }, post: { material: '', units: 1, price: 1 },
    fills: /** @type {Record<string, number>} */ ({}), weave: /** @type {Record<string, number>} */ ({}),
    bid: /** @type {Record<string, number>} */ ({}),   // PROF5b: the bids typed, by auction
  };
  const balance = () => m.book.state.balance;
  const short = (marks) => balance() != null && balance() < marks;
  /** AUDIT 30 U2: a search's words as the catalogue's materials (their family and tier too) - the service reads those. */
  const searched = () => {
    const needle = st.query.trim().toLowerCase();
    if (!needle) return null;
    return marketCatalogue().filter((c) => (!st.family || c.family === st.family) && (!st.tier || c.tier === st.tier)
      && m.name(c.key).toLowerCase().includes(needle)).map((c) => c.key);
  };
  const q = () => {
    const found = st.view === 'materials' ? searched() : null;
    return { region: m.region, hubs: m.hubs, ...(['materials', 'orders', 'crafted', 'auctions'].includes(st.view) ? { family: st.family } : {}),
      ...(st.view === 'materials' && st.tier ? { tier: st.tier } : {}), ...(found ? { materials: found } : {}) };
  };
  /** AUDIT 30 U3: the last read asked - an answer to an earlier one (a view or a filter since left) is dropped. */
  let seq = 0;
  async function load(force = false) {
    const mine = ++seq;
    st.loading = true; ui.rerender();
    const r = await m.book.read(st.view, q(), { force });
    if (!ui.alive() || mine !== seq) return;
    st.loading = false;
    st.data = r.data; st.error = r.ok ? null : r.error; st.stale = !!r.stale;
    ui.rerender();
    collectArrived();
  }
  /** AUDIT 30 U4: the kept acts settled and the arrived pieces collected - an act through the window's door, so no
   *  other press is made while it runs (the market book refuses one, `market-busy`, besides). */
  const settle = () => ui.run(async () => {
    const r = await m.book.settle(m.mint, m.putBack, m.drop ?? null);
    for (const x of arrived()) if (r?.ok) tried.add(x.id);
    if (r?.settled) load(true);
    return { ok: !!r?.ok, text: r?.settled ? 'The counting-house has settled what it held for you.' : (r?.ok ? '' : accountRefusalText(r?.error)) };
  });
  /** AUDIT 30 U10: a piece arrived while the tab stands is collected - each delivery asked once a showing (a refusal is
   *  said, and the next showing asks again). */
  const tried = new Set();
  const arrived = () => (m.book.state.road ?? []).filter((x) => x.kind === 'piece' && x.ready && !tried.has(x.id));
  const collectArrived = () => { if (arrived().length && !ui.busy()) settle(); };
  /** On the tab shown: the kept acts settled (and the arrived pieces collected), then the view read. */
  async function open() {
    if (m.book.pending || arrived().length) await settle();
    await load(false);
  }
  const go = (view) => { st.view = view; st.picked = null; st.family = null; st.tier = 0; st.data = m.book.cached(view, q()); load(false); };
  /** An act through the window's door; its word, then the view read again - a press the market says has moved too. */
  const act = (start, okText) => ui.run(async () => {
    const r = await start();
    if (r?.ok) { st.picked = null; load(true); return { ok: true, text: typeof okText === 'function' ? okText(r.data) : okText }; }
    if (MOVED.includes(r?.error)) { st.picked = null; load(true); }
    return { ok: false, text: r?.text ?? accountRefusalText(r?.error) };
  });
  const held = (key) => { const s = m.stores().get(key); return s ? s.own + s.bought : 0; };
  const where = (row) => (row.region === m.region ? 'here' : m.regionNameOf(row.region));
  /** The units a row's pick starts at, and its courier's quote is for. */
  const pickOf = (row) => (row.kind === 'piece' || row.kind === 'auction' ? 1 : Math.max(1, Math.min(row.units, PICK_UNITS)));
  const courierOf = (row, units) => (row.region === m.region ? 0 : row.road ? courierFee(units, row.road.road) : null);
  /** AUDIT 30 U16: a unit's price landed here - its courier's share of the pick's. */
  const landed = (row) => { const n = pickOf(row), c = courierOf(row, n); return c == null ? Infinity : row.price + c / n; };
  const roadText = (row) => {
    if (row.region === m.region) return '';
    if (!row.road) return ' no courier knows the road';
    const n = pickOf(row);
    return ` +${courierOf(row, n)} courier${row.kind === 'piece' ? '' : ` for ${n}`}, ${arrivalText(row.road.seconds, 0)}`;
  };

  function viewsNode() {
    const nav = el('nav', 'market-views');
    nav.setAttribute('aria-label', 'Market views');
    for (const [id, label] of MARKET_VIEWS) {
      const t = el('button', `notice-tab market-view${st.view === id ? ' on' : ''}`, label);
      t.setAttribute('type', 'button');
      if (st.view === id) t.setAttribute('aria-current', 'page');
      t.onclick = () => { if (st.view !== id) go(id); };
      nav.append(t);
    }
    return nav;
  }

  function roadNode() {
    const road = m.book.state.road ?? [];
    if (!road.length) return null;
    const box = el('div', 'market-road');
    box.append(el('h4', null, 'On the road'));
    for (const x of road) {
      const from = x.from == null ? '' : ` from ${m.regionNameOf(x.from)}`;
      const what = x.kind === 'material' ? `${x.units} ${m.countName(x.material, x.units)}` : m.pieceName(x.piece);
      const when = x.kind === 'material' ? (x.waiting ? 'arrived - waiting for room in your Stores' : arrivalText(x.arrivesAt, ui.nowS()))
        : x.why === 'returned' ? 'back from the market' : arrivalText(x.arrivesAt, ui.nowS());
      box.append(el('p', 'market-roadline', `${what}${from} - ${when}`));
    }
    return box;
  }

  let typing = null;
  function filtersNode(families) {
    const row = el('div', 'market-filters');
    if (st.view === 'materials') {
      const search = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-search'));
      search.placeholder = 'Search';
      search.setAttribute('aria-label', 'Search the materials');
      search.setAttribute('data-focus', 'search');
      search.value = st.query;
      // AUDIT 30 U2: the words read from the service once the typing rests - the field is never redrawn under the keys
      search.oninput = () => { st.query = search.value; st.picked = null; clearTimeout(typing); typing = setTimeout(() => load(false), 300); };
      row.append(search);
    }
    row.append(select([['', 'All'], ...families], st.family ?? '', (v) => { st.family = v || null; st.picked = null; load(false); }, 'Family'));
    if (st.view === 'materials') {
      row.append(select([['0', 'Any tier'], ...[1, 2, 3, 4, 5, 6, 7].map((t) => [String(t), `Tier ${t}`])], String(st.tier), (v) => { st.tier = Number(v) || 0; st.picked = null; load(false); }, 'Tier'));
    }
    return row;
  }

  const pick = (row) => { st.picked = st.picked === row.id ? null : row.id; st.qty = pickOf(row); ui.rerender(); };
  function rowButton(row, cls) {
    const b = el('button', `market-row${cls}${st.picked === row.id ? ' on' : ''}`);
    b.setAttribute('type', 'button');
    b.setAttribute('aria-expanded', st.picked === row.id ? 'true' : 'false');   // AUDIT 30 U22
    b.onclick = () => pick(row);
    return b;
  }
  function materialRow(row) {
    const med = st.data?.medians?.[row.material];
    const b = rowButton(row, '');
    b.append(el('b', null, `${m.name(row.material)} x${row.units.toLocaleString('en-US')}`),
      el('span', 'market-price', `${marksText(row.price)} each`),
      el('span', 'market-where', `${where(row)}${roadText(row)}`),
      el('span', 'market-median', `median ${medianText(med?.median ?? null)}`));
    const line = medianLineNode(med?.line);
    if (line) b.append(line);
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', plural(row.reports, 'report')));
    return b;
  }
  function pieceRow(row) {
    const p = row.piece;
    const b = rowButton(row, ' market-piece');
    b.append(el('b', null, m.pieceName(p)),
      el('span', 'market-quality', [QUALITY_NAMES[p.quality] ?? null, p.maker ? `made by ${p.maker}` : null, wearText(p.wear)].filter(Boolean).join(' · ')),
      el('span', 'market-price', marksText(row.price)),
      el('span', 'market-where', `${where(row)}${roadText(row)}`));
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', plural(row.reports, 'report')));
    return b;
  }
  /** The picked row's bar: "Buy N for P Marks + C courier?", Buy; Report; a moderator's Remove. A number typed moves the
   *  words and the button that hang on it, never the bar (AUDIT 30 U8). */
  function pickedBar(row) {
    const bar = el('div', 'market-bar');
    const piece = row.kind === 'piece';
    const unitsNow = () => (piece ? 1 : intOf(st.qty, 1, row.units));
    const what = (units) => (piece ? m.pieceName(row.piece) : `${units} ${m.countName(row.material, units)}`);
    const ask = el('span', 'market-ask');
    ask.setAttribute('aria-live', 'polite');
    const buy = button('primary market-buy', m.book.busy ? 'Buying...' : 'Buy', () => {
      const units = unitsNow(), courier = courierOf(row, units), w = what(units);
      return act(() => m.book.buy({ region: m.region, listing: row.id, units, max: units * row.price + (courier ?? 0), hubs: m.hubs }, m.mint),
        (d) => (d?.sale?.here ? `Bought ${w}.` : `Bought ${w} - the courier brings it from ${m.regionNameOf(row.region)} in ${arrivalText(d?.sale?.arrivesAt, ui.nowS())}.`));
    });
    const refresh = () => {
      const units = unitsNow(), courier = courierOf(row, units), total = units * row.price;
      ask.textContent = courier == null ? `The couriers do not know the road to ${m.regionNameOf(row.region)} yet.`
        : `Buy ${what(units)} for ${marksText(total)}${courier ? ` + ${courier} courier` : ''}?`;
      buy.disabled = ui.busy() || row.mine || courier == null || short(total + (courier ?? 0));
    };
    if (!piece) {
      const n = numberInput(unitsNow(), 1, row.units, 'Units to buy', `qty|${row.id}`);
      n.oninput = () => { st.qty = intOf(n.value, 1, row.units); refresh(); };
      bar.append(n);
    }
    refresh();
    bar.append(ask, buy);
    if (!row.mine) bar.append(button('market-report', 'Report', () => act(() => m.book.report(row.id), 'Reported. A moderator will look at it.')));
    if (row.reports != null) bar.append(button('market-remove', 'Remove', () => act(() => m.book.remove(row.id), 'Removed. Its goods go back to its seller.')));
    return bar;
  }

  // ─── PROF5b: THE AUCTIONS ────────────────────────────────────────
  const endsText = (endsAt) => (endsAt - ui.nowS() <= 0 ? 'ended' : `ends in ${arrivalText(endsAt, ui.nowS())}`);
  const standing = (a) => (a.high == null ? `opening ${marksText(a.opening)} - no bids yet` : `${marksText(a.high)} (${plural(a.bids, 'bid')})`);
  function auctionRow(a) {
    const p = a.piece;
    const b = rowButton(a, ' market-piece market-auction');
    b.append(el('b', null, m.pieceName(p)),
      el('span', 'market-quality', [QUALITY_NAMES[p.quality] ?? null, p.maker ? `made by ${p.maker}` : null, wearText(p.wear)].filter(Boolean).join(' · ')),
      el('span', 'market-price', standing(a)),
      el('span', 'market-where', `${where(a)}${roadText({ ...a, kind: 'piece' })} · ${endsText(a.endsAt)}`));
    if (a.mine) b.append(el('span', 'market-mine', 'yours'));
    else if (a.leading) b.append(el('span', 'market-mine', 'your bid leads'));
    if (a.reports != null) b.append(el('span', 'market-mod', plural(a.reports, 'report')));
    return b;
  }
  /** The picked auction's bar: the seller's Cancel while no bid stands; the leader's word; else Bid at the next bid, the
   *  courier with it - the number typed moves the words that hang on it (AUDIT 30 U8). */
  function auctionBar(a) {
    const bar = el('div', 'market-bar');
    if (a.mine) {
      bar.append(el('span', 'market-ask', a.bids ? `Your auction - ${standing(a)}. It cannot be taken back while a bid stands.` : 'Your auction - no bids yet.'));
      if (!a.bids) bar.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(a.id, m.mint), 'Cancelled. Your Masterwork is back; the fee is kept.')));
      return bar;
    }
    if (a.leading) {
      bar.append(el('span', 'market-ask', `Your bid of ${marksText(a.high)} leads. It is held until you are outbid or the auction ends.`));
    } else {
      const courier = courierOf({ ...a, kind: 'piece' }, 1);
      const amountNow = () => Math.max(a.next, intOf(st.bid[a.id] ?? a.next, a.next, AUCTION_BID_MAX));
      const n = numberInput(amountNow(), a.next, AUCTION_BID_MAX, 'Your bid in Marks', `bid|${a.id}`);
      const ask = el('span', 'market-ask');
      ask.setAttribute('aria-live', 'polite');
      const go = button('primary market-bid', 'Bid', () => {
        const amount = amountNow();
        return act(() => m.book.bid({ region: m.region, auction: a.id, amount, hubs: m.hubs }),
          `Your bid of ${marksText(amount)} leads. It is held until you are outbid or the auction ends.`);
      });
      const refresh = () => {
        const amount = amountNow();
        ask.textContent = courier == null ? `The couriers do not know the road to ${m.regionNameOf(a.region)} yet.`
          : `Bid ${marksText(amount)}${courier ? ` + ${courier} courier` : ''}? At least ${marksText(a.next)}.`;
        go.disabled = ui.busy() || courier == null || short(amount + (courier ?? 0));
      };
      n.oninput = () => { st.bid[a.id] = intOf(n.value, a.next, AUCTION_BID_MAX); refresh(); };
      refresh();
      bar.append(n, ask, go);
    }
    bar.append(button('market-report', 'Report', () => act(() => m.book.report(a.id), 'Reported. A moderator will look at it.')));
    if (a.reports != null) bar.append(button('market-remove', 'Remove', () => act(() => m.book.remove(a.id), 'Removed. Its bid is returned and its piece goes back to its seller.')));
    return bar;
  }

  function weaversNode() {
    const box = el('div', 'market-counter');
    box.append(el('h4', null, 'The Weavers\' counter'));
    for (const w of m.weavers) {
      const row = el('div', 'market-counterrow');
      const count = () => intOf(st.weave[w.key] ?? 1, 1, 100);
      const inp = numberInput(count(), 1, 100, `Bolts of ${m.name(w.key)}`, `weave|${w.key}`);
      const b = button('market-weave', '', () => ui.run(() => m.stock(w.key, count())));
      const refresh = () => {
        b.textContent = `Buy for ${marksText(w.marks * count())}`;
        b.disabled = ui.busy() || short(w.marks * count());   // AUDIT 30 U12, U13
      };
      inp.oninput = () => { st.weave[w.key] = intOf(inp.value, 1, 100); refresh(); };
      refresh();
      row.append(el('b', null, m.name(w.key)), el('span', 'market-price', `${marksText(w.marks)} a bolt`), inp, b);
      box.append(row);
    }
    box.append(el('p', 'notice-hint', 'Into your Stores. A bolt stays there until its craft is practised.'));
    return box;
  }

  function listForm() {
    const box = el('div', 'market-listform');
    box.append(el('h4', null, 'List on the market'));
    box.append(select([['material', 'From the Stores'], ['piece', 'A crafted piece'], ['auction', 'An auction (Masterworks)']], st.list.kind, (v) => { st.list.kind = v; ui.rerender(); }, 'What to list'));
    const price = numberInput(st.list.price, 1, MARKET_PRICE_MAX, 'Price in Marks', 'list-price');
    const hint = el('p', 'notice-hint');
    const b = button('primary market-list', 'List', () => send());
    const full = (m.book.state.counts?.listings ?? 0) >= MARKET_LISTINGS_MAX;
    let can = () => false, send = () => {}, worth = () => 0;
    if (st.list.kind === 'material') {
      const stores = [...m.stores().values()].filter((s) => s.own + s.bought > 0);
      if (!stores.some((s) => s.material === st.list.material)) st.list.material = stores[0]?.material ?? '';
      const most = held(st.list.material);
      st.list.units = intOf(st.list.units, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX)));
      const units = numberInput(st.list.units, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX)), 'Units to list', 'list-units');
      units.oninput = () => { st.list.units = intOf(units.value, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX))); refresh(); };
      box.append(select(stores.map((s) => [s.material, `${m.name(s.material)} (${(s.own + s.bought).toLocaleString('en-US')})`]), st.list.material, (v) => { st.list.material = v; ui.rerender(); }, 'Material'),
        el('span', 'notice-label', 'Units'), units, el('span', 'notice-label', 'Marks each'), price);
      worth = () => st.list.units * st.list.price;
      can = () => !!st.list.material && most >= st.list.units;
      send = () => act(() => m.book.list({ region: m.region, kind: 'material', material: st.list.material, units: st.list.units, price: st.list.price, hubs: m.hubs }),
        `Listed ${st.list.units} ${m.countName(st.list.material, st.list.units)} at ${marksText(st.list.price)} each.`);
    } else {
      // PROF5b: an auction offers the Masterworks alone (10.2)
      const auction = st.list.kind === 'auction';
      const pieces = m.pieces().filter((p) => !auction || p.item.quality === MASTERWORK);
      if (!pieces.some((p) => p.item.provenance === st.list.piece)) st.list.piece = pieces[0]?.item.provenance ?? '';
      const chosen = pieces.find((p) => p.item.provenance === st.list.piece) ?? null;
      box.append(pieces.length ? select(pieces.map((p) => [p.item.provenance, `${p.name}${p.where === 'home' ? ' (your home)' : ''}`]), st.list.piece, (v) => { st.list.piece = v; ui.rerender(); }, 'Crafted piece')
        : el('span', 'notice-hint', auction ? 'You carry no Masterwork to auction.' : 'You carry no crafted piece to sell.'),
      el('span', 'notice-label', auction ? 'Opening bid in Marks' : 'Price in Marks'), price);
      worth = () => st.list.price;
      can = () => !!chosen;
      const piece = () => ({ item: chosen.item, where: chosen.where, take: () => m.take(chosen.item, chosen.where), putBack: m.putBack });
      send = auction
        ? () => act(() => m.book.auction({ region: m.region, provenance: chosen.item.provenance, wear: wearOf(chosen.item), opening: st.list.price, hubs: m.hubs }, piece()),
          `${chosen?.name} is up for auction, opening at ${marksText(st.list.price)}.`)
        : () => act(() => m.book.list({ region: m.region, kind: 'piece', provenance: chosen.item.provenance, wear: wearOf(chosen.item), price: st.list.price, hubs: m.hubs }, piece()),
          `Listed ${chosen?.name} at ${marksText(st.list.price)}.`);
    }
    // AUDIT 30 U13: a listing the fee or the board's limit would refuse is not offered - the words say which
    const refresh = () => {
      const fee = listingFee(worth());
      hint.textContent = full ? `You have ${MARKET_LISTINGS_MAX} listings standing, the most one account may. Cancel one, or wait for one to sell.`
        : st.list.kind === 'auction'
          ? `Listing fee ${marksText(fee)}, kept if you cancel (only while no bid stands). It stands on the boards of ${m.regionName} for ${AUCTION_S / 3600} hours; each bid must be ${AUCTION_RAISE_PCT}% over the last, and a bid in its last ${AUCTION_LATE_S / 60} minutes adds ${AUCTION_LATE_S / 60} more. The highest bid buys it; you receive it less ${saleTax(100)}%.`
          : `Listing fee ${marksText(fee)}, kept if you cancel. It stands on the boards of ${m.regionName} for 72 hours; a sale pays you its price less ${saleTax(100)}% (${marksText(worth() - saleTax(worth()))} if it all sells).`;
      b.disabled = ui.busy() || full || !can() || short(fee);
    };
    price.oninput = () => { st.list.price = intOf(price.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    box.append(hint, b);
    return box;
  }

  function orderForm() {
    const box = el('div', 'market-orderform');
    box.append(el('h4', null, 'Post a buy order'));
    const cat = marketCatalogue();
    if (!st.post.material) st.post.material = cat[0]?.key ?? '';
    const units = numberInput(st.post.units, 1, MARKET_UNITS_MAX, 'Units wanted', 'post-units');
    const price = numberInput(st.post.price, 1, MARKET_PRICE_MAX, 'Marks each', 'post-price');
    box.append(select(cat.map((c) => [c.key, `${m.name(c.key)} (tier ${c.tier})`]), st.post.material, (v) => { st.post.material = v; ui.rerender(); }, 'Material wanted'),
      el('span', 'notice-label', 'Units'), units, el('span', 'notice-label', 'Marks each'), price);
    const hint = el('p', 'notice-hint');
    const full = (m.book.state.counts?.orders ?? 0) >= MARKET_ORDERS_MAX;
    const b = button('primary market-post', 'Post the order', () => act(() => m.book.order({ region: m.region, material: st.post.material, units: st.post.units, price: st.post.price, hubs: m.hubs }),
      `Your order for ${st.post.units} ${m.countName(st.post.material, st.post.units)} is up.`));
    const refresh = () => {
      const cost = st.post.units * st.post.price;
      hint.textContent = full ? `You have ${MARKET_ORDERS_MAX} orders standing, the most one account may.`
        : `${marksText(cost)} held for it while it stands (7 days); what is not filled comes back.`;
      b.disabled = ui.busy() || full || !st.post.material || short(cost);
    };
    units.oninput = () => { st.post.units = intOf(units.value, 1, MARKET_UNITS_MAX); refresh(); };
    price.oninput = () => { st.post.price = intOf(price.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    box.append(hint, b);
    return box;
  }

  function orderRow(o) {
    const li = el('li', `market-order${o.mine ? ' mine' : ''}`);
    li.append(el('b', null, `${m.name(o.material)}`), el('span', 'market-price', `${o.left.toLocaleString('en-US')} of ${o.units.toLocaleString('en-US')} wanted at ${marksText(o.price)} each`));
    const med = st.data?.medians?.[o.material];
    if (med) li.append(el('span', 'market-median', `median ${medianText(med.median)}`));
    if (o.mine) {
      li.append(el('span', 'market-mine', 'yours'),
        el('span', 'market-state', o.state === 'open' ? `${plural(Math.max(0, Math.ceil((o.expiresAt - ui.nowS()) / 86400)), 'day')} left` : o.state));
      if (o.state === 'open') li.append(button('market-unorder', 'Withdraw', () => act(() => m.book.unorder(o.id), 'Withdrawn. What was held for it is back.')));
      return li;
    }
    const have = held(o.material);
    const most = Math.max(1, Math.min(have, o.left));
    const count = () => intOf(st.fills[o.id] ?? Math.min(have, o.left), 1, most);
    const inp = numberInput(count(), 1, most, `Units of ${m.name(o.material)} to fill`, `fill|${o.id}`);
    const b = button('primary market-fill', '', () => act(() => m.book.fill({ region: m.region, order: o.id, units: count(), hubs: m.hubs }),
      (d) => `Filled: ${marksText(d?.fill?.pay ?? 0)}.`));
    const refresh = () => { b.textContent = `Fill ${count()} from the Stores`; b.disabled = ui.busy() || have < 1; };
    inp.oninput = () => { st.fills[o.id] = intOf(inp.value, 1, most); refresh(); };
    refresh();
    li.append(inp, b, el('span', 'notice-hint', `${have.toLocaleString('en-US')} in your Stores`));
    return li;
  }

  function mineNode() {
    const box = el('div', 'market-mine-view');
    box.append(listForm());
    const rows = st.data?.rows ?? [];
    const ul = el('ul', 'market-list');
    for (const l of rows) {
      const li = el('li', `market-listing state-${l.state}`);
      li.append(el('b', null, l.kind === 'piece' ? m.pieceName(l.piece) : `${m.name(l.material)} - ${l.units} of ${l.listed} left`),
        el('span', 'market-price', `${marksText(l.price)}${l.kind === 'piece' ? '' : ' each'}`),
        el('span', 'market-where', l.region === m.region ? 'here' : m.regionNameOf(l.region)),
        el('span', 'market-state', l.state === 'open' ? `${plural(Math.max(0, Math.ceil((l.expiresAt - ui.nowS()) / 3600)), 'hour')} left` : l.state));
      if (l.state === 'open') li.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(l.id, m.mint), 'Cancelled. The goods are back; the fee is kept.')));
      ul.append(li);
    }
    if (!rows.length && st.data) ul.append(el('li', 'notice-empty', 'You have nothing on the market.'));
    box.append(ul);
    // PROF5b: this account's auctions and its bids
    const auctions = st.data?.auctions ?? [];
    if (auctions.length) {
      box.append(el('h4', null, 'Your auctions'));
      const al = el('ul', 'market-list');
      const said = { sold: (a) => `sold for ${marksText(a.high)}`, unsold: () => 'no bid came - it is on its way back', cancelled: () => 'cancelled', removed: () => 'removed by a moderator' };
      for (const a of auctions) {
        const li = el('li', `market-listing state-${a.state}`);
        li.append(el('b', null, m.pieceName(a.piece)), el('span', 'market-price', standing(a)),
          el('span', 'market-state', a.state === 'open' ? endsText(a.endsAt) : (said[a.state]?.(a) ?? a.state)));
        if (a.state === 'open' && !a.bids) li.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(a.id, m.mint), 'Cancelled. Your Masterwork is back; the fee is kept.')));
        al.append(li);
      }
      box.append(al);
    }
    const bids = st.data?.bids ?? [];
    if (bids.length) {
      box.append(el('h4', null, 'Your bids'));
      const bl = el('ul', 'market-list');
      for (const b of bids) {
        const word = b.state === 'high' ? (b.auctionState === 'open' ? `leading - ${endsText(b.endsAt)}` : 'leading')
          : b.state === 'won' ? 'won - it comes to you'
            : b.state === 'void' ? (b.returned ? 'the auction was removed - returned' : 'the auction was removed - returned when you next open the market')
              : b.returned ? 'outbid - returned' : 'outbid - returned when you next open the market';
        bl.append(el('li', `market-listing state-${b.state}`, `${m.pieceName(b.piece)} - ${marksText(b.amount)}${b.courier ? ` + ${b.courier} courier` : ''} - ${word}`));
      }
      box.append(bl);
    }
    const orders = st.data?.orders ?? [];
    if (orders.length) {
      box.append(el('h4', null, 'Your buy orders'));
      const ol = el('ul', 'market-list');
      for (const o of orders) ol.append(orderRow(o));
      box.append(ol);
    }
    return box;
  }

  function historyNode() {
    const box = el('div', 'market-history');
    const ul = el('ul', 'market-list');
    for (const h of st.data?.history ?? []) {
      const li = el('li', 'market-histrow');
      li.append(el('b', null, m.name(h.material)), el('span', 'market-units', `${h.units.toLocaleString('en-US')} sold this week`),
        el('span', 'market-median', `median ${medianText(h.median)}`));
      const line = medianLineNode(h.line);
      if (line) li.append(line);
      ul.append(li);
    }
    if (st.data && !(st.data.history?.length)) ul.append(el('li', 'notice-empty', 'Nothing has sold on the Bay\'s boards this week.'));
    box.append(ul);
    const trades = st.data?.trades ?? [];
    if (trades.length) {
      box.append(el('h4', null, 'Your trades'));
      const tl = el('ul', 'market-list');
      // AUDIT 30 U15: the Marks each trade moved - paid with its courier, or taken after the tax and the Tithe
      const verb = { bought: ['Bought', 'paid'], sold: ['Sold', 'to you'], filled: ['Filled an order with', 'to you'], ordered: ['Your order took', 'paid'],
        won: ['Won at auction', 'paid'], auctioned: ['Sold at auction', 'to you'] };   // PROF5b
      for (const t of trades) {
        const what = t.kind === 'piece' ? 'a crafted piece' : `${t.units} ${m.countName(t.material, t.units)}`;
        const [v, way] = verb[t.side] ?? [t.side, ''];
        tl.append(el('li', 'market-trade', `${v} ${what} - ${marksText(t.total)} ${way} - ${agoText(t.at, ui.nowS())}`));
      }
      box.append(tl);
    }
    return box;
  }

  /** AUDIT 30 U8, A12: the field that had the focus keeps it through a redraw (a read's answer redraws the tab). */
  const focusNow = () => {
    const a = /** @type {any} */ (globalThis.document?.activeElement);
    const key = a?.getAttribute?.('data-focus');
    if (!key) return null;
    let at = null;
    try { at = [a.selectionStart, a.selectionEnd]; } catch { /* a number field has none */ }
    return { key, at };
  };
  const refocus = (box, was) => {
    if (!was) return;
    Promise.resolve().then(() => {
      const n = /** @type {any} */ ([...box.querySelectorAll('input, select')].find((x) => x.getAttribute('data-focus') === was.key));
      if (!n || !n.isConnected) return;
      n.focus?.();
      if (was.at && was.at[0] != null) { try { n.setSelectionRange(was.at[0], was.at[1]); } catch { /* none to set */ } }
    });
  };

  /** The tab's body. */
  function body() {
    const was = focusNow();
    const box = el('div', 'notice-body market-body');
    box.append(viewsNode());
    const road = roadNode();
    if (road) box.append(road);
    if (st.error && !st.data) {
      // AUDIT 30 U11: the service's own word - a shut market, or a session to sign in again for
      const shut = SHUT.includes(st.error);
      const p = el('p', 'notice-empty', shut ? accountRefusalText(st.error) : st.error === 'offline' || st.error === 'server'
        ? 'The counting-house is not answering. The market cannot be read now.' : accountRefusalText(st.error));
      if (!shut) p.append(button('notice-retry', 'Try again', () => load(true)));
      box.append(p);
      return box;
    }
    if (st.loading && !st.data) box.append(el('p', 'notice-empty', 'Reading the market...'));
    if (st.view === 'auctions') {
      box.append(filtersNode(CRAFTED_FAMILIES));
      const rows = st.data?.rows ?? [];
      const list = el('div', 'market-rows');
      for (const a of rows) {
        list.append(auctionRow(a));
        if (st.picked === a.id) list.append(auctionBar(a));
      }
      if (st.data && !rows.length) list.append(el('p', 'notice-empty', 'No Masterwork is up for auction.'));
      box.append(list);
    } else if (st.view === 'materials' || st.view === 'crafted') {
      box.append(filtersNode(st.view === 'materials' ? MARKET_FAMILIES : CRAFTED_FAMILIES));
      const rows = [...(st.data?.rows ?? [])].sort((a, b) => landed(a) - landed(b) || a.price - b.price);
      const list = el('div', 'market-rows');
      for (const r of rows) {
        list.append(st.view === 'materials' ? materialRow(r) : pieceRow(r));
        if (st.picked === r.id) list.append(pickedBar(r));
      }
      if (st.data && !rows.length) list.append(el('p', 'notice-empty', st.view === 'materials' ? 'Nothing of that is listed on the Bay\'s boards.' : 'No crafted piece of that kind is listed.'));
      box.append(list);
      if (st.view === 'materials') box.append(weaversNode());
    } else if (st.view === 'mine') box.append(mineNode());
    else if (st.view === 'orders') {
      box.append(filtersNode(MARKET_FAMILIES));
      const ul = el('ul', 'market-list');
      // AUDIT 30 U7: this account's own orders stand among the region's, Withdraw beside them
      const orders = st.data?.orders ?? [];
      for (const o of orders) ul.append(orderRow(o));
      if (st.data && !orders.length) ul.append(el('li', 'notice-empty', `No buy orders stand on the boards of ${m.regionName}.`));
      box.append(ul, orderForm());
    } else box.append(historyNode());
    const held = m.book.state.held ?? 0;
    const foot = el('p', 'market-foot', `Your Marks: ${balance() == null ? '-' : marksText(balance())}${held > 0 ? ` (${marksText(held)} held in bids)` : ''}${st.stale ? ' - the market may be out of date' : ''}`);
    box.append(foot);
    refocus(box, was);
    return box;
  }

  return { body, open, load, state: st };
}
