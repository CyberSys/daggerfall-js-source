// LPT1 (2026-10-05, the owner: "Next mod to integrate is this ... Its important we make this compatible with seasons of
// daggerfall, ensure performance doesnt take a hit and draw distance can remain the same. A true visual overhaul with no
// performance loss"): LOW POLY TREES 5 (SquidKamer). bible/07-Rendering/Low-Poly-Trees.md is the design; this file pins
// the pure module (world/lowPolyTrees.js), the vendored data, the renderer's mesh mode and handover, the host's door
// (systems/lowPolyTreesAssets.js) and the two exterior hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LPT_ORIENTATIONS, orientedSize, orientedSource, synthTop, tileCrop, fillCells, LPT_FILL_CELL, decodeErase, composeAtlas,
  paintAtlas, atlasMips, atlasMipSteps, LPT_MIP_ROWS, readLowPolyTrees, lptProto, LPT_ARCHIVES, renderImpostor, impostorSteps,
  LPT_IMPOSTOR_TRIS, LPT_IMPOSTOR_MAX, LPT_IMPOSTOR_MIN, LPT_SCALE_MIN, LPT_SCALE_MAX, LPT_TINT_GREY, lptVariety, LPT_NEAR_M,
  LPT_BAND_M, gatherNear, runSteps, LPT_SNOW,
} from '../src/world/lowPolyTrees.js';
import { packErase, packMeshes } from '../tools/lowPolyTreesExtract.mjs';
import { createLowPolyTrees, LPT_REGATHER_M, LPT_SOURCES_KEPT, resampleRgba, topDownOf } from '../src/systems/lowPolyTreesAssets.js';
import { LowPolyTreesGpu, LPT_INSTANCE_FLOATS } from '../src/render/lowPolyTreesRender.js';
import { LPT_FS_HEAD, LPT_FS_TEXEL } from '../src/render/lowPolyTreesGlsl.js';
import { Renderer, WORLD_FRAME, bbVertexShader, bbCornerX } from '../src/render/renderer.js';
import { EL_LANE, EL_BB_FS } from '../src/render/enhancedLighting.js';
import { FOREST_STAMP, sinkFelled } from '../src/scenes/treeHost.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const bytes = (p) => new Uint8Array(readFileSync(join(ROOT, p)));
const V = 'vendor/low-poly-trees/Trees';
const JSON_ = JSON.parse(read(`${V}/trees.json`));
const LPT = readLowPolyTrees(JSON_, bytes(`${V}/trees.bin`), bytes(`${V}/atlases.bin`));

/** A record, top-down RGBA: each texel its own colour (x, y, and the record), so a misplaced copy shows. */
const rec = (w, h, id = 1, hole = null) => {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = (y * w + x) * 4;
    if (hole && hole(x, y)) continue;
    data[d] = x; data[d + 1] = y; data[d + 2] = id; data[d + 3] = 255;
  }
  return { width: w, height: h, data };
};
const px = (pic, x, y) => Array.from(pic.data.subarray((y * pic.width + x) * 4, (y * pic.width + x) * 4 + 4));

// ---- the vendored data --------------------------------------------------------------------------------------------

test('LPT1 the vendored data: 253 prototypes over the twelve nature archives, 116 meshes, every material\'s atlas a spec - and no picture: only the manifest, the README, the geometry and the specs (a render of game data is game data)', () => {
  assert.equal(LPT.protos.size, 253);
  assert.equal(JSON_.meshes.length, 116);
  assert.deepEqual([...new Set([...LPT.protos.values()].map((p) => p.archive))].sort((a, b) => a - b), [...LPT_ARCHIVES]);
  for (const p of LPT.protos.values()) {
    assert.ok(JSON_.meshes[p.mesh], `${p.key}: its mesh`);
    assert.ok(p.size.w > 0 && p.size.h >= 0.5, `${p.key}: a standing size`);
    assert.equal(p.subs.length, JSON_.meshes[p.mesh].subs.length, `${p.key}: a material a submesh`);
    for (const s of p.subs) if (s.atlas) assert.ok(LPT.atlases[s.atlas]?.blits, `${p.key}: ${s.atlas} is a spec`);
  }
  for (const [name, a] of Object.entries(JSON_.atlases)) if (a.same) assert.deepEqual(LPT.atlases[name].blits, LPT.atlases[a.same].blits, `${name}: the same spec as ${a.same}`);
  const files = readdirSync(join(ROOT, 'vendor/low-poly-trees'), { recursive: true }).map(String).filter((f) => /\.\w+$/.test(f)).sort();
  assert.deepEqual(files, ['README.md', 'Trees/atlases.bin', 'Trees/trees.bin', 'Trees/trees.json', 'lowpolytrees.dfmod.json'].sort());
  // the geometry's length is what the index says - vertices, then every submesh's u16 indices (padded to four)
  const idx = JSON_.meshes.reduce((n, m) => n + m.subs.reduce((k, s) => k + s[1], 0), 0);
  const bin = bytes(`${V}/trees.bin`);
  assert.equal(bin.length, JSON_.vertexBytes + idx * 2 + ((idx * 2) % 4 ? 2 : 0));
  const u16 = new Uint16Array(bin.buffer, bin.byteOffset + JSON_.vertexBytes, idx);
  for (const m of JSON_.meshes) for (const [at, n] of m.subs) for (let k = 0; k < n; k++) assert.ok(u16[m.index + at + k] < m.vertices);
  assert.equal(JSON.parse(read('vendor/low-poly-trees/lowpolytrees.dfmod.json')).ModVersion, '5');
});

test('LPT1 lptProto: an archive and record the mod has a tree for, else null - and null before the data is read', () => {
  assert.equal(lptProto(LPT, 504, 12)?.key, '504_12');
  assert.equal(lptProto(LPT, 504, 999), null);
  assert.equal(lptProto(null, 504, 12), null);
});

// ---- the atlases --------------------------------------------------------------------------------------------------

