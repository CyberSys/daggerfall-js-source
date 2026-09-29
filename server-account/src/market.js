// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET, AS THE SERVICE KEEPS
// IT: listings of Stores materials and crafted pieces, their sales and
// couriers, buy orders and their fills, the prices' history, reports and
// removal (bible/06-Systems/Professions-Arc.md 10.2-10.5 and 26; the
// numbers are src/net/marketLaw.js, which the client reads too).
//
// ═══ OPEN WHERE THE BOARD, THE PROFESSIONS AND THE MARKS ARE ═══════
//
// The market is the board's tab, sells the Stores and moves Marks, so it
// is open to an account only while BOARD_OPEN, PROFESSIONS_OPEN and
// MARKS_OPEN all are (PROF0 26: no switch of its own). Registered accounts
// alone, as the Stores are.
//
// ═══ ONE STATEMENT DECIDES, AND A REQUEST ASKED TWICE IS ONE ════════
//
// PROF1's law, whole: each act is one `db.batch` whose FIRST statement
// writes its row with a fresh nonce `n` only where every condition holds
// against the rows as they stand - the listing still open with the units,
// the buyer's Marks, the seller's room under the cap, the Stores' room -
// and every statement after it moves goods and Marks only where that row
// carries this request's nonce. The row is looked for BEFORE the switch
// (AUDIT 28 M2): a request that was made is answered, `repeat`.
//
// ═══ SETTLED ON READ ════════════════════════════════════════════════
//
// Nothing here runs on a clock. A listing past its 72 hours, an order past
// its seventh day, a courier's load that has arrived - each is settled on
// its owner's next read of the market, one row a batch (so a full Stores
// keeps one load waiting without refusing the rest), each keyed on its
// row's own id, so it happens once.
//
// ═══ THE LEDGER'S LINES (AUDIT 30 S1-S4) ════════════════════════════
//
// Every Marks line an act writes carries its OWN name in the one ledger's `(actor, rid)` namespace - the request id and
// a suffix no client id can hold (`:fee`, `:sale`, `:tax`, `:courier`, `:escrow`, `:fill`, `:filltax`) - and is a plain
// INSERT: a line that cannot be written (a clash, a balance its trigger would break) throws and rolls the whole act
// back, where INSERT OR IGNORE let the act stand with its Marks unmoved (and swallowed the trigger's CHECK). The rows
// that answer a repeat are pruned after 90 days (section 20) but the ledger is forever, so each decision also refuses
// a request whose first line the ledger already holds - a request id is spent once, whatever was pruned since.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, mintId, overRate } from './accounts.js';
import { canModerate } from './titles.js';
import { marksOpenFor, balanceOf } from './marks.js';
import { boardOpenFor } from './board.js';
import { profOpenFor, spendStatements, storeOf } from './professions.js';
import { CHAR_ID_RE } from './service.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { STORES_MAX } from '../../src/net/professionLaw.js';
import { material, regionOk, WITNESS } from '../../src/net/nodeLaw.js';
import { recipeById } from '../../src/net/recipeLaw.js';
import {
  MARKET_LISTING_S, MARKET_ORDER_S, MARKET_LISTINGS_MAX, MARKET_ORDERS_MAX, MARKET_POSTS_MAX, MARKET_OPS_MAX, MARKET_WINDOW_S,
  MARKET_SHOWN, MARKET_HISTORY_SHOWN, MARKET_TRADES_SHOWN, MARKET_MEDIAN_DAYS, MARKET_KEEP_DAYS, MARKET_RID_RE, MARKET_ID_RE,
  MARKET_VIEWS, CRAFTED_FAMILIES, unitsOk, priceOk, wearOk, provenanceOk, listingFee, saleTaxOn, saleTithe, hubReport, hubPixelOk,
  MARKET_WORTH_MAX, UNYIELDED, pieceListable,
  hubPixel, roadPixels, courierFee, courierSeconds, medianOf, medianLine, marketCatalogue,
} from '../../src/net/marketLaw.js';

const DAY_S = 86_400;
/** How far back "My listings" shows a closed listing or order, and "Your trades" reaches. */
const RECENT_S = 7 * DAY_S;
/** Rows one settle works, at most - a read settles the rest next time. */
const SETTLE_MAX = 20;

/** Whether the market is open to this account: the board, the professions and the Marks, each at its switch. */
export function marketOpenFor(player, env) {
  return boardOpenFor(player, env) && profOpenFor(player, env) && marksOpenFor(player, env);
}
const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
/** The first door: a registered account, its character, and (for an act) a request id. */
function asks(player, { character, rid, needRid = true, needChar = true }) {
  if (accountKind(player) !== 'linked') return { error: 'prof-need-account' };
  if (needChar && !charOk(character)) return { error: 'prof-character' };
  if (needRid && (typeof rid !== 'string' || !MARKET_RID_RE.test(rid))) return { error: 'prof-rid' };
  return null;
}
const shut = (player, env) => (marketOpenFor(player, env) ? null : { error: 'market-closed' });
const idOk = (id) => typeof id === 'string' && MARKET_ID_RE.test(id);
/** An account a week registered may witness (SEAT0 3.2), as a harvest's does. */
const witnessOf = (player, nowS) => (Number.isSafeInteger(player.registered_at) && player.registered_at <= nowS - WITNESS.ageS ? 1 : 0);

/** The hubs a request carries - `{ [region]: [x, y] }`, the client's own derivation - as a Map of region to pixel;
 *  anything out of shape is left out, never refused. */
