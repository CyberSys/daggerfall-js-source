// @ts-check
// NAV-G (2026-09-28, Mac: "directly integrate into online mode") - THE WIRE: the sea's ships, their volleys and the
// blows on them, between the players in a cell. The port's own; pure.
//
// THE SEA IS THE ROOM'S, STOOD BY ONE. The open bay is cells (net/wire.js isCellRoom) - no host seat, no room memory -
// so the ships a group of players meets are stood the way Iliac Puddle No More's deep is (scenes/deepWatersHost.js
// standsTheDeep, DEEP-SHARE): by ONE of them, the lowest id among the players within NAVAL_SHARE_RADIUS of each
// other (systems/campEncounters.js amGroupRollOwner, with its hysteresis), who launches them, sails them and fights
// them, and says them in `nv` on their own foes frame - beside Come Sail Away's `sa`, which already tells the others
// where each player's own boat is. The relay reads nothing inside a foes frame, so this needs no relay change, and
// this module sits outside the relay's bundle (net/wire.js is inside it) for exactly that reason.
//
// THE WORD. `nv: { s, v, b }`:
//   s - the ships, each [n, cls, variant, x, y, z, yaw, speed, sails, hull%, sail%, crew%, state, heel, seed, fire]
//       in the wire frame's natives (the owner's `toWire`, as every cell object's), at most NAVAL_WIRE_SHIPS
//   v - the volleys of the last NAVAL_VOLLEY_KEEP_MS, each [id, shooter, hull, side, x, y, z, yaw, vx, vz, elevation,
//       seed, skill]: the shooting ship's number (-1: the owner's own boat), its hull and root pose at the fire, the
//       lay and the volley's seed - every receiver flies the same balls from it (navalGunnery.js volleyLaunches) and
//       draws them, hitting nothing (`resolve: false`); at most NAVAL_WIRE_VOLLEYS
//   b - the fire barrels dropped in the same window, each [id, x, y, z], at most NAVAL_WIRE_BARRELS
// A word passes the door whole or not at all (`validNavalRecord`): a known class and variant, bounded places, a state
// the ship can be in, shares in 0..100, a side, a finite lay.
//
// A BLOW ON A SHIP goes to whoever stands it: the directed `hit` frame (`{ to, nv: { n, h, s, c, f, z } }` - the
// ship's number, its hull, sail and crew damage, a fire, the zone) that the relay routes by `to` alone, landed by
// the stander, who says the ship's new state in its next word. `validNavalHit` is its door: bounded damage, no more
// than one broadside's worth in one frame (NAVAL_HIT_MAX). A board is the same frame with `nv.board` (1: I board
// her, 2: she is taken, 3: scuttled, 4: set adrift) - the stander marks her so no one boards her twice.

import { POSE_BOUND, POSE_Y_BOUND } from '../../net/wire.js';
import { SHIP_CLASSES } from './navalShips.js';
import { HULL_NAMES, HULL_VARIANT_COUNTS } from '../comeSailAwayBoat.js';

/** The radius within which players stand one sea between them (m): a ship's fighting reach and then some. */
export const NAVAL_SHARE_RADIUS = 1200;
export const NAVAL_WIRE_SHIPS = 8;
export const NAVAL_WIRE_VOLLEYS = 12;
export const NAVAL_WIRE_BARRELS = 8;
/** How long a volley stays in the word, so every receiver's frame catches it (ms). */
export const NAVAL_VOLLEY_KEEP_MS = 1500;
/** One blow frame's ceiling on each damage (a whole broadside of heavy guns, holed, and some). */
export const NAVAL_HIT_MAX = 400;
/** The states on the wire, by code. */
export const WIRE_STATES = Object.freeze(['afloat', 'struck', 'sinking', 'sunk', 'prize', 'boarded']);
export const SIDE_CODES = Object.freeze(['starboard', 'port', 'bow', 'stern']);
export const BOARD_CODES = Object.freeze({ boarding: 1, taken: 2, scuttled: 3, adrift: 4 });

const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const inBounds = (p) => Math.abs(p[0]) <= POSE_BOUND && Math.abs(p[2]) <= POSE_BOUND && Math.abs(p[1]) <= POSE_Y_BOUND;
const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));
const U32 = 0xffffffff;

/**
 * My word: the ships I stand, the volleys and barrels of the last moments - in scene units, `toWire` taking a scene
 * point to the wire frame. Null when there is nothing to say (the reader drops mine).
 * @param {{ ships: any[], volleys: any[], barrels: any[] }} view
 */
export function navalWireRecord(view, toWire = (p) => p) {
  const s = [], v = [], b = [];
  for (const sh of view?.ships ?? []) {
    if (s.length >= NAVAL_WIRE_SHIPS) break;
    const cls = SHIP_CLASSES.findIndex((c) => c.id === sh.classId);
    if (cls < 0 || !Array.isArray(sh.pos) || !sh.pos.every(Number.isFinite)) continue;
    const p = toWire(sh.pos);
    s.push([sh.n | 0, cls, sh.variant | 0, r2(p[0]), r2(p[1]), r2(p[2]), r4(sh.yaw), r2(sh.speed), r2(sh.sails), pct(sh.hull), pct(sh.sail), pct(sh.crew),
      Math.max(0, WIRE_STATES.indexOf(sh.state)), Math.round(sh.heel * 10) / 10, sh.seed >>> 0, sh.fire ? 1 : 0]);
  }
  for (const vo of view?.volleys ?? []) {
    if (v.length >= NAVAL_WIRE_VOLLEYS) break;
    const side = SIDE_CODES.indexOf(vo.side);
    if (side < 0 || !Array.isArray(vo.pos)) continue;
    const p = toWire(vo.pos);
    v.push([vo.id >>> 0, vo.shooter | 0, vo.hull | 0, side, r2(p[0]), r2(p[1]), r2(p[2]), r4(vo.yaw), r2(vo.vel?.[0] ?? 0), r2(vo.vel?.[2] ?? 0), r4(vo.elevation), vo.seed >>> 0, r2(vo.skill ?? 0.5)]);
  }
  for (const ba of view?.barrels ?? []) {
    if (b.length >= NAVAL_WIRE_BARRELS) break;
    const p = toWire(ba.pos);
    b.push([ba.id >>> 0, r2(p[0]), r2(p[1]), r2(p[2])]);
  }
  return s.length || v.length || b.length ? { s, v, b } : null;
}

