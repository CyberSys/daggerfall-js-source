// @ts-check
// HELM-WAY (DECLARED, the Port-Ledger's HELM-WAY row; 2026-09-29, Mac: "Improve the overall mobility and
// maneuverability of ships") - THE RESPONSIVE HELM: one law for how a hull gathers way, loses it and answers her helm,
// read by the player's own boat (systems/comeSailAway.js, over Come Sail Away's own handling - the Features row's Ship
// handling, 'responsive' by default, 'classic' the mod to the letter) and by the sea's captains
// (systems/naval/navalAI.js maxTurnRate - they sail at the player's own pace, so they turn at the player's own helm).
//
// MEASURED FIRST, on the real runtime (1/60 s frames): Come Sail Away's Small Ship took 29.8 s to her full way on a
// beam reach and 45 s (200 m) to lose it with her sails struck; she turned only with way on - her rudder is her speed
// (TurnTarget = |v| x rudder / 10) - so 0.75 deg/s at 1 m/s, nothing at rest, on a 153 m circle at every speed; a Large
// Galley under sail turned 0.85 deg/s (a 458 m circle); and a Carrack could neither make way nor turn (no Cargo node:
// a hold of 0, and UpdateBoatCargoMod's 2 - w / 0 clamps every speed to nothing).
//
// THE LAW:
//   - WAY: under sail her way comes on at HELM_WAY.sailAccel of the mod's rate and, sails struck, off at HELM_WAY.coast
//     of it - a Small Ship 8.5 s to her full way, 15 s to lose it. Every Handling dial of the mod still multiplies it.
//   - STEERAGE (`steerage`): the rudder answers by a curve of her way through the water in place of the way itself -
//     STEER_FLOOR at rest (the wind in her canvas swings her), biting hardest at steerPeakV, easing toward her full
//     way - so half sail turns tightest, as Black Flag's does. Times the hull's own helm (HULL_HELM, the prefab's
//     rudder x sail-turn modifiers): a Small Ship 2.3 deg/s at rest, 10.5 at 4.5 m/s, 8.3 at 9 m/s - a 49 m circle at
//     half her way, 124 m at full (the mod's: 153 m at every way, 6.7 deg/s at full, none at rest); a Large Galley under
//     sail 3.4 deg/s at 3.4 m/s (a 114 m circle; the mod's 458 m). The helm comes over HELM_WAY.turnAccelSail times the
//     mod's own rate.
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
