# Master Skills, Tougher Dungeons and Mentoring

## Master Skills: skills past 100
Skills no longer have to stop at 100. The new hard cap is **200**. Everything up to 100 works exactly as before.

- **100 to 125:** about 4x slower per point.
- **125 to 150:** about 8x slower per point.
- **150 to 200:** about 16x slower per point. This is the long-term grind.

Each point above 100 gives 25% of the benefit of a point below 100. Milestones at **125, 150, 175 and 200** add an extra boost and are announced with a fanfare. A skill at 200 fights like a 140.

### Mastering skills (2 / 2 / 1)
Master Skills lifts Daggerfall's old lock that froze your other skills at 95 once you mastered a primary skill, so **every skill can reach 100**. But only skills you **master** can go past 100:

- **2** of your 3 primary skills
- **2** of your 3 major skills
- **1** of your 6 minor skills

When a skill reaches 100 and its group still has a free slot, the game asks whether you want to master it. It tells you how many skills of that group you can master and how many are left. **This decision cannot be undone.** If you say no, you can still master it later from your skill screen. Miscellaneous skills always stop at 100. Mastered skills are marked in gold on every skill screen.

**Where to find it:** on the Enhanced Plus Stats page, a **Master Skills** button sits next to Ascend (highlighted with a count when a skill is ready). Its page lists your primary, major and minor skills in three groups, each showing its free slots. Every skill shows its value and bar and, on the right, either a gold **Mastered** tag, a **Master** button (asks before it commits), or why not yet ("12 to 100", "No slot left"). On the Skills list, a mastered skill gets a gold name and a gold bar under it for its climb from 100 to 200. On the classic sheet, the primary, major and minor pages show "Mastered 1/2 (M)"; click it or press M to choose.

**Online** Master Skills is always on; the first mastery question also explains how it works. **Offline** you choose: the first time you master a primary skill you're asked whether to activate Master Skills, and you can switch it on or off at any time in your skill screen (not inside a dungeon). Switching off never deletes anything: skills above 100 show as 100 until you switch it back on.

## No easy grinding (skills at 100 and above only)
Below 100, skills rise exactly as before. Past 100, a skill only learns from enemies that are tough **for that skill**; weak enemies and repeating the skill give little or nothing. The tougher the enemy, the better the gain.

## Tougher dungeons, by where you are
Dungeons now answer a strong character. This starts as your three best combat or magic skills climb past 75, is fully felt at 100, and keeps growing as they climb toward 200. It needs Master Skills (always on online).

Against a strong enemy in the most dangerous dungeons:

| Your best combat skills | Enemy hit and dodge | Enemy health | Enemy damage |
|---|---|---|---|
| 80 | +2 | ×1.2 | ×1.05 |
| 90 | +6 | ×1.6 | ×1.15 |
| 100 | +10 | ×2.0 | ×1.25 |
| 150 | +21 | ×2.6 | ×1.4 |
| 200 | +36 | ×3.4 | ×1.6 |

How dangerous the dungeon is decides how much of that applies:

| Dungeon | Scaling | Enemy health at 100 | at 200 |
|---|---|---|---|
| Mine, Natural Cave | 11% | ×1.11 | ×1.26 |
| Human Stronghold, Ruined Castle, Spider Nest, Cemetery | 22% | ×1.22 | ×1.53 |
| Harpy Nest, Prison, Scorpion Nest | 44% | ×1.44 | ×2.06 |
| Crypt, Orc Stronghold, Giant Stronghold | 88% | ×1.88 | ×3.1 |
| Laboratory, Barbarian Stronghold, Coven, Vampire Haunt, Desecrated Temple, Dragon's Den, Volcanic Caves | 100% | ×2.0 | ×3.4 |
| Wilderness by day | 22% | ×1.22 | ×1.53 |
| Wilderness at night | 44% | ×1.44 | ×2.06 |

- **Weak creatures stay weak**, even in a dangerous dungeon (a rat is still a rat).
- Tougher enemies also teach your skills above 100 more.
- **The wilderness counts too:** 22% by day and 44% at night, the same rules as dungeons (so strong wilderness enemies also teach your skills past 100).
- Towns, cities and the grounds of other locations never change. Offline with Master Skills off, everything stays classic.

## Mentoring (automatic)
Party up with players well below your level (3 levels or more) and you automatically become their mentor:

