// DUNGEON-SEAMS (2026-09-26, a player, relayed by Mac: "if you look around stairs and curved cellings in dungeons, you
// can spot holes leading into void, sometimes you can even see other rooms through those holes"): THE HOLES IN
// DAGGERFALL'S OWN MODELS, CLOSED. world/arch3dSeams.js moves the corners of the stairs whose treads stop short of their
// walls and of the vault and round-room ceilings that stop short of their corridors, on a copy the pipeline draws
// (scenes/dataPipeline.js); tools/seamCensus.mjs measures every dungeon block with and without it. Synthetic tests
// always run; the census and the rules' aim against the real models run with ARENA2_PATH.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SEAM_RULES, POINT_EPS, STRAY_EPS, patchSeams } from '../src/world/arch3dSeams.js';
import { blockSeams, census, isArchitecture, SEAM_HAIR, SEAM_REACH } from '../tools/seamCensus.mjs';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { identity } from '../src/world/mat4.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

/** A DFMesh as Arch3dFile.getMesh builds one: faces of corners in ARCH3D units over 256, each with its normal and UV. */
const P = (x, y, z, u = 0, v = 0) => ({ x, y, z, nx: 0, ny: -1, nz: 0, u, v });
function mesh(...faces) {
  const planes = faces.map((points) => ({ points }));
  const totalVertices = faces.reduce((n, f) => n + f.length, 0);
  const totalTriangles = faces.reduce((n, f) => n + f.length - 2, 0);
  return { totalVertices, totalTriangles, radius: 1, subMeshes: [{ textureArchive: 122, textureRecord: 2, totalTriangles, planes }] };
}
const pointsOf = (m) => m.subMeshes.flatMap((sm) => sm.planes.flatMap((pl) => pl.points));

// ---------------------------------------------------------------------------------------------------------------------
// The patch - always run.
// ---------------------------------------------------------------------------------------------------------------------

test('DUNGEON-SEAMS: a model with no rules is drawn from the very mesh the archive holds', () => {
  const m = mesh([P(62, 0, 0), P(62, -10, 0), P(0, -10, 0)]);
  assert.equal(SEAM_RULES[41000], undefined);
  assert.equal(patchSeams(41000, m), m, 'no copy made for a model nothing is wrong with');
  assert.equal(patchSeams(61018, null), null);
  assert.equal(patchSeams(61018, undefined), undefined);
});

test('DUNGEON-SEAMS: a stair side - the treads\' ends go out to the wall, on a copy, the rest of each corner kept', () => {
  // 61018: treads and risers end at +-62, the walls stand at +-64
  const tread = [P(-62, -18, -112, 0, 0), P(62, -18, -112, 124, 0), P(62, -18, -88, 124, 24), P(-62, -18, -88, 0, 24)];
  const wall = [P(64, 0, -128, 5, 6), P(64, -96, -128, 7, 8), P(64, -96, 128, 9, 10)];
  const near = [P(62.5, 0, 0), P(61.999, 0, 0), P(0, 0, 62)];   // not ON the rule's value, or on another axis
  const m = mesh(tread, wall, near);
  const before = JSON.stringify(m);
  const out = patchSeams(61018, m);
  assert.equal(JSON.stringify(m), before, 'the archive\'s mesh is shared (Arch3dFile caches it) - never written');
  assert.notEqual(out, m);
  assert.notEqual(out.subMeshes[0], m.subMeshes[0]);
  const t = out.subMeshes[0].planes[0].points;
  assert.deepEqual(t.map((p) => p.x), [-64, 64, 64, -64]);
  assert.deepEqual(t.map((p) => [p.y, p.z, p.u, p.v, p.nx, p.ny, p.nz]), tread.map((p) => [p.y, p.z, p.u, p.v, p.nx, p.ny, p.nz]),
    'a moved corner keeps its height, depth, texture coordinates and normal');
  assert.deepEqual(out.subMeshes[0].planes[1].points, wall, 'the wall already stands where the treads were meant to meet it');
  assert.equal(out.subMeshes[0].planes[1].points[0], wall[0], 'an unmoved corner is the same object');
  assert.deepEqual(out.subMeshes[0].planes[2].points.map((p) => [p.x, p.z]), [[62.5, 0], [61.999, 0], [0, 62]]);
  // everything a mesh carries besides its corners rides along untouched
  assert.equal(out.totalVertices, m.totalVertices);
  assert.equal(out.totalTriangles, m.totalTriangles);
  assert.equal(out.subMeshes[0].textureArchive, 122);
  assert.equal(out.subMeshes[0].totalTriangles, m.subMeshes[0].totalTriangles);
});

