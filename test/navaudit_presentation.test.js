// AUDIT NAV1 (2026-09-29, Mac: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
// and combat to flow perfectly, just like assisins creed black flag") - THE PRESENTATION, the audit's fifth slice
// (bible/03-World/Naval-Combat.md "The presentation"): what the player sees and hears of a sea fight. First, going
// down: the kill is the frame a player watches closest, and it ended in a pop - the laws, and the host through real
// frames over Come Sail Away's real pool (test/navalSea.mjs), each hull's own meshes measured as drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from './navalSea.mjs';
import { sparsOf, FLAME_AWASH, BLAST_SHAKE, NEAR_BOOM_M, FAR_FADE_M, FAR_MATCH, GUN_PITCH_JITTER, GUN_GAIN_JITTER_DB, HIT_CONFIRM_REF_M, HIT_BURST_MAX, GUN_KICK } from '../src/scenes/navalHost.js';
import { READY_FLASH_S } from '../src/systems/naval/navalGunnery.js';
import { NAVAL_SFX, NAVAL_SOUND_RANGE } from '../src/systems/naval/navalSounds.js';
import { navalHudText, drawNavalHud, destroyNavalHud, NAVAL_HUD_CSS, CARD_HIT_S } from '../src/ui/navalHud.js';
import { byClass } from './chargenDom.mjs';
import { FLAG_DONOR_HULL } from '../src/scenes/comeSailAwayPool.js';
import { Boat, meshLocalBounds, worldBounds } from '../src/systems/comeSailAwayBoat.js';
import { createShipDamage, sinkAngles, sinkDepth, SHIP_STATES, SINK_SECONDS, SINK_LIST, SINK_PITCH, SINK_CLEAR } from '../src/systems/naval/navalDamage.js';
import { hullBuild, NAVAL_FACTIONS } from '../src/systems/naval/navalShips.js';
import { navalHitData } from '../src/systems/naval/navalWire.js';
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

// ── feedback: the mix, a hit, the reload, her colours ──────────────────────────────────────────────────────────────
const RATE = 11025;
const pcm = (f) => { const b = readFileSync(new URL(`../public/sfx/${f}`, import.meta.url)); const i = b.indexOf('data') + 8; return Float32Array.from(b.subarray(i), (v) => (v - 128) / 128); };
const rms = (x, secs) => { const n = Math.min(x.length, Math.round(secs * RATE)); let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i]; return Math.sqrt(s / n); };
/** Every play3d the host makes, with the sea's clock it was made at. */
function soundLog(h) {
  const played = [];
  const at = { t: 0 };
  h.deps.audio.play3d = (k, p, v, opts) => played.push({ k, p: [...p], v, opts, t: at.t });
  return { played, at };
}
/** A peer's volley on their word, fired from `pos` out of her starboard side (navalWire.js's volley row). */
const peerVolley = (id, pos) => ({ s: [], v: [[id, -1, 2, 0, pos[0], pos[1], pos[2], Math.PI, 0, 0, 0.05, 99 + id, 0.5]], b: [] });

test('AUDIT NAV1 (the presentation) THE MIX, my broadside: each report at one over the root of her guns, its own pitch within GUN_PITCH_JITTER and level within GUN_GAIN_JITTER_DB, no far roll at my own guns, each gun\'s kick along the ripple - and summed as the bus sums them (no limiter) it no longer clips at the default volume (+3.4 dBFS before; 11% of samples clipped at full) (mutants: my ripple unscaled, the jitter dropped, the kick at the release once)', async () => {
  const clip = pcm('naval-cannon.wav');
  for (const hull of [2, 4]) {
    const h = await sea({ hull });
    const { played, at } = soundLog(h);
    h.host.frame(0.1);
    h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
    for (let i = 0; i < 12; i++) { at.t += 0.05; h.host.frame(0.05); }
    const reports = played.filter((s) => s.k === NAVAL_SFX.cannon);
    const n = reports.length;
    assert.equal(n, hull === 2 ? 6 : 7, 'every gun heard');
    const lo = 10 ** (-GUN_GAIN_JITTER_DB / 20) / Math.sqrt(n), hi = 10 ** (GUN_GAIN_JITTER_DB / 20) / Math.sqrt(n);
    assert.ok(reports.every((r) => r.v >= lo - 1e-9 && r.v <= hi + 1e-9), `each at 1/sqrt(${n}), jittered (${reports.map((r) => r.v.toFixed(2))})`);
    assert.ok(reports.every((r) => Math.abs(r.opts.pitch - 1) <= GUN_PITCH_JITTER + 1e-9), 'each its own pitch');
    assert.ok(new Set(reports.map((r) => r.opts.pitch.toFixed(4))).size === n && new Set(reports.map((r) => r.v.toFixed(4))).size === n, 'no two guns one clip');
    assert.equal(played.some((s) => s.k === NAVAL_SFX.cannonFar), false, 'my own guns are near: no far roll');
    assert.deepEqual(h.log.shake, reports.map(() => GUN_KICK.long), 'a long gun\'s kick a gun');
    // the ripple summed as the bus sums it, at the default SoundVolume
    const out = new Float32Array(RATE * 3);
    for (const r of reports) {
      const start = Math.round(r.t * RATE);
      for (let i = 0; start + i < out.length; i++) { const s = i * r.opts.pitch, j = Math.floor(s); if (j + 1 >= clip.length) break; out[start + i] += r.v * (clip[j] + (clip[j + 1] - clip[j]) * (s - j)); }
    }
    const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) * 0.5;
    assert.ok(peak < 0.8, `hull ${hull}: the ripple peaks ${peak.toFixed(2)} at the default volume - never clipped`);
  }
});

