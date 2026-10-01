// FIELD BUGS 2026-10-01 #6 (MANA-HALF, MANA-SHOP) - "Potions are durability. Mages could basically kill for free.
// Potions makes them cost to use magic. Gold sink same as repairs for melee"; Mac chose "Half the pool" and
// "Everywhere, 1 g/point".
//
// A sword wears with every blow and a smith is paid to mend it; online a caster's magicka came back whole and free from
// four seconds of rest anywhere, for every career (REST-MANA1), and the one potion that gives magicka back - Restore
// Power - was sold only by temples and the Dark Brotherhood, to members, a random handful a day, at a flat price. Online
// now a rest gives magicka back up to half the pool (systems/rest.js), and Restore Power is the rest of it: every
// alchemist and the Mages Guild's magic-items counter sell it to anyone, at what it restores at the buyer's level, a
// gold a point (systems/restorePower.js). Offline, Daggerfall's rest, prices and shelves.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { exhaustionOutcome, restMagickaCap, restedMagicka, spellPointRecoveryRate, ONLINE_REST_MAGICKA_SHARE } from '../src/systems/rest.js';
import { restVitals, restFullyHealed } from '../src/scenes/shared.js';
import { maxFatigue } from '../src/systems/statMods.js';
import {
  RESTORE_POWER_KEY, RESTORE_POWER_GOLD_PER_POINT, RESTORE_POWER_SHELF, isRestorePower, restorePowerMagnitude,
  restorePowerCost, restorePowerStack, magesSellRestorePower,
} from '../src/systems/restorePower.js';
import { potionBundle, POTION_RECIPES, potionRecipeKey } from '../src/systems/potions.js';
import { rollMagnitude } from '../src/systems/spellcast.js';
import { createPotion } from '../src/systems/loot.js';
import { buyItemPrice, tradeCost, getTradePrice } from '../src/systems/tradeModes.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { HOLIDAYS } from '../src/systems/holidays.js';
import { GUILDS } from '../src/systems/guilds.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** The recipe table's own keys, by name. */
const POTION_KEYS = Object.fromEntries(POTION_RECIPES.map((r) => [r.name, potionRecipeKey(r.ingredients)]));

/** Run `fn` with the page online (`?online=1`) or off. */
function lane(online, fn) {
  const was = globalThis.location;
  globalThis.location = { search: online ? '?online=1' : '' };
  try { return fn(); } finally { globalThis.location = was; }
}

function createPotionStack(key, n) { const p = createPotion(key); p.stackCount = n; return p; }

function caster({ magicka = 0, maxMagicka = 200 } = {}) {
  const entity = {
    isPlayer: true, level: 10, raceId: 0, name: 'Caster', health: 100, maxHealth: 100, magicka, maxMagicka,
    stats: { strength: 50, intelligence: 80, willpower: 60, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), activeEffects: [], items: [], career: {},
  };
  entity.fatigue = maxFatigue(entity);
  return entity;
}

test('MANA-HALF: online a rested hour fills magicka up to half the pool and no further, and "rest until healed" ends there; offline the whole pool, as Daggerfall', () => {
  assert.equal(ONLINE_REST_MAGICKA_SHARE, 0.5);
  lane(true, () => {
    const e = caster({ magicka: 0, maxMagicka: 201 });
    assert.equal(restMagickaCap(e), 100, 'half the pool, floored');
    let hours = 0;
    while (!restVitals(e) && hours < 48) hours++;
    assert.equal(e.magicka, 100, 'the rest stops at half the pool');
    assert.ok(hours < 48, 'and "rest until healed" ends there');
    assert.equal(restFullyHealed(e), true);
    e.magicka = 99;
    assert.equal(restFullyHealed(e), false, 'below the cap is not healed');
    e.magicka = 180;   // a potion drunk
    restVitals(e);
    assert.equal(e.magicka, 180, 'a rest never takes back what stands above the cap');
    assert.equal(restFullyHealed(e), true);
  });
  lane(false, () => {
    const e = caster({ magicka: 0, maxMagicka: 201 });
    assert.equal(restMagickaCap(e), 201);
    let hours = 0;
    while (!restVitals(e) && hours < 48) hours++;
    assert.equal(e.magicka, 201, 'offline the whole pool');
    e.magicka = 150;
    assert.equal(restFullyHealed(e), false, 'offline "healed" is the full pool');
  });
});

