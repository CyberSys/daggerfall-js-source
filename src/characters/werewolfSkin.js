// SHADOW-FANG (2026-09-26, Mac): "Wants a custom morrowind werewolf skin (skin base but blacker amd like crimson red
// thru out the edging in the fur, red eyes)" - for SirMcMobdon, whose title and glyph are Shadow Fang
// (ui/playerBadge.js). The werewolf is Bloodmoon's (WEREWOLF1: combat/fpArm.js builds it from the player's own
// Bloodmoon data), so its textures are the player's own files and never this repo's: the skin cannot be a painted
// texture shipped with the build. It is a LAW over the texture's pixels, applied on the way to the GPU, to a copy -
// the decoded texture cache is shared by every rig on the page (the local body and every peer's).
//
// ═══ WHO WEARS IT ══════════════════════════════════════════════════
//
// The holder of the Shadow Fang GLYPH. A glyph is TRUE of a player and rides the identity token the relay verifies,
// so every client in a room reads the same grant off the same signature: the peer who is SirMcMobdon is drawn in it
// on everybody's screen, and nobody can type themselves into it. The player's own screen reads the glyphs the
// account service last stated for this device (net/accountClient.js keeps them on the stored session; systems/
// ownGlyphs.js reads them), so the skin is theirs offline too - a local read of a cosmetic, which only that player sees.
// This module is the LAW alone and imports nothing: the rig (combat/fpArm.js) takes it without the storage.
//
// ═══ THE LAW ═══════════════════════════════════════════════════════
//
// Per texel of an opaque-enough pixel (alpha is kept, a transparent texel is left alone):
//   THE EYES burn red - every texel of a texture whose file names an eye, and anywhere a glow no fur takes: bright and
//   saturated in the yellow-to-cyan hues, or a hot saturated red.
//   THE BASE is the skin's own colour, blacker: a third of its light, some of its colour drained toward its grey - so
//   the wolf is still its own wolf, in shadow.
//   THE EDGING is crimson, through the fur: a strand lighter than the fur around it (the texel's light over its 5x5
//   neighbourhood's), the lit tips (the lightest texels), and the fringe of an alpha-cut fur card (a texel beside a
//   transparent one). Its weight is the strongest of the three, the crimson lit by the texel's own light.

/** The skins that exist, and the glyph that dresses a werewolf in each. */
export const WEREWOLF_SKINS = Object.freeze(['shadowfang']);
export const SKIN_GLYPH = Object.freeze({ shadowfang: 'shadowfang' });

/** The skin a player's glyphs dress their werewolf in, or null. */
export function werewolfSkinOf(glyphs) {
  if (!Array.isArray(glyphs)) return null;
  for (const s of WEREWOLF_SKINS) if (glyphs.includes(SKIN_GLYPH[s])) return s;
  return null;
}

/** Shadow Fang's constants, in one place: the base's light and drain, the three edging rules (low, high, weight),
 *  and the two reds. */
export const SHADOW_FANG = Object.freeze({
  dark: 0.3,                                  // the base keeps this share of its light
  drain: 0.4,                                 // and loses this share of its colour toward its grey
  strand: Object.freeze([0.04, 0.15, 0.85]),  // a strand: its light over the neighbourhood's, low to high, and its weight
  tip: Object.freeze([0.5, 0.85, 0.6]),       // the lit tips: the texel's own light, low to high, and its weight
  fringe: 0.65,                               // an alpha-cut card's fringe
  crimson: Object.freeze([196, 18, 48]),      // #c41230
  eye: Object.freeze([255, 34, 46]),          // #ff222e - the glyph's own eye (ui/playerBadge.js GLYPH_DETAIL)
});

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Is this texture an eye's, by its file name - Morrowind names its eye textures so (tx_*eye*). */
export const isEyeTexture = (file) => /eye/i.test(String(file || ''));

/** A texel that glows the way no fur does: bright and saturated in the yellow-to-cyan hues (a beast's eye), or a hot,
 *  saturated red (an eye already red). */
