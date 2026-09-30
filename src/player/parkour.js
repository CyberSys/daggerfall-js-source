// CLIMB1 (2026-09-30, the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md):
// THE LEDGE SENSOR, THE MANTLE AND THE VAULT. Mac: "a proper and detailed
// climbing system... Being able to latch, mantle, jump from one location to
// another ledge. Almost parkour like", after Assassin's Creed and Dying Light.
// His four calls: JUMP IS THE GRAB, THE SKILL SCALES IT (it gates no move),
// SHEER WALLS FREE-CLIMB ON GRIP, and LEAPS OF THEIR OWN scaled by Jumping.
//
// The port's own law, not DFU's: ClimbingMotor's classic path (climbing.js)
// has no idea what a ledge is - the wall-hug shoves the capsule over the lip
// (DISC21) - and its `AdvancedClimbing` arms (hang, rappel, corner wraps) are
// Ledger A off-road and stay so. This module is ENHANCED LANE ONLY: the motor
// consults it only when its host hands `parkour` deps whose switch answers
// yes (scenes/shared.js parkourDeps - the enhanced skin and the Features row),
// so the classic climb is untouched on the classic skin and with the row off.
//
// What CLIMB1 moves:
//   - MANTLE: a lip within reach of the hands (Jump pressed on the ground, Jump
//     held in the air, or the classic climb arriving under one) is climbed
//     onto along a scripted path - up the face, then over the lip - ending
//     standing on the top, or crouched where only a crouch fits;
//   - VAULT: a lip at the waist or under whose top ends within a stride,
//     taken at a run with Forward held, is passed over and the body carries
//     on beyond it with its momentum.
// The path is SCRIPTED, not physics (the one thing both reference games do),
// and it is proven clear before it starts: every point it passes through is
// a capsule the collider says fits.
//
// This module is pure - the collider is handed in and nothing is imported
// from the motor, whose constants arrive as arguments (the motor imports this
// file; a top-level read of a motor constant here would meet the cycle's TDZ).

import { KHAJIIT_CLIMBING_BONUS } from './climbing.js';

/** The lip height above the feet a standing body reaches with its hands, at
 *  Climbing 0 and at Climbing 100: a ledge at the chest, and one at the full
 *  stretch of the arms over a 1.8 m capsule. */
export const PARKOUR_REACH_MIN = 1.5;
export const PARKOUR_REACH_MAX = 2.1;
/** In the air or on the wall the arms are already up: this much more reach. */
export const PARKOUR_AIR_REACH = 0.15;
/** In the air a lip as low as the knees is still one to climb onto. On the
 *  ground the floor of the band is the step offset - under it the step
 *  ladder already walks the body up (collider.js _moveStep). */
export const PARKOUR_AIR_LOW = 0.25;
/** How far past the capsule's side the face may stand and still be grabbed. */
export const PARKOUR_WALL_REACH = 0.5;
/** The look must meet the face within 50 degrees of square. */
export const PARKOUR_FACING_DOT = Math.cos((50 * Math.PI) / 180);
/** A face is a wall while its normal's y is at most this (60 degrees from
 *  level or steeper); anything flatter is a slope the body walks. */
export const PARKOUR_FACE_MAX_NY = 0.5;
/** A top pitched past 45 degrees is a roof the body would slide off. */
export const PARKOUR_TOP_MIN_NY = Math.cos((45 * Math.PI) / 180);
/** The wall scan's rung: level rays this far apart up the face. */
export const PARKOUR_SCAN_STEP = 0.2;
/** The down ray that finds the top lands this far past the face. */
export const PARKOUR_LIP_INSET = 0.2;
/** The feet land the capsule's radius plus this past the face. */
export const PARKOUR_TOP_INSET = 0.12;
/** The top under the landing feet is sought from this far over the lip, and
 *  may stand 0.35 above or below it. */
export const PARKOUR_TOP_PROBE = 0.3;
/** The body rises this far off the face, and this far over the lip. */
export const PARKOUR_UP_GAP = 0.04;
/** "Clear": the push collider.penetrationAt reports, findClearFloor's own. */
export const PARKOUR_FIT_EPS = 0.03;
/** A vault: the lip at the waist or under, the top ending within a stride. */
export const PARKOUR_VAULT_MAX = 1.2;
export const PARKOUR_VAULT_DEPTH = 0.9;
/** The vault's body clears the top by this, and leaves it with this rise. */
export const PARKOUR_VAULT_CLEAR = 0.08;
export const PARKOUR_VAULT_EXIT_VY = 1.0;
/** The slowest a vault leaves its far side, m/s - a standing vault still
 *  carries the body off the top rather than dropping it onto the edge. */
