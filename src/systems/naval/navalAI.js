// @ts-check
// NAV-C (2026-09-28, Mac: "introduce actual sailing ships to the world that players can encounter and pillage") -
// THE CAPTAINS: how a ship of the Iliac Bay sails, keeps off the rocks and off other hulls, and fights. The port's own;
// pure - the host hands the wind, a water test and what else is at sea, and gets the ship moved and its volleys back.
//
// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") rebuilt the seamanship on what the movement
// audit measured: ships that stalled head to wind for minutes, spun like tops in a tenth of their own length, sailed
// through each other and over thin spits, and could never force, hold or chase a fight at half the player's speed.
//
// A SHIP SAILS BY THE WIND. Its way is its class's best (navalShips.js, rated at WIND_RATED - the player's own hulls'
// pace, Come Sail Away's) times the wind's strength over that, times the point of sail - the angle between its
// heading and where the wind blows TO: running before it most of its best, a broad reach all of it, close-hauled a
// third, head to wind in irons almost none (`windFactor`) - times what canvas it has left (navalDamage.js wayShare)
// and the sail it has set. A galley rows: under oars it never makes less than OARS_FLOOR of its best, whatever the
// wind. NO SHIP POINTS HIGHER THAN CLOSE-HAULED: a course into the wind's eye is beaten up to on a TACK, 45 degrees
// off the eye, coming about when the place it beats for bears TACK_FLIP past the eye on the other side (a galley
// strikes sail and rows it).
//
// IT TURNS LIKE A HULL. The helm takes over TURN_TAU (the hull's own) and the turn eases in and out - never past the
// course, the approach critically damped - at no more than the rate that keeps her on her least turning circle,
// TURN_RADIUS_K lengths across, and her class's handiness (`turn`); with no way on she barely answers (TURN_FLOOR, a
// galley's oars OARS_TURN). A turn at full helm costs her TURN_SPEED_LOSS of her way, and she heels into it - with
// her way, and to leeward with the wind on her beam - on a spring, settling rather than snapping.
//
// IT KEEPS OFF THE LAND. Every NAV_EVERY_S the lookout sounds the course she wants - from the stem out past her
// turning circle and LOOKAHEAD_S of her way (LOOKAHEAD_MIN at least), every SCAN_STEP, on the keel line and SCAN_MARGIN
// past either side of her hull - and when it is foul, the courses swung either side of it, nearest first; she keeps a
// swing until it is foul too or the course she swung from has been clear AVOID_HOLD_S; boxed in she comes about. A
// stem or a shoulder that would stand on land does not: she loses her way (AGROUND_WAY) and turns for open water.
// `isWater(x, z, hull)` is the host's word (the map's heights, the streamed ground where it is built, deep enough for
// her hull). AND OFF OTHER HULLS: one that will pass within both hulls' reach and AVOID_SHIP_CLEAR inside
// AVOID_SHIP_S is given room - to starboard for one ahead, as the rule of the road has it, away from one overtaking.
//
// IT FIGHTS AS A SHIP OF THE LINE. A captain with an enemy in reach (ENGAGE_RANGE, or a raider's own lookout) closes
// on a true intercept - the course that meets the enemy's way, read smoothed - to its class's range, then shows the
// side whose broadside will bear SOONEST: the turn to present it against its reload, the wind's eye costing its
// course, a course onto land none at all. Presented, it lays the enemy's LEAD abeam - where the enemy will be when the
// balls arrive - bent up to RANGE_BEND off the beam to keep its fighting range, her way matched to the enemy's
// along her course so the lead stays abeam (PRESENT_GAIN on how far it has drawn ahead or dropped astern) and never
// under PRESENT_SAILS of her sail: she keeps station yardarm to yardarm with a ship under way, and never sails past a
// slow one. A galley fights over its stem. It lets an enemy go past DISENGAGE times the reach it saw it at, or
// a chase that gains nothing in CHASE_GIVE_UP_S, and leaves that one be for SPARE_S. A merchant runs from a threat on
// the fastest point of sail away from it, and fires only what bears as it runs; a pirate short of hull runs too - a
// flagship never. A PIRATE COMES ALONGSIDE a player's boat that is crippled, holed under GRAPPLE_HULL or lying still
// GRAPPLE_STILL_S: to her lee side, BERTH_GAP of water between the planks, shortening sail as she closes, her
// broadsides held - and grapples within GRAPPLE_RANGE (the boarding is the host's: NAV-D, Warm Ashes' raid). A wreck
// no one aboard will board (no pirate, no men, the Boarders setting off) is not fired on and is left WRECK_SPARE_S on.
//
// WHO FIGHTS WHOM. Pirates take anything; a navy takes pirates, and the player when their notoriety in its crown's
// waters has reached NAVY_HUNTS (NAV-D) or they have fired on it or on a lawful ship it saw; a merchant fights no
// one and fires back only at who fired on it. `hostile(a, b)` is that table; `provoke` records a blow.

import { classById, batteryOf, hullBuild, GUNS, HULL } from './navalShips.js';
import { createShipDamage, SHIP_STATES } from './navalDamage.js';
import { createGunDeck, aimSolution } from './navalGunnery.js';
import { NAVAL_DEG, rangeAt, SHOT_GRAVITY } from './navalBallistics.js';
import { BERTH_GAP } from './navalBoarding.js';
import { wrapAngle } from '../../world/mat4.js';   // ONCRASH1: the port's one angle wrap, which cannot loop

/** A galley's oars: its least way, as a share of its best. */
export const OARS_FLOOR = 0.55;
/** How far ahead a helm looks past its stem and its turning circle: seconds of its way, and never less than this. */
export const LOOKAHEAD_S = 22;
export const LOOKAHEAD_MIN = 70;
/** The lookout's soundings: SCAN_STEP m apart out to the turning circle's far side and twice that beyond, each on the
 *  keel line and SCAN_MARGIN m past either side of the hull. */
export const SCAN_STEP = 6;
export const SCAN_MARGIN = 4;
/** The swings a foul course is tried at, nearest first (degrees). */
export const AVOID_SWINGS = Object.freeze([25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180]);
/** A swing is kept until the course it swung from has been clear this long (s); the lookout sounds this often (s). */
export const AVOID_HOLD_S = 3;
export const NAV_EVERY_S = 0.25;
/** A broadside bears within this of abeam; the chasers within BOW_BEAR of dead ahead (degrees). */
export const BEAR_DEG = 13;
export const BOW_BEAR = 11;
/**
 * AUDIT NAV1 (the guns) - THE RUN-OUT: a battery is run out RUN_OUT_S before it can fire - the tell the helm sees,
 * hears and braces for (the host's glint along her ports, the trucks' rumble, the readout's warning) - once it is
 * loaded, in its reach, with a lay that can strike her and no friend across the line, and the enemy's lead will bear
 * within RUN_OUT_S: in the fire's window now, or closing on it fast enough (the lead's bearing's own rate - its way
 * across her and her own turn); never past RUN_OUT_DEG of the beam (the chasers' BOW_RUN_OUT of the stem). It is
 * run in again past RUN_IN_DEG, out of reach, with the line fouled, or unfired RUN_OUT_WAIT_S past its time - and not
 * run out again for RUN_IN_S: a tell is a promise, never a stance.
 * THE FIRE: run out, and the lead inside the fire's window (`fireWindow`): the bearing off the battery's line that
 * still lays the volley across her - her half-extent across the line of fire, her length turned to it - the crew's
 * share of it: a crack crew waits for her middle (FIRE_EXTENT_K), a green one fires at her edge (FIRE_EXTENT_SKILL
 * more at no skill); never inside the gun's own spread, never past BEAR_DEG. A side whose window the wind will not let
 * her bring the lead into costs NO_BEAR_S more in the choosing (engageCourse): she tacks to show the other.
 */
export const RUN_OUT_S = 1.3;
export const RUN_OUT_DEG = 30;
export const BOW_RUN_OUT = 24;
export const RUN_IN_DEG = 45;
export const RUN_OUT_WAIT_S = 2.5;
export const RUN_IN_S = 2;
/** A tell is begun only with the lead inside this share of the battery's reach - never one the enemy sails out of. */
export const RUN_OUT_REACH = 0.92;
/** Loaded, she still opens the range from a lead inside this share of her fighting range - no slugging hull to hull. */
export const POINT_BLANK = 0.4;
/** Presented, the helm leads the turn by her heading's own rate (read over TRACK_TAU s; a jump past TRACK_JUMP degrees
 *  in a step is a new course, not a rate) - the orbit's turn - else it trails the lead 4 TURN_TAU times that rate aft of
 *  her beam, outside the fire's window (AUDIT NAV1, the guns: 8 degrees in a steady orbit at 90 m). */
export const TRACK_TAU = 0.5;
export const TRACK_JUMP = 20;
export const FIRE_EXTENT_K = 0.35;
export const FIRE_EXTENT_SKILL = 0.65;
export const NO_BEAR_S = 90;
/** The crew's lay, long or short of the lead by up to LAY_ERR of the range at no skill (none at the best), laid at
 *  AIM_FREEBOARD of her hull's height (her rig's middle for chain shot). */
export const LAY_ERR = 0.9;
export const AIM_FREEBOARD = 0.4;
/** A ship she does not take for an enemy within FRIEND_CLEAR of the line of fire holds it (m). */
export const FRIEND_CLEAR = 6;
/** An enemy is engaged inside this (m) and let go past DISENGAGE times the reach it was seen at; a threat is fled inside
 *  FLEE_RANGE. A chase that has not closed CHASE_GAIN of its range in CHASE_GIVE_UP_S is given up, and the one it
 *  chased left be for SPARE_S. */
