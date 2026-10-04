// @ts-check
// SERPENT1 (2026-10-04, Mac: "a new world event that requires players with a ship to meet up and take on a large scale
// sea serpent in the ocean"; "make this something truly special"): THE SERPENT'S BRAIN - the whole of what the relay runs
// for Sethrakul's fight, as pure law: its health and who brought it, how it swims, what it does to the ships about it,
// and what a blow on it is worth. Design: bible/11-Multiplayer/Sea-Serpent.md sections 4-7.
//
// THE GATE'S LAW AT SEA (net/gateBrain.js - Option B: the relay's Durable Object is the authority over a world boss).
// The gate could run on the relay because its boss stands on a disc with nothing to path round; the serpent can because
// the sea is the same - open water with nothing in it but the ships, and the ships are their players' poses, which the
// relay already holds. Its whole world is a body (net/serpentBody.js - a few legs of path, the way it rides the sea), a
// health bar, a clock and the poses about it. THE FIGHT LIVES IN THE CELL ROOM ITS SITE STANDS IN (server/src/index.js),
// whichever socket of a player's reaches it - its own cell's or a halo's (RAID3's law).
//
// THE SHIPS' LAW. A blow on it is a ball (or a fire barrel) the striker's own machine flew and saw strike one of its
// segments (scenes/navalHost.js - the shots' targets); the number is the gun's own, and the relay's caps decide what
// lands. What a player BRINGS is their ship: each fighter's claim of the hull they sail (`hl`) sets both the health they
// bring the serpent and the damage they may deal (SHIP_REF - a reference broadside a second), so no claim buys a faster
// kill (the gate's law: the fastest possible is SERPENT_TTK_S / SERPENT_BUCKET_RATE_X of a full broadside whatever is claimed).
// A player aboard another's ship brings nothing and deals nothing with the guns - they earn their part by standing the
// fight out (SERPENT_STOOD_SHARE).
//
// ITS BLOWS ARE RESOLVED ON THE STRUCK PLAYER'S MACHINE (co-op's law, and the sea's victim's law - navalHost.js landHit):
// every attack's shape and moment is said here, and each client tests its own boat and its own feet against it
// (systems/serpentStrike.js). The relay never learns a ship's hurts.
//
// PURE. No clock of its own (every function takes `now`), no randomness of its own (an `rng` is handed in), no I/O - the
// relay owns the sockets, the alarm that steps this, the storage that checkpoints it, and the receipts.
//
// Not a DFU member. Ledger A (SERPENT1).
import {
  LEG, MODE, legFrom, headAt, legAt, bodyAt, headExposed, nearestExposed, spinePoint, coilWeight, supersede,
  BODY_LEN, LEGS_KEPT, MODES_KEPT, SEG_N, SEG_LEN, COIL_R, SWIM_MIN_V, MODE_BLEND_MS,
} from './serpentBody.js';

// ── the waters ─────────────────────────────────────────────────────────
/** The serpent's head keeps within this of its site (m) - its waters, the ring the storm closes round at the seal. */
export const ARENA_R = 420;
/** A player within this of the site is AT the fight - chosen, struck at, standing their time (m). */
export const ENGAGE_R = 900;
/** An `in` is heard from a pose within this of the site (m): a ship sighting it from its waters' edge. */
export const ADMIT_R = 1500;
/** The relay says the fight to every socket within this of the site (m) - a watcher on a headland sees it too. */
export const FAN_R = 3000;
/** How far a gun reaches - the farthest a ball flies from a deck (navalShips.js: the heavy guns' 263 m), and slack -
 *  and the pose's own slack: a pose is the player at the helm, aft, and a broadside lies along the hull and up to a
 *  fifth of a second stale (m). */
export const GUN_REACH_M = 300;
export const SERPENT_POSE_SLACK = 45;

// ── the swim ───────────────────────────────────────────────────────────
/** Its speeds, m/s: cruising, under the sea, the ram's wind-up and its run, reared, adrift. */
export const CRUISE_V = 11;
export const DEEP_V = 14;
export const RAM_WIND_V = 6;
export const RAM_V = 34;
export const REAR_V = 4;
export const DRIFT_V = 3;
/** How tight it turns (m), the ring it circles a ship at (m) and how far ahead on it it aims (radians), the ring it
 *  circles the maelstrom's eye at (m). */
export const TURN_R = 60;
export const ORBIT_R = 120;
export const ORBIT_LEAD = 0.55;
export const MAEL_ORBIT_R = 85;
/** The ring it circles its waters' heart on as it first surfaces (m). */
export const RISE_RING = 160;
/** The steering: a turn is begun past STEER_TURN of error, a straight run within STEER_STRAIGHT (radians); no leg is
 *  cut shorter than LEG_MIN_MS unless an attack begins one. */
export const STEER_TURN = 0.35;
export const STEER_STRAIGHT = 0.12;
export const LEG_MIN_MS = 900;
/** A woken fight whose head has swum past its waters by this much (m) - a room that slept with nobody in it - surfaces
 *  again inside them. */
export const STRAY_M = 200;
/** AUDIT SERPENT E1: the serpent goes only at what it can reach - a body within this of its waters' heart (m); its head
 *  is aimed within ARENA_R and orbits its mark at ORBIT_R. */
export const SERPENT_TARGET_R = 600;

// ── the clock of the fight ─────────────────────────────────────────────
export const SERPENT_TICK_MS = 250;
export const SERPENT_HP_SEND_MS = 250;
export const SERPENT_STATE_SEND_MS = 5000;
export const SERPENT_CHECKPOINT_MS = 2000;
export const SERPENT_STEP_MAX_MS = 1000;
/** AUDIT SERPENT S9: a fight read back from its checkpoint after a wake - its attack numbers go on PAST any it may have
 *  said since (a checkpoint is at most CHECKPOINT_MS old, and no attack is shorter than a second), so no client takes a
 *  new attack or coil for one it already lived through. */
export const SERPENT_WAKE_SEQ = 50;
export function serpentWoke(f) { f.seq = (Number.isSafeInteger(f.seq) ? f.seq : 0) + SERPENT_WAKE_SEQ; return f; }
/** It surfaces and circles this long after the fight is born before it strikes - time to see it. */
export const SERPENT_OPENING_MS = 10_000;
/** A target is kept this long before it looks again. */
export const SERPENT_TARGET_HOLD_MS = 8000;
/** After an attack's recovery, this long before the next is chosen. */
export const SERPENT_BREATH_MS = 900;
/** No attack more than SERPENT_REPEAT_MAX times running (gateBrain.js WB13f's law). */
export const SERPENT_REPEAT_MAX = 2;
/** The most accounts one fight remembers - its checkpoint's bound. */
export const SERPENT_FIGHTERS_MAX = 128;

// ── the numbers a claim sets ───────────────────────────────────────────
export const SERPENT_LV_MIN = 1;
export const SERPENT_LV_MAX = 60;
export const clampSerpentLv = (lv) => Math.max(SERPENT_LV_MIN, Math.min(SERPENT_LV_MAX, Number.isFinite(lv) ? Math.floor(lv) : SERPENT_LV_MIN));
/** The hulls (navalShips.js HULL - pinned equal): -1 is aboard no ship of one's own. */
export const HULLS = 5;
export const clampHull = (hl) => (Number.isInteger(hl) && hl >= 0 && hl < HULLS ? hl : -1);
/** A REFERENCE BROADSIDE A SECOND by hull - a battery's hull points over its reload, both sides and the chasers taken
 *  in turn (navalShips.js GUNS and HULL_BUILDS): the rowboat none, the Large Boat's swivels, the Small Ship's and the
 *  Carrack's long guns and chasers, the galley's long guns and great guns. */
