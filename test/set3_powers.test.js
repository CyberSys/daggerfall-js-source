// SET3 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md): WHAT THE SETS DO (systems/sigilSetPowers.js),
// each power driven through the REAL seam SET2 opened - the entity fold through computeEntityMods and the formulas'
// accessors, the blow through weaponBlowMods, Spite through the attack formula's struck tail, Unbroken and the Wrath
// through hurtPlayer, the kills through reportPlayerKill, Mora through the cast price and the absorption roll, the
// "ready again" through the magic round - with a stand-in for the running host's door (systems/playerDoor.js) and a
// clock of the test's own. Every power sleeps for anyone but MY entity, offline, before my Renown is known and in a duel.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  awakeTiersOf, setFold, rampageStacks, setBlow, setStruck, setDamageMod, setDeathSave, setHurt, eventideBundle, setKill,
  setCastCost, setAbsorbChance, setRound, setPowerStates, setSetPowersVoice, SIGIL_SETS_POWER,
  _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../src/systems/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, _resetSigilForTests } from '../src/systems/sigil.js';
import {
  setSetsDueling, SIGIL_SETS, RAMPAGE_SECONDS, RAMPAGE_STACKS, ROUND_SECONDS, CLEAVE_METRES, NOVA_METRES, WRATH_SECONDS,
  _resetSigilSetsForTests,
} from '../src/systems/sigilSets.js';
import {
  computeEntityMods, entityFoldNames, entityModsOf, entityArmorMod, entityStatMod, entitySkillMod, entityResistMod,
  weaponBlowMods, NUMBER_BODY_PARTS,
} from '../src/systems/entityMods.js';
import { calculateAttackDamage } from '../src/combat/formulas.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { reportPlayerKill } from '../src/systems/playerKills.js';
import { calculateCastCost } from '../src/systems/spellcost.js';
import { tryAbsorption } from '../src/systems/absorption.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';
import { applySpell, isBlending } from '../src/systems/effects.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { SKILLS, MAGIC_SKILLS } from '../src/systems/skills.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];   // helm, right and left pauldron, cuirass, gauntlets, greaves, boots
const XP = SIGIL_STAGES.map((s) => s.xp);           // 0, 5000, 12500, 22500, 37500
const piece = (templateIndex, set, xp = 0) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  return it;
};
/** `n` body pieces of a set, worn (equip.js's listener folds them at once). */
const wearSet = (e, set, n, xp = 0) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set, xp); e.items.push(it); equipItem(e, it); } return e; };
const sword = () => createWeapon(120, 0, () => 0.5);   // a longsword: melee
const bow = () => createWeapon(130, 0, () => 0.5);     // a long bow: Archery
const RAT = Object.freeze({ name: 'rat' });            // a foe's entity - no isPlayer

let T = 0;
_setSetPowersClockForTests(() => T);
const at = (t) => { T = t; };
/** Every test starts here: offline, no Renown, no duel, every power fresh, no door, the clock at 0, a voice to listen to. */
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); setPlayerDoor(null); at(0);
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  return v;
}
const online = (renown = 1) => { setSigilOnline(true); setSigilRenown(renown); };
const foe = (name, x, z = 0, y = 0) => ({ name, entity: { name }, ai: { feet: [x, y, z] }, dead: false });
/** The running host's door, standing in: the foes MY harm reaches, my feet, and what it was asked to do. */
function door(foes = [], { feet = [0, 0, 0], me = null } = {}) {
  const d = { hurts: [], casts: [] };
  setPlayerDoor({
    foes: () => foes.filter((f) => !f.dead && f.entity),
    feet: () => feet,
    hurtFoe: (f, n) => { d.hurts.push([f.name, n]); },
    castOnPlayer: (b) => { d.casts.push(b); },
    player: () => me,
  });
  return d;
}

test('SET3 registered at import, under one name, at every seam SET2 opened: the entity fold, the blow, the struck tail, the damage door\'s three says, the kill, the cast price, the absorption roll and the magic round (mutants: any registration dropped)', () => {
  assert.equal(SIGIL_SETS_POWER, 'sigilSets');
  assert.ok(entityFoldNames().includes('sigilSets'), 'the fold');
  const src = strip(read('src/systems/sigilSetPowers.js'));
  for (const [seam, fn] of [
    ['registerEntityFold', 'setFold'], ['registerWeaponBlowMod', 'setBlow'], ['registerPlayerStruckListener', 'setStruck'],
    ['registerPlayerDamageMod', 'setDamageMod'], ['registerPlayerDeathSave', 'setDeathSave'], ['registerPlayerHurtListener', 'setHurt'],
    ['registerPlayerKillListener', 'setKill'], ['registerSpellCostMod', 'setCastCost'], ['registerAbsorptionChance', 'setAbsorbChance'],
    ['registerMagicRoundHook', 'setRound'],
  ]) assert.match(src, new RegExp(`\\n${seam}\\(SIGIL_SETS_POWER, ${fn}\\);`), `${seam} -> ${fn}`);
});

