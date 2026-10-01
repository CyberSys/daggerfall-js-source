// LR1-LR3 (2026-09-14, Mac: "building on unleveled loot. My goal is to
// transform things into a diablo style system with rarity ... Make
// this the most detailed and best that it can be"): LOOT RARITY - the
// port's own item ladder over Daggerfall's loot. ENHANCED, the port's
// departure from DFU's rules, ON by default (LR5, 2026-09-15, Mac: "I
// want to mod on by default" - it shipped off beside the enhanced AI,
// and Mac's call is that the ladder is the port's own game rather than
// something a player has to go and ask for) and on for everyone online
// (OL1). Off, not one field is written and not one read moves: DFU's
// loot, exactly - so the 1:1 lane is one press away, not lost.
//
// THE LADDER. Six tiers, and Daggerfall already had three of them:
//   common     - a plain item, DFU's own mint, untouched
//   magic      - an item with one or two AFFIXES (below), or one of
//                DFU's own MAGIC.DEF items (which are the same idea:
//                a plain item with enchantments and a name)
//   rare       - three or four affixes, a generated two-part name, and
//                ONE of DFU's own catalogue enchantments as its flavour
//   legendary  - a fixed record from LEGENDARIES: a name, a set affix
//                signature and its own DFU enchantment
//   aetheric   - SET6 (Sigil Sets): the rung under Artifact, never
//                rolled - a boss's own set (systems/aetheric.js), and
//                the Sigil Broker's
//   artifact   - DFU's artifacts, untouched, the top of the ladder
//
// REPLACE, DON'T LAYER. With the switch on there is ONE ladder: every
// enchanted item is at least Magic (rarityOf derives it), every rolled
// item wears its tier, and artifacts are the ceiling. DFU's own
// magic-item roll (the loot matrices' MI column) still runs and its
// products ARE Magic-tier items; the port does not re-roll them.
//
// AFFIXES ARE NUMBERS THE PLAYER CAN READ. DFU's enchantment catalogue
// is spell-shaped (Cast When Strikes, Regens Health) - fine flavour,
// weak as a comparison loop. The port's affixes are the numbers a
// Diablo player compares two swords by: +damage%, +armour, +attribute,
// +resistance, +skill, +carrying capacity. They ride an `affixes` list
// on the item, folded onto the wearer as ONE of the entity's folds
// (RF1: systems/entityMods.js - affixFold, registered there, summed
// with every other fold at the equip seam and the magic round, and
// read by DFU's formulas through one accessor per channel: the hit
// formula's armour term, the weapon damage roll, liveStat, skillValue,
// savingThrow, entityMaxEncumbrance). They are NOT entries in `item.enchantments`:
// that list is FallExe's closed enum, and a foreign type in it would
// make every DFU reader of the list (the value sum, the item maker,
// the payload dispatcher's unknown-key abort) affix-aware. Two lists,
// one wearer.
//
// RARITY FOLLOWS THE SOURCE, NOT THE PLAYER. Unleveled Loot's whole
// point is that the world does not scale to you, and this keeps that
// law: the roll reads the SOURCE's tier - the dead thing's level, the
// dungeon's kind - and luck. A Daedra Lord's corpse in a Volcanic Cave
// can drop a Legendary at level 3; a rat never does.
//
// IDENTIFY IS DAGGERFALL'S OWN. A Rare or Legendary carries a real DFU
// enchantment, so DFU's own IsIdentified law (tradeModes.itemIsIdentified:
// an enchanted item is unidentified until identified) makes it drop
// UNIDENTIFIED with no new mechanism: the Identify spell and the Mages
// Guild's service reveal it, and until then it reads as its bare
// template with no material and no affix lines. A Magic-tier item with
// only numeric affixes has no enchantment and so reads at once, as a
// plain item does. The affixes WORK while unidentified - DFU's
// enchantments do too.
//
// ONE TUNING TABLE. Every drop weight is RARITY_WEIGHTS and SOURCE_MULT
// below, per mille, so the feel can be tuned without touching a roll.

import { getPref } from './uiPrefs.js';
import { armorBodyParts, equipTableOf } from './equip.js';   // LR4: the parts a piece covers, the foe's worn table
import { registerEntityFold, registerWeaponDamageMod, newMods, EMPTY_MODS } from './entityMods.js';   // RF1: the fold is one of the entity's, read once per channel
import { templateByIndex, itemBaseValue, isAmmunition } from './itemTemplates.js';   // AUDIT 68 S27-ammo-arrow-only: the ammunition registry's home
import { rriVariantWord } from './rriItems.js';   // DISC29-B: the word Roleplay & Realism: Items' mint put before the template's name
import { STAT_KEYS_ORDER } from './statMods.js';
import { SKILL_NAMES, SKILL_COUNT, SKILLS, MAGIC_SKILLS } from './skills.js';
import { weaponSkillUsed } from '../characters/weapons.js';   // LOOT1: a weapon's skill affix leans to the skill that swings it
import { ENCHANTMENT_TYPES } from '../formats/magicDef.js';
import { enchantmentName, enchantmentParamName } from './enchantmentCatalogue.js';
import { rollSigil, sigilOnline, SIGIL_BANDS } from './sigil.js';   // SIGIL1: a weapon won online may carry a sigil
import { ROLLED_TIERS } from './rarityTier.js';   // RARE-BREAK1: the rolled tiers' one home
import { setPieceKind, rollSetSigil, rollSetJoin, setLines, setSigilLines } from './sigilSets.js';   // SET4: a won piece of armour or a shield may carry a set's sigil; a weapon's may join one; SET5: the set in words

export const LOOT_RARITY_KEY = 'lootRarity';
/** The switch. Read at every seam, so a press takes effect on the next
 *  roll and the next fold. */
export const lootRarityOn = () => !!getPref(LOOT_RARITY_KEY);

// ── the tiers ───────────────────────────────────────────────────────
export const RARITY_ORDER = Object.freeze(['common', 'magic', 'rare', 'legendary', 'aetheric', 'artifact']);
/** Label, the skin colour (the enhanced sheet's rules read the id; the
 *  native scroller tints the cell with `tint`), and the rank. SET6: the
 *  Aetheric rung (the aether's pale blue-white) under the Artifact. */
export const RARITIES = Object.freeze({
  common:    Object.freeze({ rank: 0, label: 'Common',    colour: '#e9e4d9', tint: null }),
  magic:     Object.freeze({ rank: 1, label: 'Magic',     colour: '#6f9ee8', tint: Object.freeze([0.22, 0.40, 0.80, 0.45]) }),
  rare:      Object.freeze({ rank: 2, label: 'Rare',      colour: '#e4c34f', tint: Object.freeze([0.80, 0.68, 0.18, 0.45]) }),
  legendary: Object.freeze({ rank: 3, label: 'Legendary', colour: '#e07a2e', tint: Object.freeze([0.85, 0.42, 0.10, 0.50]) }),
  aetheric:  Object.freeze({ rank: 4, label: 'Aetheric',  colour: '#bfe8ff', tint: Object.freeze([0.62, 0.86, 1.00, 0.55]) }),
  artifact:  Object.freeze({ rank: 5, label: 'Artifact',  colour: '#b57bee', tint: Object.freeze([0.60, 0.35, 0.85, 0.50]) }),
});
export { ROLLED_TIERS };   // RARE-BREAK1: its one home is the leaf (rarityTier.js), so a formula can ask it without the ladder

const enchanted = (item) => !!(item?.enchantments?.length || item?.customEnchantments?.length);

/** The tier an item wears - its own field when it rolled one, else
 *  derived: an artifact is the ceiling, any enchanted item (DFU's
 *  MAGIC.DEF loot, a made item, a soul-bound one) is Magic, and the
 *  rest is Common. Pure; answers whatever the switch says, so a
 *  caller that draws a tier gates on lootRarityOn() itself. */
export function rarityOf(item) {
  if (!item) return 'common';
  if (item.artifact) return 'artifact';
  if (typeof item.rarity === 'string' && RARITIES[item.rarity] && item.rarity !== 'artifact') return item.rarity;
  return item.magic || enchanted(item) ? 'magic' : 'common';   // LR4: a MAGIC.DEF row whose effects all filtered out is still DFU's magic item
}
export const rarityRank = (item) => RARITIES[rarityOf(item)].rank;

/** What may roll a tier: a weapon that is not an arrow, a piece of
 *  armour, a piece of jewellery. Never a quest item, an artifact, a
 *  DFU magic item (it is already Magic and keeps DFU's name), an item
 *  that already rolled (LR4: one roll per item, ever), or a worn one. */
/** AMMUNITION IS NEVER PROMOTED. DFU's own reason is the Arrow's: a
 *  stack is not an item you compare, and promoting one ENCHANTS it,
 *  which makes it unstackable (isStackable refuses an enchanted item)
 *  - so a quiver of twenty becomes twenty rows the player has to
 *  carry one at a time. What is ammunition is itemTemplates.js's
 *  registry (isAmmunition), where a mod's own registers.
 *
 *  AUDIT-THUNDERLOCK F4: the Pellet was eligible. A found stack could
 *  roll Magic and shatter itself. */
export function rarityEligible(item) {
  if (!item || item.questItem || item.artifact || item.magic || item.rarity || enchanted(item) || item.equipSlot != null) return false;
  if (item.group === 'Weapons') return !isAmmunition(item);
  return item.group === 'Armor' || item.group === 'Jewellery';
}

// ── the source and the roll ─────────────────────────────────────────
/** The port's own grading of DFU's nineteen dungeon kinds (DFRegion.
 *  DungeonTypes order), 0..21 - the SOURCE tier a treasure pile in that
 *  dungeon rolls at. Not Unleveled Loot's ladder (that is the mod's,
 *  for materials); this one grades by how deadly the kind's own
 *  monster table runs, which is what a Diablo drop rate follows. */
export const DUNGEON_RARITY_TIER = Object.freeze([
  9,    // 0 Crypt
  9,    // 1 OrcStronghold
  6,    // 2 HumanStronghold
  5,    // 3 Prison
  15,   // 4 DesecratedTemple
  4,    // 5 Mine
  4,    // 6 NaturalCave
  13,   // 7 Coven
  14,   // 8 VampireHaunt
  10,   // 9 Laboratory
  7,    // 10 HarpyNest
  6,    // 11 RuinedCastle
  5,    // 12 SpiderNest
  8,    // 13 GiantStronghold
  18,   // 14 DragonsDen
  11,   // 15 BarbarianStronghold
  18,   // 16 VolcanicCaves
  5,    // 17 ScorpionNest
  3,    // 18 Cemetery
]);
export const dungeonRarityTier = (dungeonType) => DUNGEON_RARITY_TIER[dungeonType] ?? 0;
/** A tavern's or a guild's treasure marker: the town's own tier. */
export const INTERIOR_RARITY_TIER = 4;
/** A monster of this level or over, or any Daedra, is a BOSS source. */
export const BOSS_LEVEL = 18;

/** The corpse source for an enemy: its own level (a class enemy has
 *  none in ENEMY_BASICS and scales to the player, so its entity level
 *  stands in), boss when it is a Daedra or high enough. LOOT6: and its
 *  FAMILY, by its mobile type (null for none). */
export function corpseSource(basics, entityLevel = 1, mobileType = null) {
  const level = Math.max(1, (basics?.level ?? entityLevel) | 0);
  const boss = basics?.affinity === 'Daedra' || level >= BOSS_LEVEL;
  return { kind: 'corpse', tier: level, boss, family: foeFamily(mobileType) };
}
export const pileSource = (tier, boss = false) => ({ kind: 'pile', tier: Math.max(0, tier | 0), boss });

