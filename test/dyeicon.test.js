// DYE-ICON (2026-09-26, Mac, over the house's hung weapons: "others are daedric but show steel"): THE CLASSIC ICON IS
// DYED. GetItemImage (ItemHelper.cs:463-478) draws an item with no replacement as the archive's own picture, its mask
// stripped and then ChangeDye'd - a weapon's or a piece of armour's METAL swatch (never an artifact's), a garment's
// CLOTH one, by the item's dye. The port stripped the mask and stopped, so every metal drew as the base picture: a
// Daedric dagger in the pack, on the hotbar and hung on a wall was the plain one. ChangeDye has no Unchanged arm - 18
// (Unchanged = Chain = Silver) is the SILVER table on a metal, so a silver blade and a chain hauberk are dyed too.
//
// MOUNT-LAZY: the hung picture's own door (scenes/decorRoom.js loadMountArt) asked the upload before the record's
// replacement was decoded - a lazy one (Diverse Weapons' metals, Roleplay Realism Items' archives) is never decoded by
// the archive's preload, so a mount hung before any list drew its record stood as the classic picture, or as nothing
// where the mod's picture is the only one ("disapeared"), and the ghost was not what stood ("changes after placment").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPng } from '../tools/pngIO.mjs';
import { DYE_COLORS, DYE_TARGETS, METAL_TABLES, changeDyeBitmap, applyDyeToIndex } from '../src/characters/dyes.js';
import { itemDyeTarget, itemDyeColor } from '../src/systems/itemDye.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { createDataPipeline } from '../src/scenes/dataPipeline.js';
import { addVendorTextures, clearVendorTextures, preloadTextureRecord } from '../src/systems/textureReplacement.js';
import { decorMountDye, decorMountDyeTarget, decorMountItem } from '../src/systems/decorItems.js';
import { loadMountArt } from '../src/scenes/decorRoom.js';
import { installRoleplayRealismItems } from '../src/systems/rriInstall.js';
import { color32Bytes } from '../src/render/renderer.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const { WeaponsAndArmor: METAL, Clothing: CLOTH } = DYE_TARGETS;

// ── the law ──────────────────────────────────────────────────────────

test('DYE-ICON: changeDyeBitmap is ChangeDye over the picture - the metal swatch 0x70-0x7F by the metal table, the cloth swatch 0x60-0x6F by the cloth start, every other index kept, into a copy (mutants: the swatch ignored, the source edited, the range off by one)', () => {
  const data = new Uint8Array([0x6f, 0x70, 0x75, 0x7f, 0x80, 0x60, 0, 0xff]);
  const bmp = { width: 4, height: 2, data, palette: 'pal' };
  const dae = changeDyeBitmap(bmp, DYE_COLORS.Daedric, METAL);
  assert.deepEqual([...dae.data], [0x6f, METAL_TABLES.Daedric[0], METAL_TABLES.Daedric[5], METAL_TABLES.Daedric[15], 0x80, 0x60, 0, 0xff],
    'the metal swatch remapped, the edges of it included, and nothing else');
  assert.deepEqual([...dae.data], [...data].map((i) => applyDyeToIndex(i, DYE_COLORS.Daedric, METAL)), 'ChangeDye, index by index');
  assert.deepEqual([dae.width, dae.height, dae.palette], [4, 2, 'pal'], 'the picture\'s own shape');
  assert.notEqual(dae.data, data, 'a copy');
  assert.deepEqual([...data], [0x6f, 0x70, 0x75, 0x7f, 0x80, 0x60, 0, 0xff], 'the cached record keeps its own');
  const red = changeDyeBitmap(bmp, DYE_COLORS.Red, CLOTH);
  assert.deepEqual([...red.data], [0xef + 15, 0x70, 0x75, 0x7f, 0x80, 0xef, 0, 0xff], 'a garment\'s cloth swatch, its metal left alone');
});

