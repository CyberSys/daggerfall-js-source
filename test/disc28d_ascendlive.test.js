// ASCEND-LIVE (2026-09-28, Discord, Megatronism: "The permanent stat bonuses from being a werewolf (vampire, etc...)
// do not appear on the level up screen, only showing what your stats would be before the bonuses were applied. You
// can actually put points into an already maxed out attribute if you are not careful, and waste part of your level
// up"). Every lane spends and caps the PERMANENT value, and still does - DFU's StatsRollout draws and caps
// GetPermanentStatValue, the mod reads `.base` - but the curse's +40 rides the live channel, so the Ascension's stars
// said 63 for a werewolf whose Stats page says 100. A star now wears the LIVE value (liveStat's own law over the
// working permanent value), and the chosen star's line says so - and, where a point would not show, that it would not.
// Fixtures from the port's own mints: createCharacter, the curse's own round, the screens themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createCharacter } from '../src/systems/chargen.js';
import { SKILLS } from '../src/systems/skills.js';
import { createLycanthropyCurse, lycanthropyMagicRound } from '../src/systems/lycanthropy.js';
import { createVampirismCurse, vampirismMagicRound } from '../src/systems/vampirism.js';
import { LYCANTHROPY_TYPES } from '../src/systems/infection.js';
import { liveStat } from '../src/systems/statMods.js';
import { isDayFromMinutes, CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { LevelUpScreen } from '../src/ui/charsheet.js';
import { VirtueLevelUpScreen } from '../src/ui/virtueLevelUp.js';
import { rolloutRows, liveNote, viewOnlyScreen, raiseAt, focusAt, canAscend } from '../src/ui/levelUpView.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { initVirtueLeveling, LEVELING_VIRTUE, levelingSettings, ORL_VENDOR } from '../src/systems/oblivionLeveling.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
// The report's own figure: Strength 63 and Endurance 58 permanent under a werewolf's +40.
const REPORT = { strength: 63, intelligence: 100, willpower: 52, agility: 53, endurance: 58, personality: 52, speed: 50, luck: 57 };
const NIGHT = (() => { let m = CLASSIC_GAME_START_TIME; while (isDayFromMinutes(m)) m += 60; return m; })();
const DAY = (() => { let m = NIGHT; while (!isDayFromMinutes(m)) m += 60; return m; })();
function character() {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  Object.assign(p.stats, REPORT);
  p.readyToLevelUp = true; p.pendingLevel = (p.level ?? 1) + 1;
  return p;
}
function werewolf() {
  const p = character();
  assert.ok(createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: NIGHT }));
  lycanthropyMagicRound(p, { nowMinutes: NIGHT + 1 });
  assert.equal(liveStat(p, 'strength'), 100, 'the curse\'s +40, read through liveStat itself');
  return p;
}
const row = (screen, key) => rolloutRows(screen).find((r) => r.key === key);

test('ASCEND-LIVE: the report - a werewolf\'s stars wear what the character HAS, and a point that cannot show says so', () => {
  const p = werewolf();
  const s = new LevelUpScreen(p, seq(0), { fanfare: false });
  const str = row(s, 'strength');
  assert.deepEqual([str.value, str.live, str.capped, str.canRaise], [63, 100, true, true],
    'permanent 63 (what the presses move, DFU\'s law), live 100 (what the Stats page shows), and a press the law allows that cannot show');
  assert.equal(liveNote(str), '100 with its bonus - a point here shows only once that ends');
  assert.deepEqual(['agility', 'endurance', 'speed'].map((k) => [row(s, k).live, row(s, k).capped]), [[93, false], [98, false], [90, false]]);
  assert.equal(liveNote(row(s, 'agility')), '93 with its bonus');
  assert.deepEqual([row(s, 'willpower').live, liveNote(row(s, 'willpower'))], [52, ''], 'a stat the curse leaves alone says nothing more');
  // The live value follows the WORKING value: Endurance 58 + 40 = 98, two points from the ceiling.
  focusAt(s, 'endurance');
  assert.ok(raiseAt(s, 'endurance') && raiseAt(s, 'endurance'));
  assert.deepEqual([row(s, 'endurance').value, row(s, 'endurance').live, row(s, 'endurance').capped], [60, 100, true]);
  // ...and the law is untouched: the permanent point still goes in, and the window closes the same way.
  assert.ok(raiseAt(s, 'strength'));
  assert.deepEqual([row(s, 'strength').value, row(s, 'strength').live], [64, 100]);
  assert.equal(canAscend(s), s.pool === 0);
});

test('ASCEND-LIVE: a vampire by day reads lower and by night higher - the live value is the clock\'s, as the Stats page\'s is', () => {
  const p = character();
  assert.ok(createVampirismCurse(p, 0, { now: NIGHT }));
  vampirismMagicRound(p, { nowMinutes: DAY });
  const s = new LevelUpScreen(p, seq(0), { fanfare: false });
  assert.deepEqual([row(s, 'strength').value, row(s, 'strength').live], [63, 43]);
  assert.equal(liveNote(row(s, 'strength')), '43 for now');
  vampirismMagicRound(p, { nowMinutes: NIGHT + 24 * 60 });
  assert.equal(row(new LevelUpScreen(p, seq(0), { fanfare: false }), 'strength').live, 83);
});

test('ASCEND-LIVE: the mod\'s lane and the view the Stats page opens read the same live values the Stats page draws', () => {
  const p = werewolf();
  const view = viewOnlyScreen(p, false);
  assert.deepEqual(rolloutRows(view).map((r) => r.live), sheetModel(p).attributes.map((a) => a.value),
    'Ascend from the Stats page shows the Stats page\'s numbers');
  // A view has no points to place, so no star warns about one: the bonus is said, the press is not.
  assert.deepEqual([row(view, 'strength').capped, liveNote(row(view, 'strength'))], [false, '100 with its bonus']);
  initVirtueLeveling(p, LEVELING_VIRTUE);
  const reader = (k) => MOD_SETTINGS[ORL_VENDOR].keys[k].default;
  const v = new VirtueLevelUpScreen(p, { settings: levelingSettings(reader), rolls: seq(0), fanfare: false });
  assert.deepEqual([row(v, 'endurance').value, row(v, 'endurance').live], [58, 98]);
  focusAt(v, 'endurance');
  assert.ok(raiseAt(v, 'endurance'));
  assert.ok(row(v, 'endurance').live > 98, 'the mod\'s delta moves the live value too');
});

test('ASCEND-LIVE by source: the window paints the live value on the star, its brightness and its line', () => {
  const w = readFileSync(new URL('../src/ui/enhancedLevelUp.js', import.meta.url), 'utf8');
  assert.match(w, /s\.val\.textContent = String\(r\.live\);/);
  assert.match(w, /starBrightness\(r\.live\)/);
  assert.match(w, /s\.node\.classList\.toggle\('boosted', r\.live > r\.value\);/);
  assert.match(w, /pickL\.textContent = liveNote\(row\);/);
  assert.match(w, /pickName\.append\(pickN, pickF, pickC, pickL\);/);
});
