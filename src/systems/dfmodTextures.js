// DFMOD1 - ANY DAGGERFALL UNITY TEXTURE MOD, ATTACHED BY THE PLAYER.
//
// Until this door every `.dfmod` the port read had a module of its own
// (Seasons of the Iliac Bay, Weapon Widget, Diverse Weapons), because
// each came with a script whose law lives in the port. A pure texture
// mod - DREAM 90s's eight bundles, and the hundreds like it - carries no
// law at all: it is DFU's asset-injection folder packed into a UnityFS
// bundle, the same `003_5-0` / `235_56-0_Aquamarine` / `FACES.CIF_14-0`
// / `SCBG04I0.IMG` names a loose pack uses, plus the `.xml` sidecars
// (`<scaleX>` for a billboard, `<rect>` for a paperdoll sprite). So one
// door serves them all:
//
//   - archive-named textures go on the texture door's BUNDLE tier
//     (systems/textureReplacement.js setBundleTextures) - world flats,
//     walls, mobs, NPCs, item icons and paperdoll items by dye, with the
//     `_Mask` map beside them; the other maps (Normal, Height, Emission,
//     ...) have no reader in the port and are not registered;
//   - billboard xml scales go on world/billboardXml.js's registry;
//   - IMG and CIF/RCI names (paperdoll backgrounds, bodies, heads, talk
//     portraits) answer `dfmodImgImage` / `dfmodCifRciImage` for the
//     screens that draw them.
//
// THE INDEX IS STORED, THE BUNDLE IS OPENED LATE. Opening a bundle is
// seconds of LZ4 (DREAM's textures are 383 MB), so at attach time the
// bundle is opened once, its names written beside it as a small JSON
// (`dfmod-index/<file>`), and closed. A boot registers from the JSON
// alone; a bundle is opened - in a worker, formats/unityBundleClient.js
// - the first time one of its pictures is asked for. The paperdoll's
// 330 MB is never opened by a player who never looks at the doll.
//
// Nothing here touches the DOM: the store and the opener are handed in.

import { openUnityBundle } from '../formats/unityBundleClient.js';
import { createBundlePool } from '../formats/unityBundlePool.js';   // DFMOD3: a few shared workers, not one per mod
import { resampleRgba } from '../formats/resample.js';
import { textureEntry, setBundleTextures, textureReplacementEnabled } from './textureReplacement.js';
import { toColor32 } from '../formats/color32Order.js';   // GROUND1: the terrain's layers are world texels, bottom row first
import { registerBillboardXml, unregisterBillboardXml } from '../world/billboardXml.js';

export const DFMOD_PREFIX = 'dfmod/';               // the stored key of a bundle (seasonsIliacBayAssets' DFMOD_KEY_PREFIX)
export const DFMOD_INDEX_PREFIX = 'dfmod-index/';   // the stored key of its name index
export const DFMOD_INDEX_VERSION = 2;   // GROUND1: 2 carries the texture arrays; a v1 index is rebuilt in the background

// ---- DFMOD2: BIG MODS (DREAM's full-resolution set, gigabytes a bundle) --------------------------------------------
// A multi-gigabyte bundle read whole into memory was a blank screen: the boot awaited it (a bundle stored without an
// index was indexed there), and the first archive's preload awaited its open. Now:
//   - a bundle is read BY RANGE in its worker from the stored Blob (unityBundleWorker blobSource) - never whole;
//   - the boot registers from stored indexes only; a missing one is built in the background, and lands as a new
//     generation the doll, the icons and the next area pick up;
//   - a picture bigger than the chosen detail is decoded from a smaller MIP (unityBundle mipLevelFor);
//   - no picture ask waits on a bundle's open longer than OPEN_WAIT_MS: that archive draws the classic art this
//     time rather than the game standing on a blank screen.
/** The texture-detail choices, in pixels on the longer side (0 = the mod's full resolution). */
export const DFMOD_DETAIL = Object.freeze([256, 512, 1024, 0]);
// 256 by default: a DREAM HD monster is hundreds of frames, and every decoded frame stays in memory as the picture
// the renderer uploads - at 512 a dungeon's worth ran the tab out of memory (a player's log, 2026-09-27)
export const DFMOD_DETAIL_DEFAULT = 256;
let _detail = () => DFMOD_DETAIL_DEFAULT;
/** The host's detail setting (a getter, read at every decode). */
export function setDfmodDetailSource(fn) { _detail = typeof fn === 'function' ? fn : () => DFMOD_DETAIL_DEFAULT; }
/** The longest side a decode keeps: the setting, the default when it is unset, Infinity for 0 (full). */
export const dfmodMaxSize = () => {
  const v = _detail();
  const d = v == null || v === '' || !Number.isFinite(Number(v)) ? DFMOD_DETAIL_DEFAULT : Number(v);
  return d > 0 ? d : Infinity;
};
const maxSize = dfmodMaxSize;
export const OPEN_WAIT_MS = 20000;
/** DFMOD3: how long a picture ask may wait in the pool's queue before it is dropped (the classic art draws). */
export const ASK_DEADLINE_MS = 15000;
let _pool = null;
/** The default opener: the shared pool when there are workers (a browser), else this thread (node, a test). */
const poolOpen = (src, opts) => {
  if (typeof Worker === 'undefined') return openUnityBundle(src, opts);
  _pool ??= createBundlePool({ size: 2 });
  return _pool.open(src, opts);
};

