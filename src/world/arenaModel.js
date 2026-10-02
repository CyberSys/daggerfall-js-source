// @ts-check
// ARENA1 (2026-10-02): THE COLOSSEUM, MODEL 864102 - Kamer's "Daggerfall Arena" 1.0, read back off the files
// tools/daggerfallArenaExtract.mjs wrote (vendor/daggerfall-arena/Models/), and rebuilt into the port's model shape.
//
// Mac, 2026-10-02: "The new arena. This is to be a centerpoint that fits in the middle of Daggerfall city." The
// prefab is one mesh in DFU's own model space (metres, +Y up, left-handed, Unity's winding - world/meshReader.js
// mints every classic model in that frame, so the bundle's numbers are used as they stand), its 23 submeshes wearing
// the classic pictures DFU's RuntimeMaterials puts on them (ApplyClimate 0: no climate, no season), and a
// non-convex MeshCollider of the same mesh.
//
// TWO HALVES, ONE MODEL:
// - KAMER'S OWN: the walls, the tiers, the floor, the roofs - 93% of the triangles, carried in Models/864102.bin.
// - DAGGERFALL'S OWN: the undercroft's passages are copies of Daggerfall's dungeon models (62009..72006) on its
//   3.2 m grid. A copy of an ARCH3D record is never carried (the bed-alias law, world/customModels.js), so the
//   vendored file lists them as PIECES - a model id, a turn, a place, the triangles that stand - and each is read out
//   of the player's own ARCH3D here (`arenaPieceModel`) and merged in (`composeArenaModel`). The tool compared every
//   triangle it left out against the same rebuild, so the merged model is the prefab's mesh again.
//
// The geometry is the pipeline's to build (scenes/dataPipeline.js asks world/customModels.js customCompositeFor):
// this module is pure - no fetch, no ARCH3D of its own - so a node test rebuilds exactly what the game draws.

/** The prefab's id - DFU's MeshReplacement answers it before ARCH3D (DFARENA.RMB places it). */
export const ARENA_MODEL_ID = 864102;
/** A piece's turns: 0-3 a quarter turn about +Y (x, z) -> (-z, x) each; 4-7 the same after a mirror in x. */
export const PIECE_TURNS = 8;

/**
 * A point (or a normal) of a classic piece under its turn - the mirror first (x -> -x), then the quarter turns.
 * @param {number[]} v [x, y, z]
 * @param {number} turn 0..7
 * @returns {number[]}
 */
export function pieceTransform(v, turn) {
  const x = turn >= 4 ? -v[0] : v[0], y = v[1], z = v[2];
  switch (turn & 3) {
    case 0: return [x, y, z];
    case 1: return [-z, y, x];
    case 2: return [-x, y, -z];
    default: return [z, y, -x];
  }
}

/**
 * Kamer's own half, out of the vendored index and binary, in the model shape world/meshReader.js mints (32-bit
 * indices - the renderer draws UNSIGNED_INT; no doors - a custom prefab gets none, as in DFU: the DOOR submesh is
 * decoration).
 * @param {any} index Models/864102.json
 * @param {Uint8Array} bin Models/864102.bin
 */
export function decodeArenaModel(index, bin) {
  const a = index.attributes;
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const n = index.vertexCount;
  const positions = new Float32Array(buf, a.position.offset, n * 3);
  const normals = new Float32Array(buf, a.normal.offset, n * 3);
  const uvs = new Float32Array(buf, a.uv0.offset, n * 2);
  const indices = Uint32Array.from(new Uint16Array(buf, a.indices.offset, a.indices.count));
  const subMeshes = index.submeshes.filter((s) => s.count > 0).map((s) => ({
    textureArchive: s.archive, textureRecord: s.record, startIndex: s.start, primitiveCount: s.count / 3,
  }));
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices, subMeshes, doors: [] };
}

