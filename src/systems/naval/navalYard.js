// @ts-check
// AUDIT NAV1 (2026-09-29, the helm - Mac: "Lets do a deep comprehensive audit and ensure this is perfection") - THE
// SHIPWRIGHT'S YARD, and HER OWN HANDS' MENDING AT SEA: what a hurt boat buys back at a port, and what her crew makes
// good between fights. The helm audit's first finding: the page promised a shipwright and none stood - `repairCost`
// was written into the readout and read by nothing, the one mend was a prize's timber, and a wreck stayed a wreck (with
// "Pirates board you" off, for ever). Pure - the host hands the boat's damage, its barrels and the purse, and gets rows
// and counts back.
//
// THE YARD sells four things by the piece - hull and canvas (navalDamage.js REPAIR_PRICE), hands (the same table's
// crew) and fire barrels (BARREL_PRICE) - as much of each as the purse will pay for and never past her whole; MAKE HER
// WHOLE buys the four in YARD_ORDER (the hull first: it is what keeps her afloat) as far as the purse goes.
//
// THE MENDING: at sea, with no hostile ship near and nothing struck her for FIELD_QUIET_S (a fire aboard strikes her every
// moment it burns - navalDamage.js step), her hands make good her hull
// and canvas FIELD_MEND_PER_S of their whole a second - times her crew's share, or FIELD_MEND_ALONE with no crew aboard
// (the player alone at a Large Boat) - up to FIELD_MEND_CAP of each and never past it: a port makes her whole, the sea
// only seaworthy. A wreck floats again once her hull passes FIELD_REFLOAT. Hands are never mended - they are hired.
import { REPAIR_PRICE } from './navalDamage.js';
import { BARREL } from './navalShips.js';

/** A fire barrel at the yard (gold). */
export const BARREL_PRICE = 40;
/** The mending at sea: quiet this long first (s), then this share of the whole a second at a full crew, this share of
 *  that with none aboard, up to this share of the whole; a wreck afloat again past this share of her hull. */
export const FIELD_QUIET_S = 30;
export const FIELD_MEND_PER_S = 0.002;
export const FIELD_MEND_ALONE = 0.5;
export const FIELD_MEND_CAP = 0.5;
export const FIELD_REFLOAT = 0.15;

/** The order MAKE HER WHOLE buys in. */
export const YARD_ORDER = Object.freeze(['hull', 'sail', 'crew', 'barrels']);
/** Each row's price a piece. */
export const YARD_PRICE = Object.freeze({ hull: REPAIR_PRICE.hull, sail: REPAIR_PRICE.sail, crew: REPAIR_PRICE.crew, barrels: BARREL_PRICE });

/**
 * What the yard offers a boat: each row's pieces missing, its price, what the whole of it costs, and how much of it the
 * purse pays for (and that for how much) - with the whole bill and the purse.
 * @param {{ hull: number, maxHull: number, sail: number, maxSail: number, crew: number, maxCrew: number }} damage
 * @param {number} barrels - the barrels aboard
 * @param {number} gold - the purse
 */
export function yardOffer(damage, barrels, gold) {
  const purse = Math.max(0, Math.floor(Number(gold) || 0));
  const missing = {
    hull: Math.max(0, Math.ceil(damage.maxHull - damage.hull - 1e-9)),
    sail: Math.max(0, Math.ceil(damage.maxSail - damage.sail - 1e-9)),
    crew: Math.max(0, Math.round(damage.maxCrew - damage.crew)),
    barrels: Math.max(0, BARREL.stock - Math.max(0, barrels | 0)),
  };
  const rows = YARD_ORDER.map((id) => {
    const n = missing[id], price = YARD_PRICE[id];
    const afford = Math.min(n, Math.floor(purse / price));
    return { id, missing: n, price, whole: n * price, afford, cost: afford * price };
  });
  return { rows, whole: rows.reduce((sum, r) => sum + r.whole, 0), gold: purse };
}