export const PARKOUR_VAULT_EXIT_MIN = 3.5;

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** The Climbing skill the moves read: the classic law's own arithmetic
 *  (climbing.js climbingChance - +30 for a Khajiit, doubled under the
 *  Climbing effect), held to 0..100 because past 100 (SOFTCAP1) the reach
 *  and the pace have nowhere further to go. */
export function parkourSkill({ climbing = 0, khajiit = false, enhanced = false } = {}) {
  let s = climbing + (khajiit ? KHAJIIT_CLIMBING_BONUS : 0);
  if (enhanced) s *= 2;
  return Math.min(100, Math.max(0, s));
}

/** The lip height a standing body's hands reach at this skill. */
export function parkourReach(skill) {
  return lerp(PARKOUR_REACH_MIN, PARKOUR_REACH_MAX, clamp01(skill / 100));
}

/** Seconds a mantle takes: longer the higher the lip, a third quicker at
 *  Climbing 100 than at 0 (a 2 m lip: 0.9 s at 0, 0.55 s at 100). */
export function mantleDuration(rise, skill) {
  return (0.25 + 0.22 * Math.max(0, rise)) * (1.3 - 0.5 * clamp01(skill / 100));
}

/** Seconds a vault takes, the same shape and quicker. */
export function vaultDuration(rise, skill) {
  return (0.22 + 0.12 * Math.max(0, rise)) * (1.2 - 0.3 * clamp01(skill / 100));
}

/** A capsule at these feet, this tall, stands in the open. Two questions,
 *  because penetrationAt is one of them only: it reports how far the
 *  resolve PUSHED the body, and the resolve will not depenetrate a body up
 *  into a ceiling - it reverts it (collider.js _resolveCapsule, "A body
 *  cannot be depenetrated UP into a ceiling") - so a standing body with its
 *  head through a slab reads clear there. The ray up the axis to the head
 *  is the headroom. (A body wholly inside a thick solid would pass both;
 *  the sensor never asks about a point it did not reach through the open -
 *  the top by a down ray from a height a level ray found clear, the risen
 *  body in the column over the body's own head.) */
export function capsuleFits(collider, p, height) {
  if (!(collider.penetrationAt(p, height) < PARKOUR_FIT_EPS)) return false;
  return !Number.isFinite(collider.raycast([p[0], p[1] + 0.05, p[2]], [0, 1, 0], height - 0.1));
}

/**
 * THE LEDGE SENSOR. From the feet, looking along `dir` (a horizontal unit
 * vector), is there a lip the hands can take - and where would the body go?
 *
 *   1. THE WALL: level rays from the capsule's axis, from `low` over the feet
 *      upward every 0.2 m; the lowest to meet a near-vertical face within
 *      reach that the look meets within 50 degrees is the wall.
 *   2. THE OPEN: the scan climbs on until a level ray runs clear past the
 *      face - the first height the wall is no longer there. None by `high`
 *      plus a rung is a wall that runs on above the reach. The top is then
 *      found by a ray straight down just past the face, from that height -
 *      never from a fixed height, which in a low dungeon room would start
 *      inside the ceiling and meet its underside.
 *   3. THE LIP: the top is level enough to stand on and inside the band, the
 *      face runs up to it (a level ray just under it meets the face) and the
 *      edge is open for the hands (a level ray just over it meets nothing).
 *   4. THE ROOM: the body fits standing on the top (else crouched, else no),
 *      fits risen in front of the face with its feet at the lip, and has a
 *      clear column over its head to rise through.
 *
 * `opts` = { low, high, radius, stand, crouch, height } - the band, the
 * capsule's radius, its standing and crouched heights, and its height now.
 * Answers { ok: false, why } when there is no lip in reach, else { ok: true,
 * lipY, rise, normal, into, face, mantle, why } - `mantle` is { up, top,
 * crouch } when the body can end on the top, else null with the reason in
 * `why`. The whys are what the pins and the probe read.
 */
