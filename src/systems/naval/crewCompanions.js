// @ts-check
// CREW-COMPANIONS (2026-09-30, Mac: "introduce the ability to take them along as companions in the world that travel
// with you and can fight by your side" - "Up to 2", "Knocked out", and through every door: "maybe this is a time for a
// refactor?") - THE PARTY ASHORE, pure. Which of the player's named hands (shipCrew.js) walk with the player, which
// rest aboard after a knock, and what each carries between places (his health). The host (scenes/navalHost.js) keeps
// one and saves it beside the crews; the world's companion layer (scenes/crewAshore.js) stands the party in whatever
// place the player is - the street, a building, a dungeon - and hands every change back here. DECLARED - Daggerfall
// has no followers, and Come Sail Away's crew never leaves the boat.
//
//  - UP TO COMPANION_MAX ashore at once, taken from a boat of mine's crewed roster by name (a name is the hand's for
//    life - shipCrew.js handName) - never one resting, never one already ashore.
//  - KNOCKED OUT, NEVER KILLED. A companion's health run out, he is carried back aboard (`knock`) and rests REST_MIN
//    of the world's minutes before he will come ashore again; his crew's spirits take KNOCKED_MORALE (shipCrew.js
//    MORALE_EVENT.knocked).
//  - A HAND THAT FALLS (the roster shorter, the boat gone) leaves the party and the rest with him (`prune`).
//  - His health rides with him through every door (`hurt`): null is whole, and a new place stands him as he left
//    the last.

/** How many hands walk ashore with the player at once (Mac: "Up to 2"). */
export const COMPANION_MAX = 2;
/** How long a knocked-out companion rests aboard before he will come ashore again - the world's minutes (8 hours). */
export const REST_MIN = 8 * 60;
/** Why a hand will not come ashore - short, for the picker's "(why)". */
export const COMPANION_WHY = Object.freeze({ full: 'two ashore already', resting: 'resting aboard', uncrewed: 'no crew' });
/** The picker's words. */
export const COMPANION_TEXT = Object.freeze({ take: 'Take ashore', back: 'Send back aboard', ashore: 'ashore', resting: 'resting' });

/** @typedef {{ boat: number, name: string, role: string, mobile: number, gender: 'male'|'female', health: number|null, maxHealth: number|null }} Companion */
/** @typedef {{ boat: number, name: string, until: number }} Resting */

const isName = (s) => typeof s === 'string' && s.length > 0 && s.length <= 80;
const isBoat = (b) => Number.isSafeInteger(b) && b > 0;
const same = (a, boat, name) => a.boat === boat && a.name === name;

/**
 * The party ashore.
 * @param {any} [record] - a save's (`snapshot()`), or none: nobody ashore
 */