test('LPT1 orientations: the eight ways a record lands are a bijection of its texels, a quarter turn swaps the sides, bit 0 mirrors x', () => {
  const w = 5, h = 3;
  for (let o = 0; o < LPT_ORIENTATIONS; o++) {
    const [ow, oh] = orientedSize(w, h, o);
    assert.deepEqual([ow, oh], o & 2 ? [h, w] : [w, h]);
    const seen = new Set();
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const [sx, sy] = orientedSource(o, w, h, x, y);
      assert.ok(sx >= 0 && sx < w && sy >= 0 && sy < h);
      seen.add(sy * w + sx);
    }
    assert.equal(seen.size, w * h, `orientation ${o} reaches every texel once`);
  }
  assert.deepEqual(orientedSource(0, w, h, 1, 2), [1, 2]);
  assert.deepEqual(orientedSource(1, w, h, 1, 2), [3, 2], 'mirrored in x');
  assert.deepEqual(orientedSource(4, w, h, 0, 0), [w - 1, h - 1], 'a half turn');
});

test('LPT1 erase spans: packed by the tool (LEB128, rows as steps) and read back exactly by the game', () => {
  const spans = [10, 4, 9, 10, 20, 300, 12, 4, 5, 400, 2, 1000];
  const packed = Uint8Array.from(packErase(spans, 2, 8));
  assert.deepEqual(decodeErase(packed, 0, 4, 2, 8), spans);
  assert.throws(() => decodeErase(null, 0, 1, 0, 0), /no atlases\.bin/);
  assert.throws(() => packErase([5, 0, 3, 4, 0, 3], 0, 0), /out of order/, 'a span above the last is no step');
});

test('LPT1 composeAtlas: a blit paints its oriented record at its place inside its clip, the first paint holds a texel, an erase span keeps the copy off, a clear texel stays clear, and a record the player lacks paints nothing', () => {
  const A = rec(4, 3, 1, (x, y) => x === 3 && y === 2), B = rec(4, 3, 2);
  const spec = { size: [16, 8], blits: [
    [500, 1, 0, 0, 2, 1, 0, 0, 16, 8, [1, 3, 4]],   // upright at (2,1), its (1,0) erased (atlas y 1, x 3)
    [500, 2, 0, 1, 3, 1, 0, 0, 16, 8],   // mirrored, overlapping: the first paint holds
    [500, 2, 0, 2, 10, 2, 10, 2, 12, 8],   // a quarter turn (3 wide, 4 tall), clipped to two columns
    [500, 9, 0, 0, 0, 0, 0, 0, 16, 8],   // a record the player's data lacks
  ] };
  const pic = composeAtlas(spec, (a, r) => (r === 1 ? A : r === 2 ? B : null));
  assert.deepEqual(px(pic, 2, 1), [0, 0, 1, 255]);
  assert.deepEqual(px(pic, 3, 1), [3, 0, 2, 255], 'erased from the first copy, so the second (mirrored: its x 0 the record\'s 3) paints it');
  assert.deepEqual(px(pic, 4, 2), [2, 1, 1, 255], 'the first paint holds');
  assert.deepEqual(px(pic, 5, 3), [1, 2, 2, 255], 'the first copy\'s clear texel left for the second');
  assert.deepEqual(px(pic, 6, 3), [0, 2, 2, 255].map((v, i) => (i === 0 ? 0 : v)), 'the mirrored copy\'s last column');
  const [sx, sy] = orientedSource(2, 4, 3, 0, 0);
  assert.deepEqual(px(pic, 10, 2), [sx, sy, 2, 255], 'turned a quarter');
  assert.equal(px(pic, 12, 2)[3], 0, 'outside its clip, nothing');
  assert.equal(px(pic, 0, 0)[3], 0, 'the lacking record paints nothing');
  // the steps are the blits and fills, one a step - and the generator's answer is composeAtlas's
  const g = paintAtlas(spec, (a, r) => (r === 1 ? A : r === 2 ? B : null));
  let n = 0, r = g.next();
  while (!r.done) { n++; r = g.next(); }
  assert.equal(n, spec.blits.length - 1, 'a step a blit painted (the lacking record none)');
  assert.deepEqual(r.value.data, pic.data);
});

test('LPT1 fills: a top folds the record\'s crown (a disc, snow-capped in winter) and a tile repeats a crop mirrored; each paints only its own cells and never over a copy', () => {
  const tree = rec(16, 24, 3, (x, y) => (y < 8 && (x < 4 || x > 11)) || y > 18);
  const top = synthTop(tree, 12, 12);
  assert.equal(px(top, 0, 0)[3], 0, 'a disc: the corner is clear');
  assert.equal(px(top, 6, 6)[3], 255);
  const snowy = synthTop(tree, 12, 12, { snow: true });
  const c = px(snowy, 6, 6), plain = px(top, 6, 6);
  assert.ok(c[0] > plain[0] && Math.abs(c[0] - LPT_SNOW[0]) < Math.abs(plain[0] - LPT_SNOW[0]), 'snow whitens the middle');
  const tile = tileCrop(rec(8, 8, 4), 6, 3, 2, 2, 2, 2);
  assert.deepEqual([px(tile, 0, 0)[0], px(tile, 1, 0)[0], px(tile, 2, 0)[0], px(tile, 3, 0)[0]], [2, 3, 3, 2], 'mirrored at every other repeat');
  // cells: 16 x 8 in 8-texel cells is two cells; '8' sets only the first
  assert.deepEqual(Array.from(fillCells(['tile', 500, 1, 0, 0, 16, 8, 0, 0, 2, 2, '8'])), [1, 0]);
  assert.equal(fillCells(['top', 500, 1, 0, 0, 16, 8, 0]), null, 'no map: the whole rectangle');
  const spec = { size: [16, 8], blits: [[500, 1, 0, 0, 0, 0, 0, 0, 2, 2]], fills: [['tile', 500, 2, 0, 0, 16, 8, 0, 0, 2, 2, '8']] };
  const pic = composeAtlas(spec, (a, r) => (r === 1 ? rec(2, 2, 1) : rec(4, 4, 2)));
  assert.equal(px(pic, 0, 0)[2], 1, 'the copy holds its texel');
  assert.equal(px(pic, 5, 5)[2], 2, 'the fill paints its cell');
  assert.equal(px(pic, 12, 4)[3], 0, 'and nothing outside its cells');
  assert.equal(LPT_FILL_CELL, 8);
});

