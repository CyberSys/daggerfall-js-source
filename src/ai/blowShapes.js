// @ts-check
// TACT4 - THE THREE SHAPES (bible/12-Enhanced-AI/Tactics-Arc.md), a LEAF: the ground's pass (render/foeTelegraph.js) is
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
