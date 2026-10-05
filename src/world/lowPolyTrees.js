// @ts-check
// LPT1 (2026-10-05, the owner: "Next mod to integrate is this ... Its important we make this compatible with seasons
// of daggerfall, ensure performance doesnt take a hit and draw distance can remain the same. A true visual overhaul with
// no performance loss"): LOW POLY TREES 5 (SquidKamer - Kamer), 253 prefabs that stand a 3D tree where a nature flat
// of archives 500-511 stood. bible/07-Rendering/Low-Poly-Trees.md is the design and the record.
//
// THIS MODULE IS PURE (no GL, no fetch): the vendored data's shape (tools/lowPolyTreesExtract.mjs writes it), the
// atlases rebuilt from the player's own pictures, the far picture of each tree, DFU's per-tree draw (scale, tint,
// turn) and the near set - so a node test runs exactly what the game draws.
//
// THE ATLASES ARE DAGGERFALL'S OWN SPRITES. Measured against every record of TEXTURE.500-511, 80-91% of each of the
// mod's 1024x1024 atlases is a classic record copied pixel for pixel - turned or mirrored in places, cut down in
// others - and the five small pictures are classic records whole. A render of game data IS game data
// (01-Overview/Port-Doctrine.md), so no atlas is carried: the extractor wrote each as a list of BLITS (the record, its
// turn, where it lands, the rectangle it may paint) and the atlas is painted here from the player's own records - or,
// under Seasons of the Iliac Bay, from that mod's seasonal picture of the same record, which is what makes the 3D trees
// turn with the seasons. The rest of each atlas is the author's TOP-DOWN crowns (the crown seen from above, folded out
// of the side view and, on the winter atlases, capped with painted snow) - no exact copy of any record, so they are
// not carried either: each is a rectangle and the record it was folded from, and `synthTop` folds a crown of its own
// from the same record (and caps it in winter).

/** The eight ways a record lands on an atlas: bit 0 a mirror in x (first), bits 1-2 the quarter turns after it. */
export const LPT_ORIENTATIONS = 8;

/** The size a record of w x h stands at under orientation `o`. */
export const orientedSize = (w, h, o) => (((o >> 1) & 1) ? [h, w] : [w, h]);

/**
 * The record's pixel that orientation `o` puts at (x, y) of the oriented picture (top-down, both).
 * @returns {[number, number]}
 */
export function orientedSource(o, w, h, x, y) {
  const rot = (o >> 1) & 3;
  let sx, sy;
  if (rot === 0) { sx = x; sy = y; } else if (rot === 1) { sx = y; sy = h - 1 - x; } else if (rot === 2) { sx = w - 1 - x; sy = h - 1 - y; } else { sx = w - 1 - y; sy = x; }
  if (o & 1) sx = w - 1 - sx;
  return [sx, sy];
}

/** Snow's colour on a winter crown, before the texel's own light (a cool white). */
export const LPT_SNOW = Object.freeze([236, 240, 247]);

const hash2 = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/**
 * The crown's box on a side view - the rows at least `share` of the widest row wide, and the columns they span.
 * @param {{width:number,height:number,data:Uint8Array}} src top-down RGBA
 */
export function crownBox(src, share = 0.4) {
  const { width: w, height: h, data } = src;
  const rows = new Int32Array(h);
  let widest = 0;
  for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) n++; rows[y] = n; widest = Math.max(widest, n); }
  let y0 = -1, y1 = -1, x0 = w, x1 = -1;
  for (let y = 0; y < h; y++) {
    if (!widest || rows[y] < share * widest) continue;
    if (y0 < 0) y0 = y;
    y1 = y;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  }
  return y0 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * A TOP-DOWN CROWN folded out of a side view: the crown's box sampled straight and again turned a quarter, so the
 * crown reads round from above, a disc's worth of it; `snow` caps it white, thickest in the middle.
 * @param {{width:number,height:number,data:Uint8Array}} src the record, top-down RGBA
 * @param {number} w @param {number} h the rectangle's size
 * @param {{snow?: boolean}} [opts]
 */