export const ENGAGE_RANGE = 750;
/** A captain's lookout: how far she sees an enemy (m) - her own where she has one (a raider's, seaRaiders.js
 *  raiderSight), else ENGAGE_RANGE. One law for her captain and for a journey that slows before her (navalHost.js
 *  threats). */
export const lookoutOf = (ship) => ship.sight ?? ENGAGE_RANGE;
export const DISENGAGE = 1.35;
export const FLEE_RANGE = 320;
export const CHASE_GIVE_UP_S = 150;
export const CHASE_GAIN = 0.1;
export const SPARE_S = 300;
/** A pirate runs under this share of hull (a flagship never). */
export const PIRATE_RUNS_AT = 0.33;
/** A pirate grapples a boat within this (m) that is crippled (under GRAPPLE_HULL of hull) or has lain under
 *  GRAPPLE_STILL m/s for GRAPPLE_STILL_S - with at least GRAPPLE_CREW men to send. */
export const GRAPPLE_RANGE = 28;
/** Where both hulls are known the grapnels fly across this much open water between them (m) - the haul brings her in. */
export const GRAPPLE_GAP = 12;
export const GRAPPLE_HULL = 0.35;
export const GRAPPLE_STILL = 1.2;
export const GRAPPLE_STILL_S = 5;
export const GRAPPLE_CREW = 6;
/** Coming alongside to board: she makes the pace that stops her BOARD_SAILS.from metres short of the berth at DECEL -
 *  never under .min of her sail - and matches the boat's own way. */
export const BOARD_SAILS = Object.freeze({ min: 0.3, from: 15 });
/** A crippled boat no one here will board is not fired on, and left after this (s). */
export const WRECK_SPARE_S = 30;
/** A navy hunts a player whose notoriety in its crown has reached this (0..100, NAV-D). */
export const NAVY_HUNTS = 50;
/** The way a ship gains and loses (m/s^2), a heavy hull half as quick to gain it - she carries her way through a tack. */
export const ACCEL = 0.35;
export const DECEL = 0.25;
/** How long a blow keeps a ship provoked by who struck it (s). */
export const PROVOKED_S = 300;
/** The wind the classes' speeds are rated at - Come Sail Away's Random.Range(1, 2), its middle - and the bounds of the
 *  share a stronger or lighter wind makes of them. */
export const WIND_RATED = 1.5;
export const WIND_SHARE = Object.freeze([0.3, 2]);
/** Close-hauled: the nearest a ship points to the wind's eye, as its angle off the run (degrees; 135 is 45 off). */
export const CLOSE_HAULED = 135;
/** A tack is held at least TACK_MIN_S (s); she comes about when the place she beats for bears TACK_FLIP (degrees) past
 *  the wind's eye on the side she sails from. */
export const TACK_MIN_S = 12;
export const TACK_FLIP = 35;
/** A hull's least turning circle, as its length times this (Rowboat, Large Boat, Small Ship, Large Galley, Carrack). */
export const TURN_RADIUS_K = Object.freeze([2.5, 2.5, 1.6, 1.3, 1.6]);
/** How quickly a hull's helm takes (s), by hull. */
export const TURN_TAU = Object.freeze([0.5, 0.6, 1.0, 1.5, 1.2]);
/** With no way on a hull turns at this (degrees a second); a galley's oars turn her at OARS_TURN. */
export const TURN_FLOOR = 1;
export const OARS_TURN = 3;
/** A turn at full helm costs this share of her way. */
export const TURN_SPEED_LOSS = 0.25;
/** The heel: a turn's (degrees per m/s of way per degree a second of turn), the wind's on the beam (degrees at the
 *  rated wind, all sail set), the most either way (degrees), and the spring she settles on (rad/s, its damping). */
export const HEEL_TURN = 0.15;
export const HEEL_WIND = 2;
export const HEEL_MAX = 12;
export const HEEL_OMEGA = 2.2;
export const HEEL_ZETA = 0.55;
/** Other hulls: watched within AVOID_SHIP_RANGE (m); one passing within both hulls' reach and AVOID_SHIP_CLEAR (m)
 *  inside AVOID_SHIP_S (s) is given room, up to AVOID_SHIP_SWING degrees - to starboard for one met within
 *  AVOID_HEAD_ON of the bow (the rule of the road), else away from the side she passes on. AUDIT NAV1 (the guns): the
 *  starboard rule once ran to 112.5 degrees, so a hull on her starboard beam had her steer into it. */
export const AVOID_SHIP_RANGE = 250;
export const AVOID_SHIP_S = 25;
export const AVOID_SHIP_CLEAR = 15;
export const AVOID_SHIP_SWING = 60;
export const AVOID_HEAD_ON = 22.5;
/** The enemy's way is read smoothed over TARGET_VEL_TAU (s); a pursuit with no intercept leads by PURSUIT_LEAD_S. */
export const TARGET_VEL_TAU = 1;
export const PURSUIT_LEAD_S = 20;
/** A broadside presented bends up to this (degrees) off the beam to keep her fighting range. */
export const RANGE_BEND = 30;
/** Presented within reach she keeps station: her way matched to the enemy's along her course, gaining PRESENT_GAIN a
 *  second on each metre the lead has drawn ahead of her beam (losing it astern), never under PRESENT_SAILS of her sail.
 *  AUDIT NAV1 (the guns): a flat PRESENT_SAILS dropped her astern of a boat under way, again and again. */
export const PRESENT_SAILS = 0.6;
export const PRESENT_GAIN = 0.08;
/** A side whose broadside heading lies past close-hauled is presented close-hauled instead; the degrees the enemy's
 *  lead then stands off the beam cost the side this many seconds each, when the sides are weighed. */
export const BEAR_COST_S = 1;
/** The side she shows is changed only for one that will bear SIDE_HOLD_S sooner, or when hers runs onto the land. */
export const SIDE_HOLD_S = 8;
/** A turn through the wind's eye is decided once, as it begins: a ship with less way than this share of her best wears
 *  - turns through the wind's lee, the long way round - rather than tack and lie in irons; one that tacks carries
 *  TACK_CARRY of the rate she went in with through the eye (her way shoots her through it). */
export const WEAR_BELOW = 0.45;
export const TACK_CARRY = 0.8;
/** Only a ship already this near the wind (degrees off the run) tacks; off it she wears, keeping her way. */
export const TACK_FROM = 110;
/** A ship lying in irons - within IRONS_DEG of the wind's eye with under IRONS_WAY m/s - pays off: the wind on her
 *  backed canvas swings her bow away at PAYOFF_TURN degrees a second. */
export const IRONS_DEG = 30;
export const IRONS_WAY = 1;
export const PAYOFF_TURN = 4;
/** A ship boxed in by the land shortens sail to BOXED_SAILS and, her way down to half again IRONS_WAY, is warped round
 *  where she lies at PAYOFF_TURN - a channel's end is turned in, not scraped round. */
export const BOXED_SAILS = 0.3;
/** A running ship takes the fastest point of sail within this of dead away (degrees). */
export const FLEE_SPREAD = 60;
/** A cruise's waypoint: out WAYPOINT_DIST (m), reached within WAYPOINT_REACHED, never upwind of close-hauled nor across
 *  land (the leg sounded every WAYPOINT_SOUND m); WAYPOINT_TRIES draws for one. */
export const WAYPOINT_DIST = Object.freeze([900, 2300]);
export const WAYPOINT_REACHED = 120;
export const WAYPOINT_SOUND = 60;
export const WAYPOINT_TRIES = 12;
/** A stem that would stand on land holds her there: her way falls to AGROUND_WAY of her best for AGROUND_S. */
export const AGROUND_WAY = 0.3;
export const AGROUND_S = 2;
/** A prize cast adrift drifts downwind at this (m/s). */
export const ADRIFT_SPEED = 0.35;

const DEG = NAVAL_DEG;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const forwardOfYaw = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
/** The quaternion of a yaw about +y (the root's rotation). */
export const quatOfYaw = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
const headingTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/**
 * The point of sail's share of a ship's best way: `offRun` the angle (radians, 0..PI) between its heading and where
 * the wind blows to - 0 running dead before it, PI head to wind.
 */
export function windFactor(offRun) {
  const d = Math.abs(offRun) / DEG;
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  if (d <= 40) return 0.85;
  if (d <= 100) return lerp(0.85, 1, (d - 40) / 60);
  if (d <= 135) return lerp(1, 0.7, (d - 100) / 35);
  if (d <= 150) return lerp(0.7, 0.35, (d - 135) / 15);
  return lerp(0.35, 0.08, (d - 150) / 30);
}

/** The share of her rated way a wind of strength `windLen` gives (Come Sail Away's way is linear in it). */
export const windShare = (windLen) => clamp(windLen / WIND_RATED, WIND_SHARE[0], WIND_SHARE[1]);

/**
 * A new ship at sea. `spec` - `{ id, seed, classId, variant, pos, yaw, names, owner }`; the class decides the rest.
 */
