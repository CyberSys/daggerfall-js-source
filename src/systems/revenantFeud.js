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
import { possessive } from './revenantPersonality.js';   // RVN5: a signature's name

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
/** RVN2 (section 13.2): what each adaptation does. Never immunity: a weapon class falls to `TAKEN_FLOOR` at the least,
 *  an element by `RESIST` on the saving throw; nothing touches its weakness (RVN3). RVN2, as built: the arc's +50 was
 *  immunity - DFU's throw starts at 50 and answers 0 at 100, BEFORE its 95 cap (spellcast.js savingThrow) - so +25,
 *  DFU's own Resistant: about x0.55 of a plain body's expected damage at Willpower 50, beside the classes' x0.6-0.75. */
export const ADAPT = Object.freeze({
  TAKEN: Object.freeze({ mailed: Object.freeze(['blade', 0.7]), braced: Object.freeze(['blunt', 0.75]), hewnHard: Object.freeze(['axe', 0.7]), unflinching: Object.freeze(['h2h', 0.6]), arrowWise: Object.freeze(['arrow', 0.7]) }),
  TAKEN_FLOOR: 0.6,
  RESIST_OF: Object.freeze({ fireproof: 'fire', rimebound: 'frost', grounded: 'shock', venomBlooded: 'poison', spellScarred: 'magic' }),
  RESIST: 25,
  BRACED_POISE: 1.4,
  STEADFAST_POISE: 1.5,
  STEADFAST_IRON: 0.5,          // one blow in two iron
  PATIENT_TRACK: 0.7,           // it tracks through this share of a wind-up (TELL5's 0.5)
  PATIENT_FEINT: 1 / 3,         // a blade feints one wind-up in this (TELL5's 1 in 5)
  PATIENT_WIND: Object.freeze([0.85, 1.35]),   // its wind-ups' lengths, U(these) (TELL5's 0.9-1.25)
  ARROW_SPEED: 20,              // Speed while its target is past...
  ARROW_FAR: 8,                 // ...this many metres
  RELENTLESS_SPEED: 25,
  NIGHT_BLOWS: 1.15,            // a Night-stalker's blows (it comes only by night)
});
/** RVN3: from this rank its will must be broken; this many staggers break it. */
export const WILL_RANK = 3;
export const WILL_STAGGERS = 2;
/** RVN3 (14.1): a blow of its weakness (a weapon class or a metal) x1.5; a daylight weakness x1.25 on every blow while
 *  the sky reads day; an element's on the saving throw (the fold); its poise weight x2 is TELL's (`POISE_WEAK`). */
export const WEAK = Object.freeze({ STRUCK: 1.5, DAYLIGHT: 1.25, RESIST: -50 });
/** RVN3 (14.1): under this share of its health with its weakness unknown, it flinches - once a stand. */
export const FLINCH_HEALTH = 0.5;
/** RVN4 (section 15): from this rank, once a stand, the blow that would kneel or kill it brings it back - to this share
 *  of its health by rank; its roar (s) - no blow reaches it, and (the Enhanced AI switch on) an iron ring about its feet
 *  lands as it ends; then PHASE TWO for the rest of the stand. */
export const LAST_STAND_RANK = 3;
export const LAST_STAND_HEALTH = Object.freeze({ 3: 0.35, 4: 0.45, 5: 0.55 });
export const LAST_STAND_ROAR = 1.2;
export const PHASE_TWO = Object.freeze({
  BLOWS: 1.2,                   // its blows (damageScale)
  SPEED: 20,                    // Speed
  WINDUP: 0.85,                 // its wind-ups' lengths
  COOLDOWN: 0.7,                // its cooldowns between telegraphed blows
  CHAIN_MAX: 2,                 // chained blows after the first - three in all (TELL5's one)
  IRON: 0.5,                    // one blow in two iron
  SIZE: 1.1,                    // stood larger (ELITE FOES' precedent)
  GLINT: Object.freeze([1.0, 0.36, 0.12, 0.5]),   // its rim, ember red, steady (TELL2's outline lane, under its wind-ups' glints)
});
/** RVN5: from this rank a revenant has a signature blow. */
export const SIG_RANK = 2;
/** RVN5 (section 16.1): its signature blow - x2.0, its own cooldown (s), iron from IRON_RANK, drawn in the revenant's
 *  ember (between TELL's amber and its iron red; the hatch only where it IS iron - TELL3's word for "no stagger", and a
 *  rank-2 signature staggers), its WIND deeper. The pyre's blast (a spell of its element): its Damage Health per DFU's GetMagnitude -
 *  base PYRE_BASE, plus PYRE_PER a level - doubled with the rest. */
