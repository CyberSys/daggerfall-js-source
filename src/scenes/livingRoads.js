// @ts-check
// LW3 (2026-10-04, bible/06-Systems/Living-World.md): THE ROADS' LAYER - the parties of the living world on the road
// near the player, stood in the open world and marked under the Overworld. The trips are pure (systems/livingWorld/
// trips.js: where every party is at the sky's minute, the same for every reader); this layer reads them about the
// player's pixel each ROADS_TICK_S, places each member, and hands the bodies to the sprites (world/travellerSprites.js).
//
//  - BY DAY a party walks IN FILE on its way: the leader where the trip has it, each after FILE_GAP_N behind along the
//    way, a little to either side (FILE_SIDE_N), all facing the way they go.
//  - BY NIGHT it is CAMPED where night found it: its people in a ring CAMP_RING_N about the camp, facing in.
//  - IN PLAY, members within ROADS_PLAY_M of the player stand, whole; UNDER THE OVERWORLD, members within the sprites'
//    far edge stand faded and grown, and every party within ROADS_VIEW_PX map pixels wears a mark (its kind and where it
//    is bound).
//  - WHAT THEY SAY: a party talks among itself in rounds (the meetings' own beat, meetups.js circleLine on the road's
//    and the camp's words, lines.js ROAD_TALKS / CAMP_TALKS) and a word to the player passing close, by regard.
//  - A TALK on the road is the street's (townTalk's talk ray takes `talkSeats()`); the person's `living.town` is this
//    layer, which notes the word in the resident's regard and refuses the talk of an enemy.
import { partiesNear, partyAt, wayAt, NATIVE_PER_M, NATIVE_PIXEL } from '../systems/livingWorld/trips.js';
import { circleLine, lineMinutes, ROUND_S, TALK_SHARE } from '../systems/livingWorld/meetups.js';
import { ROAD_GREETINGS, fillLine, firstNameOf } from '../systems/livingWorld/lines.js';
import { lwSeed, textSeed } from '../systems/livingWorld/seed.js';
import { DAY_MIN, DAY_START_MIN } from '../systems/livingWorld/dayPlan.js';
import { LIVING_REFUSAL } from '../systems/livingWorld/livingTown.js';
import { TRAVELLER_FAR_M } from '../world/travellerSprites.js';

/** The parties near are read again this often (real seconds). */
export const ROADS_TICK_S = 1;
/** In play, a member further than this from the player (m) is not stood. */
export const ROADS_PLAY_M = 360;
/** Under the Overworld, parties within this many map pixels wear a mark. */
export const ROADS_VIEW_PX = 6;
/** A party in file: each this far behind the one before (native - 1.8 m) and this far to a side (native - 0.55 m). */
export const FILE_GAP_N = 72;
export const FILE_SIDE_N = 22;
/** A camped party's ring about its fire (native - 2.25 m). */
export const CAMP_RING_N = 90;
/** How near the player passes a traveller for a word (m), and a traveller's word's rest (minutes of the clock). */
export const ROAD_GREET_M = 4;
export const ROAD_GREET_REST_MIN = 120;
/** How long a word to the player stands (real seconds). */
export const ROAD_GREET_S = 3.4;

/** A party's mark's label, by what it is (the leader's job) and where it is bound. @param {any} trip @param {string} [home] */
export function partyLabel(trip, home = '') {
  const to = trip.to?.name ?? '';
  const n = trip.party?.length ?? 1;
  const bound = trip.kind === 'merchant' ? 'Caravan' : trip.kind === 'pilgrim' ? (n > 1 ? 'Pilgrims' : 'Pilgrim')
    : trip.kind === 'courier' ? 'Courier' : trip.kind === 'adventurer' ? (n > 1 ? 'Adventurers' : 'Adventurer') : (n > 1 ? 'Travellers' : 'Pedlar');
  return to ? `${bound} to ${to}` : (home ? `${bound} of ${home}` : bound);
}

/**
 * Where each member of a party stands at a moment of its trip (native x, z), the way each faces and whether it walks.
 * @param {any} trip @param {ReturnType<typeof partyAt>} at
 * @returns {{ res: any, x: number, z: number, yaw: number, moving: boolean }[]}
 */
