// @ts-check
// NAV-C (2026-09-28, Mac: "introduce actual sailing ships to the world that players can encounter and pillage") -
// THE CAPTAINS: how a ship of the Iliac Bay sails, keeps off the rocks, and fights. The port's own; pure - the host
// hands the wind, a water test and what else is at sea, and gets the ship moved and its volleys back.
//
// A SHIP SAILS BY THE WIND. Its way is its class's best (navalShips.js) times the point of sail - the angle between
// its heading and where the wind blows TO: running before it most of its best, a broad reach all of it, close-hauled
// a third, head to wind in irons almost none (`windFactor`) - times what canvas it has left (navalDamage.js
// wayShare) and the wind's own strength. A galley rows: under oars it never makes less than OARS_FLOOR of its best,
// whatever the wind. It turns at its class's rate once it has steerage way, and heels into a turn.
//
// IT KEEPS OFF THE LAND. Before each turn of the helm it looks ahead - LOOKAHEAD_S of its way, never under
// LOOKAHEAD_MIN - down the course it wants and, when that is foul, down courses swung either side of it, the nearest
// clear one first; a ship boxed in comes about. `isWater(x, z)` is the host's word (the map's heights, the streamed
// ground where it is built).
//
// IT FIGHTS AS A SHIP OF THE LINE. A captain with an enemy in reach closes to its class's range, then turns to bring
// a LOADED broadside to bear - the enemy abeam - and circles there; too close, it opens the range; a broadside that
// bears within BEAR_DEG fires, laid for where the enemy will be when the balls arrive (the lead, iterated), with a
// range error its gun crew's skill shrinks. The chasers fire over the bow at an enemy dead ahead; barrels roll off
// the stern of a ship with one on its tail. A merchant runs from a threat and fires only what bears as it runs; a
// pirate short of hull runs too - a flagship never. A PIRATE CLOSES AND GRAPPLES a boat that is crippled or lying
// stopped (GRAPPLE_*): the boarding is the host's (NAV-D, Warm Ashes' raid).
//
// WHO FIGHTS WHOM. Pirates take anything; a navy takes pirates, and the player when their notoriety in its crown's
// waters has reached NAVY_HUNTS (NAV-D) or they have fired on it or on a lawful ship it saw; a merchant fights no
// one and fires back only at who fired on it. `hostile(a, b)` is that table; `provoke` records a blow.

import { classById, batteryOf, GUNS } from './navalShips.js';
import { createShipDamage, SHIP_STATES } from './navalDamage.js';
import { createGunDeck, aimSolution } from './navalGunnery.js';
import { NAVAL_DEG, rangeAt } from './navalBallistics.js';
import { wrapAngle } from '../../world/mat4.js';   // ONCRASH1: the port's one angle wrap, which cannot loop

/** A galley's oars: its least way, as a share of its best. */
export const OARS_FLOOR = 0.55;
/** How far ahead a helm looks: seconds of its way, and never less than this many metres. */
export const LOOKAHEAD_S = 22;
export const LOOKAHEAD_MIN = 70;
/** The swings a foul course is tried at, nearest first (degrees). */
export const AVOID_SWINGS = Object.freeze([25, -25, 50, -50, 80, -80, 115, -115, 150, -150, 180]);
/** A broadside bears within this of abeam; the chasers within BOW_BEAR of dead ahead (degrees). */
export const BEAR_DEG = 13;
export const BOW_BEAR = 11;
/** An enemy is engaged inside this (m); a threat is fled inside FLEE_RANGE. */
export const ENGAGE_RANGE = 750;
export const FLEE_RANGE = 320;
/** A pirate runs under this share of hull (a flagship never). */
export const PIRATE_RUNS_AT = 0.33;
/** A pirate grapples a boat within this (m) that is crippled (under GRAPPLE_HULL of hull) or has lain under
 *  GRAPPLE_STILL m/s for GRAPPLE_STILL_S - with at least GRAPPLE_CREW men to send. */
