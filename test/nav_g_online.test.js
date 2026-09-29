// NAV-G (2026-09-28, Mac: "directly integrate into online mode") - ONLINE: one player stands the sea for everyone
// near and says it in `nv` on their own foes frame - the ships, the last volleys and the barrels - which every other
// client lands through one door; a blow on another's ship is a directed hit frame its stander lands; the other players'
// boats at their helms are the sea's contacts too (bible/03-World/Naval-Combat.md NAV-G).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  NAVAL_WIRE_SHIPS, NAVAL_WIRE_VOLLEYS, NAVAL_WIRE_BARRELS, NAVAL_HIT_MAX, WIRE_STATES, SIDE_CODES, BOARD_CODES,
  navalWireRecord, validNavalRecord, navalRecordKey, navalHitData, validNavalHit,
} from '../src/systems/naval/navalWire.js';
import { SHIP_CLASSES, classById } from '../src/systems/naval/navalShips.js';
import { HULL_VARIANT_COUNTS, Boat } from '../src/systems/comeSailAwayBoat.js';
import { POSE_BOUND, POSE_Y_BOUND } from '../src/net/wire.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { createComeSailAwayPeers } from '../src/scenes/comeSailAwayPeers.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const ship = (o = {}) => ({ n: 3, classId: 'pirateBrig', variant: 0, pos: [100.123, 0, -50.456], yaw: 1.234567, speed: 3.456, sails: 0.8, hull: 0.4567, sail: 1, crew: 0.9, state: 'afloat', heel: 2.34, seed: 0xdeadbeef, fire: true, ...o });
const volley = (o = {}) => ({ id: 77, shooter: 3, hull: 2, side: 'port', pos: [1, 2, 3], yaw: -0.5, vel: [1.234, 0, -2.345], elevation: 0.1234567, seed: 99, skill: 0.55, ...o });

// ── the word ────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-G my word: each ship I stand in the wire frame\'s natives, rounded as a cell object\'s are - her class by its row, her shares as whole percents, her state by its code - the volleys\' lays and seeds, the barrels; at most the caps; nothing to say, null; a moved ship a new key (mutants: toWire skipped, the caps, a class by name)', () => {
  const toWire = (p) => [p[0] + 1000, p[1] - 5, p[2] + 2000];
  const rec = navalWireRecord({ ships: [ship()], volleys: [volley()], barrels: [{ id: 5, pos: [7, 8, 9] }] }, toWire);
  const cls = SHIP_CLASSES.findIndex((c) => c.id === 'pirateBrig');
  assert.deepEqual(rec.s, [[3, cls, 0, 1100.12, -5, 1949.54, 1.2346, 3.46, 0.8, 46, 100, 90, 0, 2.3, 0xdeadbeef, 1, 0]]);
  assert.equal(navalWireRecord({ ships: [ship({ runOut: 0b0101 })] }).s[0][16], 0b0101, 'AUDIT NAV1: her run-out, a bit a side');
  assert.deepEqual(rec.v, [[77, 3, 2, SIDE_CODES.indexOf('port'), 1001, -3, 2003, -0.5, 1.23, -2.35, 0.1235, 99, 0.55]]);
  assert.deepEqual(rec.b, [[5, 1007, 3, 2009]]);
  assert.equal(navalWireRecord({ ships: [], volleys: [], barrels: [] }), null);
  assert.equal(navalWireRecord(null), null);
  assert.equal(navalWireRecord({ ships: [ship({ classId: 'ghostShip' })] }), null, 'no such class: not said');
  assert.equal(navalWireRecord({ ships: [ship({ pos: [Number.NaN, 0, 0] })] }), null);
  assert.equal(navalWireRecord({ volleys: [volley({ side: 'up' })] }), null);
  const many = navalWireRecord({
    ships: Array.from({ length: 20 }, (_, i) => ship({ n: i })),
    volleys: Array.from({ length: 20 }, (_, i) => volley({ id: i })),
    barrels: Array.from({ length: 20 }, (_, i) => ({ id: i, pos: [i, 0, 0] })),
  });
  assert.deepEqual([many.s.length, many.v.length, many.b.length], [NAVAL_WIRE_SHIPS, NAVAL_WIRE_VOLLEYS, NAVAL_WIRE_BARRELS]);
  assert.equal(navalWireRecord({ ships: [ship({ state: 'prize' })] }).s[0][12], WIRE_STATES.indexOf('prize'));
  assert.equal(navalRecordKey(null), '');
  assert.notEqual(navalRecordKey(rec), navalRecordKey(navalWireRecord({ ships: [ship({ pos: [101, 0, -50.456] })], volleys: [volley()], barrels: [{ id: 5, pos: [7, 8, 9] }] }, toWire)));
});