export const SIG = Object.freeze({
  MULT: 2.0,
  COOLDOWN: Object.freeze([12, 18]),
  IRON_RANK: 3,
  COLOR: Object.freeze([0.95, 0.25, 0.04]),
  WIND_PITCH: 0.7,
  PYRE_BASE: Object.freeze([3, 6]),
  PYRE_PER: 1,
});
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
/** RVN4: its last stand's share of its health at `rank` (none under LAST_STAND_RANK). */
export const lastStandHealth = (rank) => LAST_STAND_HEALTH[Math.min(5, rank | 0)] ?? 0;
/** RVN4: phase two as the brain, the motor and the pools read it (`entity.revenant.p2`) - every number PHASE_TWO's. */
export const phaseTwo = () => Object.freeze({ windup: PHASE_TWO.WINDUP, cooldown: PHASE_TWO.COOLDOWN, chainMax: PHASE_TWO.CHAIN_MAX, iron: PHASE_TWO.IRON, size: PHASE_TWO.SIZE });
/** RVN4: the rim a body in phase two wears (null for any other) - the pools draw it where no wind-up glints. */
export const lastStandGlint = (entity) => (entity?.revenant?.p2 ? PHASE_TWO.GLINT : null);
/** RVN4: the size a body in phase two is stood at. */
export const lastStandSize = (entity) => entity?.revenant?.p2?.size ?? 1;
/** A weapon's metal as a weakness names it (silver, elven, dwarven), or null. */
const METAL_OF = Object.freeze({ 2: 'silver', 3: 'elven', 4: 'dwarven' });
export const metalOf = (weapon) => (weapon && Number.isInteger(weapon.material) ? METAL_OF[weapon.material] ?? null : null);
/** RVN3 (14.1): is a blow of class `cls` (a weapon class, or a spell's element) in metal `metal` one of weakness `weak` -
 *  the daylight's every blow while the sky reads day (`day`)? */
