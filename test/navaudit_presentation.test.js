// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE PRESENTATION, the audit's fifth slice
// (bible/03-World/Naval-Combat.md "The presentation"): what the player sees and hears of a sea fight. First, going
// down: the kill is the frame a player watches closest, and it ended in a pop - the laws, and the host through real
// frames over Come Sail Away's real pool (test/navalSea.mjs), each hull's own meshes measured as drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from './navalSea.mjs';
import { sparsOf, FLAME_AWASH } from '../src/scenes/navalHost.js';
import { createShipDamage, sinkAngles, sinkDepth, SHIP_STATES, SINK_SECONDS, SINK_LIST, SINK_PITCH, SINK_CLEAR } from '../src/systems/naval/navalDamage.js';
import { hullBuild } from '../src/systems/naval/navalShips.js';
import { navalHitData } from '../src/systems/naval/navalWire.js';
import { meshLocalBounds, worldBounds } from '../src/systems/comeSailAwayBoat.js';
import { NAVAL_DEG } from '../src/systems/naval/navalBallistics.js';
import { quatEuler } from '../src/world/unityAnimator.js';
import { quatRotate } from '../src/world/quat.js';

/** A ship stood where a test wants her (her Large Boat's rig `variant`), built and settled a frame. */
function place(h, classId, pos, { yaw = 0, variant = 0, seed = null } = {}) {
  const id = h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]), yaw });
  const e = h.host._sea.get(id);
  e.ship.pos = [...pos];
  e.ship.variant = variant;
  if (seed != null) e.ship.seed = seed >>> 0;
  h.host.frame(0.1);
  assert.ok(e.boat, 'built');
  return e;
}
/** Her highest drawn point in the world, as drawn: every rigid mesh rendered under her hull's mesh object (the harness's
 *  own walk, not the host's measure). */
function drawnTop(pool, boat) {
  let top = -Infinity;
  for (const node of boat.MeshObject.walk()) {
    if (!node.activeInHierarchy || !node.components.some((c) => c.type === 'MeshRenderer')) continue;
    const ref = node.getComponent('MeshFilter')?.m_Mesh;
    if (!ref || ref.builtin) continue;
    const local = meshLocalBounds({ models: pool.models }, ref);
    if (local) top = Math.max(top, worldBounds(node, local).max[1]);
  }
  return top;
}
/** A flame the host lights, recorded: where it stands and when (the sea's clock) it went out. */
function flameLog(h) {
  const flames = [];
  const clock = { t: 0 };
  h.deps.flame = (p) => { const f = { pos: [...p], out: null, move(q) { f.pos = [...q]; }, retire() { f.out = clock.t; } }; flames.push(f); return f; };
  const loops = [];
  h.deps.audio.loop3d = (k) => { const l = { k, stopped: null, move() {}, stop() { l.stopped = clock.t; } }; loops.push(l); return l; };
  return { flames, loops, clock };
}
/** A peer's word of one ship (navalWire.js: [n, cls, variant, x, y, z, yaw, speed, sails, hull%, sail%, crew%, state, heel,
 *  seed, fire]) - `state` the wire's code (2: sinking). */
const peerWord = (cls, state = 0, hull = 100, fire = 0) => ({ s: [[4, cls, 0, 120, 0, 0, Math.PI / 2, 0, 1, hull, 100, 100, state, 0, 999, fire]], v: [], b: [] });
const ONLINE = { id: () => 'b-player', peers: () => [{ id: 'a-player', feet: [10, 0, 0] }], sendHit: () => true };
/** The wire's class index (navalWire.js: SHIP_CLASSES' order). */
const WIRE_CLASS = { pirateBrig: 1 };