test('AUDIT NAV1 (the presentation) THE MIX, a broadside across the bay: the far roll once a volley at FAR_MATCH times the root of her guns (it was one a GUN - fourteen thumps for seven), the near reports and the roll crossfaded in equal power over FAR_FADE_M either side of NEAR_BOOM_M (the roll stood 6.5 dB over the near at the switch), FAR_MATCH the clips\' own; and nothing played past its range (mutants: the roll once a gun, the band dropped, the cull dropped)', async () => {
  // the clips' own match: their RMS through their references
  const near = rms(pcm('naval-cannon.wav'), 1), far = rms(pcm('naval-cannon-far.wav'), 1);
  const match = (near * NAVAL_SOUND_RANGE[NAVAL_SFX.cannon].refDistance) / (far * NAVAL_SOUND_RANGE[NAVAL_SFX.cannonFar].refDistance);
  assert.ok(Math.abs(20 * Math.log10(FAR_MATCH / match)) < 1, `FAR_MATCH ${FAR_MATCH} is the clips' ${match.toFixed(3)} within 1 dB`);
  const heard = async (x) => {
    const h = await sea({ hull: 2, online: ONLINE });
    const { played } = soundLog(h);
    h.host.applyWord('a-player', peerVolley(1, [x, 0, 0]), (p) => p);
    h.run(0.8);
    return played;
  };
  const close = await heard(150);
  const closeReports = close.filter((s) => s.k === NAVAL_SFX.cannon);
  assert.ok(closeReports.length >= 6 && !close.some((s) => s.k === NAVAL_SFX.cannonFar), 'near: her reports, no roll');
  assert.ok(closeReports.every((r) => r.v >= 10 ** (-GUN_GAIN_JITTER_DB / 20) - 1e-9), 'another\'s guns each at full weight - only my own ripple is scaled');
  const off = await heard(700);
  const rolls = off.filter((s) => s.k === NAVAL_SFX.cannonFar);
  assert.equal(off.filter((s) => s.k === NAVAL_SFX.cannon).length, 0, 'far: no near report');
  assert.equal(rolls.length, 1, 'one roll a volley');
  assert.ok(Math.abs(rolls[0].v - FAR_MATCH * Math.sqrt(6)) < 1e-9, `at FAR_MATCH x sqrt(6) (${rolls[0].v})`);
  assert.equal(rolls[0].opts.far, true, 'held off the ear as a far sound');
  const mid = await heard(NEAR_BOOM_M);
  const midReports = mid.filter((s) => s.k === NAVAL_SFX.cannon), midRoll = mid.filter((s) => s.k === NAVAL_SFX.cannonFar);
  assert.ok(midReports.length >= 6 && midRoll.length === 1, 'in the band: both');
  // each at its own place in the band: x = 0 at NEAR_BOOM_M - FAR_FADE_M, 1 at + FAR_FADE_M - the reports by cos, the roll
  // by sin: equal power across it (the feet at the origin)
  const xOf = (p) => Math.min(1, Math.max(0, (Math.hypot(p[0], p[2]) - (NEAR_BOOM_M - FAR_FADE_M)) / (2 * FAR_FADE_M)));
  for (const r of midReports) {
    const k = r.v / Math.cos(xOf(r.p) * Math.PI / 2);
    assert.ok(k >= 10 ** (-GUN_GAIN_JITTER_DB / 20) - 1e-9 && k <= 10 ** (GUN_GAIN_JITTER_DB / 20) + 1e-9, `a report faded by the cosine of its place (${k.toFixed(3)})`);
  }
  const x0 = xOf(midRoll[0].p);
  assert.ok(x0 > 0.3 && x0 < 0.7, `the volley in the band's middle (${x0.toFixed(2)})`);
  assert.ok(Math.abs(midRoll[0].v - FAR_MATCH * Math.sqrt(6) * Math.sin(x0 * Math.PI / 2)) < 1e-9, 'the roll coming in by the sine of its first gun\'s place');
  assert.ok(FAR_FADE_M > 0 && FAR_FADE_M < NEAR_BOOM_M);
  const gone = await heard(NAVAL_SOUND_RANGE[NAVAL_SFX.cannonFar].maxDistance + 200);
  assert.equal(gone.filter((s) => s.k === NAVAL_SFX.cannon || s.k === NAVAL_SFX.cannonFar).length, 0, 'past its range: nothing (the inverse law never reaches silence)');
});