test('SET3 the 2-piece stat tiers: one fold over RF1\'s channels for MY entity with the set awake - Orc-Hide\'s armour on all seven parts and its Endurance, the Ravager\'s Strength and Critical Strike, Shadow\'s Grace\'s Stealth and Agility, Forbidden Lore\'s Intelligence and all six schools, the Burning Gate\'s fire resistance - at the set\'s own stage, read by the formulas\' accessors; nothing at one piece (mutants: a part left out; a school left out; the resistance on the wrong element; a stat on the wrong name)', () => {
  fresh(); online(1);
  const one = wearSet(player(), 'malacath', 1);
  assert.deepEqual(entityModsOf(one).armorParts, new Array(NUMBER_BODY_PARTS).fill(0), 'one piece wakes nothing');
  const mal = wearSet(player(), 'malacath', 2);
  assert.deepEqual(entityModsOf(mal).armorParts, new Array(NUMBER_BODY_PARTS).fill(2), 'Orc-Hide at Faint: +2 on every part, folded at the equip');
  for (let p = 0; p < NUMBER_BODY_PARTS; p++) assert.equal(entityArmorMod(mal, p), -2, `part ${p}: two points off a blow's chance to land`);
  assert.equal(entityStatMod(mal, 'endurance'), 2);
  const dag = wearSet(player(), 'dagon', 3);
  assert.equal(entityStatMod(dag, 'strength'), 2);
  assert.equal(entitySkillMod(dag, SKILLS.CriticalStrike), 4);
  const noc = wearSet(player(), 'nocturnal', 2);
  assert.equal(entitySkillMod(noc, SKILLS.Stealth), 4);
  assert.equal(entityStatMod(noc, 'agility'), 2);
  const mor = wearSet(player(), 'mora', 2);
  assert.equal(entityStatMod(mor, 'intelligence'), 2);
  assert.equal(MAGIC_SKILLS.length, 6);
  for (const s of MAGIC_SKILLS) assert.equal(entitySkillMod(mor, s), 2, `school ${s}`);
  assert.equal(entitySkillMod(mor, SKILLS.Stealth), 0, 'only the schools');
  const ruhn = wearSet(player(), 'ruhn', 2);
  assert.equal(entityResistMod(ruhn, ['fire']), 15);
  assert.equal(entityResistMod(ruhn, ['frost', 'shock', 'poison', 'magic']), 0, 'fire alone');
  assert.equal(entityStatMod(ruhn, 'endurance'), 0, 'a set\'s tier is its own');
});

test('SET3 the stat tiers grow together: the numbers stand at the SET\'s stage - its lowest piece\'s, under the Renown\'s cap - and the fold is recomputed the moment the Renown or the duel changes (the host\'s two recomputes) and at every magic round (mutants: the Renown\'s recompute missing; the duel\'s recompute missing)', () => {
  fresh(); online(40);
  const asc = wearSet(player(), 'malacath', 2, XP[4]);
  assert.equal(entityStatMod(asc, 'endurance'), 6, 'both at Ascendant, Renown 40: Ascendant');
  assert.deepEqual(entityModsOf(asc).armorParts, new Array(NUMBER_BODY_PARTS).fill(5));
  const mixed = player();
  wearSet(mixed, 'malacath', 1, XP[4]);
  const low = piece(BODY[1], 'malacath', 0); mixed.items.push(low); equipItem(mixed, low);
  assert.equal(entityStatMod(mixed, 'endurance'), 2, 'one Faint piece holds the set at Faint');
  setSigilRenown(20);   // Bright opens at Renown 20 (the Renown only rises in play; the test lowers it for the cap)
  computeEntityMods(asc);
  assert.equal(entityStatMod(asc, 'endurance'), 4, 'Ascendant pieces under a Bright Renown stand at Bright: 2 + 4 x 2/4');
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /setSigilRenown\(level\);[^\n]*\n\s*computeEntityMods\(playerEntity\);/, 'my Renown adopted: the fold at once');
  assert.match(w, /const setsWere = setsDueling\(\);\s*setSetsDueling\(!!duelMgr\.live\);[^\n]*\n\s*if \(setsDueling\(\) !== setsWere\) computeEntityMods\(playerEntity\);/, 'a duel begun or ended: the fold at once');
  assert.match(strip(read('src/systems/worldTick.js')), /computeEntityMods\(entity\);/, 'and every magic round');
});

