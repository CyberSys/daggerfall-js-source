// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF5 (2026-09-29, Mac: "Continue") - THE MARKET: what a listing, a
// sale, a courier and a buy order are, and every bound both ends read.
// The record is bible/06-Systems/Professions-Arc.md 10.2-10.5 and 26.
//
// A LISTING is a Stores material (escrowed by the service - the units
// leave the Stores at once) or a crafted piece with a provenance id (the
// piece leaves the save), at a price in Marks, for 72 hours, standing on
// every board of the region it was listed in. A buyer in that region
// takes it at once; a buyer anywhere else pays the COURIER and waits for
// it - so a signature material is cheap at home and dear abroad, and
// hauling is a trade (10.2).
//
// THE ROAD. The courier is charged by the map pixels between the two
// regions' hub towns (HUB1). The service holds no ARENA2, so it learns a
// hub's pixel the way it learns a pixel's climate: from the clients that
// derived it (SEAT0 3.2's witnessed world, `world_witness` kind `hub`).
//
// Pure: no clock, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { STORES_MAX, MATERIAL_FAMILIES, MINED_KEYS, FOOD_KEYS, PLANT_GROUP_TEMPLATES } from './professionLaw.js';
import { PROVENANCE_RE, recipeById, takesQuality, MASTERWORK } from './recipeLaw.js';
import { MARKS_MAX } from './marksLaw.js';
import { witnessedFact, factConfirmed, material } from './nodeLaw.js';

/** A listing stands this long (10.2: 72 hours). */
export const MARKET_LISTING_S = 72 * 3600;
/** A buy order stands this long (10.3: 7 days). */
export const MARKET_ORDER_S = 7 * 86_400;
/** Live listings an account (materials and pieces together) and live buy orders an account (10.2, 10.3). */
export const MARKET_LISTINGS_MAX = 30;
export const MARKET_ORDERS_MAX = 20;
/** AUDIT 30 L8: a listing's or an order's whole worth (units x price), at most - what one balance can hold. */
export const MARKET_WORTH_MAX = MARKS_MAX;
/** A listing's or an order's units, at most: what one Stores can hold of a material (section 7). */
export const MARKET_UNITS_MAX = STORES_MAX;
/** A price - a material's a unit, a piece's whole (10.2: 1 to 1,000,000 Marks). */
export const MARKET_PRICE_MAX = 1_000_000;
/** Postings (a listing or an order) an account may make an hour (section 20: listings 60), and every other market
 *  act (a buy, a fill, a cancel, a collect) - the Marks' own hourly rate. */
export const MARKET_POSTS_MAX = 60;
export const MARKET_OPS_MAX = 120;
export const MARKET_WINDOW_S = 3600;
/** The sales tax, in hundredths of a sale, burnt from the seller's proceeds (10.4: 5%). */
export const MARKET_TAX_PCT = 5;
/** The Tithe, in hundredths (10.4: the holder's rate, 0-10% or 0-15%). FOUND: no seat is held yet (SEAT1 builds
 *  holders), so it is nought until SEAT1 sets it - the law keeps the term so the shape does not change. */
