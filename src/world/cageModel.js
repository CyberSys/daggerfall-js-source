// @ts-check
// BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate, and the gate opens after all the
// enemies are cleared"): THE SIGIL BROKER'S CAGE, MADE - cut from the gate's own stone (world/gateModel.js faces,
// GATE_ARCHIVE), as the faithful's circle is (world/riteModel.js): corner posts, a ring of bars on three sides and
// either side of its door, a frame and bars over the top, and the door itself, a barred leaf on its hinge. Its walls in
// the collider are plain slabs apart from the bars (a body meets a wall, never slips between two bars).
//
// THE CAGE'S OWN FRAME: x across, z through its door (the door on its +z face), y up from her feet - the host turns it
// with trs's yaw (world/mat4.js: local +z faces the bearing). Its bars stand CAGE_FOOT under her feet, so a cage on a
// slope never stands on air. The door is made in its HINGE's frame (x along the leaf from the hinge, z out of the
// cage) and swung by the host about the hinge (`cageHinge`), CAGE_DOOR_OPEN when it is open: outward. Pure.
//
// Not a DFU member. Ledger A (WB).
import { faces, GATE_STONE_RECORD, GATE_PLINTH_RECORD, GATE_ARCHIVE } from './gateModel.js';

/** The cage, metres: across, deep, and high over her feet (her idle stands 2.15). */
export const CAGE_W = 2.2;
export const CAGE_D = 2.2;
export const CAGE_H = 2.7;
/** How far its bars and walls stand under her feet - the ground under a cage on a slope. */
export const CAGE_FOOT = 0.5;
/** A bar's width, and the bars' spacing, centre to centre - a hand between two, never a body. */
export const CAGE_BAR = 0.06;
export const CAGE_GAP = 0.22;
/** A corner post's width, and the frame's beams'. */
export const CAGE_POST = 0.14;
export const CAGE_BEAM = 0.1;
/** The door: its width (centred on the +z face). */
export const CAGE_DOOR_W = 1;
/** The door swung open, radians about its hinge (outward, off the cage's face), and how long it takes to swing, ms. */
export const CAGE_DOOR_OPEN = -1.75;
export const CAGE_DOOR_MS = 1500;
/** A wall's thickness in the collider. */
export const CAGE_WALL = 0.1;

/** The door's hinge in the cage's frame: the door's left edge on the +z face. */
export const cageHinge = () => [-CAGE_DOOR_W / 2, CAGE_D / 2];

/** An upright box's six faces, x0..x1, y0..y1, z0..z1, wound outward as the circle's stones are (riteModel.js box): its
 *  sides a strip of the art up their height, its ends a patch. */
