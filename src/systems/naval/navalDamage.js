// @ts-check
// NAV-A (2026-09-28) - THE DAMAGE: what a shot does to a ship, and what a ship does about it. The port's own; pure.
//
// A SHIP IS THREE NUMBERS. Its HULL (holed, it sinks), its SAILS (cut, it slows - a ship's way is 35% of its best
// under bare poles and the rest in proportion to the canvas left), and its CREW (thinned, the guns reload slower -
// navalGunnery.js reloadSeconds - and a boarding meets fewer). Each shot is classified where it strikes the hull's
// box (navalBallistics.js segmentBoxEntry's local point): over the gunwale it is in the RIGGING - sails and a man or
// two; below it the HULL - and within WATERLINE_BAND of the sea it is holed below the waterline, HOLED_BONUS more.
// A hull hit has FIRE_CHANCE to start a fire (a fire barrel always does): a fire burns FIRE_HP a second for
// FIRE_SECONDS, a new one topping the clock up, never stacking.
//
// THE STATES (SHIP_STATES) follow Black Flag's rhythm. An AI ship brought to STRUCK_AT of its hull STRIKES ITS COLOURS: it stops
// fighting and heaves to, and can be boarded (navalBoarding.js) - or shot on until it sinks. At nought it SINKS, over
// SINK_SECONDS (navalAI.js settles and heels it), then is SUNK and gone, its flotsam left floating. A ship taken by
// boarding is a PRIZE.
//
// THE PLAYER'S OWN BOAT NEVER SINKS. At nought it is WRECKED: dismasted in effect - no sail can be raised
// (the boat's `sailsTorn`), her oars at WRECKED_OARS of their way, her guns silent - until she is repaired at a port
// or with a prize's timber. A boat is a possession bought for up to two hundred thousand gold, and losing one to a
// lucky broadside would be a punishment Daggerfall never deals; a wreck is the price instead, and pirates who see
// one will board it.
//
// BRACING halves the hull and sail damage a ship takes while the brace is held (the gunnery's own brace).

export const SHIP_STATES = Object.freeze({ afloat: 'afloat', struck: 'struck', sinking: 'sinking', sunk: 'sunk', prize: 'prize', wrecked: 'wrecked' });
/** An AI ship strikes its colours at this share of its hull. */
export const STRUCK_AT = 0.25;
/** A sinking ship's seconds to go under. */
export const SINK_SECONDS = 22;
/** The band over the sea a hull hit is below the waterline in (m), and what it adds. */
export const WATERLINE_BAND = 1.1;
export const HOLED_BONUS = 0.4;
/** The rigging's floor: this far under the hull box's top a shot is already in the rigging (m). */
export const RIG_MARGIN = 0.4;
/** Fire: the chance a hull hit sets one, its bite a second, its length. */
export const FIRE_CHANCE = 0.06;
export const FIRE_HP = 1.4;
export const FIRE_SECONDS = 15;
/** What bracing leaves of a hit. */
export const BRACE_TAKEN = 0.5;
/** A wrecked boat's oars: this share of their way. */
export const WRECKED_OARS = 0.35;
/** Under bare poles a ship keeps this share of its way; the rest is its canvas. */
export const BARE_POLES = 0.35;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Where a shot struck, from the hit's point in the hull box's own frame (`local`, navalBallistics.js
 * segmentBoxEntry): 'rig' over the gunwale, 'holed' within WATERLINE_BAND of the sea, else 'hull'.
 * @param {number[]} local - the point in the box frame (x across, y up, z along)
 * @param {{ h: number[] }} box - its half sizes
 * @param {number} boxCentreOverSea - the box centre's height over the sea (m)
 */
export function hitZone(local, box, boxCentreOverSea) {
  if (local[1] >= box.h[1] - RIG_MARGIN) return 'rig';
  if (local[1] + boxCentreOverSea <= WATERLINE_BAND) return 'holed';
  return 'hull';
}

