// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BAG1 (2026-10-03) — THE MATERIALS BAG AND WHAT A CHARACTER CARRIES:
// the shapes and bounds BOTH ends read (bible/06-Systems/Materials-
// Bag.md). The account service counts (server-account/src/
// professions.js); the client holds the items (systems/materialsBag.js).
// Pure: no clock, no DOM, no network.
//
// Asked (2026-10-03, from LostMyLeg's suggestion on the Discord):
// "implement a crafting mats bag that gets handled like the cart in an
// extra slot. It shouldnt carry unlimited weight but quite a lot";
// "make the bag available in every general store for like 500g";
// "Aslong theres no bag the mats just go into the players inventory" -
// and the request itself: "I definitely like this idea instead of the
// current go straight into your storage. Like having a new player
// actually buy the crafting bag, and still allowing crafting materials
// in the inventory itself."
//
// ═══ WHERE A GATHERED UNIT IS ══════════════════════════════════════
//
// A harvest lands in the MATERIALS BAG when the character owns one and
// it has room, else in the PACK - as the very item a withdrawal from
// the Stores always minted (systems/profItems.js). The Stores stay: a
// character's storage, reached in a town (bible: the Stores page), and
// the market's, the writs' and the guild Stores' one door, as before.
//
// ═══ THE SERVICE COUNTS WHAT IT HANDED OVER (law 3, restated) ══════
//
// A pack is the save's, and a save is the client's word. So the
// service keeps, beside the Stores, a CARRIED count for each character
// and material (`prof_carried`, own / bought / gold like the Stores):
// every unit it handed to the bag or the pack and has not had back. A
// carried item reaches the Stores - and so a station, a writ, the
// market, the guild - only through a DEPOSIT, and a deposit moves at
// most what the count holds. The client says what it holds (`held`, the
// items of that material in its bag and pack); the count is first cut
// down to it (never raised), so an honest pack that sold, dropped or
// brewed some heals the count, and an edited save that holds more than
// the count adds nothing. Nothing reaches the economy past what the
// service itself handed out: law 3's guarantee, kept with the door open
// one way more.
// ═══════════════════════════════════════════════════════════════════

/** The bag's template, in the professions' reserved range (Professions-Arc 4.8: 600 was unused). */
export const BAG_TEMPLATE = 600;
/** What it holds, in kg - "quite a lot", never unlimited: two fifths of a wagon's 750 (DFU ItemHelper.WagonKgLimit). A
 *  day's Logging (60 trees of 2-4 logs at 2 kg) is about 360 kg; the bag holds most of a day in one craft. */
export const BAG_KG_LIMIT = 300;
/** Its row's base price. DFU's shop price is 2 x (cost x (quality - 10) / 100 + cost) (shopStock.js calculateCost):
 *  500 gold at a middling shop, 450 to 550 by its quality, before the region and the haggle - "like 500g". */
export const BAG_BASE_PRICE = 250;
/** Its row, in the port's template columns (systems/profTemplates.js registers it): DFU's own Backpack picture
 *  (ItemTemplates 89: TEXTURE.205 record 44 - law 6, the picture is DFU's own), weightless as the Small Cart is
 *  (`hasNoEncumbrance`, template 93), one to a slot. Rarity 10: no shelf rolls it - a General Store shelves it by name
 *  (shopStock.js), online only. */
export const BAG_ROW = Object.freeze({
  index: BAG_TEMPLATE, name: 'Materials Bag', baseWeight: 1, hitPoints: 0, capacityOrTarget: 0, basePrice: BAG_BASE_PRICE,
  enchantmentPoints: 0, rarity: 10, variants: 0, drawOrderOrEffect: 0, isBluntWeapon: false, isLiquid: false,
  isOneHanded: false, isIngredient: false, worldTextureArchive: 205, worldTextureRecord: 44,
  playerTextureArchive: 0, playerTextureRecord: 0, stackable: false, hasNoEncumbrance: true,
});

/** Whether a record IS a Materials Bag - its template and its group, the one spelling every rule reads (the save's
 *  hands, the window, the shop, the trade, the realm's trade law: ONE DFU MEMBER, ONE EXPORT's rule, for the port's own). */
export const isBagItem = (item) => item?.templateIndex === BAG_TEMPLATE && item?.group === 'UselessItems2';
/** Whether a list (the pack) holds one - DFU's HasCart, for the bag: owning one is holding one. */
export const hasBag = (items) => Array.isArray(items) && items.some(isBagItem);

/** The bag as a capacity the transfer ladder reads (systems/inventorySession.js storeCapacityOf's shape - the
 *  companion's pack's): its kg and its words ("Your Materials Bag cannot carry any more."). */
export const BAG_CAPACITY = Object.freeze({ kg: BAG_KG_LIMIT, name: 'Your Materials Bag' });

/** The most of one material the service counts as carried, every origin together - the Stores' own bound
 *  (professionLaw.js STORES_MAX), so a unit is never refused between the two. */
export const CARRIED_MAX = 5000;
/** One deposit, at most - a withdrawal's own bound (professionLaw.js WITHDRAW_MAX). */
export const DEPOSIT_MAX = 200;
/** The origins a carried count keeps - the Stores' three (0041_gold_market.sql). */
export const CARRIED_ORIGINS = Object.freeze(['own', 'bought', 'gold']);
/** THE ORDER A COUNT IS CUT DOWN TO WHAT THE PACK HOLDS: gold's first, bought, then own - the order a withdrawal fills
 *  the pack in (professions.js withdrawStores), so the goods walled from every Marks act go first and a character's
 *  own, which raise a seat's influence (law 3), go last. A unit the pack no longer holds is gone; which one is unknown,
 *  and the count gives up the least precious. */
