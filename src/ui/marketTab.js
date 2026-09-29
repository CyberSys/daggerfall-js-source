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
import { accountRefusalText } from '../net/accountClient.js';
import {
  MARKET_VIEWS, MARKET_FAMILIES, CRAFTED_FAMILIES, MARKET_PRICE_MAX, MARKET_UNITS_MAX, listingFee, saleTax, courierFee, wearOf,
  wearText, medianText, marketCatalogue,
} from '../net/marketLaw.js';
import { material as materialStanding } from '../net/nodeLaw.js';
import { QUALITY_NAMES } from '../net/recipeLaw.js';
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
const numberInput = (value, min, max, cls = 'notice-input market-num') => {
  const i = /** @type {HTMLInputElement} */ (el('input', cls));
  i.type = 'number'; i.min = String(min); i.max = String(max); i.value = String(value);
  return i;
};
const select = (options, value, onChange) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select market-select'));
  for (const [v, label] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, label)); o.value = v; if (v === value) o.selected = true; s.append(o); }
  s.onchange = () => onChange(s.value);
  return s;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** "32 minutes", "2 hours", "arrived". */
export function arrivalText(atS, nowS) {
  const s = (Number(atS) || 0) - nowS;
  if (s <= 0) return 'arrived';
  const m = Math.ceil(s / 60);
  return m < 90 ? `${m} minute${m === 1 ? '' : 's'}` : `${Math.round(m / 60)} hours`;
}
/** "2 days ago", "3 hours ago", "just now". */
const agoText = (atS, nowS) => {
  const s = Math.max(0, nowS - (Number(atS) || 0));
  if (s >= 86400) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? '' : 's'} ago`; }
  if (s >= 3600) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'} ago`; }
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
 *   weavers: ReadonlyArray<{ key: string, marks: number }>, stock: (key: string, n: number) => Promise<{ ok: boolean, text?: string }>,
 * }} m the host's market (scenes/world.js)
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => Promise<void>, rerender: () => void, nowS: () => number,
 *   alive: () => boolean }} ui the window's
 */
