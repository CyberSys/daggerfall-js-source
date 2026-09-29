// @ts-check
// PROF3 (2026-09-28, Mac: "Lets keep moving") - THE RECIPE LAW: Smithing's recipes, the quality they are made at, the
// XP they give and the heat they are struck in. Design: bible/06-Systems/Professions-Arc.md 9.1-9.4 (the record) and
// 24 (PROF3 as built); the name is section 14's ("recipeLaw.js (to be written, with PROF3)"). PROF4 (2026-09-28, Mac:
// "Continue"; section 25): Carpentry's recipes beside them - the staves, bows, arrows, furniture, the Basket and the
// Ram Kit - and the plane they are drawn with; a recipe names its profession.
//
// PURE, and both ends import it: the account service decides a craft by it (server-account/src/professions.js
// craftAtAnvil), the client draws the anvil by it (ui/profPages.js) and mints the piece by it (systems/smithItems.js).
//
// THE PIECE IS DFU'S. A recipe names a DFU template and a DFU material (ItemEnums.cs WeaponMaterialTypes; armour's
// ArmorMaterialTypes - plate 0x0200 + the metal, chain 0x0100); the item is minted by DFU's own law and the quality
// laid on it after. Not a DFU member: DFU crafts nothing. Ledger A (the professions' row).
import { INGOTS, TIER_RANKS, topTierOf, actBand, minedMaterial, WOODS, PINE_PLANK, RESIN, HEARTWOOD, LINEN, BEAR_HIDE } from './professionLaw.js';

// ─── THE METALS (PROF0 4.1) ──────────────────────────────────────────

/** The DFU material each ingot makes (WeaponMaterialTypes: Iron 0, Steel 1, Silver 2, Elven 3, Dwarven 4, Mithril 5,
 *  Adamantium 6, Ebony 7, Orcish 8, Daedric 9). Warforged Steel counts as Ebony, with a step (PROF0 4.7). */
export const INGOT_MATERIAL = Object.freeze({
  'ingot:iron': 0, 'ingot:steel': 1, 'ingot:silver': 2, 'ingot:moonstone': 3, 'ingot:dwarven': 4, 'ingot:mithril': 5,
  'ingot:adamantium': 6, 'ingot:ebony': 7, 'ingot:orichalcum': 8, 'ingot:daedric': 9, 'ingot:warforged': 7,
});
/** DFU's material names (itemInfo.js MATERIAL_NAMES), by material - the recipe's word for its metal. */
const METAL_WORDS = Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']);
/** The ingot a Warforged piece is made from counts a quality step (PROF0 4.7, 9.2). */
export const WARFORGED = 'ingot:warforged';
/** DFU's armour materials (ItemEnums.cs ArmorMaterialTypes): chain, and plate above the metal. */
export const ARMOR_CHAIN = 0x0100;
export const ARMOR_PLATE = 0x0200;

// ─── THE PRODUCTS (PROF0 9.3) ────────────────────────────────────────

const TIN = 'metal:tin', COPPER = 'metal:copper', LEATHER = 'leather:cured', OAK = 'plank:oak', PINE = 'plank:pine';
/**
 * @typedef {{ id: string, name: string, kind: 'weapon'|'plate'|'shield'|'chain'|'tool'|'kit', templateIndex: number,
 *   ingots: number, also: readonly (readonly [string, number])[] }} Product
 */