export const MARKET_TITHE_PCT = 0;
/** The courier (10.4): a load of this many units a trip, a road this many pixels a Mark, at least this many Marks. */
export const COURIER = Object.freeze({ load: 20, pixelsAMark: 25, least: 2, baseS: 900, pixelsAMinute: 10 });
/** Rows a view of the market shows, the History's materials, "Your trades", and the weekly report's medians. */
export const MARKET_SHOWN = 100;
export const MARKET_HISTORY_SHOWN = 30;
export const MARKET_TRADES_SHOWN = 20;
export const MARKET_REPORT_MEDIANS = 20;
/** The History's span (10.2: a 7-day median) and how long sales and prices are kept (section 20: 90 days). */
export const MARKET_MEDIAN_DAYS = 7;
export const MARKET_KEEP_DAYS = 90;
/** A piece's wear: its condition as a share of its most, in thousandths (PROF0 26). */
export const WEAR_WHOLE = 1000;
/** The Market tab's views, in its row's order (10.1; PROF5b: Auctions beside Crafted). */
export const MARKET_VIEWS = Object.freeze([
  Object.freeze(['materials', 'Materials']), Object.freeze(['crafted', 'Crafted']), Object.freeze(['auctions', 'Auctions']),
  Object.freeze(['mine', 'My listings']), Object.freeze(['orders', 'Orders']), Object.freeze(['history', 'History']),
]);
/** The crafted families that list - arrows carry no provenance and the siege works are never made (PROF0 25). */
export const CRAFTED_FAMILIES = Object.freeze([
  Object.freeze(['weapons', 'Weapons']), Object.freeze(['armour', 'Armour']), Object.freeze(['staves', 'Staves']),
  Object.freeze(['bows', 'Bows']), Object.freeze(['tools', 'Tools']), Object.freeze(['kits', 'Repair Kits']),
  Object.freeze(['furniture', 'Furniture']),
  // PROF7: the loom's - the leather armour, the clothing (its dye carried with the piece), the rugs, tapestries and skins
  Object.freeze(['leather', 'Leather Armour']), Object.freeze(['clothing', 'Clothing']), Object.freeze(['furnishings', 'Furnishings']),
]);
/** The material families the Materials view filters by - the Stores' own (section 8). */
export const MARKET_FAMILIES = MATERIAL_FAMILIES;
/** A request id, as every account act's: 8-40 of [A-Za-z0-9_-]. A listing's or an order's id is the service's own
 *  (SOC1's id shape, minted by `mintId`). */
export const MARKET_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
export const MARKET_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

/** A whole number of units, 1 up to `max`. */
export const unitsOk = (n, max = MARKET_UNITS_MAX) => Number.isSafeInteger(n) && n >= 1 && n <= max;
/** A price in Marks, 1 to 1,000,000. */
export const priceOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= MARKET_PRICE_MAX;
/** A piece's wear, 1 to 1,000 thousandths. */
export const wearOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= WEAR_WHOLE;
/** A piece's id, as its product record names it. */
export const provenanceOk = (p) => typeof p === 'string' && PROVENANCE_RE.test(p);

/** The listing fee (10.4): 1% of the listing's whole worth, rounded up, at least 1 Mark - burnt, kept on a cancel. */
export const listingFee = (worth) => Math.max(1, Math.ceil(worth / 100));
/** The sales tax on a sale (10.4: 5%), rounded DOWN - a one-Mark sale is not taxed to nothing (PROF0 26). */
export const saleTax = (total) => Math.floor((total * MARKET_TAX_PCT) / 100);
/** AUDIT 30 L6: the tax on a sale of `total` out of a listing (or a fill of an order) that has already sold `before`:
 *  5% of the running total, rounded down, less what the earlier sales paid - so a listing bought a unit at a time pays
 *  the tax it would have paid bought whole, and splitting a sale saves nothing. */
export const saleTaxOn = (before, total) => saleTax(before + total) - saleTax(before);
/** The Tithe on a sale at `pct` hundredths, rounded down (nought until SEAT1). */
export const saleTithe = (total, pct = MARKET_TITHE_PCT) => Math.floor((total * pct) / 100);
/** What the seller receives of a sale: the price less the tax and the Tithe (10.4). */
export const sellerGets = (total, tithePct = MARKET_TITHE_PCT) => total - saleTax(total) - saleTithe(total, tithePct);

/** A map pixel as `world_witness` keeps a hub's: "x,y" - MAPS.BSA's 1000 x 500 (mapsFile.js). */
export const hubReport = (x, y) => `${x},${y}`;
export const hubPixelOk = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && x < 1000 && y >= 0 && y < 500;
export function parseHubReport(s) {
  const m = typeof s === 'string' ? /^(\d{1,3}),(\d{1,3})$/.exec(s) : null;
  if (!m) return null;
  const x = Number(m[1]), y = Number(m[2]);
  return hubPixelOk(x, y) ? { x, y } : null;
}
/**
 * A region's hub pixel as the witnesses say it is (PROF0 26): the confirmed answer, else the answer most give, else
 * the asking client's own - the unconfirmed answer is taken as given, because a short road buys nothing a lie about
 * the region does not (a buyer may say it stands in the listing's own region). Null with neither.
 * @param {Array<{ account: string, report: string, at: number }>} rows @param {{ x: number, y: number }|null} own
 */