export function senseLedge(collider, feet, dir, opts) {
  const { low, high, radius, stand, crouch, height = stand } = opts;
  if (!collider?.raycastHit) return { ok: false, why: 'no-collider' };
  const reach = radius + PARKOUR_WALL_REACH;
  const heights = [];
  for (let h = low; h < high + PARKOUR_SCAN_STEP; h += PARKOUR_SCAN_STEP) heights.push(h);
  // 1. the wall
  let wall = null, i = 0;
  for (; i < heights.length && heights[i] <= high; i++) {
    const y = feet[1] + heights[i];
    const hit = collider.raycastHit([feet[0], y, feet[2]], dir, reach);
    if (!Number.isFinite(hit.dist) || !hit.normal) continue;
    const [nx, ny, nz] = hit.normal;
    const l = Math.hypot(nx, nz);
    if (Math.abs(ny) <= PARKOUR_FACE_MAX_NY && l > 1e-4
        && -(nx * dir[0] + nz * dir[2]) / l >= PARKOUR_FACING_DOT) {
      wall = { y, dist: hit.dist, normal: [nx / l, 0, nz / l] };
      break;
    }
  }
  if (!wall) return { ok: false, why: 'no-wall' };
  const wn = wall.normal;                       // out of the wall, toward the body
  const into = [-wn[0], 0, -wn[2]];
  // 2. the open
  const past = wall.dist + PARKOUR_LIP_INSET + 0.05;
  let openY = null;
  for (i++; i < heights.length; i++) {
    const y = feet[1] + heights[i];
    if (!Number.isFinite(collider.raycast([feet[0], y, feet[2]], dir, past))) { openY = y; break; }
  }
  if (openY == null) return { ok: false, why: 'too-high' };
  const fx = feet[0] + dir[0] * wall.dist, fz = feet[2] + dir[2] * wall.dist;
  const ip = [fx + into[0] * PARKOUR_LIP_INSET, openY + 0.02, fz + into[2] * PARKOUR_LIP_INSET];
  const down = collider.surfaceHit(ip, [0, -1, 0], ip[1] - (wall.y - 0.05));
  if (!Number.isFinite(down.dist)) return { ok: false, why: 'no-top' };
  const lipY = ip[1] - down.dist;
  // 3. the lip
  if (!down.normal || down.normal[1] < PARKOUR_TOP_MIN_NY) return { ok: false, why: 'steep-top' };
  const rise = lipY - feet[1];
  if (rise > high) return { ok: false, why: 'too-high' };
  if (rise < low - 0.05) return { ok: false, why: 'too-low' };
  const under = collider.raycastHit([feet[0], lipY - 0.08, feet[2]], dir, wall.dist + 0.3);
  if (!Number.isFinite(under.dist)) return { ok: false, why: 'no-lip' };
  const faceDist = under.dist;
  if (Number.isFinite(collider.raycast([feet[0], lipY + 0.1, feet[2]], dir,
    faceDist + PARKOUR_LIP_INSET + 0.1))) return { ok: false, why: 'blocked-lip' };
  const face = [feet[0] + dir[0] * faceDist, lipY, feet[2] + dir[2] * faceDist];
  // 4. the room - the lip is real from here on; what is left is whether the
  // body can end up standing on it (a fence's top is a lip with no room on
  // it, which is the vault's to answer - senseVault)
  const ledge = { ok: true, lipY, rise, normal: wn, into, face, mantle: null, why: null };
  const tIn = radius + PARKOUR_TOP_INSET;
  const tx = face[0] + into[0] * tIn, tz = face[2] + into[2] * tIn;
  // from just over the lip, not a body's height over it: a lid low over the
  // top would hold a higher origin inside it, and a ray out of a solid meets
  // its underside (a lid that low leaves no room, which the fit says below)
  const floor = collider.surfaceHit([tx, lipY + PARKOUR_TOP_PROBE, tz], [0, -1, 0], PARKOUR_TOP_PROBE + 0.35);
  const topY = lipY + PARKOUR_TOP_PROBE - floor.dist;
  if (!Number.isFinite(floor.dist) || Math.abs(topY - lipY) > 0.35
      || !floor.normal || floor.normal[1] < PARKOUR_TOP_MIN_NY) {
    ledge.why = 'no-top';
    return ledge;
  }
  const top = [tx, topY + 0.02, tz];
  let body = stand, crouched = false;
  if (!capsuleFits(collider, top, stand)) {
    if (!capsuleFits(collider, top, crouch)) { ledge.why = 'no-room'; return ledge; }
    body = crouch;
    crouched = true;
  }
  const up = risePoint(face, wn, radius, lipY + PARKOUR_UP_GAP);
  if (!riseClear(collider, feet, up, body, height)) { ledge.why = 'no-room-up'; return ledge; }
  ledge.mantle = { up, top, crouch: crouched };
  return ledge;
}

/** The feet of a body risen up the face: off it by the radius and a gap. */
function risePoint(face, wn, radius, y) {
  const off = radius + PARKOUR_UP_GAP;
  return [face[0] + wn[0] * off, y, face[2] + wn[2] * off];
}

/** The body can rise from `feet` to `up` and fit there: a clear column over
 *  its head to the risen head's height, and a capsule that fits at the
 *  risen feet and half way along. */
