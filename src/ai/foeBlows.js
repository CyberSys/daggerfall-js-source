// @ts-check
// TACT4 - TELEGRAPHED BLOWS (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Introducing new attack patterns
// and smaller telegraphed attacks (like our world boss) but not overdoing it"; his calls: one or two, tier-based -
// level 10 and up, or an elite foe).
//
// The world boss's language at a foe's scale: a short wind-up with its shape drawn on the ground where it will land,
// resolved by where the player's feet stand at the landing (net/gateStrike.js's law). Three shapes - the LUNGE (a short
// lane ahead), the SWEEP (a front cone), the SLAM (a disc just ahead) - one or two per family. A blow is the foe's own
// blow, delayed and shaped: at the landing the brain (ai/tactics.js) forces the swing, and the host's ordinary hit
// resolution asks `blowConnects` (the shape's verdict, in place of the reach test) and `blowScaled` (the shape's
// weight on DFU's own damage roll - armour, skill and all).
//
// Sparingly: a cooldown per foe, at most one wind-up near the player at a time, only from a foe holding a melee token
// in reach (TACT2), never against anyone but the local player. With the Enhanced AI switch off the brain never starts
// one, and both helpers answer the classic value.

import { MOBILE_TYPES } from '../characters/mobileTypes.js';

const M = MOBILE_TYPES;

/** The shapes, and every number they carry. Metres, seconds, damage multipliers on the foe's own blow. */
export const BLOW = Object.freeze({
  lunge: Object.freeze({ windup: 0.7, len: 4.5, halfW: 0.6, mult: 1.5 }),
  sweep: Object.freeze({ windup: 0.8, r: 3.2, halfArc: (65 * Math.PI) / 180, mult: 1.25 }),
  slam: Object.freeze({ windup: 0.9, r: 2.0, ahead: 1.0, mult: 1.75 }),
});
export const BLOW_TIER_LEVEL = 10;      // Mac: level 10 and up, or an elite
export const BLOW_COOLDOWN_MIN = 8;     // seconds between one foe's blows
export const BLOW_COOLDOWN_MAX = 15;
export const BLOW_CHANCE = 1 / 10;      // a classic tick in reach with a token: the roll to wind one up
export const BLOW_NEAR = 20;            // at most one wind-up from any foe within this of the player
export const BLOW_FLASH = 0.3;          // the landing's flash on the ground (seconds)
export const BLOW_VERDICT_LIFE = 2;     // a verdict the swing never spent (a knock, a death) goes stale

/** The families: which shapes a kind may throw (one or two). Not here: no telegraphed blow (the casters, the
 *  spectral, the small and the flying). */
const BEAST = ['lunge'];
const BRUTE = ['slam', 'sweep'];
const BLADE = ['sweep', 'lunge'];
const FAMILY = new Map([
  [M.GrizzlyBear, BEAST], [M.SabertoothTiger, BEAST], [M.Spider, BEAST], [M.Werewolf, BEAST], [M.Wereboar, BEAST],
  [M.GiantScorpion, BEAST], [M.Dragonling, BEAST], [M.Dragonling_Alternate, BEAST], [M.Centaur, BLADE],
  [M.Giant, BRUTE], [M.OrcWarlord, BRUTE], [M.Daedroth, BRUTE], [M.DaedraLord, BRUTE], [M.IronAtronach, BRUTE],
  [M.FleshAtronach, BRUTE], [M.Gargoyle, BRUTE], [M.Dreugh, BRUTE],
  [M.Orc, BLADE], [M.OrcSergeant, BLADE], [M.SkeletalWarrior, BLADE], [M.Mummy, BLADE], [M.Vampire, BLADE],
  [M.VampireAncient, BLADE], [M.FrostDaedra, BLADE], [M.FireDaedra, BLADE], [M.DaedraSeducer, BLADE], [M.Lamia, BLADE],
]);
const CASTERS = new Set([M.Mage, M.Sorcerer, M.Healer]);

/** The shapes this kind may throw ([] for none). */
export function blowShapesOf(mobileType) {
  if (FAMILY.has(mobileType)) return FAMILY.get(mobileType);
  if (mobileType >= 128 && mobileType !== M.None) return CASTERS.has(mobileType) ? [] : BLADE;   // the classes and the watch
  return [];
}
/** Is this body of the tier that telegraphs (Mac: level 10 and up, or an elite)? */
export function blowTier(entity) {
  if (!entity) return false;
  return (entity.level ?? 0) >= BLOW_TIER_LEVEL || entity.elite === true || entity.eliteFoe === true;
}
/** Does this foe telegraph at all? */
export const throwsBlows = (entity) => blowTier(entity) && blowShapesOf(entity.mobileType).length > 0;

