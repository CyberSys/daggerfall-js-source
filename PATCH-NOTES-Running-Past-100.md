# Patch Notes: Running past 100

## Running, Swimming, Climbing and Jumping
No spam protection, because running a lot is the normal way to use the skill. Instead, **only real movement counts past 100**. Holding the run key while standing still or running against a wall won't count, so nobody can train it AFK.

- **Running:** only the ground you actually cover counts. Sliding along a wall counts for the part you really moved.
- **Swimming:** swimming through the water counts, and so does diving. Treading water in place doesn't.
- **Climbing:** only climbing up or down the wall counts. Pressing into a wall you can't climb, or into a ledge above you, doesn't.
- **Jumping:** a jump that carries you somewhere counts. Jumping in place doesn't.
- Being carried doesn't count, for example standing on someone's boat.
- **Below 100 nothing changes.** Training and quests still raise these skills as before.

Estimated time with that, if you run constantly:

| Level | 100 → 125 | → 150 | → 200 |
|---|---|---|---|
| 20 | about 35 hours | about 120 hours | about 540 hours |
| 30 | about 50 hours | about 175 hours | about 800 hours |

## Fixes
- **The Master Skills button opens the Master Skills page again.** On the Enhanced Plus Stats page it was showing the Character page instead.

---

## For developers
- `src/systems/skillSoftcap.js` (MOVE-REAL): `MOVEMENT_SKILLS` (Jumping and Running across the ground with a 1 m stride, Swimming either axis with 3 m, Climbing up or down with 0.5 m) and `movementTallyWeight`. A motion use at 100+ takes no spam weight and no foe. It weighs the metres of its axis since that skill's last use, divided by its stride. What is left over carries to the next use, capped at `MOVE_CREDIT_CAP` (2).
- `src/player/motor.js`: `odometer` { h, v } counts the body's own physics steps only. A step faster than `ODOMETER_MAX_SPEED` (60 m/s) counts as a placement, not movement. `carryBy`, `pinFeet`, spawns and origin shifts all happen outside the steps, so they never count.
- `src/systems/skills.js` `tallyMovementSkill` is the motion door. worldTick's Running, Jumping and Swimming tallies use it, and so does the climb check (`scenes/shared.js climbingDeps`). Training, quests and hunting still call `tallySkill`, so the general law still applies to them.
- Every host (world, exterior, the interior, and both dungeon hosts through `reportActivity`) passes `odometer: player.odometer` with the tick's activity, and the tick puts it on the entity as `_odometer`. Nothing is saved.
- `src/ui/enhancedMenu.js` `pauseStats` (MASTER-DOOR): PROF1's guard sent any section off the rail back to Character, and that included the Master Skills page, whose only door is the button. The guard now lets `'master'` through.
- `test/move_real.test.js`.