test('LPT1 every vendored atlas paints from records of the classic sizes without a throw, every texel a copy or a fill, the steps a blit or a fill each', () => {
  const recs = new Map();
  const recordRgba = (a, r) => { const k = `${a}_${r}`; if (!recs.has(k)) recs.set(k, rec(48 + (r % 5) * 8, 64 + (r % 3) * 16, r)); return recs.get(k); };
  for (const [name, spec] of Object.entries(LPT.atlases)) {
    if (JSON_.atlases[name].same) continue;
    let steps = 0;
    const g = paintAtlas(spec, recordRgba, LPT.atlasesBin);
    let r = g.next();
    while (!r.done) { steps++; r = g.next(); }
    assert.equal(steps, spec.blits.length + (spec.fills?.length ?? 0), name);
    assert.deepEqual([r.value.width, r.value.height], spec.size, name);
  }
});

test('LPT1 atlasMips: the chain halves to 1x1, a level\'s colour is its DRAWN texels\' mean (a clear texel never darkens a leaf\'s edge) and its alpha the four\'s mean; the steps are LPT_MIP_ROWS rows', () => {
  const pic = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4) };
  pic.data.set([200, 100, 50, 255], 0);   // one drawn texel of the first 2x2, three clear (black)
  pic.data.set([10, 20, 30, 255, 30, 40, 50, 255], 8);   // two of the second's top row
  const mips = atlasMips(pic);
  assert.deepEqual(mips.map((m) => [m.width, m.height]), [[4, 2], [2, 1], [1, 1]]);
  assert.deepEqual(px(mips[1], 0, 0), [200, 100, 50, 64], 'the drawn colour, a quarter alpha');
  assert.deepEqual(px(mips[1], 1, 0), [20, 30, 40, 128]);
  const big = { width: 512, height: 512, data: new Uint8Array(512 * 512 * 4) };
  let n = 0;
  const g = atlasMipSteps(big);
  let r = g.next();
  while (!r.done) { n++; r = g.next(); }
  assert.equal(n, 256 / LPT_MIP_ROWS - 1 + 128 / LPT_MIP_ROWS - 1, 'a breath every LPT_MIP_ROWS rows of the two levels taller than it');
  assert.equal(r.value.length, 10);
});

// ---- the far picture ----------------------------------------------------------------------------------------------

test('LPT1 renderImpostor: the tree from the side at LPT_IMPOSTOR_PER_M texels a metre (bounded), its width to its height as the tree\'s, standing on its bottom row; a cut material leaves its clear texels clear, an opaque one never; the steps are LPT_IMPOSTOR_TRIS triangles', () => {
  const proto = lptProto(LPT, 504, 12);
  const solid = { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(200) };
  const clear = { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4) };
  const pic = renderImpostor(LPT, proto, () => solid);
  assert.ok(pic.height >= LPT_IMPOSTOR_MIN && pic.height <= LPT_IMPOSTOR_MAX);
  assert.ok(Math.abs(pic.width / pic.height - proto.size.w / proto.size.h) < 0.05);
  let bottom = 0, any = 0;
  for (let x = 0; x < pic.width; x++) if (px(pic, x, pic.height - 1)[3]) bottom++;
  for (let i = 3; i < pic.data.length; i += 4) if (pic.data[i]) any++;
  assert.ok(bottom > 0, 'it stands on the ground');
  assert.ok(any > pic.width * pic.height * 0.05, 'a tree, not a speck');
  const none = renderImpostor(LPT, proto, () => clear);
  const opaque = proto.subs.some((s) => s.opaque);
  assert.equal(none.data.some((v, i) => i % 4 === 3 && v), opaque, 'clear texels cut unless the material is opaque');
  const tris = JSON_.meshes[proto.mesh].subs.reduce((n, s) => n + s[1] / 3, 0);
  let steps = 0;
  const g = impostorSteps(LPT, proto, () => solid);
  let r = g.next();
  while (!r.done) { steps++; r = g.next(); }
  assert.ok(steps >= Math.floor(tris / LPT_IMPOSTOR_TRIS) - JSON_.meshes[proto.mesh].subs.length, 'a breath every LPT_IMPOSTOR_TRIS triangles');
  assert.deepEqual(r.value.data, pic.data);
});

// ---- a tree's own draw, the near set --------------------------------------------------------------------------------

test('LPT1 lptVariety: a wilderness tree takes DFU\'s terrain variety (scale 0.6-1.4, tint white to grey, any turn), a location\'s the prefab as it is, turned; the same place answers the same tree on every client', () => {
  assert.deepEqual([LPT_SCALE_MIN, LPT_SCALE_MAX, LPT_TINT_GREY], [0.6, 1.4, 0.5]);
  let lo = Infinity, hi = -Infinity, tlo = Infinity, yaws = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = lptVariety(10, 20, i * 0.73, i * 1.31, false);
    lo = Math.min(lo, v.scale); hi = Math.max(hi, v.scale); tlo = Math.min(tlo, v.tint);
    assert.ok(v.tint <= 1 && v.tint >= 1 - LPT_TINT_GREY && v.yaw >= 0 && v.yaw < Math.PI * 2);
    yaws.add(Math.floor(v.yaw * 4));
  }
  assert.ok(lo < 0.65 && hi > 1.35 && tlo < 0.55, 'the whole range');
  assert.equal(yaws.size, 26, 'every turn');
  assert.deepEqual(lptVariety(10, 20, 3.5, 7.25, false), lptVariety(10, 20, 3.5, 7.25, false));
  assert.notDeepEqual(lptVariety(10, 20, 3.5, 7.25, false), lptVariety(11, 20, 3.5, 7.25, false), 'the pixel is in it');
  const l = lptVariety(10, 20, 3.5, 7.25, true);
  assert.equal(l.scale, 1); assert.equal(l.tint, 1);
  assert.equal(l.yaw, lptVariety(10, 20, 3.5, 7.25, false).yaw);
});

