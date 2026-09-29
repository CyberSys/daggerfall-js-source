// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag"; of the arc: "directly integrate into online mode")
// - ONLINE, the audit's sixth lens (bible/03-World/Naval-Combat.md "Online"): several players' hosts over Come Sail
// Away's real pool and a stand-in relay (test/navalRoom.mjs) - the sea handed on when its stander goes, a ship another
// stands boarded in one world, no twins, a ship's names the same to everyone, another's ship sailing on between words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { room } from './navalRoom.mjs';
import { sea } from './navalSea.mjs';
import { OWNER_SWEEP_S, OWNER_STALE_S, ORPHAN_S, PREDICT_MAX_S, PUPPET_SNAP_M, claimBeats, idSalt } from '../src/scenes/navalHost.js';
import { seedBaseOf, SEED_SALT, createNavalDirector } from '../src/systems/naval/navalDirector.js';
import { NAVAL_GEN_MAX, navalWireRecord, validNavalRecord } from '../src/systems/naval/navalWire.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { GRAPPLE_S } from '../src/systems/naval/navalBoarding.js';
import { CROWNS } from '../src/systems/naval/navalShips.js';

const bySeed = (c, seed) => [...c.s.host._sea.values()].find((e) => e.ship.seed === seed) ?? null;
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A ship the player stands, placed where the test wants her. */
function stand(c, classId, pos, yaw = 0) {
  const e = c.s.host._sea.get(c.s.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]) || 1, bearing: Math.atan2(pos[0], pos[2]), yaw }));
  e.ship.pos = [...pos];
  e.ship.yaw = yaw;
  return e;
}

test('AUDIT NAV1 (online) THE CLAIM: a ship\'s seed is who she is in every sea, and of two claims on her the greater handover count holds her, on a tie the lower id - the stander law\'s own; a stander\'s traffic salted with its id, the waters\' own seeds offline (mutants: the tie to the higher id, the count unread, no salt, a salt offline)', () => {
  assert.equal(claimBeats(1, 'z', 0, 'a'), true, 'taken over beats the first claim, whoever\'s id');
  assert.equal(claimBeats(0, 'a', 1, 'z'), false);
  assert.equal(claimBeats(2, 'b', 2, 'c'), true, 'a tie: the lower id');
  assert.equal(claimBeats(2, 'c', 2, 'b'), false);
  assert.equal(claimBeats(0, 'a', 0, 'a'), false, 'no claim beats itself');
  assert.equal(idSalt('local'), 0);
  assert.equal(idSalt(null), 0);
  assert.notEqual(idSalt('a-player'), idSalt('b-player'));
  assert.equal(idSalt('a-player'), idSalt('a-player'));
  assert.equal(seedBaseOf(100, 100, 1, SEED_SALT ^ idSalt('local')), seedBaseOf(100, 100, 1), 'offline: the waters\' own seeds');
  assert.notEqual(seedBaseOf(100, 100, 1, SEED_SALT ^ idSalt('a-player')), seedBaseOf(100, 100, 1, SEED_SALT ^ idSalt('b-player')));
  assert.equal(NAVAL_GEN_MAX, 255);
});

