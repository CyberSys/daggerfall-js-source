// @ts-check
// TACT2 - THE TACTICS BRAIN (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "enemy tactics like backing off and
// knowing when to strike"; "have enemies aware of each other"; his calls: 2 melee + 2 ranged attack tokens; animals
// and the cowardly human classes break and run, undead, daedra, constructs and guards never).
//
// A thin decision layer over the classic motor, read with the Enhanced AI switch on (this module is the switch's
// reader for it), and only while a foe SEES its target inside the engage range - out of sight, the motor's own pursuit
// (and the navmesh's, in a dungeon) finds the way. The motor still does the walking: the brain only says which way to
// step (`ai._tacDir`, at `ai._tacSpeed` of a walk, facing the target) and whether a blow may be struck
// (`ai._tacStrike`, `ai._tacShoot`). With the switch off every one of those stays unset and the motor is DFU's.
//
//   - TOKENS. At most TACT_MELEE_TOKENS foes hold a melee token on one target, TACT_RANGED_TOKENS a ranged one. A
//     holder walks in and strikes on DFU's own clock. The rest hold the RING - just outside reach - each on its own
//     angle (a slot), circling slowly, never swinging.
//   - THE STRIKE WINDOW. After its blow a holder backs out to the ring for a beat (RECOVER) and hands its token on:
//     the next to go in is the foe that has waited longest. A foe that has waited past its PATIENCE goes in whatever
//     the tokens say - nobody waits forever. A target whose back is turned on a waiting foe within reach is open: it
//     strikes.
//   - BACKING OFF. A foe that loses a share of its health in a short window backs out of reach and circles before it
//     comes back. A coward (an animal, a thief's kind of class) at low health runs (DFU's flee).
//   - KITING. A shooter with a ranged token backs away from a target closing inside its stand-off band.
//
// One registry of tokens, by target: the local player is one key, every other target its own object.

import { getPref } from '../systems/uiPrefs.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';

export const tacticsSwitchOn = () => getPref('enhancedAI') === true;

/** Every number on one table. Metres, seconds, shares. */
export const TACT = Object.freeze({
  MELEE_TOKENS: 2,
  RANGED_TOKENS: 2,
  ENGAGE_RANGE: 14,          // a foe further than this from its target is pursuing, not fighting: the motor's own
  SHOOT_RANGE: 51.2,         // ...a shooter's, DFU's own ranged band's far edge (MAX_RANGED_DISTANCE)
  RING_GAP: 1.5,             // the ring stands this far outside the foe's own reach
  RING_SLACK: 0.6,           // the ring's band either side
  CIRCLE_SPEED: 0.4,         // a waiting foe circles at this share of its walk
  STEP_SPEED: 0.7,           // backing out, stepping to the ring
  SLOT_TURN: 0.15,           // how far round the ring a waiting foe's slot drifts a second (radians)
  SWING: 0.7,                // a blow plays out where it was struck before the foe backs out
  RECOVER_MIN: 0.8,          // the beat after a blow, out to the ring (seconds)
  RECOVER_MAX: 1.6,
  PATIENCE: 6,               // a foe waiting this long goes in, tokens or not
  HURT_SHARE: 0.25,          // of its health lost inside HURT_WINDOW: it backs off
  HURT_WINDOW: 3,
  BACKOFF: 2,                // ...for this long
  FLEE_SHARE: 0.2,           // a coward below this share of its health runs
  FLEE_SECONDS: 8,
  KITE_RANGE: 5,             // a shooter backs off a target nearer than this
  BACK_TURNED_DEG: 110,      // the target's facing this far from the foe: its back is turned
  STALE: 1.5,                // a token holder unseen this long (despawned, unloaded) loses it
});

/** The cowardly human classes (Mac's call): the ones who live by not being hit. */
export const COWARD_CLASSES = Object.freeze(new Set(['Mage', 'Sorcerer', 'Healer', 'Bard', 'Burglar', 'Acrobat', 'Thief'].map((n) => MOBILE_TYPES[n])));
/** Does this kind break and run when badly hurt? Animals and the cowardly classes; undead, daedra, constructs and
 *  guards never (the watch is a Human-affinity class outside the list). */
export function isCoward(mobileId) {
  if (COWARD_CLASSES.has(mobileId)) return true;
  return ENEMY_BASICS[mobileId]?.affinity === 'Animal';
}

let clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
/** Tests: drive the brain's clock. */
export function setTacticsClock(fn) { clock = fn; }

/** @type {Map<any, { melee: Map<any, number>, ranged: Map<any, number>, waiting: Map<any, number> }>} */
const _boards = new Map();
/** The local player's facing, as its host last noted it (feet and a unit forward, xz) - for the back-turned test. */
let _me = null;
/** Each host, each frame: where the local player stands and faces. */
export function noteLocalPlayer(feet, fwd) {
  if (!feet || !fwd) { _me = null; return; }
  const l = Math.hypot(fwd[0], fwd[2]) || 1;
  _me = { feet: [feet[0], feet[1], feet[2]], fx: fwd[0] / l, fz: fwd[2] / l };
}
/** Tests: forget every board and the noted player. */
export function resetTactics() { _boards.clear(); _me = null; }

