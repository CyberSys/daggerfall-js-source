// REPAIR-RATE and KIT-CEILING (2026-10-01, the economy arc - bible/06-Systems/Economy-Arc.md, set from its confirmed
// intent: repairs "exist to limit outings and force planning. Their function is not to remove money from the economy";
// field repair stays partial). A repair costs a third of Daggerfall's price (REPAIR-EASE had two thirds); no kit - a
// field kit or a smith's - mends a piece past three quarters of its condition, and a kit that has nothing below them
// to mend says a smith can do the rest.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateItemRepairCost, dfuItemRepairCost, REPAIR_COST_SCALE } from '../src/systems/repairService.js';
import { _resetModSettings, setModSetting } from '../src/systems/modSettings.js';
import {
  mintFieldRepairKit, mintPiece, useRepairKit, repairKitUse, repairKitTargets, kitCeiling, KIT_CEILING_TEXT, installSmithing,
} from '../src/systems/smithItems.js';
import { KIT_CEILING, pieceLines } from '../src/net/recipeLaw.js';
import { weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { readFileSync } from 'node:fs';

installSmithing();
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const at = (item, pct) => { item.currentCondition = Math.round(item.maxCondition * pct / 100); return item; };
const pct = (item) => Math.round(item.currentCondition / item.maxCondition * 100);

test('REPAIR-RATE: a repair is a third of Daggerfall\'s price - a broken Daedric longsword 9,216 at a quality-10 smith, a fifth of its asking price; DFU\'s flat tenth a third too (mutants: the scale back at two thirds)', () => {
  assert.equal(REPAIR_COST_SCALE, 1 / 3);
  _resetModSettings();
  // Roleplay & Realism: Items' damage-scaled price (on as shipped): 0.6 of the value for a broken piece, through CalculateCost
  assert.equal(dfuItemRepairCost(23040, 10, 0, 6400, { instantRepairs: false }), 27648);
  assert.equal(calculateItemRepairCost(23040, 10, 0, 6400), 9216);
  assert.equal(calculateItemRepairCost(23040, 10, 3200, 6400), 4608, 'half the damage, half the price');
  // the mod off: DFU's own flat tenth, a third of it
  setModSetting('roleplay-realism-items', 'conditionBasedPrices', false);
  try {
    assert.equal(calculateItemRepairCost(23040, 10, 6000, 6400), Math.round(dfuItemRepairCost(23040, 10, 6000, 6400, { instantRepairs: false }) / 3));
  } finally { _resetModSettings(); }
  assert.equal(calculateItemRepairCost(1, 1, 99, 100), 1, 'never under 1 - two thirds of a gold piece is one');
  assert.equal(calculateItemRepairCost(300, 10, 1000, 1000), 0, 'nothing at full condition');
});

test('KIT-CEILING: no kit mends a piece past three quarters - 60% to 75%, 70% to 75%, 50% to 65%; a piece at three quarters or more is no kit\'s, and the refusal says a smith can do the rest (mutants: the ceiling at whole; the targets unfiltered; the cap dropped; the refusal dropped)', () => {
  assert.equal(KIT_CEILING, 0.75);
  const sword = () => weaponOfMaterial(120, 4);
  for (const [from, to] of [[60, 75], [70, 75], [50, 65]]) {
    const kit = mintFieldRepairKit();
    const piece = at(sword(), from);
    useRepairKit(kit, [kit, piece]);
    assert.equal(pct(piece), to, `a field kit: ${from}% to ${to}%`);
    assert.ok(piece.currentCondition <= kitCeiling(piece));
  }
  // a smith's kit: a quarter, and the same ceiling
  const smith = mintPiece({ recipe: 'kit:dwarven', quality: -1, seed: 1 }, '0000000000000001');
  const worn = at(sword(), 60);
  useRepairKit(smith, [smith, worn]);
  assert.equal(worn.currentCondition, kitCeiling(worn), 'a smith\'s quarter stops at three quarters too');
  // at three quarters or more: no kit's
  const kit = mintFieldRepairKit();
  const keen = at(sword(), 80), edge = at(sword(), 75);
  assert.deepEqual(repairKitTargets(kit, [kit, keen, edge]), []);
  const items = [kit, keen, edge];
  assert.deepEqual(repairKitUse(kit, items), { kind: 'repairKit', text: KIT_CEILING_TEXT });
  assert.equal(KIT_CEILING_TEXT, 'A kit mends nothing past 75%. A smith can do the rest.');
  assert.ok(items.includes(kit), 'and the kit is kept');
  // whole pieces: the old refusal stands
  const whole = mintFieldRepairKit();
  assert.equal(repairKitUse(whole, [whole, at(sword(), 100)]).text, 'Nothing here wants mending.');
});

test('KIT-CEILING: what a kit says it does - the tooltip lines and the smithing page name the ceiling (mutants: a line without it)', () => {
  assert.deepEqual(pieceLines(mintFieldRepairKit()), ['Mends 15% of a weapon\'s or armour\'s condition, up to 75%, once']);
  assert.deepEqual(pieceLines({ kitMetal: 4, provenance: '0123456789abcdef' }), ['Mends a quarter of a Dwarven piece\'s condition, up to 75%, once']);
  assert.match(rd('src/ui/profPages.js'), /A Repair Kit mends a quarter of a piece\\'s condition, up to three quarters, once/);
});
