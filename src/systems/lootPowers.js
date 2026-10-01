// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT4 (2026-10-01) — THE KIT: WHAT A PIECE DOES.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 6; Mac: "Do you
// wanna turn this into an arc and do all of the above?"). LR1's six
// affix kinds are numbers a wearer carries, folded onto the entity
// (systems/lootRarity.js affixFold). Five more DO something, and they do
// it here, through the seams the Sigil Sets opened (SET2) - registered at
// import, each a no-op for anyone but MY entity, offline and online:
//
//   elemental   the BLOW modifier: that much of its element on every
//               blow of the weapon in hand at a foe - none on a foe
//               IMMUNE to it, half on one that RESISTS (the career's
//               own word, spellcast.js careerTolerance)
//   slayer      the BLOW modifier: that much more (%) of the weapon in
//               hand's blow at its kind of foe (DFU's own four groups:
//               combat/formulas.js enemyEntityGroup)
//   leech       a STRIKE listener (the blow that LANDED, its final
//               damage): that share of it heals me, the fraction carried
//   thorns      a LANDED-BLOW listener (sigilSetPowers.js - the one law
//               of a foe's blow that took my health): the foe takes that
//               much back, all I wear summed under THORNS_CAP
//   focus       a CAST COST modifier: that share off my spells'
//               magicka, all I wear summed under FOCUS_CAP
//
// NEVER ON A PLAYER (the arc's law 5): a blow at a player is a duel's,
// and the blow modifier refuses it; a duel's blow at me passes my damage
// door without asking the port (playerEntity.js hurtPlayer's `spare`),
// so no thorn answers it. The gate's Warden is out of every reach, as he
// is the sets' (his ward turns a blow whole; his strikes carry no mark).
// ═══════════════════════════════════════════════════════════════════

import { registerWeaponBlowMod } from './entityMods.js';
import { registerPlayerStrikeListener, enemyEntityGroup, ENEMY_GROUPS } from '../combat/formulas.js';
import { registerSpellCostMod } from './spellcost.js';
import { registerPlayerBlowLanded } from './sigilSetPowers.js';
import { playerDoor } from './playerDoor.js';
import { careerTolerance, EFFECT_FLAGS } from './spellcast.js';
import { lootRarityOn, validAffix } from './lootRarity.js';
import { equipTableOf } from './equip.js';

/** All the thorns a wearer's pieces sum to, at most, a blow. */
export const THORNS_CAP = 25;
/** All the focus a wearer's pieces sum to, at most (%). */
export const FOCUS_CAP = 30;

const mine = (e) => !!e?.isPlayer && !e.peer;
/** A piece's valid lines of one kind - none with the switch off (off is DFU exactly). */
export function linesOf(item, id) {
  if (!lootRarityOn() || !Array.isArray(item?.affixes)) return [];
  return item.affixes.filter((a) => a?.id === id && validAffix(a));
}
/** What MY entity wears - the equip table's pieces. */
export const wornPieces = (entity) => (entity ? equipTableOf(entity).filter(Boolean) : []);
/** A kind's lines summed over everything worn. */
export const wornSum = (entity, id) => wornPieces(entity).reduce((n, it) => n + linesOf(it, id).reduce((m, a) => m + a.value, 0), 0);

/** The kind of foe a slayer's edge reads - DFU's own four groups (FormulaHelper.GetEnemyGroup): a class foe (the Human
 *  affinity) a humanoid, a monster by its career (a vampire undead, a dragonling an animal, an orc a humanoid); an
 *  atronach, the horse and a player none. */
export function foeGroup(target) {
  if (!target || target.isPlayer) return null;
  if (target.affinity === 'Human') return 'humanoid';
  const g = enemyEntityGroup(target.careerIndex);
  return g === ENEMY_GROUPS.Undead ? 'undead' : g === ENEMY_GROUPS.Daedra ? 'daedra' : g === ENEMY_GROUPS.Humanoid ? 'humanoid'
    : g === ENEMY_GROUPS.Animals ? 'animal' : null;
}
const ELEMENT_FLAG = Object.freeze({ fire: EFFECT_FLAGS.Fire, frost: EFFECT_FLAGS.Frost, shock: EFFECT_FLAGS.Shock, poison: EFFECT_FLAGS.Poison });
/** How much of an element a foe takes: none IMMUNE, half when it RESISTS, else whole. */
export function elementShare(target, element) {
  const t = careerTolerance(target?.career ?? {}, ELEMENT_FLAG[element] ?? 0);
  return t === 'Immune' ? 0 : t === 'Resistant' ? 0.5 : 1;
}

