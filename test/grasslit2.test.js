// GRASS-LIT2 (2026-10-02, Mac: "Tackle the not done" - the five things GRASS-LIT's report left unpaid): the lanterns
// light the grass as they light the ground under it; a blade is lit about the ground's own normal, so a hillside's
// field darkens with the hillside; the grass's colour is taken off the tile set that is DRAWN, a texture mod's
// included; and the classic lane paints the field in its own tones, as the default lane shows it at noon. The vertex
// stage is run on its OWN TEXT through test/glsl.mjs and held against TERRAIN_FS's and EL_TERRAIN_FS's formulas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAB_GRASS_HEAD, GAME_GRASS_FIELD, GAME_GRASS_VS, GAME_GRASS_FS, GRASS_TONES, GRASS_TONES_CLASSIC, GRASS_TILE_MEANS,
  GRASS_SLOPE_SPAN, GRASS_SLOPE_STEPS, GRASS_HEIGHT_BITS, GRASS_MAX_LIGHTS, GRASS_MEAN_SAMPLES, GRASS_SUN_LIFT,
  packHeightSlope, unpackHeightSlope, beginGrassCell, stepGrassCell, placeLabGrassCell, createGrassField, tileMeanColour,
  grassLit, LabGrassRenderer, heightFloor, heightSpan,
} from '../src/render/labGrass.js';
import { elDecode, elDecode3, elDecodeN, elEncode, elTonemapRGB, elAttenuation, EL_EXPOSURE, EL_GLSL, EL_ATTEN_GLSL, EL_MAX_LIGHTS } from '../src/render/enhancedLighting.js';
import { buildTerrainGrid, buildTerrainIndices, surfaceNormalAt } from '../src/world/terrainSurface.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { glslFunctions } from './glsl.mjs';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const close = (a, b, e = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) <= e);
const NOON = { amb: [0.9, 0.9, 0.9], sunCol: [0.8161765, 0.954361, 1], sunScale: 0.6, sunDir: [0, 1, 0] };
const LOW = { amb: [0.55, 0.55, 0.55], sunCol: [0.8161765, 0.954361, 1], sunScale: 0.35, sunDir: [-0.9, 0.4358899, 0] };
const WOOD = GRASS_TILE_MEANS.woodland;
const zeros4 = (n) => Array.from({ length: n }, () => [0, 0, 0, 0]);
const zeros3 = (n) => Array.from({ length: n }, () => [0, 0, 0]);

/** The grass vertex stage, run on the compiled text: one blade at the cell's middle (15, rootY 0, 15) with no lean and
 *  no wind, its height lane `w`, the frame's `lights` ([{ at, range, color }], colours as the host uploads them),
 *  `casterOf` the lights' shadow slots (-1: none). Answers the stage's outputs. */
