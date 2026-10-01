// FIELD BUGS 2026-10-01 - "People are trying to mine boulders on the outside, but it's not letting people mine" (Mac).
//
// ROCK-FOOT. A boulder is a rock field's piece (PROF0 23), and the pieces were carried as their WHOLE mesh's box
// (scenes/world.js pixelRocks). World of Daggerfall's fields are a few models scaled by tens to hundreds, turned and
// sunk, so a piece's box ran far past the rock that shows - and it is that box a boulder's foot stood on the edge of,
// and that every other foot was asked to stay out of (AUDIT 29 C11). On the shipped layouts a boulder's one foot fell
// inside a neighbour's box most of the time, and then nothing stood: the piece was spent, no other piece or side was
// asked, and the veins had already taken the field's clear pieces. Where one did stand, its stones lay on the box's
// edge, metres to hundreds of metres off any rock a player could see. Now a piece is carried as it stands out of the
// ground (terrainNature.js rockFootprint), a node takes the nearest piece with a clear foot on any side (the side facing
// its point first), and the boulders claim before the veins (a vein has the stone beside the field to fall back on, a
// boulder has nothing). The real meshes are ARENA2's; a cube stands in for each model over the shipped layouts' own
// transforms, at the sizes and origins that bracket a real rock's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { rockFootprint, groundAt, insideRocks } from '../src/world/terrainNature.js';
import { standMineNodes, ROCK_OFFSET, NODE_SPACING_M } from '../src/scenes/mineHost.js';
import { boulders, veins, nodeCount } from '../src/net/nodeLaw.js';
import { objectMatrix } from '../src/world/wodLocationObjects.js';
import { loadLocationPrefab } from '../src/world/wodLocationData.js';
import { transformedAabb } from '../src/render/frustum.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';

const WOODS = CLIMATES.Woodlands, MOUNTAIN = CLIMATES.Mountain, GLENUMBRA = 59;
const PX = 405, PY = 150, DAY = 20500;
const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.5);
const G = groundAt(samples, 400, 400);
const grass = new Uint8Array(128 * 128).fill(2);

/** A box mesh [x0..x1] x [y0..y1] x [z0..z1], model-local: its eight corners and twelve faces. */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const positions = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  return { positions, indices };
}
const unit = boxMesh(-1, -1, -1, 1, 1, 1);
/** A piece's matrix at pixel-local (x, y, z), rolled `roll` about the north (z) axis, scaled. */
function piece(x, y, z, s, roll = 0) {
  return objectMatrix([x, y, z], { x: 0, y: 0, z: Math.sin(roll / 2), w: Math.cos(roll / 2) }, { x: s, y: s, z: s });
}
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

test('ROCK-FOOT rockFootprint: a piece as it stands out of the ground - a sunk rock its cut at the ground, never its whole box; a buried one none (mutants: the ground unasked; the cut at the ground left out)', () => {
  // a 10 m cube sunk to its middle, square to the axes: its footprint is its square
  const half = rockFootprint(unit.positions, unit.indices, piece(400, G, 400, 5), samples);
  assert.ok(near(half[0], 395) && near(half[3], 405) && near(half[2], 395) && near(half[5], 405));
  assert.ok(near(half[1], G) && near(half[4], G + 5), 'from the ground to its top');
  // the same cube stood on its edge (rolled 45 degrees) and sunk to 2 m under its middle: the ground cuts it where it
  // is 2 * (7.07 - 2) = 10.14 m across - the box of the whole mesh is 14.14 m, and the top that shows (its upper edge,
  // its only corners above the ground) is a line
  const edge = rockFootprint(unit.positions, unit.indices, piece(400, G - 2, 400, 5, Math.PI / 4), samples);
  const full = transformedAabb([-1, -1, -1, 1, 1, 1], piece(400, G - 2, 400, 5, Math.PI / 4));
  assert.ok(near(full[3] - full[0], 14.142, 1e-2), 'its whole box');
  assert.ok(near(edge[3] - edge[0], 2 * (5 * Math.SQRT2 - 2), 1e-3), `cut at the ground: ${(edge[3] - edge[0]).toFixed(3)} m across`);
  assert.ok(near(edge[2], 395) && near(edge[5], 405), 'its length along the edge as it is');
  // a hill: scaled by a hundred and rolled, its middle 95 m down - the top of it shows, and its box is a field wide
  const hill = rockFootprint(unit.positions, unit.indices, piece(400, G - 95, 400, 100, 0.6), samples);
  const hillBox = transformedAabb([-1, -1, -1, 1, 1, 1], piece(400, G - 95, 400, 100, 0.6));
  assert.ok(hillBox[3] - hillBox[0] > 150, 'the mesh\'s box is a field wide');
  assert.ok(hill[3] - hill[0] < (hillBox[3] - hillBox[0]) / 2, `across its roll, what shows is a fraction of it (${(hill[3] - hill[0]).toFixed(0)} of ${(hillBox[3] - hillBox[0]).toFixed(0)} m)`);
  // wholly under the ground: none
  assert.equal(rockFootprint(unit.positions, unit.indices, piece(400, G - 20, 400, 5), samples), null);
});