// ── LOOT6: signature drops ──────────────────────────────────────────
// The Loot arc (bible/06-Systems/Loot-Arc.md section 8): each Legendary record is FOUND AMONG a family of the foe table,
// and a source of that family - a corpse of one of its foes, a pile in a dungeon kind of its - weighs its own records
// SIGNATURE_WEIGHT to one in the record's pick. WHETHER a Legendary drops is the source's tier alone (LR1's law); the
// family steers WHICH. One roll a pick, as the pick it replaces took, so no seeded mint draws more.
/** The port's grouping of the foe table (ENEMY_BASICS by mobile type; the class foes by their own teams and magic). */
export const FOE_FAMILIES = Object.freeze({
  undead: Object.freeze([15, 17, 18, 19, 23, 28, 30, 32, 33]),                   // the skeletal warrior to the Ancient Lich, the vampires among them
  daedra: Object.freeze([1, 22, 25, 26, 27, 29, 31, 35, 36, 37, 38]),            // the five Daedra, the four atronachs, the imp and the gargoyle
  dragon: Object.freeze([34, 40]),                                               // the two dragonlings
  beast: Object.freeze([0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 20, 41, 42]),    // the animals, the werecreatures, the wild and the water
  brute: Object.freeze([7, 12, 16, 21, 24]),                                     // the orcs and the giant
  caster: Object.freeze([128, 129, 130, 131, 132, 133]),                         // Mage, Spellsword, Battlemage, Sorcerer, Healer, Nightblade
  rogue: Object.freeze([134, 135, 136, 137, 138, 139]),                          // Bard, Burglar, Rogue, Acrobat, Thief, Assassin
  warrior: Object.freeze([140, 141, 142, 143, 144, 145, 146]),                   // Monk, Archer, Ranger, Barbarian, Warrior, Knight, the watch
});
export const FAMILY_IDS = Object.freeze(Object.keys(FOE_FAMILIES));
/** A foe's family by its mobile type, or null (the horse; a type the table does not know). */
export function foeFamily(mobileType) {
  if (!Number.isInteger(mobileType)) return null;
  for (const id of FAMILY_IDS) if (FOE_FAMILIES[id].includes(mobileType)) return id;
  return null;
}
/** A dungeon kind's family (DFRegion.DungeonTypes order) - whose its piles are; null for a kind of no one family. */
export const DUNGEON_FAMILY = Object.freeze([
  'undead',   // 0 Crypt
  'brute',    // 1 OrcStronghold
  'warrior',  // 2 HumanStronghold
  'rogue',    // 3 Prison
  'daedra',   // 4 DesecratedTemple
  null,       // 5 Mine
  'beast',    // 6 NaturalCave
  'caster',   // 7 Coven
  'undead',   // 8 VampireHaunt
  'caster',   // 9 Laboratory
  'beast',    // 10 HarpyNest
  'undead',   // 11 RuinedCastle
  'beast',    // 12 SpiderNest
  'brute',    // 13 GiantStronghold
  'dragon',   // 14 DragonsDen
  'warrior',  // 15 BarbarianStronghold
  'daedra',   // 16 VolcanicCaves
  'beast',    // 17 ScorpionNest
  'undead',   // 18 Cemetery
]);
export const dungeonFamily = (dungeonType) => DUNGEON_FAMILY[dungeonType] ?? null;
/** Each record's family - where it is found. Keyed by id; a mod's record may carry its own `found`. */
export const LEGENDARY_FOUND = Object.freeze({
  graveward: 'undead', 'the-warden': 'undead', 'aegis-of-dawn': 'undead', 'lysandus-visor': 'undead',
  'warp-edge': 'daedra', 'orsiniums-anvil': 'daedra', 'amulet-of-the-nine': 'daedra',
  wyrmbane: 'dragon', 'mountains-root': 'dragon',
  stormcaller: 'beast', 'glenmoril-bow': 'beast', foxglove: 'beast', 'mark-of-the-hist': 'beast',
  titanheart: 'brute', 'gortwogs-cleaver': 'brute', 'reachmans-torc': 'brute',
  'direnni-staff': 'caster', 'archmages-loop': 'caster', 'worms-tooth': 'caster', 'witch-sisters-ring': 'caster',
  nightwhisper: 'rogue', 'tsaesci-fang': 'rogue', 'night-mothers-embrace': 'rogue', 'wayrest-treads': 'rogue',
  'anseis-edge': 'warrior', 'gauntlets-of-the-rose': 'warrior', 'ravens-wings': 'warrior', 'wall-of-daggerfall': 'warrior',
  'kings-mark': 'warrior', 'duelists-vambrace': 'warrior',
});
/** Where a record is found, or null. */
export const foundAmong = (id) => (typeof id === 'string' ? (LEGENDARY_FOUND[id] ?? legendaryById(id)?.found ?? null) : null);
/** How much a family's own records weigh against the rest in a pick from a source of that family. */
export const SIGNATURE_WEIGHT = 5;
/** THE PICK - one roll: a source with no family picks evenly (exactly `pick`'s index for the same roll); a family's own
 *  records weigh SIGNATURE_WEIGHT each. */
export function pickLegendary(pool, family, rolls = Math.random) {
  const w = pool.map((r) => (family && foundAmong(r.id) === family ? SIGNATURE_WEIGHT : 1));
  const total = w.reduce((a, b) => a + b, 0);
  let r = rolls() * total;
  for (let i = 0; i < pool.length; i++) { if (r < w[i]) return pool[i]; r -= w[i]; }
  return pool[pool.length - 1];
}

/** THE TUNING TABLE. Per mille of reaching AT LEAST the tier: `base`
 *  at source tier 0, `perTier` more per tier point, never over `cap`.
 *  Luck adds LUCK_PER_POINT per point over 50 (and takes it under),
 *  and a source kind multiplies the lot. */
export const RARITY_WEIGHTS = Object.freeze({
  magic:     Object.freeze({ base: 100, perTier: 15,  cap: 600 }),
  rare:      Object.freeze({ base: 15,  perTier: 6,   cap: 260 }),
  legendary: Object.freeze({ base: 1,   perTier: 1.2, cap: 45 }),
});
export const SOURCE_MULT = Object.freeze({ corpse: 1, pile: 1.3, boss: 2.5 });
export const LUCK_PER_POINT = 2;

/** The three thresholds, per mille, for one source at one luck. LOOT5: `find` multiplies the Legendary threshold - the
 *  source's OWN chance, past its cap but never past the Rare threshold (the ladder never inverts): Foxglove's Fortune's
 *  Favour, and LOOT8's drought. */
export function rarityChances({ kind = 'corpse', tier = 0, boss = false, luck = 50, qualityMult = 1, find = 1 } = {}) {
  // ELITE: `qualityMult` scales the whole ladder (1.2 = every tier 20% likelier), caps unchanged
  const mult = (boss ? SOURCE_MULT.boss : (SOURCE_MULT[kind] ?? 1)) * (Number.isFinite(qualityMult) && qualityMult > 0 ? qualityMult : 1);
  const luckMod = (Math.max(0, Math.min(100, luck | 0)) - 50) * LUCK_PER_POINT;
  const at = (w) => Math.max(0, Math.min(w.cap, (w.base + w.perTier * Math.max(0, tier)) * mult + luckMod));
  const magic = at(RARITY_WEIGHTS.magic);
  const rare = Math.min(magic, at(RARITY_WEIGHTS.rare));
  const legendary = Math.min(rare, at(RARITY_WEIGHTS.legendary) * (Number.isFinite(find) && find > 0 ? find : 1));
  return { magic, rare, legendary };
}

/** LOOT5 (bible/06-Systems/Loot-Arc.md sections 7 and 10): THE FINDERS - named functions answering a multiplier on the
 *  Legendary threshold at the host door (rollLootRarity): Foxglove's power (systems/lootPowers.js), the drought
 *  (LOOT8). Their product; a finder that throws or answers nonsense is 1. */
const _finders = new Map();
export function registerLegendaryFind(name, fn) { if (typeof fn === 'function') _finders.set(name, fn); else _finders.delete(name); }
export function legendaryFindMult() {
  let m = 1;
  for (const fn of _finders.values()) { try { const v = fn(); if (Number.isFinite(v) && v > 0) m *= v; } catch { /* a finder is not the roll's problem */ } }
  return m;
}

/** One roll in [0, 1000) against the thresholds, highest tier first. */
export function rollRarity(source, rolls = Math.random) {
  const c = rarityChances(source);
  const r = rolls() * 1000;
  if (r < c.legendary) return 'legendary';
  if (r < c.rare) return 'rare';
  if (r < c.magic) return 'magic';
  return 'common';
}

// ── THE UNIQUE FIND ─────────────────────────────────────────────────
//
// Mac, 2026-09-19, of the Dwarven Thunderlock: "This weapon wont be
// available for purchase and should be one of the rarest items to find
// in the game."
//
// A TIER IS NOT A THING. Everything above decorates an item that DFU's
// own loot roll already produced - a Legendary is a sword the matrices
// minted, wearing a name. A unique find is the other question: an item
// that DFU's roll CANNOT produce, appearing at all. So it is its own
// roll, once per list rather than once per item, and it ADDS to the
// list instead of promoting something in it.
//
// AND IT IS REGISTERED, NOT NAMED. This file is the port's loot
// ladder; it has no business knowing that a gun exists. A weapon that
// wants to be findable registers itself (systems/thunderlock.js does,
// at import), which is the same shape registerCustomTemplates and the
// equip-sound sink already have.
//
// THE NUMBERS. Base zero: at source tier 0 - a rat, a shallow crypt -
// the chance is NOTHING, not "small". It only begins at `minTier`, and
// even then it is per mille of a per mille's worth of drops: 0.35 per
// tier point, capped at 6 (0.6%), times the source multiplier, plus
// luck. A Daedra Lord in a Volcanic Cave is the case this is for.
const _uniqueFinds = [];
export const UNIQUE_WEIGHTS = Object.freeze({ base: 0, perTier: 0.35, cap: 6 });

/**
 * Register a find. `mint(rolls)` answers the ITEMS to add (a list, so
 * a weapon can arrive with the ammunition it would be useless
 * without); `minTier` is the source tier it first becomes possible at;
 * `weight` scales its own chance against the others.
 */
export function registerUniqueFind(find) {
  if (!find?.id || typeof find.mint !== 'function') return _uniqueFinds.length;
  if (!_uniqueFinds.some((f) => f.id === find.id)) {
    _uniqueFinds.push(Object.freeze({ minTier: 4, weight: 1, ...find }));
  }
  return _uniqueFinds.length;
}
export const uniqueFinds = () => _uniqueFinds.slice();

/** Per mille that a qualifying source yields THIS find. */
export function uniqueFindChance(find, { kind = 'corpse', tier = 0, boss = false, luck = 50 } = {}) {
  if (!find || tier < (find.minTier ?? 4)) return 0;
  const mult = boss ? SOURCE_MULT.boss : (SOURCE_MULT[kind] ?? 1);
  const luckMod = (Math.max(0, Math.min(100, luck | 0)) - 50) * 0.02;   // a hundredth of the tier roll's - luck helps, it does not hand it over
  const w = UNIQUE_WEIGHTS;
  return Math.max(0, Math.min(w.cap, (w.base + w.perTier * Math.max(0, tier)) * mult * (find.weight ?? 1) + luckMod));
}

/** Roll every registered find against one source. Answers the items to
 *  add - almost always none. */
export function rollUniqueFinds(source, rolls = Math.random) {
  const out = [];
  for (const find of _uniqueFinds) {
    const chance = uniqueFindChance(find, source);
    if (chance <= 0) continue;
    if (rolls() * 1000 < chance) out.push(...(find.mint(rolls) ?? []));
  }
  return out;
}

