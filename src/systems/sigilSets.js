// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SET1 (2026-09-26) — SIGIL SETS: ARMOUR THAT ANSWERS TO A DAEDRIC PRINCE.
//
// Mac: "I wanna talk about making sigil armor sets that also come with
// set builds (think having multiple of one set type grants detailed
// abilities)". Asked, Mac chose: sets "come from any source, just like
// weapons", a boss's own set at a new rarity (Aetheric), Sigil Stones
// as a currency at a vendor beside the gate; tiers at 2 / 4 / 6 pieces;
// "Grow together" - the bonuses scale with the LOWEST stage among the
// worn pieces; online only, never in duels. Then: "I want you to go all
// out on this, just like you did with the World Boss". Design, and the
// record of every slice: bible/11-Multiplayer/Sigil-Sets.md.
//
// ═══ THIS FILE IS THE LAW ══════════════════════════════════════════
//
// Pure but for the session's two words (online-ness and Renown are
// systems/sigil.js's; the duel is set here): the sets, what a set piece
// is, what an entity wears of each, the stage a set stands at, which of
// its tiers are awake and what every number in them is. What the tiers
// DO lives in systems/sigilSetPowers.js (SET3), which reads this.
//
// ═══ A SET PIECE ═══════════════════════════════════════════════════
//
// An item whose sigil names a set (sigil.js sigilSetId): a piece of
// armour, a shield, or a weapon (never ammunition) - never jewellery,
// clothing or anything else, whatever its record says. The places a
// set is worn are nine: the seven body pieces, the shield, and ONE
// weapon - Daggerfall readies a weapon in each hand and swings one at
// a time, so two weapons of a set in the two hands count once.
//
// ═══ THE STAGE AND THE NUMBERS ═════════════════════════════════════
//
// A piece's stage is its sigil's (sigilStageIn: the lower of its own
// rank and the stage its wearer's Renown opens); the SET's stage is the
// lowest of its worn pieces' - "grow together". Every number a tier has
// is given at Faint and at Ascendant, and a stage between takes its
// place on the line (stageValue). Asleep (-1): offline, online before
// the page knows its Renown, and in a duel - no tier wakes.
// ═══════════════════════════════════════════════════════════════════

import { SIGIL_STAGES, SIGIL_SET_IDS, sigilSetId, sigilRank, sigilStageIn, renownSigilStage, sigilRenown } from './sigil.js';
import { equipTableOf } from './equip.js';
import { isShieldTemplate } from './armorMaterials.js';
import { isAmmunition } from './itemTemplates.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';

/** The pieces a set's tiers wake at. */
export const SET_TIERS = Object.freeze([2, 4, 6]);
/** The last stage (Ascendant): the numbers' line runs from 0 to it. */
export const SET_STAGE_MAX = SIGIL_STAGES.length - 1;

/** The nine places a set is worn - the equip slots of the body pieces and the shield's hand; the weapon is its own
 *  (either hand, once a set). In the order a card lists them. */
export const SET_BODY_SLOTS = Object.freeze([
  EQUIP_SLOTS.Head, EQUIP_SLOTS.RightArm, EQUIP_SLOTS.LeftArm, EQUIP_SLOTS.ChestArmor,
  EQUIP_SLOTS.Gloves, EQUIP_SLOTS.LegsArmor, EQUIP_SLOTS.Feet,
]);
export const SET_PLACES = Object.freeze(['head', 'right arm', 'left arm', 'chest', 'hands', 'legs', 'feet', 'shield', 'weapon']);

// ── the abilities' own constants (what the tiers' words name; sigilSetPowers.js reads them) ──
/** Dagon's Brand (6): a Rampage stack lasts this long, a kill refreshing every one, and no more than this many stand. */
export const RAMPAGE_SECONDS = 12;
export const RAMPAGE_STACKS = 3;
/** Ruhn's Regalia (4): Cleave finds the other foe within this many metres of the one struck. */
export const CLEAVE_METRES = 3;
/** Ruhn's Regalia (6): the Wrath wakes when a blow leaves you under this share of your health; its Nova reaches this
 *  far; its fury lasts this long. */