test('AUDIT NAV1 (the presentation) going down: every hull - the Large Boat\'s rigs, a brig, a galley, a carrack - is SINK_CLEAR under the sea with her highest spar when SINK_SECONDS is up, and only then gone (it was her deck and 8 m: a brig vanished with 19.5 m of mast standing, a galley 24.5, a carrack 32.2) (mutants: the old depth, the clearance dropped, the depth not squared)', async () => {
  for (const [classId, variant, seed] of [['pirateSloop', 0, 1], ['merchantCoaster', 3, 2], ['pirateBrig', 0, 0], ['navyGalley', 0, 3], ['pirateFlagship', 0, 1], ['merchantCarrack', 0, 2]]) {
    const h = await sea({ hull: 2 });
    const e = place(h, classId, [300, 0, 0], { variant, seed });
    const rest = drawnTop(h.pool, e.boat);
    assert.ok(rest > hullBuild(e.ship.hull).deck + 5, `${classId}: her masts stand over her deck`);
    e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
    assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
    let last = null, half = null, gone = null;
    for (let t = 0.1; t < SINK_SECONDS + 1; t += 0.1) {
      h.host.frame(0.1);
      if (!h.host._sea.has(e.id)) { gone = t; break; }
      last = drawnTop(h.pool, e.boat);
      if (half == null && t >= SINK_SECONDS / 2) half = last;
    }
    assert.ok(gone != null && gone >= SINK_SECONDS - 0.05 && gone <= SINK_SECONDS + 0.25, `${classId}: gone when SINK_SECONDS is up (${gone})`);
    assert.ok(last <= -(SINK_CLEAR - 0.6), `${classId} v${variant}: her highest spar ${last.toFixed(2)} m at the last frame drawn - under the sea`);
    assert.ok(last >= -(SINK_CLEAR + 1.5), `${classId}: and no deeper than the clearance asks (${last.toFixed(2)})`);
    assert.ok(half > rest * 0.5, `${classId}: slow as she fills - half her height still stands at half time (${half.toFixed(1)} of ${rest.toFixed(1)})`);
  }
});

test('AUDIT NAV1 (the presentation) she lists to her seed\'s side and goes down by the head or the stern - her seed\'s next bit - both growing over SINK_SECONDS; her root settles by the square of the time to the depth her own spars ask (mutants: the trim one way for every ship, the list\'s side fixed, the trim dropped)', async () => {
  assert.deepEqual(sinkAngles(0, 1), { roll: -SINK_LIST, pitch: SINK_PITCH });
  assert.deepEqual(sinkAngles(1, 1), { roll: SINK_LIST, pitch: SINK_PITCH });
  assert.deepEqual(sinkAngles(2, 1), { roll: -SINK_LIST, pitch: -SINK_PITCH });
  assert.deepEqual(sinkAngles(3, 0.5), { roll: SINK_LIST / 2, pitch: -SINK_PITCH / 2 });
  assert.deepEqual(sinkAngles(3, 7), sinkAngles(3, 1), 'no further than her last');
  assert.deepEqual(sinkAngles(1, -1), { roll: 0, pitch: 0 });
  assert.equal(sinkDepth(40, 0.5), 10);
  assert.equal(sinkDepth(40, 1), 40);
  assert.equal(sinkDepth(40, 2), 40);
  assert.equal(sinkDepth(-3, 1), 0);
  assert.equal(sinkDepth(40, NaN), 0);
  // on the real hull: by the head her stem goes under first, by the stern her taffrail
  for (const [seed, first, low] of [[0, 'bow', 'starboard'], [3, 'stern', 'port']]) {
    const h = await sea({ hull: 2 });
    const e = place(h, 'pirateBrig', [300, 0, 0], { seed });
    e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
    h.run(SINK_SECONDS * 0.6);
    const b = hullBuild(e.ship.hull);
    const mo = e.boat.MeshObject;
    const bow = mo.transformPoint([0, b.deck, b.bowZ])[1], stern = mo.transformPoint([0, b.deck, b.aftZ])[1];
    // her 44 m trimmed 12 degrees by 0.6 of SINK_SECONDS: one end 9 m under the other
    if (first === 'bow') assert.ok(bow < stern - 5, `by the head: her stem ${bow.toFixed(1)} under her stern ${stern.toFixed(1)}`);
    else assert.ok(stern < bow - 5, `by the stern: her stern ${stern.toFixed(1)} under her stem ${bow.toFixed(1)}`);
    const port = mo.transformPoint([-b.halfWidth, b.deck, 0])[1], starboard = mo.transformPoint([b.halfWidth, b.deck, 0])[1];
    if (low === 'port') assert.ok(port < starboard - 3, `seed ${seed}: listed to port (${port.toFixed(1)} vs ${starboard.toFixed(1)})`);
    else assert.ok(starboard < port - 3, `seed ${seed}: listed to starboard (${starboard.toFixed(1)} vs ${port.toFixed(1)})`);
  }
});