test('AUDIT NAV1 (online #2) THE SEA HANDED ON: a stander gone from the cell took every ship with it, mid-fight - now the player who would stand the sea without them takes them over where they lie (the same hulls, one past their count) and sails them on; anyone else keeps them ORPHAN_S for that heir\'s word, which claims the same entries; one no word claims is let go (mutants: dropped at once, the heir unread, adopted by all, the orphan never let go)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  const A = r.get('a'), B = r.get('b'), C = r.get('c');
  const brig = stand(A, 'pirateBrig', [260, 0, 160]);
  const galleon = stand(A, 'merchantGalleon', [-300, 0, 250], 1);
  r.run(1.5);
  const onB = bySeed(B, brig.ship.seed), onC = bySeed(C, brig.ship.seed), galleonB = bySeed(B, galleon.ship.seed);
  assert.ok(onB?.boat && onC?.boat && galleonB, 'a stands them: on every screen');
  assert.deepEqual([onB.owner, onB.gen, onC.owner], ['a', 0, 'a']);
  const hullB = onB.boat;
  A.present = false;   // a goes indoors: out of the cell
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(onB.owner, null, 'b, the lowest id left, takes her over');
  assert.equal(onB.gen, 1, 'one past her count');
  assert.equal(B.s.host._sea.get(onB.id), onB, 'the same entry');
  assert.equal(onB.boat, hullB, 'the same hull - never rebuilt');
  assert.equal(galleonB.owner, null);
  assert.deepEqual([onC.owner, onC.gen], ['b', 1], 'c keeps her for b\'s word, which claims the same entry');
  assert.equal(bySeed(C, brig.ship.seed), onC);
  assert.equal([...C.s.host._sea.values()].filter((e) => e.ship.seed === brig.ship.seed).length, 1, 'one of her');
  const at = [...onB.ship.pos];
  r.run(4);
  assert.ok(flat(onB.ship.pos, at) > 3, `she sails on under b's captain (${flat(onB.ship.pos, at).toFixed(1)} m)`);
  assert.ok(flat(onC.ship.pos, onB.ship.pos) < 3, 'and on c\'s screen where b says she is');
  // no heir's word: a player who is not the heir lets them go ORPHAN_S on
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }, { id: 'c', hull: 2 }]);
  const qa = q.get('a'), qb = q.get('b'), qc = q.get('c');
  const lone = stand(qa, 'merchantGalleon', [200, 0, 200]);
  q.run(1.5);
  const loneC = bySeed(qc, lone.ship.seed);
  assert.ok(loneC);
  qb.quiet = true;   // b is the heir, but says nothing
  qa.present = false;
  q.run(OWNER_SWEEP_S + 0.6);
  assert.ok(loneC.orphan != null && loneC.owner === 'a', 'c holds her for the heir');
  q.run(ORPHAN_S);
  assert.equal(bySeed(qc, lone.ship.seed), null, 'no word claimed her: let go');
  assert.ok(bySeed(qb, lone.ship.seed)?.owner === null, 'the heir has her, all the same');
});

test('AUDIT NAV1 (online) A QUIET STANDER: in the cell but saying nothing past OWNER_STALE_S (a tab put away), their ships are the heir\'s as a departed one\'s; when they speak again their first claim yields to the heir\'s - their own copies become the heir\'s ships on their screen, the same entries - and no one holds two of her (mutants: the stale owner never released, the old claim kept)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const brig = stand(A, 'pirateBrig', [200, 0, 220]);
  r.run(1.5);
  const onB = bySeed(B, brig.ship.seed);
  A.quiet = true;
  r.run(OWNER_STALE_S + OWNER_SWEEP_S + 0.5);
  assert.deepEqual([onB.owner, onB.gen], [null, 1], 'quiet past OWNER_STALE_S: taken over');
  A.quiet = false;
  r.run(1.5);
  assert.deepEqual([brig.owner, brig.gen], ['b', 1], 'a hears the stronger claim: her own copy is b\'s ship now');
  assert.equal(bySeed(A, brig.ship.seed), brig, 'the same entry');
  for (const c of [A, B]) assert.equal([...c.s.host._sea.values()].filter((e) => e.ship.seed === brig.ship.seed).length, 1, `${c.id}: one of her`);
  assert.equal(onB.owner, null, 'b keeps her');
});

