// POTION-COMMON (2026-10-01, the field: "make health potions more common"; the economy arc - bible/06-Systems/
// Economy-Arc.md: "Potions are the solo answer to healing, so they are easy to come by"). A Potion of Healing was a
// twentieth of DFU's random potion - 0.15% of looting foes, 0.2% of J-O piles - and no ordinary shop sold one. Beside
// that random potion (kept): a looting foe carries one 6 times in 100, a J-O pile holds one 12 times in 100, and an
// alchemist's and a general store's shelf stock a few a day, counted by the shop's quality and drawn from no roll.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  HEALING_RECIPE_KEY, HEALING_ENEMY_CHANCE, HEALING_PILE_CHANCE, mintHealingPotion, healingShelfCount, installHealingSupply,
} from '../src/systems/healingSupply.js';
import { CLASSIC_RECIPE_KEYS, POTION_TEMPLATE_INDEX, addEnemyLootExtras, addPileLootExtras } from '../src/systems/loot.js';
import { potionRecipeByKey } from '../src/systems/potions.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

installHealingSupply();
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const healing = (items) => items.filter((it) => it.group === 'UselessItems1' && it.potionRecipeKey === HEALING_RECIPE_KEY)
  .reduce((n, it) => n + (it.stackCount ?? 1), 0);
const at = (v) => () => v;

test('POTION-COMMON: the potion is DFU\'s own Potion of Healing - the "healing" recipe, classicRecipeKeys[2], a bottle worth its recipe\'s 50 (mutants: another recipe\'s key)', () => {
  assert.equal(HEALING_RECIPE_KEY, CLASSIC_RECIPE_KEYS[2]);
  assert.equal(potionRecipeByKey(HEALING_RECIPE_KEY)?.name, 'healing');
  const p = mintHealingPotion();
  assert.deepEqual([p.group, p.templateIndex, p.potionRecipeKey, p.value], ['UselessItems1', POTION_TEMPLATE_INDEX, HEALING_RECIPE_KEY, 50]);
});

test('POTION-COMMON: an alchemist stocks 2 + a fifth of its quality a day, a general store 1 + a tenth, any other shop none - at the shelf\'s end, from no roll (mutants: either shop\'s stock dropped; the shelf\'s loop dropped)', () => {
  assert.deepEqual([1, 10, 20].map((q) => healingShelfCount(BUILDING_TYPES.Alchemist, q)), [2, 4, 6]);
  assert.deepEqual([1, 10, 20].map((q) => healingShelfCount(BUILDING_TYPES.GeneralStore, q)), [1, 2, 3]);
  assert.equal(healingShelfCount(BUILDING_TYPES.Bank, 20), 0);
  const alch = stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 10 }, { level: 5 }, { rolls: at(0.999), torchesFromItems: false });
  assert.equal(healing(alch), 4);
  assert.equal(alch.at(-1).potionRecipeKey, HEALING_RECIPE_KEY, 'the last row');
  const gen = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 20 }, { level: 5 }, { rolls: at(0.999), torchesFromItems: false });
  assert.equal(healing(gen), 3);
  assert.match(rd('src/systems/shopStock.js'), /for \(let n = healingShelfCount\(buildingType, quality\); n > 0; n--\) add\(mintHealingPotion\(\)\);\n {2}return items;\n\}/, 'after every draw of the shelf, before it is handed back');
});

test('POTION-COMMON: a J-O pile holds one 12 times in 100 and no other pile ever; a looting foe carries one 6 times in 100 and a foe with no loot table never (mutants: either chance at 0; every pile)', () => {
  assert.equal(HEALING_PILE_CHANCE, 12);
  assert.equal(HEALING_ENEMY_CHANCE, 6);
  for (const key of ['J', 'O']) {
    assert.equal(healing(addPileLootExtras([], key, at(0.11), { online: false })), 1, `${key}: 11 under 12`);
    assert.equal(healing(addPileLootExtras([], key, at(0.13), { online: false })), 0, `${key}: 13 is not`);
  }
  assert.equal(healing(addPileLootExtras([], 'A', at(0), { online: false })), 0, 'A: never');
  assert.equal(healing(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.05))), 1, '5 under 6');
  assert.equal(healing(addEnemyLootExtras([], { lootTableKey: 'B', mapChance: 0 }, at(0.07))), 0, '7 is not');
  assert.equal(healing(addEnemyLootExtras([], { lootTableKey: '-', mapChance: 0 }, at(0))), 0, 'no loot table, no potion');
});

test('POTION-COMMON: every host installs it, after the smithing install so a field kit\'s roll still comes first (mutants: the install dropped)', () => {
  assert.match(rd('src/scenes/shared.js'), /installSmithing\(\);[^\n]*\n {2}installHealingSupply\(\);/);
});