export function synthTop(src, w, h, { snow = false } = {}) {
  const out = new Uint8Array(w * h * 4);
  const box = crownBox(src);
  if (!box || w < 1 || h < 1) return { width: w, height: h, data: out };
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const at = (u, v) => {   // u, v in [-1, 1] across the crown's box
    const x = Math.min(bw - 1, Math.max(0, Math.floor((u * 0.5 + 0.5) * bw))) + box.x0;
    const y = Math.min(bh - 1, Math.max(0, Math.floor((v * 0.5 + 0.5) * bh))) + box.y0;
    return (y * src.width + x) * 4;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1, v = ((y + 0.5) / h) * 2 - 1;
      const r = Math.hypot(u, v);
      if (r > 1) continue;
      let s = at(u, v);
      if (!src.data[s + 3]) s = at(v, -u);
      if (!src.data[s + 3]) continue;
      const d = (y * w + x) * 4;
      let cr = src.data[s], cg = src.data[s + 1], cb = src.data[s + 2];
      if (snow) {
        const k = Math.min(1, Math.max(0, (0.8 - r) / 0.55)) * (0.65 + 0.35 * hash2(x, y));
        const lum = (cr * 0.3 + cg * 0.59 + cb * 0.11) / 255;
        const f = 0.82 + 0.18 * lum;
        cr = Math.round(cr + (LPT_SNOW[0] * f - cr) * k);
        cg = Math.round(cg + (LPT_SNOW[1] * f - cg) * k);
        cb = Math.round(cb + (LPT_SNOW[2] * f - cb) * k);
      }
      out[d] = cr; out[d + 1] = cg; out[d + 2] = cb; out[d + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * A TILED CROP: the rectangle filled with the record's crop (cx, cy, cw, ch) repeated, mirrored at every other repeat so
 * no seam shows; a clear texel of the crop stays clear. Top-down RGBA w x h.
 * @param {{width:number,height:number,data:Uint8Array}} src the record, top-down RGBA
 */
export function tileCrop(src, w, h, cx, cy, cw, ch) {
  const out = new Uint8Array(w * h * 4);
  if (cw < 1 || ch < 1) return { width: w, height: h, data: out };
  for (let y = 0; y < h; y++) {
    const ty = Math.floor(y / ch), my = y % ch;
    const sy = cy + (ty & 1 ? ch - 1 - my : my);
    for (let x = 0; x < w; x++) {
      const tx = Math.floor(x / cw), mx = x % cw;
      const sx = cx + (tx & 1 ? cw - 1 - mx : mx);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const s = (sy * src.width + sx) * 4;
      if (!src.data[s + 3]) continue;
      const d = (y * w + x) * 4;
      out[d] = src.data[s]; out[d + 1] = src.data[s + 1]; out[d + 2] = src.data[s + 2]; out[d + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** A fill's region is laid out in cells this many texels square - a coarse map of where the author's region lies
 *  (a cell is the region's when a quarter of its texels are), never its picture. */
export const LPT_FILL_CELL = 8;

/** A fill's cells, row-major over its rectangle (hex, four cells a digit, the first cell the digit's high bit), or
 *  null for a fill that paints its whole rectangle. */
export function fillCells(fill) {
  const hex = fill[0] === 'top' ? fill[8] : fill[11];
  if (typeof hex !== 'string') return null;
  const cols = Math.ceil(fill[5] / LPT_FILL_CELL), rows = Math.ceil(fill[6] / LPT_FILL_CELL);
  const out = new Uint8Array(cols * rows);
  for (let i = 0; i < out.length; i++) out[i] = (Number.parseInt(hex[i >> 2] ?? '0', 16) >> (3 - (i & 3))) & 1;
  return out;
}

/** A fill's picture: `['top', a, r, x, y, w, h, snow, cells]` folds the record's crown, `['tile', a, r, x, y, w, h,
 *  cx, cy, cw, ch, cells]` tiles a crop of it. */
export function fillPicture(fill, src) {
  const [kind, , , , , w, h] = fill;
  if (kind === 'top') return synthTop(src, w, h, { snow: !!fill[7] });
  if (kind === 'tile') return tileCrop(src, w, h, fill[7], fill[8], fill[9], fill[10]);
  throw new Error(`low poly trees: a fill of kind ${kind}`);
}

/**
 * A blit's erase spans, packed (tools/lowPolyTreesExtract.mjs packErase): `count` spans from `offset`, each three
 * unsigned LEB128 numbers - the row's step down from the last span's (the clip's top first), the span's start past the
 * clip's left edge, its length. Back as the flat [y, x from, x to) list, atlas texels.
 * @param {Uint8Array|null} bytes Trees/atlases.bin
 */
export function decodeErase(bytes, offset, count, clipX0, clipY0) {
  if (!bytes) throw new Error('low poly trees: a packed erase list with no atlases.bin to read it from');
  const out = new Array(count * 3);
  let p = offset, y = clipY0;
  const next = () => { let v = 0, shift = 0, b; do { b = bytes[p++]; v += (b & 0x7f) * 2 ** shift; shift += 7; } while (b & 0x80); return v; };
  for (let i = 0; i < count; i++) {
    y += next();
    const x = clipX0 + next();
    out[i * 3] = y; out[i * 3 + 1] = x; out[i * 3 + 2] = x + next();
  }
  return out;
}

/**
 * AN ATLAS, PAINTED. `spec` is the extractor's: `size`; `blits` - [archive, record, frame, orientation, x, y, clip x0,
 * y0, x1, y1, erase?]: the oriented record's top-left at x, y, painting inside the clip (half-open) every texel of the
 * record but those `erase` names (flat [y, x from, x to) spans, atlas texels - where the author cut the copy or another
 * copy holds the texel; inline, or packed in Trees/atlases.bin as [.., offset, count] - `decodeErase`); and `fills` -
 * the regions no record copies, each painted by `fillPicture` in its own cells (`fillCells`). The first paint of a
 * texel holds it (the extractor's greedy order). `recordRgba` hands a record top-down RGBA at its classic size, or null
 * for one the player's data does not hold (its texels stay clear). Returns the atlas top-down.
 * @param {{size:[number,number], blits:any[][], fills?:any[][]}} spec
 * @param {(archive:number, record:number, frame:number) => ({width:number,height:number,data:Uint8Array}|null)} recordRgba
 * @param {Uint8Array|null} [eraseBytes]
 */
export function composeAtlas(spec, recordRgba, eraseBytes = null) {
  return runSteps(paintAtlas(spec, recordRgba, eraseBytes));
}

/**
 * composeAtlas a blit or a fill at a step - a generator, so the game paints an atlas between frames (one record's
 * worth of texels a step) and the node tests and the tool paint it whole. Its return value is the atlas.
 */
export function* paintAtlas(spec, recordRgba, eraseBytes = null) {
  const [W, H] = spec.size;
  const data = new Uint8Array(W * H * 4);
  const erased = new Uint8Array(W * H);
  for (const blit of spec.blits) {
    const [a, r, f, o, bx, by, x0, y0, x1, y1] = blit;
    const src = recordRgba(a, r, f);
    if (!src) continue;
    const erase = typeof blit[10] === 'number' ? decodeErase(eraseBytes, blit[10], blit[11], x0, y0) : blit[10];
    if (erase) for (let i = 0; i < erase.length; i += 3) erased.fill(1, erase[i] * W + erase[i + 1], erase[i] * W + erase[i + 2]);
    const [ow, oh] = orientedSize(src.width, src.height, o);
    const ya = Math.max(by, y0, 0), yb = Math.min(by + oh, y1, H);
    const xa = Math.max(bx, x0, 0), xb = Math.min(bx + ow, x1, W);
    for (let ty = ya; ty < yb; ty++) {
      for (let tx = xa; tx < xb; tx++) {
        const i = ty * W + tx, d = i * 4;
        if (data[d + 3] || erased[i]) continue;
        const [sx, sy] = orientedSource(o, src.width, src.height, tx - bx, ty - by);
        const s = (sy * src.width + sx) * 4;
        if (!src.data[s + 3]) continue;
        data[d] = src.data[s]; data[d + 1] = src.data[s + 1]; data[d + 2] = src.data[s + 2]; data[d + 3] = 255;
      }
    }
    if (erase) for (let i = 0; i < erase.length; i += 3) erased.fill(0, erase[i] * W + erase[i + 1], erase[i] * W + erase[i + 2]);
    yield;
  }
  for (const fill of spec.fills ?? []) {
    const [, a, r, fx, fy, fw, fh] = fill;
    const src = recordRgba(a, r, 0);
    if (!src) continue;
    const pic = fillPicture(fill, src);
    const cells = fillCells(fill);
    const cols = Math.ceil(fw / LPT_FILL_CELL);
    for (let y = 0; y < fh; y++) {
      const ty = fy + y;
      if (ty < 0 || ty >= H) continue;
      for (let x = 0; x < fw; x++) {
        const tx = fx + x;
        if (tx < 0 || tx >= W) continue;
        if (cells && !cells[Math.floor(y / LPT_FILL_CELL) * cols + Math.floor(x / LPT_FILL_CELL)]) continue;
        const s = (y * fw + x) * 4, d = (ty * W + tx) * 4;
        if (!pic.data[s + 3] || data[d + 3]) continue;
        data[d] = pic.data[s]; data[d + 1] = pic.data[s + 1]; data[d + 2] = pic.data[s + 2]; data[d + 3] = 255;
      }
    }
    yield;
  }
  return { width: W, height: H, data };
}

/** A step generator run to its end - its answer. */
export function runSteps(steps) {
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

/** Rows of a mip level made a step (atlasMipSteps), and triangles of a far picture drawn a step (impostorSteps). */
export const LPT_MIP_ROWS = 64;
export const LPT_IMPOSTOR_TRIS = 256;

/**
 * AN ATLAS'S MIP CHAIN, ALPHA-WEIGHTED: each level's texel the mean of the four below it, its colour taken from the
 * drawn ones alone - so a leaf's edge never darkens toward the clear texels' black at a distance (a mip the GL made
 * would average them in). Level 0 first, down to 1x1; each `{width, height, data}` in the atlas's own row order.
 */
export const atlasMips = (pic) => runSteps(atlasMipSteps(pic));

/** atlasMips a step at a time - LPT_MIP_ROWS rows a step, so the game's build breathes between them. */
export function* atlasMipSteps(pic) {
  const levels = [pic];
  let cur = pic;
  while (cur.width > 1 || cur.height > 1) {
    const w = Math.max(1, cur.width >> 1), h = Math.max(1, cur.height >> 1);
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      if (y && y % LPT_MIP_ROWS === 0) yield;
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(cur.width - 1, x * 2 + dx), sy = Math.min(cur.height - 1, y * 2 + dy);
          const s = (sy * cur.width + sx) * 4, al = cur.data[s + 3];
          r += cur.data[s] * al; g += cur.data[s + 1] * al; b += cur.data[s + 2] * al; a += al;
        }
        const d = (y * w + x) * 4;
        if (a) { data[d] = Math.round(r / a); data[d + 1] = Math.round(g / a); data[d + 2] = Math.round(b / a); }
        data[d + 3] = Math.round(a / 4);
      }
    }
    cur = { width: w, height: h, data };
    levels.push(cur);
  }
  return levels;
}

// ---- the vendored data, read --------------------------------------------------------------------------------------

/** The archives the mod stands trees in. */
export const LPT_ARCHIVES = Object.freeze([500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511]);

/**
 * THE MOD, READ: Trees/trees.json with its two binaries. Each prototype (`ARCHIVE_RECORD`) as its mesh, its root's
 * scale, its submeshes' atlas and cut, and its standing size - the widest it reaches about its root (w, across) and its
 * height above the ground (h), the mesh's box under the root's scale. An atlas named `same` is the other's spec.
 * @param {any} json @param {Uint8Array} treesBin @param {Uint8Array} atlasesBin
 */
export function readLowPolyTrees(json, treesBin, atlasesBin) {
  const atlases = {};
  for (const [name, a] of Object.entries(json.atlases)) atlases[name] = a.same ? { ...json.atlases[a.same], alpha: a.alpha } : a;
  const protos = new Map();
  for (const [key, p] of Object.entries(json.prefabs)) {
    const [archive, record] = key.split('_').map(Number);
    const m = json.meshes[p.mesh];
    const [sx, sy, sz] = p.scale;
    const reach = Math.max(Math.abs(m.min[0] * sx), Math.abs(m.max[0] * sx), Math.abs(m.min[2] * sz), Math.abs(m.max[2] * sz));
    const subs = m.subs.map((sub, i) => {
      const mat = json.materials[p.materials[Math.min(i, p.materials.length - 1)]];
      const atlas = mat?.tex && atlases[mat.tex] ? mat.tex : null;
      return { atlas, opaque: !!atlas && !atlases[atlas].alpha, cutoff: mat?.cutoff ?? 0.5 };
    });
    protos.set(key, { key, archive, record, mesh: p.mesh, scale: p.scale, subs, size: { w: reach * 2, h: Math.max(0.5, m.max[1] * sy) } });
  }
  return { json, treesBin, atlasesBin, atlases, protos, meshes: json.meshes };
}

/** The prototype standing for (archive, record), or null - a record the mod leaves a flat. */
export const lptProto = (lpt, archive, record) => lpt?.protos.get(`${archive}_${record}`) ?? null;

/** The atlases a set of prototypes paints from. */
export const protoAtlases = (protos) => [...new Set(protos.flatMap((p) => p.subs.map((s) => s.atlas).filter(Boolean)))];

// ---- the far picture ------------------------------------------------------------------------------------------------

/** The far picture's texels a metre of the tree's height (the classic flats run about 7-14), and its bounds. */
export const LPT_IMPOSTOR_PER_M = 8;
export const LPT_IMPOSTOR_MIN = 24;
export const LPT_IMPOSTOR_MAX = 256;
/** The light the far picture is drawn under: from the front and above - the same law as the 3D tree's (BB_VS's
 *  0.72 + 0.28 n.l), so the two agree where they hand over. */
export const LPT_IMPOSTOR_LIGHT = Object.freeze([0, 0.6, -0.8]);
const lptShade = (n0, n1, n2) => {
  const l = LPT_IMPOSTOR_LIGHT, len = Math.hypot(n0, n1, n2) || 1;
  return Math.min(1, Math.max(0.5, 0.72 + 0.28 * ((n0 * l[0] + n1 * l[1] + n2 * l[2]) / len)));
};

/**
 * A TREE'S FAR PICTURE: its mesh drawn from the side (looking along +z, orthographic) with its own atlases, each texel
 * nearest-sampled and cut as the tree's own material cuts, lit by LPT_IMPOSTOR_LIGHT - so where a 3D tree gives way to
 * its flat the two are one picture. The picture spans the tree's whole reach (w) and its height above the ground (h),
 * top-down RGBA; the flat stands it at the tree's root.
 * @param {ReturnType<typeof readLowPolyTrees>} lpt
 * @param {any} proto lptProto's
 * @param {(name:string) => ({width:number,height:number,data:Uint8Array}|null)} atlasPic a painted atlas, top-down
 */
export const renderImpostor = (lpt, proto, atlasPic) => runSteps(impostorSteps(lpt, proto, atlasPic));

/** renderImpostor a step at a time - LPT_IMPOSTOR_TRIS triangles a step. */
export function* impostorSteps(lpt, proto, atlasPic) {
  const { w, h } = proto.size;
  const H = Math.round(Math.min(LPT_IMPOSTOR_MAX, Math.max(LPT_IMPOSTOR_MIN, h * LPT_IMPOSTOR_PER_M)));
  const W = Math.max(4, Math.round((H * w) / h));
  const data = new Uint8Array(W * H * 4);
  const depth = new Float32Array(W * H).fill(Infinity);
  const m = lpt.meshes[proto.mesh];
  const f = new Float32Array(lpt.treesBin.buffer, lpt.treesBin.byteOffset, lpt.json.vertexBytes / 4);
  const ix = new Uint16Array(lpt.treesBin.buffer, lpt.treesBin.byteOffset + lpt.json.vertexBytes, (lpt.treesBin.byteLength - lpt.json.vertexBytes) >> 1);
  const [sx, sy, sz] = proto.scale;
  const toX = (x) => ((x * sx) / w + 0.5) * W, toY = (y) => (1 - (y * sy) / h) * H;
  for (let si = 0; si < m.subs.length; si++) {
    const [at, n] = m.subs[si];
    const sub = proto.subs[si];
    const pic = sub?.atlas ? atlasPic(sub.atlas) : null;
    if (!pic) continue;
    for (let t = 0; t < n; t += 3) {
      if (t && (t / 3) % LPT_IMPOSTOR_TRIS === 0) yield;
      const v = [0, 1, 2].map((k) => m.vertex + ix[m.index + at + t + k]);
      const P = v.map((i) => [toX(f[i * 8]), toY(f[i * 8 + 1]), f[i * 8 + 2] * sz]);
      const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const b0 = ((P[1][0] - px) * (P[2][1] - py) - (P[2][0] - px) * (P[1][1] - py)) / area;
          const b1 = ((P[2][0] - px) * (P[0][1] - py) - (P[0][0] - px) * (P[2][1] - py)) / area;
          const b2 = 1 - b0 - b1;
          if (b0 < 0 || b1 < 0 || b2 < 0) continue;
          const z = b0 * P[0][2] + b1 * P[1][2] + b2 * P[2][2];
          const i = y * W + x;
          if (z >= depth[i]) continue;
          const u = b0 * f[v[0] * 8 + 6] + b1 * f[v[1] * 8 + 6] + b2 * f[v[2] * 8 + 6];
          const vv = b0 * f[v[0] * 8 + 7] + b1 * f[v[1] * 8 + 7] + b2 * f[v[2] * 8 + 7];
          const tx = Math.min(pic.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * pic.width)));
          const ty = Math.min(pic.height - 1, Math.max(0, Math.floor((1 - (vv - Math.floor(vv))) * pic.height)));   // uv's v=0 is the picture's bottom
          const s = (ty * pic.width + tx) * 4;
          if (!sub.opaque && pic.data[s + 3] < 128) continue;
          const sh = lptShade(b0 * f[v[0] * 8 + 3] + b1 * f[v[1] * 8 + 3] + b2 * f[v[2] * 8 + 3], b0 * f[v[0] * 8 + 4] + b1 * f[v[1] * 8 + 4] + b2 * f[v[2] * 8 + 4], b0 * f[v[0] * 8 + 5] + b1 * f[v[1] * 8 + 5] + b2 * f[v[2] * 8 + 5]);
          depth[i] = z;
          data[i * 4] = Math.round(pic.data[s] * sh); data[i * 4 + 1] = Math.round(pic.data[s + 1] * sh); data[i * 4 + 2] = Math.round(pic.data[s + 2] * sh); data[i * 4 + 3] = 255;
        }
      }
    }
  }
  return { width: W, height: H, data };
}

// ---- a tree's own draw ----------------------------------------------------------------------------------------------

/** DFU's terrain tree (MeshReplacement.ImportNatureGameObject's callbacks): a scale of 0.6 to 1.4 and a tint between
 *  white and Color.grey; the far pictures' batch is sized for the tallest. */
export const LPT_SCALE_MIN = 0.6;
export const LPT_SCALE_MAX = 1.4;
export const LPT_TINT_GREY = 0.5;

const unit = (a, b, c, salt) => {
  let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791) ^ Math.imul(salt, 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/**
 * A TREE'S OWN DRAW - its scale, its tint (the multiplier its colour takes) and its turn (radians), a function of where it
 * stands so every client and every rebuild stands the same tree. A wilderness tree takes DFU's terrain variety; a
 * location's takes the prefab as it is, turned (ImportCustomFlatGameobject: no scale, no tint).
 * @param {number} px @param {number} py its map pixel @param {number} x @param {number} z its place in the pixel (m)
 * @param {boolean} location a flat of a location's block
 */
export function lptVariety(px, py, x, z, location) {
  const qx = Math.round(x * 16), qz = Math.round(z * 16), k = Math.imul(px, 1009) + py;
  const yaw = unit(qx, qz, k, 1) * Math.PI * 2;
  if (location) return { scale: 1, tint: 1, yaw };
  return { scale: LPT_SCALE_MIN + (LPT_SCALE_MAX - LPT_SCALE_MIN) * unit(qx, qz, k, 2), tint: 1 - LPT_TINT_GREY * unit(qx, qz, k, 3), yaw };
}

// ---- the near set ---------------------------------------------------------------------------------------------------

/** The 3D trees stand within this radius of the eye (m) and crossfade with their far pictures across the band past it.
 *  The far pictures stand everywhere else, out to the land view's whole reach, at a flat's own cost. */
export const LPT_NEAR_M = 140;
export const LPT_BAND_M = 20;

/**
 * THE NEAR SET: every standing tree within `radius + band` of the eye (x, z - scene metres), as instances grouped by
 * prototype. `sets` - each pixel's trees: `{ ox, oy, oz }` its translation into the scene, `protos` the prototypes, and
 * `trees` a Float32Array of [proto index, x, y, z (pixel-local), scale, tint, yaw] a tree; `skip(set, i)` a tree that
 * stands no more (a felled one). Writes into `out` (grown as needed) and answers the runs.
 * @returns {{ data: Float32Array, count: number, runs: { proto: any, start: number, count: number }[] }}
 */
export function gatherNear(sets, eyeX, eyeZ, radius, band, out = null, skip = null) {
  const reach = radius + band, r2 = reach * reach;
  /** @type {Map<any, number[]>} */
  const byProto = new Map();
  let count = 0;
  for (const set of sets) {
    const t = set.trees;
    for (let i = 0; i < t.length; i += 7) {
      const x = t[i + 1] + set.ox, z = t[i + 3] + set.oz;
      const dx = x - eyeX, dz = z - eyeZ;
      if (dx * dx + dz * dz > r2) continue;
      if (skip && skip(set, i / 7)) continue;
      const proto = set.protos[t[i]];
      let l = byProto.get(proto);
      if (!l) byProto.set(proto, (l = []));
      l.push(x, t[i + 2] + set.oy, z, t[i + 6], t[i + 4], t[i + 5]);
      count++;
    }
  }
  let data = out;
  if (!data || data.length < count * 6) data = new Float32Array(Math.max(count * 6, (out?.length ?? 0) * 2, 6144));
  const runs = [];
  let at = 0;
  for (const [proto, l] of byProto) {
    data.set(l, at * 6);
    runs.push({ proto, start: at, count: l.length / 6 });
    at += l.length / 6;
  }
  return { data, count, runs };
}