/** The stored key for a picked `.dfmod` - lower-cased basename, the shape the other doors already read. */
export const dfmodStoreKey = (fileName) => {
  const base = String(fileName ?? '').replace(/\\/g, '/').split('/').pop();
  return /\.dfmod$/i.test(base) ? DFMOD_PREFIX + base.toLowerCase() : null;
};
export const dfmodIndexKey = (storeKey) => DFMOD_INDEX_PREFIX + String(storeKey).slice(DFMOD_PREFIX.length);

/** Mods with a door of their own (a script the port carries) - read there, not here. */
export const hasOwnDoor = (storeKey) => /season|weapon.?widget/i.test(String(storeKey)) || isOriginalDiverseWeapons(storeKey);
/** DWHD1: RealAKP's Diverse Weapons bundle has a door of its own; the HD REPLACERS for it (DeBlue's "Diverse Weapons HD
 *  - Handhelds I/II", "- Inventory") are plain texture mods under the same words, and were refused by both doors - the
 *  generic one skipped them by name, the Diverse Weapons one by GUID. An HD name comes here. */
export const isOriginalDiverseWeapons = (storeKey) => /diverse.?weapons/i.test(String(storeKey)) && !/\bhd\b/i.test(String(storeKey));
/** A handheld weapon frame is drawn large; it keeps at least this much of its detail whatever the texture detail. */
export const WEAPON_FRAME_MIN_SIZE = 512;

/** The maps a port reader asks for. */
const USED_MAPS = new Set(['Albedo', 'Mask']);
/** Archives whose records are drawn one at a time by the icon and paperdoll doors (and are thousands, per dye):
 *  never decoded by an archive preload. */
const isItemArchive = (a) => a >= 233 && a <= 252;

/** XMLManager.GetRect: x, y, width, height over the rect's `scale`. */
export function xmlRect(text) {
  const m = /<rect\s+scale="([\d.]+)"\s*>[\s\S]*?<x>(-?[\d.]+)<\/x>\s*<y>(-?[\d.]+)<\/y>\s*<width>(-?[\d.]+)<\/width>\s*<height>(-?[\d.]+)<\/height>/.exec(text);
  if (!m) return null;
  const s = Number(m[1]) || 1;
  return { x: Number(m[2]) / s, y: Number(m[3]) / s, width: Number(m[4]) / s, height: Number(m[5]) / s };
}
/** SetBillboardScale's `<scaleX>`/`<scaleY>`, or null. */
export function xmlScale(text) {
  const x = /<scaleX>\s*(-?[\d.]+)\s*<\/scaleX>/.exec(text);
  const y = /<scaleY>\s*(-?[\d.]+)\s*<\/scaleY>/.exec(text);
  if (!x && !y) return null;
  return [x ? Number(x[1]) : 1, y ? Number(y[1]) : 1];
}

/** The manifest (the `<title>.dfmod` text asset), or null. */
function manifestOf(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try { return JSON.parse(t.text); } catch { /* not this one */ }
  }
  return null;
}

/** The name index of an opened bundle - what is stored beside it. */
export function buildDfmodIndex(bundle) {
  const manifest = manifestOf(bundle) ?? {};
  const xml = {};
  for (const t of bundle.textAssets ?? []) {
    if (/\.dfmod$/i.test(t.name)) continue;
    let text;
    try { text = t.text; } catch { continue; }
    if (/<info>/i.test(text) && (/<scale[XY]>/i.test(text) || /<rect/i.test(text))) xml[t.name] = text;
  }
  return {
    v: DFMOD_INDEX_VERSION,
    title: manifest.ModTitle ?? null, version: manifest.ModVersion ?? null, author: manifest.ModAuthor ?? null, guid: manifest.GUID ?? null,
    textures: (bundle.textures ?? []).map((t) => [t.name, t.width, t.height]),
    arrays: (bundle.arrays ?? []).map((a) => [a.name, a.width, a.height, a.depth]),   // GROUND1
    xml,
  };
}