export function isWeakBlow(weak, cls, metal = null, day = false) {
  if (!isWeakness(weak)) return false;
  if (weak === 'daylight') return !!day;
  return weak === cls || (metal != null && weak === metal);
}
/** RVN3 (14.2): its will broken in this fight (its ledger) - its weakness struck, or staggered WILL_STAGGERS times. */
export const willBroken = (ledger) => !!ledger && ((ledger.weak | 0) > 0 || (ledger.staggers | 0) >= WILL_STAGGERS);
/** RVN3 (14.2): must its will be broken (rank WILL_RANK and up)? */
export const willMatters = (rank) => (rank | 0) >= WILL_RANK;
/** RVN3 (14.1): WHAT IT SHIES FROM - the narrator's line, one a weakness, in no personality's voice. */
export const FLINCH_LINES = Object.freeze({
  fire: 'It keeps its eyes on your torch.',
  frost: 'It shrinks from the chill on your breath.',
  shock: 'It flinches at the crackle of a storm.',
  poison: 'It covers its mouth at the reek of venom.',
  magic: 'It flinches from the light gathering in your hands.',
  silver: 'It flinches from the glint of silver.',
  dwarven: 'Its eyes keep straying to your Dwarven steel.',
  elven: 'It shrinks from the shimmer of elven steel.',
  blunt: 'It guards its skull from every swing.',
  axe: 'It twists away from the bite of an axe.',
  blade: 'It turns its throat from every point.',
  arrow: 'It keeps to cover from your arrows.',
  h2h: 'It fears your bare hands more than any steel.',
  daylight: 'It squints and shrinks from the daylight.',
});
/** RVN3 (14.1, 24.1): a weakness's name, and the hint a flinch or a rumour gives. */
export const WEAK_NAMES = Object.freeze({
  fire: 'Fire', frost: 'Frost', shock: 'Shock', poison: 'Poison', magic: 'Magic', silver: 'Silver', dwarven: 'Dwarven steel',
  elven: 'Elven steel', blunt: 'Blunt weapons', axe: 'Axes', blade: 'Blades', arrow: 'Arrows', h2h: 'Bare hands', daylight: 'Daylight',
});
export const WEAK_HINTS = Object.freeze({ element: 'An element', metal: 'A metal', weapon: 'A weapon', sun: 'The sun' });
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
/** RVN5 (16.2): a signature's noun, by its shape (drawn on its id); the pyre's by its element (DFU's order). */
export const SIG_NOUNS = Object.freeze({
  slam: Object.freeze(['Skullsplitter', 'Gravefall', 'Anvil', 'Hammerfall', 'Bonebreaker', 'Mountainfall']),
  sweep: Object.freeze(['Widowmaker', 'Red Harvest', 'Reaping', 'Crescent', 'Scythe-Wind']),
  lunge: Object.freeze(['Heartseeker', "Viper's Kiss", 'Spite', 'Last Word']),
  charge: Object.freeze(['Bloodrush', 'Stampede', "Bull's Folly", 'Avalanche']),
  leap: Object.freeze(['Skyfall', "Raptor's Drop", 'Pounce of Ruin']),
  ring: Object.freeze(['Earthbreaker', 'Quake', 'Ruin-Circle']),
});
export const PYRE_NOUNS = Object.freeze(['Pyre', 'Rimefall', 'Blight', 'Stormcall', 'Unmaking']);   // fire, frost, poison, shock, magic
/** RVN5 (16.1): the element a pyre burns in - by the nature of the kinds that throw one (signatureFamily null): an
 *  atronach's own and an imp's fire; a lich's frost; the vermin's, the bat's, the spriggan's, the dead's and the fish's
 *  poison (Blight); a harpy's storm; any other's (a ghost, a wraith, a nymph, a shaman, a mage) magic. Decided here: by
 *  its KIND, not its career's spells - DFU's spell lists index SPELLS.STD, data read at run time
 *  (systems/enemySpells.js), and the signature's name, which the page draws with no body standing, must be the name its
 *  stand calls out. */
const PYRE_ELEMENT = new Map([
  [M.FireAtronach, 0], [M.Imp, 0],
  [M.IceAtronach, 1], [M.Lich, 1], [M.AncientLich, 1],
  [M.Rat, 2], [M.GiantBat, 2], [M.Spriggan, 2], [M.Zombie, 2], [M.Slaughterfish, 2],
  [M.Harpy, 3],
]);
export const pyreElement = (mobileType) => PYRE_ELEMENT.get(mobileType) ?? 4;
/** RVN5 (16.2): its signature's noun, drawn on its id from its shape's bank (a pyre's by its element) - what its stand
 *  calls out ("Grushnak readies Skullsplitter!"). */
export function signatureNoun(r) {
  if (!r?.sig) return null;
  const bank = r.sig === 'pyre' ? [PYRE_NOUNS[pyreElement(r.mobileType)]] : SIG_NOUNS[r.sig];
  if (!bank?.length) return null;
  return bank[Math.min(bank.length - 1, Math.floor(idStream(r.id, 'signame')() * bank.length))];
}
/** RVN5 (16.2): its signature's name - "<given>'s <noun>". Derived, never stored. */
export function signatureName(r) {
  const noun = signatureNoun(r);
  if (!noun) return null;
  return r.given ? `${possessive(r.given)} ${noun}` : noun;   // a record has its given name; none, the noun alone
}
/** RVN5: its signature as its stand carries it (`entity.revenant.sigBlow` - the brain reads it; null under SIG_RANK or
 *  with none): its shape, iron from IRON_RANK, x MULT, its cooldown, its colour and its WIND, its name and its noun. */
