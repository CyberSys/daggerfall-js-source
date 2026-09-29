// MW-BRIG1 (2026-09-29, Mac: "This is for the morrowind model. The steel
// brigantine"): THE PORT'S OWN WORN MODEL, PINNED.
//
// Roleplay & Realism Items' Jerkin in Steel - "Brigandine Jerkin" by its
// own mint - wore retail's steel_cuirass on the Morrowind body. It wears
// Mac's brigandine now: baked from his committed FBX and PNG by
// tools/bakeBrigandine.mjs, split at the belt into a Chest piece and a
// Groin piece, and attached where he fitted it - its vertices are in the
// skeleton's REST space, and the binder takes the bone's rest transform
// back out (mwFirstPerson.js restPoseInverse).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseNif } from '../src/formats/mwNifFile.js';
import { flattenNif } from '../src/formats/mwNifMesh.js';
import { decodeTextureImage } from '../src/formats/mwTexture.js';
import { assembleFirstPersonArm, poseAssembly, restPoseInverse } from '../src/formats/mwFirstPerson.js';
import { composeWornArmor, ARMO_PART, itemMapCoverage } from '../src/formats/mwItemMap.js';
import { collectArmTextures } from '../src/combat/fpArm.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { RRI_TEMPLATES, rriVariantWord } from '../src/systems/rriItems.js';
import { OWN_MW_ARMOR, RRI_JERKIN_TEMPLATE, ownArmorModelFor, ownArmorModelPaths } from '../src/characters/ownArmorModels.js';
import { ownMwDataPath } from '../src/systems/ownMwAssets.js';
import { writeNif } from '../tools/nifWrite.mjs';
import { readFbx, nodeAt, childNamed } from '../tools/fbxRead.mjs';
import { polygonsOf, earClip, isConvexPolygon } from '../tools/fbxMesh.mjs';
import { readPng } from '../tools/pngIO.mjs';
import { SETTINGS, OUT, SOURCE_FBX, SOURCE_PNG, TEXTURE_NAME, bakeBrigandine, splitMesh, belowBelt } from '../tools/bakeBrigandine.mjs';

const onDisk = (p) => new Uint8Array(readFileSync(new URL(`../${p}`, import.meta.url)));
const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));   // a Buffer, as the bake's readers take
const sourceText = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const baked = bakeBrigandine(raw(SOURCE_FBX), raw(SOURCE_PNG));
const STEEL_JERKIN = Object.freeze({ templateIndex: RRI_JERKIN_TEMPLATE, material: ARMOR_MATERIAL.Steel });

test('MW-BRIG1: the shipped assets are REPRODUCED from the committed sources, byte for byte', () => {
  // The Thunderlock's lesson (fieldgunmw.test.js): a pin that reads a
  // committed artefact tests the artefact, not the thing that made it.
  for (const [what, bytes, path] of [['chest', baked.chestNif, OUT.chest], ['skirt', baked.skirtNif, OUT.skirt], ['texture', baked.dds, OUT.texture]]) {
    const disk = onDisk(path);
    assert.equal(Buffer.compare(Buffer.from(bytes), Buffer.from(disk)), 0,
      `${path} (${what}) is not what tools/bakeBrigandine.mjs produces from ${SOURCE_FBX} + ${SOURCE_PNG} - re-run it`);
  }
  const again = bakeBrigandine(raw(SOURCE_FBX), raw(SOURCE_PNG));
  assert.equal(Buffer.compare(Buffer.from(again.chestNif), Buffer.from(baked.chestNif)), 0, 'two runs, one chest');
  assert.equal(Buffer.compare(Buffer.from(again.skirtNif), Buffer.from(baked.skirtNif)), 0, 'two runs, one skirt');
  assert.equal(Buffer.compare(Buffer.from(again.dds), Buffer.from(baked.dds)), 0, 'two runs, one texture');
  // The sources are what they claim to be: a swapped file is a red
  // suite, not a silently different garment.
  const sha = (p) => createHash('sha256').update(onDisk(p)).digest('hex');
  assert.equal(sha(SOURCE_FBX), 'baa21240f2e38ca408531ef28efc951639279cde9ff0879953a00ee993aec36a', 'Mac\'s export, as supplied');
  assert.equal(sha(SOURCE_PNG), 'cde8d2b8870dbb35833329e39d43ac7914f45d60dbf1791309f81cc44159a51c', 'its texture, as supplied');
});