test('AUDIT NAV1 (the presentation) her spars as drawn: the corners of every rigid mesh under her hull\'s mesh object, in its frame - never a skinned sail\'s bind pose (the Carrack\'s reads 101 m); the Large Boat\'s rigs apart (6 to 9.4 m); her depth her highest point at her LAST pose, over her mesh\'s lift, and SINK_CLEAR (mutants: the skinned sails counted, another rig\'s counted, one measure for every rig, the pose at rest measured, the lift dropped)', async () => {
  const h = await sea({ hull: 2 });
  const top = (sp) => sp.lift + Math.max(...sp.points.map((p) => p[1]));
  const carrack = place(h, 'merchantCarrack', [300, 0, 0]);
  const c = sparsOf(carrack.boat, h.pool.models);
  assert.ok(Math.abs(top(c) - 47.51) < 0.05, `the Carrack's mainmast truck, not her sails' bind pose (${top(c).toFixed(2)})`);
  const boats = [0, 1, 3].map((variant) => sparsOf(place(h, 'merchantCoaster', [300 + variant * 40, 0, 0], { variant }).boat, h.pool.models));
  assert.ok(boats.every((b) => Math.abs(b.lift - 0.1) < 1e-6), 'the Large Boat\'s mesh stands 0.1 m over her root');
  assert.deepEqual(boats.map((b) => Math.round(top(b) * 10) / 10), [9.3, 6, 9.4], 'her lateen, her short mast, her tall mast');
  assert.equal(sparsOf(null, h.pool.models), null);
  // the host measures a rig once and a ship once: two Large Boats of two rigs go down to two depths
  const s = await sea({ hull: 2 });
  const tall = place(s, 'merchantCoaster', [300, 0, 0], { variant: 3, seed: 0 });
  const short = place(s, 'merchantCoaster', [300, 0, 60], { variant: 1, seed: 0 });
  for (const e of [tall, short]) e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  s.host.frame(0.1);
  assert.ok(tall.sinkUnder > short.sinkUnder + 2, `the tall mast goes deeper (${tall.sinkUnder.toFixed(1)} vs ${short.sinkUnder.toFixed(1)})`);
  // the law: her highest point at her last pose (by the head, to starboard - seed 0), over her mesh's lift, SINK_CLEAR more
  const sp = sparsOf(tall.boat, s.pool.models);
  const last = sinkAngles(0, 1);
  const q = quatEuler(last.pitch, 0, last.roll);
  const expect = sp.lift + Math.max(...sp.points.map((p) => quatRotate(q, p)[1])) + SINK_CLEAR;
  assert.ok(Math.abs(tall.sinkUnder - expect) < 1e-4, `${tall.sinkUnder} is ${expect} (measured at another frame's pose: the matrices' rounding)`);
  // a hull whose meshes are unknown goes down by her build's rig and her length's trim
  const u = await sea({ hull: 2 });
  const blind = place(u, 'pirateBrig', [300, 0, 0], { seed: 0 });
  blind.boat.MeshObject.setActive(false);   // nothing of her known to measure
  blind.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  u.host.frame(0.1);
  const b = hullBuild(blind.ship.hull);
  const reach = Math.max(b.top, ...b.rig.map(([, mx]) => mx[1])) + Math.max(-b.aftZ, b.bowZ) * Math.sin(SINK_PITCH * NAVAL_DEG);
  assert.ok(Math.abs(blind.sinkUnder - (reach + SINK_CLEAR)) < 1e-9, `the build's reach (${blind.sinkUnder.toFixed(2)})`);
});

