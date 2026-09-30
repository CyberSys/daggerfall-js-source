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
// byte for byte by test/mwbrig2.test.js - and departs where they are not:
//
//   WHERE IT SITS IS THE AUTHORING. Mac fitted the brigandine onto the
//   Morrowind body in his scene (his answer, asked: "fitted in place"),
//   so the bake keeps the scene placement - `placement: 'scene'`, see
//   tools/fbxMesh.mjs - 1 Blender unit to 1 Morrowind unit. A gun is
//   placed by the hand that grips it; a cuirass is placed by the body it
//   was fitted to. MW-BRIG3: the scene's body is NOT the skeleton at rest
//   - it stood lower, and drawn at the scene's height the brigandine sat
//   under the torso - so its height is measured on the wearer at bind time
//   (ownArmorModels.js `fitTo`, formats/mwSkinTransfer.js fitLift). The
//   bake keeps the scene's numbers; the binder puts it on the body.
//
//   THE TEXTURE IS PAINTED, NOT BAKED. The Thunderlock's DDS was grown
//   from its own geometry because Mac's export carried no texture; this
//   one carries Steel.png and UVs laid out for it, so the DDS is that
//   PNG, mip-chained, and the mesh keeps its own unwrap.
//
//   IT IS ONE PIECE, SKINNED FROM THE BODY AT BIND TIME (MW-BRIG2,
//   formats/mwSkinTransfer.js). MW-BRIG1 split it at the belt and hung the
//   halves rigid on the Chest and Groin nodes. Skinned from the chest,
//   groin, thighs and knees, the whole garment moves with the body it
//   covers, and the skirt bends with the legs. (What moved it in game, in
//   both builds, was the height above - MW-BRIG3.)
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
  mesh: 'src/assets/mw/meshes/brigandine_steel.nif',
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
});


const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };

export function bakeBrigandine(fbxBytes, pngBytes, { sheets = false } = {}) {
  const mesh = bakeMesh(readFbx(fbxBytes), {
    name: 'Steel Brigandine',
    placement: SETTINGS.placement, forward: SETTINGS.forward, up: SETTINGS.up,
  });
  const png = readPng(pngBytes);
  const dds = writeDds(mipChain({ width: png.width, height: png.height, data: png.data }));
  const out = { mesh, dds, png, nif: meshToNif(mesh, { texture: TEXTURE_NAME, node: 'Brigandine' }), sheets: null };
  if (sheets) {
    out.sheets = { preview: writePng(previewSheet(mesh, 360, { width: png.width, height: png.height, data: png.data })) };
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
  save(OUT.mesh, r.nif);
  save(OUT.texture, r.dds);
  const b = r.mesh.bake;
  console.log(`${fbx} + ${png}`);
  console.log(`  ${b.polygons} polygons (${b.clipped} ear-clipped) -> ${r.mesh.indices.length / 3} triangles, placed at ${b.sceneTranslation.join(', ')}`);
  console.log(`  z ${r.mesh.bounds.min[2].toFixed(2)}..${r.mesh.bounds.max[2].toFixed(2)}  -> ${OUT.mesh}  ${r.nif.length} bytes`);
  console.log(`  texture ${r.png.width}x${r.png.height} -> ${OUT.texture}  ${r.dds.length} bytes`);
  if (wantSheets) {
    for (const [k, bytes] of Object.entries(r.sheets)) { save(`scratch/brigandine-${k}.png`, bytes); console.log(`  scratch/brigandine-${k}.png`); }
  }
}
