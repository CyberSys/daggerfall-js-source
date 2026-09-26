// DECOR-SHELL (2026-09-26, a player over the house decorator, relayed by Mac: "decor they go poof", "They are there /
// But its model disappearing / Placing models is different then the ones after"): A PLACED PIECE STAYS IN THE ROOM.
//
// The free camera flew through walls, floor and ceiling - nothing but the forty-metre leash held it - and a room's
// faces are one-sided, so from outside it the room is an open dollhouse: a piece set on the ceiling's top or behind a
// wall looked placed from up there and was gone from the body's own eye, still listed, still solid, still named
// through the ceiling. And from INSIDE, a model aimed at the ceiling stood on it - above it, out of the room. Three
// more: an online home's list, landing after a placement, stood the room over it whole (the piece taken down, its
// item sent back to the pack); and a model that would not load once was remembered as nothing for the session.
//
// Pinned over a REAL collider room (player/collider.js - two-sided, as the room's own is): the eye is cut short of
// every face and slides along it; a model aimed at a ceiling hangs from it, its top at the face; a flat cannot hang;
// a failed load is asked again; and the host's gate by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../src/player/collider.js';
import { flyClip, DECOR_FLY_SKIN } from '../src/scenes/decorTool.js';
import { createDecorPlacer, DECOR_HANG_NY } from '../src/systems/decorPlacer.js';
import { createDecorRoom } from '../src/scenes/decorRoom.js';
import { settle, toolRig, placeFrom } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A closed box - the room's shell, floor to ceiling - as the collider takes a mesh. */
function boxMesh(x0, y0, z0, x1, y1, z1) {
  const p = new Float32Array([x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]);
  const i = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2]);
  return { p, i };
}
/** A room ten metres a side and three high, its floor at y=0, centred on the rig's building origin (10, 0, 10). */
function room() {
  const c = new Collider();
  const { p, i } = boxMesh(5, 0, 5, 15, 3, 15);
  c.addMesh('room', p, i, IDENTITY);
  return c;
}

test('DECOR-SHELL flyClip: a step through a face is cut DECOR_FLY_SKIN short of it, either side, and what is left slides along it; a step that meets nothing is the step; no collider, no cut (mutants: no cut, the skin lost, no slide)', () => {
  const c = room();
  const up = flyClip(c, [10, 1.6, 10], [10, 4, 10]);
  assert.ok(near(up[1], 3 - DECOR_FLY_SKIN), `straight up: under the ceiling by the skin (${up[1]})`);
  const wall = flyClip(c, [14, 1.6, 10], [17, 1.6, 10]);
  assert.ok(near(wall[0], 15 - DECOR_FLY_SKIN) && near(wall[2], 10), `into a wall: short of it (${wall})`);
  const slid = flyClip(c, [10, 1.6, 10], [10, 4, 12]);
  assert.ok(slid[1] < 3 && slid[1] > 2.5, `a climb into the ceiling stops under it (${slid[1].toFixed(3)})`);
  assert.ok(near(slid[2], 12), `and slides along it the rest of the way (${slid[2].toFixed(3)})`);
  const out = flyClip(c, [10, 3.5, 10], [10, 4, 10]);
  assert.deepEqual(out, [10, 4, 10], 'above the room, going up: nothing across the step');
  const back = flyClip(c, [10, 3.5, 10], [10, 2, 10]);
  assert.ok(near(back[1], 3 + DECOR_FLY_SKIN), 'and the ceiling met from ABOVE stops it too - the collider is two-sided');
  const open = [11, 1.6, 10];
  assert.equal(flyClip(c, [10, 1.6, 10], open), open, 'a step that meets nothing is the step itself');
  assert.equal(flyClip(null, [10, 1.6, 10], [10, 9, 10])[1], 9, 'no collider: no cut');
  // a piece being moved is no face for the eye either
  const { p, i } = boxMesh(9, 0, 11, 11, 2, 12);
  c.addMesh('decor:m1', p, i, IDENTITY);
  assert.ok(flyClip(c, [10, 1, 10], [10, 1, 13])[2] < 11, 'a piece stops the eye');
  assert.deepEqual(flyClip(c, [10, 1, 10], [10, 1, 13], ['decor:m1']), [10, 1, 13], '...unless it is the one being moved');
});