export const GRAPPLE_RANGE = 28;
export const GRAPPLE_HULL = 0.35;
export const GRAPPLE_STILL = 1.2;
export const GRAPPLE_STILL_S = 5;
export const GRAPPLE_CREW = 6;
/** A navy hunts a player whose notoriety in its crown has reached this (0..100, NAV-D). */
export const NAVY_HUNTS = 50;
/** The way a ship gains and loses (m/s^2), a heavy hull half as quick. */
export const ACCEL = 0.28;
export const DECEL = 0.45;
/** How long a blow keeps a ship provoked by who struck it (s). */
export const PROVOKED_S = 300;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const forwardOfYaw = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
/** The quaternion of a yaw about +y (the root's rotation). */
export const quatOfYaw = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

/**
 * The point of sail's share of a ship's best way: `offRun` the angle (radians, 0..PI) between its heading and where
 * the wind blows to - 0 running dead before it, PI head to wind.
 */
export function windFactor(offRun) {
  const d = Math.abs(offRun) / NAVAL_DEG;
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  if (d <= 40) return 0.85;
  if (d <= 100) return lerp(0.85, 1, (d - 40) / 60);
  if (d <= 135) return lerp(1, 0.7, (d - 100) / 35);
  if (d <= 150) return lerp(0.7, 0.35, (d - 135) / 15);
  return lerp(0.35, 0.08, (d - 150) / 30);
}

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
    mode: 'cruise', target: null, waypoint: null, damage,
    guns: createGunDeck(cls.hull, { crewed: true, crewShare: () => damage.crewShare() }),
    /** attacker id -> the time of its last blow */
    provoked: new Map(),
    stillFor: new Map(),
    boarded: false,
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

/**
 * Whether the course `yaw` is clear for `dist` metres from `pos` (three soundings along it and one either beam of
 * its end - a hull is wide).
 */
export function courseClear(pos, yaw, dist, isWater, beam = 10) {
  const f = forwardOfYaw(yaw), r = [f[2], 0, -f[0]];
  for (const k of [0.34, 0.67, 1]) {
    const x = pos[0] + f[0] * dist * k, z = pos[2] + f[2] * dist * k;
    if (!isWater(x, z)) return false;
  }
  const ex = pos[0] + f[0] * dist, ez = pos[2] + f[2] * dist;
  return isWater(ex + r[0] * beam, ez + r[2] * beam) && isWater(ex - r[0] * beam, ez - r[2] * beam);
}

/** The course nearest `want` that is clear (AVOID_SWINGS), or the reciprocal of the heading when none is. */
export function avoidLand(ship, want, isWater) {
  const dist = Math.max(LOOKAHEAD_MIN, ship.speed * LOOKAHEAD_S);
  if (courseClear(ship.pos, want, dist, isWater)) return want;
  for (const s of AVOID_SWINGS) {
    const y = wrapAngle(want + s * NAVAL_DEG);
    if (courseClear(ship.pos, y, dist, isWater)) return y;
  }
  return wrapAngle(ship.yaw + Math.PI);
}

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
 * One step of a captain. `world`:
 *   now, dt, seaY, wind (where the wind blows to, its length the strength), isWater(x, z),
 *   contacts: [{ id, kind: 'player'|'ship', faction?, pos, vel, speed, hullShare?, crippled?, ship? }],
 *   notoriety(crown) -> 0..100, random() -> [0, 1)
 * Answers `{ volleys: [{ side, solution }], barrels: [solution], grapple: contactId | null }`; the ship itself moved.
 */