function vertex({ w = packHeightSlope(0.5, 0, 0, 0), sunDir = [0, 1, 0], lane = 0, lights = [], vertexId = 2, casterOf = null, shadow = 1 }) {
  const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS, {
    aCorner: [0.5, 0.5], aPA: [0.5, 0.5, 0, w / 65535], aPB: [0.5, 0.5, 0.5, 0.5], aPC: [0.2, 0.3, 0.1, 0],
    uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uTime: 0, uWind: 0, uRange: 300, uEye: [0, 1, 0], uSunDir: sunDir, uMoonDir: [0, 1, 0], uWindDir: [1, 0],
    uSnowFull: 1.1, uSlotN: 0, uCellFrame: [0, 0, 0, 1], uBladeScale: [heightFloor(), heightSpan(), 0.05, 0.05], uCellSize: 30, uPixel: 0, uPxVariants: 8,
    uGFieldOrigin: [0, 0], uGFieldM: 1, uSnowGlobal: 0, uWindV: [0, 0], uSunScale: 0.6, uCamPos: [0, 0, 0], uIndirect: [0, 0, 0, 0], uIndirectColor: [0, 0, 0],
    uCloudShadowRect: [0, 0, 0, 0], uSunVP: [Array(16).fill(0), Array(16).fill(0), Array(16).fill(0)], uSunOrigin: [0, 0, 0, 0], uSunShadowParams: [0, 0, 0, 0], uSunTexel: [0, 0, 0, 0],
    // a caster's map answers `shadow` everywhere: its params name a far plane, its taps the value
    uPointShadowParams: [[0, 0, 0, 50], ...zeros4(7)], uShadowIndex: Array(8).fill(-1), uCasterOf: casterOf ?? Array(EL_MAX_LIGHTS).fill(-1),
    uLane: lane, uPointCount: lights.length,
    uPointLights: [...lights.map((l) => [...l.at, l.range]), ...zeros4(GRASS_MAX_LIGHTS - lights.length)],
    uPointColors: [...lights.map((l) => [...l.color]), ...zeros3(GRASS_MAX_LIGHTS - lights.length)],
    gl_VertexID: vertexId, gl_InstanceID: 0,
    texture: (name) => (name === 'uPointShadow' || name === 'uPointShadowLo' ? shadow : [0, 0, 0, 0]),
  });
  f.main();
  return f.globals;
}
/** TERRAIN_FS's lantern term on the ground at `p` with normal `n` (the classic (1 - d/r)^2), or EL_TERRAIN_FS's
 *  diffuse with its spec set aside (elAttenuation) - per light, its colour as uploaded */
function groundLanterns(p, n, lights, lane) {
  const acc = [0, 0, 0];
  for (const l of lights) {
    const L = l.at.map((v, i) => v - p[i]), d = Math.hypot(...L);
    if (d >= l.range) continue;
    const att = lane ? elAttenuation(d, l.range) : Math.max(0, 1 - d / l.range) ** 2;
    const ndl = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / Math.max(d, 1e-4));
    for (let i = 0; i < 3; i++) acc[i] += att * ndl * l.color[i];
  }
  return acc;
}

test('GRASS-LIT2: the numbers - the classic lane\'s tones, the slope\'s span and steps, the height\'s bits, the lanterns\' cap, the mean\'s reads', () => {
  assert.deepEqual(GRASS_TONES_CLASSIC.map((t) => [...t]), [[0.93, 0.93, 0.98], [1.06, 1.10, 1.01], [1.24, 1.33, 1.05], [1.45, 1.57, 1.16]]);
  assert.deepEqual([GRASS_SLOPE_SPAN, GRASS_SLOPE_STEPS, GRASS_HEIGHT_BITS, GRASS_MAX_LIGHTS, GRASS_MEAN_SAMPLES], [0.75, 15, 6, 48, 65536]);
  assert.equal(GRASS_MAX_LIGHTS, EL_MAX_LIGHTS, 'the lane\'s own cap - every light the ground takes, the grass takes');
  assert.ok(GRASS_HEIGHT_BITS + 2 * 5 === 16, 'the height and the slope\'s two five-bit codes fill the lane exactly');
  assert.ok(heightSpan() / (2 ** GRASS_HEIGHT_BITS - 1) < 0.008, `the height's step ${(heightSpan() / 63 * 1000).toFixed(1)} mm`);
  assert.ok(Math.atan(GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS) * 180 / Math.PI < 3, 'the slope\'s step under three degrees');
});