export const SHIP_REF = Object.freeze([0, 3.6, 10, 13, 12]);   // AUDIT SERPENT T6: the Large Boat has no crew to its guns (reload x1.4) - 5 overstated what she can deal by two fifths
export const refOf = (hl) => SHIP_REF[clampHull(hl)] ?? 0;
/** Seconds of reference broadside the health a ship brings stands for. */
export const SERPENT_TTK_S = 180;
/** A fighter's damage bucket: refilled at SERPENT_BUCKET_RATE_X their reference a second, SERPENT_BUCKET_DEPTH_X deep (a broadside's
 *  whole weight on the head lands), no one blow over SERPENT_HIT_CAP_X of it. */
export const SERPENT_BUCKET_RATE_X = 1.5;   // AUDIT SERPENT T5: honest fire measures 0.25-0.4 of the reference; 3 gave a forged claim a 12-20x ceiling
export const SERPENT_BUCKET_DEPTH_X = 20;
export const SERPENT_HIT_CAP_X = 14;
/** The words of blows an account says a second (its machine gathers a volley's balls into one). */
export const SERPENT_HIT_HZ_MAX = 6;
/** The weak place: a ball on the head while it is thrown up lands this many times, and a stunned serpent takes every
 *  blow this much heavier. */
export const HEAD_X = 2;
export const STUN_X = 1.5;
/** Where a blow struck: the body, the head, a coil about a ship. */
export const ZONES = Object.freeze({ body: 0, head: 1, coil: 2 });

// ── phases ─────────────────────────────────────────────────────────────
/** The health fractions it changes phase at, and the ward it stands under as it does. */
export const SERPENT_PHASE_AT = Object.freeze([0.66, 0.33]);
export const SERPENT_SHIELD_MS = 4000;
export const SERPENT_PHASE_NAMES = Object.freeze(['The Hunt', 'The Coil', 'The Maelstrom']);

// ── the attacks ────────────────────────────────────────────────────────
// `shape` is what the sea shows and what a struck player's machine tests its boat and feet against (systems/
// serpentStrike.js):
//   sector - from `tg[0]`, `r` long, `arc` degrees wide about the facing `yw` (the tail's sweep)
//   lane   - from `tg[0]` to `tg[1]`, `width` wide; the head runs it over `active`
//   disc   - `r` about `tg[0]`
//   ring   - `r` about `tg[0]` - the ship inside it at the landing is coiled; one that sailed out of it is not
//   rings  - between `r0` and `r1` about `tg[0]` (the roar - safe close in under its jaws)
//   none   - nothing struck (a phase's cry, the maelstrom's forming)
// A SHIP struck takes `hull` of her whole hull and `base` more, `sail` of her canvas and `crew` men (TOUGHER-SHIPS: her
// whole is her refits'); `shove` (m/s) throws her off her way. AUDIT SERPENT T1 (2026-10-04, Mac chose the validated
// rebalance): every blow lighter - a ship it focused was wrecked in 36-80 s, and no fleet of eight won at the measured
// gunnery - the ram kept the heaviest, the one blow a helm can sail out of. `pool` is the venom
// the spit leaves on the water and the decks (players standing in it take `pct` of their health and `base` more a
// SERPENT_POOL_TICK_MS). `mode` how it holds itself through the wind-up. `phase` the first it comes in, `range` how near its
// head the target must be (m), `minGap` how far at least, `w` its weight in the choice.
/** The venom's bite on a standing player, each second, resolved on their machine. */
export const SERPENT_POOL_TICK_MS = 1000;
export const SERPENT_ATTACK_TABLE = Object.freeze({
  lash: Object.freeze({ id: 0, key: 'lash', name: 'Tail Lash', windup: 2600, active: 400, recover: 900, shape: 'sector', r: 85, arc: 120, hull: 0.06, base: 6, sail: 0.06, crew: 2, shove: 4, mode: MODE.cruise, phase: 1, range: 170, minGap: 0, w: 3 }),
  ram: Object.freeze({ id: 1, key: 'ram', name: 'Breaching Ram', windup: 3600, active: 4400, recover: 1800, shape: 'lane', width: 18, hull: 0.14, base: 12, sail: 0.05, crew: 3, shove: 9, mode: MODE.deep, phase: 1, range: 240, minGap: 60, w: 2 }),
  breach: Object.freeze({ id: 2, key: 'breach', name: 'Rising Maw', windup: 3200, active: 400, recover: 3000, shape: 'disc', r: 20, hull: 0.07, base: 8, sail: 0.1, crew: 2, shove: 6, mode: MODE.deep, phase: 1, range: 320, minGap: 0, w: 2 }),
  spit: Object.freeze({ id: 3, key: 'spit', name: 'Venom Spit', windup: 2600, active: 300, recover: 900, shape: 'disc', r: 13, hull: 0.015, base: 2, sail: 0, crew: 1, shove: 0, pool: Object.freeze({ r: 13, ms: 9000, pct: 0.02, base: 1 }), mode: MODE.breach, phase: 1, range: 260, minGap: 30, w: 2 }),
  coil: Object.freeze({ id: 4, key: 'coil', name: 'Constrict', windup: 4800, active: 0, recover: 600, shape: 'ring', r: 36, hull: 0, base: 0, sail: 0, crew: 0, shove: 0, mode: MODE.deep, phase: 2, range: 320, minGap: 0, w: 2 }),
  roar: Object.freeze({ id: 5, key: 'roar', name: 'Abyssal Roar', windup: 2800, active: 300, recover: 1600, shape: 'rings', r0: 22, r1: 120, hull: 0.05, base: 5, sail: 0.18, crew: 1, shove: 3, mode: MODE.rear, phase: 3, range: 150, minGap: 0, w: 2 }),
  cry: Object.freeze({ id: 6, key: 'cry', name: "Satakal's Call", windup: 2600, active: 0, recover: 400, shape: 'none', hull: 0, base: 0, sail: 0, crew: 0, shove: 0, mode: MODE.rear, phase: 99, range: 9999, minGap: 0, w: 0 }),
  mael: Object.freeze({ id: 7, key: 'mael', name: 'The Maelstrom', windup: 5000, active: 0, recover: 800, shape: 'none', hull: 0, base: 0, sail: 0, crew: 0, shove: 0, mode: MODE.deep, phase: 99, range: 9999, minGap: 0, w: 0 }),
});
/** The attacks by their wire id. */
export const SERPENT_ATTACK_BY_ID = Object.freeze(Object.values(SERPENT_ATTACK_TABLE).sort((a, b) => a.id - b.id));
/** The ones it chooses among (the cry and the maelstrom are its phases' turns). */
const CHOSEN = Object.freeze([SERPENT_ATTACK_TABLE.lash, SERPENT_ATTACK_TABLE.ram, SERPENT_ATTACK_TABLE.breach, SERPENT_ATTACK_TABLE.spit, SERPENT_ATTACK_TABLE.coil, SERPENT_ATTACK_TABLE.roar]);
/** THE TURN OF A PHASE: the Coil begins with Satakal's Call and a coil about the ship it hates most; the Maelstrom with
 *  the whirlpool forming at the waters' heart and the Abyssal Roar from its eye. */
export const SERPENT_PHASE_TURN = Object.freeze({
  2: Object.freeze(['cry', 'coil']),
  3: Object.freeze(['mael', 'roar']),
});
/** The ram's lane is as long as its run (m). */
export const ramLen = () => RAM_V * (SERPENT_ATTACK_TABLE.ram.active / 1000);
/** The spit's glob is in the air this long before it lands (ms) - its arc drawn from the jaws. */
export const SPIT_FLIGHT_MS = 900;
/** A breach's head is placed under its mark this long before it bursts out (ms) - the swim up from below. */
export const BREACH_LEAD_MS = 1200;

// ── the coil ───────────────────────────────────────────────────────────
/** How long a coil holds before it crushes the ship in it (ms); how long the coiled ship's word that she slipped it is
 *  heard (ms); its health - COIL_TEAM_S seconds of the fighters' reference broadsides between them, COIL_HP_MIN at the
 *  least - and the stun a broken coil leaves it in (ms). */
