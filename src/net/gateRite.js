// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"; then "Btw I want to do all 4. We're going balls deep with this"):
// THE FAITHFUL'S RITE - the law every client and the relay share with no word sent: where a breach's faithful work
// their rite (off the gate's own spot and facing - net/gateLaw.js), who stands there, when the rite holds, and how many
// may break it. Design: bible/11-Multiplayer/World-Bosses.md section 19 D.
//
// PURE and imported by the relay: an edit here is an edit to the relay's law (test/relayversion.test.js).
//
// Not a DFU member. Ledger A (WB).
import { GATE_SALT, gateHash, gateRoll, gateSpotLocal, gateYaw, gateTimes, isGateDay, PIXEL_M, GATE_COLLAPSE_MS } from './gateLaw.js';

/** The circle stands this far from the arch, metres (its banner's 60 never reached). */
export const RITE_MIN_M = 90;
export const RITE_MAX_M = 180;
/** ...and never within this many degrees of the gate's two ways in (its own ±z - the rim spires' rule, world/gateModel.js). */
export const RITE_OFF_APPROACH_DEG = 50;
/** A word is believed from a pose this near the circle, metres - a fight with the faithful drifts. */
export const RITE_REACH_M = 60;
/** A native unit's metres: a map pixel is PIXEL_UNITS (32768, net/wire.js) over PIXEL_M (819.2) - pinned equal. */
export const RITE_UNITS_PER_M = 40;
/** The faithful at a circle beside the Summoner: the day's roll in [MIN, MAX]. */
export const RITE_FAITHFUL_MIN = 6;
export const RITE_FAITHFUL_MAX = 8;
/** Their robed careers (characters/mobileTypes.js): Mage, Battlemage, Healer, Nightblade. The Summoner is a Sorcerer -
 *  a caster none of them is, so every screen knows him by his kind alone (a copy of a peer's carries no name). */
export const RITE_CAREERS = Object.freeze([128, 130, 132, 133]);
export const RITE_SUMMONER_CAREER = 131;
/** The Summoner's health over a caster's. */
export const RITE_SUMMONER_HEALTH = 3;
/** The most accounts a rite counts among those who broke it (a raid's bound). */
export const RITE_HELPERS_MAX = 64;
/** A player at the circle says the rite's word this often while it holds. */
export const RITE_WORD_MS = 5000;

const unit = (v) => v / 4294967296;

/**
 * The circle's offset from the gate in the gate's own frame, metres: [x across the arch, z through the fire]. To one
 * side of the arch (the day's roll), within 40 degrees of its x axis - so 50 or more off either way in - and
 * RITE_MIN_M to RITE_MAX_M out. Pure.
 * @param {number} day
 */
export function riteOffset(day) {
  const side = gateRoll(day, 9) % 2 ? 1 : -1;
  const a = (unit(gateRoll(day, 16)) * 2 - 1) * (90 - RITE_OFF_APPROACH_DEG) * (Math.PI / 180);
  const d = RITE_MIN_M + unit(gateRoll(day, 10)) * (RITE_MAX_M - RITE_MIN_M);
  return [side * d * Math.cos(a), d * Math.sin(a)];
}

/**
 * Where the faithful work their rite: [east, north] metres from the gate pixel's south-west corner (gateSpotLocal's
 * frame) - the offset carried out of the gate's frame as the Broker's spot is (scenes/sigilBrokerPool.js). Always
 * inside the pixel: the spot is at most 200 m from its centre, the circle 180 m more, the half-side 409.6. Pure.
 * @param {number} day
 */
export function riteLocalOf(day) {
  const [sx, sz] = gateSpotLocal(day), [lx, lz] = riteOffset(day);
  const yaw = gateYaw(day), c = Math.cos(yaw), s = Math.sin(yaw);
  return [sx + c * lx + s * lz, sz - s * lx + c * lz];
}

/** The circle in the relay's frame - native world units - for the gate's pixel. Pure.
 * @param {number} day @param {number} px @param {number} py */
export function riteNativeOf(day, px, py) {
  const [e, n] = riteLocalOf(day);
  return [px * PIXEL_M * RITE_UNITS_PER_M + e * RITE_UNITS_PER_M, (499 - py) * PIXEL_M * RITE_UNITS_PER_M + n * RITE_UNITS_PER_M];
}

/** Whether a native pose stands within RITE_REACH_M of the day's circle in the gate's pixel. Pure. */
export function riteNear(day, px, py, x, z) {
  const [cx, cz] = riteNativeOf(day, px, py);
  return Math.hypot(x - cx, z - cz) <= RITE_REACH_M * RITE_UNITS_PER_M;
}

/** The rite holds from the omen until the breach opens (relay ms). */
export const riteWindow = (day) => { const t = gateTimes(day); return { from: t.omenAt, to: t.openAt }; };
export const riteHolds = (day, now) => { const w = riteWindow(day); return now >= w.from && now < w.to; };
/** AUDIT WB12d (R8): a word said in the rite's last moment reaches the relay a moment after it - believed this long past
 *  the opening (a fall seen at the last second still breaks the rite). */
export const RITE_GRACE_MS = 2000;
export const riteHeard = (day, now) => { const w = riteWindow(day); return now >= w.from && now < w.to + RITE_GRACE_MS; };
/** The circle stands - its fires, its chest and the word of a broken rite - from the omen until its breach collapses:
 *  the Wrath's, or (AUDIT WB12d R7) an early kill's, `fellAt` (ms) when the Warden fell first. */
export const riteStands = (day, now, fellAt = null) => {
  const t = gateTimes(day);
  const end = Math.min(t.wrathAt, Number.isFinite(fellAt) ? fellAt : Infinity) + GATE_COLLAPSE_MS;
  return isGateDay(day) && now >= t.omenAt && now < end;
};

/**
 * The day's faithful, the Summoner first (a Sorcerer): `{ career, summoner }` - RITE_FAITHFUL_MIN to RITE_FAITHFUL_MAX of
 * Dagon's Faithful beside him, each one of the four robed careers by the day's roll. Pure.
 * @param {number} day
 */
export function riteFaithfulOf(day) {
  const n = RITE_FAITHFUL_MIN + (gateRoll(day, 17) % (RITE_FAITHFUL_MAX - RITE_FAITHFUL_MIN + 1));
  const out = [{ career: RITE_SUMMONER_CAREER, summoner: true }];
  for (let i = 0; i < n; i++) out.push({ career: RITE_CAREERS[gateHash(GATE_SALT, day, 18, i) % RITE_CAREERS.length], summoner: false });
  return out;
}