export function stepCaptain(ship, world) {
  const out = { volleys: [], barrels: [], grapple: null };
  const dt = Math.max(0, world.dt);
  const st = ship.damage.state;
  ship.guns.step(dt);
  if (st === SHIP_STATES.sinking || st === SHIP_STATES.sunk) {
    ship.speed = Math.max(0, ship.speed - DECEL * dt);
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    moveShip(ship, dt, 0);
    return out;
  }
  if (st === SHIP_STATES.struck || st === SHIP_STATES.prize || ship.boarded) {
    ship.mode = st === SHIP_STATES.prize ? 'prize' : ship.boarded ? 'boarded' : 'struck';
    ship.sails = Math.max(0, ship.sails - dt * 0.5);
    ship.speed = Math.max(0, ship.speed - DECEL * 0.6 * dt);
    moveShip(ship, dt, 0);
    return out;
  }

  // who is out there, and who is an enemy
  let enemy = null, enemyD = Infinity, threat = null, threatD = Infinity;
  for (const c of world.contacts ?? []) {
    if (c.id === ship.id || c.gone) continue;
    const { dist } = bearingTo(ship, c.pos);
    if (hostile(ship, c, world)) {
      if (dist < ENGAGE_RANGE && dist < enemyD) { enemy = c; enemyD = dist; }
    }
    // a threat is anything hostile that would take US
    const theyTakeUs = c.kind === 'ship' ? c.ship && hostile(c.ship, { kind: 'ship', faction: ship.cls.faction, id: ship.id }, world) : ship.cls.faction !== 'pirate' && (ship.provoked.get(c.id) ?? -Infinity) > world.now - PROVOKED_S;
    if (theyTakeUs && dist < FLEE_RANGE && dist < threatD) { threat = c; threatD = dist; }
  }

  const runs = (ship.cls.faction === 'merchant' && (threat || enemy))
    || (ship.cls.faction === 'pirate' && !ship.cls.flagship && ship.damage.hullShare() < PIRATE_RUNS_AT && (threat || enemy));
  let want = ship.yaw;
  if (runs) {
    const from = threat ?? enemy;
    ship.mode = 'flee';
    const { bearing } = bearingTo(ship, from.pos);
    want = wrapAngle(ship.yaw + bearing + Math.PI);
    // never flee into the wind's eye: bear away to a reach
    const off = offRunOf(want, world.wind);
    if (off > 150 * NAVAL_DEG) want = wrapAngle(want + (bearing > 0 ? -1 : 1) * 60 * NAVAL_DEG);
    ship.target = from.id;
  } else if (enemy && ship.cls.faction !== 'merchant') {
    ship.mode = 'engage';
    ship.target = enemy.id;
    want = engageCourse(ship, enemy, enemyD, broadsideReach(ship, world.seaY), batteryReach(ship, 'bow', world.seaY));
  } else {
    ship.mode = 'cruise';
    ship.target = null;
    want = cruiseCourse(ship, world);
  }
  want = avoidLand(ship, want, world.isWater);

  // the helm and the way
  const off = offRunOf(ship.yaw, world.wind);
  const windLen = Math.hypot(world.wind?.[0] ?? 0, world.wind?.[2] ?? 0);
  const strength = clamp(0.55 + 0.3 * windLen, 0.4, 1.3);
  let best = ship.cls.speed * windFactor(off) * strength * ship.damage.wayShare();
  if (ship.hull === 3) best = Math.max(best, ship.cls.speed * OARS_FLOOR);
  const targetSpeed = best * ship.sails;
  const heavy = ship.hull === 4 || ship.hull === 3 ? 0.5 : 1;
  ship.speed = ship.speed < targetSpeed ? Math.min(targetSpeed, ship.speed + ACCEL * heavy * dt) : Math.max(targetSpeed, ship.speed - DECEL * dt);
  ship.sails = Math.min(1, ship.sails + dt * 0.4);
  const steer = ship.hull === 3 ? 0.8 : 0.3 + 0.7 * Math.min(1, ship.speed / 1.5);
  const rate = ship.cls.turn * NAVAL_DEG * steer;
  const err = wrapAngle(want - ship.yaw);
  const turn = clamp(err, -rate * dt, rate * dt);
  ship.turnNow = dt > 0 ? turn / dt : 0;
  ship.yaw = wrapAngle(ship.yaw + turn);
  moveShip(ship, dt, ship.turnNow / (rate || 1));

  // the guns
  if (!ship.guns.braced) gunnery(ship, world, enemy ?? (ship.cls.faction === 'merchant' ? threat : null), out);

  // the grapple: a pirate with men to send, alongside a crippled or stopped boat
  if (ship.cls.faction === 'pirate' && enemy && enemy.kind === 'player' && enemyD <= GRAPPLE_RANGE && ship.damage.crew >= GRAPPLE_CREW) {
    const still = (enemy.speed ?? 0) < GRAPPLE_STILL ? (ship.stillFor.get(enemy.id) ?? 0) + dt : 0;
    ship.stillFor.set(enemy.id, still);
    if (enemy.crippled || (enemy.hullShare ?? 1) < GRAPPLE_HULL || still >= GRAPPLE_STILL_S) out.grapple = enemy.id;
  }
  return out;
}