export const COIL_MS = 24_000;
export const COIL_ESC_MS = 3000;
export const COIL_TEAM_S = 4;   // AUDIT SERPENT T3: 6 seconds of every broadside about it held 35-40% of phases II and III, and no coil broke at the measured gunnery
export const COIL_HP_MIN = 60;
export const SERPENT_STUN_MS = 9000;
/** How far the coiled ship's word may move the coil's centre off her pose (m) - her hull's middle, not her helm. */
export const COIL_HELD_SLACK = 40;
/** AUDIT SERPENT S3: how early before its landing (the relay's clock) a coiled ship's word is kept for it (ms) - her clock
 *  is the relay's through the welcome's offset, which a frame's jitter may put a little ahead. */
export const COIL_WORD_EARLY_MS = 1000;
/** The crush and the coil's grip, on the coiled ship (her machine's): the crush at its end, the grip each second. */
export const CRUSH = Object.freeze({ hull: 0.25, base: 15, sail: 0.2, crew: 4, shove: 12 });   // AUDIT SERPENT T1: a full coil was 108-212% of any hull
export const GRIP = Object.freeze({ hull: 0.008, base: 1, crew: 0.15 });
/** AUDIT SERPENT T3: a blow on a coil holding a ship hurts the serpent too - this share of it off its own health (the
 *  fire a coil draws is never wasted, broken or not). */
export const SERPENT_COIL_PASS = 0.5;

// ── the maelstrom ──────────────────────────────────────────────────────
/** THE MAELSTROM - phase three's whirlpool at the waters' heart: how far it pulls (m), its eye (m), the pull at its rim
 *  and at the eye (m/s, toward the heart), its swirl (m/s about it), and what the eye grinds off a hull each second. */
export const MAEL_R = 230;
export const MAEL_EYE_R = 40;
export const MAEL_PULL = Object.freeze([1.0, 3.8]);   // AUDIT SERPENT T8: at [1.2, 5] a rowboat or a Large Boat in it never sailed out
export const MAEL_SWIRL = 4;
export const MAEL_GRIND = Object.freeze({ hull: 0.012, base: 1 });   // AUDIT SERPENT T1: the eye ground a carrack to a wreck in 31 s
/** In the Maelstrom it rears out of the whirl every MAEL_REAR_EVERY_MS for MAEL_REAR_MS - its head the prize. */
export const MAEL_REAR_EVERY_MS = 14_000;
export const MAEL_REAR_MS = 6000;

// ── the receipt ────────────────────────────────────────────────────────
/** Who earns a receipt: dealt this share of the health their own ship brought, or stood alive at the fight - within
 *  SERPENT_STAND_R of its body - this share of it (a hand aboard another's ship earns so). AUDIT SERPENT E1/E2 (Mac:
 *  "Must be in the fight"): 2% was one volley, and a boat parked at 900 m - where nothing of it reaches - stood. */
export const SERPENT_RECEIPT_SHARE = 0.1;
export const SERPENT_STOOD_SHARE = 0.5;
export const SERPENT_STAND_R = 450;
/** AUDIT SERPENT E2/E3: a ship whose guns have said nothing this long takes her share out of its health (back, at the
 *  fraction it stands at, with her next blow) - a claim never backed by fire no longer makes it tougher for everyone. */
export const SERPENT_IDLE_RETIRE_MS = 90_000;
/** A share leaves with its fighter (gateBrain.js AUDIT WBX R1): one away from the fight this long takes its share out
 *  of the health at the fraction it stands at. Longer than the gate's - a ship tacking back in is gone a while. */
export const SERPENT_ABSENT_RETIRE_MS = 45_000;
/** A real part in the fight - what keeps a seat in a full fight. */
export const SERPENT_SEAT_KEEP_MS = 45_000;
export const serpentHasPart = (p) => (p.share > 0 && p.dealt >= SERPENT_RECEIPT_SHARE * p.share) || p.stoodMs >= SERPENT_SEAT_KEEP_MS;
/** AUDIT SERPENT T2/E2/S8: does a fighter's share belong in its health now - not wrecked, not away from the fight past
 *  SERPENT_ABSENT_RETIRE_MS, and (a ship) not silent past SERPENT_IDLE_RETIRE_MS. */
export const serpentShareWanted = (p, now) => !p.wreck && now - (p.seenAt ?? p.joinedAt) <= SERPENT_ABSENT_RETIRE_MS && !(p.share > 0 && now - (p.hitAt ?? p.joinedAt) > SERPENT_IDLE_RETIRE_MS);
/** Threat: the share of aimed attacks at whoever dealt most lately, and how fast it forgets (a share a second). */
export const SERPENT_THREAT_PICK = 0.6;
export const SERPENT_THREAT_DECAY = 0.08;
/** The damage chart's rows at most. */
export const SERPENT_DAMAGE_CHART_MAX = 32;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** The nearest of the body's points to (x, z), metres - Infinity for none. */
const nearestPoint = (pts, x, z) => { let d = Infinity; for (const p of pts ?? []) d = Math.min(d, dist(p.x, p.z, x, z)); return d; };
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
/** An angle into [-PI, PI). */
export const serpentWrapYaw = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };
/** A leg as the fight keeps it and the wire says it - its numbers rounded, so the relay and every client hold the same
 *  bits and draw the same body. */
function roundLeg(L) {
  const o = { k: L.k, at: Math.round(L.at), x: r2(L.x), z: r2(L.z), yw: r4(serpentWrapYaw(L.yw)), v: r2(Math.max(SWIM_MIN_V, L.v)) };
  if (L.k === LEG.arc) { o.r = r2(L.r); o.sd = L.sd < 0 ? -1 : 1; }
  if (L.j) o.j = 1;
  return o;
}
/** A point kept within `r` of the site. */
export function keepIn(x, z, r = ARENA_R) {
  const d = Math.hypot(x, z);
  return d <= r ? [x, z] : [(x / d) * r, (z / d) * r];
}

/**
 * A fresh fight: nobody in it, the serpent surfacing at its waters' heart, no health until a ship brings some. `soundAt`
 * the day's sounding (net/serpentLaw.js serpentTimes), `sx`/`sz` the site's native point (the first `in`'s word), `yaw`
 * the way it first swims (serpentLaw.js serpentRiseYaw).
 */
export function newSerpentFight(day, now, soundAt, boss, sx, sz, yaw = 0) {
  // circling its waters' heart at RISE_RING: an arc turning right from a point on that ring (its centre lies to the
  // right of the start - serpentBody.js legAt)
  const start = { k: LEG.arc, at: now, x: -RISE_RING * Math.cos(yaw), z: RISE_RING * Math.sin(yaw), yw: yaw, v: CRUISE_V, r: RISE_RING, sd: 1, j: 1 };
  return {
    v: 1, day, boss, startedAt: now, soundAt, sx, sz,
    phase: 1, shieldUntil: 0, stunUntil: 0, hp: 0, max: 0,
    legs: [roundLeg(start)],
    modes: [{ at: now, m: MODE.deep }, { at: now + 1500, m: MODE.breach }, { at: now + 6500, m: MODE.cruise }],
    coil: null, mael: null,
    atk: null, lastA: -1, runA: 0, freeAt: 0, nextAt: now + SERPENT_OPENING_MS, openUntil: now + SERPENT_OPENING_MS, seq: 0, coils: 0,
    target: null, targetAt: 0, queue: [], pending: null, rearAt: 0,
    /** @type {Record<string, {name: string, lv: number, hl: number, ref: number, share: number, dealt: number, clipped: number, bucket: number, bucketAt: number, rate: number, rateAt: number, stoodMs: number, joinedAt: number, seenAt: number, retired: boolean, hits: number, best: number, cd: number, bq?: any, bqAt?: number}>} */
    players: {},
    liveMs: 0,
    /** @type {Record<string, number>} */
    threat: {},
    /** @type {{at: number, top: string[], n: number, dm?: any[]}|null} */
    fell: null,
    /** @type {{at: number}|null} */
    gone: null,
    lastHpAt: 0, lastHpSent: -1, lastStateAt: now, lastTickAt: now,
  };
}