test('NAV-G a peer\'s word through the door, whole or not at all: my own word comes back as what it said; a known class and a variant her hull has, bounded places, a way and canvas a ship can have, shares 0-100, a state the wire knows, a side, a finite lay - one bad entry drops the lot (mutants: the variant unchecked, the state\'s range, one bad ship let the rest through)', () => {
  const rec = navalWireRecord({ ships: [ship(), ship({ n: 4, classId: 'merchantCoaster', variant: 3, fire: false })], volleys: [volley()], barrels: [{ id: 5, pos: [7, 8, 9] }] });
  const got = validNavalRecord(rec);
  assert.equal(got.ships.length, 2);
  assert.deepEqual(got.ships[0], { n: 3, classId: 'pirateBrig', hull: classById('pirateBrig').hull, variant: 0, pos: [100.12, 0, -50.46], yaw: 1.2346, speed: 3.46, sails: 0.8, hull100: 46, sail100: 100, crew100: 90, state: 'afloat', heel: 2.3, seed: 0xdeadbeef, fire: true, runOut: 0 });
  assert.equal(validNavalRecord({ s: [rec.s[0].slice(0, 16)] }).ships[0].runOut, 0, 'an older build\'s word, without the run-out: none');
  assert.equal(validNavalRecord({ s: [Object.assign([...rec.s[0]], { 16: 0b1001 })] }).ships[0].runOut, 0b1001);
  assert.equal(got.ships[1].variant, 3, 'a Large Boat has variants');
  assert.deepEqual(got.volleys[0], { id: 77, shooter: 3, hull: 2, side: 'port', pos: [1, 2, 3], yaw: -0.5, vel: [1.23, 0, -2.35], elevation: 0.1235, seed: 99, skill: 0.55 });
  assert.deepEqual(got.barrels, [{ id: 5, pos: [7, 8, 9] }]);
  assert.deepEqual(validNavalRecord({}), { ships: [], volleys: [], barrels: [] }, 'an empty word stands for none');
  const s0 = rec.s[0], v0 = rec.v[0];
  const withShip = (i, val) => ({ s: [Object.assign([...s0], { [i]: val })] });
  const withVolley = (i, val) => ({ v: [Object.assign([...v0], { [i]: val })] });
  const brigVariants = HULL_VARIANT_COUNTS[classById('pirateBrig').hull];
  for (const [bad, why] of [
    [null, 'nothing'], [[], 'an array'], [{ s: 'x' }, 'ships not a list'],
    [{ s: Array.from({ length: NAVAL_WIRE_SHIPS + 1 }, () => s0) }, 'past the ships\' cap'],
    [{ v: Array.from({ length: NAVAL_WIRE_VOLLEYS + 1 }, () => v0) }, 'past the volleys\' cap'],
    [{ s: [s0.slice(0, 15)] }, 'fifteen fields'], [withShip(3, Number.NaN), 'NaN'],
    [withShip(1, SHIP_CLASSES.length), 'no such class'], [withShip(1, 1.5), 'a fractional class'],
    [withShip(2, Math.max(1, brigVariants)), 'a variant her hull has not'],
    [withShip(3, POSE_BOUND + 1), 'past the world'], [withShip(4, POSE_Y_BOUND + 1), 'past the sky'],
    [withShip(7, 41), 'no ship makes forty'], [withShip(8, 1.1), 'more canvas than she has'],
    [withShip(9, 101), 'a share past whole'], [withShip(12, WIRE_STATES.length), 'a state the wire does not know'],
    [withShip(13, 91), 'on her beam ends'], [withShip(14, -1), 'a negative seed'], [withShip(15, 2), 'a fire that is not a bit'],
    [withShip(16, 16), 'a run-out past the four batteries'], [withShip(16, 1.5), 'a fractional run-out'], [{ s: [[...s0, 0]] }, 'eighteen fields'],
    [withVolley(3, SIDE_CODES.length), 'a side past the stern'], [withVolley(1, -2), 'a shooter past the owner\'s own'],
    [withVolley(10, 2), 'a lay past the carriage'], [withVolley(12, 1.5), 'a skill past the best'],
    [{ b: [[1, POSE_BOUND + 1, 0, 0]] }, 'a barrel past the world'], [{ b: [[1.5, 0, 0, 0]] }, 'a fractional barrel id'],
    [{ s: [s0, 'x'] }, 'one bad ship drops them all'],
  ]) assert.equal(validNavalRecord(bad), null, why);
});