function hubsOf(hubs) {
  const out = new Map();
  if (!hubs || typeof hubs !== 'object' || Array.isArray(hubs)) return out;
  for (const [k, v] of Object.entries(hubs).slice(0, 62)) {
    const r = Number(k);
    if (!regionOk(r) || !Array.isArray(v)) continue;
    const [x, y] = v;
    if (hubPixelOk(x, y)) out.set(r, { x, y });
  }
  return out;
}
/** THE ROADS' ENDS: each region's hub as the witnesses say it is, else as this client derived it (marketLaw hubPixel). */
async function hubsAt(db, regions, own) {
  const keys = [...new Set(regions)].map(String);
  const out = new Map();
  if (!keys.length) return out;
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = 'hub' AND key IN (${keys.map((_, i) => `?${i + 1}`).join(', ')})`)
    .bind(...keys).all();
  for (const k of keys) {
    const rows = results.filter((r) => r.key === k).map((r) => ({ account: r.account, report: r.report, at: Number(r.at) }));
    out.set(Number(k), hubPixel(rows, own.get(Number(k)) ?? null));
  }
  return out;
}
/** The courier between two regions: `{ courier, seconds, road }` - nothing on the same region, null with no road. */
function courierOf(hubs, from, to, units) {
  if (from === to) return { courier: 0, seconds: 0, road: 0 };
  const a = hubs.get(from), b = hubs.get(to);
  if (!a || !b) return null;
  const road = roadPixels(a, b);
  return { courier: courierFee(units, road), seconds: courierSeconds(road), road };
}
/** AUDIT 30 S3: whether the ledger already holds this account's line `rid` + `suffix` - a request id spent, though the
 *  row that would answer its repeat was pruned. */
const spent = async (db, me, rid, suffix) => !!(await db.prepare('SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(me, `${rid}${suffix}`).first());
/** The witness statements an act writes for the regions it names (SEAT0 3.2), each where its decision stands. */
function witnessStatements(db, player, nowS, regions, own, guardSql, guardBinds) {
  if (!witnessOf(player, nowS)) return [];
  const out = [];
  for (const r of new Set(regions)) {
    const px = own.get(r);
    if (!px) continue;
    out.push(db.prepare(`INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at)
      SELECT 'hub', ?1, ?2, ?3, ?4, ?5 WHERE ${guardSql}`).bind(String(r), player.id, hubReport(px.x, px.y), r, nowS, ...guardBinds));
  }
  return out;
}

// ─── WHAT A ROW LOOKS LIKE TO THE CLIENT ─────────────────────────────

const pieceOf = (p, wear) => (p ? {
  provenance: p.provenance, recipe: p.recipe, quality: Number(p.quality), seed: Number(p.seed), maker: p.maker ?? null,
  marked: Number(p.marked) === 1, template: Number(p.template), material: Number(p.material), wear: Number(wear),
} : null);
function listingView(l, me, extra = {}) {
  return {
    id: l.id, kind: l.kind, region: Number(l.region), ...(l.material ? { material: l.material } : {}),
    units: Number(l.own) + Number(l.bought), listed: Number(l.units), price: Number(l.price), fee: Number(l.fee),
    ...(l.wear != null ? { wear: Number(l.wear) } : {}), at: Number(l.at), expiresAt: Number(l.expires_at), state: l.state,
    mine: l.seller === me, ...extra,
  };
}
const orderView = (o, me) => ({
  id: o.id, region: Number(o.region), material: o.material, units: Number(o.units), left: Number(o.left_units), price: Number(o.price),
  escrow: Number(o.escrow), at: Number(o.at), expiresAt: Number(o.expires_at), state: o.state, mine: o.poster === me,
});

// ─── SETTLED ON READ ─────────────────────────────────────────────────

/**
 * An account's own market, settled: its listings past their hours closed and their goods returned (a material's units
 * to the listing character's Stores where there is room, a piece a delivery to collect), its orders past their days
 * closed and their escrow returned (under the Marks cap), its couriers' loads that have arrived put in the Stores
 * (where there is room). One row a batch; SETTLE_MAX rows a read.
 */
async function settle(ctx, player) {
  const { db, nowS, rand } = ctx;
  const me = player.id;
  /** AUDIT 30 U1: the Stores this settle moved, `char_id|material`, so a read can answer them */
  const touched = new Set();
  await db.batch([
    db.prepare(`UPDATE market_listings SET state = 'expired', closed_at = ?2 WHERE seller = ?1 AND state = 'open' AND expires_at <= ?2`).bind(me, nowS),
    db.prepare(`UPDATE market_orders SET state = 'expired', closed_at = ?2 WHERE poster = ?1 AND state = 'open' AND expires_at <= ?2`).bind(me, nowS),
  ]);
  // the listings' goods back
  // AUDIT 30 S7: only what can settle now - a return a full Stores cannot take waits without holding back the rest
  const { results: back = [] } = await db.prepare(`SELECT * FROM market_listings WHERE seller = ?1 AND state IN ('expired', 'removed') AND returned = 0
      AND (kind = 'piece' OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = market_listings.seller AND char_id = market_listings.char_id
        AND material = market_listings.material), 0) + own + bought <= ?2)
    ORDER BY closed_at LIMIT ${SETTLE_MAX}`).bind(me, STORES_MAX).all();
  for (const l of back) {
    const nonce = mintId(rand);
    if (l.kind === 'piece') {
      await db.batch([
        db.prepare(`UPDATE market_listings SET returned = 1, rn = ?2 WHERE id = ?1 AND returned = 0`).bind(l.id, nonce),
        db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
          SELECT id, seller, char_id, provenance, wear, 'returned', region, ?2, ?2 FROM market_listings WHERE id = ?1 AND rn = ?3`).bind(l.id, nowS, nonce),
        db.prepare(`UPDATE products SET listed = 0 WHERE provenance = (SELECT provenance FROM market_listings WHERE id = ?1 AND rn = ?2)`).bind(l.id, nonce),
      ]);
      continue;
    }
    await db.batch([
      db.prepare(`UPDATE market_listings SET returned = 1, rn = ?2 WHERE id = ?1 AND returned = 0
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = market_listings.seller AND char_id = market_listings.char_id AND material = market_listings.material), 0)
          + own + bought <= ?3`).bind(l.id, nonce, STORES_MAX),
      ...backToStores(db, l.id, nonce),
    ]);
    touched.add(`${l.char_id}|${l.material}`);
  }
  // the orders' escrow back
  const { results: shutOrders = [] } = await db.prepare(`SELECT id FROM market_orders WHERE poster = ?1 AND state != 'open' AND returned = 0
      AND (escrow = 0 OR COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + escrow <= ?2)
    ORDER BY closed_at LIMIT ${SETTLE_MAX}`).bind(me, MARKS_MAX).all();
  for (const o of shutOrders) await db.batch(orderReturn(db, o.id, nowS));
  // the couriers' loads that have arrived
  const { results: loads = [] } = await db.prepare(`SELECT rid, char_id, material FROM market_sales WHERE buyer = ?1 AND kind = 'material' AND delivered = 0 AND arrives_at <= ?2
      AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = market_sales.char_id AND material = market_sales.material), 0) + units <= ?3
    ORDER BY arrives_at LIMIT ${SETTLE_MAX}`).bind(me, nowS, STORES_MAX).all();
  for (const s of loads) {
    const nonce = mintId(rand);
    await db.batch([
      db.prepare(`UPDATE market_sales SET delivered = 1, dn = ?3 WHERE buyer = ?1 AND rid = ?2 AND delivered = 0
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = market_sales.char_id AND material = market_sales.material), 0) + units <= ?4`)
        .bind(me, s.rid, nonce, STORES_MAX),
      db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
        SELECT buyer, char_id, material, 'bought', units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND dn = ?3
        ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, s.rid, nonce),
    ]);
    touched.add(`${s.char_id}|${s.material}`);
  }
  return touched;
}
/** A closed listing's units back into its character's Stores, each with its origin - where its return carries `nonce`. */
function backToStores(db, id, nonce) {
  return ['own', 'bought'].map((origin) => db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT seller, char_id, material, '${origin}', ${origin} FROM market_listings WHERE id = ?1 AND rn = ?2 AND kind = 'material' AND ${origin} > 0
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(id, nonce));
}
/** What is left of a closed order's escrow back to its poster - one line keyed on the order's own id, under the Marks
 *  cap (else it waits) - then the order marked returned. */