/** The fraction it stands at (gateBrain.js serpentStandsAt - AUDIT WBX2 M2's law). */
export const serpentStandsAt = (f) => (f.max > 0 ? f.hp / f.max : Number.isFinite(f.idle) ? f.idle : 1);
function shareOut(f, share) {
  const frac = serpentStandsAt(f);
  f.max = Math.max(0, f.max - share);
  f.hp = f.max * frac;
  if (!(f.max > 0)) f.idle = frac;
}
export function retireSerpentShare(f, p) { if (p.retired) return; shareOut(f, p.share); p.retired = true; }
export function restoreSerpentShare(f, p) {
  if (!p.retired) return;   // AUDIT SERPENT T2: every caller asks serpentShareWanted first - a wreck's never comes back
  const frac = serpentStandsAt(f);
  f.max += p.share; f.hp += p.share * frac; p.retired = false;
}

/**
 * A player joins the fight, claiming hull `hl` (-1 aboard none of their own) and level `lv` (the spoils' level). A
 * newcomer brings SERPENT_TTK_S seconds of their hull's reference broadside as health - at the fraction it stands at
 * (a late ship never heals it), with an empty bucket after the first blood (AUDIT WB A8) - and only while `admits`
 * and the fight has room (a full one frees an idle seat: `present`). A player already in keeps their first LEVEL;
 * AUDIT SERPENT B4/H2: a later claim of a bigger hull (a captain who sighted it off her helm, or from her rowboat)
 * takes her old share out and brings the new one in at the fraction it stands at, its bucket empty - the late ship's
 * law, so it buys no faster kill. `near` (AUDIT SERPENT S8): the word was said from within ENGAGE_R - only then does it
 * count as being at the fight (a ship anchored 1400 m off keeps no share in it by saying `in`).
 * @returns {boolean}
 */
export function joinSerpentFight(f, sub, name, lv, hl, now, admits, present = null, near = true) {
  const known = f.players[sub];
  if (known) {
    if (typeof name === 'string' && name) known.name = name.slice(0, 24);
    if (f.fell || f.gone) return true;
    const hull = clampHull(hl), ref = refOf(hull);
    if (ref > known.ref) {
      if (!known.retired) shareOut(f, known.share);
      const share = SERPENT_TTK_S * ref, frac = serpentStandsAt(f);
      Object.assign(known, { hl: hull, ref, share, bucket: 0, bucketAt: now, hitAt: now, retired: !!known.wreck });
      if (!known.wreck) { f.max += share; f.hp += share * frac; }
    }
    if (near) { known.seenAt = now; if (serpentShareWanted(known, now)) restoreSerpentShare(f, known); }
    return true;
  }
  if (f.fell || f.gone || !admits) return false;
  if (Object.keys(f.players).length >= SERPENT_FIGHTERS_MAX && !freeSerpentSeat(f, present)) return false;
  const hull = clampHull(hl), ref = refOf(hull), share = SERPENT_TTK_S * ref, frac = serpentStandsAt(f);
  f.max += share;
  f.hp += share * frac;
  f.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: clampSerpentLv(lv), hl: hull, ref, share, dealt: 0, clipped: 0,
    bucket: frac >= 1 ? SERPENT_BUCKET_DEPTH_X * ref : 0, bucketAt: now, rate: SERPENT_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now,
    seenAt: now, hitAt: now, retired: false, wreck: false, hits: 0, best: 0, cd: 0,
  };
  return true;
}
/**
 * AUDIT SERPENT T2: a fighter's ship WRECKED (`w` 1) or afloat again (0) - her machine's word. A wreck's share leaves its
 * health and never comes back while she is one; it no longer goes at her; her stood time still counts.
 * @returns {boolean} whether anything changed
 */
export function serpentWreck(f, sub, w, now) {
  const p = f.players[sub];
  if (!p || f.fell || f.gone || p.share <= 0) return false;
  const wreck = !!w;
  if (wreck === !!p.wreck) return false;
  p.wreck = wreck;
  if (wreck) { retireSerpentShare(f, p); if (f.target === sub) f.target = null; }
  else { p.hitAt = now; if (serpentShareWanted(p, now)) restoreSerpentShare(f, p); }
  return true;
}
/** A full fight frees the seat of one who joined and left with no part in it (gateBrain.js AUDIT WB A1). */
export function freeSerpentSeat(f, present) {
  if (!present) return false;
  for (const [sub, p] of Object.entries(f.players)) {
    if (present.has(sub) || serpentHasPart(p)) continue;
    if (!p.retired) shareOut(f, p.share);
    delete f.players[sub]; delete f.threat[sub];
    if (f.target === sub) f.target = null;
    return true;
  }
  return false;
}

/** The blow rate's hand: one token a word (a word is one gathered volley). */
function spendBlow(p, now) {
  p.rate = Math.min(SERPENT_HIT_HZ_MAX, p.rate + (Math.max(0, now - p.rateAt) / 1000) * SERPENT_HIT_HZ_MAX);
  p.rateAt = now;
  if (!(p.rate >= 1)) return false;
  p.rate -= 1;
  return true;
}
/** The blow's purse: `d` capped a blow, by the bucket and by what is `left`; the clipping counted. */
function spendPurse(p, d, left, now) {
  const ref = p.ref;
  p.bucket = Math.min(SERPENT_BUCKET_DEPTH_X * ref, p.bucket + (Math.max(0, now - p.bucketAt) / 1000) * SERPENT_BUCKET_RATE_X * ref);
  p.bucketAt = now;
  const got = Math.max(0, Math.min(d, SERPENT_HIT_CAP_X * ref, p.bucket, left));
  p.bucket -= got;
  p.clipped += Math.max(0, d - got);
  p.dealt += got;
  return got;
}
/** Is a coil holding a ship now (wound on, not broken, crushed or slipped)? */
export const coilHolds = (f, now) => !!f.coil && !(f.coil.off > 0) && now >= f.coil.at;
/** Is it stunned now? */
export const stunned = (f, now) => now < (f.stunUntil ?? 0);

/**
 * A BLOW on it from `sub`, standing at `pose` ({x, z} - the site frame), claiming `d` points where `z` (ZONES) of it was
 * struck. Answers the frames to fan (a coil broken, the kill) - what landed is the fighter's own `dealt`. Refused: a
 * stranger, a fight over or past its sounding, its ward, past the blow rate, a pose away from the fight, nothing of it
 * above the sea, the body beyond a gun's reach. Clipped (and counted): past the one-blow cap, past the bucket.
 */
export function applySerpentHit(f, sub, d, z, pose, now) {
  const out = [];
  const p = f.players[sub];
  if (!p || f.fell || f.gone || !Number.isFinite(d) || !(d > 0) || now >= f.soundAt) return out;
  if (now < f.shieldUntil) return out;
  if (!spendBlow(p, now)) return out;
  if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z) || Math.hypot(pose.x, pose.z) > ENGAGE_R + SERPENT_POSE_SLACK) return out;
  const pts = bodyAt(f, now);
  const near = nearestExposed(pts, pose.x, pose.z);
  if (!near || near.d > GUN_REACH_M + SERPENT_POSE_SLACK) return out;
  // AUDIT SERPENT E2: her guns speak - a share retired for their silence comes back at the fraction it stands at
  p.hitAt = now;
  if (p.retired && serpentShareWanted(p, now)) restoreSerpentShare(f, p);
  const stun = stunned(f, now);
  if (z === ZONES.coil && coilHolds(f, now)) {
    const got = spendPurse(p, d * (stun ? STUN_X : 1), f.coil.h, now);
    p.cd += got;
    if (got > 0) { p.hits++; p.best = Math.max(p.best, got); f.threat[sub] = (f.threat[sub] ?? 0) + got; }
    f.coil.h -= got;
    // AUDIT SERPENT T3: the coil's fire is never wasted - SERPENT_COIL_PASS of it off its own health
    f.hp -= Math.min(f.hp, got * SERPENT_COIL_PASS);
    if (f.coil.h <= 1e-6) breakCoil(f, now, p.name, out);
    if (f.hp <= 1e-6 && f.max > 0) fall(f, now, out);
    return out;
  }
  const x = (z === ZONES.head && headExposed(f, pts, now, stun) ? HEAD_X : 1) * (stun ? STUN_X : 1);
  const got = spendPurse(p, d * x, f.hp, now);
  if (got > 0) { p.hits++; p.best = Math.max(p.best, got); f.threat[sub] = (f.threat[sub] ?? 0) + got; }
  f.hp -= got;
  if (f.hp <= 1e-6 && f.max > 0) fall(f, now, out);
  return out;
}