export const CLAMP_ORDER = Object.freeze(['gold', 'bought', 'own']);
/** THE ORDERS A DEPOSIT MOVES BY. `all` (the Stores page's Put in) every origin, as the count is cut; `spend` (a station's
 *  or a writ's shortfall, put in just before it spends) bought first then own - the order a craft spends the Stores in
 *  (professions.js spendStatements) - and never gold's, which no station may spend (GOLD-MARKET's wall). */
export const DEPOSIT_ORDERS = Object.freeze({ all: CLAMP_ORDER, spend: Object.freeze(['bought', 'own']) });
export const depositOrderOk = (o) => typeof o === 'string' && Object.hasOwn(DEPOSIT_ORDERS, o);

/** A held count the client says: a whole number from 0 to CARRIED_MAX x 10 (a pack may hold looted pieces of the same
 *  template beside the carried ones - DFU's own Red Rose and a gathered one are one item) - or null. */
export const heldOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= CARRIED_MAX * 10;
/** AUDIT BAG1 B2: the count a client last heard, every origin together (a `seen`) - a whole number from 0 to three origins'
 *  bound - or anything else, which the service reads as unsaid. */
export const seenOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= CARRIED_MAX * CARRIED_ORIGINS.length;

/** What a count `c` (`{ own, bought, gold }`) is once cut to `held`, by CLAMP_ORDER - a copy; never raised. */
export function clampCarried(c, held) {
  const out = { own: Math.max(0, c?.own | 0), bought: Math.max(0, c?.bought | 0), gold: Math.max(0, c?.gold | 0) };
  let over = out.own + out.bought + out.gold - Math.max(0, held | 0);
  for (const o of CLAMP_ORDER) {
    if (over <= 0) break;
    const cut = Math.min(over, out[o]);
    out[o] -= cut;
    over -= cut;
  }
  return out;
}
/** A count's total, every origin. */
export const carriedTotal = (c) => (c?.own | 0) + (c?.bought | 0) + (c?.gold | 0);
/** What of a count a station, a craft or a writ may spend - never gold's (GOLD-MARKET). */
export const carriedSpendable = (c) => (c?.own | 0) + (c?.bought | 0);

/** THE UNITS OF A MATERIAL A CHARACTER MAY USE ON A STATION FROM WHAT IT CARRIES: the service's count, as far as the
 *  pack and the bag still hold them (`held` the items), never gold's. */
export const carriedUsable = (c, held) => carriedSpendable(clampCarried(c, held));

/** WHERE A HARVEST'S GOODS WENT, in the words its line ends on (scenes/gatherHost.js storesLine, fishHost.js haulLine) -
 *  the Stores (an older book's harvest), else the bag, the pack or both as the mint put them (net/profBook.js `put`),
 *  and what found no room said beside them. */
export function goodsWhere(d) {
  if (d?.carry !== true) return 'to your Stores';
  const p = d.put ?? { bag: 0, pack: 0, left: 0 };
  const to = p.bag > 0 && p.pack > 0 ? 'to your bag and pack' : p.pack > 0 ? 'to your pack' : 'to your bag';
  return p.left > 0 ? `${to} - ${p.left} left where ${p.left === 1 ? 'it was' : 'they were'} gathered: no room` : to;
}

/** AUDIT BAG1 B9: WHERE A STATION'S WORK WENT (net/profBook.js smelt's `put`: `{ bag, pack, stored }`), as the sentence
 *  after the work's own - the bag, the pack, or what stayed in the Stores with no room in either. '' when nothing was
 *  carried out (an older book's work stays in the Stores, as it always did). */
export function madeWhere(p) {
  if (!p || typeof p !== 'object') return '';
  const bag = p.bag | 0, pack = p.pack | 0, stored = p.stored | 0;
  const to = bag > 0 && pack > 0 ? 'Into your bag and pack' : pack > 0 ? 'Into your pack' : bag > 0 ? 'Into your bag' : '';
  if (!stored) return to ? `${to}.` : '';
  const kept = `${stored} ${stored === 1 ? 'stays' : 'stay'} in your Stores: no room in your bag or pack.`;
  return to ? `${to} - ${kept[0].toLowerCase()}${kept.slice(1)}` : kept;
}

/** The bag's words, said where it is bought, where a harvest lands, and where it is refused. */
export const BAG_WORDS = Object.freeze({
  name: BAG_ROW.name,
  /** the first harvest of a session, said once (scenes/gatherHost.js) */
  where: 'Gathered goods go into your Materials Bag - or your pack while you have none. Every General Store sells the bag.',
  /** the bag's own refusals (systems/materialsBag.js bagStoreRefusal, inventorySession.js planBagToggle) - AUDIT BAG1:
   *  `full` and `second` were never said (the capacity ladder says a full bag; the shop shelves none to a second) */
  onlyMaterials: 'Only crafting materials go in the Materials Bag.',
  none: 'You have no Materials Bag. Every General Store sells one.',
  notEmpty: 'Empty your Materials Bag first.',
  /** AUDIT BAG1 H1: a reward tray is up - a piece taken from the bag beside it was taken as the reward */
  reward: 'Choose your reward first - your Materials Bag opens after.',
  /** a node's prompt when neither the bag nor the pack has room for one more unit */
  noRoom: 'No room in your bag or pack',
  /** the Stores page, away from a town */
  town: 'Your Stores are kept in town. Go to any town to put materials in or take them out.',
});
