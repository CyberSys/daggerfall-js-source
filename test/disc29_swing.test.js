// DISC29-G (2026-09-28, Lynk on Discord, online: "Speed 55" and about four swings a second since the update, faster
// still as a wolf) - NOT A BUG: DFU'S OWN RATE FOR A LYCANTHROPE.
//
// DISC28-D made the first-person swing read the player's LIVE Speed, as GetMeleeWeaponAnimTime always did
// (FormulaHelper.cs:830-838; before it the port swung every player at the number 50). A lycanthrope's live Speed is
// its base plus the curse's 40, in both forms, every magic round (LycanthropyEffect.ApplyLycanthropeAdvantages) - so
// a base-55 werewolf swings at live 95, about 3.3 blows a second in DFU too (5 frames of 3 * (115 - 95) / 980 s). The
// wolf is faster still under the default Roleplay & Realism: Items weaponBalance, which slows a HELD weapon by its
// weight and the claws hold none. These pin that rate, so a later "fix" has to be a decision rather than an accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWeaponRig } from '../src/combat/weaponRig.js';
import { machineAttack, getMeleeWeaponAnimTime } from '../src/characters/weaponStates.js';
import { EQUIP_SLOTS, equipTableOf } from '../src/systems/equip.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { liveStat } from '../src/systems/statMods.js';
import { createLycanthropyCurse, lycanthropyMagicRound, LYCANTHROPE_STAT_MOD } from '../src/systems/lycanthropy.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { isFullMoonFromMinutes, MINUTES_PER_DAY, CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';

const DT = 1 / 60;
/** A night with no full moon (the lycanthropy suite's QUIET): a forced change would morph the subject. */
const QUIET = (() => {
  let m = CLASSIC_GAME_START_TIME;
  while (isFullMoonFromMinutes(m) || isFullMoonFromMinutes(m + MINUTES_PER_DAY * 3)) m += MINUTES_PER_DAY;
  return m;
})();
/** A base-55 character with the curse's advantages applied, as one magic round applies them. */
function werewolf() {
  const p = {
    isPlayer: true, level: 5, health: 60, maxHealth: 60, activeEffects: [], items: [], spells: [], skills: {},
    stats: { strength: 55, intelligence: 50, willpower: 50, agility: 55, endurance: 55, personality: 50, speed: 55, luck: 50 },
  };
  assert.ok(createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: QUIET }));
  lycanthropyMagicRound(p, { nowMinutes: QUIET + 1 });
  return p;
}
/** The real rig over the entity with a drawn weapon, stepped by its own frame (AUDIT DISC28 AR-4's harness). */
function rigWith(entity, templateIndex) {
  const weapon = mintCondition(setItemFields({ group: 'Weapons', templateIndex, material: 0 }));
  entity.items = [weapon];
  equipTableOf(entity)[EQUIP_SLOTS.RightHand] = weapon;
  const rig = createWeaponRig({
    renderer: { uploadTexture: () => null, drawScreenQuad: () => {} },
    canvas: { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 },
    fetchBytes: () => { throw new Error('no art in this pin'); }, palette: null, audio: { playOneShot() {} }, entity,
    camera: () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { baseSpeed: 3, grounded: true, standing: true } }),
  });
  rig.playerWeapon.sheathed = false;
  rig.frame(DT);
  return rig;
}
const swing = (rig) => {
  assert.ok(machineAttack(rig.playerWeapon.machine, 'StrikeDown'), 'a swing starts');
  let t = 0;
  while (rig.playerWeapon.machine.state !== 'Idle' && t < 10) { rig.frame(DT); t += DT; }
  return t;
};
const near = (got, speed) => Math.abs(got - 5 * getMeleeWeaponAnimTime(speed)) <= 5 * DT;

test('DISC29-G: a base-55 lycanthrope\'s live Speed is 95 - the curse\'s 40, in either form', () => {
  const p = werewolf();
  assert.equal(LYCANTHROPE_STAT_MOD, 40);
  assert.equal(liveStat(p, 'speed'), 95, 'the Attributes page shows 95 / 100, not 55');
});

test('DISC29-G: the real rig swings a base-55 werewolf at live 95 - DFU\'s own ~3.3 blows a second', () => {
  _resetModSettings();
  setModSetting('roleplay-realism-items', 'weaponBalance', false);   // DFU's own line: no weight in the clock
  setModSetting('roleplay-realism', 'weaponSpeed', false);
  try {
    const p = werewolf();
    const t = swing(rigWith(p, WEAPONS.Dagger));
    assert.ok(near(t, 95), `${t.toFixed(3)}s a blow against DFU's ${(5 * getMeleeWeaponAnimTime(95)).toFixed(3)}s at live 95`);
    assert.ok(1 / t > 2.8 && 1 / t < 3.8, `about 3.3 a second (${(1 / t).toFixed(2)})`);
    const human = { ...werewolf(), activeEffects: [] };   // the same body without the curse
    const plain = swing(rigWith(human, WEAPONS.Dagger));
    assert.ok(near(plain, 55), 'without the curse, base 55 swings as 55');
    assert.ok(plain > 2.5 * t, 'the curse alone is the difference');
  } finally { _resetModSettings(); }
});