test('MW-BRIG1: the bake keeps where Mac fitted it - scene placement, Morrowind\'s facing', () => {
  const b = baked.mesh.bake;
  assert.equal(b.placement, 'scene');
  assert.deepEqual(b.sceneTranslation, [0, 0, 64], 'the object sat 64 units up in his scene, and still does');
  assert.equal(b.clipped, 6, 'the six concave faces round the clasps are ear-clipped, not refused');
  // ...and each clip covers its face exactly: the triangles' areas sum
  // to the face's own (Newell) area and every one keeps the face's
  // winding - no shard outside, no hole, no flipped triangle.
  const geo = nodeAt(readFbx(raw(SOURCE_FBX)).nodes, 'Objects', 'Geometry');
  const V = childNamed(geo, 'Vertices').props[0];
  const faces = [];
  for (const poly of polygonsOf(childNamed(geo, 'PolygonVertexIndex').props[0])) {
    const pts = poly.map((i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]]);
    if (pts.length > 3 && !isConvexPolygon(pts)) faces.push(pts);
  }
  assert.equal(faces.length, 6);
  const sub = (a, c) => a.map((x, i) => x - c[i]);
  const crs = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
  for (const pts of faces) {
    const nrm = [0, 0, 0];
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; nrm[0] += (p[1] - q[1]) * (p[2] + q[2]); nrm[1] += (p[2] - q[2]) * (p[0] + q[0]); nrm[2] += (p[0] - q[0]) * (p[1] + q[1]); });
    const len = Math.hypot(...nrm);
    let area = 0;
    for (const [i, j, k] of earClip(pts)) {
      const x = crs(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
      const signed = (x[0] * nrm[0] + x[1] * nrm[1] + x[2] * nrm[2]) / len;
      assert.ok(signed > 0, 'a clipped triangle keeps the face\'s winding');
      area += signed / 2;
    }
    assert.ok(Math.abs(area - len / 2) < 1e-9, `the clip covers the face: ${area} vs ${len / 2}`);
  }
  assert.equal(baked.mesh.indices.length / 3, 864);
  // THE SIZE IS HIS: 29.4 wide, 61 tall, nothing normalised - a
  // knee-length garment on a Morrowind body, 1 Blender unit to 1 unit.
  const { min, max } = baked.mesh.bounds;
  assert.ok(Math.abs((max[0] - min[0]) - 29.389) < 0.01, `width ${max[0] - min[0]}`);
  assert.ok(Math.abs(min[2] - 33.888) < 0.01 && Math.abs(max[2] - 94.763) < 0.01, `height ${min[2]}..${max[2]}`);
  // THE FRONT FACES +Y. The three clasps are the brigandine's three
  // small separate islands (twenty vertices each, down its centre line);
  // they were on the scene's -Y side and must land on Morrowind's +Y,
  // where an actor faces.
  const P = baked.mesh.positions; const I = baked.mesh.indices;
  const keyOf = (i) => `${P[i * 3].toFixed(4)},${P[i * 3 + 1].toFixed(4)},${P[i * 3 + 2].toFixed(4)}`;
  const parent = new Map();
  const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
  for (let i = 0; i < P.length / 3; i++) if (!parent.has(keyOf(i))) parent.set(keyOf(i), keyOf(i));
  for (let t = 0; t < I.length; t += 3) for (const j of [1, 2]) parent.set(find(keyOf(I[t + j])), find(keyOf(I[t])));
  const islands = new Map();
  for (const k of parent.keys()) { const r = find(k); islands.set(r, [...(islands.get(r) ?? []), k.split(',').map(Number)]); }
  const clasps = [...islands.values()].filter((pts) => pts.length <= 30);
  assert.equal(clasps.length, 3, `three clasps (${[...islands.values()].map((v) => v.length)})`);
  const front = clasps.flat().filter((p) => p[1] > 0).length;
  const back = clasps.flat().length - front;
  assert.ok(front === 60 && back === 0, `the clasps face forward: ${front} vertices at +Y, ${back} at -Y`);
});