export function signatureStamp(r) {
  if (!r || (r.rank | 0) < SIG_RANK || !isSignature(r.sig)) return null;
  return Object.freeze({ kind: r.sig, iron: (r.rank | 0) >= SIG.IRON_RANK, mult: SIG.MULT, cooldown: SIG.COOLDOWN, color: SIG.COLOR, windPitch: SIG.WIND_PITCH, name: signatureName(r), noun: signatureNoun(r), element: pyreElement(r.mobileType) });
}
/** RVN5 (16.1): THE PYRE'S BLAST - a strike spell of its element (Damage Health, DFU's GetMagnitude: SIG.PYRE_BASE plus
 *  SIG.PYRE_PER a level, both x `mult`), cast at the player through the host's own door so the saving throw answers it. */
export function pyreSpell(name, element, mult = SIG.MULT) {
  const e = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, ...o });
  const m = mult > 0 ? mult : 1;
  return Object.freeze({
    name: name ?? 'Pyre', index: -1, element: Number.isInteger(element) ? element : 4, rangeType: 2, icon: 0,   // at range, at its target: never CasterOnly - the save answers it
    effects: [e(4, 0, { magnitudeBaseLow: Math.round(SIG.PYRE_BASE[0] * m), magnitudeBaseHigh: Math.round(SIG.PYRE_BASE[1] * m), magnitudeLevelBase: Math.round(SIG.PYRE_PER * m), magnitudeLevelHigh: Math.round(SIG.PYRE_PER * m) }), { type: -1, subType: -1 }, { type: -1, subType: -1 }],
  });
}
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

// ── RVN2's adaptations (section 13) ─────────────────────────────────
/** The adaptations a revenant can learn. */
export const ADAPTATIONS = Object.freeze(['mailed', 'braced', 'hewnHard', 'unflinching', 'arrowWise', 'fireproof', 'rimebound', 'grounded', 'venomBlooded', 'spellScarred', 'silverScarred', 'steadfast', 'patient', 'watchful', 'relentless', 'nightStalker']);
const ADAPT_SET = new Set(ADAPTATIONS);
export const isAdaptation = (v) => typeof v === 'string' && ADAPT_SET.has(v);
/** What a scar teaches (13.2's "learned from"); a kill by night (the `night` scar with `slew`) teaches the Night-stalker. */
const TEACHES = Object.freeze({
  blade: 'mailed', blunt: 'braced', axe: 'hewnHard', h2h: 'unflinching', arrow: 'arrowWise',
  fire: 'fireproof', frost: 'rimebound', shock: 'grounded', poison: 'venomBlooded', magic: 'spellScarred',
  silver: 'silverScarred', staggered: 'steadfast', dodged: 'patient', back: 'watchful', routed: 'relentless',
});
/** The kinds silver doubles against - DFU's Skeletal Warrior and PCAAO's six (combat/pcaao.js SILVER_DOUBLED_CAREERS):
 *  the only ones a silver scar teaches. */
export const SILVER_DOUBLED_KINDS = Object.freeze(new Set([M.SkeletalWarrior, M.Werewolf, M.Ghost, M.Wraith, M.Vampire, M.Mummy, M.Wereboar]));
/** RVN2 (13.1): the fight's lesson - the first of its scars (`kinds`, feudScars' order: its leading source first) that
 *  teaches an adaptation `learned` does not hold. Decided here: a leading scar it already holds passes the lesson to the
 *  next (a revenant that has learned your blade learns the next thing you lean on); `mixed`, `other` and a deed teach
 *  nothing but the two that do (a kill by night; being run from - RVN10's `routed`); an element its `career` already
 *  resists or shrugs off teaches nothing (DFU's tolerance is its own - stacked, it was immunity). Null for none. */