test('SET3 every power sleeps for anyone but me and whenever the sets sleep - offline, online before my Renown is known, in a duel - and a peer\'s entity here is never mine (mutants: awake while the sets sleep; a peer\'s entity awake)', () => {
  fresh();
  const e = wearSet(player(), 'malacath', 6);
  assert.equal(awakeTiersOf(e), null, 'offline');
  assert.equal(entityStatMod(e, 'endurance'), 0);
  setSigilOnline(true);
  computeEntityMods(e);
  assert.equal(awakeTiersOf(e), null, 'online, my Renown not yet known');
  assert.equal(entityStatMod(e, 'endurance'), 0);
  setSigilRenown(1);
  computeEntityMods(e);
  assert.equal(entityStatMod(e, 'endurance'), 2, 'awake');
  assert.deepEqual(awakeTiersOf(e).get('malacath').map((v) => !!v), [true, true, true]);
  setSetsDueling(true);
  computeEntityMods(e);
  assert.equal(awakeTiersOf(e), null, 'in a duel');
  assert.equal(entityStatMod(e, 'endurance'), 0);
  assert.equal(setDamageMod(e, 10), 10);
  assert.equal(setDeathSave(e), false);
  setSetsDueling(false);
  assert.equal(awakeTiersOf({ ...e, peer: 'p1' }), null, 'a peer\'s entity');
  assert.equal(setFold({ ...e, peer: 'p1' }).stats.endurance, undefined);
  assert.equal(awakeTiersOf({ ...e, isPlayer: false }), null, 'a foe');
  assert.equal(awakeTiersOf(null), null);
});

test('SET3 the blow - Bloodfury\'s per cent (twice below half health), taken of the whole blow with the fraction carried on the weapon; never on a miss, a blow at a player, a peer\'s blow or a foe\'s, or while the sets sleep (mutants: the doubling at half health itself; the carry dropped; the carry kept per wielder instead of per weapon; a duel\'s blow raised)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'dagon', 4);
  const s = sword();
  assert.equal(weaponBlowMods(s, 100, e, RAT), 104, 'Bloodfury at Faint: +4%');
  e.health = 50;
  assert.equal(weaponBlowMods(s, 100, e, RAT), 104, 'at half health: not below it');
  e.health = 49;
  assert.equal(weaponBlowMods(s, 100, e, RAT), 108, 'below half: twice');
  e.health = 100;
  const knife = createWeapon(113, 0, () => 0.5);
  assert.deepEqual([1, 2].map(() => weaponBlowMods(knife, 10, e, RAT)), [10, 10], '0.4 a blow, carried: 0.8 stands on the knife');
  assert.equal(weaponBlowMods(sword(), 10, e, RAT), 10, 'another weapon carries its own - never the knife\'s 0.8');
  assert.equal(weaponBlowMods(knife, 10, e, RAT), 11, 'the knife\'s 0.8 and this blow\'s 0.4 make the whole point');
  assert.deepEqual([1, 2].map(() => weaponBlowMods(knife, 10, e, RAT)), [10, 11], 'and on: 0.6, then 1.0');
  assert.equal(weaponBlowMods(s, 0, e, RAT), 0, 'a miss');
  assert.equal(weaponBlowMods(s, 100, e, { isPlayer: true }), 100, 'a blow at a player');
  assert.equal(weaponBlowMods(s, 100, { ...e, peer: 'p1' }, RAT), 100, 'a peer\'s blow resolved here');
  assert.equal(weaponBlowMods(s, 100, RAT, e), 100, 'a foe\'s blow at me');
  setSetsDueling(true);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'in a duel');
  setSetsDueling(false);
  setSigilOnline(false);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 100, 'offline');
  assert.equal(setBlow(s, 100, e, RAT, {}), 100);
});

