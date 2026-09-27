#!/usr/bin/env node
// CSA-A (2026-09-27): COME SAIL AWAY 2.1 (RedRoryOTheGlen) - THE VENDORED
// PICTURES AND SOUNDS, OUT OF THE SHIPPED BUNDLE AND THE PLAYER'S OWN ARENA2.
//
//   node tools/comeSailAwayExtract.mjs "<path-to>/come sail away.dfmod" [outDir] --arena2 <ARENA2>
//
// Default outDir is vendor/come-sail-away. Every picture is measured before
// anything is written, because a render of game data is game data
// (Port-Doctrine) and never enters the tree - bible/03-World/Come-Sail-Away.md
// "The bundle" has the measurements:
//
// - `Textures/112395_0-0.png`, `Textures/112395_1-<frame>.png` - the splash
//   and the wind widget's 24 frames: the author's own drawings. Each is held
//   to Detailed Ships' bar first (no record within a pixel of its size covers
//   DERIVED_SHARE of it - the picture whole, and cut to its visible box, so a
//   small sprite on a clear canvas is judged at its own size) and to the
//   block search (tools/lib/classicBlocks.mjs: no square record that is not
//   a flat swatch matches that share of any aligned block's visible pixels),
//   and the tool refuses to write one that fails.
// - `Textures/112395_2-base<n>.paint.png` + `Textures/derived.json` - the
//   waves' 32 frames. Each is the author's wave shapes and troughs laid over
//   Daggerfall's snow, TEXTURE.303 record 1, tiled across the frame; the
//   crests are the record's pixels exactly. And the 32 are two pictures,
//   each scrolled down the same sixteen steps (the even frames the first,
//   the odd the second). So what is carried is the author's two paints, the
//   crests as the spec's key colour, and each frame's scroll and phase
//   (formats/derivedTexture.js composeTiledPicture rebuilds a frame from the
//   player's own record); every frame's rebuild is checked exact against the
//   bundle's before anything is written, and each paint - the snow taken
//   out - must pass the block search itself.
// - record 3 (1000x500) is NOT written: it is TEXTURE `TRAV0I00.IMG`'s map,
//   Daggerfall's own art (the port builds it from the player's file, CSA-I).
//   The tool measures it against that file and reports the measure.
// - Unity's own pictures (Default-Particle, Default-ParticleSystem) and the
//   two Bayer tables are not the mod's, and are not written.
// - `Sounds/<clip>.ogg` + `Sounds/sounds.json` - the five clips the assembly
//   loads (ComeSailAway.Start: SmallShipAmbience, ShipExteriorAmbience2,
//   Oars_In, Oars_Sweep, Oars_Out), each the bundle's FSB5 Vorbis packets
//   remuxed into Ogg untouched (tools/lib/fsb5Vorbis.mjs) with the setup
//   header vendor/vorbis-fsb-setups/ names by CRC32. The three it ships and
//   never plays are not carried.
// - `Textures/textures.json` - each carried picture's import settings.
//
// The output is a function of the bundle and the ARENA2 alone.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { isMain } from './lib/isMain.mjs';
import { readUnityFs, readSerializedFile, decodeTexture2D, CLASS_ID } from '../src/formats/unityBundle.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { ImgFile } from '../src/formats/imgFile.js';
import { classicRecordRgba, composeTiledPicture, deriveTiledPaint } from '../src/formats/derivedTexture.js';
import { classicRecords, findClassicSource } from './detailedShipsAssets.mjs';
import { bestClassicBlock, isDerivedBlock, cropToVisible } from './lib/classicBlocks.mjs';
import { encodeIndexedPng, pictureColours } from './lib/indexedPng.mjs';
import { fsb5ToOgg } from './lib/fsb5Vorbis.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLASS_AUDIO_CLIP = 83;

/** The mod's own texture archive (ComeSailAway.Start / InitializeWaveTextures). */
export const CSA_ARCHIVE = 112395;
/** The snow the waves' crests are, and the paint colour that stands for it. */
export const WAVE_SOURCE = Object.freeze([303, 1, 0]);
export const WAVE_KEY = 'ff00ffff';
/** The five clips ComeSailAway.Start loads by name, in its audioClips order. */
export const PLAYED_CLIPS = Object.freeze(['SmallShipAmbience', 'ShipExteriorAmbience2', 'Oars_In', 'Oars_Sweep', 'Oars_Out']);