test('AUDIT NAV1 (online #3, #1) BOARDING ANOTHER\'S SHIP, IN ONE WORLD: the boarder hauled his copy 17 m while her stander\'s lay at 40, then after the win she slid 20 m from under him, and her scuttling burned on his screen alone - now he takes her over at the grapple: the haul, the fight, the prize and her fate are his world, her stander\'s copy follows his word, and her fire and her sinking reach every screen (mutants: no takeover at the grapple, the claim yielded back, the prize adrift in two worlds)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  A.s.view.feet = [0, 0, -400];
  const ship = stand(A, 'merchantGalleon', [40, 0, 0]);
  ship.ship.damage.apply({ hull: Math.ceil(ship.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  r.run(1);
  const mine = bySeed(B, ship.ship.seed);
  assert.equal(mine.ship.damage.state, SHIP_STATES.struck);
  assert.equal(B.s.host.hudModel().board?.kind, 'board');
  assert.equal(B.s.host.activate(), true);
  assert.deepEqual([mine.owner, mine.gen], [null, 1], 'taken over at the grapple');
  let apart = 0;
  for (let t = 0; t < GRAPPLE_S + 0.3; t += 1 / 30) {
    r.tick(1 / 30);
    if (t > 0.6) apart = Math.max(apart, flat(ship.ship.pos, mine.ship.pos));
  }
  assert.equal(B.s.host.boarding?.phase, 'fight');
  assert.deepEqual([ship.owner, ship.gen], ['b', 1], 'her stander\'s copy is the boarder\'s ship now');
  // the haul draws her sideways with no way of her own on her word: her stander's copy follows a word behind (it was
  // 23 m apart for good)
  assert.ok(apart < 8, `the haul followed (${apart.toFixed(2)} m apart at most)`);
  r.run(0.5);
  assert.ok(flat(ship.ship.pos, mine.ship.pos) < 0.5, `alongside, one world (${flat(ship.ship.pos, mine.ship.pos).toFixed(2)} m)`);
  for (const f of B.s.log.foes) f.dead = true;
  r.run(0.3);
  assert.equal(mine.ship.damage.state, SHIP_STATES.prize);
  const deck = B.s.log.placed.at(-1)[0];
  const under = flat(mine.ship.pos, deck);
  r.run(1.5);
  assert.ok(Math.abs(flat(mine.ship.pos, deck) - under) < 0.5, 'the prize stays under his feet');
  assert.ok(flat(ship.ship.pos, mine.ship.pos) < 1, 'and where he says she is');
  B.s.log.plunder.at(-1).fate('scuttle');
  r.run(3);
  assert.equal(ship.ship.damage.state, SHIP_STATES.sinking, 'her stander sees her go down');
  assert.ok(ship.ship.damage.fire > 0 && ship.fires?.some((f) => !f.out), 'burning');
  assert.ok(Math.abs(ship.boat.GameObject.position[1] - mine.boat.GameObject.position[1]) < 0.3, 'settling with his');
});

test('AUDIT NAV1 (online #5, #8, #6c) NO TWINS, ONE NUMBER, ONE NAME: two standers in the same waters on the same day launched the same three ships side by side - now each one\'s traffic is salted with its id; a ship launched while the socket was away (`local:n`) takes a peer\'s blow by her number; and a navy ship is her stander\'s crown\'s to everyone (the same cutter was Wayrest\'s to one player and Daggerfall\'s to one a pixel over) - her names drawn in the region her word carries (mutants: the salt dropped, the blow by her id, the reader\'s own region)', async () => {
  const r = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'many' } }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'many' } }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [3000, 0, 0];   // apart: each stands its own sea
  r.run(150, 0.1);
  const own = (c) => [...c.s.host._sea.values()].filter((e) => !e.owner).map((e) => e.ship.seed);
  const [sa, sb] = [own(A), own(B)];
  assert.ok(sa.length >= 2 && sb.length >= 2, `both launched (${sa.length}, ${sb.length})`);
  assert.equal(sa.filter((x) => sb.includes(x)).length, 0, 'no ship twice');
  // a ship minted under `local:n` takes a peer's blow by her number
  const q = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const qa = q.get('a');
  qa.offline = true;
  const early = stand(qa, 'merchantGalleon', [150, 0, 100]);
  assert.match(early.id, /^local:/);
  qa.offline = false;
  q.run(1);
  const hull0 = early.ship.damage.hull;
  assert.equal(qa.s.host.applyPeerHit('b', { to: 'a', nv: { n: early.n, h: 40, s: 0, c: 0, f: 0, z: 0 } }), true);
  assert.equal(early.ship.damage.hull, hull0 - 40, 'by her number');
  // one name: a reader in another crown's waters calls her what her stander calls her
  const n = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2, where: { region: 17, capitals: [{ region: 17, x: 100, y: 100 }] } }]);
  const cutter = stand(n.get('a'), 'navyCutter', [200, 0, 200]);
  n.run(1);
  const seen = bySeed(n.get('b'), cutter.ship.seed);
  assert.equal(cutter.ship.names.crown, 'Wayrest');
  assert.deepEqual(seen.ship.names, cutter.ship.names, 'her name, her captain, her crown');
  assert.equal(seen.region, CROWNS.find((c) => c.name === 'Wayrest').region);
  // an older word without her region: the reader's own, as before
  const old = navalWireRecord({ ships: [{ n: 9, classId: 'navyCutter', variant: 0, pos: [300, 0, 0], yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: 77, fire: false }] }).s[0].slice(0, 17);
  n.get('b').s.host.applyWord('z', { s: [old], v: [], b: [] }, (p) => p);
  assert.equal(n.get('b').s.host._sea.get('z:9').ship.names.crown, 'Daggerfall');
  assert.ok(validNavalRecord({ s: [old] }));
});

