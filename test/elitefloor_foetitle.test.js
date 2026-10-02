// ELITE-FLOOR + FOE-TITLE (2026-10-02, Mac: "Do it" - the two cheap wins of the elites-and-champions review).
//   - ELITE-FLOOR: an elite is never a foe under ELITE_FOE_MIN_LEVEL (LOOT7's floor), the city watch, or an ally; a
//     refused promotion leaves the foe as it was built, and the dungeon's build arm falls through to its plain path.
//   - FOE-TITLE: one home names a special foe on every surface - a nemesis by its own name, a champion by its trait,
//     an elite as "Elite" - the target bar, the hover, the death line and the body's title alike.
//   - ELITE-RARITY (Mac: "ensure elite spawns arent over abundant. I think theyre common right now"): one foe in fifty
//     in the open world, past a gate - none while one stands near, none within three hours of the last of mine, never
//     a loose stand; a normal dungeon one time in ten. The Elite Dungeon keeps its 3 or 4 (Mac's own number).

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foeTitle } from '../src/systems/foeTitle.js';
import { promoteEliteFoe, eliteEligible, ELITE_FOE_MIN_LEVEL, ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT, grantEliteLoot, overworldEliteAllowed, pickDungeonElites, ELITE_FOE_OVERWORLD_CHANCE, ELITE_FOE_OVERWORLD_GAP_MINUTES, ELITE_FOE_NORMAL_DUNGEON_CHANCE, ELITE_FOE_DUNGEON_MIN, ELITE_FOE_DUNGEON_MAX } from '../src/systems/eliteFoes.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';
import { championName } from '../src/systems/champions.js';
import { liveEntityName } from '../src/systems/worldTooltips.js';
import { markFoeStruck, foeTarget, clearFoeTarget } from '../src/ui/hudFoeTarget.js';
import { KNIGHT_CITY_WATCH } from '../src/characters/mobileTypes.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const foe = (over = {}) => ({ level: 5, mobileType: 7, health: 40, maxHealth: 40, team: 'Monster', ...over });

test('ELITE-FLOOR: under level 3, the watch and an ally are never elites - the foe stands as built; a puppet takes its owner\'s word (mutants: no floor; the watch promoted; an ally promoted; the puppet refused)', () => {
  assert.equal(ELITE_FOE_MIN_LEVEL, 3, 'LOOT7\'s champion floor');
  for (const [why, e] of [['level 2', foe({ level: 2 })], ['the watch', foe({ mobileType: KNIGHT_CITY_WATCH })], ['an ally', foe({ team: 'PlayerAlly' })], ['an ally by its copy', foe({ mobileTeam: 'PlayerAlly' })]]) {
    assert.equal(eliteEligible(e), false, why);
    assert.equal(promoteEliteFoe(e), false, `${why}: refused`);
    assert.equal(e.eliteFoe, undefined, `${why}: no mark`);
    assert.equal(e.maxHealth, 40, `${why}: its health as built`);
    assert.equal(e.damageScale, undefined, `${why}: its blows as built`);
    grantEliteLoot(e, 5, () => 0.5);
    assert.equal(e.items, undefined, `${why}: no elite drop`);
  }
  const ok = foe();
  assert.equal(promoteEliteFoe(ok), true);
  assert.equal(ok.eliteFoe, true);
  assert.equal(ok.maxHealth, 40 * ELITE_FOE_HEALTH_MULT);
  assert.equal(ok.damageScale, ELITE_FOE_DAMAGE_MULT);
  assert.equal(promoteEliteFoe(ok), true, 'idempotent: already one');
  assert.equal(ok.maxHealth, 40 * ELITE_FOE_HEALTH_MULT, '...and never twice');
  const pup = foe({ level: 1 });
  assert.equal(promoteEliteFoe(pup, { own: false }), true, 'a puppet stands as its owner\'s elite - the owner asked the floor');
  assert.equal(pup.maxHealth, 40, '...its maximum the owner\'s word');
});