test('GRASS-LIT2: the classic lane\'s tones - photographed against the default lane at noon: no brighter and no greener than the default lane shows its field, the highlight its per-channel match', () => {
  // the default lane's displayed colour of a tone over the ground's at noon, the five grass climates averaged
  const el = (c) => elTonemapRGB(c.map((v, i) => elDecode(v) * (elDecode(NOON.amb[i]) + elDecode(NOON.sunCol[i]) * NOON.sunScale) * EL_EXPOSURE)).map(elEncode);
  const climates = Object.values(GRASS_TILE_MEANS);
  const shown = (k) => [0, 1, 2].map((i) => climates.reduce((a, g) => a + el(g.map((v, j) => v * GRASS_TONES[k][j]))[i] / el(g)[i], 0) / climates.length);
  for (let k = 0; k < 4; k++) {
    const lane = shown(k);
    assert.ok(GRASS_TONES_CLASSIC[k].every((v, i) => v <= lane[i] + 0.012), `tone ${k}: ${GRASS_TONES_CLASSIC[k]} no brighter than the lane's ${lane.map((v) => v.toFixed(3))}`);
    if (k > 0) assert.ok(GRASS_TONES_CLASSIC[k][1] / GRASS_TONES_CLASSIC[k][0] <= lane[1] / lane[0] + 1e-3, `tone ${k}: and no greener`);
    if (k > 0) assert.ok(GRASS_TONES_CLASSIC[k].every((v, i) => v < GRASS_TONES[k][i]), `tone ${k}: darker than the shipped tones on every channel`);
  }
  assert.ok(close([...GRASS_TONES_CLASSIC[3]], shown(3), 0.012), 'the highlight is the per-channel match');
  // still a field lighter than its ground, root to highlight, the root melting into it
  assert.ok(GRASS_TONES_CLASSIC[0].every((v) => v < 1) && GRASS_TONES_CLASSIC.slice(1).every((t) => t.every((v) => v > 1)));
  for (let k = 1; k < 4; k++) assert.ok(GRASS_TONES_CLASSIC[k].every((v, i) => v > GRASS_TONES_CLASSIC[k - 1][i]));
  // the twin: a classic blade over its ground no brighter than the default lane's, at noon
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const ground = (lane) => (lane ? el(WOOD) : WOOD.map((v, i) => v * (NOON.amb[i] + NOON.sunCol[i] * NOON.sunScale)));
  for (const t of [0.3, 0.7]) {
    const ratio = (lane) => lum(grassLit(WOOD, t, NOON, lane)) / lum(ground(lane));
    assert.ok(ratio(false) <= ratio(true) + 0.005, `t ${t}: classic ${ratio(false).toFixed(3)}x the ground, the lane ${ratio(true).toFixed(3)}x`);
  }
});

test('GRASS-LIT2: the height lane packs the height and the ground\'s slope - level packs level for every blade, the dither is unbiased, a steep normal keeps its heading', () => {
  const step = GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS;
  for (let i = 0; i < 4096; i++) {
    const w = packHeightSlope(0.37, 0, 0, i);
    assert.ok(w >= 0 && w <= 65535);
    const u = unpackHeightSlope(w);
    assert.equal(u.nx, 0); assert.equal(u.nz, 0);
    assert.ok(Math.abs(u.hn - 0.37) <= 0.5 / 63 + 1e-12);
    assert.ok(((w >> 5) & 31) !== 31 && (w & 31) !== 31, 'code 31 is never written - 15 either side of the level');
  }
  // a hillside's normal lands on its two nearest steps, in proportion: the mean of a patch is the slope's own
  for (const [nx, nz] of [[0.3, -0.2], [0.123, 0.456], [-0.61, 0.07]]) {
    let sx = 0, sz = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const u = unpackHeightSlope(packHeightSlope(0.5, nx, nz, i));
      assert.ok(Math.abs(u.nx - nx) <= step + 1e-12 && Math.abs(u.nz - nz) <= step + 1e-12, 'within a step of the slope');
      sx += u.nx; sz += u.nz;
    }
    assert.ok(Math.abs(sx / N - nx) < 0.002 && Math.abs(sz / N - nz) < 0.002, `[${nx}, ${nz}]: the mean ${(sx / N).toFixed(4)}, ${(sz / N).toFixed(4)}`);
  }
  // past the span: held to it, its heading kept
  const u = unpackHeightSlope(packHeightSlope(1, 0.9, 0.9, 0));
  assert.ok(Math.abs(u.nx - u.nz) < 1e-12 && Math.hypot(u.nx, u.nz) <= GRASS_SLOPE_SPAN + step, `${u.nx}, ${u.nz}`);
  assert.equal(unpackHeightSlope(packHeightSlope(1, 0, 0, 0)).hn, 1);
  assert.equal(unpackHeightSlope(packHeightSlope(0, 0, 0, 0)).hn, 0);
});

