// WEAR-VANILLA (2026-10-01, the repair triage: "Disable the modded feature that increases durability loss. Vanilla
// values work fine. Weapon degradation done improperly is extremely agitating if done wrong"). The default game wore
// gear through Physical Combat And Armor Overhaul's wear module (~2.8x DFU on a weapon per landed hit, ~15x on armour,
// and armour worn by a monster's claws, which DFU never wears) or Roleplay Realism's equipDamage (armour x5), with
// BALANCE1's 0.6 on top; and the overhaul's fading module DESTROYED a player's broken enchanted piece. The port ships
// the three switches off (the mods ship them on) and the wear scale at 1, so a blow wears what DFU's DamageEquipment
// says, and a value saved under the old default is let go once. Offline a player may turn them back on; online the
// room reads the port's defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, _resetModSettings, SWITCH_RESETS } from '../src/systems/modSettings.js';
import { onlineForcedModSetting } from '../src/systems/onlineLane.js';
import { pcaaoModules, installPcaao } from '../src/combat/pcaao.js';
import { installRoleplayRealism } from '../src/systems/rrInstall.js';
import { damageEquipment, calculateAttackDamage, registerFormulaOverride, formulaOverride } from '../src/combat/formulas.js';
import { CONDITION_WEAR_SCALE, equipTableOf, EQUIP_SLOTS, slotForBodyPart } from '../src/systems/equip.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { BODY_PARTS } from '../src/systems/armorMaterials.js';

const WEAR_KEYS = [['pcaao', 'equipmentDamageEnhanced'], ['pcaao', 'fadingEnchantedItems'], ['roleplay-realism', 'equipDamage']];
const dfuWear = (damage) => Math.trunc((10 * damage + 50) / 100);   // FormulaHelper.ApplyConditionDamageThroughPhysicalHit
const foe = () => ({ isPlayer: false, isClass: true, items: [], activeEffects: [], stats: { strength: 50 } });
const armed = (item, slot, who = foe()) => { mintCondition(item); who.items.push(item); equipTableOf(who)[slot] = item; return who; };
const longsword = () => mintCondition({ group: 'Weapons', templateIndex: 120, material: 1, name: 'Longsword' });
const cuirass = () => ({ group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass' });

installPcaao();
installRoleplayRealism();

test('WEAR-VANILLA: the three wear switches ship off and read off, the rest of both mods stays on, and a blow\'s scale is DFU\'s', () => {
  _resetModSettings();
  for (const [vendor, key] of WEAR_KEYS) {
    assert.equal(MOD_SETTINGS[vendor].keys[key].default, false, `${vendor}/${key} ships off`);
    assert.equal(modSetting(vendor, key), false, `${vendor}/${key} reads off`);
  }
  const m = pcaaoModules();
  assert.deepEqual([m.enabled, m.equipmentDamageEnhanced, m.fadingEnchantedItems], [true, false, false], 'the overhaul is on, its wear is not');
  assert.deepEqual([m.armorHitFormulaRedone, m.fixedStrengthDamageModifier, m.criticalStrikesIncreaseDamage], [true, true, true], 'the rest of the overhaul is untouched');
  assert.equal(modSetting('roleplay-realism', 'Enabled'), true);
  assert.equal(CONDITION_WEAR_SCALE, 1);
});

test('WEAR-VANILLA: with every mod on as shipped, a landed blow wears what DFU says - (10 x damage + 50) / 100 on the blade and on the struck piece - and a claw wears nothing; either mod\'s module back on wears more (mutants: a switch shipped on)', () => {
  _resetModSettings();
  const blade = longsword();
  const target = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const piece = equipTableOf(target)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), target, 30, blade, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(blade.maxCondition - blade.currentCondition, dfuWear(30), 'the blade: 3');
  assert.equal(piece.maxCondition - piece.currentCondition, dfuWear(30), 'the cuirass: 3');
  const clawed = piece.currentCondition;
  damageEquipment(foe(), target, 30, null, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(piece.currentCondition, clawed, 'a natural attack wears no armour, as in DFU');

  setModSetting('roleplay-realism', 'equipDamage', true);
  const t2 = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const p2 = equipTableOf(t2)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), t2, 30, longsword(), BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.equal(p2.maxCondition - p2.currentCondition, 30 * 5, 'Roleplay Realism\'s module on: armour x5');

  _resetModSettings();
  setModSetting('pcaao', 'equipmentDamageEnhanced', true);
  const t3 = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const p3 = equipTableOf(t3)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), t3, 30, longsword(), BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.ok(p3.maxCondition - p3.currentCondition > dfuWear(30) * 5, 'the overhaul\'s module on: many times DFU\'s on the piece');
  const t4 = armed(cuirass(), EQUIP_SLOTS.ChestArmor);
  const p4 = equipTableOf(t4)[EQUIP_SLOTS.ChestArmor];
  damageEquipment(foe(), t4, 30, null, BODY_PARTS.Chest, { rolls: () => 0.99 });
  assert.ok(p4.currentCondition < p4.maxCondition, '...and a claw wears it');
  _resetModSettings();
});