test('SET3 the Rampage: each kill of mine a stack, up to three, every one refreshed by the last kill and gone twelve seconds after it; each stack a share of the blow, said as it rises (mutants: the window from the first kill; no cap; a stack said at the cap)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'dagon', 6);
  door([], { me: e });
  const s = sword();
  at(100);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 104, 'Bloodfury alone');
  reportPlayerKill(RAT, { kind: 'melee' });
  assert.equal(rampageStacks(), 1);
  assert.equal(weaponBlowMods(s, 100, e, RAT), 108, '+4% a stack at Faint');
  reportPlayerKill(RAT); reportPlayerKill(RAT); reportPlayerKill(RAT);
  assert.equal(rampageStacks(), RAMPAGE_STACKS, 'three at most');
  assert.equal(RAMPAGE_STACKS, 3);
  assert.deepEqual(v.said, ['Rampage I', 'Rampage II', 'Rampage III'], 'said as it rises, not again at the cap');
  assert.equal(weaponBlowMods(s, 100, e, RAT), 116);
  at(105);
  reportPlayerKill(RAT, { kind: 'arrow' });
  at(105 + RAMPAGE_SECONDS - 0.01);
  assert.equal(rampageStacks(), 3, 'the last kill refreshed them all');
  at(105 + RAMPAGE_SECONDS);
  assert.equal(rampageStacks(), 0, 'twelve seconds after the last kill');
  assert.equal(weaponBlowMods(s, 100, e, RAT), 104);
  reportPlayerKill(RAT);
  assert.equal(rampageStacks(), 1, 'a new run starts at one');
  // four pieces: no Rampage, whatever is killed
  fresh(); online(1);
  const four = wearSet(player(), 'dagon', 4);
  door([], { me: four });
  reportPlayerKill(RAT);
  assert.equal(rampageStacks(), 0);
});

test('SET3 Nightfall Strike: a weapon blow at a foe that had not noticed me (the host\'s `unaware`), a bow\'s too; and the Burning Gate\'s sear, flat on every weapon blow after the per cents (mutants: Nightfall on an aware foe; Nightfall never on an arrow; the sear inside the per cent)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'nocturnal', 4);
  assert.equal(weaponBlowMods(sword(), 100, e, RAT, { unaware: true }), 125, '+25% at Faint');
  assert.equal(weaponBlowMods(bow(), 100, e, RAT, { unaware: true }), 125, 'arrows too');
  assert.equal(weaponBlowMods(sword(), 100, e, RAT, { unaware: false }), 100, 'a foe that saw me');
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 100, 'no word: aware');
  fresh(); online(1);
  const r = wearSet(player(), 'ruhn', 2);
  assert.equal(weaponBlowMods(sword(), 100, r, RAT), 102, 'the sear at Faint: +2');
  assert.equal(weaponBlowMods(bow(), 1, r, RAT), 3, 'on an arrow too');
  fresh(); online(40);
  const r4 = wearSet(player(), 'ruhn', 2, XP[4]);
  assert.equal(weaponBlowMods(sword(), 100, r4, RAT), 106, 'at Ascendant: +6');
});

test('SET3 Cleave: a MELEE blow also strikes the nearest other live foe within three metres of the one struck (flat distance), for its share of the whole blow, through the host\'s door as my hurt - never from a bow, never past the reach, never a dead foe, never without a door (mutants: the last in reach taken, not the nearest; the reach ignored; a bow cleaving; the share of the blow before the sear; the reach measured with the height)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'ruhn', 4);
  const a = foe('a', 0), b = foe('b', 2), c = foe('c', 2.5), far = foe('far', CLEAVE_METRES + 0.5);
  const d = door([a, b, c, far]);
  assert.equal(weaponBlowMods(sword(), 100, e, a.entity), 102, 'the struck foe takes the blow and the sear');
  assert.deepEqual(d.hurts, [['b', 26]], 'the nearest, 25% of 102 = 25.5, whole');
  b.dead = true; d.hurts.length = 0;
  weaponBlowMods(sword(), 100, e, a.entity);
  assert.deepEqual(d.hurts, [['c', 26]], 'a dead foe is passed over');
  c.dead = true; d.hurts.length = 0;
  weaponBlowMods(sword(), 100, e, a.entity);
  assert.deepEqual(d.hurts, [], 'past three metres: none');
  const high = foe('high', 2.9, 0, 6);
  const d2 = door([a, high]);
  weaponBlowMods(sword(), 100, e, a.entity);
  assert.deepEqual(d2.hurts, [['high', 26]], 'flat distance - a foe on a ledge above is within reach');
  d2.hurts.length = 0;
  weaponBlowMods(bow(), 100, e, a.entity);
  assert.deepEqual(d2.hurts, [], 'an arrow does not cleave');
  weaponBlowMods(sword(), 100, e, { name: 'not on the door' });
  assert.deepEqual(d2.hurts, [], 'a struck foe the door does not know');
  weaponBlowMods(sword(), 1, e, a.entity);
  assert.deepEqual(d2.hurts, [['high', 1]], '25% of 3 is under one: one');
  setPlayerDoor(null);
  assert.equal(weaponBlowMods(sword(), 100, e, a.entity), 102, 'no door: the blow still lands, nothing cleaves');
  fresh(); online(1);
  const two = wearSet(player(), 'ruhn', 2);
  const d3 = door([a, foe('near', 1)]);
  weaponBlowMods(sword(), 100, two, a.entity);
  assert.deepEqual(d3.hurts, [], 'two pieces: no Cleave');
});