test('GRASS-LIT2: the vertex stage decodes the lane as packHeightSlope packs it, and lights the blade about the ground\'s normal - the sun on a hillside is the terrain\'s own lambert there', () => {
  for (const [nx, nz] of [[0, 0], [0.3, -0.2], [-0.45, 0.25], [0.6, 0.0]]) {
    const w = packHeightSlope(0.5, nx, nz, 0);   // index 0: the dither's centre, so the code is the nearest step
    const { nx: qx, nz: qz } = unpackHeightSlope(w);
    const n = [qx, Math.sqrt(1 - qx * qx - qz * qz), qz];
    for (const sun of [[0, 1, 0], LOW.sunDir, [0.6, 0.8, 0]]) {
      const g = vertex({ w, sunDir: sun });
      const want = Math.max(0, (n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]) / Math.hypot(...sun));
      assert.ok(Math.abs(g.vLam - want) < 1e-9, `normal [${qx}, ${qz}], sun ${sun}: ${g.vLam} vs ${want}`);
    }
    // the height is the lane's high six bits over the height law's span
    assert.ok(Math.abs(vertex({ w }).gl_Position[1] - (heightFloor() + 0.5 * heightSpan()) * 0.5) < heightSpan() / 63, 'the blade\'s middle at half its height');
  }
  // a hillside facing away from a low sun: the blade loses the sun with the ground (it used to stand straight up and keep it)
  assert.equal(vertex({ w: packHeightSlope(0.5, 0.5, 0, 0), sunDir: LOW.sunDir }).vLam, 0, 'the ground\'s own lambert there is nothing');
  assert.ok(vertex({ w: packHeightSlope(0.5, 0, 0, 0), sunDir: LOW.sunDir }).vLam > 0.43, 'on the level, the low sun\'s');
  assert.ok(GAME_GRASS_VS.includes('vec3 nrm = normalize(vec3(-lean.y, 0.0, lean.x) + 1.2 * gN);'), 'level ground\'s gN is the up the blade stood about (0.35 + 0.85 = 1.2)');
});

test('GRASS-LIT2: the lanterns light the root as they light the ground under it - TERRAIN_FS\'s (1 - d/r)^2 on the classic lane, the lane\'s elAttenuation on its own, each light\'s map where it has one, in the provoking vertex alone', () => {
  const lights = [
    { at: [16, 1.5, 15], range: 10, color: [1, 0.8, 0.6] },
    { at: [10, 2.0, 20], range: 18, color: [0.5, 0.45, 0.4] },
    { at: [60, 1.0, 15], range: 12, color: [3, 3, 3] },   // out of range: nothing
  ];
  const root = [15, 0, 15];
  for (const [nx, nz] of [[0, 0], [0.3, -0.2]]) {
    const w = packHeightSlope(0.5, nx, nz, 0);
    const { nx: qx, nz: qz } = unpackHeightSlope(w);
    const n = [qx, Math.sqrt(1 - qx * qx - qz * qz), qz];
    for (const lane of [0, 1]) {
      const got = vertex({ w, lane, lights }).vPoint;
      assert.ok(close(got, groundLanterns(root, n, lights, lane), 1e-9), `lane ${lane}, normal [${qx}, ${qz}]: ${got}`);
    }
  }
  // a light with a map: its shadow at the root, lifted off the ground's depth (half lit here); the others unshadowed
  const casterOf = Array(EL_MAX_LIGHTS).fill(-1); casterOf[0] = 0;
  const half = vertex({ lane: 1, lights, casterOf, shadow: 0.5 }).vPoint;
  const full = groundLanterns(root, [0, 1, 0], lights.slice(1), 1), first = groundLanterns(root, [0, 1, 0], lights.slice(0, 1), 1);
  assert.ok(close(half, full.map((v, i) => v + 0.5 * first[i]), 1e-9), `${half}`);
  // the other two vertices of a triangle hand nothing down - the provoking vertex's value is the triangle's (flat)
  assert.deepEqual(vertex({ lane: 1, lights, vertexId: 0 }).vPoint, [0, 0, 0]);
  assert.deepEqual(vertex({ lane: 1, lights: [] }).vPoint, [0, 0, 0], 'no lights, no light');
  assert.ok(GAME_GRASS_VS.includes(`shadowOfLight(i, uPointLights[i], rootW + vec3(0.0, ${GRASS_SUN_LIFT}, 0.0), vec3(0.0))`), 'the flats\' reader, at the sun\'s lift');
  assert.ok(GAME_GRASS_VS.includes('flat out vec3 vPoint;') && GAME_GRASS_FS.includes('flat in vec3 vPoint;'));
  assert.ok(GAME_GRASS_FS.includes('+ vNear + vPoint;'), 'and the fragment adds it beside the player\'s light, on the albedo, under the lane\'s pipeline');
  // the lane's falloff is ONE text - EL_GLSL carries it, and so does the grass
  assert.ok(EL_GLSL.includes(EL_ATTEN_GLSL) && GAME_GRASS_VS.includes(EL_ATTEN_GLSL));
  // the JS twin carries the lanterns as the stage does: on the classic lane the lanterns alone are an ambient of their
  // sum over the sward's shade; on the lane they add to the light
  const shade = 0.9 + 0.1 * 0.5;
  const pt = groundLanterns(root, [0, 1, 0], lights, 0);
  assert.ok(close(grassLit(WOOD, 0.5, { ...NOON, sunScale: 0, amb: [0, 0, 0], root, points: lights }, false), grassLit(WOOD, 0.5, { ...NOON, sunScale: 0, amb: pt.map((v) => v / shade) }, false), 1e-12));
  assert.ok(grassLit(WOOD, 0.5, { ...NOON, root, points: lights }, true).every((v, i) => v > grassLit(WOOD, 0.5, NOON, true)[i]));
});

