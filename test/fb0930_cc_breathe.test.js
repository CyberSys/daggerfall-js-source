// FIELD BUGS 2026-09-30 (CLOTHES-BREATHE) - #bug-reports, "Climates & Calories Bugs": "Whether you are appropriately
// clothed for your region, indoors, etc. your temperature gets to either "Scorching" or "Freezing" ... and seems to never
// recover".
//
// Clothing only ever added warmth: the chest, the legs, the feet and the cloaks summed and went on the body at full
// weight whatever the weather, so nothing a player wore lowered a hot reading and the lightest outfit in the desert was
// charged its every point - the starting kit's short shirt and casual pants are fifteen degrees in a desert inn at noon,
// Hot. In the heat (a natural temperature above ten) clothing counts at HALF its warmth, truncated; the cold is unchanged,
// and armour is unchanged (its metal's heat in the sun is its own rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clothingWarmth, armorWarmth, feltTemperature, temperatureWord, CLOTHES_BREATHE_ABOVE } from '../src/systems/survival/temperature.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { RACES } from '../src/systems/races.js';

const S = EQUIP_SLOTS;
/** The starting kit: a short shirt (5) and casual pants (10) - fifteen. */
const kit = () => { const w = new Array(27).fill(null); w[S.ChestClothes] = { templateIndex: 165, group: 'MensClothing' }; w[S.LegsClothes] = { templateIndex: 151, group: 'MensClothing' }; return w; };
/** A tunic (8), pants (10), boots (4) and a formal cloak drawn hood up (variant 1: 5 x 3) - thirty-seven. */
const cloaked = () => { const w = kit(); w[S.ChestClothes] = { templateIndex: 158, group: 'MensClothing' }; w[S.Feet] = { templateIndex: 148, group: 'MensClothing' }; w[S.Cloak1] = { templateIndex: 155, group: 'MensClothing', variant: 1 }; return w; };

test('CLOTHES-BREATHE: the report - the starting kit in a desert inn at noon counts seven, not fifteen: warm, not Hot; the street at noon in Rain\'s Hand is lighter by the same eight (mutants: the heat never halves; the half rounds up; the dry reading unhalved; the wet before the half)', () => {
  const inn = feltTemperature({ climateIndex: CLIMATES.Desert, month: 6, hour: 12, weather: 'sunny', insideBuilding: true }, kit(), { raceId: RACES.Redguard });
  assert.deepEqual([inn.natural, inn.clothes, inn.clothesDry, inn.felt], [30, 7, 7, 27], 'the roof\'s 30, the kit\'s half, 30 - 5 + 7 - 5');
  assert.equal(temperatureWord(inn.felt), 'warm');
  const road = feltTemperature({ climateIndex: CLIMATES.Desert, month: 3, hour: 12, weather: 'sunny' }, kit(), { raceId: RACES.Redguard });
  assert.deepEqual([road.natural, road.clothes, road.felt], [40, 7, 37], 'the Alik\'r road at noon in Rain\'s Hand: 45 before');
});

test('CLOTHES-BREATHE: the rule - above ten the clothes count half, truncated; at ten and in the cold whole; a cloak halves with the rest; the wet eats what is left and the hood shades after; armour is its own (mutants: the heat never halves; the threshold at ten; the half rounds up; the cold halves too; the wet before the half; the dry reading unhalved; armour breathes too)', () => {
  assert.equal(CLOTHES_BREATHE_ABOVE, 10);
  assert.equal(clothingWarmth(kit(), { natural: 11 }).warmth, 7, 'eleven: half of fifteen, truncated');
  assert.equal(clothingWarmth(kit(), { natural: 10 }).warmth, 15, 'ten: whole');
  assert.equal(clothingWarmth(kit(), { natural: 0 }).warmth, 15, 'comfortable: whole');
  assert.equal(clothingWarmth(kit(), { natural: -40 }).warmth, 15, 'the cold: whole');
  assert.equal(clothingWarmth(kit(), { natural: -11 }).warmth, 15, 'a mild cold: whole');
  assert.deepEqual(clothingWarmth(cloaked(), { natural: 20 }), { warmth: 18, pure: 18, hood: true }, 'the cloak halves with the rest: 37 -> 18');
  assert.equal(clothingWarmth(kit(), { natural: 20, wet: 4 }).warmth, 3, 'the half first (7), then the wet (4)');
  assert.equal(clothingWarmth(kit(), { natural: 20, wet: 4 }).pure, 7, 'the dry reading is the half');
  assert.equal(clothingWarmth(cloaked(), { natural: 40, inSunlight: true }).warmth, 8, 'the hood shades the half: 18 - 10');
  const leather = new Array(27).fill(null);
  leather[S.ChestArmor] = { group: 'Armor', templateIndex: 102, material: 0 }; leather[S.LegsArmor] = { group: 'Armor', templateIndex: 103, material: 0 };
  assert.equal(armorWarmth(leather, { natural: 40 }).warmth, armorWarmth(leather, { natural: 0 }).warmth, 'leather warms the same in the heat');
  assert.equal(armorWarmth(leather, { natural: 40 }).warmth, 5, 'its chest 3 and legs 2, whole');
});