test('WEAR-VANILLA: a player\'s broken enchanted piece breaks and STAYS in the pack, repairable; the fading module back on still takes it (mutants: fading shipped on)', () => {
  const helm = () => ({ group: 'Armor', templateIndex: 107, material: 0x0201, name: 'Helm', enchantments: [{ type: 5, param: 1 }] });
  _resetModSettings();
  const me = armed(helm(), EQUIP_SLOTS.Head, { isPlayer: true, items: [], activeEffects: [], stats: { strength: 50 } });
  const worn = me.items[0];
  worn.currentCondition = 1;
  damageEquipment(foe(), me, 30, longsword(), BODY_PARTS.Head, { rolls: () => 0.99 });
  assert.equal(worn.currentCondition, 0, 'broken');
  assert.equal(me.items.includes(worn), true, 'and kept');

  setModSetting('pcaao', 'equipmentDamageEnhanced', true); setModSetting('pcaao', 'fadingEnchantedItems', true);
  const me2 = armed(helm(), EQUIP_SLOTS.Head, { isPlayer: true, items: [], activeEffects: [], stats: { strength: 50 } });
  const worn2 = me2.items[0];
  worn2.currentCondition = 1;
  damageEquipment(foe(), me2, 30, longsword(), BODY_PARTS.Head, { rolls: () => 0.99 });
  assert.equal(me2.items.includes(worn2), false, 'a player who turns both back on gets the mod\'s fading');
  _resetModSettings();
});

test('WEAR-VANILLA: online the room reads the three off, whatever the player saved (mutants: the room\'s armour x5 left on)', () => {
  _resetModSettings();
  for (const [vendor, key] of WEAR_KEYS) setModSetting(vendor, key, true);
  for (const [vendor, key] of WEAR_KEYS) assert.equal(onlineModSetting(vendor, key, '?online=1'), false, `${vendor}/${key}: the room's off`);
  assert.equal(onlineForcedModSetting('roleplay-realism', 'equipDamage', '?online=1'), false, 'Roleplay Realism\'s is a room key, forced off');
  assert.equal(modSetting('pcaao', 'equipmentDamageEnhanced'), true, 'offline the saved choice stands');
  _resetModSettings();
});