/** @returns {Product} */
const product = (id, name, kind, templateIndex, ingots, also = []) => Object.freeze({ id, name, kind, templateIndex, ingots, also: Object.freeze(also.map((a) => Object.freeze(a))) });
/** The weapons (DFU 113-128 but the Staff, a carpenter's): the ingots and the fittings 9.3 asks. */
export const WEAPON_PRODUCTS = Object.freeze([
  product('dagger', 'Dagger', 'weapon', 113, 1, [[TIN, 1]]), product('tanto', 'Tanto', 'weapon', 114, 1, [[TIN, 1]]),
  product('shortsword', 'Shortsword', 'weapon', 116, 2, [[TIN, 1]]), product('wakizashi', 'Wakizashi', 'weapon', 117, 2, [[TIN, 1]]),
  product('broadsword', 'Broadsword', 'weapon', 118, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('saber', 'Saber', 'weapon', 119, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('longsword', 'Longsword', 'weapon', 120, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('katana', 'Katana', 'weapon', 121, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('mace', 'Mace', 'weapon', 124, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('flail', 'Flail', 'weapon', 125, 3, [[COPPER, 1], [LEATHER, 1]]),
  product('warhammer', 'Warhammer', 'weapon', 126, 4, [[COPPER, 1], [OAK, 1]]),
  product('battleaxe', 'Battle Axe', 'weapon', 127, 4, [[COPPER, 1], [OAK, 1]]),
  product('waraxe', 'War Axe', 'weapon', 128, 4, [[COPPER, 1], [OAK, 1]]),
  product('claymore', 'Claymore', 'weapon', 122, 5, [[COPPER, 1], [LEATHER, 1]]),
  product('daikatana', 'Dai-katana', 'weapon', 123, 5, [[COPPER, 1], [LEATHER, 1]]),
]);
/** The plate (DFU 102-108): Cuirass 6 and 2 Cured Leather, Greaves 4, Helm 2, the pauldrons, Gauntlets and Boots 2. */
export const PLATE = Object.freeze([
  product('cuirass', 'Cuirass', 'plate', 102, 6, [[LEATHER, 2]]), product('greaves', 'Greaves', 'plate', 104, 4, [[LEATHER, 1]]),
  product('helm', 'Helm', 'plate', 107, 2, [[LEATHER, 1]]), product('lpauldron', 'Left Pauldron', 'plate', 105, 2, [[LEATHER, 1]]),
  product('rpauldron', 'Right Pauldron', 'plate', 106, 2, [[LEATHER, 1]]), product('gauntlets', 'Gauntlets', 'plate', 103, 2, [[LEATHER, 1]]),
  product('boots', 'Boots', 'plate', 108, 2, [[LEATHER, 1]]),
]);
/** The shields (DFU 109-112): the Buckler 3 and Cured Leather; Round, Kite and Tower 3, 4 and 5 and an Oak Plank. */
export const SHIELDS = Object.freeze([
  product('buckler', 'Buckler', 'shield', 109, 3, [[LEATHER, 1]]), product('roundshield', 'Round Shield', 'shield', 110, 3, [[OAK, 1]]),
  product('kiteshield', 'Kite Shield', 'shield', 111, 4, [[OAK, 1]]), product('towershield', 'Tower Shield', 'shield', 112, 5, [[OAK, 1]]),
]);
/** The chain (the plate's seven - DFU has no chain shield): the plate piece's ingots x 0.75 rounded up, nothing else. */
export const CHAIN = Object.freeze(PLATE.map((p) => product(`chain-${p.id}`, p.name, 'chain', p.templateIndex, Math.ceil(p.ingots * 0.75))));
/** Foraging's tools (FORAGE0 14.7), at Iron: their templates are Foraging's own (foragingLaw.js FT). */
export const TOOLS = Object.freeze([
  product('woodaxe', 'Wood-Axe', 'tool', 1600, 2, [[PINE, 1]]), product('pickaxe', 'Pick-Axe', 'tool', 1601, 2, [[PINE, 1]]),
  product('sickle', 'Sickle', 'tool', 1602, 1, [[PINE, 1]]), product('spade', 'Spade', 'tool', 1606, 2, [[OAK, 1]]),
]);
/** A tool's tier: the Spade's rank 10 (FORAGE0 14.7) is tier 2's; the rest tier 1. */
const TOOL_TIER = Object.freeze({ spade: 2 });
/** The Repair Kit (PROF0 4.8's 692): one of its metal's ingots and a Cured Leather. */
export const KIT_PRODUCT = product('kit', 'Repair Kit', 'kit', 692, 1, [[LEATHER, 1]]);
export const REPAIR_KIT_TEMPLATE = 692;
/** What a kit gives back (PROF0 9.3): a quarter of an item's condition, once. */
export const KIT_REPAIR = 0.25;

/** The metals a recipe is made in: every ingot but the Daedric's and the Warforged's for the tools (Iron alone). */
const SMITH_INGOTS = Object.freeze(INGOTS.map((i) => i.key));
const KIT_INGOTS = Object.freeze(SMITH_INGOTS.filter((k) => k !== WARFORGED));

/**
 * @typedef {{ id: string, product: string, name: string, kind: string, family: string, profession: 'smithing'|'carpentry',
 *   templateIndex: number, metal: string|null, wood?: string|null, material: number, tier: number, rank: number,
 *   stack?: number, later?: string, inputs: readonly { key: string, n: number }[] }} Recipe
 */
const FAMILY = Object.freeze({ weapon: 'weapons', plate: 'armour', shield: 'armour', chain: 'armour', tool: 'tools', kit: 'kits' });
/** @returns {Recipe} */
function recipeOf(p, metal) {
  const m = INGOT_MATERIAL[metal];
  const tier = p.kind === 'tool' ? (TOOL_TIER[p.id] ?? 1) : minedMaterial(metal).tier;
  const material = p.kind === 'plate' || p.kind === 'shield' ? ARMOR_PLATE + m : p.kind === 'chain' ? ARMOR_CHAIN : p.kind === 'weapon' ? m : 0;
  const name = p.kind === 'chain' ? `Chain ${p.name}` : p.kind === 'tool' ? p.name : `${metal === WARFORGED ? 'Warforged' : METAL_WORDS[m]} ${p.name}`;
  return Object.freeze({
    id: `${p.id}:${metal.slice('ingot:'.length)}`, product: p.id, name, kind: p.kind, family: FAMILY[p.kind], profession: 'smithing',
    templateIndex: p.templateIndex, metal, material, tier, rank: TIER_RANKS[tier - 1],
    inputs: Object.freeze([Object.freeze({ key: metal, n: p.ingots }), ...p.also.map(([key, n]) => Object.freeze({ key, n }))]),
  });
}
/** EVERY RECIPE the anvil knows, in its window's order: the weapons, the plate, the shields at every metal; the chain
 *  at Steel; the tools at Iron; the kits at every metal. */
export const SMITH_RECIPES = Object.freeze([
  ...[...WEAPON_PRODUCTS, ...PLATE, ...SHIELDS].flatMap((p) => SMITH_INGOTS.map((metal) => recipeOf(p, metal))),
  ...CHAIN.map((p) => recipeOf(p, 'ingot:steel')),
  ...TOOLS.map((p) => recipeOf(p, 'ingot:iron')),
  ...KIT_INGOTS.map((metal) => recipeOf(KIT_PRODUCT, metal)),
]);

// ─── CARPENTRY (PROF0 9.3, 25) ───────────────────────────────────────

/** A staff's or bow's DFU material is its wood's tier's (9.3): Pine Iron, Oak Steel, Cherry Silver, Teak Elven,
 *  Mahogany Mithril; the two tier-6 woods split between the tier's metals - Ironwood Adamantium, Ghostwood Ebony. */
export const WOOD_MATERIAL = Object.freeze({ pine: 0, oak: 1, cherry: 2, teak: 3, mahogany: 5, ironwood: 6, ghostwood: 7 });
/** DFU's weapons Carpentry makes: the Staff (115), the Short Bow (129), the Long Bow (130), the Arrow (131). */
export const STAFF_TEMPLATE = 115, SHORT_BOW_TEMPLATE = 129, LONG_BOW_TEMPLATE = 130, ARROWS_TEMPLATE = 131;
/** Arrows a craft makes - one stack, DFU's own most (CreateWeapon's arrow arm rolls 1-20). */
export const ARROWS_STACK = 20;
/** DFU's Twigs (a plant of both lands - PlantIngredients1 and 2, template 8), as the Stores keep it twice. */
export const TWIGS_NORTH = 'p1:8', TWIGS_SOUTH = 'p2:8';
/** The Ram Kit (PROF0 4.8's 690) - a siege work, rank 60 (9.3). */
export const RAM_KIT_TEMPLATE = 690;
export const RAM_KIT_RANK = 60;
const woodName = (id) => WOODS.find((w) => w.id === id)?.name ?? id;
const woodTier = (id) => WOODS.find((w) => w.id === id)?.tier ?? 1;
/** @returns {Recipe} */
function carpentry({ id, name, kind, family, templateIndex, wood = null, tier = wood ? woodTier(wood) : 1, rank = TIER_RANKS[tier - 1], material = 0, inputs, stack = 0, later = null }) {
  return Object.freeze({
    id, product: id.slice(0, id.indexOf(':')), name, kind, family, profession: 'carpentry', templateIndex, metal: null,
    wood: wood ? `plank:${wood}` : null, material, tier, rank, ...(stack ? { stack } : {}), ...(later ? { later } : {}),
    inputs: Object.freeze(inputs.map(([key, n]) => Object.freeze({ key, n }))),
  });
}
const plank = (w) => `plank:${w}`;
/** The four woods of DFU's furniture (templates 221-232: Oak, Cherry, Mahogany, Teak, each at its offset). */
/** @type {ReadonlyArray<[string, number]>} */
const FURNITURE_WOODS = Object.freeze([['oak', 0], ['cherry', 1], ['mahogany', 2], ['teak', 3]]);
/** DFU's four beds by their rarity column (1 Plain Single, 2 Plain Double, 3 Fancy Single, 4 Fancy Double) - each the
 *  wood of that tier (PROF0 25): FOUND, a bed names no wood. */
/** @type {ReadonlyArray<[string, string, number, string]>} */
const BEDS = Object.freeze([
  ['bed-plain-single', 'Plain Single Bed', 217, 'pine'], ['bed-plain-double', 'Plain Double Bed', 219, 'oak'],
  ['bed-fancy-single', 'Fancy Single Bed', 218, 'cherry'], ['bed-fancy-double', 'Fancy Double Bed', 220, 'teak'],
]);
/** EVERY RECIPE the workbench knows, in its window's order: the staves and bows at every wood; the arrows (the northern
 *  Twigs' and the southern's); the furniture; the Basket; the Ram Kit (named, never made in PROF4 - PROF0 25). */
export const CARPENTRY_RECIPES = Object.freeze([
  ...WOODS.map((w) => carpentry({ id: `staff:${w.id}`, name: `${w.name} Staff`, kind: 'staff', family: 'staves', templateIndex: STAFF_TEMPLATE, wood: w.id, material: WOOD_MATERIAL[w.id], inputs: [[plank(w.id), 3]] })),
  ...WOODS.map((w) => carpentry({ id: `shortbow:${w.id}`, name: `${w.name} Short Bow`, kind: 'bow', family: 'bows', templateIndex: SHORT_BOW_TEMPLATE, wood: w.id, material: WOOD_MATERIAL[w.id], inputs: [[plank(w.id), 3], [RESIN.key, 1]] })),
  ...WOODS.map((w) => carpentry({ id: `longbow:${w.id}`, name: `${w.name} Long Bow`, kind: 'bow', family: 'bows', templateIndex: LONG_BOW_TEMPLATE, wood: w.id, material: WOOD_MATERIAL[w.id], inputs: [[plank(w.id), 4], [RESIN.key, 1]] })),
  carpentry({ id: 'arrows:north', name: 'Arrows (northern Twigs)', kind: 'arrows', family: 'arrows', templateIndex: ARROWS_TEMPLATE, wood: 'pine', stack: ARROWS_STACK, inputs: [[PINE_PLANK.key, 1], ['ingot:iron', 1], [TWIGS_NORTH, 4]] }),
  carpentry({ id: 'arrows:south', name: 'Arrows (southern Twigs)', kind: 'arrows', family: 'arrows', templateIndex: ARROWS_TEMPLATE, wood: 'pine', stack: ARROWS_STACK, inputs: [[PINE_PLANK.key, 1], ['ingot:iron', 1], [TWIGS_SOUTH, 4]] }),
  ...FURNITURE_WOODS.map(([w, i]) => carpentry({ id: `table-large:${w}`, name: `Large ${woodName(w)} Table`, kind: 'furniture', family: 'furniture', templateIndex: 221 + i, wood: w, inputs: [[plank(w), 6]] })),
  ...FURNITURE_WOODS.map(([w, i]) => carpentry({ id: `table-small:${w}`, name: `Small ${woodName(w)} Table`, kind: 'furniture', family: 'furniture', templateIndex: 225 + i, wood: w, inputs: [[plank(w), 3]] })),
  ...FURNITURE_WOODS.map(([w, i]) => carpentry({ id: `chair:${w}`, name: `${woodName(w)} Chair`, kind: 'furniture', family: 'furniture', templateIndex: 229 + i, wood: w, inputs: [[plank(w), 2]] })),
  ...BEDS.map(([p, name, t, w]) => carpentry({ id: `${p}:${w}`, name, kind: 'furniture', family: 'furniture', templateIndex: t, wood: w, inputs: [[plank(w), 8], [LINEN.key, 2]] })),
  carpentry({ id: 'basket:pine', name: 'Basket', kind: 'tool', family: 'tools', templateIndex: 1607, wood: 'pine', inputs: [[PINE_PLANK.key, 2]] }),
  carpentry({ id: 'ramkit:oak', name: 'Ram Kit', kind: 'siege', family: 'siege', templateIndex: RAM_KIT_TEMPLATE, wood: 'oak', tier: 5, rank: RAM_KIT_RANK, later: 'sieges', inputs: [[plank('oak'), 40], ['ingot:iron', 20], [BEAR_HIDE.key, 4]] }),
]);
/** Every recipe, the anvil's and the workbench's. */
export const RECIPES = Object.freeze([...SMITH_RECIPES, ...CARPENTRY_RECIPES]);
const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
/** A recipe by its id (`longsword:mithril`, `chain-cuirass:steel`, `kit:iron`, `table-small:oak`), or null. */
export const recipeById = (id) => (typeof id === 'string' ? BY_ID.get(id) ?? null : null);
/** Every recipe unlocks by rank (the found ones come with the writs, PROF6); a recipe whose slice is to come (`later`)
 *  is named and never made. */
export const recipeOpen = (r, rank) => !!r && !r.later && rank >= r.rank;
/** Whether a recipe may take a Heartwood for one of its planks (PROF0 25): it asks a plank and takes a quality. */
export const takesHeartwood = (r) => !!r && takesQuality(r) && r.inputs.some((i) => i.key.startsWith('plank:'));
/**
 * WHAT A CRAFT SPENDS (PROF0 25): the recipe's inputs - a Joiner's furniture at half the planks, rounded up; a Heartwood
 * standing in for one plank where the recipe takes one. Both ends spend and show by this.
 * @param {Recipe} r @param {{ heartwood?: boolean, joiner?: boolean }} [opts]
 */
export function recipeInputs(r, { heartwood = false, joiner = false } = {}) {
  let inputs = r.inputs.map((i) => ({ key: i.key, n: joiner && r.family === 'furniture' && i.key.startsWith('plank:') ? Math.ceil(i.n / 2) : i.n }));
  if (heartwood && takesHeartwood(r)) {
    const p = /** @type {{ key: string, n: number }} */ (inputs.find((i) => i.key.startsWith('plank:')));
    p.n -= 1;
    inputs = [...inputs.filter((i) => i.n > 0), { key: HEARTWOOD.key, n: 1 }];
  }
  return inputs;
}

// ─── THE QUALITY (PROF0 9.2) ─────────────────────────────────────────

export const QUALITIES = Object.freeze(['crude', 'standard', 'fine', 'superior', 'masterwork']);
export const QUALITY_NAMES = Object.freeze(['Crude', 'Standard', 'Fine', 'Superior', 'Masterwork']);
export const MASTERWORK = 4;
/** The roll by the margin (the smith's rank minus the recipe's): each row's odds, Crude to Masterwork, of 100. */
export const QUALITY_ROWS = Object.freeze([
  Object.freeze({ upTo: 9, odds: Object.freeze([20, 60, 20, 0, 0]) }),
  Object.freeze({ upTo: 24, odds: Object.freeze([0, 50, 40, 10, 0]) }),
  Object.freeze({ upTo: 44, odds: Object.freeze([0, 20, 50, 28, 2]) }),
  Object.freeze({ upTo: Infinity, odds: Object.freeze([0, 0, 40, 52, 8]) }),
]);
/** Masterwright's points of Masterwork (3.3), taken off the row's lowest quality. */
export const MASTERWRIGHT_POINTS = 5;
/** The odds a margin rolls on, Masterwright's points laid in. */
export function qualityOdds(margin, { masterwright = false } = {}) {
  const odds = [...QUALITY_ROWS.find((r) => Math.max(0, margin) <= r.upTo).odds];
  if (masterwright) {
    let left = MASTERWRIGHT_POINTS;
    for (let q = 0; q < MASTERWORK && left > 0; q++) { const take = Math.min(left, odds[q]); odds[q] -= take; left -= take; }
    odds[MASTERWORK] += MASTERWRIGHT_POINTS - left;
  }
  return odds;
}
/** The quality a unit `u` in [0, 1) rolls on the odds. */
export function rollQuality(u, odds) {
  let at = u * 100;
  for (let q = 0; q < odds.length; q++) { if (at < odds[q]) return q; at -= odds[q]; }
  return odds.length - 1;
}
/** The steps a craft takes, each source at most one (PROF0 9.2): the clean act (the honest bound, 5.1), the family's
 *  specialisation (Weaponsmith the weapons, Armoursmith the plate, the chain and the shields; PROF4: Bowyer the bows),
 *  a Warforged ingot or a Heartwood - one step between them (9.2's "Heartwood or a Warforged ingot"). */
export function qualitySteps(r, { clean = false, spec50 = null, heartwood = false } = {}) {
  let steps = clean ? 1 : 0;
  if ((spec50 === 'weaponsmith' && r.family === 'weapons') || (spec50 === 'armoursmith' && r.family === 'armour')
    || (spec50 === 'bowyer' && r.family === 'bows')) steps++;
  if (r.metal === WARFORGED || (heartwood && takesHeartwood(r))) steps++;
  return steps;
}
/** The quality a craft is made at: the roll, then the steps; nothing past Masterwork. */
export const craftQuality = (rolled, steps) => Math.min(MASTERWORK, rolled + Math.max(0, steps));

/** What a quality does to the piece (PROF0 9.2): its condition's and its weight's multipliers, and its Loot Rarity
 *  roll; the maker's mark is Masterwork's. */
export const QUALITY_EFFECTS = Object.freeze([
  Object.freeze({ condition: 0.75, weight: 1, rarity: null }),
  Object.freeze({ condition: 1, weight: 1, rarity: null }),
  Object.freeze({ condition: 1.15, weight: 0.95, rarity: null }),
  Object.freeze({ condition: 1.3, weight: 0.9, rarity: 'magic' }),
  Object.freeze({ condition: 1.3, weight: 0.9, rarity: 'rare' }),
]);
/** A tool's life by its quality (FORAGE0 14.7): Crude 37 uses, Standard 50, Fine 57, Superior and Masterwork 65. */
export const TOOL_LIFE = Object.freeze([37, 50, 57, 65, 65]);
/** Whether a recipe's piece takes a quality at all: a Repair Kit does not (it is measured by its work); PROF4: nor
 *  arrows (DFU mints a quiver at condition 0 - nothing for a quality to act on) nor the Ram Kit (a siege work). */
export const takesQuality = (r) => r.kind !== 'kit' && r.kind !== 'arrows' && r.kind !== 'siege';
/** PROF4: a Master Joiner's furniture carries the maker's mark at any quality (PROF0 3.3); a Masterwork always does. */
export const carriesMark = (r, quality, spec100 = null) => quality === MASTERWORK || (r?.family === 'furniture' && spec100 === 'master-joiner');

// ─── THE XP AND THE COUNT (PROF0 3.2, 3.3) ───────────────────────────

export const CRAFT_XP_PER_TIER = 20;
export const FIRST_CRAFT_XP = 500;
/** A craft's XP (Smithing's or Carpentry's): 20 x its tier - a quarter for a recipe more than two tiers below the rank's top - and 500 the
 *  first time the character makes it. */
export function craftXp(tier, rank, first) {
  const xp = CRAFT_XP_PER_TIER * tier;
  return (tier < topTierOf(rank) - 2 ? Math.floor(xp / 4) : xp) + (first ? FIRST_CRAFT_XP : 0);
}
/** The pieces a craft makes: one, a Quartermaster's kit two (3.3). */
export const craftCount = (r, spec100) => (r.kind === 'kit' && spec100 === 'quartermaster' ? 2 : 1);

// ─── THE HEAT (PROF0 9.4) ────────────────────────────────────────────

/**
 * The ingot's glow rises and falls, `periodS` a breath; three strikes, each at least `gapS` after the last, and a strike
 * while the glow stands in the band - from `bandLo`, `bandW` wide x the attribute band - is a hit. Three hits are a
 * clean act.
 */
export const HEAT_ACT = Object.freeze({ strikes: 3, periodS: 2.0, bandLo: 0.62, bandW: 0.2, gapS: 0.35 });
/** Smithing's attribute pair (PROF0 24): (STR + AGI) / 2, on Foraging's four bands. */
export const heatBand = ({ strength, agility }) => actBand(Math.trunc((strength + agility) / 2));
/** The glow at `t` seconds into the act, 0 cold to 1 white: it starts cold and breathes. */
export const glowAt = (t) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / HEAT_ACT.periodS);
/** The band a heat act is struck in: [lo, hi], never past white. */
export function heatWindow(band = 1) {
  const w = HEAT_ACT.bandW * band;
  const hi = Math.min(1, HEAT_ACT.bandLo + w);
  return [hi - w, hi];
}

// ─── THE MAKER'S MARK AND THE PROVENANCE (PROF0 9.1, 9.2) ────────────

/** A provenance id: 16 hex digits from the service's CSPRNG, unique across the server. */
export const PROVENANCE_RE = /^[0-9a-f]{16}$/;
// ─── THE PLANE (PROF0 9.4, 25) ───────────────────────────────────────

/**
 * The grain runs across the board, a gentle wave its own each act (`waveA` of the half-height, `waves` along it); the
 * player presses at its head (x at most `headX`) and draws to its foot (`footX`). A pass whose mean deviation from the
 * grain is within the tolerance - `tol` of the half-height, x the attribute band, widening by `masterWiden` at Master -
 * and that took `minS` to `maxS` is clean.
 */
export const PLANE_ACT = Object.freeze({ tol: 0.18, masterWiden: 0.5, minS: 1.2, maxS: 4, headX: 0.08, footX: 0.98, waveA: 0.35, waves: 1.5 });
/** Carpentry's attribute pair (PROF0 25): (AGI + WIL) / 2, a steady hand, on Foraging's four bands. */
export const planeBand = ({ agility, willpower }) => actBand(Math.trunc((agility + willpower) / 2));
/** The plane's tolerance at a rank, x the band. */
export const planeTolerance = (rank, band = 1) => PLANE_ACT.tol * band * (1 + PLANE_ACT.masterWiden * Math.max(0, Math.min(100, rank)) / 100);
/** The grain's line at `x` in [0, 1] for an act's `phase`: a share of the half-height, up positive. */
export const grainAt = (x, phase) => PLANE_ACT.waveA * Math.sin(2 * Math.PI * (PLANE_ACT.waves * x + phase));

/** A maker's name as the mark keeps it: the character's name at the moment of making (PROF0 18), trimmed, at most 32. */
export const MAKER_MAX = 32;
export function makerName(name) {
  if (typeof name !== 'string') return null;
  const n = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAKER_MAX).trim();
  return n.length ? n : null;
}
/** A Masterwork's name: "Silverthorn's Mithril Longsword". */
export const markedName = (maker, name) => `${maker}'s ${name}`;
/** The lines a crafted piece's tooltip and card carry above its powers (PROF0 9.2): its quality and its maker - or a
 *  Repair Kit's work. Nothing for a piece no anvil or workbench made. */
export function pieceLines(item) {
  if (!item || typeof item.provenance !== 'string' || !PROVENANCE_RE.test(item.provenance)) return [];
  if (Number.isInteger(item.kitMetal)) return [`Mends a quarter of a ${METAL_WORDS[item.kitMetal] ?? ''} piece's condition, once`];
  const out = [];
  if (Number.isInteger(item.quality) && item.quality >= 0 && item.quality <= MASTERWORK) out.push(QUALITY_NAMES[item.quality]);
  if (typeof item.maker === 'string' && item.maker) out.push(`Made by ${item.maker}`);
  return out;
}
