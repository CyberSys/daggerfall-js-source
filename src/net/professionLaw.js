// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!"; "Life skills will utilize things
// like tree chopping, picking up ingredients, fishing, etc. Active player
// involvement and actual UI integration for life skills") - THE
// PROFESSIONS' LAW: the thirteen, their ranks and XP, the tiers, the
// specialisations, the day's cap, the Stores, Herbalism's two acts, the
// materials the Stores hold, and the Court writs. The record is
// bible/06-Systems/Professions-Arc.md (PROF0) 3, 5, 7, 11 and 22.
//
// ONLINE ONLY. Daggerfall has no crafting skill and its three makers use
// none (PROF0 law 1); a profession is a Ledger A departure, online's
// alone, and every point of it is the account service's to credit - it
// performed the harvest, the delivery (server-account/src/professions.js).
//
// A MATERIAL IS DFU'S OWN ITEM wherever DFU has one (law 2). An herb is
// a plant template in one of DFU's two plant groups - PlantIngredients1,
// named "(northern)" below template 18, and PlantIngredients2,
// "(southern)" (systems/itemInfo.js itemNameParts) - and a two-group
// plant takes its pixel's region's (FALL.EXE's REGION_RACES: a Breton
// region northern, a Redguard one southern), so the Stores keep such a
// plant as two materials and a withdrawal is the item DFU's own loot
// would have made. The names are DFU's, read on the client through
// templateByIndex; nothing here re-types one.
//
// Pure: no clock, no DOM, no network. Both ends read it.
// ═══════════════════════════════════════════════════════════════════

import { REGION_RACES } from '../formats/mapsTables.js';
import { attributeBand } from '../systems/foragingCore.js';   // Foraging's bands, one home (FORAGE0 14.4)

// ─── THE THIRTEEN (PROF0 3.1) ────────────────────────────────────────

/** Every profession, in the Professions tab's order: the five that gather, then the eight that craft. */
export const PROFESSIONS = Object.freeze([
  Object.freeze({ id: 'mining', name: 'Mining', kind: 'gathering' }),
  Object.freeze({ id: 'logging', name: 'Logging', kind: 'gathering' }),
  Object.freeze({ id: 'herbalism', name: 'Herbalism', kind: 'gathering' }),
  Object.freeze({ id: 'hunting', name: 'Hunting', kind: 'gathering' }),
  Object.freeze({ id: 'fishing', name: 'Fishing', kind: 'gathering' }),
  Object.freeze({ id: 'smithing', name: 'Smithing', kind: 'crafting' }),
  Object.freeze({ id: 'outfitting', name: 'Outfitting', kind: 'crafting' }),
  Object.freeze({ id: 'carpentry', name: 'Carpentry', kind: 'crafting' }),
  Object.freeze({ id: 'masonry', name: 'Masonry', kind: 'crafting' }),
  Object.freeze({ id: 'alchemy', name: 'Alchemy', kind: 'crafting' }),
  Object.freeze({ id: 'enchanting', name: 'Enchanting', kind: 'crafting' }),
  Object.freeze({ id: 'cooking', name: 'Cooking', kind: 'crafting' }),
  Object.freeze({ id: 'jewelcrafting', name: 'Jewelcrafting', kind: 'crafting' }),
]);
/** @type {Map<string, { id: string, name: string, kind: string }>} */
const BY_ID = new Map(PROFESSIONS.map((p) => [p.id, p]));
export const isProfession = (id) => typeof id === 'string' && BY_ID.has(id);
export const professionName = (id) => BY_ID.get(id)?.name ?? '';
export const isGathering = (id) => BY_ID.get(id)?.kind === 'gathering';

// ─── RANKS, XP, TIERS (PROF0 3.2) ────────────────────────────────────

/** A track runs 0 to 100. */
export const PROF_RANK_MAX = 100;
/** The rank names, each from the rank it starts at. */
export const RANK_NAMES = Object.freeze([
  Object.freeze(['Novice', 0]), Object.freeze(['Apprentice', 25]), Object.freeze(['Journeyman', 50]),
  Object.freeze(['Expert', 75]), Object.freeze(['Master', 100]),
]);
/** The XP a track holds at rank `n`: 10 x n^2 (Apprentice 6,250; Journeyman 25,000; Expert 56,250; Master 100,000). */
export const xpForRank = (n) => 10 * n * n;
/** The most XP a track holds - a Master's. */
export const PROF_XP_MAX = xpForRank(PROF_RANK_MAX);
/** A track's rank: the highest `n` whose XP it holds, 0 to 100 - exact: every 10 x n^2 is a perfect square's tenfold,
 *  whose root a double answers exactly (pinned over all 101 ranks and the XP one under each). */
