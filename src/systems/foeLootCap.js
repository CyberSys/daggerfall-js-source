// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FOE-CAP (2026-10-03, Mac: "normal enemies that are non Elite or Enemies
// that have something infront of their real name (like thorned) should
// never drop more then 3 items in total max. Gold included. Bosses/
// worldbosses are not affected" ... "dropchances of those normal enemies
// should whites, rare = blue items, very rare = yellow, almost impossible
// = orange" ... "The exception for the rarity changes are elite dungeons.
// And max drop 5 items in Elite dungeons"; and, asked whether a champion
// counts: "champions are not normal").
//
// THE PORT'S OWN, not DFU's: DFU caps nothing and has no ladder.
//
// WHO IS PLAIN. A foe with no title of its own - never an elite foe
// (`eliteFoe`), a LOOT7 champion (`champion`), a revenant (`revenant`) or
// a feature's named foe (`properName`), and never a BOSS by the ladder's
// own law (lootRarity.js corpseSource: a Daedra, or level BOSS_LEVEL and
// up). An Elite DUNGEON's ordinary foe (`elite`, the place's doubling -
// not an elite foe) is plain too, at the larger cap and on the ladder it
// already had.
//
// ONE STAMP, TWO DOORS. spawnEnemyLoot (scenes/hostCombat.js) decides once
// and writes `entity.lootCap`; the cap is applied there, after the whole
// spawn chain, and again by raiseEnemyDeath (scenes/corpseMarker.js) after
// every OnEnemyDeath handler has added its own (food, a mod's find) - so
// "never more than three" holds for what the body actually carries.
// ═══════════════════════════════════════════════════════════════════

import { corpseSource, rarityRank } from './lootRarity.js';
import { isGoldPieces } from './inventory.js';

/** The most a plain foe's body carries, gold included. */
export const PLAIN_FOE_LOOT_CAP = 3;
/** ...and a plain foe's in an Elite Dungeon. */
export const ELITE_DUNGEON_FOE_LOOT_CAP = 5;

/** THE PLAIN FOE'S LADDER (per mille of reaching AT LEAST the tier, lootRarity.js RARITY_WEIGHTS' shape). White is the
 *  rule; Magic (blue) rare - 4% at level 0, 15% at most; Rare (yellow) very rare - 0.4% to 2.5%; Legendary (orange)
 *  almost impossible - 0.01% to 0.2%. Aetheric and Artifact are never rolled by a ladder at all. */
export const PLAIN_FOE_RARITY_WEIGHTS = Object.freeze({
  magic:     Object.freeze({ base: 40,  perTier: 4,    cap: 150 }),
  rare:      Object.freeze({ base: 4,   perTier: 0.8,  cap: 25 }),
  legendary: Object.freeze({ base: 0.1, perTier: 0.05, cap: 2 }),
});

/** Has this foe a title of its own (and so no cap)? */
export const titledFoe = (entity) => !!(entity?.eliteFoe || entity?.champion || entity?.revenant || entity?.properName || entity?.worldBoss);

/**
 * THE RULE for one freshly built foe: its cap and whether its corpse rolls on the plain ladder - or null for a foe the
 * rule leaves alone (titled, or a boss). `elite` is the Elite Dungeon's mark, which the dungeon host writes before the
 * loot is rolled (dungeonContext.js applyEliteScaling).
 * @returns {{ cap: number, plainLadder: boolean } | null}
 */
export function plainFoeLootRule(entity, basics = null) {
  if (!entity || titledFoe(entity)) return null;
  if (corpseSource(basics, entity.level, entity.mobileType).boss) return null;
  const eliteDungeon = !!entity.elite;
  return { cap: eliteDungeon ? ELITE_DUNGEON_FOE_LOOT_CAP : PLAIN_FOE_LOOT_CAP, plainLadder: !eliteDungeon };
}

/**
 * CAP A LIST IN PLACE: gold first (every coin stack folded into the first - one item, its count the sum), then a quest's
 * items (never thrown away, even past the cap), then the rest by tier and then by worth, best first, until the cap.
 * Answers the items dropped.
 * @param {any[]} items
 * @param {number} cap
 */
export function capLootList(items, cap) {
  if (!Array.isArray(items) || !(cap >= 0) || items.length <= cap) return [];
  let gold = null;
  for (const it of items) {
    if (!isGoldPieces(it)) continue;
    if (!gold) gold = it;
    else gold.stackCount = (gold.stackCount | 0) + (it.stackCount | 0);
  }
  const quest = items.filter((it) => it?.questItem && it !== gold);
  const rest = items.filter((it) => it && it !== gold && !isGoldPieces(it) && !it.questItem)
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (rarityRank(b.it) - rarityRank(a.it)) || ((b.it.value ?? 0) - (a.it.value ?? 0)) || (a.i - b.i))
    .map((r) => r.it);
  const keep = [...(gold ? [gold] : []), ...quest];
  for (const it of rest) { if (keep.length >= cap) break; keep.push(it); }
  const kept = new Set(keep);
  const dropped = items.filter((it) => !kept.has(it));
  // in place, in the list's own order (the inventory window reads it as it stands)
  const order = items.filter((it) => kept.has(it));
  items.length = 0;
  items.push(...order);
  return dropped;
}

/** The body's own cap, as its spawn stamped it (`entity.lootCap`); nothing for a foe without one. */
export function capFoeLoot(entity) {
  const cap = entity?.lootCap;
  if (!Number.isInteger(cap) || !Array.isArray(entity.items) || titledFoe(entity)) return [];   // a foe promoted after its spawn (the street's elite) is titled by its death
  return capLootList(entity.items, cap);
}
