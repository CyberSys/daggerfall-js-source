// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT7 (2026-10-01) — CHAMPION FOES.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 9; Mac: "Do you
// wanna turn this into an arc and do all of the above?" - "Champion foes.
// Single named foes with visible traits (Fiery, Swift, Vampiric) and a
// guaranteed Rare"). About one foe in twenty of level 3 or more stands as
// a CHAMPION with one TRAIT: twice its health and its blows a quarter
// harder, its trait on top, its name the trait's and its own, and a Rare
// or better ALWAYS on its body (scenes/hostCombat.js spawnEnemyLoot).
//
// WHO DECIDES. A dungeon's foes are its LAYOUT's, built on every client
// from the location (the elite's way): `markDungeonChampions` marks the
// layout's records by a HASH of the location and the marker, so every
// client stands the same champion with no wire word, and the mark rides
// the record (`src`) through a rebuild or a respawn. A foe in the street
// or a building is its OWNER's: `rollStreetChampion` hashes it, and the foe
// record carries its trait (`cp`, net/wire.js validFoeRecord) to every
// puppet, which wears the same scaling - a puppet's blow resolved on my
// side is a champion's.
//
// OFF IS DFU EXACTLY: with the loot-rarity row off, no champion stands.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn } from './lootRarity.js';
import { registerPlayerStruckListener, registerPlayerStrikeListener } from '../combat/formulas.js';
import { hurtPlayer } from '../characters/playerEntity.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';

/** Per mille of the foes that may be one that stand as a champion. */
export const CHAMPION_PER_MILLE = 50;
/** A champion is a foe of this level or more. */
export const CHAMPION_MIN_LEVEL = 3;
/** Every champion: its health times this, its blows times this. */
export const CHAMPION_HEALTH = 2;
export const CHAMPION_DAMAGE = 1.25;
/** @typedef {{ id: string, name: string, text: string, damage?: number, health?: number, speed?: number, drink?: number, thorns?: number }} ChampionTrait */
/** The traits, in the wire's order (`cp` is the index). @type {ReadonlyArray<Readonly<ChampionTrait>>} */
export const CHAMPION_TRAITS = Object.freeze([
  Object.freeze({ id: 'mighty', name: 'Mighty', text: 'Its blows land half again as hard', damage: 1.5 }),
  Object.freeze({ id: 'stalwart', name: 'Stalwart', text: 'Half again its health, on top of a champion\'s double', health: 1.5 }),
  Object.freeze({ id: 'swift', name: 'Swift', text: 'Thirty more Speed: it closes, and it swings, sooner', speed: 30 }),
  Object.freeze({ id: 'vampiric', name: 'Vampiric', text: 'Half of what its blows take from you heals it', drink: 50 }),
  Object.freeze({ id: 'thorned', name: 'Thorned', text: 'Your blows that land on it hurt you back, a seventh of them', thorns: 7 }),
]);
export const championTrait = (id) => CHAMPION_TRAITS.find((t) => t.id === id) ?? null;
export const championIndex = (id) => CHAMPION_TRAITS.findIndex((t) => t.id === id);
/** A foe's trait, when it stands as a champion, else null. */
export const championOf = (entity) => (entity?.champion ? championTrait(entity.champion) : null);
/** What a champion is called - its trait before its own name ("Mighty Orc Warlord"); anyone else's name as it was. */
export function championName(entity, base) {
  const t = championOf(entity);
  return t && base ? `${t.name} ${base}` : base;
}

/** FNV-1a over a few integers - a mixer of the dungeon's own (the same answer on every client, every load). */
function mix(...ns) {
  let h = 0x811c9dc5;
  for (const n of ns) {
    let v = Math.trunc(Number(n) || 0) >>> 0;
    for (let i = 0; i < 4; i++) { h ^= v & 0xff; h = Math.imul(h, 0x01000193) >>> 0; v >>>= 8; }
  }
  return h >>> 0;
}
/** THE DUNGEON'S CHAMPIONS: every layout record a hash of the location and its place in the list says - its trait
 *  index on the record (`champion`), the rest untouched. A quest's foe is never in the layout. Answers how many. */
