// @ts-check
// SHIP-CREW (2026-09-30, Mac: "Let's do #1" - named crew with morale, and deck orders the crew follow) - THE PLAYER'S
// OWN CREW AS PEOPLE: who they are, how their spirits stand, and what they were last told to do. Pure: the host
// (scenes/navalHost.js) keeps one per boat of the player's, steps it and tells it what happened; the save keeps it
// (`snapshot` / `restore`). DECLARED - Daggerfall has no ships, and Come Sail Away's crew is a count.
//
// WHO THEY ARE. The hands a crewed boat stands on her deck (crewLife.js playerCrewCount) each have a name - DFU's own
// NameHelper.FullName over the waters' bank (navalShips.js names a captain the same way), drawn off the boat's seed
// and the hire's number, so a name never changes while its hand lives - and a ROLE by where they stand in the roster:
// the first her First Mate, a Bard her Bard, the rest Bosun, Gunner, Carpenter, Lookout, Cook, Deckhand in turn. Each
// remembers the FIGHTS won and the BOARDINGS stood with this ship. A hand the guns take (the roster shorter) FALLS,
// named - the last to join first, her First Mate last; a hand hired joins with a new name.
//
// THEIR SPIRITS (Mac: "Gentle" - no wages, no desertion). MORALE 0-100, MORALE_START a new crew's. A win, a prize, a
// hold filled and a round of grog raise it; a hand lost and a wreck lower it; the sea wears it down a point every
// SEA_DECAY_S away from port, and a port lifts it a point every PORT_RISE_S, as far as PORT_CAP. It NUDGES: the guns'
// reload (`reloadScaleOf`, MORALE_RELOAD either way), the mending (`mendScaleOf`, MORALE_MEND either way), a boarding's
// hands (`handsBonusOf`, one more in high spirits, one fewer in low), what they say (`moraleLine`) and whether they sing
// (none below SING_MIN).
//
// THE CREW_ORDERS. CREW_ORDERS - her guns manned (a quicker reload, GUNS_RELOAD; the crew at the guns), all hands to the rail (one
// more hand to a boarding; the crew at the rail), repairs (the carpenter's stores spent - navalYard.js seaRepair), and
// stand down (their own work again). An order stands until another is given, or the work it was is done.
import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { fullName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { mulberry32 } from '../../combat/bloodArt.js';
import { MOBILE } from './navalBoarding.js';

/** A new crew's spirits, and the range. */
export const MORALE_START = 60;
export const MORALE_MAX = 100;
/** What lifts them, and what wears them (points). A hand lost costs HAND_LOST, a fight's losses at most LOSSES_CAP. */
export const MORALE_EVENT = Object.freeze({ win: 10, prize: 6, plunder: 3, grog: 15, handLost: -3, wrecked: -15, knocked: -4 });   // CREW-COMPANIONS: one of theirs carried back aboard (crewCompanions.js)
export const LOSSES_CAP = -15;
/** AUDIT CC-D4: a fight's losses are counted as one while each comes within this of the last (s) - a boarding's dead,
 *  lost after the colours came down, spent the NEXT fight's cap, and a hostile at the edge of reach handed out new ones. */
export const LOSSES_WINDOW_S = 60;
/** The sea wears a point off every SEA_DECAY_S away from port (sea seconds); a port lifts one every PORT_RISE_S up to
 *  PORT_CAP (above it, only a win or a round lifts them). */
export const SEA_DECAY_S = 150;
export const PORT_RISE_S = 20;
export const PORT_CAP = 75;
/** High spirits and low: a hand more to a boarding at HIGH_SPIRITS and over, a hand fewer at LOW_SPIRITS and under; no
 *  song under SING_MIN. */
export const HIGH_SPIRITS = 80;
export const LOW_SPIRITS = 20;
export const SING_MIN = 30;
/** How far spirits move the reload and the mending at their ends (a share, either way). */
export const MORALE_RELOAD = 0.12;
export const MORALE_MEND = 0.25;
/** Her guns manned: their reload this much quicker. */
export const GUNS_RELOAD = 0.88;

/** The orders a captain gives from her deck. */
export const CREW_ORDERS = Object.freeze({ guns: 'guns', rail: 'rail', repair: 'repair', stand: 'stand' });
/** Each order's words - the list's row, and what the crew answers. */
export const ORDER_TEXT = Object.freeze({
  guns: Object.freeze({ label: 'Man the guns', said: 'Guns manned, Captain!' }),
  rail: Object.freeze({ label: 'All hands to the rail', said: 'All hands to the rail!' }),
  repair: Object.freeze({ label: 'Make repairs', said: 'Carpenter\'s crew to work!' }),
  stand: Object.freeze({ label: 'Stand down', said: 'Aye, Captain. Standing down.' }),
});

/** The roles after her First Mate (and a Bard her Bard), dealt in turn. */
export const ROLES = Object.freeze(['Bosun', 'Gunner', 'Carpenter', 'Lookout', 'Cook', 'Deckhand']);
/** SHIP-WATCH: the role whose hand keeps her bow (AUDIT WK-W10: the card's Lookout is her lookout). */
export const LOOKOUT_ROLE = 'Lookout';
/** The role of the hand who answers for her (the roster's first, dealt; HOLDINGS: given). */
export const FIRST_MATE = 'First Mate';
/** HOLDINGS (bible/03-World/Holdings.md, Mac: "Named crew companions should be able to be assigned to certain roles, and
 *  be positioned accordingly to their role"): the posts a captain gives her hands - her First Mate and the roles dealt.
 *  A Bard keeps his calling until given another, and is given it back; one First Mate to a ship. */
export const CREW_ROLES = Object.freeze([FIRST_MATE, ...ROLES]);

/** The spirits, in words, by the lowest morale each begins at. */
export const SPIRITS = Object.freeze([
  Object.freeze({ at: 85, key: 'roaring', label: 'Roaring' }),
  Object.freeze({ at: 65, key: 'high', label: 'High' }),
  Object.freeze({ at: 45, key: 'steady', label: 'Steady' }),
  Object.freeze({ at: 25, key: 'low', label: 'Low' }),
  Object.freeze({ at: 0, key: 'grim', label: 'Grim' }),
]);
/** @param {number} m */
export const spiritsOf = (m) => SPIRITS.find((s) => m >= s.at) ?? SPIRITS[SPIRITS.length - 1];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Spirits as a share either way of steady: -1 at none, 0 at 50, +1 at the top. */
export const moraleFactor = (m) => clamp((m - 50) / 50, -1, 1);
/** The guns' reload scaled by spirits and her guns manned (lower is quicker). */
export const reloadScaleOf = (m, order = null) => (1 - MORALE_RELOAD * moraleFactor(m)) * (order === CREW_ORDERS.guns ? GUNS_RELOAD : 1);
/** Her hands' mending scaled by spirits. */
export const mendScaleOf = (m) => 1 + MORALE_MEND * moraleFactor(m);
/** A boarding's hands more or fewer: spirits, and all hands to the rail. */
export const handsBonusOf = (m, order = null) => (m >= HIGH_SPIRITS ? 1 : 0) - (m <= LOW_SPIRITS ? 1 : 0) + (order === CREW_ORDERS.rail ? 1 : 0);

/** What a crew says of their spirits and their work - high, low, a veteran's, the repairs'. */
export const MORALE_LINES = Object.freeze({
  high: Object.freeze([
    'Best crew on the Iliac Bay, and don\'t you forget it!', 'Captain\'s luck is holding.', 'I\'d follow this ship to Oblivion.',
    'A fine voyage, this.', 'Another prize like the last and I\'ll buy a farm.', 'Sing up, lads!',
  ]),
  low: Object.freeze([
    'How long since we saw port?', 'My bones ache for a tavern bench.', 'Hardtack again...', 'This voyage will be the death of us.',
    'Captain had better know what she\'s about.', 'I miss dry land.',
  ]),
  repair: Object.freeze([
    'Pitch here!', 'Hand me that plank.', 'Mind the caulking iron!', 'She\'ll hold, give her time.', 'More oakum!', 'Patch that sail!',
  ]),
  guns: Object.freeze(['Guns manned!', 'Powder ready!', 'Shot in, rammed home!', 'Waiting on your word, Captain!']),
  rail: Object.freeze(['All hands to the rail!', 'Blades out, lads!', 'Nobody sets foot on our deck!']),
});

/** A hand's role by where he stands in her roster (`i`) and his class. @param {number} i @param {number} mobile @param {number} dealt */
const roleOf = (i, mobile, dealt) => (i === 0 ? FIRST_MATE : mobile === MOBILE.Bard ? 'Bard' : ROLES[dealt % ROLES.length]);

/**
 * A hand's name: NameHelper.FullName over the waters' bank, on the boat's seed and the hire's number (DFU's own global
 * stream put back as it stood).
 * @param {number} seed @param {number} hire @param {'male'|'female'} gender @param {number} regionIndex
 */
export function handName(seed, hire, gender, regionIndex = 17) {
  const s = (Math.imul((seed >>> 0) ^ 0x7a3d, 0x9e3779b1) + Math.imul(hire + 1, 0x85ebca6b)) >>> 0;
  const saved = getSeed();
  try {
    srand(s || 1);
    const bank = getNameBankOfRegion(regionIndex >= 0 && regionIndex < REGION_NAMES.length ? regionIndex : 17);
    return fullName(bank, gender === 'female' ? GENDERS.Female : GENDERS.Male);
  } finally { setSeed(saved); }
}

/**
 * One boat's crew as people.
 * @param {{ seed: number, regionIndex?: number, record?: any }} o - `record` a save's (`snapshot()`), or none: a new crew
 */
export function createShipCrew({ seed, regionIndex = 17, record = null }) {
  /** @type {{ name: string, role: string, mobile: number, gender: 'male'|'female', fights: number, boardings: number }[]} */
  let hands = [];
  let morale = MORALE_START, hires = 0, seaT = 0, portT = 0, losses = 0, lossT = 0;
  /** AUDIT CC-D5: the world's day her crew last drank the yard's round (one a port day). */
  let grogDay = null;
  /** @type {string} */
  let order = CREW_ORDERS.stand;
  // AUDIT CC-D3: the standing order rides the save (one not CREW_ORDERS' own stands down); the grog's day with it
  if (record && typeof record === 'object') {
    const m = Number(record.morale);
    morale = Number.isFinite(m) ? clamp(m, 0, MORALE_MAX) : MORALE_START;
    hires = Number.isInteger(record.hires) && record.hires >= 0 ? record.hires : 0;
    if (Array.isArray(record.hands)) {
      hands = record.hands.filter((h) => h && typeof h.name === 'string').slice(0, 64).map((h) => ({
        name: h.name, role: typeof h.role === 'string' ? h.role : 'Deckhand', mobile: Number.isInteger(h.mobile) ? h.mobile : MOBILE.Warrior,
        gender: h.gender === 'female' ? 'female' : 'male', fights: Math.max(0, h.fights | 0), boardings: Math.max(0, h.boardings | 0),
      }));
    }
    hires = Math.max(hires, hands.length);
    if (typeof record.order === 'string' && /** @type {string[]} */ (Object.values(CREW_ORDERS)).includes(record.order)) order = record.order;
    if (Number.isFinite(record.grogDay)) grogDay = record.grogDay;
  }
  const rng = mulberry32(((seed >>> 0) ^ 0x3c7e11) >>> 0);
  const bump = (d) => { morale = clamp(morale + d, 0, MORALE_MAX); };

  return {
    get morale() { return morale; },
    get order() { return order; },
    get hands() { return hands; },
    spirits: () => spiritsOf(morale),
    /**
     * Her roster as it stands on her deck now (crewLife.js crewRoster: each a class and a sex): the named hands made to
     * match it - more joining with new names, fewer falling (the last to join first). Answers who fell and who joined.
     * @param {{ mobile: number, gender: string }[]} roster
     */
    sync(roster) {
      const fell = [], joined = [];
      while (hands.length > roster.length) fell.push(hands.pop());
      for (let i = hands.length; i < roster.length; i++) {
        const r = roster[i];
        /** @type {'male'|'female'} */
        const gender = r.gender === 'female' ? 'female' : 'male';
        const dealt = hands.filter((h) => h.role !== 'First Mate' && h.role !== 'Bard').length;
        const h = { name: handName(seed, hires++, gender, regionIndex), role: roleOf(i, r.mobile, dealt), mobile: r.mobile, gender, fights: 0, boardings: 0 };
        hands.push(h);
        joined.push(h);
      }
      return { fell, joined };
    },
    /** A hand's name by where he stands (null past the roster). @param {number} i */
    nameOf: (i) => hands[i]?.name ?? null,
    /**
     * HOLDINGS: a hand given a post - one of CREW_ROLES, or a Bard's own calling back. She has one First Mate: the one she
     * had stands down to Deckhand. Answers `{ ok, text }`.
     * @param {string} name @param {string} role
     */
    assign(name, role) {
      const h = hands.find((x) => x.name === name);
      if (!h) return { ok: false, text: 'No such hand aboard her.' };
      const bard = role === 'Bard' && h.mobile === MOBILE.Bard;
      if (!/** @type {readonly string[]} */ (CREW_ROLES).includes(role) && !bard) return { ok: false, text: 'No such post aboard her.' };
      if (role === LOOKOUT_ROLE && h.mobile === MOBILE.Bard) return { ok: false, text: `${h.name} leads her songs - he keeps no lookout.` };   // AUDIT HOLDINGS C3: her bow is never a Bard's (crewLife.js canLook)
      if (h.role === role) return { ok: true, text: `${h.name} is her ${role} already.` };
      if (role === FIRST_MATE) for (const o of hands) if (o !== h && o.role === FIRST_MATE) o.role = 'Deckhand';
      h.role = role;
      return { ok: true, text: `${h.name} is her ${role} now.` };
    },
    /** A hand's name and role, as he is called: "Aldric Wayrest, Bosun". @param {number} i */
    calledOf: (i) => (hands[i] ? `${hands[i].name}, ${hands[i].role}` : null),
    /**
     * What happened: 'win' (a ship struck to her), 'prize' (one taken), 'plunder' (her hold filled), 'grog' (a round),
     * 'handLost' (`n` of her crew's points lost - a fight's losses at most LOSSES_CAP until `fightOver`), 'wrecked', and
     * 'boarding' (a boarding stood - each hand's count).
     * @param {string} kind @param {number} [n]
     */
    event(kind, n = 1) {
      if (kind === 'handLost') {
        if (!Number.isFinite(n)) return;   // AUDIT CC-D4: a NaN loss saved as null and loaded as no spirits at all
        if (lossT > LOSSES_WINDOW_S) losses = 0;
        lossT = 0;
        const d = Math.max(LOSSES_CAP - losses, MORALE_EVENT.handLost * Math.max(0, n));
        losses += d;
        bump(d);
        return;
      }
      if (kind === 'win') for (const h of hands) h.fights++;
      if (kind === 'boarding') { for (const h of hands) h.boardings++; return; }
      const d = MORALE_EVENT[kind];
      if (typeof d === 'number') bump(d);
    },
    /** A fight over: the next one's losses counted afresh. */
    fightOver() { losses = 0; },
    /**
     * The spirits' clock: `atSea` away from port wears them down a point every SEA_DECAY_S; `inPort` lifts them a point
     * every PORT_RISE_S as far as PORT_CAP.
     * @param {number} dt @param {{ atSea?: boolean, inPort?: boolean }} where
     */
    tick(dt, { atSea = false, inPort = false } = {}) {
      if (!(dt > 0)) return;
      lossT += dt;
      if (inPort) {
        seaT = 0;
        // AUDIT CC-D4: a long step spent at once (a backlog drained a point a frame after it)
        if (morale < PORT_CAP) { portT += dt; const k = Math.floor(portT / PORT_RISE_S); if (k > 0) { portT -= k * PORT_RISE_S; morale = Math.min(PORT_CAP, morale + k); } } else portT = 0;
      } else if (atSea) {
        portT = 0;
        seaT += dt; const k = Math.floor(seaT / SEA_DECAY_S); if (k > 0) { seaT -= k * SEA_DECAY_S; bump(-k); }
      }
    },
    /** The order given - CREW_ORDERS' own words; answers whether it was one. @param {string} o */
    give(o) {
      if (!/** @type {string[]} */ (Object.values(CREW_ORDERS)).includes(o)) return false;
      order = o;
      return true;
    },
    /**
     * A line of theirs by their spirits or their order - or null for the crew's own (crewLife.js's calm words). The
     * order's work first; then high spirits or low, a third of the time.
     */
    line() {
      /** @type {readonly string[] | undefined} */
      const work = order !== CREW_ORDERS.stand ? /** @type {Record<string, readonly string[]>} */ (MORALE_LINES)[order] : undefined;
      if (work) return work[Math.floor(rng() * work.length)];
      const s = morale >= 70 ? MORALE_LINES.high : morale <= 35 ? MORALE_LINES.low : null;
      if (!s || rng() >= 1 / 3) return null;
      return s[Math.floor(rng() * s.length)];
    },
    /** Whether they sing (low spirits sing no chanties). */
    sings: () => morale >= SING_MIN,
    /** The crew as the save keeps them. */
    /** AUDIT CC-D5: whether her crew drank the yard's round on the world's day `day`, and the round drunk. */
    grogOn: (day) => day != null && grogDay === day,
    drankGrog(day) { if (Number.isFinite(day)) grogDay = day; },
    snapshot: () => ({ morale: Math.round(morale * 10) / 10, hires, hands: hands.map((h) => ({ ...h })), order, grogDay }),
  };
}

/**
 * The crew's card - the roster's lines as a captain reads them: her spirits, then each hand, his role, and what he
 * has stood with her.
 * @param {{ morale: number, hands: { name: string, role: string, fights: number, boardings: number }[] }} crew
 * @param {{ ship?: string, order?: string, ashore?: Set<string>|null }} [o]
 */
export function crewCard(crew, { ship = 'Your ship', order = CREW_ORDERS.stand, ashore = null } = {}) {
  const s = spiritsOf(crew.morale);
  const lines = [`${ship}'s crew - spirits ${s.label} (${Math.round(crew.morale)} of ${MORALE_MAX}).`];
  if (order && order !== CREW_ORDERS.stand) lines.push(`Standing order: ${ORDER_TEXT[order].label}.`);
  if (!crew.hands.length) lines.push('No hands aboard.');
  for (const h of crew.hands) {
    const deeds = [h.fights ? `${h.fights} ${h.fights === 1 ? 'fight' : 'fights'}` : '', h.boardings ? `${h.boardings} ${h.boardings === 1 ? 'boarding' : 'boardings'}` : ''].filter(Boolean).join(', ');
    lines.push(`${h.name}, ${h.role}${deeds ? ` - ${deeds}` : ''}${ashore?.has(h.name) ? ' - ashore with you' : ''}`);   // AUDIT CC-D8: a hand ashore said so
  }
  return lines;
}

/**
 * The orders list a captain picks from (the helm panel's Orders, the boat's menu): a crewed boat's four, a boat with no
 * crew its repairs and standing down (she has no hands to man her guns or her rail); the order standing marked.
 * @param {{ crewed: boolean, order?: string }} o
 * @returns {{ id: string, label: string }[]}
 */
export function orderRows({ crewed, order = CREW_ORDERS.stand }) {
  const ids = crewed ? [CREW_ORDERS.guns, CREW_ORDERS.rail, CREW_ORDERS.repair, CREW_ORDERS.stand] : [CREW_ORDERS.repair, CREW_ORDERS.stand];
  return ids.map((id) => ({ id, label: id === order && id !== CREW_ORDERS.stand ? `${ORDER_TEXT[id].label} (standing)` : ORDER_TEXT[id].label }));
}
