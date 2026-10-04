// CABIN-CLEAR (2026-10-04, Mac: "The classic style ship is broken. its two ships clipped inside of eachother"; then
// "from the ship deed it spawns in a dark void outside the game world and you can move around another ship under
// construction") - a sailing cabin drew the ship it is the cabin of. SAILING-CABINS keeps the whole exterior fleet
// afloat while its owner is below deck (world.js keepExteriorBoats), and lays the bank ship's room where her hull floats
// (scenes/sailingCabin.js); the modal pass's Come Sail Away hooks - meant for a boat on a dungeon's water - asked only
// whether the mod was on, so the room drew her hull, her hands and lanterns, lit her lamps and pointed its ray at her,
// through its own walls in the void of an interior. The hooks (world.js csaModeShown) hand a cabin none of it; a dungeon
// (and a building) keeps them. bible/03-World/Come-Sail-Away.md "Cabins on owned sailing ships".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
/** One line of world.js, by its start (exactly one). */
function line(start) {
  const lines = world.split('\n').filter((l) => l.startsWith(start));
  assert.equal(lines.length, 1, `one line starts ${JSON.stringify(start)}`);
  return lines[0].replace(/\s+\/\/.*$/, '');
}
const HOOKS = ['extraBillboards', 'drawModeMeshes', 'csaDrawParticlesBlended', 'modeLights', 'csaActivationPick'];

/** The modal pass's Come Sail Away hooks, as world.js writes them, over stand-ins: `modes` the mode machine's, the pool
 *  recording what it is asked to draw. */
function hooks(modes, on = true) {
  const log = { drawn: 0, blended: 0, opaque: 0, lit: 0, picked: 0 };
  const deps = {
    csaOn: () => on, modes,
    csa: { batches: () => ['csa-crew'], draw: () => { log.drawn++; }, lights: () => { log.lit++; return ['csa-lantern']; } },
    renderer: {}, cam: { pos: [0, 0, 0] },
    csaDrawParticlesOpaque: () => { log.opaque++; }, csaDrawParticlesBlended: () => { log.blended++; },
    csaActivationPick: () => { log.picked++; return { key: 'boat' }; },
    remotePlayers: { batches: () => ['peer'] }, peerRiders: null, peerWalkers: null, gateCourt: null, arenaBouts: { batches: () => [] },
  };
  const body = `${line('  const csaModeShown = ')}\nreturn {\n${HOOKS.map((h) => `${line(`    ${h}: `)}`).join('\n')}\n};`;
  const o = new Function(...Object.keys(deps), body)(...Object.values(deps));
  return { o, log };
}

test('CABIN-CLEAR in a sailing cabin the modal pass hands nothing of Come Sail Away\'s fleet - no hull or wake drawn, no hands or lanterns among its billboards, no lantern lit, no ray on a boat - while the other players\' bodies still stand', () => {
  const { o, log } = hooks({ mode: 'interior', sailingCabin: { uid: 7, hull: 2 } });
  o.drawModeMeshes(); o.csaDrawParticlesBlended();
  assert.equal(log.drawn + log.opaque + log.blended, 0, 'her hull through the room');
  assert.deepEqual(o.extraBillboards(), ['peer'], 'her hands and lanterns');
  assert.deepEqual(o.modeLights(), [], 'her lamps');
  assert.equal(o.csaActivationPick([0, 0, 0], [0, 0, 1]), null, 'her helm, hold and door under the ray');
  assert.equal(log.picked + log.lit, 0);
});

test('CABIN-CLEAR a dungeon (a boat placed on its water - UpdateBoatVisibility\'s inside arm) and a building keep the hooks: her hull and wake drawn, her hands among the billboards, her lanterns lit, the ray on her; the mod off, none', () => {
  for (const mode of ['dungeon', 'interior']) {
    const { o, log } = hooks({ mode, sailingCabin: null });
    o.drawModeMeshes(); o.csaDrawParticlesBlended();
    assert.deepEqual([log.drawn, log.opaque, log.blended], [1, 1, 1], `${mode}: drawn`);
    assert.ok(o.extraBillboards().includes('csa-crew'), `${mode}: her hands`);
    assert.deepEqual(o.modeLights(), ['csa-lantern'], `${mode}: lit`);
    assert.deepEqual(o.csaActivationPick([0, 0, 0], [0, 0, 1]), { key: 'boat' }, `${mode}: the ray`);
  }
  const off = hooks({ mode: 'dungeon', sailingCabin: null }, false);
  off.o.drawModeMeshes(); off.o.csaDrawParticlesBlended();
  assert.equal(off.log.drawn + off.log.opaque + off.log.blended, 0, 'the mod off: nothing drawn');
  assert.deepEqual([off.o.extraBillboards(), off.o.modeLights(), off.o.csaActivationPick([0, 0, 0], [0, 0, 1])], [['peer'], [], null], 'the mod off: nothing handed');
});

test('CABIN-CLEAR the fleet itself stays as SAILING-CABINS keeps it - afloat below deck (keepExteriorBoats), for its passengers and its word; only the room stops drawing it', () => {
  assert.match(world, /keepExteriorBoats: \(\) => !!modes\?\.sailingCabin,/);
  for (const h of HOOKS) assert.match(line(`    ${h}: `), /csaModeShown\(\)/, `${h} asks csaModeShown`);
});