test('MANA-HALF: the collapse\'s rested hour pays magicka up to the cap online, the rate offline; a pool over the cap is paid nothing', () => {
  lane(true, () => {
    const e = caster({ magicka: 95, maxMagicka: 200 });
    assert.equal(spellPointRecoveryRate(e), 25);
    assert.equal(exhaustionOutcome({ entity: e }).magicka, 5, 'up to the cap (100)');
    assert.equal(restedMagicka(e), 5);
    e.magicka = 150;
    assert.equal(exhaustionOutcome({ entity: e }).magicka, 0);
    e.magicka = 0;
    assert.equal(exhaustionOutcome({ entity: e }).magicka, 25, 'the rate, under the cap');
  });
  lane(false, () => {
    const e = caster({ magicka: 95, maxMagicka: 200 });
    assert.equal(exhaustionOutcome({ entity: e }).magicka, 25, 'offline the rate');
  });
});

test('MANA-HALF: a cautious journey\'s nights fill magicka as far as rest does (world.js), never lowering it', () => {
  const src = rd('src/scenes/world.js');
  const at = src.indexOf('if (opts.speedCautious) {');
  assert.ok(at > 0);
  const block = src.slice(at, at + 700);
  assert.match(block, /playerEntity\.magicka = Math\.max\(playerEntity\.magicka \?\? 0, restMagickaCap\(playerEntity\)\);/);
  assert.doesNotMatch(block, /playerEntity\.magicka = playerEntity\.maxMagicka;/);
});

test('MANA-SHOP: a bottle restores 5 + 4 a level - the drink\'s own bundle at the level - and online costs that, a gold a point', () => {
  const bundle = potionBundle(RESTORE_POWER_KEY);
  assert.equal(bundle.name, 'Restore Power');
  for (const level of [1, 5, 10, 20, 30, 47]) {
    const drunk = rollMagnitude(bundle.effects[0], level, () => 0.999);
    assert.equal(restorePowerMagnitude(level), drunk, `the drink's magnitude at ${level}`);
    assert.equal(restorePowerMagnitude(level), 5 + 4 * level);
  }
  assert.equal(RESTORE_POWER_GOLD_PER_POINT, 1);
  const bottle = createPotion(RESTORE_POWER_KEY);
  assert.equal(isRestorePower(bottle), true);
  assert.equal(isRestorePower(createPotion(POTION_KEYS.healing)), false);
  assert.deepEqual([1, 10, 20].map((l) => restorePowerCost(bottle, l, { online: true })), [9, 45, 85]);
  assert.equal(restorePowerCost(bottle, 10, { online: false }), null, 'offline the counter\'s own cost');
  assert.equal(restorePowerCost(bottle, null, { online: true }), null, 'no level, no law');
  const heal = createPotion(POTION_KEYS.healing);
  assert.equal(restorePowerCost(heal, 10, { online: true }), null, 'another potion is the counter\'s');
});

test('MANA-SHOP: online the counter asks what the bottles restore at the buyer\'s level - no shop multiplier, no ESSENTIALS-HALF - and a holiday still halves it; offline Daggerfall\'s price', () => {
  const stack = restorePowerStack(4);
  assert.equal(stack.stackCount, 4);
  const ctx = { quality: 20, priceAdjustment: 1500, buyerLevel: 10 };
  assert.equal(buyItemPrice(stack, { ...ctx, online: true }), 45 * 4);
  assert.equal(buyItemPrice(stack, { ...ctx, online: true, holidayId: HOLIDAYS.Tales_and_Tallow, guildFactionId: GUILDS.MagesGuild.factionId }), 90, 'Tales and Tallow at the Mages Guild');
  const offline = buyItemPrice(stack, { ...ctx, online: false });
  assert.notEqual(offline, 45 * 4);
  assert.equal(offline, buyItemPrice(createPotionStack(POTION_KEYS.restorePower, 4), { quality: 20, priceAdjustment: 1500, online: false }), 'offline the level reads nothing');
  lane(true, () => {
    assert.equal(tradeCost('Buy', [stack], ctx).cost, 180, 'the walk passes the level');
    assert.equal(tradeCost('Buy', [stack], { ...ctx, buyerLevel: 20 }).cost, 340);
    const heal = createPotionStack(POTION_KEYS.healing, 1);
    assert.equal(tradeCost('Buy', [heal], ctx).cost, buyItemPrice(heal, { quality: 20, priceAdjustment: 1500, online: true }), 'every other potion keeps ESSENTIALS-HALF');
  });
});