/** A legendary record a mod adds - the pool is DFU-shaped but not
 *  DFU's, so it is allowed to grow. */
const _customLegendaries = [];
export function registerLegendary(record) {
  if (!record?.id) return _customLegendaries.length;
  if (!_customLegendaries.some((l) => l.id === record.id)) _customLegendaries.push(Object.freeze(record));
  return _customLegendaries.length;
}

// ── the affixes ─────────────────────────────────────────────────────
/** The five elements a resistance affix names - the saving throw's own
 *  Fire/Frost/Shock/Poison/Magic flags (spellcast.js EFFECT_FLAGS), by
 *  name here so this leaf owes the formulas no import. */
export const RESIST_ELEMENTS = Object.freeze(['fire', 'frost', 'shock', 'poison', 'magic']);
const ELEMENTS = RESIST_ELEMENTS;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** The value bands per rolled tier: [min, max] inclusive. */
export const AFFIX_RANGES = Object.freeze({
  damage: Object.freeze({ magic: [5, 12],  rare: [10, 25], legendary: [20, 40] }),   // % on the weapon's own roll
  armor:  Object.freeze({ magic: [3, 6],   rare: [6, 12],  legendary: [12, 20] }),   // points off every blow's chance to land
  stat:   Object.freeze({ magic: [2, 5],   rare: [5, 10],  legendary: [10, 15] }),   // on one attribute
  resist: Object.freeze({ magic: [10, 20], rare: [20, 35], legendary: [35, 50] }),   // on the saving throw against one element
  skill:  Object.freeze({ magic: [5, 10],  rare: [10, 20], legendary: [20, 30] }),   // on one skill
  weight: Object.freeze({ magic: [10, 20], rare: [20, 35], legendary: [35, 50] }),   // % carrying capacity
  // LOOT4 (bible/06-Systems/Loot-Arc.md section 6): the five that DO something - systems/lootPowers.js does it
  elemental: Object.freeze({ magic: [1, 3], rare: [3, 6], legendary: [6, 10] }),     // that much of its element a weapon blow
  leech:     Object.freeze({ magic: [2, 4], rare: [4, 7], legendary: [7, 10] }),     // % of a landed weapon blow, healed
  thorns:    Object.freeze({ magic: [1, 3], rare: [3, 6], legendary: [6, 10] }),     // back to a foe whose blow lands on you
  focus:     Object.freeze({ magic: [2, 4], rare: [4, 7], legendary: [7, 10] }),     // % off a spell's magicka
  slayer:    Object.freeze({ magic: [5, 10], rare: [10, 20], legendary: [20, 30] }), // % more weapon damage to one kind of foe
});
/** How many affixes a tier rolls: [min, max]. A Legendary's are its record's. */
export const AFFIX_COUNTS = Object.freeze({ magic: [1, 2], rare: [3, 4] });

const STAT_SUFFIX = Object.freeze({
  strength: ['of the Ox', 'of the Bear', 'of the Titan'],
  intelligence: ['of the Owl', 'of the Sage', 'of the Archmage'],
  willpower: ['of the Oak', 'of Iron Will', 'of the Unbroken'],
  agility: ['of the Cat', 'of the Falcon', 'of the Wind'],
  endurance: ['of the Boar', 'of the Mountain', 'of the Ageless'],
  personality: ['of the Peacock', 'of the Silver Tongue', 'of Kings'],
  speed: ['of the Hare', 'of the Stag', 'of Lightning'],
  luck: ['of the Fox', 'of Fortune', 'of the Gods'],
});
const RESIST_SUFFIX = Object.freeze({
  fire: ['of Embers', 'of Flame', 'of the Inferno'],
  frost: ['of Rime', 'of Winter', 'of the Glacier'],
  shock: ['of Sparks', 'of Storms', 'of the Tempest'],
  poison: ['of Venom', 'of the Serpent', 'of the Antidote'],
  magic: ['of Warding', 'of the Ward', 'of Negation'],
});
const SKILL_SUFFIX = Object.freeze(['of Practice', 'of Skill', 'of Mastery']);
/** LOOT4: the elements a weapon's blow may carry, and the kinds of foe a slayer's edge is for (DFU's own four groups -
 *  FormulaHelper.GetEnemyGroup, combat/formulas.js enemyEntityGroup; systems/lootPowers.js foeGroup reads a foe). */
export const PROC_ELEMENTS = Object.freeze(['fire', 'frost', 'shock']);
export const SLAYER_FOES = Object.freeze(['undead', 'daedra', 'humanoid', 'animal']);
const ELEMENTAL_PREFIX = Object.freeze({
  fire: ['Smouldering', 'Burning', 'Infernal'], frost: ['Chilling', 'Freezing', 'Glacial'], shock: ['Sparking', 'Crackling', 'Thundering'],
});
const LEECH_SUFFIX = Object.freeze(['of Leeching', 'of the Leech', 'of the Vampire']);
const THORNS_PREFIX = Object.freeze(['Barbed', 'Spiked', 'Thorned']);
const FOCUS_PREFIX = Object.freeze(["Adept's", "Magister's", "Sorcerer's"]);
const SLAYER_SUFFIX = Object.freeze({
  undead: ['of Rest', 'of the Gravewatch', 'of Exorcism'], daedra: ['of Banishing', 'of the Exile', "of Oblivion's Bane"],
  humanoid: ['of the Duellist', 'of the Headsman', 'of the Warlord'], animal: ['of the Hunt', 'of the Huntsman', 'of the Wild Hunt'],
});
const SLAYER_NOUN = Object.freeze({ undead: 'the undead', daedra: 'daedra', humanoid: 'humanoids', animal: 'animals' });
const DAMAGE_PREFIX = Object.freeze(["Soldier's", "Warrior's", "Slayer's"]);
const ARMOR_PREFIX = Object.freeze(["Sentinel's", "Guardian's", "Bulwark"]);
const WEIGHT_PREFIX = Object.freeze(["Porter's", "Mule's", "Giant's"]);
const BAND = Object.freeze({ magic: 0, rare: 1, legendary: 2 });

/** The affix kinds: which groups may carry each, the slot its word
 *  takes in the name, the words, and the label the tooltip prints. A
 *  `param` names the attribute, element or skill; a kind without one
 *  never repeats on an item, a kind with one never repeats a param. */
export const AFFIX_KINDS = Object.freeze({
  damage: Object.freeze({ slot: 'prefix', groups: Object.freeze(['Weapons']), params: null,
    word: (band) => DAMAGE_PREFIX[band], label: (a) => `+${a.value}% damage` }),
  armor:  Object.freeze({ slot: 'prefix', groups: Object.freeze(['Armor']), params: null,
    word: (band) => ARMOR_PREFIX[band], label: (a) => `+${a.value} armor` }),
  weight: Object.freeze({ slot: 'prefix', groups: Object.freeze(['Armor', 'Jewellery']), params: null,
    word: (band) => WEIGHT_PREFIX[band], label: (a) => `+${a.value}% carrying capacity` }),
  stat:   Object.freeze({ slot: 'suffix', groups: Object.freeze(['Weapons', 'Armor', 'Jewellery']), params: STAT_KEYS_ORDER,
    word: (band, p) => STAT_SUFFIX[p][band], label: (a) => `+${a.value} ${cap(a.param)}` }),
  resist: Object.freeze({ slot: 'suffix', groups: Object.freeze(['Armor', 'Jewellery']), params: ELEMENTS,
    word: (band, p) => RESIST_SUFFIX[p][band], label: (a) => `+${a.value}% ${cap(a.param)} resistance` }),
  skill:  Object.freeze({ slot: 'suffix', groups: Object.freeze(['Weapons', 'Armor', 'Jewellery']), params: Object.freeze([...Array(SKILL_COUNT).keys()]),
    word: (band) => SKILL_SUFFIX[band], label: (a) => `+${a.value} ${SKILL_NAMES[a.param] ?? 'Skill'}` }),
  // LOOT4: the five that DO something (`proc`) - never in the roll's own draw (rollAffixes), a door's last pass adds
  // one (rollProcLine), and they never name a piece (nameAround)
  elemental: Object.freeze({ slot: 'prefix', groups: Object.freeze(['Weapons']), params: PROC_ELEMENTS, proc: true,
    word: (band, p) => ELEMENTAL_PREFIX[p][band], label: (a) => `+${a.value} ${cap(a.param)} damage` }),
  leech:  Object.freeze({ slot: 'suffix', groups: Object.freeze(['Weapons']), params: null, proc: true,
    word: (band) => LEECH_SUFFIX[band], label: (a) => `${a.value}% life leech` }),
  thorns: Object.freeze({ slot: 'prefix', groups: Object.freeze(['Armor']), params: null, proc: true,
    word: (band) => THORNS_PREFIX[band], label: (a) => `${a.value} thorns` }),
  focus:  Object.freeze({ slot: 'prefix', groups: Object.freeze(['Jewellery']), params: null, proc: true,
    word: (band) => FOCUS_PREFIX[band], label: (a) => `-${a.value}% spell cost` }),
  slayer: Object.freeze({ slot: 'suffix', groups: Object.freeze(['Weapons']), params: SLAYER_FOES, proc: true,
    word: (band, p) => SLAYER_SUFFIX[p][band], label: (a) => `+${a.value}% damage vs ${SLAYER_NOUN[a.param]}` }),
});
export const AFFIX_IDS = Object.freeze(Object.keys(AFFIX_KINDS));

/** Gold per point of each affix, for the item's value. */
export const AFFIX_WORTH = Object.freeze({ damage: 40, armor: 60, weight: 15, stat: 90, resist: 20, skill: 25,
  elemental: 50, leech: 80, thorns: 40, focus: 60, slayer: 25 });   // LOOT4

const rangeInt = (min, max, rolls) => min + Math.floor(rolls() * (max + 1 - min));
const pick = (list, rolls) => list[Math.floor(rolls() * list.length)];

/** LOOT1 (the Loot arc, bible/06-Systems/Loot-Arc.md - AUDIT-LR's second note: "a warhammer can roll +20 Impish ... a
 *  weighting toward the group's own combat skills would be a tuning slice"): A SKILL AFFIX LEANS TO THE ITEM'S OWN
 *  SKILLS. A weapon's to the hand that swings it - half the time its own weapon skill, then the strike's kin (Critical
 *  Strike, Backstabbing, Dodging); a piece of armour's to the body (the seven ways of fighting and the five of moving);
 *  jewellery's to the mind (the six schools and the skills of talk and the shadows) - in all, 85 times in a hundred.
 *  The rest of the time any skill at all, the languages among them (a skill affix was a language 9 times in 35; now
 *  about 1 in 30) - a weighting, never a fence: an amulet of tongues is still a find. */
export const SKILL_OWN_SHARE = 0.5;
export const SKILL_KIN_SHARE = 0.85;
const S = SKILLS;
const STRIKE_KIN = Object.freeze([S.CriticalStrike, S.Backstabbing, S.Dodging]);
const BODY_KIN = Object.freeze([S.ShortBlade, S.LongBlade, S.HandToHand, S.Axe, S.BluntWeapon, S.Archery, S.CriticalStrike,
  S.Dodging, S.Running, S.Jumping, S.Climbing, S.Swimming]);
const MIND_KIN = Object.freeze([...MAGIC_SKILLS, S.Etiquette, S.Streetwise, S.Mercantile, S.Lockpicking, S.Pickpocket,
  S.Stealth, S.Medical]);