test('LPT1 gatherNear: every standing tree within the radius and band of the eye, at its pixel\'s translation, grouped by prototype as [x, y, z, turn, scale, tint]; a skipped (felled) tree is none; the scratch is reused', () => {
  const pa = { key: 'a' }, pb = { key: 'b' };
  const set = { ox: 100, oy: 5, oz: -50, protos: [pa, pb], trees: Float32Array.from([
    0, 0, 1, 0, 1.2, 0.8, 0.5,
    1, 10, 2, 0, 0.7, 0.9, 1.5,
    0, 200, 0, 0, 1, 1, 0,   // 200 m off
    0, 20, 3, 0, 1, 1, 2.5,
  ]) };
  const g = gatherNear([set], 100, -50, LPT_NEAR_M, LPT_BAND_M);
  assert.equal(g.count, 3);
  assert.deepEqual(g.runs.map((r) => [r.proto.key, r.start, r.count]), [['a', 0, 2], ['b', 2, 1]]);
  assert.deepEqual(Array.from(g.data.subarray(0, 6)), [100, 6, -50, 0.5, Math.fround(1.2), Math.fround(0.8)]);
  assert.deepEqual(Array.from(g.data.subarray(12, 18)), [110, 7, -50, 1.5, Math.fround(0.7), Math.fround(0.9)]);
  const felled = gatherNear([set], 100, -50, LPT_NEAR_M, LPT_BAND_M, g.data, (s, i) => i === 0);
  assert.equal(felled.count, 2);
  assert.equal(felled.data, g.data, 'the scratch reused');
  assert.equal(gatherNear([set], 110, -50 + LPT_NEAR_M + LPT_BAND_M + 1, LPT_NEAR_M, LPT_BAND_M).count, 0, 'past the radius and the band: none');
  assert.deepEqual([LPT_NEAR_M, LPT_BAND_M], [140, 20]);
});

// ---- the renderer -------------------------------------------------------------------------------------------------

test('LPT1 a flat\'s scale and tint ride on its corner: bbCornerX packs them and BB_VS reads them back - a classic flat\'s corner is its own (scale 1, white)', () => {
  assert.equal(bbCornerX(-0.5), -0.5);
  assert.equal(bbCornerX(0.5, 1, 1), 0.5);
  for (const [s, t] of [[1, 1], [0.6 / 1.4, 0.5], [1, 0.5], [0.43, 0.77]]) {
    for (const x of [-0.5, 0.5]) {
      const ax = Math.abs(Math.fround(bbCornerX(x, s, t))), tq = Math.floor(ax * 0.5);
      assert.ok(Math.abs((ax - tq * 2) * 2 - s) < 1e-4, `scale ${s}`);
      assert.ok(Math.abs(1 - tq / 255 - t) <= 0.5 / 255 + 1e-9, `tint ${t}`);
      assert.equal(Math.sign(bbCornerX(x, s, t)), Math.sign(x));
    }
  }
});

const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BBU = { uProj: I16, uView: I16, uRight: [1, 0, 0], uUp: [0, 1, 0], uOrigin: [0, 0, 0], uSize: [2, 4], uFlatWind: [0, 0, 0, 0], uSway: 0, uTip: [0, 0, 0], uFacePoint: [0, 0, 0, 0], uElitePad: [0, 0, 0, 0], uMesh: 0, uMeshScale: [1, 1, 1], uMeshOpaque: 0, uLptCut: [0, 0, 0, 0], uLptBand: 20, uLptSun: [0, 1, 0, 0], aNormal: [0, 1, 0], aInst: [0, 0, 0, 0], aInst2: [1, 1] };
const bbAt = (b) => { const f = glslFunctions(bbVertexShader(), { ...BBU, ...b }, { fp32: true }); f.main(); return f.globals; };

test('LPT1 BB_VS: a far picture\'s quad is its share of the batch\'s size about its base, its uv the picture\'s whole, its shade its tint; inside the radius it is gone, across the band it fades', () => {
  const top = bbAt({ aCenter: [10, 0, 0], aCorner: [bbCornerX(0.5, 0.5, 0.6), 0.5] });
  assert.deepEqual(top.vBBWorld.map((v) => Math.round(v * 1e4) / 1e4), [10.5, 2, 0], 'half the width and half the height');
  assert.deepEqual(top.vUV, [1, 1]);
  assert.ok(Math.abs(top.vShade - 0.6) < 0.003);
  const plain = bbAt({ aCenter: [10, 0, 0], aCorner: [0.5, 0.5] });
  assert.deepEqual(plain.vBBWorld, [11, 4, 0], 'a classic flat as it was');
  assert.equal(plain.vShade, 1);
  const cut = (d) => bbAt({ aCenter: [d, 0, 0], aCorner: [0.5, -0.5], uLptCut: [0, 0, 0, 140] });
  assert.deepEqual(cut(100).gl_Position, [2, 2, 2, 1], 'inside the radius: off the clip volume');
  assert.ok(Math.abs(cut(150).vFade - 0.5) < 1e-3, 'half across the band');
  assert.equal(cut(300).vFade, 1);
  assert.equal(bbAt({ aCenter: [100, 0, 0], aCorner: [0.5, -0.5] }).vFade, 1, 'no cut uniform, no cut');
});