test('DECOR-SHELL the placer: a model aimed at a face that looks down HANGS from it - its top at the face, turned and scaled - never stands on top of it; a flat cannot hang; a floor and a wall are as they were (mutants: the ceiling stood on, the hang at the bottom, a flat hung)', () => {
  const box = [-0.5, -0.1, -0.5, 0.5, 0.9, 0.5];
  const entry = { key: 'm41000', model: 41000, name: 'Chest' };
  const pl = createDecorPlacer(entry, { radius: 1, box });
  const origin = [10, 0, 10];
  const ceiling = pl.pieceAt([10, 3, 10], origin, 'a', [0, -1, 0], 0);
  assert.ok(near(ceiling.pos[1], 3 - 0.9), `its top at the ceiling (${ceiling.pos[1]})`);
  assert.ok(near(pl.pieceAt([10, 3, 10], origin, 'b', [0, -2, 0.3], 0).pos[1], 2.1), 'the normal at its unit length');
  const floor = pl.pieceAt([10, 0, 10], origin, 'c', [0, 1, 0], 0);
  assert.ok(near(floor.pos[1], 0.1), 'a floor: its bottom on it, as before');
  assert.ok(near(pl.pieceAt([10, 1, 10], origin, 'd', [0, 0, -1], 0).pos[1], 1.1), 'a wall: as before');
  assert.ok(near(pl.pieceAt([10, 1, 10], origin, 'e', null, 0).pos[1], 1.1), 'no surface: as before');
  const tilted = pl.pieceAt([10, 3, 10], origin, 'f', [0, -Math.sin(Math.PI / 4), Math.cos(Math.PI / 4)], 0);
  assert.ok(near(tilted.pos[1], 2.1), `a face looking down at 45 degrees is hung from (the bound, ${DECOR_HANG_NY})`);
  const big = createDecorPlacer(entry, { radius: 1, box });
  big.rescale(true);
  assert.ok(near(big.pieceAt([10, 3, 10], origin, 'g', [0, -1, 0], 0).pos[1], 3 - 0.9 * 1.1, 1e-3), 'scaled, its scaled top');
  const flat = createDecorPlacer({ key: 'f210.3', model: null, flat: [210, 3], name: 'Lamp' }, { radius: 0.3 });
  assert.equal(flat.pieceAt([10, 3, 10], origin, 'h', [0, -1, 0], 0), null, 'a flat has no top to hang by: it cannot stand there');
  assert.deepEqual(flat.pieceAt([10, 0, 10], origin, 'i', [0, 1, 0], 0).pos, [0, 0, 0], 'on a floor it stands, as before');
});

test('DECOR-SHELL the tool over a real room: holding Jump flies the eye to the ceiling and no further; looking down the ghost stands on the floor, looking up it hangs from the ceiling - inside the room both ways (mutants: the flight unclipped)', async () => {
  const rig = toolRig({ gold: 5000, collider: room() });
  const model = rig.entries.find((e) => e.model != null);
  await placeFrom(rig, model.key);
  assert.equal(rig.tool.flying(), true);
  rig.win.fire('keydown', { code: 'Space', target: rig.doc.body });
  for (let k = 0; k < 40; k++) rig.frame();
  rig.win.fire('keyup', { code: 'Space', target: rig.doc.body });
  rig.tool.cameraOverride(rig.cam);
  assert.ok(rig.cam.pos[1] <= 3 - DECOR_FLY_SKIN + 1e-6, `four seconds of Jump: the eye under the ceiling (${rig.cam.pos[1].toFixed(3)}) - the bug flew it out`);
  rig.cam.pitch = -Math.PI / 2 + 1e-3;
  rig.frame();
  const down = rig.tool.ghost();
  assert.ok(down && near(down.pos[1], 0.1, 1e-3), `looking down: on the floor, its bottom on it (${down?.pos[1]})`);
  rig.cam.pitch = Math.PI / 2 - 1e-3;
  rig.frame();
  const up = rig.tool.ghost();
  assert.ok(up && near(up.pos[1], 3 - 0.9, 1e-3), `looking up: hung from the ceiling, inside the room (${up?.pos[1]})`);
});

test('DECOR-SHELL the room: a model that would not load is asked again by the next piece of it, never remembered as nothing (mutants: the failure cached)', async () => {
  let calls = 0;
  const drawn = [];
  const pool = createDecorRoom({
    meshes: { getGpuMesh: async () => { calls++; if (calls === 1) throw new Error('the archive was not in hand yet'); return { gpu: 'mesh' }; }, cpuModels: new Map() },
    renderer: { drawMesh: (g) => drawn.push(g) },
    collider: () => ({ addMesh: () => {}, removeBucket: () => {} }), origin: () => [0, 0, 0],
  });
  const piece = (id) => ({ id, model: 41000, flat: null, item: null, pos: [1, 0, 1], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 20 });
  pool.put(piece('a'));
  await settle();
  assert.equal(pool.draw(), 0, 'the first load failed: nothing to draw');
  pool.put(piece('b'));
  await settle();
  assert.equal(calls, 2, 'the next piece of it asked again');
  assert.equal(pool.draw(), 1, 'and it stands');
  pool.put(piece('a'));
  await settle();
  assert.equal(pool.draw(), 2, 'the first one too, put again (a move, a restore)');
  assert.equal(calls, 2, 'and a model that loaded is kept');
});

test('DECOR-SHELL the host by source: an online home is decorated only once its list has answered this visit - answered, stood or not, or failed - so no late answer stands the room over a placement (mutants: the gate gone, the answer never marked)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /let _decorListed = -1;/);
  assert.match(m, /if \(interiorHome && _decorListed !== _decorVisit\) return null;\n    if \(interiorHome\) return \{ kind: 'home'/);
  assert.match(m, /if \(visit !== _decorVisit \|\| interiorBuilding !== b\) return;\n      _decorListed = visit;/);
  assert.match(m, /\}\)\.catch\(\(\) => \{ if \(visit === _decorVisit\) _decorListed = visit; \}\);/);
  const t = src('src/scenes/decorTool.js');
  assert.match(t, /p\.fly = flyClip\(deps\.collider\?\.\(\), p\.fly, next, through\);/, 'the flight cut by the room\'s own collider, through what the eye looks through');
});