export function looksLikeEye(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!mx || !d) return false;
  const s = d / mx, v = mx / 255;
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return (v > 0.6 && s > 0.5 && hue >= 40 && hue <= 200) || (v > 0.72 && s > 0.62 && (hue >= 345 || hue <= 12));
}

/** The 5x5 mean light of every texel over its opaque neighbours, wrapping as a tiled texture does - two box passes
 *  over running sums, so a 1024-square texture costs a few million additions and not twenty-five million. */
function neighbourhoodLight(L, A, w, h) {
  const R = 2;
  const sumH = new Float32Array(w * h), cntH = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let dx = -R; dx <= R; dx++) {
        const j = row + (((x + dx) % w) + w) % w;
        if (A[j] >= 128) { s += L[j]; c++; }
      }
      sumH[row + x] = s; cntH[row + x] = c;
    }
  }
  const mean = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let dy = -R; dy <= R; dy++) {
        const j = ((((y + dy) % h) + h) % h) * w + x;
        s += sumH[j]; c += cntH[j];
      }
      mean[y * w + x] = c ? s / c : L[y * w + x];
    }
  }
  return mean;
}

/**
 * SHADOW FANG over one level's RGBA texels (row-major, 4 bytes a texel). Answers a NEW array; the input is never
 * written - it is the shared cache's.
 * @param {Uint8Array} rgba
 * @param {number} w
 * @param {number} h
 * @param {{ eyeTexture?: boolean, isEye?: (r: number, g: number, b: number) => boolean }} [opts]
 */
export function shadowFangPixels(rgba, w, h, { eyeTexture = false, isEye = looksLikeEye } = {}) {
  const k = SHADOW_FANG;
  const n = w * h;
  const out = new Uint8Array(rgba.length);
  const L = new Float32Array(n), A = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
    A[i] = rgba[i * 4 + 3];
  }
  const mean = eyeTexture ? null : neighbourhoodLight(L, A, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2], a = rgba[o + 3];
      out[o + 3] = a;
      if (!a) { out[o] = r; out[o + 1] = g; out[o + 2] = b; continue; }
      const l = L[i];
      if (eyeTexture || isEye(r, g, b)) {
        const q = 0.7 + 0.3 * Math.min(1, l * 2);
        out[o] = Math.round(k.eye[0] * q); out[o + 1] = Math.round(k.eye[1] * q); out[o + 2] = Math.round(k.eye[2] * q);
        continue;
      }
      const grey = l * 255;
      const br = (r * (1 - k.drain) + grey * k.drain) * k.dark;
      const bg = (g * (1 - k.drain) + grey * k.drain) * k.dark;
      const bb = (b * (1 - k.drain) + grey * k.drain) * k.dark;
      let fringe = 0;
      for (let dy = -1; dy <= 1 && !fringe; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          if (A[yy * w + xx] < 128) { fringe = 1; break; }
        }
      }
      const strand = smooth(k.strand[0], k.strand[1], l - mean[i]) * k.strand[2];
      const tip = smooth(k.tip[0], k.tip[1], l) * k.tip[2];
      const wgt = Math.min(1, Math.max(strand, tip, fringe * k.fringe));
      const lit = 0.5 + 0.7 * l;
      out[o] = Math.round(Math.min(255, br * (1 - wgt) + k.crimson[0] * lit * wgt));
      out[o + 1] = Math.round(Math.min(255, bg * (1 - wgt) + k.crimson[1] * lit * wgt));
      out[o + 2] = Math.round(Math.min(255, bb * (1 - wgt) + k.crimson[2] * lit * wgt));
    }
  }
  return out;
}

/** A decoded texture's mips in a skin - every level, each its own copy; a skin nobody has is the mips as they are.
 *  @param {Array<{width: number, height: number, rgba: Uint8Array}>} mips @param {string|null} skin @param {string} [file] */
export function skinMips(mips, skin, file = '') {
  if (skin !== 'shadowfang' || !Array.isArray(mips)) return mips;
  const eyeTexture = isEyeTexture(file);
  return mips.map((m) => ({ ...m, rgba: shadowFangPixels(m.rgba, m.width, m.height, { eyeTexture }) }));
}