test('LPT1 BB_VS mesh mode: the tree\'s vertex turned about +Y and scaled at its root, its uv the mesh\'s, its shade its tint times its faces\' light by day; its share 2 + how far across the band it stands', () => {
  const g = bbAt({ uMesh: 1, uMeshScale: [2, 2, 2], aCenter: [1, 3, 0], aCorner: [0.25, 0.75], aNormal: [1, 0, 0], aInst: [50, 1, 7, Math.PI / 2], aInst2: [1.5, 0.8], uLptCut: [0, 0, 0, 140], uLptSun: [0, 1, 0, 0] });
  assert.deepEqual(g.vBBWorld.map((v) => Math.round(v * 1e4) / 1e4), [50, 10, 4]);
  assert.deepEqual(g.vUV, [0.25, 0.75]);
  assert.ok(Math.abs(g.vShade - 0.8) < 1e-5, 'no sun: the tint alone');
  assert.equal(g.vFade, 3);
  const lit = bbAt({ uMesh: 1, aCenter: [0, 1, 0], aCorner: [0, 0], aNormal: [0, 0, 1], aInst: [150, 0, 0, 0], aInst2: [1, 1], uLptCut: [0, 0, 0, 140], uLptSun: [0, 0, 1, 1] });
  assert.ok(Math.abs(lit.vShade - 1) < 1e-5 && Math.abs(lit.vFade - 2.5) < 1e-3);
  const away = bbAt({ uMesh: 1, aCenter: [0, 1, 0], aCorner: [0, 0], aNormal: [0, 0, -1], aInst: [0, 0, 0, 0], aInst2: [1, 1], uLptSun: [0, 0, 1, 1] });
  assert.ok(Math.abs(away.vShade - 0.5) < 1e-5, 'a face turned from the sun at the floor');
});

test('LPT1 the handover in the fragment: the far picture and its tree are complementary screen-door shares across the band - every pixel one or the other, never both, never neither - on both lanes', () => {
  const fs = `${LPT_FS_HEAD}\nfloat bayer4(vec2 p) { vec2 q = mod(floor(p), 4.0); return (q.x * 4.0 + q.y) / 16.0; }\nvec4 shade(vec4 tex) {\n${LPT_FS_TEXEL}\n return tex; }`;
  const kept = (fade, frag) => { const f = glslFunctions(fs, { vShade: 1, vOpaque: 0, vFade: fade, gl_FragCoord: [...frag, 0, 1] }); try { f.shade([1, 1, 1, 1]); return true; } catch (e) { if (e instanceof GlslDiscard) return false; throw e; } };
  for (const share of [0.1, 0.37, 0.5, 0.81]) {
    let both = 0, neither = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const far = kept(share, [x, y]), near = kept(3 - share, [x, y]);   // BB_VS: a picture's share, and 2 plus its tree's (1 less the picture's)
      if (far && near) both++;
      if (!far && !near) neither++;
    }
    assert.deepEqual([both, neither], [0, 0], `share ${share}`);
  }
  assert.equal(kept(1, [0, 0]), true, 'a whole flat');
  assert.equal(kept(3, [0, 0]), true, 'a whole tree');
  assert.equal(kept(2, [1, 1]), false, 'a tree past the band: none');
  const classic = read('src/render/renderer.js').split('const BB_FS = `')[1].split('`;')[0];
  for (const [name, src] of [['BB_FS', classic], ['EL_BB_FS', EL_BB_FS]]) {
    assert.ok(src.includes('${LPT_FS_TEXEL}') || src.includes(LPT_FS_TEXEL), `${name} carries the handover`);
    assert.ok(src.includes('${LPT_FS_HEAD}') || src.includes(LPT_FS_HEAD), `${name} declares its inputs`);
  }
  assert.ok(EL_BB_FS.indexOf(LPT_FS_TEXEL) > EL_BB_FS.indexOf('vec4 tex = texture(uTex, uv);'), 'the texel it shades is the one sampled');
});

/** A recording fake GL (arena5_banners's shape). */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 33984, TEXTURE1: 33985, TEXTURE_2D: 3553, TEXTURE_2D_ARRAY: 35866 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls, canvas: { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 } };
}
const R3 = new Float32Array([1, 0, 0]), UP = new Float32Array([0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 1.6, 0.1, 4000));
const VIEW = lookAt([0, 1.7, 9], [0, 1.2, -4], [0, 1, 0]);

test('LPT1 createBillboardBatch / moveBillboardBatch: each flat\'s scale and tint written on its corners, kept where it moves; the batch is born with the fields', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  calls.length = 0;
  const b = r.createBillboardBatch(504, '12#lpt', { w: 4, h: 8 }, [[0, 0, 0], [5, 0, 5]], { scales: [0.5, 1], tints: [0.6, 1] });
  const data = calls.find((c) => c[0] === 'bufferData' && c[2].length === 40)[2];
  assert.equal(data[3], Math.fround(bbCornerX(-0.5, 0.5, 0.6)));
  assert.equal(data[23], Math.fround(bbCornerX(-0.5, 1, 1)));
  assert.ok('lptProto' in b && '_scales' in b && '_tints' in b);
  calls.length = 0;
  r.moveBillboardBatch(b, [[0, -9, 0], [5, 0, 5]]);
  const moved = calls.find((c) => c[0] === 'bufferSubData')[3];
  assert.equal(moved[3], Math.fround(bbCornerX(-0.5, 0.5, 0.6)), 'a sunk tree keeps its own size and tint');
});