test('MW-BRIG1: the belt line sits in a GAP, and the split is exact', () => {
  // No vertex between the skirt's top loop and the belt's bottom loop -
  // so the line is well-posed: anywhere in the gap is the same split.
  const P = baked.mesh.positions;
  const inGap = [];
  for (let i = 2; i < P.length; i += 3) if (P[i] > 63.3 && P[i] < 64.9) inGap.push(P[i]);
  assert.deepEqual(inGap, [], 'nothing between the loops');
  assert.ok(SETTINGS.beltLine > 63.3 && SETTINGS.beltLine < 64.9);
  // Every triangle is on exactly one side.
  assert.equal(baked.chest.indices.length + baked.skirt.indices.length, baked.mesh.indices.length);
  assert.ok(baked.chest.bounds.min[2] >= SETTINGS.beltLine, 'the chest does not reach below the belt');
  assert.ok(baked.skirt.bounds.max[2] < 65.5, 'the skirt ends at the belt\'s lower edge');
  assert.ok(baked.skirt.bounds.min[2] < 34, 'and runs to the hem');
  // THE SEAM IS SHARED: the belt's lower loop is in both pieces, so the
  // two meet where the leather already draws a line.
  const key = (p, i) => `${p[i].toFixed(4)},${p[i + 1].toFixed(4)},${p[i + 2].toFixed(4)}`;
  const chestKeys = new Set();
  for (let i = 0; i < baked.chest.positions.length; i += 3) chestKeys.add(key(baked.chest.positions, i));
  let shared = 0;
  for (let i = 0; i < baked.skirt.positions.length; i += 3) if (chestKeys.has(key(baked.skirt.positions, i))) shared++;
  assert.ok(shared >= 17, `the seam loop is in both pieces (${shared} shared vertices)`);
});

test('MW-BRIG1: splitMesh keeps each side self-contained', () => {
  // A strip of two triangles: A (v0 v1 v2) touches z 0 and goes below
  // the line; B (v2 v3 v4) sits wholly at z >= 1 and stays above. They
  // share v2, and each side re-indexes from 0 with its own copy of it.
  const mesh = { name: 'm', positions: [0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 2], normals: null,
    uvs: [0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1], indices: [0, 1, 2, 2, 3, 4] };
  const [top, bottom] = splitMesh(mesh, belowBelt(0.5));
  assert.deepEqual(bottom.indices, [0, 1, 2]);
  assert.deepEqual(bottom.positions, [0, 0, 0, 1, 0, 0, 0, 0, 1]);
  assert.deepEqual(top.indices, [0, 1, 2]);
  assert.deepEqual(top.positions, [0, 0, 1, 1, 0, 1, 0, 0, 2]);
  assert.deepEqual(top.uvs, [0, 0.5, 1, 0.5, 0, 1]);
  assert.equal(top.normals, null);
  assert.deepEqual(top.bounds, { min: [0, 0, 1], max: [1, 0, 2] });
});

test('MW-BRIG1: the shipped NIFs read back through the port\'s own doors, painted', () => {
  for (const [path, piece] of [[OUT.chest, baked.chest], [OUT.skirt, baked.skirt]]) {
    const batches = flattenNif(parseNif(onDisk(path)));
    assert.equal(batches.length, 1, `${path}: one shape`);
    const b = batches[0];
    assert.equal(b.skinned, false, 'a rigid part - the binder places it');
    assert.equal(b.material.twoSided, true, 'two-sided: a garment is an open shell, its inside shows at the hem');
    assert.equal(b.positions.length, piece.positions.length);
    for (let i = 0; i < piece.positions.length; i++) {
      assert.ok(Math.abs(b.positions[i] - piece.positions[i]) < 1e-4, `${path} vertex ${i}: authored space survives the NIF`);
    }
  }
  // The texture resolves through the lane's own ladder and is Mac's
  // painting, pixel for pixel at the top level - not the magenta warning.
  const files = new Map([[`textures/${TEXTURE_NAME}`, onDisk(OUT.texture)]]);
  const arc = { has: (p) => files.has(p), get: (p) => files.get(p) };
  const textures = collectArmTextures(flattenNif(parseNif(onDisk(OUT.chest))), [arc]);
  const entry = textures.get(TEXTURE_NAME);
  assert.ok(entry?.ok, `the texture decoded: ${entry?.error}`);
  assert.equal(entry.path, `textures/${TEXTURE_NAME}`);
  const png = readPng(raw(SOURCE_PNG));
  const top = decodeTextureImage(OUT.texture, onDisk(OUT.texture)).mips[0];
  assert.equal(top.width, png.width);
  assert.deepEqual(Array.from(top.rgba), Array.from(png.data), 'the DDS is the PNG');
});

