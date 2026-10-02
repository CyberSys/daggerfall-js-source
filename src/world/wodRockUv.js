// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FB1001-WODROCK (2026-10-01, the field: "MASSIVE buggy mountain at 823, 399 - insane"; Mac: "Retexture them to be as
// detailed as possible") - A STRETCHED WORLD OF DAGGERFALL PIECE KEEPS ITS PEBBLE'S TEXEL DENSITY.
//
// World of Daggerfall's Rocks and Mountains layouts build their outcrops and massifs out of ARCH3D's pebbles - models
// 60610 and 60711-60720 (0.7 to 5.5 m, 20 to 65 triangles, texture 141.2 or 41.0) - scaled by 200 to 5,800 on an
// axis (LocationHelper.cs:1243 multiplies the scale, and nothing else in the mod or in DFU's
// GameObjectHelper.CreateDaggerfallMeshGameObject / MeshReader.GetMesh touches the UVs). The model's own UVs ride the
// scale, so one 64x64 texture repeat covers 600 m to 2.6 km of a spire's face: the 1.4 km spire of
// WOD_Mountain_01r1 at (824,399) read as ground texture smeared up a cliff. The pieces stand where they stand and as
// tall as they are; their FACES are re-mapped.
//
// THE LAW. A piece whose matrix stretches the model by WOD_ROCK_STRETCH_MIN or more on any axis gets new UVs, plane by
// plane: each of the model's planes (the triangles that share vertices and lie in one plane - dfMeshToModel emits
// each DF plane its own vertices) is UNFOLDED ISOMETRICALLY. A frame (t, b) is laid in the unscaled plane along one of
// its triangle's edges and the same frame in the scaled plane along the same edge; a vertex's metric coordinates in
// the scaled plane, read through the unscaled plane's own UV map, give its UV. So every face of the scaled piece
// carries the texture exactly as the pebble's face carried it - the same texels per metre in every direction, the
// same orientation against the face's edge - and tiles it across the face (renderer.js uploads world art REPEAT with
// a mip chain, so a repeat is free and the far view takes the chain). A plane's map is ONE affine function of the
// position, so the triangles that make a plane meet without a seam. Each plane's UVs are then shifted by whole
// repeats to start near zero (REPEAT makes the shift invisible; it keeps a 2.5 km face's UVs in the low thousands).
// A vertex two planes share (not one dfMeshToModel makes) is given to the first and copied for the rest.
//
// Below the threshold the model comes back as the SAME object, so a camp, a house, a shrine statue (2.65 at most)
// batches byte for byte as before. Object 2's million-scale rock is mapped like any other - in place, its 90
// vertices - and is never seen (the camera stands inside it; renderer far plane 6,000).
// A LEAF: no imports.
// ═══════════════════════════════════════════════════════════════════

/** A piece stretched by this much or more on any axis takes the unfolded UVs. Of the 65 layouts' 1,325 model
 *  records, 746 of the 784 rock pieces (60610, 60711-60720, 41719) stand at 4 or more - the other 38 at 1 to 3.9,
 *  their texture at most 3.9 times its pebble's - and 101 others reach it: a fort's palisade (43001 at 6 x 2 x 4,
 *  38), the docks' planks and piles (58041, 61027, 6804: 60) and a fort's 41106 at 2 x 1.5 x 5 (3), whose stretched planks tile now
 *  too. Under it stand the camps, the houses and the shrine's statue (uniform 2.65). */
export const WOD_ROCK_STRETCH_MIN = 4;