export function lessonOf(kinds, learned, mobileType, career = null) {
  const held = new Set(learned ?? []);
  const slew = kinds.includes('slew');
  for (const k of kinds) {
    const a = k === 'night' ? (slew ? 'nightStalker' : null) : TEACHES[k] ?? null;
    if (!a || held.has(a)) continue;
    if (a === 'silverScarred' && !SILVER_DOUBLED_KINDS.has(mobileType)) continue;   // its kind's silver double is none to lose
    if (ADAPT.RESIST_OF[a] && weaknessShut(ADAPT.RESIST_OF[a], career)) continue;
    return a;
  }
  return null;
}
/** RVN2 (13.1): `learned` with `a` learned at `rank` - at most min(rank, ADAPT_MAX), the oldest forgotten. */
export const withLesson = (learned, a, rank) => [...(learned ?? []).filter((x) => x !== a), a].slice(-Math.max(1, Math.min(rank | 0, ADAPT_MAX)));
/** RVN2: what a revenant's adaptations do to it, as its stand carries them (`entity.revenant.edge` - the brain, the
 *  motor, the doors and the formulas read it there; every number is ADAPT's): `taken` by blow class, `resist` by
 *  element, its poise, iron share, tracking share, feint chance and wind-up band (null: TELL's), Speed past a distance,
 *  and the flags. NOTHING TOUCHES ITS WEAKNESS (`weak`): no class or element of it is taken less, and a silver weakness
 *  keeps silver's double. Frozen. */
export function adaptEdge(learned, weak = null) {
  const has = (a) => (learned ?? []).includes(a);
  /** @type {Record<string, number>} */
  const taken = {};
  for (const [a, [cls, m]] of Object.entries(ADAPT.TAKEN)) if (has(a) && cls !== weak) taken[cls] = Math.max(ADAPT.TAKEN_FLOOR, Number(m));
  /** @type {Record<string, number>} */
  const resist = {};
  for (const [a, el] of Object.entries(ADAPT.RESIST_OF)) if (has(a) && el !== weak) resist[el] = ADAPT.RESIST;
  return Object.freeze({
    taken: Object.freeze(taken), resist: Object.freeze(resist),
    poise: (has('braced') ? ADAPT.BRACED_POISE : 1) * (has('steadfast') ? ADAPT.STEADFAST_POISE : 1),
    iron: has('steadfast') ? ADAPT.STEADFAST_IRON : 0,
    track: has('patient') ? ADAPT.PATIENT_TRACK : null,
    feint: has('patient') ? ADAPT.PATIENT_FEINT : null,
    wind: has('patient') ? ADAPT.PATIENT_WIND : null,
    farSpeed: has('arrowWise') ? ADAPT.ARROW_SPEED : 0, farAt: ADAPT.ARROW_FAR, closes: has('arrowWise'),
    watchful: has('watchful'), silverScarred: has('silverScarred') && weak !== 'silver', relentless: has('relentless'), nightStalker: has('nightStalker'),
    weak: isWeakness(weak) ? weak : null,
  });
}
/** RVN2: a blow's class as an adaptation weighs it - an arrow; a weapon's class; bare hands a person's (the player's, a
 *  class foe's) - a monster's own body is none of them. */
export function adaptBlowClass(attacker, weapon, kind) {
  if (kind === 'arrow') return 'arrow';
  if (weapon) return weaponFeudClass(weapon).cls;
  return attacker?.isPlayer || (attacker?.mobileType ?? -1) >= 128 ? 'h2h' : 'other';
}

// ── the record, whole (section 26) ──────────────────────────────────
/** RVN1: every field FEUD adds to a revenant's record, read back (a save, the mirror, a merge) - each checked by its
 *  validator, and an older record's derived (the weakness, the signature at rank 2 and up, the kin - on its id; the
 *  fights it has had from its counts). `r` the raw record (its id, kind, rank and counts already checked). */
export function feudFields(r, { id, mobileType, rank }) {
  const fights = Number.isInteger(r.fights) && r.fights >= 0 ? r.fights : (r.kills | 0) + (r.escapes | 0) + (r.returns | 0);
  return {
    scars: sanitizeScars(r.scars),
    learned: Array.isArray(r.learned) ? [...new Set(r.learned.filter(isAdaptation))].slice(-Math.min(rank, ADAPT_MAX)) : [],   // RVN2: at most its rank's
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