test('SET3 Spite of the Spurned: a foe\'s attack that lands on me with damage - told at the attack formula\'s struck tail - hurts that foe back through the door for its share, whole and at least one (mutants: the whole blow sent back; a foe that did not strike hurt)', () => {
  fresh(); online(1);
  const e = wearSet(player(), 'malacath', 4);
  const rat = makeEnemyEntity(0, ENEMY_BASICS[0], { ...stats(), attackModifierFlags: 0 }, 5, () => 0.5);
  const d = door([{ name: 'rat', entity: rat, ai: { feet: [1, 0, 0] }, dead: false }]);
  let dmg = 0;
  for (let i = 0; i < 20 && !(dmg > 0); i++) dmg = calculateAttackDamage(rat, e, { rolls: () => 0.01 });
  assert.ok(dmg > 0, `the rat's bite lands (${dmg})`);
  assert.deepEqual(d.hurts, [['rat', Math.max(1, Math.round(dmg * 0.1))]], 'through the formula\'s own tail: 10% back at Faint');
  d.hurts.length = 0;
  setStruck(rat, e, 40);
  assert.deepEqual(d.hurts, [['rat', 4]]);
  setStruck(rat, e, 0);
  setStruck({ name: 'elsewhere' }, e, 40);
  setStruck(rat, { ...e, peer: 'p1' }, 40);
  assert.deepEqual(d.hurts, [['rat', 4]], 'nothing for no damage, a foe the door does not know, or a peer struck');
  fresh(); online(40);
  const asc = wearSet(player(), 'malacath', 4, XP[4]);
  const d2 = door([{ name: 'rat', entity: rat, ai: { feet: [1, 0, 0] }, dead: false }]);
  setStruck(rat, asc, 40);
  assert.deepEqual(d2.hurts, [['rat', 12]], '30% at Ascendant');
});

test('SET3 Unbroken: damage that would kill me leaves me at 1, said and sounded, and every blow for the next seconds is halved; it recovers in its time and is said ready again at the next round - never on a SetHealth(0) door or a duel\'s blow, and a second death inside the recovery is a death (mutants: no recovery; the halving never ends; the recovery read off the halving)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'malacath', 6);
  e.health = 50;
  at(1000);
  assert.equal(hurtPlayer(e, 500), false);
  assert.equal(e.health, 1, 'left at 1');
  assert.deepEqual(v.said, ['Unbroken! Malacath will not let you fall - all damage halved for 4 s.']);
  assert.deepEqual(v.sounds, ['unbroken']);
  e.health = 50;
  at(1001);
  hurtPlayer(e, 10);
  assert.equal(e.health, 45, 'halved');
  at(1004);
  hurtPlayer(e, 10);
  assert.equal(e.health, 35, 'four seconds at Faint, then whole');
  at(1100);
  hurtPlayer(e, 500);
  assert.equal(e.health, 0, 'inside the recovery: a death');
  e.health = 50;
  setRound(e);
  assert.equal(v.said.length, 1, 'not ready yet: nothing said');
  at(1300);
  setRound(e);
  assert.equal(v.said.at(-1), 'Unbroken is ready again.', 'three hundred seconds at Faint');
  setRound(e);
  assert.equal(v.said.filter((l) => l === 'Unbroken is ready again.').length, 1, 'said once');
  hurtPlayer(e, 500, { bypassShield: true });
  assert.equal(e.health, 0, 'a SetHealth(0) door (drowning) is death');
  e.health = 50;
  hurtPlayer(e, 500, { spare: () => {} });
  assert.equal(e.health, 1, 'a duel\'s blow: the duel\'s own floor');
  assert.equal(v.sounds.length, 1, '...and neither spent the save');
  e.health = 50;
  hurtPlayer(e, 500);
  assert.equal(e.health, 1, 'still ready');
  assert.equal(v.sounds.length, 2);
  fresh(); online(40);
  const asc = wearSet(player(), 'malacath', 6, XP[4]);
  asc.health = 10;
  at(0);
  hurtPlayer(asc, 50);
  at(7.99);
  assert.equal(setDamageMod(asc, 10), 5, 'eight seconds at Ascendant');
  at(8);
  assert.equal(setDamageMod(asc, 10), 10);
  at(149);
  assert.equal(setDeathSave(asc), false);
  at(150);
  assert.equal(setDeathSave(asc), true, 'a hundred and fifty at Ascendant');
});

