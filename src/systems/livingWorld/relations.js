// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): FRIENDS AND ENEMIES - how each resident of the living world
// regards the player's character (LW0 decision 6: the world is shared; how it feels about you is yours).
//
// A REGARD per resident, from HOSTILE_AT and below to FRIEND_AT and above, kept by the resident's id (census.js:
// `L<mapId>.<slot>` - the same person wherever they walk). Nothing is kept for a resident the player has not met: a
// stranger reads 0. What moves it (`EVENTS`): a word exchanged (once a day counts), a gift, a hand in their fight, their
// life saved - and a blow, a crime seen, one of theirs struck down. Past FRIEND_AT they are a FRIEND (a greeting by name,
// a hand in yours), below ENEMY_AT an ENEMY (no words for you), below HOSTILE_AT HOSTILE (an armed one draws on you).
// Regard eases back toward nothing by EASE_PER_DAY a day the player does not see them - a quarrel, and a friendship,
// fades unkept - but never across zero.
//
// The record rides the character's save (`snapshot` / `createRelations(record)`; the host registers it with
// modSaveData as vendor `LivingWorld`) - online in the character's snapshot like every modData record.

/** The save's record's vendor (modSaveData): the character's regards ride their save under it. */
export const LIVING_WORLD_VENDOR = 'LivingWorld';

export const FRIEND_AT = 40;
export const ENEMY_AT = -40;
export const HOSTILE_AT = -70;
export const REGARD_MIN = -100;
export const REGARD_MAX = 100;
/** How much regard eases back toward zero for each day apart. */
export const EASE_PER_DAY = 0.5;
/** The most residents kept: the least-regarded-either-way and longest-unseen leave first. */
export const RELATIONS_MAX = 600;

/** What moves a regard, and by how much. `talk` counts once a day per resident. */
export const EVENTS = Object.freeze({
  talk: 3,        // a word exchanged (the talk window opened on them)
  polite: 1,      // a courteous word in the talk (the talk's own tone)
  gift: 8,        // a gift given
  helped: 20,     // a blow struck for them in their fight
  saved: 35,      // their fight won with them standing
  struck: -45,    // struck by the player
  crime: -15,     // a crime of the player's seen
  slain: -60,     // one of their own party struck down by the player
  insulted: -6,   // a blunt word in the talk
});

/** @typedef {{ r: number, met: number, seen: number, talked: number }} Regard - `met`, `seen`, `talked` days (the clock's day numbers) */

/** The standing a regard reads as. @param {number} r */
export const standingOf = (r) => (r >= FRIEND_AT ? 'friend' : r <= HOSTILE_AT ? 'hostile' : r <= ENEMY_AT ? 'enemy' : 'neutral');

/**
 * One character's regards.
 * @param {any} [record] - a save's (`snapshot()`), or none: nobody known
 */
export function createRelations(record = null) {
  /** @type {Map<string, Regard>} */
  const map = new Map();
  const clamp = (v) => Math.max(REGARD_MIN, Math.min(REGARD_MAX, v));
  const ok = (id) => typeof id === 'string' && id.length > 0 && id.length <= 40;
  if (record && typeof record === 'object' && record.v === 1 && record.people && typeof record.people === 'object') {
    for (const [id, e] of Object.entries(record.people)) {
      if (!ok(id) || !e || typeof e !== 'object') continue;
      const r = Number(/** @type {any} */ (e).r), met = Number(/** @type {any} */ (e).met), seen = Number(/** @type {any} */ (e).seen), talked = Number(/** @type {any} */ (e).talked);
      if (!Number.isFinite(r)) continue;
      map.set(id, { r: clamp(r), met: Number.isFinite(met) ? met : 0, seen: Number.isFinite(seen) ? seen : 0, talked: Number.isFinite(talked) ? talked : -1 });
    }
  }
  /** The regard as it stands on `day` - eased for the days unseen. */
  const eased = (e, day) => {
    const apart = Math.max(0, day - e.seen);
    const ease = apart * EASE_PER_DAY;
    return e.r > 0 ? Math.max(0, e.r - ease) : Math.min(0, e.r + ease);
  };
  const trim = () => {
    if (map.size <= RELATIONS_MAX) return;
    const order = [...map.entries()].sort((a, b) => (Math.abs(a[1].r) - Math.abs(b[1].r)) || (a[1].seen - b[1].seen));
    for (let i = 0; map.size > RELATIONS_MAX && i < order.length; i++) map.delete(order[i][0]);
  };
  return {
    /** The regard of `id` on `day` (0 for a stranger). @param {string} id @param {number} day */
    regard: (id, day) => { const e = map.get(id); return e ? eased(e, day) : 0; },
    /** 'friend' | 'neutral' | 'enemy' | 'hostile'. @param {string} id @param {number} day */
    standing(id, day) { return standingOf(this.regard(id, day)); },
    /** Whether the player has met `id`. @param {string} id */
    known: (id) => map.has(id),
    /**
     * Something happened between the player and `id` on `day`: `kind` an EVENTS key (or `amount` given). A `talk` counts
     * once a day. Answers the new regard.
     * @param {string} id @param {keyof typeof EVENTS} kind @param {number} day @param {number} [amount]
     */
    note(id, kind, day, amount) {
      if (!ok(id)) return 0;
      const e = map.get(id) ?? { r: 0, met: day, seen: day, talked: -1 };
      const now = eased(e, day);
      let delta = Number.isFinite(amount) ? Number(amount) : (EVENTS[kind] ?? 0);
      if (kind === 'talk') { if (e.talked === day) delta = 0; else e.talked = day; }
      e.r = clamp(now + delta);
      e.seen = day;
      map.set(id, e);
      trim();
      return e.r;
    },
    /** The player saw `id` on `day` (the regard stops easing from today). @param {string} id @param {number} day */
    seen(id, day) { const e = map.get(id); if (e) { e.r = eased(e, day); e.seen = day; } },
    /** Everyone known, for a list (the player's own). */
    entries: () => [...map.entries()].map(([id, e]) => ({ id, ...e })),
    size: () => map.size,
    /** The save's record. */
    snapshot() {
      /** @type {Record<string, Regard>} */
      const people = {};
      for (const [id, e] of map) people[id] = { r: Math.round(e.r * 10) / 10, met: e.met, seen: e.seen, talked: e.talked };
      return { v: 1, people };
    },
  };
}
