// THE STEEL BRIGANDINE'S MORROWIND ASSETS, in one command.
//
//     node tools/bakeBrigandine.mjs [--fbx=src/assets/mw/source/Brigandine_Steel.fbx]
//                                   [--png=src/assets/mw/source/Brigandine_Steel.png]
//                                   [--sheets]
//
// MW-BRIG1 (2026-09-29, Mac: "This is for the morrowind model. The steel
// brigantine"). The second of the port's own Morrowind models, and the
// first one that is WORN rather than held: Roleplay & Realism Items'
// Jerkin in Steel - "Brigandine Jerkin" by its own mint (rriItems.js
// lightWord) - wore retail's steel_cuirass, and now wears this.
//
// tools/bakeThunderlock.mjs is the precedent and this follows it where
// the two are the same thing - the source committed beside what it
// makes, the numbers in a file somebody can read, the output re-made
// byte for byte by test/mwbrig1.test.js - and departs where they are not:
//
//   WHERE IT SITS IS THE AUTHORING. Mac fitted the brigandine onto the
//   Morrowind body in his scene (his answer, asked: "fitted in place"),
//   so the bake keeps the scene placement - `placement: 'scene'`, see
//   tools/fbxMesh.mjs - and the mesh lands in the skeleton's REST
//   space, 1 Blender unit to 1 Morrowind unit. A gun is placed by the
//   hand that grips it; a cuirass is placed by the body it was fitted to.
//
//   THE TEXTURE IS PAINTED, NOT BAKED. The Thunderlock's DDS was grown
//   from its own geometry because Mac's export carried no texture; this
//   one carries Steel.png and UVs laid out for it, so the DDS is that
//   PNG, mip-chained, and the mesh keeps its own unwrap.
//
//   IT IS TWO PIECES. The skirt reaches the knee, and a garment riding
//   the Chest bone alone swings its hem with the ribs. Mac's call, asked:
//   split at the belt - the body on Chest, the skirt on Groin, the two
//   bones Morrowind's own cuirass and skirt parts hang on (mwItemMap.js
//   ARMO_PART).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readFbx } from './fbxRead.mjs';
import { bakeMesh } from './fbxMesh.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { meshToNif } from './nifWrite.mjs';
import { previewSheet } from './meshSheets.mjs';
import { readPng, writePng } from './pngIO.mjs';
import { isMain } from './lib/isMain.mjs';

/** Mac's Blender export and the texture it names, committed so the bake
 *  is reproducible. (The FBX points at the PNG as "Steel.png"; it is
 *  kept under the asset's own name here.) */
export const SOURCE_FBX = 'src/assets/mw/source/Brigandine_Steel.fbx';
export const SOURCE_PNG = 'src/assets/mw/source/Brigandine_Steel.png';

export const OUT = Object.freeze({
  chest: 'src/assets/mw/meshes/brigandine_steel_chest.nif',
  skirt: 'src/assets/mw/meshes/brigandine_steel_skirt.nif',
  texture: 'src/assets/mw/textures/brigandine_steel.dds',
});

/** The DDS's name as the NIFs spell it: a BARE file, which
 *  `correctTexturePath` re-roots under `textures/` - the ladder the whole
 *  lane uses (the Thunderlock's own convention). */
export const TEXTURE_NAME = 'brigandine_steel.dds';

export const SETTINGS = Object.freeze({
  placement: 'scene',
  // THE FRONT, MEASURED: the buckle, the three clasps and the split in
  // the skirt are all on the scene's -Y side (the clasps sit at y -5.7
  // to -10, the whole of their extent), and Morrowind's actors face +Y.
  // So the bake turns it half round: forward -Y, up +Z.
  forward: '-y',
  up: '+z',
  // THE BELT'S LOWER EDGE, in scene units. A face goes to the SKIRT when
  // its lowest corner is below this line, and to the CHEST otherwise.
  //
  // Read off the mesh, not chosen: the belt's own faces (the brown band
  // and the buckle, sampled off Steel.png through their UVs) run from a
  // loop at z 64.95-65.33 up to 67.4, and the red cloth below it starts
  // at a loop at z 62.96-63.19. NO VERTEX lies between the two loops
  // (test/mwbrig1.test.js asserts the gap), so any line inside it is the
  // same split - 64 is its middle. The belt stays on the chest, and the
  // seam the two pieces share is the belt's lower edge, where the
  // leather already hides a line.
  beltLine: 64,
});