test('SET3 Wrath of the Warden: a blow that takes me from at or above 30% to under it - never a killing blow - bursts a Nova on every live foe within six metres of my feet through the door, said with the count and sounded, and my weapon blows deal more for ten seconds; it recovers in its time (mutants: any blow under the line waking it; the Nova past its reach; the fury never ending; no recovery; a killing blow waking it)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'ruhn', 6);
  const near = foe('near', 5), far = foe('far', NOVA_METRES + 1), dead = foe('dead', 1);
  dead.dead = true;
  const d = door([near, far, dead], { feet: [0, 0, 0] });
  e.health = 50;
  at(0);
  hurtPlayer(e, 10);
  assert.deepEqual(d.hurts, [], 'still above the line');
  hurtPlayer(e, 11);
  assert.equal(e.health, 29);
  assert.deepEqual(d.hurts, [['near', 10]], 'crossed: 10 at Faint, only within six metres');
  assert.deepEqual(v.said, ['Wrath of the Warden! The gate\'s fire bursts from you (1 struck).']);
  assert.deepEqual(v.sounds, ['wrath']);
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 112, 'the fury (+10%) and the sear (+2)');
  at(WRATH_SECONDS - 0.01);
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 112);
  at(WRATH_SECONDS);
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 102, 'ten seconds');
  e.health = 50;
  at(100);
  hurtPlayer(e, 25);
  assert.equal(d.hurts.length, 1, 'inside the recovery: no Nova');
  e.health = 29;
  at(180);
  hurtPlayer(e, 5);
  assert.equal(d.hurts.length, 1, 'already under the line: no crossing');
  e.health = 30;
  hurtPlayer(e, 1);
  assert.equal(d.hurts.length, 2, 'from exactly the line to under it: a crossing');
  e.health = 50;
  at(360);
  hurtPlayer(e, 50);
  assert.equal(e.health, 0);
  assert.equal(d.hurts.length, 2, 'a killing blow wakes nothing');
  e.health = 50;
  setHurt(e, { dmg: 25, before: 50, after: 25 });
  assert.equal(d.hurts.length, 3);
  setPlayerDoor(null);
  e.health = 50; at(1000);
  setHurt(e, { dmg: 25, before: 50, after: 25 });
  assert.equal(v.said.at(-1), 'Wrath of the Warden! The gate\'s fire bursts from you.', 'no door: the fury still wakes, no count said');
  assert.equal(weaponBlowMods(sword(), 100, e, RAT), 112);
});