/** The bundle's serialized file and a reader for its `.resS` / `.resource` streams. */
export function openBundle(bytes) {
  const fs = readUnityFs(bytes);
  const main = fs.files.find((f) => !/\.res(S|ource)$/.test(f.path));
  const sf = readSerializedFile(main, main.path);
  const resource = (path, offset, size) => {
    const base = path.slice(path.lastIndexOf('/') + 1);
    const f = fs.files.find((x) => x.path === base || x.path === path);
    if (!f) throw new Error(`the bundle has no stream ${path}`);
    return f.read(offset, size);
  };
  return { sf, resource };
}

/** The tile phase that explains the most opaque pixels - sampled one pixel in sixteen, then counted whole. */
function tilePhase(pic, src) {
  let best = null;
  for (let py = 0; py < src.height; py++) {
    for (let px = 0; px < src.width; px++) {
      let same = 0;
      for (let y = 0; y < pic.height; y += 4) {
        const sy = (y + py) % src.height;
        for (let x = 0; x < pic.width; x += 4) {
          const i = (y * pic.width + x) * 4;
          if (pic.data[i + 3] !== 255) continue;
          const s = (sy * src.width + (x + px) % src.width) * 4;
          if (pic.data[i] === src.data[s] && pic.data[i + 1] === src.data[s + 1] && pic.data[i + 2] === src.data[s + 2]) same++;
        }
      }
      if (!best || same > best.same) best = { tile: [px, py], same };
    }
  }
  return best.tile;
}

/** How near record 3 is to TRAV0I00.IMG's 320x160 interior (row 12 down) sampled at the texel centres: mean |RGB| per pixel. */
function travelMapDistance(pic, arena2) {
  const img = new ImgFile();
  img.load(new Uint8Array(readFileSync(join(arena2, 'TRAV0I00.IMG'))), 'TRAV0I00.IMG');
  const pal = new DFPalette();
  pal.load(new Uint8Array(readFileSync(join(arena2, img.paletteName))));
  img.load(new Uint8Array(readFileSync(join(arena2, 'TRAV0I00.IMG'))), 'TRAV0I00.IMG', pal);
  const bm = img.getDFBitmap(0, 0);
  let err = 0, n = 0;
  for (let y = 0; y < pic.height; y++) {
    for (let x = 0; x < pic.width; x++) {
      const sx = Math.min(319, Math.round((x + 0.5) * 320 / pic.width - 0.5));
      const sy = Math.min(159, Math.round((y + 0.5) * 160 / pic.height - 0.5));
      const c = pal.get(bm.data[(sy + 12) * bm.width + sx]);
      const i = (y * pic.width + x) * 4;
      err += Math.abs(pic.data[i] - c.r) + Math.abs(pic.data[i + 1] - c.g) + Math.abs(pic.data[i + 2] - c.b);
      n++;
    }
  }
  return err / n;
}

const byFrame = (a, b) => a.frame - b.frame;

/** The rows `pic` is `base` moved down by (pic's row y is base's row (y + n) mod height), or null - clear pixels alike whatever their colour. */
function verticalScroll(pic, base) {
  const { width: w, height: h } = pic;
  if (base.width !== w || base.height !== h) return null;
  const same = (i, j) => (pic.data[i + 3] === 0 && base.data[j + 3] === 0)
    || (pic.data[i] === base.data[j] && pic.data[i + 1] === base.data[j + 1] && pic.data[i + 2] === base.data[j + 2] && pic.data[i + 3] === base.data[j + 3]);
  for (let n = 0; n < h; n++) {
    let ok = true;
    for (let y = 0; y < h && ok; y++) {
      const by = (y + n) % h;
      for (let x = 0; x < w; x++) if (!same((y * w + x) * 4, (by * w + x) * 4)) { ok = false; break; }
    }
    if (ok) return n;
  }
  return null;
}

/**
 * Every file the tool writes, as { path: bytes | string }, and a report.
 * @param {Uint8Array} bundleBytes the shipped `come sail away.dfmod`
 * @param {string} arena2 the player's ARENA2 folder
 */
