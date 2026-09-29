// @ts-check
// PROF4 (2026-09-28, Mac: "Continue") - THE PLANE, Carpentry's act at the workbench (bible/06-Systems/Professions-Arc.md
// 9.4, 25): "a steady drag along the grain, deviation scored as the trace is". The grain runs across a board, a gentle
// wave its own each act; the player presses at its head and draws the plane to its foot. Pure - a machine the
// workbench's page feeds pointer positions (ui/profPages.js), as the heat is the anvil's (systems/heatAct.js).
//
// Positions are the board's: `x` 0 (the head) to 1 (the foot), `y` a share of its half-height, up positive. A pass is
// clean when its mean deviation from the grain is within the tolerance (recipeLaw planeTolerance: the rank's, x the
// attribute band) and it took PLANE_ACT.minS to maxS - a plane is drawn, not flicked. A pass let go before the foot
// starts again. The act is the client's, so it may be lied about: its report moves the service's roll by one quality
// step at most (5.1's honest bound - the service reads `clean` and nothing else). Gentle acts plane plain.
import { PLANE_ACT, grainAt, planeTolerance } from '../net/recipeLaw.js';

/**
 * @param {{ rank?: number, band?: number, gentle?: boolean, rng?: () => number }} [opts] `band` the attribute band's
 *   widening (recipeLaw planeBand)
 */
export function createPlaneAct({ rank = 0, band = 1, gentle = false, rng = Math.random } = {}) {
  const st = {
    kind: 'plane', phase: rng(), tol: planeTolerance(rank, band), gentle,
    /** the pass under way: pressed at the head, its start, how far it has come, its deviations */
    planing: false, t0: 0, x: 0, devs: /** @type {number[]} */ ([]),
    /** passes let go before the foot, and the finished pass's measure */
    slips: 0, done: false, cancelled: false, deviation: 0, seconds: 0,
  };
  return {
    state: st,
    /** The grain's line at `x`, for the page to draw. */
    grain: (x) => grainAt(x, st.phase),
    /** How far the pass has come, 0 to 1. */
    get progress() { return st.planing ? Math.min(1, st.x / PLANE_ACT.footX) : st.done ? 1 : 0; },
    /** A press at (x, y), `t` seconds: a pass starts only at the grain's head. */
    press(x, y, t) {
      if (st.done || st.cancelled || st.planing || !(x <= PLANE_ACT.headX)) return false;
      st.planing = true; st.t0 = t; st.x = Math.max(0, x); st.devs = [Math.abs(y - grainAt(Math.max(0, x), st.phase))];
      return true;
    },
    /** The plane drawn to (x, y) at `t`: each step forward measured against the grain; the foot ends the pass. */
    move(x, y, t) {
      if (!st.planing || st.done) return;
      if (x > st.x) { st.x = Math.min(1, x); st.devs.push(Math.abs(y - grainAt(st.x, st.phase))); }
      if (st.x >= PLANE_ACT.footX) {
        st.planing = false; st.done = true;
        st.seconds = t - st.t0;
        st.deviation = st.devs.reduce((a, b) => a + b, 0) / st.devs.length;
      }
    },
    /** Let go: a pass not at its foot starts again from the head. */
    release() {
      if (!st.planing || st.done) return;
      st.planing = false; st.slips++; st.devs = []; st.x = 0;
    },
    /** Let go of the act (Esc, the page shut): no pass, no craft. */
    cancel() { st.cancelled = true; st.planing = false; },
    /** The act's report, once a pass is done: `{ clean, deviation, seconds, slips }`. */
    report() {
      if (!st.done) return null;
      const steady = st.seconds >= PLANE_ACT.minS && st.seconds <= PLANE_ACT.maxS;
      return { clean: !gentle && steady && st.deviation <= st.tol, deviation: st.deviation, seconds: st.seconds, slips: st.slips };
    },
  };
}