/** THE KILL: its health spent - its throes begun, everything in flight ended, every fighter's part ranked. */
function fall(f, now, out) {
  f.hp = 0;
  f.fell = { at: now, top: serpentTopDealers(f, 3), n: Object.keys(f.players).length, dm: serpentDamageChart(f) };
  f.atk = null; f.queue = []; f.pending = null;
  // AUDIT SERPENT S4/M1: a coil holding a ship lets her go, and says so - a dead serpent never grips
  if (coilHolds(f, now) || (f.coil && !(f.coil.off > 0))) { f.coil.off = now; f.coil.why = 'fell'; out.push({ k: 'cx', i: f.coil.i, at: now }); }
  // AUDIT SERPENT M2: its throes said, as every other turn of its body is
  pushMode(f, now, MODE.dying, out);
  pushLeg(f, legFrom(f.legs, now, LEG.line, DRIFT_V), out);
  out.push({ k: 'fell', at: now, top: f.fell.top, n: f.fell.n, dm: f.fell.dm });
}
/** THE SOUNDING: the day's end with it unslain - it dives and is gone. */
function sound(f, now, out) {
  f.gone = { at: f.soundAt };
  f.atk = null; f.queue = []; f.pending = null;
  if (coilHolds(f, now) || (f.coil && !(f.coil.off > 0))) { f.coil.off = now; f.coil.why = 'gone'; out.push({ k: 'cx', i: f.coil.i, at: now }); }
  pushMode(f, now, MODE.deep, out);
  pushLeg(f, legFrom(f.legs, now, LEG.line, DEEP_V), out);
  out.push({ k: 'gone', at: f.gone.at });
}

/** The names of the `k` who dealt the most, most first (ties by the earlier to join). */
export function serpentTopDealers(f, k) {
  return Object.values(f.players).filter((q) => q.dealt > 0).sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, k).map((q) => q.name);
}
/**
 * THE DAMAGE CHART, made at the kill (the gate's GATE-UX): every fighter with a part, most damage first, whole numbers -
 * `n` the name, `h` the hull they sailed (-1 aboard another's), `d` all they dealt, `c` the coils' share of it, `x` the
 * blows that landed, `b` the heaviest.
 */
export function serpentDamageChart(f) {
  return Object.values(f.players).filter((q) => q.dealt > 0 || q.stoodMs > 0)
    .sort((a, b) => b.dealt - a.dealt || a.joinedAt - b.joinedAt).slice(0, SERPENT_DAMAGE_CHART_MAX)
    .map((q) => ({ n: q.name, h: q.hl, d: Math.round(q.dealt), c: Math.min(Math.round(q.dealt), Math.round(q.cd ?? 0)), x: q.hits ?? 0, b: Math.round(q.best ?? 0) }));
}
/** Did `sub` earn a receipt? Only a slain serpent pays: dealt SERPENT_RECEIPT_SHARE of the health their ship brought, or stood
 *  alive within SERPENT_STAND_R of its body SERPENT_STOOD_SHARE of the fight. */
export function serpentEarned(f, sub) {
  const p = f.players[sub];
  if (!p || !f.fell) return false;
  const fight = Math.max(1, Number.isFinite(f.liveMs) ? f.liveMs : f.fell.at - f.startedAt);
  return (p.share > 0 && p.dealt >= SERPENT_RECEIPT_SHARE * p.share) || p.stoodMs >= SERPENT_STOOD_SHARE * fight;
}
/** How it was serpentEarned, for the receipt: 'dealt' first, else 'stood'. */
export const serpentEarnedBy = (f, sub) => { const p = f.players[sub]; return p && p.share > 0 && p.dealt >= SERPENT_RECEIPT_SHARE * p.share ? 'dealt' : 'stood'; };

/** Who it goes at: SERPENT_THREAT_PICK of the time the ship (or, with none at the fight, the body) with the most threat, else a
 *  random one. Ships first - a hand aboard another's ship stands where that ship does. AUDIT SERPENT E1/T2: only what it
 *  can reach (within SERPENT_TARGET_R of its waters), never a wreck; `shipOnly` (a coil - AUDIT SERPENT S10) no hand. */
export function pickSerpentTarget(f, bodies, rng, shipOnly = false) {
  const live = bodies.filter((b) => !b.dead && f.players[b.sub] && !f.players[b.sub].wreck && Math.hypot(b.x, b.z) <= SERPENT_TARGET_R);
  const ships = live.filter((b) => f.players[b.sub].hl >= 0);
  const pool = ships.length || shipOnly ? ships : live;
  if (!pool.length) return null;
  if (rng() < SERPENT_THREAT_PICK) {
    let best = null, t = 0;
    for (const b of pool) { const v = f.threat[b.sub] ?? 0; if (v > t) { t = v; best = b; } }
    if (best) return best;
  }
  return pool[Math.floor(rng() * pool.length) % pool.length];
}
/** The attacks this phase allows at a target `gap` metres from its head - the last used left out when anything else is
 *  open, and never SERPENT_REPEAT_MAX + 1 times running. A coil is for a ship (`ship`), and never twice at once. */
export function serpentAttacksFor(phase, gap, ship, lastA = -1, run = 1) {
  const out = CHOSEN.filter((a) => a.phase <= phase && gap <= a.range && gap >= a.minGap && (a !== SERPENT_ATTACK_TABLE.coil || ship));
  const fresh = out.filter((a) => a.id !== lastA);
  return fresh.length ? fresh : run >= SERPENT_REPEAT_MAX ? [] : out;
}
/** One of `can` by weight. */
export function chooseSerpentAttack(can, rng) {
  const total = can.reduce((s, a) => s + a.w, 0);
  let x = rng() * total;
  for (const a of can) { x -= a.w; if (x < 0) return a; }
  return can[can.length - 1];
}

/** A new leg, kept and said (the bound on how many are kept: pruneLegs's, on the beat - a leg may begin in the future,
 *  and the track is pruned by the clock that has come, never by the one a future leg names). */
function pushLeg(f, L, out) {
  const leg = roundLeg(L);
  // AUDIT SERPENT S2: THE TIMELINE'S ONE RULE - a leg said now supersedes any still to come (the relay and every client
  // apply it alike: serpentBody.js supersede), so the track is always in time order and every screen draws one body
  supersede(f.legs, leg.at);
  f.legs.push(leg);
  while (f.legs.length > LEGS_KEPT * 2) f.legs.shift();
  out?.push({ k: 'sw', l: leg });
  return leg;
}
/** The legs the body no longer lies along let go at `t` (the clock NOW - never a future leg's start: a jump still to
 *  come leaves the body where it is until it comes): the oldest goes while the track from the head at `t` back to the
 *  start of the one after it is a whole body long, or the one after it is a jump already begun (the body never reaches
 *  back past one). A client that lets go of more at a later clock lets go of nothing the body is drawn from. */