test('ROCK-FOOT standMineNodes: a boulder whose piece faces into a neighbour stands on its open side; a piece shut on every side passes it to the next (mutants: one piece asked; one side asked)', () => {
  const law = boulders({ x: PX, y: PY, day: DAY, climate: WOODS });
  assert.equal(law.length, 3, 'the Woodlands\' three (BOULDERS)');
  const bx = law[0].u * TERRAIN_SIZE, bz = law[0].v * TERRAIN_SIZE;
  const first = (rocks) => standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: grass, rocks }).find((n) => n.what === 'boulder' && n.slot === 0);
  // its point on a piece's west end, and a neighbour over that end and the point (the field's pieces overlap): the
  // foot facing the point is inside the neighbour - the piece's north side is open
  const p = [bx - 1, G, bz - 1, bx + 5, G + 4, bz + 1];
  const w = [bx - 10, G, bz - 10, bx + 0.5, G + 6, bz + 10];
  const one = first([p, w]);
  assert.ok(one, 'it stands');
  assert.deepEqual(one.rock, p, 'at its own piece');
  assert.ok(near(one.local[0], bx + 2) && near(one.local[2], bz + 1 + ROCK_OFFSET), `on its open north side (${one.local[0] - bx}, ${one.local[2] - bz})`);
  assert.equal(insideRocks([p, w], one.local[0], one.local[2]), false, 'clear of every piece');
  // a piece wholly inside another, both over the point: its every foot is inside - the other is asked
  const a = [bx - 1, G, bz - 1, bx + 1, G + 3, bz + 1];
  const b = [bx - 20, G, bz - 20, bx + 20, G + 8, bz + 20];
  const next = first([a, b]);
  assert.ok(next, 'still it stands');
  assert.deepEqual(next.rock, b, 'at the piece round it');
  assert.equal(insideRocks([a, b], next.local[0], next.local[2]), false);
});