test('AUDIT NAV1 (online) ANOTHER\'S SHIP BETWEEN WORDS sails on along her course at her way (PREDICT_MAX_S at most), eased as ever: a brig at 7 m/s stepped from word to word, a word and more behind - now she stands where her stander has her; a word gone quiet, she stops PREDICT_MAX_S on, never sailing off on a guess (mutants: no prediction, unbounded)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const brig = stand(A, 'pirateBrig', [200, 0, -300], Math.PI / 2);
  brig.ship.course = [1e6, -300];   // a course held (NAV-R's hook): she sails on, fighting no one
  brig.ship.cls = { ...brig.ship.cls, faction: 'merchant' };
  r.run(20);
  const copy = bySeed(B, brig.ship.seed);
  assert.ok(brig.ship.speed > 3, `under way (${brig.ship.speed.toFixed(1)} m/s)`);
  let worst = 0;
  for (let i = 0; i < 90; i++) { r.tick(1 / 30); worst = Math.max(worst, flat(copy.ship.pos, brig.ship.pos)); }
  const lag = brig.ship.speed * 0.28;   // a word's interval and the relay's latency, unpredicted
  assert.ok(worst < Math.max(1.2, lag * 0.5), `where her stander has her (${worst.toFixed(2)} m at worst; ${lag.toFixed(2)} m a word behind)`);
  // her stander falls quiet: she sails on PREDICT_MAX_S at most, then stops
  A.quiet = true;
  const at = [...copy.ship.pos];
  r.run(PREDICT_MAX_S + 2);
  const went = flat(copy.ship.pos, at);
  assert.ok(went <= brig.ship.speed * PREDICT_MAX_S + 1 && went > brig.ship.speed * PREDICT_MAX_S * 0.5, `on her course, then no further (${went.toFixed(1)} m)`);
  const still = [...copy.ship.pos];
  r.run(1);
  assert.ok(flat(copy.ship.pos, still) < 0.05, 'stopped');
  assert.ok(PUPPET_SNAP_M > brig.ship.speed * PREDICT_MAX_S);
});

test('AUDIT NAV1 (online #2) TWO STANDERS MEET: the one who stops standing kept its ships for good and the sea doubled - now the stander counts the whole shared sea near it against the density and launches nothing past it, and every player lets its own ships go out of sight, standing or not, launching none (mutants: the peers\' ships uncounted, the non-stander never letting go, the non-stander launching)', async () => {
  const r = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'some' } }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'some' } }]);
  const A = r.get('a'), B = r.get('b');
  B.s.view.feet = [400, 0, 0];
  stand(A, 'merchantGalleon', [300, 0, 600], 1);
  stand(B, 'merchantGalleon', [-300, 0, 600], 2);
  stand(B, 'merchantCoaster', [100, 0, -700], 3);
  const far = stand(B, 'merchantCoaster', [2600, 0, 2600]);   // past DESPAWN_BEYOND of both
  const count = (c) => [...c.s.host._sea.values()].filter((e) => !e.owner).length;
  r.run(1);
  assert.equal(B.s.host._sea.has(far.id), false, 'b lets its own go out of sight - not standing');
  // a director with nothing to launch lets its own go and draws nothing on the stream (the host's own - a roll that
  // could launch nothing shifted every later draw)
  let draws = 0;
  const idle = createNavalDirector({ random: () => { draws++; return 0.5; } });
  const ctx = (density) => ({ density, player: [0, 0, 0], players: [[0, 0, 0]], ships: [], isOpenWater: () => true, seedBase: 1, seaY: 0 });
  for (let t = 0; t < 200; t++) idle.step(1, ctx(0));
  assert.equal(draws, 0, 'density 0: no roll, no draw');
  for (let t = 0; t < 200; t++) idle.step(1, ctx(3));
  assert.ok(draws > 0);
  const away = { id: 'z:1', pos: [5000, 0, 0], classId: 'merchantGalleon', theirs: true, afloat: true };
  assert.deepEqual(idle.step(1, { ...ctx(3), ships: [away, { ...away, id: 'mine', theirs: false }] }).despawn, ['mine'], 'another\'s ship is never mine to let go');
  r.run(90, 0.1);   // the first roll and two more, the traders still near
  assert.ok([...B.s.host._sea.values()].filter((e) => !e.owner).every((e) => flat(e.ship.pos, A.s.view.feet) < 1900), 'b\'s two still near a');
  assert.equal(count(A), 1, 'the shared sea holds three ("some"): a launches none');
  assert.equal(count(B), 2, 'b launches none');
  // the sea short near them both: only the stander launches
  const q = await room([{ id: 'a', hull: 2, settings: { ShipsAtSea: 'some' } }, { id: 'b', hull: 2, settings: { ShipsAtSea: 'some' } }]);
  q.get('b').s.view.feet = [400, 0, 0];
  q.run(90, 0.1);
  assert.ok(count(q.get('a')) >= 1, 'a launches');
  assert.equal(count(q.get('b')), 0, 'b never does');
});

