// SEARCH1 + FOE-CAP (2026-10-03): short aimed pins - the searchables' law (systems/searchables.js), the box that acts
// only when clicked away (ui/actionText.js onClose), and the plain foe's cap and ladder (systems/foeLootCap.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  searchableKind, SEARCH_REACH, SEARCH_COOLDOWN_MINUTES, rollSearchOutcome, rollSearchLoot, pickSearchUndead,
  searchKey, markSearched, searchCooldownLeft, searchLedgerRecord, restoreSearchLedger, markPicked, isPicked,
  searchLockValue, searchMessage, _resetSearchLedgerForTests, SEARCH_FOES_PER_PLAYER,
} from '../src/systems/searchables.js';
import { DOOR_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { capLootList, capFoeLoot, plainFoeLootRule, PLAIN_FOE_RARITY_WEIGHTS } from '../src/systems/foeLootCap.js';
import { rarityChances } from '../src/systems/lootRarity.js';
import { goldStack, isGoldPieces } from '../src/systems/inventory.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('SEARCH1: the models, read off ARCH3D/BLOCKS by their texture archives', () => {
  const ids = [41315, 41319, 41327, 41120, 41006, 41808, 41003, 41812, 41833, 43059, 43082, 43083, 43105, 43142, 41619];
  assert.deepEqual(ids.map(searchableKind),
    ['coffin', 'sarcophagus', 'sarcophagus', null, 'shelf', 'shelf', null, 'chest', 'crate', 'tombstone', 'tombstone', null, null, 'tombstone', null]);
});

test('SEARCH1: half a door\'s reach, five game hours', () => {
  assert.equal(SEARCH_REACH, DOOR_ACTIVATION_DISTANCE / 2);
  assert.equal(SEARCH_COOLDOWN_MINUTES, 300);
});

test('SEARCH1: a third each underground; two in three nothing at a graveyard\'s stone', () => {
  assert.deepEqual([0.33, 0.34, 0.66, 0.67].map((r) => rollSearchOutcome({ rolls: () => r })), ['foe', 'loot', 'loot', 'nothing']);
  assert.deepEqual([0.66, 0.67, 0.83, 0.84].map((r) => rollSearchOutcome({ graveyard: true, rolls: () => r })), ['nothing', 'loot', 'loot', 'foe']);
});

test('SEARCH1: one to four items, the first always gold', () => {
  const mint = { jewellery: () => ({ name: 'ring' }), religious: () => ({ name: 'icon' }), gem: () => ({ name: 'gem' }), weapon: () => ({ name: 'blade' }) };
  const few = rollSearchLoot('coffin', 5, mint, seq(0, 0.5, 0));
  const many = rollSearchLoot('coffin', 5, mint, seq(0.99, 0.5, 0, 0, 0));
  assert.equal(few.length, 1);
  assert.equal(many.length, 4);
  for (const l of [few, many]) { assert.ok(isGoldPieces(l[0])); assert.equal(l.filter(isGoldPieces).length, 1); }
});

test('SEARCH1: the grave\'s undead by level', () => {
  assert.equal(pickSearchUndead(1, () => 0.999), 19);    // a new character: skeleton, zombie, ghost, mummy - no higher
  assert.equal(pickSearchUndead(20, () => 0.999), 33);   // the Ancient Lich stands from level 18
});

test('SEARCH1: the cooldown, the picked lock, and the save that drops what ran out', () => {
  _resetSearchLedgerForTests();
  const a = searchKey('d1', '0:12'), b = searchKey('d1', '0:40');
  markSearched(a, 100);
  assert.equal(searchCooldownLeft(a, 399), 1);
  assert.equal(searchCooldownLeft(a, 400), 0);
  markSearched(b, 1000); markPicked(searchKey('d1', '2:7'));
  restoreSearchLedger(searchLedgerRecord(1100));
  assert.equal(searchCooldownLeft(a, 1100), 0);
  assert.equal(searchCooldownLeft(b, 1100), 200);
  assert.ok(isPicked(searchKey('d1', '2:7')));
});

test('SEARCH1: locks are the place\'s own and only a chest or a crate holds one', () => {
  assert.equal(searchLockValue('coffin', 'd1', '0:1'), 0);
  const v = searchLockValue('chest', 'd77', '3:120');
  assert.equal(v, searchLockValue('chest', 'd77', '3:120'));
  let locked = 0;
  for (let i = 0; i < 300; i++) if (searchLockValue('crate', 'd5', `0:${i}`) > 0) locked++;
  assert.ok(locked > 60 && locked < 140, `about a third locked (${locked})`);
});

test('SEARCH1: the foe\'s message names it, and an elite says so', () => {
  const rows = searchMessage('tombstone', 'foe', { foeName: 'Zombie', elite: true, rolls: () => 0 });
  assert.ok(rows.some((r) => r.includes('A Zombie')));
  assert.equal(rows.at(-1), 'It burns with a cold, unholy light...');
});

test('SEARCH1: the box acts only once it is clicked away, and never when replaced', async () => {
  let n = 0;
  const box = new ActionTextBox(['x'], { onClose: () => n++ });
  await Promise.resolve();
  assert.equal(n, 0);
  box.input(); box.input();
  assert.equal(n, 0);   // deferred past the dismissal
  await Promise.resolve(); await Promise.resolve();
  assert.equal(n, 1);
  const gone = new ActionTextBox(['y'], { onClose: () => n++ });
  gone.dispose(); gone.input();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(n, 1);
});

test('SEARCH1: both dungeon hosts route a search key, the exterior ladder a grave', () => {
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) assert.match(readFileSync(f, 'utf8'), /key\.startsWith\('search:'\)/, f);
  assert.match(readFileSync('src/scenes/worldModes.js', 'utf8'), /startsWith\('grave:'\)/);
});