/** The skills an item leans to: `{ own, kin }` - a weapon's own skill (null for one with none) and its kin. */
export function skillKin(item) {
  if (item?.group === 'Weapons') return { own: weaponSkillUsed(item.templateIndex), kin: STRIKE_KIN };
  if (item?.group === 'Armor') return { own: null, kin: BODY_KIN };
  if (item?.group === 'Jewellery') return { own: null, kin: MIND_KIN };
  return { own: null, kin: Object.freeze([]) };
}
/** One skill affix's skill, of the `free` ones (a kind with a param never repeats one): the item's own, then its kin,
 *  then any - each step taken only when it has a free skill to give (its share given to the next), so the draw never
 *  comes back empty.
 *
 *  ONE ROLL, AS THE DRAW IT REPLACES TOOK (`pick(free, rolls)`): the roll's place in [0, 1) chooses the step AND the
 *  skill within it, each step's interval spread evenly over its list. Every seeded mint - the gate's spoils, a town's
 *  thanks, the Sigil Broker's day, a Masterwork's roll - draws exactly as many rolls as it did, so what it mints after
 *  a skill affix (the next piece, the Regalia's roll, the gold) is still its seed's; only the skill itself moved. */
function pickSkill(item, free, rolls) {
  const r = rolls();
  const { own, kin } = skillKin(item);
  const ownFree = own != null && free.includes(own);
  if (ownFree && r < SKILL_OWN_SHARE) return own;
  const near = kin.filter((s) => free.includes(s));
  const lo = ownFree ? SKILL_OWN_SHARE : 0;   // where the kin's interval starts
  const within = (list, from, to) => list[Math.min(list.length - 1, Math.floor(((r - from) / (to - from)) * list.length))];
  if (near.length && r < SKILL_KIN_SHARE) return within(near, lo, SKILL_KIN_SHARE);
  return within(free, near.length ? SKILL_KIN_SHARE : lo, 1);
}
/** Tests only: the one draw, alone. */
export const _pickSkillForTests = pickSkill;

/** LR4 (the audit): ONE AFFIX RECORD, VALID - a known kind, a param the
 *  kind names (and none for a kind without), an integer value from 1 to
 *  the kind's Legendary ceiling. The wire's validator refuses a list
 *  that fails this (a forged +1e9 armour, a stat with no attribute), and
 *  every reader below skips a malformed record rather than throwing out
 *  of a tooltip or the magic round. */
export function validAffix(a) {
  if (!a || typeof a !== 'object') return false;
  const k = AFFIX_KINDS[a.id];
  if (!k) return false;
  if (k.params ? !k.params.includes(a.param) : a.param !== undefined) return false;
  const max = AFFIX_RANGES[a.id].legendary[1];
  return Number.isInteger(a.value) && a.value >= 1 && a.value <= max;
}
export const validAffixList = (list) => Array.isArray(list) && list.every(validAffix);
/** One affix's label - the tooltip line; '' for a malformed record. */
export const affixLabel = (a) => (validAffix(a) ? AFFIX_KINDS[a.id].label(a) : '');
/** The name-word an affix contributes, by the tier's band. */
export const affixWord = (a, tier) => (validAffix(a) ? AFFIX_KINDS[a.id].word(BAND[tier] ?? 0, a.param) : '');

/** Roll a tier's affixes for an item: the count from AFFIX_COUNTS, no
 *  kind repeated (no param repeated for a kind with params), the first
 *  pick leaning to the group's own number (a weapon's damage, a piece
 *  of armour's armour) half the time, a Rare guaranteed a prefix AND a
 *  suffix so its name has both parts. */
export function rollAffixes(item, tier, rolls = Math.random) {
  const kinds = AFFIX_IDS.filter((id) => AFFIX_KINDS[id].groups.includes(item.group) && !AFFIX_KINDS[id].proc);   // LOOT4: the numbers alone - a door's last pass adds a kind that does something
  const [min, max] = AFFIX_COUNTS[tier] ?? [0, 0];
  const count = rangeInt(min, max, rolls);
  const out = [];
  const taken = new Set();
  const mint = (id) => {
    const k = AFFIX_KINDS[id];
    const [lo, hi] = AFFIX_RANGES[id][tier];
    const value = rangeInt(lo, hi, rolls);
    if (!k.params) { taken.add(id); return { id, value }; }
    const free = k.params.filter((p) => !taken.has(`${id}:${p}`));
    const param = id === 'skill' ? pickSkill(item, free, rolls) : pick(free, rolls);   // LOOT1: a skill leans to the item's own
    taken.add(`${id}:${param}`);
    return { id, param, value };
  };
  const open = () => kinds.filter((id) => AFFIX_KINDS[id].params ? AFFIX_KINDS[id].params.some((p) => !taken.has(`${id}:${p}`)) : !taken.has(id));
  const own = item.group === 'Weapons' ? 'damage' : item.group === 'Armor' ? 'armor' : null;
  for (let i = 0; i < count; i++) {
    let pool = open();
    if (!pool.length) break;
    if (tier === 'rare' && i === count - 1) {
      // the last pick fills whichever slot the name still lacks
      const has = (slot) => out.some((a) => AFFIX_KINDS[a.id].slot === slot);
      const need = !has('prefix') ? 'prefix' : !has('suffix') ? 'suffix' : null;
      if (need) { const p = pool.filter((id) => AFFIX_KINDS[id].slot === need); if (p.length) pool = p; }
    }
    const id = i === 0 && own && pool.includes(own) && rolls() < 0.5 ? own : pick(pool, rolls);
    out.push(mint(id));
  }
  return out;
}

// ── the flavour (Rare) and the records (Legendary) ─────────────────
const T = ENCHANTMENT_TYPES;
/** The DFU catalogue enchantment a Rare carries, one per item, by
 *  group: a weapon strikes or drinks, a piece of armour or jewellery
 *  holds. {type, param} are the catalogue's own (enchantmentCatalogue
 *  ENCHANTMENT_COSTS: the CastWhen* params are classic spell ids). */
export const RARE_FLAVOURS = Object.freeze({
  Weapons: Object.freeze([
    { type: T.CastWhenStrikes, param: 7 },    // Wizard's Fire
    { type: T.CastWhenStrikes, param: 16 },   // Ice Bolt
    { type: T.CastWhenStrikes, param: 53 },   // Hand of Sleep
    { type: T.CastWhenStrikes, param: 52 },   // Vampiric Touch
    { type: T.CastWhenStrikes, param: 33 },   // Wildfire
    { type: T.VampiricEffect, param: 1 },     // when strikes
    { type: T.PotentVs, param: 0 },           // Undead
    { type: T.PotentVs, param: 1 },           // Daedra
    { type: T.PotentVs, param: 2 },           // Humanoid
    { type: T.PotentVs, param: 3 },           // Animals
    { type: T.RepairsObjects, param: -1 },
  ]),
  Armor: Object.freeze([
    { type: T.CastWhenHeld, param: 37 },      // Slowfalling
    { type: T.CastWhenHeld, param: 41 },      // Water Walking
    { type: T.CastWhenHeld, param: 42 },      // Water Breathing
    { type: T.CastWhenHeld, param: 24 },      // Troll's Blood
    { type: T.RegensHealth, param: 2 },       // in darkness
    { type: T.RegensHealth, param: 1 },       // in sunlight
    { type: T.IncreasedWeightAllowance, param: 0 },
    { type: T.RepairsObjects, param: -1 },
    { type: T.ImprovesTalents, param: 1 },    // Athleticism (LR4: FeatherWeight left - its payload fires at the item maker alone, so on a drop it would be a dead line)
  ]),
  Jewellery: Object.freeze([
    { type: T.CastWhenHeld, param: 44 },      // Chameleon
    { type: T.CastWhenHeld, param: 45 },      // Shadow Form
    { type: T.CastWhenHeld, param: 49 },      // Tongues
    { type: T.CastWhenHeld, param: 39 },      // Spell Resistance
    { type: T.ExtraSpellPts, param: 8 },      // Near Daedra
    { type: T.ExtraSpellPts, param: 7 },      // Near Undead
    { type: T.AbsorbsSpells, param: -1 },
    { type: T.ImprovesTalents, param: 0 },    // Hearing
    { type: T.ImprovesTalents, param: 2 },    // Adrenaline Rush
    { type: T.GoodRepWith, param: 1 },        // Merchants
  ]),
});

/** THE LEGENDARIES. A fixed pool per group: a name a player learns, a
 *  set affix signature, one DFU enchantment. `templates` narrows a
 *  record to particular items (a bow, a shield) when it should not
 *  land on any of the group. */