export function createSeaShip({ id, seed, classId, variant = 0, pos, yaw = 0, names = null, owner = null }) {
  const cls = classById(classId);
  if (!cls) throw new Error(`navalAI: no ship class '${classId}'`);
  const damage = createShipDamage({ hullHp: cls.hullHp, sailHp: cls.sailHp, crew: cls.crew });
  const ship = {
    id: String(id), seed: seed >>> 0, cls, hull: cls.hull, variant, names, owner,
    pos: [...pos], yaw: wrapAngle(yaw), speed: 0, turnNow: 0, sails: 1, heel: 0, settle: 0,
    /** AUDIT NAV1: the helm's rate (rad/s), the heel's (degrees a second), the sail she wants, her own clock (s) */
    yawRate: 0, heelVel: 0, sailsWant: 1, clock: 0,
    mode: 'cruise', target: null, waypoint: null, damage,
    /** NAV-R: a raider's own lookout (m; null: ENGAGE_RANGE) and the course it sails ([x, z]; null: a waypoint of its own) */
    sight: null, course: null,
    guns: createGunDeck(cls.hull, { crewed: true, crewShare: () => damage.crewShare() }),
    /** attacker id -> the time of its last blow */
    provoked: new Map(),
    /** contact id -> seconds it has lain still */
    stillFor: new Map(),
    /** contact id -> the clock she leaves it be until (a chase given up, a wreck left) */
    spare: new Map(),
    /** AUDIT NAV1: the lookout's swing off the land, the tack she beats on, the chase's tally, the enemy's way smoothed,
     *  the side she presents, the wreck she watches, the side she berths on, the seconds she lies aground, and the turn
     *  through the wind's eye she has committed to (tack or wear) */
    avoid: { swing: 0, heading: null, clearFor: 0, at: -Infinity, dir: 0 },
    tack: null, chase: null, tvel: null, present: null, wreck: null, berthSide: 0, aground: 0, turnWay: null,
    /** AUDIT NAV1 (the guns): the heading she steered for last step, and its rate - the presented helm's lead */
    wantPrev: null, wantRate: 0,
    /** AUDIT NAV1 (the guns): side -> her clock when that battery began to run out; side -> the clock it was run in */
    runOut: new Map(), runIn: new Map(),
    boarded: false,
    /** a prize cast adrift: she drifts downwind */
    adrift: false,
    volleySeq: 0,
    lastFire: -Infinity,
  };
  return ship;
}

/** The world velocity of a ship: its way along its heading. */
export const velocityOf = (ship) => { const f = forwardOfYaw(ship.yaw); return [f[0] * ship.speed, 0, f[2] * ship.speed]; };

/**
 * Whether faction `a`'s ship takes `b` (a contact: `{ kind: 'ship'|'player', faction?, id }`) for an enemy.
 * @param {any} ship
 * @param {{ kind: string, faction?: string, id: string }} contact
 * @param {{ notoriety?: (crown: string | null) => number, now?: number }} [opts]
 */
export function hostile(ship, contact, { notoriety = () => 0, now = 0 } = {}) {
  const f = ship.cls.faction;
  const provokedBy = (ship.provoked.get(contact.id) ?? -Infinity) > now - PROVOKED_S;
  if (contact.kind === 'player') {
    if (f === 'pirate') return true;
    if (f === 'navy') return provokedBy || notoriety(ship.names?.crown ?? null) >= NAVY_HUNTS;
    return provokedBy;   // a merchant: only who fired on it
  }
  const g = contact.faction;
  if (f === 'pirate') return g === 'merchant' || g === 'navy' || provokedBy;
  if (f === 'navy') return g === 'pirate' || provokedBy;
  return provokedBy;
}

/** A blow from `by` at `now`: the ship remembers who struck it. */
export function provoke(ship, by, now) { if (by != null) ship.provoked.set(String(by), now); }

// ── the hull's handling ────────────────────────────────────────────────────────────────────────────────────────────

/** A hull's length off its build (m). */
export const hullLength = (hull) => { const b = hullBuild(hull); return b.bowZ - b.aftZ; };
/** A ship's least turning circle (radius, m). */
export const turnRadius = (ship) => TURN_RADIUS_K[ship.hull] * hullLength(ship.hull);
/** The most she turns now (rad/s): her way over her least circle, never under the floor, never past her class's. */
export function maxTurnRate(ship) {
  const floor = (ship.hull === HULL.LargeGalley ? OARS_TURN : TURN_FLOOR) * DEG;
  return Math.min(ship.cls.turn * DEG, Math.max(floor, ship.speed / turnRadius(ship)));
}

// ── the land ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Whether the course `yaw` is clear from `pos`: soundings every `step` metres from `from` out to `dist` (twice as far
 * apart past `near`), each on the line and `half` metres either side of it - a hull is wide. `isWater(x, z)`.
 * @param {number[]} pos
 * @param {number} yaw
 * @param {number} dist
 * @param {(x: number, z: number) => boolean} isWater
 * @param {{ half?: number, from?: number, near?: number, step?: number }} [opts]
 */
export function courseClear(pos, yaw, dist, isWater, { half = 10, from = 0, near = Infinity, step = SCAN_STEP } = {}) {
  const f = forwardOfYaw(yaw), r = [f[2], 0, -f[0]];
  let s = Math.max(0, from);
  for (;;) {
    const x = pos[0] + f[0] * s, z = pos[2] + f[2] * s;
    if (!isWater(x, z) || !isWater(x + r[0] * half, z + r[2] * half) || !isWater(x - r[0] * half, z - r[2] * half)) return false;
    if (s >= dist) return true;
    s = Math.min(dist, s + (s < near ? step : step * 2));
  }
}

/** The lookout's reach for a ship: past her stem, her turning circle and LOOKAHEAD_S of her way. */
function lookout(ship) {
  const b = hullBuild(ship.hull);
  const rTurn = turnRadius(ship);
  return { from: b.bowZ * 0.5, near: b.bowZ + rTurn, dist: b.bowZ + rTurn + Math.max(LOOKAHEAD_MIN, ship.speed * LOOKAHEAD_S), half: b.halfWidth + SCAN_MARGIN };
}
const soundCourse = (ship, yaw, isWater) => { const l = lookout(ship); return courseClear(ship.pos, yaw, l.dist, isWater, { half: l.half, from: l.from, near: l.near }); };

/**
 * The course nearest `want` that is clear (AVOID_SWINGS), or the reciprocal of the heading when none is. Sounded
 * every NAV_EVERY_S of the ship's own clock - between soundings the last answer stands - and a swing is kept until it
 * is foul or `want` has been clear AVOID_HOLD_S.
 */
export function avoidLand(ship, want, isWater, wind = null) {
  const a = ship.avoid;
  if (ship.clock - a.at < NAV_EVERY_S) return a.heading != null ? a.heading : wrapAngle(want + a.swing * DEG);
  const since = Number.isFinite(a.at) ? ship.clock - a.at : 0;
  a.at = ship.clock;
  const out = avoidLandSounded(ship, want, isWater, wind, since);
  // a turn of more than 120 degrees near the land: round on the side with the more open water
  const turn = wrapAngle(out - ship.yaw);
  if (Math.abs(turn) > 120 * DEG && !a.dir) {
    const r = roomEither(ship, isWater);
    a.dir = r.right === r.left ? 0 : r.right > r.left ? 1 : -1;
  } else if (Math.abs(turn) <= 120 * DEG) a.dir = 0;
  return out;
}
/** The open water either side of her: how many of three courses 45, 90 and 135 degrees off to each side sound clear
 *  out to her turning circle's reach. */
function roomEither(ship, isWater) {
  const l = lookout(ship);
  const count = (side) => { let n = 0; for (const k of [45, 90, 135]) if (courseClear(ship.pos, wrapAngle(ship.yaw + side * k * DEG), l.near, isWater, { half: l.half, from: l.from })) n++; return n; };
  return { right: count(1), left: count(-1) };
}
function avoidLandSounded(ship, want, isWater, wind, since) {
  const a = ship.avoid;
  const wantClear = soundCourse(ship, want, isWater);
  if (a.heading == null && a.swing === 0) {
    if (wantClear) return want;
  } else {
    a.clearFor = wantClear ? a.clearFor + since : 0;
    if (a.clearFor >= AVOID_HOLD_S) { a.swing = 0; a.heading = null; a.clearFor = 0; return want; }
    if (a.heading == null && soundCourse(ship, wrapAngle(want + a.swing * DEG), isWater)) return wrapAngle(want + a.swing * DEG);
    if (wantClear) { a.swing = 0; a.heading = null; a.clearFor = 0; return want; }   // the swing is foul and the course clear again
  }
  // the nearest clear swing she can sail (a galley rows any), else the nearest clear one at all
  for (const any of [false, true]) {
    for (const s of AVOID_SWINGS) {
      const y = wrapAngle(want + s * DEG);
      if (!any && wind && sailable(ship, y, wind) !== y) continue;
      if (soundCourse(ship, y, isWater)) { a.swing = s; a.heading = null; a.clearFor = 0; return y; }
    }
  }
  // boxed in: about - round toward the side with the more open water, never swinging the stem across the land
  const r = roomEither(ship, isWater);
  const side = r.right >= r.left ? 1 : -1;
  a.swing = 0; a.clearFor = 0;
  a.heading = wrapAngle(ship.yaw + side * (Math.PI - 1e-3));
  return a.heading;
}

// ── bearings, the lead, the intercept ───────────────────────────────────────────────────────────────────────────────

/** The bearing of a point off a ship's bow (radians, + starboard) and its distance on the flat. */
export function bearingTo(ship, p) {
  const dx = p[0] - ship.pos[0], dz = p[2] - ship.pos[2];
  return { bearing: wrapAngle(Math.atan2(dx, dz) - ship.yaw), dist: Math.hypot(dx, dz) };
}

/**
 * Where to lay for a moving enemy: its position after the flight, the flight found by iterating the range twice.
 * `rel` the enemy's velocity less ours (the balls carry our own).
 */
export function leadPoint(from, target, rel, speed) {
  let p = [...target];
  for (let i = 0; i < 3; i++) {
    const d = Math.hypot(p[0] - from[0], p[2] - from[2]);
    const t = d / Math.max(1, speed * 0.97);   // the flight: the ball's way along the flat (cos of a laid gun ~0.97)
    p = [target[0] + rel[0] * t, target[1], target[2] + rel[2] * t];
  }
  return p;
}

