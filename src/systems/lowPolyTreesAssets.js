// @ts-check
// LPT1 (bible/07-Rendering/Low-Poly-Trees.md): LOW POLY TREES IN THE GAME - the host's one door.
//
// - THE DATA is fetched once, the first time a pixel asks for a tree (vendor/low-poly-trees/Trees/, ~3 MB, a page that
//   never stands a nature flat never fetches it).
// - THE ATLASES are painted from the player's own pictures (world/lowPolyTrees.js paintAtlas) a record a step between
//   the build's breaths, their mips alpha-weighted (atlasMips), uploaded bottom-up - the port's texel order - and kept
//   for the source they were painted from: the classic records, or Seasons of the Iliac Bay's seasonal picture of each
//   record it manages (`seasonal`), so the 3D trees take the season the flats take.
// - THE FAR PICTURE of each prototype (renderImpostor) is uploaded as a flat's texture under the archive, keyed by the
//   record and the source (`${record}#lpt${source}`), and stands where the classic flat stood, out to the land view's
//   whole reach, at a flat's own cost: one quad a tree.
// - THE NEAR SET: each frame the trees within LPT_NEAR_M + LPT_BAND_M of the eye (world/lowPolyTrees.js gatherNear,
//   re-gathered when the eye has moved a few metres or the pixels changed), one instanced draw a prototype's submesh.
import { readLowPolyTrees, lptProto, paintAtlas, atlasMipSteps, impostorSteps, gatherNear, LPT_NEAR_M, LPT_BAND_M, LPT_SCALE_MAX } from '../world/lowPolyTrees.js';
import { toColor32 } from '../formats/color32Order.js';
import { classicRecordRgba } from '../formats/derivedTexture.js';
import { LowPolyTreesGpu, LPT_INSTANCE_FLOATS } from '../render/lowPolyTreesRender.js';

export const LPT_TREES_JSON_URL = new URL('../../vendor/low-poly-trees/Trees/trees.json', import.meta.url).href;
export const LPT_TREES_BIN_URL = new URL('../../vendor/low-poly-trees/Trees/trees.bin', import.meta.url).href;
export const LPT_ATLASES_BIN_URL = new URL('../../vendor/low-poly-trees/Trees/atlases.bin', import.meta.url).href;

/** The eye moves this far (m) before the near set is gathered again. */
export const LPT_REGATHER_M = 3;
/** The sources whose atlases and far pictures are kept: the season standing and the one before it, whose flats the
 *  re-skin is still rebuilding - an older one's are freed as a third is first painted. */
export const LPT_SOURCES_KEPT = 2;

const defaultFetch = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};

