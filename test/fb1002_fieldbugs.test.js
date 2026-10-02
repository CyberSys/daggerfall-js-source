// FIELD BUGS 2026-10-02 - the three that are not the climb (test/fb1002_climb.test.js holds those):
//   HUNT-FOES - Aru: "when an event occurs while traveling (Track a group of animals type stuff) and you press YES,
//               enemies can attack you while the result loads" / "During this enemies can still attack you";
//   HELM-NET  - Cruor: "New fishing context pop up clashes with come sail away! Gets in the way especially when trying
//               to aim bow guns";
//   HELM-HUSH - (relayed) "audio cutting when taking helm of a ship".
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createHunting, HUNT_PENDING_NEAR_M } from '../src/scenes/hunting.js';
import { HuntWindow, HUNT_PHASE } from '../src/ui/huntWindow.js';
import { newSurvival } from '../src/systems/survival/needs.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { fishKind } from '../src/scenes/fishHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { scene } from './csaScene.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const player = () => ({ isPlayer: true, level: 5, health: 30, maxHealth: 40, fatigue: 20 * 64, items: [], survival: newSurvival(1000), stats: { luck: 50 }, career: {} });
const WILD = { minute: 10 * 60, luck: 50, winter: false, outdoors: true, inLocationRect: false, night: false, enemiesNear: false, resting: false, climateIndex: 232, hasBow: true, skills: { archery: 100, stealth: 100, criticalStrike: 100, climbing: 100 } };

/** A hunt as surv6's composed pin builds it - the roll lands at the first tick - with a foe that can come near. */
function hunt() {
  _resetForTests(); setPref('survival', 'hard');
  const advanced = [], spawned = [];
  let foe = false;
  const h = createHunting({
    entity: player(), env: () => WILD, rolls: seq(0.029, 0.69, 0.5, 0.2, 0.5, 0.95, 0),
    showOverlay: () => {}, advanceMinutes: (n) => advanced.push(n), spawnBeast: (b) => spawned.push(b), enemiesNear: () => foe,
  });
  const w = h.tick();
  assert.ok(w instanceof HuntWindow, 'the hunt\'s box');
  return { h, w, advanced, spawned, near: (v) => { foe = v; } };
}

test('HUNT-FOES: the report - a foe come near while the hunt\'s box asks closes it as a No: nothing searched, no minute passed, no beast, the hunter\'s hands back (mutants: the foe never asked; the ask not interrupted)', () => {
  const s = hunt();
  s.w.tick(0.1);
  assert.equal(s.w.done, false, 'no foe: the box stays');
  s.near(true);
  s.w.tick(0.1);
  assert.equal(s.w.done, true, 'a foe near: the box is gone');
  assert.equal(s.h.window, null, 'the slot freed');
  assert.deepEqual(s.advanced, [], 'no minute');
  assert.deepEqual(s.spawned, [], 'no beast');
});

test('HUNT-FOES: Yes, then a foe come near on the busy page - the search ends unsearched; on the result page (the outcome given) it stays to be read', () => {
  const s = hunt();
  s.w.input('KeyY');
  assert.equal(s.w.phase, HUNT_PHASE.Busy);
  s.w.tick(0.5);
  s.near(true);
  s.w.tick(0.5);
  assert.equal(s.w.done, true, 'the search ends');
  assert.deepEqual(s.advanced, [], 'unsearched: no minute');
  const r = hunt();
  r.w.input('KeyY');
  r.w.tick(100);
  assert.equal(r.w.phase, HUNT_PHASE.Result);
  r.near(true);
  r.w.tick(0.1);
  assert.equal(r.w.done, false, 'the result is the player\'s to read');
});

test('HUNT-FOES: the search\'s minutes pass as the box closes, not under it - offline their encounter tick stood a wanderer 10-20 m off, facing a hunter the result page held; a box taken from under the result still spends them (mutants: the minutes under the box again; the minutes lost with the slot)', () => {
  const s = hunt();
  s.w.input('KeyY');
  s.w.tick(100);
  assert.equal(s.w.phase, HUNT_PHASE.Result);
  assert.deepEqual(s.advanced, [], 'nothing passes under the result page');
  s.w.click(0, 0);
  assert.equal(s.advanced.length, 1, 'the minutes at the close');
  assert.equal(s.spawned.length, 1, 'and the beast');
  const t = hunt();
  t.w.input('KeyY');
  t.w.tick(100);
  t.w.dispose();   // a death screen takes the slot: the outcome was given, so its time was spent
  assert.equal(t.advanced.length, 1, 'the minutes spent');
  assert.deepEqual(t.spawned, [], 'no beast over a box dropped from under');
});