/**
 * One piece rebuilt from its classic model (dfMeshToModel's shape, read out of the player's ARCH3D): the triangles
 * it keeps, turned and placed, a mirrored piece's wound back the right way out, a retextured triangle under its
 * picture. Answers the model shape.
 * @param {{ positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array, subMeshes: any[] }} classic
 * @param {{ model: number, turn: number, at: number[], keep: 'all' | number[], retexture?: Record<string, number[]> }} piece
 */
export function arenaPieceModel(classic, piece) {
  const keep = piece.keep === 'all' ? null : new Set(piece.keep);
  const mirrored = piece.turn >= 4;
  /** @type {Map<string, number[]>} */
  const groups = new Map();   // "<archive>_<record>" -> [classic triangle index]
  for (const sm of classic.subMeshes) {
    for (let t = sm.startIndex / 3; t < sm.startIndex / 3 + sm.primitiveCount; t++) {
      if (keep && !keep.has(t)) continue;
      const to = piece.retexture?.[t] ?? [sm.textureArchive, sm.textureRecord];
      const k = `${to[0]}_${to[1]}`;
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
  }
  const pos = [], nor = [], uv = [], idx = [], subMeshes = [];
  for (const [k, list] of groups) {
    const [archive, record] = k.split('_').map(Number);
    const startIndex = idx.length;
    for (const t of list) {
      const corners = [0, 1, 2].map((c) => classic.indices[t * 3 + c]);
      if (mirrored) corners.reverse();
      for (const v of corners) {
        const p = pieceTransform([classic.positions[v * 3], classic.positions[v * 3 + 1], classic.positions[v * 3 + 2]], piece.turn);
        const nn = pieceTransform([classic.normals[v * 3], classic.normals[v * 3 + 1], classic.normals[v * 3 + 2]], piece.turn);
        idx.push(pos.length / 3);
        pos.push(p[0] + piece.at[0], p[1] + piece.at[1], p[2] + piece.at[2]);
        nor.push(...nn);
        uv.push(classic.uvs[v * 2], classic.uvs[v * 2 + 1]);
      }
    }
    subMeshes.push({ textureArchive: archive, textureRecord: record, startIndex, primitiveCount: list.length });
  }
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: Uint32Array.from(idx), subMeshes, doors: [] };
}

/**
 * Kamer's half and the pieces, one model: the buffers end to end, each part's indices moved past the vertices before
 * it, every submesh kept (the renderer draws a submesh a picture, wherever it lies).
 * @param {any[]} parts models in the meshReader shape
 */
export function composeArenaModel(parts) {
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.positions.length / 3; ni += p.indices.length; }
  const positions = new Float32Array(nv * 3), normals = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), indices = new Uint32Array(ni);
  const subMeshes = [];
  let v0 = 0, i0 = 0;
  for (const p of parts) {
    positions.set(p.positions, v0 * 3);
    normals.set(p.normals, v0 * 3);
    uvs.set(p.uvs, v0 * 2);
    for (let i = 0; i < p.indices.length; i++) indices[i0 + i] = p.indices[i] + v0;
    for (const s of p.subMeshes) subMeshes.push({ ...s, startIndex: s.startIndex + i0 });
    v0 += p.positions.length / 3;
    i0 += p.indices.length;
  }
  return { positions, normals, uvs, indices, subMeshes, doors: [] };
}

/**
 * The whole colosseum: Kamer's half and every piece out of the player's ARCH3D. `classicOf(id)` answers a classic
 * model in dfMeshToModel's shape, or null when the player's ARCH3D has no such record (that piece is not drawn - the
 * rest of the arena still stands).
 * @param {any} index Models/864102.json
 * @param {Uint8Array} bin Models/864102.bin
 * @param {(id: number) => any} classicOf
 */
export function buildArenaModel(index, bin, classicOf) {
  const parts = [decodeArenaModel(index, bin)];
  for (const piece of index.pieces ?? []) {
    const classic = classicOf(piece.model);
    if (classic) parts.push(arenaPieceModel(classic, piece));
  }
  return composeArenaModel(parts);
}