test('ROCK-SHARE: a piece holds a node on each of its sides NODE_SPACING_M apart - the boulders first; a stone too small for two holds one, and the veins stand on the stone beside it (mutants: the spacing unasked; the boulders after the veins in the list)', () => {
  const law = veins({ x: PX, y: PY, day: DAY, climate: WOODS, region: GLENUMBRA });
  const b = boulders({ x: PX, y: PY, day: DAY, climate: WOODS })[0];
  const x = b.u * TERRAIN_SIZE, z = b.v * TERRAIN_SIZE;
  const stone = new Uint8Array(128 * 128).fill(3);
  const stand = (rocks) => standMineNodes({ px: PX, py: PY, day: DAY, climate: WOODS, region: GLENUMBRA, samples, tilemap: stone, rocks });
  const apart = (nodes) => {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].local[0] - nodes[j].local[0], nodes[i].local[2] - nodes[j].local[2]);
      assert.ok(d >= NODE_SPACING_M - 1e-9, `${nodes[i].key} and ${nodes[j].key} ${d.toFixed(2)} m apart`);
    }
  };
  // a field's one great piece, sixty metres across: every boulder and every vein at its foot, each on its own side
  const hill = [[x - 30, G, z - 30, x + 30, G + 9, z + 30]];
  const all = stand(hill);
  assert.equal(all.filter((n) => n.what === 'boulder').length, 3, 'the three boulders');
  assert.equal(all.filter((n) => n.what === 'vein').length, law.length, 'and the veins');
  assert.ok(all.every((n) => n.rock === hill[0] && !insideRocks(hill, n.local[0], n.local[2])), 'all at the piece, outside it');
  apart(all);
  // one stone a metre across: one node - the first boulder's; the rest of the boulders none, the veins on the stone
  const pebble = [[x - 0.5, G, z - 0.5, x + 0.5, G + 1, z + 0.5]];
  const few = stand(pebble);
  const bs = few.filter((n) => n.what === 'boulder'), vs = few.filter((n) => n.what === 'vein');
  assert.deepEqual(bs.map((n) => [n.slot, n.rock]), [[0, pebble[0]]], 'the first boulder claims it - before the veins');
  assert.equal(vs.length, law.length, 'every vein stands');
  assert.ok(vs.every((n) => n.rock === null && !insideRocks(pebble, n.local[0], n.local[2])), 'on the stone, outside the rock');
  apart(few);
  assert.deepEqual(few.map((n) => n.what), [...vs.map(() => 'vein'), 'boulder'], 'the list in its order, the veins first');
});

test('ROCK-FOOT over the shipped rock fields: most of the law\'s boulders stand, every one at a rock that shows and outside every piece (before: under one in ten, and one in sixteen at a rock)', () => {
  const dir = new URL('../vendor/world-of-daggerfall/LocationPrefab/', import.meta.url);
  const layouts = readdirSync(dir).filter((f) => /^WOD_(?:Rocks_(?!Cave)|Mountain_)/.test(f));
  assert.ok(layouts.length >= 40, `the rock and mountain layouts (${layouts.length})`);
  const c = TERRAIN_SIZE / 2;
  // a model a metre across, its origin at its middle and at its foot: what a real rock's is lies between
  for (const [label, mesh] of [['centred', boxMesh(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)], ['on its origin', boxMesh(-0.5, 0, -0.5, 0.5, 1, 0.5)]]) {
    let want = 0, stood = 0, shut = 0;
    for (const f of layouts) {
      const p = loadLocationPrefab(readFileSync(new URL(f, dir), 'utf8'));
      const rocks = p.obj.filter((o) => o.type === 0 && o.scale.x < 1e5)   // never object 2, the mountains' rock a million times over (AUDIT BRANCH B1 - the road's test refuses it)
        .map((o) => rockFootprint(mesh.positions, mesh.indices, objectMatrix([o.pos.x + c, o.pos.y + G, o.pos.z + c], o.rot, o.scale), samples)).filter(Boolean);
      for (const climate of [WOODS, CLIMATES.MountainWoods, MOUNTAIN, CLIMATES.Desert]) {
        for (let day = DAY; day < DAY + 10; day++) {
          want += nodeCount(climate, 'boulder');
          for (const n of standMineNodes({ px: PX, py: PY, day, climate, region: GLENUMBRA, samples, tilemap: grass, rocks })) {
            if (n.what !== 'boulder') continue;
            stood++;
            if (insideRocks(rocks, n.local[0], n.local[2])) shut++;
            const d = Math.hypot(Math.max(n.rock[0] - n.local[0], 0, n.local[0] - n.rock[3]), Math.max(n.rock[2] - n.local[2], 0, n.local[2] - n.rock[5]));
            assert.ok(d > 0 && d <= ROCK_OFFSET + 1e-9, `${f}: a boulder's stones at the foot of its rock as it shows (${d.toFixed(2)} m)`);
          }
        }
      }
    }
    assert.equal(shut, 0, `${label}: no boulder inside a piece`);
    assert.ok(stood / want > 0.85, `${label}: ${stood} of ${want} boulders stand`);   // ROCK-SHARE: a field's pieces hold one on each side
  }
});