function orderReturn(db, id, nowS) {
  return [
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', id, 'account', poster, 'order-return', escrow, ?2, ?3, poster, material, 'order-close:' || id FROM market_orders
      WHERE id = ?1 AND state != 'open' AND returned = 0 AND escrow > 0
        AND COALESCE((SELECT balance FROM marks WHERE account = market_orders.poster), 0) + escrow <= ?4`).bind(id, utcDay(nowS), nowS, MARKS_MAX),
    db.prepare(`UPDATE market_orders SET escrow = 0, returned = 1 WHERE id = ?1 AND state != 'open' AND returned = 0
      AND (escrow = 0 OR EXISTS (SELECT 1 FROM marks_ledger WHERE actor = market_orders.poster AND rid = 'order-close:' || ?1))`).bind(id),
  ];
}
/** What is on its way to this account: couriers' loads not yet in the Stores and pieces not yet collected. */
async function roadOf(db, me, nowS) {
  const { results: loads = [] } = await db.prepare(`SELECT rid, char_id, material, units, from_region, arrives_at FROM market_sales
    WHERE buyer = ?1 AND kind = 'material' AND delivered = 0 ORDER BY arrives_at LIMIT 50`).bind(me).all();
  const { results: pieces = [] } = await db.prepare(`SELECT d.id, d.char_id, d.wear, d.why, d.from_region, d.arrives_at, p.recipe, p.quality, p.seed, p.maker, p.marked,
    p.template, p.material, p.provenance FROM market_deliveries d JOIN products p ON p.provenance = d.provenance
    WHERE d.player = ?1 AND d.collected = 0 ORDER BY d.arrives_at LIMIT 50`).bind(me).all();
  return [
    ...loads.map((s) => ({ kind: 'material', id: s.rid, character: s.char_id, material: s.material, units: Number(s.units), from: Number(s.from_region),
      arrivesAt: Number(s.arrives_at), waiting: Number(s.arrives_at) <= nowS })),
    ...pieces.map((d) => ({ kind: 'piece', id: d.id, character: d.char_id, why: d.why, from: d.from_region == null ? null : Number(d.from_region),
      arrivesAt: Number(d.arrives_at), ready: Number(d.arrives_at) <= nowS, piece: pieceOf(d, d.wear) })),
  ];
}

// ─── THE READ ────────────────────────────────────────────────────────

/** The medians and lines of `keys` over the last MARKET_MEDIAN_DAYS UTC days (10.2): a Map of key to { median, line }. */
async function mediansOf(db, keys, today) {
  const out = new Map();
  if (!keys.length) return out;
  const { results = [] } = await db.prepare(`SELECT day, material, price, units FROM market_prices WHERE day > ?1 AND material IN
    (${keys.map((_, i) => `?${i + 2}`).join(', ')})`).bind(today - MARKET_MEDIAN_DAYS, ...keys).all();
  for (const k of keys) {
    const rows = results.filter((r) => r.material === k).map((r) => ({ day: Number(r.day), price: Number(r.price), units: Number(r.units) }));
    out.set(k, { median: medianOf(rows), line: medianLine(rows, today) });
  }
  return out;
}

/**
 * THE MARKET TAB: `{ character, region, view, family?, tier?, material?, hubs? }` - the board's region and one of its
 * views (marketLaw MARKET_VIEWS), after the account's own market is settled. Every answer carries what is on its way
 * to the account, its balance and its live counts.
 */
export async function marketRead(ctx, player, env, { character, region, view, family = null, tier = null, material: key = null, materials = null, hubs } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { character, needRid: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!MARKET_VIEWS.some(([v]) => v === view)) return { error: 'bad-act' };
  const touched = await settle(ctx, player);
  const me = player.id;
  const today = utcDay(nowS);
  const own = hubsOf(hubs);
  const moderator = canModerate(player, env);
  // AUDIT 30 U1: this character's Stores the settle moved, answered so the pages read them
  const stores = [];
  for (const t of touched) {
    const [c, m] = t.split('|');
    if (c === character) stores.push(await storeOf(db, me, c, m));
  }
  const base = async () => {
    const counts = await db.prepare(`SELECT
        (SELECT COUNT(*) FROM market_listings WHERE seller = ?1 AND state = 'open') AS listings,
        (SELECT COUNT(*) FROM market_orders WHERE poster = ?1 AND state = 'open') AS orders`).bind(me).first();
    return {
      ok: true, view, region, road: await roadOf(db, me, nowS), balance: await balanceOf(db, me),
      counts: { listings: Number(counts?.listings ?? 0), orders: Number(counts?.orders ?? 0) }, stores,
    };
  };
  const reportsOf = async (ids) => {
    if (!moderator || !ids.length) return new Map();
    const { results = [] } = await db.prepare(`SELECT listing, COUNT(*) AS n FROM market_reports WHERE listing IN (${ids.map((_, i) => `?${i + 1}`).join(', ')}) GROUP BY listing`)
      .bind(...ids).all();
    return new Map(results.map((r) => [r.listing, Number(r.n)]));
  };
  const quote = async (rows, unitsOf) => {
    const at = await hubsAt(db, [region, ...rows.map((l) => Number(l.region))], own);
    return rows.map((l) => courierOf(at, Number(l.region), region, unitsOf(l)));
  };

  if (view === 'materials') {
    // AUDIT 30 U2: the materials asked for chosen in the query itself - one, a search's matches, or a family's and a
    // tier's - so a rare material is never lost behind the five hundred cheapest of everything else
    const keys = key ? [key]
      : Array.isArray(materials) ? materials.filter((k) => typeof k === 'string' && material(k)).slice(0, 120)
        : (family || tier) ? marketCatalogue().filter((c) => (!family || c.family === family) && (!tier || c.tier === tier)).map((c) => c.key)
          : null;
    if (keys && !keys.length) return { ...(await base()), rows: [], medians: {} };
    const { results = [] } = await db.prepare(`SELECT * FROM market_listings WHERE state = 'open' AND kind = 'material' AND expires_at > ?1
      ${keys ? `AND material IN (${keys.map((_, i) => `?${i + 2}`).join(', ')})` : ''} ORDER BY price, at LIMIT ${MARKET_SHOWN}`)
      .bind(nowS, ...(keys ?? [])).all();
    const rows = results.filter((l) => material(l.material));
    const quotes = await quote(rows, (l) => Number(l.own) + Number(l.bought));
    const medians = await mediansOf(db, [...new Set(rows.map((l) => l.material))], today);
    const reports = await reportsOf(rows.map((l) => l.id));
    return {
      ...(await base()),
      rows: rows.map((l, i) => listingView(l, me, { road: quotes[i], ...(moderator ? { reports: reports.get(l.id) ?? 0 } : {}) })),
      medians: Object.fromEntries([...medians].map(([k, v]) => [k, v])),
    };
  }
  if (view === 'crafted') {
    const { results = [] } = await db.prepare(`SELECT l.*, p.recipe, p.quality, p.seed, p.maker, p.marked, p.template, p.material AS dfu_material
      FROM market_listings l JOIN products p ON p.provenance = l.provenance
      WHERE l.state = 'open' AND l.kind = 'piece' AND l.expires_at > ?1 ORDER BY l.price, l.at LIMIT 500`).bind(nowS).all();
    const famOk = (f) => !family || f === family;
    const rows = results.filter((l) => famOk(recipeById(l.recipe)?.family ?? null) && CRAFTED_FAMILIES.some(([f]) => f === recipeById(l.recipe)?.family))
      .slice(0, MARKET_SHOWN);
    const quotes = await quote(rows, () => 1);
    const reports = await reportsOf(rows.map((l) => l.id));
    return {
      ...(await base()),
      rows: rows.map((l, i) => listingView(l, me, {
        road: quotes[i], piece: pieceOf({ ...l, material: l.dfu_material }, l.wear), ...(moderator ? { reports: reports.get(l.id) ?? 0 } : {}),
      })),
    };
  }
  if (view === 'mine') {
    const { results: listings = [] } = await db.prepare(`SELECT l.*, p.recipe, p.quality, p.seed, p.maker, p.marked, p.template, p.material AS dfu_material
      FROM market_listings l LEFT JOIN products p ON p.provenance = l.provenance
      WHERE l.seller = ?1 AND (l.state = 'open' OR l.closed_at > ?2) ORDER BY l.state = 'open' DESC, l.at DESC LIMIT ${MARKET_SHOWN}`)
      .bind(me, nowS - RECENT_S).all();
    const { results: orders = [] } = await db.prepare(`SELECT * FROM market_orders WHERE poster = ?1 AND (state = 'open' OR closed_at > ?2)
      ORDER BY state = 'open' DESC, at DESC LIMIT ${MARKET_SHOWN}`).bind(me, nowS - RECENT_S).all();
    return {
      ...(await base()),
      rows: listings.map((l) => listingView(l, me, l.kind === 'piece' ? { piece: pieceOf({ ...l, material: l.dfu_material }, l.wear) } : {})),
      orders: orders.map((o) => orderView(o, me)),
    };
  }
  if (view === 'orders') {
    const { results = [] } = await db.prepare(`SELECT * FROM market_orders WHERE state = 'open' AND region = ?1 AND expires_at > ?2
      ORDER BY price DESC, at LIMIT ${MARKET_SHOWN}`).bind(region, nowS).all();
    const rows = results.filter((o) => !family || material(o.material)?.family === family);
    const medians = await mediansOf(db, [...new Set(rows.map((o) => o.material))], today);
    return { ...(await base()), orders: rows.map((o) => orderView(o, me)), medians: Object.fromEntries(medians) };
  }
  // history - pruned first (section 20: 90 days)
  const keepFrom = today - MARKET_KEEP_DAYS;
  await db.batch([
    db.prepare('DELETE FROM market_prices WHERE day < ?1').bind(keepFrom),
    db.prepare('DELETE FROM market_sales WHERE day < ?1 AND delivered = 1').bind(keepFrom),
    db.prepare('DELETE FROM market_fills WHERE day < ?1').bind(keepFrom),
    db.prepare(`DELETE FROM market_listings WHERE state != 'open' AND closed_at < ?1 AND (returned = 1 OR state = 'sold')`).bind(keepFrom * DAY_S),
    db.prepare(`DELETE FROM market_orders WHERE state != 'open' AND closed_at < ?1 AND returned = 1`).bind(keepFrom * DAY_S),
    db.prepare('DELETE FROM market_deliveries WHERE collected = 1 AND at < ?1').bind(keepFrom * DAY_S),
  ]);
  const { results: top = [] } = await db.prepare(`SELECT material, SUM(units) AS units FROM market_prices WHERE day > ?1 GROUP BY material
    ORDER BY units DESC, material LIMIT ${MARKET_HISTORY_SHOWN}`).bind(today - MARKET_MEDIAN_DAYS).all();
  const medians = await mediansOf(db, top.map((t) => t.material), today);
  // AUDIT 30 U15: the Marks each side moved - a buyer the price and the courier, a seller the price less the tax and the
  // Tithe, a filler the pay, an orderer the price
  const { results: sales = [] } = await db.prepare(`SELECT 'bought' AS side, kind, material, provenance, units, price, total + courier AS total, at FROM market_sales WHERE buyer = ?1 AND at > ?2
    UNION ALL SELECT 'sold', kind, material, provenance, units, price, total - tax - tithe, at FROM market_sales WHERE seller = ?1 AND at > ?2
    UNION ALL SELECT 'filled', 'material', material, NULL, units, price, pay, at FROM market_fills WHERE filler = ?1 AND at > ?2
    UNION ALL SELECT 'ordered', 'material', material, NULL, units, price, units * price, at FROM market_fills WHERE poster = ?1 AND at > ?2
    ORDER BY at DESC LIMIT ${MARKET_TRADES_SHOWN}`).bind(me, nowS - MARKET_KEEP_DAYS * DAY_S).all();
  return {
    ...(await base()),
    history: top.map((t) => ({ material: t.material, units: Number(t.units), ...(medians.get(t.material) ?? { median: null, line: [] }) })),
    trades: sales.map((s) => ({ side: s.side, kind: s.kind, material: s.material ?? null, provenance: s.provenance ?? null, units: Number(s.units),
      price: Number(s.price), total: Number(s.total), at: Number(s.at) })),
  };
}

// ─── A LISTING (10.2) ────────────────────────────────────────────────

/**
 * LIST: `{ character, region, kind, material?, units?, provenance?, wear?, price, hubs?, rid }` - a Stores material's
 * `units` (bought first out of the Stores, the split kept) at a unit price, or a crafted piece this account owns and has
 * not listed, at its whole price and wear - on the boards of `region` for 72 hours, for the listing fee burnt.
 */
export async function marketList(ctx, player, env, { character, region, kind, material: key = null, units = 1, provenance = null, wear = null, price, hubs, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, listing: listingView(row, me), balance: await balanceOf(db, me),
    ...(row.kind === 'material' ? { store: await storeOf(db, me, row.char_id, row.material) } : {}),
  });
  const prior = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!priceOk(price)) return { error: 'bad-price' };
  if (kind === 'material') {
    if (!material(key)) return { error: 'bad-material' };
    if (!unitsOk(units)) return { error: 'bad-units' };
    provenance = null; wear = null;   // AUDIT 30 S9: a kind's own fields alone - another's would break the row's CHECK
  } else if (kind === 'piece') {
    if (!provenanceOk(provenance)) return { error: 'bad-provenance' };
    if (!wearOk(wear)) return { error: 'bad-wear' };
    units = 1;
    key = null;
    // AUDIT 30 L2/S8: a piece of a family the market lists - never arrows (the crafter's quiver stays whole) nor a siege
    // work; the recipe is the product row's, fixed at the craft
    const made = await db.prepare('SELECT recipe FROM products WHERE provenance = ?1').bind(provenance).first();
    if (made && !pieceListable(made.recipe)) return { error: 'market-not-listable' };
  } else return { error: 'bad-act' };
  if (units * price > MARKET_WORTH_MAX) return { error: 'bad-price' };   // AUDIT 30 L8: no balance could pay its fee or buy it
  if (await overRate(ctx, `market-post:${me}`, MARKET_POSTS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await settle(ctx, player);
  const fee = listingFee(units * price);
  const nonce = mintId(rand);
  const id = mintId(rand);
  const mine = 'EXISTS (SELECT 1 FROM market_listings WHERE seller = ?1 AND rid = ?5 AND n = ?6)';
  const boughtHeld = `COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?6 AND origin = 'bought'), 0)`;
  const own = hubsOf(hubs);
  await db.batch([
    // THE DECISION: the fee held, a place among the thirty, and the goods - the units in the Stores, or the piece this
    // account's and listed nowhere
    db.prepare(`INSERT OR IGNORE INTO market_listings (id, seller, char_id, region, kind, material, provenance, units, own, bought, price, wear, fee, at, expires_at, rid, n)
      SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?7, ?8,
        CASE WHEN ?5 = 'material' THEN ?8 - MIN(?8, ${boughtHeld}) ELSE 1 END,
        CASE WHEN ?5 = 'material' THEN MIN(?8, ${boughtHeld}) ELSE 0 END,
        ?9, ?10, ?11, ?12, ?13, ?14, ?15
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?11
        AND (SELECT COUNT(*) FROM market_listings WHERE seller = ?1 AND state = 'open') < ?16
        AND ((?5 = 'material' AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?6), 0) >= ?8)
          OR (?5 = 'piece' AND EXISTS (SELECT 1 FROM products WHERE provenance = ?7 AND owner = ?1 AND listed = 0)
            AND NOT EXISTS (SELECT 1 FROM market_listings WHERE provenance = ?7 AND state = 'open')
            -- AUDIT 30 S5: not while a delivery of it waits to be collected (the pack does not hold it yet)
            AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = ?7 AND collected = 0)
            -- AUDIT 30 S6: not while it stands in a home
            AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?7)))
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?14 || ':fee')`)
      .bind(me, character, id, region, kind, key, provenance, units, price, wear, fee, nowS, nowS + MARKET_LISTING_S, rid, nonce, MARKET_LISTINGS_MAX),
    // a material's units out of the Stores, bought first
    ...(kind === 'material' ? spendStatements(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: mine, binds: [key, units, rid, nonce] }) : []),
    // a piece marked listed
    db.prepare(`UPDATE products SET listed = 1 WHERE provenance = ?2 AND EXISTS (SELECT 1 FROM market_listings WHERE seller = ?1 AND rid = ?3 AND n = ?4)`)
      .bind(me, provenance, rid, nonce),
    // the fee burnt
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', ?1, 'burn', NULL, 'market-fee', fee, ?2, at, ?1, id, rid || ':fee' FROM market_listings WHERE seller = ?1 AND rid = ?3 AND n = ?4`)
      .bind(me, utcDay(nowS), rid, nonce),
    ...witnessStatements(db, player, nowS, [region], own, 'EXISTS (SELECT 1 FROM market_listings WHERE seller = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':fee')) return { error: 'prof-rid' };
  if ((await balanceOf(db, me)) < fee) return { error: 'marks-short' };
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM market_listings WHERE seller = ?1 AND state = 'open'`).bind(me).first();
  if (Number(open?.n ?? 0) >= MARKET_LISTINGS_MAX) return { error: 'market-listings-max' };
  if (kind === 'material') return { error: 'stores-short' };
  const p = await db.prepare('SELECT owner, listed FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!p || p.owner !== me) return { error: 'market-not-yours' };
  if (await db.prepare('SELECT 1 FROM market_deliveries WHERE provenance = ?1 AND collected = 0').bind(provenance).first()) return { error: 'market-uncollected' };
  if (await db.prepare("SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?1").bind(provenance).first()) return { error: 'market-standing' };
  return { error: 'market-listed' };
}

// ─── BUYING (10.4) ───────────────────────────────────────────────────

/**
 * BUY: `{ character, region, listing, units?, max, hubs?, rid }` - `units` of a material listing (a piece whole) at its
 * price, and the courier when the listing stands in another region than the board's; `max` the most the buyer agreed
 * to pay in all. Here, a material goes into the Stores at once and a piece is answered to the pack; elsewhere the goods
 * go by courier. The seller is paid at the sale; a piece's owner moves to the buyer in the same batch.
 */
export async function marketBuy(ctx, player, env, { character, region, listing: id, units = 1, max, hubs, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => {
    const out = {
      ok: true, ...extra,
      sale: {
        listing: row.listing, kind: row.kind, ...(row.material ? { material: row.material } : {}), units: Number(row.units), price: Number(row.price),
        total: Number(row.total), tax: Number(row.tax), courier: Number(row.courier), arrivesAt: Number(row.arrives_at), here: Number(row.from_region) === Number(row.to_region),
        from: Number(row.from_region),
      },
      balance: await balanceOf(db, me),
    };
    if (row.kind === 'material') out.store = await storeOf(db, me, row.char_id, row.material);
    if (row.kind === 'piece') {
      const d = await db.prepare(`SELECT id, arrives_at FROM market_deliveries WHERE player = ?1 AND provenance = ?2 AND why = 'bought' AND at = ?3`).bind(me, row.provenance, row.at).first();
      if (d) out.delivery = { id: d.id, arrivesAt: Number(d.arrives_at) };
      else {
        const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(row.provenance).first();
        const l = await db.prepare('SELECT wear FROM market_listings WHERE id = ?1').bind(row.listing).first();
        out.piece = pieceOf(p, l?.wear ?? 1000);
      }
    }
    return out;
  };
  const prior = await db.prepare('SELECT * FROM market_sales WHERE buyer = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'bad-listing' };
  if (!Number.isSafeInteger(max) || max < 1) return { error: 'bad-price' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const l = await db.prepare('SELECT * FROM market_listings WHERE id = ?1').bind(id).first();
  if (!l || l.state !== 'open' || Number(l.expires_at) <= nowS) return { error: 'market-gone' };
  if (l.seller === me) return { error: 'market-own' };
  if (l.kind === 'piece') units = 1;
  else if (!unitsOk(units)) return { error: 'bad-units' };
  if (units > Number(l.own) + Number(l.bought)) return { error: 'market-short' };
  const from = Number(l.region);
  const own = hubsOf(hubs);
  const road = courierOf(await hubsAt(db, [from, region], own), from, region, units);
  if (!road) return { error: 'market-no-road' };
  const total = units * Number(l.price);
  // AUDIT 30 L6: the tax of the listing's running total - what it has sold before this, units x its price
  const left = Number(l.own) + Number(l.bought);
  const tax = saleTaxOn((Number(l.units) - left) * Number(l.price), total), tithe = saleTithe(total);
  const gets = total - tax - tithe;
  if (total + road.courier > max) return { error: 'market-price-moved' };
  const here = from === region;
  const delivered = l.kind === 'piece' || here ? 1 : 0;
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  const sold = 'EXISTS (SELECT 1 FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3)';
  await db.batch([
    // THE DECISION: the listing open with the units, the buyer's Marks, the seller's room under the cap, and here, the
    // Stores' room for a material
    db.prepare(`INSERT OR IGNORE INTO market_sales (buyer, rid, char_id, listing, seller, kind, material, provenance, units, price, total, tax, tithe,
        courier, road, from_region, to_region, arrives_at, delivered, at, day, n)
      SELECT ?1, ?2, ?3, l.id, l.seller, l.kind, l.material, l.provenance, ?4, l.price, ?5, ?6, ?7, ?8, ?9, l.region, ?10, ?11, ?12, ?13, ?14, ?15
      FROM market_listings l WHERE l.id = ?16 AND l.state = 'open' AND l.expires_at > ?13 AND l.seller != ?1 AND l.own + l.bought >= ?4
        AND l.price * ?4 = ?5
        AND l.own + l.bought = ?20   -- the running total the tax was taken on (AUDIT 30 L6)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2 || ':sale')   -- AUDIT 30 S3
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?5 + ?8
        AND COALESCE((SELECT balance FROM marks WHERE account = l.seller), 0) + ?17 <= ?18
        AND (?12 = 0 OR l.kind = 'piece'
          OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = l.material), 0) + ?4 <= ?19)`)
      .bind(me, rid, character, units, total, tax, tithe, road.courier, road.road, region, nowS + road.seconds, delivered, nowS, day, nonce,
        id, gets, MARKS_MAX, STORES_MAX, left),
    // the units out of the listing, bought first (the seller keeps its own for a cancel), and a listing sold out closed
    db.prepare(`UPDATE market_listings SET own = own - MAX(0, ?4 - bought), bought = MAX(0, bought - ?4),
        state = CASE WHEN own + bought = ?4 THEN 'sold' ELSE state END, closed_at = CASE WHEN own + bought = ?4 THEN ?5 ELSE closed_at END
      WHERE id = ?6 AND ${sold}`).bind(me, rid, nonce, units, nowS, id),
    // the Marks: the proceeds to the seller, the tax and the courier burnt
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, 'account', seller, 'market-sale', total - tax - tithe, day, at, buyer, listing, rid || ':sale'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, 'burn', NULL, 'market-tax', tax, day, at, buyer, listing, rid || ':tax'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND tax > 0`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', buyer, 'burn', NULL, 'courier', courier, day, at, buyer, listing, rid || ':courier'
      FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND courier > 0`).bind(me, rid, nonce),
    // a material here, into the Stores as bought
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT buyer, char_id, material, 'bought', units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'material' AND delivered = 1
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce),
    // a piece's owner moved, and by courier its delivery written
    db.prepare(`UPDATE products SET owner = ?1, listed = 0 WHERE provenance = (SELECT provenance FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'piece')`)
      .bind(me, rid, nonce),
    db.prepare(`INSERT OR IGNORE INTO market_deliveries (id, player, char_id, provenance, wear, why, from_region, arrives_at, at)
      SELECT ?4, s.buyer, s.char_id, s.provenance, l.wear, 'bought', s.from_region, s.arrives_at, s.at
      FROM market_sales s JOIN market_listings l ON l.id = s.listing
      WHERE s.buyer = ?1 AND s.rid = ?2 AND s.n = ?3 AND s.kind = 'piece' AND s.from_region != s.to_region`).bind(me, rid, nonce, mintId(rand)),
    // the price table (10.2's History) - a material's sale
    db.prepare(`INSERT INTO market_prices (day, material, price, units)
      SELECT day, material, price, units FROM market_sales WHERE buyer = ?1 AND rid = ?2 AND n = ?3 AND kind = 'material'
      ON CONFLICT (day, material, price) DO UPDATE SET units = market_prices.units + excluded.units`).bind(me, rid, nonce),
    ...witnessStatements(db, player, nowS, [from, region], own, 'EXISTS (SELECT 1 FROM market_sales WHERE buyer = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_sales WHERE buyer = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':sale')) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT * FROM market_listings WHERE id = ?1').bind(id).first();
  if (!now || now.state !== 'open') return { error: 'market-gone' };
  if (Number(now.own) + Number(now.bought) < units) return { error: 'market-short' };
  if (Number(now.own) + Number(now.bought) !== left) return { error: 'market-price-moved' };   // another sold between: its tax moved
  if ((await balanceOf(db, me)) < total + road.courier) return { error: 'marks-short' };
  if ((await balanceOf(db, l.seller)) + gets > MARKS_MAX) return { error: 'market-seller-full' };
  return { error: 'stores-full' };
}

// ─── CANCEL (10.2: "a cancelled listing returns its goods, the fee kept") ─

/** CANCEL: `{ character, listing, rid }` - this account's open listing closed; a material's units back to the listing
 *  character's Stores (refused while they would not fit), a piece answered back to the pack. */
export async function marketCancel(ctx, player, env, { character, listing: id, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => {
    const out = { ok: true, ...extra, listing: listingView(row, me), balance: await balanceOf(db, me) };
    if (row.kind === 'material') out.store = await storeOf(db, me, row.char_id, row.material);
    else out.piece = pieceOf(await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(row.provenance).first(), row.wear);
    return out;
  };
  const prior = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND cancel_rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-listing' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const l = await db.prepare('SELECT * FROM market_listings WHERE id = ?1 AND seller = ?2').bind(id, me).first();
  if (!l || l.state !== 'open') return { error: 'market-gone' };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`UPDATE market_listings SET state = 'cancelled', closed_at = ?3, returned = 1, cancel_rid = ?4, rn = ?5
      WHERE id = ?1 AND seller = ?2 AND state = 'open' AND (kind = 'piece'
        OR COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?2 AND char_id = market_listings.char_id AND material = market_listings.material), 0)
          + own + bought <= ?6)`).bind(id, me, nowS, rid, nonce, STORES_MAX),
    ...backToStores(db, id, nonce),
    db.prepare(`UPDATE products SET listed = 0 WHERE provenance = (SELECT provenance FROM market_listings WHERE id = ?1 AND rn = ?2)`).bind(id, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM market_listings WHERE seller = ?1 AND cancel_rid = ?2').bind(me, rid).first();
  if (made?.rn === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  const now = await db.prepare('SELECT state FROM market_listings WHERE id = ?1').bind(id).first();
  return { error: now?.state === 'open' ? 'stores-full' : 'market-gone' };
}

// ─── BUY ORDERS (10.3) ───────────────────────────────────────────────

/** ORDER: `{ character, region, material, units, price, hubs?, rid }` - a standing order at the board's region for 7
 *  days, its Marks (units x price) escrowed at once - a line to the ledger's `escrow` end, the order's id. */
export async function marketOrder(ctx, player, env, { character, region, material: key, units, price, hubs, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({ ok: true, ...extra, order: orderView(row, me), balance: await balanceOf(db, me) });
  const prior = await db.prepare('SELECT * FROM market_orders WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!material(key)) return { error: 'bad-material' };
  if (UNYIELDED.includes(key)) return { error: 'market-unyielded' };   // AUDIT 30 L7: nobody could fill it
  if (!unitsOk(units)) return { error: 'bad-units' };
  if (!priceOk(price) || units * price > MARKET_WORTH_MAX) return { error: 'bad-price' };
  if (await overRate(ctx, `market-post:${me}`, MARKET_POSTS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await settle(ctx, player);
  const cost = units * price;
  const nonce = mintId(rand);
  const id = mintId(rand);
  const own = hubsOf(hubs);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO market_orders (id, poster, char_id, region, material, units, left_units, price, escrow, at, expires_at, rid, n)
      SELECT ?3, ?1, ?2, ?4, ?5, ?6, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?8
        AND (SELECT COUNT(*) FROM market_orders WHERE poster = ?1 AND state = 'open') < ?13
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?11 || ':escrow')`)
      .bind(me, character, id, region, key, units, price, cost, nowS, nowS + MARKET_ORDER_S, rid, nonce, MARKET_ORDERS_MAX),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', poster, 'escrow', id, 'order-escrow', escrow, ?4, at, poster, material, rid || ':escrow'
      FROM market_orders WHERE poster = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, utcDay(nowS)),
    ...witnessStatements(db, player, nowS, [region], own, 'EXISTS (SELECT 1 FROM market_orders WHERE poster = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_orders WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':escrow')) return { error: 'prof-rid' };
  return { error: (await balanceOf(db, me)) < cost ? 'marks-short' : 'market-orders-max' };
}