test('DUNGEON-SEAMS: a stray corner - the one the table names, in every face that shares it, and no other', () => {
  // 61004: the vault's corner at (-63.996, -95.02, -127.992) belongs at the corridor's (-64, -95.996, -128)
  const wallFace = [P(-34, 0, -36), P(-34, -95.996, -36), P(-63.996, -95.02, -127.992), P(-64, 0, -128)];
  const ceiling = [P(-63.996, -95.02, -127.992, 3, 4), P(-34, -95.996, -36), P(-8, -127.996, -52), P(-32, -127.996, -128)];
  const offBy = [P(-63.996 + 2 * STRAY_EPS, -95.02, -127.992), P(-63.996, -95.02 - 2 * STRAY_EPS, -127.992), P(128.242, -128, 31.199)];
  const out = patchSeams(61004, mesh(wallFace, ceiling, offBy));
  const [w, c, o] = out.subMeshes[0].planes.map((pl) => pl.points);
  assert.deepEqual([w[2].x, w[2].y, w[2].z], [-64, -95.996, -128]);
  assert.deepEqual([c[0].x, c[0].y, c[0].z, c[0].u, c[0].v], [-64, -95.996, -128, 3, 4], 'a shared corner stays shared');
  assert.deepEqual(o.slice(0, 2).map((p) => [p.x, p.y, p.z]), offBy.slice(0, 2).map((p) => [p.x, p.y, p.z]), 'a corner the table does not name stands');
  assert.deepEqual([o[2].x, o[2].y, o[2].z], [128, -128, 32], 'the vault\'s other stray corner');
  assert.deepEqual(w.filter((_, i) => i !== 2), wallFace.filter((_, i) => i !== 2));
});

test('DUNGEON-SEAMS: the table - dungeon architecture only, XJDHDR\'s models all in it, every move small', () => {
  const ids = Object.keys(SEAM_RULES).map(Number);
  assert.ok(Object.isFrozen(SEAM_RULES));
  for (const id of ids) assert.ok(isArchitecture(id), `${id}: a dungeon's own architecture (a prop's gap is in front of a wall)`);
  // "Unofficial Block, Location and Model Fixes": the stairs whose holes it closed, and the ceilings
  for (const id of [58009, 58050, 59004, 59007, 59011, 59012, 59013, 61017, 61118, 61218, 63026, 67016, 67025, 61204, 63034, 63134]) {
    assert.ok(SEAM_RULES[id], `${id}: in XJDHDR's list, so in the table`);
  }
  // re-textured twins carry their original's geometry, so its rules
  assert.equal(SEAM_RULES[61104], SEAM_RULES[61004]);
  assert.equal(SEAM_RULES[61204], SEAM_RULES[61004]);
  assert.equal(SEAM_RULES[63134], SEAM_RULES[63034]);
  for (const id of ids) {
    for (const r of SEAM_RULES[id]) {
      if ('at' in r) {
        const d = Math.hypot(r.to[0] - r.at[0], r.to[1] - r.at[1], r.to[2] - r.at[2]);
        assert.ok(d > POINT_EPS && d <= 5, `${id}: a stray corner moves (${d.toFixed(3)} units), at most five`);
      } else {
        assert.ok(['x', 'y', 'z'].includes(r.axis));
        for (const [from, to] of Object.entries(r.map)) {
          const d = Math.abs(to - Number(from));
          assert.ok(d > 0 && d <= 2, `${id}: ${r.axis} ${from} -> ${to}, a unit or two`);
        }
      }
    }
  }
});