test('AUDIT NAV1 (the presentation) a hit that registers: a ball of mine striking her hull is heard at HIT_CONFIRM_REF_M (19 dB down from 150 m at the hull\'s own 16), another\'s at the hull\'s own; its splinters, flash and puff grown for the eye that sees it far off, to HIT_BURST_MAX (a splinter at 150 m was two pixels) (mutants: no confirm, the burst unscaled)', async () => {
  const strike = async (shooter, x) => {
    const h = await sea({ hull: 2 });
    const { played } = soundLog(h);
    const e = place(h, 'merchantGalleon', [x, 0, 0], { yaw: 0 });
    const box = hullBuild(e.ship.hull);
    const p0 = [x - box.halfWidth - 3, 3, 0];
    h.host._shots.fireVolley({ id: 'v1', shooter, launches: [{ delay: 0, p0, v0: [60, 0.5, 0], gun: 'long', index: 0 }], resolve: true });
    h.run(0.3);
    return { hit: played.find((s) => s.k === NAVAL_SFX.hit), debris: h.host._effects.drawList().filter((p) => p.kind === 'debris') };
  };
  const mine = await strike('me:42', 150);
  assert.ok(mine.hit, 'struck her');
  assert.equal(mine.hit.opts.refDistance, HIT_CONFIRM_REF_M, 'mine: the confirm');
  assert.ok(mine.debris.some((p) => p.size > 0.4 * 2), `grown for a far eye (${Math.max(...mine.debris.map((p) => p.size)).toFixed(2)} m)`);
  assert.ok(mine.debris.every((p) => p.size <= 0.4 * HIT_BURST_MAX + 1e-9));
  const theirs = await strike('peer:a', 150);
  assert.equal(theirs.hit.opts.refDistance, NAVAL_SOUND_RANGE[NAVAL_SFX.hit].refDistance, 'another\'s: the hull\'s own');
  const close = await strike('me:42', 20);
  assert.ok(close.debris.every((p) => p.size <= 0.4 + 1e-9), 'close by: as it was');
});