/** A top-down RGBA picture resampled (nearest) to w x h. */
export function resampleRgba(pic, w, h) {
  if (pic.width === w && pic.height === h) return pic;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(pic.height - 1, Math.floor(((y + 0.5) * pic.height) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(pic.width - 1, Math.floor(((x + 0.5) * pic.width) / w));
      data.set(pic.data.subarray((sy * pic.width + sx) * 4, (sy * pic.width + sx) * 4 + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

/** A port-order (bottom-up) colour picture back top-down, its alpha cut to 0 or 255 as a flat's is. */
export function topDownOf(color32) {
  const { width: w, height: h } = color32;
  const src = color32.colors ?? color32.data;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4;
      data[d] = src[s]; data[d + 1] = src[s + 1]; data[d + 2] = src[s + 2]; data[d + 3] = src[s + 3] >= 128 ? 255 : 0;
    }
  }
  return { width: w, height: h, data };
}

/**
 * @param {{ renderer: any, getTexture: (archive:number) => Promise<any>,
 *   seasonal?: { key: () => string, picture: (archive:number, record:number) => any } | null,
 *   fetchBytes?: (url:string) => Promise<Uint8Array>, breathe?: () => Promise<void>, warn?: (m:string) => void }} deps
 *   `seasonal.picture` - Seasons of the Iliac Bay's texture for a record (its `image` in the port's order), or null
 */
export function createLowPolyTrees({ renderer, getTexture, seasonal = null, fetchBytes = defaultFetch, breathe = async () => {}, warn = (m) => console.warn(m) }) {
  /** @type {ReturnType<typeof readLowPolyTrees>|null} */
  let lpt = null;
  /** @type {Promise<any>|null} */
  let loading = null;
  let failed = false;
  /** @type {LowPolyTreesGpu|null} */
  let gpu = null;
  /** `${atlas}|${source}` -> Promise<{ tex, pic }> */
  const atlases = new Map();
  /** `${proto}|${source}` -> Promise<{ record, size }> */
  const pictures = new Map();
  /** what a frame reads: `${atlas}|${source}` -> the atlas's texture, once painted */
  const ready = new Map();
  /** the sources painted, oldest first (LPT_SOURCES_KEPT) */
  const sources = [];
  /** counts every atlas painted or freed - the frame's runs are made again when it moves */
  let readyGen = 0;
  /** THE FRAME'S HAND-OFF, one object for the session: the runs made for `from` (a gather) under `source` at `readyGen` */
  const out = { from: null, source: '', readyGen: -1, runs: [], cut: new Set(), frame: { eye: [0, 0, 0], radius: LPT_NEAR_M, band: LPT_BAND_M, gpu: null, runs: [], cut: new Set() } };
  let data = new Float32Array(0), gathered = null, lastEye = null, lastStamp = NaN;
  /** the sets the last gather read, each with the translation it read it at - [set, ox, oy, oz] */
  const lastSets = [];
  /** Are `sets` the ones the last gather read, where it read them? (A recentre moves every one.) */
  const sameSets = (sets) => {
    if (sets.length !== lastSets.length) return false;
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i], l = lastSets[i];
      if (l[0] !== s || l[1] !== s.ox || l[2] !== s.oy || l[3] !== s.oz) return false;
    }
    return true;
  };

  const sourceKey = () => seasonal?.key?.() ?? '';

  /** A record top-down at its classic size - the season's picture when it has one, else the player's own record. */
  const recordRgba = (textures) => (archive, record, frame) => {
    const t = textures.get(archive);
    if (!t || record >= t.recordCount) return null;
    const bm = t.getDFBitmap(record, frame);
    if (!bm?.width) return null;
    const sib = frame === 0 ? seasonal?.picture?.(archive, record) : null;
    const img = sib?.image ?? sib;
    if (img?.width) return resampleRgba(topDownOf(img), bm.width, bm.height);
    return classicRecordRgba(bm, t.palette);
  };

  /** The atlas painted (between breaths) and uploaded - its GL texture and its top-down picture. */
  function atlas(name, source) {
    const k = `${name}|${source}`;
    if (!atlases.has(k)) {
      atlases.set(k, (async () => {
        const spec = lpt.atlases[name];
        const archives = new Set([...spec.blits.map((b) => b[0]), ...(spec.fills ?? []).map((f) => f[1])]);
        const textures = new Map();
        for (const a of archives) textures.set(a, await getTexture(a));
        const pic = await stepped(paintAtlas(spec, recordRgba(textures), lpt.atlasesBin));
        const mips = await stepped(atlasMipSteps(pic));
        if (!sources.includes(source)) return { tex: null, pic };   // its source freed while it painted: nothing kept
        const tex = await uploadAtlas(mips);
        ready.set(k, tex); readyGen++;
        return { tex, pic };
      })());
    }
    return atlases.get(k);
  }

  /** A step generator run between the build's breaths - its answer. */
  async function stepped(steps) {
    let r = steps.next();
    while (!r.done) { await breathe(); r = steps.next(); }   // the breather yields only once the build's slice is spent
    await breathe();
    return r.value;
  }

  /** The atlas's texture: its mip chain (atlasMips, alpha-weighted), each level bottom-up (a mesh's uv v=0 is its picture's bottom), a breath between levels, sampled as a classic flat is - nearest, the mips between. */
  async function uploadAtlas(mips) {
    const gl = renderer.gl;
    const tex = gl.createTexture();
    for (let i = 0; i < mips.length; i++) {
      const lv = mips[i], c = toColor32(lv);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, lv.width, lv.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, c.colors);
      gl.bindTexture(gl.TEXTURE_2D, null);
      renderer._tex0Bound = null;
      if (i < 2) await breathe();
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    renderer._tex0Bound = null;
    return tex;
  }

  /** A source is painted: the oldest past LPT_SOURCES_KEPT gives its atlases and far pictures back. */
  function noteSource(source) {
    if (sources.includes(source)) return;
    sources.push(source);
    while (sources.length > LPT_SOURCES_KEPT) freeSource(/** @type {string} */ (sources.shift()));
  }
  /** EVERY ALLOCATION HAS AN OWNER: a source's atlases (and their pictures) and far pictures, freed. */
  function freeSource(source) {
    const tail = `|${source}`;
    for (const [k, p] of atlases) {
      if (!k.endsWith(tail)) continue;
      atlases.delete(k); ready.delete(k); readyGen++;
      p.then((a) => a?.tex && renderer.gl.deleteTexture(a.tex)).catch(() => {});
    }
    for (const [k, p] of pictures) {
      if (!k.endsWith(tail)) continue;
      pictures.delete(k);
      p.then((r) => r && renderer.releaseTexture(r.archive, r.record)).catch(() => {});
    }
  }

  return {
    /** Fetched and read once; null when the data cannot be had (the trees stay flats). */
    load() {
      if (lpt || failed) return Promise.resolve(lpt);
      loading ??= (async () => {
        try {
          const [j, tb, ab] = await Promise.all([fetchBytes(LPT_TREES_JSON_URL), fetchBytes(LPT_TREES_BIN_URL), fetchBytes(LPT_ATLASES_BIN_URL)]);
          lpt = readLowPolyTrees(JSON.parse(new TextDecoder().decode(j)), tb, ab);
          gpu = new LowPolyTreesGpu(renderer.gl, lpt.json, tb);
        } catch (e) {
          failed = true;
          warn(`[trees] Low Poly Trees could not load: ${e?.message ?? e}`);
        }
        return lpt;
      })();
      return loading;
    },
    get loaded() { return !!lpt; },
    /** The prototype standing for (archive, record), or null. */
    proto: (archive, record) => lptProto(lpt, archive, record),
    sourceKey,
    /**
     * A PROTOTYPE'S FAR PICTURE, ready to batch: its atlases painted for the source and the picture uploaded as the
     * archive's flat - `{ record, size }` for createBillboardBatch (sized for the tallest tree, LPT_SCALE_MAX; each
     * tree's own share rides its corner), or null when a record the player's data lacks leaves it unpaintable.
     */
    farPicture(proto) {
      const source = sourceKey();
      const k = `${proto.key}|${source}`;
      noteSource(source);
      if (!pictures.has(k)) {
        pictures.set(k, (async () => {
          const pics = new Map();
          for (const s of proto.subs) if (s.atlas && !pics.has(s.atlas)) pics.set(s.atlas, (await atlas(s.atlas, source)).pic);
          await breathe();
          const pic = await stepped(impostorSteps(lpt, proto, (n) => pics.get(n) ?? null));
          const record = `${proto.record}#lpt${source}`;
          if (!sources.includes(source)) return null;   // its source freed while it painted
          renderer.uploadTexture(proto.archive, record, toColor32(pic));
          return { archive: proto.archive, record, size: { w: proto.size.w * LPT_SCALE_MAX, h: proto.size.h * LPT_SCALE_MAX } };
        })().catch((e) => { warn(`[trees] ${proto.key}: ${e?.message ?? e}`); return null; }));
      }
      return pictures.get(k);
    },
    /** Is every atlas a prototype's 3D tree draws with painted for the source its far picture was? */
    nearReady(proto) {
      const source = sourceKey();
      return proto.subs.every((s) => !s.atlas || ready.has(`${s.atlas}|${source}`));
    },
    /**
     * THE FRAME: the near set gathered (again only when the eye moved LPT_REGATHER_M, or the pixels or where they stand
     * changed - `sets` may be the caller's scratch, refilled each frame) and handed to the renderer, or nothing when
     * there is none. `sets` - gatherNear's, and `skip` its; `swayOf(proto)` its share of the wind's lean
     * (systems/windDrive.js floraSwayOf, as its flats take it); `stamp` a count that moves when a tree is felled or
     * stood again (scenes/treeHost.js FOREST_STAMP).
     * @param {any[]} sets @param {number} ex @param {number} ey @param {number} ez
     * @param {{ skip?: (set:any, i:number) => boolean, swayOf?: (proto:any) => number, stamp?: number }} [opts]
     */
    frame(sets, ex, ey, ez, { skip = null, swayOf = null, stamp = 0 } = {}) {
      if (!gpu || !lpt) { renderer.setLowPolyTrees(null); return; }
      const moved = !lastEye || Math.hypot(ex - lastEye[0], ez - lastEye[2]) > LPT_REGATHER_M;
      if (moved || stamp !== lastStamp || !sameSets(sets) || !gathered) {
        gathered = gatherNear(sets, ex, ez, LPT_NEAR_M, LPT_BAND_M + LPT_REGATHER_M, data, skip);   // the band and the way the eye may go before the next gather: a tree it walks into the band toward is there
        data = gathered.data;
        gpu.setInstances(data, gathered.count);
        lastEye = [ex, ey, ez]; lastStamp = stamp;
        lastSets.length = 0;
        for (const s of sets) lastSets.push([s, s.ox, s.oy, s.oz]);
      }
      // the runs, made again only when the gather, the source or the painted atlases changed - a frame between hands
      // the renderer the same object, its eye moved (nothing allocated a frame)
      const source = sourceKey();
      if (out.from !== gathered || out.source !== source || out.readyGen !== readyGen) {
        out.from = gathered; out.source = source; out.readyGen = readyGen;
        out.runs = []; out.cut = new Set();
        for (const r of gathered.runs) {
          const p = r.proto;
          const subs = [];
          let ok = true;
          lpt.meshes[p.mesh].subs.forEach((_, i) => {
            const s = p.subs[i];
            const at = gpu.subs[p.mesh][i];
            const tex = s.atlas ? ready.get(`${s.atlas}|${source}`) ?? null : null;
            if (s.atlas && !tex) ok = false;
            subs.push({ offset: at[0], count: at[1], tex, opaque: s.opaque });
          });
          if (!ok) continue;
          out.cut.add(p);
          out.runs.push({ start: r.start, count: r.count, scale: p.scale, size: [p.size.w, p.size.h], sway: swayOf ? swayOf(p) : 0, subs });
        }
      }
      out.frame.eye[0] = ex; out.frame.eye[1] = ey; out.frame.eye[2] = ez;
      out.frame.gpu = gpu; out.frame.runs = out.runs; out.frame.cut = out.cut;
      renderer.setLowPolyTrees(out.runs.length ? out.frame : null);
    },
    /** Forget the near set (a teardown, an interior). */
    clearFrame() { renderer.setLowPolyTrees(null); gathered = null; lastSets.length = 0; out.from = null; },
    /** EVERY ALLOCATION HAS AN OWNER: the buffers and the atlases' textures. */
    destroy() {
      renderer.setLowPolyTrees(null);
      gpu?.destroy(); gpu = null;
      for (const s of sources.splice(0)) freeSource(s);
      atlases.clear(); pictures.clear(); ready.clear();
    },
    /** For the tests and the probes. */
    get _lpt() { return lpt; },
    LPT_INSTANCE_FLOATS,
  };
}