export const LEGENDARIES = Object.freeze([
  { id: 'wyrmbane', name: 'Wyrmbane', group: 'Weapons',
    affixes: [{ id: 'damage', value: 35 }, { id: 'stat', param: 'strength', value: 12 }, { id: 'skill', param: 34, value: 20 }],
    enchantment: { type: T.CastWhenStrikes, param: 25 },   // Fire Storm
    lore: 'Forged for a dragon hunt no chronicle finished.' },
  { id: 'nightwhisper', name: 'Nightwhisper', group: 'Weapons', templates: [113, 114, 116, 117],   // Dagger, Tanto, Shortsword, Wakizashi
    affixes: [{ id: 'damage', value: 25 }, { id: 'stat', param: 'agility', value: 12 }, { id: 'stat', param: 'speed', value: 10 }, { id: 'skill', param: 16, value: 25 }],
    enchantment: { type: T.CastWhenHeld, param: 44 },   // Chameleon
    lore: 'A blade the Dark Brotherhood swears it never lost.' },
  { id: 'graveward', name: 'Graveward', group: 'Weapons', templates: [124, 125, 126, 127, 128],   // Mace, Flail, Warhammer, Battle Axe, War Axe
    affixes: [{ id: 'damage', value: 30 }, { id: 'stat', param: 'endurance', value: 10 }, { id: 'skill', param: 34, value: 25 }],
    enchantment: { type: T.PotentVs, param: 0 },   // Undead
    lore: 'The Order of the Hour buried it with its bearer. It did not stay buried.' },
  { id: 'stormcaller', name: "Stormcaller's Bow", group: 'Weapons', templates: [129, 130],   // Short Bow, Long Bow
    affixes: [{ id: 'damage', value: 30 }, { id: 'stat', param: 'agility', value: 10 }, { id: 'skill', param: 33, value: 25 }],
    enchantment: { type: T.CastWhenStrikes, param: 20 },   // Ice Storm
    lore: 'Strung with a hair of the Ebonarm, or so the archer said.' },
  { id: 'the-warden', name: 'The Warden', group: 'Armor', templates: [102, 103, 104, 105, 106, 107, 108],   // the body pieces
    affixes: [{ id: 'armor', value: 15 }, { id: 'stat', param: 'endurance', value: 12 }, { id: 'resist', param: 'magic', value: 40 }],
    enchantment: { type: T.RegensHealth, param: 0 },   // all the time
    lore: 'Worn by the last warden of a keep that no longer stands.' },
  { id: 'titanheart', name: 'Titanheart', group: 'Armor', templates: [102, 103, 104, 105, 106, 107, 108],
    affixes: [{ id: 'armor', value: 12 }, { id: 'stat', param: 'strength', value: 15 }, { id: 'weight', value: 40 }],
    enchantment: { type: T.AbsorbsSpells, param: -1 },
    lore: 'Its plates are said to have been beaten from a giant\'s own heart.' },
  { id: 'aegis-of-dawn', name: 'Aegis of Dawn', group: 'Armor', templates: [109, 110, 111, 112],   // the four shields
    affixes: [{ id: 'armor', value: 18 }, { id: 'resist', param: 'fire', value: 45 }, { id: 'stat', param: 'willpower', value: 10 }],
    enchantment: { type: T.CastWhenHeld, param: 39 },   // Spell Resistance
    lore: 'Raised against the Underking\'s host at the dawn of the second era.' },
  { id: 'foxglove', name: 'Foxglove', group: 'Jewellery',
    affixes: [{ id: 'stat', param: 'luck', value: 15 }, { id: 'stat', param: 'speed', value: 10 }, { id: 'resist', param: 'poison', value: 35 }],
    enchantment: { type: T.ImprovesTalents, param: 1 },   // Athleticism
    lore: 'Pretty, and poisonous to those who would take it from you.' },
  { id: 'kings-mark', name: "King's Mark", group: 'Jewellery',
    affixes: [{ id: 'stat', param: 'personality', value: 15 }, { id: 'skill', param: 1, value: 25 }, { id: 'weight', value: 35 }],
    enchantment: { type: T.GoodRepWith, param: 3 },   // Nobility
    lore: 'Whoever wears it is received at court; whoever loses it is not.' },
  { id: 'archmages-loop', name: "Archmage's Loop", group: 'Jewellery',
    affixes: [{ id: 'stat', param: 'intelligence', value: 15 }, { id: 'stat', param: 'willpower', value: 12 }, { id: 'resist', param: 'shock', value: 40 }],
    enchantment: { type: T.ExtraSpellPts, param: 8 },   // Near Daedra
    lore: 'One of the rings the Mages Guild does not admit to having made.' },
  // ── LOOT3 (the Loot arc, bible/06-Systems/Loot-Arc.md section 5): TWENTY MORE - every weapon family, every armour
  // place and every kind of jewellery a record of its own, named in the lore of the Bay and never an artifact's name.
  // Each keeps LR2's law: three or more lines in the Legendary band of kinds its group may carry, ONE DFU catalogue
  // enchantment priced by DFU's own table (never an item-maker-only payload; a held spell a cheap one, since DFU bills
  // its casting cost in condition at the first equip - LR4's watch item 9), a base it can land on, a line of lore.
  { id: 'anseis-edge', name: "Ansei's Edge", group: 'Weapons', templates: [118, 119, 120, 121, 122, 123],   // the long blades
    affixes: [{ id: 'damage', value: 30 }, { id: 'stat', param: 'agility', value: 12 }, { id: 'skill', param: 29, value: 25 }],
    enchantment: { type: T.PotentVs, param: 2 },   // Humanoid
    lore: 'Carried out of drowned Yokuda by a sword-singer who never sang again.' },
  { id: 'tsaesci-fang', name: 'Tsaesci Fang', group: 'Weapons', templates: [114, 117, 121, 123],   // Tanto, Wakizashi, Katana, Dai-katana
    affixes: [{ id: 'damage', value: 28 }, { id: 'stat', param: 'speed', value: 12 }, { id: 'skill', param: 34, value: 25 }],
    enchantment: { type: T.CastWhenStrikes, param: 56 },   // Hand of Decay
    lore: 'Akaviri steel, folded by the serpent-folk who came to take Tamriel and stayed to serve it.' },
  { id: 'orsiniums-anvil', name: "Orsinium's Anvil", group: 'Weapons', templates: [124, 125, 126],   // Mace, Flail, Warhammer
    affixes: [{ id: 'damage', value: 32 }, { id: 'stat', param: 'strength', value: 12 }, { id: 'skill', param: 32, value: 25 }],
    enchantment: { type: T.PotentVs, param: 1 },   // Daedra
    lore: 'Beaten on the anvil that raised Orsinium again, and every bit as hard to put down.' },
  { id: 'glenmoril-bow', name: 'The Glenmoril Bow', group: 'Weapons', templates: [129, 130],   // Short Bow, Long Bow
    affixes: [{ id: 'damage', value: 28 }, { id: 'stat', param: 'agility', value: 10 }, { id: 'skill', param: 33, value: 22 }],
    enchantment: { type: T.PotentVs, param: 3 },   // Animals
    lore: 'Strung by the witches of Glenmoril for a hunt that Hircine himself had called.' },
  { id: 'direnni-staff', name: 'The Direnni Staff', group: 'Weapons', templates: [115],   // Staff
    affixes: [{ id: 'damage', value: 20 }, { id: 'stat', param: 'intelligence', value: 15 }, { id: 'skill', param: 22, value: 25 }, { id: 'stat', param: 'willpower', value: 10 }],
    enchantment: { type: T.CastWhenStrikes, param: 54 },   // Magicka Leech
    lore: 'From the Adamantine Tower, when the Direnni still ruled High Rock and thought they always would.' },
  { id: 'gortwogs-cleaver', name: "Gortwog's Cleaver", group: 'Weapons', templates: [127, 128],   // Battle Axe, War Axe
    affixes: [{ id: 'damage', value: 36 }, { id: 'stat', param: 'strength', value: 10 }, { id: 'skill', param: 31, value: 25 }],
    enchantment: { type: T.VampiricEffect, param: 1 },   // when strikes
    lore: 'King Gortwog\'s own, before the crown made him sit down; he still asks after it.' },
  { id: 'worms-tooth', name: "Worm's Tooth", group: 'Weapons', templates: [113, 114],   // Dagger, Tanto
    affixes: [{ id: 'damage', value: 24 }, { id: 'stat', param: 'intelligence', value: 12 }, { id: 'skill', param: 27, value: 22 }, { id: 'skill', param: 19, value: 20 }],
    enchantment: { type: T.CastWhenStrikes, param: 67 },   // Energy Leech
    lore: 'A necromancer\'s knife, cut from the King of Worms\' own tooth - or so his acolytes swear.' },
  { id: 'warp-edge', name: 'Warp-Edge', group: 'Weapons', templates: [118, 122, 123],   // Broadsword, Claymore, Dai-katana
    affixes: [{ id: 'damage', value: 38 }, { id: 'stat', param: 'luck', value: 12 }, { id: 'skill', param: 34, value: 22 }],
    enchantment: { type: T.CastWhenStrikes, param: 55 },   // Sphere of Negation
    lore: 'Forged in the hour the West warped and every ending happened at once. It remembers all of them.' },
  { id: 'lysandus-visor', name: 'The Visor of King Lysandus', group: 'Armor', templates: [107],   // Helm
    affixes: [{ id: 'armor', value: 16 }, { id: 'stat', param: 'willpower', value: 12 }, { id: 'resist', param: 'magic', value: 40 }, { id: 'stat', param: 'personality', value: 10 }],
    enchantment: { type: T.RegensHealth, param: 2 },   // in darkness
    lore: 'The ghost-king\'s own. It still sees Cryngaine Field, and the arrow that ended him.' },
  { id: 'wayrest-treads', name: "The Wayrest Courier's Treads", group: 'Armor', templates: [108],   // Boots
    affixes: [{ id: 'armor', value: 12 }, { id: 'stat', param: 'speed', value: 15 }, { id: 'skill', param: 21, value: 25 }],
    enchantment: { type: T.ImprovesTalents, param: 1 },   // Athleticism
    lore: 'Worn thin on the road between Wayrest and Daggerfall by a courier who was never once late.' },
  { id: 'gauntlets-of-the-rose', name: 'Gauntlets of the Rose', group: 'Armor', templates: [103],   // Gauntlets
    affixes: [{ id: 'armor', value: 14 }, { id: 'stat', param: 'strength', value: 12 }, { id: 'skill', param: 30, value: 25 }],
    enchantment: { type: T.StrengthensArmor, param: -1 },
    lore: 'Of Wayrest\'s Knights of the Rose, sworn to strike with an open hand - and then with a closed one.' },
  { id: 'mountains-root', name: "The Mountain's Root", group: 'Armor', templates: [104],   // Greaves
    affixes: [{ id: 'armor', value: 16 }, { id: 'stat', param: 'endurance', value: 12 }, { id: 'weight', value: 40 }],
    enchantment: { type: T.IncreasedWeightAllowance, param: 1 },   // 50% additional
    lore: 'Dwemer-wrought for a foreman of the deep halls who never once lost his footing.' },
  { id: 'ravens-wings', name: "The Raven's Wings", group: 'Armor', templates: [105, 106],   // the Pauldrons
    affixes: [{ id: 'armor', value: 14 }, { id: 'stat', param: 'agility', value: 12 }, { id: 'skill', param: 20, value: 25 }],
    enchantment: { type: T.CastWhenHeld, param: 37 },   // Slowfalling
    lore: 'Of Camlorn\'s Order of the Raven, whose knights drop from the walls and land standing.' },
  { id: 'night-mothers-embrace', name: "The Night Mother's Embrace", group: 'Armor', templates: [102],   // Cuirass
    affixes: [{ id: 'armor', value: 14 }, { id: 'stat', param: 'agility', value: 10 }, { id: 'skill', param: 19, value: 25 }, { id: 'skill', param: 16, value: 20 }],
    enchantment: { type: T.CastWhenHeld, param: 45 },   // Shadow Form
    lore: 'Sweet Mother, sweet Mother, send your child unto me - and she sent this instead.' },
  { id: 'wall-of-daggerfall', name: 'The Wall of Daggerfall', group: 'Armor', templates: [111, 112],   // Kite Shield, Tower Shield
    affixes: [{ id: 'armor', value: 18 }, { id: 'stat', param: 'endurance', value: 12 }, { id: 'resist', param: 'shock', value: 40 }],
    enchantment: { type: T.RepairsObjects, param: -1 },
    lore: 'Hewn from the gate the city was named for. The gate fell; this did not.' },
  { id: 'amulet-of-the-nine', name: 'The Amulet of the Nine', group: 'Jewellery', templates: [133, 139],   // Amulet, Cloth Amulet
    affixes: [{ id: 'stat', param: 'willpower', value: 12 }, { id: 'skill', param: 23, value: 25 }, { id: 'resist', param: 'magic', value: 40 }],
    enchantment: { type: T.RegensHealth, param: 1 },   // in sunlight
    lore: 'Blessed at each of the Nine\'s altars in turn, and a tenth time by someone who would not give a name.' },
  { id: 'witch-sisters-ring', name: "The Witch-Sisters' Ring", group: 'Jewellery', templates: [135],   // Ring
    affixes: [{ id: 'stat', param: 'intelligence', value: 12 }, { id: 'skill', param: 24, value: 25 }, { id: 'resist', param: 'frost', value: 40 }],
    enchantment: { type: T.ExtraSpellPts, param: 6 },   // During New Moon
    lore: 'Passed hand to hand through a Glenmoril coven; each sister added a curse, and none took one off.' },
  { id: 'duelists-vambrace', name: "The Duelist's Vambrace", group: 'Jewellery', templates: [134, 136],   // Bracer, Bracelet
    affixes: [{ id: 'stat', param: 'agility', value: 12 }, { id: 'stat', param: 'speed', value: 10 }, { id: 'skill', param: 34, value: 25 }],
    enchantment: { type: T.ImprovesTalents, param: 2 },   // Adrenaline Rush
    lore: 'Worn through a hundred Sentinel duels. Its owner lost one, and has not been seen since.' },
  { id: 'mark-of-the-hist', name: 'The Mark of the Hist', group: 'Jewellery', templates: [137],   // Mark
    affixes: [{ id: 'stat', param: 'endurance', value: 12 }, { id: 'resist', param: 'poison', value: 45 }, { id: 'skill', param: 17, value: 25 }],
    enchantment: { type: T.CastWhenHeld, param: 42 },   // Water Breathing
    lore: 'Hist-sap hardened in the shape of a hand. The Argonians call it a gift; the Hist does not say.' },
  { id: 'reachmans-torc', name: "The Reachman's Torc", group: 'Jewellery', templates: [138],   // Torc
    affixes: [{ id: 'stat', param: 'strength', value: 12 }, { id: 'stat', param: 'willpower', value: 10 }, { id: 'resist', param: 'shock', value: 40 }],
    enchantment: { type: T.ExtraSpellPts, param: 9 },   // Near Humanoids
    lore: 'Briar-bound and hagraven-blessed, taken off a Reach chieftain who had no more use for it.' },
]);
export const legendaryById = (id) => allLegendaries().find((l) => l.id === id) ?? null;
/** LOOT5 (the Loot arc, bible/06-Systems/Loot-Arc.md section 7): EVERY LEGENDARY A POWER. Each record names one: its
 *  name, its BRIEF (the card's row - CARD-FIT's 32 characters at most), its sentence, its `kind` (what systems/
 *  lootPowers.js does with it) and its numbers, fixed - a Legendary does not grow. Keyed by the record's id, so the
 *  records keep LR2's own shape; a mod's record may carry its own `power` (powerOf reads both). */