// ── the session's memory ───────────────────────────────────────────
/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();   // a weapon's (or my fists') per-cent fraction, carried to its next blow
let _healOwed = 0;            // the leech's fraction, carried to the next heal
/** Heal MY entity by `amount` - the fraction carried, never past its maximum, never a body. */
export function healMine(entity, amount) {
  if (!entity || !(entity.health > 0) || !(amount > 0)) return 0;
  const exact = amount + _healOwed;
  const whole = Math.floor(exact + 1e-9);
  _healOwed = exact - whole;
  if (whole <= 0) return 0;
  const max = Number.isFinite(entity.maxHealth) ? entity.maxHealth : entity.health + whole;
  const before = entity.health;
  entity.health = Math.min(max, entity.health + whole);
  return entity.health - before;
}
/** A per-cent share of a blow, the fraction carried on its weapon (the sets' own law, sigilSetPowers.js setBlow). */
function shareOf(key, damage, pct) {
  const exact = (damage * pct) / 100 + (_carry.get(key) ?? 0);
  const more = Math.floor(exact + 1e-9);
  _carry.set(key, Math.max(0, exact - more));
  return more;
}

// ── the blow: elemental, slayer ─────────────────────────────────────
/**
 * MY weapon's blow at a foe: the slayer's per cents of its kind, taken of the whole blow with the fraction carried, and
 * the elemental's flat sear, each of the weapon IN HAND alone. Nothing for a miss, a blow at a player (a duel), a peer's
 * blow resolved here, a foe's, or the Warden's ward.
 */
export function lootBlow(weapon, damage, attacker, target) {
  if (!(damage > 0) || !mine(attacker) || !target || target.isPlayer || target.warded) return damage;
  let out = damage;
  const group = foeGroup(target);
  let pct = 0;
  for (const a of linesOf(weapon, 'slayer')) if (a.param === group) pct += a.value;
  if (pct > 0) out += shareOf(weapon ?? attacker, damage, pct);
  for (const a of linesOf(weapon, 'elemental')) out += Math.floor(a.value * elementShare(target, a.param));
  return out;
}

// ── the strike: leech ───────────────────────────────────────────────
/** MY blow, LANDED (formulas.js registerPlayerStrikeListener - the final damage at a foe): the leech's share heals me. */
export function lootStrike(attacker, target, damage, weapon) {
  if (!mine(attacker) || !(damage > 0) || !target || target.isPlayer) return;
  let pct = 0;
  for (const a of linesOf(weapon, 'leech')) pct += a.value;
  if (pct > 0) healMine(attacker, (damage * pct) / 100);
}

// ── a foe's blow landed: thorns ────────────────────────────────────
/** A FOE'S BLOW TOOK MY HEALTH (sigilSetPowers.js registerPlayerBlowLanded): the thorns I wear, summed under the cap,
 *  back to the foe that struck - through its own pool's door (systems/playerDoor.js), a kill mine. */
export function lootLanded(entity, attacker, took) {
  if (!mine(entity) || !(took > 0) || !attacker || attacker.isPlayer) return;
  const n = Math.min(THORNS_CAP, wornSum(entity, 'thorns'));
  if (n <= 0) return;
  const door = playerDoor();
  const f = door?.foes().find((x) => x.entity === attacker);
  if (f && !f.dead) door.hurtFoe(f, n);
}

// ── the cast: focus ─────────────────────────────────────────────────
/** MY spell's magicka: the focus I wear off it, summed under the cap. */
export function lootCastCost(entity, sp) {
  if (!mine(entity)) return sp;
  const pct = Math.min(FOCUS_CAP, wornSum(entity, 'focus'));
  return pct > 0 ? (sp * (100 - pct)) / 100 : sp;
}

// ── registered at import ───────────────────────────────────────────
export const LOOT_POWERS = 'lootPowers';
registerWeaponBlowMod(LOOT_POWERS, lootBlow);
registerPlayerStrikeListener(LOOT_POWERS, lootStrike);
registerPlayerBlowLanded(LOOT_POWERS, lootLanded);
registerSpellCostMod(LOOT_POWERS, lootCastCost);

/** Tests only: every carry fresh. */
export function _resetLootPowersForTests() { _carry = new WeakMap(); _healOwed = 0; }
