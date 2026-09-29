// NAV-R (2026-09-28, Mac, of main's Overworld raiders: "Definitely want them to appear as ships") - WARM ASHES' RAIDERS,
// STOOD AS SHIPS OF THE SEA: the pure law (systems/naval/navalRaiders.js - a raider's class off its seed, the plan of
// which stand and which go, one copy between two players), the host driving them through real frames over Come Sail
// Away's real pool (scenes/navalHost.js raiders, raiderShipOf, the captain's own sight and course), and the world
// host's wiring, pinned (bible/03-World/Naval-Combat.md NAV-R).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { raiderClassOf, raiderPlan, RAIDER_STAND_M, RAIDER_DROP_M, RAIDER_SHIPS_MAX, RAIDER_LEAD_S } from '../src/systems/naval/navalRaiders.js';
import { createNavalHost, RAIDER_SHEER_M } from '../src/scenes/navalHost.js';
import { createComeSailAwayPool } from '../src/scenes/comeSailAwayPool.js';
import { Boat } from '../src/systems/comeSailAwayBoat.js';
import { SHIP_CLASSES } from '../src/systems/naval/navalShips.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { ENGAGE_RANGE } from '../src/systems/naval/navalAI.js';
import { navalWireRecord } from '../src/systems/naval/navalWire.js';
import { RAIDER_SIGHT_M, RAIDER_SIGHT_NIGHT_M, RAIDER_SAIL_MPS } from '../src/systems/seaRaiders.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-R a raider\'s class: a pirate the player\'s level has met, drawn off the raider\'s own seed by the classes\' weights - never the flagship (the small raid\'s crew, not WAQ_SHIP_ATTACK_PIRATE\'s); one seed, one class for every player of a level (mutants: the flagship drawn, the level ungated, the seed unread)', () => {
  const seeds = Array.from({ length: 6000 }, (_, i) => (Math.imul(i + 1013, 73856093) ^ 0x52414944) >>> 0);
  for (const level of [1, 4, 7, 20]) {
    const count = {};
    for (const seed of seeds) {
      const c = raiderClassOf(seed, level);
      assert.equal(c.faction, 'pirate');
      assert.equal(c.flagship, false, 'never the flagship');
      assert.ok(c.minLevel <= level, `${c.id} at level ${level}`);
      assert.equal(raiderClassOf(seed, level), c, 'the seed decides');
      count[c.id] = (count[c.id] ?? 0) + 1;
    }
    const pool = SHIP_CLASSES.filter((c) => c.faction === 'pirate' && !c.flagship && c.minLevel <= level);
    const total = pool.reduce((s, c) => s + c.weight, 0);
    for (const c of pool) assert.ok(Math.abs(count[c.id] / seeds.length - c.weight / total) < 0.03, `${c.id} at level ${level}: ${count[c.id]}`);
    assert.equal(Object.keys(count).length, pool.length, 'every class the level has met is drawn');
  }
});

test('NAV-R the plan: a raider within RAIDER_STAND_M of me stands, the nearest first and RAIDER_SHIPS_MAX at most, never a spent one; one of mine past RAIDER_DROP_M goes unless it fights, and one whose life is over only once it is out of sight; a peer\'s copy of the same seed with the lower id keeps it - mine yields, and a higher id\'s does not stop me (mutants: the range unread, the cap, a spent one stood, a fight let go of, the lower id yielding)', () => {
  const me = [0, 0, 0];
  const r = (id, seed, x) => ({ id, seed, pos: [x, 0, 0] });
  const empty = { me, myId: 'm', stood: new Map(), peers: new Map(), spent: new Set() };
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 1, RAIDER_STAND_M + 5)] }), { stand: [], drop: [] }, 'out of reach');
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('far', 1, 1100), r('near', 2, 300), r('mid', 3, 800)] }).stand, ['near', 'mid'], `the nearest ${RAIDER_SHIPS_MAX}`);
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 1, 300)], spent: new Set(['a']) }).stand, [], 'spent for its life');
  // mine: kept while it fights, let go past the drop range, and one gone past its life only out of sight
  const stood = new Map([['a', { pos: [RAIDER_DROP_M + 10, 0, 0], engaged: false }], ['b', { pos: [RAIDER_DROP_M + 10, 0, 0], engaged: true }], ['c', { pos: [600, 0, 0], engaged: false }]]);
  const plan = raiderPlan({ ...empty, stood, raiders: [r('a', 1, RAIDER_DROP_M + 10), r('b', 2, RAIDER_DROP_M + 10), r('d', 4, 200)] });
  assert.deepEqual(plan.drop, ['a'], 'out of sight and fighting no one; `c` (its life over) sails on in sight');
  assert.deepEqual(plan.stand, [], `two already stand: ${RAIDER_SHIPS_MAX} at most`);
  // one copy between two players: the lower id keeps it
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300)], peers: new Map([[7, 'a-peer']]) }).stand, [], 'a lower id stands it: I do not');
  assert.deepEqual(raiderPlan({ ...empty, raiders: [r('a', 7, 300)], peers: new Map([[7, 'z-peer']]) }).stand, ['a'], 'a higher id\'s copy yields to mine');
  const yielded = raiderPlan({ ...empty, raiders: [r('a', 7, 300)], stood: new Map([['a', { pos: [300, 0, 0], engaged: true }]]), peers: new Map([[7, 'a-peer']]) });
  assert.deepEqual(yielded.drop, ['a'], 'mine yields even mid-fight - the peer\'s copy is the one the room sees');
});