/**
 * The course that meets a target: the smallest t with |P + V t| = s t (P where it is from us, V its way, s ours) - or,
 * when it outruns us, a pursuit leading it by at most PURSUIT_LEAD_S. Answers `{ heading, point, t }`.
 */
export function intercept(from, speed, target, vel) {
  const P = [target[0] - from[0], target[2] - from[2]], V = [vel?.[0] ?? 0, vel?.[2] ?? 0];
  const s = Math.max(0.5, speed);
  const a = V[0] * V[0] + V[1] * V[1] - s * s, b = 2 * (P[0] * V[0] + P[1] * V[1]), c = P[0] * P[0] + P[1] * P[1];
  let t = null;
  if (Math.abs(a) < 1e-9) t = b < 0 ? -c / b : null;
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const q = Math.sqrt(disc);
      const roots = [(-b - q) / (2 * a), (-b + q) / (2 * a)].filter((r) => r > 0);
      t = roots.length ? Math.min(...roots) : null;
    }
  }
  if (t == null) t = Math.min(PURSUIT_LEAD_S, Math.sqrt(c) / s);
  const point = [target[0] + V[0] * t, target[1] ?? 0, target[2] + V[1] * t];
  return { heading: headingTo(from, point), point, t };
}

// ── the wind's eye ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The angle between a heading and where the wind blows to (0 running, PI in irons). */
function offRunOf(yaw, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (wl < 1e-6) return Math.PI / 2;
  return Math.abs(wrapAngle(yaw - Math.atan2(wind[0], wind[2])));
}

/**
 * A course no nearer the wind's eye than close-hauled: `want` itself, or the tack she beats on toward `goal` - held
 * TACK_MIN_S at least, put about when the goal bears TACK_FLIP past the eye on the side she sails from. A galley rows.
 */
export function tackCourse(ship, want, goal, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (ship.hull === HULL.LargeGalley || wl < 1e-6 || offRunOf(want, wind) <= CLOSE_HAULED * DEG) { ship.tack = null; return want; }
  const eye = wrapAngle(Math.atan2(wind[0], wind[2]) + Math.PI);
  const g = goal ?? [ship.pos[0] + Math.sin(want) * 1000, 0, ship.pos[2] + Math.cos(want) * 1000];
  const a = wrapAngle(headingTo(ship.pos, g) - eye);
  const flip = TACK_FLIP * DEG;
  if (!ship.tack) {
    const side = Math.abs(a) > flip ? Math.sign(a) : (wrapAngle(ship.yaw - eye) >= 0 ? 1 : -1);
    ship.tack = { side, since: ship.clock };
  } else if (ship.clock - ship.tack.since >= TACK_MIN_S && ((ship.tack.side > 0 && a < -flip) || (ship.tack.side < 0 && a > flip))) {
    ship.tack = { side: -ship.tack.side, since: ship.clock };
  }
  return wrapAngle(eye + ship.tack.side * (180 - CLOSE_HAULED) * DEG);
}

/** The heading nearest `want` a ship can sail - `want`, or close-hauled on its side of the wind's eye (a galley rows
 *  any course). */
export function sailable(ship, want, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (ship.hull === HULL.LargeGalley || wl < 1e-6 || offRunOf(want, wind) <= CLOSE_HAULED * DEG) return want;
  const eye = wrapAngle(Math.atan2(wind[0], wind[2]) + Math.PI);
  return wrapAngle(eye + (wrapAngle(want - eye) >= 0 ? 1 : -1) * (180 - CLOSE_HAULED) * DEG);
}

// ── other hulls ────────────────────────────────────────────────────────────────────────────────────────────────────

/** A hull's reach for passing clear: between its half beam and its half length. */
const passReach = (hull) => { const b = hullBuild(hull); return 0.5 * (b.halfWidth + (b.bowZ - b.aftZ) / 2); };

/**
 * `want` bent clear of the hulls about her (`contacts` with a `hull`): each that will pass within both reaches and
 * AVOID_SHIP_CLEAR inside AVOID_SHIP_S bends it by its urgency - to starboard for one forward of the beam, away from
 * one abaft it - up to AVOID_SHIP_SWING in all. `except` is left out (the ship she means to lie alongside).
 */
export function trafficCourse(ship, want, contacts, except = null) {
  const my = velocityOf(ship);
  const mine = passReach(ship.hull);
  let bend = 0;
  for (const c of contacts ?? []) {
    if (c.id === ship.id || c.id === except || c.gone || c.hull == null) continue;
    const p = [c.pos[0] - ship.pos[0], c.pos[2] - ship.pos[2]];
    if (Math.hypot(p[0], p[1]) > AVOID_SHIP_RANGE) continue;
    const v = [(c.vel?.[0] ?? 0) - my[0], (c.vel?.[2] ?? 0) - my[2]];
    const vv = v[0] * v[0] + v[1] * v[1];
    const tca = vv > 1e-6 ? Math.max(0, -(p[0] * v[0] + p[1] * v[1]) / vv) : 0;
    if (tca > AVOID_SHIP_S) continue;
    const dca = Math.hypot(p[0] + v[0] * tca, p[1] + v[1] * tca);
    const reach = mine + passReach(c.hull) + AVOID_SHIP_CLEAR;
    if (dca >= reach) continue;
    const urgency = (1 - dca / reach) * (1 - tca / AVOID_SHIP_S);
    const brg = wrapAngle(Math.atan2(p[0], p[1]) - ship.yaw);
    const side = wrapAngle(Math.atan2(p[0] + v[0] * tca, p[1] + v[1] * tca) - ship.yaw);   // where she lies at the closest
    const dir = Math.abs(brg) < AVOID_HEAD_ON * DEG ? 1 : side > 0 ? -1 : 1;
    bend += dir * urgency * AVOID_SHIP_SWING * DEG;
  }
  return wrapAngle(want + clamp(bend, -AVOID_SHIP_SWING * DEG, AVOID_SHIP_SWING * DEG));
}

// ── the captain ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One step of a captain. `world`:
 *   now, dt, seaY, wind (where the wind blows to, its length the strength), isWater(x, z, hull),
 *   contacts: [{ id, kind: 'player'|'ship', faction?, pos, vel, speed, yaw?, hull?, hullShare?, crippled?, peer?, ship? }],
 *   notoriety(crown) -> 0..100, random() -> [0, 1), boarders (false: the Boarders setting off - no one grapples)
 * Answers `{ volleys: [{ side, solution }], barrels: [solution], grapple: contactId | null }`; the ship itself moved.
 */
export function stepCaptain(ship, world) {
  const out = { volleys: [], barrels: [], grapple: null, runOuts: [] };
  const dt = Math.max(0, world.dt);
  ship.clock += dt;
  const st = ship.damage.state;
  const isWater = (x, z) => world.isWater(x, z, ship.hull);
  ship.guns.step(dt);
  if (st !== SHIP_STATES.afloat || ship.boarded) ship.runOut.clear();   // a ship that no longer fights runs her guns in
  if (st === SHIP_STATES.sinking || st === SHIP_STATES.sunk) {
    ship.speed = Math.max(0, ship.speed - DECEL * dt);
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    helm(ship, ship.yaw, dt, world, 0);
    moveShip(ship, dt, null);
    return out;
  }
  if (st === SHIP_STATES.struck || st === SHIP_STATES.prize || ship.boarded) {
    ship.mode = st === SHIP_STATES.prize ? 'prize' : ship.boarded ? 'boarded' : 'struck';
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    ship.speed = Math.max(0, ship.speed - DECEL * 0.6 * dt);
    helm(ship, ship.yaw, dt, world, 0);
    moveShip(ship, dt, isWater);
    if (ship.adrift && st === SHIP_STATES.prize) drift(ship, dt, world.wind, isWater);
    return out;
  }

  // who is out there, and who is an enemy - the one she fights kept until it is past DISENGAGE of its reach
  const sight = lookoutOf(ship);
  let enemy = null, enemyD = Infinity, threat = null, threatD = Infinity;
  for (const c of world.contacts ?? []) {
    if (c.id === ship.id || c.gone) continue;
    const { dist } = bearingTo(ship, c.pos);
    const held = c.id === ship.target && (ship.mode === 'engage' || ship.mode === 'board');
    if (hostile(ship, c, world) && !((ship.spare.get(c.id) ?? -Infinity) > ship.clock)) {
      if (dist < (held ? sight * DISENGAGE : sight) && (held ? dist * 0.8 : dist) < enemyD) { enemy = c; enemyD = held ? dist * 0.8 : dist; }
    }
    // a threat is anything hostile that would take US
    const theyTakeUs = c.kind === 'ship' ? c.ship && hostile(c.ship, { kind: 'ship', faction: ship.cls.faction, id: ship.id }, world) : ship.cls.faction !== 'pirate' && (ship.provoked.get(c.id) ?? -Infinity) > world.now - PROVOKED_S;
    if (theyTakeUs && dist < FLEE_RANGE && dist < threatD) { threat = c; threatD = dist; }
  }
  if (enemy) enemyD = bearingTo(ship, enemy.pos).dist;
  for (const c of world.contacts ?? []) {
    if (c.kind !== 'player') continue;
    ship.stillFor.set(c.id, (c.speed ?? 0) < GRAPPLE_STILL ? (ship.stillFor.get(c.id) ?? 0) + dt : 0);
  }
  enemy = chaseOrGiveUp(ship, enemy, enemyD);
  if (!enemy) enemyD = Infinity;
  const boards = !!enemy && boardsHer(ship, enemy, world);
  enemy = leaveTheWreck(ship, enemy, boards);
  if (!enemy) enemyD = Infinity;

  const runs = (ship.cls.faction === 'merchant' && (threat || enemy))
    || (ship.cls.faction === 'pirate' && !ship.cls.flagship && ship.damage.hullShare() < PIRATE_RUNS_AT && (threat || enemy));
  let plan;
  if (runs) {
    const from = threat ?? enemy;
    ship.mode = 'flee';
    ship.target = from.id;
    plan = fleeCourse(ship, from, world.wind);
  } else if (enemy && ship.cls.faction !== 'merchant') {
    trackTarget(ship, enemy, dt);
    ship.target = enemy.id;
    if (boards) { ship.mode = 'board'; plan = boardCourse(ship, enemy, world.wind); }
    else { ship.mode = 'engage'; ship.berthSide = 0; plan = engageCourse(ship, enemy, enemyD, world, isWater); }
  } else {
    ship.mode = 'cruise';
    ship.target = null;
    ship.berthSide = 0;
    plan = { want: cruiseCourse(ship, world.wind, isWater, world.random ?? Math.random), goal: ship.course ? [ship.course[0], 0, ship.course[1]] : ship.waypoint ? [ship.waypoint[0], 0, ship.waypoint[1]] : null, sails: 1 };
  }
  let want = plan.sailable ? plan.want : tackCourse(ship, plan.want, plan.goal, world.wind);
  want = trafficCourse(ship, want, world.contacts, ship.mode === 'board' ? ship.target : null);
  want = avoidLand(ship, want, isWater, world.wind);

  // the sail, the helm and the way - boxed in by the land she shortens sail and pivots
  ship.sailsWant = ship.avoid.heading != null ? Math.min(plan.sails, BOXED_SAILS) : plan.sails;
  ship.sails = clamp(ship.sails + clamp(ship.sailsWant - ship.sails, -0.5 * dt, 0.4 * dt), 0, 1);
  helm(ship, want, dt, world, 1, plan.track ? trackRate(ship, want, dt) : (ship.wantPrev = null, ship.wantRate = 0));
  moveShip(ship, dt, isWater);

  // the guns - held at a wreck, and all but the chasers while she comes alongside
  if (!ship.guns.braced && !(enemy?.crippled && enemy.kind === 'player')) {
    gunnery(ship, world, enemy ?? (ship.cls.faction === 'merchant' ? threat : null), out, { broadsides: ship.mode !== 'board' });
  } else ship.runOut.clear();

  // the grapple: a pirate with men to send, alongside a crippled, holed or stopped boat - GRAPPLE_GAP of water between
  // the hulls where both are known, else within GRAPPLE_RANGE
  if (ship.mode === 'board') {
    const close = enemy.hull != null && Number.isFinite(enemy.yaw) ? hullGap(ship.pos, ship.yaw, ship.hull, enemy.pos, enemy.yaw, enemy.hull) <= GRAPPLE_GAP : enemyD <= GRAPPLE_RANGE;
    if (close) out.grapple = enemy.id;
  }
  return out;
}