test('SET3 Eventide: a kill of mine wraps me in Nocturnal\'s shadow - a Chameleon of whole magic rounds on me through the door, no save and no roll - said and sounded, and it recovers in its time; the bundle lands as the classic Chameleon (mutants: no recovery; the shadow on four pieces; the rounds off the stage)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'nocturnal', 6);
  const d = door([], { me: e });
  at(0);
  reportPlayerKill(RAT);
  assert.equal(d.casts.length, 1);
  assert.deepEqual(d.casts[0], eventideBundle(1));
  assert.equal(d.casts[0].effects[0].durationBase, 1, 'one round at Faint');
  assert.equal(d.casts[0].effects[0].durationMod, 0, 'whatever my level');
  assert.equal(d.casts[0].effects[0].type, 23);
  assert.equal(d.casts[0].effects[0].subType, 0, 'Chameleon (Normal): a strike of mine breaks it');
  assert.deepEqual(v.said, ['Eventide - Nocturnal\'s shadows take you.']);
  assert.deepEqual(v.sounds, ['eventide']);
  at(29.99);
  reportPlayerKill(RAT);
  assert.equal(d.casts.length, 1, 'thirty seconds at Faint');
  at(30);
  reportPlayerKill(RAT);
  assert.equal(d.casts.length, 2);
  assert.match(SIGIL_SETS.nocturnal.tiers[2].text({ rounds: 1, recover: 30 }), new RegExp(`for ${ROUND_SECONDS} s`), 'the words count the rounds in seconds');
  // the bundle through the real apply, as the door's castOnPlayer sends it: the player blends
  const target = player();
  applySpell(eventideBundle(3), 5, target, { hurt: () => {}, heal: () => {} }, () => 0.99, null, { bypassSavingThrows: true, bypassChance: true });
  assert.equal(isBlending(target), true, 'Chameleon lands on me');
  fresh(); online(40);
  const asc = wearSet(player(), 'nocturnal', 6, XP[4]);
  const d2 = door([], { me: asc });
  at(0); reportPlayerKill(RAT);
  assert.equal(d2.casts[0].effects[0].durationBase, 3, 'three rounds at Ascendant');
  at(15); reportPlayerKill(RAT);
  assert.equal(d2.casts.length, 2, 'fifteen seconds at Ascendant');
  fresh(); online(1);
  const four = wearSet(player(), 'nocturnal', 4);
  const d3 = door([], { me: four });
  reportPlayerKill(RAT);
  assert.equal(d3.casts.length, 0, 'four pieces: no Eventide');
  const d4 = door([], { me: null });
  reportPlayerKill(RAT);
  assert.equal(d4.casts.length, 0, 'a door with no player of its own: nothing');
});

test('SET3 Mora\'s Mantle: my spells cost less at four pieces (whole, at least one) and never a foe\'s cast; at six, a Destruction spell on me is absorbed its share of the time as Spell Absorption is, under DFU\'s gates (mutants: the price raised; the Eye on four pieces)', () => {
  fresh(); online(1);
  const spell = { rangeType: 0, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] };
  const bare = player();
  const plain = calculateCastCost(spell, bare).sp;
  assert.ok(plain > 20, `a price to cut (${plain})`);
  const e = wearSet(player(), 'mora', 4);
  const skilled = calculateCastCost(spell, e, { portMods: false }).sp;
  assert.ok(skilled < plain, `Forbidden Lore's schools already cheapen it, as any school a skill raises does (${plain} -> ${skilled})`);
  assert.equal(calculateCastCost(spell, e).sp, Math.max(1, Math.round(skilled * 0.95)), 'then 5% less at Faint');
  assert.equal(calculateCastCost(spell, { ...e, isPlayer: false }).sp, skilled, 'a caster that is not the player: none of it');
  assert.equal(setCastCost(e, 100), 95);
  assert.equal(setCastCost({ ...e, peer: 'p1' }, 100), 100);
  const dmg = spell.effects[0];
  assert.equal(setAbsorbChance(e), 0, 'four pieces: no Eye');
  let rolled = 0;
  assert.equal(tryAbsorption(dmg, 0, e, { rolls: () => { rolled++; return 0; } }), 0);
  assert.equal(rolled, 0, 'nothing to roll');
  fresh(); online(1);
  const six = wearSet(player(), 'mora', 6);
  assert.equal(setAbsorbChance(six), 10, '10% at Faint');
  assert.ok(tryAbsorption(dmg, 0, six, { rolls: () => 0.09 }) > 0, 'a roll under ten: absorbed');
  assert.equal(tryAbsorption(dmg, 0, six, { rolls: () => 0.1 }), 0, 'ten: not');
  assert.equal(tryAbsorption({ ...dmg, type: 10, subType: 8 }, 0, six, { rolls: () => 0 }), 0, 'a heal is never absorbed');
  assert.equal(tryAbsorption(dmg, 0, { ...six, magicka: six.maxMagicka }, { rolls: () => 0 }), 0, 'no room for it: none');
  fresh(); online(40);
  const asc = wearSet(player(), 'mora', 6, XP[4]);
  assert.equal(setAbsorbChance(asc), 30);
  assert.equal(setCastCost(asc, 100), 85);
});

