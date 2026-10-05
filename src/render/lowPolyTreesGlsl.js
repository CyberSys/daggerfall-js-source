// @ts-check
// LPT1 (bible/07-Rendering/Low-Poly-Trees.md): THE BILLBOARD PROGRAM'S FRAGMENT HALF OF A LOW-POLY TREE - one home for
// both lanes' billboard shaders (render/renderer.js BB_FS, render/enhancedLighting.js EL_BB_FS), which the vertex
// shader's mesh mode feeds (renderer.js BB_VS: vShade, vOpaque, vFade - 1, 0 and 1 on every flat, so a flat's texel is
// what it was).
//
// - vShade: the tree's own faces lit by the sun's direction and its tint, laid on the texel before either lane lights it.
// - vOpaque: an opaque card (the mod's *_Opaque materials) is never cut by alpha.
// - vFade: THE CROSSFADE between a far picture and its 3D tree, a screen-door over bayer4 (the port's one ordered
//   dither - render/orderedDither.js): a far picture keeps a fragment where the threshold stands under its share (vFade
//   below 1), a tree where it does not (vFade 2 plus the tree's share, 1 less the picture's: 3 less it), so across the
//   band every pixel is one of the two, never both and never neither. 1 (every flat) and 3 (a tree inside the radius)
//   keep every fragment. Wants bayer4 above it.

/** The three inputs, before main. */
export const LPT_FS_HEAD = `
in float vShade;   // LPT1 (render/lowPolyTreesGlsl.js)
in float vOpaque;
in float vFade;
`;

/** On the texel, after both maps are sampled and the quad's margin cleared (SPRITE-GRAD's law: no branch before). */
export const LPT_FS_TEXEL = `
  // LPT1: a low-poly tree's light, its opaque cards, and the crossfade with its far picture (render/lowPolyTreesGlsl.js)
  tex.rgb *= vShade;
  tex.a = max(tex.a, vOpaque);
  if (vFade < 1.0 ? bayer4(gl_FragCoord.xy) + 0.03125 >= vFade : (vFade > 1.5 && vFade < 3.0 && bayer4(gl_FragCoord.xy) + 0.03125 < 3.0 - vFade)) discard;
`;
