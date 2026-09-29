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
/** `later`: the slice the choice waits for - named on its card, never chosen until then (AUDIT 29 A17). */
const spec = (id, name, text, later = null) => Object.freeze(later ? { id, name, text, later } : { id, name, text });
const pair = (a, b) => Object.freeze([a, b]);
/** Every profession's two choices at 50 and at 100 - the record's words. PROF1 gives Herbalism's their effect; the
 *  others take effect with their professions' slices (a track there holds no XP until then). */
export const SPECIALISATIONS = Object.freeze({
  mining: Object.freeze({
    50: pair(spec('prospector', 'Prospector', 'Surface veins within 200 m are marked on the compass; gems come a tenth more often.'),
      spec('deep-delver', 'Deep Delver', 'Dungeon veins yield +50%.')),
    100: pair(spec('motherlode-sense', 'Motherlode Sense', 'Motherlode warnings come 30 minutes ahead, not 10.', 'PROF2b'),
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
export const specOk = (profession, rank, specId) => !!SPECIALISATIONS[profession]?.[rank]?.some((s) => s.id === specId && !s.later);
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
/** AUDIT 29 A3: and an account a UTC day, a profession - two characters' days. A character is an id the client names,
 *  so the character's sixty alone bounded nothing: invented ids filled a day each. */
export const HARVESTS_PER_ACCOUNT_DAY = 2 * HARVESTS_PER_DAY;
/** AUDIT 29 A5: the veins an account may work a UTC day in dungeons nobody has vouched for - one dungeon's most. A
 *  dungeon's id is the client's word, and an unconfirmed dungeon's least (Silver, tier 3, at any hour) was worth more
 *  than any unconfirmed pixel; a confirmed dungeon is bounded by the day's sixty alone. */
export const DEEP_UNCONFIRMED_PER_DAY = 4;
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

// ─── THE MATERIALS PROF2 STORES (PROF0 4.1, 4.5, 4.6, 4.8, 23) ────────

/**
 * @typedef {{ key: string, family: string, tier: number, templateIndex: number, group?: string, name?: string,
 *   icon?: readonly number[]|null, dye?: string|null }} MinedRow a mined (or smelted) material's row - or a stock's (PROF3)
 */
/** A DFU item's material row: its key, family, tier, DFU group and template. @returns {MinedRow} */
const dfu = (key, family, tier, group, templateIndex) => Object.freeze({ key, family, tier, group, templateIndex });
/** A new template's (600-699, PROF0 4.8): its key, family, tier and template - DFU's picture it borrows, and the DFU
 *  dye that recolours it (systems/itemDye.js; `dye` a DYE_COLORS name, over the WeaponsAndArmor swatch, or null). A
 *  silver one is DFU's Silver - Unchanged, as a silver blade is (dyes.js). @returns {MinedRow} */
const made = (key, family, tier, templateIndex, name, icon, dye) => Object.freeze({ key, family, tier, templateIndex, name, icon, dye });

/** DFU's metals (MetalIngredients, itemTemplatesData.js) at PROF0 4.1's tiers: Iron, Tin, Copper, Lead, Sulphur 1;
 *  Lodestone, Mercury 2; Silver 3; Gold 4; Platinum 5 - and Brass, smelted from Copper and Tin, 2. */
export const METALS = Object.freeze([
  dfu('metal:iron', 'metals', 1, 'MetalIngredients', 71), dfu('metal:tin', 'metals', 1, 'MetalIngredients', 66),
  dfu('metal:copper', 'metals', 1, 'MetalIngredients', 72), dfu('metal:lead', 'metals', 1, 'MetalIngredients', 70),
  dfu('metal:sulphur', 'metals', 1, 'MetalIngredients', 69), dfu('metal:lodestone', 'metals', 2, 'MetalIngredients', 68),
  dfu('metal:mercury', 'metals', 2, 'MetalIngredients', 65), dfu('metal:silver', 'metals', 3, 'MetalIngredients', 73),
  dfu('metal:gold', 'metals', 4, 'MetalIngredients', 74), dfu('metal:platinum', 'metals', 5, 'MetalIngredients', 75),
  dfu('metal:brass', 'metals', 2, 'MetalIngredients', 67),
]);
/** DFU's pictures the new templates borrow (TEXTURE.254): Lodestone's lump, Iron's bar. */
export const ICON_LODESTONE = Object.freeze([254, 66]);
export const ICON_IRON = Object.freeze([254, 63]);
/** The new ores (610-615): Moonstone 4, Dwarven Scrap 4, Mithril 5, Adamantium 6, Ebony 6, Orichalcum 6. */
export const ORES = Object.freeze([
  made('ore:moonstone', 'metals', 4, 610, 'Moonstone Ore', ICON_LODESTONE, 'Elven'),
  made('ore:dwarven', 'metals', 4, 611, 'Dwarven Scrap', ICON_LODESTONE, 'Dwarven'),
  made('ore:mithril', 'metals', 5, 612, 'Mithril Ore', ICON_LODESTONE, 'Mithril'),
  made('ore:adamantium', 'metals', 6, 613, 'Adamantium Ore', ICON_LODESTONE, 'Adamantium'),
  made('ore:ebony', 'metals', 6, 614, 'Ebony Ore', ICON_LODESTONE, 'Ebony'),
  made('ore:orichalcum', 'metals', 6, 615, 'Orichalcum Ore', ICON_LODESTONE, 'Orcish'),
]);
/** The ingots (620-630), each its DFU material's tier and dye. Daedric (7) and Warforged Steel (6: counts as Ebony
 *  with a step, a Siege Honour's) are registered with the rest; nothing in PROF2 makes them. */
export const INGOTS = Object.freeze([
  made('ingot:iron', 'metals', 1, 620, 'Iron Ingot', ICON_IRON, 'Iron'),
  made('ingot:steel', 'metals', 2, 621, 'Steel Ingot', ICON_IRON, 'Steel'),
  made('ingot:silver', 'metals', 3, 622, 'Silver Ingot', ICON_IRON, 'Silver'),
  made('ingot:moonstone', 'metals', 4, 623, 'Moonstone Ingot', ICON_IRON, 'Elven'),
  made('ingot:dwarven', 'metals', 4, 624, 'Dwarven Ingot', ICON_IRON, 'Dwarven'),
  made('ingot:mithril', 'metals', 5, 625, 'Mithril Ingot', ICON_IRON, 'Mithril'),
  made('ingot:adamantium', 'metals', 6, 626, 'Adamantium Ingot', ICON_IRON, 'Adamantium'),
  made('ingot:ebony', 'metals', 6, 627, 'Ebony Ingot', ICON_IRON, 'Ebony'),
  made('ingot:orichalcum', 'metals', 6, 628, 'Orichalcum Ingot', ICON_IRON, 'Orcish'),
  made('ingot:daedric', 'metals', 7, 629, 'Daedric Ingot', ICON_IRON, 'Daedric'),
  made('ingot:warforged', 'metals', 6, 630, 'Warforged Steel Ingot', ICON_IRON, 'Steel'),
]);
/** Stone (PROF0 4.5): Rough Stone quarried, tier 1; Cut Stone cut from it 2 : 1, tier 2. Lodestone's grey lump as it
 *  is - FACT, DFU's Grey is a clothing dye (dyes.js CLOTHING_STARTS), and no metal's swatch is a stone's. */
export const STONES = Object.freeze([
  made('stone:rough', 'stone', 1, 673, 'Rough Stone', ICON_LODESTONE, null),
  made('stone:cut', 'stone', 2, 674, 'Cut Stone', ICON_LODESTONE, null),
]);
/** A gem's tier by its DFU price's band (PROF0 23): to 10 gold 2, to 50 3, to 100 4, to 250 5, past it 6. */
export const gemTierOfPrice = (price) => (price <= 10 ? 2 : price <= 50 ? 3 : price <= 100 ? 4 : price <= 250 ? 5 : 6);
/** DFU's eight gems (Gems, itemTemplatesData.js), each at its price's tier (Ruby 250, Emerald 425, Sapphire 375,
 *  Diamond 500, Jade 10, Turquoise 50, Malachite 25, Amber 100 - itemTemplates.json). Pearl comes with Fishing. */
export const GEMS = Object.freeze([
  dfu('gem:ruby', 'gems', gemTierOfPrice(250), 'Gems', 0), dfu('gem:emerald', 'gems', gemTierOfPrice(425), 'Gems', 1),
  dfu('gem:sapphire', 'gems', gemTierOfPrice(375), 'Gems', 2), dfu('gem:diamond', 'gems', gemTierOfPrice(500), 'Gems', 3),
  dfu('gem:jade', 'gems', gemTierOfPrice(10), 'Gems', 4), dfu('gem:turquoise', 'gems', gemTierOfPrice(50), 'Gems', 5),
  dfu('gem:malachite', 'gems', gemTierOfPrice(25), 'Gems', 6), dfu('gem:amber', 'gems', gemTierOfPrice(100), 'Gems', 7),
]);
/** Charcoal (PROF0 4.2): Logging's, tier 1 - the Steel recipe names it; the smith's stock sells it (PROF3). */
export const CHARCOAL = made('wood:charcoal', 'wood', 1, 652, 'Charcoal', ICON_LODESTONE, null);
/** Every new template PROF2 registers, by template. */
export const MINING_TEMPLATES = Object.freeze([...ORES, ...INGOTS, ...STONES]);

// ─── THE SMITH'S STOCK (PROF0 24) ────────────────────────────────────

/** PROF3: the fittings Smithing's recipes ask (PROF0 9.3) that no profession yields yet - Hunting's Cured Leather
 *  (665: 4.4's cure of tier 1-3 hides, their middle, tier 2) and Logging's Oak and Pine Planks (646 tier 2, 645 tier
 *  1) and Charcoal. The smith's forge sells them into the Stores for Marks: a counter's goods (4.5), bought, never own. */
export const CURED_LEATHER = made('leather:cured', 'hides', 2, 665, 'Cured Leather', null, null);
export const OAK_PLANK = made('plank:oak', 'wood', 2, 646, 'Oak Plank', null, null);
export const PINE_PLANK = made('plank:pine', 'wood', 1, 645, 'Pine Plank', null, null);
/** The smith's price, a unit: twice the material's Marks value (4.8) - a gatherer's own undersells it once the
 *  professions that yield it come (PROF4, PROF7). In the stock window's order. */
export const SMITH_STOCK = Object.freeze([CURED_LEATHER, OAK_PLANK, PINE_PLANK, CHARCOAL]
  .map((m) => Object.freeze({ key: m.key, marks: 2 * TIER_VALUES[m.tier - 1] })));
export const stockOf = (key) => SMITH_STOCK.find((s) => s.key === key) ?? null;
/** Units a purchase, at most. */
export const STOCK_MAX = 100;
/** Whether the Stores may give a material to the pack: not the stock's four, whose templates their own professions
 *  register (FACT: none of 645, 646, 652, 665 is a template before PROF4 and PROF7). */
export const withdrawable = (key) => !stockOf(key);
const MINED = new Map([...METALS, ...ORES, ...INGOTS, ...STONES, ...GEMS, CHARCOAL, CURED_LEATHER, OAK_PLANK, PINE_PLANK].map((m) => [m.key, m]));
/** A mined (or smelted) material's row, or null. */
export const minedMaterial = (key) => MINED.get(key) ?? null;

/**
 * A material's standing: `{ key, family, tier, value, group?, templateIndex? }`, or null for a key the Stores never
 * hold. An herb's tier and value are its COMMONEST place's (nodeLaw herbTier): a plant common anywhere is a common
 * herb's worth everywhere - the one price a market can hold. A metal, ore, ingot, stone or gem is its row's.
 * @param {string} key
 * @param {(templateIndex: number) => number|null} herbTier nodeLaw's herbTier
 * @returns {{ key: string, family: string, tier: number, value: number, group?: string, templateIndex?: number }|null}
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
  const r = MINED.get(key);
  if (r) return { key, family: r.family, tier: r.tier, value: TIER_VALUES[r.tier - 1], ...(r.group ? { group: r.group } : {}), templateIndex: r.templateIndex };
  return null;
}
/** Which profession gathers a material - a writ's XP goes to it. */
export const professionOfFamily = (family) => (family === 'herbs' || family === 'food' ? 'herbalism'
  : family === 'metals' || family === 'stone' || family === 'gems' ? 'mining' : null);

// ─── MINING'S ACT (PROF0 5.2, 23; FORAGE0 14.4) ──────────────────────

/** The strikes a node takes by its tier: 4 (1-2), 5 (3-4), 7 (5-6). */
export const strikesFor = (tier) => (tier <= 2 ? 4 : tier <= 4 ? 5 : 7);
/** The glint: five points, one glinting `glintS` (`masterGlintS` at Master) x the Pick-Axe's band, a strike within
 *  `radiusDeg` of it counting double; one strike a `swingS`. The points' box: `spreadYawDeg` x `spreadPitchDeg` about
 *  the node's centre. */
export const MINE_ACT = Object.freeze({ points: 5, glintS: 1.2, masterGlintS: 2.0, radiusDeg: 2.5, swingS: 0.45, spreadYawDeg: 7, spreadPitchDeg: 4 });
/** The most strikes a finish can hold on the glint - every one of them, each counting two. */
export const glintsMax = (tier) => Math.ceil(strikesFor(tier) / 2);
/** A gem: 3% a strike on the glint (a Prospector's x1.1), on a confirmed pixel or dungeon only. */
export const GEM_CHANCE = 0.03;
export const PROSPECTOR_GEM = 1.1;
/** Deep Delver's dungeon veins, x1.5. */
export const DEEP_DELVER_MULT = 1.5;
/** Rough Stone cut at the rock: two make one (PROF0 4.5; Quarryman's 1 : 1 is the bench's, not the rock's). */
export const CUT_RATIO = 2;
/** The Pick-Axe's attribute pair (FORAGE0 14.4): (INT + AGI) / 2 - Foraging's average, the IL's Agility. */
export const pickAxeBand = ({ intelligence, agility }) => actBand(Math.trunc((intelligence + agility) / 2));

// ─── SMELTING (PROF0 4.1, 23) ────────────────────────────────────────

/** A smelt, most units a request. */
export const SMELT_MAX = 100;
/** The use fee a Weaponsmith's or Armorer's forge asks, a smelt (gold, the purse's). */
export const FORGE_FEE = 50;
const recipe = (id, out, inputs) => Object.freeze({ id, out, inputs: Object.freeze(inputs.map(([key, n]) => Object.freeze({ key, n }))) });
/** The forge's recipes, in the window's order: two of a raw metal an ingot; Steel an Iron Ingot and a Charcoal; Brass
 *  a Copper and a Tin. Daedric waits on its heart and its stone (PROF0 23). */
export const SMELT_RECIPES = Object.freeze([
  recipe('ingot:iron', 'ingot:iron', [['metal:iron', 2]]),
  recipe('ingot:steel', 'ingot:steel', [['ingot:iron', 1], ['wood:charcoal', 1]]),
  recipe('ingot:silver', 'ingot:silver', [['metal:silver', 2]]),
  recipe('metal:brass', 'metal:brass', [['metal:copper', 1], ['metal:tin', 1]]),
  recipe('ingot:moonstone', 'ingot:moonstone', [['ore:moonstone', 2]]),
  recipe('ingot:dwarven', 'ingot:dwarven', [['ore:dwarven', 2]]),
  recipe('ingot:mithril', 'ingot:mithril', [['ore:mithril', 2]]),
  recipe('ingot:adamantium', 'ingot:adamantium', [['ore:adamantium', 2]]),
  recipe('ingot:ebony', 'ingot:ebony', [['ore:ebony', 2]]),
  recipe('ingot:orichalcum', 'ingot:orichalcum', [['ore:orichalcum', 2]]),
]);
export const smeltRecipe = (id) => SMELT_RECIPES.find((r) => r.id === id) ?? null;
/** Smithing XP a smelt: 10 x its tier a unit (PROF0 4.1) - a quarter for a recipe more than two tiers below the smith's
 *  rank's top (3.2's "a node or recipe"; AUDIT 29 A7: a Master smelting Iron took it whole). */
export function smeltXp(tier, units, rank = 0) {
  const xp = 10 * tier * units;
  return tier < topTierOf(rank) - 2 ? Math.floor(xp / 4) : xp;
}
/**
 * THE ORIGIN OF A SMELT'S UNITS (PROF0 7, 23): `count` products, each input spent bought-first (`bought[i]` the
 * bought units of input i the Stores hold). Product j takes input i's units j*n_i .. (j+1)*n_i - 1 in that order, so
 * it is bought when any of them is: the bought products are the most any input's bought units reach.
 * @returns {{ own: number, bought: number }}
 */
export function smeltOrigin(r, count, bought) {
  let b = 0;
  r.inputs.forEach((inp, i) => { b = Math.max(b, Math.ceil(Math.min(Math.max(0, bought[i] ?? 0), inp.n * count) / inp.n)); });
  b = Math.min(count, b);
  return { own: count - b, bought: b };
}
/** THE CRAFTER'S LIMIT (PROF0 3.2): a character raises at most two crafts past Journeyman. A craft that is not one of
 *  them while two others are stops at rank 50 - the XP one short of rank 51. `ranks` every crafting track's rank. */
export function craftXpCap(profession, ranks) {
  const past = Object.entries(ranks ?? {}).filter(([p, r]) => p !== profession && BY_ID.get(p)?.kind === 'crafting' && r > JOURNEYMAN_RANK).length;
  return past >= CRAFTS_ABOVE_JOURNEYMAN ? xpForRank(JOURNEYMAN_RANK + 1) - 1 : PROF_XP_MAX;
}

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