/** MAKE HER WHOLE: each row in YARD_ORDER as far as the purse goes - `[{ id, n, cost }]`, the rows it can pay for. */
export function yardAll(damage, barrels, gold) {
  let purse = Math.max(0, Math.floor(Number(gold) || 0));
  const out = [];
  for (const r of yardOffer(damage, barrels, purse).rows) {
    const n = Math.min(r.missing, Math.floor(purse / r.price));
    if (n <= 0) continue;
    out.push({ id: r.id, n, cost: n * r.price });
    purse -= n * r.price;
  }
  return out;
}

/**
 * `dt` seconds of her hands' mending: the hull and canvas they make good (points), each up to FIELD_MEND_CAP of its
 * whole - nothing past it, nothing for a part already there.
 * @param {{ hull: number, maxHull: number, sail: number, maxSail: number }} damage
 * @param {number} dt
 * @param {{ crewed: boolean, crewShare: number, scale?: number }} crew
 */
export function fieldMend(damage, dt, { crewed, crewShare, scale = 1 }) {
  // SHIP-CREW: `scale` her crew's spirits (shipCrew.js mendScaleOf)
  const rate = FIELD_MEND_PER_S * (crewed ? Math.max(0, Math.min(1, crewShare)) : FIELD_MEND_ALONE) * Math.max(0, scale) * Math.max(0, dt);
  const part = (have, whole) => Math.max(0, Math.min(whole * FIELD_MEND_CAP - have, whole * rate));
  return { hull: part(damage.hull, damage.maxHull), sail: damage.maxSail > 0 ? part(damage.sail, damage.maxSail) : 0 };
}

// ── SEA-REPAIR (2026-09-30, Mac: "a way to repair ships on the high seas" - "Carpenter's stores") ──────────────────────
// The yard sells CARPENTER'S STORES (timber, pitch and canvas - an item of the hold, navalStores.js) and a ROUND OF
// GROG for her crew (shipCrew.js's spirits). At sea, her captain's order MAKE REPAIRS (shipCrew.js ORDERS.repair) sets
// her hands to work while nothing threatens her (the mending's own quiet): SEA_REPAIR_PER_S of the whole a second -
// times her crew's share (SEA_REPAIR_ALONE with none aboard) and her spirits' mending - on her hull first, then her
// canvas, ALL THE WAY TO WHOLE, a store spent for every STORE_POINTS of work it makes good (AUDIT CC-D1). A wreck floats again past
// FIELD_REFLOAT as the free mending's. The free mending to FIELD_MEND_CAP stands beside it, as it was.

/** AUDIT CC-D1 (Mac: "Priced per hull, no port use"): A STORE OF TIMBER, PITCH AND CANVAS MAKES GOOD STORE_POINTS OF
 *  WORK - a hull point a point, canvas at its yard price's share of the hull's (SAIL_WORK) - and costs STORE_YARD_SHARE
 *  of what the yard asks for that work. A flat 25 gold for a TENTH of any ship had ten of them make a wrecked Small
 *  Ship whole for 250 gold against the yard's 6000, in the harbour beside it. So a bigger ship needs more stores, and
 *  stores are what they cost: a yard's work carried to sea, at a carpenter's discount. */
export const STORE_POINTS = 40;
export const STORE_YARD_SHARE = 0.7;
export const SAIL_WORK = REPAIR_PRICE.sail / REPAIR_PRICE.hull;
/** A store's price (gold). */
export const storePrice = () => Math.round(STORE_POINTS * REPAIR_PRICE.hull * STORE_YARD_SHARE);
export const STORE_PRICE = storePrice();
/** The work (points) between her hurts and whole, and the stores it takes. */
export const workToWhole = (d) => Math.max(0, d.maxHull - d.hull) + (d.maxSail > 0 ? Math.max(0, d.maxSail - d.sail) * SAIL_WORK : 0);
export const storesToWhole = (d) => Math.ceil(workToWhole(d) / STORE_POINTS - 1e-9);
/** The least the yard fills a hold to (a hull whose wreck takes fewer). */
export const STORES_STOCK = 10;
/** A round of grog: this a hand of her crew (at least GROG_MIN), and the spirits it lifts are shipCrew.js's. */
export const GROG_PER_HAND = 1;
export const GROG_MIN = 10;
/** The repairs at sea: this share of the whole a second at a full crew, this share of that with none aboard (AUDIT
 *  CC-D2: and with every hand of a crewed boat lost - her captain at the work alone; a crewed boat at no crew held a
 *  repair order that never did anything). */