/** A pirate's boarding: a player's own boat (never a peer's - their sea is theirs), men to send, the Boarders setting
 *  on, and the boat crippled, holed or lying still. */
function boardsHer(ship, enemy, world) {
  if (ship.cls.faction !== 'pirate' || enemy.kind !== 'player' || enemy.peer || world.boarders === false) return false;
  if (ship.damage.crew < GRAPPLE_CREW || ship.damage.hullShare() < PIRATE_RUNS_AT) return false;
  return !!enemy.crippled || (enemy.hullShare ?? 1) < GRAPPLE_HULL || (ship.stillFor.get(enemy.id) ?? 0) >= GRAPPLE_STILL_S;
}

/** A wreck no one here will board is not fought: after WRECK_SPARE_S watching it she leaves it be. */
function leaveTheWreck(ship, enemy, boards) {
  if (!enemy || boards || !(enemy.crippled && enemy.kind === 'player')) { if (!enemy || ship.wreck?.id !== enemy.id) ship.wreck = null; return enemy; }
  if (ship.wreck?.id !== enemy.id) ship.wreck = { id: enemy.id, since: ship.clock };
  if (ship.clock - ship.wreck.since < WRECK_SPARE_S) return enemy;
  ship.spare.set(enemy.id, ship.clock + SPARE_S);
  ship.wreck = null;
  return null;
}

/** The chase's tally: a new enemy starts it; one not closed by CHASE_GAIN in CHASE_GIVE_UP_S - while still past her
 *  fighting range - is given up and left be for SPARE_S. */
function chaseOrGiveUp(ship, enemy, d) {
  if (!enemy) { ship.chase = null; return null; }
  if (ship.chase?.id !== enemy.id) ship.chase = { id: enemy.id, since: ship.clock, best: d };
  else if (d < ship.chase.best * (1 - CHASE_GAIN) || d <= ship.cls.range * CLOSE_FROM) { ship.chase.best = d; ship.chase.since = ship.clock; }   // closing, or in the fight
  if (ship.clock - ship.chase.since > CHASE_GIVE_UP_S && d > ship.cls.range * CLOSE_FROM) {
    ship.spare.set(enemy.id, ship.clock + SPARE_S);
    ship.chase = null;
    return null;
  }
  return enemy;
}

/** The enemy's way, smoothed over TARGET_VEL_TAU - its turns read as turns, not as each frame's jitter. */
function trackTarget(ship, enemy, dt) {
  const v = enemy.vel ?? [0, 0, 0];
  if (ship.tvel?.id !== enemy.id) { ship.tvel = { id: enemy.id, v: [v[0], 0, v[2]] }; return; }
  const k = 1 - Math.exp(-dt / TARGET_VEL_TAU);
  ship.tvel.v[0] += (v[0] - ship.tvel.v[0]) * k;
  ship.tvel.v[2] += (v[2] - ship.tvel.v[2]) * k;
}

/** The rate her wanted heading turns at (rad/s), read smoothed over TRACK_TAU - a jump past TRACK_JUMP a new course. */
function trackRate(ship, want, dt) {
  if (ship.wantPrev == null || !(dt > 0)) { ship.wantPrev = want; ship.wantRate = 0; return 0; }
  const step = wrapAngle(want - ship.wantPrev);
  ship.wantPrev = want;
  if (Math.abs(step) > TRACK_JUMP * DEG) { ship.wantRate = 0; return 0; }
  ship.wantRate += (step / dt - ship.wantRate) * (1 - Math.exp(-dt / TRACK_TAU));
  return ship.wantRate;
}

/**
 * The helm and the way: the turn eased toward `want` inside her rate - led by `lead` (rad/s, the heading's own turn
 * while she presents) - her way toward what the wind, her canvas and her sail give (`power` 0 for none), a turn's cost
 * taken from it, and the heel on its spring.
 */
function helm(ship, want, dt, world, power, lead = 0) {
  let maxRate = maxTurnRate(ship);
  const tau = TURN_TAU[ship.hull] ?? 1;
  let err = wrapAngle(want - ship.yaw);
  // a turn through the wind's eye, decided as it begins and held to its end: wear with little way on (the short way
  // round becomes the long way, through the lee), else tack - her way carrying her through the eye at TACK_CARRY of
  // the rate she went in with
  const wind = world.wind;
  const wl0 = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (power > 0 && ship.hull !== HULL.LargeGalley && wl0 > 1e-6) {
    const toEye = wrapAngle(Math.atan2(wind[0], wind[2]) + Math.PI - ship.yaw);
    const through = Math.sign(toEye) === Math.sign(err) && Math.abs(toEye) < Math.abs(err);
    const off = offRunOf(ship.yaw, wind);
    // a tack is over once she can sail again past the eye; a wear once she is round
    if (ship.turnWay && (Math.abs(err) < 20 * DEG || (!through && ship.turnWay.kind === 'tack' && off <= CLOSE_HAULED * DEG))) ship.turnWay = null;
    if (!ship.turnWay && through) {
      ship.turnWay = ship.speed >= WEAR_BELOW * paceOf(ship, wind) && off >= TACK_FROM * DEG ? { kind: 'tack', rate: maxRate } : { kind: 'wear' };
    }
    if (ship.turnWay?.kind === 'wear' && through) err -= Math.sign(err) * 2 * Math.PI;
    if (ship.turnWay?.kind === 'tack') maxRate = Math.max(maxRate, Math.min(ship.cls.turn * DEG, TACK_CARRY * ship.turnWay.rate));
    // in irons she pays off, the bow swung from the eye whichever way the helm asks
    if (Math.abs(toEye) < IRONS_DEG * DEG && ship.speed < IRONS_WAY) maxRate = Math.max(maxRate, PAYOFF_TURN * DEG);
  } else ship.turnWay = null;
  if (ship.avoid.heading != null || ship.aground > 0) {
    maxRate = Math.max(maxRate, PAYOFF_TURN * DEG);   // boxed in or aground: warped round where she lies
    ship.turnWay = null;
  }
  // a big turn under the land goes round on the side the lookout found open (avoidLand's `dir`)
  if (ship.avoid.dir) {
    if (Math.abs(err) < 30 * DEG) ship.avoid.dir = 0;
    else if (Math.sign(err) !== ship.avoid.dir && Math.abs(err) > 90 * DEG) err -= Math.sign(err) * 2 * Math.PI;
  }
  const cmd = clamp(err / (4 * tau) + lead, -maxRate, maxRate);
  if (dt > 0) ship.yawRate += (cmd - ship.yawRate) * (1 - Math.exp(-dt / tau));
  ship.yawRate = clamp(ship.yawRate, -maxRate, maxRate);
  ship.yaw = wrapAngle(ship.yaw + ship.yawRate * dt);
  ship.turnNow = ship.yawRate;
  if (power > 0) {
    const wl = wl0;
    let best = ship.cls.speed * windFactor(offRunOf(ship.yaw, wind)) * windShare(wl) * ship.damage.wayShare();
    if (ship.hull === HULL.LargeGalley) best = Math.max(best, ship.cls.speed * OARS_FLOOR);
    const helmShare = maxRate > 0 ? Math.min(1, Math.abs(ship.yawRate) / maxRate) : 0;
    const target = best * ship.sails * (1 - TURN_SPEED_LOSS * helmShare) * (ship.aground > 0 ? AGROUND_WAY : 1);
    const heavy = ship.hull === HULL.Carrack || ship.hull === HULL.LargeGalley ? 0.5 : 1;
    ship.speed = ship.speed < target ? Math.min(target, ship.speed + ACCEL * heavy * dt) : Math.max(target, ship.speed - DECEL * dt);
  }
  ship.aground = Math.max(0, ship.aground - dt);
  // the heel: into the turn with her way, to leeward with the wind on her beam, on a spring
  const cross = (wind?.[0] ?? 0) * Math.cos(ship.yaw) - (wind?.[2] ?? 0) * Math.sin(ship.yaw);   // the wind across her, + blowing to starboard
  const want2 = clamp(-HEEL_TURN * ship.speed * (ship.yawRate / DEG) + HEEL_WIND * (cross / WIND_RATED) * ship.sails, -HEEL_MAX, HEEL_MAX);
  for (let t = dt; t > 1e-9;) {
    const h = Math.min(t, 0.05);
    ship.heelVel += (HEEL_OMEGA * HEEL_OMEGA * (want2 - ship.heel) - 2 * HEEL_ZETA * HEEL_OMEGA * ship.heelVel) * h;
    ship.heel += ship.heelVel * h;
    t -= h;
  }
}

