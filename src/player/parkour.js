// CLIMB1 (2026-09-30, the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md):
// THE LEDGE SENSOR, THE MANTLE, THE CLAMBER AND THE VAULT. Mac: "a proper and
// detailed climbing system... Being able to latch, mantle, jump from one
// location to another ledge. Almost parkour like", after Assassin's Creed and
// Dying Light. The four calls: JUMP IS THE GRAB, THE SKILL SCALES IT (it gates
// no move), SHEER WALLS FREE-CLIMB ON GRIP, and LEAPS OF THEIR OWN scaled by
// Jumping.
//
// The port's own law, not DFU's: ClimbingMotor's classic path (climbing.js)
// has no idea what a ledge is - the wall-hug shoves the capsule over the lip
// (DISC21) - and its `AdvancedClimbing` arms (hang, rappel, corner wraps) are
// Ledger A off-road and stay so. This module is ENHANCED LANE ONLY: the motor
// consults it only when its host hands `parkour` deps whose switch answers
// yes (scenes/shared.js parkourSwitchOn), so the classic climb is untouched on
// the classic skin offline and with the row off.
//
// What CLIMB1 moves:
//   - MANTLE: a lip within reach of the hands (Jump pressed on the ground, Jump
//     held in the air, or the classic climb arriving under one) is climbed
//     onto - up the face, then over the lip - ending standing on the top, in
//     the middle of a narrow one, or crouched where only a crouch fits;
//   - CLAMBER: a top too thin to stand on (a parapet, a railing's top rail, a
//     thin fence) is climbed over onto the floor just behind it;
//   - VAULT: a lip at the waist or under whose top ends within a stride, taken
//     moving forward, is passed over and the body carries on beyond it.
// The path is SCRIPTED, not physics (the one thing both reference games do),
// and the WHOLE of it is proven clear before it starts (AUDIT CLIMB1 F2: the
// first sensor proved only the two ends, and a body stepped through railings,
// slots and lintels): every point the body passes through is a capsule the
// collider says fits, at the height the body will have there.
//
// What CLIMB2 moves (the second half of this file):
//   - HANG: a lip caught in the air at the chest or higher is HELD - the body
//     hangs under it, the eye just below the lip - and Forward (or a fresh
//     Jump) climbs up from there, Crouch lets go;
//   - SHIMMY: Left and Right move the hang along the lip, following its
//     height and a wall that curves, and stop where the lead hand finds
//     nothing to take;
//   - GRIP: a hold that runs out - its time the Climbing skill's and the
//     body's Fatigue's - and gives out when spent;
//   - FREE CLIMB: on the enhanced lane any wall is climbed without the
//     classic roll (Mac's "Free-climb on grip") - up, down and across, until
//     the grip gives; its top is a hang, and Forward over it a mantle.
//
// This module is pure - the collider is handed in - and it takes no motor
// constant at its top level: the motor imports this file, so a top-level read
// of a motor constant here would meet the cycle's TDZ. The numbers it shares
// with the motor are restated and pinned equal (test/auditclimb1, test/climb2).

import { KHAJIIT_CLIMBING_BONUS, climbingSpeed } from './climbing.js';

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
/** The wall scan's rung: level rays this far apart up the face. AUDIT CLIMB1
 *  G4: 0.2 at CLIMB1, and a table top thinner than a rung was found only when
 *  a rung happened to land in its edge. */
export const PARKOUR_SCAN_STEP = 0.1;
/** The face goes on while the next rung meets it within this much farther
 *  (a face leaning back up to ~38 degrees); farther, or nothing, and the face
 *  has ended under that rung - a 45-degree roof's rise is 0.1 a rung. */
export const PARKOUR_FACE_LEAN = 0.08;
/** The lip is the top just past the face: the down ray that finds it lands
 *  this far in. AUDIT CLIMB1 G1/G3: it was 0.2 in, which read a pitched
 *  roof's lip 0.2 up its slope and missed a fence thinner than 0.2 outright. */
export const PARKOUR_EDGE_INSET = 0.03;
/** The face under the lip is confirmed this far below it (a 4 cm table top's
 *  edge is still a face). */
export const PARKOUR_UNDER = 0.02;
/** The feet land the capsule's radius plus this past the face. */
export const PARKOUR_TOP_INSET = 0.12;
/** The top is sought from this far over it (plus a 45-degree slope's rise). */
export const PARKOUR_TOP_PROBE = 0.3;
/** The top's profile: a down ray every this far from the face, out to the walk. */
export const PARKOUR_TOP_STEP = 0.1;
export const PARKOUR_TOP_WALK = 1.0;
/** A surface more than this under the lip is past the top's far edge. */
export const PARKOUR_TOP_DROP = 0.1;
/** A top shallower than this is stood on by nobody - it is climbed over (the
 *  clamber) or vaulted; one at least this deep is stood on in its middle when
 *  the usual landing would overhang it (AUDIT CLIMB1 G3). */
export const PARKOUR_MIN_STAND_DEPTH = 0.28;
/** The landing may stand this far off the plane the lip's own slope draws: a
 *  flat tread 0.25 above its lip is the next stair, not this top (G5). */
export const PARKOUR_SLOPE_SLACK = 0.1;
/** On the ground, the floor just in front of the face must be the body's own
 *  - within this of the feet. A tread higher than that between the body and
 *  the face is a stair, and the face a riser further up it (AUDIT CLIMB1 G5:
 *  near a staircase's head a press mantled onto the landing two treads up). */
export const PARKOUR_FOOTING = 0.15;
/** Where the straight landing does not fit - an inner corner, a taller wall
 *  beside the ledge - the body slides along the face by these (G2). */
export const PARKOUR_NUDGE = Object.freeze([0, 0.15, -0.15, 0.3, -0.3]);
/** The body rises this far off the face, and this far over the lip. */
export const PARKOUR_UP_GAP = 0.04;
/** A mantle's step over the lip rises this much more at its middle. */
export const PARKOUR_MANTLE_ARC = 0.03;
/** "Clear": the push collider.penetrationAt reports, findClearFloor's own. */
export const PARKOUR_FIT_EPS = 0.03;
/** The body's radius (the motor's CAPSULE_RADIUS, restated for the cycle and
 *  pinned equal). */