export function rankOfXp(xp) {
  const x = Number.isFinite(xp) ? Math.max(0, Math.min(PROF_XP_MAX, Math.floor(xp))) : 0;
  return Math.floor(Math.sqrt(x / 10));
}
/** A rank's name: "Novice" to "Master". */
export const rankName = (rank) => RANK_NAMES.reduce((name, [n, at]) => (rank >= at ? n : name), RANK_NAMES[0][0]);
/** The rank each tier needs - tier t's is TIER_RANKS[t - 1] (PROF0 3.2's ladder). */
export const TIER_RANKS = Object.freeze([0, 10, 25, 40, 55, 70, 90]);
export const TIER_MAX = TIER_RANKS.length;
/** Whether a rank may work tier `tier`. */
export const tierOpen = (rank, tier) => Number.isSafeInteger(tier) && tier >= 1 && tier <= TIER_MAX && rank >= TIER_RANKS[tier - 1];
/** The highest tier a rank works. */
export const topTierOf = (rank) => TIER_RANKS.filter((r) => rank >= r).length;

/** A harvest's XP: 15 x tier, +50% for a clean act, a quarter for a node more than two tiers below the rank's top. */
export const HARVEST_XP_PER_TIER = 15;
export function harvestXp(tier, rank, clean) {
  let xp = HARVEST_XP_PER_TIER * tier;
  if (clean) xp = Math.floor((xp * 3) / 2);
  if (tier < topTierOf(rank) - 2) xp = Math.floor(xp / 4);
  return xp;
}
/** A writ's XP: twice its Mark value - its pay (PROF0 3.2), to the profession its material is gathered by. */
export const writXp = (pay) => 2 * pay;
/** The crafter's limit (PROF0 3.2): two crafts above Journeyman. The crafts come with PROF3; the tab says it now. */
export const CRAFTS_ABOVE_JOURNEYMAN = 2;
export const JOURNEYMAN_RANK = 50;

// ─── SPECIALISATIONS (PROF0 3.3) ─────────────────────────────────────

/** The ranks a choice opens at. */
export const SPEC_RANKS = Object.freeze([50, 100]);
/** A change of mind: 1,000 Marks burnt, and the new one takes effect a week later (the old stands until then). */
export const RESPEC = Object.freeze({ marks: 1000, days: 7 });
const spec = (id, name, text) => Object.freeze({ id, name, text });
const pair = (a, b) => Object.freeze([a, b]);
/** Every profession's two choices at 50 and at 100 - the record's words. PROF1 gives Herbalism's their effect; the
 *  others take effect with their professions' slices (a track there holds no XP until then). */