export const WRATH_BELOW = 0.3;
export const NOVA_METRES = 6;
export const WRATH_SECONDS = 10;

const tier = (at, key, name, values, text) => Object.freeze({ at, key, name, values: Object.freeze(values), text });

/**
 * THE SETS. Each: its id (the sigil's `set`), its name, its Prince, its colour, the one line that says what it is for,
 * `aetheric` for a boss's own, and its three tiers - each `{ at, key, name, values: { name: [faint, ascendant] },
 * text(v) }`, `text` saying the tier with the numbers of a stage.
 */
export const SIGIL_SETS = Object.freeze({
  malacath: Object.freeze({
    id: 'malacath', name: "Malacath's Bulwark", prince: 'Malacath', colour: '#a4b84e', aetheric: false,
    role: 'The one who will not fall',
    tiers: Object.freeze([
      tier(2, 'orc-hide', 'Orc-Hide', { armor: [2, 5], endurance: [2, 6] },
        (v) => `+${v.armor} armour on every part, +${v.endurance} Endurance`),
      tier(4, 'spite', 'Spite of the Spurned', { back: [10, 30] },
        (v) => `A foe whose weapon lands on you takes ${v.back}% of the blow back`),
      tier(6, 'unbroken', 'Unbroken', { halved: [4, 8], recover: [300, 150] },
        (v) => `A blow that would kill you leaves you at 1 health, and every blow on you is halved for ${v.halved} s. Recovers in ${v.recover} s`),
    ]),
  }),
  dagon: Object.freeze({
    id: 'dagon', name: "Dagon's Brand", prince: 'Mehrunes Dagon', colour: '#ec5a3c', aetheric: false,
    role: 'The one who does not stop',
    tiers: Object.freeze([
      tier(2, 'ravager', 'Ravager', { strength: [2, 6], critical: [4, 12] },
        (v) => `+${v.strength} Strength, +${v.critical} Critical Strike`),
      tier(4, 'bloodfury', 'Bloodfury', { more: [4, 12] },
        (v) => `Your weapon blows deal +${v.more}% damage, +${v.more * 2}% below half health`),
      tier(6, 'rampage', 'Rampage', { stack: [4, 10] },
        (v) => `Each kill grants a Rampage stack for ${RAMPAGE_SECONDS} s, up to ${RAMPAGE_STACKS}: +${v.stack}% weapon damage a stack`),
    ]),
  }),
  nocturnal: Object.freeze({
    id: 'nocturnal', name: "Nocturnal's Shroud", prince: 'Nocturnal', colour: '#9384f2', aetheric: false,
    role: 'The one who is not seen',
    tiers: Object.freeze([
      tier(2, 'shadows-grace', "Shadow's Grace", { stealth: [4, 12], agility: [2, 6] },
        (v) => `+${v.stealth} Stealth, +${v.agility} Agility`),
      tier(4, 'nightfall', 'Nightfall Strike', { more: [25, 60] },
        (v) => `A blow at a foe that has not noticed you deals +${v.more}% damage, arrows too`),
      tier(6, 'eventide', 'Eventide', { cloak: [2, 6], recover: [30, 15] },
        (v) => `A kill wraps you in shadow for ${v.cloak} s. Recovers in ${v.recover} s`),
    ]),
  }),
  mora: Object.freeze({
    id: 'mora', name: "Mora's Mantle", prince: 'Hermaeus Mora', colour: '#43c49b', aetheric: false,
    role: 'The one who knows',
    tiers: Object.freeze([
      tier(2, 'forbidden-lore', 'Forbidden Lore', { intelligence: [2, 6], schools: [2, 6] },
        (v) => `+${v.intelligence} Intelligence, +${v.schools} to every school of magic`),
      tier(4, 'waters', 'Waters of Oblivion', { less: [5, 15] },
        (v) => `Your spells cost ${v.less}% less magicka`),
      tier(6, 'eye', 'Eye of Mora', { absorb: [10, 30] },
        (v) => `A hostile spell that strikes you is drunk ${v.absorb}% of the time: nothing lands, and its magicka is yours`),
    ]),
  }),
  ruhn: Object.freeze({
    id: 'ruhn', name: "Ruhn's Regalia", prince: 'Mehrunes Dagon', colour: '#ffae45', aetheric: true,
    role: 'The Warden of the Burning Gate, worn',
    tiers: Object.freeze([
      tier(2, 'burning-gate', 'The Burning Gate', { fire: [15, 45], sear: [2, 6] },
        (v) => `+${v.fire} fire resistance; your weapon blows sear for ${v.sear} more damage`),
      tier(4, 'cleave', 'Cleave', { share: [25, 60] },
        (v) => `Your melee blows also strike the nearest other foe within ${CLEAVE_METRES} m of your target for ${v.share}% of the blow`),
      tier(6, 'wrath', 'Wrath of the Warden', { nova: [10, 40], more: [10, 25], recover: [180, 90] },
        (v) => `When a blow leaves you under ${Math.round(WRATH_BELOW * 100)}% health, a Flame Nova deals ${v.nova} damage to every foe within ${NOVA_METRES} m, and your weapon blows deal +${v.more}% for ${WRATH_SECONDS} s. Recovers in ${v.recover} s`),
    ]),
  }),
});
/** The sets of the world (the four any win may roll), and every set, in the registry's order. */
export const WORLD_SET_IDS = Object.freeze(Object.values(SIGIL_SETS).filter((s) => !s.aetheric).map((s) => s.id));
export const setById = (id) => (typeof id === 'string' && Object.hasOwn(SIGIL_SETS, id) ? SIGIL_SETS[id] : null);

