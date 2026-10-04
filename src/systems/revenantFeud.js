// @ts-check
// FEUD, Part B - RVN (bible/12-Enhanced-AI/Feud-Arc.md sections 12-26; Mac, 2026-10-04: "I want to improve the revenant
// system to be more complex, less easy to accomplish and more detailed", then "Go" on every call): A REVENANT WITH A
// MEMORY. systems/revenant.js keeps the record and its deeds; this sibling keeps what FEUD adds to it - every RVN number
// in one place, the law of every new field (its validator, and the value an older record derives from its id), the
// scars a fight leaves (the ledger is systems/feudLedger.js, a leaf), and the draws a revenant is born with: its
// WEAKNESS, its SIGNATURE and its KIN.
//
// DRAWS. A record's identity draws run on a stream SEEDED by its id and a salt (FNV-1a, then mulberry32) - one id, one
// answer, on every client and every load, and nobody's dice moved: the shared DFRandom (formats/dfRandom.js), which the
// given name borrows and puts back, is never touched here.
import { MOBILE_TYPES as M } from '../characters/mobileTypes.js';
import { factionOf } from '../characters/mobileFactions.js';
import { weaponSkillUsed, WEAPON_MATERIALS } from '../characters/weapons.js';
import { SKILLS } from './skills.js';
import { setItemFields } from './itemTemplates.js';
import { FEUD_CLASSES } from './feudLedger.js';

// ── the numbers (section 27) ────────────────────────────────────────
/** RVN1: a fight's leading source - this share of the damage dealt or more - is a scar. */
export const SCAR_SHARE = 0.4;
/** RVN1: how many scars a record keeps (the latest). */
export const SCAR_MAX = 6;
/** RVN1: a fight's other lessons - staggered this often, this many blows dodged, this many at its back. */
export const SCAR_STAGGERS = 2;
export const SCAR_DODGED = 3;
export const SCAR_BACK = 3;
/** RVN2: a revenant holds at most its rank's adaptations, and never more than this. */
export const ADAPT_MAX = 3;
/** RVN3: from this rank its will must be broken; this many staggers break it. */
export const WILL_RANK = 3;
export const WILL_STAGGERS = 2;
/** RVN5: from this rank a revenant has a signature blow. */
export const SIG_RANK = 2;
/** RVN6: its band's size by rank (1 to 5). */
export const RETINUE = Object.freeze([0, 0, 1, 2, 3, 3]);
/** RVN8: the most it holds of what it took. */
export const TOOK_MAX = 3;
/** RVN9: its wrath, at most. */
export const WRATH_MAX = 3;

// ── the scars (section 12) ──────────────────────────────────────────
/** What a fight can leave on a record: a leading source (a weapon class, an element, `silver`), `mixed` (none leading),
 *  a fight's other lessons, and the deed itself. */
export const SCAR_KINDS = Object.freeze([
  ...FEUD_CLASSES, 'silver', 'mixed', 'staggered', 'dodged', 'back', 'night',
  'slew', 'fled', 'felled', 'routed', 'festered', 'deserted', 'betrayed', 'laststand',
]);
const SCAR_SET = new Set(SCAR_KINDS);
/** RVN1: the scars a fight's ledger leaves at its deed (`deedName`), its leading one first: its leading source (40% of
 *  what was dealt or more), else `mixed` - none with nothing dealt; silver at 40%; staggered twice, three blows dodged,
 *  three at its back or a backstab; a fight begun by night; and the deed. */
