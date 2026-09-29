// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIELD BUGS 2026-09-29 (the sea) #4 (the Discord, through Mac: "Water flickers from a distance"): THE WATER'S LAYERS
// IN WINDOW DEPTH. The sea is a stack of sheets a few centimetres apart: the ground under it (the beach at the sea's
// own 34 m, Iliac Puddle No More's carved floor at least 5 cm under it), the sea's surface film over that (Iliac Puddle
// No More's top 3 cm up, SurfaceRenderYOffset; WATER1 a hand's breadth over the ground it lies on), and Come Sail Away's
// breakers 10 cm up (WAVE_LIFT). Unity draws them on a reversed, floating-point depth buffer that parts a centimetre
// at any range; this port's world pass is the GL convention's - a 24-bit buffer, the near plane 0.2 m out - where a
// step of depth is z^2 / (0.2 x 2^24) metres of eye depth: 3 mm at 100 m, 30 cm at 1 km. Seen from a raised eye a
// sheet 3 cm over another is a fraction of a step apart at a few hundred metres, and which of the two a pixel shows is
// the rounding's, which moves with every centimetre the deck bobs the camera: the far beach and the breakers flicker
// (tools/fbseaWaterProbe.mjs measures it on a real pipeline). WATER1 met the same law first and took a polygon offset
// (renderer.js, WATER-AUDIT M3): a nudge in WINDOW depth, so worth one resolvable step at every distance, never a lift
// in metres that is worth nothing past a few hundred. Every sheet of the stack takes it now, in the order the sheets
// stand in, from this one table:
//
//   the ground and the floor .......... 0 (opaque, written)
//   the surface film (the top, WATER1)  SURFACE: it covers what lies under it by two steps
//   Come Sail Away's breakers ......... BREAKERS: they stand over the film by four more - they write their depth, and
//                                       the film is drawn after them and tested against it
//
// The CONSTANT term only (WATER-AUDIT M3's reason: a slope factor grows with the sheet's own depth slope, hundreds of
// units a pixel at a grazing look, and would pull the water in front of a hull or a shore standing above it). What a
// step of bias costs: a sheet shows through what stands within that many steps in front of it - under a millimetre
// at 100 m, and at a kilometre a hull's waterline creeps up by a few centimetres, a fraction of the one pixel it is.
// ═══════════════════════════════════════════════════════════════════

/** polygonOffset's units (constant term, factor 0) for each sheet of the sea, the ground's 0 under them. */
export const WATER_LAYER_UNITS = Object.freeze({
  /** The sea's surface film: Iliac Puddle No More's top and WATER1 - never both over one texel (DW-F). */
  surface: -2,
  /** Come Sail Away's breakers: opaque, written, and drawn before the film - so the film tests against them. */
  breakers: -6,
});