export function createMarketTab(m, ui) {
  const st = {
    view: 'materials', family: /** @type {string|null} */ (null), tier: 0, query: '', picked: /** @type {string|null} */ (null),
    qty: 1, data: /** @type {any} */ (null), error: /** @type {string|null} */ (null), stale: false, loading: false,
    list: { kind: 'material', material: '', units: 1, price: 1, piece: '' }, post: { material: '', units: 1, price: 1 },
    fills: /** @type {Record<string, number>} */ ({}), weave: /** @type {Record<string, number>} */ ({}),
  };
  const q = () => ({ region: m.region, hubs: m.hubs, ...(st.view === 'materials' || st.view === 'orders' ? { family: st.family } : {}),
    ...(st.view === 'crafted' ? { family: st.family } : {}), ...(st.view === 'materials' && st.tier ? { tier: st.tier } : {}) });
  async function load(force = false) {
    st.loading = true; ui.rerender();
    const r = await m.book.read(st.view, q(), { force });
    if (!ui.alive()) return;
    st.loading = false;
    st.data = r.data; st.error = r.ok ? null : r.error; st.stale = !!r.stale;
    ui.rerender();
  }
  /** On the tab shown: the kept acts settled (and the arrived pieces collected), then the view read. */
  async function open() {
    if (m.book.pending || m.book.state.road.some((x) => x.kind === 'piece' && x.ready)) await m.book.settle(m.mint, m.putBack);
    await load(false);
  }
  const go = (view) => { st.view = view; st.picked = null; st.family = null; st.tier = 0; st.data = m.book.cached(view, q()); load(false); };
  /** An act through the window's door; its word, then the view read again. */
  const act = (start, okText) => ui.run(async () => {
    const r = await start();
    if (r?.ok) { st.picked = null; load(true); return { ok: true, text: typeof okText === 'function' ? okText(r.data) : okText }; }
    return { ok: false, text: r?.text ?? accountRefusalText(r?.error) };
  });
  const held = (key) => { const s = m.stores().get(key); return s ? s.own + s.bought : 0; };
  const where = (row) => (row.region === m.region ? 'here' : m.regionNameOf(row.region));
  const roadText = (road) => (!road ? 'no courier knows the road' : road.courier ? `+${road.courier} courier, ${arrivalText(road.seconds, 0)}` : '');

  function viewsNode() {
    const nav = el('nav', 'market-views');
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

  function filtersNode(families) {
    const row = el('div', 'market-filters');
    if (st.view === 'materials') {
      const search = /** @type {HTMLInputElement} */ (el('input', 'notice-input market-search'));
      search.placeholder = 'Search';
      search.value = st.query;
      search.oninput = () => { st.query = search.value; ui.rerender(); const s = /** @type {HTMLInputElement|null} */ (document.querySelector('.market-search')); s?.focus?.(); s?.setSelectionRange?.(st.query.length, st.query.length); };
      row.append(search);
    }
    row.append(select([['', 'All'], ...families], st.family ?? '', (v) => { st.family = v || null; st.picked = null; load(false); }));
    if (st.view === 'materials') {
      row.append(select([['0', 'Any tier'], ...[1, 2, 3, 4, 5, 6, 7].map((t) => [String(t), `Tier ${t}`])], String(st.tier), (v) => { st.tier = Number(v) || 0; st.picked = null; load(false); }));
    }
    return row;
  }

  function materialRow(row) {
    const med = st.data?.medians?.[row.material];
    const b = el('button', `market-row${st.picked === row.id ? ' on' : ''}`);
    b.setAttribute('type', 'button');
    b.append(el('b', null, `${m.name(row.material)} x${row.units.toLocaleString('en-US')}`),
      el('span', 'market-price', `${row.price.toLocaleString('en-US')} Mark${row.price === 1 ? '' : 's'} each`),
      el('span', 'market-where', `${where(row)}${row.region === m.region ? '' : ` ${roadText(row.road)}`}`),
      el('span', 'market-median', `median ${medianText(med?.median ?? null)}`));
    const line = medianLineNode(med?.line);
    if (line) b.append(line);
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', `${row.reports} report${row.reports === 1 ? '' : 's'}`));
    b.onclick = () => { st.picked = st.picked === row.id ? null : row.id; st.qty = Math.min(row.units, 20); ui.rerender(); };
    return b;
  }
  function pieceRow(row) {
    const p = row.piece;
    const b = el('button', `market-row market-piece${st.picked === row.id ? ' on' : ''}`);
    b.setAttribute('type', 'button');
    b.append(el('b', null, m.pieceName(p)),
      el('span', 'market-quality', [QUALITY_NAMES[p.quality] ?? null, p.maker ? `made by ${p.maker}` : null, wearText(p.wear)].filter(Boolean).join(' · ')),
      el('span', 'market-price', `${row.price.toLocaleString('en-US')} Marks`),
      el('span', 'market-where', `${where(row)}${row.region === m.region ? '' : ` ${roadText(row.road)}`}`));
    if (row.mine) b.append(el('span', 'market-mine', 'yours'));
    if (row.reports != null) b.append(el('span', 'market-mod', `${row.reports} report${row.reports === 1 ? '' : 's'}`));
    b.onclick = () => { st.picked = st.picked === row.id ? null : row.id; st.qty = 1; ui.rerender(); };
    return b;
  }
  /** The picked row's bar: "Buy N for P Marks + C courier?", Buy; Report; a moderator's Remove. */
  function pickedBar(row) {
    const bar = el('div', 'market-bar');
    const piece = row.kind === 'piece';
    const units = piece ? 1 : intOf(st.qty, 1, row.units);
    const courier = row.region === m.region ? 0 : row.road ? courierFee(units, row.road.road) : null;
    const total = units * row.price;
    const what = piece ? m.pieceName(row.piece) : `${units} ${m.countName(row.material, units)}`;
    if (!piece) {
      const n = numberInput(units, 1, row.units);
      n.onchange = () => { st.qty = intOf(n.value, 1, row.units); ui.rerender(); };
      bar.append(n);
    }
    bar.append(el('span', 'market-ask', courier == null ? `The couriers do not know the road to ${m.regionNameOf(row.region)} yet.`
      : `Buy ${what} for ${total.toLocaleString('en-US')} Marks${courier ? ` + ${courier} courier` : ''}?`));
    const buy = button('primary market-buy', ui.busy() ? 'Buying...' : 'Buy', () => act(
      () => m.book.buy({ region: m.region, listing: row.id, units, max: total + (courier ?? 0), hubs: m.hubs }, m.mint),
      (d) => (d?.sale?.here ? `Bought ${what}.` : `Bought ${what} - the courier brings it from ${m.regionNameOf(row.region)} in ${arrivalText(d?.sale?.arrivesAt, ui.nowS())}.`),
    ));
    buy.disabled = ui.busy() || row.mine || courier == null || (m.book.state.balance != null && m.book.state.balance < total + (courier ?? 0));
    bar.append(buy);
    if (!row.mine) bar.append(button('market-report', 'Report', () => act(() => m.book.report(row.id), 'Reported. A moderator will look at it.')));
    if (row.reports != null) bar.append(button('market-remove', 'Remove', () => act(() => m.book.remove(row.id), 'Removed. Its goods go back to its seller.')));
    return bar;
  }

  function weaversNode() {
    const box = el('div', 'market-counter');
    box.append(el('h4', null, 'The Weavers\' counter'));
    for (const w of m.weavers) {
      const row = el('div', 'market-counterrow');
      const n = st.weave[w.key] ?? 1;
      const inp = numberInput(n, 1, 100);
      inp.onchange = () => { st.weave[w.key] = intOf(inp.value, 1, 100); ui.rerender(); };
      row.append(el('b', null, m.name(w.key)), el('span', 'market-price', `${w.marks} Marks a bolt`), inp,
        button('market-weave', `Buy for ${(w.marks * n).toLocaleString('en-US')} Marks`, () => ui.run(() => m.stock(w.key, n))));
      box.append(row);
    }
    box.append(el('p', 'notice-hint', 'Into your Stores. A bolt stays there until its craft is practised.'));
    return box;
  }

  function listForm() {
    const box = el('div', 'market-listform');
    box.append(el('h4', null, 'List on the market'));
    box.append(select([['material', 'From the Stores'], ['piece', 'A crafted piece']], st.list.kind, (v) => { st.list.kind = v; ui.rerender(); }));
    let fee = 0, can = false, go = () => {};
    const price = numberInput(st.list.price, 1, MARKET_PRICE_MAX);
    price.onchange = () => { st.list.price = intOf(price.value, 1, MARKET_PRICE_MAX); ui.rerender(); };
    if (st.list.kind === 'material') {
      const stores = [...m.stores().values()].filter((s) => s.own + s.bought > 0);
      if (!stores.some((s) => s.material === st.list.material)) st.list.material = stores[0]?.material ?? '';
      const most = held(st.list.material);
      st.list.units = intOf(st.list.units, 1, Math.max(1, Math.min(most, MARKET_UNITS_MAX)));
      const units = numberInput(st.list.units, 1, Math.max(1, most));
      units.onchange = () => { st.list.units = intOf(units.value, 1, Math.max(1, most)); ui.rerender(); };
      box.append(select(stores.map((s) => [s.material, `${m.name(s.material)} (${(s.own + s.bought).toLocaleString('en-US')})`]), st.list.material, (v) => { st.list.material = v; ui.rerender(); }),
        el('span', 'notice-label', 'Units'), units, el('span', 'notice-label', 'Marks each'), price);
      fee = listingFee(st.list.units * st.list.price);
      can = !!st.list.material && most >= st.list.units;
      go = () => act(() => m.book.list({ region: m.region, kind: 'material', material: st.list.material, units: st.list.units, price: st.list.price, hubs: m.hubs }),
        `Listed ${st.list.units} ${m.countName(st.list.material, st.list.units)} at ${st.list.price} Marks each.`);
    } else {
      const pieces = m.pieces();
      if (!pieces.some((p) => p.item.provenance === st.list.piece)) st.list.piece = pieces[0]?.item.provenance ?? '';
      const chosen = pieces.find((p) => p.item.provenance === st.list.piece) ?? null;
      box.append(pieces.length ? select(pieces.map((p) => [p.item.provenance, `${p.name}${p.where === 'home' ? ' (your home)' : ''}`]), st.list.piece, (v) => { st.list.piece = v; ui.rerender(); })
        : el('span', 'notice-hint', 'You carry no crafted piece to sell.'), el('span', 'notice-label', 'Price in Marks'), price);
      fee = listingFee(st.list.price);
      can = !!chosen;
      go = () => act(() => m.book.list({ region: m.region, kind: 'piece', provenance: chosen.item.provenance, wear: wearOf(chosen.item), price: st.list.price, hubs: m.hubs },
        { item: chosen.item, where: chosen.where, take: () => m.take(chosen.item, chosen.where), putBack: m.putBack }), `Listed ${chosen?.name} at ${st.list.price} Marks.`);
    }
    const worth = st.list.kind === 'material' ? st.list.units * st.list.price : st.list.price;
    box.append(el('p', 'notice-hint', `Listing fee ${fee} Mark${fee === 1 ? '' : 's'}, kept if you cancel. It stands on the boards of ${m.regionName} for 72 hours; a sale pays you its price less ${saleTax(100)}% (${(worth - saleTax(worth)).toLocaleString('en-US')} Marks if it all sells).`));
    const b = button('primary market-list', 'List', go);
    b.disabled = ui.busy() || !can;
    box.append(b);
    return box;
  }

  function orderForm() {
    const box = el('div', 'market-orderform');
    box.append(el('h4', null, 'Post a buy order'));
    const cat = marketCatalogue();
    if (!st.post.material) st.post.material = cat[0]?.key ?? '';
    const units = numberInput(st.post.units, 1, MARKET_UNITS_MAX);
    units.onchange = () => { st.post.units = intOf(units.value, 1, MARKET_UNITS_MAX); ui.rerender(); };
    const price = numberInput(st.post.price, 1, MARKET_PRICE_MAX);
    price.onchange = () => { st.post.price = intOf(price.value, 1, MARKET_PRICE_MAX); ui.rerender(); };
    box.append(select(cat.map((c) => [c.key, `${m.name(c.key)} (tier ${c.tier})`]), st.post.material, (v) => { st.post.material = v; ui.rerender(); }),
      el('span', 'notice-label', 'Units'), units, el('span', 'notice-label', 'Marks each'), price);
    const cost = st.post.units * st.post.price;
    box.append(el('p', 'notice-hint', `${cost.toLocaleString('en-US')} Marks held for it while it stands (7 days); what is not filled comes back.`));
    const b = button('primary market-post', 'Post the order', () => act(() => m.book.order({ region: m.region, material: st.post.material, units: st.post.units, price: st.post.price, hubs: m.hubs }),
      `Your order for ${st.post.units} ${m.countName(st.post.material, st.post.units)} is up.`));
    b.disabled = ui.busy() || !st.post.material || (m.book.state.balance != null && m.book.state.balance < cost);
    box.append(b);
    return box;
  }

  function orderRow(o) {
    const li = el('li', `market-order${o.mine ? ' mine' : ''}`);
    li.append(el('b', null, `${m.name(o.material)}`), el('span', 'market-price', `${o.left.toLocaleString('en-US')} of ${o.units.toLocaleString('en-US')} wanted at ${o.price} Marks each`));
    const med = st.data?.medians?.[o.material];
    if (med) li.append(el('span', 'market-median', `median ${medianText(med.median)}`));
    if (o.mine) {
      li.append(el('span', 'market-state', o.state === 'open' ? `${Math.max(0, Math.ceil((o.expiresAt - ui.nowS()) / 86400))} days left` : o.state));
      if (o.state === 'open') li.append(button('market-unorder', 'Withdraw', () => act(() => m.book.unorder(o.id), 'Withdrawn. What was held for it is back.')));
      return li;
    }
    const have = held(o.material);
    const n = intOf(st.fills[o.id] ?? Math.min(have, o.left), 1, Math.max(1, Math.min(have, o.left)));
    const inp = numberInput(n, 1, Math.max(1, Math.min(have, o.left)));
    inp.onchange = () => { st.fills[o.id] = intOf(inp.value, 1, Math.max(1, Math.min(have, o.left))); ui.rerender(); };
    const b = button('primary market-fill', `Fill ${n} from the Stores`, () => act(() => m.book.fill({ region: m.region, order: o.id, units: n, hubs: m.hubs }),
      (d) => `Filled: ${d?.fill?.pay ?? ''} Marks.`));
    b.disabled = ui.busy() || have < 1;
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
        el('span', 'market-price', `${l.price.toLocaleString('en-US')} Marks${l.kind === 'piece' ? '' : ' each'}`),
        el('span', 'market-where', l.region === m.region ? 'here' : m.regionNameOf(l.region)),
        el('span', 'market-state', l.state === 'open' ? `${Math.max(0, Math.ceil((l.expiresAt - ui.nowS()) / 3600))} hours left` : l.state));
      if (l.state === 'open') li.append(button('market-cancel', 'Cancel', () => act(() => m.book.cancel(l.id, m.mint), 'Cancelled. The goods are back; the fee is kept.')));
      ul.append(li);
    }
    if (!rows.length && st.data) ul.append(el('li', 'notice-empty', 'You have nothing on the market.'));
    box.append(ul);
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
      const verb = { bought: 'Bought', sold: 'Sold', filled: 'Filled an order with', ordered: 'Your order took' };
      for (const t of trades) {
        const what = t.kind === 'piece' ? 'a crafted piece' : `${t.units} ${m.countName(t.material, t.units)}`;
        tl.append(el('li', 'market-trade', `${verb[t.side] ?? t.side} ${what} for ${t.total.toLocaleString('en-US')} Marks - ${agoText(t.at, ui.nowS())}`));
      }
      box.append(tl);
    }
    return box;
  }

  /** The tab's body. */
  function body() {
    const box = el('div', 'notice-body market-body');
    box.append(viewsNode());
    const road = roadNode();
    if (road) box.append(road);
    if (st.error && !st.data) {
      const shut = ['market-closed', 'prof-need-account', 'no-session', 'auth'].includes(st.error);
      const p = el('p', 'notice-empty', shut ? 'The market is not open to you.' : 'The counting-house is not answering. The market cannot be read now.');
      if (!shut) p.append(button('notice-retry', 'Try again', () => load(true)));
      box.append(p);
      return box;
    }
    if (st.loading && !st.data) box.append(el('p', 'notice-empty', 'Reading the market...'));
    if (st.view === 'materials' || st.view === 'crafted') {
      box.append(filtersNode(st.view === 'materials' ? MARKET_FAMILIES : CRAFTED_FAMILIES));
      const needle = st.query.trim().toLowerCase();
      const rows = (st.data?.rows ?? []).filter((r) => st.view === 'crafted' || !needle || m.name(r.material).toLowerCase().includes(needle));
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
      for (const o of (st.data?.orders ?? []).filter((x) => !x.mine)) ul.append(orderRow(o));
      if (st.data && !(st.data.orders ?? []).some((x) => !x.mine)) ul.append(el('li', 'notice-empty', `No buy orders stand on the boards of ${m.regionName}.`));
      box.append(ul, orderForm());
    } else box.append(historyNode());
    const foot = el('p', 'market-foot', `Your Marks: ${m.book.state.balance == null ? '-' : marksText(m.book.state.balance)}${st.stale ? ' - the market may be out of date' : ''}`);
    box.append(foot);
    return box;
  }

  return { body, open, load, state: st };
}
