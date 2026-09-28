// @ts-check
// COME SAIL AWAY - THE WIRE (CSA-J, 2026-09-28). The mod is single-player: a boat is a possession in its owner's save,
// placed and sailed on their client alone (systems/onlineLane.js ONLINE_PLAYERS_OWN_MODS). Online, the others in a
// cell should SEE it - the hull a sailor stands on, the boats they left at the shore - as Horse Cart and Cargo's team
// is seen (systems/horseCartWire.js, whose law this follows): `sa` on the owner's own foes frame, beside the camps'
// `c` and the team's `hv`, under the same owner law (an owner's word replaces that owner's and no one else's; an owner
// gone quiet takes theirs with them). The relay reads nothing inside a foes frame, so the word needs no relay change.
//
// The record is what the presentation shows, not the save: each active boat's hull, its variant, its root's place
// and turn (the wire frame's natives, as every cell object's), which of its sails stand raised, whether its owner is
// at its helm (the crew's two objects) and whether its lanterns are lit. Nothing of the cargo, the wind, the helm's
// way or the time scale rides - a peer's boat is a thing to see, not to board, open or sail: it stands no collider
// and answers no activation (scenes/comeSailAwayPool.js's peers). Its bob, wake, oars, sounds and trim are not
// played for the others (the owner's own frame drives them; the wire carries the pose five times a second).
import { POSE_BOUND, POSE_Y_BOUND } from '../net/wire.js';
import { HULL_NAMES } from './comeSailAwayBoat.js';

/** The boats one word carries - a player's shore holds few, and a frame's size is the room's. */
export const CSA_WIRE_BOATS_MAX = 8;
/** The variants a boat can be (the mod's `variantNames`, I to X). */
export const CSA_WIRE_VARIANTS = 10;
/** The sails a hull's bits can name (the Carrack's are the most). */
export const CSA_WIRE_SAILS_MAX = 16;
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const finite3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const inBounds = (p) => Math.abs(p[0]) <= POSE_BOUND && Math.abs(p[2]) <= POSE_BOUND && Math.abs(p[1]) <= POSE_Y_BOUND;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * My word: the boats as they stand, in scene units - `[{ hull, variant, position, rotation, sails, helm, light }]`
 * (sails a bit per raised sail in the boat's own order) - and `toWire` converting a scene point to the wire frame.
 * @returns {{ b: number[][] } | null} null when none stands (the reader drops mine)
 */
export function csaWireRecord(view, toWire = (p) => p) {
  if (!Array.isArray(view)) return null;
  const b = [];
  for (const v of view) {
    if (b.length >= CSA_WIRE_BOATS_MAX) break;
    if (!v || !int(v.hull, 0, HULL_NAMES.length - 1) || !finite3(v.position) || !Array.isArray(v.rotation) || v.rotation.length !== 4) continue;
    const p = toWire(v.position);
    const q = v.rotation;
    b.push([v.hull, v.variant | 0, r2(p[0]), r2(p[1]), r2(p[2]), r4(q[0]), r4(q[1]), r4(q[2]), r4(q[3]), (v.sails | 0) & ((1 << CSA_WIRE_SAILS_MAX) - 1), v.helm ? 1 : 0, v.light ? 1 : 0]);
  }
  return b.length ? { b } : null;
}

/**
 * A peer's word through the door: shape, a known hull and variant, bounds, a unit quaternion, the sail bits and two
 * flags. Anything else is null - the record is dropped whole.
 * @returns {{ boats: { hull:number, variant:number, position:number[], rotation:number[], sails:number, helm:boolean, light:boolean }[] } | null}
 */
export function validCsaRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.b)) return null;
  if (raw.b.length < 1 || raw.b.length > CSA_WIRE_BOATS_MAX) return null;
  const boats = [];
  for (const w of raw.b) {
    if (!Array.isArray(w) || w.length !== 12 || !w.every(Number.isFinite)) return null;
    if (!int(w[0], 0, HULL_NAMES.length - 1) || !int(w[1], 0, CSA_WIRE_VARIANTS - 1)) return null;
    const p = [w[2], w[3], w[4]];
    if (!inBounds(p)) return null;
    const q = [w[5], w[6], w[7], w[8]];
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    if (!(len > 0.5 && len < 2)) return null;
    if (!int(w[9], 0, (1 << CSA_WIRE_SAILS_MAX) - 1)) return null;
    if ((w[10] !== 0 && w[10] !== 1) || (w[11] !== 0 && w[11] !== 1)) return null;
    boats.push({ hull: w[0], variant: w[1], position: p, rotation: q.map((v) => v / len), sails: w[9], helm: w[10] === 1, light: w[11] === 1 });
  }
  return { boats };
}

/** A change key, so a frame carries the record only when the word moved (the full frame always does). */
export const csaRecordKey = (rec) => (rec ? JSON.stringify(rec.b) : '');
