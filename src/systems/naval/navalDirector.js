// @ts-check
// NAV-C (2026-09-28) - THE SEA'S TRAFFIC: which ships are out there, where they come from and where they go. The
// port's own; pure - the host hands where the players are, what is water and what the sea already holds, and gets
// back a ship to launch or ships to let go.
//
// SHIPS COME OVER THE HORIZON. Every SPAWN_EVERY seconds (a draw between its two numbers) the director rolls for a
// new ship while fewer than the density's own count sail within DESPAWN_BEYOND of a player: it stands the ship
// SPAWN_RING out from the player, on a bearing whose ground is open water deep enough for its hull, and never within
// SPAWN_CLEAR of any player - nobody sees one appear. A ship past DESPAWN_BEYOND of every player, and not in a
// fight, sails out of the world. None of this runs while no player is on the water (the host's gate).
//
// WHO SAILS. The faction by the waters: out on the open bay pirates are the likelier; within PORT_PIXELS of a port
// town the merchantmen and the crown's navy; and a player whose notoriety in these waters has reached HUNTER_AT
// draws the navy after them - HUNTERS: ships that come for the player (the host lays their course at the player,
// NAV-D). The class by faction and level (navalShips.js classFor): a green captain meets sloops, a seasoned one
// brigantines and galleys, and at most one pirate flagship sails at a time.
//
// DETERMINISM. Every spawn's seed is `hash32(seedBase, count)` - the pixel and the day the host folds into
// seedBase, and the spawn's own count - so the same waters on the same day send the same ships, and a pin can name
// one.

import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/bloodArt.js';
import { classFor, HULL } from './navalShips.js';
import { HULL_VARIANT_COUNTS } from '../comeSailAwayBoat.js';

/** How many ships the density keeps at sea near a player. */
export const DENSITY = Object.freeze({ off: 0, few: 2, some: 3, many: 5 });
export const DENSITY_KEYS = Object.freeze(Object.keys(DENSITY));
/** Where a ship is launched (m from the player), how far from every player it must be, and where it leaves. */
export const SPAWN_RING = Object.freeze([650, 1000]);
export const SPAWN_CLEAR = 450;
export const DESPAWN_BEYOND = 1900;
/** Seconds between the director's rolls (a draw in the range), and the first roll's wait after the water is reached. */
export const SPAWN_EVERY = Object.freeze([30, 65]);
export const FIRST_ROLL_S = 12;
/** A roll's chance to launch a ship when there is room for one. */
export const SHIP_SPAWN_CHANCE = 0.8;
/** The factions' weights: the open bay, and what a port within PORT_PIXELS and a notoriety at HUNTER_AT add. */
export const FACTION_WEIGHTS = Object.freeze({ pirate: 45, merchant: 38, navy: 17 });
export const PORT_PIXELS = 3;
export const PORT_WEIGHTS = Object.freeze({ merchant: 30, navy: 15 });
export const HUNTER_AT = 50;
export const HUNTER_WEIGHT = 45;
/** The bearings a spawn tries before it gives the roll up. */
export const SPAWN_TRIES = 10;

/** A weighted pick from `{ key: weight }` with a draw in [0, 1). */
export function weightedPick(weights, r) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let x = Math.max(0, Math.min(0.999999, r)) * total;
  for (const k of keys) { if ((x -= weights[k]) < 0) return k; }
  return keys[keys.length - 1] ?? null;
}

/** The factions' weights for these waters. */
export function factionWeights({ nearPort = false, notoriety = 0 } = {}) {
  const w = { ...FACTION_WEIGHTS };
  if (nearPort) { w.merchant += PORT_WEIGHTS.merchant; w.navy += PORT_WEIGHTS.navy; }
  if (notoriety >= HUNTER_AT) w.navy += HUNTER_WEIGHT;
  return w;
}