test('NAV-G a blow on a ship another stands: the striker sends the directed hit frame - the ship, her hurts, a fire (a ball\'s 1, a barrel\'s 2 - AUDIT NAV1), the zone, a board code - and the stander\'s door takes only bounded numbers, a known fire, a known zone and a board code (mutants: the ceiling, the zone\'s codes, a board code of five)', () => {
  const d = navalHitData('ann', { n: 7, hull: 33.4, sail: 5.6, crew: 2, fire: true, zone: 'holed' });
  assert.deepEqual(d, { to: 'ann', nv: { n: 7, h: 33, s: 6, c: 2, f: 1, z: 2 } });
  assert.deepEqual(validNavalHit(d), { n: 7, hull: 33, sail: 6, crew: 2, fire: true, zone: 'holed', board: 0 });
  const barrel = navalHitData('ann', { n: 7, hull: 45, fire: 'barrel' });
  assert.equal(barrel.nv.f, 2);
  assert.equal(validNavalHit(barrel).fire, 'barrel', 'a barrel\'s fire comes over as a barrel\'s');
  assert.equal(validNavalHit(navalHitData('ann', { n: 7 })).fire, false);
  assert.equal(validNavalHit(navalHitData('ann', { n: 1, zone: 'rig' })).zone, 'rig');
  assert.equal(validNavalHit(navalHitData('ann', { n: 1 })).zone, 'hull');
  const board = navalHitData('bob', { n: 2, board: BOARD_CODES.taken });
  assert.equal(board.nv.board, 2);
  assert.equal(validNavalHit(board).board, BOARD_CODES.taken);
  assert.deepEqual(Object.values(BOARD_CODES), [1, 2, 3, 4]);
  for (const [bad, why] of [
    [null, 'nothing'], [{ nv: [] }, 'an array'], [{ nv: { ...d.nv, n: -1 } }, 'no ship'],
    [{ nv: { ...d.nv, h: NAVAL_HIT_MAX + 1 } }, 'more than a broadside'], [{ nv: { ...d.nv, s: -1 } }, 'negative canvas'],
    [{ nv: { ...d.nv, c: 61 } }, 'more men than a galley'], [{ nv: { ...d.nv, f: 3 } }, 'no such fire'], [{ nv: { ...d.nv, f: 0.5 } }, 'half a fire'],
    [{ nv: { ...d.nv, z: 3 } }, 'no such zone'], [{ nv: { ...d.nv, board: 5 } }, 'no such board'], [{ nv: { ...d.nv, h: 1.5 } }, 'a fraction'],
  ]) assert.equal(validNavalHit(bad), null, why);
});