/** The angle between a heading and where the wind blows to (0 running, PI in irons). */
function offRunOf(yaw, wind) {
  const wl = Math.hypot(wind?.[0] ?? 0, wind?.[2] ?? 0);
  if (wl < 1e-6) return Math.PI / 2;
  return Math.abs(wrapAngle(yaw - Math.atan2(wind[0], wind[2])));
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
  return rangeAt(g.maxEl * NAVAL_DEG, g.speed, bat.muzzles[0][1] + (ship.pos[1] - seaY));
}
export const broadsideReach = (ship, seaY = 0) => batteryReach(ship, 'starboard', seaY);
/**
 * The engagement course. Far off - past CLOSE_FROM ranges, or past the guns' reach - it steers for where the enemy
 * WILL be (an intercept: the enemy's way for the time our own best way takes to close). Near, the enemy is held at a
 * BEARING rather than steered at: with a LOADED broadside and the enemy inside PRESENT_WITHIN of its reach, dead abeam
 * on that side - the broadside presented, to fire as it bears; reloading, drawn forward toward the bow as the range
 * opens (converging: 50 degrees of bearing for every range out, never inside 35) and aft as it closes (never past
 * 130), so the range is worked while the guns are served. The side shown is the side the enemy is on, unless that
 * battery's reload has longer to run than wearing round (180 degrees at the class's turn) and the other is loaded.
 */
function engageCourse(ship, enemy, d, reach, bowReach = 0) {
  const { bearing } = bearingTo(ship, enemy.pos);
  const range = ship.cls.range;
  const intercept = () => {
    const t = d / Math.max(1, ship.cls.speed);
    const p = [enemy.pos[0] + (enemy.vel?.[0] ?? 0) * t, 0, enemy.pos[2] + (enemy.vel?.[2] ?? 0) * t];
    return Math.atan2(p[0] - ship.pos[0], p[2] - ship.pos[2]);
  };
  if (d > Math.max(range * CLOSE_FROM, reach)) return intercept();
  // a galley fights over its stem: its great guns loaded, the enemy in their reach and within BOW_SWING of the bow,
  // it turns its bow on where its guns must be laid - the enemy's lead for their flight (further round, the
  // broadside is the quicker gun)
  if (ship.cls.tactic === 'bow' && ship.guns.ready('bow') && d <= bowReach * PRESENT_WITHIN && Math.abs(bearing) <= BOW_SWING * NAVAL_DEG) {
    const bow = batteryOf(ship.hull, 'bow');
    const my = velocityOf(ship);
    const lead = leadPoint(ship.pos, enemy.pos, [(enemy.vel?.[0] ?? 0) - my[0], 0, (enemy.vel?.[2] ?? 0) - my[2]], GUNS[bow.gun].speed);
    return Math.atan2(lead[0] - ship.pos[0], lead[2] - ship.pos[2]);
  }
  // the side to show: the one the enemy is on, unless it is reloading for longer than wearing round to the other
  // (loaded) side would take - a slow hull holds its engaged side and works the range while its guns are served
  const sideNow = bearing >= 0 ? 'starboard' : 'port';
  const other = sideNow === 'starboard' ? 'port' : 'starboard';
  const swing = 180 / Math.max(1, ship.cls.turn);
  const side = ship.guns.ready(sideNow) || ship.guns.left(sideNow) <= swing || !ship.guns.ready(other) ? sideNow : other;
  const sign = side === 'starboard' ? 1 : -1;
  const present = ship.guns.ready(side) && d <= reach * PRESENT_WITHIN;
  const wantDeg = present ? 90 : clamp(90 - ((d - range) / range) * 50, 35, 130);
  return wrapAngle(ship.yaw + bearing - wantDeg * NAVAL_DEG * sign);
}