export function partyPlaces(trip, at) {
  const out = [];
  const n = trip.party.length;
  if (at.camp) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (lwSeed(textSeed(trip.id), 0x63616d70) % 628) / 100;   // 'camp': the ring turned its own way
      const x = /** @type {number} */ (at.x) + Math.sin(a) * CAMP_RING_N, z = /** @type {number} */ (at.z) + Math.cos(a) * CAMP_RING_N;
      out.push({ res: trip.party[i], x, z, yaw: Math.atan2(/** @type {number} */ (at.x) - x, /** @type {number} */ (at.z) - z), moving: false });
    }
    return out;
  }
  const back = at.phase === 'back';
  for (let i = 0; i < n; i++) {
    const s = /** @type {number} */ (at.s) + (back ? 1 : -1) * i * FILE_GAP_N;   // behind the leader, the way they walk
    const p = wayAt(trip.way, s);
    const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * FILE_SIDE_N;
    const yaw = back ? p.yaw + Math.PI : p.yaw;
    out.push({ res: trip.party[i], x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw, moving: true });
  }
  return out;
}

/**
 * @param {{
 *   world: import('../systems/livingWorld/trips.js').TripWorld,
 *   mpm: number, clock: () => number, baseRate: () => number,
 *   sceneOf: (nx: number, nz: number) => number[],
 *   here: () => ({ x: number, z: number } | null),
 *   sprites: ReturnType<typeof import('../world/travellerSprites.js').createTravellerSprites>,
 *   memo?: Map<string, any>,
 *   relations?: () => any, playerName?: () => string, weather?: () => (string|null),
 * }} deps - `here` the player's native place (null: nowhere on the map - indoors, underground); `baseRate` the clock's
 *   minutes a real second at the walking pace's own rate (the rounds' and the lines' beat on the clock)
 */