export const PARKOUR_BODY_RADIUS = 0.35;
/** The body asked between the collider's spheres at least this often up its
 *  axis (bandsClear), by spheres this far inside the body's radius - so a
 *  thin feature between two samples sits no further in than a contact's
 *  PARKOUR_FIT_EPS (0.33 - sqrt(0.33^2 - 0.069^2) = 0.007 more than the 2 cm
 *  slack), and a wall the body leans on (at its radius, 2 cm clear of the
 *  sphere) or a 45-degree roof it stands on (1.5 cm) is no feature. The first
 *  cut sampled half as often a centimetre further in, and left 4.6 cm. */
export const PARKOUR_FIT_BAND = 0.1375;
export const PARKOUR_BAND_SLACK = 0.02;
/** AUDIT CLIMB2 G2: a free climber's move that would take the body into a
 *  moulding or a rail across the wall leans out past it instead - the hug let
 *  go of, then these far out from the face: the nearest that clears, within
 *  the wall's contact (PARKOUR_CONTACT). */
export const PARKOUR_LEAN = [0, 0.02, 0.05, 0.1];
/** The path is proven at least this often - under a quarter of the radius. */
export const PARKOUR_PATH_STEP = 0.08;
/** After a lip is found and every way onto or over it refused, the air catch
 *  and the top-out rest this many steps before asking again - the refusal
 *  proves the whole path at up to ten tries (1.4 ms on a railing), and held
 *  Jump would otherwise ask it every step. 50 ms is a few centimetres of fall. */
export const PARKOUR_QUIET_STEPS = 3;
/** THE TAP CATCH (Mac, 2026-10-01: "Take care of what is left including a
 *  jump catching a ledge" - his "Jump near a ledge catches"): a fresh press of
 *  Jump arms the air catch for the jump it makes, as if the key were still
 *  held, until the body is down again. A press on the ground that leaves it
 *  no jump (the grounded gate's) lapses after this long - the jump it would
 *  have made takes off on the press's own step. */
export const PARKOUR_ARM_GRACE_S = 0.05;
/** A vault: the lip at the waist or under, the top ending within a stride. */
export const PARKOUR_VAULT_MAX = 1.2;
export const PARKOUR_VAULT_DEPTH = 0.9;
/** The body clears a thin top by this going over it; a vault leaves it with
 *  this rise. */
export const PARKOUR_VAULT_CLEAR = 0.08;
export const PARKOUR_VAULT_EXIT_VY = 1.0;
/** The slowest a vault leaves its far side, m/s - a standing vault still
 *  carries the body off the top rather than dropping it onto the edge. */
export const PARKOUR_VAULT_EXIT_MIN = 3.5;
/** DFU's fall-damage threshold (motor.js FALL_DAMAGE_THRESHOLD, AcrobatMotor's
 *  fallingDamageThreshold), restated for the cycle and pinned equal. A vault
 *  never leaps into a fall that hurts (G6); a catch at Climbing 0 holds only a
 *  fall that could not have hurt anyway (F6). */
export const PARKOUR_SAFE_DROP = 5;
/** A clamber comes down behind the thin top onto a floor at most this far
 *  under its lip, stepping off it at this pace. */
export const PARKOUR_OVER_DROP = 1.5;
export const PARKOUR_OVER_EXIT = 0.8;
/** How far a body may have FALLEN and still hold a lip it catches (Mac's
 *  "Skill scales it": the skill says whether a hard catch holds): the fall
 *  threshold at Climbing 0, three times it at 100. AUDIT CLIMB1 F6: every catch
 *  held and cancelled the fall above it - Jump held beside a tower was a fall
 *  from any height without a scratch. */
export const PARKOUR_CATCH_HOLD_MIN = PARKOUR_SAFE_DROP;
export const PARKOUR_CATCH_HOLD_MAX = 15;

// ---- CLIMB2 ----------------------------------------------------------------
/** A hanging body: the lip this far over its feet - the eye (motor.js
 *  EYE_HEIGHT 1.7, restated for the cycle) 0.1 under it, the hands on the lip
 *  at the head's height, the arms bent. */
export const PARKOUR_HANG_DROP = 1.8;
/** The body hangs this far off the face (a mantle's rise keeps the same). */
export const PARKOUR_HANG_GAP = PARKOUR_UP_GAP;
/** A lip is held only at the chest or higher: one lower is stepped onto (a
 *  body cannot hang from its knees). Under the heaviest pack's reach at
 *  Climbing 0 in the air (1.5 - 0.3 + 0.15), so a hang is always in reach. */
export const PARKOUR_HANG_LOW = 1.2;
/** A catch pulls the body into the hang in this long. */
export const PARKOUR_CATCH_S = 0.15;
/** A hand-hold is a top at least this deep past its face: a level ray over
 *  the lip that meets a wall within this of the face is the wall running on,
 *  not a ledge - a sill is, its wall set back (the face's lean, as CLIMB1's). */
export const PARKOUR_GRIP_DEPTH = PARKOUR_FACE_LEAN;
/** From one grip to the next a lip may rise or fall this much (a sloped
 *  coping, a stepped sill); the grip is sought in this window about it. */
export const PARKOUR_LIP_FOLLOW = 0.15;
/** ...and the face may turn this much (a round tower's wall, the rays' own
 *  scatter) - the dot of the two normals. */
export const PARKOUR_FACE_FOLLOW = Math.cos((30 * Math.PI) / 180);
/** The lead hand reaches this far along the lip past the body's middle: the
 *  shimmy stops where it finds nothing to take. */
export const PARKOUR_HAND_SPAN = 0.25;
/** THE GRIP (Mac's "Skill scales it": the skill sets grip time): the seconds a
 *  fresh hold lasts at Climbing 0 and at 100... */
export const PARKOUR_GRIP_MIN_S = 6;
export const PARKOUR_GRIP_MAX_S = 30;
/** ...and the fraction of it a body at Fatigue 0 has ("grip on Fatigue"). */
export const PARKOUR_GRIP_TIRED = 0.35;
/** A free climber held still on the wall, the feet on it too, spends the grip
 *  at this rate; hanging from the hands, shimmying and climbing spend it whole. */
export const PARKOUR_GRIP_REST = 0.5;
/** The grip comes back from nothing in this long, the feet on the ground. */
export const PARKOUR_GRIP_REGEN_S = 2.5;
/** Under this the grip is failing: the HUD's short colour, and the line once a
 *  hold. */