test('WEAR-VANILLA: a value saved under the old default is let go once, and a choice made after the reset stands (mutants: an entry dropped from SWITCH_RESETS)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings';
  try {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    _resetModSettings();
    store.set(K, JSON.stringify({ pcaao: { Enabled: true, equipmentDamageEnhanced: true, fadingEnchantedItems: true }, 'roleplay-realism': { equipDamage: true, bandaging: false } }));
    for (const [vendor, key] of WEAR_KEYS) assert.equal(modSetting(vendor, key), false, `${vendor}/${key}: the old saved on is let go`);
    assert.equal(modSetting('roleplay-realism', 'bandaging'), false, 'every other saved choice stands');
    assert.deepEqual(JSON.parse(store.get(K)), { pcaao: { Enabled: true }, 'roleplay-realism': { bandaging: false } }, 'written back without them');
    setModSetting('pcaao', 'equipmentDamageEnhanced', true);
    const saved = store.get(K);
    _resetModSettings(); store.set(K, saved);   // a reload
    assert.equal(modSetting('pcaao', 'equipmentDamageEnhanced'), true, 'chosen after the reset: stamped, and kept');
    const stamps = SWITCH_RESETS.filter((r) => r.stamp.endsWith('@WEAR-VANILLA')).map((r) => `${r.vendor}/${r.key}`);
    assert.deepEqual(stamps, WEAR_KEYS.map(([v, k]) => `${v}/${k}`));
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

test('WEAR-VANILLA: through the overhaul\'s own attack core - its redone armour formula on, as shipped - a landed blow wears DFU\'s amount with the weapon it was struck with, a monster\'s stand-in weapon wears no armour, and the wear module back on wears the overhaul\'s way again (mutants: the core always wearing its way; the stand-in handed to DFU\'s wear)', () => {
  _resetModSettings();
  assert.equal(pcaaoModules().armorHitFormulaRedone, true, 'the core is the overhaul\'s');
  const stats = { strength: 60, intelligence: 50, willpower: 50, agility: 60, endurance: 60, personality: 50, speed: 60, luck: 50 };
  const career = () => ({ ...stats, attackModifierFlags: 0 });
  const me = { isPlayer: true, level: 10, raceId: 1, stats, skills: Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, 70])), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, health: 500, maxHealth: 500, items: [], activeEffects: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0 };
  const pieces = Object.values(BODY_PARTS).map((part) => armed(cuirass(), slotForBodyPart(part), me) && equipTableOf(me)[slotForBodyPart(part)]);
  const worn = () => pieces.reduce((n, p) => n + p.maxCondition - p.currentCondition, 0);
  const monster = (id) => ({ ...makeEnemyEntity(id, ENEMY_BASICS[id], career(), 10, () => 0.5), activeEffects: [] });
  let seed = 11; const rolls = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 10000) / 10000; };
  const dfRand = () => Math.floor(rolls() * 32768);
  const slot = formulaOverride('applyConditionDamageThroughPhysicalHit');
  const seen = [];
  registerFormulaOverride('applyConditionDamageThroughPhysicalHit', (item, owner, damage, opts) => { seen.push({ item, damage }); return slot ? slot(item, owner, damage, opts) : false; });
  try {
    // my blade on a rat: every landed blow is DFU's DamageEquipment's, and wears it (10 x damage + 50) / 100
    const blade = longsword();
    let landed = 0;
    for (let i = 0; i < 60; i++) {
      const before = blade.currentCondition;
      seen.length = 0;
      const d = calculateAttackDamage(me, monster(0), { weapon: blade, rolls, dfRand });
      if (!(d > 0)) continue;
      landed++;
      const mine = seen.filter((x) => x.item === blade);
      assert.equal(mine.length, 1, 'DFU\'s DamageEquipment wore the blade');
      const amount = dfuWear(mine[0].damage);
      if (amount > 0) assert.equal(before - blade.currentCondition, amount, `${mine[0].damage} damage: DFU's ${amount}`);
    }
    assert.ok(landed > 5, `the blows land (${landed})`);
    // the Skeletal Warrior strikes with the overhaul's stand-in axe: DFU has no such weapon, so no armour wears
    seen.length = 0;
    let struck = 0;
    for (let i = 0; i < 40; i++) struck += calculateAttackDamage(monster(15), me, { rolls, dfRand }) > 0 ? 1 : 0;
    assert.ok(struck > 0, 'its blows land');
    assert.equal(worn(), 0, 'and wear nothing');
    assert.equal(seen.length, 0);
    // the wear module back on: the overhaul's own wear, by its own path, the stand-in axe wearing my armour
    setModSetting('pcaao', 'equipmentDamageEnhanced', true);
    for (let i = 0; i < 40; i++) calculateAttackDamage(monster(15), me, { rolls, dfRand });
    assert.ok(worn() > 0, 'on: the axe wears my armour');
    assert.equal(seen.length, 0, 'and never through DFU\'s member');
  } finally {
    registerFormulaOverride('applyConditionDamageThroughPhysicalHit', slot);
    _resetModSettings();
  }
});