export function markDungeonChampions(records, locationKey) {
  if (!lootRarityOn() || !Array.isArray(records)) return 0;
  let n = 0;
  records.forEach((e, i) => {
    if (!e || e.allied || e.champion != null) return;
    const h = mix(locationKey, i, 0x10071);
    if (h % 1000 < CHAMPION_PER_MILLE) { e.champion = (h >>> 10) % CHAMPION_TRAITS.length; n++; }
  });
  return n;
}
/** THE STREET'S: an ordinary encounter's foe (never a quest's, a summons, an ally or a placed camp's - the caller says
 *  which) by the same mixer over where it stands, its type and the pool's count of them - never a draw: the pool's
 *  stream (its loot, its kit) draws as it did, and a test's seeded street stands the same foes every run. A trait's
 *  index or null. */
let _streetN = 0;
export function rollStreetChampion(feet = null, mobileType = 0) {
  if (!lootRarityOn()) return null;
  const h = mix(Math.round((Number(feet?.[0]) || 0) * 64), Math.round((Number(feet?.[2]) || 0) * 64), mobileType, ++_streetN, 0x57ee7);
  return h % 1000 < CHAMPION_PER_MILLE ? (h >>> 10) % CHAMPION_TRAITS.length : null;
}
/** Tests only: the street's count back to none. */
export function _resetStreetChampionsForTests() { _streetN = 0; }

/**
 * MAKE IT A CHAMPION - on its entity, in place, right after the entity is built and BEFORE its loot is rolled (the loot
 * reads the mark): its trait, twice its health (the Stalwart's half again more), its blows a quarter harder (the
 * Mighty's half again more) multiplied onto whatever `damageScale` it has (an elite's double stands under it), the
 * Swift's Speed. Nothing for no trait, a foe under CHAMPION_MIN_LEVEL, the city watch, an ally, or with the switch off.
 * Answers whether it stood as one.
 */
export function applyChampion(entity, traitIndex) {
  if (!entity || !Number.isInteger(traitIndex) || !lootRarityOn()) return false;
  const t = CHAMPION_TRAITS[traitIndex];
  if (!t || (entity.level | 0) < CHAMPION_MIN_LEVEL) return false;
  if (entity.mobileType === KNIGHT_CITY_WATCH || entity.team === 'PlayerAlly' || entity.mobileTeam === 'PlayerAlly') return false;
  entity.champion = t.id;
  const hp = CHAMPION_HEALTH * (t.health ?? 1);
  entity.maxHealth = Math.max(1, Math.round((entity.maxHealth ?? 1) * hp));
  entity.health = entity.maxHealth;
  entity.damageScale = (Number.isFinite(entity.damageScale) ? entity.damageScale : 1) * CHAMPION_DAMAGE * (t.damage ?? 1);
  if (t.speed && entity.stats) entity.stats.speed = Math.min(100, (entity.stats.speed ?? 50) + t.speed);
  return true;
}

// ── the traits that answer a blow ───────────────────────────────────
/** VAMPIRIC: a champion's blow that reached me (formulas.js's struck tail) heals it half of it. */
export function championStruck(attacker, target, damage) {
  const t = championOf(attacker);
  if (!t?.drink || !(damage > 0) || !target?.isPlayer || !(attacker.health > 0)) return;
  attacker.health = Math.min(attacker.maxHealth ?? attacker.health, attacker.health + Math.max(1, Math.round((damage * t.drink) / 100)));
}
/** THORNED: my blow that landed on a champion (formulas.js's strike tail) hurts me a seventh of it, through my one
 *  damage door - a hurt as any other, never a blow of a foe's. */
export function championStrike(attacker, target, damage) {
  const t = championOf(target);
  if (!t?.thorns || !(damage > 0) || !attacker?.isPlayer || attacker.peer) return;
  hurtPlayer(attacker, Math.max(1, Math.round(damage / t.thorns)));
}
export const CHAMPIONS = 'champions';
registerPlayerStruckListener(CHAMPIONS, championStruck);
registerPlayerStrikeListener(CHAMPIONS, championStrike);