test('DYE-ICON: 18 is dyed - Silver\'s table on a metal (a silver blade, a chain hauberk, leather armour), the swatch itself on a garment; no target or no dye is the picture as it came (mutants: 18 skipped as Unchanged, a dyeless picture copied)', () => {
  const bmp = { width: 2, height: 1, data: new Uint8Array([0x70, 0x7f]) };
  assert.equal(DYE_COLORS.Unchanged, DYE_COLORS.Silver, 'one value, four names in the enum');
  assert.deepEqual([...changeDyeBitmap(bmp, 18, METAL).data], [METAL_TABLES.Silver[0], METAL_TABLES.Silver[15]], 'the Silver table');
  assert.notDeepEqual(METAL_TABLES.Silver, METAL_TABLES.None, 'which is NOT the swatch itself - skipping 18 drew a silver blade as steel');
  const cloth = changeDyeBitmap({ width: 1, height: 1, data: new Uint8Array([0x65]) }, 18, CLOTH);
  assert.deepEqual([...cloth.data], [0x65], 'a garment\'s 18 is its own swatch');
  assert.equal(changeDyeBitmap(bmp, DYE_COLORS.Daedric, null), bmp, 'no target: as it came');
  assert.equal(changeDyeBitmap(bmp, null, METAL), bmp, 'no dye: as it came');
  assert.equal(changeDyeBitmap({ width: 0, height: 0, data: null }, 25, METAL).data, null, 'an empty picture stays empty');
});

test('DYE-ICON: itemDyeTarget is GetItemImage\'s own choice (:473-476) - a weapon\'s or armour\'s metal, never an artifact\'s, a garment\'s cloth, anything else none; the item\'s image carries it beside its dye (mutants: the artifact dyed, the clothing on the metal table, the image without it)', () => {
  assert.equal(itemDyeTarget({ group: 'Weapons' }), METAL);
  assert.equal(itemDyeTarget({ group: 'Armor' }), METAL);
  assert.equal(itemDyeTarget({ group: 'Weapons', artifact: { index: 3 } }), null, 'an artifact wears its own colours');
  assert.equal(itemDyeTarget({ group: 'MensClothing' }), CLOTH);
  assert.equal(itemDyeTarget({ group: 'WomensClothing' }), CLOTH);
  for (const group of ['Books', 'Gems', 'UselessItems2', 'Jewellery']) assert.equal(itemDyeTarget({ group }), null, group);
  assert.equal(itemDyeTarget(null), null);
  const dagger = createWeapon(113, WEAPON_MATERIALS.Daedric);
  const img = inventoryItemImage(dagger);
  assert.deepEqual([img.dye, img.dyeTarget], [DYE_COLORS.Daedric, METAL], 'a Daedric dagger\'s image asks for the Daedric metal');
  const silver = inventoryItemImage(createWeapon(113, WEAPON_MATERIALS.Silver));
  assert.deepEqual([silver.dye, silver.dyeTarget], [18, METAL], 'and a silver one for the Silver table');
  // a mount's numbers name the same dye and swatch - every client hangs the same picture
  const d = { t: 113, g: 3, m: WEAPON_MATERIALS.Daedric, v: null, a: null, p: null };
  assert.deepEqual([decorMountDye(d), decorMountDyeTarget(d)], [DYE_COLORS.Daedric, METAL]);
  assert.equal(decorMountDyeTarget({ ...d, a: 2 }), null, 'a hung artifact is not dyed');
  assert.deepEqual(decorMountItem(d), { group: 'Weapons', templateIndex: 113, material: WEAPON_MATERIALS.Daedric, variant: 0, artifact: false });
  assert.equal(itemDyeColor({ group: 'Weapons', artifact: {} }), DYE_COLORS.Unchanged);
});

// ── the pipeline's door (the GL lists, the hotbar's diamond, the hung pictures) ──

/** One-record TEXTURE archive, uncompressed, stride 256 (helmMask.test.js's shape). */
function textureBytes(width, height, indices) {
  const recPos = 46, RECORD_HEADER = 28;
  const bytes = new Uint8Array(recPos + RECORD_HEADER + 256 * height);
  const v = new DataView(bytes.buffer);
  v.setInt16(0, 1, true);
  v.setInt32(28, recPos, true);
  v.setInt16(recPos + 4, width, true);
  v.setInt16(recPos + 6, height, true);
  v.setUint32(recPos + 10, 256 * height, true);
  v.setUint32(recPos + 14, RECORD_HEADER, true);
  v.setUint16(recPos + 20, 1, true);
  for (let y = 0; y < height; y++) bytes.set(indices.subarray(y * width, (y + 1) * width), recPos + RECORD_HEADER + y * 256);
  return bytes;
}