/** The ship moves along its heading - unless her stem or a shoulder would stand on land: then she holds, losing her
 *  way, and the lookout sounds again at once. */
function moveShip(ship, dt, isWater) {
  const f = forwardOfYaw(ship.yaw);
  const step = ship.speed * dt;
  if (isWater && step > 0) {
    const b = hullBuild(ship.hull);
    const nx = ship.pos[0] + f[0] * step, nz = ship.pos[2] + f[2] * step;
    const r = [f[2], -f[0]];
    const sh = b.bowZ * 0.55, w = b.halfWidth;
    const clear = isWater(nx + f[0] * b.bowZ, nz + f[2] * b.bowZ)
      && isWater(nx + f[0] * sh + r[0] * w, nz + f[2] * sh + r[1] * w)
      && isWater(nx + f[0] * sh - r[0] * w, nz + f[2] * sh - r[1] * w);
    if (!clear) {
      ship.speed = Math.min(ship.speed, AGROUND_WAY * ship.cls.speed);
      ship.aground = AGROUND_S;
      ship.avoid.at = -Infinity;
      return;
    }
  }
  ship.pos[0] += f[0] * step;
  ship.pos[2] += f[2] * step;
}

/** A prize cast adrift goes where the wind takes her, slowly, and never onto the land. */
function drift(ship, dt, wind, isWater) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (wl < 1e-6) return;
  const s = ADRIFT_SPEED * dt / wl;
  const x = ship.pos[0] + wind[0] * s, z = ship.pos[2] + wind[2] * s;
  if (isWater(x, z)) { ship.pos[0] = x; ship.pos[2] = z; }
}

/** Past this many times its fighting range (or past its guns' reach) a captain closes on an intercept. */
export const CLOSE_FROM = 1.8;
/** A loaded broadside is presented once the enemy is inside this share of the guns' reach. */
export const PRESENT_WITHIN = 0.92;
/** A galley turns its bow on an enemy within this of the bow (degrees); further round it fights its broadside. */
export const BOW_SWING = 60;
/** A battery's reach from its deck: its gun's range at the carriage's highest (m); 0 for none, or a barrel. */
export function batteryReach(ship, side, seaY = 0) {
  const bat = batteryOf(ship.hull, side);
  if (!bat || bat.gun === 'barrel') return 0;
  const g = GUNS[bat.gun];
  return rangeAt(g.maxEl * DEG, g.speed, bat.muzzles[0][1] + (ship.pos[1] - seaY));
}
export const broadsideReach = (ship, seaY = 0) => batteryReach(ship, 'starboard', seaY);

/** The best way she makes on no particular point of sail - the intercept's own pace. */
const paceOf = (ship, wind) => ship.cls.speed * windShare(Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0)) * ship.damage.wayShare();

/**
 * The engagement course. Far off - past CLOSE_FROM ranges, or past the guns' reach - she steers to meet the enemy (a
 * true intercept on its smoothed way). A galley with her great guns loaded and the enemy within BOW_SWING of the bow
 * turns her stem on its lead. Else she shows the broadside that will bear SOONEST: each side's heading lays the
 * enemy's lead abeam, bent up to RANGE_BEND to keep her fighting range, and is weighed by the time to turn to it
 * against its reload, the wind's eye costing its degrees and a course onto the land never taken while another serves.
 * The side is weighed each NAV_EVERY_S; between, its heading follows the enemy.
 */
function engageCourse(ship, enemy, d, world, isWater) {
  const range = ship.cls.range;
  const reach = broadsideReach(ship, world.seaY);
  const vel = ship.tvel?.v ?? enemy.vel ?? [0, 0, 0];
  if (d > Math.max(range * CLOSE_FROM, reach)) {
    const i = intercept(ship.pos, paceOf(ship, world.wind), enemy.pos, vel);
    ship.present = null;
    return { want: i.heading, goal: i.point, sails: 1 };
  }
  const { bearing } = bearingTo(ship, enemy.pos);
  const my = velocityOf(ship);
  const rel = [vel[0] - my[0], 0, vel[2] - my[2]];
  // a galley fights over its stem: its great guns loaded, the enemy in their reach and within BOW_SWING of the bow,
  // it turns its bow on where its guns must be laid - the enemy's lead for their flight
  const bowReach = batteryReach(ship, 'bow', world.seaY);
  if (ship.cls.tactic === 'bow' && ship.guns.ready('bow') && d <= bowReach * PRESENT_WITHIN && Math.abs(bearing) <= BOW_SWING * DEG) {
    const bow = batteryOf(ship.hull, 'bow');
    const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bow.gun].speed);
    ship.present = null;
    return { want: headingTo(ship.pos, lead), goal: lead, sails: 1 };
  }
  // a loaded side in reach lays the lead dead abeam - to fire; one reloading bends off the beam to work the range, and
  // so does one loaded at point-blank (AUDIT NAV1, the guns: the hulls all but touching)
  const bendOf = (side) => (ship.guns.ready(side) && d <= reach * PRESENT_WITHIN && d >= range * POINT_BLANK ? 0 : clamp((d - range) / range, -1, 1) * RANGE_BEND * DEG);
  const headingFor = (side) => {
    const bat = batteryOf(ship.hull, side);
    const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bat.gun].speed);
    const sign = side === 'starboard' ? 1 : -1;
    return wrapAngle(headingTo(ship.pos, lead) - sign * (90 * DEG - bendOf(side)));
  };
  const sides = ['starboard', 'port'].filter((s) => { const b = batteryOf(ship.hull, s); return b && b.gun !== 'barrel'; });
  if (!sides.length) { ship.present = null; return { want: headingTo(ship.pos, enemy.pos), goal: enemy.pos, sails: 1 }; }
  if (!ship.present || ship.clock - ship.present.at >= NAV_EVERY_S || !sides.includes(ship.present.side)) {
    const rate = Math.max(maxTurnRate(ship), TURN_FLOOR * DEG);
    const l = lookout(ship);
    const cost = {};
    for (const side of sides) {
      const ideal = headingFor(side);
      const h = sailable(ship, ideal, world.wind);
      const turnS = Math.abs(wrapAngle(h - ship.yaw)) / rate;
      const off = Math.abs(wrapAngle(ideal - h)) / DEG;
      // AUDIT NAV1 (the guns): the wind holding the lead outside the fire's window - she would sail on unfired
      const bat = batteryOf(ship.hull, side);
      const noBear = off > fireWindow(ship, enemy, leadPoint(ship.pos, enemy.pos, rel, GUNS[bat.gun].speed), bat.gun, BEAR_DEG) ? NO_BEAR_S : 0;
      const foul = courseClear(ship.pos, h, l.near, isWater, { half: l.half, from: l.from }) ? 0 : 1e4;   // her turning circle's reach
      cost[side] = Math.max(turnS, ship.guns.left(side)) + off * BEAR_COST_S + noBear + foul;
    }
    const held = ship.present && sides.includes(ship.present.side) ? ship.present.side : null;
    let best = held ?? sides[0];
    for (const side of sides) if (cost[side] + (side === held ? 0 : held ? SIDE_HOLD_S : 0) < cost[best] + (best === held ? 0 : held ? SIDE_HOLD_S : 0)) best = side;
    ship.present = { side: best, at: ship.clock };
  }
  const side = ship.present.side;
  const ideal = headingFor(side);
  const want = sailable(ship, ideal, world.wind);
  const bat = batteryOf(ship.hull, side);
  const lead = leadPoint(ship.pos, enemy.pos, rel, GUNS[bat.gun].speed);
  // presented: loaded, in reach, on her heading - and a heading the wind lets lay the lead inside the fire's window
  const presented = ship.guns.ready(side) && d <= reach * PRESENT_WITHIN && Math.abs(wrapAngle(want - ship.yaw)) < 30 * DEG
    && Math.abs(wrapAngle(ideal - want)) / DEG <= fireWindow(ship, enemy, lead, bat.gun, BEAR_DEG);
  if (!presented) return { want, goal: null, sails: 1, sailable: true, track: true };
  // station: her way matched to the enemy's along her course, closing on the lead drawn ahead or astern of her beam
  const f = forwardOfYaw(ship.yaw);
  const pace = (vel[0] * f[0] + vel[2] * f[2]) + PRESENT_GAIN * ((lead[0] - ship.pos[0]) * f[0] + (lead[2] - ship.pos[2]) * f[2]);
  const best = Math.max(0.5, paceOf(ship, world.wind) * windFactor(offRunOf(ship.yaw, world.wind)));
  return { want, goal: null, sails: clamp(pace / best, PRESENT_SAILS, 1), sailable: true, track: true };
}