test('AUDIT NAV1 (online) A RAIDER TAKEN OVER is known by her seed: the heir marks her its raider (held on its word, spent by its law) and stands no second copy beside another\'s; mid-boarding, a lower id\'s Overworld hold never takes her from under the fight (mutants: the seed unread, a second copy stood, the hold dropping a boarding)', async () => {
  const r = await room([{ id: 'a', hull: 2 }, { id: 'b', hull: 2 }]);
  const A = r.get('a'), B = r.get('b');
  const R = { id: 'r16.16.1', seed: 0x51f00d, pos: [700, 0, 0], yaw: Math.PI / 2, ahead: [900, 0, 0] };
  A.s.host.raiders([R], { sight: 0, spent: new Set() });
  r.run(1);
  const copy = bySeed(B, R.seed);
  assert.ok(copy && copy.owner === 'a');
  B.s.host.raiders([R], { sight: 0, spent: new Set() });
  assert.equal([...B.s.host._sea.values()].filter((e) => e.ship.seed === R.seed).length, 1, 'no second copy beside a\'s');
  A.present = false;
  r.run(OWNER_SWEEP_S + 0.6);
  assert.equal(copy.owner, null);
  B.s.host.raiders([R], { sight: 0, spent: new Set() });
  assert.equal(copy.raider?.id, R.id, 'her raider, by her seed');
  assert.deepEqual(B.s.host.raiderHeld().map((h) => h.id), [R.id], 'held on b\'s word');
  // taken over from me in turn by a stronger claim: no raider of mine to hold or spend
  B.s.host.applyWord('c', { s: [[...navalWireRecord({ ships: [{ n: 7, classId: copy.ship.cls.id, variant: 0, pos: copy.ship.pos, yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state: 'afloat', heel: 0, seed: R.seed, fire: false, gen: 2, region: 23 }] }).s[0]]], v: [], b: [] }, (p) => p);
  assert.deepEqual([copy.owner, copy.gen, copy.raider], ['c', 2, null], 'yielded: hers, not my raider');
  assert.deepEqual(B.s.host.raiderHeld(), []);
});

test('AUDIT NAV1 (online) A NUMBER SAID AGAIN for another ship (her stander\'s numbers come round after 65,536 launches): the one I had under it is gone at once, even going down - left sinking under the key the new ship takes, her hull was never let go (mutants: the old one let go to finish)', async () => {
  const h = await sea({ hull: 2 });
  const word = (seed, state) => ({ s: [navalWireRecord({ ships: [{ n: 5, classId: 'merchantGalleon', variant: 0, pos: [200, 0, 100], yaw: 0, speed: 0, sails: 1, hull: 1, sail: 1, crew: 1, state, heel: 0, seed, fire: false }] }).s[0]], v: [], b: [] });
  h.host.applyWord('z', word(11, 'sinking'), (p) => p);
  h.run(0.3);
  const old = h.host._sea.get('z:5');
  assert.ok(old?.boat);
  const removed = h.pool.remove.bind(h.pool);
  let gone = null;
  h.pool.remove = (b) => { if (b === old.boat) gone = b; return removed(b); };
  h.host.applyWord('z', word(12, 'afloat'), (p) => p);
  assert.equal(gone, old.boat, 'her hull let go');
  assert.equal(h.host._sea.get('z:5').ship.seed, 12, 'the number is the new ship\'s');
  assert.equal([...h.host._sea.values()].filter((e) => e.ship.seed === 11).length, 0);
});