function pipeRig(indices = new Uint8Array([0x70, 0x7f, 0x65, 0xff])) {
  const palette = new DFPalette(); palette.makeGrayscale();
  const bytes = textureBytes(2, 2, indices);
  const uploads = [];
  const textures = new Map();
  const renderer = {
    textures,
    uploadTexture(a, r, c32, opts = {}) {
      const k = `${a}_${r}${opts.mips === false ? (opts.variant ?? '#ui') : ''}`;
      if (textures.has(k)) return textures.get(k);   // the real renderer's law: the first upload of a key is every later asker's
      uploads.push({ k, colors: [...c32.colors] });
      textures.set(k, { k, colors: [...c32.colors] });
      return textures.get(k);
    },
    uploadEmissionTexture: () => {},
  };
  const pipe = createDataPipeline({ renderer, arch: { getRecordIndex: () => -1, getMesh: () => null }, palette, fetch: async (name) => (name === 'FLATS.CFG' ? new Uint8Array(0) : bytes) });
  return { pipe, uploads, textures, palette };
}
/** what the classic arm should upload for these indices: the TextureFile's own color32 of them, index 0 cut */
const color32Of = (tex, width, height, data) => [...tex.getColor32({ width, height, data: new Uint8Array(data) }, 0).colors];

test('DYE-ICON: the pipeline\'s classic arm uploads the picture dyed - its mask stripped first - under a dyed UI variant of its own, by dye and swatch; undyed it keeps the shared #ui; the cached record is never edited (mutants: the dye dropped, the dyed picture under #ui, a silver blade keyed as an artifact\'s)', async () => {
  const { pipe, uploads } = pipeRig();
  const tex = await pipe.getTexture(245);
  const dae = pipe.uploadRecord(245, 0, { mips: false, removeMask: true, dye: DYE_COLORS.Daedric, dyeTarget: METAL });
  assert.equal(dae, `#ui_dye${DYE_COLORS.Daedric}_${METAL}`, 'the Daedric picture keys apart');
  assert.deepEqual(uploads[0].colors, color32Of(tex, 2, 2, [METAL_TABLES.Daedric[0], METAL_TABLES.Daedric[15], 0x65, 0]), 'dyed: the metal swatch by the Daedric table, the mask a cut-out');
  const silver = pipe.uploadRecord(245, 0, { mips: false, removeMask: true, dye: 18, dyeTarget: METAL });
  assert.equal(silver, `#ui_dye18_${METAL}`);
  assert.deepEqual(uploads[1].colors, color32Of(tex, 2, 2, [METAL_TABLES.Silver[0], METAL_TABLES.Silver[15], 0x65, 0]), 'a silver blade on the Silver table');
  const plain = pipe.uploadRecord(245, 0, { mips: false, removeMask: true, dye: 18 });
  assert.equal(plain, '#ui', 'no swatch (an artifact, a book): the shared key');
  assert.deepEqual(uploads[2].colors, color32Of(tex, 2, 2, [0x70, 0x7f, 0x65, 0]), 'and the picture as it came, the mask stripped');
  const red = pipe.uploadRecord(245, 0, { mips: false, removeMask: true, dye: DYE_COLORS.Red, dyeTarget: CLOTH });
  assert.equal(red, `#ui_dye${DYE_COLORS.Red}_${CLOTH}`);
  assert.deepEqual(uploads[3].colors, color32Of(tex, 2, 2, [0x70, 0x7f, 0xef + 5, 0]), 'a garment\'s cloth swatch');
  assert.deepEqual([...tex.getDFBitmap(0, 0).data], [0x70, 0x7f, 0x65, 0xff], 'the cached record is untouched');
  // the world's own (mipped) upload is never dyed and never keyed as UI art
  assert.equal(pipe.uploadRecord(245, 0, { dye: DYE_COLORS.Daedric, dyeTarget: METAL }), undefined);
  assert.deepEqual(uploads[4].colors, color32Of(tex, 2, 2, [0x70, 0x7f, 0x65, 0xff]));
});