test('GRASS-LIT2: the vertex stage still fits the vectors WebGL2 promises every device - 96 of them are the lanterns\' now', () => {
  // an upper bound: every declared non-sampler uniform live, every scalar a whole vector, a mat4 four (a compiler packs
  // scalars and drops what no path reads, so the real count is lower); MAX_VERTEX_UNIFORM_VECTORS is at least 256
  const vs = LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS;
  let vectors = 0;
  for (const [, type, names] of vs.matchAll(/uniform\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+([^;]+);/g)) {
    if (/sampler/.test(type)) continue;
    for (const v of names.split(',')) vectors += Number(v.match(/\[(\d+)\]/)?.[1] ?? 1) * (type === 'mat4' ? 4 : 1);
  }
  assert.ok(vectors <= 256, `${vectors} vectors at most`);
  assert.ok(GAME_GRASS_VS.includes(`uniform vec4 uPointLights[${GRASS_MAX_LIGHTS}];`) && GAME_GRASS_VS.includes(`uniform vec3 uPointColors[${GRASS_MAX_LIGHTS}];`));
});

test('GRASS-LIT2: the draw hands the shader the frame\'s lanterns - the list the ground took, linear under the lane, raw on the classic, cut to the program\'s slots; none handed is none', () => {
  const run = (light) => {
    const calls = []; let ids = 0;
    const gl = new Proxy({}, { get(_, k) {
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (/^create/.test(k)) return () => ++ids;
      if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
      return (...args) => { calls.push([k, ...args]); };
    } });
    const r = new LabGrassRenderer(gl);
    r.count = 1; r.slotBox = [];
    r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 1, 1], ...light }, { dir: [1, 0], speed: 0, windV: [0, 0] });
    return (name) => calls.filter((c) => c[1] === name).map((c) => c.slice(2));
  };
  const points = new Float32Array(50 * 4).map((_, i) => i);
  const colors = new Float32Array(50 * 3).map((_, i) => (i % 7) / 7);
  const lane = run({ points, pointColors: colors, lane: { decode3: elDecode3, decodeN: elDecodeN } });
  assert.deepEqual(lane('uPointCount'), [[GRASS_MAX_LIGHTS]], 'fifty handed, the program\'s forty-eight');
  assert.deepEqual([...lane('uPointLights')[0][0]], [...points.subarray(0, GRASS_MAX_LIGHTS * 4)]);
  assert.ok(close([...lane('uPointColors')[0][0]], [...colors.subarray(0, GRASS_MAX_LIGHTS * 3)].map(elDecode), 1e-7), 'decoded, as the ground\'s');
  assert.deepEqual([...lane('uGrassTone')[0][0]], [...new Float32Array(GRASS_TONES.flat())], 'the lane\'s tones');
  const classic = run({ points: points.subarray(0, 8), pointColors: colors.subarray(0, 6) });
  assert.deepEqual(classic('uPointCount'), [[2]], 'as many as both arrays hold');
  assert.deepEqual([...classic('uPointColors')[0][0]], [...colors.subarray(0, 6)], 'display colours on the classic lane');
  assert.deepEqual([...classic('uGrassTone')[0][0]], [...new Float32Array(GRASS_TONES_CLASSIC.flat())], 'and its own tones');
  const none = run({});
  assert.deepEqual(none('uPointCount'), [[0]]);
  assert.equal(none('uPointLights').length, 0);
  // the host hands the list the ground took and its display colours
  const w = src('scenes/world.js');
  assert.ok(w.includes('points: renderer._pointLights, pointColors: renderer._pointColorData(renderer._pointLights.length >> 2, true) },'));
});