export const SPECIALISATIONS = Object.freeze({
  mining: Object.freeze({
    50: pair(spec('prospector', 'Prospector', 'Veins within 200 m are marked on the compass and the held map; gem chance +10%.'),
      spec('deep-delver', 'Deep Delver', 'Dungeon veins yield +50%.')),
    100: pair(spec('motherlode-sense', 'Motherlode Sense', 'Motherlode warnings come 30 minutes ahead, not 10.'),
      spec('stonebreaker', 'Stonebreaker', 'Quarrying yields Cut Stone directly.')),
  }),
  logging: Object.freeze({
    50: pair(spec('lumberjack', 'Lumberjack', 'Two chops fewer a tree (three at least).'),
      spec('forester', 'Forester', 'Heartwood chance x2.')),
    100: pair(spec('charcoal-burner', 'Charcoal Burner', 'A log burns to 2 Charcoal, not 1.'),
      spec('timberwright', 'Timberwright', 'A log saws to 3 planks, not 2.')),
  }),
  herbalism: Object.freeze({
    50: pair(spec('gardener', 'Gardener', 'Common herbs yield +1.'),
      spec('botanist', 'Botanist', 'The steady window +50%.')),
    100: pair(spec('seasonal-eye', 'Seasonal Eye', 'Off-season herbs, at half the yield.'),
      spec('apothecarys-friend', "Apothecary's Friend", 'Every herb you pick counts as unbruised.')),
  }),
  hunting: Object.freeze({
    50: pair(spec('tracker', 'Tracker', 'Animals within 100 m are marked.'),
      spec('tanner', 'Tanner', 'Hides cure 1:1, not 2:1.')),
    100: pair(spec('trophy-hunter', 'Trophy Hunter', 'A trophy decor piece from a tier 5+ kill.'),
      spec('butcher', 'Butcher', 'Meat x2, and it spoils half as fast.')),
  }),
  fishing: Object.freeze({
    50: pair(spec('angler', 'Angler', 'The tug window +40%.'),
      spec('netter', 'Netter', "A school's haul +2 fish, not +1.")),
    100: pair(spec('deep-sea', 'Deep-Sea', "The sea's Pearl and Slaughterfish chances x2."),
      spec('pearl-diver', 'Pearl Diver', 'Pearl chance x3.')),
  }),
  smithing: Object.freeze({
    50: pair(spec('weaponsmith', 'Weaponsmith', 'Weapons +1 quality step.'),
      spec('armoursmith', 'Armoursmith', 'Armour +1 quality step.')),
    100: pair(spec('masterwright', 'Masterwright', 'Masterwork chance +5%.'),
      spec('quartermaster', 'Quartermaster', 'Ingots and repair kits x2.')),
  }),
  outfitting: Object.freeze({
    50: pair(spec('tailor', 'Tailor', 'Clothing +1 quality step.'),
      spec('leatherworker', 'Leatherworker', 'Leather armour +1 quality step.')),
    100: pair(spec('couturier', 'Couturier', 'Two-colour dyes.'),
      spec('saddler', 'Saddler', 'A wagon upgrade (Horse Cart and Cargo) of +100 kg.')),
  }),
  carpentry: Object.freeze({
    50: pair(spec('bowyer', 'Bowyer', 'Bows and arrows +1 quality step.'),
      spec('joiner', 'Joiner', 'Furniture at half the planks.')),
    100: pair(spec('siegewright', 'Siegewright', 'Rams +50% vitality; siege works a day sooner.'),
      spec('master-joiner', 'Master Joiner', "Furniture carries the maker's mark.")),
  }),
  masonry: Object.freeze({
    50: pair(spec('quarryman', 'Quarryman', 'Rough Stone cuts 1:1, not 2:1.'),
      spec('builder', 'Builder', 'Fortification projects need 10% less stone.')),
    100: pair(spec('fortifier', 'Fortifier', "Once a Season a seat's Walls skip their drop on capture."),
      spec('sculptor', 'Sculptor', 'Stone decor pieces.')),
  }),
  alchemy: Object.freeze({
    50: pair(spec('brewer', 'Brewer', '3 potions a brew at Journeyman.'),
      spec('distiller', 'Distiller', 'Potent chance +10%.')),
    100: pair(spec('master-alchemist', 'Master Alchemist', 'Potent is +40%, not +25%.'),
      spec('transmuter', 'Transmuter', 'Three of a DFU metal make one of the next up.')),
  }),
  enchanting: Object.freeze({
    50: pair(spec('efficient', 'Efficient', 'A further -5% cost.'),
      spec('disenchanter', 'Disenchanter', 'Arcane Essence x2.')),
    100: pair(spec('soulbinder', 'Soulbinder', 'Filled soul gems give +10% points.'),
      spec('runecaster', 'Runecaster', "A Masterwork's property chosen from three.")),
  }),
  cooking: Object.freeze({
    50: pair(spec('cook', 'Cook', '+1 serving a dish.'),
      spec('field-cook', 'Field Cook', "A campfire without a Campfire Kit's charge.")),
    100: pair(spec('chef', 'Chef', 'Feasts last +50%.'),
      spec('provisioner', 'Provisioner', 'Rations and dishes never spoil.')),
  }),
  jewelcrafting: Object.freeze({
    50: pair(spec('gemcutter', 'Gemcutter', 'A set gem adds +10% enchantment points.'),
      spec('goldsmith', 'Goldsmith', 'Silver counts as Gold.')),
    100: pair(spec('master-jeweller', 'Master Jeweller', 'Jewellery Masterwork chance +5%.'),
      spec('lapidary', 'Lapidary', 'Siege-cracked Gems set as any gem.')),
  }),
});
/** Whether `specId` is one of the two a profession offers at `rank` (50 or 100). */
export const specOk = (profession, rank, specId) => !!SPECIALISATIONS[profession]?.[rank]?.some((s) => s.id === specId);
/** A choice's record, or null. */
export const specOf = (profession, rank, specId) => SPECIALISATIONS[profession]?.[rank]?.find((s) => s.id === specId) ?? null;
/**
 * The specialisations a track stands under at `nowS`: the chosen ones, a paid change taking the place of its rank's
 * choice once its week is out. `row` is the service's track row (spec50, spec100, respec_rank, respec_to, respec_at).
 * @returns {{ 50: string|null, 100: string|null }}
 */
