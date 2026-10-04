// FIELD BUGS 2026-10-04e - WILD-ROAD and HUNT-ROAD (bible/01-Overview/Field-Bugs-2026-10-04e.md, report 4).
//
// Discord (Private Joker, "Wilderness Encounter Chances"): "perhaps encounters can be scaled with player level or some
// other metric. having to completely halt my travel because 1 rat chose today to die can be quite the interruption.
// That as well as the random hunting y/n prompts that stop you completely. If I'm going to be stopped on the road, let
// it be for something important or dangerous. a roving orc patrol, a bandit holdup ... This shouldn't be every
// encounter of course. A level 1 leaving privateers hold can take care of the rat problems lol."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { trivialOnRoad, roadCompany, wandererCount, TRIVIAL_LEVEL_RATIO, ROAD_PARTY_MAX, CLASS_FOE_MIN } from '../src/systems/roadEncounters.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { SOLITARY_TYPES } from '../src/characters/mobileFactions.js';
import { amGroupRollOwner } from '../src/systems/campEncounters.js';
import { partyExtraFoes } from '../src/systems/partyScale.js';
import { createHunting } from '../src/scenes/hunting.js';
import { FEATURES } from '../src/systems/features.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };

test('WILD-ROAD law: a monster a third of the traveller\'s level or less is passed by on the road - a rat from level 3, an orc from 15; a class foe and a solitary terror never (mutants: the ratio loosened; class foes trivial; the solitary let through)', () => {
  assert.equal(TRIVIAL_LEVEL_RATIO, 3);
  assert.equal(trivialOnRoad(M.Rat, 2), false, 'a level 2 is stopped by a rat - "a level 1 ... can take care of the rat problems"');
  assert.equal(trivialOnRoad(M.Rat, 3), true);
  assert.equal(trivialOnRoad(M.Orc, 14), false);
  assert.equal(trivialOnRoad(M.Orc, 15), true);
  assert.equal(trivialOnRoad(CLASS_FOE_MIN + 2, 40), false, 'a class foe is built at the traveller\'s level');
  const imp = M.Imp;
  assert.ok(SOLITARY_TYPES.has(imp));
  assert.equal(trivialOnRoad(imp, 40), false, 'a solitary kind is never passed by');
  assert.equal(trivialOnRoad(-1, 40), false);
  assert.equal(trivialOnRoad(M.Rat, NaN), false);
});

test('WILD-ROAD law: company on the road - none below level 5 or for a solitary kind; a chance of level/50 (two in five at most) of one more, one more each six levels past five; never past four with the party\'s own (mutants: the chance inverted; the size unbounded; the party cap gone)', () => {
  assert.equal(roadCompany(M.Orc, 4, 0), 0, 'below level 5');
  assert.equal(roadCompany(M.Orc, 10, 0.19), 1, 'level 10: one in five, one more');
  assert.equal(roadCompany(M.Orc, 10, 0.2), 0, 'the roll past the chance');
  assert.equal(roadCompany(M.Orc, 17, 0.1), 3, 'level 17: three more');
  assert.equal(roadCompany(M.Orc, 40, 0.39), 3, 'never past three');
  assert.equal(roadCompany(M.Orc, 40, 0.4), 0, 'two in five at most');
  assert.equal(roadCompany(M.Imp, 40, 0), 0, 'a solitary kind comes alone');
  assert.equal(wandererCount(M.Orc, 0, 0), 1);
  assert.equal(wandererCount(M.Orc, 3, 3), ROAD_PARTY_MAX, 'the party\'s extras and the road\'s company together, at most four');
  assert.equal(wandererCount(M.Orc, 3, 0), 1 + 3, 'PSCALE1 unchanged off the road');
  assert.equal(wandererCount(M.Imp, 3, 3), 1);
});