test('MANA-SHOP: online a bottle sold back is costed as it is sold, so buying to sell back never pays - every level, quality and haggle', () => {
  lane(true, () => {
    const one = restorePowerStack(1);
    for (const level of [1, 3, 10, 25, 60]) {
      for (const quality of [1, 10, 20]) {
        for (const skill of [0, 40, 100]) {
          const skills = { mercantile: skill, personality: skill };
          const ctx = { quality, priceAdjustment: 1000, buyerLevel: level };
          const buy = tradeCost('Buy', [one], ctx), sell = tradeCost('Sell', [one], ctx);
          assert.equal(sell.cost, restorePowerCost(one, level), 'the Sell arm reads the same cost');
          const paid = getTradePrice('Buy', buy.cost, quality, skills, buy.pieces);
          const got = getTradePrice('Sell', sell.cost, quality, skills, sell.pieces);
          assert.ok(got <= paid, `L${level} q${quality} skill ${skill}: sold ${got} for ${paid} paid`);
        }
      }
    }
  });
  const src = rd('src/scenes/worldModes.js');
  assert.match(src, /buyerLevel: effectiveLevel\(playerEntity\),\s+\/\/ MANA-SHOP/, 'the trade window\'s price context carries the level');
  assert.match(src, /const cost = \(restorePowerCost\(it, effectiveLevel\(playerEntity\)\) \?\? calculateCost\(/, 'and the keyed sale');
  assert.match(src, /tradeCost\('Buy', \[it\], \{[^}]*buyerLevel: effectiveLevel\(playerEntity\) \}\)/, 'and the keyed purchase');
});

test('MANA-SHOP: online every alchemist shelves twenty bottles a day after the classic stock, which is unchanged; offline and at any other shop, none', () => {
  const seq = () => { let i = 0; return () => ((i++ * 0.6180339887) % 1); };
  const offline = lane(false, () => stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 12 }, { level: 7 }, { rolls: seq() }));
  const online = lane(true, () => stockShopShelf({ buildingType: BUILDING_TYPES.Alchemist, quality: 12 }, { level: 7 }, { rolls: seq() }));
  assert.equal(offline.some(isRestorePower), false);
  assert.equal(online.length, offline.length + 1);
  assert.deepEqual(online.slice(0, -1), offline, 'the day\'s classic stock is the stock it always was');
  const last = online.at(-1);
  assert.equal(isRestorePower(last), true);
  assert.equal(last.stackCount, RESTORE_POWER_SHELF);
  assert.equal(RESTORE_POWER_SHELF, 20);
  const store = lane(true, () => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 12 }, { level: 7 }, { rolls: seq() }));
  assert.equal(store.some(isRestorePower), false);
});

test('MANA-SHOP: online the Mages Guild\'s magic-items counter sells Restore Power to anyone its magic shelf is closed to, and shelves it beside the magic for a member who may buy', () => {
  const mages = GUILDS.MagesGuild, fighters = GUILDS.FightersGuild;
  assert.equal(magesSellRestorePower(mages, 'BuyMagicItems', { online: true }), true);
  assert.equal(magesSellRestorePower(mages, 'BuyMagicItems', { online: false }), false);
  assert.equal(magesSellRestorePower(mages, 'Training', { online: true }), false);
  assert.equal(magesSellRestorePower(fighters, 'BuyMagicItems', { online: true }), false);
  const src = rd('src/scenes/worldModes.js');
  assert.match(src, /const manaOnly = !access\.allowed && magesSellRestorePower\(guild, service\);\s*\n(?:\s*\/\/.*\n)*\s*if \(!access\.allowed && !manaOnly\) \{/, 'the refusal stands only where no potions are sold');
  assert.match(src, /openServiceFlow\(manaOnly \? 'guildServiceBuyRestorePower' : serviceDestination\(service\)/);
  assert.match(src, /destination === 'guildServiceBuyRestorePower' && tradeDoorReady\(\)\) \{[\s\S]{0,300}guildShelf\('BuyRestorePower', \(\) => \[restorePowerStack\(RESTORE_POWER_SHELF\)\]\)/);
  assert.match(src, /\.concat\(magesSellRestorePower\(guild, 'BuyMagicItems'\) \? \[restorePowerStack\(RESTORE_POWER_SHELF\)\] : \[\]\)\);/);
});