test('MW-BRIG1: the Steel Brigandine Jerkin wears it; nothing else does', () => {
  // The template is the mod's Jerkin, and Steel mints it "Brigandine".
  assert.equal(RRI_TEMPLATES.find((t) => t.index === RRI_JERKIN_TEMPLATE)?.name, 'Jerkin');
  assert.equal(rriVariantWord(STEEL_JERKIN), 'Brigandine ');
  assert.equal(ownArmorModelFor(STEEL_JERKIN)?.id, 'daggerfall_brigandine_steel');
  // Every other material of the same jerkin - and Silver, which shares
  // Steel's Morrowind token - keeps the retail cuirass it had.
  for (const [name, m] of Object.entries(ARMOR_MATERIAL)) {
    if (m === ARMOR_MATERIAL.Steel) continue;
    assert.equal(ownArmorModelFor({ templateIndex: RRI_JERKIN_TEMPLATE, material: m }), null, `${name} jerkin`);
  }
  assert.equal(ownArmorModelFor({ templateIndex: 102, material: ARMOR_MATERIAL.Steel }), null, 'the classic Steel Cuirass is untouched');
  assert.equal(ownArmorModelFor(null), null);
  // Every mesh the table names ships, where the vendored archive keys it.
  for (const path of ownArmorModelPaths()) {
    assert.ok(existsSync(new URL(`../src/assets/mw/${path}`, import.meta.url)), `${path} ships`);
    assert.equal(ownMwDataPath(`../assets/mw/${path}`), path);
  }
  assert.ok(itemMapCoverage().some((c) => c.kind === 'own' && c.own === 'ownArmorModels' && c.material === 'Steel'));
});

test('MW-BRIG1: composed as an armour - Chest and Groin, the chest skin hidden, no retail record needed', () => {
  const worn = composeWornArmor({ pieces: [STEEL_JERKIN], armors: [], bodyPool: [] });
  assert.deepEqual(worn.notes, [], 'no record is asked for');
  assert.deepEqual(worn.adds.map((a) => [a.partName, a.bones.join(), a.model, a.restPose]), [
    ['cuirass', 'chest', 'brigandine_steel_chest.nif', true],
    ['skirt', 'groin', 'brigandine_steel_skirt.nif', true],
  ]);
  assert.deepEqual(worn.shadows, ['chest'], 'a cuirass hides the chest skin; a skirt hides nothing');
  // The priority law still holds: a robe (base 11) outranks it, as it
  // outranks any cuirass - the own model is an armour, not an exception.
  const skirtAt = ARMO_PART.findIndex((r) => r.name === 'skirt');
  assert.ok(skirtAt >= 0 && ARMO_PART[skirtAt].bones[0] === 'groin');
  // And an iron jerkin still asks the player's records, as before.
  const iron = composeWornArmor({ pieces: [{ templateIndex: RRI_JERKIN_TEMPLATE, material: ARMOR_MATERIAL.Iron }], armors: [], bodyPool: [] });
  assert.equal(iron.adds.length, 0);
  assert.match(iron.notes.join(), /armor 520: no iron cuirass/);
  // The build hands `restPose` to the binder at both of its worn-add
  // doors - the third-person body and the first-person camera's.
  const fp = sourceText('src/combat/fpArm.js');
  assert.equal((fp.match(/restPose: (row|add)\.restPose \?\? false/g) ?? []).length, 2);
});

// ── the binder, on a skeleton whose bones are NOT at the origin ──────
//
// Root, then a pelvis 60 up and turned 90 degrees about Z, then a chest
// 25 above it and tilted 30 degrees about X, and a groin under the
// pelvis. Retail's bones are turned like this; a part in rest space
// that forgot the inverse would be rotated and lifted by all of it.
const deg = Math.PI / 180;
const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
function skeletonBytes() {
  return writeNif([
    { type: 'NiNode', name: 'Root', children: [1] },
    { type: 'NiNode', name: 'Bip01 Pelvis', translation: [0, 0, 60], rotation: rotZ(90 * deg), children: [2, 3] },
    { type: 'NiNode', name: 'Chest', translation: [0, 0, 25], rotation: rotX(30 * deg), children: [] },
    { type: 'NiNode', name: 'Groin', translation: [0, 0, -2], children: [] },
  ], [0]);
}

