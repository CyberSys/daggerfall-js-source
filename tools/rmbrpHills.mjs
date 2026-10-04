// TREES-SEATED (FIELD BUGS 2026-10-03b): THE RMB RESOURCE PACK'S HILLS, MEASURED - the table the port's stand-ins
// (src/world/townStandIns.js RMBRP_HILLS, sized by the catalogue's Small/Medium/Large) would be re-sized from.
//
//   git clone --depth 1 https://github.com/drcarademono/rmb-resource-pack <dir>   (GIT_LFS_SKIP_SMUDGE=1 is enough)
//   node tools/rmbrpHills.mjs <dir>
//
// Reads, for each hill id the port stands in: its prefab (Prefabs/Hills/{Grass,Stone}/<id>.prefab), the .blend its mesh
// lives in (found by the guid in Assets/**.blend.meta), the mesh's vertices and faces out of the .blend itself (Blender's
// own SDNA - no Blender needed), and the scale the prefab stands it at: the .blend object's own (0.01 - the mesh is in
// centimetres) unless the prefab sets one (the Medium prefabs 0.005, the Small 0.0025). Prints each hill's half-extents,
// top and base in metres beside the stand-in's [radius, height]. Nothing of the pack is written or kept - the clone is
// the user's, and the numbers are a measurement of it (the rocks, stalls and docks were measured the same way).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RMBRP_HILLS } from '../src/world/townStandIns.js';

const root = process.argv[2];
if (!root || !existsSync(join(root, 'Prefabs/Hills'))) {
  console.error('usage: node tools/rmbrpHills.mjs <a clone of drcarademono/rmb-resource-pack>');
  process.exit(1);
}

/** Every file under `dir` whose name ends in `suffix`. */
function walk(dir, suffix, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, suffix, out); else if (n.endsWith(suffix)) out.push(p);
  }
  return out;
}

/** A .blend's file blocks and its SDNA (Blender's own description of its structs). */
function readBlend(path) {
  const b = readFileSync(path);
  if (b.toString('latin1', 0, 7) !== 'BLENDER') throw new Error(`${path}: not a .blend`);
  const ptr = b[7] === 0x2d ? 8 : 4, le = b[8] === 0x76;
  const i32 = (o) => (le ? b.readInt32LE(o) : b.readInt32BE(o)), u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const i16 = (o) => (le ? b.readInt16LE(o) : b.readInt16BE(o)), f32 = (o) => (le ? b.readFloatLE(o) : b.readFloatBE(o));
  const blocks = [];
  for (let o = 12; o < b.length;) {
    const code = b.toString('latin1', o, o + 4), size = i32(o + 4), sdna = i32(o + 8 + ptr), count = i32(o + 12 + ptr), data = o + 16 + ptr;
    blocks.push({ code, size, sdna, count, data });
    if (code === 'ENDB') break;
    o = data + size;
  }
  const dna = blocks.find((k) => k.code === 'DNA1');
  let p = dna.data + 4;
  const strings = () => { const n = i32(p + 4); p += 8; const out = []; for (let k = 0; k < n; k++) { const e = b.indexOf(0, p); out.push(b.toString('latin1', p, e)); p = e + 1; } return out; };
  const align = () => { p = (p + 3) & ~3; };
  const names = strings(); align();
  const types = strings(); align();
  p += 4; const tlen = types.map((_, k) => i16(p + k * 2)); p += types.length * 2; align();
  p += 4; const nStructs = i32(p); p += 4;
  const structs = [];
  for (let k = 0; k < nStructs; k++) {
    const t = i16(p), nf = i16(p + 2); p += 4;
    const fields = [];
    for (let f = 0; f < nf; f++) { fields.push([types[i16(p)], names[i16(p + 2)]]); p += 4; }
    structs.push({ name: types[t], fields });
  }
  /** byte offset of `field` in struct `name`, and the struct's index */
  const offset = (name, field) => {
    const si = structs.findIndex((s) => s.name === name);
    let o = 0;
    for (const [type, fname] of structs[si].fields) {
      if (fname === field) return { si, o };
      const isPtr = fname.startsWith('*') || fname.startsWith('(*');
      const dims = [...fname.matchAll(/\[(\d+)\]/g)].reduce((m, x) => m * Number(x[1]), 1);
      o += (isPtr ? ptr : tlen[types.indexOf(type)]) * dims;
    }
    throw new Error(`${path}: ${name}.${field} not in this .blend's SDNA`);
  };
  const rows = (name, field, read) => {
    const { si, o } = offset(name, field), out = [];
    for (const k of blocks) if (k.sdna === si && k.code === 'DATA') { const stride = k.size / k.count; for (let r = 0; r < k.count; r++) out.push(read(k.data + r * stride + o)); }
    return out;
  };
  const verts = rows('MVert', 'co[3]', (o) => [f32(o), f32(o + 4), f32(o + 8)]);
  const loops = rows('MLoop', 'v', (o) => u32(o));
  const starts = rows('MPoly', 'loopstart', (o) => i32(o)), totals = rows('MPoly', 'totloop', (o) => i32(o));
  const ob = (() => { try { return offset('Object', 'scale[3]'); } catch { return offset('Object', 'size[3]'); } })();   // Blender 3.0 names it size[3]
  const objScale = blocks.filter((k) => k.code.startsWith('OB') && k.sdna === ob.si).map((k) => f32(k.data + ob.o));
  return { verts, loops, polys: starts.map((s, k) => [s, totals[k]]), objScale: objScale[0] ?? 1 };
}