export const PARKOUR_GRIP_LOW = 0.25;
export const PARKOUR_GRIP_LOW_TEXT = 'Your grip is failing.';
/** A grip under this takes no new hold. */
export const PARKOUR_GRIP_MIN = 0.05;
/** The shimmy's pace, m/s, at Climbing 0 and 100. */
export const PARKOUR_SHIMMY_MIN = 0.6;
export const PARKOUR_SHIMMY_MAX = 1.4;
/** The free climb's pace: the classic climb's (Speed / 3, doubled under the
 *  Climbing spell - climbing.js climbingSpeed) times this, at 0 and 100. */
export const PARKOUR_CLIMB_MIN = 0.7;
export const PARKOUR_CLIMB_MAX = 1.3;
/** Forward held against a wall starts a free climb after this long, at 0 and
 *  100 (the classic's 14 system-timer units are 0.77 s, then a roll). */
export const PARKOUR_START_MIN_S = 0.6;
export const PARKOUR_START_MAX_S = 0.3;
/** A heavy pack (the proposal's "heavy packs cut your reach"): up to this
 *  share of what the body can carry costs nothing; a full pack costs this. */
export const PARKOUR_LOAD_FREE = 0.5;
export const PARKOUR_LOAD_CUT = 0.3;
/** A free climber keeps to the wall while a level ray from the axis meets it
 *  within the radius and this - at one of these shares of the body's height. */
export const PARKOUR_CONTACT = 0.15;
export const PARKOUR_CONTACT_AT = Object.freeze([0.8, 0.4, 0.2]);

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

/** The Jumping skill a vault reads (its pace; a vault trains Jumping too),
 *  held to 0..100 the same way. */
export function jumpingSkill({ jumping = 0 } = {}) {
  return Math.min(100, Math.max(0, jumping));
}

/** The lip height a standing body's hands reach at this skill - less under a
 *  heavy pack (CLIMB2): `load` is the pack's weight over what the body can
 *  carry (PlayerEntity.CarriedWeight / MaxEncumbrance), and past half of it
 *  the reach shortens, by PARKOUR_LOAD_CUT at a full pack. */
export function parkourReach(skill, load = 0) {
  const cut = PARKOUR_LOAD_CUT * clamp01((load - PARKOUR_LOAD_FREE) / (1 - PARKOUR_LOAD_FREE));
  return lerp(PARKOUR_REACH_MIN, PARKOUR_REACH_MAX, clamp01(skill / 100)) - cut;
}

/** The fall a caught lip still holds at this Climbing skill (metres). */
export function parkourCatchHold(skill) {
  return lerp(PARKOUR_CATCH_HOLD_MIN, PARKOUR_CATCH_HOLD_MAX, clamp01(skill / 100));
}

/** CLIMB2: the seconds a fresh hold lasts at this Climbing skill and this
 *  Fatigue (the body's current over its most, 0..1). */
export function gripSeconds(skill, fatigue = 1) {
  return lerp(PARKOUR_GRIP_MIN_S, PARKOUR_GRIP_MAX_S, clamp01(skill / 100)) * lerp(PARKOUR_GRIP_TIRED, 1, clamp01(fatigue));
}

/** CLIMB2: the shimmy's pace along a lip, m/s. */
export function shimmySpeed(skill) {
  return lerp(PARKOUR_SHIMMY_MIN, PARKOUR_SHIMMY_MAX, clamp01(skill / 100));
}

/** CLIMB2: the free climb's pace, m/s - the classic climb's over the motor's
 *  Speed (and the Climbing spell's doubling), times the skill's share. */
export function freeClimbSpeed(speed, skill, spell = false) {
  return climbingSpeed(speed, spell) * lerp(PARKOUR_CLIMB_MIN, PARKOUR_CLIMB_MAX, clamp01(skill / 100));
}

/** CLIMB2: how long Forward is held against a wall before the free climb. */
export function freeStartSeconds(skill) {
  return lerp(PARKOUR_START_MIN_S, PARKOUR_START_MAX_S, clamp01(skill / 100));
}

/** Seconds a mantle takes: longer the higher the lip, a third quicker at
 *  Climbing 100 than at 0 (a 1.5 m lip: 0.75 s at 0, 0.46 s at 100). */
export function mantleDuration(rise, skill) {
  return (0.25 + 0.22 * Math.max(0, rise)) * (1.3 - 0.5 * clamp01(skill / 100));
}

/** Seconds a vault takes, the same shape and quicker - the Jumping skill's. */
export function vaultDuration(rise, skill) {
  return (0.22 + 0.12 * Math.max(0, rise)) * (1.2 - 0.3 * clamp01(skill / 100));
}

/** Roleplay & Realism's seam (AUDIT CLIMB1 F10): a registered gate answers a
 *  line when a climb must be refused ("You can't climb whilst holding your
 *  weapon."), null otherwise. The mantle and the clamber ask it; a vault is a
 *  leap and does not. One gate, the mod's (systems/rrInstall.js). */
let _gate = null;
export function registerParkourGate(fn) { _gate = typeof fn === 'function' ? fn : null; }
export const parkourRefusal = () => _gate?.() ?? null;

/** A capsule at these feet, this tall, stands in the open. Two questions,
 *  because penetrationAt is one of them only: it reports how far the
 *  resolve PUSHED the body, and the resolve will not depenetrate a body up
 *  into a ceiling - it reverts it (collider.js _resolveCapsule, "A body
 *  cannot be depenetrated UP into a ceiling") - so a standing body passing
 *  through a slab reads clear there. The ray up the axis to the head is the
 *  headroom. (A body wholly inside a thick solid would pass both; the path
 *  that reaches such a point crosses the solid's face on the way, and the
 *  path is proven at every step - pathClear.) */
export function capsuleFits(collider, p, height) {
  if (!(collider.penetrationAt(p, height) < PARKOUR_FIT_EPS) || !bandsClear(collider, p, height)) return false;
  return !Number.isFinite(collider.raycast([p[0], p[1] + 0.05, p[2]], [0, 1, 0], height - 0.1));
}

/** AUDIT CLIMB2 G2: THE BODY BETWEEN THE COLLIDER'S SPHERES. collider.js
 *  resolves the capsule as a chain of spheres at most a diameter apart, and
 *  between two of them it reaches only 0.22 m from the axis (standing: feet +
 *  0.625 and + 1.175) - a moulding, a rail or a cornice there sits up to
 *  0.16 m inside the 0.35 body and penetrationAt reads it clear. The bands are
 *  asked too: spheres PARKOUR_BAND_SLACK inside the body, every
 *  PARKOUR_FIT_BAND or less up the axis between its ends. */
