// @ts-check
// TACT4 - THE SHAPES (three at TACT4, bible/12-Enhanced-AI/Tactics-Arc.md; four more since TELL6), a LEAF: the ground's pass (render/foeTelegraph.js) is
// on the renderer's boot graph and must not bring the brain with it (test/boot2.test.js holds the entry's reach), so the
// numbers both read live here, importing nothing. ai/foeBlows.js re-exports them.

/** The shapes, and every number they carry. Metres, seconds, damage multipliers on the foe's own blow. */
export const BLOW = Object.freeze({
  lunge: Object.freeze({ windup: 0.7, len: 4.5, halfW: 0.6, mult: 1.5 }),
  sweep: Object.freeze({ windup: 0.8, r: 3.2, halfArc: (65 * Math.PI) / 180, mult: 1.25 }),
  slam: Object.freeze({ windup: 0.9, r: 2.0, ahead: 1.0, mult: 1.75 }),
  // TELL6 (bible/12-Enhanced-AI/Feud-Arc.md 8.1): the ring - an annulus about its feet; safe at its feet (the hug
  // answers it), for the player who backs off
  ring: Object.freeze({ windup: 1.0, rIn: 1.6, rOut: 4.0, mult: 1.5 }),
  // TELL6 (8.1): the charge - the gap-closer, begun 5-12 m out: a lane 9 m by 1.6 m it crosses in 0.45 s at its landing
  charge: Object.freeze({ windup: 0.9, len: 9.0, halfW: 0.8, mult: 1.5, cross: 0.45, from: 5, to: 12 }),
  // TELL6 (8.1): the leap - a disc at the target's feet, locked at its start, 3-9 m off; the wind-up a crouch, its last
  // `arc` seconds the jump to the point
  leap: Object.freeze({ windup: 1.0, r: 1.8, mult: 1.6, from: 3, range: 9, arc: 0.35 }),
  // TELL6 (8.1): the aimed shot - a line from the archer to its target, locked at its start; the arrow leaves along it
  // x1.3 as fast (`speed`) and x`mult` its damage. The arrow's own flight decides: stepping off the line dodges it
  aimed: Object.freeze({ windup: 0.6, halfW: 0.25, mult: 1.4, speed: 1.3 }),
});

// TELL2 (bible/12-Enhanced-AI/Feud-Arc.md section 4): the numbers the ground's pass reads beside the brain - their one
// home is here, for the same reason as the shapes'; ai/tells.js's TELL table takes them from here.
/** The last stretch before a landing (s): the glint rises to full and the mark's line brightens ("now"). */
export const TELL_NOW = 0.2;
/** A wind-up this near the player (m)... */
export const TELL_NEAR_M = 6;
/** ...draws at no less than this through the fog (a dungeon's black murk swallowed a mark a step away). */
export const TELL_NEAR_FLOOR = 0.6;
/** TELL3 (section 5): an IRON blow's wind-up runs this much longer than its shape's. */
export const TELL_IRON_EXTRA = 0.2;
/** TELL5 (7.3): a cut feint's mark fades out, dashed, over this (s). */
export const TELL_FEINT_FADE = 0.15;