/**
 * Alongside to board: the berth on her lee side (chosen once), the two hulls' half beams and BERTH_GAP apart, steered
 * for through a point on her quarter that slides up to the berth as she closes - so she comes up parallel, not bows
 * on - her sail coming in as she nears it.
 */
function boardCourse(ship, enemy, wind) {
  const v = enemy.vel ?? [0, 0, 0];
  const eYaw = Number.isFinite(enemy.yaw) ? enemy.yaw : Math.hypot(v[0], v[2]) > 0.3 ? Math.atan2(v[0], v[2]) : ship.yaw;
  const f = forwardOfYaw(eYaw), r = [f[2], 0, -f[0]];
  // the side she comes up on: the one she is on when she means to board - her approach never crosses the boat
  if (!ship.berthSide) ship.berthSide = ((ship.pos[0] - enemy.pos[0]) * r[0] + (ship.pos[2] - enemy.pos[2]) * r[2]) >= 0 ? 1 : -1;
  const gap = hullBuild(ship.hull).halfWidth + hullBuild(enemy.hull ?? HULL.LargeBoat).halfWidth + BERTH_GAP;
  const berth = [enemy.pos[0] + r[0] * ship.berthSide * gap, 0, enemy.pos[2] + r[2] * ship.berthSide * gap];
  const d = Math.hypot(berth[0] - ship.pos[0], berth[2] - ship.pos[2]);
  // the pace that stops her BOARD_SAILS.from short of the berth, and the boat's own way on top
  const along = Math.max(0, v[0] * f[0] + v[2] * f[2]);
  const pace = Math.sqrt(2 * DECEL * Math.max(0, d - BOARD_SAILS.from)) + along;
  const best = Math.max(0.5, paceOf(ship, wind));
  const sails = clamp(pace / best, BOARD_SAILS.min, 1);
  if (d < 8) return { want: eYaw, goal: berth, sails };
  const lead = Math.min(60, d) * 0.8, ahead = Math.min(10, d / Math.max(1, ship.speed));
  const aim = [berth[0] - f[0] * lead + v[0] * ahead, 0, berth[2] - f[2] * lead + v[2] * ahead];
  return { want: headingTo(ship.pos, aim), goal: aim, sails };
}

/** The open water between two hulls on the flat (m): the widest gap along any of their four axes - 0 or less when
 *  they touch. Hulls off their builds; `hull` null is a Large Boat. */
export function hullGap(aPos, aYaw, aHull, bPos, bYaw, bHull) {
  const box = (pos, yaw, hull) => {
    const b = hullBuild(hull ?? HULL.LargeBoat), f = [Math.sin(yaw), Math.cos(yaw)], mid = (b.bowZ + b.aftZ) / 2;
    return { c: [pos[0] + f[0] * mid, pos[2] + f[1] * mid], f, r: [f[1], -f[0]], hl: (b.bowZ - b.aftZ) / 2, hw: b.halfWidth };
  };
  const A = box(aPos, aYaw, aHull), B = box(bPos, bYaw ?? 0, bHull);
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1]];
  let gap = -Infinity;
  for (const u of [A.f, A.r, B.f, B.r]) {
    const ra = A.hl * Math.abs(A.f[0] * u[0] + A.f[1] * u[1]) + A.hw * Math.abs(A.r[0] * u[0] + A.r[1] * u[1]);
    const rb = B.hl * Math.abs(B.f[0] * u[0] + B.f[1] * u[1]) + B.hw * Math.abs(B.r[0] * u[0] + B.r[1] * u[1]);
    gap = Math.max(gap, Math.abs(d[0] * u[0] + d[1] * u[1]) - ra - rb);
  }
  return gap;
}

/** Running: the fastest point of sail within FLEE_SPREAD of dead away from what she runs from. */
function fleeCourse(ship, from, wind) {
  const away = headingTo(from.pos, ship.pos);
  let best = away, bestV = -Infinity;
  for (let k = -FLEE_SPREAD; k <= FLEE_SPREAD; k += 15) {
    const h = wrapAngle(away + k * DEG);
    const v = windFactor(offRunOf(h, wind)) * Math.cos(k * DEG);
    if (v > bestV + 1e-9) { bestV = v; best = h; }
  }
  return { want: best, goal: null, sails: 1 };
}

/** A cruise: toward a waypoint - drawn from every quarter, never upwind of close-hauled (a galley rows there) nor across
 *  the land, a new one on arrival (and none kept once reached) - or a raider's own seeded course, where the host sets
 *  one (NAV-R). */
function cruiseCourse(ship, wind, isWater, r) {
  if (ship.course) return Math.atan2(ship.course[0] - ship.pos[0], ship.course[1] - ship.pos[2]);
  const wp = ship.waypoint;
  if (!wp || Math.hypot(wp[0] - ship.pos[0], wp[1] - ship.pos[2]) < WAYPOINT_REACHED || !isWater(wp[0], wp[1])) {
    ship.waypoint = null;
    for (let i = 0; i < WAYPOINT_TRIES; i++) {
      const a = r() * Math.PI * 2;
      const dist = WAYPOINT_DIST[0] + r() * (WAYPOINT_DIST[1] - WAYPOINT_DIST[0]);
      if (ship.hull !== HULL.LargeGalley && offRunOf(a, wind) > CLOSE_HAULED * DEG) continue;   // a galley rows to windward
      const p = [ship.pos[0] + Math.sin(a) * dist, ship.pos[2] + Math.cos(a) * dist];
      let clear = true;
      for (let s = WAYPOINT_SOUND; s < dist && clear; s += WAYPOINT_SOUND) clear = isWater(ship.pos[0] + Math.sin(a) * s, ship.pos[2] + Math.cos(a) * s);
      if (clear && isWater(p[0], p[1])) { ship.waypoint = p; break; }
    }
    // none found (a channel, a bight): back the way she came, as far as it is open
    if (!ship.waypoint) {
      const a = wrapAngle(ship.yaw + Math.PI);
      let s = 0;
      while (s + WAYPOINT_SOUND <= WAYPOINT_DIST[0] && isWater(ship.pos[0] + Math.sin(a) * (s + WAYPOINT_SOUND), ship.pos[2] + Math.cos(a) * (s + WAYPOINT_SOUND))) s += WAYPOINT_SOUND;
      if (s >= WAYPOINT_REACHED * 2) ship.waypoint = [ship.pos[0] + Math.sin(a) * s, ship.pos[2] + Math.cos(a) * s];
    }
  }
  if (!ship.waypoint) return ship.yaw;
  return Math.atan2(ship.waypoint[0] - ship.pos[0], ship.waypoint[1] - ship.pos[2]);
}

/**
 * The guns of one step. Each battery that bears is run out (RUN_OUT_S, the tell) and fires once it is out and its lay
 * passes near enough the enemy's LEAD - where it will be when the balls arrive, which is where the guns are laid (the
 * crew's error long or short by LAY_ERR at no skill) - at AIM_FREEBOARD of her hull, or through the middle of her rig
 * for chain shot. Never a lay that passes over her or falls short of her, never across a friend; barrels for a pursuer
 * close under the stern. `broadsides` false holds the broadsides (a pirate coming alongside keeps her prize whole).
 */