/** Open a bundle's bytes, index it and close it - the attach step. */
export async function indexDfmodBytes(bytes, { open = openUnityBundle } = {}) {
  const isBlob = typeof Blob !== 'undefined' && bytes instanceof Blob;   // DFMOD2: a picked File is read by range
  const bundle = await open(isBlob || bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  try { return buildDfmodIndex(bundle); } finally { try { bundle.close?.(); } catch { /* gone */ } }
}

// ---- the registry ------------------------------------------------------

let _mods = [];                 // [{ key, index }] in attach order
let _open = new Map();          // store key -> Promise<bundle client | null>
let _openErrors = new Map();    // DFMOD2: store key -> why it would not open (the packs card says so)
let _img = new Map();           // 'SCBG04I0.IMG' -> { key, name }
let _cifRci = new Map();        // 'FACES.CIF_14-0' -> { key, name }
let _ground = new Map();        // GROUND1: ground archive (302) -> { key, name, depth }
let _load = null;
let _loadBlob = null;           // DFMOD2: the stored Blob, for a by-range open
let _opener = poolOpen;
let _generation = 0;
let _sig = null;          // the stored set last registered
let _registered = null;   // Promise-free count it registered

function forgetOpen() {
  for (const p of _open.values()) p.then((b) => b?.close?.()).catch(() => null);
  _open = new Map();
  _openErrors = new Map();
}

/** DFMOD2: the stored index's texture list for a bundle - the open skips its heads with it. */
const knownOf = (key) => _mods.find((m) => m.key === key)?.index?.textures ?? null;

/** One stored bundle, opened once, in a worker when there is one. */
function bundleFor(key) {
  if (!_open.has(key)) {
    _open.set(key, (async () => {
      if (_loadBlob) {   // DFMOD2: by range, in the worker - never the whole file on this thread
        const blob = await _loadBlob(key);
        if (blob?.size) return _opener(blob, { maxTextureSize: maxSize(), knownTextures: knownOf(key) });
      }
      if (!_load) return null;
      const bytes = await _load(key);
      if (!bytes || !bytes.byteLength) return null;
      return _opener(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { maxTextureSize: maxSize(), knownTextures: knownOf(key) });
    })().catch((e) => {
      console.warn(`[dfmod] ${key} would not open:`, e?.message ?? e);
      _openErrors.set(key, e?.name === 'NotReadableError' || /could not be read/i.test(e?.message ?? '')
        ? 'the browser could not read the stored file - remove it and add it again'
        : /allocation failed|out of memory/i.test(e?.message ?? '') ? 'ran out of memory - lower Texture detail, or attach fewer mods'
          : String(e?.message ?? e));
      return null;
    }));
  }
  return _open.get(key);
}

/** A texture of a stored bundle, top-down RGBA `{ width, height, data }` (a decoded PNG's order), or null. */
async function bundleImage(key, name, { floor = 0 } = {}) {
  // DFMOD2: an open still running after OPEN_WAIT_MS answers nothing for THIS ask (the classic art draws); the open
  // goes on, and the next ask finds it done
  let timer;
  const waited = new Promise((res) => { timer = setTimeout(() => res(null), OPEN_WAIT_MS); });
  const b = await Promise.race([bundleFor(key), waited]);
  clearTimeout(timer);
  if (!b) return null;
  try { return await b.rgba(name, { maxSize: Math.max(maxSize(), floor), deadline: Date.now() + ASK_DEADLINE_MS }); } catch (e) { console.warn(`[dfmod] ${name} would not decode:`, e?.message ?? e); return null; }
}

async function readIndex(key, load) {
  try {
    const bytes = await load(dfmodIndexKey(key));
    if (!bytes || !bytes.byteLength) return null;
    const idx = JSON.parse(new TextDecoder().decode(bytes));
    return idx?.v === DFMOD_INDEX_VERSION ? idx : null;
  } catch { return null; }
}

/**
 * Register every generic `.dfmod` among the texture store's names. `load(key)` answers stored bytes;
 * `saveIndex(key, json)` (optional) writes an index built here for a bundle stored without one (a folder pick).
 * Resolves to how many textures the bundles put on the door. Never throws.
 */
export async function setDfmodSources(fileNames, load, { saveIndex = null, open = null, loadBlob = null, background = true, warm = false } = {}) {
  const names = (fileNames ?? []).filter((n) => typeof n === 'string' && n.startsWith(DFMOD_PREFIX) && /\.dfmod$/i.test(n) && !hasOwnDoor(n)).sort();
  // IDEMPOTENT: the boot seam registers on every host boot (scenes/shared.js ensureAudio), and closing a bundle a
  // player has already paid seconds to open, for the same set, would pay them again at every door
  const sig = names.join('\n');
  if (sig === _sig && load === _load && _registered) return _registered;
  const gen = ++_generation;
  forgetOpen();
  _load = typeof load === 'function' ? load : null;
  _loadBlob = typeof loadBlob === 'function' ? loadBlob : null;
  if (open) _opener = open;
  const mods = [];
  const missing = [];
  for (const key of names) {
    if (!_load) break;
    const index = await readIndex(key, _load);
    if (index) mods.push({ key, index }); else missing.push(key);
    if (gen !== _generation) return 0;   // a newer registration overtook this one
  }
  _mods = mods;
  _sig = sig;
  _registered = install();
  // DFMOD2: a bundle stored without its index (a folder pick, an attach that did not finish) is indexed OFF the boot
  // path - the game starts with what is indexed, and the rest lands as a new generation when it is ready
  const indexMissing = async () => {
    for (const key of missing) {
      let index = null;
      try {
        const src = (_loadBlob && await _loadBlob(key)) || await _load(key);
        if (src && (src.size || src.byteLength)) index = await indexDfmodBytes(src, { open: _opener === poolOpen ? openUnityBundle : _opener });   // DFMOD3: an index needs the full answer, not the pool's quiet open
        if (index && saveIndex) await saveIndex(dfmodIndexKey(key), JSON.stringify(index)).catch(() => null);
      } catch (e) { console.warn(`[dfmod] ${key} could not be indexed:`, e?.message ?? e); }
      if (gen !== _generation) return;
      if (index) { _mods = [..._mods, { key, index }].sort((a, b) => (a.key < b.key ? -1 : 1)); _registered = install(); }
    }
  };
  if (missing.length) { if (background) indexMissing(); else await indexMissing(); }
  // DFMOD2: WARM - open the bundles now, one after another, off the boot path, so the first area's pictures find
  // them open rather than waiting (each open is a worker reading its index by range)
  if (warm) (async () => { for (const { key } of _mods) { if (gen !== _generation) return; await bundleFor(key); } })();
  return _registered;
}

/** Put the registered mods' names on the doors. */
function install() {
  const entries = [];
  const table = {};
  _img = new Map(); _cifRci = new Map(); _ground = new Map(); _groundCache = new Map();
  for (const { key, index } of _mods) {
    const rects = new Map();
    for (const [name, text] of Object.entries(index.xml ?? {})) {
      const rect = xmlRect(text);
      if (rect) rects.set(name, rect);
      const scale = xmlScale(text);
      const e = scale && textureEntry(`${name}.png`);
      if (e && e.map === 'Albedo' && !e.dye) ((table[e.archive] ??= {})[e.record] ??= scale);
    }
    // GROUND1: a texture array named `<archive>-TexArray` is that terrain archive's whole tile set (DREAM's 302, 402...)
    for (const [name, , , depth] of index.arrays ?? []) {
      const m = /^(\d+)-TexArray$/i.exec(name);
      if (m && !_ground.has(Number(m[1]))) _ground.set(Number(m[1]), { key, name, depth });
    }
    for (const [name] of index.textures ?? []) {
      const e = textureEntry(`${name}.png`);
      if (e) {
        if (!USED_MAPS.has(e.map)) continue;
        entries.push({
          archive: e.archive, record: e.record, frame: e.frame, map: e.map, dye: e.dye, fileName: `${key}:${name}`,
          image: () => bundleImage(key, name), lazy: isItemArchive(e.archive), rect: rects.get(name) ?? null,
        });
        continue;
      }
      const up = name.toUpperCase();
      if (/\.IMG$/.test(up)) { if (!_img.has(up)) _img.set(up, { key, name }); continue; }
      if (/\.(CIF|RCI)_\d+-\d+(_[A-Z]+)?$/.test(up) && !_cifRci.has(up)) _cifRci.set(up, { key, name });   // DFMOD2: with a metal suffix too (a handheld weapon's frames)
    }
  }
  const n = setBundleTextures(entries);
  if (Object.keys(table).length) registerBillboardXml('dfmod', table); else unregisterBillboardXml('dfmod');
  _imgCache = new Map();
  _installGen++;
  return n + _img.size + _cifRci.size;
}

export function clearDfmodSources() {
  _generation++;
  _mods = []; _load = null; _sig = null; _registered = null;
  forgetOpen();
  install();
}

/** The attached mods, for the menu: [{ key, title, version, author, textures }]. */
export const attachedDfmods = () => _mods.map(({ key, index }) => ({
  key, title: index.title ?? key.slice(DFMOD_PREFIX.length), version: index.version, author: index.author, textures: index.textures?.length ?? 0,
  error: _openErrors.get(key) ?? null,   // DFMOD2
  guid: index.guid ?? null,   // IIL1: a script mod (Improved Interior Lighting) is known by its GUID
}));

// ---- IMG and CIF/RCI pictures --------------------------------------------

let _imgCache = new Map();   // name -> Promise<img | null>
let _installGen = 0;
/** Bumps whenever the attached set changes - a cache of pictures built from it (the paperdoll's art) keys on it. */
export const dfmodGeneration = () => _installGen;
const cached = (id, hit, opts) => {
  if (!hit) return Promise.resolve(null);
  if (!_imgCache.has(id)) _imgCache.set(id, bundleImage(hit.key, hit.name, opts));
  return _imgCache.get(id);
};
export const hasDfmodImg = (name) => _img.has(String(name).toUpperCase());
export const hasDfmodCifRci = (file, record, frame = 0) => _cifRci.has(`${String(file).toUpperCase()}_${record}-${frame}`);
/** An attached mod's picture of a whole IMG (`SCBG04I0.IMG`), top-down RGBA, or null. */
export const dfmodImgImage = (name) => cached(`img:${String(name).toUpperCase()}`, _img.get(String(name).toUpperCase()));
/** An attached mod's picture of one CIF/RCI record (`FACES.CIF`, 14, 0), top-down RGBA, or null. */
export const dfmodCifRciImage = (file, record, frame = 0) => {
  const k = `${String(file).toUpperCase()}_${record}-${frame}`;
  return cached(`cif:${k}`, _cifRci.get(k));
};

/** DFMOD2: an attached mod's CIF/RCI picture by its whole TryImportCifRci name (`WEAPON03.CIF_0-4_Iron`) - the
 *  first-person weapon's ask - top-down RGBA, or null. */
export const dfmodCifRciNamed = (name) => {
  const k = String(name).toUpperCase();
  return cached(`cif:${k}`, _cifRci.get(k), { floor: WEAPON_FRAME_MIN_SIZE });   // DWHD1: a weapon frame keeps its detail
};

// ---- GROUND1: THE TERRAIN'S TILE SET ---------------------------------------------------------------------------------
// The ground is not drawn through the texture door: the world hosts upload each ground archive's 56 records as one
// texture array (renderer.uploadTileArray), straight off the classic file. A DFU mod dresses it the same way DFU draws
// it - as a Texture2DArray per archive (TerrainMaterialProvider's `<archive>-TexArray`) - so the hosts ask here first.
let _groundCache = new Map();   // archive -> Promise<layers | null>
/** The mod names the archive's tile set, and the AssetInjection gate is open. */
export const hasDfmodGround = (archive) => textureReplacementEnabled() && _ground.has(Number(archive));
/**
 * An attached mod's tile set for a ground archive - `recordCount` layers in the upload path's `{ width, height, colors }`
 * shape, bottom row first (getColor32's order) - or null: no mod carries it, the gate is shut, it would not decode, or
 * it does not hold one layer per classic record (a partial set would put the wrong picture on a tile).
 */
export function dfmodGroundLayers(archive, recordCount) {
  const hit = _ground.get(Number(archive));
  if (!hit || !textureReplacementEnabled()) return Promise.resolve(null);
  if (!_groundCache.has(hit.name)) {
    _groundCache.set(hit.name, (async () => {
      const b = await bundleFor(hit.key);
      if (!b?.layers) return null;
      try {
        const imgs = await b.layers(hit.name);
        if (!imgs?.length) return null;
        const w = imgs[0].width, h = imgs[0].height;
        if (imgs.some((i) => i.width !== w || i.height !== h)) return null;
        return imgs.map((i) => toColor32(i));
      } catch (e) { console.warn(`[dfmod] ${hit.name} would not decode:`, e?.message ?? e); return null; }
    })());
  }
  return _groundCache.get(hit.name).then((layers) => (layers && (recordCount == null || layers.length >= recordCount) ? layers.slice(0, recordCount ?? layers.length) : null));
}

export { resampleRgba };   // DFMOD2: its home is formats/resample.js (the worker downscales with it too)

/** Test seam. */
export function _resetDfmodForTests() { clearDfmodSources(); _opener = poolOpen; }
