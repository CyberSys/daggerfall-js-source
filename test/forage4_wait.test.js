// FORAGE4 (2026-09-28, Mac: "Continue! Remember, this is your baby"):
// FORAGING'S ONLINE WAIT - bible/06-Systems/Foraging.md 13.1. Online the
// shared clock is nobody's to move, so Quest Actions Extension's `raise
// time by` is a wait on the hunt's busy page (THE ONE CONSTRUCTION SEAM:
// its four new options, the hunt keeping its defaults), at C&C's 8 real
// seconds a game hour; the page opens when the slot is free, holds the
// quest's boxes behind it, ends early for a foe near with the rest
// forgiven, and rides the save.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { HuntWindow, HUNT_PHASE } from '../src/ui/huntWindow.js';
import { createForagingWait, waitLine, saneWait, FORAGING_WAIT_MAX_SECONDS } from '../src/scenes/foragingWait.js';
import { HUNT_WAIT_PER_HOUR } from '../src/systems/survival/hunting.js';
import { RaiseTime, questActionsExtensionTemplates } from '../src/systems/quest/questActionsExtension.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QUEST_CTX_CONTRACT } from '../src/scenes/questBridge.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A slot as the host keeps one: showOverlay replaces and disposes the outgoing window, as townTalk's does. */
function slot() {
  const s = { win: null, busy: false };
  s.show = (w) => { const out = s.win; s.win = w; if (out && out !== w) out.dispose?.(); };
  return s;
}
/** A wait over a player, online, with a foe switch and a slot. */
function rig({ online = true } = {}) {
  const entity = { foragingWait: null };
  const s = slot();
  const foe = { near: false };
  const wait = createForagingWait({ entity, showOverlay: s.show, overlayActive: () => s.busy, enemiesNear: () => foe.near, online: () => online });
  return { entity, s, foe, wait };
}
const run = (win, seconds, step = 0.5) => { for (let t = 0; t < seconds; t += step) win.tick(step); };

test('FORAGE4: the hunt page keeps its defaults - the ask first, Escape walks away, a result page', () => {
  const closed = [];
  const w = new HuntWindow({ prompt: ['Tracks.'], seconds: 2, onSearched: () => ['Meat.'], onClosed: (s) => closed.push(s) });
  assert.equal(w.phase, HUNT_PHASE.Ask);
  w._begin();
  w.input('Escape');
  assert.deepEqual(closed, [false], 'Escape off the busy page walks away, as before');
  const r = new HuntWindow({ seconds: 1, onSearched: () => ['Meat.'], onClosed: (s) => closed.push(s) });
  r._begin();
  run(r, 1.5);
  assert.equal(r.phase, HUNT_PHASE.Result, 'and the wait turns to its result page');
});

test('FORAGE4: the four options - no ask, no Escape, a foe ends it unsearched, and no result page', () => {
  const closed = [];
  let searched = 0;
  const w = new HuntWindow({ seconds: 3, ask: false, escape: false, result: false, onSearched: () => { searched++; return []; }, onClosed: (s) => closed.push(s) });
  assert.equal(w.phase, HUNT_PHASE.Busy, 'ask: false opens on the busy page');
  w.input('Escape');
  assert.equal(w.done, false, 'escape: false - the wait is the cost');
  w.tick(1);
  assert.equal(w.remaining, 2);
  w.extend(2);
  assert.equal(w.remaining, 4, 'a second wait joins the one standing');
  w.tick(4);
  assert.deepEqual([w.done, searched, closed], [true, 1, [true]], 'result: false - the end closes the page, no result to click');
  let foe = false;
  const f = new HuntWindow({ seconds: 10, ask: false, escape: false, result: false, interruptWhen: () => foe, onClosed: (s) => closed.push(s) });
  f.tick(1);
  foe = true;
  f.tick(1);
  assert.equal(f.done, true);
  assert.deepEqual(closed, [true, false], 'a foe near ends it unsearched');
});

test('FORAGE4: a wait is its game time at 8 real seconds an hour - Food 8 s, Chop and Plants 12 s, Mining and Graves 16 s', () => {
  assert.equal(HUNT_WAIT_PER_HOUR, 8);
  for (const [gameSeconds, real] of [[3600, 8], [5400, 12], [7200, 16]]) {
    const { wait, entity } = rig();
    assert.equal(wait.add(gameSeconds, 'Chop and Gather Wood'), real);
    assert.deepEqual(entity.foragingWait, { seconds: real, label: 'Chop and Gather Wood', held: [] });
  }
  assert.equal(waitLine('Chop and Gather Wood'), 'Chop and Gather Wood...', 'the page says the quest\'s own DisplayName');
  assert.equal(waitLine(null), 'Time passes...');
});

