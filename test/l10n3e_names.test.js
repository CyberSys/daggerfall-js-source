// L10N3e (2026-09-27): THE NAMES OF THINGS, IN THE PLAYER'S LANGUAGE. DFU names a place, a region, an enemy, a spell,
// an item, a magic item and a faction through TextManager's name lookups - GetLocalized*Name, a pack's table by the
// thing's own id, the game's canonical name where the language has none - and only where the name is SHOWN: the
// canonical name stays the key discovery, saves and quests read. The port's sites are read off the source by
// tools/l10nRouted.mjs's namedSites. Pinned here: every name lookup, file by file (NAMED - a site that goes back to the
// bare canonical name is a name no translation reaches), none of them made once at module load, the scan itself over a
// fixture, and the one lookup the port had to add, getLocalizedEnemyName.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as tm from '../src/systems/textManager.js';
import { namedSites } from '../tools/l10nRouted.mjs';

beforeEach(() => tm._resetTextManagerForTests());
const SITES = namedSites();

/** The name lookups, file by file. A new site raises its file's count here; a lost one fails. */
const NAMED = {
};

test('L10N3e names: the name lookups, file by file - none lost, every new one counted', () => {
  const counts = {};
  for (const s of SITES) counts[s.file] = (counts[s.file] ?? 0) + 1;
  assert.deepEqual(counts, NAMED);
});

test('L10N3e names: a name is looked up where it is shown - never once, at module load, where it would stay English whatever the language', () => {
  assert.deepEqual(SITES.filter((s) => s.loose).map((s) => `${s.file}:${s.line} ${s.via}`), []);
});

test('L10N3e the scan itself: the core\'s name lookups under any local name, a same-named function from elsewhere not counted, a lookup at load marked', () => {
  const root = mkdtempSync(join(tmpdir(), 'l10nnamed-'));
  try {
    mkdirSync(join(root, 'src/ui'), { recursive: true });
    writeFileSync(join(root, 'src/ui/a.js'), [
      "import { getLocalizedLocationName as place, getLocalizedEnemyName } from '../systems/textManager.js';",
      "import { getLocalizedItemName } from './elsewhere.js';",
      "export const FIRST = place(1, 'Daggerfall');",
      "export const shown = (f) => [getLocalizedEnemyName(f.id, f.name), getLocalizedItemName(3, 'x')];",
    ].join('\n'));
    assert.deepEqual(namedSites(root).map((s) => [s.file, s.line, s.via, s.loose]), [
      ['src/ui/a.js', 3, 'getLocalizedLocationName', true],
      ['src/ui/a.js', 4, 'getLocalizedEnemyName', false],
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('L10N3e getLocalizedEnemyName: a MobileTypes id reads the enemyNames row (a class at 43 + id - 128); a custom enemy, no list, or a short one answers the port\'s own name', () => {
  assert.equal(tm.getLocalizedEnemyName(0, 'Rat'), 'Rat', 'English: the port\'s own name');
  const rows = Array.from({ length: 62 }, (_, i) => `ennemi ${i}`);
  tm.patchLocaleTable('fr', 'Internal_Strings', [['enemyNames', rows.join('\n')]]);
  tm.setLocale('fr');
  assert.equal(tm.getLocalizedEnemyName(0, 'Rat'), 'ennemi 0');
  assert.equal(tm.getLocalizedEnemyName(42, 'Ancient Lich'), 'ennemi 42');
  assert.equal(tm.getLocalizedEnemyName(128, 'Mage'), 'ennemi 43', 'the first class');
  assert.equal(tm.getLocalizedEnemyName(146, 'Knight'), 'ennemi 61', 'the last class');
  assert.equal(tm.getLocalizedEnemyName(43, 'Custom Beast'), 'Custom Beast', 'no MobileTypes member: a custom enemy');
  assert.equal(tm.getLocalizedEnemyName(147, 'Custom Class'), 'Custom Class');
  assert.equal(tm.getLocalizedEnemyName('7', 'Giant'), 'ennemi 7', 'an id held as a string');
  tm.patchLocaleTable('fr', 'Internal_Strings', [['enemyNames', 'rat\nimp']]);
  assert.equal(tm.getLocalizedEnemyName(1, 'Imp'), 'imp');
  assert.equal(tm.getLocalizedEnemyName(5, 'Spriggan'), 'Spriggan', 'a short list: the port\'s own name');
});
