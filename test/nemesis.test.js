// NEMESIS (2026-10-02; systems/nemesis.js, Mac: "the ability for these enemies that kill you, or a very small chance
// to flee at low health. These enemies can return at a later time stronger, with a new name, a chance of more loot
// and taunt the player"). The laws pinned here:
//   - WHO: a special foe (an elite, a champion, a nemesis already) of level 3 or more - never the watch, an ally, a
//     quest's foe; off (the loot-rarity row), none.
//   - THE KILL: the blow that kills the player, through the real door - and not one a Stendarr's mercy undoes.
//   - THE NAME: DFU's banks, seeded by the nemesis's id, the shared DFRandom put back; an epithet by the deed, a new
//     one at every rank, the risen ones from rank 3.
//   - THE RETURN: due one to three days on, one at a time, the highest rank first; its rank's health and blows; out
//     until it dies or leaves, then due again.
//   - ITS DROP, ITS WORDS, ITS KEEPING: the save slot and the app's storage merged by revision.
//   - THE HOSTS: the open world's pool runs, escapes, taunts and closes it; the world's roll stands it.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// the app's storage: a plain map in node
const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/nemesis.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { hurtPlayer, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
const { setStruck, _resetSetPowersForTests } = await import('../src/systems/sigilSetPowers.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { getSeed, setSeed } = await import('../src/formats/dfRandom.js');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const { KNIGHT_CITY_WATCH, MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
const { foeTitle } = await import('../src/systems/foeTitle.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (id = 'char-1') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5,
  career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const orc = (over = {}) => ({ mobileType: MOBILE_TYPES.Orc, level: 6, health: 60, maxHealth: 60, team: 'Orcs', champion: 'mighty', ...over });
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const tick = () => new Promise((r) => setTimeout(r, 0));
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetNemesisForTests(); _store.clear(); _resetSetPowersForTests(); setPlayerDoor(null); setAvoidDeathHook(null);
}

test('NEMESIS WHO: a special foe of level 3 or more - an elite, a champion, a nemesis already; never a plain foe, the watch, an ally, a quest\'s foe; off, none (mutants: a plain foe made one; the floor dropped; the watch; off ignored)', () => {
  fresh();
  assert.equal(N.nemesisCandidate(orc()), true, 'a champion');
  assert.equal(N.nemesisCandidate(orc({ champion: undefined, eliteFoe: true })), true, 'an elite');
  assert.equal(N.nemesisCandidate(orc({ champion: undefined, nemesis: { id: 'x' } })), true, 'a nemesis already');
  assert.equal(N.nemesisCandidate(orc({ champion: undefined })), false, 'a plain foe never');
  assert.equal(N.nemesisCandidate(orc({ level: 2 })), false, 'under the floor');
  assert.equal(N.nemesisCandidate(orc({ mobileType: KNIGHT_CITY_WATCH })), false, 'the watch');
  assert.equal(N.nemesisCandidate(orc({ team: 'PlayerAlly' })), false, 'an ally');
  assert.equal(N.nemesisCandidate(orc(), { questBehaviour: {} }), false, 'a quest\'s foe');
  setPref('lootRarity', false);
  assert.equal(N.nemesisCandidate(orc()), false, 'off: none - DFU exactly');
  assert.equal(N.rollNemesisFlee(orc(), () => 0), false, '...and none runs');
});

test('NEMESIS THE NAME: DFU\'s banks seeded by the id - one id, one name, the shared DFRandom left where it was; a person a first name, a beast a monster\'s (mutants: the shared stream moved; an unseeded draw)', () => {
  fresh();
  setSeed(12345);
  const a = N.nemesisGivenName('abc', MOBILE_TYPES.Orc), b = N.nemesisGivenName('abc', MOBILE_TYPES.Orc);
  assert.equal(getSeed(), 12345, 'the shared stream untouched');
  assert.equal(a, b, 'one id, one name');
  assert.match(a, /^[A-Z][a-z'\- ]+$/i);
  assert.notEqual(N.nemesisGivenName('abc', MOBILE_TYPES.Orc), N.nemesisGivenName('a-different-id-entirely', MOBILE_TYPES.Orc) + 'x', 'a name, not a constant');
  const person = N.nemesisGivenName('id-7', 130, 'female');
  assert.ok(person.length > 1 && person !== 'Nameless', `a person's first name (${person})`);
  // epithets: by the deed, a new one each rank, the risen from rank 3, the player's name filled
  assert.ok(N.NEMESIS_EPITHETS.slew.map((e) => e.replace('{p}', 'Ayla')).includes(N.nemesisEpithet('slew', 1, 'Ayla Stormwind', () => 0.99)));
  assert.ok(N.NEMESIS_EPITHETS.fled.includes(N.nemesisEpithet('fled', 2, 'Ayla', () => 0)));
  assert.ok(N.NEMESIS_EPITHETS.risen.map((e) => e.replace('{p}', 'Ayla')).includes(N.nemesisEpithet('fled', 3, 'Ayla', () => 0.5)));
  assert.notEqual(N.nemesisEpithet('slew', 1, 'Ayla', () => 0, 'the Butcher'), 'the Butcher', 'never the one it wears');
});

test('NEMESIS THE KILL: the blow that kills me makes its foe a nemesis through the real door - named at once where it stands, due in one to three days, the player told once alive; a death a Stendarr\'s mercy undoes makes nobody one (mutants: no confirm; the mercy ignored; the name not stood)', async () => {
  fresh();
  const me = player();
  const killer = orc({ health: 60 });
  const rec = { entity: killer, mobileType: MOBILE_TYPES.Orc, gender: 'male', dead: false };
  setPlayerDoor({ foes: () => [rec], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
  // a blow that does not kill: nothing
  setStruck(killer, me, 30); hurtPlayer(me, 30);
  await tick();
  assert.equal(N.livingNemeses().length, 0, 'a wound is no deed');
  // a mercy: the killing blow undone
  setAvoidDeathHook(() => true);
  setStruck(killer, me, 500); hurtPlayer(me, 500);
  await tick();
  assert.equal(N.livingNemeses().length, 0, 'Stendarr\'s mercy: no death, no nemesis');
  setAvoidDeathHook(null);
  me.health = 100;
  setStruck(killer, me, 500); hurtPlayer(me, 500);
  assert.equal(N.livingNemeses().length, 0, 'confirmed once the hurt is done, not inside it');
  await tick();
  const [r] = N.livingNemeses();
  assert.ok(r, 'the killer is a nemesis');
  assert.equal(r.rank, 1); assert.equal(r.kills, 1); assert.equal(r.trait, 'mighty'); assert.equal(r.mobileType, MOBILE_TYPES.Orc);
  assert.ok(r.dueAt >= r.born + N.NEMESIS_RETURN_MIN_MINUTES && r.dueAt <= r.born + N.NEMESIS_RETURN_MAX_MINUTES, 'due in one to three days');
  assert.equal(killer.nemesis.id, r.id, 'the foe over my body wears its name at once');
  assert.equal(foeTitle(killer, 'Orc'), r.name, '...on every surface');
  assert.ok(r.out, 'and stands out in the world');
  assert.equal(N.takeNemesisNotice(me), null, 'dead: nothing said yet');
  me.health = 50;
  const note = N.takeNemesisNotice(me);
  assert.equal(note.kind, 'rise', 'alive again: told once - an event a face draws');
  assert.match(note.line, /that killed you lives on as /, '...and its line for a text surface');
  assert.equal(N.takeNemesisNotice(me), null, '...once');
  // a peer's own hurt, or a blow with no foe behind it, is nobody's
  me.health = 100; const peer = { ...player('p'), peer: true };
  setStruck(killer, peer, 500); hurtPlayer(peer, 500); await tick();
  assert.equal(N.livingNemeses().length, 1);
});

test('NEMESIS DEEDS AND RANKS: killing me again ranks it up with a new epithet; an escape ranks it up too; the rank stops at five and the epithet rises from three; past five nemeses the weakest, oldest is forgotten (mutants: no rank-up; the same epithet kept; no cap)', () => {
  fresh();
  const me = player();
  const e = orc();
  const r = N.nemesisDeed(me, e, 'slew', { now: 1000, rolls: () => 0 });
  const ep1 = r.epithet;
  N.nemesisDeed(me, e, 'slew', { now: 2000, rolls: () => 0 });
  assert.equal(r.rank, 2); assert.equal(r.kills, 2); assert.notEqual(r.epithet, ep1, 'a new name for a new deed');
  N.nemesisDeed(me, e, 'fled', { now: 3000, rolls: () => 0 });
  assert.equal(r.rank, 3); assert.equal(r.escapes, 1); assert.equal(r.out, false, 'an escape is gone');
  assert.ok(N.NEMESIS_EPITHETS.risen.map((x) => x.replace('{p}', 'Ayla')).includes(r.epithet), 'risen from rank three');
  for (let i = 0; i < 5; i++) N.nemesisDeed(me, e, 'slew', { now: 4000 + i, rolls: () => 0.3 });
  assert.equal(r.rank, N.NEMESIS_MAX_RANK, 'five and no more');
  assert.equal(r.history.length <= 12, true);
  // the cap
  for (let i = 0; i < 5; i++) N.nemesisDeed(me, orc({ champion: 'swift' }), 'fled', { now: 9000 + i, rolls: () => 0.5 });
  assert.equal(N.livingNemeses().length, N.NEMESIS_MAX, 'five living at most');
  assert.ok(N.nemesisById(r.id), 'the strongest is kept');
});

test('NEMESIS THE RETURN: not before it is due; then on the roll, the highest rank first, one at a time; it stands with its rank\'s health and blows, its name, a class foe higher; gone unfought it is due again; slain it never comes back (mutants: early; two out at once; no scaling; lost forgotten; the slain returned)', () => {
  fresh();
  const me = player();
  const a = N.nemesisDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  const b = N.nemesisDeed(me, orc({ champion: 'stalwart' }), 'fled', { now: 0, rolls: () => 0 });
  b.rank = 3;
  assert.equal(N.nemesisToReturn(me, { now: 100, rolls: () => 0 }), null, 'not before its time');
  const late = N.NEMESIS_RETURN_MAX_MINUTES + 10;
  assert.equal(N.nemesisToReturn(me, { now: late, rolls: () => 0.99 }), null, 'the roll can pass it by');
  const r = N.nemesisToReturn(me, { now: late, rolls: () => 0 });
  assert.equal(r, b, 'the highest rank first');
  const opt = N.nemesisSpawnOptions(r, 10);
  assert.equal(opt.nemesis, r); assert.equal(opt.level, null, 'a monster is its kind\'s level'); assert.equal(opt.gender, null);
  assert.equal(N.nemesisSpawnOptions({ ...r, mobileType: 130, gender: 'female' }, 10).level, 10 + 3 * N.NEMESIS_LEVEL_PER_RANK, 'a class foe over the player');
  const ent = { maxHealth: 100, health: 100, damageScale: 1.25 };
  assert.equal(N.applyNemesis(ent, r, { now: late }), true);
  assert.equal(ent.maxHealth, Math.round(100 * (1 + N.NEMESIS_HEALTH_PER_RANK * 3)));
  assert.equal(ent.health, ent.maxHealth);
  assert.ok(Math.abs(ent.damageScale - 1.25 * (1 + N.NEMESIS_DAMAGE_PER_RANK * 3)) < 1e-9, 'its blows over its trait\'s');
  assert.equal(ent.nemesis.name, r.name);
  assert.equal(r.out, true); assert.equal(r.returns, 1);
  assert.equal(N.nemesisToReturn(me, { now: late, rolls: () => 0 }), null, 'one out at a time');
  // in the world: present, then gone unfought
  N.nemesisPresence([{ entity: ent, dead: false }], { now: late, wall: Date.now() + 60000 });
  assert.equal(r.out, true, 'still there');
  N.nemesisPresence([], { now: late, wall: Date.now() + 1000 });
  assert.equal(r.out, true, 'a stand crossing its awaits has its grace');
  N.nemesisPresence([], { now: late, wall: Date.now() + 60000 });
  assert.equal(r.out, false, 'gone unfought');
  assert.ok(r.dueAt >= late + N.NEMESIS_LOST_MINUTES, 'and due again later');
  // slain
  assert.equal(N.nemesisSlain(me, ent, { now: late + 1 }), r);
  assert.equal(r.defeated, true);
  assert.equal(N.nemesisSlain(me, ent), null, 'once');
  assert.equal(N.livingNemeses().includes(r), false);
  assert.equal(N.nemesisToReturn(me, { now: late + 99999, rolls: () => 0 }), a, 'the slain never comes back; the other does');
});

test('NEMESIS ITS DROP AND ITS WORDS: gold by level and rank and gear on chances that grow, a Rare always from rank three; a taunt that knows the deed and the player, a beast\'s growl, the flee, the escape and the fall (mutants: no gold; no rank-three Rare; a beast that talks)', () => {
  fresh();
  const low = N.nemesisLoot(10, 1, () => 0.99);
  assert.equal(low.length, 1, 'rank one, unlucky: gold alone');
  assert.equal(low[0].templateIndex !== undefined || low[0].stackCount !== undefined || low[0].group !== undefined, true);
  const high = N.nemesisLoot(10, 3, () => 0.99);
  assert.ok(high.some((i) => i.rarity === 'rare'), 'rank three: a Rare always');
  const e = { nemesis: { id: 'x', rank: 2 }, level: 8, items: [] };
  N.grantNemesisLoot(e, 8, () => 0.5); const n = e.items.length;
  N.grantNemesisLoot(e, 8, () => 0.5);
  assert.equal(e.items.length, n, 'once');
  const r = { name: 'Grushnak the Butcher', given: 'Grushnak', mobileType: MOBILE_TYPES.Orc, rank: 1, kills: 1, history: [{ deed: 'slew', at: 0 }] };
  assert.match(N.nemesisTaunt(r, 'Ayla Stormwind', () => 0), /^Grushnak the Butcher: ".*"$/);
  assert.match(N.nemesisTaunt(r, 'Ayla Stormwind', () => 0), /Ayla|fell/);
  assert.match(N.nemesisTaunt({ ...r, history: [{ deed: 'fled', at: 0 }] }, 'Ayla', () => 0), /finished me, Ayla/);
  assert.match(N.nemesisTaunt({ ...r, mobileType: MOBILE_TYPES.SabertoothTiger }, 'Ayla', () => 0), /^Grushnak the Butcher bares its teeth/, 'a beast does not talk');
  assert.match(N.nemesisFleeLine({ mobileType: MOBILE_TYPES.Orc }, 'Mighty Orc'), /^Mighty Orc breaks and runs! "This isn't over!"$/);
  assert.equal(N.nemesisEscapeLine(r), 'Grushnak got away. Grushnak the Butcher will remember this.');
  assert.equal(N.nemesisSlainLine(r), 'Grushnak the Butcher has fallen. Your nemesis is no more.');
});

test('NEMESIS ITS KEEPING: the save slot carries the records (never as out); the app\'s storage mirrors them per character, and the two merge by revision - an older save forgets no nemesis made since, nor raises one slain (mutants: no mirror; the older revision wins; out carried over a load)', () => {
  fresh();
  const me = player('char-keep');
  const r = N.nemesisDeed(me, orc(), 'slew', { now: 10, rolls: () => 0 });
  const saved = modSaveRecords()[N.NEMESIS_SAVE];
  assert.equal(saved.list.length, 1); assert.equal(saved.list[0].out, false, 'never out across a load');
  assert.ok(_store.get(`${N.NEMESIS_STORE_PREFIX}char-keep`), 'mirrored under the character');
  // made since the save: a second, and the first slain
  const r2 = N.nemesisDeed(me, orc({ champion: 'swift' }), 'fled', { now: 20, rolls: () => 0 });
  N.nemesisSlain(me, { nemesis: { id: r.id } }, { now: 30 });
  // the old save restored
  restoreModSaveRecords({ [N.NEMESIS_SAVE]: saved });
  assert.equal(N.nemesisById(r.id).defeated, false, 'before the mirror is read: the save\'s word');
  N.nemesisToReturn(me, { now: 0 });   // any ask reads the mirror in
  assert.equal(N.nemesisById(r.id).defeated, true, 'the slain stays slain');
  assert.ok(N.nemesisById(r2.id), 'the one made since is kept');
  // another character's mirror is its own
  N._resetNemesisForTests();
  N.nemesisToReturn(player('char-other'), { now: 0 });
  assert.equal(N.allNemeses().length, 0, 'another character: none of these');
  assert.deepEqual(N.mergeNemeses([{ ...saved.list[0], rev: 5, rank: 2 }], [{ ...saved.list[0], rev: 3, rank: 4 }])[0].rank, 2, 'the higher revision wins');
  assert.equal(N.mergeNemeses([{ id: 'bad' }], []).length, 0, 'a broken record is dropped');
});

test('NEMESIS THE HOSTS: the open world\'s pool rolls the flee once under a fifth, runs and escapes without a corpse, taunts once in sight, closes a slain one; the spawn stands its trait or glow, then its rank, before its loot; the world\'s roll stands a due one, whoever rolls the group\'s wanderers, and reads its presence and its notice', () => {
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(f\.fleeing\) \{\s*\n\s*if \(!\(f\.ai\.fleeLeft > 0\) \|\| Math\.hypot\(playerFeet\[0\] - f\.ai\.feet\[0\], playerFeet\[2\] - f\.ai\.feet\[2\]\) > NEMESIS_ESCAPE_DISTANCE\) escapeFoe\(f\);\s*\n\s*else _runStep\(\);\s*\n\s*continue;/, 'a running foe does nothing else but walk, and escapes out of reach');
  assert.match(x, /const _runStep = \(\) => \{ f\._mout = f\.mobile\.update\(dt, \{ moving: f\.ai\.moving, striking: false, rangedStriking: false, hurting: f\.ai\.hurtKnock, casting: false \}/, 'its walk drawn, no blow and no cast in it');
  assert.match(x, /if \(!f\._fleeRolled && _onMe && f\.ai\.isHostile && nemesisFleeHealth\(f\.entity\) && nemesisCandidate\(f\.entity, f\)\) \{\s*\n\s*f\._fleeRolled = true;\s*\n\s*if \(rollNemesisFlee\(f\.entity\)\) \{\s*\n\s*f\.fleeing = true;\s*\n\s*f\.ai\.flee\(playerFeet, NEMESIS_FLEE_SECONDS\);/, 'once, under the line, mine on me');
  assert.match(x, /function escapeFoe\(f\) \{\s*\n\s*releaseFoeBatch\(f\);\s*\n\s*f\.dead = true;[\s\S]{0,300}nemesisDeed\(playerEntity, f\.entity, 'fled'/, 'gone without a corpse, made a nemesis');
  assert.doesNotMatch(x.slice(x.indexOf('function escapeFoe(f)'), x.indexOf('function escapeFoe(f)') + 600), /f\.corpse = true|sayEnemyDied|reportPlayerKill/, 'no corpse, no kill');
  assert.match(x, /if \(f\.entity\.nemesis && !f\._taunted && _onMe && f\.ai\.inSight/, 'the taunt, once a return');
  assert.match(x, /if \(f\.entity\?\.nemesis\) \{ const nr = nemesisSlain\(playerEntity, f\.entity\); if \(nr && !peer\) nemesisSay\(nemesisSlainEvent\(nr, playerEntity\?\.name, \{ archive: f\.archive \}\), say\); \}/, 'slain at last');
  const spawn = x.slice(x.indexOf('async function spawnFoe('), x.indexOf('const gender = MobileUnit.resolveGender'));
  assert.match(spawn, /nemesis \? nemesis\.elite : rollOverworldElite\(Math\.random\)/, 'an elite stands as one again, never a fresh roll');
  assert.match(spawn, /nemesis \? \(nemesis\.trait \? championIndex\(nemesis\.trait\) : null\)/, 'its trait, never a fresh one');
  const iApply = spawn.indexOf('applyNemesis(entity, nemesis)'), iLoot = spawn.indexOf('spawnEnemyLoot(entity');
  assert.ok(iApply > spawn.indexOf('applyChampion(entity') && iApply < iLoot, 'its rank over its trait, before its loot');
  assert.match(spawn, /if \(entity\.nemesis\) grantNemesisLoot\(entity, builtLevel\);/);
  const w = read('src/scenes/world.js');
  assert.match(w, /const _nemesis = hit && _m === 'exterior' \? nemesisToReturn\(playerEntity, \{ now \}\) : null;\s*\n\s*if \(_nemesis\) \{ _standEncounterFoe\(\{ \.\.\.hit, mobileType: _nemesis\.mobileType, nemesis: _nemesis \}, playerFeet\); break; \}\s*\n\s*if \(hit && _rollsForGroup\)/, 'before the group\'s gate - a nemesis is the player\'s own');
  assert.match(w, /\.\.\.\(hit\.nemesis \? nemesisSpawnOptions\(hit\.nemesis, effectiveLevel\(playerEntity\)\) : \{\}\)/);
  assert.match(w, /nemesisPresence\(exteriorFoes\.foes, \{ now \}\);\s*\n\s*nemesisSay\(takeNemesisNotice\(playerEntity\), \(l\) => townTalk\.say\(l\)\);/);
});
