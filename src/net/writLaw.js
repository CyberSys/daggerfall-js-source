// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF6 (2026-09-29, Mac: "continue") - THE WRITS' LAW BESIDE THE COURT'S:
// a guild's writs, paid from its Marks treasury and delivered from the
// Stores into the guild Stores; a player's commission, naming a crafter and
// a piece of their make; the guild Stores' bounds; the seat week an
// Officer's writ budget is counted in. Pure, both ends - the service
// (server-account/src/writs.js) decides by it, the Work tab says it.
// bible/06-Systems/Professions-Arc.md 7, 11 and 28.
//
// The Court's writs stay professionLaw.js's (PROF1): they mint Marks and
// Renown; these move Marks a guild or a player already holds.
// ═══════════════════════════════════════════════════════════════════

import { material } from './nodeLaw.js';
import { STORES_MAX } from './professionLaw.js';
import { MARKS_MAX } from './marksLaw.js';
import { marketCatalogue, pieceListable, priceOk } from './marketLaw.js';
import { recipeById, takesQuality, MASTERWORK } from './recipeLaw.js';

const DAY_S = 86_400;

// ─── GUILD WRITS (11) ────────────────────────────────────────────────

/** A guild writ, and a commission, stands seven days (11: "unfilled after 7 days, the escrow returns"). */
export const WRIT_S = 7 * DAY_S;
/** The open writs a guild may stand at once (28: a buy order's twenty). */
export const GUILD_WRITS_MAX = 20;
/** A guild writ's units: 1 up to a character's Stores' most of a material (28). */
export const WRIT_UNITS_MAX = STORES_MAX;
/** A writ's pay each is at most this share of the material's Marks value, in hundredths (11: "1.5 x the materials'
 *  value", so a writ cannot be a disguised transfer to an alt - 13). */
export const WRIT_PAY_PCT = 150;
/** An Officers' writ budget a week, at most: the Marks cap (28). 0 until the Guildmaster sets it. */
export const WRIT_BUDGET_MAX = MARKS_MAX;
/** Writ posts an account may make an hour - a guild writ's and a commission's together (20: "writ posts 20"). */
export const WRIT_POSTS_MAX = 20;
/** Every other writ act an account may make an hour - a delivery, a fill, a withdrawal, a decline, a guild Stores move
 *  (the market's acts' number, 20: PROF5's 120). */
export const WRIT_OPS_MAX = 120;
export const WRIT_WINDOW_S = 3600;
/** The rows one sweep of expired writs and one settle of an account's commissions work, at most (the market's). */
export const WRIT_SETTLE_MAX = 20;
/** The most a region's board shows of each kind, and how long a closed commission stays in "Yours". */
export const WRIT_SHOWN = 50;
export const WRIT_RECENT_S = 7 * DAY_S;
/** A writ's, a commission's and a guild Stores move's request id - every account act's shape. */
export const WRIT_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
/** A writ's or a commission's id - the service's own (SOC1's `mintId` shape, as the market's). */
export const WRIT_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

/** Whether a guild writ may ask this material: one the market takes - PROF5's catalogue, what something yields. */
export const writMaterialOk = (key) => typeof key === 'string' && marketCatalogue().some((m) => m.key === key);
/** A writ's units: a whole number, 1 to 5,000. */
export const writUnitsOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= WRIT_UNITS_MAX;
/** The most a guild writ may pay a unit of `key`: 1.5 x its Marks value, rounded down (a tier-1 material pays 1). */
export const writPayMax = (key) => {
  const m = material(key);
  return m ? Math.floor((m.value * WRIT_PAY_PCT) / 100) : 0;
};
/** A writ's pay each: a whole number of Marks, 1 up to its material's most. */
export const writPayOk = (key, pay) => Number.isSafeInteger(pay) && pay >= 1 && pay <= writPayMax(key);
/** An Officers' writ budget: a whole number of Marks, 0 to the cap. */
export const writBudgetOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= WRIT_BUDGET_MAX;

