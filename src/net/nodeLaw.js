// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - THE NODES' LAW: which nodes a map
// pixel holds on a UTC day, what an herb patch grows, what the season
// does to it, what a harvest yields, what the witnessed world says a
// pixel is, and what a region's Court writs may ask. The record is
// bible/06-Systems/Professions-Arc.md (PROF0) 4.3, 6, 11 and 22.
//
// THE NODES ARE THE CLOCK'S (PROF0 law 4). A pixel's nodes on a day are
// a hash of the pixel and the UTC day - the gate's own mix (gateLaw.js
// gateHash), under the nodes' own salt - so every client stands the same
// patch in the same place and the service knows a node id is real
// without a word from anyone. What a harvest YIELDS is rolled by the
// service alone (server-account/src/professions.js); this file says only
// how the roll is shaped.
//
// THE WITNESSED WORLD (SEAT0 3.2). The service holds no ARENA2, so it
// knows a pixel's climate and region only from the clients that derived
// them: a harvest carries them, an account a week registered reports a
// pixel once, three agreeing make it confirmed. `witnessedFact` is that
// law; an unconfirmed pixel is worth the least its kind allows - its
// patches never rise past tier 2, and no march's bounty is paid on it.
//
// Pure: no clock of its own, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { gateHash } from './gateLaw.js';   // the one mix every clock-law in the world rolls with
import { sharedClassicMinutes } from './wire.js';
import { CLIMATES, REGION_NAMES, MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';
import { SEASONS, seasonValue, dateFromClassicMinutes } from '../systems/gameDate.js';
import { basketBlock, BASKET_BLOCKS } from '../systems/foragingCore.js';   // the Basket's blocks and foods - the IL's, one home
import {
  herbKey, materialOf, foodKey, WRIT_UNITS, WRIT_TIER_WEIGHTS, writPay, writRenown,
} from './professionLaw.js';

/** The one salt every client stands a day's nodes with. Changing it moves every node in the world. */
export const NODE_SALT = 0x5e3d;
/** The salt a region's Court writs are drawn with. */
export const WRIT_SALT = 0x3c17;
/** A node's kind, as its id and its hash write it. */
export const NODE_KINDS = Object.freeze({ tree: 1, herb: 2, vein: 3, boulder: 4 });

// ─── HOW MANY (PROF0 6) ──────────────────────────────────────────────

const counts = (tree, herb, vein, boulder) => Object.freeze({ tree, herb, vein, boulder });
/** A wilderness pixel's nodes a day, by climate. The sea has none (Fishing's alone). */
export const NODE_COUNTS = Object.freeze({
  [CLIMATES.Woodlands]: counts(6, 4, 2, 1),
  [CLIMATES.MountainWoods]: counts(5, 3, 3, 2),
  [CLIMATES.Mountain]: counts(2, 2, 6, 3),
  [CLIMATES.HauntedWoodlands]: counts(4, 4, 2, 1),
  [CLIMATES.Swamp]: counts(3, 5, 1, 0),
  [CLIMATES.Rainforest]: counts(6, 5, 1, 0),
  [CLIMATES.Subtropical]: counts(4, 4, 2, 1),
  [CLIMATES.Desert]: counts(0, 3, 5, 3),
  [CLIMATES.Desert2]: counts(0, 3, 5, 3),
});
/** How many nodes of `kind` a pixel of `climate` holds a day. */
export const nodeCount = (climate, kind) => NODE_COUNTS[climate]?.[kind] ?? 0;
/** A node's tier weights, tier 1 first (40 / 25 / 15 / 10 / 6 / 4 %). */
export const NODE_TIER_WEIGHTS = Object.freeze([40, 25, 15, 10, 6, 4]);

// ─── THE HERBS (PROF0 4.3) ───────────────────────────────────────────

const row = (...t) => Object.freeze(t);
/** Each climate's herbs - DFU's plant templates - as [common, uncommon, rare]: tiers 1, 2 and 3. */
export const HERB_TABLES = Object.freeze({
  [CLIMATES.Woodlands]: Object.freeze([row(9, 18, 10, 11), row(16, 17, 19, 20, 23), row(25, 26)]),
  [CLIMATES.MountainWoods]: Object.freeze([row(14, 18, 15), row(12), row(22)]),
  [CLIMATES.Mountain]: Object.freeze([row(14, 8), row(13), row(26)]),
  [CLIMATES.HauntedWoodlands]: Object.freeze([row(8, 12), row(21, 24), row(27)]),
  [CLIMATES.Swamp]: Object.freeze([row(12, 13, 9), row(28), row(24)]),
  [CLIMATES.Rainforest]: Object.freeze([row(28, 15), row(27, 31, 10), row(22)]),
  [CLIMATES.Subtropical]: Object.freeze([row(29, 30, 11), row(31, 28), row(25)]),
  [CLIMATES.Desert]: Object.freeze([row(32, 8), row(30, 29), row(25)]),
  [CLIMATES.Desert2]: Object.freeze([row(32, 8), row(30, 29), row(25)]),
});
/** The herbs' three tiers. */
export const HERB_TIERS = 3;
/**
 * An herb's own tier - its commonest place's (PROF0 22): the Stores' tier and Marks value of the plant, which a writ
 * and a market read. A patch's tier is its climate's (a rare find there), and that is what its rank and XP read.
 */
export function herbTier(templateIndex) {
  let best = null;
  for (const table of Object.values(HERB_TABLES)) {
    for (let t = 0; t < table.length; t++) if (table[t].includes(templateIndex) && (best === null || t + 1 < best)) best = t + 1;
  }
  return best;
}
/** A material's standing (professionLaw materialOf, with the herbs' own tiers). */
export const material = (key) => materialOf(key, herbTier);

// ─── THE SEASONS (PROF0 4.3, 22) ─────────────────────────────────────

/** The flowers, roses, poppies and berries - what winter bares. Green Leaves and Clover the line names on neither side:
 *  they grow all year. */
export const HERB_FLOWERS = Object.freeze([10, 11]);
export const HERB_ROSES = Object.freeze([19, 20, 21, 22]);
export const HERB_POPPIES = Object.freeze([23, 24, 25, 26]);
export const HERB_BERRIES = Object.freeze([15, 16, 17]);
export const WINTER_BARE = Object.freeze([...HERB_FLOWERS, ...HERB_ROSES, ...HERB_POPPIES, ...HERB_BERRIES]);
/** Spring's +50%: every flowering herb (the winter line less its berries). Autumn's: the berries. */
export const SPRING_BLOOM = Object.freeze([...HERB_FLOWERS, ...HERB_ROSES, ...HERB_POPPIES]);
export const AUTUMN_FRUIT = HERB_BERRIES;
export const SEASON_MULT = 1.5;
/** A Seasonal Eye's off-season herb (PROF0 3.3): half the yield. */
export const OFF_SEASON_MULT = 0.5;
export const herbInSeason = (templateIndex, season) => season !== SEASONS.Winter || !WINTER_BARE.includes(templateIndex);
export const herbSeasonMult = (templateIndex, season) =>
  ((season === SEASONS.Spring && SPRING_BLOOM.includes(templateIndex)) || (season === SEASONS.Fall && AUTUMN_FRUIT.includes(templateIndex)) ? SEASON_MULT : 1);

/** The UTC day an instant (ms) falls in. */
export const utcDayOfMs = (ms) => Math.floor(ms / 86_400_000);
/** A UTC day's first instant on the shared clock, as DFU's date - a day's patches, the Basket's block and a writ's
 *  table read the season and month of it, so nothing under a player changes before the day does. */
export const dayDate = (day) => dateFromClassicMinutes(Math.floor(sharedClassicMinutes(day * 86_400_000)));
export const daySeason = (day) => seasonValue(dayDate(day));
export const dayMonth = (day) => dayDate(day).month;

// ─── A NODE'S ID ─────────────────────────────────────────────────────

/** Whether (x, y) is a map pixel. */
export const pixelOk = (x, y) => Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < MAX_MAP_PIXEL_X && y < MAX_MAP_PIXEL_Y;
/** Whether `r` is a region index. */
export const regionOk = (r) => Number.isSafeInteger(r) && r >= 0 && r < REGION_NAMES.length;
/** A node's id: `herb:412:188:20724:2` - its kind, its pixel, its UTC day and its slot. */
export const nodeKey = ({ kind, x, y, day, slot }) => `${kind}:${x}:${y}:${day}:${slot}`;
const NODE_KEY_RE = /^(tree|herb|vein|boulder):(\d{1,3}):(\d{1,3}):(\d{1,6}):(\d{1,2})$/;
/** A node id read back, or null for one out of shape. */
export function parseNodeKey(s) {
  const m = typeof s === 'string' ? NODE_KEY_RE.exec(s) : null;
  if (!m) return null;
  const [x, y, day, slot] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  return pixelOk(x, y) ? { kind: m[1], x, y, day, slot } : null;
}
/** Roll `k` of a node: a whole number in [0, 2^32). */
export const nodeRoll = (kind, x, y, day, slot, k) => gateHash(NODE_SALT, x, y, day, NODE_KINDS[kind] ?? 0, slot, k);
const unit = (kind, x, y, day, slot, k) => nodeRoll(kind, x, y, day, slot, k) / 4294967296;

/** A tier drawn by `u` in [0, 1) over the first `tiers` of NODE_TIER_WEIGHTS, renormalised (herbs: 40 : 25 : 15). */
export function drawTier(u, tiers) {
  const w = NODE_TIER_WEIGHTS.slice(0, tiers);
  const total = w.reduce((a, b) => a + b, 0);
  let at = u * total;
  for (let t = 0; t < w.length; t++) { if (at < w[t]) return t + 1; at -= w[t]; }
  return w.length;
}

/**
 * ONE HERB PATCH of a pixel's day: where it stands in the pixel (`u`, `v` in [0.04, 0.96]), its tier, its herb, and
 * whether the herb is out of season (a Seasonal Eye's alone). The tier is held to 2 on a pixel not confirmed. The herb
 * is drawn from the tier's list; a bare first draw draws again among what grows at that tier, stepping down a tier
 * until something does - but a Seasonal Eye keeps the first draw, off-season. Null where the climate grows no herbs.
 * @param {{ x: number, y: number, day: number, slot: number, climate: number, confirmed?: boolean, seasonalEye?: boolean }} p
 */
export function herbPatch({ x, y, day, slot, climate, confirmed = false, seasonalEye = false }) {
  const table = HERB_TABLES[climate];
  if (!table) return null;
  const season = daySeason(day);
  const u = 0.04 + 0.92 * unit('herb', x, y, day, slot, 1);
  const v = 0.04 + 0.92 * unit('herb', x, y, day, slot, 2);
  let tier = drawTier(unit('herb', x, y, day, slot, 3), HERB_TIERS);
  if (!confirmed) tier = Math.min(tier, 2);
  const list = table[tier - 1];
  const first = list[Math.floor(unit('herb', x, y, day, slot, 4) * list.length)];
  if (herbInSeason(first, season)) return { slot, u, v, tier, herb: first, offSeason: false };
  if (seasonalEye) return { slot, u, v, tier, herb: first, offSeason: true };
  for (let t = tier; t >= 1; t--) {
    const grow = table[t - 1].filter((h) => herbInSeason(h, season));
    if (grow.length) return { slot, u, v, tier: t, herb: grow[Math.floor(unit('herb', x, y, day, slot, 5) * grow.length)], offSeason: false };
  }
  return null;
}
/** Every herb patch of a pixel's day, slot 0 first. */
export function herbPatches({ x, y, day, climate, confirmed = false, seasonalEye = false }) {
  const n = nodeCount(climate, 'herb');
  const out = [];
  for (let slot = 0; slot < n; slot++) {
    const p = herbPatch({ x, y, day, slot, climate, confirmed, seasonalEye });
    if (p) out.push(p);
  }
  return out;
}

// ─── THE YIELDS (PROF0 6) ────────────────────────────────────────────

/** An herb's base roll (the service's dice): 1 to 3. */
export const HERB_YIELD = Object.freeze([1, 3]);
/** The Basket's food by the patch's block (FORAGE0 14.6): one in a desert, 1-2 in B and D, 1-3 in C and E. */
export const FOOD_YIELD = Object.freeze({ A: Object.freeze([1, 1]), B: Object.freeze([1, 2]), C: Object.freeze([1, 3]), D: Object.freeze([1, 2]), E: Object.freeze([1, 3]) });
/** The Marches - Betony, Anticlere, Lainlyn (PROF0 4.7): every node +25%, on a confirmed pixel. */
export const MARCH_REGIONS = Object.freeze([19, 21, 22]);
export const MARCH_MULT = 1.25;
export const isMarch = (region) => MARCH_REGIONS.includes(region);
/** A fraction of a unit left at the end is that chance of one more, on the service's dice (`chance` in [0, 1)). */
export function wholeYield(y, chance) {
  const whole = Math.floor(y + 1e-9);
  return whole + (chance < y - whole - 1e-9 ? 1 : 0);
}
/**
 * AN HERB'S YIELD, in PROF0 6's order: the base roll (+1 a common herb for a Gardener); the season (spring's blooms,
 * autumn's berries x1.5; a Seasonal Eye's off-season herb x0.5); the act's step - a bruised herb one less, at least one;
 * a march's +25%; the fraction a chance.
 */
export function herbYield({ roll, common = false, gardener = false, seasonMult = 1, offSeason = false, bruised = false, march = false }, chance) {
  let y = roll + (common && gardener ? 1 : 0);
  y *= seasonMult;
  if (offSeason) y *= OFF_SEASON_MULT;
  if (bruised) y = Math.max(1, y - 1);
  if (march) y *= MARCH_MULT;
  return Math.max(1, wholeYield(y, chance));
}
/** THE BASKET'S YIELD: the block's roll, the search's step (x1.5 all three, x1.25 two), a march's +25%, the fraction. */
export function foodYield({ roll, step = 1, march = false }, chance) {
  let y = roll * step;
  if (march) y *= MARCH_MULT;
  return Math.max(1, wholeYield(y, chance));
}
/** The Basket's find at a patch on day `day`: its block (the climate, the day's month) and the food drawn from the
 *  block's list by `u` in [0, 1) - a material key. */
export function basketFood(climate, day, u) {
  const block = basketBlock(climate, dayMonth(day));
  const b = BASKET_BLOCKS[block];
  const code = b.foods[Math.min(b.foods.length - 1, Math.floor(u * b.foods.length))];
  return { block, material: foodKey(code, b.fruit) };
}

// ─── THE WITNESSED PIXEL (SEAT0 3.2) ─────────────────────────────────

/** Who may witness, and how many make a fact: an account a week registered; three agree; two dispute. */
export const WITNESS = Object.freeze({ ageS: 7 * 86_400, confirm: 3, dispute: 2 });
/** A pixel's key and a report on it, as `world_witness` keeps them. */
export const pixelKey = (x, y) => `${x},${y}`;
export const pixelReport = (climate, region) => `${climate},${region}`;
export function parseReport(s) {
  const m = typeof s === 'string' ? /^(\d{3}),(\d{1,2})$/.exec(s) : null;
  return m ? { climate: Number(m[1]), region: Number(m[2]) } : null;
}
/**
 * WHAT THE WITNESSES SAY a pixel is: `rows` its reports (`{ account, report, at }`, one an account). The first answer
 * three accounts give is CONFIRMED, and stands; another answer two accounts give after it makes the pixel DISPUTED,
 * the confirmed answer still standing (SEAT0 3.2's one dispute rule). Unconfirmed, the answer most give (the earliest
 * on a tie) is what the pixel is taken to be, at the least its kind allows. `none` with no report.
 * @param {Array<{ account: string, report: string, at: number }>} rows
 * @returns {{ state: 'none'|'unconfirmed'|'confirmed'|'disputed', climate: number|null, region: number|null }}
 */
export function witnessedFact(rows) {
  const sorted = [...(rows ?? [])].filter((r) => parseReport(r?.report)).sort((a, b) => (a.at - b.at) || (a.account < b.account ? -1 : a.account > b.account ? 1 : 0));
  if (!sorted.length) return { state: 'none', climate: null, region: null };
  const byReport = new Map();
  let confirmed = null, disputed = false;
  for (const r of sorted) {
    const seen = byReport.get(r.report) ?? new Set();
    seen.add(r.account);
    byReport.set(r.report, seen);
    if (!confirmed && seen.size >= WITNESS.confirm) confirmed = r.report;
    else if (confirmed && r.report !== confirmed && seen.size >= WITNESS.dispute) disputed = true;
  }
  if (confirmed) return { state: disputed ? 'disputed' : 'confirmed', ...parseReport(confirmed) };
  let best = null, bestN = 0;
  for (const [report, seen] of byReport) if (seen.size > bestN) { best = report; bestN = seen.size; }
  return { state: 'unconfirmed', ...parseReport(best) };
}
/** A confirmed answer stands for a disputed pixel too. */
export const factConfirmed = (fact) => fact?.state === 'confirmed' || fact?.state === 'disputed';

// ─── A REGION'S COURT WRITS (PROF0 11, 22) ───────────────────────────

/**
 * WHAT A REGION'S COURT MAY ASK on a day: every herb its witnessed ground grows in the day's season - a confirmed
 * pixel's whole table, an unconfirmed one's tiers 1-2 - as the region's own group's material, with the material's own
 * tier and value, ordered by key (a stable input for the draw).
 * @param {number} region
 * @param {Array<{ climate: number, confirmed: boolean }>} pixels the region's witnessed pixels
 * @param {number} season
 */
export function regionWritTable(region, pixels, season) {
  const keys = new Set();
  for (const p of pixels ?? []) {
    const table = HERB_TABLES[p?.climate];
    if (!table) continue;
    const upTo = p.confirmed ? HERB_TIERS : 2;
    for (let t = 0; t < upTo; t++) {
      for (const h of table[t]) if (herbInSeason(h, season)) { const k = herbKey(h, region); if (k) keys.add(k); }
    }
  }
  return [...keys].sort().map((key) => { const m = material(key); return { material: key, tier: m.tier, value: m.value }; });
}
const writUnit = (day, region, slot, k) => gateHash(WRIT_SALT, day, region, slot, k) / 4294967296;
/**
 * A REGION'S COURT WRITS for a day: `count` of them over `table` (regionWritTable). The day's first asks the highest tier
 * the table holds of 5-6, else its highest (PROF0 11: "one a day of tier 5-6"; herbs reach tier 3); the rest draw a tier
 * of 1-4 the table holds by the nodes' weights, then a material of it evenly; units in tens from the tier's range. The
 * pay and the Renown follow. None over an empty table.
 * @param {number} day @param {number} region @param {number} count
 * @param {Array<{ material: string, tier: number, value: number }>} table
 */
export function courtWrits(day, region, count, table) {
  if (!table?.length) return [];
  const tiers = [...new Set(table.map((m) => m.tier))].sort((a, b) => a - b);
  const high = tiers.filter((t) => t >= 5);
  const low = tiers.filter((t) => t <= 4);
  const out = [];
  for (let slot = 0; slot < count; slot++) {
    let tier;
    if (slot === 0 || !low.length) tier = high.length ? high[Math.floor(writUnit(day, region, slot, 1) * high.length)] : tiers[tiers.length - 1];
    else {
      const w = low.map((t) => WRIT_TIER_WEIGHTS[t - 1]);
      let at = writUnit(day, region, slot, 1) * w.reduce((a, b) => a + b, 0);
      tier = low[low.length - 1];
      for (let i = 0; i < low.length; i++) { if (at < w[i]) { tier = low[i]; break; } at -= w[i]; }
    }
    const of = table.filter((m) => m.tier === tier);
    const m = of[Math.floor(writUnit(day, region, slot, 2) * of.length)];
    const [lo, hi] = WRIT_UNITS[tier];
    const steps = (hi - lo) / 10 + 1;
    const units = lo + 10 * Math.floor(writUnit(day, region, slot, 3) * steps);
    out.push({ slot, material: m.material, tier, units, pay: writPay(units, m.value), renown: writRenown(tier, units) });
  }
  return out;
}