/** the drawn mesh's normal at a point: the triangle that holds it, off the real index buffer, its three vertex normals
 *  interpolated as the rasteriser does, normalised as TERRAIN_FS does */
function meshNormalAt(normals, lx, lz) {
  const g = HEIGHTMAP_DIMENSION, q = g - 1, cell = TERRAIN_SIZE / q;
  const idx = buildTerrainIndices(1);
  const P = (i) => [(i % g) * cell, Math.floor(i / g) * cell];
  const cx = Math.max(0, Math.min(q - 1, Math.floor(lx / cell))), cz = Math.max(0, Math.min(q - 1, Math.floor(lz / cell)));
  const base = (cz * q + cx) * 6;
  for (let t = 0; t < 2; t++) {
    const ia = idx[base + t * 3], ib = idx[base + t * 3 + 1], ic = idx[base + t * 3 + 2];
    const a = P(ia), b = P(ib), c = P(ic);
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const u = ((b[1] - c[1]) * (lx - c[0]) + (c[0] - b[0]) * (lz - c[1])) / den;
    const v = ((c[1] - a[1]) * (lx - c[0]) + (a[0] - c[0]) * (lz - c[1])) / den;
    const wgt = 1 - u - v;
    if (u >= -1e-9 && v >= -1e-9 && wgt >= -1e-9) {
      const n = [0, 1, 2].map((k) => u * normals[ia * 3 + k] + v * normals[ib * 3 + k] + wgt * normals[ic * 3 + k]);
      const l = Math.hypot(...n);
      return n.map((x) => x / l);
    }
  }
  return null;
}