export const SEA_REPAIR_PER_S = 0.008;
export const SEA_REPAIR_ALONE = 0.5;

/** A round of grog's price for a crew of `crew`. */
export const grogPrice = (crew) => Math.max(GROG_MIN, Math.round(Math.max(0, crew) * GROG_PER_HAND));

/**
 * The yard's provisions for a boat: her stores (as many as fill her hold to `stock` - the stores her wreck takes to be
 * whole, at least STORES_STOCK) and a round of grog (while her crew's spirits are short of the top, AUDIT CC-D5: and
 * once a port day - `grogToday` the day's round drunk) - each row as yardOffer's.
 * @param {{ stores: number, stock?: number, morale: number|null, crew: number, crewed: boolean, gold: number, grogToday?: boolean }} o
 */
export function provisionOffer({ stores, stock = STORES_STOCK, morale, crew, crewed, gold, grogToday = false }) {
  const purse = Math.max(0, Math.floor(Number(gold) || 0));
  const rows = [];
  const n = Math.max(0, Math.max(0, stock | 0) - Math.max(0, stores | 0));
  rows.push({ id: 'stores', missing: n, price: STORE_PRICE, whole: n * STORE_PRICE, afford: Math.min(n, Math.floor(purse / STORE_PRICE)), have: Math.max(0, stores | 0) });
  if (crewed && morale != null) {
    const price = grogPrice(crew), want = morale < 100 && !grogToday ? 1 : 0;
    rows.push({ id: 'grog', missing: want, price, whole: want * price, afford: Math.min(want, Math.floor(purse / price)), have: morale });
  }
  for (const r of rows) r.cost = r.afford * r.price;
  return { rows, gold: purse };
}

/**
 * `dt` seconds of repairs at sea: the hull and canvas made good (points), her hull first, up to whole - and the WORK it
 * was (`work`, points: a hull point a point, canvas at SAIL_WORK - what the stores pay for, a store STORE_POINTS of it).
 * `budget` the work her stores can still pay for (points): none, none made good.
 * @param {{ hull: number, maxHull: number, sail: number, maxSail: number }} damage
 * @param {number} dt
 * @param {{ crewed: boolean, crewShare: number, scale?: number, budget?: number }} o
 */
export function seaRepair(damage, dt, { crewed, crewShare, scale = 1, budget = Infinity }) {
  const share = crewed && crewShare > 0 ? Math.min(1, crewShare) : SEA_REPAIR_ALONE;   // AUDIT CC-D2
  let left = SEA_REPAIR_PER_S * share * Math.max(0, scale) * Math.max(0, dt);
  const out = { hull: 0, sail: 0, work: 0 };
  const hullGap = damage.maxHull > 0 ? Math.max(0, 1 - damage.hull / damage.maxHull) : 0;
  const h = Math.min(hullGap, left);
  out.hull = h * damage.maxHull; left -= h;
  if (left > 0 && damage.maxSail > 0) out.sail = Math.min(Math.max(0, 1 - damage.sail / damage.maxSail), left) * damage.maxSail;
  out.work = out.hull + out.sail * SAIL_WORK;
  const cap = Math.max(0, budget);
  if (out.work > cap) {
    // the stores run short: the hull first, as ever, then what is left of the budget on her canvas
    out.hull = Math.min(out.hull, cap);
    out.sail = Math.min(out.sail, Math.max(0, cap - out.hull) / SAIL_WORK);
    out.work = out.hull + out.sail * SAIL_WORK;
  }
  return out;
}
/** Whether she wants anything the repairs make good. */
export const wantsRepair = (damage) => damage.hull < damage.maxHull - 1e-6 || (damage.maxSail > 0 && damage.sail < damage.maxSail - 1e-6);