export function hubPixel(rows, own = null) {
  const f = witnessedFact(rows, parseHubReport);
  if (f.state !== 'none' && Number.isSafeInteger(f.x)) return { x: /** @type {number} */ (f.x), y: /** @type {number} */ (f.y), confirmed: factConfirmed(f) };
  return own && hubPixelOk(own.x, own.y) ? { x: own.x, y: own.y, confirmed: false } : null;
}
/** The road between two hubs, in whole map pixels (the straight line, rounded). */
export const roadPixels = (a, b) => Math.round(Math.hypot(a.x - b.x, a.y - b.y));
/** The courier's fee (10.4): ceil(ceil(units / 20) x (1 + pixels / 25)) Marks, at least 2 - by the load, so moving
 *  thousands of units across the Bay costs thousands, and regional prices hold. Integers throughout. */
export function courierFee(units, pixels) {
  const loads = Math.ceil(units / COURIER.load);
  return Math.max(COURIER.least, Math.ceil((loads * (COURIER.pixelsAMark + pixels)) / COURIER.pixelsAMark));
}
/** The courier's time (10.4): 15 minutes + 1 minute for every 10 pixels begun. */
export const courierSeconds = (pixels) => COURIER.baseS + 60 * Math.ceil(pixels / COURIER.pixelsAMinute);

/** A piece's wear from the pack's item: its condition over its most, in thousandths - at least 1, a whole piece
 *  1,000 (a piece with no condition to wear is whole). AUDIT 31 H9: whole only when it is - a piece worn by a point of
 *  a condition past 2,000 rounded up to whole and was sold, and handed to a commission, as new work. */
export function wearOf(item) {
  const max = Number(item?.maxCondition) || 0;
  if (max <= 0) return WEAR_WHOLE;
  const cur = Math.max(0, Number(item?.currentCondition) || 0);
  if (cur >= max) return WEAR_WHOLE;
  return Math.max(1, Math.min(WEAR_WHOLE - 1, Math.round((cur * WEAR_WHOLE) / max)));
}
/** A piece minted from its record takes its wear: the condition that share of its most, at least 1. */
export function wearCondition(maxCondition, wear) {
  if (!(maxCondition > 0)) return maxCondition;
  return Math.max(1, Math.min(maxCondition, Math.round((maxCondition * wear) / WEAR_WHOLE)));
}
/** A wear as a person reads it: "worn to 62%". Null for a whole piece. */
export const wearText = (wear) => (wear >= WEAR_WHOLE ? null : `worn to ${Math.max(1, Math.min(99, Math.round(wear / 10)))}%`);   // AUDIT 30 L5: a worn piece never reads 100%

/**
 * THE MEDIAN (10.2): the unit price the middle unit sold at - `rows` the day table's `{ price, units }` - weighted by
 * units; an even count's the mean of its two middle units' prices. Null with no sale.
 * @param {Array<{ price: number, units: number }>} rows
 */
export function medianOf(rows) {
  const sorted = (rows ?? []).filter((r) => r && r.units > 0 && r.price > 0).sort((a, b) => a.price - b.price);
  const n = sorted.reduce((s, r) => s + r.units, 0);
  if (!n) return null;
  const at = (k) => { let seen = 0; for (const r of sorted) { seen += r.units; if (seen >= k) return r.price; } return sorted[sorted.length - 1].price; };
  return n % 2 ? at((n + 1) / 2) : (at(n / 2) + at(n / 2 + 1)) / 2;
}
/**
 * A material's line (10.2): its daily medians over the `days` UTC days ending `today`, oldest first - null for a day
 * with no sale. `rows` the price table's `{ day, price, units }`.
 * @param {Array<{ day: number, price: number, units: number }>} rows @param {number} today
 */
export function medianLine(rows, today, days = MARKET_MEDIAN_DAYS) {
  const out = [];
  for (let d = today - days + 1; d <= today; d++) out.push(medianOf((rows ?? []).filter((r) => r.day === d)));
  return out;
}
/** A median as a person reads it: "8", "8.5", or a dash with no sale. */
export const medianText = (m) => (m == null ? '-' : Number.isInteger(m) ? String(m) : m.toFixed(1));

