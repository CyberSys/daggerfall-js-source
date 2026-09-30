// @ts-check
// HELM-WAY (DECLARED, the Port-Ledger's HELM-WAY row; 2026-09-29, Mac: "Improve the overall mobility and
// maneuverability of ships") - THE RESPONSIVE HELM: one law for how a hull gathers way, loses it and answers her helm,
// read by the player's own boat (systems/comeSailAway.js, over Come Sail Away's own handling - the Features row's Ship
// handling, 'responsive' by default, 'classic' the mod to the letter) and by the sea's captains
// (systems/naval/navalAI.js maxTurnRate - they sail at the player's own pace, so they turn at the player's own helm).
//
// MEASURED FIRST, on the real runtime (test/csaScene.mjs at 1/60 s frames, waves off, a 1.5 m/s wind on her beam; AUDIT
// NAV2 F20: re-measured like-for-like, each figure at its speed): Come Sail Away's Small Ship took 25.4 s to her full way
// of 7.6 m/s and 38.1 s (145 m) to lose it with her sails struck; she turned only with way on - her rudder is her speed
// (TurnTarget = |v| x rudder / 10) - so 0.75 deg/s at 1 m/s, 5.7 at her full way, nothing at rest, on a 153 m circle at
// every speed; a Large Galley under sail turned 0.85 deg/s at 3.4 m/s (a 458 m circle); and a Carrack could neither make
// way nor turn (no Cargo node: a hold of 0, and UpdateBoatCargoMod's 2 - w / 0 clamps every speed to nothing).
//
// THE LAW:
//   - WAY: under sail her way comes on at HELM_WAY.sailAccel of the mod's rate and, sails struck, off at HELM_WAY.coast
//     of it - a Small Ship 7.25 s to her full way, 12.7 s (48 m) to lose it. Every Handling dial of the mod still
//     multiplies it.
//   - STEERAGE (`steerage`): the rudder answers by a curve of her way through the water in place of the way itself -
//     STEER_FLOOR at rest (the wind in her canvas swings her), biting hardest at steerPeakV, easing toward her full
//     way - so half sail turns tightest, as Black Flag's does. Times the hull's own helm (HULL_HELM, the prefab's
//     rudder x sail-turn modifiers): a Small Ship 2.25 deg/s at rest, 10.5 at 4.5 m/s (a 49 m circle), 9.2 at her full
//     way of 7.6 m/s (a 94 m circle), 8.3 at 9 m/s (124 m) - the mod's 153 m at every way and none at rest; two seconds
//     from rest with the helm over she swings 8.8 deg/s (the mod's 0.45); a Large Galley under sail 3.4 deg/s at 3.4 m/s
//     (a 114 m circle; the mod's 458 m). The helm comes over HELM_WAY.turnAccelSail times the mod's own rate.
//   - A HULL WITH NO CARGO NODE carries the largest hold the mod gave any hull (CARGO_HOLD_MISSING, the Large Galley's).

export const HELM_WAY = Object.freeze({ sailAccel: 3.5, coast: 3, turnAccelSail: 2.4, steerFloor: 3, steerPeak: 14, steerPeakV: 4.5 });
/** The Features row's two handlings (prefs `naval-handling`): the port's responsive helm, and the mod's own. */
export const HANDLINGS = Object.freeze(['responsive', 'classic']);
export const CARGO_HOLD_MISSING = 3;
/** A hull's own helm - Come Sail Away's rudder modifier times its sail-turn modifier, read off the prefab (Rowboat,
 *  Large Boat, Small Ship, Large Galley, Carrack): the steerage's degrees a second, per metre a second of it. */
export const HULL_HELM = Object.freeze([1, 1, 0.75, 0.25, 0.75]);

/**
 * The steerage of a hull making `v` m/s through the water - the "way" her rudder answers to (the mod's own rudder reads
 * the way itself): steerFloor at rest, steerPeak at steerPeakV, easing past it (x e^(1 - x), x her way over the peak's).
 * @param {number} v
 */
export function steerage(v) {
  const x = Math.max(0, Number(v) || 0) / HELM_WAY.steerPeakV;
  return HELM_WAY.steerFloor + (HELM_WAY.steerPeak - HELM_WAY.steerFloor) * x * Math.exp(1 - x);
}

/** Whether a handling choice is the responsive helm (anything but the mod's own 'classic'). @param {unknown} h */
export const isResponsive = (h) => h !== 'classic';