function riseClear(collider, feet, up, body, height) {
  const head = feet[1] + height - 0.05;
  const column = up[1] + body - head;
  if (column > 0 && Number.isFinite(collider.raycast([feet[0], head, feet[2]], [0, 1, 0], column))) return false;
  if (!capsuleFits(collider, up, body)) return false;
  const mid = [(feet[0] + up[0]) / 2, (feet[1] + up[1]) / 2, (feet[2] + up[2]) / 2];
  return capsuleFits(collider, mid, Math.min(body, height));
}

/**
 * THE VAULT'S OWN QUESTION, over a ledge senseLedge found: does the top end
 * within a stride of the face, with room beyond it? Down rays walk the top
 * away from the face every 0.1 m; the first to find no top at the lip's
 * height is past the far edge. Answers { over, depth } - `over` the feet the
 * body leaves the top at, clear by PARKOUR_VAULT_CLEAR - or null (a deep top
 * is mantled onto, not vaulted).
 */
export function senseVault(collider, feet, ledge, { radius, stand, height = stand }) {
  if (!(ledge?.ok) || ledge.rise > PARKOUR_VAULT_MAX) return null;
  const { face, into, normal, lipY } = ledge;
  let depth = null;
  for (let d = 0.2; d <= PARKOUR_VAULT_DEPTH + 1e-6; d += 0.1) {
    const p = [face[0] + into[0] * d, lipY + 0.3, face[2] + into[2] * d];
    if (!Number.isFinite(collider.surfaceHit(p, [0, -1, 0], 0.55).dist)) { depth = d; break; }
  }
  if (depth == null) return null;
  const y = lipY + PARKOUR_VAULT_CLEAR;
  const up = risePoint(face, normal, radius, y);
  if (!riseClear(collider, feet, up, stand, height)) return null;
  const out = depth + radius + 0.1;
  const over = [face[0] + into[0] * out, y, face[2] + into[2] * out];
  const mid = [face[0] + into[0] * (depth / 2), y, face[2] + into[2] * (depth / 2)];
  if (!capsuleFits(collider, over, stand) || !capsuleFits(collider, mid, stand)) return null;
  return { up, over, depth };
}

/** A mantle's move: from the feet, up the face, onto the top. The first
 *  segment's share of the time grows with the rise - a waist-high step-up
 *  is mostly the step over, a head-high pull-up mostly the pull. */
export function planMantle(feet, ledge, skill) {
  return {
    kind: 'mantle',
    from: [feet[0], feet[1], feet[2]],
    up: [...ledge.mantle.up],
    to: [...ledge.mantle.top],
    split: Math.min(0.75, Math.max(0.45, 0.35 + 0.2 * ledge.rise)),
    dur: mantleDuration(ledge.rise, skill),
    arc: 0.06,
    crouch: !!ledge.mantle.crouch,
    exit: null,
    t: 0,
  };
}

/** A vault's move: from the feet up the face to clear the top, over it, and
 *  out beyond the far edge, where the body is handed back to the fall with
 *  its momentum along the wall's own normal (`exitSpeed` m/s). */
export function planVault(feet, ledge, vault, skill, exitSpeed) {
  const s = Math.max(PARKOUR_VAULT_EXIT_MIN, exitSpeed || 0);
  return {
    kind: 'vault',
    from: [feet[0], feet[1], feet[2]],
    up: [...vault.up],
    to: [...vault.over],
    split: 0.4,
    dur: vaultDuration(ledge.rise, skill),
    arc: 0.1,
    crouch: false,
    exit: [ledge.into[0] * s, ledge.into[2] * s],
    t: 0,
  };
}

/** Where a move's feet are at normalised time t: the rise (from -> up) eased
 *  at both ends, then the step over (up -> to) with a small arc over the lip.
 *  Both segments end where the sensor proved a capsule fits, and the first
 *  never comes nearer the face than `up` does. */
export function movePoint(m, t, out = [0, 0, 0]) {
  const u = clamp01(t);
  if (u <= m.split) {
    const k = smooth(m.split > 0 ? u / m.split : 1);
    out[0] = lerp(m.from[0], m.up[0], k);
    out[1] = lerp(m.from[1], m.up[1], k);
    out[2] = lerp(m.from[2], m.up[2], k);
  } else {
    const v = (u - m.split) / (1 - m.split);
    const k = smooth(v);
    out[0] = lerp(m.up[0], m.to[0], k);
    out[1] = lerp(m.up[1], m.to[1], v) + m.arc * Math.sin(Math.PI * v);
    out[2] = lerp(m.up[2], m.to[2], k);
  }
  return out;
}

/** Shift a move with the world (the motor's offsetOrigin). */
export function offsetMove(m, offset) {
  for (const p of [m.from, m.up, m.to]) {
    p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2];
  }
}