/** AUDIT 30 L7: the materials nothing yields yet - an order for one could only hold its Marks for a week. The Daedric
 *  Ingot waits on its heart and its stone (4.1, the Oblivion Gate's gift), the Warforged on a siege's Spoils (SEAT2), and
 *  Standard-bearer's Silk on the same Spoils (4.7). PROF7: Hunting yields the Bear Hide now. */
export const UNYIELDED = Object.freeze(['ingot:daedric', 'ingot:warforged', 'cloth:standard']);
/** AUDIT 30 L2: a crafted piece lists only of a family the market lists (CRAFTED_FAMILIES) - never arrows (a quiver's
 *  stack, re-minted whole) nor a siege work. */
export const pieceListable = (recipeId) => CRAFTED_FAMILIES.some(([f]) => f === recipeById(recipeId)?.family);

/** EVERY MATERIAL THE MARKET KNOWS (a buy order's choices): the registry's, the four foods and every herb the law
 *  gives a tier - each `material()`'s standing, in the families' order - less what nothing yields yet. */
export function marketCatalogue() {
  const herbs = Object.entries(PLANT_GROUP_TEMPLATES).flatMap(([g, ts]) => ts.map((t) => `${g}:${t}`));
  const all = [...MINED_KEYS, ...FOOD_KEYS, ...herbs].filter((k) => !UNYIELDED.includes(k)).map((k) => material(k)).filter(Boolean);
  const order = MATERIAL_FAMILIES.map(([f]) => f);
  return all.sort((a, b) => (order.indexOf(a.family) - order.indexOf(b.family)) || (a.tier - b.tier));
}

/** The switch: the market is open where the board, the professions and the Marks all are (PROF0 26 - section 20
 *  names three switches, and the market needs each). */
export const marketOpen = (board, prof, marks) => board === true && prof === true && marks === true;

// ─── PROF5b: TIMED AUCTIONS FOR MASTERWORKS (10.2, bible/06-Systems/Professions-Arc.md 27) ─────

/** An auction stands this long (10.2: 24 hours). */
export const AUCTION_S = 24 * 3600;
/** The least raise over the standing bid, in hundredths (10.2: 5%) - rounded up, at least a Mark. */
export const AUCTION_RAISE_PCT = 5;
/** 10.2: "a bid in the last 2 minutes adds 2" - a bid this near the end moves it this far on. */
export const AUCTION_LATE_S = 120;
export const AUCTION_ADD_S = 120;
/** A bid, at most: what one balance can hold. */
export const AUCTION_BID_MAX = MARKS_MAX;
/** A bid's amount in whole Marks, 1 up to AUCTION_BID_MAX. */
export const bidOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= AUCTION_BID_MAX;
/** The least next bid: the opening while none stands, else the standing bid and its 5%, rounded up, at least 1. */
export const auctionNext = (high, opening) => (high == null ? opening : high + Math.max(1, Math.ceil((high * AUCTION_RAISE_PCT) / 100)));
/** An auction's end after a bid at `atS`: moved AUCTION_ADD_S on when the bid came in its last AUCTION_LATE_S. */
export const auctionEnd = (endsAt, atS) => (endsAt - atS < AUCTION_LATE_S ? endsAt + AUCTION_ADD_S : endsAt);
/** AUDIT 31 S3: how long past its end a won auction waits for its seller's Marks cap to take the sale. Past it, the
 *  winning bid is void (its escrow back on its bidder's read) and the piece back to its seller, unsold - the winner's
 *  Marks are never held without end for a seller who does not spend. */
export const AUCTION_GRACE_S = 7 * 86_400;
/** What may be auctioned (10.2: "Masterworks only"): a Masterwork of a family the market lists - a piece that takes a
 *  quality (AUDIT 31 L9: a Repair Kit takes none, so no kit is a Masterwork). */
export const auctionable = (recipeId, quality) => quality === MASTERWORK && pieceListable(recipeId) && takesQuality(/** @type {any} */ (recipeById(recipeId)));