export const LEGENDARY_POWERS = Object.freeze({
  wyrmbane: Object.freeze({ name: 'Dragonsbane', kind: 'bane', foes: Object.freeze([34, 40, 16]), pct: 50,
    brief: '+50% vs dragons and giants', text: 'Its blows deal +50% damage to dragonlings and giants' }),
  nightwhisper: Object.freeze({ name: 'Silent Death', kind: 'unaware', pct: 100,
    brief: '+100% to a foe unaware', text: 'Its blows deal double damage to a foe that has not noticed you' }),
  graveward: Object.freeze({ name: 'Sanctified', kind: 'sanctified', group: 'undead', pct: 40, heal: 10,
    brief: '+40% vs undead; their end heals', text: 'Its blows deal +40% damage to the undead, and each undead foe you kill while you wield it heals you 10% of your health' }),
  stormcaller: Object.freeze({ name: 'Chain Lightning', kind: 'chain', metres: 6, share: 50,
    brief: 'Arrows arc 50% to a foe near', text: 'Each of its arrows that lands arcs to the nearest other foe within 6 m, for half its damage as shock' }),
  'anseis-edge': Object.freeze({ name: 'Way of the Sword', kind: 'flow', pct: 6, max: 5, seconds: 6,
    brief: '+6% a hit, up to 5 (6s)', text: 'Each of its blows that lands grants Flow for 6 s, up to five: +6% weapon damage a stack' }),
  'tsaesci-fang': Object.freeze({ name: "Serpent's Kiss", kind: 'venom', flat: 8,
    brief: '+8 poison, x2 under half', text: 'Its blows carry 8 poison, twice that to a foe under half its health - none to a foe immune, half to one that resists' }),
  'orsiniums-anvil': Object.freeze({ name: 'Earthshaker', kind: 'quake', metres: 3, share: 25,
    brief: 'Blows quake 25% around', text: 'Each of its blows that lands shakes the ground: every other foe within 3 m takes a quarter of it' }),
  'glenmoril-bow': Object.freeze({ name: "Hunter's Moon", kind: 'moon', pct: 35, beast: 35,
    brief: '+35% at night, +70% on beasts', text: 'At night its blows deal +35% damage, and +35% more to animals' }),
  'direnni-staff': Object.freeze({ name: 'Arcane Conduit', kind: 'conduit', less: 20, mana: 3,
    brief: '-20% spell cost; hits give 3 MP', text: 'While you wield it your spells cost 20% less magicka, and each of its blows that lands restores 3 magicka' }),
  'gortwogs-cleaver': Object.freeze({ name: 'Orc Rage', kind: 'rage', heal: 10, below: 33, pct: 30,
    brief: 'Kills heal 10%; +30% when low', text: 'While you wield it each foe you kill heals you 10% of your health, and under a third of your health its blows deal +30% damage' }),
  'worms-tooth': Object.freeze({ name: 'Soul Siphon', kind: 'siphon', pct: 15,
    brief: 'Kills restore 15% magicka', text: 'While you wield it each foe you kill restores 15% of your magicka' }),
  'warp-edge': Object.freeze({ name: 'Many Endings', kind: 'echo', chance: 10,
    brief: '10% to strike twice', text: 'Each of its blows that lands strikes again, one time in ten, for the same damage' }),
  'the-warden': Object.freeze({ name: 'Last Stand', kind: 'laststand', below: 25, less: 25,
    brief: '-25% damage taken when low', text: 'Under a quarter of your health, the damage you take is lessened by a quarter' }),
  titanheart: Object.freeze({ name: 'Unyielding', kind: 'unyielding', most: 25,
    brief: 'No hurt over 25% of health', text: 'No single hurt takes more than a quarter of your health' }),
  'aegis-of-dawn': Object.freeze({ name: 'Dawnward', kind: 'dawnward', charges: 5,
    brief: 'Turns aside every 6th blow', text: 'Each foe\'s blow that lands on you charges it; at five charges, the next foe\'s blow is turned aside whole' }),
  'lysandus-visor': Object.freeze({ name: "The Ghost-King's Vigil", kind: 'vigil', below: 33, heal: 20, recover: 60,
    brief: 'Heal 20% when low (60s)', text: 'When a hurt leaves you under a third of your health, you are healed 20% of it. Recovers in 60 s' }),
  'wayrest-treads': Object.freeze({ name: "Courier's Haste", kind: 'haste', speed: 20, rounds: 2, recover: 10,
    brief: 'Kills: +20 Speed (2 rounds)', text: 'A kill fortifies your Speed by 20 for two magic rounds. Recovers in 10 s' }),
  'gauntlets-of-the-rose': Object.freeze({ name: 'Open Hand', kind: 'fists',
    brief: 'Bare-handed blows land twice', text: 'Each of your bare-handed blows that lands strikes again for the same damage' }),
  'mountains-root': Object.freeze({ name: 'Bedrock', kind: 'bedrock', less: 4, max: 5, seconds: 6,
    brief: '-4% damage a hit, up to 5', text: 'Each foe\'s blow that lands on you lessens the blows after it by 4% for 6 s, up to five times' }),
  'ravens-wings': Object.freeze({ name: "Raven's Evasion", kind: 'evade', chance: 15,
    brief: '15% to evade a blow', text: 'A foe\'s blow is turned aside whole 15 times in a hundred' }),
  'night-mothers-embrace': Object.freeze({ name: "Sweet Mother's Kiss", kind: 'execute', below: 25, pct: 50,
    brief: '+50% to foes under 25%', text: 'Your weapon blows deal +50% damage to a foe under a quarter of its health' }),
  'wall-of-daggerfall': Object.freeze({ name: 'Bulwark', kind: 'bulwark', less: 5,
    brief: 'Blows on you: -5 damage', text: 'Each foe\'s blow on you is lessened by 5 points, never under 1' }),
  foxglove: Object.freeze({ name: "Fortune's Favour", kind: 'fortune', mult: 1.5,
    brief: 'Legendaries half again likelier', text: 'While you wear it, every Legendary you find is half again as likely - its source\'s own chance, times one and a half' }),
  'kings-mark': Object.freeze({ name: 'Tribute', kind: 'tribute', gold: 5,
    brief: 'Kills pay 5 gold a level', text: 'Each foe you kill pays you 5 gold for each of its levels' }),
  'archmages-loop': Object.freeze({ name: 'Spell Mastery', kind: 'mastery', less: 15, low: 30,
    brief: '-15% spell cost, -30% when low', text: 'Your spells cost 15% less magicka, and 30% less while your magicka is under half' }),
  'amulet-of-the-nine': Object.freeze({ name: 'Divine Grace', kind: 'grace', heal: 25, recover: 180,
    brief: 'Cheat death, heal 25% (180s)', text: 'Damage that would kill you leaves you standing, healed a quarter of your health. Recovers in 180 s' }),
  'witch-sisters-ring': Object.freeze({ name: 'Hex', kind: 'hex', less: 25, seconds: 8,
    brief: 'Strikers hexed: -25% (8s)', text: 'A foe whose blow lands on you is hexed for 8 s: its blows on you are lessened by a quarter' }),
  'duelists-vambrace': Object.freeze({ name: 'First Blood', kind: 'firstblood', pct: 60,
    brief: '+60% first blow on a foe', text: 'Your first weapon blow on each foe deals +60% damage' }),
  'mark-of-the-hist': Object.freeze({ name: 'Hist-Sap', kind: 'regen', pct: 2, low: 4,
    brief: 'Regenerate 2% a round', text: 'Each magic round you regenerate 2% of your health, 4% while you are under half' }),
  'reachmans-torc': Object.freeze({ name: "Hagraven's Pact", kind: 'absorb', chance: 15,
    brief: '15% to absorb a spell', text: 'A Destruction spell that strikes you is absorbed 15 times in a hundred, as Spell Absorption is' }),
});
/** A record's power: the port's table's, else a mod's record's own `power`, else null. */
export const powerOf = (id) => (typeof id === 'string' ? (LEGENDARY_POWERS[id] ?? legendaryById(id)?.power ?? null) : null);
/** The power's line on a card and a tooltip: its name and its brief. */
export const powerLine = (p) => (p?.name && p?.brief ? `${p.name}: ${p.brief}` : '');

/** DFU-shaped, but not DFU's - the pool is the port's own, so it is
 *  allowed to grow (registerLegendary, below). */
export const allLegendaries = () => [...LEGENDARIES, ..._customLegendaries];
/** The records an item may become.
 *
 *  `exclusive` SHADOWS the rest: a registered record that names its
 *  templates and claims them outright, so the port's own weapon does
 *  not roll up as a blade forged for a dragon hunt. Nothing in DFU's
 *  own pool sets it, so the classic pairings are exactly what they
 *  were - a dagger can still be Wyrmbane or Nightwhisper. */
export function legendariesFor(item) {
  const pool = allLegendaries().filter((l) => l.group === item?.group && (!l.templates || l.templates.includes(item.templateIndex)));
  const claimed = pool.filter((l) => l.exclusive);
  return claimed.length ? claimed : pool;
}

// ── the mint ────────────────────────────────────────────────────────
/** The item's name for a tier: "Sentinel's Cuirass of the Bear"
 *  (prefix, the template, suffix). A Magic item has one word, a Rare
 *  both, a Legendary its record's name.
 *
 *  DISC29-B (Julian on Discord: a coloured-tier "iron" helmet his class was refused as leather): "the template" is the
 *  template's name AS THE MINT WROTE IT - Roleplay & Realism: Items puts Brigandine, Fur or Mail before it
 *  (rriItems.js rriVariantWord), and the class check reads that make (a brigandine helmet is leather to it, by the
 *  mod's design). Built from the bare template the word was gone: the list said "Iron Sentinel's Helmet", and the
 *  refusal read as a bug. */
export function rarityName(item, tier, affixes) {
  const template = templateByIndex(item.templateIndex)?.name;
  return nameAround(template != null ? rriVariantWord(item) + template : (item.name ?? ''), tier, affixes);
}
const nameAround = (base, tier, affixes) => {
  const names = (a, slot) => AFFIX_KINDS[a?.id]?.slot === slot && !AFFIX_KINDS[a.id].proc;   // LOOT4: a line that does something never names a piece
  const pre = affixes.find((a) => names(a, 'prefix'));
  const suf = affixes.find((a) => names(a, 'suffix'));
  const parts = [];
  if (pre) parts.push(affixWord(pre, tier));
  parts.push(base);
  if (suf) parts.push(affixWord(suf, tier));
  return parts.join(' ');
};

/** DISC29-B: THE NAMES A SAVE KEPT. A Magic or Rare piece of Roleplay & Realism: Items armour rolled before the fix
 *  carries the name built from the bare template; on load it is given the word its mint wrote ("Sentinel's Helmet of
 *  the Bear" -> "Sentinel's Brigandine Helmet of the Bear"). Only a name that IS that old build moves - a piece whose
 *  make has no word (leather, the mod off) or whose name is anything else is left as it came - so a second load finds
 *  nothing to do. In place, as the save's other repairs are; answers how many were renamed. */