- Your level, skills, attributes, health and gear are brought down to about your group's level while you play together.
- Enemies, loot and your spells match the group's level, so the fight stays fair and your friends' contributions matter.
- Weak enemies still teach your skills above 100 nothing, so there's no farming or power-levelling.
- Your real progress is never touched. It returns the moment you leave the group.

Type **/mentor** to see whether you're mentoring right now.

## All UIs
Every skill screen shows values up to 200 (classic sheet, Enhanced Plus stats page, level-up screens, notices). Enhanced Plus draws a gold second bar for 100–200 with milestone marks. While mentoring, skills show like "85 (150)". The Master Skills messages use Daggerfall's own message box on the classic skin (and so in any UI pack such as GrimoireUI) and the Yes/No/OK card on Enhanced Plus.

## Heads up
This project is in active development. Skill caps, progression speed and enemy strength may change between updates, and this can affect existing characters.

---

## For developers
- `src/systems/skillSoftcap.js` (SOFTCAP1/2): caps, cost ladder, `effectiveSkill`, milestones, the real-use weight (foe tier `5·level+30` against the REAL skill), `combatEdge` (mean effective gain of the three best combat/magic skills, 0..40; 0 while mentoring or while Master Skills is off), `dungeonShare` (the designed `DUNGEON_SHARE` table, one share per dungeon kind by DungeonTypes index; unknown = 0), `foeShare` (class 1; monsters clamp((level−4)/8, 0, 1)) and `veteranProgress` (three best combat/magic skills from 75 to 100, 0..1) and `progressionScaling` (two layers from the one `ENEMY_SCALING` tuning table - veteran at 100: skills +10, health +1.0, damage +0.25; overcap added at 200: skills +26, health +1.4, damage +0.35 - all times dungeonShare · foeShare; challenge level + skill bonus / 2).
- SOFTCAP5: the wilderness is an area too (`WILDERNESS_SHARE` day 0.22 / night 0.44), applied in `exteriorFoes.js` to the player's own non-allied foes when the host's `inLocation()` says the player is off every location's ground (world.js passes its location-rect test; other hosts default to no scaling).
- `src/characters/enemyEntity.js applyProgressionScaling`: skills, health, `damageScale`, and `challengeLevel` (what the foe teaches). The foe's real `level` is untouched, so spells, loot and gear are not scaled twice. Dungeon spawns only; puppets never.
- `src/systems/masterSkills.js` (SOFTCAP3): always in force online (`entity._online`, stamped each frame by world.js from `isOnlinePage()`); offline the player's switch (`entity.masterSkills`) with a dungeon gate. Off means skills read as 100 (`masterCappedSkill`), no tally weighting, no climb, the classic 95 lock and no enemy scaling. One-time boxes via `raisePlayerSkills`'s new `ask` presenter on a quiet pass: `info` (online, OK box) or `offer` (offline, Yes/No).
- `src/ui/yesNoBox.js`: `okOnly` mode, a single OK button (BUTTONS.RCI record 5) on the classic parchment and the enhanced card, answered by Return or O.
- `src/systems/mentorMode.js`: automatic (no switch, no save field); the mentored level now also drives which monsters spawn, rest/camp encounters, enemy attack speed, loot/gear/treasure piles and the mentor's own spell level; incoming spells are scaled like blows.
- SOFTCAP4 masteries (`masterSkills.js`): `MASTERY_SLOTS` {primary 2, major 2, minor 1}; `entity.masteredSkills` is permanent; only a mastered skill reads, tallies, raises or counts for the combat edge past 100 (`skillCanPassCap`, `masterCappedSkill(entity, raw, id)`). The choice is asked once per skill on a quiet pass (`nextMasteryChoice`, `entity.masteryPrompted`) and offered any time on the skill screens (classic: M / the row on a career page; Enhanced Plus: a button per candidate).
- Save: `skillUseFrac`, `skillProgress`, `masterSkills`, `masterSkillsAsked`, `masterSkillsInfoSeen`, `masteredSkills`, `masteryPrompted` (all optional).
- Wire: party pose `cl`, **RELAY_VERSION world131** (the relay must be redeployed for mentoring online; an old relay strips `cl` and nobody mentors).
- Pinned-source tests updated for the changed lines; the relay-version law has the world131 hash.