// ── the host ────────────────────────────────────────────────────────────────────────────────────────────────────

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
const seeded = (seed = 1) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let _pool = null;
async function readyPool() {
  if (_pool) return _pool;
  _pool = createComeSailAwayPool({ renderer: standInRenderer(), pipeline: standInPipeline(), fetchFn: fileFetch, log: { warn() {} } });
  assert.equal(await _pool.preload(), true);
  return _pool;
}
async function harness(o = {}) {
  const pool = await readyPool();
  pool.destroyAll();
  const log = { spent: [], say: [] };
  const boat = pool.spawnNow(Object.assign(new Boat(o.hull ?? 2, 0), { uid: 42 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  const runtime = {
    sailing: true, state: { CurrentBoat: boat, AllBoats: [boat], velocityCurrent: [0, 0, 0], windVectorCurrent: [0.6, 0, 0.8], sailPosition: 0 },
    isSailing() { return this.sailing; }, StopSailing() { this.sailing = false; }, LowerSails() {},
  };
  const view = { feet: [0, 0, 0] };
  const deps = {
    pool, csa: () => runtime, seaY: () => 0, isWater: () => true, feet: () => view.feet, look: () => ({ origin: [0, 5, 0], dir: [1, 0, 0] }), level: () => o.level ?? 5,
    where: () => ({ px: 100, py: 100, region: 23, day: 1, nearPort: false, capitals: [{ region: 23, x: 100, y: 100 }], cityLights: false }),
    say: (t) => log.say.push(t), mid() {}, audio: { play3d() {}, loop3d: () => ({ move() {}, stop() {} }) }, flame: () => ({ move() {}, retire() {} }),
    law: { crime() {}, legal() {}, faction() {} },
    board: { leaveHelm() {}, placePlayer() {}, deckSpots: (_b, n) => Array.from({ length: n }, (_, i) => [[i, 5, 0], 0]), spawnFoe: () => ({ dead: false }), foeDown: () => false, removeFoe() {}, startRaid: () => null, openPlunder: () => true, giveItems: () => ({ left: [] }) },
    hold: () => [], online: o.online ?? null, setting: (k) => o.settings?.[k], random: seeded(3), shake() {},
    raiderSpent: (id) => log.spent.push(id),
  };
  const host = createNavalHost(deps);
  return { host, pool, boat, log, view, deps };
}
const run = (host, seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) host.frame(0.1); };
const raiderShips = (host) => [...host._sea.values()].filter((e) => e.raider);
/** A raider sailing +x at 900 m, its course where it is RAIDER_LEAD_S on. */
const RAIDER = { id: 'r16.16.100', seed: 0x51f00d, pos: [900, 0, 0], yaw: Math.PI / 2, ahead: [900 + RAIDER_SAIL_MPS * RAIDER_LEAD_S, 0, 0] };

test('NAV-R a raider near me at sea stands as a pirate of its seed\'s own class and name - her colours, her guns, her captain - steering the place its seeded course reaches RAIDER_LEAD_S on; she looks out as far as the raiders\' lookout sees (a night\'s 500 m) and, a day\'s 1,000 m sighting me, closes and fights as any pirate; the map finds her where she sails and that she chases (mutants: the course unread, the sight unread, the chase unsaid)', async () => {
  const { host } = await harness({ settings: { ShipsAtSea: 'off' } });
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_NIGHT_M, spent: new Set() });
  const [e] = raiderShips(host);
  assert.ok(e, 'stood');
  assert.equal(e.ship.seed, RAIDER.seed);
  assert.equal(e.ship.cls, raiderClassOf(RAIDER.seed, 5), 'her class off her seed at my level');
  assert.ok(e.ship.names?.name && e.ship.names?.captain, 'named, her captain too');
  assert.deepEqual(e.ship.pos, [900, 0, 0]);
  assert.equal(e.ship.sight, RAIDER_SIGHT_NIGHT_M);
  assert.deepEqual(e.ship.course, [RAIDER.ahead[0], RAIDER.ahead[2]]);
  assert.deepEqual(host.raiderShipOf(RAIDER.seed), { pos: e.ship.pos, chase: false });
  assert.equal(host.raiderShipOf(RAIDER.seed + 1), null);
  // at night I am past her lookout: she sails her course, away from me
  run(host, 20);
  assert.equal(e.ship.mode, 'cruise');
  assert.ok(e.ship.pos[0] > 905 && Math.abs(e.ship.pos[2]) < 30, `on her course (${e.ship.pos.map((v) => v.toFixed(1))})`);
  // by day her lookout sees me - further than the sea's own captains look (ENGAGE_RANGE)
  assert.ok(RAIDER_SIGHT_M > ENGAGE_RANGE);
  host.raiders([{ ...RAIDER, pos: e.ship.pos }], { sight: RAIDER_SIGHT_M, spent: new Set() });
  assert.equal(raiderShips(host).length, 1, 'the same ship, not a second');
  run(host, 2);
  assert.equal(e.ship.mode, 'engage');
  assert.equal(e.ship.target, 'local');
  assert.equal(host.raiderShipOf(RAIDER.seed).chase, true, 'the map says she chases');
  const d0 = Math.hypot(...e.ship.pos);
  run(host, 30);
  assert.ok(Math.hypot(...e.ship.pos) < d0 - 40, 'she closes');
});