export function comeSailAwayAssets(bundleBytes, arena2) {
  const { sf, resource } = openBundle(bundleBytes);
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(arena2, 'ART_PAL.COL'))));
  const records = [...classicRecords(arena2, palette)];
  const out = {};
  const report = [];
  const meta = [];

  const textures = [];
  for (const o of sf.objects) {
    if (o.classId !== CLASS_ID.Texture2D) continue;
    const t = o.read();
    const m = /^(\d+)_(\d+)-(\d+)$/.exec(t.m_Name);
    if (!m || Number(m[1]) !== CSA_ARCHIVE) { report.push(`${t.m_Name}: Unity's own, not carried`); continue; }
    textures.push({ record: Number(m[2]), frame: Number(m[3]), name: t.m_Name, tex: t, pic: decodeTexture2D(t, resource) });
  }
  const settings = (t) => ({ filterMode: t.m_TextureSettings.m_FilterMode, wrapU: t.m_TextureSettings.m_WrapU, wrapV: t.m_TextureSettings.m_WrapV, mipCount: t.m_MipCount });

  // records 0 and 1: the author's own, or refused
  for (const e of textures.filter((x) => x.record === 0 || x.record === 1).sort((a, b) => a.record - b.record || byFrame(a, b))) {
    const crop = cropToVisible(e.pic);
    for (const pic of [e.pic, crop]) {
      const src = findClassicSource(pic, records);
      if (src) throw new Error(`${e.name}: TEXTURE.${src.archive} record ${src.record} covers it - not the author's own picture`);
    }
    const block = bestClassicBlock(e.pic, records);
    if (isDerivedBlock(block)) throw new Error(`${e.name}: TEXTURE.${block.archive} record ${block.record} matches ${(block.share * 100).toFixed(1)}% of a block`);
    out[`Textures/${e.name}.png`] = encodeIndexedPng(e.pic);
    meta.push({ name: e.name, kind: 'own', width: e.pic.width, height: e.pic.height, ...settings(e.tex) });
    report.push(`${e.name}: the author's (${e.pic.width}x${e.pic.height}; best block ${block ? `${(block.share * 100).toFixed(1)}% TEXTURE.${block.archive} r${block.record}` : 'none'})`);
  }

  // record 2: the waves, as paint over the player's snow
  const [sa, sr, sfr] = WAVE_SOURCE;
  const tf = new TextureFile();
  if (!tf.load(new Uint8Array(readFileSync(join(arena2, `TEXTURE.${String(sa).padStart(3, '0')}`))), `TEXTURE.${sa}`, palette)) throw new Error(`TEXTURE.${sa} did not load`);
  const snow = classicRecordRgba(tf.getDFBitmap(sr, sfr), palette);
  const waves = textures.filter((x) => x.record === 2).sort(byFrame);
  // the frames are pictures scrolled: each is a base, or a base moved down whole rows
  const bases = [];
  const frames = [];
  for (const e of waves) {
    let hit = null;
    for (let b = 0; b < bases.length && !hit; b++) {
      const scroll = verticalScroll(e.pic, bases[b].pic);
      if (scroll != null) hit = { base: b, scroll };
    }
    if (!hit) { bases.push({ name: `${e.name.replace(/-\d+$/, '')}-base${bases.length}`, pic: e.pic }); hit = { base: bases.length - 1, scroll: 0 }; }
    frames.push({ e, ...hit });
  }
  for (const base of bases) {
    base.tile = tilePhase(base.pic, snow);
    const d = deriveTiledPaint(base.pic, snow, base.tile, WAVE_KEY);
    base.paint = d.paint;
    // the author's part alone, the snow taken out, must be no record's either
    const own = { width: d.paint.width, height: d.paint.height, data: new Uint8Array(d.paint.data) };
    for (let i = 0; i < own.data.length; i += 4) if (own.data[i] === 0xff && own.data[i + 1] === 0 && own.data[i + 2] === 0xff) own.data.fill(0, i, i + 4);
    const block = bestClassicBlock(own, records);
    if (isDerivedBlock(block)) throw new Error(`${base.name}: the paint still matches TEXTURE.${block.archive} record ${block.record} over ${(block.share * 100).toFixed(1)}% of a block`);
    const vis = d.fromRecord + d.own;
    report.push(`${base.name}: TEXTURE.${sa} record ${sr} tiled at ${base.tile} under ${d.fromRecord} of ${vis} opaque pixels (${(100 * d.fromRecord / vis).toFixed(1)}%), the author's ${d.own}; the paint's best block ${block ? `${(block.share * 100).toFixed(1)}% TEXTURE.${block.archive} r${block.record}` : 'none'}`);
  }
  const derived = {};
  for (const { e, base, scroll } of frames) {
    const b = bases[base];
    const spec = { from: sfr ? [sa, sr, sfr] : [sa, sr], size: [e.pic.width, e.pic.height], paint: `${b.name}.paint.png`, scroll, tile: [b.tile[0], (b.tile[1] + scroll) % snow.height], key: WAVE_KEY };
    const back = composeTiledPicture(spec, snow, b.paint);
    for (let i = 0; i < e.pic.width * e.pic.height; i++) {
      if (e.pic.data[i * 4 + 3] === 0 && back.data[i * 4 + 3] === 0) continue;   // clear either way: the shader's cut-out never draws it
      for (let k = 0; k < 4; k++) if (back.data[i * 4 + k] !== e.pic.data[i * 4 + k]) throw new Error(`${e.name}: the rebuild differs at pixel ${i}`);
    }
    derived[e.name] = spec;
    report.push(`${e.name}: ${b.name} scrolled ${scroll} rows - rebuilt exact`);
    meta.push({ name: e.name, kind: 'derived', width: e.pic.width, height: e.pic.height, ...settings(e.tex) });
  }
  // one palette for the paints, so they index alike
  const shared = [...new Set(bases.flatMap((b) => pictureColours(b.paint)))].sort((x, y) => x - y);
  for (const b of bases) out[`Textures/${b.name}.paint.png`] = encodeIndexedPng(b.paint, shared);
  out['Textures/derived.json'] = `{\n${Object.entries(derived).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n}\n`;

  // record 3: Daggerfall's travel map, measured and never written
  for (const e of textures.filter((x) => x.record === 3)) {
    report.push(`${e.name}: TRAV0I00.IMG's interior scaled (mean |RGB| ${travelMapDistance(e.pic, arena2).toFixed(1)} of 765) - Daggerfall's own, not carried`);
  }
  const unknown = textures.filter((x) => x.record > 3);
  if (unknown.length) throw new Error(`records the tool has not measured: ${unknown.map((x) => x.name).join(', ')}`);
  out['Textures/textures.json'] = `[\n${meta.map((m) => `  ${JSON.stringify(m)}`).join(',\n')}\n]\n`;

  // the five played clips
  const setups = new Map();
  for (const f of readdirSync(join(ROOT, 'vendor/vorbis-fsb-setups')).filter((n) => /^setup_[0-9a-f]{8}\.bin$/.test(n))) {
    const b = new Uint8Array(readFileSync(join(ROOT, 'vendor/vorbis-fsb-setups', f)));
    const crc = zlib.crc32(b) >>> 0;
    if (f !== `setup_${crc.toString(16).padStart(8, '0')}.bin`) throw new Error(`${f} is not the header its name says (CRC32 ${crc.toString(16)})`);
    setups.set(crc, b);
  }
  const clips = [];
  for (const o of sf.objects) {
    if (o.classId !== CLASS_AUDIO_CLIP) continue;
    const c = o.read();
    if (!PLAYED_CLIPS.includes(c.m_Name)) { report.push(`${c.m_Name}: never played by the assembly, not carried`); continue; }
    const fsb = resource(c.m_Resource.m_Source, Number(c.m_Resource.m_Offset), Number(c.m_Resource.m_Size));
    const r = fsb5ToOgg(fsb, (crc) => setups.get(crc) ?? null);
    out[`Sounds/${c.m_Name}.ogg`] = r.ogg;
    clips.push({ name: c.m_Name, channels: r.channels, frequency: r.rate, samples: r.numSamples, length: Math.fround(c.m_Length), loadType: c.m_LoadType, setup: r.crc.toString(16).padStart(8, '0') });
    report.push(`${c.m_Name}: ${r.channels} ch ${r.rate} Hz, ${r.numSamples} samples, ${r.packets} packets, setup ${r.crc.toString(16)}`);
  }
  const missing = PLAYED_CLIPS.filter((n) => !clips.some((c) => c.name === n));
  if (missing.length) throw new Error(`the bundle lacks ${missing.join(', ')}`);
  clips.sort((a, b) => PLAYED_CLIPS.indexOf(a.name) - PLAYED_CLIPS.indexOf(b.name));
  out['Sounds/sounds.json'] = `[\n${clips.map((c) => `  ${JSON.stringify(c)}`).join(',\n')}\n]\n`;
  return { out, report };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--arena2');
  const arena2 = at >= 0 ? args.splice(at, 2)[1] : process.env.ARENA2_PATH;
  const [bundlePath, outDir = join(ROOT, 'vendor/come-sail-away')] = args;
  if (!bundlePath || !arena2) {
    console.error('usage: node tools/comeSailAwayExtract.mjs "<come sail away.dfmod>" [outDir] --arena2 <ARENA2>');
    process.exit(2);
  }
  const { out, report } = comeSailAwayAssets(new Uint8Array(readFileSync(bundlePath)), arena2);
  for (const line of report) console.log(`  ${line}`);
  for (const [path, body] of Object.entries(out)) {
    const full = join(outDir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  console.log(`wrote ${Object.keys(out).length} files to ${outDir}`);
}
