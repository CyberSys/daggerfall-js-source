// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW8 (2026-10-05, bible/06-Systems/Living-World.md "LW8"): THE DOORS OPEN - the living world's residents inside the
// building the player is in. Mac: NPCs "dynamically all have tasks ... perform activities". LW2 stood a resident's day
// in the street and shut the door behind them; this stands what is behind the door.
//
// WHO. The town's own word (livingTown.js insideAt): each resident whose day has them in this building at the clock's
// minute - the evening's drinkers at the tavern, the errand's customers at a shop, the faithful at the temple, members
// at the guild hall, a household at home awake - read again each INDOOR_TICK_S; never the asleep, and never the
// building's own staff at their work where it is no house (DFU's static people stand for them, as they always have).
// WHERE. A room has no grid to walk; the room is SOUNDED once from where the player came in (`origin`): a fan of
// INDOOR_FAN directions walked out to INDOOR_SPREAD_M through the room's own collider (`move` - never through a wall),
// each landing on a floor (`floorAt`), kept INDOOR_APART_M from every other, from the building's static people and from
// the way in - and each resident given one, in the order of their ids over an order the building's key deals (those in
// the room on the way in stand alike for every reader). They stand facing into the room, in their own clothes (indoors
// no one is armed), to INDOOR_MAX.
// COMING AND GOING. One whose day takes them in comes on, one whose day takes them out goes - where the player is not
// looking, or at once on the way in (the room as the day has it, LW2's arrival law).
// TALK. Each is a talk target in the street's own shape ({ person, pos }), so the street's own talk ray takes them
// (townTalk.tryActivate through the host's press hook) - and their regard hears it as the street's does (the host's
// door: a refusal, a word, a tone); a hand caught in a purse here is seen by those in the room (`caught`).
//
// EVERY ALLOCATION HAS AN OWNER: each body is the sprites' (travellerSprites.js), synced each frame from this list;
// `clear()` frees them all - the building left, the living world off, the host's teardown.
// ═══════════════════════════════════════════════════════════════════
import { WITNESS_M } from '../systems/livingWorld/livingTown.js';

/** Who is inside is read this often (real seconds). */
export const INDOOR_TICK_S = 1;
/** The directions a room is sounded in from the way in, and the distances walked out along each (m). */
export const INDOOR_FAN = 12;
export const INDOOR_SPREAD_M = Object.freeze([2.4, 3.8, 5.2, 6.6]);
/** How far apart two spots stand (m), and how far a spot keeps from a static person and from the way in (m). */
export const INDOOR_APART_M = 1.3;
export const INDOOR_CLEAR_M = 1.1;
export const INDOOR_DOOR_M = 1.8;
/** The most residents stood in one room. */
export const INDOOR_MAX = 12;
/** A coming or a going waits for the player to look away unless it is this far off (m) - indoors, little is. */
export const INDOOR_SEEN_M = 14;

/**
 * Sound a room: from `origin` (feet), a fan of directions walked out through the collider and landed on its floor,
 * kept apart from each other, from `keepClear` (feet) and from the way in. Pure over the collider's answers.
 * @param {number[]} origin @param {{ move: (feet: number[], dx: number, dy: number, dz: number, height: number) => any }} collider
 * @param {(x: number, y: number, z: number) => (number|null)} floorAt - the floor's height under a point, or null
 * @param {readonly number[][]} [keepClear]
 * @returns {number[][]}
 */
export function soundRoom(origin, collider, floorAt, keepClear = []) {
  const spots = [];
  const far = (p, list, d) => list.every((q) => Math.hypot(p[0] - q[0], p[2] - q[2]) >= d);
  for (const dist of INDOOR_SPREAD_M) {
    for (let i = 0; i < INDOOR_FAN; i++) {
      const a = (i / INDOOR_FAN) * Math.PI * 2 + (dist / 7);
      const q = [origin[0], origin[1] + 0.05, origin[2]];
      try { collider.move(q, Math.sin(a) * dist, 0, Math.cos(a) * dist, 1.8); } catch { continue; }
      const y = floorAt(q[0], q[1] + 0.5, q[2]);
      if (y == null || !Number.isFinite(y) || Math.abs(y - origin[1]) > 1.2) continue;   // a floor of this room, not a stair's foot or a hole
      const p = [q[0], y, q[2]];
      if (Math.hypot(p[0] - origin[0], p[2] - origin[2]) < INDOOR_DOOR_M) continue;
      if (!far(p, spots, INDOOR_APART_M) || !far(p, keepClear, INDOOR_CLEAR_M)) continue;
      spots.push(p);
    }
  }
  return spots;
}

/**
 * @param {{
 *   sprites: ReturnType<typeof import('../world/travellerSprites.js').createTravellerSprites>,
 *   building: () => ({ key: number, town: any } | null),
 *   collider: () => any,
 *   floorAt: (x: number, y: number, z: number) => (number|null),
 *   origin: () => (number[] | null),
 *   staticFeet: () => number[][],
 *   clock: () => number,
 *   ready?: () => boolean,
 * }} deps - `building()` the building the player is in and its town's LivingTown (null: none, or not a living town's);
 *   `origin()` where the player came in (feet, the room's frame); `floorAt` the room's floor under a point;
 *   `staticFeet()` the building's static people standing; `ready()` whether the room is whole (nothing loading)
 */