/** auditpscale1's mount of runEncounterTick's head (test/auditpscale1.test.js `stands`), with the road's words. */
function stands(over = {}) {
  const W = read('src/scenes/world.js');
  const a = W.indexOf('let _updatedGuards = false;'), b = W.indexOf('// CAMP1 - GROUP ENCOUNTERS', a);
  assert.ok(a > 0 && b > a, 'the tick\'s head is found');
  const out = [];
  mount(strip(W.slice(a, b)), {
    modes: { mode: 'exterior' }, span: 1, amGroupRollOwner, online: null, player: { feetAt: () => [0, 0, 0], isPlayerSwimming: false },
    partyNear: () => [], walkMode: true, playerSpawned: true, intermittentEnemySpawn: () => ({ mobileType: over.mobileType ?? M.Rat }), _lastEncMinutes: 0,
    playerEntity: { isResting: false, level: over.level ?? 10 }, _musicInLocationRect: () => false, maps: { getClimateIndex: () => 0 }, playerTravelPixel: () => ({ x: 0, y: 0 }),
    SOLITARY_TYPES, partyExtraFoes, partySize: () => 1, effectiveLevel: (e) => e?.level ?? 1,
    _standEncounterFoe: (hit) => out.push(hit.mobileType), playerFeet: [0, 0, 0],
    revenantToReturn: () => null, now: 0, sharedClockOn: () => false, worldMinutes: () => 0, spawns: true,
    getPref: (k) => (k === 'roadEncounters' ? over.pref : undefined), onTheRoad: () => !!over.road, trivialOnRoad, roadCompany, wandererCount,
    Math: Object.create(Math, { random: { value: () => over.roll ?? 0.99 } }),
    ...over.scope,
  }, '}');
  return out;
}

test('WILD-ROAD mounted: on the road a level 10 rides past a rat and stands an orc patrol now and then; off the road, or with the switch off, DFU\'s wanderer as it was (mutants: the road never asked; the switch ignored; no company stood)', () => {
  assert.deepEqual(stands({ road: true }), [], 'on the road: the rat passed by');
  assert.deepEqual(stands({ road: false }), [M.Rat], 'off the road: the rat stands');
  assert.deepEqual(stands({ road: true, pref: false }), [M.Rat], 'the switch off: DFU\'s wanderer');
  assert.deepEqual(stands({ road: true, level: 2 }), [M.Rat], 'a level 2 meets its rat');
  assert.deepEqual(stands({ road: true, mobileType: M.Orc }), [M.Orc], 'an orc, alone most rolls');
  assert.deepEqual(stands({ road: true, mobileType: M.Orc, roll: 0 }), [M.Orc, M.Orc], 'and now and then a patrol');
  assert.deepEqual(stands({ road: false, mobileType: M.Orc, roll: 0 }), [M.Orc], 'never off the road');
  const W = read('src/scenes/world.js');
  assert.match(W, /const onTheRoad = \(\) => !!travelOptions\?\.isTravelActive \|\| !!travelView\?\.active;/, 'the road: a journey, or the Overworld up');
});

test('HUNT-ROAD: the player\'s switch holds the hunt\'s roll on the road - on by default (TO-FIELD3, Mac\'s: the wilderness rolls at the traveller); held, the minute passes unrolled and is never banked (mutants: the hold ignored; the hold banks the minute)', async () => {
  const row = FEATURES.find((f) => f.id === 'hunt-on-road');
  assert.equal(row?.control.key, 'huntOnRoad');
  assert.equal(row.control.initial, true, 'Mac\'s law by default');
  const road = FEATURES.find((f) => f.id === 'road-encounters');
  assert.equal(road?.control.key, 'roadEncounters');
  assert.equal(road.control.initial, true);
  const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
  const { newSurvival } = await import('../src/systems/survival/needs.js');
  _resetForTests(); setPref('survival', 'hard');
  try {
    let held = true, minute = 600, rolled = 0;
    const WILD = { luck: 50, winter: false, outdoors: true, inLocationRect: false, night: false, enemiesNear: false, resting: false, climateIndex: 232 };
    const entity = { isPlayer: true, level: 5, health: 30, maxHealth: 40, fatigue: 20 * 64, items: [], survival: newSurvival(0), stats: { luck: 50 }, career: {} };
    const h = createHunting({ entity, env: () => ({ ...WILD, minute }), held: () => held, rolls: () => { rolled++; return 0.99; }, showOverlay: () => {} });
    h.tick();
    assert.equal(rolled, 0, 'held: no roll');
    held = false;
    h.tick();
    assert.equal(rolled, 0, 'the same minute, never rolled again once it passed held');
    minute++;
    h.tick();
    assert.ok(rolled > 0, 'the next minute off the road rolls');
  } finally { _resetForTests(); }
  const W = read('src/scenes/world.js');
  assert.match(W, /held: \(\) => getPref\('huntOnRoad'\) === false && onTheRoad\(\),/);
  assert.match(W, /if \(_mode\(\) === 'exterior'\) hunting\.tick\(\);/, 'the roll is still the overworld host\'s mode (TO-FIELD3\'s pin)');
  assert.match(read('src/scenes/hunting.js'), /_lastMinute = minute;\n\s*if \(_win \|\| overlayActive\(\)\) return null;\n\s*if \(held\(\)\) return null;/);
});