test('ELITE-FLOOR: the dungeon\'s build arm promotes only when the promotion stands - a refused one falls through to the plain build (the Elite Dungeon\'s doubling, LOOT7\'s champion arm)', () => {
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /if \(e\?\.eliteFoe && entity && promoteEliteFoe\(entity, \{ eliteDungeon: !!e\.elite, checkLevel: false \}\)\) \{ if \(e\.elite\) entity\.elite = true; return; \}\s*(?:\/\/[^\n]*)?\n\s*if \(!e\?\.elite \|\| !entity\) return void applyChampion\(entity, e\?\.champion\);/);
});

test('FOE-TITLE: a nemesis by its name, a champion by its trait, an elite as Elite, anyone else as it was - on the target bar, the hover, the death line and the body alike (mutants: the elite unnamed off the target bar; the nemesis named by its kind)', () => {
  assert.equal(foeTitle({}, 'Orc'), 'Orc');
  assert.equal(foeTitle({ champion: 'mighty' }, 'Orc'), 'Mighty Orc');
  assert.equal(foeTitle({ eliteFoe: true }, 'Orc'), 'Elite Orc');
  assert.equal(foeTitle({ nemesis: { name: 'Grushnak the Butcher' }, eliteFoe: true }, 'Orc'), 'Grushnak the Butcher', 'a nemesis is its own name');
  assert.equal(foeTitle({ eliteFoe: true }, null), null, 'no name, nothing to dress');
  // every surface asks the one home
  const elite = foe({ eliteFoe: true });
  assert.equal(championName(elite, 'Orc'), 'Elite Orc', 'the death line and the body (championName)');
  assert.equal(liveEntityName({ entity: elite }, 'Orc'), 'Elite Orc', 'the hover');
  clearFoeTarget();
  markFoeStruck({ entity: { ...elite, name: 'Orc' }, dead: false });
  assert.equal(foeTarget().name, 'Elite Orc', 'the target bar');
  clearFoeTarget();
  for (const f of ['src/ui/hudFoeTarget.js', 'src/systems/worldTooltips.js', 'src/systems/champions.js']) {
    assert.match(read(f), /import \{ foeTitle \} from '[./]+(?:systems\/)?foeTitle\.js';/, `${f} asks the one home`);
  }
  assert.doesNotMatch(read('src/systems/foeTitle.js'), /^import /m, 'a leaf: the HUD\'s leaves may ask it');
});

test('ELITE-RARITY: the gate - none while one stands near, none within the gap of the last, a clock gone back frees it (mutants: the gate ignores the standing one; the gap off by its edge; a load holds the gap)', () => {
  assert.equal(ELITE_FOE_OVERWORLD_CHANCE, 0.02, 'one in fifty (was one in twenty)');
  assert.equal(ELITE_FOE_OVERWORLD_GAP_MINUTES, 180, 'a quarter hour of play at 12x');
  assert.equal(overworldEliteAllowed({ now: 500 }), true, 'none yet: free');
  assert.equal(overworldEliteAllowed({ now: 500, liveElites: 1 }), false, 'one standing: none');
  assert.equal(overworldEliteAllowed({ now: 500, lastAt: 400 }), false, '100 minutes on: still in the gap');
  assert.equal(overworldEliteAllowed({ now: 579, lastAt: 400 }), false, 'a minute short');
  assert.equal(overworldEliteAllowed({ now: 580, lastAt: 400 }), true, 'the gap spent');
  assert.equal(overworldEliteAllowed({ now: 580, lastAt: 400, liveElites: 2 }), false, '...but not while one stands');
  assert.equal(overworldEliteAllowed({ now: 100, lastAt: 400 }), true, 'an older save loaded: the clock went back, the gap is no one\'s');
});