/** The longest column of a column-major matrix's upper 3x3 - the piece's largest |scale|, whatever its rotation. */
export function pieceStretch(m) {
  return Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const scaled = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/**
 * The UVs a WoD piece is drawn with: the model's own below the stretch threshold (the SAME object back), else the
 * isometric unfolding above, plane by plane.
 * @template {{positions: Float32Array, normals?: Float32Array, uvs?: Float32Array, indices: Uint32Array, subMeshes: Array<any>}} M
 * @param {M} cpu - the model in its own frame, UVs as dfMeshToModel leaves them (a repeat is 1)
 * @param {ArrayLike<number>} matrix - the piece's column-major matrix (objectMatrix: T * R * S)
 * @param {number} [minStretch]
 * @returns {M}
 */
export function wodRockUvs(cpu, matrix, minStretch = WOD_ROCK_STRETCH_MIN) {
  if (!cpu?.uvs || !cpu.indices?.length || !(pieceStretch(matrix) + 1e-4 >= minStretch)) return cpu;   // a float32 matrix holds a scale of 4 as 3.9999998
  const P = cpu.positions, UV = cpu.uvs, I = cpu.indices;
  const nV = P.length / 3, nT = I.length / 3;
  const pos = (v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
  const lin = (d) => [   // the matrix's linear part on a direction
    matrix[0] * d[0] + matrix[4] * d[1] + matrix[8] * d[2],
    matrix[1] * d[0] + matrix[5] * d[1] + matrix[9] * d[2],
    matrix[2] * d[0] + matrix[6] * d[1] + matrix[10] * d[2],
  ];

  // the patches: triangles joined through a shared vertex
  const parent = new Int32Array(nV).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < nT; t++) {
    const a = find(I[t * 3]), b = find(I[t * 3 + 1]), c = find(I[t * 3 + 2]);
    parent[b] = a; parent[find(c)] = a;
  }
  // the model's size, for the plane test's tolerance
  let ext = 0;
  for (let i = 0; i < P.length; i++) ext = Math.max(ext, Math.abs(P[i]));
  const tol = Math.max(ext, 1e-6) * 1e-4;

  // the planes: within a patch, the triangles of one normal and one offset
  /** @type {Array<{n: number[], d: number, tris: number[]}>} */
  const planes = [];
  const byRoot = new Map();
  for (let t = 0; t < nT; t++) {
    const pa = pos(I[t * 3]), n0 = cross(sub(pos(I[t * 3 + 1]), pa), sub(pos(I[t * 3 + 2]), pa)), l = len(n0);
    const root = find(I[t * 3]);
    let list = byRoot.get(root);
    if (!list) byRoot.set(root, list = []);
    let g = -1;
    if (l > 0) {
      const n = scaled(n0, 1 / l), d = dot(n, pa);
      g = list.find((k) => dot(planes[k].n, n) > 1 - 1e-4 && Math.abs(dot(planes[k].n, pa) - planes[k].d) <= tol) ?? -1;
      if (g < 0) { g = planes.length; planes.push({ n, d, tris: [] }); list.push(g); }
    } else if (list.length) g = list[0];   // a sliver draws nothing: it rides its patch's first plane
    else { g = planes.length; planes.push({ n: [0, 0, 0], d: 0, tris: [] }); list.push(g); }
    planes[g].tris.push(t);
  }

  // each plane's unfolding
  const out = { positions: [], normals: [], uvs: [] };   // vertices a second plane copies, appended
  const uvs = new Float32Array(UV);
  let indices = I;
  const owner = new Int32Array(nV).fill(-1);
  const copyOf = new Map();   // `${plane}:${vertex}` -> its copy's index
  let next = nV;
  for (let g = 0; g < planes.length; g++) {
    const { tris } = planes[g];
    // the reference triangle: the largest one whose UVs span the plane
    let ref = -1, best = 0;
    for (const t of tris) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
      const area = len(cross(sub(pos(b), pos(a)), sub(pos(c), pos(a))));
      const det = (UV[b * 2] - UV[a * 2]) * (UV[c * 2 + 1] - UV[a * 2 + 1]) - (UV[c * 2] - UV[a * 2]) * (UV[b * 2 + 1] - UV[a * 2 + 1]);
      if (area > best && Math.abs(det) > 1e-12) { best = area; ref = t; }
    }
    let map = null;   // vertex -> [u, v], or null: the plane keeps its own UVs
    if (ref >= 0) {
      const a = I[ref * 3], b = I[ref * 3 + 1], c = I[ref * 3 + 2];
      const pa = pos(a), e1 = sub(pos(b), pa), e2 = sub(pos(c), pa);
      const n0 = cross(e1, e2), t0 = scaled(e1, 1 / len(e1)), b0 = cross(scaled(n0, 1 / len(n0)), t0);
      // the unscaled plane's UV map: (x, y) in (t0, b0) metres -> (u, v), from the reference triangle
      const x1 = dot(e1, t0), y1 = dot(e1, b0), x2 = dot(e2, t0), y2 = dot(e2, b0);
      const du1 = UV[b * 2] - UV[a * 2], dv1 = UV[b * 2 + 1] - UV[a * 2 + 1];
      const du2 = UV[c * 2] - UV[a * 2], dv2 = UV[c * 2 + 1] - UV[a * 2 + 1];
      const k = x1 * y2 - x2 * y1;
      // the same frame on the scaled plane, along the same edge
      const f1 = lin(e1), f2 = lin(e2), m1 = cross(f1, f2), lf = len(f1), lm = len(m1);
      if (k !== 0 && lf > 0 && lm > 0 && Number.isFinite(lf * lm)) {
        const ux = (du1 * y2 - du2 * y1) / k, uy = (du2 * x1 - du1 * x2) / k;
        const vx = (dv1 * y2 - dv2 * y1) / k, vy = (dv2 * x1 - dv1 * x2) / k;
        const t1 = scaled(f1, 1 / lf), b1 = cross(scaled(m1, 1 / lm), t1);
        const u0 = UV[a * 2], v0 = UV[a * 2 + 1];
        map = (v) => {
          const d = lin(sub(pos(v), pa)), x = dot(d, t1), y = dot(d, b1);
          return [u0 + ux * x + uy * y, v0 + vx * x + vy * y];
        };
      }
    }
    // the plane's vertices: its own, or a copy where another plane holds one
    const verts = [];
    for (const t of tris) {
      for (let j = 0; j < 3; j++) {
        const v = I[t * 3 + j];
        if (owner[v] < 0 || owner[v] === g) { if (owner[v] < 0) { owner[v] = g; verts.push([v, v]); } continue; }
        const key = `${g}:${v}`;
        let w = copyOf.get(key);
        if (w === undefined) {
          w = next++;
          copyOf.set(key, w);
          out.positions.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
          out.normals.push(cpu.normals ? cpu.normals[v * 3] : 0, cpu.normals ? cpu.normals[v * 3 + 1] : 0, cpu.normals ? cpu.normals[v * 3 + 2] : 0);
          out.uvs.push(UV[v * 2], UV[v * 2 + 1]);
          verts.push([v, w]);
        }
        if (indices === I) indices = new Uint32Array(I);
        indices[t * 3 + j] = w;
      }
    }
    if (!map) continue;
    // the new UVs, shifted by whole repeats to start near zero
    const got = verts.map(([v]) => map(v));
    let minU = Infinity, minV = Infinity;
    for (const [u, v] of got) { if (u < minU) minU = u; if (v < minV) minV = v; }
    const su = Math.floor(minU), sv = Math.floor(minV);
    verts.forEach(([, w], i) => {
      const u = got[i][0] - su, v = got[i][1] - sv;
      if (w < nV) { uvs[w * 2] = u; uvs[w * 2 + 1] = v; } else { out.uvs[(w - nV) * 2] = u; out.uvs[(w - nV) * 2 + 1] = v; }
    });
  }

  if (next === nV) return { ...cpu, uvs };
  const grow = (base, extra) => { const a = new Float32Array(base.length + extra.length); a.set(base); a.set(extra, base.length); return a; };
  return {
    ...cpu,
    positions: grow(P, out.positions),
    normals: cpu.normals ? grow(cpu.normals, out.normals) : cpu.normals,
    uvs: grow(uvs, out.uvs),
    indices,
  };
}
