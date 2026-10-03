// @ts-check
// QUAYS (2026-10-03; systems/naval/quays.js) - A BERTH'S QUAY AS A MODEL: the plan's deck, jetty and ramp, its piles,
// its kerb, the jetty's rails, the bollards, the lantern posts and their lanterns, and the cargo, built in the berth's
// frame (metres, y over the sea's top) by the port's MeshBuilder (world/detStandIns.js) and dressed in CLASSIC textures
// - the very planking and ironwork a classic ship wears (67_0, 67_8, 0_79, 0_10, 0_77), out of the player's own ARENA2
// like every other model. The gangway is a model of its own, a metre long along +z, stretched to its length.
//
// Not a DFU member. Ledger A (QUAYS).

import { MeshBuilder } from './detStandIns.js';
import { QUAY_DECK_T, PILE_R, BOLLARD_R, BOLLARD_H, LANTERN_UP, LANTERN_ARM, lanternHead } from '../systems/naval/quays.js';

const WOOD = [67, 0];        // the classic ship's own planking: the decks
const WOOD_DARK = [67, 8];   // a darker plank of the same set: the piles, the timbers, the cargo
const IRON = [0, 79];        // #322d22: the bollards, the lanterns' frames
const GLOW = [0, 10];        // #ffc556: a lamp's lit glass
const ROPE = [0, 77];        // #453f2a: the gangway's lines

/** The jetty's rails: their height over its deck and the posts' spacing (m). */
export const RAIL_UP = 1.0;
export const RAIL_STEP = 2;

/** A slab along x from (xa, ya) to (xb, yb), `t` thick, across z0..z1 - a ramp: its top, its foot, its sides, its ends. */
function slab(m, tex, xa, ya, xb, yb, z0, z1, t) {
  const len = Math.hypot(xb - xa, yb - ya) || 1;
  const n = [-(yb - ya) / len, (xb - xa) / len, 0];   // the top's normal, up off the slope
  const P = (x, y, z) => [x, y, z];
  const uv = [[0, 0], [len * 0.5, 0], [len * 0.5, -(z1 - z0) * 0.5], [0, -(z1 - z0) * 0.5]];
  m.quad(tex, P(xa, ya, z0), P(xb, yb, z0), P(xb, yb, z1), P(xa, ya, z1), n, uv);
  m.quad(tex, P(xa, ya - t, z1), P(xb, yb - t, z1), P(xb, yb - t, z0), P(xa, ya - t, z0), [-n[0], -n[1], 0], uv);
  m.quad(tex, P(xa, ya - t, z0), P(xb, yb - t, z0), P(xb, yb, z0), P(xa, ya, z0), [0, 0, -1]);
  m.quad(tex, P(xb, yb - t, z1), P(xa, ya - t, z1), P(xa, ya, z1), P(xb, yb, z1), [0, 0, 1]);
  m.quad(tex, P(xb, yb - t, z0), P(xb, yb - t, z1), P(xb, yb, z1), P(xb, yb, z0), [1, 0, 0]);
  m.quad(tex, P(xa, ya - t, z1), P(xa, ya - t, z0), P(xa, ya, z0), P(xa, ya, z1), [-1, 0, 0]);
}

/** One rail along x, from `xa` to `xb` at `z`: posts every RAIL_STEP and the rail over them. */
function railX(m, xa, xb, z, deck) {
  if (xb - xa < 0.5) return;
  const n = Math.max(1, Math.round((xb - xa) / RAIL_STEP));
  for (let k = 0; k <= n; k++) m.box(WOOD_DARK, [xa + ((xb - xa) * k) / n, deck + RAIL_UP / 2, z], [0.12, RAIL_UP, 0.12], 2);
  m.box(WOOD_DARK, [(xa + xb) / 2, deck + RAIL_UP, z], [xb - xa, 0.1, 0.1], 1);
}

/**
 * A berth's quay (quays.js planQuay's plan) as a model in its frame - dfMeshToModel's shape.
 * @param {any} plan
 */