export function bandsClear(collider, p, height) {
  if (!collider.sphereOverlaps) return true;
  const axis = Math.max(0, height - 2 * PARKOUR_BODY_RADIUS);
  const n = Math.ceil(axis / PARKOUR_FIT_BAND - 1e-9);
  for (let i = 1; i < n; i++) {
    if (collider.sphereOverlaps([p[0], p[1] + PARKOUR_BODY_RADIUS + (axis * i) / n, p[2]], PARKOUR_BODY_RADIUS - PARKOUR_BAND_SLACK)) return false;
  }
  return true;
}

/** A level hit that is a wall the look meets: its distance, its horizontal
 *  normal toward the body, its bucket. */
function faceHit(collider, origin, dir, reach) {
  const hit = collider.raycastHit(origin, dir, reach);
  if (!Number.isFinite(hit.dist) || !hit.normal) return null;
  const [nx, ny, nz] = hit.normal;
  const l = Math.hypot(nx, nz);
  if (Math.abs(ny) > PARKOUR_FACE_MAX_NY || l < 1e-4) return null;
  if (-(nx * dir[0] + nz * dir[2]) / l < PARKOUR_FACING_DOT) return null;
  return { dist: hit.dist, normal: [nx / l, 0, nz / l], key: hit.key ?? null };
}

/** THE WALL, by rungs: level rays from the axis every PARKOUR_SCAN_STEP up the
 *  band; the lowest to meet a wall the look meets is the face. The scan then
 *  climbs on until a rung meets nothing within the face's lean - the first
 *  height the face is no longer there (`openY`), with the face's distance
 *  just under it (`faceDist`). No such height one rung past the reach is a
 *  wall that runs on above it (`openY` null). */
function scanFace(collider, feet, dir, low, high, reach) {
  let wall = null, faceDist = 0;
  for (let i = 0; ; i++) {
    const h = low + i * PARKOUR_SCAN_STEP;
    if (h > high + PARKOUR_SCAN_STEP + 1e-9) break;
    const y = feet[1] + h;
    if (!wall) {
      if (h > high + 1e-9) break;
      const f = faceHit(collider, [feet[0], y, feet[2]], dir, reach);
      if (f) { wall = { y, dist: f.dist, normal: f.normal, key: f.key }; faceDist = f.dist; }
      continue;
    }
    const d = collider.raycast([feet[0], y, feet[2]], dir, faceDist + PARKOUR_FACE_LEAN);
    if (!Number.isFinite(d)) return { ...wall, openY: y, faceDist };
    faceDist = d;
  }
  return wall ? { ...wall, openY: null, faceDist } : null;
}

/** THE WALL, by its top (AUDIT CLIMB1 G4): a slab whose edge is thinner than a
 *  rung - a table top, a shelf - meets no rung. Down rays just ahead find its
 *  top instead, from a height a level ray found open, and the edge just under
 *  that top is the face. */
function scanSlab(collider, feet, dir, low, high, reach, radius) {
  const y0 = feet[1] + high + 0.05;
  for (const d of [radius + 0.1, radius + 0.25, reach]) {
    if (Number.isFinite(collider.raycast([feet[0], y0, feet[2]], dir, d + 0.02))) continue;
    const down = collider.surfaceHit([feet[0] + dir[0] * d, y0, feet[2] + dir[2] * d], [0, -1, 0], high + 0.05 - low);
    if (!Number.isFinite(down.dist) || !down.normal || down.normal[1] < PARKOUR_TOP_MIN_NY) continue;
    const topY = y0 - down.dist;
    const f = faceHit(collider, [feet[0], topY - PARKOUR_UNDER, feet[2]], dir, reach);
    if (!f) continue;
    if (Number.isFinite(collider.raycast([feet[0], topY + 0.05, feet[2]], dir, f.dist + PARKOUR_FACE_LEAN))) continue;
    return { y: topY - PARKOUR_UNDER, dist: f.dist, normal: f.normal, key: f.key, openY: topY + 0.05, faceDist: f.dist };
  }
  return null;
}

/** The top's profile, walked away from the face along `into`: down rays from
 *  over a 45-degree rise, every PARKOUR_TOP_STEP out to the walk. The top goes
 *  on while each finds a surface no more than PARKOUR_TOP_DROP under the lip;
 *  the first that does not is past its far edge, which a bisection finds to a
 *  centimetre (`depth`; null for a top that runs on past the walk). */
function topProfile(collider, face, into, lipY) {
  const onTop = (s) => {
    const oy = lipY + PARKOUR_TOP_PROBE + s;
    const h = collider.surfaceHit([face[0] + into[0] * s, oy, face[2] + into[2] * s], [0, -1, 0], PARKOUR_TOP_PROBE + s + PARKOUR_TOP_DROP);
    return Number.isFinite(h.dist);
  };
  let last = 0;
  for (let i = 0; ; i++) {
    const s = 0.05 + i * PARKOUR_TOP_STEP;
    if (s > PARKOUR_TOP_WALK + 1e-9) return { depth: null };
    if (onTop(s)) { last = s; continue; }
    let a = i === 0 ? PARKOUR_EDGE_INSET : last, b = s;
    for (let k = 0; k < 4; k++) { const mid = (a + b) / 2; if (onTop(mid)) a = mid; else b = mid; }
    return { depth: (a + b) / 2 };
  }
}

/** The landing on the top at `s` past the face at (fx, fz): the surface there,
 *  if it is the lip's own - no steeper than 45 degrees, on the plane the
 *  lip's slope draws give or take the slack (a flat tread a riser above is the
 *  next stair), and no lower than the top's drop - with the feet lifted so the
 *  capsule's round foot rests on a slope rather than in it (r/cos - r). A
 *  surface too high to be the top is asked under once more: the probe's origin
 *  can stand inside a lid low over the top, and a ray out of a solid meets its
 *  underside (the top is still there - it is the fit's to refuse, "no-room"). */
function landingAt(collider, fx, fz, into, lipY, s, radius) {
  const px = fx + into[0] * s, pz = fz + into[2] * s, floor = lipY - PARKOUR_TOP_DROP;
  let oy = lipY + PARKOUR_TOP_PROBE + s;
  for (let tries = 0; tries < 2; tries++) {
    const h = collider.surfaceHit([px, oy, pz], [0, -1, 0], oy - floor);
    if (!Number.isFinite(h.dist) || !h.normal) return null;
    const ny = h.normal[1];
    const y = oy - h.dist;
    const tan = ny > 0 ? Math.sqrt(Math.max(0, 1 - ny * ny)) / ny : Infinity;
    if (ny >= PARKOUR_TOP_MIN_NY && y - lipY <= s * tan + PARKOUR_SLOPE_SLACK) return { y: y + radius / ny - radius, key: h.key ?? null };
    oy = y - 0.02;
    if (oy <= floor) return null;
  }
  return null;
}