test('AUDIT NAV1 (the presentation) ONLINE: a ship another player stands goes down on my screen too - her sinking run on my clock between their words (every word reset it to nought: a peer\'s brig stood whole at the surface for 22 s, then vanished), and one their word lets go of mid-sinking finishes going down before she is gone; an afloat ship let go of goes at once, and a room left takes them all (mutants: the reset kept, the local clock dropped, the let-go dropped at once, the lost never dropped)', async () => {
  const h = await sea({ hull: 2, online: ONLINE });
  h.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig), (p) => p);
  h.run(0.3);
  const e = h.host._sea.get('a-player:4');
  assert.ok(e?.boat, 'her puppet');
  const rest = drawnTop(h.pool, e.boat);
  let seen = 0;
  for (let t = 0; t < 12; t++) { h.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p); h.run(1); seen++; }
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  assert.ok(Math.abs(e.ship.damage.sinkT - seen) < 0.15, `her clock runs on between their words (${e.ship.damage.sinkT.toFixed(2)} of ${seen})`);
  assert.ok(e.boat.GameObject.position[1] < -5, 'she settles');
  assert.ok(drawnTop(h.pool, e.boat) < rest - 5, 'and her masts go with her');
  // their word lets her go (her stander drops her the moment she is under - a word or two before my clock): she goes on down
  h.host.applyWord('a-player', { s: [], v: [], b: [] }, (p) => p);
  assert.equal(h.host._sea.has('a-player:4'), true, 'still going down');
  let gone = null, last = null;
  for (let t = 0; t < SINK_SECONDS; t += 0.1) { h.host.frame(0.1); if (!h.host._sea.has('a-player:4')) { gone = t; break; } last = drawnTop(h.pool, e.boat); }
  assert.ok(gone != null && Math.abs(gone - (SINK_SECONDS - seen)) < 0.3, `gone when her own clock is up (${gone?.toFixed(1)})`);
  assert.ok(last < 0, `under the sea when she went (${last.toFixed(2)})`);
  // an afloat ship out of the word goes at once; a sinking one when the room is left, at once too
  const o = await sea({ hull: 2, online: ONLINE });
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig), (p) => p);
  o.run(0.3);
  o.host.applyWord('a-player', { s: [], v: [], b: [] }, (p) => p);
  assert.equal(o.host._sea.has('a-player:4'), false, 'an afloat ship out of the word goes');
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  o.run(1);
  o.host.clearPeers();
  assert.equal(o.host._sea.has('a-player:4'), false, 'a room left takes her');
  // back in the word, she is theirs again
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  o.run(1);
  o.host.applyWord('a-player', { s: [], v: [], b: [] }, (p) => p);
  const lost = o.host._sea.get('a-player:4');
  assert.equal(lost?.lost, true);
  o.host.applyWord('a-player', peerWord(WIRE_CLASS.pirateBrig, 2, 0), (p) => p);
  assert.equal(lost.lost, false, 'seen again in their word');
});

test('AUDIT NAV1 (the presentation) the word\'s sinking and a scuttle never start her over: restore keeps her clock while the state holds and starts it only on a new sinking; a second scuttle leaves her going down; a peer\'s clock stops at SINK_SECONDS and says she is under (mutants: restore resets every word, scuttle restarts her, sinkOn unbounded)', () => {
  const d = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  d.restore({ hull: 0, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.sinking });
  assert.equal(d.sinkT, 0);
  assert.equal(d.sinkOn(5), false);
  assert.equal(d.sinkT, 5);
  d.restore({ hull: 0, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.sinking });
  assert.equal(d.sinkT, 5, 'the word says she still sinks: her clock kept');
  assert.equal(d.sinkOn(SINK_SECONDS), true, 'under');
  assert.equal(d.sinkT, SINK_SECONDS, 'and no further');
  d.restore({ hull: 50, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.afloat });
  d.restore({ hull: 0, sail: 100, crew: 20, fire: 0, state: SHIP_STATES.sinking });
  assert.equal(d.sinkT, 0, 'a new sinking starts at nought');
  assert.equal(d.sinkOn(NaN), false);
  assert.equal(d.sinkT, 0);
  const s = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  s.scuttle();
  s.step(6);
  s.scuttle();
  assert.equal(s.sinkT, 6, 'scuttled twice (a peer\'s claim after mine): she goes on down');
  const f = createShipDamage({ hullHp: 400, sailHp: 100, crew: 20 });
  assert.equal(f.sinkOn(3), false, 'afloat: no clock');
  assert.equal(f.sinkT, 0);
});