test('ELITE-RARITY: the dungeons - a normal one holds one about one time in ten, an Elite Dungeon still 3 or 4 (mutants: the old one in five; the Elite Dungeon thinned)', () => {
  assert.equal(ELITE_FOE_NORMAL_DUNGEON_CHANCE, 0.1);
  assert.deepEqual([ELITE_FOE_DUNGEON_MIN, ELITE_FOE_DUNGEON_MAX], [3, 4], 'Mac\'s own "3 - 4 times in Elite Dungeons"');
  const list = () => Array.from({ length: 40 }, () => ({ mobileType: 7 }));
  let normal = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) normal += pickDungeonElites(list(), `loc${i}`, { elite: false });
  assert.ok(normal / N > 0.08 && normal / N < 0.12, `about one in ten (${normal}/${N})`);
  for (let i = 0; i < 200; i++) {
    const n = pickDungeonElites(list(), `loc${i}`, { elite: true });
    assert.ok(n >= 3 && n <= 4, `an Elite Dungeon: ${n}`);
  }
});

test('ELITE-RARITY: the open world\'s pool, online - a camp that wins every roll stands ONE elite, the next within the gap none, the next past it one; a loose stand never; a returning elite nemesis outside the gate (mutants: the gap unset at the promotion; the loose stand promoted; the nemesis gated)', async () => {
  const careers = (() => {
    const b = new Uint8Array(74); const v = new DataView(b.buffer);
    b[10] = 0x08; v.setUint16(52, 4, true);
    for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true);
    const NAME_FIELD = 14, ENTRY = 18, out = new Uint8Array(4 + b.length + ENTRY), dv = new DataView(out.buffer);
    dv.setInt16(0, 1, true); dv.setUint16(2, 0x0100, true); out.set(b, 4);
    const name = 'ENEMY002.CFG';
    for (let i = 0; i < name.length; i++) out[4 + b.length + i] = name.charCodeAt(i);
    dv.setInt32(4 + b.length + NAME_FIELD, b.length, true);
    return out;
  })();
  const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
  let minute = 1000;
  const pool = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return careers; throw new Error(`no ${n} here`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => minute, currentPixelKey: () => '3,12', inLocation: () => false,
    playerEntity: { level: 10, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 },
    audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
  });
  pool.setNet({ room: () => 'r' });   // online: a host in a room
  const real = Math.random;
  Math.random = () => 0;   // every roll won
  try {
    const camp = await Promise.all([0, 1, 2, 3].map((i) => pool.spawnFoe(2, [i * 3, 0, 0], { feetGiven: true, level: 5 })));
    assert.equal(camp.filter((f) => f?.entity.eliteFoe).length, 1, 'a camp of four that wins every roll: one elite');
    for (const f of camp) f.dead = true;
    minute += 60;
    const soon = await pool.spawnFoe(2, [0, 0, 20], { feetGiven: true, level: 5 });
    assert.equal(!!soon.entity.eliteFoe, false, 'an hour on, the last one dead: still in the gap');
    soon.dead = true;
    minute += ELITE_FOE_OVERWORLD_GAP_MINUTES;
    const loose = await pool.spawnFoe(2, [0, 0, 30], { feetGiven: true, level: 5, loose: true });
    assert.equal(!!loose.entity.eliteFoe, false, 'a loose stand (a summoning\'s squad), even past the gap: never');
    loose.dead = true;
    const later = await pool.spawnFoe(2, [0, 0, 40], { feetGiven: true, level: 5 });
    assert.equal(later.entity.eliteFoe, true, 'past the gap: one again');
    const nem = await pool.spawnFoe(2, [0, 0, 50], { feetGiven: true, level: 5, nemesis: { id: 'n1', name: 'Grushnak the Butcher', rank: 1, elite: true, trait: null, returns: 0, history: [] } });
    assert.equal(nem.entity.eliteFoe, true, 'an elite nemesis stands as one, the gate and an elite standing notwithstanding');
  } finally { Math.random = real; pool.destroy?.(); }
});