export function pruneLegs(f, t) {
  while (f.legs.length > 1) {
    const second = f.legs[1];
    if (second.at > t) break;
    if (!second.j && trackSince(f.legs, t, second.at) < BODY_LEN) break;
    f.legs.shift();
  }
  while (f.legs.length > LEGS_KEPT * 2) f.legs.shift();
}
/** The track's length (m) from the head at `t` back to the moment `since`. */
function trackSince(legs, t, since) {
  let len = 0, end = t;
  for (let i = legs.length - 1; i >= 0 && end > since; i--) {
    const L = legs[i];
    if (L.at > end) continue;
    const from = Math.max(L.at, since);
    len += (Math.max(SWIM_MIN_V, L.v) * (end - from)) / 1000;
    end = L.at;
  }
  return len;
}
/** A change of mode, kept and said. */
function pushMode(f, at, m, out) {
  // AUDIT SERPENT S2: the timeline's one rule - and a mode still to come that it takes away is said away (the word is said
  // even when the ride it keeps is the same, so every client's fold drops what the relay dropped)
  const had = f.modes.length;
  supersede(f.modes, Math.round(at));
  const cur = f.modes[f.modes.length - 1];
  if (f.modes.length === had && cur && cur.m === m && cur.at <= at) return;
  f.modes.push({ at: Math.round(at), m });
  while (f.modes.length > MODES_KEPT) f.modes.shift();
  out?.push({ k: 'dv', at: Math.round(at), m });
}
/** A JUMP: the head placed at (x, z) heading `yw` from `at` - under the sea, between two of its sightings (a breach
 *  rising under a ship, a woken serpent surfacing again, the maelstrom's orbit). The body never reaches back past it. */
function jumpTo(f, at, x, z, yw, v, out, arc = null) {
  return pushLeg(f, arc ? { k: LEG.arc, at, x, z, yw, v, r: arc.r, sd: arc.sd, j: 1 } : { k: LEG.line, at, x, z, yw, v, j: 1 }, out);
}

/** STEER the head toward `aim` at speed `v`: a turn begun past STEER_TURN of error, a straight run within
 *  STEER_STRAIGHT, a change of pace said as a leg of its own - no leg cut under LEG_MIN_MS. */
function steer(f, now, aim, v, out) {
  const L = f.legs[f.legs.length - 1];
  if (L && L.at > now) return;   // a jump still to come is the way
  const h = headAt(f.legs, now);
  const err = serpentWrapYaw(Math.atan2(aim[0] - h.x, aim[1] - h.z) - h.yw);
  const young = L && now - L.at < LEG_MIN_MS;
  const arc = L?.k === LEG.arc;
  if (Math.abs(err) > STEER_TURN && (!arc || L.sd !== Math.sign(err)) && !young) { pushLeg(f, legFrom(f.legs, now, LEG.arc, v, TURN_R, Math.sign(err)), out); return; }
  if (Math.abs(err) <= STEER_STRAIGHT && arc && !young) { pushLeg(f, legFrom(f.legs, now, LEG.line, v), out); return; }
  if (L && Math.abs(L.v - v) > 0.5 && !young) pushLeg(f, L.k === LEG.arc ? legFrom(f.legs, now, LEG.arc, v, L.r, L.sd) : legFrom(f.legs, now, LEG.line, v), out);
}
/** Where it swims: about the maelstrom's eye in its last phase, about its target otherwise (a point ahead on a ring
 *  round it), about its waters' heart with no one at the fight - always within its waters. */
function aimOf(f, now, target) {
  const h = headAt(f.legs, now);
  let cx = 0, cz = 0, r = 200;
  if (f.mael) { cx = f.mael.x; cz = f.mael.z; r = MAEL_ORBIT_R; }
  else if (target) { cx = target.x; cz = target.z; r = ORBIT_R; }
  const a = Math.atan2(h.x - cx, h.z - cz) + ORBIT_LEAD;
  return keepIn(cx + Math.sin(a) * r, cz + Math.cos(a) * r);
}

/** WB-style: the attack's wind-up (never shortened: Mac, "I dont think making mechanics faster is the play"). */
export const serpentWindupOf = (A) => A.windup;
/** An attack as the wire says it. */
export function serpentAtkFrame(a) {
  return { i: a.i, a: a.a, at: a.at, x: r2(a.x), z: r2(a.z), yw: r4(serpentWrapYaw(a.yw)), tg: a.tg.map((p) => [r2(p[0]), r2(p[1])]), ...(a.s ? { s: a.s } : {}) };
}

/**
 * BEGIN an attack at `target` (a body, or null for a turn's): where it lands and when, said now so every screen draws its
 * wind-up at once - and the swim and the bearing that go with it.
 */
function begin(f, A, now, target, rng, out) {
  const at = now + serpentWindupOf(A);
  const h = headAt(f.legs, now);
  let tg = [], yw = h.yw;
  const tx = target?.x ?? 0, tz = target?.z ?? 0;
  if (A === SERPENT_ATTACK_TABLE.lash) {
    // the tail's sweep: from the body's rear third, toward the ship
    const p = spinePoint(f.legs, now, BODY_LEN * 0.65);
    yw = Math.atan2(tx - p.x, tz - p.z);
    tg = [[p.x, p.z]];
  } else if (A === SERPENT_ATTACK_TABLE.ram) {
    // under, turned on the ship, and along a lane at it - the run from the wind-up's end
    yw = Math.atan2(tx - h.x, tz - h.z);
    const x0 = h.x + Math.sin(yw) * RAM_WIND_V * (A.windup / 1000), z0 = h.z + Math.cos(yw) * RAM_WIND_V * (A.windup / 1000);
    tg = [[x0, z0], [x0 + Math.sin(yw) * ramLen(), z0 + Math.cos(yw) * ramLen()]];
    pushLeg(f, { k: LEG.line, at: now, x: h.x, z: h.z, yw, v: RAM_WIND_V }, out);
  } else if (A === SERPENT_ATTACK_TABLE.breach) {
    // it sounds, and comes up under the ship: the mark where she is now
    const [px, pz] = keepIn(tx, tz, ARENA_R + 60);
    yw = Math.atan2(px - h.x, pz - h.z);
    tg = [[px, pz]];
    const lead = (CRUISE_V * BREACH_LEAD_MS) / 1000;
    jumpTo(f, at - BREACH_LEAD_MS, px - Math.sin(yw) * lead, pz - Math.cos(yw) * lead, yw, CRUISE_V, out);
  } else if (A === SERPENT_ATTACK_TABLE.spit || A === SERPENT_ATTACK_TABLE.coil) {
    tg = [[tx, tz]];
    yw = Math.atan2(tx - h.x, tz - h.z);
  } else if (A === SERPENT_ATTACK_TABLE.roar) {
    tg = [[h.x, h.z]];
    pushLeg(f, legFrom(f.legs, now, LEG.line, REAR_V), out);
  } else if (A === SERPENT_ATTACK_TABLE.cry) {
    pushLeg(f, legFrom(f.legs, now, LEG.line, REAR_V), out);
  } else if (A === SERPENT_ATTACK_TABLE.mael) {
    tg = [[0, 0]];
  }
  pushMode(f, now, A.mode, out);
  f.atk = { i: ++f.seq, a: A.id, at, x: h.x, z: h.z, yw, tg, until: at + A.active + A.recover, ...(target ? { s: target.sub } : {}) };
  out.push({ k: 'atk', ...serpentAtkFrame(f.atk) });
}

/** The attack in flight, on its beat: the ram's run and its rising at the lane's end, the breach's burst, the coil's
 *  winding, the maelstrom's forming. */
function attackBeat(f, now, here, out) {
  const a = f.atk, A = SERPENT_ATTACK_BY_ID[a.a];
  if (A === SERPENT_ATTACK_TABLE.ram) {
    if (!a.ran && now >= a.at) { a.ran = true; pushLeg(f, { k: LEG.line, at: a.at, x: a.tg[0][0], z: a.tg[0][1], yw: a.yw, v: RAM_V }, out); }
    if (!a.done && now >= a.at + A.active) { a.done = true; pushLeg(f, legFrom(f.legs, a.at + A.active, LEG.line, CRUISE_V), out); pushMode(f, a.at + A.active, MODE.breach, out); }
  } else if (A === SERPENT_ATTACK_TABLE.breach) {
    if (!a.done && now >= a.at) { a.done = true; pushMode(f, a.at, MODE.breach, out); }
  } else if (A === SERPENT_ATTACK_TABLE.coil) {
    if (!a.done && now >= a.at) { a.done = true; beginCoil(f, a, now, here, out); }
  } else if (A === SERPENT_ATTACK_TABLE.mael) {
    if (!a.done && now >= a.at) {
      a.done = true;
      f.mael = { at: a.at, x: 0, z: 0 };
      out.push({ k: 'mael', at: a.at, x: 0, z: 0 });
      jumpTo(f, a.at, MAEL_ORBIT_R, 0, 0, CRUISE_V, out, { r: MAEL_ORBIT_R, sd: -1 });
      pushMode(f, a.at, MODE.rear, out);
      f.rearAt = a.at;
    }
  }
}