export function createLivingRoads(deps) {
  /** @type {{ trip: any, at: any }[]} */
  let parties = [];
  let timer = Infinity;
  /** @type {{ key: string, res: any, feet: number[], yaw: number, moving: boolean, distM: number }[]} */
  const list = [];
  /** @type {Map<string, number>} */
  const greeted = new Map();
  /** @type {{ id: string, text: string, until: number }[]} */
  let greetings = [];
  let realNow = 0;
  const memo = deps.memo ?? new Map();
  const dayOf = (t) => Math.floor((t - DAY_START_MIN) / DAY_MIN);

  function refresh(t) {
    const here = deps.here();
    if (!here) { parties = []; return; }
    const px = Math.floor(here.x / NATIVE_PIXEL), py = 499 - Math.floor(here.z / NATIVE_PIXEL);
    parties = partiesNear(px, py, t, deps.world, { mpm: deps.mpm, memo }, ROADS_VIEW_PX).parties;
  }

  /**
   * One frame. `eye` the frame's eye (scene); `overworld` the Overworld's frame while it is up ({ grow, blend }), else
   * null; `ground` false while the world is not the open world's (indoors: nothing stands).
   * @param {number} dt @param {number[]} eye @param {{ overworld?: { grow?: number, blend?: number } | null, ground?: boolean }} [o]
   */
  function frame(dt, eye, { overworld = null, ground = true } = {}) {
    realNow += dt;
    if (!ground) { list.length = 0; deps.sprites.sync(list); return; }
    const t = deps.clock();
    timer += dt;
    if (timer >= ROADS_TICK_S) { timer = 0; refresh(t); }
    const here = deps.here();
    list.length = 0;
    if (here) {
      const reach = overworld ? TRAVELLER_FAR_M + 60 : ROADS_PLAY_M;
      for (const p of parties) {
        const at = partyAt(p.trip, t);
        if (at.phase !== 'out' && at.phase !== 'back') continue;
        if (Math.hypot(/** @type {number} */ (at.x) - here.x, /** @type {number} */ (at.z) - here.z) / NATIVE_PER_M > reach + 40) continue;
        for (const m of partyPlaces(p.trip, at)) {
          const distM = Math.hypot(m.x - here.x, m.z - here.z) / NATIVE_PER_M;
          if (distM > reach) continue;
          list.push({ key: m.res.id, res: m.res, feet: deps.sceneOf(m.x, m.z), yaw: m.yaw, moving: m.moving, distM });
        }
      }
    }
    deps.sprites.sync(list, { dt, eye, grow: overworld?.grow ?? 1, fade: overworld?.blend ?? 1, ground: !overworld });
    if (!overworld && dt > 0) greet(t);
  }

  /** A word to the player passing close - by regard, once in ROAD_GREET_REST_MIN of the clock. */
  function greet(t) {
    for (const m of list) {
      if (m.distM > ROAD_GREET_M) continue;
      const last = greeted.get(m.res.id);
      if (last != null && t - last < ROAD_GREET_REST_MIN) continue;
      greeted.set(m.res.id, t);
      const rel = deps.relations?.() ?? null;
      const standing = rel ? rel.standing(m.res.id, dayOf(t)) : 'neutral';
      const pool = standing === 'friend' ? ROAD_GREETINGS.friend : standing === 'enemy' || standing === 'hostile' ? ROAD_GREETINGS.enemy
        : rel?.known(m.res.id) ? ROAD_GREETINGS.known : ROAD_GREETINGS.stranger;
      const text = fillLine(pool[lwSeed(textSeed(m.res.id), Math.floor(t / 7)) % pool.length], { player: deps.playerName?.() ?? '' });
      greetings = greetings.filter((g) => g.id !== m.res.id && g.until > realNow);
      greetings.push({ id: m.res.id, text, until: realNow + ROAD_GREET_S });
      rel?.seen(m.res.id, dayOf(t));
    }
  }

  /**
   * What the road says this moment: each party's own talk in rounds (walking, or about the fire), and the words to the
   * player - over the speakers standing within `range` of `eye`.
   * @param {number[]} eye @param {number} [range]
   * @returns {{ person: any, text: string, kind: 'talk' }[]}
   */
  function speech(eye, range = 30) {
    const t = deps.clock();
    const rate = deps.baseRate();
    const roundMin = ROUND_S * rate * 1.25, lineMin = lineMinutes(rate);
    greetings = greetings.filter((g) => g.until > realNow);
    const out = [];
    const near = (person) => person?.pos && Math.hypot(person.pos[0] - eye[0], person.pos[2] - eye[2]) <= range;
    for (const g of greetings) {
      const b = deps.sprites.bodyOf(g.id);
      if (b && near(b.person)) out.push({ person: b.person, text: g.text, kind: /** @type {'talk'} */ ('talk') });
    }
    for (const p of parties) {
      if (p.trip.party.length < 2) continue;
      const at = partyAt(p.trip, t);
      if (at.phase !== 'out' && at.phase !== 'back') continue;
      const round = Math.floor(t / roundMin);
      const seed = lwSeed(textSeed(p.trip.id), round);
      const circle = { members: p.trip.party, seed, start: round * roundMin, end: (round + 1) * roundMin, talks: (seed % 1000) / 1000 < TALK_SHARE, index: 0 };
      const line = circleLine(circle, t, lineMin, { place: p.trip.to?.name, weather: deps.weather?.() ?? null, hour: Math.floor((((t % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60), road: at.camp ? 'camp' : 'walk' });
      if (!line) continue;
      const b = deps.sprites.bodyOf(line.who.id);
      if (b && near(b.person) && !greetings.some((g) => g.id === line.who.id)) out.push({ person: b.person, text: line.text, kind: /** @type {'talk'} */ ('talk') });
    }
    return out;
  }

  /**
   * The Overworld's marks: a party within ROADS_VIEW_PX - where its leader is, its kind and where it is bound.
   * @returns {{ key: string, at: number[], label: string, kind: string, trip: any }[]}
   */
  function marks() {
    const t = deps.clock();
    const out = [];
    for (const p of parties) {
      const at = partyAt(p.trip, t);
      if (at.phase !== 'out' && at.phase !== 'back') continue;
      out.push({ key: `party:${p.trip.id}`, at: deps.sceneOf(/** @type {number} */ (at.x), /** @type {number} */ (at.z)), label: partyLabel(p.trip),
        kind: p.trip.kind === 'merchant' ? 'wayfarer caravan' : 'wayfarer', trip: p.trip });
    }
    return out;
  }

  return {
    frame,
    speech,
    marks,
    /** The bodies on the ground as talk targets (the street's own shape). */
    talkSeats: () => deps.sprites.persons(),
    /** This frame's drawn bodies (the exterior's billboard pass). */
    batches: () => deps.sprites.batches(),
    /** The parties read about the player (the probes; the pins). */
    parties: () => parties,
    /** The person's town: the roads note a word in the resident's regard ... */
    talked(person) {
      const id = person?.living?.id;
      if (!id) return null;
      deps.relations?.()?.note(id, 'talk', dayOf(deps.clock()));
      return id;
    },
    /** ... remembers a hand caught in a purse (no watch on the road: the regard is all that comes of it) ... */
    caught(person) {
      const id = person?.living?.id;
      if (!id) return null;
      deps.relations?.()?.note(id, 'crime', dayOf(deps.clock()));
      return id;
    },
    /** ... and an enemy will not talk. */
    refuses(person) {
      const id = person?.living?.id;
      const rel = deps.relations?.();
      if (!id || !rel) return null;
      const s = rel.standing(id, dayOf(deps.clock()));
      return s === 'enemy' || s === 'hostile' ? fillLine(LIVING_REFUSAL, { a: firstNameOf(person.nameNPC) }) : null;
    },
    /** Every body freed and the parties forgotten (the host's teardown). */
    clear() { deps.sprites.clear(); parties = []; list.length = 0; greetings = []; timer = Infinity; },
  };
}