/**
 * The director. `step(dt, ctx)` answers `{ spawn: spec | null, despawn: id[] }`:
 *   ctx = { density, player: [x, y, z], players: [x, y, z][] (every player the host places - itself included),
 *           level, ships: [{ id, pos, classId, engaged, afloat }], isOpenWater(x, z, hull), nearPort, notoriety, seedBase,
 *           seaY }
 * Only a ship `afloat` (not false) counts against the density - a prize, a struck hulk, a ship going down is still at
 * sea but fills no berth (AUDIT NAV1 B1: three prizes emptied the sea until the next transition).
 * A spec is `{ seed, classId, variant, pos, yaw, hunter }`.
 */
export function createNavalDirector({ random = Math.random } = {}) {
  let wait = FIRST_ROLL_S;
  let count = 0;
  const director = {
    step(dt, ctx) {
      const out = { spawn: null, despawn: [] };
      const players = ctx.players?.length ? ctx.players : [ctx.player];
      const nearest = (p) => Math.min(...players.map((q) => Math.hypot(p[0] - q[0], p[2] - q[2])));
      for (const s of ctx.ships ?? []) if (!s.engaged && nearest(s.pos) > DESPAWN_BEYOND) out.despawn.push(s.id);
      wait -= Math.max(0, dt);
      if (wait > 0) return out;
      wait = SPAWN_EVERY[0] + random() * (SPAWN_EVERY[1] - SPAWN_EVERY[0]);
      const alive = (ctx.ships ?? []).filter((s) => !out.despawn.includes(s.id) && s.afloat !== false).length;   // AUDIT NAV1 (B1): a prize, a hulk or a wreck going down fills no berth
      if (alive >= (ctx.density ?? 0) || random() >= SHIP_SPAWN_CHANCE) return out;
      const seed = hash32(ctx.seedBase >>> 0, count++);
      const rng = mulberry32(seed);
      const faction = weightedPick(factionWeights({ nearPort: !!ctx.nearPort, notoriety: ctx.notoriety ?? 0 }), rng());
      let cls = classFor(faction, ctx.level ?? 1, rng());
      if (cls?.flagship && (ctx.ships ?? []).some((s) => s.classId === cls.id)) cls = classFor(faction, 1, rng());   // one flagship at a time
      if (!cls) return out;
      for (let i = 0; i < SPAWN_TRIES; i++) {
        const a = rng() * Math.PI * 2;
        const d = SPAWN_RING[0] + rng() * (SPAWN_RING[1] - SPAWN_RING[0]);
        const pos = [ctx.player[0] + Math.sin(a) * d, ctx.seaY ?? ctx.player[1], ctx.player[2] + Math.cos(a) * d];
        if (nearest(pos) < SPAWN_CLEAR) continue;
        if (!ctx.isOpenWater(pos[0], pos[2], cls.hull)) continue;
        const hunter = faction === 'navy' && (ctx.notoriety ?? 0) >= HUNTER_AT;
        // a hunter comes for the player; anyone else crosses the player's waters on a slant
        const toPlayer = Math.atan2(ctx.player[0] - pos[0], ctx.player[2] - pos[2]);
        const yaw = hunter ? toPlayer : toPlayer + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.9);
        const variants = HULL_VARIANT_COUNTS[cls.hull] ?? 0;
        const variant = cls.hull === HULL.LargeBoat && variants > 0 ? Math.floor(rng() * variants) : 0;
        out.spawn = { seed, classId: cls.id, variant, pos, yaw, hunter };
        break;
      }
      return out;
    },
    /** The water was left, or a transition: the next roll waits its first wait again. */
    reset() { wait = FIRST_ROLL_S; },
    get count() { return count; },
    set count(n) { count = Math.max(0, n | 0); },
  };
  return director;
}

/** The seed base of a pixel on a day - what the host folds the waters into. */
export const seedBaseOf = (px, py, day, salt = 0x5ea) => hash32(px | 0, py | 0, day | 0, salt);