test('AUDIT NAV1 (the presentation) a battery coming ready: the gun captain\'s word from her side (a new clip, NAVAL_SFX.ready) and its chip\'s flash for READY_FLASH_S - a side came ready in silence; a side loaded when I take the helm says nothing; a loaded side stands FULL brass (it filled to 97% and dropped to nought, loaded) (mutants: no word, the flash never ends, the gauge emptied loaded)', async () => {
  const h = await sea({ hull: 2 });
  const { played, at } = soundLog(h);
  h.host.frame(0.1);
  assert.equal(played.filter((s) => s.k === NAVAL_SFX.ready).length, 0, 'loaded as I came aboard: nothing said');
  h.host.attackInput(true); h.host.frame(0.1); h.host.attackInput(false);
  const side = () => h.host.hudModel().batteries.find((b) => b.side === 'starboard');
  assert.equal(side().loaded, false);
  let readyAt = null;
  for (let t = 0; t < 30 && readyAt == null; t += 0.1) { at.t = t; h.host.frame(0.1); if (played.some((s) => s.k === NAVAL_SFX.ready)) readyAt = t; }
  assert.ok(readyAt != null, 'the word when she is loaded');
  const word = played.filter((s) => s.k === NAVAL_SFX.ready);
  assert.equal(word.length, 1, 'once');
  assert.ok(word[0].p[0] > 3, 'from her starboard side');
  assert.equal(side().loaded, true);
  assert.equal(side().fresh, true, 'her chip flashes');
  h.run(READY_FLASH_S + 0.1);
  assert.equal(side().fresh, false, 'for READY_FLASH_S');
  assert.equal(played.filter((s) => s.k === NAVAL_SFX.ready).length, 1, 'and no more');
  const text = navalHudText(h.host.hudModel(), {});
  assert.equal(text.plate.batteries.find((b) => b.side === 'starboard').fill, 100, 'loaded: full brass');
  destroyNavalHud();
  drawNavalHud(h.host.hudModel(), { keys: {} });
  const chip = byClass(globalThis.document.body, 'dfnaval-gun starboard')[0] ?? byClass(globalThis.document.body, 'dfnaval-gun').find((g) => / starboard/.test(g.className));
  assert.equal(byClass(chip, 'dfnaval-gun-fill')[0].style.height, '100%', 'drawn full, loaded');
  destroyNavalHud();
  const reloading = navalHudText({ ...h.host.hudModel(), batteries: [{ side: 'port', gun: 'long', guns: 6, progress: 0.97, ready: false, loaded: false }] }, {});
  assert.equal(reloading.plate.batteries[0].fill, 97);
  const loaded = navalHudText({ ...h.host.hudModel(), batteries: [{ side: 'port', gun: 'long', guns: 6, progress: 1, ready: false, loaded: true, fresh: true }] }, {});
  assert.deepEqual([loaded.plate.batteries[0].fill, loaded.plate.batteries[0].fresh], [100, true], 'braced but loaded: full');
});

test('AUDIT NAV1 (the presentation) her hull bar reads a hit as the foe bar does (ui/barLoss.js): the pale ghost holds where it WAS, a bite of CARD_CHUNK_MIN_LOSS breaks a piece off over the span it took and flashes the card for CARD_HIT_S - it only slid, for 160 ms; a new target starts whole; the HUD hidden puts the pieces away (FRAME1c) (mutants: no ghost, no piece, no flash, a new ship\'s loss read off the last)', () => {
  destroyNavalHud();
  const target = (o = {}) => ({ id: 'a:1', name: 'The Red Wake', captain: null, classLine: 'Pirate Brigantine', faction: 'pirate', hull: 0.8, sail: 0.9, state: 'afloat', boarded: false, distance: 150, hostile: true, ...o });
  const model = (t) => ({ ship: null, armed: false, batteries: [], aim: null, aiming: false, target: t, board: null, boarding: null, notoriety: { crown: 'Wayrest', value: 0, level: 0 } });
  const draw = (t, dt = 0.016, o = {}) => drawNavalHud(model(t), { keys: {}, dt, ...o });
  draw(target());
  const card = byClass(globalThis.document.body, 'dfnaval-card')[0];
  const ghost = byClass(card, 'dfnaval-ghost')[0];
  const chunks = byClass(card, 'dfnaval-chunk');
  assert.equal(chunks.length, 2);
  assert.equal(ghost.style.width, '80%', 'whole at her bar');
  draw(target({ hull: 0.62 }));
  assert.equal(ghost.style.width, '80%', 'the ghost holds where it was');
  assert.match(chunks[0].className, /dfnaval-chunk fa/, 'a piece breaks off');
  assert.deepEqual([chunks[0].style.left, chunks[0].style.width], ['62.0%', '18.0%'], 'over the span the bite took');
  assert.match(card.className, /hit-[ab]$/, 'the card flashes');
  draw(target({ hull: 0.62 }), CARD_HIT_S + 0.01);
  assert.equal(card.className, 'dfnaval-card pirate hostile', 'for CARD_HIT_S');
  draw(target({ hull: 0.615 }));
  assert.equal(byClass(card, 'dfnaval-chunk').filter((c) => / f[ab]/.test(c.className)).length, 1, 'under CARD_CHUNK_MIN_LOSS: no piece');
  for (let i = 0; i < 40; i++) draw(target({ hull: 0.62 }), 0.05);
  assert.equal(ghost.style.width, '62%', 'then it drains to her bar');
  draw(target({ id: 'b:2', name: 'The Salt Maid', hull: 0.3 }));
  assert.equal(ghost.style.width, '30%', 'a new ship starts whole at her own bar - nothing lost to show');
  assert.ok(chunks.every((c) => c.className === 'dfnaval-chunk'), 'the last ship\'s pieces put away');
  draw(target({ id: 'b:2', name: 'The Salt Maid', hull: 0.2 }));
  assert.match(chunks[0].className, / f[ab]$/);
  drawNavalHud(model(target({ id: 'b:2', hull: 0.2 })), { keys: {}, dt: 0.016, covered: true });
  assert.ok(chunks.every((c) => c.className === 'dfnaval-chunk'), 'hidden under a window: the pieces put away, never replayed');
  destroyNavalHud();
});