test('DYE-ICON: a replacement answered by the dye is drawn as it is - never dyed - under its own #ui_<Dye>, apart from the classic dyed key, so one decoded AFTER a classic upload still lands (mutants: the replacement dyed, the two sharing a key)', async () => {
  const { pipe, uploads } = pipeRig();
  await pipe.getTexture(245);
  const classic = pipe.uploadRecord(245, 0, { mips: false, removeMask: true, dye: DYE_COLORS.Daedric, dyeTarget: METAL });
  addVendorTextures([{ archive: 245, record: 0, dye: DYE_COLORS.Daedric, fileName: '245_0-0_Daedric', load: async () => new Uint8Array([1]) }]);
  try {
    const px = { width: 1, height: 1, data: new Uint8ClampedArray([9, 8, 7, 255]) };
    assert.ok(await preloadTextureRecord(245, 0, 0, 'Albedo', DYE_COLORS.Daedric, { decode: async () => px }), 'the replacement decoded');
    const swap = pipe.uploadRecord(245, 0, { mips: false, removeMask: true, dye: DYE_COLORS.Daedric, dyeTarget: METAL });
    assert.equal(swap, '#ui_Daedric', 'DW3\'s variant');
    assert.notEqual(swap, classic);
    assert.deepEqual(uploads.at(-1).colors, [9, 8, 7, 255], 'the replacement\'s own pixels, undyed');
  } finally { clearVendorTextures(); }
});