test('FORAGE4: the page opens only when the slot is free, writes its seconds left for the save, and clears at its end', () => {
  const { wait, entity, s } = rig();
  s.busy = true;   // the tool's result box, the pack
  wait.add(5400, 'Chop and Gather Wood');
  assert.equal(wait.tick(), null, 'the box and the pack close first');
  assert.equal(s.win, null);
  s.busy = false;
  const page = wait.tick();
  assert.equal(s.win, page);
  assert.equal(page.busy, 'Chop and Gather Wood...');
  assert.equal(page.phase, HUNT_PHASE.Busy);
  page.tick(5);
  wait.tick();
  assert.equal(entity.foragingWait.seconds, 7, 'what is left, for a save made now');
  wait.add(3600);
  assert.equal(page.remaining, 15, 'a second raise joins the page');
  page.tick(15);
  assert.equal(page.done, true);
  assert.equal(entity.foragingWait, null);
  assert.equal(wait.tick(), null, 'nothing left, nothing opens');
});

test('FORAGE4: a foe near, or a window taking the slot, ends the wait with the rest forgiven', () => {
  const a = rig();
  a.wait.add(7200, 'Mine for Gems or Elements');
  const page = a.wait.tick();
  page.tick(2);
  a.foe.near = true;
  page.tick(0.1);
  assert.equal(page.done, true);
  assert.equal(a.entity.foragingWait, null, 'forgiven, not owed');
  const b = rig();
  b.wait.add(7200);
  b.wait.tick();
  b.s.show({ dispose() {} });   // a death screen, a transition
  assert.equal(b.wait.window, null);
  assert.equal(b.entity.foragingWait, null);
});

test('FORAGE4: the quest\'s boxes wait behind the page - held while it is pending or open, shown in order when it ends', () => {
  const { wait, s } = rig();
  const shown = [];
  assert.equal(wait.holds(), false);
  s.busy = true;
  wait.add(3600, 'Forage for some Food');
  assert.equal(wait.holds(), true, 'pending behind the pack is holding too - a bonus\'s line comes after the work');
  wait.hold(() => shown.push('bonus'));
  wait.hold(() => shown.push('second'));
  s.busy = false;
  const page = wait.tick();
  assert.deepEqual(shown, []);
  page.tick(8);
  assert.deepEqual(shown, [], 'the finished page leaves the slot first (AUDIT 28 H6)');
  wait.tick();
  assert.deepEqual(shown, ['bonus', 'second']);
  assert.equal(wait.holds(), false);
});

test('FORAGE4: a reload reopens the page with its seconds; offline a saved wait is forgiven; a save-edited one is cut to the max', () => {
  const { wait, entity, s } = rig();
  entity.foragingWait = { seconds: 9.5, label: 'Forage for Plants' };   // as ENTITY_FIELDS restores it
  const page = wait.tick();
  assert.equal(s.win, page);
  assert.equal(page.remaining, 9.5);
  assert.equal(page.busy, 'Forage for Plants...');
  const off = rig({ online: false });
  off.entity.foragingWait = { seconds: 12, label: 'x' };
  assert.equal(off.wait.tick(), null);
  assert.equal(off.entity.foragingWait, null, 'the offline lane has no waits');
  assert.equal(FORAGING_WAIT_MAX_SECONDS, 64, 'eight game hours: the build\'s Mining quadruple, more than the patched pack raises');
  assert.deepEqual(saneWait({ seconds: 86400, label: 'a'.repeat(100) }), { seconds: 64, label: 'a'.repeat(60), held: [] });
  assert.equal(saneWait({ seconds: -1 }), null);
  assert.equal(saneWait({ seconds: NaN }), null);
  assert.equal(saneWait('12'), null);
  const edited = rig();
  edited.entity.foragingWait = { seconds: 1e9, label: 7 };
  assert.equal(edited.wait.tick().remaining, 64);
  assert.equal(edited.wait.add(3600 * 100), 800);
  assert.equal(edited.entity.foragingWait.seconds, 864, 'a SAVED wait is cut; a wait joined in play is the sum (AUDIT 28 F1)');
});