export function feudScars(ledger, deedName = null) {
  const out = [];
  if (ledger) {
    const dmg = ledger.dmg ?? {};
    let total = 0, lead = null, leadN = 0;
    for (const k of FEUD_CLASSES) {
      const n = Number(dmg[k]) || 0;
      total += n;
      if (n > leadN) { lead = k; leadN = n; }
    }
    if (total > 0) out.push(leadN / total >= SCAR_SHARE ? lead : 'mixed');
    if (total > 0 && (Number(ledger.silver) || 0) / total >= SCAR_SHARE) out.push('silver');
    if ((ledger.staggers | 0) >= SCAR_STAGGERS) out.push('staggered');
    if ((ledger.dodged | 0) >= SCAR_DODGED) out.push('dodged');
    if ((ledger.backHits | 0) >= SCAR_BACK || ledger.backstab === true) out.push('back');
    if (ledger.night === true) out.push('night');
  }
  if (deedName && SCAR_SET.has(deedName)) out.push(deedName);
  return out;
}
/** The record's scars with `kinds` added at minute `at`, the latest SCAR_MAX kept. */
export function withScars(scars, kinds, at) {
  const out = [...(scars ?? []), ...kinds.map((k) => ({ k, at }))];
  return out.slice(-SCAR_MAX);
}
const sanitizeScars = (v) => (Array.isArray(v) ? v.filter((s) => s && SCAR_SET.has(s.k) && Number.isFinite(s.at)).map((s) => ({ k: s.k, at: s.at })).slice(-SCAR_MAX) : []);

/** RVN1: what the player's blow was, as the ledger counts it - a weapon's class by its skill (a bow's shaft an arrow,
 *  bare hands and claws hand-to-hand), and whether its metal was silver. */
export function weaponFeudClass(weapon) {
  if (!weapon) return { cls: 'h2h', silver: false };
  let skill = null;
  try { skill = Number.isInteger(weapon.templateIndex) ? weaponSkillUsed(weapon.templateIndex) : null; } catch { skill = null; }
  const cls = skill === SKILLS.ShortBlade || skill === SKILLS.LongBlade ? 'blade'
    : skill === SKILLS.BluntWeapon ? 'blunt' : skill === SKILLS.Axe ? 'axe'
      : skill === SKILLS.Archery ? 'arrow' : skill === SKILLS.HandToHand ? 'h2h' : 'other';
  return { cls, silver: weapon.material === WEAPON_MATERIALS.Silver };
}