// ── the other players' boats: the sea's contacts ────────────────────────────────────────────────────────────────

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function standInRenderer() {
  return {
    createMesh: (model) => ({ model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s, _bounds: [0, 0, 0, 0] })) }),
    drawMesh() {}, updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh() {},
  };
}
function standInPipeline() {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  return { getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
}
const Q = [0, Math.sin(0.25), 0, Math.cos(0.25)];
const boatWord = (over = {}) => [over.hull ?? 1, over.variant ?? 0, over.x ?? 10, over.y ?? 34, over.z ?? 20, ...Q, 0, over.helm ?? 1, 0];

test('NAV-H the other players\' boats at their helms are the sea\'s contacts: where each stands and her way - her word\'s own (CSA-K\'s `m`), carried through the frame as the lead carries it; a word that says no way has none, and a boat at rest at its mooring is nobody\'s contact (mutants: an idle boat hunted, the way never read, the way left in the wire frame)', async () => {
  const pool = createComeSailAwayPool({ renderer: standInRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await pool.preload(), true);
  const peers = createComeSailAwayPeers({ pool, selfId: () => 'me' });
  // the wire frame is natives, forty to the metre, about an origin of its own - a way is carried through it as a
  // difference, never read as it stands
  const toScene = (p) => [(p[0] - 1000) / 40, p[1], (p[2] + 400) / 40];
  peers.applyOwner('ann', { b: [boatWord({ x: 1400, z: 400 }), boatWord({ x: 16000, helm: 0 })] }, toScene, 1000);
  peers.frame(0.1);
  let got = peers.helmBoats();
  assert.equal(got.length, 1, 'the moored boat is not at a helm');
  assert.deepEqual(got[0].id, 'ann');
  assert.deepEqual(got[0].pos.map((v) => +v.toFixed(6)), [10, 34, 20]);
  assert.deepEqual([got[0].speed, ...got[0].vel], [0, 0, 0, 0], 'her word says no way: she has none');
  // she sails: her word says her way - 200 natives a second along x and 80 along z, 5 and 2 m/s in the scene
  peers.applyOwner('ann', { b: [boatWord({ x: 1420, z: 400 }), boatWord({ x: 16000, helm: 0 })], m: [[200, 80, 3], [0, 0, 0]] }, toScene, 1100);
  peers.frame(0.1);
  got = peers.helmBoats();
  assert.equal(pool.peerBoats.length, 2, 'both of ann\'s boats built');
  assert.equal(got.length, 1, 'the moored one is still nobody\'s contact');
  assert.deepEqual(got[0].vel.map((v) => +v.toFixed(9)), [5, 0, 2], 'her way in the scene, a second\'s');
  assert.ok(Math.abs(got[0].speed - Math.hypot(5, 2)) < 1e-9);
  assert.ok(got[0].pos[0] > 10.5, 'and she is led along it');
  // brought up short: the word that says no way takes it at once - nothing measured, nothing left over
  peers.applyOwner('ann', { b: [boatWord({ x: 1440, z: 400 }), boatWord({ x: 16000, helm: 0 })] }, toScene, 1200);
  peers.frame(0.1);
  assert.equal(peers.helmBoats()[0].speed, 0, 'no way said, none');
  // a summons is a new place, not a way: she snaps there, and her speed stays her word's (none said here) - never the jump's
  peers.applyOwner('ann', { b: [boatWord({ x: 9000, z: 400 }), boatWord({ x: 16000, helm: 0 })] }, toScene, 1300);
  peers.frame(0.1);
  assert.deepEqual([peers.helmBoats()[0].speed, peers.helmBoats()[0].pos[0]], [0, 200], 'snapped to her new place with no way');
  peers.applyOwner('ann', null, toScene, 4000);
  peers.frame(0.1);
  assert.deepEqual(peers.helmBoats(), [], 'her word withdrawn');
  // a sea ship stands in the pool beside the others - drawn, never mine, and torn down with the rest
  const sea = pool.spawnSeaNow(new Boat(2, 0));   // the naval host's own call (scenes/navalHost.js)
  assert.ok(sea?.GameObject, 'built as SpawnBoat builds one');
  assert.deepEqual(pool.seaBoats, [sea]);
  assert.equal(pool.boats.includes(sea), false, 'never one of MY boats - no helm is taken on her');
  pool.remove(sea);
  assert.deepEqual(pool.seaBoats, []);
  pool.spawnSeaNow(new Boat(4, 0));
  pool.destroyAll();
  assert.deepEqual([pool.boats.length, pool.peerBoats.length, pool.seaBoats.length], [0, 0, 0]);
});

// ── the hosts' doors ────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-G the doors: my word rides my foes frame beside the boats\' - a changed word asking for the frame it rides; a peer\'s lands past the room test and is cleared with the puppets; a blow carrying `nv` goes to the naval stander, anything else where it always went (mutants: the moved word never asking, the clears, the hit routed to the foes)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /if \(cell\) csaWord\(frame, full\); if \(cell\) csaAboardWord\(frame, full\);(?: if \(cell\) bandWord\(frame, full\);)? if \(cell\) navalWord\(frame, full\);/);   // THE MERGE with TV7b: the Overworld's bands' word may ride between
  assert.match(w, /function navalWord\(frame, full\) \{\n\s+if \(!navalOn\(\)\) \{ if \(!_navalWordKey\) return false; if \(frame\) \{ frame\.nv = null; _navalWordKey = ''; \} return true; \}\n\s+const rec = naval\.word\(campToWire\);\n\s+const key = navalRecordKey\(rec\);\n\s+if \(!full && key === _navalWordKey\) return false;\n\s+if \(frame\) \{ frame\.nv = rec; _navalWordKey = key; \}\n\s+return true;/);
  assert.match(w, /exteriorFoes\.setOnNaval\(\(from, nv\) => naval\?\.applyWord\(from, nv, campToScene\), \(\) => naval\?\.clearPeers\(\)\);/);
  assert.match(w, /online\.onHit = \(id, data\) => \{ if \(isCellRoom\(online\.room\) && data\?\.nv\) \{ naval\?\.applyPeerHit\(id, data\); return; \} if \(isCellRoom\(online\.room\)\) exteriorFoes\.applyHit\(id, data\);/);
  const x = src('scenes/exteriorFoes.js');
  assert.match(x, /if \(data\.nv !== undefined\) _onNaval\?\.\(from, data\.nv, _now\(\)\);/);
  assert.equal((x.match(/_onNavalClear\?\.\(\);/g) ?? []).length, 2, 'both clears: the teardown and the room change');
  assert.match(x, /function setOnNaval\(fn, onClear = null\) \{ _onNaval = typeof fn === 'function' \? fn : null; _onNavalClear = typeof onClear === 'function' \? onClear : null; \}/);
  // the sea's word stays outside the relay's bundle: net/ never imports it
  for (const f of ['net/wire.js', 'net/relay.js']) {
    let s = '';
    try { s = src(f); } catch { continue; }
    assert.doesNotMatch(s, /navalWire/, `${f} reads nothing of the sea`);
  }
});