export function specsAt(row, nowS) {
  const out = { 50: row?.spec50 ?? null, 100: row?.spec100 ?? null };
  if (row?.respec_to && Number.isSafeInteger(row?.respec_at) && nowS >= row.respec_at && (row.respec_rank === 50 || row.respec_rank === 100)) {
    out[row.respec_rank] = row.respec_to;
  }
  return out;
}

// ─── THE DAY, THE STORES, THE RATE (PROF0 6, 7, 20) ──────────────────

/** Harvests a gathering profession gives a character a UTC day - the Basket's among Herbalism's (FORAGE0 14.6). */
export const HARVESTS_PER_DAY = 60;
/** The Stores hold at most this many of any one material, own and bought together. */
export const STORES_MAX = 5000;
/** One withdrawal to the pack, at most. */
export const WITHDRAW_MAX = 200;
/** Professions writes an account may make an hour (a harvest, a withdrawal, a delivery, a choice each count). */
export const PROF_OPS_MAX = 600;
export const PROF_OPS_WINDOW_S = 3600;
/** A harvest's `at` - the act's end on the shared clock - may be at most this far past (the queue's bound, PROF0 19)... */
export const HARVEST_LATE_S = 600;
/** ...and at most this far ahead of the service's clock (a client's clock a little fast). */
export const HARVEST_EARLY_S = 60;
/** The switch the service's config holds (PROFESSIONS_OPEN): off, dev (the developers alone), on. */
export const PROF_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const profSwitchOf = (v) => (PROF_SWITCH.includes(v) ? v : 'off');
/** A request id, so an answer lost and asked again is answered again, never credited twice (MARKS_RID_RE's shape). */
export const PROF_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;

// ─── HERBALISM'S ACTS (PROF0 5.2, FORAGE0 14.6) ──────────────────────

/** A common herb comes up by hand in this long, with no moment. The steady hand holds for `steadyS`, bruised by a turn
 *  past `steadyDeg` (x the band, x Botanist's) or a move past `moveM`. */
export const HERB_ACT = Object.freeze({ commonS: 0.8, steadyS: 2.5, steadyDeg: 3, moveM: 0.25, botanist: 1.5 });
/** The Basket's search: three finds glint in turn, each `glintS` long (`masterGlintS` at Master), a `gapS` between. */
export const BASKET_ACT = Object.freeze({ finds: 3, glintS: 1.0, masterGlintS: 1.4, gapS: 0.4 });
/** The attribute bands' widening of an act's window (FORAGE0 14.4), by Foraging's own band. */
export const ACT_BANDS = Object.freeze([0.85, 1.0, 1.15, 1.3]);
export const actBand = (attribute) => ACT_BANDS[attributeBand(attribute)];
/** The Basket's step by finds: all three +50%, two +25%, fewer none (FORAGE0 14.6). */
export const basketStep = (finds) => (finds >= 3 ? 1.5 : finds === 2 ? 1.25 : 1);

// ─── THE MATERIALS PROF1 STORES (PROF0 4.3, 4.8; FORAGE0 14.6) ───────