/** A renderer with a tree frame: one far-picture batch of `proto`, one plain batch, and the trees' fake buffers. */
function treeFrame(lane) {
  const { gl, calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  if (lane) r.setLightingLane(lane);
  r.textures.set('504_12#lpt', { id: 'far' }); r.textures.set('182_0', { id: 'plain' });
  const proto = { key: '504_12' };
  const far = r.createBillboardBatch(504, '12#lpt', { w: 4, h: 8 }, [[0, 0, -3]], { scales: [0.7], tints: [0.9] });
  far.lptProto = proto;
  const plain = r.createBillboardBatch(182, 0, { w: 1, h: 2 }, [[1, 0, -4]]);
  const gpu = { vao: { id: 'treeVao' }, pointInstances: (at) => calls.push(['pointInstances', at]) };
  const frame = { eye: [1, 2, 3], radius: 140, band: 20, gpu, cut: new Set([proto]), runs: [{ start: 0, count: 7, scale: [1, 1, 1], size: [3, 9], sway: 0.6, subs: [{ offset: 48, count: 30, tex: { id: 'atlas' }, opaque: false }, { offset: 0, count: 0, tex: null, opaque: true }] }] };
  return { gl, calls, r, far, plain, frame, proto };
}

test('LPT1 drawBillboards with a tree frame: the far picture of a drawn prototype gives way near the eye, a plain flat never does; the trees go down after the opaque flats, a prototype\'s run an instanced draw a submesh with a texture, on both lanes; the frame is spent in the call', () => {
  for (const lane of [null, EL_LANE]) {
    const { calls, r, far, plain, frame } = treeFrame(lane);
    r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
    r.setLowPolyTrees(frame);
    calls.length = 0;
    r.drawBillboards([plain, far], R3, UP);
    const seq = calls.filter((c) => (c[0] === 'uniform4f' && c[1] === 'uLptCut') || c[0] === 'drawElements' || c[0] === 'drawElementsInstanced' || (c[0] === 'uniform1f' && c[1] === 'uMesh'));
    const cutOn = seq.findIndex((c) => c[1] === 'uLptCut' && c[5] === 140);
    assert.ok(cutOn >= 0 && seq[cutOn + 1][0] === 'drawElements', `${lane ? 'EL' : 'classic'}: the cut is on for the far picture`);
    const inst = calls.filter((c) => c[0] === 'drawElementsInstanced');
    assert.equal(inst.length, 1, 'one draw: the submesh with no texture is none');
    assert.deepEqual(inst[0].slice(1), ['TRIANGLES', 30, 'UNSIGNED_INT', 48, 7]);
    const lastFlat = calls.map((c) => c[0]).lastIndexOf('drawElements');
    assert.ok(calls.indexOf(inst[0]) > lastFlat, 'after the opaque flats');
    assert.deepEqual(calls.filter((c) => c[1] === 'uMesh').map((c) => c[2]), [0, 1, 0], 'mesh mode for the trees alone (the frame block\'s 0 first)');
    assert.ok(calls.some((c) => c[0] === 'uniform3f' && c[1] === 'uMeshScale'));
    calls.length = 0;
    r.drawBillboards([far], R3, UP);
    assert.equal(calls.filter((c) => c[0] === 'drawElementsInstanced').length, 0, 'spent: a second call draws no tree');
    assert.ok(!calls.some((c) => c[0] === 'uniform4f' && c[1] === 'uLptCut' && c[5] === 140), 'and cuts no picture');
  }
});

test('LPT1 a far picture whose prototype is not drawn this frame (its atlases still painting) stands whole - no hole where no tree stands', () => {
  const { calls, r, far, frame } = treeFrame(null);
  frame.cut = new Set(); frame.runs = [];   // the door hands no run and no cut for a prototype it cannot draw
  r.beginFrame(PROJ, VIEW, new Float32Array([0.3, 0.8, 0.2]), WORLD_FRAME);
  r.setLowPolyTrees(frame);
  calls.length = 0;
  r.drawBillboards([far], R3, UP);
  assert.ok(!calls.some((c) => c[0] === 'uniform4f' && c[1] === 'uLptCut' && c[5] === 140));
});

test('LPT1 LowPolyTreesGpu: one vertex buffer as the billboard program reads it (vertex 0, uv 1, normal 2), the indices made whole-buffer u32 with each mesh\'s first vertex added, the instances at 3 and 4 a divisor each; setInstances grows by doubling', () => {
  const { gl, calls } = recordingGl();
  const g = new LowPolyTreesGpu(gl, JSON_, bytes(`${V}/trees.bin`));
  const ptr = calls.filter((c) => c[0] === 'vertexAttribPointer').map((c) => c.slice(1));
  assert.deepEqual(ptr.slice(0, 3), [[0, 3, 'FLOAT', false, 32, 0], [2, 3, 'FLOAT', false, 32, 12], [1, 2, 'FLOAT', false, 32, 24]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'vertexAttribDivisor').map((c) => c.slice(1)), [[3, 1], [4, 1]]);
  const ib = calls.find((c) => c[0] === 'bufferData' && c[1] === 'ELEMENT_ARRAY_BUFFER')[2];
  const m = JSON_.meshes[5], [at] = m.subs[0], [off] = g.subs[5][0];
  const u16 = new Uint16Array(bytes(`${V}/trees.bin`).buffer, JSON_.vertexBytes);
  assert.equal(off, (m.index + at) * 4);
  assert.equal(ib[m.index + at], u16[m.index + at] + m.vertex);
  assert.equal(LPT_INSTANCE_FLOATS, 6);
  calls.length = 0;
  g.setInstances(new Float32Array(6 * 2000), 2000);
  assert.equal(calls.find((c) => c[0] === 'bufferData')[2], 2000 * 6 * 4);
  calls.length = 0;
  g.setInstances(new Float32Array(6 * 2100), 2100);
  assert.equal(calls.find((c) => c[0] === 'bufferData')[2], 4000 * 6 * 4, 'doubled');
  calls.length = 0;
  g.destroy();
  assert.equal(calls.filter((c) => c[0] === 'deleteBuffer').length, 3);
  assert.equal(calls.filter((c) => c[0] === 'deleteVertexArray').length, 1);
});

// ---- the host's door --------------------------------------------------------------------------------------------

/** A fake TEXTURE file: every record 32 x 48, each texel index 1 + record. */
const fakeTexture = (archive) => ({
  archive, recordCount: 40, palette: { getRed: (i) => i, getGreen: (i) => i * 2 % 256, getBlue: () => 9 },
  getDFBitmap: (record) => ({ width: 32, height: 48, data: new Uint8Array(32 * 48).fill(1 + record) }),
});
function door({ seasonal = null } = {}) {
  const { gl, calls } = recordingGl();
  const uploads = [], released = [], frames = [];
  const renderer = { gl, _tex0Bound: 1, uploadTexture: (a, r, c) => uploads.push([a, r, c.width, c.height]), releaseTexture: (a, r) => released.push([a, r]), setLowPolyTrees: (f) => frames.push(f) };
  let breaths = 0;
  const lpt = createLowPolyTrees({
    renderer, getTexture: async (a) => fakeTexture(a), seasonal,
    fetchBytes: async (url) => bytes(`${V}/${url.split('/').pop()}`), breathe: async () => { breaths++; }, warn: () => {},
  });
  return { lpt, gl, calls, uploads, released, frames, breaths: () => breaths };
}

test('LPT1 the door: the data read once, a prototype\'s far picture painted between breaths and uploaded under its archive as `${record}#lpt${source}`, sized for the tallest tree; its atlases uploaded with their mip chain', async () => {
  const d = door();
  assert.equal(d.lpt.loaded, false);
  await Promise.all([d.lpt.load(), d.lpt.load()]);
  assert.equal(d.lpt.loaded, true);
  const p = d.lpt.proto(504, 12);
  assert.equal(d.lpt.nearReady(p), false);
  const far = await d.lpt.farPicture(p);
  assert.equal(far.record, '12#lpt');
  assert.deepEqual(far.size, { w: p.size.w * LPT_SCALE_MAX, h: p.size.h * LPT_SCALE_MAX });
  assert.deepEqual(d.uploads.map((u) => u.slice(0, 2)), [[504, '12#lpt']]);
  assert.equal(await d.lpt.farPicture(p), far, 'once');
  assert.ok(d.breaths() > 50, 'painted a step at a time');
  assert.equal(d.lpt.nearReady(p), true);
  const levels = d.calls.filter((c) => c[0] === 'texImage2D').map((c) => c[2]);
  assert.deepEqual(levels, p.subs.filter((s) => s.atlas).flatMap(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 'every level of each 1024 atlas\'s chain');
  assert.ok(d.calls.some((c) => c[0] === 'texParameteri' && c[3] === 'NEAREST_MIPMAP_LINEAR'));
});

test('LPT1 the frame: the near set gathered once and handed on, again only when the eye moves LPT_REGATHER_M, a pixel moves (a recentre) or a tree is felled; a prototype whose atlases are not painted is neither drawn nor cut', async () => {
  const d = door();
  await d.lpt.load();
  const p = d.lpt.proto(504, 12), q = d.lpt.proto(500, 1);   // q: atlases of its own, none painted
  await d.lpt.farPicture(p);
  const edge = LPT_NEAR_M + LPT_BAND_M + LPT_REGATHER_M - 1;   // past the band, inside the way the eye may go before the next gather
  const set = { ox: 0, oy: 0, oz: 0, protos: [p, q], trees: Float32Array.from([0, 5, 0, 5, 1, 1, 0, 1, 6, 0, 6, 1, 1, 0, 0, edge, 0, 0, 1, 1, 0]) };
  const subData = () => d.calls.filter((c) => c[0] === 'bufferSubData').length;
  d.lpt.frame([set], 0, 0, 0, { stamp: 1 });
  const f = d.frames.at(-1);
  assert.equal(f.runs.length, 1, 'q\'s atlases unpainted: no run');
  assert.ok(f.cut.has(p) && !f.cut.has(q));
  assert.equal(f.runs[0].count, 2, 'a tree the eye may walk into the band toward before the next gather is there');
  const n = subData();
  const runs = f.runs;
  d.lpt.frame([set], LPT_REGATHER_M - 0.5, 0, 0, { stamp: 1 });
  assert.equal(subData(), n, 'a step: no gather');
  assert.equal(d.frames.at(-1).runs, runs, 'and no new runs - a frame between gathers allocates nothing');
  assert.equal(d.frames.at(-1).eye[0], LPT_REGATHER_M - 0.5, 'its eye moved');
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 1 });
  assert.equal(subData(), n + 1, 'moved: gathered');
  set.ox = 1;   // the floating origin moved the pixel
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 1 });
  assert.equal(subData(), n + 2, 'recentred: gathered');
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 2 });
  assert.equal(subData(), n + 3, 'a tree felled: gathered');
  await d.lpt.farPicture(q);
  d.lpt.frame([set], LPT_REGATHER_M + 0.5, 0, 0, { stamp: 2 });
  assert.equal(subData(), n + 3, 'no gather...');
  assert.ok(d.frames.at(-1).cut.has(q), '...but q\'s atlases painted since: q drawn and cut, the frame it can be');
  d.lpt.frame([], 0, 0, 0, { stamp: 2 });
  assert.equal(d.frames.at(-1), null, 'none near: no frame');
});