test('FORAGE4: QAE\'s raise time is the host\'s wait online and the clock offline', () => {
  const calls = [];
  const quest = (online) => ({
    displayName: 'Chop and Gather Wood',
    hooks: { sharedClock: () => online, raiseTime: (s) => calls.push(['clock', s]), waitOnline: (s, q) => calls.push(['wait', s, q.displayName]), nowSeconds: () => 0 },
    showMessagePopup() {},
  });
  const t = new RaiseTime(null);
  t.createNew('raise time by 1:30', quest(true)).update(null);
  t.createNew('raise time by 1:30', quest(false)).update(null);
  assert.deepEqual(calls, [['wait', 5400, 'Chop and Gather Wood'], ['clock', 5400]]);
  assert.ok(QUEST_CTX_CONTRACT.includes('waitOnline'), 'the bridge\'s contract names the door');
});

test('FORAGE4 done-when: online, the Wood-Axe\'s quest gives a 12-second wait and 20% fatigue, and the shared clock does not move', () => {
  const T = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
  loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
  const entity = {
    stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45, willpower: 50, personality: 50, speed: 50 },
    items: [], wagonItems: [], fatigue: 105 * FATIGUE_MULTIPLIER, health: 50, maxHealth: 100, magicka: 10, maxMagicka: 50,
    level: 5, gender: 'male', name: 'Tester', foragingWait: null,
  };
  const s = slot();
  const wait = createForagingWait({ entity, showOverlay: s.show, overlayActive: () => false, online: () => true });
  const clock = [];
  const m = new QuestMachine({
    nowSeconds: () => 1000000, sharedClock: () => true, playerEntity: entity,
    raiseTime: (sec) => clock.push(sec), waitOnline: (sec, q) => wait.add(sec, q?.displayName ?? null),
    getQuestSourceLines: () => null, giveItemToPlayer: () => {}, addGold: () => {}, addHUDText: () => {}, showPopup: () => {},
    releaseQuestItem: () => {}, makeHeldQuestItemsPermanent: () => {}, getGuild: () => null, regionPriceAdjustment: () => 0,
  });
  for (const a of questActionsExtensionTemplates()) m.registerAction(a);
  const src = rd('vendor/foraging/Quests/ChopWoodQuest.txt').split(/\r?\n/);
  const ow = console.warn, ol = console.log; console.warn = () => {}; console.log = () => {};
  try {
    m.scheduleQuest(src, 0, { rolls: () => 0.99 });
    for (let i = 0; i < 6; i++) m.tick();
  } finally { console.warn = ow; console.log = ol; }
  assert.deepEqual(clock, [], 'the shared clock never asked to move');
  assert.deepEqual(entity.foragingWait, { seconds: 12, label: 'Chop and Gather Wood', held: [] });
  assert.equal(entity.fatigue, 105 * FATIGUE_MULTIPLIER * 0.8, '20% of the maximum, as offline');
  const page = wait.tick();
  assert.equal(page.remaining, 12);
});

test('FORAGE4: the wiring - the streaming host builds the wait on its own slot and rest test, ticks it, holds its boxes, and the save carries it', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const foragingWait = createForagingWait\(\{\n\s*entity: playerEntity,\n\s*showOverlay: \(w\) => townTalk\.showOverlay\(w\),\n\s*overlayActive: \(\) => townTalk\.overlayActive \|\| !!modes\?\.overlayHeld,\n\s*enemiesNear: \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\), \{ resting: true \}\),\n\s*online: \(\) => sharedClockOn\(\),/);
  assert.match(w, /hunting\.tick\(\);[^\n]*\n\s*foragingWait\.tick\(\);/, 'every frame, in every mode');
  assert.match(w, /waitOnline: \(seconds, quest\) => \{ foragingWait\.add\(seconds, quest\?\.displayName \?\? null\); \},/);
  assert.match(w, /const showQuestBox = \(box\) => \{\n[^\n]*\n\s*if \(foragingWait\.holds\(\)\) \{ foragingWait\.hold\(\(\) => showQuestBox\(box\), keptBox\(box\)\); return; \}/);
  assert.match(w, /if \(foragingWait\.holds\(\)\) foragingWait\.hold\(\(\) => giveReward\(dfItem\), \{ reward: dfItem \}\);/, 'a reward\'s pile after its box, behind the wait - and kept in the save');
  assert.match(rd('src/systems/save.js'), /'restSimMinutes',[^\n]*\n\s*'foragingWait',/);
  assert.match(rd('src/systems/quest/questActionsExtension.js'), /if \(hooks\?\.sharedClock\?\.\(\)\) hooks\?\.waitOnline\?\.\(seconds, this\.parentQuest\);\n\s*else hooks\?\.raiseTime\?\.\(seconds\);/);
});