/** A number of a tier at a stage: its place on the line from Faint to Ascendant, rounded. Stage clamped to 0..4. */
export function stageValue(pair, stage) {
  const [faint, asc] = pair;
  const s = Math.max(0, Math.min(SET_STAGE_MAX, Math.trunc(Number(stage) || 0)));
  return Math.round(faint + ((asc - faint) * s) / SET_STAGE_MAX);
}
/** Every number of a tier at a stage. */
export function tierValues(t, stage) {
  const out = {};
  for (const [k, pair] of Object.entries(t.values)) out[k] = stageValue(pair, stage);
  return out;
}

/** The kind of place an item is worn in, if it may be a set piece at all: 'armor' (a body piece), 'shield', 'weapon',
 *  or null (jewellery, clothing, ammunition, anything else). */
export function setPieceKind(item) {
  if (!item) return null;
  if (item.group === 'Armor') return isShieldTemplate(item.templateIndex) ? 'shield' : 'armor';
  if (item.group === 'Weapons') return isAmmunition(item) ? null : 'weapon';
  return null;
}
/** The set an item is a piece of, or null: its sigil names one AND it is a kind a set may be worn as. */
export const setIdOf = (item) => (setPieceKind(item) ? sigilSetId(item?.sigil) : null);
export const isSetPiece = (item) => setIdOf(item) != null;

/**
 * THE WORN PIECES, per set: `Map<id, item[]>`, in the registry's order - the body pieces and the shield where they
 * are worn, and one weapon a set (the right hand's before the left's: the first found). An entity that wears no set
 * piece answers an empty map. The table is the entity's equip table (equip.js equipTableOf); a piece in the pack
 * counts for nothing.
 */
export function wornSetPieces(entity) {
  /** @type {Map<string, any[]>} */
  const out = new Map();
  const slots = entity?.equip ? equipTableOf(entity) : null;
  if (!slots) return out;
  const add = (it) => { const id = setIdOf(it); if (!id) return; if (!out.has(id)) out.set(id, []); out.get(id).push(it); };
  for (const slot of SET_BODY_SLOTS) { const it = slots[slot]; if (it && setPieceKind(it) === 'armor') add(it); }
  const left = slots[EQUIP_SLOTS.LeftHand], right = slots[EQUIP_SLOTS.RightHand];
  if (left && setPieceKind(left) === 'shield') add(left);
  const weaponOf = new Set();
  for (const hand of [right, left]) {
    if (!hand || setPieceKind(hand) !== 'weapon') continue;
    const id = setIdOf(hand);
    if (!id || weaponOf.has(id)) continue;   // one weapon a set
    weaponOf.add(id);
    add(hand);
  }
  // the registry's order, whatever order the table gave
  return new Map([...out.entries()].sort((a, b) => SIGIL_SET_IDS.indexOf(a[0]) - SIGIL_SET_IDS.indexOf(b[0])));
}

