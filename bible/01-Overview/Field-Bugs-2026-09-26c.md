# FIELD BUGS 2026-09-26 (c) — SquidKamer on the sea's encounters

SquidKamer (Kamer - the author of Warm Ashes - Ships, `03-World/Warm-Ashes-Ships.md`) in the Discord's
`#developer-chat`, relayed by Mac ("Can you look into this"):

1. *"Just sp you know if the wa ships allies aren't attacking then my other modsmay have issues. I can work around it
   but other mods doing the same thing will lead to issues. So say we port some quests packs in ... We can use wa ships
   to test tge issue"*.
2. *"Also puddle no more (I suspect spawning enemies) are causing massive performance issues. So ship encounters you
   drop to 1 fps for a few seconds and get jumped by everyone"*.
3. *"I suspect enemies spawning in enhanced is more aggressive than dfu. That's cause no collision on monsters ≈ free
   space to spawn enemy always. Probably why puddle and wa encounters are so more aggressive in general"*; *"Even then I
   think puddle no more is too aggressive on top of the free area spawn. I jumped in last night and it summoned an army
   of everything."*

## WA-ALLIES: `change foe ... infighting` lands, so a quest's allies fight (report 1)

WAQ_SHIP_SMALLRAID (`vendor/warm-ashes-ships/Quests/`) musters the ship's crew with `change foe _ally_ team 1`
(PlayerAlly) and `change foe _X_ infighting true` for every foe, re-applied every quest tick by an always-on
`daily from 00:00 to 24:00` task. The team landed. The infighting flag never did: `ChangeFoeInfighting`
(`systems/quest/actions.js`) wrote `inst.behaviour`, and the hosts' instance walk (`questFoeInstances`, world.js /
exterior.js / worldModes.js `liveQuestFoes`) answers foe RECORDS, which keep the QuestResourceBehaviour as
`questBehaviour` (`scenes/questFoeHost.js bindQuestFoeHost`; `behaviour` is the name only on a spawn handle). The
write was skipped and the action completed anyway, silently. So every quest foe stayed one that targets only the player
and that nobody may target (EnemySenses.GetTargets :806-807, :814-815, the port's `enemyTargets.js getTargets`): the
crew stood idle, and the raiders fought the player alone. Every host was affected, and every quest using the action.

Each half had been pinned apart: `test/enemyinfighting.test.js` wrote to fixtures shaped `{ behaviour }`, and
`test/dungeoninfighting.test.js` read `questBehaviour`. No test ran the action against a real record. The action now
writes the record's `questBehaviour`, the fixtures are the record's shape, and `test/waallies.test.js` runs the author's
own quest through the machine over records of the exterior pool's shape, then the real target machine: the crew takes
a raider and the raider the crew, and neither ever targets the player's side wrongly.

As in DFU, with "Enemies fight each other" off the allies still stand idle: the else-arm reads the mobile's own team,
which `change foe ... team` does not touch (EnemySenses.cs :801). The setting ships on.

`test/waallies.test.js` (3); `test/enemyinfighting.test.js` re-aimed; `tools/mutants/waallies.json` 3, 3 dead.