const LOCAL = Object.freeze({ local: true });
/** The board's key for an ai's target: the local player is one key; a peer by its owner; a foe by itself. */
export function targetKey(ai) {
  const t = ai._armedTargeting ? ai.target : null;
  if (!t || (t.isPlayer && !t.isPeer)) return LOCAL;
  return t.owner ?? t.peerId ?? t;
}
function board(key) {
  let b = _boards.get(key);
  if (!b) _boards.set(key, b = { melee: new Map(), ranged: new Map(), waiting: new Map() });
  return b;
}
/** Release every token and place `ai` holds (it died, despawned, lost its target, fled). */
export function releaseTactics(ai) {
  for (const b of _boards.values()) { b.melee.delete(ai); b.ranged.delete(ai); b.waiting.delete(ai); }
  if (ai._tac) ai._tac.key = null;
  ai._tacDir = null; ai._tacStrike = undefined; ai._tacShoot = undefined;
}
/** How many tokens of `kind` the target `key` has out (tests, probes). */
export function tokensOut(key, kind) { return _boards.get(key)?.[kind]?.size ?? 0; }
export const LOCAL_TARGET = LOCAL;

/** Is this foe a shooter (a bow, or a ranged spell it can cast)? */
const shooter = (ai) => !!ai.hasBowAttack || !!ai.canCastRangedSpell?.();

function prune(b, now) {
  for (const m of [b.melee, b.ranged, b.waiting]) for (const [a, seen] of m) if (now - (a._tac?.seen ?? -Infinity) > TACT.STALE || a._tac?.seen == null) m.delete(a);
}

/** Take a token of `kind` for `ai` if one is free - or, past its patience, whatever the count. */
function take(b, kind, ai, now, cap) {
  const m = b[kind];
  if (m.has(ai)) return true;
  const waited = now - (b.waiting.get(ai) ?? now);
  if (m.size < cap) {
    // the longest waiter goes first: a free token is not taken over the head of one who has waited longer
    let longest = ai, best = waited;
    for (const [other, since] of b.waiting) {
      if (other === ai || m.has(other) || other._tac?.kind !== kind) continue;
      if (now - since > best + 1e-9) { best = now - since; longest = other; }
    }
    if (longest !== ai) return false;
  } else if (!(waited >= TACT.PATIENCE)) return false;
  m.set(ai, now);
  b.waiting.delete(ai);
  return true;
}

/**
 * The brain's turn, from the motor's classic tick (EnemyAI._classicTick, after the ranged stand-off). Answers true
 * when it took the step's decision (the motor returns), false to leave it to the classic ladder. `tx, tz` the
 * horizontal way to the target (the destination's).
 */