test('LPT1 SEASONS OF THE ILIAC BAY: under a season the atlases are painted from the mod\'s seasonal picture of each record (resampled to the classic size) and the far picture keys on the season; a third season frees the oldest\'s atlases and pictures', async () => {
  let season = '';
  const seen = [];
  const seasonal = { key: () => season, picture: (a, r) => { seen.push(`${a}_${r}`); return season ? { image: { width: 64, height: 96, colors: new Uint8ClampedArray(64 * 96 * 4).fill(season === 's1' ? 77 : 200) } } : null; } };
  const d = door({ seasonal });
  await d.lpt.load();
  const p = d.lpt.proto(504, 12);
  const a = await d.lpt.farPicture(p);
  season = 's1';
  const b = await d.lpt.farPicture(p);
  assert.deepEqual([a.record, b.record], ['12#lpt', '12#lpts1']);
  assert.ok(seen.length > 0, 'the season was asked for its pictures');
  const ua = d.uploads[0][2] * d.uploads[0][3];
  assert.ok(ua > 0);
  season = 's2';
  await d.lpt.farPicture(p);
  assert.equal(LPT_SOURCES_KEPT, 2);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(d.released, [[504, '12#lpt']], 'the oldest source\'s far picture given back');
  assert.ok(d.calls.some((c) => c[0] === 'deleteTexture'), 'and its atlases');
  // resampled to the classic size, rows put top-down and the alpha cut as a flat's is
  const r = resampleRgba({ width: 2, height: 2, data: Uint8Array.from([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]) }, 4, 4);
  assert.deepEqual([px(r, 0, 0)[0], px(r, 3, 0)[0], px(r, 0, 3)[0]], [1, 2, 3]);
  const t = topDownOf({ width: 1, height: 2, colors: Uint8Array.from([9, 9, 9, 200, 5, 5, 5, 20]) });
  assert.deepEqual(Array.from(t.data), [5, 5, 5, 0, 9, 9, 9, 255]);
});