/**
 * THE COIL WINDS about the ship it was begun at - where she stands at its landing - with COIL_TEAM_S of the fighters'
 * broadsides as its health, holding COIL_MS unless broken. Her own machine says whether she was inside its ring
 * (`held`, with her hull's middle) or had slipped it (`esc` - the coil closes on empty sea).
 */
function beginCoil(f, a, now, here, out) {
  // it closes where its ring was said - the ship's own word (`held`) brings it onto her hull's middle
  const cx = a.tg[0][0], cz = a.tg[0][1];
  const h = headAt(f.legs, now);
  const th = Math.atan2(h.x - cx, h.z - cz);
  // AUDIT SERPENT T3: COIL_TEAM_S of the broadsides of the ships FIGHTING it - afloat, and with some threat on it
  const refs = here.reduce((s, b) => { const p = f.players[b.sub]; return s + (p && !p.wreck && (f.threat[b.sub] ?? 0) > 0 ? p.ref : 0); }, 0);
  const m = Math.max(COIL_HP_MIN, Math.round(COIL_TEAM_S * refs));
  // its moment the landing's - the moment every client tested its own ship against the ring - not the beat's
  f.coil = { i: a.i, s: a.s ?? null, x: r2(cx), z: r2(cz), th: r4(th), at: a.at, until: a.at + COIL_MS, off: 0, h: m, m, held: false, why: null };
  f.coils = (f.coils ?? 0) + 1;
  jumpTo(f, a.at, cx + Math.sin(th) * COIL_R, cz + Math.cos(th) * COIL_R, serpentWrapYaw(th + Math.PI / 2), DRIFT_V, out);
  pushMode(f, a.at, MODE.coil, out);
  out.push(coilFrame(f.coil));
  // AUDIT SERPENT S3/B1: her word, said at the landing on her own clock, came before the beat that wound it - heard now
  if (a.word) out.push(...coilWord(f, a.word.sub, a.word.k, a.i, a.word.x, a.word.z, Math.max(now, f.coil.at)));
}
/** The coil as the wire says it. */
export const coilFrame = (c) => ({ k: 'coil', i: c.i, s: c.s, x: c.x, z: c.z, th: c.th, at: c.at, until: c.until, h: Math.ceil(c.h), m: c.m });
/** The coil let go - broken, crushed or slipped - and the swim taken up again from where its head is. */
function releaseCoil(f, now, out) {
  f.coil.off = now;
  pushLeg(f, legFrom(f.legs, now, LEG.line, CRUISE_V), out);
  pushMode(f, now, MODE.cruise, out);
}
/** A COIL BROKEN by the ships' fire: it lets go, and lies stunned on the water - its head the prize. */
function breakCoil(f, now, by, out) {
  f.coil.h = 0;
  f.coil.why = 'broken';
  f.stunUntil = now + SERPENT_STUN_MS;
  releaseCoil(f, now, out);
  pushLeg(f, legFrom(f.legs, now, LEG.line, DRIFT_V), out);
  if (f.atk) f.atk.until = Math.min(f.atk.until, now);
  out.push({ k: 'cb', i: f.coil.i, n: by, at: now, su: f.stunUntil });
}
/**
 * The ship in a coil says her word: `held` (she was inside its ring - `x`/`z` her hull's middle, within COIL_HELD_SLACK
 * of the coil) or `esc` (she had slipped it, within COIL_ESC_MS of its winding). Only the coiled ship's account speaks
 * for her. Answers the frames to fan.
 */
export function coilWord(f, sub, k, i, x, z, now) {
  const out = [];
  const c = f.coil;
  // AUDIT SERPENT S3/B1: the word of a coil not yet wound - its landing come on her clock, the relay's beat still to
  // wind it (up to SERPENT_TICK_MS on) - is kept on the attack and heard as it winds (beginCoil)
  const a = f.atk;
  if ((!c || c.i !== i) && a && a.i === i && a.a === SERPENT_ATTACK_TABLE.coil.id && !a.done && a.s === sub && !a.word && now >= a.at - COIL_WORD_EARLY_MS && (k === 'held' || k === 'esc')) {
    a.word = { sub, k, x: Number.isFinite(x) ? x : null, z: Number.isFinite(z) ? z : null };
    return out;
  }
  if (!c || c.i !== i || c.s !== sub || !coilHolds(f, now) || c.held) return out;
  if (k === 'esc') {
    if (now - c.at > COIL_ESC_MS) return out;
    c.why = 'esc';
    releaseCoil(f, now, out);
    out.push({ k: 'cx', i: c.i, at: now });
    return out;
  }
  if (k === 'held') {
    c.held = true;
    if (Number.isFinite(x) && Number.isFinite(z) && dist(x, z, c.x, c.z) <= COIL_HELD_SLACK) { c.x = r2(x); c.z = r2(z); }
    out.push(coilFrame(c));
  }
  return out;
}

/**
 * ONE BEAT. `bodies` are the fight's players about it now ({sub, x, z, dead} - the site frame), `rng` a [0,1) source.
 * Answers the frames to send, in order, as plain objects the relay stamps and fans (the `serpent` frame's kinds). Moves
 * the state in place.
 */