/** The two-segment path every move rides (movePoint), as the sensor proves it. */
const path = (from, up, to, split, arc) => ({ from: [from[0], from[1], from[2]], up, to, split, arc });
const splitFor = (rise) => Math.min(0.75, Math.max(0.45, 0.35 + 0.2 * rise));

/** THE PATH, PROVEN (AUDIT CLIMB1 F2/F3): the body fits at every point of the
 *  move at least every PARKOUR_PATH_STEP - under a quarter of the radius, so
 *  anything the path crosses is within the radius of some point's axis (a bar
 *  a centimetre thick through the middle of the body reads 0.35 deep). The
 *  body is `body` tall throughout: a crouched move is crouched from its first
 *  step (the motor flips the stance as the move begins). (The first sensor
 *  asked a straight column over the body's head instead; the real path leaves
 *  that column as it rises, so the column refused paths that were clear and
 *  proved nothing the points do not - the audit's mutation run found it.) */
function pathClear(collider, m, body) {
  const len = Math.hypot(m.up[0] - m.from[0], m.up[1] - m.from[1], m.up[2] - m.from[2])
    + Math.hypot(m.to[0] - m.up[0], m.to[1] - m.up[1], m.to[2] - m.up[2]) + 2 * m.arc;
  const n = Math.max(6, Math.ceil(len / PARKOUR_PATH_STEP));
  for (let i = 1; i <= n; i++) {
    if (!capsuleFits(collider, movePoint(m, i / n), body)) return false;
  }
  return true;
}

/**
 * THE LEDGE SENSOR. From the feet, looking along `dir` (a horizontal unit
 * vector), is there a lip the hands can take - and where would the body go?
 *
 *   1. THE WALL: rungs up the band (scanFace), or - for a slab thinner than a
 *      rung - its top from above (scanSlab).
 *   2. THE LIP: a down ray just past the face (PARKOUR_EDGE_INSET) from the
 *      first height the face is gone - never from a fixed height, which in a
 *      low room starts inside the ceiling - finds the top at the edge: level
 *      enough to stand on, inside the band, the face running up to it.
 *   3. THE TOP: its profile (topProfile) says how deep it is.
 *   4. THE LANDING: the radius and an inset past the face, or the middle of a
 *      top too shallow for that; the body fits there standing, else crouched;
 *      failing that, slid along the face; and the whole path to it proven
 *      (pathClear) - the stage a refusal reached is its reason: no top at the
 *      landing, no room on it, or no way up to it.
 *
 * `opts` = { low, high, radius, stand, crouch, height, footing } - the band,
 * the capsule's radius, its standing and crouched heights, its height now,
 * and whether the body stands on the ground (the stair check, G5).
 * Answers { ok: false, why } when there is no lip in reach, else { ok: true,
 * lipY, rise, normal, into, face, depth, faceKey, mantle, why } - `mantle` is
 * { up, top, crouch, split, arc, key } when the body can end on the top, else
 * null with the reason in `why` (a thin top is the clamber's or the vault's:
 * senseOver). The whys are what the pins and the probe read.
 */
export function senseLedge(collider, feet, dir, opts) {
  const { low, high, radius, stand, crouch, height = stand, footing = false } = opts;
  if (!collider?.raycastHit) return { ok: false, why: 'no-collider' };
  const reach = radius + PARKOUR_WALL_REACH;
  const wall = scanFace(collider, feet, dir, low, high, reach) ?? scanSlab(collider, feet, dir, low, high, reach, radius);
  if (!wall) return { ok: false, why: 'no-wall' };
  if (wall.openY == null) return { ok: false, why: 'too-high' };
  const wn = wall.normal;                       // out of the wall, toward the body
  const into = [-wn[0], 0, -wn[2]];
  // 2. the lip
  const ey = wall.openY + 0.02;
  const ex = feet[0] + dir[0] * wall.faceDist + into[0] * PARKOUR_EDGE_INSET;
  const ez = feet[2] + dir[2] * wall.faceDist + into[2] * PARKOUR_EDGE_INSET;
  const down = collider.surfaceHit([ex, ey, ez], [0, -1, 0], ey - (wall.y - 0.05));
  if (!Number.isFinite(down.dist)) return { ok: false, why: 'no-top' };
  const lipY = ey - down.dist;
  if (!down.normal || down.normal[1] < PARKOUR_TOP_MIN_NY) return { ok: false, why: 'steep-top' };
  const rise = lipY - feet[1];
  if (rise > high) return { ok: false, why: 'too-high' };
  if (rise < low - 0.05) return { ok: false, why: 'too-low' };
  const under = collider.raycastHit([feet[0], lipY - PARKOUR_UNDER, feet[2]], dir, wall.faceDist + 0.3);
  if (!Number.isFinite(under.dist)) return { ok: false, why: 'no-lip' };
  const face = [feet[0] + dir[0] * under.dist, lipY, feet[2] + dir[2] * under.dist];
  if (footing) {
    const f = collider.surfaceHit([face[0] + wn[0] * 0.1, lipY - PARKOUR_UNDER, face[2] + wn[2] * 0.1], [0, -1, 0], lipY - feet[1] + 0.5);
    if (Number.isFinite(f.dist) && lipY - PARKOUR_UNDER - f.dist - feet[1] > PARKOUR_FOOTING) return { ok: false, why: 'riser' };
  }
  // 3. the top
  const { depth } = topProfile(collider, face, into, lipY);
  const ledge = { ok: true, lipY, rise, normal: wn, into, face, depth, faceKey: wall.key, mantle: null, why: null };
  // 4. the landing
  const full = radius + PARKOUR_TOP_INSET;
  let s;
  if (depth == null || depth >= full + 0.05) s = full;
  else if (depth >= PARKOUR_MIN_STAND_DEPTH) s = depth / 2;
  else { ledge.why = 'no-top'; return ledge; }
  const tangent = [-into[2], 0, into[0]];
  const bodies = height > crouch + 1e-6 ? [height, crouch] : [height];
  const split = splitFor(rise);
  let stage = 0;   // how far the best try got: 0 no top there, 1 no room on it, 2 no way up to it
  for (const body of bodies) {
    for (const n of PARKOUR_NUDGE) {
      const fx = face[0] + tangent[0] * n, fz = face[2] + tangent[2] * n;
      const land = landingAt(collider, fx, fz, into, lipY, s, radius);
      if (!land) continue;
      stage = Math.max(stage, 1);
      const top = [fx + into[0] * s, land.y + 0.02, fz + into[2] * s];
      if (!capsuleFits(collider, top, body)) continue;
      stage = 2;
      const upOff = radius + PARKOUR_UP_GAP;
      const up = [fx + wn[0] * upOff, lipY + PARKOUR_UP_GAP, fz + wn[2] * upOff];
      if (!capsuleFits(collider, up, body)) continue;
      if (!pathClear(collider, path(feet, up, top, split, PARKOUR_MANTLE_ARC), body)) continue;
      ledge.mantle = { up, top, crouch: body < height - 1e-6, split, arc: PARKOUR_MANTLE_ARC, key: land.key };
      return ledge;
    }
  }
  ledge.why = ['no-top', 'no-room', 'no-room-up'][stage];
  return ledge;
}