test('DUNGEON-SEAMS: the census - a slit between two faces is a seam; a joint, or open space, is not', () => {
  // one block, two models at the origin: a floor ending at x 64, and a wall at x 64 + gap
  const floor = mesh([P(-64, 0, -64), P(64, 0, -64), P(64, 0, 64), P(-64, 0, 64)]);
  const wallAt = (x) => mesh([P(x, 0, -64), P(x, -128, -64), P(x, -128, 64), P(x, 0, 64)]);
  const run = (x) => {
    const meshes = new Map([[60000, floor], [60001, wallAt(x)]]);
    return blockSeams([{ modelIdNum: 60000, matrix: identity() }, { modelIdNum: 60001, matrix: identity() }], (id) => meshes.get(id));
  };
  const joint = run(64);
  assert.equal(joint.seams.length, 0, 'the floor\'s edge on the wall: sealed');
  assert.equal(joint.faces, 2);
  const slit = run(65);
  assert.equal(slit.seams.length, 2, 'one unit (2.5 cm) between them: a slit, seen from each side of it');
  const [s, back] = slit.seams;
  assert.equal(s.model, 60000);
  assert.equal(s.partner, 60001);
  assert.equal(s.samePlacement, false);
  assert.deepEqual(s.edge, [[64, 0, -64], [64, 0, 64]], 'the edge named in the model\'s own units, as a rule is written');
  assert.ok(Math.abs(s.gap - 0.025) < 1e-6);
  assert.ok(s.gap > SEAM_HAIR && s.gap <= SEAM_REACH);
  assert.deepEqual([back.model, back.partner, back.edge], [60001, 60000, [[65, 0, 64], [65, 0, -64]]], 'the wall\'s foot, a unit off the floor\'s end');
  assert.equal(run(70).seams.length, 0, 'fifteen centimetres: open space, a floor that ends in the room');
});

