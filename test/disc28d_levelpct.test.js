// LEVEL-PCT (2026-09-28, Discord, dragonatg: "The level progress is inconsistent between the Uis. On GrimoireUi a
// level progress of 93% is only 12/100 on EnhancedPlus."). GrimoireUI is the classic skin under an art pack, so its
// Level box is the classic sheet's (ui/charsheet.js _showLevel), and that box always printed DFU's skill-sum fraction.
// A character ORL1's bar levels (the mod's law, chosen at creation) still has that sum kept (advancement.js
// raiseSkills) but it levels nothing: the Ascension's crown read the bar (12/100), the box the sum (93%). The box now
// reads the character's own law. And its DFU arithmetic is DFU's precision: `float currentLevel` is a single, and in
// a double two spans in fifteen read a point off what DFU's box reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CharSheet, CHARSHEET_RECTS, levelProgressPercent } from '../src/ui/charsheet.js';
import { levelProgress, viewOnlyScreen } from '../src/ui/levelUpView.js';
import { initVirtueLeveling, LEVELING_VIRTUE, LEVELING_CLASSIC, LEVELUP_TOTAL } from '../src/systems/oblivionLeveling.js';
import { createCharacter } from '../src/systems/chargen.js';
import { raiseSkills, skillUsesForAdvancement, SKILL_ADVANCEMENT_MULTIPLIER } from '../src/systems/advancement.js';
import { SKILLS } from '../src/systems/skills.js';
import { CLASSIC_GAME_START_TIME as T0 } from '../src/systems/gameDate.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};
// The report's own history through the port's own producers: a character minted, its law answered, then one skill
// pass raising a primary (the bar +8, the sum +1) and two misc skills (the bar +2 each, the sum untouched) - the bar
// at 12 and the sum one past its anchor, which DFU's arithmetic reads as 93%.
function played(system) {
  const p = { isPlayer: true, reflexes: 2, items: [] };
  createCharacter(p, career, 16, { rolls: seq(0) });
  initVirtueLeveling(p, system);
  const skills = [SKILLS.Etiquette, SKILLS.Backstabbing, SKILLS.LongBlade];
  for (const s of skills) p.skillUses[s] = skillUsesForAdvancement(p.skills[s], SKILL_ADVANCEMENT_MULTIPLIER[s], 1.0, p.level);
  assert.deepEqual(raiseSkills(p, T0 + 361, seq(0), () => {}), skills, 'one pass raises all three');
  return p;
}
const box = (entity) => {
  const w = new CharSheet(entity, {});
  const [x, y, ww, h] = CHARSHEET_RECTS.level;
  w.click(x + ww / 2, y + h / 2);
  return w.child.lines;
};

test('LEVEL-PCT: the report - a character the bar levels reads the bar on the classic Level box, as the Ascension does', () => {
  const v = played(LEVELING_VIRTUE);
  assert.equal(v.currentLevelUpSkillSum - v.startingLevelUpSkillSum, 1, 'the sum moved one, as it does for everyone');
  assert.equal(v.levelProgress, 12, 'the bar took 8 + 2 + 2');
  assert.deepEqual(levelProgress(v, viewOnlyScreen(v, true)), { now: 12, max: LEVELUP_TOTAL, carried: 0, label: 'Toward the next' });
  assert.deepEqual(box(v), ['Progress made to the next level: 12%'], 'the box reads the law that levels this character (was 93%)');
  // The same history on DFU's law: the bar never moved, and both screens read the sum - 93% and 14 of 15.
  const c = played(LEVELING_CLASSIC);
  assert.equal(c.levelProgress, 0);
  assert.deepEqual(box(c), ['Progress made to the next level: 93%']);
  assert.deepEqual(levelProgress(c, viewOnlyScreen(c, false)), { now: 14, max: 15, carried: 0, label: 'Skill sum toward the next' });
});

test('LEVEL-PCT: the bar reads the same on both screens at its ends - held to 0..100, a full bar 100%', () => {
  const v = played(LEVELING_VIRTUE);
  for (const [bar, pct] of [[0, 0], [99, 99], [LEVELUP_TOTAL, 100], [LEVELUP_TOTAL + 40, 100], [-5, 0]]) {
    v.levelProgress = bar;
    assert.equal(levelProgressPercent(v), pct, `bar ${bar}`);
    assert.equal(levelProgress(v, viewOnlyScreen(v, true)).now, pct, `the crown's bar ${bar}`);
  }
});

test('LEVEL-PCT: the classic box is LevelButton_OnMouseClick in DFU\'s own precision (`float currentLevel`, a single)', () => {
  // (current - starting + 28) / 15f, its fraction truncated to a percent - the values DFU's single-precision
  // arithmetic prints, spans 26 to 41. A double reads 27 as 80 and 36 as 39; DFU prints 79 and 40 (and 59 at 39).
  const dfu = [73, 79, 86, 93, 0, 6, 13, 20, 26, 33, 40, 46, 53, 59, 66, 73];
  const port = dfu.map((_, i) => levelProgressPercent({ startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 98 + i }));
  assert.deepEqual(port, dfu);
});