test('LPT1 destroy: the buffers, every atlas and every far picture given back (EVERY ALLOCATION HAS AN OWNER)', async () => {
  const d = door();
  await d.lpt.load();
  await d.lpt.farPicture(d.lpt.proto(504, 12));
  d.lpt.destroy();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(d.released, [[504, '12#lpt']]);
  assert.ok(d.calls.filter((c) => c[0] === 'deleteTexture').length >= 1);
  assert.equal(d.calls.filter((c) => c[0] === 'deleteBuffer').length, 3);
  assert.equal(d.frames.at(-1), null);
});

// ---- the hosts ------------------------------------------------------------------------------------------------------

test('LPT1 the felled trees: a sink or a stand moves FOREST_STAMP (the near set gathered anew), and a low-poly tree falls as its own far picture at its own size and tint', () => {
  const before = FOREST_STAMP.n;
  const c = [1, 0, 1];
  const g = { batch: {}, centers: [c], size: { w: 4, h: 8 } };
  sinkFelled({ groups: new Map([['504_12', g]]) }, new Set(['504_12#0']), { moveBillboardBatch: () => true });
  assert.equal(FOREST_STAMP.n, before + 1);
  sinkFelled({ groups: new Map([['504_12', g]]) }, new Set(), { moveBillboardBatch: () => true });
  assert.equal(FOREST_STAMP.n, before + 2, 'stood again');
  assert.match(read('src/scenes/treeHost.js'), /createBillboardBatch\(g\.batch\.archive, g\.batch\.record, g\.size, \[c\], g\.scales \? \{ scales: \[g\.scales\[n\.flat\.i\]\], tints: \[g\.tints\[n\.flat\.i\]\] \} : undefined\)/);
});

test('LPT1 the hosts: world.js and exterior.js stand the trees behind the mod\'s switch and ?trees=off, through the one door; a far picture batch per prototype, the near set handed on between the gibs\' call and the wind (WIND3 keeps the wind and the flats\' draw adjacent); the terrain\'s own flats alone take DFU\'s variety', () => {
  const w = read('src/scenes/world.js'), x = read('src/scenes/exterior.js');
  for (const [name, src] of [['world.js', w], ['exterior.js', x]]) {
    assert.match(src, /modSetting\('low-poly-trees', 'Enabled'\) && params\.get\('trees'\) !== 'off' \? createLowPolyTrees\(/, name);
    assert.match(src, /renderer\.createBillboardBatch\(archive, far\.record, far\.size, centers, \{ scales/, name);
    assert.match(src, /batch\.lptProto = lpt;/, name);
    const flats = src.indexOf('renderer.drawBillboards(');
    const wind = src.lastIndexOf('renderer.setFlatWind(', flats), gibs = src.lastIndexOf('bloodMarks.draw(', flats);
    const frame = src.slice(gibs, wind);
    assert.match(frame, /lowPolyTrees/, `${name}: the frame's trees between the gibs and the wind`);
  }
  assert.match(w, /if \(lowPolyTrees\) wildFlats\.add\(`\$\{natureArchive\}_\$\{f\.record\}#\$\{i\}`\);/, 'the terrain layout\'s flats marked wild');
  assert.match(w, /lptVariety\(px, py, c\[0\], c\[2\], !wildFlats\.has\(`\$\{k\}#\$\{i\}`\)\)/);
  assert.match(x, /lptVariety\(0, 0, c\[0\], c\[2\], true\)/, 'the location host: none of it wild');
  assert.match(w, /lowPolyTrees: lptTrees\.length \? \{ ox: 0, oy: 0, oz: 0, protos: lptProtos, trees: Float32Array\.from\(lptTrees\), centers: lptCenters \} : null/);
  assert.match(w, /skip: \(set, i\) => FELLED\.has\(set\.centers\[i\]\)/, 'a felled tree stands no 3D tree');
  assert.match(w, /if \(p\._dist2 > 2\) break;/, 'the eye\'s pixel and its eight - LPT_NEAR_M + LPT_BAND_M is under a pixel');
  assert.ok(LPT_NEAR_M + LPT_BAND_M + LPT_REGATHER_M < 819.2);
  assert.match(w, /seasonal: seasons \? \{ key: \(\) => \(seasonsActive \? `s\$\{seasons\.installedSeason\}` : ''\), picture: \(a, r\) => \(seasonsActive \? seasons\.lookup\(a, r\)\?\.texture \?\? null : null\) \} : null/);
});

test('LPT1 the mod\'s row: Low Poly Trees, SquidKamer, on by default - a switch that takes effect when the world next loads', () => {
  const m = MOD_SETTINGS['low-poly-trees'];
  assert.equal(m.title, 'Low Poly Trees');
  assert.equal(m.author, 'SquidKamer');
  assert.equal(m.keys.Enabled.default, true);
  assert.match(read('src/systems/features.js'), /modFeature\('low-poly-trees', 'Takes effect when the world next loads\.', 'sight'\)/);
});

test('LPT1 runSteps: a step generator\'s answer, whole', () => {
  assert.equal(runSteps((function* () { yield; yield; return 7; })()), 7);
});