// ── draws on the id ─────────────────────────────────────────────────
/** A small stable hash (FNV-1a) of a string - a draw's seed (systems/revenant.js's names too). */
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** The id's own stream for one draw (`salt` names it): mulberry32 on the id's hash - never the shared DFRandom. */
export function idStream(id, salt) {
  let a = hashStr(`${id}|${salt}`) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** One of a weighted pool `[[value, weight], ...]` on `rolls`. */
function weighted(pool, rolls) {
  const total = pool.reduce((a, [, w]) => a + w, 0);
  if (!(total > 0)) return null;
  let x = rolls() * total;
  for (const [v, w] of pool) { if ((x -= w) < 0) return v; }
  return pool[pool.length - 1][0];
}

// ── RVN3's weakness (section 14.1) ──────────────────────────────────
/** A weakness: an element, a metal, a weapon class, or the daylight. */
export const WEAKNESS_ELEMENTS = Object.freeze(['fire', 'frost', 'shock', 'poison', 'magic']);
export const WEAKNESS_METALS = Object.freeze(['silver', 'dwarven', 'elven']);
export const WEAKNESS_WEAPONS = Object.freeze(['blunt', 'axe', 'blade', 'arrow', 'h2h']);
export const WEAKNESSES = Object.freeze([...WEAKNESS_ELEMENTS, ...WEAKNESS_METALS, ...WEAKNESS_WEAPONS, 'daylight']);
const WEAKNESS_SET = new Set(WEAKNESSES);
export const isWeakness = (v) => typeof v === 'string' && WEAKNESS_SET.has(v);
/** What kind of weakness it is - the hint a rumour or a flinch gives ('element', 'metal', 'weapon', 'sun'). */
export const weaknessKind = (w) => (WEAKNESS_ELEMENTS.includes(w) ? 'element' : WEAKNESS_METALS.includes(w) ? 'metal' : w === 'daylight' ? 'sun' : WEAKNESS_WEAPONS.includes(w) ? 'weapon' : null);
/** An element's bit in a career's tolerance flags (systems/spellcast.js EFFECT_FLAGS). */
const ELEMENT_FLAG = Object.freeze({ fire: 8, frost: 16, poison: 4, shock: 32, magic: 2 });

const UNDEAD = new Set([M.SkeletalWarrior, M.Zombie, M.Ghost, M.Wraith, M.Mummy, M.Lich, M.AncientLich]);
const DAEDRA = new Set([M.FrostDaedra, M.FireDaedra, M.Daedroth, M.DaedraSeducer, M.DaedraLord]);
const ATRONACHS = new Set([M.FireAtronach, M.IronAtronach, M.FleshAtronach, M.IceAtronach]);
const WEREBEASTS = new Set([M.Werewolf, M.Wereboar]);
const VAMPIRES = new Set([M.Vampire, M.VampireAncient]);
const ORCS_GIANTS = new Set([M.Orc, M.OrcSergeant, M.OrcShaman, M.OrcWarlord, M.Giant]);
/** An elemental kind's opposite (the table's "its opposite"): fire and frost, each the other's. Decided here: a kind of
 *  no element (the Daedroth, a Seducer, the Daedra Lord; the iron and flesh atronachs) has none. */
const OPPOSITE = new Map([[M.FireDaedra, 'frost'], [M.FrostDaedra, 'fire'], [M.FireAtronach, 'frost'], [M.IceAtronach, 'fire']]);

/** The weighted pool a kind's weakness is drawn from (section 14.1's table; every monster not named there is a beast). */
export function weaknessPool(mobileType) {
  const t = mobileType;
  const opp = OPPOSITE.get(t);
  if (UNDEAD.has(t)) return [['fire', 3], ['magic', 1], ['silver', 2], ['blunt', 2], ['daylight', 2]];
  if (DAEDRA.has(t)) return [...(opp ? [[opp, 3]] : []), ['shock', 1], ['magic', 1]];
  if (ATRONACHS.has(t)) return [...(opp ? [[opp, 3]] : []), ['shock', 1], ['blunt', 1]];
  if (VAMPIRES.has(t)) return [['fire', 1], ['dwarven', 2], ['daylight', 2]];
  if (WEREBEASTS.has(t)) return [['fire', 1], ['dwarven', 2]];
  if (ORCS_GIANTS.has(t)) return [['fire', 1], ['shock', 1], ['elven', 1], ['arrow', 1], ['blade', 1]];
  if (t >= 128) return [...WEAKNESS_ELEMENTS.map((e) => [e, 1]), ['silver', 1], ['dwarven', 1], ['blunt', 1], ['axe', 1], ['blade', 1], ['arrow', 1], ['h2h', 1]];
  return [['fire', 2], ['frost', 1], ['axe', 1], ['arrow', 1]];
}
/** RVN3: its weakness, drawn on its id from its kind's pool - never an element its career resists or is immune to
 *  (`career` its tolerance flags, when known). */
export function drawWeakness(id, mobileType, career = null) {
  const shut = ((career?.resistanceFlags | 0) | (career?.immunityFlags | 0)) >>> 0;
  const pool = weaknessPool(mobileType).filter(([w]) => !(ELEMENT_FLAG[w] && (shut & ELEMENT_FLAG[w])));
  return weighted(pool.length ? pool : [['blunt', 1]], idStream(id, 'weak')) ?? 'blunt';
}
/** Is `weak` an element `career` resists or is immune to (an older record's draw, met with its career at a stand)? */
export const weaknessShut = (weak, career) => !!(ELEMENT_FLAG[weak] && ((((career?.resistanceFlags | 0) | (career?.immunityFlags | 0)) >>> 0) & ELEMENT_FLAG[weak]));

// ── RVN5's signature (section 16.1) ─────────────────────────────────
/** Its signature's shape. */
export const SIGNATURES = Object.freeze(['slam', 'charge', 'leap', 'ring', 'pyre']);
const SIG_SET = new Set(SIGNATURES);
export const isSignature = (v) => typeof v === 'string' && SIG_SET.has(v);
/** The family the brain throws for (ai/foeBlows.js blowFamily's table, read without the brain): a blade, a beast, a
 *  brute - or none (a caster, a spectral, a small kind, a flyer). */
const BEASTS = new Set([M.GrizzlyBear, M.SabertoothTiger, M.Spider, M.Werewolf, M.Wereboar, M.GiantScorpion, M.Dragonling, M.Dragonling_Alternate]);
const BRUTES = new Set([M.Giant, M.OrcWarlord, M.Daedroth, M.DaedraLord, M.IronAtronach, M.FleshAtronach, M.Gargoyle, M.Dreugh]);
const BLADES = new Set([M.Centaur, M.Orc, M.OrcSergeant, M.SkeletalWarrior, M.Mummy, M.Vampire, M.VampireAncient, M.FrostDaedra, M.FireDaedra, M.DaedraSeducer, M.Lamia]);
const CASTER_CLASSES = new Set([M.Mage, M.Sorcerer, M.Healer]);
export function signatureFamily(mobileType) {
  if (BEASTS.has(mobileType)) return 'beast';
  if (BRUTES.has(mobileType)) return 'brute';
  if (BLADES.has(mobileType)) return 'blade';
  if (mobileType >= 128 && mobileType !== M.None) return CASTER_CLASSES.has(mobileType) ? null : 'blade';
  return null;
}
const SIG_POOL = Object.freeze({ blade: ['slam', 'charge'], beast: ['charge', 'leap'], brute: ['ring', 'charge'] });
/** RVN5: its signature, drawn on its id from the shapes past its family's ordinary set; no family, the pyre. */
export function drawSignature(id, mobileType) {
  const fam = signatureFamily(mobileType);
  const pool = fam ? SIG_POOL[fam] : null;
  if (!pool) return 'pyre';
  return pool[Math.min(pool.length - 1, Math.floor(idStream(id, 'sig')() * pool.length))];
}

// ── RVN6's kin (section 17) ─────────────────────────────────────────
/** A person's class family: who rides with whom.
 *  @type {readonly number[][]} */
const CLASS_FAMILIES = Object.freeze([
  [M.Warrior, M.Barbarian, M.Knight],
  [M.Thief, M.Rogue, M.Burglar, M.Acrobat, M.Assassin],
  [M.Mage, M.Sorcerer, M.Battlemage, M.Spellsword, M.Healer, M.Nightblade],
  [M.Archer, M.Ranger, M.Monk, M.Bard],
]);
/** The kinds that may ride in its band. A person its class's family; a monster its faction's (orcs bring orcs, the
 *  undead their own); a beast, a vermin or a fish its own kind. Decided here: a solitary kind (a giant, a daedra, a
 *  lich, an atronach - mobileFactions.js SOLITARY_TYPES) rides alone. */
export function kinPool(mobileType) {
  if (mobileType >= 128) return CLASS_FAMILIES.find((f) => f.includes(mobileType)) ?? [];
  const fac = factionOf(mobileType);
  if (!fac) return [];
  const members = {
    ORC: [M.Orc, M.OrcSergeant, M.OrcShaman],
    UNDEAD: [M.SkeletalWarrior, M.Zombie, M.Ghost, M.Wraith],
    WEREBEAST: [M.Werewolf, M.Wereboar],
    FAE: [M.Centaur, M.Harpy, M.Gargoyle],
  }[fac];
  return members ?? [mobileType];   // a beast, a vermin, a fish (BEASTPACK, VERMIN, AQUATIC): its own kind
}
/** RVN6: its kin, drawn on its id - as many as its band can ever hold (RETINUE's most), each from its pool. */
export function drawKin(id, mobileType) {
  const pool = kinPool(mobileType);
  if (!pool.length) return [];
  const rolls = idStream(id, 'kin');
  const n = Math.max(...RETINUE);
  return Array.from({ length: n }, () => pool[Math.min(pool.length - 1, Math.floor(rolls() * pool.length))]);
}
const sanitizeKin = (v) => (Array.isArray(v) ? v.filter((t) => Number.isInteger(t) && ((t >= 0 && t < 128) || (t >= 128 && t < M.Knight_CityWatch))).slice(0, Math.max(...RETINUE)) : null);

// ── RVN11's loyalty (section 22.1) ──────────────────────────────────
/** A sworn one's loyalty when it is sworn, by its personality. */
export const LOYALTY_START = Object.freeze({ honourable: 80, weary: 70, humorous: 65, cold: 65, witty: 60, zealous: 60, arrogant: 55, brutal: 55, craven: 45, unhinged: 40 });
export const loyaltyStart = (personality) => LOYALTY_START[personality] ?? 60;
/** A loyalty read back: 0-100, else its personality's start. */
export const sanitizeLoyalty = (v, personality) => (Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : loyaltyStart(personality));

// ── RVN7's lair (section 18.1) ──────────────────────────────────────
const sanitizeLair = (v) => (v && typeof v === 'object' && Number.isInteger(v.px) && Number.isInteger(v.py) && typeof v.name === 'string' && v.name
  ? { px: v.px, py: v.py, name: v.name.slice(0, 80), region: Number.isInteger(v.region) ? v.region : -1 } : null);

// ── RVN2's adaptations (section 13.2) ───────────────────────────────
/** The adaptations a revenant can learn (their effects are RVN2's). */
export const ADAPTATIONS = Object.freeze(['mailed', 'braced', 'hewnHard', 'unflinching', 'arrowWise', 'fireproof', 'rimebound', 'grounded', 'venomBlooded', 'spellScarred', 'silverScarred', 'steadfast', 'patient', 'watchful', 'relentless', 'nightStalker']);
const ADAPT_SET = new Set(ADAPTATIONS);
export const isAdaptation = (v) => typeof v === 'string' && ADAPT_SET.has(v);

// ── the record, whole (section 26) ──────────────────────────────────
/** RVN1: every field FEUD adds to a revenant's record, read back (a save, the mirror, a merge) - each checked by its
 *  validator, and an older record's derived (the weakness, the signature at rank 2 and up, the kin - on its id; the
 *  fights it has had from its counts). `r` the raw record (its id, kind, rank and counts already checked). */
export function feudFields(r, { id, mobileType, rank }) {
  const fights = Number.isInteger(r.fights) && r.fights >= 0 ? r.fights : (r.kills | 0) + (r.escapes | 0) + (r.returns | 0);
  return {
    scars: sanitizeScars(r.scars),
    learned: Array.isArray(r.learned) ? [...new Set(r.learned.filter(isAdaptation))].slice(-ADAPT_MAX) : [],
    weak: isWeakness(r.weak) ? r.weak : drawWeakness(id, mobileType),
    weakKnown: /** @type {0|1|2} */ (r.weakKnown === 1 || r.weakKnown === 2 ? r.weakKnown : 0),
    sig: rank >= SIG_RANK ? (isSignature(r.sig) ? r.sig : drawSignature(id, mobileType)) : null,
    kin: sanitizeKin(r.kin) ?? drawKin(id, mobileType),
    lair: sanitizeLair(r.lair),
    lairKnown: r.lairKnown === true && !!sanitizeLair(r.lair),
    took: Array.isArray(r.took) ? r.took.filter((it) => it && typeof it === 'object' && Number.isInteger(it.templateIndex)).slice(0, TOOK_MAX).map((it) => setItemFields(it)) : [],
    wrath: Number.isInteger(r.wrath) ? Math.max(0, Math.min(WRATH_MAX, r.wrath)) : 0,
    fights,
  };
}
/** RVN1: the fields of a record born now (section 26's, fresh): its weakness drawn against its career when known. */
export function newFeudFields(id, mobileType, rank, career = null) {
  return {
    scars: [], learned: [], weak: drawWeakness(id, mobileType, career), weakKnown: /** @type {0} */ (0),
    sig: rank >= SIG_RANK ? drawSignature(id, mobileType) : null, kin: drawKin(id, mobileType),
    lair: null, lairKnown: false, took: [], wrath: 0, fights: 0,
  };
}