/** A blow wound up at `origin` facing `yaw` (atan2(dx, dz)), at `now`. */
export function makeBlow(kind, origin, yaw, now, color = null) {
  const P = BLOW[kind];
  return { kind, origin: [origin[0], origin[1], origin[2]], yaw, start: now, land: now + P.windup, mult: P.mult, color };
}

/** Is the point (px, pz) inside the blow's shape? The verdict at the landing. */
export function inBlow(b, px, pz) {
  const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
  const rx = px - b.origin[0], rz = pz - b.origin[2];
  const along = rx * fx + rz * fz, across = -rx * fz + rz * fx;
  if (b.kind === 'lunge') { const P = BLOW.lunge; return along >= -0.3 && along <= P.len && Math.abs(across) <= P.halfW; }
  if (b.kind === 'sweep') {
    const P = BLOW.sweep, d = Math.hypot(rx, rz);
    if (d > P.r) return false;
    if (d < 0.5) return true;   // at its feet
    return Math.acos(Math.max(-1, Math.min(1, along / d))) <= P.halfArc;
  }
  if (b.kind === 'slam') { const P = BLOW.slam; return Math.hypot(along - P.ahead, across) <= P.r; }
  return false;
}

/** The ground's own question: how far through its wind-up (0..1), and the landing's flash (1 at the landing, 0 after
 *  BLOW_FLASH) - null once it is gone. */
export function blowPhase(b, now) {
  if (!b) return null;
  if (now < b.land) return { t: Math.max(0, (now - b.start) / (b.land - b.start)), flash: 0 };
  const after = now - b.land;
  if (after > BLOW_FLASH) return null;
  return { t: 1, flash: 1 - after / BLOW_FLASH };
}

/** The live blows, by foe: the brain winds them up, the ground draws them. */
const _live = new Map();
export function liveBlows() { return _live; }
export function setLiveBlow(ai, b) { if (b) _live.set(ai, b); else _live.delete(ai); }
/** Is any foe winding up within BLOW_NEAR of `feet`? (one at a time near the player) */
export function windupNear(feet, now, except = null) {
  for (const [ai, b] of _live) {
    if (ai === except || now >= b.land) continue;
    if (Math.hypot(b.origin[0] - feet[0], b.origin[2] - feet[2]) <= BLOW_NEAR) return true;
  }
  return false;
}
/** What the ground draws now: each live blow within `range` of `near` (the player's feet in the host's frame) with its
 *  phase; a blow past its flash is dropped from the registry here. */
export function drawableBlows(now, near = null, range = 40) {
  const out = [];
  for (const [ai, b] of _live) {
    const phase = blowPhase(b, now);
    if (!phase) { _live.delete(ai); continue; }
    if (near && Math.hypot(b.origin[0] - near[0], b.origin[2] - near[2]) > range) continue;
    out.push({ blow: b, phase });
  }
  return out;
}
/** Tests: forget every blow. */
export function resetBlows() { _live.clear(); }

/**
 * The host's hit resolution, asked in place of its reach test: a foe whose telegraphed blow just landed answers the
 * shape's verdict (the feet in it, or out of it - dodged), once; any other swing answers `classic`.
 */
export function blowConnects(ai, classic, now = null) {
  const v = ai?._blowVerdict;
  if (v == null) return classic;
  const fresh = now == null || ai._blowAt == null || now - ai._blowAt <= BLOW_VERDICT_LIFE;
  ai._blowVerdict = null;
  if (!fresh) { ai._blowMult = undefined; return classic; }
  if (!v) ai._blowMult = undefined;   // dodged: the weight is spent with it
  return v;
}
/** ...and its weight on the damage DFU rolled (spent once). */
export function blowScaled(ai, dmg) {
  const m = ai?._blowMult;
  if (m == null) return dmg;
  ai._blowMult = undefined;
  return dmg > 0 ? Math.max(1, Math.round(dmg * m)) : dmg;
}

/** The colour a blow is drawn in - the boss's weight, a foe's ember. */
export const BLOW_COLOR = Object.freeze([1.0, 0.42, 0.12]);
