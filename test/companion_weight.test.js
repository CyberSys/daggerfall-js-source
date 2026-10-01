// COMPANION-WEIGHT (2026-10-01, the field: "make the crew companions have a balanced inventory weight"). A crew
// companion's pack carried anything (COMPANION-KIT: "no weight cap"); it carries what a person of his strength can
// now - Daggerfall's own MaxEncumbrance over his body's live strength, an average person's when there is none to read.
// Storing into it takes what fits and refuses the rest in his name, gold clamped the way the wagon clamps it; a pack
// filled past the limit before it keeps what it holds and takes nothing more; taking out is never gated by it.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { packCapacityKg, PACK_DEFAULT_STRENGTH } from '../src/systems/naval/crewCompanions.js';
import { storeCapacityOf } from '../src/systems/inventorySession.js';
import { planStore, planDropGold, packFullText, packFullGoldText } from '../src/systems/itemTransfer.js';
import { remoteModel } from '../src/ui/enhancedInventory.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const body = (strength) => ({ stats: { strength }, activeEffects: [] });
/** A piece of `kg` each (an instance weight, DFU's own field), `n` in the stack. */
const piece = (kg, n = 1) => ({ group: 'Weapons', templateIndex: 120, material: 1, weightInKg: kg, stackCount: n });
const HILDA = Object.freeze({ kg: 90, name: 'Hilda' });

test('COMPANION-WEIGHT: his pack carries DFU\'s MaxEncumbrance of his body - 1.5 kg a point of live strength, 90 at 60, 120 at 80 - and an average person\'s 75 with no strength to read (mutants: the law unread; the default lost)', () => {
  assert.equal(PACK_DEFAULT_STRENGTH, 50);
  assert.equal(packCapacityKg(body(60)), 90);
  assert.equal(packCapacityKg(body(80)), 120);
  assert.equal(packCapacityKg(null), 75, 'no body');
  assert.equal(packCapacityKg({ stats: {} }), 75, 'his class not loaded yet');
});

test('COMPANION-WEIGHT: the storage\'s own limit is asked only when the remote list IS that storage - never the wagon, a choose-one list, the ground or a storage without one', () => {
  const loot = { storage: true, capacity: () => HILDA };
  assert.deepEqual(storeCapacityOf({ loot }, {}), HILDA);
  assert.equal(storeCapacityOf({ loot }, { usingWagon: true }), null);
  assert.equal(storeCapacityOf({ loot }, { chooseOne: [] }), null);
  assert.equal(storeCapacityOf({}, {}), null, 'the ground');
  assert.equal(storeCapacityOf({ loot: { storage: true } }, {}), null, 'a chest');
});

test('COMPANION-WEIGHT: storing takes what fits - a stack split to the headroom, a full pack refused in his name, a pack already over the limit refused anything more; a storage without a limit takes it all (mutants: the gate dropped; the split lost; the refusal unnamed)', () => {
  const remote = [piece(80)];   // 80 of his 90
  const split = planStore(piece(2, 10), { remote, capacity: HILDA });
  assert.deepEqual([split.ok, split.amount], [true, 5], 'five of ten 2 kg pieces fit in 10 kg');
  const full = planStore(piece(11), { remote, capacity: HILDA });
  assert.equal(full.ok, false);
  assert.deepEqual(full.refusal, { reason: 'packFull', text: 'Hilda cannot carry any more.' });
  assert.equal(packFullText(null), 'Your companion cannot carry any more.');
  const over = planStore(piece(0.5), { remote: [piece(120)], capacity: HILDA });
  assert.equal(over.ok, false, 'filled past the limit before it: nothing more');
  const free = planStore(piece(500), { remote: [piece(500)] });
  assert.deepEqual([free.ok, free.amount], [true, 1], 'no limit, no gate');
});

test('COMPANION-WEIGHT: gold is clamped to what he can carry and said in his name; a full pack takes none (mutants: the gold gate dropped)', () => {
  const remote = [piece(89.99)];   // 0.01 kg left: four gold pieces of 0.0025
  const some = planDropGold('100', { carried: 500, remote, capacity: HILDA });
  assert.deepEqual([some.ok, some.amount, some.notice], [true, 4, packFullGoldText('Hilda', 4)]);
  assert.equal(packFullGoldText('Hilda', 4), 'Hilda could only carry 4 gold pieces.');
  const none = planDropGold('100', { carried: 500, remote: [piece(90)], capacity: HILDA });
  assert.equal(none.ok, false);
  assert.equal(none.refusal.reason, 'packFull');
  assert.deepEqual(planDropGold('100', { carried: 500, remote: [piece(90)] }), { ok: true, amount: 100, notice: null }, 'no limit, no clamp');
});

test('COMPANION-WEIGHT: the window shows his load against it, and every store and gold door of both windows hands it in; the host reads his body (mutants: a door without it)', () => {
  const loot = { storage: true, items: () => [piece(30)], capacity: () => HILDA };
  const m = remoteModel({ loot }, {});
  assert.deepEqual([m.kind, m.capacity, m.weight], ['storage', 90, 30]);
  assert.equal(remoteModel({ loot: { storage: true, items: () => [] } }, {}).capacity, null, 'a chest has none');
  const e = rd('src/ui/enhancedInventory.js'), n = rd('src/ui/nativeInventory.js'), w = rd('src/scenes/world.js');
  assert.equal((e.match(/capacity: storeCapacityOf\(deps, session\)/g) ?? []).length, 5, 'the enhanced window: canStow, the label, the split, the store, the gold');
  assert.equal((n.match(/capacity: storeCapacityOf\(this\.hooks, \{ usingWagon: this\.usingWagon, chooseOne: this\.chooseOne \}\)/g) ?? []).length, 2, 'the classic window: the store and the gold');
  assert.match(w, /const capacity = \(\) => \(\{ kg: packCapacityKg\(rec\?\.entity \?\? null\), name: naval\?\.companionPack\?\.\(key\)\?\.name \?\? null \}\);/);
});