test('NAV-R a raider is SPENT for its life - said once to the world host - when she sinks, strikes, is taken or boarded, and when she chased me and lost me: given the slip she sheers off RAIDER_SHEER_M away and looks for no one, and goes once out of sight; a spent raider is never stood again (mutants: the slip unspent, the sheer off, the sinking unspent, a spent one restood)', async () => {
  const { host, log, view, boat } = await harness({ settings: { ShipsAtSea: 'off' } });
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set() });
  run(host, 2);
  const [e] = raiderShips(host);
  assert.equal(e.ship.mode, 'engage');
  // I slip away: far past her lookout in a moment (a fast travel, a crossing)
  boat.GameObject.position = [-6000, 0, 0];
  view.feet = [-6000, 0, 0];
  run(host, 1);
  assert.deepEqual(log.spent, [RAIDER.id], 'given the slip: spent');
  assert.equal(e.raider.spent, true);
  assert.equal(e.ship.sight, 0, 'she looks for no one');
  assert.ok(e.ship.course[0] > e.ship.pos[0] + RAIDER_SHEER_M * 0.9, 'she sheers off, away from me');
  run(host, 5);
  assert.equal(e.ship.mode, 'cruise');
  assert.deepEqual(log.spent, [RAIDER.id], 'said once');
  // the world host marks her spent; the next refresh never stands her again, and lets her go out of sight
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set([RAIDER.id]) });
  assert.equal(raiderShips(host).length, 0, 'out of sight, gone - and not stood again');
  // another: sunk
  const other = { ...RAIDER, id: 'r17.16.100', seed: 0x51f00e, pos: [-6000 + 600, 0, 0], ahead: [-6000 + 600, 0, 200] };
  host.raiders([other], { sight: RAIDER_SIGHT_M, spent: new Set() });
  const [s] = raiderShips(host);
  s.ship.damage.apply({ hull: s.ship.damage.maxHull * 2, sail: 0, crew: 0 }, 1);
  run(host, 0.2);
  assert.notEqual(s.ship.damage.state, SHIP_STATES.afloat);
  assert.deepEqual(log.spent, [RAIDER.id, other.id], 'going down: spent');
});