export function createCompanions(record = null) {
  /** @type {Companion[]} */
  let party = [];
  /** @type {Resting[]} */
  let resting = [];
  if (record && typeof record === 'object') {
    for (const c of Array.isArray(record.party) ? record.party : []) {
      if (party.length >= COMPANION_MAX || !c || !isBoat(c.boat) || !isName(c.name) || party.some((p) => same(p, c.boat, c.name))) continue;
      const hp = Number(c.health), max = Number(c.maxHealth);
      party.push({
        boat: c.boat, name: c.name, role: isName(c.role) ? c.role : 'Deckhand', mobile: Number.isInteger(c.mobile) ? c.mobile : 0,
        gender: c.gender === 'female' ? 'female' : 'male',
        health: c.health != null && Number.isFinite(hp) && hp > 0 ? hp : null, maxHealth: c.maxHealth != null && Number.isFinite(max) && max > 0 ? max : null,
      });
    }
    for (const r of Array.isArray(record.resting) ? record.resting : []) {
      if (!r || !isBoat(r.boat) || !isName(r.name) || !Number.isFinite(r.until) || resting.some((o) => same(o, r.boat, r.name))) continue;
      if (party.some((p) => same(p, r.boat, r.name))) continue;
      resting.push({ boat: r.boat, name: r.name, until: r.until });
    }
  }
  const find = (boat, name) => party.find((p) => same(p, boat, name)) ?? null;
  const restOf = (boat, name) => resting.find((r) => same(r, boat, name)) ?? null;

  return {
    /** The companions ashore, in the order they came. */
    get party() { return party; },
    /** The hands resting aboard after a knock, each with the minute he is fit again. */
    get resting() { return resting; },
    /** Whether a hand walks ashore. @param {number} boat @param {string} name */
    isAshore: (boat, name) => !!find(boat, name),
    /** One companion ashore, or null. @param {number} boat @param {string} name */
    of: (boat, name) => find(boat, name),
    /**
     * Why a hand of a boat will not come ashore now - COMPANION_WHY's words - or null: he may.
     * @param {number} boat @param {{ name: string }} hand @param {number} now - the world's minute @param {boolean} [crewed]
     */
    why(boat, hand, now, crewed = true) {
      if (!crewed) return COMPANION_WHY.uncrewed;
      const r = restOf(boat, hand.name);
      if (r && now < r.until) return COMPANION_WHY.resting;
      if (party.length >= COMPANION_MAX && !find(boat, hand.name)) return COMPANION_WHY.full;
      return null;
    },
    /**
     * A hand ashore with the player - the companion, or null when he may not (`why`) or walks already.
     * @param {number} boat @param {{ name: string, role: string, mobile: number, gender: string }} hand @param {number} now
     */
    take(boat, hand, now) {
      if (!isBoat(boat) || !isName(hand?.name) || find(boat, hand.name) || this.why(boat, hand, now) != null) return null;
      resting = resting.filter((r) => !same(r, boat, hand.name));
      /** @type {Companion} */
      const c = { boat, name: hand.name, role: hand.role, mobile: hand.mobile, gender: hand.gender === 'female' ? 'female' : 'male', health: null, maxHealth: null };
      party.push(c);
      return c;
    },
    /** A companion sent back aboard - whole again among his mates. Answers whether he was ashore. @param {number} boat @param {string} name */
    sendBack(boat, name) {
      const n = party.length;
      party = party.filter((p) => !same(p, boat, name));
      return party.length < n;
    },
    /**
     * A companion knocked out: carried back aboard to rest till `now + REST_MIN`. Answers whether he was ashore.
     * @param {number} boat @param {string} name @param {number} now
     */
    knock(boat, name, now) {
      if (!this.sendBack(boat, name)) return false;
      resting = resting.filter((r) => !same(r, boat, name));
      resting.push({ boat, name, until: now + REST_MIN });
      return true;
    },
    /** The rested fit again by `now` - answers them (their rest over, they may come ashore). @param {number} now */
    wake(now) {
      const woke = resting.filter((r) => now >= r.until);
      if (woke.length) resting = resting.filter((r) => now < r.until);
      return woke;
    },
    /**
     * A companion's health as the place he stands in says it - carried to the next (null health: whole).
     * @param {number} boat @param {string} name @param {number} health @param {number} maxHealth
     */
    hurt(boat, name, health, maxHealth) {
      const c = find(boat, name);
      if (!c || !Number.isFinite(health) || !Number.isFinite(maxHealth) || maxHealth <= 0) return;
      c.maxHealth = maxHealth;
      c.health = health >= maxHealth ? null : Math.max(1, health);
    },
    /**
     * The hands no longer anyone's (`lives(boat, name)` false: fallen from the roster, the boat gone) out of the party and
     * the rest - answers the companions dropped.
     * @param {(boat: number, name: string) => boolean} lives
     */
    prune(lives) {
      const gone = party.filter((p) => !lives(p.boat, p.name));
      if (gone.length) party = party.filter((p) => lives(p.boat, p.name));
      resting = resting.filter((r) => lives(r.boat, r.name));
      return gone;
    },
    /** The names of a boat's hands ashore - her deck stands without them. @param {number} boat */
    awayOf: (boat) => new Set(party.filter((p) => p.boat === boat).map((p) => p.name)),
    /** The party as the save keeps it. */
    snapshot: () => ({ party: party.map((p) => ({ ...p })), resting: resting.map((r) => ({ ...r })) }),
  };
}

/**
 * The companions picker a boat of mine offers (the boat's menu): each hand of her crew, one to take ashore, one ashore
 * to send back, one resting refused with his hours left - in the shape of the plaque's rows ({id, label, disabled, why}).
 * @param {{ boat: number, crewed: boolean, hands: { name: string, role: string }[], now: number, companions: ReturnType<typeof createCompanions> }} o
 */
export function companionRows({ boat, crewed, hands, now, companions }) {
  return hands.map((h) => {
    const called = `${h.name}, ${h.role}`;
    if (companions.isAshore(boat, h.name)) return { id: h.name, label: `${COMPANION_TEXT.back}: ${called}`, back: true };
    const why = companions.why(boat, h, now, crewed);
    if (why === COMPANION_WHY.resting) {
      const r = companions.resting.find((x) => same(x, boat, h.name));
      const hours = Math.max(1, Math.ceil(((r?.until ?? now) - now) / 60));
      return { id: h.name, label: `${called}`, disabled: true, why: `${COMPANION_TEXT.resting}, ${hours} ${hours === 1 ? 'hour' : 'hours'}` };
    }
    if (why) return { id: h.name, label: `${called}`, disabled: true, why };
    return { id: h.name, label: `${COMPANION_TEXT.take}: ${called}` };
  });
}

/**
 * Where the party stands behind a leader facing `yaw`: the `i`th of `n` a pace or two back and to the side, so two
 * never stand on one another - [dx, dz] off the leader's feet.
 * @param {number} yaw @param {number} i @param {number} n
 */
export function companionSlot(yaw, i, n) {
  const back = 1.8, side = n > 1 ? (i === 0 ? -1 : 1) * 1.1 : 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return [-fx * back + fz * side, -fz * back - fx * side];
}
