// FIELD BUGS 2026-09-30 (MENU-CLIMATE) - found under the #bug-reports "Climates & Calories Bugs" thread (the Sentinel
// inn of its third item): the tavern's regional menu is keyed by the climate, and MENU_KEY_BY_CLIMATE was written as the
// numbers 224 to 233 while the port's climate indices run 223 (Ocean) to 232 (Haunted Woodlands). Every climate read the
// menu meant for the one before it: the Desert - Sentinel's - served the bay's bananas, the Mountain served the desert's
// camel milk, the Rainforest the north-east's carrot cake, the Ocean nobody's (the default), and a 233 nothing stands on.
// The table is keyed by the CLIMATES enum's own names now, each to the menu its number was written for.
//
// The mod's six keys (Climates-Calories.md, "The tavern (SURV5)"): n the north, ne the north-east, se the south-east, s
// the south, b the bay's warm coasts, o unused. The port keys the dishes by climate: the two deserts eat the south's
// antelope and drink its camel milk and coffee, the mountains and their woods the north-east's Bruma rabbit and mead, the
// swamp the south-east's Dunmeri horse, the rainforest, the subtropics and the beach the bay's bananas, the woodlands and
// the haunted woods the north's Breton sausage.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MENU_KEY_BY_CLIMATE, menuKeyFor, tavernMenu, FOOD_MENUS, drinkMenuFor } from '../src/systems/survival/tavernMenu.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

/** Every climate the port reads, by its enum name, to the menu it serves. */
const SERVES = Object.freeze({
  Ocean: 'b', Desert: 's', Desert2: 's', Mountain: 'ne', Rainforest: 'b', Swamp: 'se', Subtropical: 'b',
  MountainWoods: 'ne', Woodlands: 'n', HauntedWoodlands: 'n',
});

test('MENU-CLIMATE: every climate by its enum name serves its own menu - the deserts the south\'s, the mountains the north-east\'s, the swamp the south-east\'s, the warm coasts the bay\'s, the woods the north\'s (mutants: the numbers back one up; the desert eats bananas; the mountain drinks camel milk; the ocean falls to the default; the swamp eats bananas; the woodlands eat Bruma rabbit; the mountain woods eat bananas; the rainforest eats carrot cake; the subtropics eat Dunmeri horse; the haunted woods eat Bruma rabbit; the Dak\'fron eats bananas)', () => {
  assert.deepEqual(Object.keys(SERVES).sort(), Object.keys(CLIMATES).sort(), 'the pin names every climate the enum has');
  for (const [name, key] of Object.entries(SERVES)) assert.equal(menuKeyFor(CLIMATES[name]), key, `${name} (${CLIMATES[name]}) serves '${key}'`);
  assert.deepEqual(Object.keys(MENU_KEY_BY_CLIMATE).map(Number).sort((a, b) => a - b), Object.values(CLIMATES).sort((a, b) => a - b), 'keyed on the enum\'s own indices - no 233, no Ocean missing');
});

test('MENU-CLIMATE: the report\'s own inn - a Sentinel (Desert) tavern at noon serves Hammerfell\'s antelope and camel milk, not the bay\'s bananas; a mountain inn serves Bruma rabbit and mead, not the desert\'s (mutants: the numbers back one up; the desert eats bananas; the mountain drinks camel milk; the rainforest eats carrot cake)', () => {
  const desert = tavernMenu({ climateIndex: CLIMATES.Desert, quality: 3, hour: 12 });
  assert.equal(desert.key, 's');
  assert.deepEqual(desert.rows.filter((r) => r.kind === 'food').map((r) => r.name), FOOD_MENUS.s.low.map((d) => d.name));
  assert.ok(desert.rows.some((r) => r.name === 'Camel Milk'), 'camel milk');
  assert.ok(!desert.rows.some((r) => /Banana/.test(r.name ?? '')), 'no banana in the Alik\'r');
  const mountain = tavernMenu({ climateIndex: CLIMATES.Mountain, quality: 10, hour: 12 });
  assert.equal(mountain.key, 'ne');
  assert.ok(mountain.rows.some((r) => r.name === 'Bruma Jugged Rabbit') && mountain.rows.some((r) => r.name === 'Mead'), 'Bruma rabbit and mead');
  assert.equal(mountain.rows.some((r) => r.name === 'Camel Milk' || r.name === 'Coffee'), false, 'no camel milk on the mountain');
  assert.equal(drinkMenuFor(menuKeyFor(CLIMATES.Rainforest)), drinkMenuFor('s'), 'the bay drinks the south\'s, as ever');
});