test('MW-BRIG1: a rest-pose part lands where it was fitted, and then rides its bone', async () => {
  const parts = composeWornArmor({ pieces: [STEEL_JERKIN], armors: [], bodyPool: [] }).adds.map((a) => ({
    slot: a.slot, partName: a.partName, bones: a.bones, restPose: a.restPose,
    bytes: onDisk(a.model === 'brigandine_steel_chest.nif' ? OUT.chest : OUT.skirt),
  }));
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts });
  assert.ok(asm.ok, asm.error);
  assert.deepEqual(asm.notes, []);
  const chest = asm.pieces.find((p) => p.bone === 'chest');
  const skirt = asm.pieces.find((p) => p.bone === 'groin');
  assert.equal(chest.kind, 'rigid');
  // AT REST, EXACTLY WHERE MAC PUT IT - the bone's rest transform is
  // taken out at bind and put back by the pose.
  for (const [piece, mesh] of [[chest, baked.chest], [skirt, baked.skirt]]) {
    for (let i = 0; i < mesh.positions.length; i++) {
      assert.ok(Math.abs(piece.positions[i] - mesh.positions[i]) < 1e-3, `${piece.bone} vertex ${i}: ${piece.positions[i]} vs ${mesh.positions[i]}`);
    }
  }
  // WITHOUT the inverse the chest would be turned and lifted by its
  // bone's whole rest chain - which is what makes this pin able to fail.
  const plain = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: parts.map((p) => ({ ...p, restPose: false })) });
  const drift = Math.abs(plain.pieces.find((p) => p.bone === 'chest').positions[2] - baked.chest.positions[2]);
  assert.ok(drift > 20, `a plain rigid attach misplaces it (${drift.toFixed(1)} units)`);

  // AND IT RIDES THE BONE: turn the chest 90 degrees about its own Z and
  // the chest piece turns with it about the chest's rest position,
  // while the skirt on the groin does not move.
  const quatZ = (a) => [Math.cos(a / 2), 0, 0, Math.sin(a / 2)];
  const tracks = new Map([['chest', { chest: true }]]);
  const sampleTrack = () => ({ rotation: quatZ(90 * deg) });
  const before = Float32Array.from(skirt.positions);
  const rest = Float32Array.from(chest.positions);
  poseAssembly(asm, { tracks, sampleTrack, time: 0 });
  assert.deepEqual(Array.from(skirt.positions), Array.from(before), 'the skirt is on the groin, not the chest');
  // Distances from the chest bone's rest origin are kept (a rotation),
  // and the piece did move.
  const origin = [0, 0, 85];
  const dist = (a, i) => Math.hypot(a[i] - origin[0], a[i + 1] - origin[1], a[i + 2] - origin[2]);
  let moved = 0;
  for (let i = 0; i < rest.length; i += 3) {
    assert.ok(Math.abs(dist(rest, i) - dist(chest.positions, i)) < 1e-3, 'a rigid turn about the bone');
    moved = Math.max(moved, Math.hypot(rest[i] - chest.positions[i], rest[i + 1] - chest.positions[i + 1]));
  }
  assert.ok(moved > 10, `the chest piece turned with its bone (${moved.toFixed(1)})`);
});

test('MW-BRIG1: restPoseInverse is the inverse of the rest affine', async () => {
  const asm = await assembleFirstPersonArm({ skeletonBytes: skeletonBytes(), parts: [{ slot: 'x', bones: ['chest'], bytes: onDisk(OUT.chest) }] });
  const ref = asm.skeleton.byName.get('chest');
  const inv = restPoseInverse(asm.fns, asm.skeleton, ref);
  const rest = asm.mats.get(ref);
  // inv * rest = identity, on a point and on the axes.
  const apply = (m, p) => [0, 1, 2].map((r) => m.a[r * 3] * p[0] + m.a[r * 3 + 1] * p[1] + m.a[r * 3 + 2] * p[2] + m.t[r]);
  for (const p of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3, -7, 11]]) {
    const back = apply(inv, apply(rest, p));
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(back[k] - p[k]) < 1e-5, `${p} -> ${back}`);
  }
  // The chest's rest origin, by the chain above: 60 + 25 up.
  assert.ok(Math.abs(rest.t[2] - 85) < 1e-5 && Math.abs(rest.t[0]) < 1e-5);
  assert.equal(OWN_MW_ARMOR.every((a) => a.restPose === true), true, 'every own armour is authored in rest space (bakeBrigandine placement: scene)');
});