/**
 * ONE MESH, TWO: every triangle goes to exactly one side by `pick`, and
 * each side keeps only the vertices its own triangles use, re-indexed in
 * first-use order. A vertex on the seam is in BOTH - the two pieces ride
 * different bones, so neither can borrow the other's.
 */
export function splitMesh(mesh, pick) {
  const sides = [{ map: new Map(), positions: [], normals: [], uvs: [], indices: [] },
    { map: new Map(), positions: [], normals: [], uvs: [], indices: [] }];
  const P = mesh.positions; const N = mesh.normals; const U = mesh.uvs;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const tri = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    const side = sides[pick(tri.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])) ? 1 : 0];
    for (const i of tri) {
      let at = side.map.get(i);
      if (at === undefined) {
        at = side.positions.length / 3;
        side.map.set(i, at);
        side.positions.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        if (N) side.normals.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
        if (U) side.uvs.push(U[i * 2], U[i * 2 + 1]);
      }
      side.indices.push(at);
    }
  }
  return sides.map((s, k) => {
    const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < s.positions.length; i += 3) {
      for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], s.positions[i + a]); max[a] = Math.max(max[a], s.positions[i + a]); }
    }
    return {
      name: `${mesh.name}${k ? ' skirt' : ' chest'}`,
      positions: s.positions, normals: N ? s.normals : null, uvs: U ? s.uvs : null, indices: s.indices,
      bounds: { min, max },
    };
  });
}

/** The skirt's side of the belt: a face with any corner below the line. */
export const belowBelt = (line) => (corners) => Math.min(...corners.map((c) => c[2])) < line;

const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

export function bakeBrigandine(fbxBytes, pngBytes, { sheets = false } = {}) {
  const mesh = bakeMesh(readFbx(fbxBytes), {
    name: 'Steel Brigandine',
    placement: SETTINGS.placement, forward: SETTINGS.forward, up: SETTINGS.up,
  });
  const [chest, skirt] = splitMesh(mesh, belowBelt(SETTINGS.beltLine));
  const png = readPng(pngBytes);
  const dds = writeDds(mipChain({ width: png.width, height: png.height, data: png.data }));
  const out = {
    mesh, chest, skirt, dds, png,
    chestNif: meshToNif(chest, { texture: TEXTURE_NAME, node: 'Brigandine Chest' }),
    skirtNif: meshToNif(skirt, { texture: TEXTURE_NAME, node: 'Brigandine Skirt' }),
    sheets: null,
  };
  if (sheets) {
    const tex = { width: png.width, height: png.height, data: png.data };
    out.sheets = {
      chest: writePng(previewSheet(chest, 360, tex)),
      skirt: writePng(previewSheet(skirt, 360, tex)),
    };
  }
  return out;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
  const fbx = opt('fbx', SOURCE_FBX);
  const png = opt('png', SOURCE_PNG);
  const wantSheets = args.includes('--sheets');
  const r = bakeBrigandine(readFileSync(fbx), readFileSync(png), { sheets: wantSheets });
  save(OUT.chest, r.chestNif);
  save(OUT.skirt, r.skirtNif);
  save(OUT.texture, r.dds);
  const b = r.mesh.bake;
  const span = (m) => `z ${m.bounds.min[2].toFixed(2)}..${m.bounds.max[2].toFixed(2)}`;
  console.log(`${fbx} + ${png}`);
  console.log(`  ${b.polygons} polygons (${b.clipped} ear-clipped) -> ${r.mesh.indices.length / 3} triangles, placed at ${b.sceneTranslation.join(', ')}`);
  console.log(`  chest  ${r.chest.indices.length / 3} triangles, ${span(r.chest)}  -> ${OUT.chest}  ${r.chestNif.length} bytes`);
  console.log(`  skirt  ${r.skirt.indices.length / 3} triangles, ${span(r.skirt)}  -> ${OUT.skirt}  ${r.skirtNif.length} bytes`);
  console.log(`  texture ${r.png.width}x${r.png.height} -> ${OUT.texture}  ${r.dds.length} bytes`);
  if (wantSheets) {
    for (const [k, bytes] of Object.entries(r.sheets)) { save(`scratch/brigandine-${k}.png`, bytes); console.log(`  scratch/brigandine-${k}.png`); }
  }
}