// ─── THE SEAT WEEK (Seats-Arc 3) ─────────────────────────────────────

/** The week an Officer's writ budget is counted in is the seat week (28): Sunday 18:00 UTC to Sunday 18:00, week 0
 *  beginning at the first Turning, Sunday 2026-09-20 18:00 UTC (Seats-Arc 3: `ONLINE_EPOCH_MS` + 6 days 18 hours). */
export const SEAT_WEEK_S = 7 * DAY_S;
export const SEAT_WEEK_ZERO_S = Date.UTC(2026, 8, 20, 18, 0, 0) / 1000;
/** The seat week a moment falls in (before the first Turning, a negative one). */
export const seatWeek = (nowS) => Math.floor((nowS - SEAT_WEEK_ZERO_S) / SEAT_WEEK_S);
/** When a seat week begins. */
export const seatWeekStart = (week) => SEAT_WEEK_ZERO_S + week * SEAT_WEEK_S;

// ─── THE GUILD STORES (7) ────────────────────────────────────────────

/** A guild's Stores hold at most this many of a material (28: ten characters' Stores - a seat's works ask hundreds). */
export const GUILD_STORES_MAX = 50_000;
/** A guild Stores move's units: a whole number, 1 to a character's Stores' most. */
export const guildMoveOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= STORES_MAX;
/** The moves of the guild Stores a Guild tab shows. */
export const GUILD_STORE_MOVES_SHOWN = 20;

// ─── COMMISSIONS (11) ────────────────────────────────────────────────

/** An account's open commissions (28), and those naming one crafter (so no one can bury a crafter's list). */
export const COMMISSIONS_MAX = 5;
export const COMMISSIONS_FOR_MAX = 20;
/** A commission's pay: a listing's price bounds, 1 to 1,000,000 Marks. */
export const commissionPayOk = (n) => priceOk(n);
/** Whether a recipe may be commissioned: a piece the market lists (weapons, armour, staves, bows, tools, kits,
 *  furniture) - never arrows or a siege work. */
export const commissionable = (recipeId) => pieceListable(recipeId);
/** Whether a recipe's piece takes a quality - a kit does not, so its commission asks none. */
export const commissionTakesQuality = (recipeId) => {
  const r = recipeById(recipeId);
  return !!r && takesQuality(r);
};
/** A commission's least quality: 0 (Crude) to Masterwork where the recipe takes one; none (null) where it does not. */
export const commissionQualityOk = (recipeId, q) => (commissionTakesQuality(recipeId)
  ? Number.isInteger(q) && q >= 0 && q <= MASTERWORK
  : q === null);
/** Whether a piece answers a commission: the recipe asked, and at least the quality asked. */
export const commissionFilledBy = (c, piece) => !!piece && piece.recipe === c.recipe
  && (c.quality == null || (Number.isInteger(piece.quality) && piece.quality >= c.quality));

/**
 * WHAT EACH GUILD RANK MAY DO OF PROF6'S (the ranks that may - GUILD1's ranks, 0 the Guildmaster, 1 an Officer): post a
 * guild writ (an Officer within the week's budget, 11), set the Officers' budget, withdraw from the guild Stores (7 -
 * any member deposits, GUILD1's own `deposit`). Kept here, not in guildLaw.js's GUILD_POWERS: the relay bundles
 * guildLaw.js (SLAM13, test/relayversion.test.js), and powers it never reads must not move its law.
 */
export const WRIT_POWERS = Object.freeze({
  postWrit: Object.freeze([0, 1]),
  writBudget: Object.freeze([0]),
  storesWithdraw: Object.freeze([0, 1]),
});
/** Whether a rank may do one of PROF6's guild acts. */
export const writMay = (rank, power) => (WRIT_POWERS[power] ?? []).includes(rank);

/** The Work tab's seals (21): the Court's purple, a guild's (NOTICE1's guild blue - no guild's colours are stored
 *  until SEAT1c's heraldry), a commission's green. */
export const WRIT_SEALS = Object.freeze({ court: 'court', guild: 'guild', commission: 'commission' });