test('DYE-ICON: every icon door asks with the swatch - the GL lists, the enhanced door (its cache keyed by dye and swatch), the hotbar, the HUD, the pack, the decorator\'s thumbnails and the hung pictures (mutants: a door asking undyed)', () => {
  for (const f of ['src/ui/itemScroller.js', 'src/ui/nativeInventory.js']) {
    const s = src(f);
    assert.match(s, /icons\.uploadRecord\(img\.archive, img\.record, \{ mips: false, removeMask: true, dye: img\.dye, dyeTarget: img\.dyeTarget \}\)/, f);
    assert.match(s, /const key = `\$\{img\.archive\}_\$\{img\.record\}\$\{token \? `_\$\{token\}` : ''\}\$\{img\.dyeTarget != null \? `_t\$\{img\.dyeTarget\}d\$\{img\.dye\}` : ''\}`;/, `${f}: its warm key tells a silver blade from an artifact`);
  }
  const canvas = src('src/ui/textureCanvas.js');
  assert.match(canvas, /const bmp = changeDyeBitmap\(changeMask\(got\.file\.getDFBitmap\(record, 0\)\), dye, dyeTarget\);/, 'the DOM door\'s classic arm dyes');
  assert.match(canvas, /const dyed = dyeTarget != null && dye != null && dye !== '';\n  return `\$\{archive\}_\$\{record\}_\$\{scale\}\$\{token \? `_\$\{token\}` : ''\}\$\{dyed \? `_t\$\{dyeTarget\}d\$\{dye\}` : ''\}`;/, 'and keys by dye and swatch');
  assert.match(src('src/ui/enhancedArt.js'), /requestIcon\(img\.archive, img\.record, \{ scale: 2, dye: img\.dye, dyeTarget: img\.dyeTarget \}\)/);
  assert.match(src('src/ui/enhancedHotbar.js'), /requestIcon\(image\.archive, image\.record, \{ scale: 2, dye: image\.dye, dyeTarget: image\.dyeTarget, onReady:/);
  assert.match(src('src/ui/enhancedHud.js'), /requestIcon\(image\.archive, image\.record, \{ scale: 2, dye: image\.dye, dyeTarget: image\.dyeTarget, onReady:/);
  assert.match(src('src/scenes/worldModes.js'), /iconUrl: \(a, r, dye = null, dyeTarget = null\) => loadIcon\(a, r, \{ scale: 1, dye, dyeTarget \}\)/);
  assert.match(src('src/scenes/decorTool.js'), /deps\.iconUrl\?\.\(entry\.icon\.archive, entry\.icon\.record, entry\.icon\.dye \?\? null, entry\.icon\.dyeTarget \?\? null\)/);
  assert.match(src('src/scenes/decorRoom.js'), /loadMountArt\(deps, flat\[0\], flat\[1\], decorMountDye\(d\), decorMountDyeTarget\(d\)\)/);
});

// ── MOUNT-LAZY: the hung picture's door decodes its record first ──────

test('MOUNT-LAZY: a mount of a picture only the mod has (Roleplay Realism Items\' Light Flail) hangs on a fresh load - its record decoded by the dye before the upload, at the file\'s size - where it hung as nothing (mutants: the preload dropped, the dye dropped from the preload)', async () => {
  globalThis.createImageBitmap = async (blob) => ({ ...readPng(new Uint8Array(await blob.arrayBuffer())), close() {} });
  globalThis.OffscreenCanvas = class {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { let bmp = null; return { drawImage: (b) => { bmp = b; }, getImageData: () => ({ width: bmp.width, height: bmp.height, data: new Uint8ClampedArray(bmp.data) }) }; }
  };
  const fetched = [];
  installRoleplayRealismItems({ fetchBytes: async (n) => { fetched.push(n); return new Uint8Array(readFileSync(join(ROOT, 'public/art/roleplay-realism-items', `${n}.png`))); } });
  try {
    const textures = new Map();
    const renderer = {
      textures,
      uploadTexture(a, r, c, o = {}) { color32Bytes(c, `uploadTexture(${a}, ${r})`); const k = `${a}_${r}${o.mips === false ? (o.variant ?? '#ui') : ''}`; textures.set(k, { k, w: c.width, h: c.height }); return textures.get(k); },
      uploadEmissionTexture() {},
    };
    const pipe = createDataPipeline({ renderer, arch: null, palette: null, fetch: async (n) => { throw new Error(`no ARENA2 here: ${n}`); } });
    const flail = createWeapon(514, WEAPON_MATERIALS.Steel);
    const img = inventoryItemImage(flail);
    const art = await loadMountArt({ getTexture: pipe.getTexture, uploadRecord: pipe.uploadRecord, renderer }, img.archive, img.record, img.dye, img.dyeTarget);
    assert.ok(fetched.includes('514_0-0_Steel'), 'the Steel file is fetched by the mount itself - no list drew it first');
    assert.ok(art, 'and it hangs (the bug: nothing did)');
    assert.deepEqual([art.tex.k, art.tex.w, art.tex.h], ['514_0#ui_Steel', 48, 76], 'the mod\'s own picture, under its metal\'s variant');
    assert.ok(art.w > 0 && art.h > 0 && Math.abs(art.h / art.w - 76 / 48) < 1e-9, 'sized as the file is, not the stand-in\'s one pixel');
  } finally { clearVendorTextures(); delete globalThis.createImageBitmap; delete globalThis.OffscreenCanvas; }
});

test('MOUNT-LAZY: the door awaits the record\'s decode by the dye before it uploads (source)', () => {
  const s = src('src/scenes/decorRoom.js');
  const body = s.slice(s.indexOf('export function loadMountArt('), s.indexOf('export function loadMwMountArt('));
  assert.ok(body.indexOf('await preloadTextureRecord(a, r, 0, \'Albedo\', dye);') > 0, 'the record, by its dye');
  assert.ok(body.indexOf('await preloadTextureRecord(') < body.indexOf('uploadRecord?.('), 'before the upload');
});

test('DYE-ICON: a real Daedric dagger\'s classic icon is dyed - its metal indices are Daedric\'s and none of the base swatch is left [needs ARENA2_PATH]', { skip: !process.env.ARENA2_PATH }, async () => {
  const dagger = createWeapon(113, WEAPON_MATERIALS.Daedric);
  const img = inventoryItemImage(dagger);
  const bytes = new Uint8Array(readFileSync(join(process.env.ARENA2_PATH, `TEXTURE.${String(img.archive).padStart(3, '0')}`)));
  const tf = new TextureFile(); tf.load(bytes, `TEXTURE.${img.archive}`);
  const base = tf.getDFBitmap(img.record, 0);
  const metal = [...base.data].filter((i) => i >= 0x70 && i <= 0x7f).length;
  assert.ok(metal > 20, `the dagger's picture is drawn in the metal swatch (${metal} texels)`);
  const dyed = changeDyeBitmap(base, img.dye, img.dyeTarget);
  const left = [...dyed.data].filter((i) => i >= 0x70 && i <= 0x7f && !METAL_TABLES.Daedric.includes(i)).length;
  assert.equal(left, 0, 'dyed: no base-swatch texel survives');
  assert.ok([...dyed.data].filter((i) => METAL_TABLES.Daedric.includes(i)).length >= metal, 'every one of them Daedric');
});