export function repairRarityNames(items) {
  let n = 0;
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || typeof it !== 'object' || (it.rarity !== 'magic' && it.rarity !== 'rare') || !Array.isArray(it.affixes) || !Object.isExtensible(it)) continue;
    const word = rriVariantWord(it);
    const template = templateByIndex(it.templateIndex)?.name;
    if (!word || template == null || it.name !== nameAround(template, it.rarity, it.affixes)) continue;
    it.name = nameAround(word + template, it.rarity, it.affixes);
    n++;
  }
  return n;
}

/** The gold the affixes add. */
export const affixesWorth = (affixes) => (affixes ?? []).reduce((n, a) => n + (AFFIX_WORTH[a.id] ?? 0) * (a.value | 0), 0);

/** Apply a rolled tier to an eligible item IN PLACE: the field, the
 *  affixes, the name, the value, and a Rare's or Legendary's DFU
 *  enchantment. Common leaves the item as DFU minted it; so does any
 *  tier the ladder does not roll (SET6: an Aetheric piece is a fixed
 *  record, minted whole by systems/aetheric.js - never a roll). */
export function applyRarity(item, tier, rolls = Math.random, legendaryPool = null, { family = null } = {}) {
  if (!item || !ROLLED_TIERS.includes(tier)) return item;
  let affixes;
  let enchantment = null;
  if (tier === 'legendary') {
    const pool = legendaryPool ?? legendariesFor(item);
    if (!pool.length) return applyRarity(item, 'rare', rolls);   // no record for this item: the tier below
    const rec = pickLegendary(pool, family, rolls);   // LOOT6: a source's family weighs its own records
    affixes = rec.affixes.map((a) => ({ ...a }));
    enchantment = rec.enchantment;
    item.legendary = rec.id;
    item.name = rec.name;
  } else {
    affixes = rollAffixes(item, tier, rolls);
    item.name = rarityName(item, tier, affixes);
    if (tier === 'rare') enchantment = pick(RARE_FLAVOURS[item.group] ?? RARE_FLAVOURS.Jewellery, rolls);
  }
  item.rarity = tier;
  item.affixes = affixes;
  if (enchantment) item.enchantments = [{ type: enchantment.type, param: enchantment.param }];
  item.value = itemBaseValue(item) + affixesWorth(affixes) + (enchantment ? RARE_ENCHANT_WORTH : 0);
  return item;
}
/** What a Rare's flavour enchantment adds to its price - a flat sum,
 *  not DFU's per-effect cost table, because that table prices a
 *  made item's whole budget and a drop is not made. */
export const RARE_ENCHANT_WORTH = 600;

/** THE HOST DOOR. Roll every eligible item of a freshly generated list
 *  against the source; a no-op with the switch off or no source, so
 *  the DFU loot list is returned untouched. `luck` is the player's
 *  live luck. Returns the list for chaining. */
export function rollLootRarity(items, source, { rolls = Math.random, luck = 50 } = {}) {
  if (!lootRarityOn() || !source || !Array.isArray(items)) return items;
  const find = legendaryFindMult();   // LOOT5: the finders' word, once for the list
  const minted = [];
  for (const it of items) {
    if (!rarityEligible(it)) continue;
    it.untaken = true;   // LOOT8: a piece a source door rolled, whatever its tier - its first take counts for the drought
    const tier = rollRarity({ ...source, luck, find }, rolls);
    if (tier !== 'common') { applyRarity(it, tier, rolls, null, { family: source.family ?? null }); minted.push(it); }
  }
  // THE UNIQUE FIND, after the tiers and ONCE for the list: it adds an
  // item DFU's roll cannot produce rather than promoting one it did.
  // The added item is rolled for its own tier too, so the rarest thing
  // in the game can still turn up legendary.
  for (const found of rollUniqueFinds({ ...source, luck }, rolls)) {
    const piece = rarityEligible(found);
    if (piece) {
      const tier = rollRarity({ ...source, luck, find }, rolls);
      if (tier !== 'common') { applyRarity(found, tier, rolls, null, { family: source.family ?? null }); minted.push(found); }
    }
    if (piece || rarityRank(found) >= RARITIES.legendary.rank) found.untaken = true;   // LOOT8: a found piece too - never its ammunition
    items.push(found);
  }
  lastPass(minted, rolls);   // LOOT2: the door's last pass, after every draw it already makes
  return items;
}
/** LOOT2 (bible/06-Systems/Loot-Arc.md section 4): A DOOR'S LAST PASS over the pieces it just laddered - LOOT4: each
 *  Magic's and Rare's chance at a line that does something, then each Legendary's one-in-ten Exalted - taken after
 *  every draw the door already makes, so a seeded door's earlier pieces are still its seed's (SET6's law: the gate's
 *  spoils, a town's thanks). The commoner draw first: an Exalted never moves a proc line's roll. */
export function lastPass(pieces, rolls = Math.random) {
  for (const it of pieces ?? []) if (it?.rarity === 'magic' || it?.rarity === 'rare') rollProcLine(it, rolls);
  for (const it of pieces ?? []) if (it?.rarity === 'legendary') rollExalted(it, rolls);
}

// ── LOOT4: a line that does something ───────────────────────────────
// The Loot arc (bible/06-Systems/Loot-Arc.md section 6). LR1's six kinds are numbers a wearer carries; five more DO
// something (systems/lootPowers.js: a weapon's sear, leech and slayer's edge, armour's thorns, jewellery's focus).
// A Magic piece one time in five, a Rare a bit over one time in three, takes ONE such line in its door's last pass:
// a kind its group may carry, from its tier's band. It never names the piece (nameAround), so a Rare's two-part name
// and a Magic's one word stand as LR1 made them.
/** Per mille that a Magic or a Rare minted at a source takes a line that does something. */
export const PROC_PER_MILLE = Object.freeze({ magic: 200, rare: 350 });
let _procPerMille = PROC_PER_MILLE;
/** Tests only: the chances (null puts them back). */
export function _setProcForTests(table) { _procPerMille = table == null ? PROC_PER_MILLE : table; }
/** ADD a line that does something to a Magic or Rare IN PLACE: a kind its group may carry that it does not, from its
 *  tier's band, its price with it. Answers the line, or null when no such kind is left. */
export function addProcLine(item, rolls = Math.random) {
  if ((item?.rarity !== 'magic' && item?.rarity !== 'rare') || !Array.isArray(item.affixes)) return null;
  const kinds = AFFIX_IDS.filter((id) => AFFIX_KINDS[id].proc && AFFIX_KINDS[id].groups.includes(item.group) && !item.affixes.some((a) => a?.id === id));
  if (!kinds.length) return null;
  const id = pick(kinds, rolls);
  const k = AFFIX_KINDS[id];
  const [lo, hi] = AFFIX_RANGES[id][item.rarity];
  const value = rangeInt(lo, hi, rolls);
  const line = k.params ? { id, param: pick(k.params, rolls), value } : { id, value };
  item.affixes = [...item.affixes, line];
  item.value = (Number.isFinite(item.value) ? item.value : itemBaseValue(item)) + affixesWorth([line]);
  return line;
}
/** The chance, for a Magic or a Rare just minted at a source: one roll, then the line - never a second on a piece that
 *  carries one. Answers the line, or null. */
export function rollProcLine(item, rolls = Math.random) {
  if (!lootRarityOn() || (item?.rarity !== 'magic' && item?.rarity !== 'rare') || !Array.isArray(item.affixes)) return null;
  if (item.affixes.some((a) => AFFIX_KINDS[a?.id]?.proc)) return null;
  if (!(rolls() * 1000 < (_procPerMille[item.rarity] ?? 0))) return null;
  return addProcLine(item, rolls);
}
/** Does a line do something (LOOT4's five)? */
export const isProcAffix = (a) => !!AFFIX_KINDS[a?.id]?.proc;

// ── LOOT2: the roll seen, and the Exalted ──────────────────────────
// The Loot arc (bible/06-Systems/Loot-Arc.md section 4). A rolled line says the band it was rolled in, so two swords
// are compared by how WELL they rolled, not only by what; a Rare whose every line stands at its band's top says so; and
// a Legendary minted at a source is, one time in ten, EXALTED - one more line, of a kind its record does not carry,
// from the top half of the Legendary band. The record stays what a player learns (its name, its lore, its lines); the
// Exalted is the find.
/** Per mille that a Legendary minted at a source is Exalted. */
export const EXALTED_PER_MILLE = 100;
/** What being Exalted adds to a Legendary's price, beside its extra line's points. */
export const EXALTED_WORTH = 1000;
let _exaltedPerMille = EXALTED_PER_MILLE;
/** Tests only: the chance (null puts it back). */
export function _setExaltedForTests(perMille) { _exaltedPerMille = perMille == null ? EXALTED_PER_MILLE : perMille; }

/** How many of a Legendary's lines are its record's (the rest is an Exalted's extra); null for a piece no record holds. */
const recordLines = (item) => (item?.legendary ? (legendaryById(item.legendary)?.affixes.length ?? null) : null);
/** THE BAND a piece's line `i` was rolled in - `[lo, hi]` - or null for a line no roll made: a Legendary's record lines
 *  (its signature, fixed), an Aetheric piece's, a line past a forged record's count. */
export function affixBand(item, i) {
  const a = item?.affixes?.[i];
  if (!validAffix(a)) return null;
  if (item.rarity === 'magic' || item.rarity === 'rare') return AFFIX_RANGES[a.id][item.rarity];
  if (item.rarity === 'legendary' && item.exalted === true) {
    const own = recordLines(item);
    return own != null && i >= own ? AFFIX_RANGES[a.id].legendary : null;
  }
  return null;
}
/** One line as the card reads it: the affix's label, and its band when a roll made it - `+18% damage [10-25]`. */
export function affixLine(item, i) {
  const label = affixLabel(item?.affixes?.[i]);
  if (!label) return '';
  const band = affixBand(item, i);
  return band ? `${label} [${band[0]}-${band[1]}]` : label;
}
/** PERFECT: a Rare whose every line stands at the top of its band. Never a Magic piece - one line at its top is one
 *  Magic in eight, no word's worth. */
export function isPerfect(item) {
  if (item?.rarity !== 'rare' || !Array.isArray(item.affixes) || !item.affixes.length) return false;
  return item.affixes.every((a, i) => { const b = affixBand(item, i); return !!b && a.value === b[1]; });
}
/** The tier's words on the first line: "Exalted Legendary", "Perfect Rare", else the tier's own label. An Exalted is
 *  said while the piece is still unknown (its tile's pips say it too); a Perfect only once its numbers are read. */
export function tierLabel(item) {
  const tier = rarityOf(item);
  if (tier === 'legendary' && item?.exalted === true) return 'Exalted Legendary';
  if (tier === 'rare' && isPerfect(item) && identified(item)) return 'Perfect Rare';
  return RARITIES[tier].label;
}
/** EXALT a Legendary IN PLACE: one more line - a kind its lines do not carry and its group may, or (none left) a kind
 *  with a param its lines leave free - its value from the top half of the Legendary band; the mark, and the price.
 *  Answers whether it was exalted (never twice, never a piece that is not a Legendary, never one with no line left). */