// ── the session: the duel (online-ness and Renown are sigil.js's) ──
let _dueling = false;
/** The host's word (scenes/world.js, at a duel's start and end): the player is in a duel, and every set sleeps. */
export function setSetsDueling(on) { _dueling = !!on; }
export const setsDueling = () => _dueling;
/** Are sets awake at all: online, my Renown known, not in a duel. */
export const setsAwake = () => sigilRenown() != null && !_dueling;

/**
 * A WORN SET'S STATE for a Renown: how many of its pieces are worn, the stage it stands at (-1 asleep), what holds it
 * there - `heldPiece`, the worn piece of the lowest rank when it is no higher than the Renown's stage (the one to
 * grow), and `heldRenown` when the Renown's stage is no higher than that piece's (both, when they meet; neither at
 * Ascendant or asleep) - and its three tiers, each awake or not with its numbers AT THE SET'S STAGE (Faint's while it
 * sleeps, so a card can still say what it would do).
 * @param {string} id @param {Array<{ sigil?: any }>} pieces @param {number|null} renown @param {boolean} [awake]
 */
export function setState(id, pieces, renown, awake = true) {
  const set = setById(id);
  if (!set) return null;
  const count = pieces.length;
  const cap = awake ? renownSigilStage(renown) : -1;
  let low = null, lowRank = SET_STAGE_MAX + 1;
  for (const p of pieces) { const r = sigilRank(p.sigil); if (r < lowRank) { lowRank = r; low = p; } }
  const stage = cap < 0 || !count ? -1 : Math.min(lowRank, cap);
  let heldPiece = null, heldRenown = false;
  if (stage >= 0 && stage < SET_STAGE_MAX) { heldPiece = lowRank <= cap ? low : null; heldRenown = cap <= lowRank; }
  const at = Math.max(0, stage);
  return {
    id, set, count, stage, heldPiece, heldRenown,
    renownNext: heldRenown ? SIGIL_STAGES[stage + 1].renown : null,   // the Renown that opens the next stage
    stageName: stage < 0 ? 'Dormant' : SIGIL_STAGES[stage].name,
    tiers: set.tiers.map((t) => {
      const values = tierValues(t, at);
      return { at: t.at, key: t.key, name: t.name, awake: stage >= 0 && count >= t.at, values, text: t.text(values),
        full: t.text(tierValues(t, SET_STAGE_MAX)) };
    }),
  };
}
/** Every set an entity wears at least one piece of, in the registry's order - what the card, the paperdoll and the
 *  powers read. `renown` and `awake` default to the session's. */
export function wornSets(entity, renown = sigilRenown(), awake = setsAwake()) {
  const out = [];
  for (const [id, pieces] of wornSetPieces(entity)) { const st = setState(id, pieces, renown, awake); if (st) out.push(st); }
  return out;
}
/**
 * THE POWERS' ONE QUESTION: the numbers of tier `index` (0, 1, 2 - the 2-, 4- and 6-piece) of set `id` if it is awake
 * on this entity now, else null. Only the player's own sets are ever awake (a peer's entity here, or a foe, answers
 * null): the Renown the session knows is mine.
 */
export function awakeTier(entity, id, index) {
  if (!entity?.isPlayer || entity.peer || !setsAwake()) return null;
  const pieces = wornSetPieces(entity).get(id);
  if (!pieces) return null;
  const st = setState(id, pieces, sigilRenown(), true);
  const t = st?.tiers[index];
  return t && t.awake ? t.values : null;
}

/** Tests only: forget the duel. */
export function _resetSigilSetsForTests() { _dueling = false; }