/** A cruise: toward a far waypoint, a new one on arrival (the host may give merchants a port's). */
function cruiseCourse(ship, world) {
  const r = world.random ?? Math.random;
  const wp = ship.waypoint;
  if (!wp || Math.hypot(wp[0] - ship.pos[0], wp[1] - ship.pos[2]) < 120 || !world.isWater(wp[0], wp[1])) {
    for (let i = 0; i < 8; i++) {
      const a = ship.yaw + (r() - 0.5) * Math.PI * 1.4;
      const dist = 900 + r() * 1400;
      const p = [ship.pos[0] + Math.sin(a) * dist, ship.pos[2] + Math.cos(a) * dist];
      if (world.isWater(p[0], p[1])) { ship.waypoint = p; break; }
    }
  }
  if (!ship.waypoint) return ship.yaw;
  return Math.atan2(ship.waypoint[0] - ship.pos[0], ship.waypoint[1] - ship.pos[2]);
}

/** The ship moves along its heading; it heels into its turn (the visual lean the host draws). */
function moveShip(ship, dt, turnShare) {
  const f = forwardOfYaw(ship.yaw);
  ship.pos[0] += f[0] * ship.speed * dt;
  ship.pos[2] += f[2] * ship.speed * dt;
  const heelWant = clamp(-turnShare * 6, -12, 12);
  ship.heel += (heelWant - ship.heel) * Math.min(1, dt * 1.5);
}

/**
 * The guns of one step: a battery fires when the enemy's LEAD - where it will be when the balls arrive, which is
 * where the guns are laid - bears within its arc and its reach; barrels for a pursuer close under the stern.
 */
function gunnery(ship, world, enemy, out) {
  if (!enemy) return;
  const { bearing, dist } = bearingTo(ship, enemy.pos);
  const deg = bearing / NAVAL_DEG;
  const pose = { position: ship.pos, rotation: quatOfYaw(ship.yaw), velocity: velocityOf(ship), hull: ship.hull };
  const skill = ship.cls.skill;
  const r = world.random ?? Math.random;
  const my = velocityOf(ship);
  const rel = [(enemy.vel?.[0] ?? 0) - my[0], 0, (enemy.vel?.[2] ?? 0) - my[2]];
  const tryBattery = (side, bearingWant, tol) => {
    if (!ship.guns.ready(side)) return;
    const bat = batteryOf(ship.hull, side);
    if (!bat || bat.gun === 'barrel') return;
    const g = GUNS[bat.gun];
    const lead = leadPoint(ship.pos, enemy.pos, rel, g.speed);
    const toLead = bearingTo(ship, lead);
    if (Math.abs(wrapAngle(toLead.bearing - bearingWant * NAVAL_DEG)) / NAVAL_DEG > tol) return;
    const dy = (bat.muzzles[0]?.[1] ?? 2) + ship.pos[1] - world.seaY;
    if (toLead.dist > rangeAt(g.maxEl * NAVAL_DEG, g.speed, dy) * 1.02) return;
    // the crew's error: the lay long or short of the lead by up to 17.5% at no skill, none at the best
    const err = 1 + (r() - 0.5) * 0.35 * (1 - skill);
    const aimAt = [ship.pos[0] + (lead[0] - ship.pos[0]) * err, lead[1], ship.pos[2] + (lead[2] - ship.pos[2]) * err];
    const solution = aimSolution(pose, side, null, world.seaY, { target: aimAt });
    if (!solution) return;
    out.volleys.push({ side, solution });
    ship.guns.fired(side);
    ship.lastFire = world.now;
  };
  tryBattery('starboard', 90, BEAR_DEG);
  tryBattery('port', -90, BEAR_DEG);
  tryBattery('bow', 0, BOW_BEAR);
  // a barrel for a pursuer close under the stern
  if (Math.abs(deg) > 160 && dist < 45 && ship.guns.ready('stern')) {
    const bat = batteryOf(ship.hull, 'stern');
    if (bat?.gun === 'barrel') {
      const solution = aimSolution(pose, 'stern', null, world.seaY);
      if (solution) { out.barrels.push(solution); ship.guns.fired('stern'); }
    }
  }
}

/** What the wire says of a ship (NAV-G) and a save keeps of nothing - a sea ship lives in a room, not a save. */
export function shipWireState(ship) {
  return {
    id: ship.id, seed: ship.seed, cls: ship.cls.id, variant: ship.variant,
    pos: ship.pos, yaw: ship.yaw, speed: ship.speed, sails: ship.sails, heel: ship.heel,
    mode: ship.mode, damage: ship.damage.snapshot(),
  };
}