test('AUDIT NAV1 (the presentation) her colours by her state: her faction\'s while she sails, struck with her (the flag stops), the captor\'s orange once taken, gone down with her - she flew her faction\'s whatever she was; a Carrack at sea flies them from her mainmast\'s truck (the pirate flagship and the merchant carrack flew none), a player\'s Carrack keeps the mod\'s rig; the card\'s hostile red wins over a trade\'s colour; a powder barrel on my deck shakes past a holed ball (mutants: struck colours flying, the prize in her faction\'s, no graft, the donor never found, hostile under the trade)', async () => {
  const h = await sea({ hull: 2 });
  const e = place(h, 'navyCutter', [200, 0, 0]);
  h.run(0.5);
  assert.deepEqual(e.boat.flagColor, NAVAL_FACTIONS.navy.flag);
  assert.equal(e.boat.FlagEmitter.isEmitting, true, 'afloat: her colours fly');
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 }, 0);
  assert.equal(e.ship.damage.state, SHIP_STATES.struck);
  h.run(0.2);
  assert.equal(e.boat.FlagEmitter.isEmitting, false, 'struck: her colours come down');
  e.ship.damage.takePrize();
  h.run(0.2);
  assert.equal(e.boat.FlagEmitter.isEmitting, true, 'taken: colours again -');
  assert.equal(e.boat.flagColor, null, '- the captor\'s orange (FlagMaterial\'s, the player\'s boats\' own)');
  // the Carrack's graft
  const c = place(h, 'pirateFlagship', [400, 0, 0], { seed: 0 });
  assert.ok(c.boat.FlagObject, 'a Carrack at sea flies her colours');
  assert.equal(c.boat.FlagObject.parent.name, 'CarrackMast1', 'on her tallest mast - heeling with it');
  const at = c.boat.MeshObject.inverseTransformPoint(c.boat.FlagObject.position);   // her hull's own frame: the swell heels it
  assert.ok(Math.abs(at[0]) < 0.05 && Math.abs(at[1] - 47.51) < 0.05 && Math.abs(at[2] + 3.09) < 0.05, `at its truck (${at.map((v) => v.toFixed(2))})`);
  assert.equal(c.boat.FlagEmitter, c.boat.FlagObject.getComponentInChildren('ParticleSystem').particleSystem);
  assert.equal(c.boat.FlagEmitter.renderer.m_RenderMode, 4, 'a mesh flag - the world draws it as her colours');
  h.run(1);
  assert.ok(c.boat.FlagEmitter.particleCount > 0 && c.boat.particleSystems.includes(c.boat.FlagEmitter), 'flying, among her particle systems');
  assert.deepEqual(c.boat.flagColor, NAVAL_FACTIONS.pirate.flag, 'the black');
  const own = h.pool.spawnNow(Object.assign(new Boat(4, 0), { uid: 7 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  assert.equal(own.FlagObject, null, 'a player\'s Carrack: the mod\'s rig as it is');
  assert.equal(FLAG_DONOR_HULL, 2);
  // the card: the hostile red last, so it wins over a navy's or a merchantman's colour
  const i = (sel) => NAVAL_HUD_CSS.indexOf(sel);
  assert.ok(i('.dfnaval-card.hostile .dfnaval-card-name') > i('.dfnaval-card.navy .dfnaval-card-name') && i('.dfnaval-card.hostile .dfnaval-card-name') > i('.dfnaval-card.merchant .dfnaval-card-name'));
  // a powder barrel going up on my deck
  const b = await sea({ hull: 2 });
  b.host._shots.dropBarrel({ id: 'x', shooter: 'x:1', pos: [0, 0, 0], resolve: true });
  b.run(3);
  assert.ok(b.log.shake.includes(BLAST_SHAKE) && BLAST_SHAKE > 2.5, `a barrel shakes past a holed ball (${b.log.shake})`);
});
