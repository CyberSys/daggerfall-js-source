#!/usr/bin/env node
// AUDIT TELL (bible/12-Enhanced-AI/Feud-Arc.md section 28): THE DUEL HARNESS - the balance targets measured, not
// guessed. The real brain (ai/tactics.js), the real foe motor and attack component (characters/enemyMotor.js,
// characters/enemyAttack.js) on a real collider's flat floor, the real foe (characters/enemyEntity.js
// makeEnemyEntity, systems/eliteFoes.js for an elite), the real damage roll (combat/formulas.js calculateAttackDamage)
// and the real swing tempo (characters/weaponStates.js, the weapon in the hand through combat/swingLaw.js) - against a
// scripted player who stands at the foe's front and either TRADES blows or DODGES. Every fight seeded.
//
//     node tools/tellDuel.mjs [--fights 1000] [--seconds 30] [--json] [--tell | --feud]
//
// It measures the TELL targets the arc names:
//   LIGHT    a dagger, solo, at a medium foe's front breaks 15% of the wind-ups its blows land on or fewer;
//   HEAVY    a warhammer, the same, 60% or more (of the wind-ups it lands on: a miss, or a swing that comes after the
//            landing, breaks nothing whatever the weapon - one swing in a wind-up at most, and DFU's hit roll on it);
//   MASSIVE  no single blow of a non-weakness weapon at a giant's front breaks it (the largest roll of each heavy and
//            long weapon, steel and daedric, from the reference player and from the strongest one, against the poise of
//            the weakest giant DFU rolls);
//   FAIR     no telegraphed blow lands on a player who is out of its shape from 70% of its wind-up on.
// AUDIT FEUD: and RVN's (revenantFight, below) - an Orc revenant fought to its end, trading or dodging perfectly:
//   DODGE PAYS  a perfect dodger takes a tenth of the telegraphed blows a trader does or fewer, and is no slower to bring a
//               rank-3 revenant to its end (FEUD BALANCE, Mac's OPEN 24: what dodging buys - the will below, the blows not
//               taken - and not speed);
//   THE WILL    at rank 3, with its weakness it kneels 90% or more; without it but dodging, 70% or more; trading, 20% or less;
//   THE RANKS   a rank-5 takes about 2.5 times a rank-1's time (2 to 3).
// `--tell` measures TELL's alone, `--feud` RVN's alone. A class foe needs its CLASS*.CFG (ARENA2's data, not in the
// repository), so the class Warrior's cells are measured where the game's data is. Exit 1 when a target is missed.
import { MOD_SETTINGS, setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { setPref, getPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { setTacticsClock, resetTactics, noteLocalPlayer, windupStruck, LOCAL_TARGET } from '../src/ai/tactics.js';
import { resetBlows, inBlow, BLOW_TIER_LEVEL } from '../src/ai/foeBlows.js';
import { blowK, blowWeight, behind, poiseOf, weightClass, TELL } from '../src/ai/tells.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { Collider } from '../src/player/collider.js';
import { calculateAttackDamage, enemyWeightClassicUnits, chooseEnemyWeapon, weaponKnockbackApplies, weaponKnockbackSpeed } from '../src/combat/formulas.js';
import { makeEnemyEntity } from '../src/characters/enemyEntity.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { WEAPONS } from '../src/characters/weapons.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { promoteEliteFoe } from '../src/systems/eliteFoes.js';
import { getMeleeWeaponAnimTime, MELEE_NUM_FRAMES, HIT_FRAME_MELEE, CLASSIC_UPDATE_INTERVAL } from '../src/characters/weaponStates.js';
import { liveStat } from '../src/systems/statMods.js';   // AUDIT FEUD 2: the foe's live Speed, as the pools hand it (phase two's +20)
import { blowEffectOf, BLOW_EFFECT } from '../src/systems/blowEffects.js';   // AUDIT FEUD 2: what a landing does to me
import '../src/combat/swingLaw.js';   // registers the reader: the swing reads the weapon in the hand
import { weaponTypeForItem } from '../src/combat/fpsWeapon.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { getSeed, setSeed } from '../src/formats/dfRandom.js';   // AUDIT FEUD: DFU's shared stream (the hit roll, the attack's reflex gate) - each fight's own seed
import { isMain } from './lib/isMain.mjs';   // AUDIT 68: the one "am I the program" test

// DFU's own numbers, as the suites pin them: every vendored mod off (test/modsOff.js's three lines)
_resetModSettings();
for (const [vendor, def] of Object.entries(MOD_SETTINGS)) if (def.keys.Enabled) setModSetting(vendor, 'Enabled', false);
_resetForTests(); setPref('survival', false);
setPref('enhancedAI', true);

export const TARGETS = Object.freeze({ LIGHT_MAX: 0.15, HEAVY_MIN: 0.6, FAIR_TO_70: 0.7 });
const DT = 1 / 60;
const REACH = 2.5;   // combat/playerWeapon.js WEAPON_REACH (WeaponManager's 2.25 and the sphere cast's 0.25)
const STATS = (v) => ({ strength: v, intelligence: 50, willpower: 50, agility: v, endurance: 50, personality: 50, speed: 50, luck: 50 });

/** mulberry32: the fight's own stream (Math.random is replaced by it for the fight - the brain's feints, the rolls). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** AUDIT FEUD 2: THE POOLS' OWN STEPS, shared by both fights. A foe's motor and attack component as the pools build them
 *  (scenes/exteriorFoes.js: its live Speed - phase two's +20 rides it). */
function foeMotor(ent) {
  const ai = new EnemyAI(new Collider(() => 0), [0, 0, 4], Math.PI, { vitals: () => ent, liveSpeed: () => liveStat(ent, 'speed') });
  const atk = new EnemyAttack({ liveSpeed: () => liveStat(ent, 'speed'), playerLevel: () => 10, reflexes: 2 });
  return { ai, atk };
}
/** A telegraphed landing on me (the brain's `_blowFx`): its blow rolled as the pool rolls it (exteriorFoes.js
 *  resolveFoeMeleeVsPlayer - DFU's hit roll on the player, the blow's own multiple), and its knockdown queued only when it
 *  did damage (hostCombat.js landBlowEffect) - and not inside the last one's guard. Answers the new `{ downUntil,
 *  guardUntil }`. */
export function landOnMe(ai, ent, type, player, T, down) {
  const w = ai._blowFx;
  ai._blowFx = null;
  const dmg = Math.round(calculateAttackDamage(ent, player.entity, { weapon: chooseEnemyWeapon(ent.weapon, ENEMY_BASICS[type]) }) * (Number(ai._blowMult) > 0 ? ai._blowMult : 1));
  if (dmg > 0 && blowEffectOf(w.kind, w.iron).knockdown && T >= down.guardUntil) return { downUntil: T + BLOW_EFFECT.KNOCKDOWN_S, guardUntil: T + BLOW_EFFECT.KNOCKDOWN_S + BLOW_EFFECT.KNOCKDOWN_GUARD };
  return down;
}
/** My blow's shove, as the pools write DFU's (exteriorFoes.js damageFoe, C15): unless the poise held it, and whenever
 *  the foe may be knocked again - away from my feet, a stagger's half again. */
export function knockFoe(ai, type, weight, dmg, word, p) {
  if (word === 'hold' || !weaponKnockbackApplies(ai.knockbackSpeed, false, ENEMY_BASICS[type]?.weight ?? 0)) return;
  const dx = ai.feet[0] - p[0], dz = ai.feet[2] - p[2], d = Math.hypot(dx, dz) || 1;
  ai.knockbackSpeed = weaponKnockbackSpeed(dmg, weight) * (word === 'stagger' ? TELL.STAGGER_KNOCK : 1);
  ai.knockbackDir = [dx / d, 0, dz / d];
}

/** The scripted player: a level, a skill and a Strength, the weapon in the right hand - steel, or `material`. */
export function makePlayer(weaponName, { level = 10, skill = 50, strength = 50, material = 1 } = {}) {
  const item = createWeapon(WEAPONS[weaponName], material, () => 0.5);   // as ItemBuilder mints it (its group, so its hands)
  const slots = []; slots[EQUIP_SLOTS.RightHand] = item;
  const entity = { isPlayer: true, isClass: true, level, skills: new Array(35).fill(skill), stats: STATS(strength), career: { attackModifierFlags: 0 }, items: [item], equip: { slots } };
  const weaponType = weaponTypeForItem(item);
  const frame = getMeleeWeaponAnimTime(50, { entity, weaponType, usingRightHand: true });
  return { entity, item, weaponType, swing: frame * MELEE_NUM_FRAMES.StrikeDown, hitAt: frame * HIT_FRAME_MELEE };
}

/** The foe: its kind's entity at a level that telegraphs (TELL7's tier - BLOW_TIER_LEVEL at least), or an elite. */
export function makeFoe(type, { elite = false } = {}) {
  const basics = ENEMY_BASICS[type];
  const entity = makeEnemyEntity(type, basics, null, 10);
  if (elite) promoteEliteFoe(entity, { checkLevel: false });
  else entity.level = Math.max(entity.level ?? 1, BLOW_TIER_LEVEL);
  const weight = enemyWeightClassicUnits(false, 'male', basics.weight ?? 0, entity.items ?? []);
  return { entity, weight, poise: poiseOf(entity, weight) };
}

/** The least metal that bites a kind (DFU's MinMetalToHit: a werewolf silver, a Daedra Lord mithril), steel at least. */
export const metalFor = (type) => Math.max(1, ENEMY_BASICS[type]?.minMetalToHit ?? -1);
const METAL = Object.freeze({ 1: 'steel', 2: 'silver', 5: 'mithril' });

/** One fight, `seconds` long: the player at the origin facing the foe 4 m off; `mode` 'trade' (swing whenever it is in
 *  reach) or 'dodge' (no swing; out of each wind-up's shape by FAIR_TO_70 of it, then still). Answers its counts. */
export function fight({ type, weapon, elite = false, mode = 'trade', seconds = 30, seed = 1 }) {
  const rand = seeded(seed);
  const was = Math.random, wasDf = getSeed();
  Math.random = rand;
  setSeed(seed);   // AUDIT FEUD: DFU's stream too - a fight was the order it ran in, not its seed
  let T = 0;
  setTacticsClock(() => T);
  resetTactics(); resetBlows();
  try {
    const foe = makeFoe(type, { elite });
    const player = weapon ? makePlayer(weapon, { material: metalFor(type) }) : null;
    const ent = foe.entity;
    const { ai, atk } = foeMotor(ent);
    const p = [0, 0, 0];
    const out = { windups: 0, iron: 0, struck: 0, broken: 0, hitsOnMe: 0, hitsOut70: 0, swings: 0 };
    let down = { downUntil: -Infinity, guardUntil: -Infinity };
    let blow = null, out70 = false, leaveAt = 0, landedOn = false;
    let swingT = rand() * (player?.swing ?? 1), struck = false;
    for (let step = 0; step < Math.round(seconds / DT); step++) {
      T += DT;
      const fx = ai.feet[0] - p[0], fz = ai.feet[2] - p[2];
      noteLocalPlayer(p, [fx, 0, fz]);
      ai.update(DT, p);
      atk.update(DT, ai, p);
      const s = ai._tac;
      const b = s?.state === 'windup' && s.key === LOCAL_TARGET ? s.blow : null;
      if (b && b !== blow) {   // a new wind-up at me
        blow = b; out70 = false; landedOn = false;
        if (b.guard === 'iron') out.iron++; else out.windups++;
        leaveAt = b.start + rand() * TARGETS.FAIR_TO_70 * (b.land - b.start);
      }
      if (mode === 'dodge' && blow && T < blow.land) {
        const share = (T - blow.start) / (blow.land - blow.start);
        if (T >= leaveAt && share <= TARGETS.FAIR_TO_70 && inBlow(blow, p[0], p[2])) stepOut(blow, p);
        if (share >= TARGETS.FAIR_TO_70) out70 = !inBlow(blow, p[0], p[2]);
      }
      if (ai._blowFx) {   // the brain stamped a landing that hit me (TELL6e)
        out.hitsOnMe++;
        if (mode === 'dodge' && out70) out.hitsOut70++;
        down = player ? landOnMe(ai, ent, type, player, T, down) : (ai._blowFx = null, down);
      }
      if (mode === 'trade' && player) {
        const d = Math.hypot(fx, fz);
        if (T >= down.downUntil) swingT += DT;   // AUDIT FEUD 2: knocked down, the swing stands (the rig's `paralyzed`)
        if (swingT >= player.swing) { swingT -= player.swing; struck = false; out.swings++; }
        if (!struck && swingT >= player.hitAt) {
          struck = true;   // AUDIT FEUD 2: the hit frame is a moment - out of reach then, the swing missed
          const dmg = d <= REACH ? calculateAttackDamage(player.entity, ent, { weapon: player.item }) : 0;
          const live = s?.state === 'windup' ? s.blow : null;
          let word = null;
          if (dmg > 0 && live) {
            if (live === blow && !landedOn && live.guard !== 'iron') { landedOn = true; out.struck++; }
            const v = blowWeight(dmg, blowK({ kind: 'melee', weapon: player.item }), { back: behind(live.origin, live.yaw, p) });
            word = windupStruck(ai, ent, foe.weight, v);
            if ((word === 'stagger' || word === 'break') && live === blow) { out.broken++; blow = null; }
          }
          if (dmg > 0) knockFoe(ai, type, foe.weight, dmg, word, p);
        }
      }
    }
    return out;
  } finally {
    Math.random = was;
    setSeed(wasDf);
    setTacticsClock(null);
  }
}

/** Out of the shape, sideways to its line, by the least step that clears it and a quarter metre more. */
function stepOut(b, p) {
  const sx = Math.cos(b.yaw), sz = -Math.sin(b.yaw);
  for (let d = 0.1; d < 12; d += 0.1) {
    for (const sg of [1, -1]) {
      const x = p[0] + sx * d * sg, z = p[2] + sz * d * sg;
      if (!inBlow(b, x, z) && !inBlow(b, x + sx * 0.25 * sg, z + sz * 0.25 * sg)) { p[0] = x + sx * 0.25 * sg; p[2] = z + sz * 0.25 * sg; return; }
    }
  }
}

/** A cell: `fights` fights summed. */
export function cell(opts, fights) {
  const sum = { windups: 0, iron: 0, struck: 0, broken: 0, hitsOnMe: 0, hitsOut70: 0, swings: 0 };
  for (let i = 0; i < fights; i++) { const r = fight({ ...opts, seed: 0x5eed + i * 7919 }); for (const k of Object.keys(sum)) sum[k] += r[k]; }
  return sum;
}

/** MASSIVE: each weapon's largest single blow at a giant's front, against the poise of the weakest giant DFU rolls -
 *  from `rolls` rolls, steel and daedric, the reference player and the strongest. */
export function massive(rolls = 20000) {
  const g = makeFoe(M.Giant);
  const weakest = { ...g.entity, maxHealth: ENEMY_BASICS[M.Giant].minHealth, health: ENEMY_BASICS[M.Giant].minHealth };
  const P = poiseOf(weakest, g.weight);
  const rows = [];
  for (const weapon of ['Dagger', 'Longsword', 'Dai_Katana', 'Claymore', 'Mace', 'Flail', 'Warhammer', 'War_Axe', 'Battle_Axe']) {
    for (const [material, metal] of [[1, 'steel'], [9, 'daedric']]) {
      for (const [who, o] of [['reference', {}], ['strongest', { level: 30, skill: 100, strength: 100 }]]) {
        const pl = makePlayer(weapon, o);
        pl.item = createWeapon(WEAPONS[weapon], material, () => 0.5); pl.entity.items = [pl.item];
        const rand = seeded(rolls + weapon.length * 31 + material);
        const was = Math.random, wasDf = getSeed(); Math.random = rand; setSeed(rolls + weapon.length * 31 + material);
        let max = 0;
        try { for (let i = 0; i < rolls; i++) max = Math.max(max, calculateAttackDamage(pl.entity, { ...g.entity }, { weapon: pl.item })); } finally { Math.random = was; setSeed(wasDf); }
        const v = blowWeight(max, blowK({ kind: 'melee', weapon: pl.item }));
        rows.push({ weapon, metal, who, maxDamage: max, maxV: +v.toFixed(2), poise: +P.toFixed(2), share: +(v / P).toFixed(3) });
      }
    }
  }
  return { foe: 'Giant', class: weightClass(g.weight), health: ENEMY_BASICS[M.Giant].minHealth, rows };
}

const FOES = [['Orc', M.Orc, false], ['Orc (elite)', M.Orc, true], ['Werewolf', M.Werewolf, false], ['Daedra Lord', M.DaedraLord, false], ['Giant', M.Giant, false]];

export function measureAll({ fights = 1000, seconds = 30 } = {}) {
  const trade = [];
  for (const weapon of ['Dagger', 'Longsword', 'Warhammer']) {
    for (const [name, type, elite] of FOES) {
      const r = cell({ type, weapon, elite, mode: 'trade', seconds }, fights);
      const f = makeFoe(type, { elite });
      trade.push({ weapon, foe: name, class: weightClass(f.weight), metal: METAL[metalFor(type)] ?? String(metalFor(type)), ...r, ofAll: r.windups ? +(r.broken / r.windups).toFixed(3) : null, breakShare: r.struck ? +(r.broken / r.struck).toFixed(3) : null });
    }
  }
  const fair = [];
  for (const [name, type, elite] of FOES) {
    const r = cell({ type, weapon: null, elite, mode: 'dodge', seconds }, fights);
    fair.push({ foe: name, windups: r.windups + r.iron, hitsOnMe: r.hitsOnMe, hitsOut70: r.hitsOut70 });
  }
  const m = massive();
  const light = trade.find((x) => x.weapon === 'Dagger' && x.foe === 'Orc');
  const heavy = trade.find((x) => x.weapon === 'Warhammer' && x.foe === 'Orc');
  const verdict = {
    LIGHT: { share: light.breakShare, held: light.breakShare != null && light.breakShare <= TARGETS.LIGHT_MAX },
    HEAVY: { share: heavy.breakShare, held: heavy.breakShare != null && heavy.breakShare >= TARGETS.HEAVY_MIN },
    MASSIVE: { worst: Math.max(...m.rows.map((x) => x.share)), held: m.rows.every((x) => x.share < 1) },
    FAIR: { hits: fair.reduce((a, x) => a + x.hitsOut70, 0), held: fair.every((x) => x.hitsOut70 === 0) },
  };
  return { fights, seconds, trade, fair, massive: m, verdict };
}

// ── AUDIT FEUD: RVN's targets (section 28) ──────────────────────────────────────────────────────────────────────────
// A revenant at a rank - its record stood on the real foe (systems/revenant.js applyRevenant: its rank's health and
// blows, its weakness's edge, its signature, its stamp the brain reads), its fight's ledger the real one (the strike
// listener's weak blows, the poise door's staggers - scenes/hostCombat.js windupDoor), its down the pools' own law
// (systems/revenantFate.js: its last stand from rank 3 - the roar no blow reaches, phase two - then its will: broken, it
// kneels; unbroken, it tears away). The player trades blows, or dodges PERFECTLY: in the shape until the brain's late
// sample (TELL4's TELL_LATE), out of it before the landing - then the overreach it earned, x1.3 and its first blow a
// stagger. Both swing whenever the foe is in reach; an iron slam, ring or charge that lands and does damage knocks the
// trader down (BLOW_EFFECT.KNOCKDOWN_S - its swing stands meanwhile, as the rig's `paralyzed` holds it). AUDIT FEUD 2: the
// pools' own steps besides - a swing whose hit frame finds the foe out of reach misses, every landed blow the poise did not
// hold shoves the foe (DFU's knockback, C15), the foe's live Speed (phase two's +20), its signature from rank 2, the
// dodger back in only once the brain has judged the landing. Never modelled: a flight (the chase is not the duel), the
// player's own health, the band (its followers, rank 5's rally at its stand).
globalThis.localStorage ??= (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
const RV = await import('../src/systems/revenant.js');
const FATE = await import('../src/systems/revenantFate.js');
const { windupDoor } = await import('../src/scenes/hostCombat.js');
const { beginRoar } = await import('../src/ai/tactics.js');
const { weaponFeudClass, drawSignature, SIG_RANK } = await import('../src/systems/revenantFeud.js');
const { walkSpeed } = await import('../src/player/motor.js');

/** Section 28's RVN targets: the telegraphed blows a perfect dodger takes, at most this share of a trader's, its time to
 *  the end no longer (FEUD BALANCE, OPEN 24 - it was its time, at most 0.75 of the trader's); the will's kneels; a rank-5's
 *  time over a rank-1's in this band ("about 2.5 times"). */
export const FEUD_TARGETS = Object.freeze({ DODGE_SPARES: 0.1, KNEEL_WEAK: 0.9, KNEEL_DODGE: 0.7, KNEEL_TRADE_MAX: 0.2, RANK_RATIO: Object.freeze([2, 3]) });
const WALK = walkSpeed(50);   // player/motor.js: DFU's walk at Speed 50 (4.43 m/s)
const CLOSE = 0.25;           // the dodger and the trader close to this inside their reach
const FEUD_ME = Object.freeze({ isPlayer: true, name: 'Duelist', characterId: 'char-duel', level: 10, items: [] });

/** One revenant fight to its end (or `seconds`): the player 4 m off its front; `weak` - the player's weapon is of its
 *  weakness (else its weakness is fire, which a blade never strikes). Answers how it ended ('knelt', 'tore' - its will
 *  held - or 'time'), when (s), and its counts. */
export function revenantFight({ type = M.Orc, weapon = 'Longsword', rank = 3, mode = 'trade', weak = false, seconds = 240, seed = 1 } = {}) {
  const rand = seeded(seed);
  const was = Math.random, wasOn = getPref('lootRarity'), wasDf = getSeed();
  Math.random = rand;
  setSeed(seed);   // DFU's stream, the fight's own
  setPref('lootRarity', true);   // the revenants' switch - for this fight alone (TELL's cells stand as they were measured)
  let T = 0;
  setTacticsClock(() => T);
  resetTactics(); resetBlows();
  RV._resetRevenantForTests(); globalThis.localStorage.clear();
  try {
    const foe = makeFoe(type);
    const ent = foe.entity;
    ent.level = Math.max(ent.level | 0, RV.REVENANT_MIN_LEVEL);
    const player = makePlayer(weapon, { material: metalFor(type) });
    const r = RV.revenantDeed(FEUD_ME, { mobileType: type, level: ent.level, champion: 'mighty', health: 1, maxHealth: 50, team: 'Monster', _voiceId: `duel-${seed}` }, 'fled', { mobileType: type, rolls: () => 0, now: 1 });   // AUDIT FEUD 2: its id the seed's - its draws (name, personality, signature) with it
    Object.assign(r, { rank, learned: [], wrath: 0, weak: weak ? weaponFeudClass(player.item).cls : 'fire', out: false });
    if (rank >= SIG_RANK && !r.sig) r.sig = drawSignature(r.id, r.mobileType);   // AUDIT FEUD 2: its signature, as a deed that ranks it to 2 draws it
    RV.applyRevenant(ent, r, { now: 2 });
    const { ai, atk } = foeMotor(ent);
    const f = { entity: ent, ai, mobileType: type, gender: 'male', dead: false };
    const p = [0, 0, 0];
    const out = { end: 'time', t: seconds, staggers: 0, weak: 0, stood: false, windups: 0, overreach: 0, hitsOnMe: 0, perfect: 0, swings: 0, sig: !!ent.revenant?.sigBlow };
    let lastState = null;
    let blow = null, down = { downUntil: -Infinity, guardUntil: -Infinity };
    let swingT = rand() * player.swing, struck = false;
    const done = (end) => { const l = ent._feud ?? {}; Object.assign(out, { end, t: +T.toFixed(3), staggers: l.staggers | 0, weak: l.weak | 0, perfect: l.perfect | 0 }); return out; };
    for (let step = 0; step < Math.round(seconds / DT); step++) {
      T += DT;
      const fx = ai.feet[0] - p[0], fz = ai.feet[2] - p[2];
      noteLocalPlayer(p, [fx, 0, fz]);
      FATE.roarStep(f, T * 1000);
      ai.update(DT, p);
      atk.update(DT, ai, p);
      const s = ai._tac;
      const b = s?.state === 'windup' && s.key === LOCAL_TARGET ? s.blow : null;
      if (b && b !== blow) { blow = b; out.windups++; }
      if (s?.state === 'overreach' && lastState !== 'overreach') out.overreach++;
      lastState = s?.state ?? null;
      // the perfect dodge: inside at the brain's late sample (its first 16 Hz turn inside TELL_LATE of the landing - by
      // TELL_LATE less a turn), out before the landing: half TELL_LATE before it
      if (mode === 'dodge' && blow && T >= blow.land - TELL.TELL_LATE / 2 && T < blow.land && inBlow(blow, p[0], p[2])) stepOut(blow, p);
      if (ai._blowFx) { out.hitsOnMe++; down = landOnMe(ai, ent, type, player, T, down); }   // a landing that hit me (TELL6e)
      // back into reach at a walk (DFU's at Speed 50) - the dodger once the wind-up it left has been judged (AUDIT FEUD 2:
      // the brain's next 16 Hz turn after its landing - walking back at the landing itself walked into it)
      const d = Math.hypot(fx, fz);
      if (d > REACH - CLOSE && T >= down.downUntil && !(mode === 'dodge' && blow && T < blow.land + CLASSIC_UPDATE_INTERVAL)) {
        const k = Math.min(WALK * DT, d - (REACH - CLOSE)) / d;
        p[0] += fx * k; p[2] += fz * k;
      }
      if (T >= down.downUntil) swingT += DT;   // AUDIT FEUD 2: knocked down, the swing stands (the rig's `paralyzed`)
      if (swingT >= player.swing) { swingT -= player.swing; struck = false; out.swings++; }
      if (struck || swingT < player.hitAt) continue;
      struck = true;   // AUDIT FEUD 2: the hit frame is a moment - out of reach then, the swing missed
      if (Math.hypot(ai.feet[0] - p[0], ai.feet[2] - p[2]) > REACH) continue;
      if (FATE.fateHeld(f) || f.roaring) continue;   // the pools' door: no blow reaches it
      const dmg = calculateAttackDamage(player.entity, ent, { weapon: player.item });
      if (!(dmg > 0)) continue;
      ent.health -= dmg;
      if (ent.health <= 0) {
        if (FATE.revenantLastStandDue(f)) { FATE.beginLastStand(FEUD_ME, f, { now: T * 1000, clock: T, roar: (sec) => beginRoar(ai, ent, sec), rolls: rand }); out.stood = true; continue; }
        return done(FATE.revenantWillHolds(f) ? 'tore' : 'knelt');
      }
      const word = s?.state === 'windup' || s?.state === 'overreach' ? windupDoor(f, dmg, { kind: 'melee', weapon: player.item, from: p, weight: foe.weight }) : null;
      knockFoe(ai, type, foe.weight, dmg, word, p);   // AUDIT FEUD 2: DFU's shove, as the pools write it
    }
    return done('time');
  } finally {
    Math.random = was;
    setSeed(wasDf);
    setPref('lootRarity', wasOn);
    setTacticsClock(null);
  }
}

/** A revenant cell: `fights` fights - how they ended, and the mean and median time to the end. */
export function revenantCell(opts, fights) {
  const rows = [];
  for (let i = 0; i < fights; i++) rows.push(revenantFight({ ...opts, seed: 0xfe0d + i * 7919 }));
  const ts = rows.map((x) => x.t).sort((a, b) => a - b);
  const n = (end) => rows.filter((x) => x.end === end).length;
  const sum = (k) => rows.reduce((a, x) => a + x[k], 0);
  return {
    raw: { mean: sum('t') / fights, hitsOnMe: sum('hitsOnMe') / fights },   // AUDIT FEUD 2: the verdict's ratios, unrounded
    fights, knelt: n('knelt'), tore: n('tore'), time: n('time'),
    kneel: +(n('knelt') / fights).toFixed(3),
    mean: +(ts.reduce((a, x) => a + x, 0) / fights).toFixed(2), median: ts[Math.floor(fights / 2)],
    stood: rows.filter((x) => x.stood).length, staggers: +(rows.reduce((a, x) => a + x.staggers, 0) / fights).toFixed(2),
    perfect: +(rows.reduce((a, x) => a + x.perfect, 0) / fights).toFixed(2), hitsOnMe: +(rows.reduce((a, x) => a + x.hitsOnMe, 0) / fights).toFixed(2),
    windups: +(rows.reduce((a, x) => a + x.windups, 0) / fights).toFixed(2), overreach: +(rows.reduce((a, x) => a + x.overreach, 0) / fights).toFixed(2),
    twoStaggers: +(rows.filter((x) => x.staggers >= 2).length / fights).toFixed(3),
  };
}

/** AUDIT FEUD 2: RVN's targets read off a measure's cells (`duel` the rank-3 cells, `ranks` the longsword's by rank) -
 *  the reference longsword's; each ratio from the cells' unrounded means. */
export function feudVerdict(duel, ranks) {
  const at = (weapon, mode, weak) => duel.find((x) => x.weapon === weapon && x.mode === mode && x.weak === weak);
  const T = FEUD_TARGETS;
  const ratio = (mode) => +(ranks.find((x) => x.mode === mode && x.rank === 5).raw.mean / ranks.find((x) => x.mode === mode && x.rank === 1).raw.mean).toFixed(2);
  const ref = 'Longsword';
  const verdict = {
    DODGE_PAYS: { struck: +(at(ref, 'dodge', false).raw.hitsOnMe / at(ref, 'trade', false).raw.hitsOnMe).toFixed(3), time: +(at(ref, 'dodge', false).raw.mean / at(ref, 'trade', false).raw.mean).toFixed(3), held: at(ref, 'dodge', false).raw.hitsOnMe <= T.DODGE_SPARES * at(ref, 'trade', false).raw.hitsOnMe && at(ref, 'dodge', false).raw.mean <= at(ref, 'trade', false).raw.mean },
    WILL_WEAK: { kneel: at(ref, 'trade', true).kneel, held: at(ref, 'trade', true).kneel >= T.KNEEL_WEAK },
    WILL_DODGE: { kneel: at(ref, 'dodge', false).kneel, held: at(ref, 'dodge', false).kneel >= T.KNEEL_DODGE },
    WILL_TRADE: { kneel: at(ref, 'trade', false).kneel, held: at(ref, 'trade', false).kneel <= T.KNEEL_TRADE_MAX },
    RANKS: { trade: ratio('trade'), dodge: ratio('dodge'), held: ['trade', 'dodge'].every((m) => ratio(m) >= T.RANK_RATIO[0] && ratio(m) <= T.RANK_RATIO[1]) },
  };
  return verdict;
}

export function measureFeud({ fights = 1000, weapons = ['Dagger', 'Longsword', 'Warhammer'] } = {}) {
  const duel = [];
  for (const weapon of weapons) {
    for (const mode of ['trade', 'dodge']) duel.push({ weapon, mode, weak: false, rank: 3, ...revenantCell({ weapon, mode, rank: 3 }, fights) });
    duel.push({ weapon, mode: 'trade', weak: true, rank: 3, ...revenantCell({ weapon, mode: 'trade', rank: 3, weak: true }, fights) });
  }
  const ranks = [];
  for (const mode of ['trade', 'dodge']) for (let rank = 1; rank <= 5; rank++) ranks.push({ weapon: 'Longsword', mode, rank, ...revenantCell({ weapon: 'Longsword', mode, rank }, fights) });
  const verdict = feudVerdict(duel, ranks);
  return { fights, duel, ranks, verdict };
}

if (isMain(import.meta.url)) {
  const arg = (n, d) => (process.argv.includes(n) ? Number(process.argv[process.argv.indexOf(n) + 1]) : d);
  const t0 = Date.now();
  const wantFeud = process.argv.includes('--feud'), wantTell = process.argv.includes('--tell');
  const onlyFeud = wantFeud && !wantTell, onlyTell = wantTell && !wantFeud;   // AUDIT FEUD 2: both named, both run
  const r = onlyFeud ? null : measureAll({ fights: arg('--fights', 1000), seconds: arg('--seconds', 30) });
  const fr = onlyTell ? null : measureFeud({ fights: arg('--fights', 1000) });
  if (process.argv.includes('--json')) console.log(JSON.stringify({ tell: r, feud: fr }, null, 2));
  else if (r) {
    console.log(`THE DUEL HARNESS - ${r.fights} fights a cell, ${r.seconds} s each (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    console.log('TRADING BLOWS at the foe\'s front: wind-ups at me (poise), those my blows landed on, broken - of those, and of all; iron apart');
    const pct = (v) => (v == null ? '    -' : `${(v * 100).toFixed(1).padStart(5)}%`);
    for (const x of r.trade) console.log(`  ${x.weapon.padEnd(10)} ${x.metal.padEnd(8)} ${x.foe.padEnd(12)} ${x.class.padEnd(8)} wind-ups ${String(x.windups).padStart(6)}  struck ${String(x.struck).padStart(6)}  broken ${String(x.broken).padStart(6)}  ${pct(x.breakShare)} of struck  ${pct(x.ofAll)} of all  iron ${x.iron}`);
    console.log('\nDODGING (out of the shape by 70% of its wind-up): blows that landed on me anyway');
    for (const x of r.fair) console.log(`  ${x.foe.padEnd(12)} wind-ups ${String(x.windups).padStart(6)}  landed out of the shape ${x.hitsOut70}  (landed at all ${x.hitsOnMe})`);
    console.log(`\nMASSIVE (${r.massive.foe}, ${r.massive.class}, the weakest roll: ${r.massive.health} health): each weapon's largest single front blow against its poise`);
    for (const x of r.massive.rows) console.log(`  ${x.weapon.padEnd(10)} ${x.metal.padEnd(8)} ${x.who.padEnd(10)} max ${String(x.maxDamage).padStart(3)}  v ${String(x.maxV).padStart(6)}  P ${x.poise}  ${(x.share * 100).toFixed(1)}%`);
    console.log('\nTARGETS');
    for (const [k, v] of Object.entries(r.verdict)) console.log(`  ${v.held ? 'held  ' : 'MISSED'} ${k} ${JSON.stringify(v)}`);
  }
  if (fr && !process.argv.includes('--json')) {
    const pct = (v) => `${(v * 100).toFixed(1).padStart(5)}%`;
    console.log(`\nTHE REVENANT (an Orc revenant, ${fr.fights} fights a cell, to its end): how it ended, the time to the end, its staggers and my perfect dodges a fight`);
    for (const x of fr.duel) console.log(`  ${x.weapon.padEnd(10)} rank ${x.rank} ${x.mode.padEnd(6)} ${x.weak ? 'its weakness' : 'plain       '}  knelt ${pct(x.kneel)}  mean ${String(x.mean).padStart(6)} s  median ${String(x.median).padStart(7)} s  staggers ${x.staggers}  two+ ${pct(x.twoStaggers)}  perfect ${x.perfect}  wind-ups ${x.windups}  blows on me ${x.hitsOnMe}`);
    console.log('\nTHE RANKS (a Longsword): the time to the end');
    for (const x of fr.ranks) console.log(`  rank ${x.rank} ${x.mode.padEnd(6)} knelt ${pct(x.kneel)}  mean ${String(x.mean).padStart(6)} s  median ${String(x.median).padStart(7)} s  stood ${x.stood}`);
    console.log('\nRVN TARGETS');
    for (const [k, v] of Object.entries(fr.verdict)) console.log(`  ${v.held ? 'held  ' : 'MISSED'} ${k} ${JSON.stringify(v)}`);
  }
  process.exit([...Object.values(r?.verdict ?? {}), ...Object.values(fr?.verdict ?? {})].every((v) => v.held) ? 0 : 1);
}