/**
 * FILL: `{ character, region, order, units, hubs?, rid }` - `units` of an open order of this board's region from this
 * character's Stores (bought first); the pay out of the escrow less the tax, the units to the orderer's Stores at once
 * as bought (refused past their room).
 */
export async function marketFill(ctx, player, env, { character, region, order: id, units, hubs, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, fill: { order: row.order_id, material: row.material, units: Number(row.units), price: Number(row.price), pay: Number(row.pay), tax: Number(row.tax) },
    store: await storeOf(db, me, row.char_id, row.material), balance: await balanceOf(db, me),
  });
  const prior = await db.prepare('SELECT * FROM market_fills WHERE filler = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!idOk(id)) return { error: 'bad-order' };
  if (!unitsOk(units)) return { error: 'bad-units' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const o = await db.prepare('SELECT * FROM market_orders WHERE id = ?1').bind(id).first();
  if (!o || o.state !== 'open' || Number(o.expires_at) <= nowS) return { error: 'market-gone' };
  if (o.poster === me) return { error: 'market-own' };
  if (Number(o.region) !== region) return { error: 'market-elsewhere' };
  if (units > Number(o.left_units)) return { error: 'market-short' };
  const total = units * Number(o.price);
  // AUDIT 30 L6: the tax of the order's running total - what it has bought before this fill
  const tax = saleTaxOn((Number(o.units) - Number(o.left_units)) * Number(o.price), total);
  const pay = total - tax;
  const nonce = mintId(rand);
  const day = utcDay(nowS);
  const own = hubsOf(hubs);
  const filled = 'EXISTS (SELECT 1 FROM market_fills WHERE filler = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: the order open with the units and their escrow, the filler's units, the orderer's room, the filler's
    // room under the Marks cap
    db.prepare(`INSERT OR IGNORE INTO market_fills (filler, rid, char_id, order_id, poster, material, units, price, pay, tax, at, day, n)
      SELECT ?1, ?2, ?3, o.id, o.poster, o.material, ?4, o.price, ?5, ?6, ?7, ?8, ?9 FROM market_orders o
      WHERE o.id = ?10 AND o.state = 'open' AND o.expires_at > ?7 AND o.poster != ?1 AND o.region = ?11 AND o.left_units >= ?4
        AND o.escrow >= o.price * ?4 AND o.price * ?4 = ?5 + ?6
        AND o.left_units = ?14   -- the running total the tax was taken on (AUDIT 30 L6)
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2 || ':fill')   -- AUDIT 30 S3
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?3 AND material = o.material), 0) >= ?4
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = o.poster AND char_id = o.char_id AND material = o.material), 0) + ?4 <= ?12
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + ?5 <= ?13`)
      .bind(me, rid, character, units, pay, tax, nowS, day, nonce, id, region, STORES_MAX, MARKS_MAX, Number(o.left_units)),
    // the order drawn down, a filled one closed
    db.prepare(`UPDATE market_orders SET left_units = left_units - ?3, escrow = escrow - price * ?3,
        state = CASE WHEN left_units = ?3 THEN 'filled' ELSE state END, closed_at = CASE WHEN left_units = ?3 THEN ?4 ELSE closed_at END
      WHERE id = ?2 AND EXISTS (SELECT 1 FROM market_fills WHERE filler = ?1 AND rid = ?5 AND n = ?6)`).bind(me, id, units, nowS, rid, nonce),
    // the filler's units out, bought first; the orderer's in, bought
    ...spendStatements(db, { player: me, character, materialSql: '?3', qtySql: '?4', guard: filled, binds: [o.material, units, rid, nonce] }),
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT poster, ?4, material, 'bought', units FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(me, rid, nonce, o.char_id),
    // the Marks: the pay out of the escrow, the tax burnt from it
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', order_id, 'account', filler, 'order-fill', pay, day, at, filler, material, rid || ':fill'
      FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', order_id, 'burn', NULL, 'market-tax', tax, day, at, filler, material, rid || ':filltax'
      FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3 AND tax > 0`).bind(me, rid, nonce),
    db.prepare(`INSERT INTO market_prices (day, material, price, units)
      SELECT day, material, price, units FROM market_fills WHERE filler = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (day, material, price) DO UPDATE SET units = market_prices.units + excluded.units`).bind(me, rid, nonce),
    ...witnessStatements(db, player, nowS, [region], own, 'EXISTS (SELECT 1 FROM market_fills WHERE filler = ?6 AND rid = ?7 AND n = ?8)', [me, rid, nonce]),
  ]);
  const made = await db.prepare('SELECT * FROM market_fills WHERE filler = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await spent(db, me, rid, ':fill')) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT * FROM market_orders WHERE id = ?1').bind(id).first();
  if (!now || now.state !== 'open') return { error: 'market-gone' };
  if (Number(now.left_units) < units) return { error: 'market-short' };
  if (Number(now.left_units) !== Number(o.left_units)) return { error: 'market-price-moved' };   // another filled between
  const held = await storeOf(db, me, character, o.material);
  if (held.own + held.bought < units) return { error: 'stores-short' };
  if ((await balanceOf(db, me)) + pay > MARKS_MAX) return { error: 'marks-full' };
  return { error: 'market-order-full' };
}

/** UNORDER: `{ order, rid }` - this account's open order closed, what is left of its escrow back (under the cap; else
 *  on a later read). Asked again, a closed order of this account's answers as done. */
export async function marketUnorder(ctx, player, env, { order: id, rid } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { rid, needChar: false });
  if (refused) return refused;
  const me = player.id;
  if (!idOk(id)) return { error: 'bad-order' };
  const o = await db.prepare('SELECT * FROM market_orders WHERE id = ?1 AND poster = ?2').bind(id, me).first();
  if (!o) return { error: 'market-gone' };
  if (o.state === 'cancelled') return { ok: true, repeat: true, order: orderView(o, me), balance: await balanceOf(db, me) };
  const closed = shut(player, env);
  if (closed) return closed;
  if (o.state !== 'open') return { error: 'market-gone' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  await db.batch([
    db.prepare(`UPDATE market_orders SET state = 'cancelled', closed_at = ?3 WHERE id = ?1 AND poster = ?2 AND state = 'open'`).bind(id, me, nowS),
    ...orderReturn(db, id, nowS),
  ]);
  const now = await db.prepare('SELECT * FROM market_orders WHERE id = ?1').bind(id).first();
  if (now?.state !== 'cancelled') return { error: 'market-gone' };
  return { ok: true, order: orderView(now, me), balance: await balanceOf(db, me) };
}

// ─── COLLECT (a piece arrived, or come back) ─────────────────────────

/** COLLECT: `{ character, delivery, rid }` - a piece whose courier has arrived, or whose listing expired or was
 *  removed, answered to this character's pack once; asked again with the same id, answered again. */
export async function marketCollect(ctx, player, env, { character, delivery: id, rid } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (d, extra = {}) => ({
    ok: true, ...extra, delivery: { id: d.id, why: d.why },
    piece: pieceOf(await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(d.provenance).first(), d.wear),
  });
  const prior = await db.prepare('SELECT * FROM market_deliveries WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-delivery' };
  if (await overRate(ctx, `market:${me}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const d = await db.prepare('SELECT * FROM market_deliveries WHERE id = ?1 AND player = ?2').bind(id, me).first();
  if (!d || Number(d.collected) === 1) return { error: 'market-gone' };
  if (d.char_id !== character) return { error: 'market-other-character' };
  if (Number(d.arrives_at) > nowS) return { error: 'market-on-road' };
  // AUDIT 30 S5: only a piece still this account's - never one id handed out twice
  await db.prepare(`UPDATE market_deliveries SET collected = 1, rid = ?3 WHERE id = ?1 AND player = ?2 AND char_id = ?4 AND collected = 0 AND arrives_at <= ?5
      AND EXISTS (SELECT 1 FROM products WHERE provenance = market_deliveries.provenance AND owner = ?2)`)
    .bind(id, me, rid, character, nowS).run();
  const made = await db.prepare('SELECT * FROM market_deliveries WHERE player = ?1 AND rid = ?2').bind(me, rid).first();
  return made ? answer(made) : { error: 'market-gone' };
}

// ─── REPORTS AND REMOVAL (section 20) ────────────────────────────────

/** REPORT: `{ listing }` - once a registered reader; counted for the moderators, hiding nothing. */
export async function marketReport(ctx, player, env, { listing: id } = {}) {
  const { db, nowS } = ctx;
  const refused = asks(player, { needRid: false, needChar: false });
  if (refused) return refused;
  const closed = shut(player, env);
  if (closed) return closed;
  if (!idOk(id)) return { error: 'bad-listing' };
  if (await overRate(ctx, `market:${player.id}`, MARKET_OPS_MAX, MARKET_WINDOW_S)) return { error: 'market-rate' };
  const l = await db.prepare('SELECT seller, state FROM market_listings WHERE id = ?1').bind(id).first();
  if (!l || l.state !== 'open') return { error: 'market-gone' };
  if (l.seller === player.id) return { error: 'market-own' };
  await db.prepare('INSERT OR IGNORE INTO market_reports (listing, reporter, at) VALUES (?1, ?2, ?3)').bind(id, player.id, nowS).run();
  return { ok: true };
}

/** REMOVE: `{ listing }` - a moderator's: the listing off every board, its goods returned on its seller's next read. */
export async function marketRemove(ctx, player, env, { listing: id } = {}) {
  const { db, nowS } = ctx;
  if (!canModerate(player, env)) return { error: 'not-moderator' };
  if (!idOk(id)) return { error: 'bad-listing' };
  const r = await db.prepare(`UPDATE market_listings SET state = 'removed', closed_at = ?2 WHERE id = ?1 AND state = 'open'`).bind(id, nowS).run();
  return r.meta?.changes ? { ok: true } : { error: 'market-gone' };
}