function slab(f, rec, x0, y0, z0, x1, y1, z1) {
  const k = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
  const v = (y1 - y0) / 3, u = Math.max(x1 - x0, z1 - z0);
  const side = (a, b, c, d) => f.quad(rec, k[d], k[c], k[b], k[a], [0, v], [u, v], [u, 0], [0, 0]);
  const end = (a, b, c, d) => f.quad(rec, k[d], k[c], k[b], k[a], [0, 0], [u, 0], [u, u], [0, u]);
  end(4, 5, 6, 7); end(3, 2, 1, 0);   // the top, the foot
  side(0, 1, 5, 4); side(1, 2, 6, 5); side(2, 3, 7, 6); side(3, 0, 4, 7);
}
/** A bar up from the foot to `top`, about (x, z). */
const bar = (f, x, z, top, w = CAGE_BAR, rec = GATE_STONE_RECORD) => slab(f, rec, x - w / 2, -CAGE_FOOT, z - w / 2, x + w / 2, top, z + w / 2);
/** The bars' places along one side from `a` to `b` (exclusive of both ends - the posts stand there). */
function along(a, b) {
  const n = Math.max(1, Math.round(Math.abs(b - a) / CAGE_GAP));
  const out = [];
  for (let i = 1; i < n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/** The faces gathered by record into renderer.createMesh's model shape (riteModel.js buildRiteModel's assembly). */
function assemble(f) {
  const recs = [...f.byRec.keys()].sort((a, b) => a - b);
  const count = recs.reduce((n, r) => n + f.byRec.get(r).p.length / 3, 0);
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(count);
  const subMeshes = [];
  let v = 0;
  for (const rec of recs) {
    const g = f.byRec.get(rec), n = g.p.length / 3;
    positions.set(g.p, v * 3); normals.set(g.n, v * 3); uvs.set(g.uv, v * 2);
    for (let i = 0; i < n; i++) indices[v + i] = v + i;
    subMeshes.push({ textureArchive: GATE_ARCHIVE, textureRecord: rec, startIndex: v, primitiveCount: n / 3 });
    v += n;
  }
  return { positions, normals, uvs, indices, subMeshes };
}

/**
 * THE CAGE, its door apart: the four corner posts and the frame of the plinth's stone, the bars of the gate's - three
 * sides, either side of the door's opening, and over the top. renderer.createMesh's model shape, in the cage's frame.
 */
export function buildCageModel() {
  const f = faces();
  const hx = CAGE_W / 2, hz = CAGE_D / 2, H = CAGE_H, dx = CAGE_DOOR_W / 2;
  for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) bar(f, x, z, H, CAGE_POST, GATE_PLINTH_RECORD);
  // the door's two jambs, posts of their own
  for (const x of [-dx, dx]) bar(f, x, hz, H, CAGE_BEAM, GATE_PLINTH_RECORD);
  // the bars: the back and the two sides whole, the front either side of the door
  for (const x of along(-hx, hx)) bar(f, x, -hz, H);
  for (const z of along(-hz, hz)) { bar(f, -hx, z, H); bar(f, hx, z, H); }
  for (const x of [...along(-hx, -dx), ...along(dx, hx)]) bar(f, x, hz, H);
  // the frame round the top, and the bars across it
  const b = CAGE_BEAM / 2, top = H - CAGE_BEAM;
  slab(f, GATE_PLINTH_RECORD, -hx, top, -hz - b, hx, H, -hz + b);
  slab(f, GATE_PLINTH_RECORD, -hx, top, hz - b, hx, H, hz + b);
  slab(f, GATE_PLINTH_RECORD, -hx - b, top, -hz, -hx + b, H, hz);
  slab(f, GATE_PLINTH_RECORD, hx - b, top, -hz, hx + b, H, hz);
  for (const x of along(-hx, hx)) slab(f, GATE_STONE_RECORD, x - CAGE_BAR / 2, top + 0.02, -hz, x + CAGE_BAR / 2, H - 0.02, hz);
  return assemble(f);
}

/** THE DOOR, in its hinge's frame: a barred leaf CAGE_DOOR_W along +x from the hinge, its rails top and bottom. */
export function buildCageDoor() {
  const f = faces();
  const W = CAGE_DOOR_W, H = CAGE_H - CAGE_BEAM, b = CAGE_BEAM / 2, low = 0.08;
  slab(f, GATE_PLINTH_RECORD, 0, low, -b, W, low + CAGE_BEAM, b);
  slab(f, GATE_PLINTH_RECORD, 0, H - CAGE_BEAM, -b, W, H, b);
  slab(f, GATE_PLINTH_RECORD, 0, low, -b, CAGE_BEAM, H, b);
  slab(f, GATE_PLINTH_RECORD, W - CAGE_BEAM, low, -b, W, H, b);
  for (const x of along(0, W)) slab(f, GATE_STONE_RECORD, x - CAGE_BAR / 2, low, -CAGE_BAR / 2, x + CAGE_BAR / 2, H, CAGE_BAR / 2);
  return assemble(f);
}

/** A slab's twelve triangles, for the collider. */
function slabTris(out, x0, y0, z0, x1, y1, z1) {
  const base = out.positions.length / 3;
  out.positions.push(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1);
  for (const i of [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]) out.indices.push(base + i);
}
const frozenMesh = (o) => Object.freeze({ positions: new Float32Array(o.positions), indices: new Uint16Array(o.indices) });

/** ITS WALLS IN THE COLLIDER, in the cage's frame: the back, the two sides, and the front either side of the door's
 *  opening - each a slab CAGE_WALL thick about its bars, foot to top. */
export const CAGE_WALLS = (() => {
  const out = { positions: [], indices: [] };
  const hx = CAGE_W / 2, hz = CAGE_D / 2, t = CAGE_WALL / 2, dx = CAGE_DOOR_W / 2, y0 = -CAGE_FOOT, y1 = CAGE_H;
  slabTris(out, -hx - t, y0, -hz - t, hx + t, y1, -hz + t);
  slabTris(out, -hx - t, y0, -hz, -hx + t, y1, hz);
  slabTris(out, hx - t, y0, -hz, hx + t, y1, hz);
  slabTris(out, -hx - t, y0, hz - t, -dx, y1, hz + t);
  slabTris(out, dx, y0, hz - t, hx + t, y1, hz + t);
  return frozenMesh(out);
})();
/** THE SHUT DOOR IN THE COLLIDER, in the cage's frame: the opening's own slab. */
export const CAGE_DOOR_WALL = (() => {
  const out = { positions: [], indices: [] };
  const hz = CAGE_D / 2, t = CAGE_WALL / 2, dx = CAGE_DOOR_W / 2;
  slabTris(out, -dx, -CAGE_FOOT, hz - t, dx, CAGE_H, hz + t);
  return frozenMesh(out);
})();