export function stepSerpentBrain(f, now, bodies, rng) {
  const out = [];
  const dt = Math.min(SERPENT_STEP_MAX_MS, Math.max(0, now - f.lastTickAt));
  f.lastTickAt = now;
  pruneLegs(f, now);
  if (f.fell || f.gone) { stateFrame(f, now, out); return out; }
  if (now >= f.soundAt) { sound(f, now, out); return out; }
  const here = bodies.filter((b) => !b.dead && f.players[b.sub] && Math.hypot(b.x, b.z) <= ENGAGE_R);
  // standing: a living body within SERPENT_STAND_R of its body stands its time (AUDIT SERPENT E1: never a boat parked
  // where nothing of it reaches), and the fight's own clock runs while anyone is at it
  const pts = here.length ? bodyAt(f, now) : null;
  for (const b of here) if (nearestPoint(pts, b.x, b.z) <= SERPENT_STAND_R) f.players[b.sub].stoodMs += dt;
  if (here.length) f.liveMs += dt;
  // a share leaves with its fighter, and comes back with them - never a wreck's, nor a silent ship's (serpentShareWanted)
  for (const b of here) f.players[b.sub].seenAt = now;
  for (const p of Object.values(f.players)) { if (serpentShareWanted(p, now)) restoreSerpentShare(f, p); else retireSerpentShare(f, p); }
  // AUDIT SERPENT B7: the ships in its waters - afloat, at the fight, now
  f.ships = here.filter((b) => f.players[b.sub].hl >= 0 && !f.players[b.sub].wreck).length;
  const keep = Math.pow(1 - SERPENT_THREAT_DECAY, dt / 1000);
  for (const k of Object.keys(f.threat)) { f.threat[k] *= keep; if (f.threat[k] < 0.5) delete f.threat[k]; }
  // a room that slept while its head swam on: it surfaces again inside its waters (under the sea, unseen)
  const h0 = headAt(f.legs, now);
  // AUDIT SERPENT S2: once - a surfacing already on its way (its jump still to come) is never asked again each beat
  if (Math.hypot(h0.x, h0.z) > ARENA_R + STRAY_M && !f.atk && !coilHolds(f, now) && !((f.legs[f.legs.length - 1]?.at ?? 0) > now)) {
    const [x, z] = keepIn(h0.x, h0.z, ARENA_R * 0.6);
    pushMode(f, now, MODE.deep, out);
    jumpTo(f, now + MODE_BLEND_MS + 200, x, z, Math.atan2(-x, -z), CRUISE_V, out);
    pushMode(f, now + MODE_BLEND_MS + 1200, MODE.cruise, out);
  }
  // a phase crossed: its ward, and the phase's turn. AUDIT SERPENT S2: an attack in flight lands as every screen was
  // told it would (the turn waits for its span - nothing said is unsaid); a coil holding a ship lets her go
  if (f.max > 0 && f.phase < 3 && f.hp / f.max <= SERPENT_PHASE_AT[f.phase - 1]) {
    f.phase++;
    f.shieldUntil = now + SERPENT_SHIELD_MS;
    f.stunUntil = 0;
    if (coilHolds(f, now)) { f.coil.why = 'turn'; releaseCoil(f, now, out); out.push({ k: 'cx', i: f.coil.i, at: now }); }
    out.push({ k: 'ph', n: f.phase, until: f.shieldUntil });
    f.queue = [...SERPENT_PHASE_TURN[f.phase]];
    f.pending = null;
    if (!f.atk) { const [first, ...rest] = f.queue; f.queue = rest; begin(f, SERPENT_ATTACK_TABLE[first], now, null, rng, out); }
  }
  // the coil's own clock: its crush at its end
  if (coilHolds(f, now) && now >= f.coil.until) {
    f.coil.why = 'crushed';
    out.push({ k: 'cr', i: f.coil.i, at: now });
    releaseCoil(f, now, out);
  }
  // stunned: adrift, its head on the water - no blow of its
  if (stunned(f, now)) { endFrames(f, now, out); return out; }
  if (f.atk) {
    attackBeat(f, now, here, out);
    // an attack holds the turn through its span - a coil until it is let go, however long it holds
    const A = SERPENT_ATTACK_BY_ID[f.atk.a];
    if (now < f.atk.until || (A === SERPENT_ATTACK_TABLE.coil && coilHolds(f, now))) { endFrames(f, now, out); return out; }
    const was = f.atk;
    f.runA = was.a === f.lastA ? (f.runA ?? 0) + 1 : 1;
    f.lastA = was.a;
    f.freeAt = now;
    f.atk = null;
    f.target = null;
    f.nextAt = now + SERPENT_BREATH_MS;
    // it settles back to cruising (the coil's letting go said so already; the Maelstrom's forming leaves it reared)
    if (A.mode !== MODE.cruise && A !== SERPENT_ATTACK_TABLE.coil && A !== SERPENT_ATTACK_TABLE.mael) pushMode(f, now, MODE.cruise, out);
    if (f.queue.length) { f.pending = f.queue.shift(); f.nextAt = now + SERPENT_BREATH_MS; }
  }
  if (f.pending && now >= f.nextAt) {
    const A = SERPENT_ATTACK_TABLE[f.pending];
    f.pending = null;
    const t = A === SERPENT_ATTACK_TABLE.coil ? pickSerpentTarget(f, here, rng, true) : null;
    if (A && (A !== SERPENT_ATTACK_TABLE.coil || t)) { begin(f, A, now, t, rng, out); endFrames(f, now, out); return out; }
  }
  // choose: a target kept a while, and what can be done to it from here
  let target = f.target ? here.find((b) => b.sub === f.target) ?? null : null;
  if (!target || now - f.targetAt >= SERPENT_TARGET_HOLD_MS) { target = pickSerpentTarget(f, here, rng); f.target = target?.sub ?? null; f.targetAt = now; }
  if (now >= f.nextAt && now >= f.openUntil && target && !f.pending) {
    const h = headAt(f.legs, now);
    if (now - (f.freeAt ?? 0) >= 6000) f.runA = 0;
    const can = serpentAttacksFor(f.phase, dist(target.x, target.z, h.x, h.z), f.players[target.sub].hl >= 0, f.lastA, f.runA);
    if (can.length) { begin(f, chooseSerpentAttack(can, rng), now, target, rng, out); endFrames(f, now, out); return out; }
  }
  // the Maelstrom's rearing: its head up out of the whirl, then down again
  if (f.mael && !f.atk) {
    const m = f.modes[f.modes.length - 1]?.m;
    if (m === MODE.rear && now - f.rearAt >= MAEL_REAR_MS) { pushMode(f, now, MODE.cruise, out); f.rearAt = now; }
    else if (m !== MODE.rear && now - f.rearAt >= MAEL_REAR_EVERY_MS) { pushMode(f, now, MODE.rear, out); f.rearAt = now; }
  }
  steer(f, now, aimOf(f, now, target), f.mael && f.modes[f.modes.length - 1]?.m === MODE.rear ? REAR_V + 2 : CRUISE_V, out);
  endFrames(f, now, out);
  return out;
}

function endFrames(f, now, out) { hpFrame(f, now, out); coilHpFrame(f, now, out); stateFrame(f, now, out); }
function hpFrame(f, now, out) {
  const h = Math.round(f.hp);
  if (h !== f.lastHpSent && now - f.lastHpAt >= SERPENT_HP_SEND_MS) { f.lastHpSent = h; f.lastHpAt = now; out.push({ k: 'hp', h, m: Math.round(f.max) }); }
}
function coilHpFrame(f, now, out) {
  const c = f.coil;
  if (!c || !coilHolds(f, now)) return;
  const h = Math.ceil(c.h);
  if (h !== c.sent && now - (c.sentAt ?? 0) >= SERPENT_HP_SEND_MS) { c.sent = h; c.sentAt = now; out.push({ k: 'ch', i: c.i, h }); }
}
function stateFrame(f, now, out) {
  if (now - f.lastStateAt < SERPENT_STATE_SEND_MS) return;
  f.lastStateAt = now;
  out.push(serpentStateOf(f));
}
/** The whole state as the wire says it (the `st` kind): on joining, and every SERPENT_STATE_SEND_MS. */
export function serpentStateOf(f) {
  const c = f.coil;
  return {
    k: 'st', d: f.day, b: f.boss, sx: f.sx, sz: f.sz, ph: f.phase, h: Math.round(f.hp), m: Math.round(f.max),
    legs: f.legs.slice(-LEGS_KEPT * 2), modes: f.modes.slice(-MODES_KEPT),
    coil: c ? { i: c.i, s: c.s, x: c.x, z: c.z, th: c.th, at: c.at, until: c.until, off: c.off > 0 ? c.off : 0, h: Math.ceil(c.h), m: c.m } : null,
    mael: f.mael ? { at: f.mael.at, x: f.mael.x, z: f.mael.z } : null,
    atk: f.atk ? serpentAtkFrame(f.atk) : null, sh: f.shieldUntil, su: f.stunUntil > 0 ? f.stunUntil : 0, sa: f.soundAt,
    n: f.ships ?? 0, op: f.openUntil,   // AUDIT SERPENT B7: the ships afloat at the fight, never every account that ever joined
    fell: f.fell ? { at: f.fell.at, top: f.fell.top, n: f.fell.n, ...(f.fell.dm ? { dm: f.fell.dm } : {}) } : null,
    gone: f.gone ? f.gone.at : null,
  };
}
/** The body's word a state carries, for serpentBody.js bodyAt - the fight is one. */
export const bodyOf = (f) => f;
/** Every segment it has, for a probe. */
export const SEGMENTS = SEG_N;
export const SEGMENT_LEN = SEG_LEN;
/** A coil's weight on the body at `t` (serpentBody.js's, re-said for the relay's one import). */
export const coilOn = (f, t) => coilWeight(f.coil, t);
/** The head on its current leg at `t` (for the relay's probes). */
export const headOf = (f, t) => headAt(f.legs, t);
export { legAt };