export function exaltLegendary(item, rolls = Math.random) {
  if (item?.rarity !== 'legendary' || item.exalted === true || !Array.isArray(item.affixes)) return false;
  const kinds = AFFIX_IDS.filter((id) => AFFIX_KINDS[id].groups.includes(item.group));
  const carried = new Set(item.affixes.map((a) => a?.id));
  const freeParams = (id) => AFFIX_KINDS[id].params.filter((p) => !item.affixes.some((a) => a?.id === id && a.param === p));
  let pool = kinds.filter((id) => !carried.has(id));
  if (!pool.length) pool = kinds.filter((id) => AFFIX_KINDS[id].params && freeParams(id).length);
  if (!pool.length) return false;
  const id = pick(pool, rolls);
  const [lo, hi] = AFFIX_RANGES[id].legendary;
  const value = rangeInt(Math.ceil((lo + hi) / 2), hi, rolls);
  const k = AFFIX_KINDS[id];
  const line = k.params ? { id, param: pick(carried.has(id) ? freeParams(id) : k.params, rolls), value } : { id, value };
  item.affixes = [...item.affixes, line];
  item.exalted = true;
  item.value = (Number.isFinite(item.value) ? item.value : itemBaseValue(item)) + EXALTED_WORTH + affixesWorth([line]);
  return true;
}
/** The one-in-ten, for a Legendary just minted at a source - taken AFTER every draw its door already makes, so a seed's
 *  earlier spoils stay what they were (SET6's law). Answers whether it was exalted. */
export function rollExalted(item, rolls = Math.random) {
  if (!lootRarityOn() || item?.rarity !== 'legendary' || item.exalted === true) return false;
  if (!(rolls() * 1000 < _exaltedPerMille)) return false;
  return exaltLegendary(item, rolls);
}
/** LOOT7 (bible/06-Systems/Loot-Arc.md section 9): what a CHAMPION adds to its corpse's source - four tiers, and its
 *  quality half again (its Rare-or-better guarantee is the spawn seam's: scenes/hostCombat.js ensureChampionLoot). */
export const CHAMPION_SOURCE = Object.freeze({ tier: 4, quality: 1.5 });
/** LR4 (the audit): THE CORPSE DOOR. A foe's list carries its WORN kit
 *  too (hostCombat.equipEnemy pushes every equipped piece into
 *  entity.items and onto the equip table, writing no equipSlot), so the
 *  roll runs over the items NOT on its table: the loot it carries, not
 *  the sword it swings - a Legendary in a Daedra Lord's hand would have
 *  struck the player with it. The source is corpseSource's. */
export function rollCorpseLoot(entity, basics, { rolls = Math.random, luck = 50, qualityMult = 1 } = {}) {
  if (!lootRarityOn() || !entity) return entity?.items ?? [];
  const worn = new Set(entity.equip ? equipTableOf(entity).filter(Boolean) : []);
  const loot = (entity.items ?? []).filter((it) => it && !worn.has(it));
  const source = corpseSource(basics, entity.level, entity.mobileType);   // LOOT6: its family
  const champ = typeof entity.champion === 'string' && entity.champion !== '';   // LOOT7: a champion is a stronger source
  rollLootRarity(loot, { ...source, tier: source.tier + (champ ? CHAMPION_SOURCE.tier : 0), qualityMult: qualityMult * (champ ? CHAMPION_SOURCE.quality : 1) }, { rolls, luck });
  return entity.items;
}
/** SIGIL1 (Mac: "weapons obtained through online play recieve a sort of sigil power"; "Magic and up, found online";
 *  "Chance at the drop, then grows"): THE WIN. Every Magic, Rare or Legendary WEAPON of a list just won - a corpse's
 *  when its foe dies, a treasure pile's when it is minted - rolls its sigil once, in a session that plays online:
 *  about one in five, more with more `fighters` (systems/sigil.js rollSigil; PSCALE1's count, read at the death).
 *  Never ammunition, an artifact, a quest's item, or a weapon that already carries one. Offline, nothing. Answers
 *  how many were marked.
 *  SET4 (Sigil Sets, bible/11-Multiplayer/Sigil-Sets.md section 4 - Mac: sets "come from any source, just like
 *  weapons"): the name is SIGIL1's; the door is every sigil's now. AFTER every weapon's own rolls - so SIGIL1's draws
 *  stay the ones they were - a fresh weapon sigil joins a set of the world one time in three, and every Magic-or-better
 *  piece of ARMOUR and every SHIELD rolls a set sigil by the same chance law (systems/sigilSets.js rollSetSigil),
 *  under the same nevers: a quest's item, an artifact, a piece that already carries one. */
export function stampWonWeapons(items, fighters = 1, { rolls = Math.random } = {}) {
  if (!sigilOnline() || !lootRarityOn() || !Array.isArray(items)) return 0;
  let n = 0;
  const fresh = [];
  for (const it of items) {
    if (!it || it.group !== 'Weapons' || isAmmunition(it) || it.questItem || it.sigil) continue;
    const tier = rarityOf(it);
    if (!SIGIL_BANDS[tier]) continue;   // Common, an Aetheric's and an artifact's own tier: no band
    const s = rollSigil(tier, fighters, rolls);
    if (s) { it.sigil = s; n++; fresh.push(it); }
  }
  for (const it of fresh) { const set = rollSetJoin(rolls); if (set) it.sigil = { ...it.sigil, set }; }   // SET4: a third join a set
  for (const it of items) {
    if (!it || it.questItem || it.sigil) continue;
    const kind = setPieceKind(it);
    if (kind !== 'armor' && kind !== 'shield') continue;   // SET4: a body piece or a shield - never jewellery or clothing
    const s = rollSetSigil(rarityOf(it), fighters, rolls);
    if (s) { it.sigil = s; n++; }
  }
  return n;
}

/** The best tier in a list (a corpse's, a pile's), for the drop sound
 *  and the plaque; null for an empty or off list. */
export function bestRarity(items) {
  let best = null;
  for (const it of items ?? []) {
    const r = rarityOf(it);
    if (!best || RARITIES[r].rank > RARITIES[best].rank) best = r;
  }
  return best;
}

// ── the fold and its readers ───────────────────────────────────────
function wornItems(entity) {
  const slots = entity?.equip?.slots;
  if (slots) return slots.filter((it) => it && Array.isArray(it.affixes) && it.affixes.length);
  return (entity?.items ?? []).filter((it) => it && it.equipSlot != null && Array.isArray(it.affixes) && it.affixes.length);
}

/** THE FOLD (RF1: one of the entity's, systems/entityMods.js): every
 *  worn affix summed into one mods record - run by computeEntityMods
 *  at every equip change (equip.js's listener; the save's
 *  rebuildEquipState) and every magic round (worldTick), so a switch
 *  press is felt within a round; with the switch off it answers
 *  EMPTY_MODS and every channel reads 0. Pure over the entity. A
 *  weapon's damage affix is NOT folded - it is the weapon's own,
 *  registered below as a weapon-damage modifier. */
export function affixFold(entity) {
  if (!entity || !lootRarityOn()) return EMPTY_MODS;
  const mods = newMods();
  for (const it of wornItems(entity)) {
    for (const a of it.affixes) {
      if (!validAffix(a)) continue;   // LR4: a malformed record off the wire folds nothing
      const v = a.value | 0;
      switch (a.id) {
        // LR4 (the audit): ON THE PIECE'S OWN PARTS, as the material's
        // armour value is - entity-wide it stacked seven pieces into an
        // unhittable player. A shield covers its SHIELD_PARTS.
        case 'armor': for (const part of armorBodyParts(it)) mods.armorParts[part] += v; break;
        case 'weight': mods.weightMult += v / 100; break;
        case 'stat': mods.stats[a.param] = (mods.stats[a.param] ?? 0) + v; break;
        case 'skill': mods.skills[a.param] = (mods.skills[a.param] ?? 0) + v; break;
        case 'resist': mods.resist[a.param] = (mods.resist[a.param] ?? 0) + v; break;
        default: break;
      }
    }
  }
  return mods;
}
/** The weapon's own damage affix over its rolled damage, truncated. */
export function affixWeaponDamage(weapon, damage) {
  if (!lootRarityOn() || !Array.isArray(weapon?.affixes)) return damage;
  const pct = weapon.affixes.reduce((n, a) => n + (a.id === 'damage' ? (a.value | 0) : 0), 0);
  return pct ? Math.trunc(damage * (1 + pct / 100)) : damage;
}
export const LOOT_RARITY_FOLD = 'lootRarity';
registerEntityFold(LOOT_RARITY_FOLD, affixFold);
registerWeaponDamageMod(LOOT_RARITY_FOLD, affixWeaponDamage);

// ── the display ────────────────────────────────────────────────────
/** IsIdentified as DFU derives it (tradeModes.itemIsIdentified): an
 *  unenchanted item is always identified. Kept local so this leaf
 *  stays importable from the formulas without a cycle. */
const identified = (item) => !enchanted(item) || item?.isIdentified === true;

/** The tier line and the affix lines a tooltip or a card shows, in
 *  order: "Rare", then each affix, then the DFU enchantment's name.
 *  Empty with the switch off, for a Common item, or while the item is
 *  unidentified (then one line: the tier, and "Unidentified").
 *  SIGIL-UI: `sigil: false` leaves the sigil's lines out, for a card
 *  that draws the sigil as its own block (ui/sigilCard.js). */
/** SET6: the lore of a fixed record the ladder does not hold - an Aetheric piece's (systems/aetheric.js registers the
 *  Regalia's; it imports this file, so this one cannot import it). `fn(item) -> string | null`. */
let _aethericLore = null;
export function registerAethericLore(fn) { _aethericLore = typeof fn === 'function' ? fn : null; }
export function rarityLines(item, { sigil = true, set = true, lore = true } = {}) {
  if (!lootRarityOn() || !item) return [];
  const tier = rarityOf(item);
  if (tier === 'common') return [];
  const out = [tierLabel(item)];   // LOOT2: "Exalted Legendary", "Perfect Rare"
  if (!identified(item)) { out.push('Unidentified'); return [...out, ...(sigil ? setSigilLines(item) : []), ...(set ? setLines(item) : [])]; }   // SIGIL1: a sigil is the port's own mark, seen at once - AUDIT SET U5: and so is its set (the card draws it; the classic tooltip said nothing)
  (item.affixes ?? []).forEach((a, i) => out.push(affixLine(item, i)));   // LOOT2: a rolled line with its band
  if (item.rarity && Array.isArray(item.enchantments)) {
    for (const e of item.enchantments) {
      if (!e || e.type === T.None) continue;
      const key = Object.keys(T).find((k) => T[k] === e.type);
      const param = key ? enchantmentParamName(key, e.param) : null;
      out.push(param && param !== 'None' ? `${enchantmentName(key)}: ${param}` : enchantmentName(key ?? ''));
    }
  }
  { const p = item.legendary ? powerOf(item.legendary) : null; if (p) out.push(powerLine(p)); }   // LOOT5: its power, by name and brief
  if (sigil) out.push(...setSigilLines(item));   // SIGIL1: what the sigil gives in my hand, and how far it has grown (AUDIT SET U11: a set piece's, asleep in a duel)
  if (set) out.push(...setLines(item));   // SET5: its set - what is worn of it, and its three tiers (a card that draws the set's block asks without)
  const words = !lore ? null : item.legendary ? legendaryById(item.legendary)?.lore : item.aetheric ? (_aethericLore?.(item) ?? null) : null;   // SET6: an Aetheric piece's own; CARD-FIT: the card's list asks without (the Info box says it)
  if (words) out.push(words);
  return out;
}
/** The skin colour for an item's name, or null for Common / off. */
export function rarityColour(item) {
  if (!lootRarityOn()) return null;
  const tier = rarityOf(item);
  return tier === 'common' ? null : RARITIES[tier].colour;
}
/** The native scroller's cell tint (RGBA 0..1), or null. */
export function rarityTint(item) {
  if (!lootRarityOn()) return null;
  return RARITIES[rarityOf(item)].tint;
}
/** The data attribute the enhanced skin's rows wear, or null. */
export function rarityAttr(item) {
  if (!lootRarityOn()) return null;
  const tier = rarityOf(item);
  return tier === 'common' ? null : tier;
}