test('NAV-R the director stands a raider outside its despawns (the raider\'s own plan lets it go) but counts it in the density; one copy between two players - a peer\'s copy of the seed with the lower id keeps her, and mine goes (mutants: the director despawning her, the peer\'s copy unread)', async () => {
  const { host, view, boat } = await harness({ settings: { ShipsAtSea: 'few' } });
  host.raiders([RAIDER], { sight: RAIDER_SIGHT_NIGHT_M, spent: new Set() });
  // I sail far from her: the director would despawn a ship of its own this far out
  boat.GameObject.position = [-3000, 0, 0];
  view.feet = [-3000, 0, 0];
  run(host, 3);
  assert.equal(raiderShips(host).length, 1, 'the director never takes her');
  host.raiders([{ ...RAIDER, pos: raiderShips(host)[0].ship.pos }], { sight: RAIDER_SIGHT_NIGHT_M, spent: new Set() });
  assert.equal(raiderShips(host).length, 0, 'her own plan lets her go past RAIDER_DROP_M');
  // online: a peer with the lower id already stands her seed
  const peerPlay = await harness({ settings: { ShipsAtSea: 'off' }, online: { id: () => 'm-me', peers: () => [{ id: 'a-peer', feet: [0, 0, 0] }], sendHit: () => true } });
  const rec = navalWireRecord({ ships: [{ n: 4, classId: raiderClassOf(RAIDER.seed, 5).id, variant: 0, pos: [900, 0, 0], yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: RAIDER.seed, fire: false }], volleys: [], barrels: [] }, (p) => p);
  assert.equal(peerPlay.host.applyWord('a-peer', rec), true);
  peerPlay.host.raiders([RAIDER], { sight: RAIDER_SIGHT_M, spent: new Set() });
  assert.equal(raiderShips(peerPlay.host).length, 0, 'the lower id\'s copy is the one the room sees');
  assert.deepEqual(peerPlay.host.raiderShipOf(RAIDER.seed)?.pos, [900, 0, 0], 'the map finds the peer\'s copy');
});

// ── the world host ──────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-R the world host: with the sea fight on the raiders are its ships - the Overworld\'s frame hands the naval host the raiders about the traveller each TV_RAID_LIST_MS, where each sails and where its course is RAIDER_LEAD_S on, with the lookout\'s reach tonight; ashore, none; the mod\'s carried-aboard raid and the old chase only with no sea fight; the map draws a raider where her ship sails; a spent ship marks the raider spent (mutants: the old chase run beside the ships, the course unsent, the marks at the seeded place, the spent word lost)', () => {
  const w = src('scenes/world.js');
  assert.match(w, /const navalRaidersOn = \(\) => navalOn\(\) && !!naval\?\.enabled && warmAshesOn\(\);/);
  const frame = w.slice(w.indexOf('  function raidFrame(dt) {'), w.indexOf('\n  }\n', w.indexOf('  function raidFrame(dt) {')));
  assert.match(frame, /if \(navalRaidersOn\(\)\) \{ tvRaid\.chase\.clear\(\); raidShips\(!!at\); return; \}\n\s+if \(!at\) \{/, 'the ships, before the old chase');
  const ships = w.slice(w.indexOf('  function raidShips(atSea) {'), w.indexOf('\n  }\n', w.indexOf('  function raidShips(atSea) {')));
  assert.match(ships, /if \(t - _raidShipsAt < TV_RAID_LIST_MS\) return;/);
  assert.match(ships, /if \(atSea\) \{/);
  assert.match(ships, /if \(tvRaid\.spent\.has\(r\.id\)\) continue;/);
  assert.match(ships, /const a = raiderAt\(r, ms \+ RAIDER_LEAD_S \* 1000, tvRaidSea\);/);
  assert.match(ships, /list\.push\(\{ id: r\.id, seed: r\.seed, pos: \[x, 0, z\], yaw: Math\.atan2\(ax - x, az - z\), ahead: \[ax, 0, az\] \}\);/);
  assert.match(ships, /naval\.raiders\(list, \{ sight: raiderSight\(isNight\(minuteNow\(\)\)\), spent: tvRaid\.spent \}\);/);
  assert.match(w, /const ship = navalRaidersOn\(\) \? naval\.raiderShipOf\(r\.seed\) : null;/);
  assert.match(w, /const at = ship \? state\.worldCoords\(ship\.pos\) : c \? c\.pos : r;/);
  assert.match(w, /const chase = ship \? ship\.chase : !!c;/);
  assert.match(w, /raiderSpent: \(id\) => \{ tvRaid\.spent\.add\(id\); tvRaid\.chase\.delete\(id\); \},/);
});