test('FOE-CAP: who is plain - champions, elites, revenants and bosses are not', () => {
  const lvl = { level: 5 };
  assert.deepEqual(plainFoeLootRule({ level: 5 }, lvl), { cap: 3, plainLadder: true });
  assert.deepEqual(plainFoeLootRule({ level: 5, elite: true }, lvl), { cap: 5, plainLadder: false });
  assert.equal(plainFoeLootRule({ level: 5, champion: 'thorned' }, lvl), null);
  assert.equal(plainFoeLootRule({ level: 5, eliteFoe: true }, lvl), null);
  assert.equal(plainFoeLootRule({ level: 5, revenant: { name: 'x' } }, lvl), null);
  assert.equal(plainFoeLootRule({ level: 18 }, { level: 18 }), null);
  assert.equal(plainFoeLootRule({ level: 5 }, { level: 5, affinity: 'Daedra' }), null);
});

test('FOE-CAP: three at most, gold folded and kept, a quest item never dropped, the best kept', () => {
  const items = [{ name: 'a', value: 5 }, goldStack(10), { name: 'b', value: 50 }, goldStack(7), { name: 'c', value: 1, rarity: 'rare' }, { name: 'q', questItem: true }, { name: 'd', value: 99 }];
  capLootList(items, 3);
  assert.deepEqual(items.map((i) => (isGoldPieces(i) ? `gold${i.stackCount}` : i.name)), ['gold17', 'c', 'q']);
  const e = { lootCap: 3, items: [goldStack(1), { name: 'x' }, { name: 'y' }, { name: 'z' }], eliteFoe: true };
  capFoeLoot(e);
  assert.equal(e.items.length, 4);   // promoted after its spawn: titled by its death
});

test('FOE-CAP: the plain ladder - white the rule, blue rare, yellow very rare, orange almost never', () => {
  const plain = rarityChances({ tier: 8, weights: PLAIN_FOE_RARITY_WEIGHTS });
  assert.deepEqual(plain, { magic: 72, rare: 10.4, legendary: 0.5 });
  const old = rarityChances({ tier: 8 });
  assert.deepEqual(old, { magic: 220, rare: 63, legendary: 10.6 });
});

test('SEARCH1-PARTY: two foes a player, a search is the room\'s container, and a crowd says so', () => {
  assert.equal(SEARCH_FOES_PER_PLAYER, 2);
  const dc = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(dc, /LOOT_KEY_RE = \/\^\(loot\|corpse\|enc\|srch\):/);   // the room's word carries it (WORLD4)
  assert.match(dc, /publishLoot\(`srch:\$\{i\}`\)/);                    // said on every search, whatever it rolled
  assert.match(dc, /canon\.startsWith\('srch:'\)\) searchHeard/);         // and heard as the five hours
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/world.js']) assert.match(readFileSync(f, 'utf8'), /SEARCH_FOES_PER_PLAYER \* \(1 \+/, f);
  assert.equal(searchMessage('crate', 'foe', { foeName: 'Orc', count: 4, rolls: () => 0 }).at(-1), 'And it has brought company.');
  assert.notEqual(searchMessage('crate', 'foe', { foeName: 'Orc', count: 1, rolls: () => 0 }).at(-1), 'And it has brought company.');
});

test('CHAMP-LOOT: no Rare forced onto a champion - Magic and Rare at half a plain foe\'s, its Legendary as it was, every chance under an elite\'s', async () => {
  const LR = await import('../src/systems/lootRarity.js');
  const { ELITE_FOE_LOOT, eliteRareChance } = await import('../src/systems/eliteFoes.js');
  assert.equal(LR.CHAMPION_RARE_CHANCE, undefined);
  assert.doesNotMatch(readFileSync('src/scenes/hostCombat.js', 'utf8'), /ensureChampionLoot/);
  const N = 2;   // eligible pieces on the body
  for (const lv of [3, 8, 12, 17, 21]) {
    const src = LR.corpseSource({ level: lv }, lv, 7);
    const d = rarityChances(src);
    const c = rarityChances(LR.championSource(src));
    assert.equal(c.magic, d.magic / 2, `L${lv}: its Magic at half`);
    assert.equal(c.legendary, rarityChances({ ...src, tier: lv + 2, qualityMult: 1.25 }).legendary, `L${lv}: its Legendary as LOOT7 left it`);
    const eliteRare = 1 - (1 - eliteRareChance(lv)) * (1 - ELITE_FOE_LOOT.legendaryChance) * (1 - d.rare / 1000) ** N;
    const champRare = 1 - (1 - c.rare / 1000) ** N;
    assert.ok(champRare < eliteRare / 2, `L${lv}: under half the elite's (${champRare.toFixed(3)} / ${eliteRare.toFixed(3)})`);
  }
});

test('ELITE-RARE: an elite\'s extra Rare is half a champion\'s blue at its level', async () => {
  const LR = await import('../src/systems/lootRarity.js');
  const { eliteRareChance } = await import('../src/systems/eliteFoes.js');
  const want = { 3: 0.07, 8: 0.104, 12: 0.13, 17: 0.162 };
  for (const [lv, w] of Object.entries(want)) {
    const blue = LR.rarityChances(LR.championSource(LR.corpseSource({ level: +lv }, +lv, null))).magic / 1000;
    assert.equal(eliteRareChance(+lv), 0.5 * (1 - (1 - blue) ** 2));
    assert.ok(Math.abs(eliteRareChance(+lv) - w) < 0.001, `L${lv}: ${eliteRareChance(+lv)}`);
  }
  assert.match(readFileSync('src/systems/eliteFoes.js', 'utf8'), /if \(rolls\(\) < eliteRareChance\(lv\)\)/);
});