const metas = walk(join(root, 'Assets'), '.blend.meta');
const blendOfGuid = (guid) => metas.find((m) => readFileSync(m, 'utf8').includes(`guid: ${guid}`))?.slice(0, -'.meta'.length) ?? null;

console.log('id     half-extents (m)   top (m)  base (m)   stand-in [radius, height]   (mesh y up; the scale the prefab stands it at)');
for (const [id, [r, h]] of Object.entries(RMBRP_HILLS)) {
  const prefab = ['Grass', 'Stone'].map((d) => join(root, 'Prefabs/Hills', d, `${id}.prefab`)).find(existsSync);
  if (!prefab) { console.log(`${id}  no prefab`); continue; }
  const text = readFileSync(prefab, 'utf8');
  const guid = /m_SourcePrefab: \{fileID: -?\d+, guid: ([0-9a-f]+)/.exec(text)?.[1] ?? /m_Mesh: \{fileID: -?\d+, guid: ([0-9a-f]+)/.exec(text)?.[1];
  const blend = guid ? blendOfGuid(guid) : null;
  if (!blend) { console.log(`${id}  no mesh found`); continue; }
  const m = readBlend(blend);
  const override = /m_LocalScale\.x\s*\n\s*value: ([\d.e-]+)/.exec(text)?.[1] ?? /m_LocalScale: \{x: ([\d.e-]+)/.exec(text)?.[1];
  const s = override != null && Number(override) !== 1 ? Number(override) : m.objScale;
  const used = new Set(m.polys.flatMap(([a, n]) => m.loops.slice(a, a + n)));
  const vs = [...used].map((k) => m.verts[k]);
  const ext = (k) => [Math.min(...vs.map((v) => v[k])), Math.max(...vs.map((v) => v[k]))];
  const [x0, x1] = ext(0), [y0, y1] = ext(1), [z0, z1] = ext(2);
  console.log(`${id}  ${(((x1 - x0) / 2) * s).toFixed(1).padStart(5)} x ${(((z1 - z0) / 2) * s).toFixed(1).padEnd(5)}      ${(y1 * s).toFixed(2).padStart(6)}   ${(y0 * s).toFixed(2).padStart(6)}     [${r}, ${h}]   (${s}, ${blend.split('/').slice(-2).join('/')})`);
}