export function createLivingIndoors(deps) {
  /** @type {{ key: number, spots: number[][], centre: number[], order: number[] } | null} */
  let room = null;
  /** @type {Map<string, { res: any, spot: number }>} who stands where */
  const stood = new Map();
  /** @type {{ res: any }[]} who the day has inside, at the last read */
  let inside = [];
  let timer = Infinity;
  let arriving = true;
  /** @type {any[]} */
  const list = [];

  /** The building's own deal of its spots: a seeded order, the same for every reader. */
  const dealOf = (key, n) => {
    const order = Array.from({ length: n }, (_, i) => i);
    let h = (key * 2654435761) >>> 0;
    for (let i = n - 1; i > 0; i--) { h = (Math.imul(h ^ (h >>> 15), 2246822519) + i) >>> 0; const j = h % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    return order;
  };

  function clear() {
    deps.sprites.clear();
    stood.clear();
    inside = [];
    room = null;
    timer = Infinity;
    arriving = true;
    list.length = 0;
  }

  /** The first free spot in the building's deal. */
  const freeSpot = () => {
    const taken = new Set([...stood.values()].map((s) => s.spot));
    return room?.order.find((i) => !taken.has(i)) ?? -1;
  };

  return {
    /**
     * One frame inside: the room sounded on the way in, who is inside read on its beat, comings and goings where the
     * player is not looking, every body synced. `feet` the player's (the room's frame), `viewYaw` the camera's yaw.
     * @param {number} dt @param {number[]} feet @param {number} viewYaw @param {number[]} eye
     */
    frame(dt, feet, viewYaw, eye) {
      const b = deps.building();
      if (!b?.town || deps.ready?.() === false) { if (room || stood.size) clear(); return; }
      if (!room || room.key !== b.key) {
        clear();
        const origin = deps.origin() ?? feet;
        const collider = deps.collider();
        const spots = collider ? soundRoom(origin, collider, deps.floorAt, deps.staticFeet()) : [];
        const cx = spots.reduce((s, p) => s + p[0], 0) / Math.max(1, spots.length), cz = spots.reduce((s, p) => s + p[2], 0) / Math.max(1, spots.length);
        room = { key: b.key, spots, centre: [cx, origin[1], cz], order: dealOf(b.key, spots.length) };
      }
      timer += dt;
      if (timer >= INDOOR_TICK_S) {
        timer = 0;
        inside = b.town.insideAt(b.key, deps.clock()).slice(0, INDOOR_MAX);
      }
      // comings and goings: at once on the way in, else where the player is not looking (or far)
      const unseen = (p) => {
        const dx = p[0] - feet[0], dz = p[2] - feet[2];
        return arriving || Math.hypot(dx, dz) > INDOOR_SEEN_M || dx * Math.sin(viewYaw) + dz * Math.cos(viewYaw) <= 0;
      };
      const want = new Set(inside.map((x) => x.res.id));
      for (const [id, s] of [...stood]) if (!want.has(id) && unseen(room.spots[s.spot])) stood.delete(id);
      for (const { res } of inside) {
        if (stood.has(res.id)) continue;
        const spot = freeSpot();
        if (spot < 0) break;
        if (!unseen(room.spots[spot])) continue;
        stood.set(res.id, { res: { ...res, cls: null }, spot });   // indoors no one is armed
      }
      arriving = false;
      list.length = 0;
      for (const [id, s] of stood) {
        const p = room.spots[s.spot];
        list.push({ key: `in:${id}`, res: s.res, feet: p, yaw: Math.atan2(room.centre[0] - p[0], room.centre[2] - p[2]), moving: false, distM: Math.hypot(p[0] - feet[0], p[2] - feet[2]) });
      }
      deps.sprites.sync(list, { dt, eye, ground: true });
    },
    /** The bodies' talk seats ({ person, pos } - the street's activation shape). */
    seats: () => deps.sprites.persons(),
    /** This frame's drawn bodies (the building's billboard pass). */
    batches: () => deps.sprites.batches(),
    /** The town the room's residents belong to (the host's door asks it), or null. */
    town: () => deps.building()?.town ?? null,
    /**
     * A hand caught in a purse here: the crime in the regard of the one robbed and of every resident in the room within
     * the street's witness reach. Answers the resident's id, or null.
     * @param {any} person
     */
    caught(person) {
      const id = person?.living?.id;
      const town = deps.building()?.town;
      if (!id || !town) return null;
      const rel = town.o?.relations?.();
      const day = town.dayOf(deps.clock());
      rel?.note(id, 'crime', day);
      const at = person.pos;
      for (const seat of deps.sprites.persons()) {
        const w = seat.person?.living?.id;
        if (!w || w === id || !at || Math.hypot(seat.pos[0] - at[0], seat.pos[2] - at[2]) > WITNESS_M) continue;
        rel?.note(w, 'crime', day);
      }
      return id;
    },
    /** Who stands where (the probes; the pins). */
    stood: () => [...stood.entries()].map(([id, s]) => ({ id, res: s.res, at: room?.spots[s.spot] ?? null })),
    /** The room's spots (the probes; the pins). */
    spots: () => room?.spots ?? [],
    clear,
    get size() { return stood.size; },
  };
}
