// ELITE-FLOOR + FOE-TITLE (2026-10-02, Mac: "Do it" - the two cheap wins of the elites-and-champions review).
//   - ELITE-FLOOR: an elite is never a foe under ELITE_FOE_MIN_LEVEL (LOOT7's floor), the city watch, or an ally; a
//     refused promotion leaves the foe as it was built, and the dungeon's build arm falls through to its plain path.
//   - FOE-TITLE: one home names a special foe on every surface - a nemesis by its own name, a champion by its trait,
//     an elite as "Elite" - the target bar, the hover, the death line and the body's title alike.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foeTitle } from '../src/systems/foeTitle.js';
import { promoteEliteFoe, eliteEligible, ELITE_FOE_MIN_LEVEL, ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT, grantEliteLoot } from '../src/systems/eliteFoes.js';
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
  assert.match(dc, /if \(e\?\.eliteFoe && entity && promoteEliteFoe\(entity, \{ eliteDungeon: !!e\.elite \}\)\) \{ if \(e\.elite\) entity\.elite = true; return; \}\s*(?:\/\/[^\n]*)?\n\s*if \(!e\?\.elite \|\| !entity\) return void applyChampion\(entity, e\?\.champion\);/);
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