test('GRASS-LIT2: the ground\'s normal under a blade IS the drawn mesh\'s - the near grid\'s vertex normals over the triangle the root stands in, ghost rows and all', () => {
  const g = HEIGHTMAP_DIMENSION;
  const data = new Float32Array(g * g);
  for (let x = 0; x < g; x++) for (let z = 0; z < g; z++) data[x * g + z] = 0.5 + 0.03 * (Math.sin(x * 0.11) * Math.cos(z * 0.09) + 0.4 * Math.sin((x + z) * 0.34));
  const ghost = (x, z) => 0.5 + 0.03 * Math.sin(x * 0.2 + z * 0.1);
  const { normals } = buildTerrainGrid(data, 1, ghost);
  let s = 0x2f6b1d3 >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  let worst = 0;
  for (let k = 0; k < 3000; k++) {
    const lx = rnd() * (TERRAIN_SIZE - 0.01), lz = rnd() * (TERRAIN_SIZE - 0.01);
    const m = meshNormalAt(normals, lx, lz), got = surfaceNormalAt(normals, lx, lz);
    worst = Math.max(worst, ...m.map((v, i) => Math.abs(v - got[i])));
  }
  assert.ok(worst < 1e-6, `the law is the mesh to ${worst}`);
  // at a vertex, the vertex's own normal; on the pixel's edge, the ghost row's (it is in the grid's normals)
  for (const [xi, zi] of [[0, 0], [5, 7], [g - 1, g - 1], [0, 64]]) {
    const at = surfaceNormalAt(normals, xi * TERRAIN_SIZE / (g - 1), zi * TERRAIN_SIZE / (g - 1));
    assert.ok(close(at, [0, 1, 2].map((c) => normals[(zi * g + xi) * 3 + c]), 1e-6), `vertex ${xi}, ${zi}`);
  }
  // a plane is its own normal everywhere
  for (let x = 0; x < g; x++) for (let z = 0; z < g; z++) data[x * g + z] = 0.4 + 0.002 * x - 0.001 * z;
  const plane = buildTerrainGrid(data, 1, (x, z) => 0.4 + 0.002 * x - 0.001 * z).normals;
  const want = surfaceNormalAt(plane, 400, 400);
  for (const [lx, lz] of [[3.3, 700.1], [511.7, 12.9], [818, 818]]) assert.ok(close(surfaceNormalAt(plane, lx, lz), want, 1e-5), 'to the float32 samples\' grain');
  // the out array is written and handed back - the host's one scratch
  const out = [9, 9, 9];
  assert.equal(surfaceNormalAt(plane, 1, 1, out), out);
});

test('GRASS-LIT2: the placer asks the slope of every blade that stands, sliced or whole the same bytes, and writeSlot packs it into the height lane', () => {
  const keep = (x, z) => ((Math.floor(x) + Math.floor(z)) % 7 === 0 ? null : 0.1 * x);
  const slope = (x, z) => [Math.sin(x * 0.1) * 0.4, 0.9, Math.cos(z * 0.1) * 0.3];
  const opts = { perCell: 1500, cell: 30 };
  const whole = placeLabGrassCell(2, -1, { ...opts, keep, slope });
  assert.ok(whole.count > 1000 && whole.count < 1500);
  for (let i = 0; i < whole.count; i++) {
    const [x, z] = [whole.inst[i * 4], whole.inst[i * 4 + 1]];
    assert.ok(Math.abs(whole.slope[i * 2] - Math.sin(x * 0.1) * 0.4) < 1e-5 && Math.abs(whole.slope[i * 2 + 1] - Math.cos(z * 0.1) * 0.3) < 1e-5, 'the normal\'s x and z at the root');
  }
  const st = beginGrassCell(2, -1, opts);
  while (!stepGrassCell(st, 211, { keep, slope }));
  assert.deepEqual([...st.slope], [...whole.slope], 'sliced, the same');
  // no slope asked, or none answered: level
  const level = placeLabGrassCell(2, -1, { ...opts, keep });
  assert.ok(level.slope.every((v) => v === 0));
  assert.deepEqual([...level.inst], [...whole.inst], 'and asking it moved no blade - the stream is the placer\'s');
  // the pack: lane A's fourth u16 is packHeightSlope's, blade by blade
  const subs = [];
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (/^create/.test(k)) return () => ({});
    if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
    if (k === 'bufferSubData') return (_t, off, data) => subs.push(data.slice());
    return () => {};
  } });
  const r = new LabGrassRenderer(gl);
  r.allocSlots(1500, 2, 30);
  r.writeSlot(1, whole);
  const A = subs[0];
  for (const i of [0, 7, whole.count - 1]) {
    const hn = (whole.inst[i * 4 + 2] - heightFloor()) / heightSpan();
    assert.equal(A[i * 4 + 3], packHeightSlope(hn, whole.slope[i * 2], whole.slope[i * 2 + 1], i));
  }
  // a placed cell from before GRASS-LIT2 (no slope) packs level
  subs.length = 0;
  r.writeSlot(0, { ...whole, slope: undefined });
  assert.equal(unpackHeightSlope(subs[0][3]).nx, 0);
  // the field threads the host's slope to every cell it places
  const placed = [];
  const field = createGrassField({ allocSlots() {}, writeSlot: (s, c) => placed.push(c), clearSlot() {} }, { keep, slope, span: 40, range: 30, cell: 30, perFrame: 4, slots: 16, density: 1200000 });
  field.update(0, 0);
  assert.ok(placed.length > 0 && placed.every((c) => c.slope && [...c.slope.subarray(0, c.count * 2)].some((v) => v !== 0)));
});