/** The Stores tab's families, in its filter row's order (PROF0 8). */
export const MATERIAL_FAMILIES = Object.freeze([
  Object.freeze(['metals', 'Ores and Metals']), Object.freeze(['wood', 'Wood']), Object.freeze(['herbs', 'Herbs']),
  Object.freeze(['hides', 'Hides and Cloth']), Object.freeze(['food', 'Food']), Object.freeze(['stone', 'Stone']),
  Object.freeze(['gems', 'Gems']), Object.freeze(['essences', 'Essences']), Object.freeze(['spoils', 'Spoils of War']),
]);
/** DFU's two plant groups (itemTemplatesData.js GROUP_TEMPLATE_INDICES), as the material keys write them. */
export const PLANT_GROUPS = Object.freeze({ p1: 'PlantIngredients1', p2: 'PlantIngredients2' });
/** The plants each group holds - DFU's own lists (itemTemplatesData.js; pinned equal there). */
export const PLANT_GROUP_TEMPLATES = Object.freeze({
  p1: Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 25]),
  p2: Object.freeze([8, 9, 10, 11, 12, 13, 15, 16, 17, 21, 22, 24, 26, 27, 28, 29, 30, 31, 32]),
});
/** A region's plant group: FALL.EXE's race for it - Breton (0) northern, Redguard (1) southern. */
export const regionPlantGroup = (region) => (REGION_RACES[region] === 1 ? 'p2' : 'p1');
/** The group a plant picked in `region` is: the region's, where the plant is in it; else the one group it is in. */
export function plantGroupFor(templateIndex, region) {
  const g = regionPlantGroup(region);
  if (PLANT_GROUP_TEMPLATES[g].includes(templateIndex)) return g;
  const other = g === 'p1' ? 'p2' : 'p1';
  return PLANT_GROUP_TEMPLATES[other].includes(templateIndex) ? other : null;
}
/** An herb's material key: its group and its template, `p1:19` (Red Rose) - or null for a template no group holds. */
export const herbKey = (templateIndex, region) => {
  const g = plantGroupFor(templateIndex, region);
  return g ? `${g}:${templateIndex}` : null;
};
/** The Basket's foods, as the Stores keep them - the template is chosen when one is withdrawn (FORAGE0 14.6). */
export const FOOD_KEYS = Object.freeze(['food:apple', 'food:orange', 'food:mushroom', 'food:egg']);
/** Foraging's food code (BASKET_BLOCKS: 2 fruit, 3 Mushroom, 4 Egg) and the block's fruit, as a material key. */
export const foodKey = (code, fruit) => (code === 2 ? (fruit === 'Apple' ? 'food:apple' : 'food:orange') : code === 3 ? 'food:mushroom' : code === 4 ? 'food:egg' : null);
/** Marks value by tier (PROF0 4.8) - an herb's by its own rarity: common 1, uncommon 2, rare 5. */
export const TIER_VALUES = Object.freeze([1, 2, 4, 6, 9, 14, 40]);
export const HERB_VALUES = Object.freeze([1, 2, 5]);

/**
 * A material's standing: `{ key, family, tier, value, group?, templateIndex? }`, or null for a key the Stores never
 * hold. An herb's tier and value are its COMMONEST place's (nodeLaw herbTier): a plant common anywhere is a common
 * herb's worth everywhere - the one price a market can hold.
 * @param {string} key
 * @param {(templateIndex: number) => number|null} herbTier nodeLaw's herbTier
 */
export function materialOf(key, herbTier) {
  if (typeof key !== 'string') return null;
  const m = /^(p1|p2):(\d{1,3})$/.exec(key);
  if (m) {
    const templateIndex = Number(m[2]);
    if (!PLANT_GROUP_TEMPLATES[m[1]].includes(templateIndex)) return null;
    const tier = herbTier(templateIndex);
    if (!tier) return null;
    return { key, family: 'herbs', tier, value: HERB_VALUES[tier - 1], group: PLANT_GROUPS[m[1]], templateIndex };
  }
  if (FOOD_KEYS.includes(key)) return { key, family: 'food', tier: 1, value: TIER_VALUES[0] };
  return null;
}
/** Which profession gathers a material - a writ's XP goes to it. */
export const professionOfFamily = (family) => (family === 'herbs' || family === 'food' ? 'herbalism' : null);

// ─── COURT WRITS (PROF0 11) ──────────────────────────────────────────

/** A region's Court writs a UTC day: 6 x max(1, ceil(active / 100)). */
export const courtWritCount = (active) => 6 * Math.max(1, Math.ceil(Math.max(0, Number(active) || 0) / 100));
/** Court writs an account fills a UTC day - the faucet's cap (MARKS_FAUCETS.writ). */
export const COURT_WRITS_PER_DAY = 3;
/** The units a writ of each tier asks, in tens (so the pay and the Renown are whole): [least, most]. */
export const WRIT_UNITS = Object.freeze({
  1: Object.freeze([20, 50]), 2: Object.freeze([10, 40]), 3: Object.freeze([10, 30]), 4: Object.freeze([10, 30]),
  5: Object.freeze([10, 20]), 6: Object.freeze([10, 20]), 7: Object.freeze([10, 10]),
});
/** A writ's pay: units x the material's Marks value x 1.2. */
export const writPay = (units, value) => (units * value * 6) / 5;
/** A writ's Renown XP: 25 x tier x units / 10. */
export const writRenown = (tier, units) => (25 * tier * units) / 10;
/** The weights the day's ordinary writs draw their tier by (the nodes' 40 / 25 / 15 / 10 over tiers 1-4). */
export const WRIT_TIER_WEIGHTS = Object.freeze([40, 25, 15, 10]);