test('SET3 the round: each recovering power is said ready again at the first magic round after its time - once, and silently forgotten while the sets sleep; the magic round runner calls it for my entity (mutants: said before its time; said every round; said in a duel)', () => {
  const v = fresh(); online(1);
  const e = wearSet(player(), 'ruhn', 6);
  door([], { feet: [0, 0, 0], me: e });
  e.health = 50;
  at(0);
  hurtPlayer(e, 25);
  v.said.length = 0;
  at(179);
  runMagicRoundsFor(e, 0, 1, { sinks: { hurt: () => {}, heal: () => {} } });
  assert.deepEqual(v.said, [], 'not yet');
  at(180);
  runMagicRoundsFor(e, 1, 2, { sinks: { hurt: () => {}, heal: () => {} } });
  assert.deepEqual(v.said, ['Wrath of the Warden is ready again.'], 'through the runner\'s round hook');
  runMagicRoundsFor(e, 2, 3, { sinks: { hurt: () => {}, heal: () => {} } });
  assert.equal(v.said.length, 1, 'once');
  e.health = 50;
  hurtPlayer(e, 25);
  v.said.length = 0;
  setSetsDueling(true);
  at(400);
  setRound(e);
  assert.deepEqual(v.said, [], 'a duel: forgotten, not said');
  setSetsDueling(false);
  setRound(e);
  assert.deepEqual(v.said, [], '...and not said after');
  setRound({ ...e, peer: 'p1' });
  setRound(RAT);
  assert.deepEqual(v.said, []);
});

test('SET3 the HUD\'s read of the powers: the Rampage\'s stacks and seconds, the halving, the fury and every recovery - whole seconds left, 0 for one not running (mutants: a window read past its end)', () => {
  fresh(); online(1);
  assert.deepEqual(setPowerStates(), { rampage: 0, rampageLeft: 0, halvedLeft: 0, unbrokenLeft: 0, wrathLeft: 0, wrathRecoverLeft: 0, eventideLeft: 0 });
  const e = wearSet(player(), 'dagon', 6);
  door([], { me: e });
  at(10);
  reportPlayerKill(RAT); reportPlayerKill(RAT);
  at(10.5);
  assert.deepEqual(setPowerStates(), { rampage: 2, rampageLeft: 12, halvedLeft: 0, unbrokenLeft: 0, wrathLeft: 0, wrathRecoverLeft: 0, eventideLeft: 0 });
  at(22);
  assert.deepEqual(setPowerStates(), { rampage: 0, rampageLeft: 0, halvedLeft: 0, unbrokenLeft: 0, wrathLeft: 0, wrathRecoverLeft: 0, eventideLeft: 0 }, 'every window past its end: 0, never a count below it');
  fresh(); online(1);
  const m = wearSet(player(), 'malacath', 6);
  m.health = 5;
  at(0);
  hurtPlayer(m, 50);
  at(1.2);
  const st = setPowerStates();
  assert.equal(st.halvedLeft, 3);
  assert.equal(st.unbrokenLeft, 299);
});

test('SET3 the host: world.js imports the powers (registering them) and gives them its voice - the parry\'s ring for Unbroken, a fire cast for the Wrath, a magic cast for Eventide, through the cast sounds\' ID door; the running host\'s door names my entity (mutants: the powers never imported; a cast sound spent as a raw index; a thrown sound breaking the save)', () => {
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /import \{ setSetPowersVoice, setHudChips \} from '\.\.\/systems\/sigilSetPowers\.js';/);
  assert.match(w, /setSetPowersVoice\(\{ sound: \(name\) => \{\s*if \(name === 'unbroken'\) audio\.playOneShot\(SOUND\.Parry6, 1\);\s*else if \(name === 'wrath'\) audio\.playOneShotId\(SPELL_CAST_SOUND\[0\], 1\);\s*else if \(name === 'eventide'\) audio\.playOneShotId\(SPELL_CAST_SOUND\[4\], 1\);\s*\} \}\);/);
  assert.match(strip(read('src/scenes/hostMagic.js')), /player: \(\) => playerEntity,/);
  assert.equal(eventideBundle(3).element, 4, 'Eventide\'s bundle rides the magic element - its cast sound\'s index');
  // the voice: a thrown sound is not the power's problem
  const v = fresh(); online(1);
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: () => { throw new Error('no audio'); } });
  const e = wearSet(player(), 'malacath', 6);
  e.health = 5;
  hurtPlayer(e, 50);
  assert.equal(e.health, 1, 'saved though the sound threw');
  setKill();
});