test('DUNGEON-SEAMS: the pipeline draws the patched copy, and the collider is built from it; the reader stays DFU\'s', () => {
  const pipe = src('src/scenes/dataPipeline.js');
  assert.match(pipe, /import \{ patchSeams \} from '\.\.\/world\/arch3dSeams\.js';/);
  const build = pipe.slice(pipe.indexOf('async function buildGpuMesh('), pipe.indexOf('/** WM2b: THE WINDMILL ROTOR'));
  assert.match(build, /const dfMesh = patchSeams\(modelIdNum, arch\.getMesh\(index\)\);/);
  assert.match(build, /const model = dfMeshToModel\(dfMesh, getTextureSize\);/);
  assert.match(build, /cpuModels\.set\(modelIdNum, \{ modelIdNum, positions: model\.positions, indices: model\.indices,/, 'the collider\'s copy is the drawn one');
  assert.doesNotMatch(src('src/formats/arch3dFile.js'), /arch3dSeams/, 'the reader reads DFU\'s bytes (the parity harness)');
});

// ---------------------------------------------------------------------------------------------------------------------
// The player's own data.
// ---------------------------------------------------------------------------------------------------------------------

test('DUNGEON-SEAMS (real data): every rule finds its corner in the model it names, and nothing else changes', { skip: skipReal }, () => {
  const arch = new Arch3dFile();
  arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA'))));
  for (const [key, rules] of Object.entries(SEAM_RULES)) {
    const id = Number(key);
    const index = arch.getRecordIndex(id);
    assert.notEqual(index, -1, `${id}: in ARCH3D`);
    const raw = arch.getMesh(index);
    const pts = pointsOf(raw);
    for (const r of rules) {
      if ('at' in r) {
        const hits = pts.filter((p) => Math.abs(p.x - r.at[0]) <= STRAY_EPS && Math.abs(p.y - r.at[1]) <= STRAY_EPS && Math.abs(p.z - r.at[2]) <= STRAY_EPS);
        assert.ok(hits.length > 0, `${id}: the stray corner (${r.at}) is there`);
      } else {
        for (const from of Object.keys(r.map)) {
          assert.ok(pts.some((p) => Math.abs(p[r.axis] - Number(from)) <= POINT_EPS), `${id}: corners at ${r.axis} ${from}`);
        }
      }
    }
    const out = pointsOf(patchSeams(id, raw));
    assert.equal(out.length, pts.length);
    const moved = out.filter((p, i) => p.x !== pts[i].x || p.y !== pts[i].y || p.z !== pts[i].z);
    assert.ok(moved.length > 0, `${id}: something moves`);
    assert.ok(out.every((p, i) => p.u === pts[i].u && p.v === pts[i].v && p.nx === pts[i].nx), `${id}: texture coordinates and normals kept`);
  }
});

test('DUNGEON-SEAMS (real data): the census - every ruled model sealed, nothing opened anywhere else', { skip: skipReal }, () => {
  const base = census(ARENA2);
  const fixed = census(ARENA2, { patched: true });
  assert.equal(fixed.blocks, base.blocks);
  assert.ok(base.blocks > 150, 'every dungeon block of the game');
  // What stays open on a ruled model, and why:
  //  56300 - the spiral's central post, 35 mm off the shaft's floor piece (56002) - not a tread's end;
  //  59002 - N0000008 stands this stair two units over its room's floor (58029), where N0000007 stands it on its own:
  //          the placement's, and a model rule that closed it would open the other;
  //  61118, 61218 - the wall's foot under the first tread, now two units from the tread's riser: inside the stair's
  //          solid, where no eye goes;
  //  63026 - N0000037 runs two in a row: the lower flight's top tread passes 5 mm under the upper's first riser
  //          (it was 25 mm).
  const RESIDUAL = { 56300: 3, 59002: 21, 61118: 5, 61218: 1, 63026: 1 };
  let ruledBefore = 0;
  for (const key of Object.keys(SEAM_RULES)) {
    const id = Number(key);
    const b = base.byModel.get(id)?.seams ?? 0, f = fixed.byModel.get(id)?.seams ?? 0;
    ruledBefore += b;
    assert.ok(b > 0, `${id}: open before the patch - a rule for a model with nothing to close is a mistake`);
    assert.ok(f <= (RESIDUAL[id] ?? 0), `${id}: ${b} seams -> ${f}`);
  }
  assert.ok(ruledBefore > 15000, `the ruled models were most of the seams (${ruledBefore} of ${base.seams})`);
  for (const [id, m] of fixed.byModel) {
    const was = base.byModel.get(id);
    assert.ok(m.seams <= (was?.seams ?? 0), `${id}: no seam opened by a neighbour's move (${was?.seams ?? 0} -> ${m.seams})`);
  }
  const NEW_EDGES = new Set([
    '59002 40,-2,44 | -168,-2,44  ~ 58029',
    '61118 -64,0,-128 | -64,0,-104  ~ itself',
    '61118 64,0,-104 | 64,0,-128  ~ itself',
    '61218 64,0,-104 | 64,0,-128  ~ itself',
    '63026 -2,0,68 | -128,0,68  ~ 63026',
  ]);
  for (const [id, m] of fixed.byModel) {
    for (const e of m.edges.keys()) {
      if (base.byModel.get(id)?.edges.has(e)) continue;
      assert.ok(NEW_EDGES.has(`${id} ${e}`), `${id}: a new seam ${e}`);
    }
  }
  assert.ok(fixed.seams <= base.seams / 4, `${base.seams} seams -> ${fixed.seams}`);
});