/**
 * OVER A THIN TOP - the vault's question and the clamber's, over a ledge
 * senseLedge found: does the top end within a stride of the face, is there a
 * floor behind it within `maxDrop` of the lip, and does the body pass over it
 * - the whole way proven - to a point past its far edge? Answers { up, over,
 * depth, floorY, key } or null. AUDIT CLIMB1 F3: the first vault asked only
 * its landing and one point over the top, and a down ray that started inside
 * the wall behind a step read "past the far edge": the body was vaulted into
 * the wall. G6: and it asked nothing of the far side - a railing over a 10 m
 * drop was vaulted into the drop.
 */
export function senseOver(collider, feet, ledge, opts, maxDrop) {
  if (!(ledge?.ok) || ledge.depth == null || ledge.depth > PARKOUR_VAULT_DEPTH) return null;
  const { radius, stand, height = stand } = opts;
  const { face, into, normal, lipY, depth } = ledge;
  const y = lipY + PARKOUR_VAULT_CLEAR;
  const out = depth + radius + 0.1;
  const tangent = [-into[2], 0, into[0]];
  for (const n of PARKOUR_NUDGE) {
    const fx = face[0] + tangent[0] * n, fz = face[2] + tangent[2] * n;
    const up = [fx + normal[0] * (radius + PARKOUR_UP_GAP), y, fz + normal[2] * (radius + PARKOUR_UP_GAP)];
    const over = [fx + into[0] * out, y, fz + into[2] * out];
    const below = collider.surfaceHit([over[0], y + 0.05, over[2]], [0, -1, 0], maxDrop + PARKOUR_VAULT_CLEAR + 0.05);
    if (!Number.isFinite(below.dist)) continue;
    if (!capsuleFits(collider, up, height) || !capsuleFits(collider, over, height)) continue;
    if (!pathClear(collider, path(feet, up, over, 0.4, 0.1), height)) continue;
    return { up, over, depth, floorY: y + 0.05 - below.dist, key: ledge.faceKey };
  }
  return null;
}

/** The vault's own question: a lip at the waist or under, and a fall beyond
 *  that could not hurt (PARKOUR_SAFE_DROP). */
export function senseVault(collider, feet, ledge, opts) {
  if (!(ledge?.ok) || ledge.rise > PARKOUR_VAULT_MAX) return null;
  return senseOver(collider, feet, ledge, opts, PARKOUR_SAFE_DROP);
}

/** A mantle's move: from the feet, up the face, onto the top - the path the
 *  sensor proved (its split and arc are the sensor's). The first segment's
 *  share of the time grows with the rise - a waist-high step-up is mostly the
 *  step over, a head-high pull-up mostly the pull. */
export function planMantle(feet, ledge, skill) {
  const { up, top, crouch, split, arc, key } = ledge.mantle;
  return {
    kind: 'mantle',
    from: [feet[0], feet[1], feet[2]],
    up: [...up],
    to: [...top],
    split, arc,
    dur: mantleDuration(ledge.rise, skill),
    crouch: !!crouch,
    exit: null,
    key: key ?? null,
    t: 0,
  };
}

/** A clamber's move: up the face, over the thin top, and off its far side at a
 *  step's pace onto the floor behind (a climb - it trains Climbing). */
export function planClamber(feet, ledge, over, skill) {
  return {
    kind: 'mantle',
    from: [feet[0], feet[1], feet[2]],
    up: [...over.up],
    to: [...over.over],
    split: 0.4, arc: 0.1,
    dur: mantleDuration(ledge.rise, skill) * 1.15,
    crouch: false,
    exit: [ledge.into[0] * PARKOUR_OVER_EXIT, ledge.into[2] * PARKOUR_OVER_EXIT],
    exitVy: 0,
    key: over.key ?? null,
    t: 0,
  };
}

/** A vault's move: from the feet up the face to clear the top, over it, and
 *  out beyond the far edge, where the body is handed back to the fall with
 *  its momentum along the wall's own normal (`exitSpeed` m/s) and a small
 *  rise. Its pace is the Jumping skill's. */