/**
 * A peer's word through the door - whole or not at all.
 * @returns {{ ships: any[], volleys: any[], barrels: any[] } | null}
 */
export function validNavalRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw.s ?? [], v = raw.v ?? [], b = raw.b ?? [];
  if (!Array.isArray(s) || !Array.isArray(v) || !Array.isArray(b)) return null;
  if (s.length > NAVAL_WIRE_SHIPS || v.length > NAVAL_WIRE_VOLLEYS || b.length > NAVAL_WIRE_BARRELS) return null;
  const ships = [];
  for (const w of s) {
    if (!Array.isArray(w) || w.length !== 16 || !w.every(Number.isFinite)) return null;
    if (!int(w[0], 0, 0xffff) || !int(w[1], 0, SHIP_CLASSES.length - 1)) return null;
    const cls = SHIP_CLASSES[w[1]];
    const variants = HULL_VARIANT_COUNTS[cls.hull] ?? 0;
    if (!int(w[2], 0, Math.max(0, variants - 1))) return null;
    const pos = [w[3], w[4], w[5]];
    if (!inBounds(pos) || Math.abs(w[6]) > 7 || w[7] < 0 || w[7] > 40 || w[8] < 0 || w[8] > 1) return null;
    if (!int(w[9], 0, 100) || !int(w[10], 0, 100) || !int(w[11], 0, 100) || !int(w[12], 0, WIRE_STATES.length - 1)) return null;
    if (Math.abs(w[13]) > 90 || !int(w[14], 0, U32) || (w[15] !== 0 && w[15] !== 1)) return null;
    ships.push({ n: w[0], classId: cls.id, hull: cls.hull, variant: w[2], pos, yaw: w[6], speed: w[7], sails: w[8], hull100: w[9], sail100: w[10], crew100: w[11], state: WIRE_STATES[w[12]], heel: w[13], seed: w[14], fire: w[15] === 1 });
  }
  const volleys = [];
  for (const w of v) {
    if (!Array.isArray(w) || w.length !== 13 || !w.every(Number.isFinite)) return null;
    if (!int(w[0], 0, U32) || !int(w[1], -1, 0xffff) || !int(w[2], 0, HULL_NAMES.length - 1) || !int(w[3], 0, SIDE_CODES.length - 1)) return null;
    const pos = [w[4], w[5], w[6]];
    if (!inBounds(pos) || Math.abs(w[7]) > 7 || Math.abs(w[8]) > 40 || Math.abs(w[9]) > 40 || Math.abs(w[10]) > 1.6 || !int(w[11], 0, U32) || w[12] < 0 || w[12] > 1) return null;
    volleys.push({ id: w[0], shooter: w[1], hull: w[2], side: SIDE_CODES[w[3]], pos, yaw: w[7], vel: [w[8], 0, w[9]], elevation: w[10], seed: w[11], skill: w[12] });
  }
  const barrels = [];
  for (const w of b) {
    if (!Array.isArray(w) || w.length !== 4 || !w.every(Number.isFinite) || !int(w[0], 0, U32)) return null;
    const pos = [w[1], w[2], w[3]];
    if (!inBounds(pos)) return null;
    barrels.push({ id: w[0], pos });
  }
  return { ships, volleys, barrels };
}

/** A change key: the word rides a delta frame only when it moved (the full frame always carries it). */
export const navalRecordKey = (rec) => (rec ? JSON.stringify(rec) : '');

/** The blow's `nv`, as its striker sends it. */
export function navalHitData(to, { n, hull = 0, sail = 0, crew = 0, fire = false, zone = 'hull', board = 0 }) {
  const nv = { n: n | 0, h: Math.round(hull), s: Math.round(sail), c: crew | 0, f: fire ? 1 : 0, z: zone === 'rig' ? 1 : zone === 'holed' ? 2 : 0 };
  if (board) nv.board = board | 0;
  return { to, nv };
}

/**
 * A blow on a ship I stand, through the door: bounded numbers, a known zone, a board code. Null for anything else.
 * @returns {{ n: number, hull: number, sail: number, crew: number, fire: boolean, zone: string, board: number } | null}
 */
export function validNavalHit(data) {
  const nv = data?.nv;
  if (!nv || typeof nv !== 'object' || Array.isArray(nv)) return null;
  if (!int(nv.n, 0, 0xffff) || !int(nv.h, 0, NAVAL_HIT_MAX) || !int(nv.s, 0, NAVAL_HIT_MAX) || !int(nv.c, 0, 60)) return null;
  if ((nv.f !== 0 && nv.f !== 1) || !int(nv.z, 0, 2)) return null;
  if (nv.board !== undefined && !int(nv.board, 1, 4)) return null;
  return { n: nv.n, hull: nv.h, sail: nv.s, crew: nv.c, fire: nv.f === 1, zone: ['hull', 'rig', 'holed'][nv.z], board: nv.board ?? 0 };
}