function gunnery(ship, world, enemy, out, { broadsides = true } = {}) {
  if (!enemy) { ship.runOut.clear(); return; }
  const { bearing, dist } = bearingTo(ship, enemy.pos);
  const deg = bearing / DEG;
  const pose = { position: ship.pos, rotation: quatOfYaw(ship.yaw), velocity: velocityOf(ship), hull: ship.hull };
  const skill = ship.cls.skill;
  const r = world.random ?? Math.random;
  const my = velocityOf(ship);
  const rel = [(enemy.vel?.[0] ?? 0) - my[0], 0, (enemy.vel?.[2] ?? 0) - my[2]];
  const build = hullBuild(enemy.hull ?? HULL.LargeBoat);
  const battery = (side, bearingWant, arc, bear) => {
    const bat = batteryOf(ship.hull, side);
    if (!bat || bat.gun === 'barrel' || (!broadsides && (side === 'starboard' || side === 'port'))) { ship.runOut.delete(side); return; }
    const g = GUNS[bat.gun];
    const lead = leadPoint(ship.pos, enemy.pos, rel, g.speed);
    const toLead = bearingTo(ship, lead);
    const err = Math.abs(wrapAngle(toLead.bearing - bearingWant * DEG)) / DEG;
    const loaded = ship.guns.ready(side);
    const reach = batteryReach(ship, side, world.seaY);
    const inReach = toLead.dist <= reach * 1.02;
    // the height the lay meets her at, and the band it must pass through to strike her there
    const rig = bat.gun === 'chain' && build.rig.length ? rigBand(build).map((y) => world.seaY + y) : null;
    const band = rig ?? [world.seaY, world.seaY + build.top];
    const aimY = rig ? (rig[0] + rig[1]) / 2 : world.seaY + build.top * AIM_FREEBOARD;
    const lay = (k) => aimSolution(pose, side, null, world.seaY, { target: [ship.pos[0] + (lead[0] - ship.pos[0]) * k, lead[1], ship.pos[2] + (lead[2] - ship.pos[2]) * k], targetY: aimY });
    const clear = !lineFoul(ship, bat, lead, enemy, world);
    const strikes = () => { const sol = lay(1); return !!sol && layPasses(sol, lead, band); };
    const window = fireWindow(ship, enemy, lead, bat.gun, bear);
    const since = ship.runOut.get(side);
    if (since == null) {
      if ((ship.runIn.get(side) ?? -Infinity) > ship.clock - RUN_IN_S) return;
      const soon = err <= window || bearsWithin(ship, lead, enemy, side === 'bow' ? 0 : bearingWant, window) <= RUN_OUT_S;
      if (loaded && toLead.dist <= reach * RUN_OUT_REACH && err <= arc && soon && clear && strikes()) { ship.runOut.set(side, ship.clock); out.runOuts.push(side); }
      return;
    }
    if (!loaded || !inReach || err > RUN_IN_DEG || !clear || ship.clock - since > RUN_OUT_S + RUN_OUT_WAIT_S) {
      ship.runOut.delete(side);
      ship.runIn.set(side, ship.clock);
      return;
    }
    if (ship.clock - since < RUN_OUT_S || err > window) return;
    if (!strikes()) return;
    // the crew's error: the lay long or short of the lead by up to LAY_ERR / 2 at no skill, none at the best
    const solution = lay(1 + (r() - 0.5) * LAY_ERR * (1 - skill));
    if (!solution) return;
    out.volleys.push({ side, solution });
    ship.guns.fired(side);
    ship.runOut.delete(side);
    ship.lastFire = world.now;
  };
  battery('starboard', 90, RUN_OUT_DEG, BEAR_DEG);
  battery('port', -90, RUN_OUT_DEG, BEAR_DEG);
  battery('bow', 0, BOW_RUN_OUT, BOW_BEAR);
  // a barrel for a pursuer close under the stern
  if (Math.abs(deg) > 160 && dist < 45 && ship.guns.ready('stern')) {
    const bat = batteryOf(ship.hull, 'stern');
    if (bat?.gun === 'barrel') {
      const solution = aimSolution(pose, 'stern', null, world.seaY);
      if (solution) { out.barrels.push(solution); ship.guns.fired('stern'); }
    }
  }
}

/**
 * The fire's window (degrees off a battery's line) for a volley at `at` (the lead): her half-extent across the line
 * of fire - her length times the sine of her heading against it, her half beam times its cosine (her heading unknown
 * and her way too slow to read it by: her mean profile) - times the crew's
 * share (FIRE_EXTENT_K, and FIRE_EXTENT_SKILL more at no skill), over the range; never inside the gun's own spread for
 * this crew, never past `bear`.
 */
export function fireWindow(ship, enemy, at, gun, bear) {
  const b = hullBuild(enemy.hull ?? HULL.LargeBoat);
  const los = Math.atan2(at[0] - ship.pos[0], at[2] - ship.pos[2]);
  const dist = Math.max(1, Math.hypot(at[0] - ship.pos[0], at[2] - ship.pos[2]));
  // her heading: her own, else her way's, else unknown - her mean profile over every heading (2/pi of each half)
  const v = enemy.vel ?? [0, 0, 0];
  const eyaw = Number.isFinite(enemy.yaw) ? enemy.yaw : Math.hypot(v[0], v[2]) > 0.3 ? Math.atan2(v[0], v[2]) : null;
  const halfLen = (b.bowZ - b.aftZ) / 2;
  const extent = eyaw == null ? (halfLen + b.halfWidth) * 2 / Math.PI : halfLen * Math.abs(Math.sin(eyaw - los)) + b.halfWidth * Math.abs(Math.cos(eyaw - los));
  const miss = extent * (FIRE_EXTENT_K + FIRE_EXTENT_SKILL * (1 - ship.cls.skill));
  const spread = (GUNS[gun]?.yawSpread ?? 1) * clamp(1.5 - ship.cls.skill, 0.4, 1.5);
  return Math.min(bear, Math.max(spread, Math.asin(Math.min(1, miss / dist)) / DEG));
}

/**
 * The seconds until the lead's bearing comes within `window` degrees of `want` (the battery's beam, degrees off the
 * bow): its rate is the lead's way across her line of sight (its smoothed way less hers, over the range) less her own
 * turn. 0 already in it, Infinity opening or standing.
 */
export function bearsWithin(ship, lead, enemy, want, window) {
  const dx = lead[0] - ship.pos[0], dz = lead[2] - ship.pos[2];
  const d2 = dx * dx + dz * dz;
  if (d2 < 1) return 0;
  const err = wrapAngle(Math.atan2(dx, dz) - ship.yaw - want * DEG) / DEG;
  if (Math.abs(err) <= window) return 0;
  const v = ship.tvel?.id === enemy.id ? ship.tvel.v : enemy.vel ?? [0, 0, 0];
  const my = velocityOf(ship);
  const rx = v[0] - my[0], rz = v[2] - my[2];
  // d(atan2(dx, dz))/dt = (dz rx - dx rz) / d2 - the world bearing's rate; less her own yaw rate
  const rate = ((dz * rx - dx * rz) / d2 - (ship.yawRate ?? 0)) / DEG;
  if (Math.sign(rate) === Math.sign(err) || Math.abs(rate) < 1e-6) return Infinity;   // opening, or standing
  return (Math.abs(err) - window) / Math.abs(rate);
}

/** A hull's rig as one band of height over the sea: its lowest box's floor to its highest's roof (m). */
export function rigBand(build) {
  let lo = Infinity, hi = -Infinity;
  for (const [mn, mx] of build.rig) { lo = Math.min(lo, mn[1]); hi = Math.max(hi, mx[1]); }
  return [lo, hi];
}

/**
 * Whether a lay's unscattered flight (the battery's middle gun) passes through the height band `band` (world heights)
 * where it comes abreast of `at` along the fire - neither over her (a carriage that cannot depress so far) nor into the
 * sea short of her.
 */
export function layPasses(solution, at, band) {
  const l = solution.launches[solution.launches.length >> 1];
  if (!l) return false;
  const along = l.v0[0] * solution.dir[0] + l.v0[2] * solution.dir[2];
  const x = (at[0] - l.p0[0]) * solution.dir[0] + (at[2] - l.p0[2]) * solution.dir[2];
  if (!(along > 1e-6) || !(x > 0)) return false;
  const t = x / along;
  const y = l.p0[1] + l.v0[1] * t - 0.5 * SHOT_GRAVITY * t * t;
  return y >= band[0] - 0.25 && y <= band[1];
}

/**
 * Whether a friend lies across a battery's line of fire: any contact she does not take for an enemy whose hull (its
 * flat box off its build, FRIEND_CLEAR grown) the line from her guns out past the lead crosses.
 */
export function lineFoul(ship, bat, lead, enemy, world) {
  const f = forwardOfYaw(ship.yaw), rr = [f[2], 0, -f[0]];
  const m = bat.muzzles[bat.muzzles.length >> 1];
  const a = [ship.pos[0] + rr[0] * m[0] + f[0] * m[2], 0, ship.pos[2] + rr[2] * m[0] + f[2] * m[2]];
  const len = Math.hypot(lead[0] - a[0], lead[2] - a[2]);
  if (len < 1e-6) return false;
  const over = hullLength(enemy.hull ?? HULL.LargeBoat) / 2;
  const b = [a[0] + (lead[0] - a[0]) / len * (len + over), 0, a[2] + (lead[2] - a[2]) / len * (len + over)];
  for (const c of world.contacts ?? []) {
    if (c.id === ship.id || c.id === enemy.id || c.gone || hostile(ship, c, world)) continue;
    const hb = hullBuild(c.hull ?? HULL.LargeBoat);
    const yaw = Number.isFinite(c.yaw) ? c.yaw : 0;
    const cf = [Math.sin(yaw), Math.cos(yaw)], cr = [cf[1], -cf[0]];
    const mid = (hb.bowZ + hb.aftZ) / 2;
    const cc = [c.pos[0] + cf[0] * mid, c.pos[2] + cf[1] * mid];
    const hl = (hb.bowZ - hb.aftZ) / 2 + FRIEND_CLEAR, hw = hb.halfWidth + FRIEND_CLEAR;
    // the segment in her box's frame, slab-tested
    const to = (p) => { const d = [p[0] - cc[0], p[2] - cc[1]]; return [d[0] * cr[0] + d[1] * cr[1], d[0] * cf[0] + d[1] * cf[1]]; };
    const pa = to(a), pb = to(b);
    let t0 = 0, t1 = 1, crosses = true;
    for (const [i, h] of [[0, hw], [1, hl]]) {
      const d = pb[i] - pa[i];
      if (Math.abs(d) < 1e-9) { if (Math.abs(pa[i]) > h) { crosses = false; break; } continue; }
      let u = (-h - pa[i]) / d, w = (h - pa[i]) / d;
      if (u > w) [u, w] = [w, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, w);
      if (t0 > t1) { crosses = false; break; }
    }
    if (crosses) return true;
  }
  return false;
}

/** What the wire says of a ship (NAV-G) and a save keeps of nothing - a sea ship lives in a room, not a save. */
export function shipWireState(ship) {
  return {
    id: ship.id, seed: ship.seed, cls: ship.cls.id, variant: ship.variant,
    pos: ship.pos, yaw: ship.yaw, speed: ship.speed, sails: ship.sails, heel: ship.heel,
    mode: ship.mode, damage: ship.damage.snapshot(),
  };
}