test('AUDIT NAV1 (the presentation) she burns as she goes down: a burning ship holed to nought keeps her fires (they went out the instant she was holed), each flame follows her deck as she lists and trims and goes out as the sea reaches its place - no ember nor smoke born under the sea (a scuttled hull\'s flames burned 5 m under it, 62 embers and puffs showing through the water) - and the fire\'s loop stops with the last (mutants: the sinking douses, no awash check, the loop never stopped)', async () => {
  const h = await sea({ hull: 2 });
  const { flames, loops, clock } = flameLog(h);
  const e = place(h, 'pirateBrig', [200, 0, 0], { seed: 0 });
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 5, fire: true, zone: 'hull' }));
  h.run(0.5);
  assert.equal(flames.length, 3, 'three fires along her deck');
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 400, zone: 'holed' }));
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  assert.ok(e.ship.damage.fire > 0, 'her fires burn on as she goes down');
  let under = 0;
  for (let t = 0; t < SINK_SECONDS && h.host._sea.has(e.id); t += 0.1) {
    clock.t = t;
    h.host.frame(0.1);
    under = Math.max(under, h.host._effects.drawList().filter((p) => (p.kind === 'ember' || p.kind === 'smoke') && p.pos[1] < 0).length);
    for (const f of flames) if (f.out == null) assert.ok(f.pos[1] >= FLAME_AWASH - 1e-9, `a flame burns only over the sea (${f.pos[1].toFixed(2)})`);
  }
  const outs = flames.map((f) => f.out).sort((a, b) => a - b);
  assert.ok(outs.every((t) => t != null && t > 3), `each out as the sea reached it, never at the hole (${outs.map((t) => t?.toFixed(1)).join(', ')})`);
  assert.ok(outs[2] - outs[0] > 0.3, 'one by one - by the head, her forward fire first');
  assert.equal(under, 0, 'no ember nor smoke born under the sea');
  assert.equal(loops.length, 1);
  assert.ok(Math.abs(loops[0].stopped - outs[2]) < 0.15, `her loop stops with her last flame (${loops[0].stopped?.toFixed(1)})`);
  // the flames follow her deck as she heels: a fire's place is her deck's, not the calm sea's
  const g = await sea({ hull: 2 });
  const log2 = flameLog(g);
  const b = place(g, 'pirateBrig', [200, 0, 0], { seed: 1 });
  g.host.applyPeerHit('peer', navalHitData('local', { n: b.n, hull: 5, fire: true, zone: 'hull' }));
  b.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  g.run(4);
  const mid = log2.flames.find((f) => f.out == null && Math.abs(f.pos[0] - b.ship.pos[0]) < 3 && Math.abs(f.pos[2] - b.ship.pos[2]) < 3);
  assert.ok(mid, 'her midships fire');
  const deckAt = b.boat.MeshObject.transformPoint([0, hullBuild(b.ship.hull).deck + 1, 0]);
  assert.ok(Math.hypot(mid.pos[0] - deckAt[0], mid.pos[1] - deckAt[1], mid.pos[2] - deckAt[2]) < 1e-6, 'on her deck as she lies');
});

test('AUDIT NAV1 (the presentation) a scuttled prize burns to the waterline and no further: the torch\'s flames go out as she settles, none under the sea (mutants: the awash check dropped)', async () => {
  const h = await sea({ hull: 2 });
  const { flames, clock } = flameLog(h);
  const e = place(h, 'merchantGalleon', [60, 0, 0], { seed: 2 });
  h.host.applyPeerHit('peer', navalHitData('local', { n: e.n, hull: 1, fire: true, zone: 'hull' }));
  h.run(0.2);
  e.ship.damage.scuttle();
  e.ship.damage.apply({ hull: 0, sail: 0, crew: 0, fire: true }, 0);   // openPrize's scuttle: the torch
  let worst = 0;
  for (let t = 0; t < SINK_SECONDS; t += 0.1) {
    clock.t = t;
    h.host.frame(0.1);
    worst = Math.max(worst, h.host._effects.drawList().filter((p) => (p.kind === 'ember' || p.kind === 'smoke') && p.pos[1] < -0.2).length);
  }
  assert.ok(flames.length === 3 && flames.every((f) => f.out != null && f.out < SINK_SECONDS / 2), `out by the time her deck is under (${flames.map((f) => f.out?.toFixed(1)).join(', ')})`);
  assert.equal(worst, 0);
});

test('AUDIT NAV1 (the presentation) her colours go down with her: the flag flies while she floats and its emitter stops the moment she founders (a flag flown on from a masthead under the sea showed through it) (mutants: the flag never stopped)', async () => {
  const h = await sea({ hull: 2 });
  const e = place(h, 'navyCutter', [200, 0, 0]);
  h.run(1);
  assert.ok(e.boat.FlagEmitter, 'she carries a flag');
  assert.equal(e.boat.FlagEmitter.isEmitting, true, 'afloat: her colours fly');
  e.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  h.run(0.2);
  assert.equal(e.boat.FlagEmitter.isEmitting, false, 'going down: her colours with her');
});