test('HUNT-FOES by source: the world host hands the hunt its foes - a foe that sees me, or one still loading - for the roll and the box', () => {
  const world = src('src/scenes/world.js');
  assert.match(world, /const huntFoesNear = \(\) => \{\n\s+if \(areEnemiesNearby\(exteriorFoePool\(\)\)\) return true;/);
  assert.match(world, /return exteriorFoes\.pendingFeet\(\)\.some\(\(p\) => Math\.hypot\(p\[0\] - f\[0\], p\[2\] - f\[2\]\) <= HUNT_PENDING_NEAR_M\);/);
  assert.equal(HUNT_PENDING_NEAR_M, 30);
  assert.match(world, /enemiesNear: huntFoesNear\(\), resting:/);
  assert.match(world, /enemiesNear: \(\) => huntFoesNear\(\),   \/\/ HUNT-FOES/);
  assert.match(src('src/ui/huntWindow.js'), /if \(this\.done \|\| this\.phase === HUNT_PHASE\.Result\) return;/);
});

/** Fishing's kind at sea (the Ocean's climate: the net's water everywhere), `busy` the host's. */
function seaNet(busy) {
  const w = { inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 223, region: 17, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' };
  const prev = setForagingHost({ world: () => w, entity: () => null });
  const book = { state: { open: true, hauls: 0, caps: { hauls: 40, stores: 5000 } }, taken: () => false, counting: () => false, held: () => 0 };
  const host = { pixel: () => ({ x: 300, y: 200 }), ground: () => ({ climate: 223, region: 17 }), eye: () => ({ pos: [0, 1.6, 0], dir: [0, 0, 1] }), feet: () => [0, 0, 0], hour: () => 12, storm: () => false, climateAt: () => 223, trophy: () => true, day: () => 20724, rand: () => 0.5, busy };
  return { k: fishKind({ book, host }), done: () => setForagingHost(prev) };
}

test('HELM-NET: the report - at sea the net\'s water is everywhere, and the cast stood under the crosshair at the helm and over the guns\' aim; while the hands are the ship\'s there is no cast, and a deck stood on still fishes (mutants: busy never asked; busy read backwards)', () => {
  let busy = false;
  const s = seaNet(() => busy);
  try {
    const entity = { items: [{ templateIndex: 1603, currentCondition: 50 }] };
    assert.equal(s.k.looseNodesOf({ entity, dungeon: false }).length, 1, 'on a deck: a cast');
    busy = true;
    assert.deepEqual(s.k.looseNodesOf({ entity, dungeon: false }), [], 'at the helm: none');
  } finally { s.done(); }
});

test('HELM-NET by source: the world host\'s fishing kind is busy at a helm, over laid guns and in a boarding', () => {
  assert.match(src('src/scenes/world.js'), /busy: \(\) => !!csaRuntime\?\.isSailing\?\.\(\) \|\| !!naval\?\.aiming \|\| !!naval\?\.boarding,/);
  assert.match(src('src/scenes/fishHost.js'), /if \(dungeon \|\| host\.busy\?\.\(\) \|\| !foragingToolIn\(entity, FT\.FishingNet\) \|\| !inWater\(\)\) return \[\];/);
});

test('HELM-HUSH: the report - at the helm, the first stroke past the wake\'s threshold and every slowing under it crossfade the boat\'s loops, and the crossfade played the loop it fades out again: the host heard a new play and cut it back to its first sample; a loop already playing goes on (mutants: every play counted again)', () => {
  const s = scene();
  const boat = s.place();
  for (let i = 0; i < 6; i++) s.rt.endOfFrame();   // the placement's fade done
  s.helm(boat);
  const slow = boat.AudioSourceSlow.plays;
  assert.equal(boat.AudioSourceSlow.isPlaying, true);
  s.rt.state.MoveVectorCurrent = [0, 0, 1];
  s.rt.update();   // under way past the threshold: PlayFast's crossfade
  assert.equal(boat.AudioSourceFast.isPlaying, true, 'the fast loop played');
  assert.equal(boat.AudioSourceSlow.plays, slow, 'the slow one goes on where it was, not from its first sample');
  for (let i = 0; i < 12; i++) s.rt.endOfFrame();   // the crossfade done: the slow one stopped
  assert.equal(boat.AudioSourceSlow.isPlaying, false);
  const fast = boat.AudioSourceFast.plays;
  s.rt.state.MoveVectorCurrent = [0, 0, 0];
  s.rt.update();   // under the threshold: PlaySlow's crossfade
  assert.equal(boat.AudioSourceFast.plays, fast, 'slowing, the fast one goes on too');
  assert.equal(boat.AudioSourceSlow.isPlaying, true, 'and the slow one plays again from silence');
});

test('HELM-HUSH: one fade handle is every boat\'s - a boat placed stopped another\'s fade-in where it stood, at nothing, the loop left playing silent; the stopped fade lands where it was going (mutants: the stopped fade left where it stood)', () => {
  const s = scene();
  const a = s.place();
  assert.equal(a.AudioSourceSlow.volume, 0, 'the first boat\'s fade at its first step');
  const b = s.place(1, 0, [140, 34, 200]);
  assert.equal(a.AudioSourceSlow.isPlaying, true);
  assert.ok(a.AudioSourceSlow.volume > 0, `the first boat's loop heard (volume ${a.AudioSourceSlow.volume})`);
  for (let i = 0; i < 6; i++) s.rt.endOfFrame();
  assert.ok(b.AudioSourceSlow.volume > 0, 'the second fades in as ever');
});