export function planVault(feet, ledge, vault, skill, exitSpeed) {
  const s = Math.max(PARKOUR_VAULT_EXIT_MIN, exitSpeed || 0);
  return {
    kind: 'vault',
    from: [feet[0], feet[1], feet[2]],
    up: [...vault.up],
    to: [...vault.over],
    split: 0.4, arc: 0.1,
    dur: vaultDuration(ledge.rise, skill),
    crouch: false,
    exit: [ledge.into[0] * s, ledge.into[2] * s],
    exitVy: PARKOUR_VAULT_EXIT_VY,
    key: vault.key ?? null,
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

/** Shift a move with the world (the motor's offsetOrigin) or with a deck that
 *  carries the body (carryBy) - and the lip of the hang it ends in (AUDIT
 *  CLIMB2 C5: left behind, the hang a catch or a corner arrived in sought its
 *  lip where it had been, and the hands let go). */
export function offsetMove(m, offset) {
  for (const p of [m.from, m.up, m.to]) {
    p[0] += offset[0]; p[1] += offset[1]; p[2] += offset[2];
  }
  if (m.hang) m.hang.lipY += offset[1];
}

/** AUDIT CLIMB1 F5: a move onto what moves - a boat's hull, a lift - rides it.
 *  `was` and `now` are the bucket's poses ({ t, r } - collider.bucketPose); the
 *  path is carried by the rigid motion between them - into the bucket's frame
 *  at `was`, out at `now` (collider.js intoBucket's convention: local =
 *  r (p - t), so world = r-transposed local + t). */
export function carryMove(m, was, now) {
  const y0 = m.to[1];
  for (const p of [m.from, m.up, m.to]) carryPoint(p, was, now);
  if (m.hang) carryLip(m.hang, m.to[1] - y0, was, now);   // AUDIT CLIMB2 C5: the hang it ends in, as a hold is carried
}

/** A hold's (or a move's hang's) wall turned with its bucket, its lip raised
 *  as far as the body under it. */
function carryLip(hold, rise, was, now) {
  const n = carryPoint([hold.normal[0], 0, hold.normal[2]], was, now, true);
  const l = Math.hypot(n[0], n[2]) || 1;
  hold.normal = [n[0] / l, 0, n[2] / l];
  if (hold.lipY != null) hold.lipY += rise;
}

/** A point carried by a bucket's rigid motion from `was` to `now` (turned
 *  only, with `turn` - a direction). */
function carryPoint(p, was, now, turn = false) {
  const wr = was.r, nr = now.r;
  const x = p[0] - (turn ? 0 : was.t[0]), y = p[1] - (turn ? 0 : was.t[1]), z = p[2] - (turn ? 0 : was.t[2]);
  const lx = wr ? wr[0] * x + wr[1] * y + wr[2] * z : x;
  const ly = wr ? wr[3] * x + wr[4] * y + wr[5] * z : y;
  const lz = wr ? wr[6] * x + wr[7] * y + wr[8] * z : z;
  p[0] = (nr ? nr[0] * lx + nr[3] * ly + nr[6] * lz : lx) + (turn ? 0 : now.t[0]);
  p[1] = (nr ? nr[1] * lx + nr[4] * ly + nr[7] * lz : ly) + (turn ? 0 : now.t[1]);
  p[2] = (nr ? nr[2] * lx + nr[5] * ly + nr[8] * lz : lz) + (turn ? 0 : now.t[2]);
  return p;
}

// ---------------------------------------------------------------------------
// CLIMB2 - THE HANG, THE SHIMMY, THE GRIP AND THE FREE CLIMB (the laws; the
// motor's _wallStep lives them).

/** The hand-hold's rungs: level rays this far apart down the lip's window. */
export const PARKOUR_GRIP_RUNG = 0.05;
/** What two rays at one surface may differ by and still read it as the
 *  surface it is (a 45-degree roof's rungs, a rung's height apart, are a
 *  rung back each; the float of the hit, not a centimetre of the shape). */
export const PARKOUR_RAY_SCATTER = 0.001;
/** A face the free climber's hands and feet press: its normal's y at most
 *  this (the classic probe took any hit; a floor or a ceiling is no wall). */
export const PARKOUR_WALL_MAX_NY = 0.7;

/**
 * THE HAND-HOLD. A lip near `lipY` on the face through `face` (a point on the
 * wall's face line - its y is not read) whose normal is `normal` (out of the
 * wall, toward the body): can the hands hold it, and where does the body hang
 * from it?
 *   1. THE EDGE - level rays from where a hanging body's axis would be, into
 *      the wall, down the window the lip may have moved in (PARKOUR_LIP_FOLLOW)
 *      every PARKOUR_GRIP_RUNG: the lip is where the wall steps OUT toward the
 *      body by the grip's depth - a rung meeting nothing, or a wall set back
 *      (a sill's), over one meeting the face where it was expected - or where
 *      a top no steeper than 45 degrees rises from it (an eave: its roof is
 *      the grip's depth back only a rung or two up, so the depth is read up
 *      the rungs the top rises through). A rung on the face is one the rung
 *      under it stands out from by no more than the edge's inset: a rung on
 *      a roof is not, however near the edge. No such step is no lip here: a
 *      wall that runs on through the window, or air;
 *   2. THE TOP - a ray down just past the face from the open rung: no steeper
 *      than 45 degrees, in the window;
 *   3. THE FACE UNDER IT - a level ray just under the top meets the face, its
 *      normal within PARKOUR_FACE_FOLLOW of the one expected (the hang follows
 *      a curving wall and does not turn a corner); under an eave, whose roof
 *      runs on past the edge, the ray from the face's rung under the lip;
 *   4. THE HANG (with `fit`) - the body off the face by its radius and a gap,
 *      the lip PARKOUR_HANG_DROP over its feet, fitting there standing.
 * Answers { lipY, normal, face, feet, key } or null. `opts` = { radius, stand }.
 */
export function senseGrip(collider, face, normal, lipY, opts, fit = true) {
  if (!collider?.raycastHit || !Number.isFinite(lipY)) return null;
  const { radius, stand } = opts;
  const dir = [-normal[0], 0, -normal[2]];
  const back = radius + PARKOUR_HANG_GAP;
  const ox = face[0] + normal[0] * back, oz = face[2] + normal[2] * back;
  const far = back + PARKOUR_LIP_FOLLOW + PARKOUR_GRIP_DEPTH + 0.05;
  const rungs = Math.round((2 * PARKOUR_LIP_FOLLOW) / PARKOUR_GRIP_RUNG);
  const rungY = (i) => lipY + PARKOUR_LIP_FOLLOW - i * PARKOUR_GRIP_RUNG;
  const seen = new Map();
  const at = (i) => {   // rung i's distance into the wall (Infinity for none), each ray cast once
    if (!seen.has(i)) { const d = collider.raycast([ox, rungY(i), oz], dir, far); seen.set(i, Number.isFinite(d) ? d : Infinity); }
    return seen.get(i);
  };
  let hiY = null, loY = null;
  for (let i = 1; i <= rungs && hiY == null; i++) {
    const dist = at(i);
    if (Math.abs(dist - back) > PARKOUR_LIP_FOLLOW || at(i - 1) - dist < PARKOUR_EDGE_INSET) continue;
    if (dist - at(i + 1) > PARKOUR_EDGE_INSET) continue;   // a rung on a top rising away from the edge, not on the face
    // AUDIT CLIMB2 C1: the step's depth, up the rungs a top no steeper than 45 degrees rises through (each a rung's
    // height or more back, less the rays' scatter - a wall standing up again, or set back a few centimetres a rung, is
    // no such top); a level top or a set-back wall is the depth at the first
    let deep = at(i - 1);
    for (let j = i - 2; j >= i - 3 && deep - dist < PARKOUR_GRIP_DEPTH; j--) {
      if (at(j) - deep < PARKOUR_GRIP_RUNG - PARKOUR_RAY_SCATTER) break;
      deep = at(j);
    }
    if (deep - dist >= PARKOUR_GRIP_DEPTH) { hiY = rungY(i - 1); loY = rungY(i); }
  }
  if (hiY == null) return null;
  // 2. the top, just past the face, from the open rung
  const d0 = collider.raycast([ox, loY, oz], dir, far);
  const ex = ox + dir[0] * (d0 + PARKOUR_EDGE_INSET), ez = oz + dir[2] * (d0 + PARKOUR_EDGE_INSET);
  const top = collider.surfaceHit([ex, hiY + 0.01, ez], [0, -1, 0], hiY - loY + 0.06);
  if (!Number.isFinite(top.dist) || !top.normal || top.normal[1] < PARKOUR_TOP_MIN_NY) return null;
  const y = hiY + 0.01 - top.dist;
  if (Math.abs(y - lipY) > PARKOUR_LIP_FOLLOW + 0.01) return null;
  // 3. the face under it - under an eave the roof runs on past the edge, and the face is the rung's under the lip
  const under = faceHit(collider, [ox, y - PARKOUR_UNDER, oz], dir, far)
    ?? faceHit(collider, [ox, Math.min(y - PARKOUR_UNDER, loY - PARKOUR_GRIP_RUNG), oz], dir, far);
  if (!under || under.normal[0] * normal[0] + under.normal[2] * normal[2] < PARKOUR_FACE_FOLLOW - PARKOUR_RAY_SCATTER) return null;
  const n = under.normal;
  const fx = ox + dir[0] * under.dist, fz = oz + dir[2] * under.dist;
  // 4. the hang
  const feet = [fx + n[0] * back, y - PARKOUR_HANG_DROP, fz + n[2] * back];
  if (fit && !capsuleFits(collider, feet, stand)) return null;
  return { lipY: y, normal: n, face: [fx, y, fz], feet, key: top.key ?? under.key ?? null };
}

/** Is the way from `feet` into the hang the grip found clear the whole way
 *  (the catch's path, proven as a mantle's is)? */
export function catchClear(collider, feet, grip, height) {
  return pathClear(collider, path(feet, grip.feet, grip.feet, 1, 0), height);
}

/** A catch's move: from where the body was caught into the hang under the lip,
 *  in PARKOUR_CATCH_S. It ends in the hang (`hang`), not on a top. */
export function planCatch(feet, grip) {
  return {
    kind: 'catch',
    from: [feet[0], feet[1], feet[2]],
    up: [...grip.feet],
    to: [...grip.feet],
    split: 1, arc: 0,
    dur: PARKOUR_CATCH_S,
    crouch: false,
    exit: null,
    hang: { normal: [...grip.normal], lipY: grip.lipY },
    key: grip.key ?? null,
    t: 0,
  };
}

/** A corner the shimmy turns is another face turned from the one held past
 *  the follow (PARKOUR_FACE_FOLLOW - a bend the grip follows on its own, its
 *  30 degrees taken with the rays' scatter: a 12-sided room's bends, exactly
 *  that, fell between the two). AUDIT CLIMB2 G5: a
 *  building's square corner, an octagonal tower's 45 degrees, a hexagon's 60
 *  - the first cut took only corners within 30 degrees of square, and the
 *  shimmy stopped at the first bend of every tower or room that was not
 *  round. Round an outer corner the other face is sought this far past the
 *  edge (its turn read off it; one too sharp to meet there is taken as
 *  square). */
export const PARKOUR_CORNER_PROBE = 0.1;
/** Round an inner corner the body comes off the first face by this more. */
export const PARKOUR_CORNER_OFF = 0.1;
/** Round an outer corner the hands take the other face this far past the
 *  edge, and the body swings round the edge this far clear of it. */
export const PARKOUR_CORNER_IN = 0.25;
export const PARKOUR_CORNER_CLEAR = 0.1;

/** Is the whole of a move's path clear for a body this tall (pathClear)? */
export function moveClear(collider, m, height) {
  return pathClear(collider, m, height);
}

/** A corner's move: the hang carried round it by `mid` into the hang on the
 *  other face, at the shimmy's pace. Unbilled: a shimmy is no new exertion. */
export function planCorner(from, mid, grip, skill) {
  const len = Math.hypot(mid[0] - from[0], mid[1] - from[1], mid[2] - from[2])
    + Math.hypot(grip.feet[0] - mid[0], grip.feet[1] - mid[1], grip.feet[2] - mid[2]);
  return {
    kind: 'corner',
    from: [from[0], from[1], from[2]],
    up: [...mid],
    to: [...grip.feet],
    split: 0.5, arc: 0,
    dur: Math.max(0.2, len / shimmySpeed(skill)),
    crouch: false,
    exit: null,
    hang: { normal: [...grip.normal], lipY: grip.lipY },
    bill: false,
    key: grip.key ?? null,
    t: 0,
  };
}

/** The free climber's wall: level rays from the axis along `dir` (into the
 *  wall) at PARKOUR_CONTACT_AT shares of the body's height; the nearest to
 *  meet a wall within the radius and `reach` (PARKOUR_CONTACT; a climb down
 *  from a hang seeks the wall under a sill as far as the grab's own reach,
 *  PARKOUR_WALL_REACH, until the hug presses the body to it). Answers { dist,
 *  normal, key } (the normal out of the wall, level) or null. */
export function wallContact(collider, feet, dir, height, radius, reach = PARKOUR_CONTACT) {
  if (!collider?.raycastHit) return null;
  let best = null;
  for (const k of PARKOUR_CONTACT_AT) {
    const h = collider.raycastHit([feet[0], feet[1] + height * k, feet[2]], dir, radius + reach);
    if (!Number.isFinite(h.dist) || !h.normal || Math.abs(h.normal[1]) > PARKOUR_WALL_MAX_NY) continue;
    const l = Math.hypot(h.normal[0], h.normal[2]);
    if (!best || h.dist < best.dist) best = { dist: h.dist, normal: [h.normal[0] / l, 0, h.normal[2] / l], key: h.key ?? null };
  }
  return best;
}

/** A hold on what moves rides it: the body carried by the bucket's rigid
 *  motion, the wall's normal turned with it and the lip risen with the body. */
export function carryHold(pos, hold, was, now) {
  const y0 = pos[1];
  carryPoint(pos, was, now);
  carryLip(hold, pos[1] - y0, was, now);
}