export function tacticsStep(ai, dx, dz) {
  ai._tacDir = null;
  ai._tacSpeed = 1;
  if (!tacticsSwitchOn()) { if (ai._tac) releaseTactics(ai); ai._tac = null; ai._tacStrike = undefined; ai._tacShoot = undefined; return false; }
  const now = clock();
  const s = ai._tac ?? (ai._tac = { key: null, kind: 'melee', state: 'wait', until: 0, slot: Math.random() * Math.PI * 2, hp: [], fled: false, seen: now, swung: 0 });
  s.seen = now;
  const dist = ai._dist;
  const fighting = ai.inSight && ai.detected && Number.isFinite(dist) && dist <= (shooter(ai) ? TACT.SHOOT_RANGE : TACT.ENGAGE_RANGE) && !ai.follow;
  const key = fighting ? targetKey(ai) : null;
  if (s.key !== key) { releaseTactics(ai); s.key = key; s.state = 'wait'; }
  ai._tacStrike = undefined; ai._tacShoot = undefined;
  if (!fighting) return false;
  const b = board(key);
  prune(b, now);
  s.kind = shooter(ai) && dist > TACT.KITE_RANGE * 0.5 ? 'ranged' : 'melee';
  if (!b.waiting.has(ai) && !b.melee.has(ai) && !b.ranged.has(ai)) b.waiting.set(ai, now);

  // health: the window's losses, and the coward's run
  const v = ai.vitals?.();
  if (v && v.maxHealth > 0) {
    s.hp.push([now, v.health]);
    while (s.hp.length && now - s.hp[0][0] > TACT.HURT_WINDOW) s.hp.shift();
    const share = v.health / v.maxHealth;
    if (!s.fled && share < TACT.FLEE_SHARE && isCoward(v.mobileType) && ai.predictedTargetPos) {
      s.fled = true;
      const from = ai.predictedTargetPos;
      releaseTactics(ai);
      ai._tac = s; s.key = null;
      ai.flee(from, TACT.FLEE_SECONDS);
      return true;
    }
    if (s.hp.length > 1 && (s.hp[0][1] - v.health) / v.maxHealth >= TACT.HURT_SHARE && s.state !== 'backoff') {
      s.state = 'backoff'; s.until = now + TACT.BACKOFF; s.hp.length = 0;
      b.melee.delete(ai); b.ranged.delete(ai); b.waiting.set(ai, now);
    }
  }

  // its own blow landed: out to the ring, the token handed on
  const swung = ai._tacSwung ?? 0;
  if (swung !== s.swung) {
    s.swung = swung;
    if (s.state === 'engage') { s.state = 'swing'; s.until = now + TACT.SWING; }   // the blow plays out where it was struck
  }
  if (s.state === 'swing' && now >= s.until) {
    s.state = 'recover'; s.until = now + TACT.RECOVER_MIN + Math.random() * (TACT.RECOVER_MAX - TACT.RECOVER_MIN);
    b.melee.delete(ai); b.waiting.set(ai, now);
  }
  if ((s.state === 'recover' || s.state === 'backoff') && now >= s.until) s.state = 'wait';

  const reach = ai.stopDistance ?? 2.25;
  const ring = reach + TACT.RING_GAP;
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l, uz = dz / l;   // to the target
  const face = () => { ai.yaw = turnToward(ai.yaw, dx, dz); };

  // a shooter: the token gates its shot; with one, it kites a closing target
  if (s.kind === 'ranged') {
    const has = take(b, 'ranged', ai, now, TACT.RANGED_TOKENS);
    ai._tacShoot = has;
    if (has && dist < TACT.KITE_RANGE) {
      ai._tacDir = [-ux, -uz]; ai._tacSpeed = TACT.STEP_SPEED; ai.moving = true; face();
      return true;
    }
    if (has) return false;   // the classic stand-off and shot
    return holdRing(ai, s, b, ux, uz, dist, ring + 2, now, face);
  }

  // melee
  const backTurned = key === LOCAL && _me && backTurnedOn(ai);
  if (s.state === 'wait' && (take(b, 'melee', ai, now, TACT.MELEE_TOKENS) || (backTurned && dist <= ring + TACT.RING_SLACK))) {
    s.state = 'engage';
  }
  if (s.state === 'engage' && !b.melee.has(ai) && !backTurned) s.state = 'wait';
  if (s.state === 'engage') { ai._tacStrike = true; return false; }   // the classic walk in and swing
  if (s.state === 'swing') { ai._tacStrike = false; ai.moving = false; face(); return true; }   // stands its blow
  ai._tacStrike = false;
  if (s.state === 'recover' || s.state === 'backoff') {
    const out = s.state === 'backoff' ? ring + 1.5 : ring;
    if (dist < out - TACT.RING_SLACK) { ai._tacDir = [-ux, -uz]; ai._tacSpeed = TACT.STEP_SPEED; ai.moving = true; face(); return true; }
  }
  return holdRing(ai, s, b, ux, uz, dist, ring, now, face);
}

/** Hold the ring: step in or out to it, else circle round toward the foe's own slot. */
function holdRing(ai, s, b, ux, uz, dist, ring, now, face) {
  face();
  if (dist > ring + TACT.RING_SLACK) return false;   // the classic advance brings it to the ring
  if (dist < ring - TACT.RING_SLACK) { ai._tacDir = [-ux, -uz]; ai._tacSpeed = TACT.STEP_SPEED; ai.moving = true; return true; }
  // round the ring toward the slot: the angle of this foe about the target against its slot
  s.slot += TACT.SLOT_TURN * 0.0625;
  const here = Math.atan2(-ux, -uz);
  let d = s.slot - here;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) < 0.2) { ai.moving = false; return true; }
  const side = d > 0 ? 1 : -1;   // tangent: (-uz, ux) turns the bearing positive
  ai._tacDir = [side * -uz, side * ux];   // d(sin t, cos t)/dt = (cos t, -sin t) = (-uz, ux) at t = here
  ai._tacSpeed = TACT.CIRCLE_SPEED;
  ai.moving = true;
  return true;
}

function backTurnedOn(ai) {
  const vx = ai.feet[0] - _me.feet[0], vz = ai.feet[2] - _me.feet[2];
  const l = Math.hypot(vx, vz) || 1;
  const dot = (vx / l) * _me.fx + (vz / l) * _me.fz;
  return dot < Math.cos(TACT.BACK_TURNED_DEG * Math.PI / 180);
}

function turnToward(yaw, dx, dz) {
  const want = Math.atan2(dx, dz);
  let d = want - yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const step = 0.35;   // radians a classic tick - quicker than the walk's turn, a fighter squaring up
  return yaw + Math.max(-step, Math.min(step, d));
}