test('GRASS-LIT2: the host reads the slope off the near grid\'s normals it keeps, and takes the grass\'s colour off the tile set that is drawn', () => {
  const w = src('scenes/world.js');
  assert.ok(w.includes('groundNormals: stride === 1 ? normals : null,'), 'a near pixel keeps its grid\'s normals');
  assert.ok(w.includes('p.groundNormals = stride === 1 ? grid.normals : null;'), 'and a promotion or a demotion moves them with the surface');
  assert.ok(w.includes('return surfaceNormalAt(p.groundNormals, x - t[0], z - t[2], grassNormalScratch);'));
  // the mod's tile set, asked before the three are learned so they land in one step
  const learn = w.slice(w.indexOf('const drawnLayers = '), w.indexOf('const terrain = renderer.createTerrainSurface('));
  assert.ok(learn.startsWith('const drawnLayers = grassRecords.has(groundArchive) ? null : await dfmodGroundLayers(groundArchive, groundTex.recordCount);'));
  assert.ok(learn.indexOf('await') < learn.indexOf('grassRecords.set(') && learn.includes('groundMeanColour.set(groundArchive, (drawnLayers ?? layers).map(tileMeanColour));'));
  assert.ok(learn.includes('grassRecords.set(groundArchive, grassRecordsOf(layers));'), 'which records are grass stays the classic file\'s question');
  // a mod's big tile is read every k-th texel, k odd - a two-texel pattern (the blue here) is read on both its phases; a classic tile whole
  const big = { width: 1024, height: 1024, colors: new Uint8Array(1024 * 1024 * 4) };
  for (let k = 0; k < 1024 * 1024; k++) { big.colors[k * 4] = 40 + (k % 3); big.colors[k * 4 + 1] = 90; big.colors[k * 4 + 2] = 30 + (k % 2) * 4; }
  const m = tileMeanColour(big);
  assert.ok(close(m, [41 / 255, 90 / 255, 32 / 255], 0.002), `${m.map((v) => (v * 255).toFixed(2))}`);
  const small = { width: 64, height: 64, colors: new Uint8Array(64 * 64 * 4) };
  let sr = 0;
  for (let k = 0; k < 4096; k++) { small.colors[k * 4] = (k * 37) % 251; sr += (k * 37) % 251; }
  assert.equal(tileMeanColour(small)[0], sr / 4096 / 255, 'a classic tile, every texel');
});

test('GRASS-LIT2: the shot hooks - the classic lane\'s tones by hand, and the heart of the deepest wood to look down on', () => {
  const w = src('scenes/world.js');
  assert.ok(w.includes("labGrass[classic ? 'tonesClassic' : 'tones'] = new Float32Array((tones ?? (classic ? GRASS_TONES_CLASSIC : GRASS_TONES)).flat())"));
  const hook = w.slice(w.indexOf('window.__forestSpot = (r = 10, here = false) => {'), w.indexOf('/** CSA-C probe: a land tile 3 tiles off a water tile'));
  assert.ok(hook.includes('forestAt(p.px * 128 + tx + dx, -p.py * 128 + tz + dz)'), 'FOREST1\'s field at the world tile');
  assert.ok(hook.includes('for (const p of here ? [cur] : built.values())') && hook.includes('origin: [t[0], t[2]]'), 'the player\'s own pixel on asking, and its origin - a pose off it stays in it');
  // shot mode only: the hooks sit in the block the shot flag opens, beside __grassSpot
  const block = w.slice(0, w.indexOf('window.__forestSpot'));
  assert.ok(block.lastIndexOf('window.__grassSpot') > block.lastIndexOf('  if (shotMode) {'));
});
