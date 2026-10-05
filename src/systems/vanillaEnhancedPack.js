// VE4 (2026-10-05, Mac: "Put it in the codebase") - VANILLA ENHANCED SHIPS WITH THE PORT.
//
// carademono's Vanilla Enhanced is Daggerfall's own textures remastered, and Port-Doctrine's A RENDER OF GAME DATA IS
// GAME DATA kept it the player's to attach (VE3). Mac approved carrying it (Port-Doctrine records the exception), so
// three of its mods ship under public/art/vanilla-enhanced/ - the Base, Masked Roads, and Snowless Swamps and Jungles -
// written there by tools/vanillaEnhancedVendor.mjs from github.com/drcarademono/vanilla-enhanced at the commit it pins.
//
// THEY ARE MODS, NOT THE PORT'S OWN ART. Daggerfall Unity reads them as mods - behind Replace Game Artwork, after the
// loose folder, in the load order their manifests' dependencies make - so they register in the texture-mod door
// (systems/dfmodTextures.js setShippedDfmods) beside any the player attaches, with the index an attached copy's would
// carry (vendor/vanilla-enhanced/vanilla-enhanced.index.json). Only where a picture comes from differs: the client here
// fetches the port's own file. Nothing is fetched until a picture is drawn; every mod is off until it is switched on.
//
// A TEXTURE ARRAY IS ITS SLICES. The bundles carry each terrain tile set as one BC7 Texture2DArray; the vendoring proved
// every slice within BC7's error of a PNG and serves the slice from it (the Base's own record where it is that record),
// so `layers` answers the array from those files. Masked Roads' 403 array is 57 deep and Daggerfall Unity refuses it;
// it is indexed with its depth and no slices, and the door's own depth law refuses it here too.
import pack from '../../vendor/vanilla-enhanced/vanilla-enhanced.index.json' with { type: 'json' };
import { setShippedDfmods } from './dfmodTextures.js';
import { decodePng, PRELOAD_CONCURRENCY } from './textureReplacement.js';
import { resampleRgba } from '../formats/resample.js';
import { APP_ROOT } from './appRoot.js';

/** The repository and commit the pictures were read from. */
export const VE_PACK_SOURCE = Object.freeze({ repo: pack.Source, commit: pack.Commit });
/** The shipped mods, as the index lists them: `{ key, dir, index, slices }`. */
export const VE_PACK_MODS = Object.freeze(pack.Mods.map((m) => Object.freeze({ ...m })));

/** The size a mip chain reaches under `maxSize` on its longer side - the level unityBundle.mipLevelFor picks - so a
 *  shipped picture is decoded at the size an attached copy's would be at the same texture detail. */
export function fitSize(width, height, maxSize = Infinity) {
  let w = width, h = height;
  while (Math.max(w, h) > maxSize && (w > 1 || h > 1)) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
  return [w, h];
}

const fetchBytes = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};
let _fetch = fetchBytes;
let _decode = decodePng;
/** Test seam: the fetch and the decode (node has neither a server nor createImageBitmap). */
export function _setVePackIoForTests({ fetch = null, decode = null } = {}) { _fetch = fetch ?? fetchBytes; _decode = decode ?? decodePng; }

/** The served URL of a file under the pack's root (`base/302_0-0.png`). */
export const vePackUrl = (path, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`${pack.Root}/${path.split('/').map(encodeURIComponent).join('/')}`, root).href;

/** A shipped mod's client, in unityBundleClient's shape: `rgba(name, { maxSize })` a texture, top-down RGBA at the
 *  texture detail; `layers(name)` an array's slices, top-down, whole; `close()`. */
export function vePackClient(mod) {
  const files = new Map(mod.index.textures.map(([name]) => [name, `${mod.dir}/${name}.png`]));
  const picture = async (path) => _decode(await _fetch(vePackUrl(path)));
  return {
    async rgba(name, { maxSize = Infinity } = {}) {
      const path = files.get(name);
      if (!path) throw new Error(`${mod.index.title} carries no ${name}`);
      const img = await picture(path);
      const [w, h] = fitSize(img.width, img.height, maxSize);
      return w === img.width && h === img.height ? img : resampleRgba(img, w, h);
    },
    async layers(name) {
      const paths = mod.slices?.[name] ?? [];
      if (!paths.length) throw new Error(`${mod.index.title}: ${name} carries no slices`);
      // a few at a time, as an archive's preload decodes (PRELOAD_CONCURRENCY)
      const out = new Array(paths.length);
      let next = 0;
      const lane = async () => { while (next < paths.length) { const i = next++; out[i] = await picture(paths[i]); } };
      await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, paths.length) }, lane));
      return out;
    },
    close() {},
  };
}

const SHIPPED = Object.freeze(VE_PACK_MODS.map((m) => Object.freeze({ key: m.key, index: m.index, open: () => vePackClient(m) })));
/** Put the shipped mods in the texture-mod door. Idempotent (the same list each time), and cheap: a registration is
 *  names - the boot seam calls it before the attached mods register, and the menus before they read the door, so a
 *  card opened before any host has booted still finds Vanilla Enhanced. */
export const installVanillaEnhancedPack = () => setShippedDfmods(SHIPPED);