export function buildQuayModel(plan) {
  const m = new MeshBuilder();
  const { deck } = plan, q = plan.quay, t = QUAY_DECK_T;
  // the deck, its kerb along the face and the timber under the face
  m.box(WOOD, [(q.x0 + q.x1) / 2, deck - t / 2, (q.z0 + q.z1) / 2], [q.x1 - q.x0, t, q.z1 - q.z0], 0.5);
  m.box(WOOD_DARK, [q.x0 + 0.15, deck + 0.075, (q.z0 + q.z1) / 2], [0.3, 0.15, q.z1 - q.z0], 1);
  m.box(WOOD_DARK, [q.x0 + 0.12, deck - t - 0.2, (q.z0 + q.z1) / 2], [0.24, 0.4, q.z1 - q.z0], 1);
  // the jetty to the shore, railed both sides, and its ramp down to a beach
  const j = plan.jetty;
  if (j && j.x1 - j.x0 > 0.05) {
    m.box(WOOD, [(j.x0 + j.x1) / 2, deck - t / 2, (j.z0 + j.z1) / 2], [j.x1 - j.x0, t, j.z1 - j.z0], 0.5);
    railX(m, j.x0 + 0.3, j.x1 - (plan.ramp ? 0 : 1.5), j.z0 + 0.06, deck);
    railX(m, j.x0 + 0.3, j.x1 - (plan.ramp ? 0 : 1.5), j.z1 - 0.06, deck);
  }
  const r = plan.ramp;
  if (r) slab(m, WOOD, r.x0, r.y0, r.x1, r.y1, r.z0, r.z1, t);
  // the piles, down to the bed
  for (const [x, z, foot] of plan.piles) {
    const top = deck - t;
    if (top - foot > 0.05) m.cylinderY(WOOD_DARK, [x, foot, z], PILE_R, top - foot, 6, 1.2, false);
  }
  // the bollards on the face
  for (const [x, z] of plan.bollards) {
    m.cylinderY(IRON, [x, deck, z], BOLLARD_R, BOLLARD_H, 8, 0.5, true);
    m.cylinderY(IRON, [x, deck + BOLLARD_H, z], BOLLARD_R * 1.35, 0.08, 8, 0.5, true);
  }
  // the lantern posts at the back corners, each lantern hung out over the quay toward the water
  for (const [x, z] of plan.lanterns) {
    m.cylinderY(WOOD_DARK, [x, deck, z], 0.09, LANTERN_UP + 0.1, 6, 0.6, true);
    m.box(WOOD_DARK, [x - LANTERN_ARM / 2, deck + LANTERN_UP + 0.04, z], [LANTERN_ARM + 0.12, 0.08, 0.08], 4);
    const [hx, hy, hz] = lanternHead(x, z, deck);
    m.box(IRON, [hx, deck + LANTERN_UP - 0.04, hz], [0.03, 0.08, 0.03]);
    m.box(IRON, [hx, hy + 0.2, hz], [0.24, 0.05, 0.24]);
    m.box(GLOW, [hx, hy, hz], [0.18, 0.32, 0.18]);
    for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]) m.box(IRON, [hx + dx, hy, hz + dz], [0.025, 0.34, 0.025]);
    m.box(IRON, [hx, hy - 0.19, hz], [0.22, 0.05, 0.22]);
  }
  // the cargo: crates, some stacked two high, and barrels
  for (const c of plan.cargo) {
    if (c.kind === 'crate') {
      for (let k = 0; k < c.stack; k++) m.box(WOOD_DARK, [c.x, deck + c.s / 2 + k * c.s, c.z + k * 0.08], [c.s, c.s, c.s], 1 / c.s);
    } else {
      m.cylinderY(WOOD_DARK, [c.x, deck, c.z], c.s, 0.95, 8, 0.95, true);
      m.cylinderY(IRON, [c.x, deck + 0.18, c.z], c.s + 0.015, 0.05, 8, 0.5, false);
      m.cylinderY(IRON, [c.x, deck + 0.72, c.z], c.s + 0.015, 0.05, 8, 0.5, false);
    }
  }
  return m.build();
}

/** The gangway: a plank a metre long along +z, 0.9 wide, its lines on either side - stretched to its length by the
 *  matrix that lays it from the quay to her rail. */
export function buildGangwayModel() {
  const m = new MeshBuilder();
  m.box(WOOD, [0, 0.04, 0.5], [0.9, 0.08, 1], 1);
  for (const x of [-0.42, 0.42]) m.box(ROPE, [x, 0.75, 0.5], [0.035, 0.035, 1], 1);
  for (let k = 0; k <= 4; k++) m.box(WOOD_DARK, [0, 0.09, k / 4 * 0.96 + 0.02], [0.86, 0.03, 0.04], 1);
  return m.build();
}