/**
 * The damage one ball does: `{ hull, sail, crew }` for its gun (navalShips.js GUNS) and the zone it struck. A rigging
 * hit cuts canvas (and takes a man) and holes nothing; a hull hit holes, and below the waterline holes more.
 * Chain shot's own numbers already favour the sails.
 */
export function shotDamage(gun, zone, { braced = false, roll = 0.5 } = {}) {
  const k = braced ? BRACE_TAKEN : 1;
  const spread = 0.85 + 0.3 * clamp(roll, 0, 1);   // each ball its own, 85-115%
  if (zone === 'rig') return { hull: 0, sail: Math.round(Math.max(gun.sail * 2, gun.hull * 0.5) * k * spread), crew: gun.crew > 0 ? 1 : 0 };
  const holed = zone === 'holed' ? 1 + HOLED_BONUS : 1;
  return { hull: Math.round(gun.hull * holed * k * spread), sail: Math.round(gun.sail * 0.25 * k * spread), crew: gun.crew };
}

/**
 * A ship's hurts: its three numbers, its fire, its state. `player` - a player's boat wrecks where an AI ship sinks.
 * @param {{ hullHp: number, sailHp: number, crew: number, player?: boolean }} spec
 */
export function createShipDamage({ hullHp, sailHp, crew, player = false }) {
  /** @type {{ maxHull: number, maxSail: number, maxCrew: number, hull: number, sail: number, crew: number, fire: number, state: string, sinkT: number, lastHitAt: number }} */
  const s = {
    maxHull: Math.max(1, hullHp), maxSail: Math.max(0, sailHp), maxCrew: Math.max(0, crew),
    hull: Math.max(1, hullHp), sail: Math.max(0, sailHp), crew: Math.max(0, crew),
    fire: 0, state: SHIP_STATES.afloat, sinkT: 0, lastHitAt: -Infinity,
  };
  const d = {
    get state() { return s.state; },
    get hull() { return s.hull; }, get maxHull() { return s.maxHull; },
    get sail() { return s.sail; }, get maxSail() { return s.maxSail; },
    get crew() { return s.crew; }, get maxCrew() { return s.maxCrew; },
    get fire() { return s.fire; },
    get sinkT() { return s.sinkT; },
    get lastHitAt() { return s.lastHitAt; },
    hullShare: () => s.hull / s.maxHull,
    sailShare: () => (s.maxSail > 0 ? s.sail / s.maxSail : 1),
    crewShare: () => (s.maxCrew > 0 ? s.crew / s.maxCrew : 1),
    /** The way the canvas left allows (0..1 of the ship's best). */
    wayShare: () => (s.maxSail > 0 ? BARE_POLES + (1 - BARE_POLES) * (s.sail / s.maxSail) : 1),
    /** Whether the ship still fights: afloat (a struck, sinking, sunk, taken or wrecked ship fires nothing). */
    fighting: () => s.state === SHIP_STATES.afloat,
    /** A hurt, applied: `{ hull, sail, crew, fire? }`, at `now` (s). Answers what it changed the state to (or null). */
    apply(hurt, now = 0) {
      if (s.state === SHIP_STATES.sunk || s.state === SHIP_STATES.prize) return null;
      s.lastHitAt = now;
      s.hull = Math.max(0, s.hull - Math.max(0, hurt.hull | 0));
      s.sail = Math.max(0, s.sail - Math.max(0, hurt.sail | 0));
      s.crew = Math.max(0, s.crew - Math.max(0, hurt.crew | 0));
      if (hurt.fire) s.fire = FIRE_SECONDS;
      return d.settle();
    },
    /** The state the numbers now call for; answers the new state on a change, else null. */
    settle() {
      const was = s.state;
      if (player) {
        if (s.hull <= 0 && s.state !== SHIP_STATES.wrecked) s.state = SHIP_STATES.wrecked;
      } else if (s.state === SHIP_STATES.afloat || s.state === SHIP_STATES.struck) {
        if (s.hull <= 0) { s.state = SHIP_STATES.sinking; s.sinkT = 0; s.fire = 0; }
        else if (s.state === SHIP_STATES.afloat && s.hull <= s.maxHull * STRUCK_AT) s.state = SHIP_STATES.struck;
      }
      return s.state !== was ? s.state : null;
    },
    /** One step: the fire burns, a sinking ship goes down. Answers a state change, or null. */
    step(dt, now = 0) {
      const t = Math.max(0, dt);
      if (s.fire > 0 && s.state !== SHIP_STATES.sinking && s.state !== SHIP_STATES.sunk) {
        const burn = Math.min(s.fire, t);
        s.fire -= burn;
        const change = d.apply({ hull: 0, sail: 0, crew: 0 }, now);
        s.hull = Math.max(0, s.hull - FIRE_HP * burn);
        const c2 = d.settle();
        if (c2 || change) return c2 ?? change;
      }
      if (s.state === SHIP_STATES.sinking) {
        s.sinkT += t;
        if (s.sinkT >= SINK_SECONDS) { s.state = SHIP_STATES.sunk; return SHIP_STATES.sunk; }
      }
      return null;
    },
    /** Taken by boarding. */
    takePrize() { if (s.state !== SHIP_STATES.sunk && s.state !== SHIP_STATES.sinking) s.state = SHIP_STATES.prize; },
    /** Scuttled: straight to sinking. */
    scuttle() { if (s.state !== SHIP_STATES.sunk) { s.state = SHIP_STATES.sinking; s.sinkT = 0; s.fire = 0; } },
    /** Repairs: hull, sails and crew each up to their best (or by an amount). A wrecked boat back over nought floats. */
    repair({ hull = Infinity, sail = Infinity, crew = Infinity } = {}) {
      s.hull = Math.min(s.maxHull, s.hull + Math.max(0, hull));
      s.sail = Math.min(s.maxSail, s.sail + Math.max(0, sail));
      s.crew = Math.min(s.maxCrew, s.crew + Math.max(0, crew));
      if (s.hull > 0) s.fire = 0;
      if (s.state === SHIP_STATES.wrecked && s.hull > 0) s.state = SHIP_STATES.afloat;
      if (s.state === SHIP_STATES.struck && s.hull > s.maxHull * STRUCK_AT) s.state = SHIP_STATES.afloat;
    },
    /** What the save or the wire keeps. */
    snapshot: () => ({ hull: Math.round(s.hull), sail: Math.round(s.sail), crew: s.crew, fire: +s.fire.toFixed(1), state: s.state }),
    /** Back from a snapshot - numbers bounded to the ship's own, a state it can be in. */
    restore(r) {
      if (!r || typeof r !== 'object') return;
      const num = (v, max) => (Number.isFinite(v) ? clamp(v, 0, max) : max);
      s.hull = num(r.hull, s.maxHull); s.sail = num(r.sail, s.maxSail); s.crew = Math.round(num(r.crew, s.maxCrew));
      s.fire = Number.isFinite(r.fire) ? clamp(r.fire, 0, FIRE_SECONDS) : 0;
      const st = Object.values(SHIP_STATES).includes(r.state) ? r.state : SHIP_STATES.afloat;
      s.state = player ? (st === SHIP_STATES.wrecked || s.hull <= 0 ? SHIP_STATES.wrecked : SHIP_STATES.afloat) : st;
      if (s.state === SHIP_STATES.sinking) s.sinkT = 0;
    },
  };
  return d;
}

/** The repair a shipwright asks, in gold: by what is missing of each - a hull point the dearest. */
export const REPAIR_PRICE = Object.freeze({ hull: 12, sail: 6, crew: 30 });
export function repairCost(damage) {
  if (!damage) return 0;
  return Math.round((damage.maxHull - damage.hull) * REPAIR_PRICE.hull + (damage.maxSail - damage.sail) * REPAIR_PRICE.sail + (damage.maxCrew - damage.crew) * REPAIR_PRICE.crew);
}
